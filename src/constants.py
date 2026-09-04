import os
from src.schemas import FailureClassification

# --- 12-Factor App Environment Configuration ---
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", os.getenv("SERVER_PORT", "8000")))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
APP_ENV = os.getenv("APP_ENV", "development")

# --- Immutable Domain Invariants & Policies (Code-Bound SSOT) ---
LEDGER_GENESIS_HASH = "00000000000000000000000000000000"

TRAI_DEFER_SECONDS = 12 * 3600
PTP_GRACE_SECONDS = 86400
MAX_RECOVERY_ATTEMPTS = 3
EVIDENCE_CONFIDENCE_THRESHOLD = 0.85

IST_OFFSET_SECONDS = 19800
SECONDS_PER_DAY = 86400

TERMINAL_CLASSIFICATIONS = frozenset({
    FailureClassification.TERMINAL_ACCOUNT_CLOSED,
    FailureClassification.TERMINAL_AUTH_REJECTED,
})

CHANNEL_COSTS_PAISE = {
    "SILENT_API_RETRY": 0,
    "WHATSAPP_HINGLISH": 60,
    "VOICE_IVR_NUDGE": 150,
    "HUMAN_ESCALATION": 500,
}
