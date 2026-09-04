import { FailureClassification } from './types';

// --- Immutable Domain Invariants & Policies (Code-Bound SSOT) ---
export const LEDGER_GENESIS_HASH = "00000000000000000000000000000000";

export const TRAI_DEFER_SECONDS = 12 * 3600;
export const PTP_GRACE_SECONDS = 86400;
export const MAX_RECOVERY_ATTEMPTS = 3;
export const EVIDENCE_CONFIDENCE_THRESHOLD = 0.85;

export const IST_OFFSET_SECONDS = 19800;
export const SECONDS_PER_DAY = 86400;

export const TERMINAL_CLASSIFICATIONS = new Set<FailureClassification>([
  FailureClassification.TERMINAL_ACCOUNT_CLOSED,
  FailureClassification.TERMINAL_AUTH_REJECTED,
]);

export const CHANNEL_COSTS_PAISE: Record<string, number> = {
  SILENT_API_RETRY: 0,
  WHATSAPP_HINGLISH: 60,
  VOICE_IVR_NUDGE: 150,
  HUMAN_ESCALATION: 500,
};
