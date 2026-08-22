import json
import os
import uvicorn
import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from dotenv import load_dotenv

from src.schemas import TelemetryEvent, DispatchRequest, PTPCommitRequest
from src.orchestrator import RevPulseOrchestrator
from src.dispatcher import WhatsAppDispatcher

load_dotenv()

def verify_razorpay_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    if not secret or not signature:
        return True
    expected_signature = hmac.new(
        key=secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)

app = FastAPI(
    title="RevPulse Sentinel — Razorpay AI Revenue Recovery Engine",
    description=(
        "Telemetry-Aware Mandate & Payment Degradation Recovery Sentinel. "
        "4-layer autonomous engine: CBS Classifier → Policy Orchestrator → Hinglish Dispatcher → SHA-256 Ledger."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={"name": "RevPulse Sentinel", "url": "https://github.com"},
    license_info={"name": "MIT"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = RevPulseOrchestrator()
dispatcher = WhatsAppDispatcher()

@app.get("/")
def read_root():
    return {
        "service": "RevPulse Sentinel Engine",
        "status": "ONLINE",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "trai_enforced": os.getenv("TRAI_ENFORCE_TIME_GATE", "true"),
        "use_mock_dispatcher": os.getenv("USE_MOCK_DISPATCHER", "true")
    }

@app.get("/api/health", tags=["Observability"])
def health_check():
    return {
        "status": "healthy",
        "bank_cbs_matrix": orchestrator.classifier.bank_cbs_health,
        "active_dispatches": len(dispatcher.get_dispatch_history()),
        "ledger_entries": len(orchestrator.ledger.chain),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


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
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
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

@app.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks):
    try:
        raw_body = await request.body()
        sig_header = request.headers.get("X-Razorpay-Signature", "")
        sec_key = os.getenv("RAZORPAY_WEBHOOK_SECRET", "revpulse_secret_2026")
        if sig_header and not verify_razorpay_signature(raw_body, sig_header, sec_key):
            raise HTTPException(status_code=401, detail="Invalid Razorpay webhook HMAC signature")

        body = json.loads(raw_body.decode("utf-8")) if raw_body else await request.json()
        event_name = body.get("event", "payment.failed")
        payload = body.get("payload", {})

        payment_entity = payload.get("payment", {}).get("entity", {})
        plink_entity = payload.get("payment_link", {}).get("entity", {})
        sub_entity = payload.get("subscription", {}).get("entity", {})
        va_entity = payload.get("virtual_account", {}).get("entity", {})

        entity = payment_entity or plink_entity or sub_entity or va_entity
        entity_id = plink_entity.get("reference_id") or entity.get("notes", {}).get("invoice_id") or entity.get("id", f"ent_{int(datetime.now().timestamp())}")
        amount_paise = entity.get("amount") or entity.get("amount_paid") or 150000
        contact = entity.get("contact") or payment_entity.get("contact", "+919876543210")
        bank = entity.get("bank", "HDFC")

        if event_name in ["payment_link.paid", "order.paid", "virtual_account.credited", "payment.authorized", "payment.captured"]:
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
                cost_paise=60
            )

            return {
                "status": "RECOVERED_AUTO_RECONCILED",
                "event_processed": event_name,
                "entity_id": entity_id,
                "amount_paise": amount_paise,
                "ledger_log_id": entry.log_id,
                "audit_hash": entry.audit_hash
            }

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
            timestamp_utc=datetime.now(timezone.utc)
        )

        action = orchestrator.process_event(event)

        return {
            "status": "ACCEPTED",
            "event_processed": event_name,
            "entity_id": entity_id,
            "action_scheduled": action.model_dump() if action else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/event")
def process_custom_event(event: TelemetryEvent):
    action = orchestrator.process_event(event)
    trace = orchestrator.state_store.get(event.entity_id, {}).get("last_trace")
    return {
        "event_id": event.event_id,
        "execution_mode": orchestrator.mode.value,
        "classification": orchestrator.classifier.diagnose(event).value,
        "action": action.model_dump() if action else None,
        "agentic_trace": trace
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

@app.post("/api/v1/ptp/commit", tags=["Intervention"])
def register_ptp(req: PTPCommitRequest):
    res = orchestrator.register_ptp_commitment(
        entity_id=req.entity_id,
        promised_timestamp_epoch=req.promised_timestamp_epoch,
        note=req.note
    )
    return {
        "status": "SUCCESS",
        "ptp_commitment": res
    }

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
        "sample_ledger_entries": [e.model_dump() for e in chain[:10]]
    }

if __name__ == "__main__":
    port = int(os.getenv("SERVER_PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
