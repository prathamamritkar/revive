import React, { useRef } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Server,
  MessageSquare,
  PhoneCall,
  FileCode,
  Sliders,
  Check,
  X,
  UserCheck,
  Coins,
  Bot,
  RefreshCw,
  Repeat,
  FileCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ExecutionMode } from '../engine/types';
import { EngineState } from '../types';
import { formatINR, paiseToInr } from '../engine/utils';

interface TabHomeProps {
  state: EngineState;
  onNavigateTab: (tabIndex: number) => void;
  onToggleMode: (mode: ExecutionMode) => void;
  onToggleTrai?: (enforce: boolean) => void;
  onApproveAction?: (entityId: string) => void;
  onRejectAction?: (entityId: string, reason?: string) => void;
  onUpdateBankStatus?: (bank: string, status: 'HEALTHY' | 'DEGRADED', mins: number) => void;
}

export const TabHome: React.FC<TabHomeProps> = ({
  state,
  onNavigateTab,
  onToggleMode,
  onToggleTrai,
  onApproveAction,
  onRejectAction,
  onUpdateBankStatus,
}) => {
  const { ledger_summary, ledger_chain, pending_queue, bank_cbs_health, dispatch_history, active_p2p, mode, enforce_trai } = state;

  const isAutonomous = mode === ExecutionMode.AGENTIC_AUTONOMOUS;
  const bankList = ['HDFC', 'SBIN', 'ICIC', 'UTIB', 'KKBK'];
  const homeBankScrollRef = useRef<HTMLDivElement>(null);

  const scrollHomeBanks = (direction: 'left' | 'right') => {
    if (homeBankScrollRef.current) {
      homeBankScrollRef.current.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
    }
  };

  // Current IST time check for TRAI window
  const nowEpoch = Math.floor(Date.now() / 1000);
  const istHour = Math.floor(((nowEpoch + 19800) % 86400) / 3600);
  const isWithinTraiHours = istHour >= 8 && istHour < 19;

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Operations Header */}
      <div className="flex items-center justify-between pb-1">
        <h1 className="duo-h1 text-2xl text-[rgb(var(--color-text))]">
          Overview
        </h1>
      </div>

      {/* 2. Core Financial Recovery & Operation Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Monitored Volume */}
        <div className="p-5 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-sky-500/40 border-b-4 border-b-sky-600 shadow-sm">
          <div className="flex items-center justify-between text-[rgb(var(--color-muted))] text-xs font-black uppercase tracking-wider mb-2">
            <span>Capital at Risk</span>
            <Activity className="w-4 h-4 text-sky-400 stroke-[2.5]" />
          </div>
          <div className="duo-metric text-sky-400">
            {formatINR(ledger_summary.total_initial_paise)}
          </div>
          <div className="text-[10px] text-[rgb(var(--color-muted))] font-mono-code mt-1">
            {ledger_summary.total_records} payments monitored
          </div>
        </div>

        {/* Total Recovered */}
        <div className="p-5 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-emerald-500/40 border-b-4 border-b-emerald-600 shadow-sm">
          <div className="flex items-center justify-between text-[rgb(var(--color-muted))] text-xs font-black uppercase tracking-wider mb-2">
            <span>Capital Recovered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
          </div>
          <div className="duo-metric text-emerald-400">
            {formatINR(ledger_summary.total_recovered_paise)}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono-code font-bold mt-1">
            {ledger_summary.recovery_rate_pct.toFixed(1)}% recovery conversion
          </div>
        </div>

        {/* Net Recovered Yield */}
        <div className="p-5 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-emerald-500/40 border-b-4 border-b-emerald-600 shadow-sm">
          <div className="flex items-center justify-between text-[rgb(var(--color-muted))] text-xs font-black uppercase tracking-wider mb-2">
            <span>Net Recovery Yield</span>
            <Coins className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
          </div>
          <div className="duo-metric text-emerald-400">
            {formatINR(ledger_summary.net_recovered_paise)}
          </div>
          <div className="text-[10px] text-[rgb(var(--color-muted))] font-mono-code mt-1">
            Less {formatINR(ledger_summary.total_cost_paise)} dispatch cost
          </div>
        </div>

        {/* Review Queue */}
        <div className="p-5 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-amber-500/40 border-b-4 border-b-amber-600 shadow-sm">
          <div className="flex items-center justify-between text-[rgb(var(--color-muted))] text-xs font-black uppercase tracking-wider mb-2">
            <span>Review Queue</span>
            <UserCheck className="w-4 h-4 text-amber-400 stroke-[2.5]" />
          </div>
          <div className="duo-metric text-amber-400">
            {pending_queue.length}
          </div>
          <div className="text-[10px] text-[rgb(var(--color-muted))] font-mono-code mt-1">
            {pending_queue.length === 0 ? 'Queue cleared' : 'Awaiting signoff'}
          </div>
        </div>

        {/* Active PTP */}
        <div className="p-5 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-violet-500/40 border-b-4 border-b-violet-600 shadow-sm">
          <div className="flex items-center justify-between text-[rgb(var(--color-muted))] text-xs font-black uppercase tracking-wider mb-2">
            <span>Active PTP Freeze</span>
            <Clock className="w-4 h-4 text-violet-400 stroke-[2.5]" />
          </div>
          <div className="duo-metric text-violet-400">
            {active_p2p.length}
          </div>
          <div className="text-[10px] text-violet-400 font-mono-code mt-1">
            Promises in grace period
          </div>
        </div>
      </div>

      {/* 3. Human-in-the-Loop Review Queue */}
      {pending_queue.length > 0 && (
        <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-amber-500/50 border-b-6 border-b-amber-600 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[rgb(var(--color-line))]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="duo-h2 text-base text-amber-400">
                  Review Queue ({pending_queue.length})
                </h2>
              </div>
            </div>
            <span className="text-[10px] font-mono-code font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              ACTION REQUIRED
            </span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {pending_queue.map((item) => (
              <div
                key={item.entity_id}
                className="p-4 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-mono-code font-black text-sm text-[rgb(var(--color-text))] truncate max-w-[150px]" title={item.entity_id}>
                      {item.entity_id}
                    </span>
                    <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                      {item.event?.issuing_bank || 'BANK'} · {item.event?.raw_error_code || 'FAILURE'}
                    </span>
                    <span className="font-mono-code font-bold text-xs text-emerald-400 shrink-0">
                      {item.event?.gross_amount_paise ? formatINR(item.event.gross_amount_paise) : '₹0.00'}
                    </span>
                  </div>
                  <p className="text-xs text-[rgb(var(--color-muted))] truncate">
                    Channel: <strong className="text-[rgb(var(--color-text))]">{item.action?.channel || 'WHATSAPP_HINGLISH'}</strong> | MDP Yield: <span className="text-emerald-400 font-mono-code">E[R<sub className="font-sans text-[8px] font-bold">net</sub>] &gt; 0</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onApproveAction && (
                    <button
                      onClick={() => onApproveAction(item.entity_id)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all border-2 border-emerald-600 border-b-4 active:border-b-2 active:translate-y-[2px] shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Approve & Dispatch</span>
                    </button>
                  )}
                  {onRejectAction && (
                    <button
                      onClick={() => onRejectAction(item.entity_id, 'OPERATOR_REJECTED')}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs uppercase tracking-wider transition-all border border-rose-500/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Reject & Halt</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Bank CBS Gateway Latency & Pacing Matrix - Horizontally Scrollable Carousel */}
      <div className="p-4 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] shadow-sm space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400 stroke-[2.5]" />
            <h2 className="duo-h2 text-sm">Bank Gateways</h2>
            <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
              5 Gateways
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollHomeBanks('left')}
              className="w-7 h-7 rounded-lg bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] flex items-center justify-center border border-[rgb(var(--color-line))] transition-colors cursor-pointer"
              title="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scrollHomeBanks('right')}
              className="w-7 h-7 rounded-lg bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] flex items-center justify-center border border-[rgb(var(--color-line))] transition-colors cursor-pointer"
              title="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={homeBankScrollRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-1 pt-0.5 scroll-smooth no-scrollbar"
        >
          {bankList.map((bank) => {
            const info = bank_cbs_health[bank] || { status: 'HEALTHY', avg_recovery_mins: 0 };
            const isHealthy = info.status === 'HEALTHY';
            return (
              <div
                key={bank}
                className={`min-w-[210px] max-w-[230px] shrink-0 p-3 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                  isHealthy
                    ? 'bg-[rgb(var(--color-surface))] border-emerald-500/40'
                    : 'bg-rose-500/10 border-rose-500/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono-code font-black text-sm text-[rgb(var(--color-text))]">
                      {bank}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isHealthy ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
                      }`}
                    />
                  </div>
                  <div className="text-[11px] font-mono-code font-bold mb-2">
                    {isHealthy ? (
                      <span className="text-emerald-400">HEALTHY (0m)</span>
                    ) : (
                      <span className="text-rose-400">DOWN ({info.avg_recovery_mins || 45}m pace)</span>
                    )}
                  </div>
                </div>

                {onUpdateBankStatus && (
                  <div className="flex gap-1 pt-1.5 border-t border-[rgb(var(--color-line))]">
                    <button
                      onClick={() => onUpdateBankStatus(bank, 'HEALTHY', 0)}
                      className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                        isHealthy
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-[rgb(var(--color-card))] hover:bg-emerald-500/20 text-[rgb(var(--color-muted))]'
                      }`}
                    >
                      Healthy
                    </button>
                    <button
                      onClick={() => onUpdateBankStatus(bank, 'DEGRADED', 45)}
                      className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                        !isHealthy
                          ? 'bg-rose-500 text-white font-black'
                          : 'bg-[rgb(var(--color-card))] hover:bg-rose-500/20 text-[rgb(var(--color-muted))]'
                      }`}
                    >
                      Pacing (45m)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Active Promise-to-Pay (PTP) Registry & Freeze Pipeline */}
      {active_p2p.length > 0 && (
        <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-violet-500/40 border-b-4 border-b-violet-600 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[rgb(var(--color-line))]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400 stroke-[2.5]" />
              <h2 className="duo-h2 text-base text-violet-400">
                Active Promises ({active_p2p.length})
              </h2>
            </div>
          </div>

          <div className="divide-y divide-[rgb(var(--color-line))] max-h-[260px] overflow-y-auto pr-1">
            {active_p2p.map((ptp, i) => {
              const epochDate = ptp.ptp_epoch ? new Date(ptp.ptp_epoch * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Pending';
              return (
                <div key={i} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="overflow-hidden">
                    <span className="font-mono-code font-black text-[rgb(var(--color-text))] truncate max-w-[150px] inline-block align-middle" title={ptp.entity_id}>
                      {ptp.entity_id}
                    </span>
                    <span className="mx-2 text-[rgb(var(--color-line))]">·</span>
                    <span className="text-[rgb(var(--color-muted))] truncate max-w-[240px] inline-block align-middle" title={ptp.ptp_note || 'Customer promise registered'}>
                      Note: "{ptp.ptp_note || 'Customer promise registered'}"
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-code text-[11px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20 whitespace-nowrap">
                      Frozen until: {epochDate} IST
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Live Recovery Dispatch Activity Feed */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgb(var(--color-line))]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400 stroke-[2.5]" />
            <h2 className="duo-h2 text-base">
              Recent Dispatches
            </h2>
          </div>
          <span className="text-[10px] font-mono-code font-black text-[rgb(var(--color-muted))]">
            Showing {Math.min(dispatch_history.length, 10)} of {dispatch_history.length} events
          </span>
        </div>

        {dispatch_history.length === 0 ? (
          <div className="p-8 text-center text-xs text-[rgb(var(--color-muted))] space-y-2">
            <p>No dispatches recorded yet in current session.</p>
            <button
              onClick={() => onNavigateTab(2)}
              className="px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 font-bold transition-all cursor-pointer"
            >
              Run Benchmark
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[360px] rounded-2xl border-2 border-[rgb(var(--color-line))] shadow-inner">
            <table className="w-full text-left text-xs font-mono-code relative">
              <thead className="sticky top-0 bg-[rgb(var(--color-surface))] z-10 shadow-xs">
                <tr className="border-b border-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] text-[10px] uppercase">
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Dispatch ID</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">Channel</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Recipient</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px]">Status</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap min-w-[90px]">Channel Fee</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap min-w-[100px]">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--color-line))] bg-[rgb(var(--color-card))]">
                {dispatch_history.slice(-8).reverse().map((d, idx) => (
                  <tr key={idx} className="hover:bg-[rgb(var(--color-surface))] transition-colors">
                    <td className="py-2.5 px-3 font-black text-[rgb(var(--color-text))] whitespace-nowrap max-w-[140px] truncate" title={d.dispatch_id || `disp_${idx}`}>
                      {d.dispatch_id || `disp_${idx}`}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap max-w-[170px]">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold truncate max-w-[160px] inline-block ${
                        d.channel?.includes('WHATSAPP')
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : d.channel?.includes('VOICE') || d.channel?.includes('IVR')
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          : d.channel?.includes('VIRTUAL')
                          ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`} title={d.channel || 'SILENT_API_RETRY'}>
                        {d.channel || 'SILENT_API_RETRY'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[rgb(var(--color-muted))] font-mono-code whitespace-nowrap max-w-[140px] truncate" title={d.to || 'API Gateway'}>
                      {d.to || 'API Gateway'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-emerald-400 font-bold">
                        {d.status || 'DISPATCHED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[rgb(var(--color-muted))] whitespace-nowrap">
                      {d.channel?.includes('VOICE') ? '₹1.20' : d.channel?.includes('API') ? '₹0.00' : '₹0.60'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[rgb(var(--color-muted))] text-[10px] whitespace-nowrap">
                      {d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : 'Just now'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
