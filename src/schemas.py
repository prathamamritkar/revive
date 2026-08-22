from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime

class FailureClassification(str, Enum):
    TRANSIENT_NETWORK_DOWN = "TRANSIENT_NETWORK_DOWN"
    TRANSIENT_BALANCE_LOW = "TRANSIENT_BALANCE_LOW"
    TERMINAL_ACCOUNT_CLOSED = "TERMINAL_ACCOUNT_CLOSED"
    TERMINAL_AUTH_REJECTED = "TERMINAL_AUTH_REJECTED"
    ABANDONED_CHECKOUT = "ABANDONED_CHECKOUT"
    B2B_OVERDUE_INVOICE = "B2B_OVERDUE_INVOICE"

class ChannelType(str, Enum):
    SILENT_API_RETRY = "SILENT_API_RETRY"
    WHATSAPP_HINGLISH = "WHATSAPP_HINGLISH"
    VOICE_IVR_NUDGE = "VOICE_IVR_NUDGE"
    HUMAN_ESCALATION = "HUMAN_ESCALATION"

class ExecutionMode(str, Enum):
    MANUAL_POLICY_GATED = "MANUAL_POLICY_GATED"
    AGENTIC_AUTONOMOUS = "AGENTIC_AUTONOMOUS"

class RecoveryState(str, Enum):
    DETECTED = "DETECTED"
    SCHEDULED = "SCHEDULED"
    DISPATCHED = "DISPATCHED"
    PROMISE_TO_PAY_PENDING = "PROMISE_TO_PAY_PENDING"
    RECOVERED = "RECOVERED"
    HALTED_TERMINAL = "HALTED_TERMINAL"
    HALTED_MAX_ATTEMPTS = "HALTED_MAX_ATTEMPTS"
    HALTED_MDP_STOPPING_RULE = "HALTED_MDP_STOPPING_RULE"

class AgenticDecisionTrace(BaseModel):
    agent_id: str = "RevPulse-Agent-01"
    telemetry_audit: str
    cbs_diagnosis: str
    fatigue_reasoning: str
    recommended_channel: ChannelType
    confidence_score: float
    auto_executed: bool
    timestamp: str

class TelemetryEvent(BaseModel):
    event_id: str
    event_type: str
    entity_id: str
    gross_amount_paise: int = Field(gt=0)
    customer_contact_hash: str
    customer_phone: Optional[str] = None
    issuing_bank: Optional[str] = None
    raw_error_code: Optional[str] = None
    invoice_age_days: Optional[int] = 0
    timestamp_utc: datetime

class RecoveryAction(BaseModel):
    action_id: str
    entity_id: str
    target_channel: ChannelType
    scheduled_timestamp_epoch: int
    payload: Dict[str, Any]
    attempt_index: int
    reason_code: str
    policy_approved: bool = True

class AuditLedgerEntry(BaseModel):
    log_id: str
    timestamp: str
    entity_id: str
    initial_amount_paise: int
    recovered_amount_paise: int
    status: RecoveryState
    attempt_count: int
    total_cost_incurred_paise: int
    audit_hash: str

class DispatchRequest(BaseModel):
    phone_number: str
    message: str
    payment_url: Optional[str] = None
    channel: ChannelType = ChannelType.WHATSAPP_HINGLISH

class PTPCommitRequest(BaseModel):
    entity_id: str
    promised_timestamp_epoch: int
    promised_amount_paise: int = Field(gt=0)
    note: Optional[str] = None

class P2PStatus(str, Enum):
    ACTIVE_PROMISE = "ACTIVE_PROMISE"
    PROMISE_HONORED = "PROMISE_HONORED"
    PROMISE_BROKEN = "PROMISE_BROKEN"

class AIIntentResponse(BaseModel):
    classification: FailureClassification
    confidence: float
    detected_intent: str
    urgency_level: str
    suggested_tone: str

def redact_pii(contact_str: Optional[str]) -> str:
    if not contact_str:
        return "anon_contact"
    clean = contact_str.replace("whatsapp:", "").strip()
    if len(clean) >= 10:
        return f"{clean[:3]}****{clean[-3:]}"
    import hashlib
    return f"hash_{hashlib.sha256(clean.encode()).hexdigest()[:8]}"
