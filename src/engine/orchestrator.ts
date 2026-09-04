import {
  FailureClassification,
  ChannelType,
  ExecutionMode,
  RecoveryState,
  P2PStatus,
  TelemetryEvent,
  RecoveryAction,
  AgenticDecisionTrace,
} from './types';
import {
  MAX_RECOVERY_ATTEMPTS,
  TERMINAL_CLASSIFICATIONS,
  TRAI_DEFER_SECONDS,
  CHANNEL_COSTS_PAISE,
} from './constants';
import { TelemetryClassifier } from './classifier';
import { AuditLedger } from './ledger';
import { SentinelDispatcher } from './dispatcher';
import { PaymentClientWrapper } from './paymentClient';
import { isTraiCompliantIST } from './utils';

export class MDPYieldCalculator {
  public static computeExpectedNetYield(
    grossPaise: number,
    kAttempt: number,
    baseProbability: number = 0.72,
    actionCostPaise: number = 60,
    lambdaFatigue: number = 0.12
  ): {
    expectedGrossPaise: number;
    expectedNetPaise: number;
    adjustedProbability: number;
    fatigueCostPaise: number;
    shouldHalt: boolean;
  } {
    const lFatigue = lambdaFatigue * (kAttempt - 1);
    const pAdj = Math.max(0.0, baseProbability * Math.pow(0.9, kAttempt - 1));
    const expectedGrossPaise = Math.round(pAdj * grossPaise);
    const fatigueCostPaise = Math.round(lFatigue * grossPaise);
    const expectedNetPaise = expectedGrossPaise - actionCostPaise - fatigueCostPaise;
    const shouldHalt = expectedNetPaise <= 0;

    return {
      expectedGrossPaise,
      expectedNetPaise,
      adjustedProbability: Number(pAdj.toFixed(3)),
      fatigueCostPaise,
      shouldHalt,
    };
  }
}

export class ReviveOrchestrator {
  public classifier: TelemetryClassifier;
  public ledger: AuditLedger;
  public dispatcher: SentinelDispatcher;
  public paymentClient: PaymentClientWrapper;
  public mode: ExecutionMode = ExecutionMode.AGENTIC_AUTONOMOUS;
  public enforceTrai: boolean = false;

  public stateStore: Map<string, any> = new Map();
  public pendingOperatorQueue: Map<string, any> = new Map();
  public decisionTraces: AgenticDecisionTrace[] = [];

  constructor() {
    this.classifier = new TelemetryClassifier();
    this.ledger = new AuditLedger();
    this.dispatcher = new SentinelDispatcher();
    this.paymentClient = new PaymentClientWrapper();
  }

  public setMode(mode: ExecutionMode) {
    this.mode = mode;
  }

  public setTraiEnforcement(enforce: boolean) {
    this.enforceTrai = enforce;
  }

  public getEntityState(entityId: string): any {
    return this.stateStore.get(entityId) || {
      entity_id: entityId,
      status: RecoveryState.DETECTED,
      attempt_count: 0,
      initial_amount_paise: 0,
      recovered_amount_paise: 0,
      total_cost_paise: 0,
    };
  }

  public registerPtpCommitment(
    entityId: string,
    promisedEpoch: number,
    promisedPaise?: number,
    note?: string
  ): any {
    const state = this.getEntityState(entityId);
    state.status = RecoveryState.PROMISE_TO_PAY_PENDING;
    state.p2p_status = P2PStatus.ACTIVE_PROMISE;
    state.ptp_epoch = promisedEpoch;
    state.ptp_amount_paise = promisedPaise || state.initial_amount_paise;
    state.ptp_note = note || "Promise to pay registered by customer";
    this.stateStore.set(entityId, state);

    this.ledger.recordEntry(
      entityId,
      state.initial_amount_paise,
      0,
      RecoveryState.PROMISE_TO_PAY_PENDING,
      state.attempt_count,
      state.total_cost_paise,
      "PTP_PROMISE_REGISTERED"
    );

    return state;
  }

  public evaluatePtpCompliance(entityId: string, actualEpoch: number): any {
    const state = this.getEntityState(entityId);
    if (state.status !== RecoveryState.PROMISE_TO_PAY_PENDING) {
      return state;
    }

    const promisedEpoch = state.ptp_epoch || 0;
    const gracePeriodLimit = promisedEpoch + 24 * 3600; // 24-hour grace period window

    if (actualEpoch <= gracePeriodLimit) {
      state.p2p_status = P2PStatus.PROMISE_HONORED;
      state.status = RecoveryState.RECOVERED;
      state.recovered_amount_paise = state.ptp_amount_paise || state.initial_amount_paise;
      this.ledger.recordEntry(
        entityId,
        state.initial_amount_paise,
        state.recovered_amount_paise,
        RecoveryState.RECOVERED,
        state.attempt_count,
        state.total_cost_paise,
        "PTP_PROMISE_HONORED_WITHIN_GRACE"
      );
    } else {
      state.p2p_status = P2PStatus.PROMISE_BROKEN;
      state.status = RecoveryState.SCHEDULED;
      this.ledger.recordEntry(
        entityId,
        state.initial_amount_paise,
        0,
        RecoveryState.SCHEDULED,
        state.attempt_count,
        state.total_cost_paise,
        "PTP_PROMISE_BROKEN_GRACE_EXPIRED_ESCALATING"
      );
    }
    this.stateStore.set(entityId, state);
    return state;
  }

  public processEvent(event: TelemetryEvent): RecoveryAction | null {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const entityId = event.entity_id;
    let state = this.stateStore.get(entityId);

    if (!state) {
      state = {
        entity_id: entityId,
        status: RecoveryState.DETECTED,
        attempt_count: 0,
        initial_amount_paise: event.gross_amount_paise,
        recovered_amount_paise: 0,
        total_cost_paise: 0,
        phone_number: event.customer_phone || "+919876543210",
      };
      this.stateStore.set(entityId, state);
    }

    // Stopping Invariant 0: If already recovered, idempotency returns null
    if (state.status === RecoveryState.RECOVERED) {
      return null;
    }

    // Stopping Invariant 1: PTP Freeze
    if (state.status === RecoveryState.PROMISE_TO_PAY_PENDING) {
      if (nowEpoch < (state.ptp_epoch || 0)) {
        return null;
      }
    }

    // Telemetry Classification
    const classification = this.classifier.diagnose(event);

    // Stopping Invariant 2: Terminal failures -> 0 touches
    if (TERMINAL_CLASSIFICATIONS.has(classification)) {
      state.status = RecoveryState.HALTED_TERMINAL;
      this.stateStore.set(entityId, state);
      this.ledger.recordEntry(
        entityId,
        event.gross_amount_paise,
        0,
        RecoveryState.HALTED_TERMINAL,
        state.attempt_count,
        state.total_cost_paise,
        classification
      );
      return null;
    }

    // Stopping Invariant 3: Max Attempts Cap (3)
    if (state.attempt_count >= MAX_RECOVERY_ATTEMPTS) {
      state.status = RecoveryState.HALTED_MAX_ATTEMPTS;
      this.stateStore.set(entityId, state);
      this.ledger.recordEntry(
        entityId,
        event.gross_amount_paise,
        0,
        RecoveryState.HALTED_MAX_ATTEMPTS,
        state.attempt_count,
        state.total_cost_paise,
        "MAX_ATTEMPTS_REACHED"
      );
      return null;
    }

    // Determine target channel & strategy
    let targetChannel = ChannelType.WHATSAPP_HINGLISH;
    let delaySeconds = 0;
    let payload: Record<string, any> = {};

    if (classification === FailureClassification.TRANSIENT_NETWORK_DOWN) {
      targetChannel = ChannelType.SILENT_API_RETRY;
      const bankHealth = this.classifier.bank_cbs_health[event.issuing_bank || 'HDFC'];
      const recoveryMins = bankHealth?.avg_recovery_mins || 45;
      delaySeconds = recoveryMins * 60;
      payload = {
        message: `Silent API retry queued after ${recoveryMins}m CBS cool-down for ${event.issuing_bank || 'bank'}.`,
        is_silent_retry: true,
      };
    } else if (classification === FailureClassification.ABANDONED_CHECKOUT) {
      targetChannel = ChannelType.WHATSAPP_HINGLISH;
      delaySeconds = 15 * 60;
      const plink = this.paymentClient.createPaymentLink(entityId, event.gross_amount_paise, "Checkout Recovery", event.customer_phone);
      payload = {
        message: `Namaste! Aapka cart checkout complete nahi ho paya. Humne aapke liye 1-Click secure link reserve kiya hai:`,
        payment_url: plink.short_url,
      };
    } else if (classification === FailureClassification.B2B_OVERDUE_INVOICE) {
      targetChannel = ChannelType.WHATSAPP_HINGLISH;
      delaySeconds = 60 * 60;
      const va = this.paymentClient.generateVirtualAccount(entityId, event.gross_amount_paise);
      payload = {
        message: `Namaste. Invoice #${entityId} pending hai. Auto-reconciliation ke liye Virtual Account VPA: ${va.upi_id} ya Account: ${va.account_number} (IFSC: ${va.ifsc}) par direct RTGS/NEFT/UPI transfer karein.`,
        payment_url: `https://rzp.io/i/va_${entityId.slice(0, 8)}`,
        virtual_account: va,
      };
    } else if (classification === FailureClassification.TRANSIENT_BALANCE_LOW) {
      targetChannel = state.attempt_count === 1 ? ChannelType.VOICE_IVR_NUDGE : ChannelType.WHATSAPP_HINGLISH;
      delaySeconds = 24 * 3600;
      const plink = this.paymentClient.createPaymentLink(entityId, event.gross_amount_paise, "Subscription Renewal", event.customer_phone);
      payload = {
        message: `Namaste! Aapka mandate payment network/balance issue ki wajah se complete nahi hua. Kripya neeche diye link se update karein:`,
        payment_url: plink.short_url,
      };
    }

    // Stopping Invariant 4: Mathematical MDP Stopping Rule
    const actionCostPaise = CHANNEL_COSTS_PAISE[targetChannel] || 60;
    const mdp = MDPYieldCalculator.computeExpectedNetYield(
      event.gross_amount_paise,
      state.attempt_count + 1,
      0.72,
      actionCostPaise,
      0.12
    );

    if (mdp.shouldHalt) {
      state.status = RecoveryState.HALTED_MDP_STOPPING_RULE;
      this.stateStore.set(entityId, state);
      this.ledger.recordEntry(
        entityId,
        event.gross_amount_paise,
        0,
        RecoveryState.HALTED_MDP_STOPPING_RULE,
        state.attempt_count,
        state.total_cost_paise,
        "HALTED_MDP_NEGATIVE_YIELD"
      );
      return null;
    }

    // Chronological Compliance: TRAI Gate (08:00 - 19:00 IST)
    let scheduledEpoch = nowEpoch + delaySeconds;
    let isTraiDeferred = false;
    if (this.enforceTrai && targetChannel !== ChannelType.SILENT_API_RETRY) {
      if (!isTraiCompliantIST(scheduledEpoch)) {
        scheduledEpoch += TRAI_DEFER_SECONDS;
        isTraiDeferred = true;
      }
    }

    const action: RecoveryAction = {
      action_id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity_id: entityId,
      target_channel: targetChannel,
      scheduled_timestamp_epoch: scheduledEpoch,
      payload: { ...payload, is_trai_deferred: isTraiDeferred },
      attempt_index: state.attempt_count + 1,
      reason_code: classification,
      policy_approved: this.mode === ExecutionMode.AGENTIC_AUTONOMOUS,
    };

    // Agentic Decision Trace
    const trace: AgenticDecisionTrace = {
      agent_id: "agent_sentinel_v2",
      telemetry_audit: `Event ${event.event_id} parsed. Raw code: ${event.raw_error_code || "NONE"}. Gross: ₹${(event.gross_amount_paise/100).toFixed(2)}.`,
      cbs_diagnosis: `Bank: ${event.issuing_bank || "N/A"} -> ${this.classifier.bank_cbs_health[event.issuing_bank || ""]?.status || "HEALTHY"}. Failure: ${classification}.`,
      fatigue_reasoning: `Attempt ${state.attempt_count + 1}/${MAX_RECOVERY_ATTEMPTS}. MDP Expected Net: ₹${(mdp.expectedNetPaise/100).toFixed(2)}. Fatigue Penalty: ₹${(mdp.fatigueCostPaise/100).toFixed(2)}.`,
      recommended_channel: targetChannel,
      confidence_score: 0.95,
      auto_executed: this.mode === ExecutionMode.AGENTIC_AUTONOMOUS,
      timestamp: new Date().toISOString(),
      reasoning_chain: {
        step_1_telemetry: `Diagnosed ${event.event_type} with error ${event.raw_error_code || "N/A"}`,
        step_2_cbs_diagnosis: `Classification: ${classification}`,
        step_3_mdp_yield: `Net expected yield ₹${(mdp.expectedNetPaise/100).toFixed(2)} > 0`,
        step_4_execution_mode: this.mode === ExecutionMode.AGENTIC_AUTONOMOUS ? "Auto-dispatched" : "Queued for operator review",
      }
    };
    this.decisionTraces.push(trace);

    if (this.mode === ExecutionMode.MANUAL_POLICY_GATED) {
      this.pendingOperatorQueue.set(entityId, { action, trace, event });
      state.status = RecoveryState.SCHEDULED;
      this.stateStore.set(entityId, state);
      return action;
    }

    // AGENTIC_AUTONOMOUS: Execute immediately
    return this.executeAction(action, state, event, actionCostPaise);
  }

  private executeAction(action: RecoveryAction, state: any, event: TelemetryEvent, actionCostPaise: number): RecoveryAction {
    state.attempt_count += 1;
    state.total_cost_paise += actionCostPaise;
    state.status = RecoveryState.DISPATCHED;

    // Dispatch via channel
    this.dispatcher.dispatch({
      phone_number: event.customer_phone || "+919876543210",
      message: action.payload.message || "Revive recovery notification",
      payment_url: action.payload.payment_url,
      channel: action.target_channel,
    });

    // Simulate recovery resolution (75% recovery for transient/checkout, or based on attempt)
    const isRecovered = Math.random() < 0.75;
    const recoveredPaise = isRecovered ? event.gross_amount_paise : 0;
    if (isRecovered) {
      state.status = RecoveryState.RECOVERED;
      state.recovered_amount_paise = recoveredPaise;
    }

    this.stateStore.set(event.entity_id, state);

    this.ledger.recordEntry(
      event.entity_id,
      event.gross_amount_paise,
      recoveredPaise,
      state.status,
      state.attempt_count,
      state.total_cost_paise,
      action.reason_code
    );

    return action;
  }

  public approveAndDispatch(entityId: string): RecoveryAction | null {
    const item = this.pendingOperatorQueue.get(entityId);
    if (!item) return null;

    const { action, event } = item;
    const state = this.getEntityState(entityId);
    action.policy_approved = true;

    const actionCostPaise = CHANNEL_COSTS_PAISE[action.target_channel] || 60;
    const executed = this.executeAction(action, state, event, actionCostPaise);
    this.pendingOperatorQueue.delete(entityId);
    return executed;
  }

  public rejectAndHalt(entityId: string, reason: string = "OPERATOR_REJECTED"): boolean {
    const item = this.pendingOperatorQueue.get(entityId);
    if (!item) return false;

    const state = this.getEntityState(entityId);
    state.status = RecoveryState.HALTED_TERMINAL;
    this.stateStore.set(entityId, state);

    this.ledger.recordEntry(
      entityId,
      state.initial_amount_paise,
      0,
      RecoveryState.HALTED_TERMINAL,
      state.attempt_count,
      state.total_cost_paise,
      reason
    );

    this.pendingOperatorQueue.delete(entityId);
    return true;
  }

  public processBatch(events: TelemetryEvent[]) {
    for (const evt of events) {
      this.processEvent(evt);
    }
  }

  public getEntitySSOT(entityId: string): any {
    const state = this.getEntityState(entityId);
    const pending = this.pendingOperatorQueue.get(entityId);
    const relevantLedger = this.ledger.chain.filter(b => b.entity_id === entityId);
    return {
      entity_id: entityId,
      current_state: state,
      pending_approval: Boolean(pending),
      pending_details: pending,
      ledger_history: relevantLedger,
      decision_traces: this.decisionTraces.filter(t => t.telemetry_audit.includes(entityId)),
    };
  }

  public replayEvent(entityId: string, event: TelemetryEvent, overrideMode?: ExecutionMode): any {
    const prevMode = this.mode;
    if (overrideMode) this.mode = overrideMode;
    const action = this.processEvent(event);
    this.mode = prevMode;
    return {
      replayed_entity: entityId,
      result_action: action,
      current_state: this.getEntityState(entityId),
    };
  }

  public clear() {
    this.stateStore.clear();
    this.pendingOperatorQueue.clear();
    this.decisionTraces = [];
    this.ledger.clear();
    this.dispatcher.clear();
  }
}
