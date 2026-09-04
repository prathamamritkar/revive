import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { ReviveOrchestrator } from "./src/engine/orchestrator";
import { SYNTHETIC_BATCH_50 } from "./src/data/syntheticBatch";
import { generateTwimlVoiceRecovery } from "./src/engine/dispatcher";
import { ExecutionMode, TelemetryEvent } from "./src/engine/types";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "revpulse_secret_2026";
  const processedEventCache = new Map<string, number>(); // 5-minute sliding window deduplication

  app.use(cors());
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );

  // Singleton Orchestrator instance
  const orchestrator = new ReviveOrchestrator();

  // ─── API Routes ─────────────────────────────────────────────────────────────

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "Revive AI Revenue Recovery Engine",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness Probe
  app.get("/api/v1/readiness", (_req, res) => {
    res.json({
      status: "ready",
      database: "in-memory-sha256-ledger",
      ledger_blocks: orchestrator.ledger.chain.length,
      mode: orchestrator.mode,
      trai_enforced: orchestrator.enforceTrai,
    });
  });

  // Full state snapshot
  app.get("/api/state", (_req, res) => {
    const summary = orchestrator.ledger.getSummary();
    res.json({
      mode: orchestrator.mode,
      enforce_trai: orchestrator.enforceTrai,
      ledger_summary: summary,
      ledger_chain: orchestrator.ledger.chain,
      dispatch_history: orchestrator.dispatcher.getDispatchHistory(),
      pending_queue: Array.from(orchestrator.pendingOperatorQueue.entries()).map(([k, v]) => ({
        entity_id: k,
        ...v,
      })),
      decision_traces: orchestrator.decisionTraces,
      bank_cbs_health: orchestrator.classifier.bank_cbs_health,
      active_p2p: Array.from(orchestrator.stateStore.entries())
        .filter(([_, v]) => v.status === "PROMISE_TO_PAY_PENDING")
        .map(([k, v]) => ({ entity_id: k, ...v })),
    });
  });

  // Toggle Mode / TRAI / Bank health
  app.post("/api/mode", (req, res) => {
    const { mode, enforce_trai, bank, bank_status, bank_recovery_mins } = req.body;
    if (mode) {
      orchestrator.setMode(mode as ExecutionMode);
    }
    if (enforce_trai !== undefined) {
      orchestrator.setTraiEnforcement(Boolean(enforce_trai));
    }
    if (bank && bank_status) {
      orchestrator.classifier.setBankStatus(bank, bank_status, bank_recovery_mins || 0);
    }
    res.json({
      status: "updated",
      mode: orchestrator.mode,
      enforce_trai: orchestrator.enforceTrai,
      bank_cbs_health: orchestrator.classifier.bank_cbs_health,
    });
  });

  // Telemetry Event ingestion
  app.post("/api/event", (req, res) => {
    const event: TelemetryEvent = req.body;
    if (!event || !event.entity_id) {
      return res.status(400).json({ error: "Missing entity_id in event payload" });
    }
    const action = orchestrator.processEvent(event);
    res.json({
      status: "processed",
      action,
      entity_state: orchestrator.getEntityState(event.entity_id),
      mode: orchestrator.mode,
    });
  });

  // Run 50-Record Batch Benchmark
  app.post("/api/batch-benchmark", (req, res) => {
    const events: TelemetryEvent[] = req.body?.events || SYNTHETIC_BATCH_50;
    orchestrator.processBatch(events);
    const summary = orchestrator.ledger.getSummary();
    res.json({
      status: "batch_completed",
      total_processed: events.length,
      summary,
    });
  });

  // Operator Approve
  app.post("/api/v1/operator/approve", (req, res) => {
    const { entity_id } = req.body;
    if (!entity_id) return res.status(400).json({ error: "Missing entity_id" });
    const action = orchestrator.approveAndDispatch(entity_id);
    if (!action) return res.status(404).json({ error: "Entity not found in pending queue" });
    res.json({ status: "approved_and_dispatched", action });
  });

  // Operator Reject
  app.post("/api/v1/operator/reject", (req, res) => {
    const { entity_id, reason } = req.body;
    if (!entity_id) return res.status(400).json({ error: "Missing entity_id" });
    const halted = orchestrator.rejectAndHalt(entity_id, reason || "OPERATOR_REJECTED");
    if (!halted) return res.status(404).json({ error: "Entity not found in pending queue" });
    res.json({ status: "rejected_and_halted", entity_id });
  });

  // AI Diagnostic with Intent Extraction
  app.post("/api/v1/ai/diagnose", (req, res) => {
    const { event, customer_note } = req.body;
    if (!event) return res.status(400).json({ error: "Missing event payload" });
    const diagnostic = orchestrator.classifier.diagnoseWithAI(event, customer_note);
    res.json(diagnostic);
  });

  // Promise-to-Pay Register
  app.post("/api/v1/ptp/commit", (req, res) => {
    const { entity_id, promised_timestamp_epoch, promised_amount_paise, note } = req.body;
    if (!entity_id || !promised_timestamp_epoch) {
      return res.status(400).json({ error: "Missing entity_id or promised_timestamp_epoch" });
    }
    const state = orchestrator.registerPtpCommitment(
      entity_id,
      promised_timestamp_epoch,
      promised_amount_paise,
      note
    );
    res.json({ status: "ptp_registered", state });
  });

  // Promise-to-Pay Evaluate
  app.post("/api/v1/ptp/evaluate", (req, res) => {
    const { entity_id, actual_payment_epoch } = req.body;
    if (!entity_id) return res.status(400).json({ error: "Missing entity_id" });
    const state = orchestrator.evaluatePtpCompliance(
      entity_id,
      actual_payment_epoch || Math.floor(Date.now() / 1000)
    );
    res.json({ status: "ptp_evaluated", state });
  });

  // Voice TwiML Synthesizer
  app.get("/api/v1/voice/twiml", (req, res) => {
    const name = String(req.query.name || "Customer");
    const amount = Number(req.query.amount || 2499);
    const orderId = String(req.query.order_id || "ord_9901");
    const xml = generateTwimlVoiceRecovery(name, amount, orderId);
    res.type("application/xml").send(xml);
  });

  // Audit Ledger & Proof
  app.get("/api/v1/ledger", (_req, res) => {
    const summary = orchestrator.ledger.getSummary();
    res.json({
      summary,
      chain: orchestrator.ledger.chain,
    });
  });

  app.get("/api/v1/ledger/audit/:log_id", (req, res) => {
    const proof = orchestrator.ledger.verifyBlockProof(req.params.log_id);
    res.json(proof);
  });

  // SSOT Inspection
  app.get("/api/v1/entity/:entity_id/ssot", (req, res) => {
    const ssot = orchestrator.getEntitySSOT(req.params.entity_id);
    res.json(ssot);
  });

  // Replay
  app.post("/api/v1/replay", (req, res) => {
    const { entity_id, event, override_mode } = req.body;
    if (!entity_id || !event) return res.status(400).json({ error: "Missing entity_id or event" });
    const result = orchestrator.replayEvent(entity_id, event, override_mode);
    res.json(result);
  });

  // Reset Engine State
  app.post("/api/clear", (_req, res) => {
    orchestrator.clear();
    res.json({ status: "cleared" });
  });

  // Helper for HMAC-SHA256 verification
  function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
    if (!signature) return false;
    try {
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // Webhooks with Cryptographic Verification & Replay Protection
  const webhookHandler = (req: express.Request, res: express.Response) => {
    const signature = (req.headers["x-razorpay-signature"] || req.headers["x-webhook-signature"]) as string | undefined;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

    // 1. Cryptographic HMAC Signature Verification (if header provided)
    if (signature) {
      const isValid = verifyRazorpaySignature(rawBody, signature, WEBHOOK_SECRET);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid Razorpay HMAC-SHA256 Signature." });
      }
    }

    const payload = req.body || {};
    const eventId = payload.event_id || payload.payload?.payment?.entity?.id || `hook_${Date.now()}`;

    // 2. Replay Protection & Deduplication (5-minute sliding window)
    const nowEpoch = Math.floor(Date.now() / 1000);
    const lastSeen = processedEventCache.get(eventId);
    if (lastSeen && nowEpoch - lastSeen < 300) {
      return res.status(200).json({ status: "SKIPPED_DUPLICATE", event_id: eventId });
    }
    processedEventCache.set(eventId, nowEpoch);

    // Clean old entries older than 10 minutes
    if (processedEventCache.size > 2000) {
      for (const [k, v] of processedEventCache.entries()) {
        if (nowEpoch - v > 600) processedEventCache.delete(k);
      }
    }

    const event: TelemetryEvent = {
      event_id: eventId,
      event_type: payload.event || payload.event_type || "payment.failed",
      entity_id: payload.payload?.payment?.entity?.id || payload.entity_id || `ent_${Date.now()}`,
      gross_amount_paise: payload.payload?.payment?.entity?.amount || payload.gross_amount_paise || 150000,
      customer_contact_hash: payload.customer_contact_hash || "hash_hook",
      customer_phone: payload.payload?.payment?.entity?.contact || payload.customer_phone || "+919876543210",
      issuing_bank: payload.payload?.payment?.entity?.bank || payload.issuing_bank || "HDFC",
      raw_error_code: payload.payload?.payment?.entity?.error_code || payload.raw_error_code || "GATEWAY_TIMEOUT",
      timestamp_utc: new Date().toISOString(),
    };
    const action = orchestrator.processEvent(event);
    res.json({ status: "webhook_accepted", event_id: event.event_id, action });
  };

  app.post("/webhook/payment", webhookHandler);
  app.post("/webhook/razorpay", webhookHandler);
  app.post("/webhook/revive", webhookHandler);

  // ─── Vite Middleware & Static Serving ───────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Revive Engine API & Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
