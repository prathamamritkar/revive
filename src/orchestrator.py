import os
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from src.schemas import (
    TelemetryEvent, FailureClassification, ChannelType,
    RecoveryAction, RecoveryState, AuditLedgerEntry, DispatchRequest,
    ExecutionMode, AgenticDecisionTrace, P2PStatus
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
        self.mode = ExecutionMode.AGENTIC_AUTONOMOUS
        self.state_store: Dict[str, Dict] = {}
        self.pending_operator_queue: Dict[str, Dict[str, Any]] = {}

    def set_execution_mode(self, mode: ExecutionMode) -> None:
        self.mode = mode

    def generate_agentic_trace(
        self,
        event: TelemetryEvent,
        classification: FailureClassification,
        channel: ChannelType,
        attempt: int
    ) -> AgenticDecisionTrace:
        bank_status = self.classifier.bank_cbs_health.get(event.issuing_bank or "", {}).get("status", "HEALTHY")
        auto_exec = self.mode == ExecutionMode.AGENTIC_AUTONOMOUS
        
        return AgenticDecisionTrace(
            agent_id="RevPulse-Agent-01",
            telemetry_audit=f"Evaluated telemetry for {event.entity_id} ({event.event_type}). Amount: INR {event.gross_amount_paise/100:,.2f}.",
            cbs_diagnosis=f"Bank {event.issuing_bank or 'UNKNOWN'} status: {bank_status}. Classified error code '{event.raw_error_code}' as {classification.value}.",
            fatigue_reasoning=f"Attempt {attempt}/{self.MAX_ATTEMPTS}. Evaluated expected net yield. Selected optimal channel {channel.value}.",
            recommended_channel=channel,
            confidence_score=round(max(0.70, 0.98 - (attempt - 1) * 0.10), 2),
            auto_executed=auto_exec,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def is_trai_compliant_time(self, epoch_time: int) -> bool:
        enforce = os.getenv("TRAI_ENFORCE_TIME_GATE", "true").lower() in ["true", "1", "yes"]
        if not enforce:
            return True
        gm = time.gmtime(epoch_time)
        ist_hour = (gm.tm_hour + 5 + (gm.tm_min + 30) // 60) % 24
        return 8 <= ist_hour < 19

    def register_ptp_commitment(self, entity_id: str, promised_timestamp_epoch: int, amount_paise: Optional[int] = None, note: Optional[str] = None) -> Dict[str, Any]:
        state = self.state_store.get(entity_id, {
            "attempts": 0,
            "status": RecoveryState.DETECTED,
            "recovered_paise": 0
        })
        state["status"] = RecoveryState.PROMISE_TO_PAY_PENDING
        state["ptp_epoch"] = promised_timestamp_epoch
        state["ptp_amount_paise"] = amount_paise or 150000
        state["ptp_note"] = note or "Customer promised payment on salary date"
        state["p2p_status"] = P2PStatus.ACTIVE_PROMISE.value
        self.state_store[entity_id] = state
        return {
            "entity_id": entity_id,
            "status": RecoveryState.PROMISE_TO_PAY_PENDING.value,
            "p2p_status": P2PStatus.ACTIVE_PROMISE.value,
            "promised_timestamp_epoch": promised_timestamp_epoch,
            "note": state["ptp_note"]
        }

    def evaluate_p2p_compliance(self, entity_id: str, current_epoch: Optional[int] = None, is_paid: bool = False) -> str:
        state = self.state_store.get(entity_id)
        if not state or state.get("status") != RecoveryState.PROMISE_TO_PAY_PENDING:
            return "NO_ACTIVE_PROMISE"

        now = current_epoch or int(time.time())
        ptp_epoch = state.get("ptp_epoch", 0)

        if is_paid:
            state["p2p_status"] = P2PStatus.PROMISE_HONORED.value
            state["status"] = RecoveryState.RECOVERED
            return "PROMISE_HONORED"

        if now <= ptp_epoch + 86400:
            return "PROMISE_WITHIN_GRACE_PERIOD"

        state["p2p_status"] = P2PStatus.PROMISE_BROKEN.value
        return "PROMISE_BROKEN_ESCALATE"

    def process_event(self, event: TelemetryEvent) -> Optional[RecoveryAction]:
        entity_id = event.entity_id
        current_state = self.state_store.get(entity_id, {
            "attempts": 0,
            "status": RecoveryState.DETECTED,
            "recovered_paise": 0
        })

        now = int(time.time())
        if current_state.get("status") == RecoveryState.PROMISE_TO_PAY_PENDING:
            p2p_eval = self.evaluate_p2p_compliance(entity_id, now)
            if p2p_eval == "PROMISE_WITHIN_GRACE_PERIOD":
                return None
            elif p2p_eval == "PROMISE_BROKEN_ESCALATE":
                current_state["attempts"] = 2

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

        channel_costs = {
            ChannelType.SILENT_API_RETRY: 0,
            ChannelType.WHATSAPP_HINGLISH: 60,
            ChannelType.VOICE_IVR_NUDGE: 150,
            ChannelType.HUMAN_ESCALATION: 500
        }
        success_prob = max(0.05, 0.75 - (attempt - 1) * 0.25)
        expected_recovery_paise = int(event.gross_amount_paise * success_prob)
        fatigue_cost_paise = 100 * attempt
        est_channel = ChannelType.SILENT_API_RETRY if (classification == FailureClassification.TRANSIENT_NETWORK_DOWN and attempt == 1) else (ChannelType.VOICE_IVR_NUDGE if attempt == 3 else ChannelType.WHATSAPP_HINGLISH)
        est_channel_cost = channel_costs.get(est_channel, 60)

        expected_net_return = expected_recovery_paise - (est_channel_cost + fatigue_cost_paise)
        if expected_net_return <= 0:
            current_state["status"] = RecoveryState.HALTED_MDP_STOPPING_RULE
            self.state_store[entity_id] = current_state
            return None

        if classification == FailureClassification.TRANSIENT_NETWORK_DOWN and attempt == 1:
            scheduled_time = now + (45 * 60)
            channel = ChannelType.SILENT_API_RETRY
            payload = {
                "action": "RAZORPAY_SUBSCRIPTION_RETRY",
                "entity_id": entity_id,
                "subscription_id": entity_id
            }
            reason = "Bank core systems degraded; silent retry scheduled post-recovery (+45m)."

        elif attempt == 3:
            scheduled_time = now + (30 * 60)
            channel = ChannelType.VOICE_IVR_NUDGE
            amount_inr = event.gross_amount_paise / 100
            plink = self.rzp_client.create_payment_link(entity_id, event.gross_amount_paise, "Escalated Voice Nudge")
            payload = {
                "message": f"Namaste! Razorpay Automated Voice Assistant calling regarding pending payment of Rs. {amount_inr:,.2f}. Press 1 to receive payment link.",
                "payment_url": plink["short_url"],
                "expire_hours": 24
            }
            reason = "Escalated intervention via interactive Hinglish Voice IVR Nudge."

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

        trace = self.generate_agentic_trace(event, classification, channel, attempt)

        action = RecoveryAction(
            action_id=f"act_{entity_id}_{attempt}",
            entity_id=entity_id,
            target_channel=channel,
            scheduled_timestamp_epoch=scheduled_time,
            payload=payload,
            attempt_index=attempt,
            reason_code=reason,
            policy_approved=(self.mode == ExecutionMode.AGENTIC_AUTONOMOUS)
        )

        current_state["attempts"] = attempt
        current_state["last_trace"] = trace.model_dump()

        if self.mode == ExecutionMode.AGENTIC_AUTONOMOUS:
            phone = event.customer_phone or os.getenv("DEMO_TARGET_PHONE", "whatsapp:+919876543210")
            disp_res = self.dispatcher.dispatch(DispatchRequest(
                phone_number=phone,
                message=payload.get("message", "Recovery notification"),
                payment_url=payload.get("payment_url"),
                channel=channel
            ))
            current_state["status"] = RecoveryState.DISPATCHED
            current_state["dispatch_result"] = disp_res
        else:
            current_state["status"] = RecoveryState.SCHEDULED
            self.pending_operator_queue[entity_id] = {
                "action": action.model_dump(),
                "event": event.model_dump(),
                "trace": trace.model_dump()
            }

        self.state_store[entity_id] = current_state
        return action

    def approve_and_dispatch(self, entity_id: str) -> Optional[Dict[str, Any]]:
        item = self.pending_operator_queue.pop(entity_id, None)
        if not item:
            return None

        act_dict = item["action"]
        evt_dict = item["event"]
        phone = evt_dict.get("customer_phone") or os.getenv("DEMO_TARGET_PHONE", "whatsapp:+919876543210")
        channel = ChannelType(act_dict["target_channel"])

        disp_res = self.dispatcher.dispatch(DispatchRequest(
            phone_number=phone,
            message=act_dict["payload"].get("message", "Recovery notification"),
            payment_url=act_dict["payload"].get("payment_url"),
            channel=channel
        ))

        state = self.state_store.get(entity_id, {"attempts": 1})
        state["status"] = RecoveryState.DISPATCHED
        state["dispatch_result"] = disp_res
        self.state_store[entity_id] = state

        return {
            "entity_id": entity_id,
            "status": "APPROVED_AND_DISPATCHED",
            "dispatch": disp_res
        }

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
                elif action.target_channel == ChannelType.VOICE_IVR_NUDGE:
                    cost_paise = 150
                    if (int(event.entity_id[-1], 16) % 3 == 0):
                        recovered_paise = event.gross_amount_paise
                elif action.target_channel == ChannelType.HUMAN_ESCALATION:
                    cost_paise = 500

                phone = event.customer_phone or os.getenv("DEMO_TARGET_PHONE", "whatsapp:+919876543210")
                self.dispatcher.dispatch(DispatchRequest(
                    phone_number=phone,
                    message=action.payload.get("message", "Recovery notification"),
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
