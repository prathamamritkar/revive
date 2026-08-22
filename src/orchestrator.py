import os
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict
from src.schemas import (
    TelemetryEvent, FailureClassification, ChannelType,
    RecoveryAction, RecoveryState, AuditLedgerEntry, DispatchRequest
)
from src.classifier import TelemetryClassifier
from src.ledger import AuditLedger
from src.rzp_client import RazorpayClientWrapper
from src.dispatcher import WhatsAppDispatcher

class RevPulseOrchestrator:
    def __init__(self, classifier: Optional[TelemetryClassifier] = None):
        self.classifier = classifier or TelemetryClassifier()
        self.ledger = AuditLedger()
        self.rzp_client = RazorpayClientWrapper()
        self.dispatcher = WhatsAppDispatcher()
        self.MAX_ATTEMPTS = 3
        self.state_store: Dict[str, Dict] = {}

    def is_trai_compliant_time(self, epoch_time: int) -> bool:
        enforce = os.getenv("TRAI_ENFORCE_TIME_GATE", "true").lower() in ["true", "1", "yes"]
        if not enforce:
            return True
        gm = time.gmtime(epoch_time)
        ist_hour = (gm.tm_hour + 5 + (gm.tm_min + 30) // 60) % 24
        return 8 <= ist_hour < 19

    def process_event(self, event: TelemetryEvent) -> Optional[RecoveryAction]:
        entity_id = event.entity_id
        current_state = self.state_store.get(entity_id, {
            "attempts": 0,
            "status": RecoveryState.DETECTED,
            "recovered_paise": 0
        })

        if current_state["attempts"] >= self.MAX_ATTEMPTS:
            current_state["status"] = RecoveryState.HALTED_MAX_ATTEMPTS
            self.state_store[entity_id] = current_state
            return None

        classification = self.classifier.diagnose(event)
        if classification in [FailureClassification.TERMINAL_ACCOUNT_CLOSED, FailureClassification.TERMINAL_AUTH_REJECTED]:
            current_state["status"] = RecoveryState.HALTED_TERMINAL
            self.state_store[entity_id] = current_state
            return None

        attempt = current_state["attempts"] + 1
        now = int(time.time())

        if classification == FailureClassification.TRANSIENT_NETWORK_DOWN:
            scheduled_time = now + (45 * 60)
            channel = ChannelType.SILENT_API_RETRY
            payload = {
                "action": "RAZORPAY_SUBSCRIPTION_RETRY",
                "entity_id": entity_id,
                "subscription_id": entity_id
            }
            reason = "Bank core systems degraded; silent retry scheduled post-recovery (+45m)."

        elif classification == FailureClassification.TRANSIENT_BALANCE_LOW:
            scheduled_time = now + (24 * 3600)
            channel = ChannelType.WHATSAPP_HINGLISH
            amount_inr = event.gross_amount_paise / 100
            plink = self.rzp_client.create_payment_link(entity_id, event.gross_amount_paise, "Subscription Renewal")
            payload = {
                "message": f"Namaste! Aapka recurring payment of Rs. {amount_inr:,.2f} bank side error ki wajah se process nahi ho paya. Subscription uninterrupted continue rakhne ke liye yahan se pay karein.",
                "payment_url": plink["short_url"],
                "expire_hours": 48
            }
            reason = "Insufficient funds; conversational Hinglish recovery link dispatched."

        elif classification == FailureClassification.B2B_OVERDUE_INVOICE:
            scheduled_time = now + 3600
            channel = ChannelType.WHATSAPP_HINGLISH
            amount_inr = event.gross_amount_paise / 100
            va = self.rzp_client.generate_virtual_account(entity_id)
            payload = {
                "message": f"Attention Accounts Team: Invoice #{entity_id} (Rs. {amount_inr:,.2f}) is overdue ({event.invoice_age_days or 15} days). Execute instant NEFT clearance via Razorpay Virtual Account: UPI ID {va['upi_id']} / A/C {va['account_number']} (IFSC: {va['ifsc']}).",
                "virtual_account_upi": va["upi_id"],
                "virtual_account_no": va["account_number"]
            }
            reason = "B2B Overdue invoice follow-up with auto-reconciling virtual account."

        else:
            scheduled_time = now + (15 * 60)
            channel = ChannelType.WHATSAPP_HINGLISH
            amount_inr = event.gross_amount_paise / 100
            plink = self.rzp_client.create_payment_link(entity_id, event.gross_amount_paise, "Checkout Drop-off Recovery")
            payload = {
                "message": f"Aapka cart wait kar raha hai! Complete your order of Rs. {amount_inr:,.2f} with 1-Click UPI:",
                "payment_url": plink["short_url"],
                "expire_hours": 12
            }
            reason = "Checkout drop-off; cart reservation link dispatched."

        if channel != ChannelType.SILENT_API_RETRY and not self.is_trai_compliant_time(scheduled_time):
            scheduled_time += (12 * 3600)

        current_state["attempts"] = attempt
        current_state["status"] = RecoveryState.SCHEDULED
        self.state_store[entity_id] = current_state

        return RecoveryAction(
            action_id=f"act_{entity_id}_{attempt}",
            entity_id=entity_id,
            target_channel=channel,
            scheduled_timestamp_epoch=scheduled_time,
            payload=payload,
            attempt_index=attempt,
            reason_code=reason
        )

    def execute_mock_batch(self, events: List[TelemetryEvent]) -> List[AuditLedgerEntry]:
        self.ledger = AuditLedger()
        self.state_store.clear()

        for event in events:
            action = self.process_event(event)
            state = self.state_store.get(event.entity_id, {"attempts": 0, "status": RecoveryState.DETECTED})

            recovered_paise = 0
            cost_paise = 0
            if action:
                if action.target_channel == ChannelType.SILENT_API_RETRY:
                    cost_paise = 0
                    if (int(event.entity_id[-1], 16) % 4 != 0):
                        recovered_paise = event.gross_amount_paise
                elif action.target_channel == ChannelType.WHATSAPP_HINGLISH:
                    cost_paise = 60
                    if (int(event.entity_id[-1], 16) % 2 == 0):
                        recovered_paise = event.gross_amount_paise
                    elif event.event_type == "invoice.overdue" and (int(event.entity_id[-1], 16) % 3 != 0):
                        recovered_paise = event.gross_amount_paise

                if action.target_channel == ChannelType.WHATSAPP_HINGLISH and "message" in action.payload:
                    phone = event.customer_phone or os.getenv("DEMO_TARGET_PHONE", "whatsapp:+919876543210")
                    self.dispatcher.dispatch(DispatchRequest(
                        phone_number=phone,
                        message=action.payload["message"],
                        payment_url=action.payload.get("payment_url"),
                        channel=action.target_channel
                    ))

            final_status = RecoveryState.RECOVERED if recovered_paise > 0 else state["status"]
            self.ledger.record_entry(
                entity_id=event.entity_id,
                initial_paise=event.gross_amount_paise,
                recovered_paise=recovered_paise,
                status=final_status,
                attempt_count=state["attempts"],
                cost_paise=cost_paise
            )

        return self.ledger.chain
