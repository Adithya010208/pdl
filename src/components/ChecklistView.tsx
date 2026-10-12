import React, { useState, useEffect } from 'react';
import { PHASE_1_CHECKLIST, PHASE_2_CHECKLIST, PHASE_3_CHECKLIST, PHASE_4_CHECKLIST, PHASE_5_CHECKLIST, PHASE_6_CHECKLIST, PHASE_7_CHECKLIST } from '../data/unityGuideData';
import { CheckCircle2, Circle, Trophy, Award, FileText, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

export const ChecklistView: React.FC = () => {
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);

  const [checkedP1, setCheckedP1] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_1') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  const [checkedP2, setCheckedP2] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_2') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  const [checkedP3, setCheckedP3] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_3') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  const [checkedP4, setCheckedP4] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_4') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  const [checkedP5, setCheckedP5] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_5') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  const [checkedP6, setCheckedP6] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_6') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  const [checkedP7, setCheckedP7] = useState<Record<string, boolean>>(() => {
    try { const value = JSON.parse(localStorage.getItem('pdl_checklist_7') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
  });

  useEffect(() => {
    try {
      [checkedP1, checkedP2, checkedP3, checkedP4, checkedP5, checkedP6, checkedP7].forEach((checks, index) => localStorage.setItem(`pdl_checklist_${index + 1}`, JSON.stringify(checks)));
    } catch { /* Storage can be unavailable in private browsing. */ }
  }, [checkedP1, checkedP2, checkedP3, checkedP4, checkedP5, checkedP6, checkedP7]);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const currentList =
    activePhase === 1
      ? PHASE_1_CHECKLIST
      : activePhase === 2
      ? PHASE_2_CHECKLIST
      : activePhase === 3
      ? PHASE_3_CHECKLIST
      : activePhase === 4
      ? PHASE_4_CHECKLIST
      : activePhase === 5
      ? PHASE_5_CHECKLIST
      : activePhase === 6
      ? PHASE_6_CHECKLIST
      : PHASE_7_CHECKLIST;

  const currentChecked =
    activePhase === 1
      ? checkedP1
      : activePhase === 2
      ? checkedP2
      : activePhase === 3
      ? checkedP3
      : activePhase === 4
      ? checkedP4
      : activePhase === 5
      ? checkedP5
      : activePhase === 6
      ? checkedP6
      : checkedP7;

  const setCurrentChecked =
    activePhase === 1
      ? setCheckedP1
      : activePhase === 2
      ? setCheckedP2
      : activePhase === 3
      ? setCheckedP3
      : activePhase === 4
      ? setCheckedP4
      : activePhase === 5
      ? setCheckedP5
      : activePhase === 6
      ? setCheckedP6
      : setCheckedP7;


  const toggleCheck = (id: string) => {
    setCurrentChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      const allChecked = currentList.every(item => next[item.id]);
      if (allChecked && !prev[id]) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      return next;
    });
  };

  const completedCount = currentList.filter(item => currentChecked[item.id]).length;
  const isAllComplete = completedCount === currentList.length;

  const handleCopyReport = () => {
    const lines = [
      '# Product Development Laboratory: Car Driving Simulator Using Unity',
      `## Phase ${activePhase} Prototype Sign-Off Checklist\n`,
      ...currentList.map(item => `[${currentChecked[item.id] ? 'x' : ' '}] ${item.requirement}: ${item.label}`)
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Phase Selector Toggle */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-stone-200 rounded-xl w-fit">
        <button
          onClick={() => setActivePhase(1)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 1 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 1 (Physics &amp; Controls)
        </button>
        <button
          onClick={() => setActivePhase(2)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 2 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 2 (Environment &amp; Cameras)
        </button>
        <button
          onClick={() => setActivePhase(3)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 3 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 3 (Rules &amp; Violations)
        </button>
        <button
          onClick={() => setActivePhase(4)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 4 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 4 (Scenarios &amp; Environment)
        </button>
        <button
          onClick={() => setActivePhase(5)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 5 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 5 (Assessment &amp; Feedback)
        </button>
        <button
          onClick={() => setActivePhase(6)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 6 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 6 (Dashboard &amp; Storage)
        </button>
        <button
          onClick={() => setActivePhase(7)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 7 ? 'bg-teal-600 text-stone-900 shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Phase 7 (Audio &amp; Lab Reports)
        </button>
      </div>

      {/* Progress banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 flex flex-wrap items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-700" />
            <h2 className="text-xl font-bold text-stone-900">
              Phase {activePhase} Completion Verification
            </h2>
          </div>
          <p className="text-xs text-stone-600">
            {activePhase === 1
              ? 'Verification of foundational 3D vehicle physics, controls, FollowCamera, and speedometer.'
              : activePhase === 2
              ? 'Verification of road network, 4-way junction, signs, traffic signals, checkpoints, and multi-camera switcher.'
              : activePhase === 3
              ? 'Verification of speed zones, overspeed detection, red-light violations, collision impact, lane monitoring, and the 100-base score penalty engine.'
              : activePhase === 4
              ? 'Verification of City, Highway, Rain, and Night training scenarios, wet road tire friction reduction, AI traffic vehicles, and pedestrians.'
              : activePhase === 5
              ? 'Verification of continuous 10 Hz telemetry logger, hard braking & aggressive accel detection, 100-base score rubric, 4 driver tiers, and explainable natural language feedback generation.'
              : activePhase === 6
              ? 'Verification of DriverProfileManager roster architecture, SessionManager JSON history serialization, ResultsManager analytics aggregation, DriverDashboardUI post-drive view, and multi-session comparison.'
              : 'Verification of dynamic RPM engine pitch modulation, tire squeal audio, collision impact sounds, turn indicator clicks, cockpit steering animation, HDR brake light emission, and LabReportExporter academic certification.'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-emerald-700">{completedCount}</span>
            <span className="text-stone-500 font-mono text-sm"> / {currentList.length}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600">Requirements Met</span>
          </div>

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-2 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors"
          >
            {copiedSummary ? <Check className="w-4 h-4 text-emerald-700" /> : <FileText className="w-4 h-4 text-teal-700" />}
            <span>{copiedSummary ? 'Copied Markdown' : `Copy Phase ${activePhase} Report`}</span>
          </button>
        </div>
      </div>

      {/* Checklist items */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentList.map(item => {
            const isDone = !!currentChecked[item.id];
            return (
              <div
                key={item.id}
                role="checkbox" aria-checked={isDone} tabIndex={0} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggleCheck(item.id); } }} onClick={() => toggleCheck(item.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                  isDone
                    ? 'bg-stone-100/60 border-emerald-900/50 hover:border-emerald-800'
                    : 'bg-stone-100/30 border-stone-200/80 hover:border-stone-300'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 fill-emerald-400/20" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">{item.requirement}</span>
                  <p className={`text-xs leading-relaxed ${isDone ? 'text-stone-800' : 'text-stone-600'}`}>
                    {item.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion congratulations note */}
      {isAllComplete && (
        <div className="p-6 bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border border-emerald-800/40 rounded-2xl flex items-center gap-4 text-emerald-700 text-xs">
          <Trophy className="w-8 h-8 text-amber-700 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-stone-900 text-sm">
              Phase {activePhase} checklist complete
            </h4>
            <p className="text-stone-700">
              You have checked every requirement in this phase. Review your implementation and export the checklist for your records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
