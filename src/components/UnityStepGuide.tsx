import React, { useState } from 'react';
import { UNITY_STEPS } from '../data/unityGuideData';
import { CheckCircle2, ChevronRight, Copy, Check, AlertTriangle, Lightbulb, PlayCircle, FolderTree } from 'lucide-react';

interface UnityStepGuideProps {
  onOpenScript?: (scriptName: string) => void;
}

export const UnityStepGuide: React.FC<UnityStepGuideProps> = ({ onOpenScript }) => {
  const [activeStepNum, setActiveStepNum] = useState<number>(1);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const step = UNITY_STEPS.find(s => s.stepNumber === activeStepNum) || UNITY_STEPS[0];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Step Navigation Pill Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {UNITY_STEPS.map(s => {
            const isCurrent = s.stepNumber === activeStepNum;
            return (
              <button
                key={s.stepNumber}
                onClick={() => setActiveStepNum(s.stepNumber)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCurrent ? 'bg-white text-blue-600' : 'bg-slate-800 text-slate-400'
                }`}>
                  {s.stepNumber}
                </span>
                <span>{s.title.split(' ')[0]} {s.title.split(' ')[1]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Detail Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-8 shadow-xl">
        {/* Step Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                STEP {step.stepNumber} OF {UNITY_STEPS.length}
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{step.category}</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1.5">{step.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={activeStepNum <= 1}
              onClick={() => setActiveStepNum(prev => Math.max(1, prev - 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              Previous
            </button>
            <button
              disabled={activeStepNum >= UNITY_STEPS.length}
              onClick={() => setActiveStepNum(prev => Math.min(UNITY_STEPS.length, prev + 1))}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 1. What to Create & Where */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">What to create</span>
            <p className="text-sm font-medium text-slate-200">{step.whatToCreate}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Where to create it</span>
            <p className="text-sm font-mono text-sky-400">{step.whereToCreate}</p>
          </div>
        </div>

        {/* 2. Unity GameObjects Required */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <FolderTree className="w-4 h-4 text-sky-400" />
            <span>Unity GameObjects Required</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            {step.gameObjectsRequired.map((go, i) => (
              <div key={i} className="leading-relaxed hover:text-white transition-colors">
                {go}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Components to Add */}
        {step.componentsToAdd.length > 0 && (
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Components to add</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {step.componentsToAdd.map((c, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{c.component}</span>
                    <span className="text-[11px] font-mono text-slate-400">on {c.targetObject}</span>
                  </div>
                  <div className="text-[11px] font-mono text-amber-300/90 space-y-1 border-t border-slate-800/80 pt-2">
                    {Object.entries(c.settings).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-400">{k}:</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Inspector Configuration Table */}
        {step.inspectorConfiguration.length > 0 && (
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Inspector Configuration Details</span>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse bg-slate-950/60">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/80">
                    <th className="py-2.5 px-4">Field</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Value</th>
                    <th className="py-2.5 px-4">Notes / Significance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {step.inspectorConfiguration.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 text-white font-medium">{row.field}</td>
                      <td className="py-2.5 px-4 text-sky-400">{row.type}</td>
                      <td className="py-2.5 px-4 text-amber-300">{row.value}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-400">{row.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. How to Connect */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">How to Connect the Script / Components</span>
          <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
            {step.howToConnect.map((inst, i) => (
              <li key={i} className="leading-relaxed pl-1">{inst}</li>
            ))}
          </ol>
        </div>

        {/* 6. How to Test */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>How to Test It in Unity</span>
          </div>
          <div className="space-y-2 bg-emerald-950/20 border border-emerald-900/50 p-4 rounded-xl text-xs text-emerald-200">
            {step.howToTest.map((test, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{test}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Pro Tips */}
        {step.proTips && step.proTips.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">Lab Engineering Pro-Tip</span>
              <p className="leading-relaxed">{step.proTips[0]}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
