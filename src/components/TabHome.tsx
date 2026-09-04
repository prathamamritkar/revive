import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  Landmark,
  Sliders,
  Repeat,
  ShoppingCart,
  Building,
  Coins,
} from 'lucide-react';
import { ExecutionMode } from '../engine/types';
import { EngineState } from '../types';
import { formatINR, paiseToInr } from '../engine/utils';

interface TabHomeProps {
  state: EngineState;
  onNavigateTab: (tabIndex: number) => void;
  onToggleMode: (mode: ExecutionMode) => void;
}

export const TabHome: React.FC<TabHomeProps> = ({
  state,
  onNavigateTab,
}) => {
  const { ledger_summary } = state;

  return (
    <div className="space-y-8 pb-6">
      {/* Hero Section */}
      <div className="p-8 sm:p-10 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-sky-500/40 border-b-6 border-b-sky-600 shadow-lg relative overflow-hidden">
        <div className="max-w-3xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 text-sky-400 border-2 border-sky-500/40 text-xs font-black font-mono-code uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            Enterprise Payment Recovery Engine
          </div>

          <h1 className="duo-h1 text-3xl sm:text-4xl text-[rgb(var(--color-text))]">
            Recover Failed Payments with Mathematical Precision
          </h1>

          <p className="duo-body text-base sm:text-lg max-w-2xl text-[rgb(var(--color-muted))] leading-relaxed">
            Revive replaces brute-force payment retries with an intelligent, TRAI-compliant recovery platform. We combine real-time bank CBS health monitoring, finite-horizon Markov Decision Processes, and localized conversational outreach to maximize recovery yield while protecting customer goodwill.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => onNavigateTab(1)}
              className="px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all border-2 border-sky-700 border-b-4 active:border-b-2 active:translate-y-[2px] shadow-md cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>Launch Agent Console</span>
            </button>

            <button
              onClick={() => onNavigateTab(2)}
              className="px-6 py-3.5 rounded-2xl bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-text))] font-black text-xs uppercase tracking-wider transition-all border-2 border-[rgb(var(--color-line))] border-b-4 active:border-b-2 active:translate-y-[2px] cursor-pointer flex items-center gap-2"
            >
              <Coins className="w-4 h-4 stroke-[2.5] text-sky-400" />
              <span>50-Batch Benchmark</span>
            </button>
          </div>
        </div>

        {/* Live Snapshot Badge in Hero */}
        <div className="mt-8 pt-6 border-t-2 border-[rgb(var(--color-line))] grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="duo-label block text-[10px]">RECOVERY RATE</span>
            <span className="duo-metric text-emerald-400 text-xl sm:text-2xl">
              {ledger_summary.recovery_rate_pct.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="duo-label block text-[10px]">TOTAL RECOVERED</span>
            <span className="duo-metric text-[rgb(var(--color-text))] text-xl sm:text-2xl">
              {formatINR(ledger_summary.total_recovered_paise)}
            </span>
          </div>
          <div>
            <span className="duo-label block text-[10px]">OPERATIONAL MODE</span>
            <span className="text-xs font-mono-code font-black text-sky-400 block mt-1">
              {state.mode === ExecutionMode.AGENTIC_AUTONOMOUS ? 'AUTONOMOUS' : 'MANUAL REVIEW'}
            </span>
          </div>
          <div>
            <span className="duo-label block text-[10px]">LEDGER CHAIN</span>
            <span className="text-xs font-mono-code font-black text-violet-400 block mt-1">
              {state.ledger_chain.length} AUDITED BLOCKS
            </span>
          </div>
        </div>
      </div>

      {/* 3 Core Architectural Pillars */}
      <div className="space-y-4">
        <div>
          <h2 className="duo-h2">
            CORE ARCHITECTURAL PILLARS
          </h2>
          <p className="duo-body">
            Deterministic safety boundaries and mathematical stopping invariants.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pillar 1 */}
          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-sky-500/40 border-b-4 border-b-sky-600 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-400 border-2 border-sky-500/40 flex items-center justify-center font-bold mb-4">
                <Landmark className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="duo-h3 text-base">
                  TRAI Chrono-Gate
                </h3>
                <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  08:00–19:00 IST
                </span>
              </div>
              <p className="duo-body leading-relaxed">
                Zero spam outside regulatory calling hours. Customer outreach scheduled during off-hours is automatically deferred by +12h without dropping context, while machine-to-machine API retries remain active.
              </p>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-emerald-500/40 border-b-4 border-b-emerald-600 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center font-bold mb-4">
                <Sliders className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="duo-h3 text-base">
                  MDP Net Yield Optimizer
                </h3>
                <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  E[R_net] &gt; 0
                </span>
              </div>
              <p className="duo-body leading-relaxed">
                Mathematical stopping rule based on a finite-horizon Markov Decision Process. Dynamically terminates retries at step $k^*$ when expected recovery yield drops below channel communication and fatigue costs.
              </p>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-violet-500/40 border-b-4 border-b-violet-600 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-violet-500/15 text-violet-400 border-2 border-violet-500/40 flex items-center justify-center font-bold mb-4">
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="duo-h3 text-base">
                  SHA-256 Audit Ledger
                </h3>
                <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  MERKLE PROOFS
                </span>
              </div>
              <p className="duo-body leading-relaxed">
                Every recovery action, bank error classification, operator approval, and settled rupee is permanently recorded in an append-only SHA-256 hash chain with paisa-level financial integrity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Core Recovery Channels */}
      <div className="space-y-4">
        <div>
          <h2 className="duo-h2">
            THREE SPECIALIZED RECOVERY CHANNELS
          </h2>
          <p className="duo-body">
            Tailored recovery workflows addressing the distinct dynamics of subscriptions, checkouts, and invoices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold border border-sky-500/30">
                    <Repeat className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="duo-h3">Recurring Subscriptions</h3>
                </div>
                <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  STREAM 1
                </span>
              </div>
              <p className="duo-body leading-relaxed mb-4">
                Handles recurring e-mandate and debit failures. Monitors bank gateway latency for cool-down pacing and sends localized WhatsApp nudges when customer account balances are low around salary cycles.
              </p>
            </div>
            <div className="pt-3 border-t-2 border-[rgb(var(--color-line))] flex items-center justify-between text-xs font-mono-code">
              <span className="text-[rgb(var(--color-muted))] font-bold">Benchmark Rate</span>
              <span className="text-emerald-400 font-black">~78% Recovery</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold border border-amber-500/30">
                    <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="duo-h3">Abandoned Checkouts</h3>
                </div>
                <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  STREAM 2
                </span>
              </div>
              <p className="duo-body leading-relaxed mb-4">
                Instantly captures dropped e-commerce cart sessions. Delivers pre-signed 1-click UPI payment links directly over WhatsApp within the high-intent 15-minute conversion window.
              </p>
            </div>
            <div className="pt-3 border-t-2 border-[rgb(var(--color-line))] flex items-center justify-between text-xs font-mono-code">
              <span className="text-[rgb(var(--color-muted))] font-bold">Benchmark Rate</span>
              <span className="text-emerald-400 font-black">~82% Recovery</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center font-bold border border-violet-500/30">
                    <Building className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="duo-h3">B2B Invoices</h3>
                </div>
                <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  STREAM 3
                </span>
              </div>
              <p className="duo-body leading-relaxed mb-4">
                Provisions dedicated, auto-reconciling virtual bank accounts (NEFT / RTGS / IMPS / UPI) with real-time webhook listeners to settle high-value commercial accounts receivables instantly.
              </p>
            </div>
            <div className="pt-3 border-t-2 border-[rgb(var(--color-line))] flex items-center justify-between text-xs font-mono-code">
              <span className="text-[rgb(var(--color-muted))] font-bold">Benchmark Rate</span>
              <span className="text-emerald-400 font-black">~88% Recovery</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works: 4-Stage Lifecycle */}
      <div className="p-8 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-6">
        <div>
          <h2 className="duo-h2">
            THE 4-STAGE RECOVERY LIFECYCLE
          </h2>
          <p className="duo-body">
            From initial gateway webhook failure to final cryptographic ledger settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigateTab(3)}
            className="p-5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-sky-500/40 border-b-4 border-b-sky-600 hover:border-sky-400 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-400 border-2 border-sky-500/40">
                STAGE 01
              </span>
              <h3 className="duo-h3">Ingest & Diagnose</h3>
            </div>
            <p className="duo-body">
              Captures raw payment webhooks, matches error codes against live bank CBS health, and infers customer intent via Gemini AI.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab(3)}
            className="p-5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-amber-500/40 border-b-4 border-b-amber-600 hover:border-amber-400 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border-2 border-amber-500/40">
                STAGE 02
              </span>
              <h3 className="duo-h3">Policy Gate</h3>
            </div>
            <p className="duo-body">
              Evaluates TRAI hours, PTP freeze states, terminal halt conditions, and solves the MDP net yield equation (E[R_net] &gt; 0).
            </p>
          </div>

          <div
            onClick={() => onNavigateTab(1)}
            className="p-5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-emerald-500/40 border-b-4 border-b-emerald-600 hover:border-emerald-400 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border-2 border-emerald-500/40">
                STAGE 03
              </span>
              <h3 className="duo-h3">Targeted Outreach</h3>
            </div>
            <p className="duo-body">
              Dispatches localized Hinglish WhatsApp messages with pre-signed 1-click links, automated IVR calls, or silent API retries.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab(4)}
            className="p-5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-violet-500/40 border-b-4 border-b-violet-600 hover:border-violet-400 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-500/15 text-violet-400 border-2 border-violet-500/40">
                STAGE 04
              </span>
              <h3 className="duo-h3">Cryptographic Proof</h3>
            </div>
            <p className="duo-body">
              Appends a SHA-256 block hash for every transition, tracks recovered rupee balances, and maintains a tamper-proof audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
