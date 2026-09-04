import json
import os
import sys
import time
import hmac
import hashlib
import logging
import uvicorn
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, Tuple
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from dotenv import load_dotenv

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.schemas import TelemetryEvent, DispatchRequest, PTPCommitRequest, RecoveryState, ExecutionMode
from src.orchestrator import ReviveOrchestrator
from src.dispatcher import WhatsAppDispatcher
from src.utils import verify_hmac_sha256, utc_now_iso

load_dotenv()

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", os.getenv("SERVER_PORT", "8000")))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
APP_ENV = os.getenv("APP_ENV", "development")

logging.basicConfig(
    stream=sys.stdout,
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("app")


def verify_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """Matches Razorpay's X-Razorpay-Signature against RAZORPAY_WEBHOOK_SECRET via HMAC-SHA256."""
    if not signature or not secret:
        return False
    try:
        sec_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
        body_bytes = raw_body if isinstance(raw_body, (bytes, bytearray)) else str(raw_body).encode("utf-8")
        expected = hmac.new(sec_bytes, body_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected.strip().lower(), signature.strip().lower())
    except Exception:
        return False


def _extract_webhook_entity(payload: dict) -> Tuple[dict, str, int, str, str]:
    payment = payload.get("payment", {}).get("entity", {})
    plink = payload.get("payment_link", {}).get("entity", {})
    sub = payload.get("subscription", {}).get("entity", {})
    va = payload.get("virtual_account", {}).get("entity", {})

    entity = payment or plink or sub or va
    entity_id = plink.get("reference_id") or entity.get("notes", {}).get("invoice_id") or entity.get("id", f"ent_{int(datetime.now().timestamp())}")
    amount_paise = entity.get("amount") or entity.get("amount_paid") or 150000
    contact = entity.get("contact") or payment.get("contact", "+919876543210")
    bank = entity.get("bank", "HDFC")
    return entity, entity_id, amount_paise, contact, bank


# --- OCP: Webhook Event Processing Extensibility ---

class BaseWebhookEventHandler(ABC):
    @abstractmethod
    def supports(self, event_name: str) -> bool:
        pass

    @abstractmethod
    def handle(
        self,
        event_name: str,
        entity_id: str,
        amount_paise: int,
        contact: str,
        bank: str,
        entity: dict,
        body: dict,
        orchestrator: ReviveOrchestrator,
    ) -> Dict[str, Any]:
        pass


class PaymentSuccessWebhookHandler(BaseWebhookEventHandler):
    def supports(self, event_name: str) -> bool:
        return event_name in [
            "payment_link.paid", "order.paid", "virtual_account.credited",
            "payment.authorized", "payment.captured"
        ]

    def handle(
        self,
        event_name: str,
        entity_id: str,
        amount_paise: int,
        contact: str,
        bank: str,
        entity: dict,
        body: dict,
        orchestrator: ReviveOrchestrator,
    ) -> Dict[str, Any]:
        state = orchestrator.state_store.get(entity_id, {"attempts": 1, "status": RecoveryState.DISPATCHED})
        state["status"] = RecoveryState.RECOVERED
        state["recovered_paise"] = amount_paise
        orchestrator.state_store[entity_id] = state

        entry = orchestrator.ledger.record_entry(
            entity_id=entity_id,
            initial_paise=amount_paise,
            recovered_paise=amount_paise,
            status=RecoveryState.RECOVERED,
            attempt_count=state.get("attempts", 1),
            cost_paise=60,
        )

        return {
            "status": "RECOVERED_AUTO_RECONCILED",
            "event_processed": event_name,
            "entity_id": entity_id,
            "amount_paise": amount_paise,
            "ledger_log_id": entry.log_id,
            "audit_hash": entry.audit_hash,
        }


class PaymentFailedWebhookHandler(BaseWebhookEventHandler):
    def supports(self, event_name: str) -> bool:
        return True

    def handle(
        self,
        event_name: str,
        entity_id: str,
        amount_paise: int,
        contact: str,
        bank: str,
        entity: dict,
        body: dict,
        orchestrator: ReviveOrchestrator,
    ) -> Dict[str, Any]:
        error_code = entity.get("error_code") or entity.get("error_reason") or "GATEWAY_TIMEOUT"
        event = TelemetryEvent(
            event_id=body.get("event_id", f"evt_{int(datetime.now().timestamp())}"),
            event_type=event_name,
            entity_id=entity_id,
            gross_amount_paise=amount_paise,
            customer_contact_hash=f"cust_hash_{entity_id[:8]}",
            customer_phone=contact,
            issuing_bank=bank,
            raw_error_code=error_code,
            timestamp_utc=datetime.now(timezone.utc),
        )

        action = orchestrator.process_event(event)

        return {
            "status": "ACCEPTED",
            "event_processed": event_name,
            "entity_id": entity_id,
            "action_scheduled": action.model_dump() if action else None,
        }


class WebhookHandlerRegistry:
    def __init__(self):
        self.handlers: List[BaseWebhookEventHandler] = [
            PaymentSuccessWebhookHandler(),
            PaymentFailedWebhookHandler(),
        ]

    def register(self, handler: BaseWebhookEventHandler, priority_index: Optional[int] = 0) -> None:
        if priority_index is not None:
            self.handlers.insert(priority_index, handler)
        else:
            self.handlers.append(handler)

    def process(
        self,
        event_name: str,
        entity_id: str,
        amount_paise: int,
        contact: str,
        bank: str,
        entity: dict,
        body: dict,
        orchestrator: ReviveOrchestrator,
    ) -> Dict[str, Any]:
        for h in self.handlers:
            if h.supports(event_name):
                return h.handle(event_name, entity_id, amount_paise, contact, bank, entity, body, orchestrator)
        return PaymentFailedWebhookHandler().handle(event_name, entity_id, amount_paise, contact, bank, entity, body, orchestrator)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Revive starting up in %s mode on %s:%s", APP_ENV, HOST, PORT)
    yield
    logger.info("Revive shutting down gracefully.")


app = FastAPI(
    title="Revive — AI Revenue Recovery Engine",
    description=(
        "Telemetry-Aware Mandate & Payment Degradation Recovery Sentinel. "
        "4-layer autonomous engine: CBS Classifier → Policy Orchestrator → Hinglish Dispatcher → SHA-256 Ledger."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={"name": "Revive", "url": "https://github.com"},
    license_info={"name": "MIT"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WebhookDeduplicationStore:
    """In-memory 300-second sliding-window deduplication store keyed on payment_id/event_id."""
    def __init__(self, window_seconds: int = 300):
        self.window_seconds = window_seconds
        self._seen: Dict[str, float] = {}

    def is_duplicate_and_record(self, key: str) -> bool:
        if not key:
            return False
        now = time.time()
        # Purge stale keys outside sliding window
        cutoff = now - self.window_seconds
        self._seen = {k: ts for k, ts in self._seen.items() if ts > cutoff}

        if key in self._seen:
            return True
        self._seen[key] = now
        return False

    def is_duplicate(self, key: str) -> bool:
        return self.is_duplicate_and_record(key)

    def clear(self) -> None:
        self._seen.clear()


orchestrator = ReviveOrchestrator()
dispatcher = WhatsAppDispatcher()
webhook_registry = WebhookHandlerRegistry()
dedup_store = WebhookDeduplicationStore(window_seconds=300)
seen_event_ids = dedup_store  # backward compatibility alias


@app.get("/")
def read_root():
    return {
        "service": "Revive Engine",
        "status": "ONLINE",
        "timestamp_utc": utc_now_iso(),
        "trai_enforced": os.getenv("TRAI_ENFORCE_TIME_GATE", "true"),
        "use_mock_dispatcher": os.getenv("USE_MOCK_DISPATCHER", "true"),
    }


@app.get("/api/health", tags=["Observability"])
def health_check():
    return {
        "status": "healthy",
        "bank_cbs_matrix": orchestrator.classifier.bank_cbs_health,
        "active_dispatches": len(dispatcher.get_dispatch_history()),
        "ledger_entries": len(orchestrator.ledger.chain),
        "timestamp_utc": utc_now_iso(),
    }


@app.get("/api/v1/entity/{entity_id}/ssot", tags=["Observability"])
def get_entity_single_source_of_truth(entity_id: str):
    return orchestrator.get_entity_ssot(entity_id)


@app.get("/api/v1/readiness", tags=["Observability"])
def readiness_probe():
    ledger_summary = orchestrator.ledger.get_summary()
    degraded_banks = [
        bank for bank, info in orchestrator.classifier.bank_cbs_health.items()
        if info["status"] == "DEGRADED"
    ]
    cbs_status = "DEGRADED" if degraded_banks else "HEALTHY"
    return {
        "status": "READY",
        "timestamp_utc": utc_now_iso(),
        "engine": {
            "classifier": "OK",
            "orchestrator": "OK",
            "dispatcher": "MOCK" if os.getenv("USE_MOCK_DISPATCHER", "true") == "true" else "LIVE",
            "ledger": "OK",
        },
        "cbs_matrix": {
            "status": cbs_status,
            "degraded_banks": degraded_banks,
            "total_banks_monitored": len(orchestrator.classifier.bank_cbs_health),
        },
        "ledger": {
            "entries": ledger_summary["total_records"],
            "integrity": "VALID" if ledger_summary["integrity_valid"] else "BROKEN",
            "yield_rate_percent": ledger_summary["yield_rate_percent"],
        },
        "policy": {
            "trai_gate_enforced": os.getenv("TRAI_ENFORCE_TIME_GATE", "true") == "true",
            "max_attempts_per_entity": orchestrator.MAX_ATTEMPTS,
        },
    }


@app.post("/webhook/payment")
@app.post("/webhook/razorpay")
@app.post("/webhook/revive")
async def payment_webhook(request: Request, background_tasks: BackgroundTasks):
    try:
        raw_body = await request.body()
        sig_header = (
            request.headers.get("X-Razorpay-Signature", "")
            or request.headers.get("X-Webhook-Signature", "")
            or request.headers.get("X-Revive-Signature", "")
        )
        sec_key = os.getenv("RAZORPAY_WEBHOOK_SECRET", os.getenv("REVIVE_WEBHOOK_SECRET", "revive_secret_2026"))

        # 1. HMAC-SHA256 signature verification matching Razorpay's X-Razorpay-Signature
        if sig_header:
            if not verify_webhook_signature(raw_body, sig_header, sec_key):
                raise HTTPException(status_code=401, detail="Invalid Razorpay webhook HMAC signature")
        elif sec_key and sec_key not in ["", "dummy_secret"] and os.getenv("REVIVE_WEBHOOK_REQUIRE_SIG", "true").lower() in ["true", "1"]:
            raise HTTPException(status_code=401, detail="Missing required X-Razorpay-Signature header")

        body = json.loads(raw_body.decode("utf-8")) if raw_body else await request.json()
        payload = body.get("payload", {})
        entity, entity_id, amount_paise, contact, bank = _extract_webhook_entity(payload)

        # 2. 300-second sliding-window deduplication keyed on payment_id/event_id
        payment_id = payload.get("payment", {}).get("entity", {}).get("id") or entity.get("id")
        event_id = body.get("event_id") or payment_id or entity_id

        if event_id and dedup_store.is_duplicate_and_record(str(event_id)):
            return {
                "status": "SKIPPED_DUPLICATE",
                "event_id": event_id,
                "message": "Duplicate or out-of-order webhook event dropped by 300-second sliding window."
            }

        event_name = body.get("event", "payment.failed")
        return webhook_registry.process(
            event_name, entity_id, amount_paise, contact, bank, entity, body, orchestrator
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Webhook processing error: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook payload")


@app.post("/api/event")
def process_custom_event(event: TelemetryEvent):
    action = orchestrator.process_event(event)
    trace = orchestrator.state_store.get(event.entity_id, {}).get("last_trace")
    return {
        "event_id": event.event_id,
        "execution_mode": orchestrator.mode.value,
        "classification": orchestrator.classifier.diagnose(event).value,
        "action": action.model_dump() if action else None,
        "agentic_trace": trace,
    }


@app.post("/api/dispatch")
def dispatch_whatsapp(req: DispatchRequest):
    res = dispatcher.dispatch(req)
    return res


@app.post("/api/v1/operator/approve", tags=["Operator In-The-Loop"])
def approve_pending_action(entity_id: str):
    res = orchestrator.approve_and_dispatch(entity_id)
    if not res:
        raise HTTPException(status_code=404, detail=f"No pending operator approval found for entity '{entity_id}'")
    return res


@app.post("/api/v1/operator/reject", tags=["Operator In-The-Loop"])
def reject_pending_action(entity_id: str, reason: Optional[str] = "Operator Rejected"):
    res = orchestrator.reject_and_halt(entity_id, reason or "Operator Rejected")
    if not res:
        raise HTTPException(status_code=404, detail=f"No pending operator action found for entity '{entity_id}'")
    return res


@app.post("/api/v1/ai/diagnose", tags=["AI Engine"])
def diagnose_telemetry_or_note(event: Optional[TelemetryEvent] = None, note: Optional[str] = None):
    if note:
        res = orchestrator.classifier.diagnose_with_ai_fallback(note)
        return {
            "source": "LLM_FALLBACK_REASONER",
            "result": res.model_dump(),
        }
    if event:
        det = orchestrator.classifier.diagnose_deterministic(event)
        ai_res = orchestrator.classifier.diagnose_with_ai(event, note)
        return {
            "deterministic_fastpath": det.value if det else None,
            "hybrid_ai_result": ai_res.model_dump(),
        }
    raise HTTPException(status_code=400, detail="Provide either 'event' payload or 'note' string.")


@app.post("/api/v1/ptp/commit", tags=["Intervention"])
def register_ptp(req: PTPCommitRequest):
    res = orchestrator.register_ptp_commitment(
        entity_id=req.entity_id,
        promised_timestamp_epoch=req.promised_timestamp_epoch,
        note=req.note,
    )
    return {
        "status": "SUCCESS",
        "ptp_commitment": res,
    }


@app.post("/api/v1/p2p/evaluate", tags=["Intervention"])
@app.post("/api/v1/ptp/evaluate", tags=["Intervention"])
def evaluate_p2p(entity_id: str, is_paid: bool = False, current_epoch: Optional[int] = None):
    res = orchestrator.evaluate_p2p_compliance(entity_id, current_epoch, is_paid)
    return {
        "entity_id": entity_id,
        "is_paid": is_paid,
        "ptp_status": res,
        "p2p_status": res,
    }


@app.get("/api/v1/voice/twiml", tags=["Multimodal Channel"])
def get_twiml_voice_script(
    customer_name: str = "Valued Customer",
    amount_inr: float = 1499.0,
    amount_paise: Optional[int] = None,
    reference_id: str = "ref_1001",
    order_id: Optional[str] = None,
):
    from src.dispatcher import (
        generate_hinglish_voice_twiml,
        generate_twiml_voice_recovery,
        synthesize_mock_audio_manifest,
    )
    ref = order_id or reference_id
    paise = amount_paise if amount_paise is not None else int(amount_inr * 100)
    twiml_xml = generate_hinglish_voice_twiml(customer_name, paise, ref)
    manifest = synthesize_mock_audio_manifest(ref, f"Namaste {customer_name}! Pending order {ref}. INR {paise/100:.2f}.")
    return {
        "customer_name": customer_name,
        "amount_inr": paise / 100.0,
        "amount_paise": paise,
        "reference_id": ref,
        "order_id": ref,
        "twiml_xml": twiml_xml,
        "audio_manifest": manifest,
    }


@app.post("/api/v1/mode", tags=["Governance"])
def switch_execution_mode(mode: str):
    m_upper = mode.strip().upper()
    if m_upper in ["MANUAL", "MANUAL_POLICY_GATED"]:
        exec_mode = ExecutionMode.MANUAL_POLICY_GATED
    elif m_upper in ["AGENTIC", "AGENTIC_AUTONOMOUS"]:
        exec_mode = ExecutionMode.AGENTIC_AUTONOMOUS
    else:
        raise HTTPException(status_code=400, detail="Invalid mode. Allowed: AGENTIC, MANUAL")

    orchestrator.set_execution_mode(exec_mode)
    return {
        "status": "SUCCESS",
        "current_mode": orchestrator.mode.value,
    }


@app.get("/api/v1/ledger", tags=["Audit & Governance"])
def get_ledger_status():
    if len(orchestrator.ledger.chain) == 0:
        benchmark_path = os.path.join(os.path.dirname(__file__), "data", "synthetic_batch_50.json")
        if os.path.exists(benchmark_path):
            with open(benchmark_path) as f:
                raw_events = json.load(f)
            events = [TelemetryEvent(**e) for e in raw_events]
            orchestrator.execute_mock_batch(events)
    summary = orchestrator.ledger.get_summary()
    valid = orchestrator.ledger.verify_integrity()
    return {
        "integrity_valid": valid,
        "summary": summary,
        "total_blocks": len(orchestrator.ledger.chain),
    }


@app.get("/api/v1/ledger/audit/{log_id}", tags=["Audit & Governance"])
def audit_single_block_proof(log_id: str):
    proof = orchestrator.ledger.verify_block_proof(log_id)
    if not proof and len(orchestrator.ledger.chain) == 0:
        benchmark_path = os.path.join(os.path.dirname(__file__), "data", "synthetic_batch_50.json")
        if os.path.exists(benchmark_path):
            with open(benchmark_path) as f:
                raw_events = json.load(f)
            events = [TelemetryEvent(**e) for e in raw_events]
            orchestrator.execute_mock_batch(events)
            proof = orchestrator.ledger.verify_block_proof(log_id)
    if not proof:
        raise HTTPException(status_code=404, detail=f"Ledger block proof not found for '{log_id}'")
    return {
        "status": "PROOF_AUDITED",
        "cryptographic_proof": proof,
    }


@app.post("/api/v1/replay", tags=["Audit & Governance"])
def replay_policy_evaluation(event: TelemetryEvent, attempt: int = 1):
    return orchestrator.replay_event(event, attempt)


@app.get("/api/benchmark")
def run_benchmark():
    benchmark_path = os.path.join(os.path.dirname(__file__), "data", "synthetic_batch_50.json")
    if not os.path.exists(benchmark_path):
        raise HTTPException(status_code=404, detail="Benchmark dataset file not found.")

    with open(benchmark_path, "r") as f:
        data = json.load(f)

    events = [TelemetryEvent(**item) for item in data]
    chain = orchestrator.execute_mock_batch(events)
    summary = orchestrator.ledger.get_summary()

    return {
        "summary": summary,
        "dispatches_sent": dispatcher.get_dispatch_history()[:10],
        "sample_ledger_entries": [e.model_dump() for e in chain[:10]],
    }


if __name__ == "__main__":
    uvicorn.run("app:app", host=HOST, port=PORT, reload=(APP_ENV == "development"))
