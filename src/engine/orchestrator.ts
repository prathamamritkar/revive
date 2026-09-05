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

// NOTE: this file is imported by BOTH server.ts (Node) and src/App.tsx
// (browser, via Vite). It must never import an LLM SDK directly (e.g.
// @google/genai) — that would ship a Node-oriented dependency into the
// browser bundle for no benefit, since a client-side call would need a
// browser-exposed API key anyway (unsafe). The real LLM agent
// (src/engine/agenticAgent.ts) is imported only by server.ts, which then
// injects its decision into this orchestrator via processEventWithAgent()
// below. This file stays fully deterministic and browser-safe.

export interface RecoveryCandidate {
  strategyName: string;
  channel: ChannelType;
  buildPayload: () => { delaySeconds: number; payload: Record<string, any> };
}

/** Minimal shape this file needs from an externally-resolved agent decision,
 * kept structurally compatible with agenticAgent.ts's AgenticInterventionDecision
 * without importing that module (see note above). */
export interface ResolvedIntervention {
  selectedStrategyName: string;
  reasoning: string;
  confidence: number;
  decisionSource: string;
}

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

  /**
   * Runs every stopping-invariant guard (idempotency, PTP freeze, terminal
   * halt, max-attempts cap) and returns either a halt result (already
   * recorded) or the continuation context needed to pick and dispatch an
   * intervention. Shared by processEvent() and processEventWithAgent() so
   * the two paths can never drift on what makes a case eligible to proceed.
   */
  private evaluateGuards(
    event: TelemetryEvent
  ): { halted: true; action: null } | { halted: false; state: any; classification: FailureClassification; nowEpoch: number } {
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

    if (state.status === RecoveryState.RECOVERED) {
      return { halted: true, action: null };
    }

    if (state.status === RecoveryState.PROMISE_TO_PAY_PENDING) {
      if (nowEpoch < (state.ptp_epoch || 0)) {
        return { halted: true, action: null };
      }
    }

    const classification = this.classifier.diagnose(event);

    if (TERMINAL_CLASSIFICATIONS.has(classification)) {
      state.status = RecoveryState.HALTED_TERMINAL;
      this.stateStore.set(entityId, state);
      this.ledger.recordEntry(
        entityId, event.gross_amount_paise, 0, RecoveryState.HALTED_TERMINAL,
        state.attempt_count, state.total_cost_paise, classification
      );
      return { halted: true, action: null };
    }

    if (state.attempt_count >= MAX_RECOVERY_ATTEMPTS) {
      state.status = RecoveryState.HALTED_MAX_ATTEMPTS;
      this.stateStore.set(entityId, state);
      this.ledger.recordEntry(
        entityId, event.gross_amount_paise, 0, RecoveryState.HALTED_MAX_ATTEMPTS,
        state.attempt_count, state.total_cost_paise, "MAX_ATTEMPTS_REACHED"
      );
      return { halted: true, action: null };
    }

    return { halted: false, state, classification, nowEpoch };
  }

  /**
   * All legal candidate interventions for this classification/attempt.
   * Ordering matters for the deterministic (non-agentic) path, which always
   * takes candidates[0] — that ordering is chosen to exactly reproduce the
   * pre-existing single-choice behavior, so processEvent()'s output is
   * unchanged for callers (App.tsx's browser fallback) that never resolve
   * an agent decision.
   */
  private buildCandidates(event: TelemetryEvent, classification: FailureClassification, attemptCount: number): RecoveryCandidate[] {
    const entityId = event.entity_id;

    if (classification === FailureClassification.TRANSIENT_NETWORK_DOWN) {
      return [{
        strategyName: 'SilentRetryStrategy',
        channel: ChannelType.SILENT_API_RETRY,
        buildPayload: () => {
          const bankHealth = this.classifier.bank_cbs_health[event.issuing_bank || 'HDFC'];
          const recoveryMins = bankHealth?.avg_recovery_mins || 45;
          return {
            delaySeconds: recoveryMins * 60,
            payload: {
              message: `Silent API retry queued after ${recoveryMins}m CBS cool-down for ${event.issuing_bank || 'bank'}.`,
              is_silent_retry: true,
            },
          };
        },
      }];
    }

    if (classification === FailureClassification.ABANDONED_CHECKOUT) {
      return [{
        strategyName: 'DefaultCheckoutStrategy',
        channel: ChannelType.WHATSAPP_HINGLISH,
        buildPayload: () => {
          const plink = this.paymentClient.createPaymentLink(entityId, event.gross_amount_paise, "Checkout Recovery", event.customer_phone);
          return {
            delaySeconds: 15 * 60,
            payload: {
              message: `Namaste! Aapka cart checkout complete nahi ho paya. Humne aapke liye 1-Click secure link reserve kiya hai:`,
              payment_url: plink.short_url,
            },
          };
        },
      }];
    }

    if (classification === FailureClassification.B2B_OVERDUE_INVOICE) {
      const candidates: RecoveryCandidate[] = [{
        strategyName: 'B2BInvoiceStrategy',
        channel: ChannelType.WHATSAPP_HINGLISH,
        buildPayload: () => {
          const va = this.paymentClient.generateVirtualAccount(entityId, event.gross_amount_paise);
          return {
            delaySeconds: 60 * 60,
            payload: {
              message: `Namaste. Invoice #${entityId} pending hai. Auto-reconciliation ke liye Virtual Account VPA: ${va.upi_id} ya Account: ${va.account_number} (IFSC: ${va.ifsc}) par direct RTGS/NEFT/UPI transfer karein.`,
              payment_url: `https://rzp.io/i/va_${entityId.slice(0, 8)}`,
              virtual_account: va,
            },
          };
        },
      }];
      if (attemptCount >= 1) {
        // Previously ChannelType.HUMAN_ESCALATION had a cost entry
        // (constants.ts) and a dispatch handler but no path here ever
        // produced it — dead, same gap as the Python backend had.
        candidates.push({
          strategyName: 'EscalationStrategy',
          channel: ChannelType.HUMAN_ESCALATION,
          buildPayload: () => ({
            delaySeconds: 30 * 60,
            payload: {
              message: `Escalation: Invoice #${entityId} remains overdue after automated follow-up. Routed to Finance Ops for direct commercial contact.`,
            },
          }),
        });
      }
      return candidates;
    }

    if (classification === FailureClassification.TRANSIENT_BALANCE_LOW) {
      const whatsappCandidate: RecoveryCandidate = {
        strategyName: 'BalanceLowStrategy',
        channel: ChannelType.WHATSAPP_HINGLISH,
        buildPayload: () => {
          const plink = this.paymentClient.createPaymentLink(entityId, event.gross_amount_paise, "Subscription Renewal", event.customer_phone);
          return {
            delaySeconds: 24 * 3600,
            payload: {
              message: `Namaste! Aapka mandate payment network/balance issue ki wajah se complete nahi hua. Kripya neeche diye link se update karein:`,
              payment_url: plink.short_url,
            },
          };
        },
      };
      const voiceCandidate: RecoveryCandidate = {
        strategyName: 'VoiceIVRStrategy',
        channel: ChannelType.VOICE_IVR_NUDGE,
        buildPayload: () => ({
          delaySeconds: 24 * 3600,
          payload: {
            message: `Namaste! Revive Automated Voice Assistant calling regarding a pending mandate payment. Press 1 to receive the payment link.`,
          },
        }),
      };
      // Prior behavior picked Voice IVR on attempt 1 else WhatsApp, as the
      // ONLY option each time. Both are now legal candidates every time so
      // an agent can genuinely choose; ordering preserves the old default
      // as candidates[0] for the deterministic (non-agentic) path.
      return attemptCount === 1 ? [voiceCandidate, whatsappCandidate] : [whatsappCandidate, voiceCandidate];
    }

    return [{
      strategyName: 'DefaultCheckoutStrategy',
      channel: ChannelType.WHATSAPP_HINGLISH,
      buildPayload: () => {
        const plink = this.paymentClient.createPaymentLink(entityId, event.gross_amount_paise, "Recovery", event.customer_phone);
        return {
          delaySeconds: 15 * 60,
          payload: { message: `Recovery notification`, payment_url: plink.short_url },
        };
      },
    }];
  }

  private finishDispatch(
    event: TelemetryEvent,
    state: any,
    classification: FailureClassification,
    candidate: RecoveryCandidate,
    resolved: ResolvedIntervention | null
  ): RecoveryAction | null {
    const entityId = event.entity_id;
    const nowEpoch = Math.floor(Date.now() / 1000);
    const { delaySeconds, payload } = candidate.buildPayload();
    const targetChannel = candidate.channel;

    const actionCostPaise = CHANNEL_COSTS_PAISE[targetChannel] || 60;
    const mdp = MDPYieldCalculator.computeExpectedNetYield(
      event.gross_amount_paise, state.attempt_count + 1, 0.72, actionCostPaise, 0.12
    );

    if (mdp.shouldHalt) {
      state.status = RecoveryState.HALTED_MDP_STOPPING_RULE;
      this.stateStore.set(entityId, state);
      this.ledger.recordEntry(
        entityId, event.gross_amount_paise, 0, RecoveryState.HALTED_MDP_STOPPING_RULE,
        state.attempt_count, state.total_cost_paise, "HALTED_MDP_NEGATIVE_YIELD"
      );
      return null;
    }

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

    const step3 = resolved
      ? `[${resolved.decisionSource}] ${resolved.reasoning}`
      : `Deterministic first-candidate policy selected ${targetChannel}; agent not invoked (mode=${this.mode}).`;

    const trace: AgenticDecisionTrace = {
      agent_id: "agent_sentinel_v2",
      telemetry_audit: `Event ${event.event_id} parsed. Raw code: ${event.raw_error_code || "NONE"}. Gross: ₹${(event.gross_amount_paise/100).toFixed(2)}.`,
      cbs_diagnosis: `Bank: ${event.issuing_bank || "N/A"} -> ${this.classifier.bank_cbs_health[event.issuing_bank || ""]?.status || "HEALTHY"}. Failure: ${classification}.`,
      fatigue_reasoning: `Attempt ${state.attempt_count + 1}/${MAX_RECOVERY_ATTEMPTS}. MDP Expected Net: ₹${(mdp.expectedNetPaise/100).toFixed(2)}. Fatigue Penalty: ₹${(mdp.fatigueCostPaise/100).toFixed(2)}.`,
      recommended_channel: targetChannel,
      confidence_score: resolved ? resolved.confidence : 0.95,
      auto_executed: this.mode === ExecutionMode.AGENTIC_AUTONOMOUS,
      timestamp: new Date().toISOString(),
      decision_source: resolved ? resolved.decisionSource : "DETERMINISTIC_MANUAL_MODE",
      reasoning_chain: {
        step_1_telemetry: `Diagnosed ${event.event_type} with error ${event.raw_error_code || "N/A"}`,
        step_2_cbs_diagnosis: `Classification: ${classification}`,
        step_3_intervention_selection: step3,
        step_4_mdp_yield: `Net expected yield ₹${(mdp.expectedNetPaise/100).toFixed(2)} > 0`,
        step_5_execution_mode: this.mode === ExecutionMode.AGENTIC_AUTONOMOUS ? "Auto-dispatched" : "Queued for operator review",
      }
    };
    this.decisionTraces.push(trace);

    if (this.mode === ExecutionMode.MANUAL_POLICY_GATED) {
      this.pendingOperatorQueue.set(entityId, { action, trace, event });
      state.status = RecoveryState.SCHEDULED;
      this.stateStore.set(entityId, state);
      return action;
    }

    return this.executeAction(action, state, event, actionCostPaise);
  }

  public processEvent(event: TelemetryEvent): RecoveryAction | null {
    const guard = this.evaluateGuards(event);
    if (guard.halted) return guard.action;
    const { state, classification } = guard;

    const candidates = this.buildCandidates(event, classification, state.attempt_count);
    // Deterministic path (used directly by the browser fallback in
    // App.tsx, and whenever no agent resolver is supplied): always the
    // first candidate, exactly reproducing pre-refactor behavior.
    return this.finishDispatch(event, state, classification, candidates[0], null);
  }

  /**
   * Node-only agentic path: identical guards and candidate computation as
   * processEvent(), but lets a caller-supplied resolver (server.ts, using
   * src/engine/agenticAgent.ts) choose among the candidates instead of
   * always taking the first. Kept as a separate method — rather than making
   * processEvent() itself async — so App.tsx's synchronous browser usage is
   * completely unaffected.
   */
  public async processEventWithAgent(
    event: TelemetryEvent,
    resolveIntervention: (candidates: RecoveryCandidate[], classification: FailureClassification, attempt: number) => Promise<ResolvedIntervention | null>
  ): Promise<RecoveryAction | null> {
    const guard = this.evaluateGuards(event);
    if (guard.halted) return guard.action;
    const { state, classification } = guard;

    const candidates = this.buildCandidates(event, classification, state.attempt_count);

    let resolved: ResolvedIntervention | null = null;
    let chosen = candidates[0];
    if (this.mode === ExecutionMode.AGENTIC_AUTONOMOUS) {
      resolved = await resolveIntervention(candidates, classification, state.attempt_count + 1);
      const match = resolved ? candidates.find(c => c.strategyName === resolved!.selectedStrategyName) : undefined;
      chosen = match || candidates[0];
    }

    return this.finishDispatch(event, state, classification, chosen, resolved);
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
