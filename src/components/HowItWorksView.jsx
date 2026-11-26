import { ArrowRight, Cpu, FileSearch, Mic, ShieldAlert, Volume2 } from 'lucide-react';
import React from 'react';

const SYSTEM_PIPELINE = [
  {
    step: '01 · Ingest',
    title: 'Document & Visual Parsing',
    tool: 'unpdf · mammoth · Multimodal Vision',
    icon: FileSearch,
    iconBg: 'bg-[#EEF0FF] text-[#5B4DF0]',
    description:
      'Upload lecture slides or project proposals (.pdf, .docx, .txt, .md) alongside optional architecture diagrams or slide screenshots (.png, .jpg, .webp). Text is extracted server-side so questions stay grounded strictly in your material.',
  },
  {
    step: '02 · Probe',
    title: 'AI Examiner Question Brain',
    tool: 'Gemini 4 Hydrogen · JSON Schema',
    icon: Cpu,
    iconBg: 'bg-[#E0F7FA] text-[#0891B2]',
    description:
      'Generates defense questions tailored to your chosen examiner style (Supportive, Standard, or Rigorous panel) and focus area (Architecture, Tool Justification, or Edge Cases), complete with diagram-specific probes.',
  },
  {
    step: '03 · Defend',
    title: 'Bidirectional Voice Chamber',
    tool: 'Gemini 3.8 TTS · Web Speech · Gemini 3.5 Transcribe',
    icon: Mic,
    iconBg: 'bg-[#EFFBF5] text-[#0D9488]',
    description:
      'Hear questions read aloud by the AI examiner, answer using live microphone dictation or recorded audio clips, and monitor your pacing clock across Practice or Exam Pressure mode.',
  },
  {
    step: '04 · Improve',
    title: 'Rubric Scoring & Follow-Up',
    tool: '4-Axis Radar · WPM & Filler Coach',
    icon: Volume2,
    iconBg: 'bg-[#FFF9EE] text-[#C27803]',
    description:
      'Receives objective scores across Accuracy, Justification, Clarity, and Conciseness, tracks your WPM speaking rate and filler words, speaks an A+ model answer, and asks a follow-up probe.',
  },
];

export function HowItWorksView({ onStartPractice }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="hero-dot-grid rounded-2xl p-8 text-white sm:p-10">
        <span className="inline-flex items-center rounded bg-[#67E8B5] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#0B3B2B] uppercase">
          System Architecture
        </span>
        <h1 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">
          How BeReady AI runs your live oral defense session.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Every stage connects real speech capture, multimodal Gemini analysis, and structured
          rubric evaluation inside one interactive studio.
        </p>
      </div>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {SYSTEM_PIPELINE.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-indigo-950/5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">{item.step}</span>
                </div>
                <h2 className="mt-5 font-display text-base font-bold text-slate-900">
                  {item.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.description}</p>
              </div>
              <p className="mt-5 border-t border-slate-200/70 pt-3 font-mono text-[11px] font-medium text-[#5B4DF0]">
                {item.tool}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-indigo-950/5">
          <span className="text-[11px] font-bold tracking-[0.12em] text-[#5B4DF0] uppercase">
            Practice Mode
          </span>
          <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
            Guided Coaching &amp; Transcript Refinement
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Preview what the examiner listens for before answering, edit technical acronyms in your
            transcript, compare A+ spoken answers, and re-record anytime to track score improvements.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1A1646]/15 bg-[#1A1646] p-6 text-white shadow-sm">
          <div className="flex items-center gap-2 text-[#67E8B5]">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase">
              Exam Mode
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-lg font-bold text-white">
            Realistic Timed Defense Simulation
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Hides checklist hints, speaks examiner questions automatically, locks manual typing, and
            enforces a strict countdown timer that auto-submits your spoken defense when time expires.
          </p>
        </div>
      </section>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={onStartPractice}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#5B4DF0] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#5B4DF0]/25 transition-colors hover:bg-[#4B3DE0]"
        >
          <span>Open practice simulator</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
