import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  PhoneCall,
  MessageSquare,
  Bot,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sliders,
  Play,
  RotateCcw,
  Zap,
  Volume2,
  Lock,
  FileCode,
  UserCheck,
  Ban,
  PlusCircle,
  X,
} from 'lucide-react';
import { EngineState } from '../types';
import {
  ChatMessage,
  CustomerScenarioPreset,
  PRESET_CUSTOMER_SCENARIOS,
  InteractiveAgentEngine,
} from '../engine/interactiveAgent';
import {
  ExecutionMode,
  TelemetryEvent,
  FailureClassification,
  ChannelType,
  AgenticDecisionTrace,
} from '../engine/types';
import { formatINR, paiseToInr } from '../engine/utils';
import { generateTwimlVoiceRecovery } from '../engine/dispatcher';

interface TabAgentConsoleProps {
  state: EngineState;
  onFireEvent: (event: TelemetryEvent) => void;
  onApproveAction: (entityId: string) => void;
  onRejectAction: (entityId: string, reason?: string) => void;
  onRegisterPtp: (entityId: string, epoch: number, paise?: number, note?: string) => void;
}

export const TabAgentConsole: React.FC<TabAgentConsoleProps> = ({
  state,
  onFireEvent,
  onApproveAction,
  onRejectAction,
  onRegisterPtp,
}) => {
  const [activeChannelView, setActiveChannelView] = useState<'whatsapp' | 'ivr' | 'twiml'>('whatsapp');
  const [selectedScenario, setSelectedScenario] = useState<CustomerScenarioPreset>(
    PRESET_CUSTOMER_SCENARIOS[0]
  );
  const [customInput, setCustomInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCustomWebhookModal, setShowCustomWebhookModal] = useState(false);

  // Custom Webhook Builder State
  const [customEvType, setCustomEvType] = useState('subscription.charged_failed');
  const [customEvBank, setCustomEvBank] = useState('HDFC');
  const [customEvCode, setCustomEvCode] = useState('GATEWAY_TIMEOUT');
  const [customEvAmount, setCustomEvAmount] = useState<number>(2499);
  const [customEvPhone, setCustomEvPhone] = useState('+919876543210');

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initTrace: AgenticDecisionTrace = {
      agent_id: 'agent_sentinel_v2',
      telemetry_audit: 'Ingested mandate failure sub_mandate_4011 for ₹2,999.00 (HDFC INSUFFICIENT_FUNDS).',
      cbs_diagnosis: 'Bank: HDFC (HEALTHY). Classification: TRANSIENT_BALANCE_LOW.',
      fatigue_reasoning: 'Calculated MDP Yield: E[R_net] = ₹2,099.40 > 0. Generating 1-Click WhatsApp outreach.',
      recommended_channel: ChannelType.WHATSAPP_HINGLISH,
      confidence_score: 0.96,
      auto_executed: true,
      timestamp: new Date().toISOString(),
      reasoning_chain: {
        step_1_telemetry: 'Mandate auto-debit failed with INSUFFICIENT_FUNDS at 09:30 AM IST.',
        step_2_cbs_diagnosis: 'HDFC CBS is operational. Classified as transient salary delay.',
        step_3_mdp_yield: 'Expected recovery yield ₹2,099.40 exceeds WhatsApp channel cost ₹0.60.',
        step_4_execution_mode: 'Autonomous execution enabled. 1-Click Razorpay link generated.',
      },
    };

    return [
      {
        id: 'init_msg',
        sender: 'agent',
        text: 'Namaste! Aapka ₹2,999 ka auto-debit mandate complete nahi ho paya. Humne aapke liye 1-Click secure link reserve kiya hai:\n\n🔗 https://rzp.io/i/sub_4011\n\nAap chahein toh directly yahan se settle kar sakte hain, ya reply karke apna preferred reminder time bata sakte hain.',
        timestamp: '10:00 AM',
        payment_url: 'https://rzp.io/i/sub_4011',
        reasoning_trace: initTrace,
        sha256_hash: 'sha256_e89a42f019b3d4e8',
      },
    ];
  });

  const [activeTrace, setActiveTrace] = useState<AgenticDecisionTrace | null>(
    messages[0]?.reasoning_trace || null
  );

  // IVR dialpad state
  const [ivrDtmfInput, setIvrDtmfInput] = useState<string>('');
  const [ivrCallState, setIvrCallState] = useState<'idle' | 'calling' | 'connected' | 'ended'>(
    'idle'
  );
  const [ivrTranscript, setIvrTranscript] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelectScenario = (scen: CustomerScenarioPreset) => {
    setSelectedScenario(scen);
    setCustomInput(scen.customerPrompt);

    // Also fire background telemetry event so ledger and orchestrator track it
    onFireEvent({
      event_id: `evt_${Date.now()}`,
      event_type: 'subscription.charged_failed',
      entity_id: scen.entityId,
      gross_amount_paise: scen.amountPaise,
      customer_contact_hash: `hash_${scen.entityId}`,
      customer_phone: '+919876543210',
      issuing_bank: scen.bank,
      raw_error_code: scen.initialError,
      timestamp_utc: new Date().toISOString(),
    });
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || customInput;
    if (!text.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `msg_cust_${Date.now()}`,
      sender: 'customer',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setCustomInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const result = InteractiveAgentEngine.processCustomerInteraction(
        text,
        selectedScenario.entityId,
        selectedScenario.amountPaise,
        selectedScenario.bank,
        selectedScenario.initialError
      );

      setMessages((prev) => [...prev, result.agentMessage]);
      setActiveTrace(result.decisionTrace);

      // If PTP registered, update global state
      if (result.ptpEpoch) {
        onRegisterPtp(
          selectedScenario.entityId,
          result.ptpEpoch,
          selectedScenario.amountPaise,
          `Customer promised to pay on ${result.ptpDateStr}`
        );
      }

      setIsProcessing(false);
    }, 600);
  };

  // Custom Webhook Submission
  const handleFireCustomWebhook = () => {
    const evt: TelemetryEvent = {
      event_id: `custom_webhook_${Date.now()}`,
      event_type: customEvType,
      entity_id: `ent_${Date.now().toString().slice(-6)}`,
      gross_amount_paise: customEvAmount * 100,
      customer_contact_hash: `hash_${Date.now()}`,
      customer_phone: customEvPhone,
      issuing_bank: customEvBank,
      raw_error_code: customEvCode,
      timestamp_utc: new Date().toISOString(),
    };

    onFireEvent(evt);
    setShowCustomWebhookModal(false);

    // Update dialogue simulator with new entity context
    setSelectedScenario({
      id: 'custom_injected',
      title: `Custom ${customEvCode}`,
      category: customEvCode,
      customerPrompt: 'Maine abhi link check kiya hai, kal pay kar dunga.',
      entityId: evt.entity_id,
      amountPaise: evt.gross_amount_paise,
      bank: evt.issuing_bank || 'HDFC',
      initialError: evt.raw_error_code || 'GATEWAY_TIMEOUT',
    });
  };

  // Voice IVR Simulation Handlers
  const handleStartIvrCall = () => {
    setIvrCallState('calling');
    setIvrTranscript(['Connecting outbound call via Twilio Voice gateway (+918045689000)...']);

    setTimeout(() => {
      setIvrCallState('connected');
      setIvrTranscript((prev) => [
        ...prev,
        `[Agent Voice (Hinglish)]: "Namaste! Yeh Revive automated recovery service hai. Aapka ₹${(
          selectedScenario.amountPaise / 100
        ).toFixed(2)} ka mandate pending hai."`,
        `[Agent Voice]: "Agar aap kal subah 10 baje pay karna chahte hain toh 1 dabayein. WhatsApp par 1-click link pane ke liye 2 dabayein. Support agent se baat karne ke liye 3 dabayein."`,
      ]);
    }, 1200);
  };

  const handleDtmfPress = (digit: string) => {
    if (ivrCallState !== 'connected') return;
    setIvrDtmfInput(digit);

    if (digit === '1') {
      const tomorrowEpoch = Math.floor(Date.now() / 1000) + 24 * 3600;
      onRegisterPtp(selectedScenario.entityId, tomorrowEpoch, selectedScenario.amountPaise, 'IVR DTMF 1 - Tomorrow 10 AM');
      setIvrTranscript((prev) => [
        ...prev,
        `[Customer DTMF Input]: Pressed '1'`,
        `[Agent Voice]: "Dhanyawad! Humne aapka Promise-to-Pay kal subah 10 baje ke liye schedule kar diya hai. Call disconnect ho rahi hai."`,
        `[System]: State updated to PROMISE_TO_PAY_PENDING (Frozen until tomorrow 10:00 AM IST).`,
      ]);
      setTimeout(() => setIvrCallState('ended'), 2500);
    } else if (digit === '2') {
      setIvrTranscript((prev) => [
        ...prev,
        `[Customer DTMF Input]: Pressed '2'`,
        `[Agent Voice]: "Humne aapke WhatsApp par instant 1-click UPI link bhej diya hai. Dhanyawad!"`,
        `[System]: Dispatched WhatsApp template with pre-signed Razorpay link.`,
      ]);
      setTimeout(() => setIvrCallState('ended'), 2500);
    } else if (digit === '3') {
      setIvrTranscript((prev) => [
        ...prev,
        `[Customer DTMF Input]: Pressed '3'`,
        `[Agent Voice]: "Aapki call human support agent queue me transfer ho rahi hai. Kripya hold karein."`,
        `[System]: Enqueued in Human Escalation Desk.`,
      ]);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Top Header Banner */}
      <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-sky-500/40 border-b-6 border-b-sky-600 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 text-sky-400 border-2 border-sky-500/40 text-xs font-black font-mono-code uppercase tracking-wider">
            <Bot className="w-3.5 h-3.5 stroke-[2.5]" />
            Live Simulation
          </div>
          <h1 className="duo-h1 text-2xl sm:text-3xl text-[rgb(var(--color-text))]">
            Autonomous Recovery Agent Console
          </h1>
          <p className="duo-body text-xs sm:text-sm">
            Observe perception, classification, mathematical MDP yield optimization, and multi-channel execution in real time.
          </p>
        </div>

        {/* Action Controls & Channel Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCustomWebhookModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black uppercase tracking-wider border-2 border-sky-600 border-b-4 active:border-b-2 active:translate-y-[2px] shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>Inject Webhook</span>
          </button>

          <div className="flex items-center p-1 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))]">
            <button
              onClick={() => setActiveChannelView('whatsapp')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono-code uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChannelView === 'whatsapp'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setActiveChannelView('ivr')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono-code uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChannelView === 'ivr'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Voice IVR</span>
            </button>

            <button
              onClick={() => setActiveChannelView('twiml')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono-code uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChannelView === 'twiml'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>TwiML</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preset Failure Scenario Selector Chips */}
      <div className="p-4 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="duo-label text-xs">TEST FAILURE SCENARIOS:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PRESET_CUSTOMER_SCENARIOS.map((scen) => {
            const isSel = selectedScenario.id === scen.id;
            return (
              <button
                key={scen.id}
                onClick={() => handleSelectScenario(scen)}
                className={`p-3 rounded-2xl text-left transition-all border-2 border-b-4 cursor-pointer flex flex-col justify-between ${
                  isSel
                    ? 'bg-sky-500/15 border-sky-500 border-b-sky-600 text-[rgb(var(--color-text))] shadow-sm'
                    : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-line))] hover:border-slate-500 text-[rgb(var(--color-muted))]'
                }`}
              >
                <div className="font-mono-code font-black text-xs text-[rgb(var(--color-text))] truncate">
                  {scen.title}
                </div>
                <div className="text-[10px] text-[rgb(var(--color-muted))] line-clamp-1 mt-1">
                  {scen.bank} · {formatINR(scen.amountPaise)}
                </div>
                <div className="mt-2 text-[9px] font-mono-code font-black px-1.5 py-0.5 rounded-md bg-slate-800 text-sky-400 w-fit">
                  {scen.initialError}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Grid: Left 7 Cols (Simulator), Right 5 Cols (Reasoning Trace) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): WhatsApp or Voice IVR or TwiML */}
        <div className="lg:col-span-7 space-y-4">
          {/* WHATSAPP VIEW */}
          {activeChannelView === 'whatsapp' && (
            <div className="rounded-3xl bg-slate-900 border-2 border-emerald-500/40 border-b-6 border-b-emerald-600 shadow-xl overflow-hidden flex flex-col h-[560px]">
              {/* WhatsApp Header */}
              <div className="px-5 py-3.5 bg-slate-800 border-b-2 border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
                    <Bot className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">Razorpay Revive Assistant</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <span className="text-[10px] font-mono-code text-slate-400">
                      Official Verified Merchant Channel · +91 98765 43210
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  TRAI COMPLIANT (IST)
                </span>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                {messages.map((msg) => {
                  const isAgent = msg.sender === 'agent';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[78%] p-3.5 rounded-2xl text-xs font-sans shadow-md whitespace-pre-wrap leading-relaxed ${
                          isAgent
                            ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-sm'
                            : 'bg-emerald-600 text-white rounded-tr-sm font-medium'
                        }`}
                      >
                        {msg.text}

                        {/* Interactive 1-Click Payment Link Preview */}
                        {msg.payment_url && (
                          <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="text-[11px] font-mono-code text-emerald-300 truncate">
                                {msg.payment_url}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCopy(msg.payment_url!, 'pay_link')}
                              className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-mono-code font-black uppercase shrink-0 cursor-pointer"
                            >
                              {copiedField === 'pay_link' ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] font-mono-code text-slate-500">
                        <span>{msg.timestamp}</span>
                        {msg.sha256_hash && (
                          <span className="text-[9px] text-emerald-400">· {msg.sha256_hash.slice(0, 10)}...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isProcessing && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-800/80 text-emerald-400 text-xs font-mono-code w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Agent evaluating intent & computing net yield...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Reply Suggestion Chips */}
              <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px] font-mono-code">
                <span className="text-slate-400 text-[10px] font-bold shrink-0">QUICK REPLIES:</span>
                <button
                  onClick={() => handleSendMessage('Salary 5th ko aayegi, tab pay karunga.')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 whitespace-nowrap cursor-pointer"
                >
                  "Salary 5th ko aayegi"
                </button>
                <button
                  onClick={() => handleSendMessage('Mujhe company name se B2B invoice chahiye.')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 whitespace-nowrap cursor-pointer"
                >
                  "Send B2B virtual account"
                </button>
                <button
                  onClick={() => handleSendMessage('Naya card details kaise update karun?')}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-violet-400 border border-violet-500/30 whitespace-nowrap cursor-pointer"
                >
                  "Card expired update"
                </button>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-slate-800 border-t-2 border-slate-700 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type customer reply in Hinglish or English..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500 font-mono-code"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!customInput.trim() || isProcessing}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          )}

          {/* VOICE IVR VIEW */}
          {activeChannelView === 'ivr' && (
            <div className="rounded-3xl bg-slate-900 border-2 border-sky-500/40 border-b-6 border-b-sky-600 shadow-xl overflow-hidden flex flex-col h-[560px] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-sky-400" />
                  <span className="duo-h3 text-base text-slate-100">Outbound Voice IVR Call Simulator</span>
                </div>
                <span
                  className={`text-[10px] font-mono-code font-bold px-2.5 py-0.5 rounded-full ${
                    ivrCallState === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  STATUS: {ivrCallState.toUpperCase()}
                </span>
              </div>

              {/* Call Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartIvrCall}
                  disabled={ivrCallState === 'calling' || ivrCallState === 'connected'}
                  className="px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-sky-600 border-b-4 active:border-b-2 active:translate-y-[2px] transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4 stroke-[2.5]" />
                  <span>Initiate Outbound Call</span>
                </button>
              </div>

              {/* Audio & Transcript Terminal */}
              <div className="flex-1 p-4 rounded-2xl bg-slate-950 border border-slate-800 overflow-y-auto space-y-2 font-mono-code text-xs">
                {ivrTranscript.length === 0 ? (
                  <div className="text-slate-500 text-center py-10">
                    Click "Initiate Outbound Call" to test the synthesized Hinglish Voice IVR dialogue.
                  </div>
                ) : (
                  ivrTranscript.map((t, i) => (
                    <div
                      key={i}
                      className={`leading-relaxed ${
                        t.includes('[Customer')
                          ? 'text-emerald-400 font-bold'
                          : t.includes('[System')
                          ? 'text-violet-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {t}
                    </div>
                  ))
                )}
              </div>

              {/* DTMF Keypad */}
              <div className="pt-2">
                <span className="text-[10px] font-mono-code text-slate-400 block mb-2 font-bold">
                  INTERACTIVE DTMF KEYPAD (PRESS 1 FOR PTP, 2 FOR LINK, 3 FOR AGENT):
                </span>
                <div className="grid grid-cols-3 gap-2 max-w-xs">
                  {['1', '2', '3'].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => handleDtmfPress(digit)}
                      disabled={ivrCallState !== 'connected'}
                      className="p-3.5 rounded-2xl bg-slate-800 hover:bg-sky-500 hover:text-slate-950 font-mono-code font-black text-base text-slate-100 border-2 border-slate-700 active:translate-y-[2px] transition-all cursor-pointer disabled:opacity-40"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TWIML XML VIEW */}
          {activeChannelView === 'twiml' && (
            <div className="rounded-3xl bg-slate-900 border-2 border-violet-500/40 border-b-6 border-b-violet-600 shadow-xl overflow-hidden flex flex-col h-[560px] p-6 space-y-4 font-mono-code text-xs">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-violet-400" />
                  <span className="duo-h3 text-base text-slate-100">Live TwiML Voice Script XML</span>
                </div>
                <button
                  onClick={() =>
                    handleCopy(
                      generateTwimlVoiceRecovery(
                        'Customer',
                        selectedScenario.amountPaise / 100,
                        selectedScenario.entityId
                      ),
                      'twiml'
                    )
                  }
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-violet-500 hover:text-white text-violet-300 border border-violet-500/30 text-[11px] font-bold cursor-pointer"
                >
                  {copiedField === 'twiml' ? 'Copied!' : 'Copy XML'}
                </button>
              </div>

              <div className="flex-1 p-4 rounded-2xl bg-slate-950 border border-slate-800 overflow-y-auto text-emerald-400 text-xs leading-relaxed whitespace-pre font-mono-code">
                {generateTwimlVoiceRecovery(
                  'Customer',
                  selectedScenario.amountPaise / 100,
                  selectedScenario.entityId
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 Cols): Agent Reasoning Trace & Invariant Checklist */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-sky-500/40 border-b-6 border-b-sky-600 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[rgb(var(--color-line))]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold border border-sky-500/30">
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="duo-h3 text-sm">Agent Reasoning Trace</h3>
                  <p className="duo-body text-[11px]">Multi-Step Rationale Chain</p>
                </div>
              </div>

              <span className="text-[10px] font-mono-code font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                CONFIDENCE: {activeTrace ? `${(activeTrace.confidence_score * 100).toFixed(0)}%` : '96%'}
              </span>
            </div>

            {/* 4 Structured Chain-of-Thought Steps */}
            <div className="space-y-3 font-mono-code text-xs">
              {/* Step 1: Telemetry */}
              <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] space-y-1">
                <div className="flex items-center justify-between text-sky-400 font-bold text-[11px]">
                  <span>STEP 1: INGESTION & PERCEPTION</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[rgb(var(--color-text))] text-[11px] leading-relaxed">
                  {activeTrace?.reasoning_chain?.step_1_telemetry ||
                    activeTrace?.telemetry_audit ||
                    'Ingested raw payment failure webhook with failure context.'}
                </p>
              </div>

              {/* Step 2: CBS Diagnosis & Intent */}
              <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] space-y-1">
                <div className="flex items-center justify-between text-amber-400 font-bold text-[11px]">
                  <span>STEP 2: BANK CBS & INTENT CLASSIFICATION</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[rgb(var(--color-text))] text-[11px] leading-relaxed">
                  {activeTrace?.reasoning_chain?.step_2_cbs_diagnosis ||
                    activeTrace?.cbs_diagnosis ||
                    'Evaluated issuing bank health & mapped natural language intent.'}
                </p>
              </div>

              {/* Step 3: MDP Yield & Stopping Rule */}
              <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] space-y-1">
                <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                  <span>STEP 3: MATHEMATICAL MDP STOPPING RULE</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[rgb(var(--color-text))] text-[11px] leading-relaxed">
                  {activeTrace?.reasoning_chain?.step_3_mdp_yield ||
                    activeTrace?.fatigue_reasoning ||
                    'Verified expected net recovery yield > 0 under fatigue decay.'}
                </p>
              </div>

              {/* Step 4: Policy & Action Dispatch */}
              <div className="p-3 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] space-y-1">
                <div className="flex items-center justify-between text-violet-400 font-bold text-[11px]">
                  <span>STEP 4: POLICY GATE & TOOL EXECUTION</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[rgb(var(--color-text))] text-[11px] leading-relaxed">
                  {activeTrace?.reasoning_chain?.step_4_execution_mode ||
                    `Channel: ${activeTrace?.recommended_channel || 'WHATSAPP_HINGLISH'}. Mode: AUTONOMOUS.`}
                </p>
              </div>
            </div>

            {/* Invariant Checklist */}
            <div className="pt-2 border-t-2 border-[rgb(var(--color-line))] space-y-2">
              <span className="duo-label block text-[10px]">DETERMINISTIC INVARIANTS:</span>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code">
                <div className="p-2 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex items-center justify-between">
                  <span className="text-[rgb(var(--color-muted))]">TRAI Gate:</span>
                  <span className={`font-bold ${state.enforce_trai ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {state.enforce_trai ? 'ENFORCED' : 'BYPASSED'}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex items-center justify-between">
                  <span className="text-[rgb(var(--color-muted))]">Attempts:</span>
                  <span className="text-sky-400 font-bold">
                    {(state.ledger_chain?.find((b) => b.entity_id === selectedScenario.entityId)?.attempt_count || 1)} / 3 CAP
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex items-center justify-between">
                  <span className="text-[rgb(var(--color-muted))]">PTP Status:</span>
                  <span
                    className={`font-bold ${
                      state.active_p2p?.some((p) => p.entity_id === selectedScenario.entityId)
                        ? 'text-violet-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {state.active_p2p?.some((p) => p.entity_id === selectedScenario.entityId)
                      ? 'FROZEN'
                      : 'ACTIVE'}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex items-center justify-between">
                  <span className="text-[rgb(var(--color-muted))]">Ledger Block:</span>
                  <span className="text-emerald-400 font-bold">{activeTrace ? 'COMMITTED' : 'PENDING'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Operator Pending Review Queue & Active PTP Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* HITL Operator Review Queue */}
        <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[rgb(var(--color-line))]">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400 stroke-[2.5]" />
              <h3 className="duo-h3 text-sm">Human-in-the-Loop Pending Queue</h3>
            </div>
            <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {state.pending_queue.length} PENDING REVIEW
            </span>
          </div>

          {state.pending_queue.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[rgb(var(--color-surface))] text-center text-xs font-mono-code text-[rgb(var(--color-muted))]">
              Queue is clear. Switch to Manual Review mode in header to test human-in-the-loop signoff.
            </div>
          ) : (
            <div className="space-y-2">
              {state.pending_queue.map((item) => (
                <div
                  key={item.entity_id}
                  className="p-3.5 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex items-center justify-between gap-3 text-xs font-mono-code"
                >
                  <div>
                    <span className="font-bold text-sky-400">{item.entity_id}</span>
                    <div className="text-[11px] text-[rgb(var(--color-muted))]">
                      {item.action?.target_channel || item.trace?.recommended_channel || 'WHATSAPP_HINGLISH'} · {formatINR(item.event?.gross_amount_paise || 250000)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApproveAction(item.entity_id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase text-[10px] transition-all cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onRejectAction(item.entity_id, 'OPERATOR_REJECTED')}
                      className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black uppercase text-[10px] transition-all cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Promise-to-Pay (PTP) Watchlist */}
        <div className="p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-[rgb(var(--color-line))] border-b-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[rgb(var(--color-line))]">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-400 stroke-[2.5]" />
              <h3 className="duo-h3 text-sm">Active Promise-to-Pay (PTP) Watchlist</h3>
            </div>
            <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
              {state.active_p2p.length} FROZEN ENTITIES
            </span>
          </div>

          {state.active_p2p.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[rgb(var(--color-surface))] text-center text-xs font-mono-code text-[rgb(var(--color-muted))]">
              No active PTP freezes. Reply "Salary 5th ko aayegi" in WhatsApp chat or press '1' in IVR to schedule a freeze.
            </div>
          ) : (
            <div className="space-y-2">
              {state.active_p2p.map((ptp) => (
                <div
                  key={ptp.entity_id}
                  className="p-3.5 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] flex items-center justify-between text-xs font-mono-code"
                >
                  <div>
                    <span className="font-bold text-violet-400">{ptp.entity_id}</span>
                    <div className="text-[11px] text-[rgb(var(--color-muted))]">
                      Promised Amount: {formatINR(ptp.gross_amount_paise || 250000)}
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 font-black text-[10px] border border-violet-500/40">
                    FROZEN UNTIL PROMISE DATE
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Webhook Modal */}
      {showCustomWebhookModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-[rgb(var(--color-card))] border-2 border-sky-500/40 border-b-6 border-b-sky-600 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[rgb(var(--color-line))]">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-sky-400 stroke-[2.5]" />
                <h3 className="duo-h3 text-base">Inject Custom Payment Failure Webhook</h3>
              </div>
              <button
                onClick={() => setShowCustomWebhookModal(false)}
                className="p-1.5 rounded-xl hover:bg-[rgb(var(--color-surface))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-3 font-mono-code text-xs">
              <div>
                <label className="duo-label block mb-1">Webhook Event Type</label>
                <select
                  value={customEvType}
                  onChange={(e) => setCustomEvType(e.target.value)}
                  className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] font-bold outline-none cursor-pointer"
                >
                  <option value="subscription.charged_failed">subscription.charged_failed</option>
                  <option value="checkout.dropped">checkout.dropped</option>
                  <option value="invoice.overdue">invoice.overdue</option>
                  <option value="mandate.notification_failed">mandate.notification_failed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="duo-label block mb-1">Issuing Bank</label>
                  <select
                    value={customEvBank}
                    onChange={(e) => setCustomEvBank(e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] font-bold outline-none cursor-pointer"
                  >
                    <option value="HDFC">HDFC Bank</option>
                    <option value="SBIN">State Bank of India</option>
                    <option value="ICIC">ICICI Bank</option>
                    <option value="UTIB">Axis Bank</option>
                    <option value="KKBK">Kotak Mahindra</option>
                  </select>
                </div>

                <div>
                  <label className="duo-label block mb-1">Raw Error Code</label>
                  <select
                    value={customEvCode}
                    onChange={(e) => setCustomEvCode(e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] font-bold outline-none cursor-pointer"
                  >
                    <option value="GATEWAY_TIMEOUT">GATEWAY_TIMEOUT</option>
                    <option value="INSUFFICIENT_FUNDS">INSUFFICIENT_FUNDS</option>
                    <option value="CARD_EXPIRED">CARD_EXPIRED</option>
                    <option value="USER_ABANDONED">USER_ABANDONED</option>
                    <option value="PAYMENT_OVERDUE">PAYMENT_OVERDUE</option>
                    <option value="MANDATE_REVOKED">MANDATE_REVOKED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="duo-label block mb-1">Amount (INR ₹)</label>
                  <input
                    type="number"
                    value={customEvAmount}
                    onChange={(e) => setCustomEvAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] font-bold outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="duo-label block mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={customEvPhone}
                    onChange={(e) => setCustomEvPhone(e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] font-bold outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleFireCustomWebhook}
              className="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-sky-600 border-b-4 active:border-b-2 active:translate-y-[2px] transition-all cursor-pointer"
            >
              Inject Webhook & Start Recovery Pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
