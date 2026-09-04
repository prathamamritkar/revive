import {
  ExecutionMode,
  FailureClassification,
  ChannelType,
  RecoveryState,
  P2PStatus,
  AuditLedgerEntry,
  AgenticDecisionTrace,
  BankCBSHealth,
} from './engine/types';
import { DispatchEntry } from './engine/dispatcher';

export type DashboardTheme = 'Dark' | 'Light' | 'High-Contrast';

export interface EngineState {
  mode: ExecutionMode;
  enforce_trai: boolean;
  ledger_summary: {
    total_records: number;
    total_initial_paise: number;
    total_recovered_paise: number;
    total_cost_paise: number;
    net_recovered_paise: number;
    recovery_rate_pct: number;
    integrity_valid: boolean;
  };
  ledger_chain: AuditLedgerEntry[];
  dispatch_history: DispatchEntry[];
  pending_queue: Array<{
    entity_id: string;
    action: any;
    trace: AgenticDecisionTrace;
    event: any;
  }>;
  decision_traces: AgenticDecisionTrace[];
  bank_cbs_health: Record<string, BankCBSHealth>;
  active_p2p: Array<{
    entity_id: string;
    ptp_epoch: number;
    ptp_note?: string;
    p2p_status?: P2PStatus;
    [key: string]: any;
  }>;
  backend_connected?: boolean;
  fastapi_url?: string;
}
