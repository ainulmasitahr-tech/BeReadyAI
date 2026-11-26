import { Plus, Sparkles } from 'lucide-react';
import React from 'react';

const NAV_ITEMS = [
  { id: 'simulator', label: 'Simulator' },
  { id: 'how-it-works', label: 'How it works' },
];

export function TopBar({ activeTab, onSelectTab, onNewSession }) {
  return (
    <header className="no-print border-b border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
        {/* Zone 1: Brand mark */}
        <button
          type="button"
          onClick={() => onSelectTab('simulator')}
          className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg py-0.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4DF0]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6D5DF6] to-[#5243E5] text-white shadow-sm shadow-[#5B4DF0]/25">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-bold tracking-tight text-slate-900">
            BeReady <span className="text-[#5B4DF0]">AI</span>
          </span>
        </button>

        {/* Zone 2: Clean system-only nav tabs */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-6 overflow-x-auto sm:gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative cursor-pointer border-b-2 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4DF0] ${
                  isActive
                    ? 'border-[#5B4DF0] font-semibold text-[#5B4DF0]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: "+ New session" CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewSession}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1A1646] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#272262] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B4DF0] focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New session</span>
          </button>
        </div>
      </div>
    </header>
  );
}
