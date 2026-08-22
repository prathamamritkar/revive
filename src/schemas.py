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

class RecoveryState(str, Enum):
    DETECTED = "DETECTED"
    SCHEDULED = "SCHEDULED"
    DISPATCHED = "DISPATCHED"
    PROMISE_TO_PAY_PENDING = "PROMISE_TO_PAY_PENDING"
    RECOVERED = "RECOVERED"
    HALTED_TERMINAL = "HALTED_TERMINAL"
    HALTED_MAX_ATTEMPTS = "HALTED_MAX_ATTEMPTS"

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
