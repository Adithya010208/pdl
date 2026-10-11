import React, { useState } from 'react';
import { PHASE_1_CHECKLIST, PHASE_2_CHECKLIST, PHASE_3_CHECKLIST, PHASE_4_CHECKLIST, PHASE_5_CHECKLIST, PHASE_6_CHECKLIST, PHASE_7_CHECKLIST } from '../data/unityGuideData';
import { CheckCircle2, Circle, Trophy, Award, FileText, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

export const ChecklistView: React.FC = () => {
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(7);

  const [checkedP1, setCheckedP1] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_1_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

  const [checkedP2, setCheckedP2] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_2_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

  const [checkedP3, setCheckedP3] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_3_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

  const [checkedP4, setCheckedP4] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_4_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

  const [checkedP5, setCheckedP5] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_5_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

  const [checkedP6, setCheckedP6] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_6_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

  const [checkedP7, setCheckedP7] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PHASE_7_CHECKLIST.forEach(i => (init[i.id] = true));
    return init;
  });

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
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActivePhase(1)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 1 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 1 (Physics &amp; Controls)
        </button>
        <button
          onClick={() => setActivePhase(2)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 2 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 2 (Environment &amp; Cameras)
        </button>
        <button
          onClick={() => setActivePhase(3)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 3 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 3 (Rules &amp; Violations)
        </button>
        <button
          onClick={() => setActivePhase(4)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 4 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 4 (Scenarios &amp; Environment)
        </button>
        <button
          onClick={() => setActivePhase(5)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 5 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 5 (Assessment &amp; Feedback)
        </button>
        <button
          onClick={() => setActivePhase(6)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 6 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 6 (Dashboard &amp; Storage)
        </button>
        <button
          onClick={() => setActivePhase(7)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activePhase === 7 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Phase 7 (Audio &amp; Lab Reports)
        </button>
      </div>

      {/* Progress banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-wrap items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">
              Phase {activePhase} Completion Verification
            </h2>
          </div>
          <p className="text-xs text-slate-400">
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
            <span className="text-2xl font-black font-mono text-emerald-400">{completedCount}</span>
            <span className="text-slate-500 font-mono text-sm"> / {currentList.length}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Requirements Met</span>
          </div>

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copiedSummary ? <Check className="w-4 h-4 text-emerald-400" /> : <FileText className="w-4 h-4 text-sky-400" />}
            <span>{copiedSummary ? 'Copied Markdown' : `Copy Phase ${activePhase} Report`}</span>
          </button>
        </div>
      </div>

      {/* Checklist items */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentList.map(item => {
            const isDone = !!currentChecked[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                  isDone
                    ? 'bg-slate-950/60 border-emerald-900/50 hover:border-emerald-800'
                    : 'bg-slate-950/30 border-slate-800/80 hover:border-slate-700 opacity-60'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.requirement}</span>
                  <p className={`text-xs leading-relaxed ${isDone ? 'text-slate-200' : 'text-slate-400 line-through'}`}>
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
        <div className="p-6 bg-gradient-to-r from-emerald-950/30 to-blue-950/30 border border-emerald-800/40 rounded-2xl flex items-center gap-4 text-emerald-200 text-xs">
          <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">
              Phase {activePhase} Objectives Fully Achieved!
            </h4>
            <p className="text-slate-300">
              {activePhase === 1
                ? 'All Phase 1 requirements (physics, controls, camera, HUD) verified.'
                : activePhase === 2
                ? 'All Phase 2 requirements (4-way intersection, crosswalks, traffic signals, speed signs, checkpoints, destination trigger, and 3-mode camera manager) are fully satisfied.'
                : activePhase === 3
                ? 'All Phase 3 requirements (SpeedLimitZone, overspeed detection, stop-line red light sensor, collision impact monitor, lane monitor, and central 100-point ViolationManager & HUD) are fully implemented.'
                : activePhase === 4
                ? 'All Phase 4 requirements (City, Highway, Rain, and Night scenarios, dynamic weather rain particles, 45% tire friction grip loss, vehicle headlights, AI traffic cars, and crosswalk pedestrians) are fully operational and verified!'
                : activePhase === 5
                ? 'All Phase 5 requirements (TelemetryManager 10 Hz recording, hard braking & aggressive acceleration sensors, 100 base score deduction engine, 4 driver classification tiers, explainable natural language feedback generation, strengths/infractions analysis, and AssessmentUI modal with CSV export) are fully implemented and verified!'
                : activePhase === 6
                ? 'All Phase 6 requirements (DriverProfileManager profile roster & career metrics, SessionManager JSON serialization & rolling cap history, ResultsManager statistical analytics & pairwise comparison, DriverDashboardUI post-drive view, and end-to-end sandbox session persistence) are fully implemented and verified!'
                : 'All Phase 7 requirements (VehicleAudio dynamic RPM engine sound & tire squeal, VehicleVisualEffects cockpit steering rotation & emissive brake lights, LabReportExporter academic certification with letter grades & SHA-256 digital hash, and comprehensive 7-phase full laboratory delivery) are fully verified and completed!'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
