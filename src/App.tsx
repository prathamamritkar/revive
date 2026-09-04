import React, { useState, useEffect } from 'react';
import {
  Activity,
  Bot,
  BarChart2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { Header } from './components/Header';
import { TabHome } from './components/TabHome';
import { TabAgentConsole } from './components/TabAgentConsole';
import { TabBenchmark } from './components/TabBenchmark';
import { TabPolicyEngine } from './components/TabPolicyEngine';
import { TabLedger } from './components/TabLedger';
import { Footer } from './components/Footer';
import { ExecutionMode, TelemetryEvent, AIIntentResponse } from './engine/types';
import { DashboardTheme, EngineState } from './types';
import { ReviveOrchestrator } from './engine/orchestrator';
import { SYNTHETIC_BATCH_50 } from './data/syntheticBatch';

// Fallback client-side orchestrator if API server isn't reached
const clientOrchestrator = new ReviveOrchestrator();

export default function App() {
  const [theme, setTheme] = useState<DashboardTheme>('Dark');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [state, setState] = useState<EngineState>({
    mode: ExecutionMode.AGENTIC_AUTONOMOUS,
    enforce_trai: true,
    ledger_summary: {
      total_records: 0,
      total_initial_paise: 0,
      total_recovered_paise: 0,
      total_cost_paise: 0,
      net_recovered_paise: 0,
      recovery_rate_pct: 0,
      integrity_valid: true,
    },
    ledger_chain: [],
    dispatch_history: [],
    pending_queue: [],
    decision_traces: [],
    bank_cbs_health: {},
    active_p2p: [],
  });

  // Apply theme class and data-theme attribute to document element
  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'Dark') {
      document.documentElement.classList.add('theme-dark');
    } else if (theme === 'Light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.add('theme-high-contrast');
    }
  }, [theme]);

  // Sync state from server or fallback
  const syncState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
        return;
      }
    } catch (e) {
      // Fallback to local engine instance
    }

    // Client fallback sync
    const summary = clientOrchestrator.ledger.getSummary();
    setState({
      mode: clientOrchestrator.mode,
      enforce_trai: clientOrchestrator.enforceTrai,
      ledger_summary: summary,
      ledger_chain: [...clientOrchestrator.ledger.chain],
      dispatch_history: clientOrchestrator.dispatcher.getDispatchHistory(),
      pending_queue: Array.from(clientOrchestrator.pendingOperatorQueue.entries()).map(([k, v]) => ({
        entity_id: k,
        ...v,
      })),
      decision_traces: [...clientOrchestrator.decisionTraces],
      bank_cbs_health: { ...clientOrchestrator.classifier.bank_cbs_health },
      active_p2p: Array.from(clientOrchestrator.stateStore.entries())
        .filter(([_, v]) => v.status === 'PROMISE_TO_PAY_PENDING')
        .map(([k, v]) => ({ entity_id: k, ...v })),
    });
  };

  // Initial load
  useEffect(() => {
    // Run initial benchmark to populate realistic initial recovery dataset
    handleRunBenchmark();
  }, []);

  // Mode Toggle
  const handleToggleMode = async (mode: ExecutionMode) => {
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
    } catch (e) {}
    clientOrchestrator.setMode(mode);
    syncState();
  };

  // TRAI Toggle
  const handleToggleTrai = async (enforce: boolean) => {
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enforce_trai: enforce }),
      });
    } catch (e) {}
    clientOrchestrator.setTraiEnforcement(enforce);
    syncState();
  };

  // Reset
  const handleReset = async () => {
    try {
      await fetch('/api/clear', { method: 'POST' });
    } catch (e) {}
    clientOrchestrator.clear();
    syncState();
  };

  // Run 50-Record Benchmark
  const handleRunBenchmark = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/batch-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: SYNTHETIC_BATCH_50 }),
      });
      if (res.ok) {
        await syncState();
        setIsLoading(false);
        return;
      }
    } catch (e) {}

    // Fallback batch run
    clientOrchestrator.processBatch(SYNTHETIC_BATCH_50);
    syncState();
    setIsLoading(false);
  };

  // Bank Health Update
  const handleUpdateBankStatus = async (bank: string, status: 'HEALTHY' | 'DEGRADED', mins: number) => {
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank, bank_status: status, bank_recovery_mins: mins }),
      });
    } catch (e) {}
    clientOrchestrator.classifier.setBankStatus(bank, status, mins);
    syncState();
  };

  // AI Diagnostic
  const handleAiDiagnose = async (event: TelemetryEvent, note?: string): Promise<AIIntentResponse> => {
    try {
      const res = await fetch('/api/v1/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, customer_note: note }),
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return clientOrchestrator.classifier.diagnoseWithAI(event, note);
  };

  // Fire Event
  const handleFireEvent = async (evt: TelemetryEvent) => {
    try {
      await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evt),
      });
    } catch (e) {}
    clientOrchestrator.processEvent(evt);
    syncState();
  };

  // Operator Approve
  const handleApprove = async (entityId: string) => {
    try {
      await fetch('/api/v1/operator/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId }),
      });
    } catch (e) {}
    clientOrchestrator.approveAndDispatch(entityId);
    syncState();
  };

  // Operator Reject
  const handleReject = async (entityId: string) => {
    try {
      await fetch('/api/v1/operator/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entityId }),
      });
    } catch (e) {}
    clientOrchestrator.rejectAndHalt(entityId, 'OPERATOR_REJECTED');
    syncState();
  };

  // Register PTP
  const handleRegisterPtp = async (entityId: string, epochOrDays: number, paise?: number, note?: string) => {
    const epoch = epochOrDays > 1000000000 ? epochOrDays : Math.floor(Date.now() / 1000) + epochOrDays * 86400;
    const amount = paise || 250000;
    const ptpNote = note || 'Customer Promise-to-Pay registered';

    try {
      await fetch('/api/v1/ptp/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_id: entityId,
          promised_timestamp_epoch: epoch,
          promised_amount_paise: amount,
          note: ptpNote,
        }),
      });
    } catch (e) {}
    clientOrchestrator.registerPtpCommitment(entityId, epoch, amount, ptpNote);
    syncState();
  };

  // Verify Proof
  const handleVerifyProof = async (logId: string) => {
    try {
      const res = await fetch(`/api/v1/ledger/audit/${logId}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return clientOrchestrator.ledger.verifyBlockProof(logId);
  };

  // 5 Canonical Navigation Tabs
  const tabs = [
    { label: 'Overview', shortLabel: 'Overview', icon: Activity },
    { label: 'Console', shortLabel: 'Console', icon: Bot },
    { label: 'Benchmark', shortLabel: 'Benchmark', icon: BarChart2 },
    { label: 'Policy', shortLabel: 'Policy', icon: Sliders },
    { label: 'Ledger', shortLabel: 'Ledger', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar with Page Navigation & Rightmost Controls Menu */}
      <Header
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={setTheme}
        mode={state.mode}
        onToggleMode={handleToggleMode}
        enforceTrai={state.enforce_trai}
        onToggleTrai={handleToggleTrai}
        onReset={handleReset}
        backendConnected={state.backend_connected}
        fastapiUrl={state.fastapi_url}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Active Tab Panel */}
        <div>
          {activeTab === 0 && (
            <TabHome
              state={state}
              onNavigateTab={(tabIdx) => setActiveTab(tabIdx)}
              onToggleMode={handleToggleMode}
              onToggleTrai={handleToggleTrai}
              onApproveAction={handleApprove}
              onRejectAction={handleReject}
              onUpdateBankStatus={handleUpdateBankStatus}
            />
          )}
          {activeTab === 1 && (
            <TabAgentConsole
              state={state}
              onFireEvent={handleFireEvent}
              onApproveAction={handleApprove}
              onRejectAction={handleReject}
              onRegisterPtp={handleRegisterPtp}
            />
          )}
          {activeTab === 2 && <TabBenchmark />}
          {activeTab === 3 && (
            <TabPolicyEngine
              state={state}
              onUpdateBankStatus={handleUpdateBankStatus}
              onAiDiagnose={handleAiDiagnose}
            />
          )}
          {activeTab === 4 && (
            <TabLedger state={state} onVerifyProof={handleVerifyProof} />
          )}
        </div>
      </main>

      {/* Enterprise Production Footer */}
      <Footer
        enforceTrai={state.enforce_trai}
        backendConnected={state.backend_connected}
      />
    </div>
  );
}
