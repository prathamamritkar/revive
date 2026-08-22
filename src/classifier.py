from typing import Optional
from src.schemas import TelemetryEvent, FailureClassification, AIIntentResponse

def analyze_unstructured_dropoff(text_payload: str) -> AIIntentResponse:
    text_lower = (text_payload or "").lower()
    
    if "salary" in text_lower or "next week" in text_lower or "pay on" in text_lower or "insufficient" in text_lower or "balance" in text_lower:
        return AIIntentResponse(
            classification=FailureClassification.TRANSIENT_BALANCE_LOW,
            confidence=0.94,
            detected_intent="Customer waiting for salary deposit cycle or temporary balance top-up",
            urgency_level="LOW",
            suggested_tone="EMPATHETIC_SALARY_CYCLE_REMINDER"
        )
        
    if "timeout" in text_lower or "gateway" in text_lower or "slow" in text_lower or "bank down" in text_lower:
        return AIIntentResponse(
            classification=FailureClassification.TRANSIENT_NETWORK_DOWN,
            confidence=0.91,
            detected_intent="Issuer bank core banking system timeout during payment handshake",
            urgency_level="HIGH",
            suggested_tone="TRANSACTIONAL_SILENT_RETRY"
        )

    if "expired" in text_lower or "blocked" in text_lower or "closed" in text_lower or "revoked" in text_lower:
        return AIIntentResponse(
            classification=FailureClassification.TERMINAL_ACCOUNT_CLOSED,
            confidence=0.98,
            detected_intent="Terminal instrument invalidity (card expired or mandate revoked)",
            urgency_level="CRITICAL",
            suggested_tone="TERMINAL_ZERO_TOUCH_HALT"
        )

    if "dispute" in text_lower or "wrong" in text_lower or "cancel" in text_lower:
        return AIIntentResponse(
            classification=FailureClassification.TERMINAL_AUTH_REJECTED,
            confidence=0.88,
            detected_intent="Customer active billing dispute or manual payment cancellation",
            urgency_level="HIGH",
            suggested_tone="HUMAN_ESCALATION_REQUIRED"
        )

    return AIIntentResponse(
        classification=FailureClassification.TRANSIENT_NETWORK_DOWN,
        confidence=0.82,
        detected_intent="Ambiguous payment drop-off or network handshake glitch",
        urgency_level="MEDIUM",
        suggested_tone="STANDARD_1CLICK_UPI_NUDGE"
    )

class TelemetryClassifier:
    def __init__(self):
        self.bank_cbs_health = {
            "HDFC": {"status": "DEGRADED", "avg_recovery_mins": 45},
            "SBIN": {"status": "HEALTHY", "avg_recovery_mins": 0},
            "ICIC": {"status": "HEALTHY", "avg_recovery_mins": 0},
            "UTIB": {"status": "DEGRADED", "avg_recovery_mins": 30},
            "KKBK": {"status": "DEGRADED", "avg_recovery_mins": 60},
        }

    def diagnose(self, event: TelemetryEvent) -> FailureClassification:
        if event.event_type == "invoice.overdue":
            return FailureClassification.B2B_OVERDUE_INVOICE
        
        if event.event_type == "checkout.dropped":
            return FailureClassification.ABANDONED_CHECKOUT

        error = (event.raw_error_code or "").upper()
        bank_info = self.bank_cbs_health.get(event.issuing_bank or "", {"status": "HEALTHY", "avg_recovery_mins": 0})

        if "TIMEOUT" in error or "GATEWAY_ERROR" in error or bank_info["status"] == "DEGRADED":
            return FailureClassification.TRANSIENT_NETWORK_DOWN
        
        if "INSUFFICIENT_FUNDS" in error or "BALANCE_LOW" in error:
            return FailureClassification.TRANSIENT_BALANCE_LOW

        if "CARD_EXPIRED" in error or "MANDATE_REVOKED" in error or "ACCOUNT_BLOCKED" in error:
            return FailureClassification.TERMINAL_ACCOUNT_CLOSED

        return FailureClassification.TERMINAL_AUTH_REJECTED

    def diagnose_with_ai(self, event: TelemetryEvent, customer_note: Optional[str] = None) -> AIIntentResponse:
        if customer_note or (event.raw_error_code and len(event.raw_error_code) > 15):
            query_text = customer_note or event.raw_error_code or ""
            return analyze_unstructured_dropoff(query_text)

        base_cls = self.diagnose(event)
        return AIIntentResponse(
            classification=base_cls,
            confidence=0.96,
            detected_intent=f"Deterministic CBS diagnostic signature for {event.event_type}",
            urgency_level="MEDIUM",
            suggested_tone="REVPULSE_DETERMINISTIC_POLICY"
        )
