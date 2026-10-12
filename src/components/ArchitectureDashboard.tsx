import React from 'react';
import { MASTER_PROJECT_PHASES, PENALTY_MATRIX, CLASSIFICATION_TIERS } from '../data/unityGuideData';
import { ArrowRight, CheckCircle2, Clock, GitBranch, Layers, ShieldAlert, Cpu } from 'lucide-react';

export const ArchitectureDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* 1. Core Workflow Pipeline */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 space-y-5 shadow-xl">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-teal-700" />
          <h2 className="text-lg font-bold text-stone-900">Core Simulation &amp; Assessment Workflow</h2>
        </div>
        <p className="text-xs text-stone-600">
          Academic telemetry and driver assessment pipeline guiding the incremental development across all 7 phases:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
          {[
            { step: '01', title: 'Driver Profile', sub: 'ID & Historical Record' },
            { step: '02', title: 'Scenario Select', sub: 'City / Highway / Rain / Night' },
            { step: '03', title: 'Telemetry Engine', sub: 'Physics, Steer, Throttle, G-Force' },
            { step: '04', title: 'Violation Sensors', sub: 'Speed, Signal, Lane, Impact' },
            { step: '05', title: 'Behavior Scoring', sub: '100 Base Penalty Deductions' },
            { step: '06', title: 'Explainable Report', sub: 'Tiers & Natural Language Advice' }
          ].map((item, idx) => (
            <div key={idx} className="relative p-3.5 bg-stone-100/70 border border-stone-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-mono font-bold text-teal-700">{item.step}</span>
              <h4 className="text-xs font-bold text-stone-900 truncate">{item.title}</h4>
              <p className="text-[10px] text-stone-600 leading-tight">{item.sub}</p>
              {idx < 5 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Development Roadmap: Phase 1 to Phase 7 */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-bold text-stone-900">Master Development Phases (1 through 7)</h2>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              A reference for building and validating the Unity implementation.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
            7 development phases · Reference roadmap
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MASTER_PROJECT_PHASES.map(phase => {
            const isCompleted = phase.status === 'Completed & Verified';
            const isPending = phase.status.includes('Pending Command');

            return (
              <div
                key={phase.phase}
                className={`p-5 rounded-xl border space-y-3.5 transition-all ${
                  isCompleted
                    ? 'bg-stone-100/80 border-emerald-900/60 shadow-lg shadow-emerald-950/20'
                    : isPending
                    ? 'bg-stone-100/90 border-teal-600/70 shadow-lg shadow-teal-950/30'
                    : 'bg-stone-100/40 border-stone-200/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-stone-600">PHASE {phase.phase}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                        : isPending
                        ? 'bg-teal-500/15 text-teal-700 border border-teal-500/40 animate-pulse'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    <span>{isCompleted ? 'Implemented' : isPending ? 'Ready to build' : 'Planned'}</span>
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-stone-900">{phase.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{phase.description}</p>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-stone-200/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">Managers &amp; Scripts:</span>
                  <div className="flex flex-wrap gap-1">
                    {phase.managers.map((m, i) => (
                      <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-white rounded border border-stone-200 text-teal-700">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Scoring & Penalty Rules Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <h3 className="text-base font-bold text-stone-900">Rule Violation &amp; Penalty Deductions</h3>
          </div>
          <p className="text-xs text-stone-600">
            Drivers begin every session with a base score of <strong>100 points</strong>. Violations trigger event-driven deductions:
          </p>

          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs border-collapse bg-stone-100/60">
              <thead>
                <tr className="border-b border-stone-200 text-stone-600 font-semibold bg-white/80">
                  <th className="py-2.5 px-3">Violation Type</th>
                  <th className="py-2.5 px-3">Deduction</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Sensor Trigger Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/60">
                {PENALTY_MATRIX.map((p, idx) => (
                  <tr key={idx} className="hover:bg-stone-200/30">
                    <td className="py-2 px-3 text-stone-900 font-medium">{p.violation}</td>
                    <td className="py-2 px-3 font-mono font-bold text-rose-700">{p.deduction} pts</td>
                    <td className="py-2 px-3 text-[11px] text-amber-700">{p.severity}</td>
                    <td className="py-2 px-3 text-[11px] font-sans text-stone-600">{p.trigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Driver Classification Scale */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-stone-900">Driver Performance Classification</h3>
          </div>
          <p className="text-xs text-stone-600">
            Final scores are categorized into 4 explainable performance tiers:
          </p>

          <div className="space-y-2.5">
            {CLASSIFICATION_TIERS.map(tier => (
              <div key={tier.tier} className="p-3 bg-stone-100/70 border border-stone-200/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${tier.badgeClass}`}>
                    {tier.tier}
                  </span>
                  <span className="text-xs font-mono font-bold text-stone-900">{tier.range} Score</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">{tier.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
