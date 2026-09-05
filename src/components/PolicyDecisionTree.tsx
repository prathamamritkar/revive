import React from 'react';
import {
  Sparkles,
  ShieldAlert,
  Server,
  Clock,
  Shield,
  Calculator,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export type TreeNodeId =
  | 'root'
  | 'gate_terminal'
  | 'leaf_terminal_halt'
  | 'gate_cbs'
  | 'leaf_cbs_pacing'
  | 'gate_trai'
  | 'leaf_silent_retry'
  | 'leaf_trai_defer'
  | 'gate_ptp_mandate'
  | 'leaf_ptp_freeze'
  | 'leaf_mandate_ceiling'
  | 'gate_mdp'
  | 'leaf_mdp_halt'
  | 'leaf_dispatch_menu';

interface PolicyDecisionTreeProps {
  selectedNode: TreeNodeId;
  onSelectNode: (node: TreeNodeId) => void;
}

interface TreePathEdge {
  from: TreeNodeId;
  to: TreeNodeId;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  badgeType: 'terminal' | 'action' | 'defer' | 'pass';
}

const EDGES: TreePathEdge[] = [
  {
    from: 'root',
    to: 'gate_terminal',
    x1: 200,
    y1: 260,
    x2: 280,
    y2: 260,
    label: 'Failure Ingest',
    badgeType: 'pass',
  },
  {
    from: 'gate_terminal',
    to: 'leaf_terminal_halt',
    x1: 490,
    y1: 260,
    x2: 570,
    y2: 83,
    label: '[YES] Match',
    badgeType: 'terminal',
  },
  {
    from: 'gate_terminal',
    to: 'gate_cbs',
    x1: 490,
    y1: 260,
    x2: 570,
    y2: 295,
    label: '[NO] Transient',
    badgeType: 'pass',
  },
  {
    from: 'gate_cbs',
    to: 'leaf_cbs_pacing',
    x1: 780,
    y1: 295,
    x2: 860,
    y2: 173,
    label: 'DEGRADED',
    badgeType: 'defer',
  },
  {
    from: 'gate_cbs',
    to: 'gate_trai',
    x1: 780,
    y1: 295,
    x2: 860,
    y2: 355,
    label: 'HEALTHY',
    badgeType: 'pass',
  },
  {
    from: 'gate_trai',
    to: 'leaf_silent_retry',
    x1: 1070,
    y1: 355,
    x2: 1150,
    y2: 210,
    label: 'M2M Retry',
    badgeType: 'action',
  },
  {
    from: 'gate_trai',
    to: 'leaf_trai_defer',
    x1: 1070,
    y1: 355,
    x2: 1150,
    y2: 310,
    label: 'Outside 08-19',
    badgeType: 'defer',
  },
  {
    from: 'gate_trai',
    to: 'gate_ptp_mandate',
    x1: 1070,
    y1: 355,
    x2: 1150,
    y2: 435,
    label: 'Inside Window',
    badgeType: 'pass',
  },
  {
    from: 'gate_ptp_mandate',
    to: 'leaf_ptp_freeze',
    x1: 1370,
    y1: 435,
    x2: 1450,
    y2: 330,
    label: 'PTP Active',
    badgeType: 'defer',
  },
  {
    from: 'gate_ptp_mandate',
    to: 'leaf_mandate_ceiling',
    x1: 1370,
    y1: 435,
    x2: 1450,
    y2: 430,
    label: '≥ 4 Debits',
    badgeType: 'terminal',
  },
  {
    from: 'gate_ptp_mandate',
    to: 'gate_mdp',
    x1: 1370,
    y1: 435,
    x2: 1450,
    y2: 557,
    label: 'Clear',
    badgeType: 'pass',
  },
  {
    from: 'gate_mdp',
    to: 'leaf_mdp_halt',
    x1: 1670,
    y1: 557,
    x2: 1750,
    y2: 503,
    label: 'E[R_net] ≤ 0',
    badgeType: 'terminal',
  },
  {
    from: 'gate_mdp',
    to: 'leaf_dispatch_menu',
    x1: 1670,
    y1: 557,
    x2: 1750,
    y2: 618,
    label: 'E[R_net] > 0',
    badgeType: 'action',
  },
];

function getUpstreamNodes(target: TreeNodeId): Set<TreeNodeId> {
  const result = new Set<TreeNodeId>([target]);
  const paths: Record<TreeNodeId, TreeNodeId[]> = {
    root: ['root'],
    gate_terminal: ['root', 'gate_terminal'],
    leaf_terminal_halt: ['root', 'gate_terminal', 'leaf_terminal_halt'],
    gate_cbs: ['root', 'gate_terminal', 'gate_cbs'],
    leaf_cbs_pacing: ['root', 'gate_terminal', 'gate_cbs', 'leaf_cbs_pacing'],
    gate_trai: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai'],
    leaf_silent_retry: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'leaf_silent_retry'],
    leaf_trai_defer: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'leaf_trai_defer'],
    gate_ptp_mandate: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'gate_ptp_mandate'],
    leaf_ptp_freeze: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'gate_ptp_mandate', 'leaf_ptp_freeze'],
    leaf_mandate_ceiling: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'gate_ptp_mandate', 'leaf_mandate_ceiling'],
    gate_mdp: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'gate_ptp_mandate', 'gate_mdp'],
    leaf_mdp_halt: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'gate_ptp_mandate', 'gate_mdp', 'leaf_mdp_halt'],
    leaf_dispatch_menu: ['root', 'gate_terminal', 'gate_cbs', 'gate_trai', 'gate_ptp_mandate', 'gate_mdp', 'leaf_dispatch_menu'],
  };

  for (const n of paths[target] || []) {
    result.add(n);
  }
  return result;
}

export const PolicyDecisionTree: React.FC<PolicyDecisionTreeProps> = ({
  selectedNode,
  onSelectNode,
}) => {
  const activePath = getUpstreamNodes(selectedNode);

  const isEdgeActive = (edge: TreePathEdge) => {
    return activePath.has(edge.from) && activePath.has(edge.to);
  };

  return (
    <div className="p-4 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-line))] shadow-inner overflow-x-auto">
      <div className="min-w-[1950px] relative pb-2">
        <svg
          viewBox="0 0 2000 680"
          className="w-full h-[680px] select-none block"
        >
          <defs>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
            <marker
              id="arrow-inactive"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
            </marker>
          </defs>

          {/* Draw Connector Paths */}
          {EDGES.map((edge, idx) => {
            const active = isEdgeActive(edge);
            const dx = edge.x2 - edge.x1;
            const c1x = edge.x1 + dx * 0.45;
            const c1y = edge.y1;
            const c2x = edge.x1 + dx * 0.55;
            const c2y = edge.y2;
            const pathD = `M ${edge.x1} ${edge.y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${edge.x2} ${edge.y2}`;
            const midX = (edge.x1 + edge.x2) / 2;
            const midY = (edge.y1 + edge.y2) / 2;

            return (
              <g key={`edge-${idx}`}>
                {/* Shadow / glow path if active */}
                {active && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="8"
                    strokeOpacity="0.25"
                    strokeLinecap="round"
                  />
                )}
                <path
                  d={pathD}
                  fill="none"
                  stroke={active ? '#38bdf8' : '#334155'}
                  strokeWidth={active ? '2.5' : '1.5'}
                  strokeDasharray={active ? 'none' : '4 3'}
                  markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow-inactive)'}
                />
                {/* Branch Label Badge */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-48"
                    y="-10"
                    width="96"
                    height="20"
                    rx="10"
                    fill={active ? '#0f172a' : '#1e293b'}
                    stroke={active ? '#38bdf8' : '#475569'}
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="ui-monospace, monospace"
                    fontWeight="700"
                    fill={active ? '#38bdf8' : '#94a3b8'}
                  >
                    {edge.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Node 1: Stage 0 Root */}
          <foreignObject x="20" y="220" width="180" height="80">
            <div
              onClick={() => onSelectNode('root')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'root'
                  ? 'bg-sky-500/25 border-sky-400 ring-2 ring-sky-500/40 shadow-lg'
                  : activePath.has('root')
                  ? 'bg-[rgb(var(--color-card))] border-sky-500/60 shadow-md'
                  : 'bg-[rgb(var(--color-card))] border-[rgb(var(--color-line))] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-sky-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>STAGE 0: INGEST</span>
              </div>
              <div className="text-xs font-bold text-[rgb(var(--color-text))] truncate">
                Telemetry Webhook
              </div>
              <div className="text-[9px] font-mono-code text-[rgb(var(--color-muted))] truncate">
                entity_id · amount · CBS
              </div>
            </div>
          </foreignObject>

          {/* Node 2: Gate 1 Terminal Invariant Check */}
          <foreignObject x="280" y="215" width="210" height="90">
            <div
              onClick={() => onSelectNode('gate_terminal')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'gate_terminal'
                  ? 'bg-rose-500/25 border-rose-400 ring-2 ring-rose-500/40 shadow-lg'
                  : activePath.has('gate_terminal')
                  ? 'bg-[rgb(var(--color-card))] border-rose-500/60 shadow-md'
                  : 'bg-[rgb(var(--color-card))] border-[rgb(var(--color-line))] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-rose-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>GATE 1: TERMINAL CHECK</span>
              </div>
              <div className="text-xs font-bold text-[rgb(var(--color-text))] truncate">
                Is Error Unrecoverable?
              </div>
              <div className="text-[9px] font-mono-code text-rose-400/80 truncate">
                CARD_EXPIRED · CLOSED · AUTH_REJ
              </div>
            </div>
          </foreignObject>

          {/* Node 3: Leaf 1 Zero-Touch Terminal Halt */}
          <foreignObject x="570" y="40" width="220" height="86">
            <div
              onClick={() => onSelectNode('leaf_terminal_halt')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_terminal_halt'
                  ? 'bg-rose-500/30 border-rose-400 ring-2 ring-rose-500/40 shadow-lg'
                  : activePath.has('leaf_terminal_halt')
                  ? 'bg-rose-500/15 border-rose-500/60 shadow-md'
                  : 'bg-rose-500/10 border-rose-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-rose-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>🛑 ZERO-TOUCH HALT</span>
              </div>
              <div className="text-xs font-bold text-rose-200 truncate">
                0 Customer Touches
              </div>
              <div className="text-[9px] font-mono-code text-rose-400 truncate">
                Direct SHA-256 Ledger Commit
              </div>
            </div>
          </foreignObject>

          {/* Node 4: Gate 2 CBS Health Status */}
          <foreignObject x="570" y="250" width="210" height="90">
            <div
              onClick={() => onSelectNode('gate_cbs')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'gate_cbs'
                  ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-500/40 shadow-lg'
                  : activePath.has('gate_cbs')
                  ? 'bg-[rgb(var(--color-card))] border-amber-500/60 shadow-md'
                  : 'bg-[rgb(var(--color-card))] border-[rgb(var(--color-line))] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-amber-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <Server className="w-3.5 h-3.5" />
                <span>GATE 2: CBS HEALTH</span>
              </div>
              <div className="text-xs font-bold text-[rgb(var(--color-text))] truncate">
                Is Bank Degraded?
              </div>
              <div className="text-[9px] font-mono-code text-amber-400/80 truncate">
                CBS Gateway Registry check
              </div>
            </div>
          </foreignObject>

          {/* Node 5: Leaf 2 CBS Pacing Deferral */}
          <foreignObject x="860" y="130" width="220" height="86">
            <div
              onClick={() => onSelectNode('leaf_cbs_pacing')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_cbs_pacing'
                  ? 'bg-amber-500/30 border-amber-400 ring-2 ring-amber-500/40 shadow-lg'
                  : activePath.has('leaf_cbs_pacing')
                  ? 'bg-amber-500/15 border-amber-500/60 shadow-md'
                  : 'bg-amber-500/10 border-amber-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>⏸️ CBS PACING DEFERRAL</span>
              </div>
              <div className="text-xs font-bold text-amber-200 truncate">
                Bank Mainframe Degraded
              </div>
              <div className="text-[9px] font-mono-code text-amber-400 truncate">
                Hold retries (+45m window)
              </div>
            </div>
          </foreignObject>

          {/* Node 6: Gate 3 TRAI Chrono-Gate */}
          <foreignObject x="860" y="310" width="210" height="90">
            <div
              onClick={() => onSelectNode('gate_trai')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'gate_trai'
                  ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg'
                  : activePath.has('gate_trai')
                  ? 'bg-[rgb(var(--color-card))] border-cyan-500/60 shadow-md'
                  : 'bg-[rgb(var(--color-card))] border-[rgb(var(--color-line))] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-cyan-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>GATE 3: TRAI & CHANNEL</span>
              </div>
              <div className="text-xs font-bold text-[rgb(var(--color-text))] truncate">
                Channel Nature & Time
              </div>
              <div className="text-[9px] font-mono-code text-cyan-400/80 truncate">
                M2M exempt · 08:00–19:00 IST
              </div>
            </div>
          </foreignObject>

          {/* Node 7: Leaf 3 Silent API Retry */}
          <foreignObject x="1150" y="170" width="210" height="80">
            <div
              onClick={() => onSelectNode('leaf_silent_retry')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_silent_retry'
                  ? 'bg-sky-500/30 border-sky-400 ring-2 ring-sky-500/40 shadow-lg'
                  : activePath.has('leaf_silent_retry')
                  ? 'bg-sky-500/15 border-sky-500/60 shadow-md'
                  : 'bg-sky-500/10 border-sky-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-sky-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>⚡ SILENT API RETRY</span>
              </div>
              <div className="text-xs font-bold text-sky-200 truncate">
                TRAI Chrono-Exempt
              </div>
              <div className="text-[9px] font-mono-code text-sky-400 truncate">
                Direct Machine-to-Machine
              </div>
            </div>
          </foreignObject>

          {/* Node 8: Leaf 4 TRAI Chrono-Deferral */}
          <foreignObject x="1150" y="270" width="210" height="80">
            <div
              onClick={() => onSelectNode('leaf_trai_defer')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_trai_defer'
                  ? 'bg-amber-500/30 border-amber-400 ring-2 ring-amber-500/40 shadow-lg'
                  : activePath.has('leaf_trai_defer')
                  ? 'bg-amber-500/15 border-amber-500/60 shadow-md'
                  : 'bg-amber-500/10 border-amber-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>🕒 TRAI CHRONO-DEFER</span>
              </div>
              <div className="text-xs font-bold text-amber-200 truncate">
                Night Hours (19:00–08:00)
              </div>
              <div className="text-[9px] font-mono-code text-amber-400 truncate">
                Deferred +12h (Never Dropped)
              </div>
            </div>
          </foreignObject>

          {/* Node 9: Gate 4 PTP & Mandate Attempt Ceiling */}
          <foreignObject x="1150" y="390" width="220" height="90">
            <div
              onClick={() => onSelectNode('gate_ptp_mandate')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'gate_ptp_mandate'
                  ? 'bg-violet-500/25 border-violet-400 ring-2 ring-violet-500/40 shadow-lg'
                  : activePath.has('gate_ptp_mandate')
                  ? 'bg-[rgb(var(--color-card))] border-violet-500/60 shadow-md'
                  : 'bg-[rgb(var(--color-card))] border-[rgb(var(--color-line))] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-violet-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>GATE 4: PTP & MANDATE CAP</span>
              </div>
              <div className="text-xs font-bold text-[rgb(var(--color-text))] truncate">
                Promise Active or ≥ 4 Debits?
              </div>
              <div className="text-[9px] font-mono-code text-violet-400/80 truncate">
                PTP freeze · NPCI 4-debit cap
              </div>
            </div>
          </foreignObject>

          {/* Node 10: Leaf 5 PTP Grace Freeze */}
          <foreignObject x="1450" y="290" width="210" height="80">
            <div
              onClick={() => onSelectNode('leaf_ptp_freeze')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_ptp_freeze'
                  ? 'bg-violet-500/30 border-violet-400 ring-2 ring-violet-500/40 shadow-lg'
                  : activePath.has('leaf_ptp_freeze')
                  ? 'bg-violet-500/15 border-violet-500/60 shadow-md'
                  : 'bg-violet-500/10 border-violet-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-violet-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>❄️ PTP GRACE FREEZE</span>
              </div>
              <div className="text-xs font-bold text-violet-200 truncate">
                Customer Promise Active
              </div>
              <div className="text-[9px] font-mono-code text-violet-400 truncate">
                Frozen until promised epoch
              </div>
            </div>
          </foreignObject>

          {/* Node 11: Leaf 6 NPCI Mandate Cap */}
          <foreignObject x="1450" y="390" width="210" height="80">
            <div
              onClick={() => onSelectNode('leaf_mandate_ceiling')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_mandate_ceiling'
                  ? 'bg-rose-500/30 border-rose-400 ring-2 ring-rose-500/40 shadow-lg'
                  : activePath.has('leaf_mandate_ceiling')
                  ? 'bg-rose-500/15 border-rose-500/60 shadow-md'
                  : 'bg-rose-500/10 border-rose-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-rose-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>🚫 NPCI MANDATE CAP</span>
              </div>
              <div className="text-xs font-bold text-rose-200 truncate">
                Attempt 4 Reached
              </div>
              <div className="text-[9px] font-mono-code text-rose-400 truncate">
                AutoPay Halted · Link Only
              </div>
            </div>
          </foreignObject>

          {/* Node 12: Gate 5 Mathematical MDP Net Yield Invariant */}
          <foreignObject x="1450" y="510" width="220" height="95">
            <div
              onClick={() => onSelectNode('gate_mdp')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'gate_mdp'
                  ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg'
                  : activePath.has('gate_mdp')
                  ? 'bg-[rgb(var(--color-card))] border-emerald-500/60 shadow-md'
                  : 'bg-[rgb(var(--color-card))] border-[rgb(var(--color-line))] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <Calculator className="w-3.5 h-3.5" />
                <span>GATE 5: MDP NET YIELD</span>
              </div>
              <div className="text-xs font-bold text-[rgb(var(--color-text))] truncate">
                E[R<sub>net</sub>] &gt; 0 Threshold?
              </div>
              <div className="text-[9px] font-mono-code text-emerald-400/80 truncate">
                E[R<sub>net</sub>] = P<sub>adj</sub>·V - C - L<sub>fatigue</sub>·V
              </div>
            </div>
          </foreignObject>

          {/* Node 13: Leaf 7 MDP Stopping Rule Halt */}
          <foreignObject x="1750" y="460" width="220" height="86">
            <div
              onClick={() => onSelectNode('leaf_mdp_halt')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_mdp_halt'
                  ? 'bg-rose-500/30 border-rose-400 ring-2 ring-rose-500/40 shadow-lg'
                  : activePath.has('leaf_mdp_halt')
                  ? 'bg-rose-500/15 border-rose-500/60 shadow-md'
                  : 'bg-rose-500/10 border-rose-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-rose-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>🛑 MDP STOPPING RULE</span>
              </div>
              <div className="text-xs font-bold text-rose-200 truncate">
                E[R<sub>net</sub>] ≤ 0
              </div>
              <div className="text-[9px] font-mono-code text-rose-400 truncate">
                Sequence halts at step k<sup>*</sup>
              </div>
            </div>
          </foreignObject>

          {/* Node 14: Leaf 8 Bounded Intervention Dispatch */}
          <foreignObject x="1750" y="575" width="220" height="86">
            <div
              onClick={() => onSelectNode('leaf_dispatch_menu')}
              className={`h-full p-3 rounded-2xl border-2 text-center cursor-pointer transition-all flex flex-col justify-center ${
                selectedNode === 'leaf_dispatch_menu'
                  ? 'bg-emerald-500/30 border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg'
                  : activePath.has('leaf_dispatch_menu')
                  ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md'
                  : 'bg-emerald-500/10 border-emerald-500/30 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-[10px] font-mono-code font-black text-emerald-300 uppercase tracking-wider flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>🎯 BOUNDED DISPATCH</span>
              </div>
              <div className="text-xs font-bold text-emerald-200 truncate">
                E[R<sub>net</sub>] &gt; 0 Net Positive
              </div>
              <div className="text-[9px] font-mono-code text-emerald-400 truncate">
                WhatsApp · Voice IVR · Account
              </div>
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>
  );
};
