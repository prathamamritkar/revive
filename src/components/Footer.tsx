import React from 'react';
import {
  ShieldCheck,
  Zap,
  Lock,
  Clock,
} from 'lucide-react';

interface FooterProps {
  enforceTrai?: boolean;
  backendConnected?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  enforceTrai = true,
  backendConnected = false,
}) => {
  return (
    <footer className="border-t border-[rgb(var(--color-line))] bg-[rgb(var(--color-card))] mt-12 py-3.5 text-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Brand & Identification */}
        <div className="flex items-center gap-2 text-[rgb(var(--color-muted))] flex-wrap text-[11px]">
          <div className="w-5 h-5 rounded-md bg-sky-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <Zap className="w-3 h-3 fill-current" />
          </div>
          <span className="font-extrabold text-[rgb(var(--color-text))] tracking-tight">REVIVE</span>
          <span className="text-[rgb(var(--color-line))]">·</span>
          <span>Autonomous Revenue Recovery Engine</span>
          <span className="text-[rgb(var(--color-line))]">·</span>
          <span className="font-mono-code text-[11px]">© 2026</span>
        </div>

        {/* Right: Consolidated Enterprise Invariant Badges */}
        <div className="flex items-center flex-wrap gap-2 font-mono-code text-[11px]">
          <span
            title="TRAI TCCCPR 2018 Chrono-Gate active (08:00 to 19:00 IST)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[10px] font-bold ${
              enforceTrai
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            <Clock className="w-3 h-3" />
            TRAI 08:00–19:00 IST
          </span>

          <span
            title="Zero-float integer paise subunit calculations across all transactions"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border-[rgb(var(--color-line))] text-[10px] font-bold"
          >
            <Lock className="w-3 h-3 text-sky-400" />
            Integer-Paise Subunits
          </span>

          <span
            title="Every state transition sealed in immutable SHA-256 block chain"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold"
          >
            <ShieldCheck className="w-3 h-3" />
            SHA-256 Chain
          </span>

          <span
            title={backendConnected ? 'Connected to FastAPI backend' : 'Running standalone hybrid engine'}
            className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
              backendConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-500/10 text-[rgb(var(--color-muted))] border-[rgb(var(--color-line))]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            {backendConnected ? 'FASTAPI' : 'STANDALONE'}
          </span>
        </div>
      </div>
    </footer>
  );
};
