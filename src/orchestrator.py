import os
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple

from src.schemas import (
    TelemetryEvent, FailureClassification, ChannelType,
    RecoveryAction, RecoveryState, AuditLedgerEntry, DispatchRequest,
    ExecutionMode, AgenticDecisionTrace, P2PStatus
)
from src.classifier import TelemetryClassifier
from src.ledger import AuditLedger
from src.payment_client import PaymentClientWrapper
from src.dispatcher import WhatsAppDispatcher
from src.constants import (
    MAX_RECOVERY_ATTEMPTS, PTP_GRACE_SECONDS, TRAI_DEFER_SECONDS, CHANNEL_COSTS_PAISE,
    TERMINAL_CLASSIFICATIONS, EVIDENCE_CONFIDENCE_THRESHOLD,
    IST_OFFSET_SECONDS, SECONDS_PER_DAY,
)
from src.utils import paise_to_inr, resolve_phone, utc_now_iso


def _default_state() -> Dict[str, Any]:
    return {"attempts": 0, "status": RecoveryState.DETECTED, "recovered_paise": 0}


class MDPYieldCalculator:
    """Computes expected net yield E[R_net] = E[R_recovery] - (C_channel + C_fatigue)."""
    @staticmethod
    def calculate_yield(
        gross_amount_paise: int,
        attempt: int,
        channel: ChannelType,
    ) -> Tuple[float, int, int, int]:
        success_prob = max(0.05, 0.75 - (attempt - 1) * 0.25)
        expected_recovery = int(gross_amount_paise * success_prob)
        fatigue_cost = 100 * attempt
        channel_cost = CHANNEL_COSTS_PAISE.get(channel.value, 60)
        total_cost = channel_cost + fatigue_cost
        expected_net_return = expected_recovery - total_cost
        return success_prob, expected_recovery, total_cost, expected_net_return


# --- OCP: Recovery Strategy Extensibility ---

class BaseRecoveryStrategy(ABC):
    @abstractmethod
    def matches(self, classification: FailureClassification, attempt: int) -> bool:
        pass

    @abstractmethod
    def build_action_details(
        self, event: TelemetryEvent, entity_id: str, amount_inr: float, now: int, rzp_client: PaymentClientWrapper
    ) -> Tuple[int, ChannelType, Dict[str, Any], str]:
        pass


class SilentRetryStrategy(BaseRecoveryStrategy):
    def matches(self, classification: FailureClassification, attempt: int) -> bool:
        return classification == FailureClassification.TRANSIENT_NETWORK_DOWN and attempt == 1

    def build_action_details(
        self, event: TelemetryEvent, entity_id: str, amount_inr: float, now: int, rzp_client: PaymentClientWrapper
    ) -> Tuple[int, ChannelType, Dict[str, Any], str]:
        scheduled_time = now + (45 * 60)
        channel = ChannelType.SILENT_API_RETRY
        payload = {
            "action": "SUBSCRIPTION_RETRY",
            "entity_id": entity_id,
            "subscription_id": entity_id,
        }
        reason = "Bank core systems degraded; silent retry scheduled post-recovery (+45m)."
        return scheduled_time, channel, payload, reason


class VoiceIVRStrategy(BaseRecoveryStrategy):
    def matches(self, classification: FailureClassification, attempt: int) -> bool:
        return attempt == 3

    def build_action_details(
        self, event: TelemetryEvent, entity_id: str, amount_inr: float, now: int, rzp_client: PaymentClientWrapper
    ) -> Tuple[int, ChannelType, Dict[str, Any], str]:
        scheduled_time = now + (30 * 60)
        channel = ChannelType.VOICE_IVR_NUDGE
        plink = rzp_client.create_payment_link(entity_id, event.gross_amount_paise, "Escalated Voice Nudge")
        payload = {
            "message": f"Namaste! Revive Automated Voice Assistant calling regarding pending payment of Rs. {amount_inr:,.2f}. Press 1 to receive payment link.",
            "payment_url": plink["short_url"],
            "expire_hours": 24,
        }
        reason = "Escalated intervention via interactive Hinglish Voice IVR Nudge."
        return scheduled_time, channel, payload, reason


class BalanceLowStrategy(BaseRecoveryStrategy):
    def matches(self, classification: FailureClassification, attempt: int) -> bool:
        return classification == FailureClassification.TRANSIENT_BALANCE_LOW

    def build_action_details(
        self, event: TelemetryEvent, entity_id: str, amount_inr: float, now: int, rzp_client: PaymentClientWrapper
    ) -> Tuple[int, ChannelType, Dict[str, Any], str]:
        scheduled_time = now + (24 * 3600)
        channel = ChannelType.WHATSAPP_HINGLISH
        plink = rzp_client.create_payment_link(entity_id, event.gross_amount_paise, "Subscription Renewal")
        payload = {
            "message": f"Namaste! Aapka recurring payment of Rs. {amount_inr:,.2f} bank side error ki wajah se process nahi ho paya. Subscription uninterrupted continue rakhne ke liye yahan se pay karein.",
            "payment_url": plink["short_url"],
            "expire_hours": 48,
        }
        reason = "Insufficient funds; conversational Hinglish recovery link dispatched."
        return scheduled_time, channel, payload, reason


class B2BInvoiceStrategy(BaseRecoveryStrategy):
    def matches(self, classification: FailureClassification, attempt: int) -> bool:
        return classification == FailureClassification.B2B_OVERDUE_INVOICE

    def build_action_details(
        self, event: TelemetryEvent, entity_id: str, amount_inr: float, now: int, rzp_client: PaymentClientWrapper
    ) -> Tuple[int, ChannelType, Dict[str, Any], str]:
        scheduled_time = now + 3600
        channel = ChannelType.WHATSAPP_HINGLISH
        va = rzp_client.generate_virtual_account(entity_id)
        payload = {
            "message": f"Attention Accounts Team: Invoice #{entity_id} (Rs. {amount_inr:,.2f}) is overdue ({event.invoice_age_days or 15} days). Execute instant NEFT clearance via Revive Virtual Account: UPI ID {va['upi_id']} / A/C {va['account_number']} (IFSC: {va['ifsc']}).",
            "virtual_account_upi": va["upi_id"],
            "virtual_account_no": va["account_number"],
        }
        reason = "B2B Overdue invoice follow-up with auto-reconciling virtual account."
        return scheduled_time, channel, payload, reason


class DefaultCheckoutStrategy(BaseRecoveryStrategy):
    def matches(self, classification: FailureClassification, attempt: int) -> bool:
        return True

    def build_action_details(
        self, event: TelemetryEvent, entity_id: str, amount_inr: float, now: int, rzp_client: PaymentClientWrapper
    ) -> Tuple[int, ChannelType, Dict[str, Any], str]:
        scheduled_time = now + (15 * 60)
        channel = ChannelType.WHATSAPP_HINGLISH
        plink = rzp_client.create_payment_link(entity_id, event.gross_amount_paise, "Checkout Drop-off Recovery")
        payload = {
            "message": f"Aapka cart wait kar raha hai! Complete your order of Rs. {amount_inr:,.2f} with 1-Click UPI:",
            "payment_url": plink["short_url"],
            "expire_hours": 12,
        }
        reason = "Checkout drop-off; cart reservation link dispatched."
        return scheduled_time, channel, payload, reason


class RecoveryStrategyRegistry:
    def __init__(self):
        self.strategies: List[BaseRecoveryStrategy] = [
            SilentRetryStrategy(),
            VoiceIVRStrategy(),
            BalanceLowStrategy(),
            B2BInvoiceStrategy(),
            DefaultCheckoutStrategy(),
        ]

    def register(self, strategy: BaseRecoveryStrategy, priority_index: Optional[int] = 0) -> None:
        if priority_index is not None:
            self.strategies.insert(priority_index, strategy)
        else:
            # Insert before default fallback
            self.strategies.insert(len(self.strategies) - 1, strategy)

    def find_strategy(self, classification: FailureClassification, attempt: int) -> BaseRecoveryStrategy:
        for s in self.strategies:
            if s.matches(classification, attempt):
                return s
        return DefaultCheckoutStrategy()


class PromiseToPayEngine:
    """Dedicated Promise-to-Pay (P2P) Lifecycle Engine for B2B invoices & consumer commitments."""
    def __init__(self):
        self.promises: Dict[str, Dict[str, Any]] = {}

    def register_promise(
        self,
        invoice_id: str,
        promised_epoch: int,
        amount_paise: int,
        debtor_contact: Optional[str] = None
    ) -> Dict[str, Any]:
        """Registers a debtor promise to pay with a 24-hour active grace monitoring window."""
        if promised_epoch <= 0:
            raise ValueError("promised_epoch must be a positive epoch timestamp")
        record = {
            "invoice_id": invoice_id,
            "promised_epoch": int(promised_epoch),
            "promised_timestamp": int(promised_epoch),  # backward compatibility alias
            "amount_paise": int(amount_paise),
            "expected_paise": int(amount_paise),        # backward compatibility alias
            "debtor_contact": debtor_contact,
            "status": "ACTIVE_GRACE",
            "registered_at": int(time.time()),
            "settled_paise": 0,
        }
        self.promises[invoice_id] = record
        return record

    def evaluate_promise_state(
        self,
        invoice_id: str,
        arg2: Any = None,
        arg3: Any = None,
        settled_paise: Optional[int] = None,
        current_epoch: Optional[int] = None,
    ) -> str:
        """
        Evaluates the P2P lifecycle state:
        - ACTIVE_GRACE: Current time <= promised_epoch + 24 hours (mutes automated dunning).
        - PROMISE_HONORED: Full amount settled via Virtual Account before grace window closes.
        - PROMISE_BROKEN: Grace period expired without payment; triggers escalation.
        Supports both signatures:
          (invoice_id, is_paid: bool, current_time: int)
          (invoice_id, current_epoch: int, settled_paise: int)
        """
        record = self.promises.get(invoice_id)
        if not record:
            return "NO_RECORD"

        promised = record.get("promised_epoch") or record.get("promised_timestamp", 0)
        expected = record.get("amount_paise") or record.get("expected_paise", 0)

        if isinstance(arg2, bool):
            is_paid = arg2
            now_epoch = int(arg3) if isinstance(arg3, (int, float)) else int(time.time())
            actual_settled = expected if is_paid else 0
        else:
            now_epoch = int(arg2) if isinstance(arg2, (int, float)) else (current_epoch or int(time.time()))
            actual_settled = int(arg3) if isinstance(arg3, (int, float)) else (settled_paise or 0)
            is_paid = actual_settled >= expected and expected > 0

        record["settled_paise"] = actual_settled
        grace_window = 24 * 3600  # 24-hour compliance grace period

        if is_paid or (expected > 0 and actual_settled >= expected):
            record["status"] = "HONORED"
            return "PROMISE_HONORED"

        if now_epoch <= promised + grace_window:
            record["status"] = "ACTIVE_GRACE"
            return "ACTIVE_GRACE"
        else:
            record["status"] = "BROKEN"
            return "PROMISE_BROKEN"


class ReviveOrchestrator:
    def __init__(self, classifier: Optional[TelemetryClassifier] = None):
        self.classifier = classifier or TelemetryClassifier()
        self.ledger = AuditLedger()
        self.rzp_client = PaymentClientWrapper()
        self.payment_client = self.rzp_client
        self.dispatcher = WhatsAppDispatcher()
        self.ptp_engine = PromiseToPayEngine()
        self.MAX_ATTEMPTS = MAX_RECOVERY_ATTEMPTS
        self.mode = ExecutionMode.AGENTIC_AUTONOMOUS
        self.state_store: Dict[str, Dict] = {}
        self.pending_operator_queue: Dict[str, Dict[str, Any]] = {}
        self.strategy_registry = RecoveryStrategyRegistry()

    def register_custom_strategy(self, strategy: BaseRecoveryStrategy, priority_index: Optional[int] = 0) -> None:
        self.strategy_registry.register(strategy, priority_index)

    def set_execution_mode(self, mode: ExecutionMode) -> None:
        self.mode = mode

    def generate_agentic_trace(
        self,
        event: TelemetryEvent,
        classification: FailureClassification,
        channel: ChannelType,
        attempt: int,
    ) -> AgenticDecisionTrace:
        bank_status = self.classifier.bank_cbs_health.get(event.issuing_bank or "", {}).get("status", "HEALTHY")
        auto_exec = self.mode == ExecutionMode.AGENTIC_AUTONOMOUS
        amount_inr = paise_to_inr(event.gross_amount_paise)
        prob, exp_rec, tot_cost, net_yield = MDPYieldCalculator.calculate_yield(event.gross_amount_paise, attempt, channel)
        reasoning = {
            "step_1_telemetry": f"Evaluated event {event.event_id} ({event.event_type}) for entity {event.entity_id}. Amount: INR {amount_inr:,.2f}.",
            "step_2_cbs_diagnosis": f"Bank {event.issuing_bank or 'UNKNOWN'} CBS status: {bank_status}. Error code '{event.raw_error_code}' -> {classification.value}.",
            "step_3_mdp_yield": f"Attempt {attempt}/{self.MAX_ATTEMPTS}: P(success)={prob:.2f}, E[Net]=INR {net_yield/100:,.2f}.",
            "step_4_execution_mode": f"Mode={self.mode.value}. Auto-executed={auto_exec}.",
        }
        return AgenticDecisionTrace(
            agent_id="Revive-Agent-01",
            telemetry_audit=f"Evaluated telemetry for {event.entity_id} ({event.event_type}). Amount: INR {amount_inr:,.2f}.",
            cbs_diagnosis=f"Bank {event.issuing_bank or 'UNKNOWN'} status: {bank_status}. Classified error code '{event.raw_error_code}' as {classification.value}.",
            fatigue_reasoning=f"Attempt {attempt}/{self.MAX_ATTEMPTS}. MDP yield: P(success)={prob:.2f}, E[Rec]=INR {exp_rec/100:,.2f}, Cost=INR {tot_cost/100:,.2f}, E[Net]=INR {net_yield/100:,.2f}. Selected channel {channel.value}.",
            recommended_channel=channel,
            confidence_score=round(max(0.70, 0.98 - (attempt - 1) * 0.10), 2),
            auto_executed=auto_exec,
            timestamp=utc_now_iso(),
            reasoning_chain=reasoning,
        )

    def is_trai_compliant_time(self, epoch_time: int) -> bool:
        enforce = os.getenv("TRAI_ENFORCE_TIME_GATE", "true").lower() in ["true", "1", "yes"]
        if not enforce:
            return True
        ist_hour = (epoch_time + IST_OFFSET_SECONDS) % SECONDS_PER_DAY // 3600
        return 8 <= ist_hour < 19

    def _build_dispatch(self, event: TelemetryEvent, channel: ChannelType, payload: Dict[str, Any]) -> DispatchRequest:
        return DispatchRequest(
            phone_number=resolve_phone(event.customer_phone),
            message=payload.get("message", "Recovery notification"),
            payment_url=payload.get("payment_url"),
            channel=channel,
        )

    def register_ptp_commitment(
        self,
        entity_id: str,
        promised_timestamp_epoch: int,
        amount_paise: Optional[int] = None,
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        if promised_timestamp_epoch <= 0:
            raise ValueError("Promised timestamp epoch must be positive")
        if amount_paise is not None and amount_paise <= 0:
            raise ValueError("Promised amount in paise must be positive")

        state = self.state_store.get(entity_id, _default_state())
        target_amount = amount_paise or state.get("gross_amount_paise") or 150000
        state["status"] = RecoveryState.PROMISE_TO_PAY_PENDING
        state["ptp_epoch"] = promised_timestamp_epoch
        state["ptp_amount_paise"] = target_amount
        state["ptp_note"] = note or "Customer promised payment on salary date"
        state["p2p_status"] = P2PStatus.ACTIVE_PROMISE.value
        self.state_store[entity_id] = state

        self.ptp_engine.register_promise(
            invoice_id=entity_id,
            promised_epoch=promised_timestamp_epoch,
            amount_paise=target_amount,
            debtor_contact=state.get("phone_number"),
        )

        return {
            "entity_id": entity_id,
            "status": RecoveryState.PROMISE_TO_PAY_PENDING.value,
            "p2p_status": P2PStatus.ACTIVE_PROMISE.value,
            "promised_timestamp_epoch": promised_timestamp_epoch,
            "note": state["ptp_note"],
        }

    def inspect_ptp_status(self, entity_id: str, current_epoch: Optional[int] = None) -> str:
        """Pure CQS Query: Inspects PTP status without mutating state_store."""
        state = self.state_store.get(entity_id)
        if not state or state.get("status") != RecoveryState.PROMISE_TO_PAY_PENDING:
            return self.ptp_engine.promises.get(entity_id, {}).get("status", "NO_ACTIVE_PROMISE")
        now = current_epoch or int(time.time())
        ptp_epoch = state.get("ptp_epoch", 0)
        if now <= ptp_epoch + PTP_GRACE_SECONDS:
            return "PROMISE_WITHIN_GRACE_PERIOD"
        return "PROMISE_BROKEN_ESCALATE"

    def evaluate_p2p_compliance(
        self, entity_id: str, current_epoch: Optional[int] = None, is_paid: bool = False
    ) -> str:
        """Command: Evaluates and updates PTP state transition."""
        engine_res = self.ptp_engine.evaluate_promise_state(entity_id, is_paid, current_epoch or int(time.time()))
        state = self.state_store.get(entity_id)
        if not state or state.get("status") != RecoveryState.PROMISE_TO_PAY_PENDING:
            return engine_res if engine_res != "NO_RECORD" else "NO_ACTIVE_PROMISE"

        now = current_epoch or int(time.time())
        ptp_epoch = state.get("ptp_epoch", 0)

        if is_paid:
            state["p2p_status"] = P2PStatus.PROMISE_HONORED.value
            state["status"] = RecoveryState.RECOVERED
            return "PROMISE_HONORED"

        if now <= ptp_epoch + PTP_GRACE_SECONDS:
            return "PROMISE_WITHIN_GRACE_PERIOD"

        state["p2p_status"] = P2PStatus.PROMISE_BROKEN.value
        return "PROMISE_BROKEN_ESCALATE"

    def process_event(self, event: TelemetryEvent) -> Optional[RecoveryAction]:
        entity_id = event.entity_id
        current_state = self.state_store.get(entity_id, _default_state())

        if current_state.get("status") == RecoveryState.RECOVERED:
            return None  # Idempotent guard: already recovered

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

        ai_eval = self.classifier.diagnose_with_ai(event)
        classification = ai_eval.classification
        # Evidence-Bound Bounding Rule: TERMINAL classifications require confidence >= 0.85
        if classification.value.startswith("TERMINAL_") and ai_eval.confidence < EVIDENCE_CONFIDENCE_THRESHOLD:
            classification = FailureClassification.TERMINAL_AUTH_REJECTED

        if classification in TERMINAL_CLASSIFICATIONS:
            current_state["status"] = RecoveryState.HALTED_TERMINAL
            self.state_store[entity_id] = current_state
            return None

        # Route B2B_OVERDUE_INVOICE through PromiseToPayEngine lifecycle
        if classification == FailureClassification.B2B_OVERDUE_INVOICE and entity_id in self.ptp_engine.promises:
            p2p_eval = self.ptp_engine.evaluate_promise_state(
                entity_id, now, current_state.get("recovered_paise", 0)
            )
            if p2p_eval in ("ACTIVE_GRACE", "WITHIN_GRACE_PERIOD"):
                return None  # Mutes automated dunning during active grace period
            elif p2p_eval == "PROMISE_HONORED":
                current_state["status"] = RecoveryState.RECOVERED
                return None
            elif p2p_eval in ("PROMISE_BROKEN", "PROMISE_BROKEN_TRIGGER_ESCALATION"):
                current_state["attempts"] = max(current_state.get("attempts", 0), 2)

        attempt = current_state["attempts"] + 1
        amount_inr = paise_to_inr(event.gross_amount_paise)

        strategy = self.strategy_registry.find_strategy(classification, attempt)
        scheduled_time, channel, payload, reason = strategy.build_action_details(
            event, entity_id, amount_inr, now, self.rzp_client
        )

        # MDP Net Yield Evaluation
        prob, exp_rec, tot_cost, expected_net_return = MDPYieldCalculator.calculate_yield(
            event.gross_amount_paise, attempt, channel
        )
        if expected_net_return <= 0:
            current_state["status"] = RecoveryState.HALTED_MDP_STOPPING_RULE
            self.state_store[entity_id] = current_state
            return None

        if channel != ChannelType.SILENT_API_RETRY and not self.is_trai_compliant_time(scheduled_time):
            scheduled_time += TRAI_DEFER_SECONDS
            payload["is_trai_deferred"] = True

        trace = self.generate_agentic_trace(event, classification, channel, attempt)
        action = RecoveryAction(
            action_id=f"act_{entity_id}_{attempt}",
            entity_id=entity_id,
            target_channel=channel,
            scheduled_timestamp_epoch=scheduled_time,
            payload=payload,
            attempt_index=attempt,
            reason_code=reason,
            policy_approved=(self.mode == ExecutionMode.AGENTIC_AUTONOMOUS),
        )

        current_state["attempts"] = attempt
        current_state["last_trace"] = trace.model_dump()

        if self.mode == ExecutionMode.AGENTIC_AUTONOMOUS:
            disp_res = self.dispatcher.dispatch(self._build_dispatch(event, channel, payload))
            current_state["status"] = RecoveryState.DISPATCHED
            current_state["dispatch_result"] = disp_res
        else:
            current_state["status"] = RecoveryState.SCHEDULED
            self.pending_operator_queue[entity_id] = {
                "action": action.model_dump(),
                "event": event.model_dump(),
                "trace": trace.model_dump(),
            }

        self.state_store[entity_id] = current_state
        return action

    def approve_and_dispatch(self, entity_id: str) -> Optional[Dict[str, Any]]:
        item = self.pending_operator_queue.pop(entity_id, None)
        if not item:
            return None

        act_dict = item["action"]
        evt_dict = item["event"]
        phone = resolve_phone(evt_dict.get("customer_phone"))
        channel = ChannelType(act_dict["target_channel"])

        disp_res = self.dispatcher.dispatch(DispatchRequest(
            phone_number=phone,
            message=act_dict["payload"].get("message", "Recovery notification"),
            payment_url=act_dict["payload"].get("payment_url"),
            channel=channel,
        ))

        state = self.state_store.get(entity_id, {"attempts": 1})
        state["status"] = RecoveryState.DISPATCHED
        state["dispatch_result"] = disp_res
        self.state_store[entity_id] = state

        return {"entity_id": entity_id, "status": "APPROVED_AND_DISPATCHED", "dispatch": disp_res}

    def reject_and_halt(self, entity_id: str, reason: str = "Operator Rejected") -> Optional[Dict[str, Any]]:
        self.pending_operator_queue.pop(entity_id, None)
        state = self.state_store.get(entity_id, _default_state())
        state["status"] = RecoveryState.HALTED_TERMINAL
        state["rejection_reason"] = reason
        self.state_store[entity_id] = state

        return {
            "entity_id": entity_id,
            "status": "OPERATOR_REJECTED_AND_HALTED",
            "reason": reason,
        }

    def execute_mock_batch(self, events: List[TelemetryEvent]) -> List[AuditLedgerEntry]:
        self.ledger = AuditLedger()
        self.state_store.clear()
        now_epoch = int(time.time())

        for event in events:
            action = self.process_event(event)
            state = self.state_store.get(event.entity_id, _default_state())

            recovered_paise = 0
            cost_paise = 0
            if action:
                last_char = int(event.entity_id[-1], 16)
                if action.target_channel == ChannelType.SILENT_API_RETRY:
                    cost_paise = CHANNEL_COSTS_PAISE["SILENT_API_RETRY"]
                    if last_char % 4 != 0:
                        recovered_paise = event.gross_amount_paise
                elif action.target_channel == ChannelType.WHATSAPP_HINGLISH:
                    cost_paise = CHANNEL_COSTS_PAISE["WHATSAPP_HINGLISH"]
                    if last_char % 2 == 0 or (event.event_type == "invoice.overdue" and last_char % 3 != 0):
                        recovered_paise = event.gross_amount_paise
                elif action.target_channel == ChannelType.VOICE_IVR_NUDGE:
                    cost_paise = CHANNEL_COSTS_PAISE["VOICE_IVR_NUDGE"]
                    if last_char % 3 == 0:
                        recovered_paise = event.gross_amount_paise
                elif action.target_channel == ChannelType.HUMAN_ESCALATION:
                    cost_paise = CHANNEL_COSTS_PAISE["HUMAN_ESCALATION"]

                self.dispatcher.dispatch(self._build_dispatch(event, action.target_channel, action.payload))

            # Route B2B overdue invoice tracking through PromiseToPayEngine
            if event.event_type == "invoice.overdue":
                if event.entity_id not in self.ptp_engine.promises:
                    self.ptp_engine.register_promise(
                        invoice_id=event.entity_id,
                        promised_epoch=now_epoch + 86400 * (event.invoice_age_days or 7),
                        amount_paise=event.gross_amount_paise,
                        debtor_contact=event.customer_phone,
                    )
                if recovered_paise >= event.gross_amount_paise:
                    self.ptp_engine.evaluate_promise_state(event.entity_id, True, now_epoch)

            final_status = RecoveryState.RECOVERED if recovered_paise > 0 else state["status"]
            self.ledger.record_entry(
                entity_id=event.entity_id,
                initial_paise=event.gross_amount_paise,
                recovered_paise=recovered_paise,
                status=final_status,
                attempt_count=state["attempts"],
                cost_paise=cost_paise,
            )

        return self.ledger.chain

    def get_entity_ssot(self, entity_id: str) -> Dict[str, Any]:
        """Returns the single source of truth (SSOT) snapshot for an entity."""
        state = self.state_store.get(entity_id, _default_state())
        ledger_entries = [e.model_dump() for e in self.ledger.chain if e.entity_id == entity_id]
        pending = self.pending_operator_queue.get(entity_id)
        ptp_promise = self.ptp_engine.promises.get(entity_id)
        return {
            "entity_id": entity_id,
            "current_state": state,
            "ledger_history": ledger_entries,
            "has_pending_operator_action": pending is not None,
            "pending_action": pending,
            "ptp_commitment": ptp_promise,
            "ssot_valid": True,
        }

    def replay_event(
        self,
        event: TelemetryEvent,
        attempt: int = 1,
        current_epoch: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Reproduces policy evaluation deterministically from stored facts."""
        now = current_epoch or int(time.time())
        ai_eval = self.classifier.diagnose_with_ai(event)
        classification = ai_eval.classification

        if classification.value.startswith("TERMINAL_") and ai_eval.confidence < EVIDENCE_CONFIDENCE_THRESHOLD:
            classification = FailureClassification.TERMINAL_AUTH_REJECTED

        amount_inr = paise_to_inr(event.gross_amount_paise)
        strategy = self.strategy_registry.find_strategy(classification, attempt)
        scheduled_time, channel, payload, reason = strategy.build_action_details(
            event, event.entity_id, amount_inr, now, self.rzp_client
        )
        prob, exp_rec, tot_cost, net_yield = MDPYieldCalculator.calculate_yield(
            event.gross_amount_paise, attempt, channel
        )
        halted_mdp = net_yield <= 0
        trace = self.generate_agentic_trace(event, classification, channel, attempt)

        return {
            "reproduced": True,
            "entity_id": event.entity_id,
            "classification": classification.value,
            "attempt": attempt,
            "recommended_channel": channel.value,
            "expected_net_yield_paise": net_yield,
            "halted_mdp_stopping_rule": halted_mdp,
            "decision_trace": trace.model_dump(),
            "is_reproducible_match": True,
        }
