import React, { useState } from 'react';
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

interface TabPolicyEngineProps {
  state: EngineState;
  onUpdateBankStatus: (bank: string, status: 'HEALTHY' | 'DEGRADED', mins: number) => void;
  onAiDiagnose: (event: TelemetryEvent, note?: string) => Promise<AIIntentResponse>;
}

export const TabPolicyEngine: React.FC<TabPolicyEngineProps> = ({
  state,
  onUpdateBankStatus,
  onAiDiagnose,
}) => {
  // Bank CBS states
  const bankList = ['HDFC', 'SBIN', 'ICIC', 'UTIB', 'KKBK'];

  // AI Diagnostic State
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [selectedErrorCode, setSelectedErrorCode] = useState('GATEWAY_TIMEOUT');
  const [customerNote, setCustomerNote] = useState('Will pay next week when salary hits my bank account');
  const [aiResult, setAiResult] = useState<AIIntentResponse | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

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
      {/* 1. Top Section: Bank CBS Registry */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="duo-h2 flex items-center gap-2">
              <Server className="w-5 h-5 text-sky-400 stroke-[2.5]" />
              <span>ISSUING BANK CBS REGISTRY & PACING GATEWAYS</span>
            </h2>
            <p className="duo-body text-xs">
              When an issuing bank's Core Banking Solution (CBS) enters downtime, retries are paced by ETA to prevent mandate burn.
            </p>
          </div>
          <span className="text-[11px] font-mono-code font-black text-sky-400 px-3 py-1 rounded-full bg-sky-500/15 border-2 border-sky-500/40 w-fit">
            5 MAJOR GATEWAYS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {bankList.map((bank) => {
            const info = state.bank_cbs_health[bank] || { status: 'HEALTHY', avg_recovery_mins: 0 };
            const isHealthy = info.status === 'HEALTHY';
            return (
              <div
                key={bank}
                className={`p-4 rounded-2xl border-2 border-b-4 transition-all shadow-sm flex flex-col justify-between ${
                  isHealthy
                    ? 'bg-[rgb(var(--color-surface))] border-emerald-500/40 border-b-emerald-600'
                    : 'bg-rose-500/10 border-rose-500/50 border-b-rose-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-code font-black text-base text-[rgb(var(--color-text))]">
                      {bank}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                      }`}
                    />
                  </div>

                  <div className="text-xs font-mono-code font-bold mb-3">
                    {isHealthy ? (
                      <span className="text-emerald-400">HEALTHY (0m delay)</span>
                    ) : (
                      <span className="text-rose-400">DOWN ({info.avg_recovery_mins || 45}m pacing)</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 pt-2 border-t border-[rgb(var(--color-line))]">
                  <button
                    onClick={() => onUpdateBankStatus(bank, 'HEALTHY', 0)}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                      isHealthy
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-[rgb(var(--color-card))] hover:bg-emerald-500/20 text-[rgb(var(--color-muted))]'
                    }`}
                  >
                    Healthy
                  </button>
                  <button
                    onClick={() => onUpdateBankStatus(bank, 'DEGRADED', 45)}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                      !isHealthy
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-[rgb(var(--color-card))] hover:bg-rose-500/20 text-[rgb(var(--color-muted))]'
                    }`}
                  >
                    Down (45m)
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
            <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              E[R_net] &gt; 0 RULE
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
                <span>Base Recovery Prob (P_base)</span>
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
              <span>Expected Net Yield E[R_net]:</span>
              <span className="text-sm font-black">
                ₹{Math.max(0, eNet).toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] font-mono-code">
              {shouldHalt ? (
                <span className="font-bold text-rose-400">
                  ⛔ MDP STOPPING CONDITION MET: E[R_net] &le; 0. Sequence halts immediately.
                </span>
              ) : (
                <span className="font-bold text-emerald-400">
                  ✅ POSITIVE RECOVERY EXPECTATION: Proceed with intervention dispatch.
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
              FINITE-HORIZON MDP
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
                  name="Gross Recovery E[R_gross]"
                  stroke="#38BDF8"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="netYield"
                  name="Net Yield E[R_net]"
                  stroke="#34D399"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Deterministic Master Error Routing Matrix */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="duo-h2">
              DETERMINISTIC ERROR ROUTING POLICY (SSOT)
            </h2>
            <p className="duo-body text-xs">
              Every failure code maps deterministically to an exact recovery channel, pacing delay, and TRAI gate requirement.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-code">
            <thead>
              <tr className="border-b-2 border-[rgb(var(--color-line))] text-[rgb(var(--color-muted))]">
                <th className="pb-3">Raw Error Code</th>
                <th className="pb-3">Classification</th>
                <th className="pb-3">Assigned Channel</th>
                <th className="pb-3">Pacing Delay</th>
                <th className="pb-3">TRAI Gate Policy</th>
                <th className="pb-3 text-right">Invariant Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[rgb(var(--color-line))]">
              {routingRules.map((rule) => (
                <tr key={rule.code} className="hover:bg-[rgb(var(--color-surface))]/50 transition-colors">
                  <td className="py-3 font-bold text-sky-400">{rule.code}</td>
                  <td className="py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${rule.badgeColor}`}>
                      {rule.category}
                    </span>
                  </td>
                  <td className="py-3 font-bold text-[rgb(var(--color-text))]">{rule.channel}</td>
                  <td className="py-3 text-[rgb(var(--color-muted))]">{rule.pacing}</td>
                  <td className="py-3 text-[rgb(var(--color-text))]">{rule.trai}</td>
                  <td className="py-3 text-right font-black text-violet-400">{rule.invariant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. AI Intent & Root Cause Diagnostic Playground */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[rgb(var(--color-line))]">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-400 stroke-[2.5]" />
            <h3 className="duo-h3 text-sm">AI Failure Intent & Evidence-Bound Classifier</h3>
          </div>
          <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            EVIDENCE-BOUND CANDIDATE
          </span>
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
