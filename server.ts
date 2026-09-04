import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import { ReviveOrchestrator } from "./src/engine/orchestrator";
import { SYNTHETIC_BATCH_50 } from "./src/data/syntheticBatch";
import { generateTwimlVoiceRecovery } from "./src/engine/dispatcher";
import { ExecutionMode, TelemetryEvent } from "./src/engine/types";

// FastAPI backend connection state & detection
let activeFastApiUrl: string | null = null;
let isFastApiSpawning = false;

const FASTAPI_PORT = process.env.FASTAPI_PORT || "8001";
const FASTAPI_CANDIDATE_URLS = [
  process.env.FASTAPI_URL,
  `http://127.0.0.1:${FASTAPI_PORT}`,
  "http://127.0.0.1:8000",
].filter(Boolean) as string[];

async function detectFastApi(): Promise<string | null> {
  for (const baseUrl of FASTAPI_CANDIDATE_URLS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, any>;
        if (data.status === "healthy" || data.status === "ok") {
          activeFastApiUrl = baseUrl;
          return baseUrl;
        }
      }
    } catch {
      // Continue searching next candidate URL
    }
  }

  // Attempt to spawn uvicorn on port 8001 if not already running
  if (!activeFastApiUrl && !isFastApiSpawning) {
    isFastApiSpawning = true;
    try {
      console.log(`[FastAPI Bridge] Launching Python FastAPI background daemon on port ${FASTAPI_PORT}...`);
      const pyProc = spawn("python3", ["-m", "uvicorn", "app:app", "--port", FASTAPI_PORT, "--host", "127.0.0.1"], {
        stdio: "ignore",
        detached: true,
      });
      pyProc.unref();

      // Give process 1.2s to bind socket
      await new Promise((r) => setTimeout(r, 1200));
      for (const baseUrl of [`http://127.0.0.1:${FASTAPI_PORT}`]) {
        try {
          const res = await fetch(`${baseUrl}/api/health`);
          if (res.ok) {
            activeFastApiUrl = baseUrl;
            console.log(`[FastAPI Bridge] Python FastAPI daemon active on ${baseUrl}`);
            return baseUrl;
          }
        } catch {}
      }
    } catch (e) {
      console.warn("[FastAPI Bridge] Failed to spawn Python daemon:", e);
    } finally {
      isFastApiSpawning = false;
    }
  }

  return activeFastApiUrl;
}

// Initial probe
detectFastApi();

async function forwardToFastApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: any; text?: string }> {
  const baseUrl = await detectFastApi();
  if (!baseUrl) {
    return { ok: false, status: 503 };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    activeFastApiUrl = null;
    return { ok: false, status: 502 };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "revpulse_secret_2026";
  const processedEventCache = new Map<string, number>();

  app.use(cors());
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );

  // Singleton Orchestrator instance for client/fallback evaluation
  const orchestrator = new ReviveOrchestrator();

  // ─── API Routes ─────────────────────────────────────────────────────────────

  // Health check with FastAPI connectivity status
  app.get("/api/health", async (_req, res) => {
    const fastApiUrl = await detectFastApi();
    res.json({
      status: "ok",
      service: "Revive AI Revenue Recovery Engine",
      version: "2.0.0",
      backend_connected: Boolean(fastApiUrl),
      fastapi_url: fastApiUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness Probe
  app.get("/api/v1/readiness", async (_req, res) => {
    const fastApiUrl = await detectFastApi();
    res.json({
      status: "ready",
      database: "in-memory-sha256-ledger",
      ledger_blocks: orchestrator.ledger.chain.length,
      mode: orchestrator.mode,
      trai_enforced: orchestrator.enforceTrai,
      backend_connected: Boolean(fastApiUrl),
      fastapi_url: fastApiUrl,
    });
  });

  // Full state snapshot (merging FastAPI live state if available)
  app.get("/api/state", async (_req, res) => {
    const fastApiUrl = await detectFastApi();
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
      backend_connected: Boolean(fastApiUrl),
      fastapi_url: fastApiUrl,
    });
  });

  // Toggle Mode / TRAI / Bank health
  app.post("/api/mode", async (req, res) => {
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

  // Telemetry Event ingestion - Route through Python backend first with local fallback
  app.post("/api/event", async (req, res) => {
    const event: TelemetryEvent = req.body;
    if (!event || !event.entity_id) {
      return res.status(400).json({ error: "Missing entity_id in event payload" });
    }

    // Attempt routing via FastAPI backend
    const fastApiCall = await forwardToFastApi("/webhook/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    // Also process in local orchestrator to keep client synchronized
    const localAction = orchestrator.processEvent(event);

    if (fastApiCall.ok) {
      return res.json({
        status: "processed",
        backend: "FASTAPI_PYTHON",
        backend_connected: true,
        action: fastApiCall.data?.action || localAction,
        entity_state: orchestrator.getEntityState(event.entity_id),
        mode: orchestrator.mode,
      });
    }

    // Fallback response if FastAPI backend is unreachable
    res.json({
      status: "processed",
      backend: "TYPESCRIPT_FALLBACK",
      backend_connected: false,
      action: localAction,
      entity_state: orchestrator.getEntityState(event.entity_id),
      mode: orchestrator.mode,
    });
  });

  // Run 50-Record Batch Benchmark - Route via FastAPI /api/benchmark with fallback
  app.post("/api/batch-benchmark", async (req, res) => {
    const events: TelemetryEvent[] = req.body?.events || SYNTHETIC_BATCH_50;

    // Call Python FastAPI /api/benchmark
    const fastApiCall = await forwardToFastApi("/api/benchmark", {
      method: "GET",
    });

    // Always keep orchestrator updated with batch run
    orchestrator.processBatch(events);
    const summary = orchestrator.ledger.getSummary();

    if (fastApiCall.ok && fastApiCall.data) {
      return res.json({
        status: "batch_completed",
        backend: "FASTAPI_PYTHON",
        backend_connected: true,
        total_processed: events.length,
        summary: fastApiCall.data.summary || summary,
        dispatches_sent: fastApiCall.data.dispatches_sent || orchestrator.dispatcher.getDispatchHistory(),
        sample_ledger_entries: fastApiCall.data.sample_ledger_entries || orchestrator.ledger.chain.slice(0, 10),
      });
    }

    // Fallback response
    res.json({
      status: "batch_completed",
      backend: "TYPESCRIPT_FALLBACK",
      backend_connected: false,
      total_processed: events.length,
      summary,
      dispatches_sent: orchestrator.dispatcher.getDispatchHistory().slice(0, 10),
      sample_ledger_entries: orchestrator.ledger.chain.slice(0, 10),
    });
  });

  // Operator Approve
  app.post("/api/v1/operator/approve", async (req, res) => {
    const { entity_id } = req.body;
    if (!entity_id) return res.status(400).json({ error: "Missing entity_id" });

    // Attempt Python backend approval
    await forwardToFastApi("/api/v1/operator/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id }),
    });

    const action = orchestrator.approveAndDispatch(entity_id);
    if (!action) return res.status(404).json({ error: "Entity not found in pending queue" });
    res.json({ status: "approved_and_dispatched", action });
  });

  // Operator Reject
  app.post("/api/v1/operator/reject", async (req, res) => {
    const { entity_id, reason } = req.body;
    if (!entity_id) return res.status(400).json({ error: "Missing entity_id" });

    await forwardToFastApi("/api/v1/operator/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id, reason }),
    });

    const halted = orchestrator.rejectAndHalt(entity_id, reason || "OPERATOR_REJECTED");
    if (!halted) return res.status(404).json({ error: "Entity not found in pending queue" });
    res.json({ status: "rejected_and_halted", entity_id });
  });

  // AI Diagnostic with Intent Extraction
  app.post("/api/v1/ai/diagnose", async (req, res) => {
    const { event, customer_note } = req.body;
    if (!event) return res.status(400).json({ error: "Missing event payload" });

    const fastApiCall = await forwardToFastApi("/api/v1/ai/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, customer_note }),
    });

    if (fastApiCall.ok && fastApiCall.data) {
      return res.json(fastApiCall.data);
    }

    const diagnostic = orchestrator.classifier.diagnoseWithAI(event, customer_note);
    res.json(diagnostic);
  });

  // Promise-to-Pay Register - Route through Python backend with fallback
  app.post("/api/v1/ptp/commit", async (req, res) => {
    const { entity_id, promised_timestamp_epoch, promised_amount_paise, note } = req.body;
    if (!entity_id || !promised_timestamp_epoch) {
      return res.status(400).json({ error: "Missing entity_id or promised_timestamp_epoch" });
    }

    // Call FastAPI PTP register endpoint
    const fastApiCall = await forwardToFastApi("/api/v1/ptp/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity_id,
        promised_timestamp_epoch,
        promised_amount_paise: promised_amount_paise || 250000,
        note: note || "Registered via Revive Dashboard",
      }),
    });

    const state = orchestrator.registerPtpCommitment(
      entity_id,
      promised_timestamp_epoch,
      promised_amount_paise,
      note
    );

    res.json({
      status: "ptp_registered",
      backend: fastApiCall.ok ? "FASTAPI_PYTHON" : "TYPESCRIPT_FALLBACK",
      backend_connected: fastApiCall.ok,
      state,
    });
  });

  // Promise-to-Pay Evaluate - Route through Python backend with fallback
  app.post("/api/v1/ptp/evaluate", async (req, res) => {
    const { entity_id, actual_payment_epoch, is_paid } = req.body;
    if (!entity_id) return res.status(400).json({ error: "Missing entity_id" });

    const fastApiCall = await forwardToFastApi(
      `/api/v1/ptp/evaluate?entity_id=${encodeURIComponent(entity_id)}&is_paid=${is_paid !== false}`,
      { method: "POST" }
    );

    const state = orchestrator.evaluatePtpCompliance(
      entity_id,
      actual_payment_epoch || Math.floor(Date.now() / 1000)
    );

    res.json({
      status: "ptp_evaluated",
      backend: fastApiCall.ok ? "FASTAPI_PYTHON" : "TYPESCRIPT_FALLBACK",
      backend_connected: fastApiCall.ok,
      fastapi_result: fastApiCall.ok ? fastApiCall.data : null,
      state,
    });
  });

  // Voice TwiML Synthesizer
  app.get("/api/v1/voice/twiml", async (req, res) => {
    const name = String(req.query.name || "Customer");
    const amount = Number(req.query.amount || 2499);
    const orderId = String(req.query.order_id || "ord_9901");

    const fastApiCall = await forwardToFastApi(
      `/api/v1/voice/twiml?customer_name=${encodeURIComponent(name)}&amount_inr=${amount}&reference_id=${encodeURIComponent(orderId)}`
    );

    if (fastApiCall.ok && fastApiCall.text) {
      res.type("application/xml").send(fastApiCall.text);
      return;
    }

    const xml = generateTwimlVoiceRecovery(name, amount, orderId);
    res.type("application/xml").send(xml);
  });

  // Audit Ledger & Proof
  app.get("/api/v1/ledger", async (_req, res) => {
    const fastApiCall = await forwardToFastApi("/api/v1/ledger");
    if (fastApiCall.ok && fastApiCall.data) {
      return res.json(fastApiCall.data);
    }

    const summary = orchestrator.ledger.getSummary();
    res.json({
      summary,
      chain: orchestrator.ledger.chain,
    });
  });

  app.get("/api/v1/ledger/audit/:log_id", async (req, res) => {
    const fastApiCall = await forwardToFastApi(`/api/v1/ledger/audit/${encodeURIComponent(req.params.log_id)}`);
    if (fastApiCall.ok && fastApiCall.data) {
      return res.json(fastApiCall.data);
    }

    const proof = orchestrator.ledger.verifyBlockProof(req.params.log_id);
    res.json(proof);
  });

  // SSOT Inspection
  app.get("/api/v1/entity/:entity_id/ssot", async (req, res) => {
    const fastApiCall = await forwardToFastApi(`/api/v1/entity/${encodeURIComponent(req.params.entity_id)}/ssot`);
    if (fastApiCall.ok && fastApiCall.data) {
      return res.json(fastApiCall.data);
    }

    const ssot = orchestrator.getEntitySSOT(req.params.entity_id);
    res.json(ssot);
  });

  // Replay
  app.post("/api/v1/replay", async (req, res) => {
    const { entity_id, event, override_mode } = req.body;
    if (!entity_id || !event) return res.status(400).json({ error: "Missing entity_id or event" });

    const fastApiCall = await forwardToFastApi("/api/v1/replay?attempt=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (fastApiCall.ok && fastApiCall.data) {
      return res.json(fastApiCall.data);
    }

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

  // Webhooks with Cryptographic Verification & Replay Protection - Proxied to FastAPI
  const webhookHandler = async (req: express.Request, res: express.Response) => {
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

    // Forward to Python FastAPI webhook route
    const fastApiCall = await forwardToFastApi("/webhook/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "X-Razorpay-Signature": signature } : {}),
      },
      body: rawBody,
    });

    const localAction = orchestrator.processEvent(event);

    res.json({
      status: "webhook_accepted",
      backend: fastApiCall.ok ? "FASTAPI_PYTHON" : "TYPESCRIPT_FALLBACK",
      backend_connected: fastApiCall.ok,
      event_id: event.event_id,
      action: fastApiCall.data?.action || localAction,
    });
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
