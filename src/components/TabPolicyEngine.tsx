import React, { useState, useRef } from 'react';
import {
  Activity,
  Server,
  Calculator,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Shield,
  Clock,
  Zap,
  GitBranch,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
  PhoneCall,
  MessageSquare,
  Building2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { EngineState } from '../types';
import { TelemetryEvent, AIIntentResponse } from '../engine/types';
import { PolicyDecisionTree, TreeNodeId } from './PolicyDecisionTree';

interface TabPolicyEngineProps {
  state: EngineState;
  onUpdateBankStatus: (bank: string, status: 'HEALTHY' | 'DEGRADED', mins: number) => void;
  onAiDiagnose: (event: TelemetryEvent, note?: string) => Promise<AIIntentResponse>;
}

const AI_SAMPLE_SCENARIOS = [
  {
    label: 'Salary Delay PTP',
    bank: 'HDFC',
    errorCode: 'INSUFFICIENT_FUNDS',
    note: 'Salary will be credited on 5th morning, please schedule debit reminder then.',
  },
  {
    label: 'Checkout Drop Link',
    bank: 'ICIC',
    errorCode: 'USER_ABANDONED',
    note: 'Payment failed at UPI screen. Please send direct payment link to complete order.',
  },
  {
    label: 'B2B RTGS Invoice',
    bank: 'SBIN',
    errorCode: 'PAYMENT_OVERDUE',
    note: 'Finance needs virtual bank account IFSC & account number for NEFT/RTGS settlement.',
  },
  {
    label: 'Expired Card Update',
    bank: 'UTIB',
    errorCode: 'CARD_EXPIRED',
    note: 'My debit card reached expiry date. How do I update card details for auto-debit?',
  },
  {
    label: 'Terminal Revocation',
    bank: 'HDFC',
    errorCode: 'MANDATE_REVOKED',
    note: 'I want to cancel this recurring subscription immediately. Do not charge again.',
  },
];

export const TabPolicyEngine: React.FC<TabPolicyEngineProps> = ({
  state,
  onUpdateBankStatus,
  onAiDiagnose,
}) => {
  // Bank CBS states
  const bankList = ['HDFC', 'SBIN', 'ICIC', 'UTIB', 'KKBK'];
  const bankScrollRef = useRef<HTMLDivElement>(null);
  const sampleScrollRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right', amount = 240) => {
    if (ref.current) {
      ref.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  // AI Diagnostic State
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [selectedErrorCode, setSelectedErrorCode] = useState('GATEWAY_TIMEOUT');
  const [customerNote, setCustomerNote] = useState('Will pay next week when salary hits my bank account');
  const [aiResult, setAiResult] = useState<AIIntentResponse | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Routing Rules View State: Graphical Decision Tree vs Master Table
  const [routingView, setRoutingView] = useState<'tree' | 'table'>('tree');
  const [selectedTreeNode, setSelectedTreeNode] = useState<string>('gate_terminal');

  // MDP Simulator State
  const [grossAmount, setGrossAmount] = useState<number>(3500);
  const [pSuccessBase, setPSuccessBase] = useState<number>(0.72);
  const [kAttempts, setKAttempts] = useState<number>(1);
  const [actionCost, setActionCost] = useState<number>(0.6);
  const [lambdaFatigue, setLambdaFatigue] = useState<number>(0.12);
  const [istHour, setIstHour] = useState<number>(10);

  // Calculations for MDP Yield
  const lFatigue = lambdaFatigue * (kAttempts - 1);
  const pAdj = Math.max(0.0, pSuccessBase * Math.pow(0.9, kAttempts - 1));
  const eGross = pAdj * grossAmount;
  const fatigueCost = lFatigue * grossAmount;
  const eNet = eGross - actionCost - fatigueCost;
  const shouldHalt = eNet <= actionCost || eNet <= 0;
  const isTraiOk = istHour >= 8 && istHour < 19;

  // Marginal yield curve data (Steps 1, 2, 3)
  const curveData = [1, 2, 3].map((step) => {
    const lf = lambdaFatigue * (step - 1);
    const pk = Math.max(0.0, pSuccessBase * Math.pow(0.9, step - 1));
    const eg = pk * grossAmount;
    const en = eg - actionCost - lf * grossAmount;
    return {
      step: `Step k=${step}`,
      grossRecovery: Math.round(eg),
      netYield: Math.round(en),
      costThreshold: Math.round(actionCost),
    };
  });

  // Master Error Routing Rules
  const routingRules = [
    {
      code: 'GATEWAY_TIMEOUT',
      category: 'TRANSIENT_NETWORK_DOWN',
      channel: 'SILENT_API_RETRY',
      pacing: '+45m Cooldown',
      trai: 'Exempt (Machine-to-Machine)',
      invariant: 'Paced Retry (Max 3)',
      badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
    },
    {
      code: 'INSUFFICIENT_FUNDS',
      category: 'TRANSIENT_BALANCE_LOW',
      channel: 'WHATSAPP_HINGLISH',
      pacing: '+24h Pay-Cycle Deferral',
      trai: 'Strict (08:00–19:00 IST)',
      invariant: 'PTP Freeze if promised',
      badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
    },
    {
      code: 'CARD_EXPIRED',
      category: 'TERMINAL_ACCOUNT_CLOSED',
      channel: 'NONE (0-TOUCH)',
      pacing: 'Immediate Halt',
      trai: 'No outreach allowed',
      invariant: 'Terminal Halt (0 Touches)',
      badgeColor: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
    },
    {
      code: 'USER_ABANDONED',
      category: 'ABANDONED_CHECKOUT',
      channel: 'WHATSAPP_1CLICK_LINK',
      pacing: '+15m High-Intent Nudge',
      trai: 'Strict (08:00–19:00 IST)',
      invariant: '1-Click Pre-Signed URL',
      badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
    },
    {
      code: 'PAYMENT_OVERDUE',
      category: 'B2B_OVERDUE_INVOICE',
      channel: 'VIRTUAL_ACCOUNT_PROVISION',
      pacing: '+1h Business Hours',
      trai: 'Strict (08:00–19:00 IST)',
      invariant: 'Auto-reconciling NEFT/RTGS/UPI',
      badgeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/40',
    },
    {
      code: 'MANDATE_REVOKED',
      category: 'TERMINAL_AUTH_REJECTED',
      channel: 'NONE (0-TOUCH)',
      pacing: 'Immediate Halt',
      trai: 'No outreach allowed',
      invariant: 'Terminal Halt (0 Touches)',
      badgeColor: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
    },
  ];

  const handleTestAiDiagnose = async () => {
    setIsDiagnosing(true);
    const mockEvt: TelemetryEvent = {
      event_id: `diag_${Date.now()}`,
      event_type: 'subscription.charged_failed',
      entity_id: 'sub_eval_999',
      gross_amount_paise: 299900,
      customer_contact_hash: 'hash_test',
      customer_phone: '+919876543210',
      issuing_bank: selectedBank,
      raw_error_code: selectedErrorCode,
      timestamp_utc: new Date().toISOString(),
    };

    const res = await onAiDiagnose(mockEvt, customerNote);
    setAiResult(res);
    setIsDiagnosing(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Section: Bank CBS Registry - Horizontally Scrollable Carousel */}
      <div className="p-4 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] shadow-sm space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400 stroke-[2.5]" />
            <h2 className="duo-h2 text-sm">Bank CBS Gateways</h2>
            <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
              5 Gateways
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollContainer(bankScrollRef, 'left', 220)}
              className="w-7 h-7 rounded-lg bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] flex items-center justify-center border border-[rgb(var(--color-line))] transition-colors cursor-pointer"
              title="Scroll left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scrollContainer(bankScrollRef, 'right', 220)}
              className="w-7 h-7 rounded-lg bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] flex items-center justify-center border border-[rgb(var(--color-line))] transition-colors cursor-pointer"
              title="Scroll right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={bankScrollRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-1 pt-0.5 scroll-smooth no-scrollbar"
        >
          {bankList.map((bank) => {
            const info = state.bank_cbs_health[bank] || { status: 'HEALTHY', avg_recovery_mins: 0 };
            const isHealthy = info.status === 'HEALTHY';
            return (
              <div
                key={bank}
                className={`min-w-[210px] max-w-[230px] shrink-0 p-3 rounded-2xl border-2 transition-all shadow-xs flex flex-col justify-between ${
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
                        isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
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

                <div className="flex gap-1 pt-1.5 border-t border-[rgb(var(--color-line))]">
                  <button
                    onClick={() => onUpdateBankStatus(bank, 'HEALTHY', 0)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      isHealthy
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'bg-[rgb(var(--color-card))] hover:bg-emerald-500/20 text-[rgb(var(--color-muted))]'
                    }`}
                  >
                    Healthy
                  </button>
                  <button
                    onClick={() => onUpdateBankStatus(bank, 'DEGRADED', 45)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      !isHealthy
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-[rgb(var(--color-card))] hover:bg-rose-500/20 text-[rgb(var(--color-muted))]'
                    }`}
                  >
                    Down
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Middle Section: MDP Mathematical Yield Optimizer & Salary Cycle Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Parameter Controls (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[rgb(var(--color-line))]">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
              <h3 className="duo-h3 text-sm">MDP Yield Optimizer</h3>
            </div>
            <span className="text-[10px] font-mono-code font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              E[R<sub className="text-[8px] font-sans font-bold">net</sub>] &gt; 0
            </span>
          </div>

          <div className="space-y-3 font-mono-code text-xs">
            <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))]">
              <div className="flex justify-between duo-label mb-1">
                <span>Gross Value (V)</span>
                <span className="text-sky-400 font-bold">₹{grossAmount.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min="500"
                max="25000"
                step="500"
                value={grossAmount}
                onChange={(e) => setGrossAmount(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer h-1.5"
              />
            </div>

            <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))]">
              <div className="flex justify-between duo-label mb-1">
                <span>Base Recovery Prob (P<sub className="text-[8px] font-sans font-bold">base</sub>)</span>
                <span className="text-emerald-400 font-bold">{(pSuccessBase * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.95"
                step="0.05"
                value={pSuccessBase}
                onChange={(e) => setPSuccessBase(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5"
              />
            </div>

            <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))]">
              <div className="flex justify-between duo-label mb-1">
                <span>Current Attempt Index (k)</span>
                <span className="text-violet-400 font-bold">Attempt {kAttempts} / 3</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="1"
                value={kAttempts}
                onChange={(e) => setKAttempts(Number(e.target.value))}
                className="w-full accent-violet-400 cursor-pointer h-1.5"
              />
            </div>

            <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))]">
              <div className="flex justify-between duo-label mb-1">
                <span>Fatigue Decay Penalty (λ)</span>
                <span className="text-rose-400 font-bold">{(lambdaFatigue * 100).toFixed(0)}% / step</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.30"
                step="0.01"
                value={lambdaFatigue}
                onChange={(e) => setLambdaFatigue(Number(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer h-1.5"
              />
            </div>
          </div>

          {/* Mathematical Evaluation Box */}
          <div
            className={`p-4 rounded-2xl border-2 border-b-4 ${
              shouldHalt
                ? 'bg-rose-500/15 border-rose-500/40 border-b-rose-600 text-rose-300'
                : 'bg-emerald-500/15 border-emerald-500/40 border-b-emerald-600 text-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono-code font-bold mb-1">
              <span>Expected Net Yield E[R<sub className="text-[8px] font-sans font-bold">net</sub>]:</span>
              <span className="text-sm font-black">
                ₹{Math.max(0, eNet).toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] font-mono-code">
              {shouldHalt ? (
                <span className="font-bold text-rose-400">
                  Stopping condition met (E[R<sub className="text-[8px] font-sans font-bold">net</sub>] ≤ 0). Sequence halts.
                </span>
              ) : (
                <span className="font-bold text-emerald-400">
                  Positive recovery yield (E[R<sub className="text-[8px] font-sans font-bold">net</sub>] &gt; 0). Proceed with dispatch.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Curves (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[rgb(var(--color-line))]">
            <h3 className="duo-h3 text-sm">Marginal Recovery Yield & Cost Decay Curve</h3>
            <span className="text-[10px] font-mono-code text-[rgb(var(--color-muted))]">
              Finite-Horizon MDP
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="step" stroke="rgb(var(--color-muted))" fontSize={11} tickLine={false} />
                <YAxis stroke="rgb(var(--color-muted))" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(var(--color-card))',
                    borderColor: 'rgb(var(--color-line))',
                    borderRadius: '16px',
                    color: 'rgb(var(--color-text))',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="grossRecovery"
                  name="Gross Recovery E[R] (Gross)"
                  stroke="#38BDF8"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="netYield"
                  name="Net Yield E[R] (Net)"
                  stroke="#34D399"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Deterministic Master Error Routing & Decision Tree */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="duo-h2 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-sky-400 stroke-[2.5]" />
              <span>Routing Rules & Decision Tree</span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))]">
            <button
              onClick={() => setRoutingView('tree')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                routingView === 'tree'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Decision Tree</span>
            </button>
            <button
              onClick={() => setRoutingView('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                routingView === 'table'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Matrix Table</span>
            </button>
          </div>
        </div>

        {routingView === 'tree' ? (
          <div className="space-y-6">
            {/* Interactive Decision Tree Diagram */}
            <PolicyDecisionTree
              selectedNode={selectedTreeNode as TreeNodeId}
              onSelectNode={(node) => setSelectedTreeNode(node)}
            />

            {/* Interactive Node Inspector Card */}
            <div className="p-4 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] space-y-2 text-xs font-mono-code">
              <div className="flex items-center justify-between pb-2 border-b border-[rgb(var(--color-line))]">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-[rgb(var(--color-text))] text-sm">
                    {selectedTreeNode === 'root' && 'Stage 0: Webhook Telemetry Ingestion'}
                    {selectedTreeNode === 'gate_terminal' && 'Gate 1: Terminal Invariant Check'}
                    {selectedTreeNode === 'leaf_terminal_halt' && 'Leaf: Zero-Touch Terminal Halt'}
                    {selectedTreeNode === 'gate_cbs' && 'Gate 2: Bank CBS Health Gateway'}
                    {selectedTreeNode === 'leaf_cbs_pacing' && 'Leaf: CBS Pacing Deferral (+45m)'}
                    {selectedTreeNode === 'gate_trai' && 'Gate 3: Channel Nature & TRAI Chrono-Gate'}
                    {selectedTreeNode === 'leaf_silent_retry' && 'Leaf: Silent API Retry (TRAI-Exempt)'}
                    {selectedTreeNode === 'leaf_trai_defer' && 'Leaf: TRAI Chrono-Deferral (+12h)'}
                    {selectedTreeNode === 'gate_ptp_mandate' && 'Gate 4: Promise-to-Pay & Mandate Cap Ceiling'}
                    {selectedTreeNode === 'leaf_ptp_freeze' && 'Leaf: Promise-to-Pay Grace Freeze'}
                    {selectedTreeNode === 'leaf_mandate_ceiling' && 'Leaf: NPCI Mandate Execution Cap'}
                    {selectedTreeNode === 'gate_mdp' && 'Gate 5: Mathematical MDP Net Yield Invariant'}
                    {selectedTreeNode === 'leaf_mdp_halt' && 'Leaf: HALTED_MDP_STOPPING_RULE'}
                    {selectedTreeNode === 'leaf_dispatch_menu' && 'Leaf: Bounded Intervention Dispatch'}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-black bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  INSPECTOR
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
                <div>
                  <span className="text-[rgb(var(--color-muted))] block font-bold">Policy Invariant Enforced:</span>
                  <span className="text-[rgb(var(--color-text))]">
                    {selectedTreeNode === 'root' && 'Subunit Integer Paise (0 floating-point rounding drift across financial ledger)'}
                    {selectedTreeNode === 'gate_terminal' && 'Zero-touch on terminal failures (Confidence ≥ 0.85 immediately halts outreach)'}
                    {selectedTreeNode === 'leaf_terminal_halt' && 'Terminal failure → 0 touches. Immediate halt. No WhatsApp, no Voice, no retry.'}
                    {selectedTreeNode === 'gate_cbs' && 'Issuing bank CBS degradation requires pacing to prevent burning attempt quotas'}
                    {selectedTreeNode === 'leaf_cbs_pacing' && 'Paced delay (+45m default) applied until bank gateway health restores to HEALTHY'}
                    {selectedTreeNode === 'gate_trai' && 'TRAI TCCCPR Regulations: Customer communication bounded to 08:00–19:00 IST'}
                    {selectedTreeNode === 'leaf_silent_retry' && 'M2M Silent Retries are exempt from TRAI chrono-gates; execute without customer ping'}
                    {selectedTreeNode === 'leaf_trai_defer' && 'Non-compliant dispatches are deferred by +12 hours to next 08:00 IST window, never dropped'}
                    {selectedTreeNode === 'gate_ptp_mandate' && 'Active customer promise freezes recovery; NPCI bounds mandate debits to 4 total attempts'}
                    {selectedTreeNode === 'leaf_ptp_freeze' && 'All communication retries frozen until promised timestamp epoch; protects customer NPS'}
                    {selectedTreeNode === 'leaf_mandate_ceiling' && 'Hard stop on auto-debit representment at 4 attempts per NPCI rules; fail over to manual link'}
                    {selectedTreeNode === 'gate_mdp' && (
                      <span>
                        Finite-horizon MDP stopping condition: Sequence halts at step k<sup>*</sup> when E[R<sub>net</sub>](k<sup>*</sup>) ≤ 0
                      </span>
                    )}
                    {selectedTreeNode === 'leaf_mdp_halt' && 'HALTED_MDP_STOPPING_RULE: Net economic value is negative; sequence aborts with ledger proof'}
                    {selectedTreeNode === 'leaf_dispatch_menu' && 'Bounded Autonomy: Agent or manual gate selects strictly among pre-computed legal candidates'}
                  </span>
                </div>

                <div>
                  <span className="text-[rgb(var(--color-muted))] block font-bold">Mathematical / Regulatory Rule:</span>
                  <span className="text-emerald-400 font-mono-code">
                    {selectedTreeNode === 'root' && 'gross_amount_paise = int(round(amount_inr * 100))'}
                    {selectedTreeNode === 'gate_terminal' && 'classification ∈ {TERMINAL_AUTH_REJECTED, TERMINAL_ACCOUNT_CLOSED}'}
                    {selectedTreeNode === 'leaf_terminal_halt' && 'status = TERMINAL_AUTH_REJECTED; attempts = 0; scheduled = None'}
                    {selectedTreeNode === 'gate_cbs' && 'bank_cbs_health[bank].status == DEGRADED'}
                    {selectedTreeNode === 'leaf_cbs_pacing' && 'next_retry_epoch = current_epoch + (avg_recovery_mins * 60)'}
                    {selectedTreeNode === 'gate_trai' && '08 <= (current_epoch + 19800) % 86400 // 3600 < 19'}
                    {selectedTreeNode === 'leaf_silent_retry' && 'channel == ChannelType.SILENT_API_RETRY'}
                    {selectedTreeNode === 'leaf_trai_defer' && 'scheduled_epoch = current_epoch + 43200 (+12h deferral)'}
                    {selectedTreeNode === 'gate_ptp_mandate' && 'status == PROMISE_TO_PAY_PENDING || mandate_execution_count >= 4'}
                    {selectedTreeNode === 'leaf_ptp_freeze' && 'current_epoch < promised_timestamp_epoch'}
                    {selectedTreeNode === 'leaf_mandate_ceiling' && 'attempt_count >= 4 (1 original + 3 retries max)'}
                    {selectedTreeNode === 'gate_mdp' && (
                      <span>
                        E[R<sub>net</sub>] = P<sub>adj</sub> · V - C<sub>action</sub> - L<sub>fatigue</sub> · V &gt; 0
                      </span>
                    )}
                    {selectedTreeNode === 'leaf_mdp_halt' && (
                      <span>
                        E[R<sub>net</sub>] ≤ 0 → abort with HALTED_MDP_STOPPING_RULE
                      </span>
                    )}
                    {selectedTreeNode === 'leaf_dispatch_menu' && (
                      <span>
                        arg_max(a ∈ A<sub>legal</sub>) &#123; E[R<sub>net</sub>](a) &#125;; policy_approved = True
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Master Matrix Table */
          <div className="overflow-x-auto overflow-y-auto max-h-[460px] rounded-2xl border-2 border-[rgb(var(--color-line))] shadow-inner">
            <table className="w-full text-left text-xs font-mono-code relative">
              <thead className="sticky top-0 bg-[rgb(var(--color-surface))] z-10 shadow-xs">
                <tr className="border-b-2 border-[rgb(var(--color-line))] text-[rgb(var(--color-muted))]">
                  <th className="py-3 px-3 whitespace-nowrap min-w-[190px]">Raw Error Code</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[160px]">Classification</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[160px]">Assigned Channel</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[130px]">Pacing Delay</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[150px]">TRAI Gate Policy</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap min-w-[130px]">Invariant Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[rgb(var(--color-line))] bg-[rgb(var(--color-card))]">
                {routingRules.map((rule) => (
                  <tr key={rule.code} className="hover:bg-[rgb(var(--color-surface))]/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-sky-400 whitespace-nowrap max-w-[200px] truncate" title={rule.code}>{rule.code}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border truncate inline-block max-w-[160px] ${rule.badgeColor}`} title={rule.category}>
                        {rule.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-[rgb(var(--color-text))] whitespace-nowrap max-w-[170px] truncate" title={rule.channel}>{rule.channel}</td>
                    <td className="py-3 px-3 text-[rgb(var(--color-muted))] whitespace-nowrap">{rule.pacing}</td>
                    <td className="py-3 px-3 text-[rgb(var(--color-text))] whitespace-nowrap">{rule.trai}</td>
                    <td className="py-3 px-3 text-right font-black text-violet-400 whitespace-nowrap">{rule.invariant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. AI Intent & Root Cause Diagnostic Playground */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[rgb(var(--color-line))]">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-400 stroke-[2.5]" />
            <h3 className="duo-h3 text-sm">AI Intent Classifier</h3>
          </div>
          <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            EVIDENCE-BOUND CANDIDATE
          </span>
        </div>

        {/* Horizontally Scrollable Carousel for Mock Failure Samples */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="duo-label text-[10px]">TEST FAILURE SAMPLES:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollContainer(sampleScrollRef, 'left', 200)}
                className="w-5 h-5 rounded bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] flex items-center justify-center border border-[rgb(var(--color-line))] cursor-pointer"
                title="Scroll left"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => scrollContainer(sampleScrollRef, 'right', 200)}
                className="w-5 h-5 rounded bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] flex items-center justify-center border border-[rgb(var(--color-line))] cursor-pointer"
                title="Scroll right"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div
            ref={sampleScrollRef}
            className="flex items-stretch gap-2 overflow-x-auto pb-1 pt-0.5 scroll-smooth no-scrollbar"
          >
            {AI_SAMPLE_SCENARIOS.map((sample, idx) => {
              const isSelected = selectedErrorCode === sample.errorCode && customerNote === sample.note;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedBank(sample.bank);
                    setSelectedErrorCode(sample.errorCode);
                    setCustomerNote(sample.note);
                  }}
                  className={`min-w-[190px] max-w-[210px] shrink-0 p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-[rgb(var(--color-text))]'
                      : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-line))] hover:border-amber-500/40 text-[rgb(var(--color-muted))]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[rgb(var(--color-text))] mb-1">
                    <span>{sample.label}</span>
                    <span className="text-[9px] font-mono-code font-bold px-1 py-0.5 rounded bg-slate-800 text-amber-400">
                      {sample.bank}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono-code text-[rgb(var(--color-muted))] truncate">
                    {sample.errorCode}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="duo-label block mb-1">Issuing Bank</label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] text-xs font-mono-code font-bold outline-none cursor-pointer"
            >
              {bankList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="duo-label block mb-1">Error Code</label>
            <select
              value={selectedErrorCode}
              onChange={(e) => setSelectedErrorCode(e.target.value)}
              className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] text-xs font-mono-code font-bold outline-none cursor-pointer"
            >
              {routingRules.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="duo-label block mb-1">Customer Spoken/Written Note</label>
            <input
              type="text"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="e.g. Salary delay, please remind me on 5th"
              className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] text-xs font-mono-code outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleTestAiDiagnose}
            disabled={isDiagnosing}
            className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider border-2 border-amber-600 border-b-4 active:border-b-2 active:translate-y-[2px] cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
            <span>Classify Intent & Generate Evidence</span>
          </button>
        </div>

        {aiResult && (
          <div className="p-4 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] space-y-2 text-xs font-mono-code">
            <div className="flex justify-between items-center pb-2 border-b border-[rgb(var(--color-line))]">
              <span className="text-[rgb(var(--color-muted))]">Classification Category:</span>
              <span className="text-amber-400 font-bold text-sm">{aiResult.classification}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--color-muted))]">Confidence Score:</span>
              <span className="text-emerald-400 font-bold">{(aiResult.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--color-muted))]">Detected Intent:</span>
              <span className="text-sky-400 font-bold">{aiResult.detected_intent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--color-muted))]">Suggested Tone & Urgency:</span>
              <span className="text-violet-400 font-bold">{aiResult.suggested_tone} · {aiResult.urgency_level}</span>
            </div>
            {aiResult.evidence_source && (
              <div className="pt-2 border-t border-[rgb(var(--color-line))] text-[rgb(var(--color-muted))]">
                <span className="font-bold text-[rgb(var(--color-text))]">Evidence Source: </span>
                {aiResult.evidence_source} ({aiResult.evidence_payload})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
