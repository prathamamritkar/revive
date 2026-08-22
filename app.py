import json
import os
import uvicorn
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from dotenv import load_dotenv

from src.schemas import TelemetryEvent, DispatchRequest
from src.orchestrator import RevPulseOrchestrator
from src.dispatcher import WhatsAppDispatcher

load_dotenv()

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
        body = await request.json()
        event_name = body.get("event", "payment.failed")
        payload = body.get("payload", {})
        
        entity = payload.get("payment", {}).get("entity", {}) or payload.get("subscription", {}).get("entity", {})
        entity_id = entity.get("id", f"ent_{int(datetime.now().timestamp())}")
        amount_paise = entity.get("amount", 150000)
        error_code = entity.get("error_code") or entity.get("error_reason") or "GATEWAY_TIMEOUT"
        contact = entity.get("contact", "+919876543210")
        bank = entity.get("bank", "HDFC")

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
            "action_scheduled": action.dict() if action else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/event")
def process_custom_event(event: TelemetryEvent):
    action = orchestrator.process_event(event)
    return {
        "event_id": event.event_id,
        "classification": orchestrator.classifier.diagnose(event).value,
        "action": action.dict() if action else None
    }

@app.post("/api/dispatch")
def dispatch_whatsapp(req: DispatchRequest):
    res = dispatcher.dispatch(req)
    return res

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
        "sample_ledger_entries": [e.dict() for e in chain[:10]]
    }

if __name__ == "__main__":
    port = int(os.getenv("SERVER_PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
