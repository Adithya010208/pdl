import React from 'react';
import { MASTER_PROJECT_PHASES, PENALTY_MATRIX, CLASSIFICATION_TIERS } from '../data/unityGuideData';
import { ArrowRight, CheckCircle2, Clock, GitBranch, Layers, ShieldAlert, Cpu } from 'lucide-react';

export const ArchitectureDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* 1. Core Workflow Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-5 shadow-xl">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">Core Simulation &amp; Assessment Workflow</h2>
        </div>
        <p className="text-xs text-slate-400">
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
            <div key={idx} className="relative p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-mono font-bold text-sky-400">{item.step}</span>
              <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
              <p className="text-[10px] text-slate-400 leading-tight">{item.sub}</p>
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Master Development Phases (1 through 7)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Incremental architecture governed by strict phase commands.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            All 7 Phases Implemented &amp; Verified · Complete Laboratory Suite
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
                    ? 'bg-slate-950/80 border-emerald-900/60 shadow-lg shadow-emerald-950/20'
                    : isPending
                    ? 'bg-slate-950/90 border-blue-600/70 shadow-lg shadow-blue-950/30'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-400">PHASE {phase.phase}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : isPending
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/40 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    <span>{isCompleted ? 'Completed' : isPending ? 'Ready for Command' : 'Planned'}</span>
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">{phase.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{phase.description}</p>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Managers &amp; Scripts:</span>
                  <div className="flex flex-wrap gap-1">
                    {phase.managers.map((m, i) => (
                      <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-sky-300">
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
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Rule Violation &amp; Penalty Deductions</h3>
          </div>
          <p className="text-xs text-slate-400">
            Drivers begin every session with a base score of <strong>100 points</strong>. Violations trigger event-driven deductions:
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse bg-slate-950/60">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/80">
                  <th className="py-2.5 px-3">Violation Type</th>
                  <th className="py-2.5 px-3">Deduction</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Sensor Trigger Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {PENALTY_MATRIX.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-white font-medium">{p.violation}</td>
                    <td className="py-2 px-3 font-mono font-bold text-rose-400">{p.deduction} pts</td>
                    <td className="py-2 px-3 text-[11px] text-amber-300">{p.severity}</td>
                    <td className="py-2 px-3 text-[11px] font-sans text-slate-400">{p.trigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Driver Classification Scale */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Driver Performance Classification</h3>
          </div>
          <p className="text-xs text-slate-400">
            Final scores are categorized into 4 explainable performance tiers:
          </p>

          <div className="space-y-2.5">
            {CLASSIFICATION_TIERS.map(tier => (
              <div key={tier.tier} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${tier.badgeClass}`}>
                    {tier.tier}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{tier.range} Score</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{tier.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
