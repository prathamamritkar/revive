import React from 'react';
import { Zap } from 'lucide-react';

interface FooterProps {
  enforceTrai?: boolean;
  backendConnected?: boolean;
}

export const Footer: React.FC<FooterProps> = () => {
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
          <span>Payment Recovery Engine</span>
          <span className="text-[rgb(var(--color-line))]">·</span>
          <span className="font-mono-code text-[11px]">© 2026</span>
        </div>

        {/* Right: Copyright */}
        <div className="text-[rgb(var(--color-muted))] font-mono-code text-[11px]">
          Revive Autonomous Recovery Engine
        </div>
      </div>
    </footer>
  );
};
