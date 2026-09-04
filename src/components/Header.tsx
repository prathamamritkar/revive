import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  UserCheck,
  Clock,
  RotateCcw,
  Sun,
  Moon,
  Contrast,
  Zap,
  SlidersHorizontal,
  Check,
  X,
} from 'lucide-react';
import { ExecutionMode } from '../engine/types';
import { DashboardTheme } from '../types';

export interface NavTabItem {
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface HeaderProps {
  tabs: NavTabItem[];
  activeTab: number;
  setActiveTab: (index: number) => void;
  theme: DashboardTheme;
  setTheme: (t: DashboardTheme) => void;
  mode: ExecutionMode;
  onToggleMode: (m: ExecutionMode) => void;
  enforceTrai: boolean;
  onToggleTrai: (v: boolean) => void;
  onReset: () => void;
  backendConnected?: boolean;
  fastapiUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  mode,
  onToggleMode,
  enforceTrai,
  onToggleTrai,
  onReset,
  backendConnected,
  fastapiUrl,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const isAutonomous = mode === ExecutionMode.AGENTIC_AUTONOMOUS;

  return (
    <header className="border-b border-[rgb(var(--color-line))] bg-[rgb(var(--color-card))] sticky top-0 z-50 shadow-xs backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center h-16 gap-3">
          
          {/* Left: Clean Brand Identity (No clutter, no version tag, no badge) */}
          <div className="flex items-center justify-start shrink-0">
            <button
              onClick={() => setActiveTab(0)}
              className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
              title="Return to Overview"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-500 text-slate-950 flex items-center justify-center font-black shadow-xs group-hover:bg-sky-400 transition-colors shrink-0">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-tight text-base text-[rgb(var(--color-text))] leading-none">
                  REVIVE
                </span>
                <span className="text-[11px] text-[rgb(var(--color-muted))] font-medium tracking-wide mt-1 leading-none">
                  Revenue Recovery Engine
                </span>
              </div>
            </button>
          </div>

          {/* Center: Consolidated Page Navigation Navbar with Proper Padding & Centering */}
          <nav
            aria-label="Main Navigation"
            className="flex items-center justify-center overflow-x-auto py-1 scrollbar-none px-2"
          >
            <div className="flex items-center gap-1.5 bg-[rgb(var(--color-surface))] p-1.5 rounded-2xl border border-[rgb(var(--color-line))] shadow-xs">
              {tabs.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = activeTab === idx;
                return (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(idx)}
                    title={tab.label}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                        : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-card))]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="inline sm:hidden">{tab.shortLabel || tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right: Clean System Settings Trigger & Popover Menu */}
          <div className="flex items-center justify-end shrink-0 relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer select-none ${
                menuOpen
                  ? 'bg-sky-500/15 border-sky-500 text-sky-400 shadow-sm ring-2 ring-sky-500/20'
                  : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-line))] text-[rgb(var(--color-text))] hover:border-slate-500 hover:bg-[rgb(var(--color-card))]'
              }`}
              aria-expanded={menuOpen}
              aria-label="System Settings & Engine Controls"
              title={`Engine Settings (${isAutonomous ? 'Autonomous Mode' : 'Manual Mode'}, TRAI: ${enforceTrai ? 'On' : 'Off'}, Theme: ${theme})`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {/* Dynamic Status Indicator Dot */}
              <span
                className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[rgb(var(--color-card))] ${
                  isAutonomous ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </button>

            {/* Dropdown Popover Panel */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-[rgb(var(--color-card))] border border-[rgb(var(--color-line))] rounded-2xl shadow-2xl z-50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
                
                {/* Header inside Menu */}
                <div className="flex items-center justify-between pb-3 border-b border-[rgb(var(--color-line))]">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--color-text))]">
                      Engine Settings
                    </span>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-1 text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))] rounded-lg hover:bg-[rgb(var(--color-surface))] transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Gateway & Backend Service Status */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-line))] text-xs font-mono-code">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span className="text-[rgb(var(--color-muted))] text-[11px] font-medium">Gateway Service</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      backendConnected
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {backendConnected ? 'FASTAPI_CONNECTED' : 'STANDALONE_HYBRID'}
                  </span>
                </div>

                {/* Section 1: Execution Mode */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-[rgb(var(--color-muted))] tracking-wider block">
                    Execution Mode
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onToggleMode(ExecutionMode.AGENTIC_AUTONOMOUS)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isAutonomous
                          ? 'bg-sky-500/15 border-sky-500 text-sky-400 font-bold'
                          : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Autonomous</span>
                        </div>
                        {isAutonomous && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </div>
                      <span className="text-[10px] opacity-80 leading-tight">
                        MDP auto-evaluates & dispatches instant recovery.
                      </span>
                    </button>

                    <button
                      onClick={() => onToggleMode(ExecutionMode.MANUAL_POLICY_GATED)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        !isAutonomous
                          ? 'bg-amber-400/15 border-amber-500 text-amber-400 font-bold'
                          : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-line))] text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Manual Review</span>
                        </div>
                        {!isAutonomous && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <span className="text-[10px] opacity-80 leading-tight">
                        Operator signs off each intervention in review queue.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Section 2: TRAI Chrono-Gate */}
                <div className="space-y-2 pt-2 border-t border-[rgb(var(--color-line))]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-[rgb(var(--color-text))]">
                          TRAI Gate (08–19 IST)
                        </span>
                      </div>
                      <p className="text-[10px] text-[rgb(var(--color-muted))] mt-0.5">
                        Defers non-compliant out-of-hours messages by +12h.
                      </p>
                    </div>

                    <button
                      onClick={() => onToggleTrai(!enforceTrai)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enforceTrai ? 'bg-emerald-500' : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-line))]'
                      }`}
                      title={`Toggle TRAI compliance gate (${enforceTrai ? 'Enabled' : 'Disabled'})`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          enforceTrai ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Section 3: Appearance & Theme */}
                <div className="space-y-2 pt-2 border-t border-[rgb(var(--color-line))]">
                  <label className="text-[11px] font-bold uppercase text-[rgb(var(--color-muted))] tracking-wider block">
                    Workspace Theme
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-[rgb(var(--color-surface))] p-1 rounded-xl border border-[rgb(var(--color-line))]">
                    <button
                      onClick={() => setTheme('Dark')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        theme === 'Dark'
                          ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                          : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('Light')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        theme === 'Light'
                          ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                          : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('High-Contrast')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        theme === 'High-Contrast'
                          ? 'bg-emerald-400 text-slate-950 font-bold shadow-xs'
                          : 'text-[rgb(var(--color-muted))] hover:text-[rgb(var(--color-text))]'
                      }`}
                    >
                      <Contrast className="w-3.5 h-3.5" />
                      <span>High-C</span>
                    </button>
                  </div>
                </div>

                {/* Section 4: System Reset Action */}
                <div className="pt-2 border-t border-[rgb(var(--color-line))] flex items-center justify-between">
                  <div className="text-[10px] text-[rgb(var(--color-muted))]">
                    Restore default engine state
                  </div>
                  <button
                    onClick={() => {
                      onReset();
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                    title="Reset Ledger, PTPs, and Telemetry"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Engine</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
