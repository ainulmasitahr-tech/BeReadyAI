/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { HowItWorksView } from './components/HowItWorksView.jsx';
import { TopBar } from './components/TopBar.jsx';
import { DefenseSimulator } from './components/DefenseSimulator.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator');
  const [sessionResetKey, setSessionResetKey] = useState(0);

  const handleNewSession = () => {
    setActiveTab('simulator');
    setSessionResetKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FC] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewSession={handleNewSession}
      />

      <main className="flex-1">
        {activeTab === 'simulator' && (
          <DefenseSimulator
            sessionResetKey={sessionResetKey}
            onNavigateTab={setActiveTab}
          />
        )}
        {activeTab === 'how-it-works' && (
          <HowItWorksView onStartPractice={() => setActiveTab('simulator')} />
        )}
      </main>

      <footer className="no-print border-t border-slate-200/80 bg-[#F7F8FC]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6D5DF6] to-[#5243E5] text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-sm font-bold text-slate-900">BeReady AI</span>
            <span className="text-slate-400">Present your work with confidence.</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className="cursor-pointer transition-colors hover:text-[#5B4DF0]"
            >
              Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('how-it-works')}
              className="cursor-pointer transition-colors hover:text-[#5B4DF0]"
            >
              How it works
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
