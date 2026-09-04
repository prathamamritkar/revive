export enum FailureClassification {
  TRANSIENT_NETWORK_DOWN = "TRANSIENT_NETWORK_DOWN",
  TRANSIENT_BALANCE_LOW = "TRANSIENT_BALANCE_LOW",
  TERMINAL_ACCOUNT_CLOSED = "TERMINAL_ACCOUNT_CLOSED",
  TERMINAL_AUTH_REJECTED = "TERMINAL_AUTH_REJECTED",
  ABANDONED_CHECKOUT = "ABANDONED_CHECKOUT",
  B2B_OVERDUE_INVOICE = "B2B_OVERDUE_INVOICE",
}

export enum ChannelType {
  SILENT_API_RETRY = "SILENT_API_RETRY",
  WHATSAPP_HINGLISH = "WHATSAPP_HINGLISH",
  VOICE_IVR_NUDGE = "VOICE_IVR_NUDGE",
  HUMAN_ESCALATION = "HUMAN_ESCALATION",
}

export enum ExecutionMode {
  MANUAL_POLICY_GATED = "MANUAL_POLICY_GATED",
  AGENTIC_AUTONOMOUS = "AGENTIC_AUTONOMOUS",
}

export enum RecoveryState {
  DETECTED = "DETECTED",
  SCHEDULED = "SCHEDULED",
  DISPATCHED = "DISPATCHED",
  PROMISE_TO_PAY_PENDING = "PROMISE_TO_PAY_PENDING",
  RECOVERED = "RECOVERED",
  HALTED_TERMINAL = "HALTED_TERMINAL",
  HALTED_MAX_ATTEMPTS = "HALTED_MAX_ATTEMPTS",
  HALTED_MDP_STOPPING_RULE = "HALTED_MDP_STOPPING_RULE",
}

export enum P2PStatus {
  ACTIVE_PROMISE = "ACTIVE_PROMISE",
  PROMISE_HONORED = "PROMISE_HONORED",
  PROMISE_BROKEN = "PROMISE_BROKEN",
}

export interface AgenticDecisionTrace {
  agent_id: string;
  telemetry_audit: string;
  cbs_diagnosis: string;
  fatigue_reasoning: string;
  recommended_channel: ChannelType;
  confidence_score: number;
  auto_executed: boolean;
  timestamp: string;
  reasoning_chain: {
    step_1_telemetry?: string;
    step_2_cbs_diagnosis?: string;
    step_3_mdp_yield?: string;
    step_4_execution_mode?: string;
    [key: string]: any;
  };
}

export interface TelemetryEvent {
  event_id: string;
  event_type: string;
  entity_id: string;
  gross_amount_paise: number;
  customer_contact_hash: string;
  customer_phone?: string;
  issuing_bank?: string;
  raw_error_code?: string;
  invoice_age_days?: number;
  timestamp_utc: string;
}

export interface RecoveryAction {
  action_id: string;
  entity_id: string;
  target_channel: ChannelType;
  scheduled_timestamp_epoch: number;
  payload: Record<string, any>;
  attempt_index: number;
  reason_code: string;
  policy_approved: boolean;
}

export interface AuditLedgerEntry {
  log_id: string;
  timestamp: string;
  entity_id: string;
  initial_amount_paise: number;
  recovered_amount_paise: number;
  status: RecoveryState;
  attempt_count: number;
  total_cost_incurred_paise: number;
  audit_hash: string;
  reason_code: string;
}

export interface DispatchRequest {
  phone_number: string;
  message: string;
  payment_url?: string;
  channel?: ChannelType;
}

export interface PTPCommitRequest {
  entity_id: string;
  promised_timestamp_epoch: number;
  promised_amount_paise?: number;
  note?: string;
}

export interface AIIntentResponse {
  classification: FailureClassification;
  confidence: number;
  detected_intent: string;
  urgency_level: string;
  suggested_tone: string;
  evidence_source?: string;
  evidence_payload?: string;
}

export interface BankCBSHealth {
  status: "HEALTHY" | "DEGRADED";
  avg_recovery_mins: number;
}
