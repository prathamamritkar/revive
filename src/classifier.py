from src.schemas import TelemetryEvent, FailureClassification

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
