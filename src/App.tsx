import React, { useState } from 'react';
import { ThreeCanvas } from './components/ThreeCanvas';
import { UnityStepGuide } from './components/UnityStepGuide';
import { ScriptViewer } from './components/ScriptViewer';
import { HierarchyTree } from './components/HierarchyTree';
import { ChecklistView } from './components/ChecklistView';
import { DriverDashboard } from './components/DriverDashboard';
import { VehicleTelemetry } from './types/simulator';
import { ArchitectureDashboard } from './components/ArchitectureDashboard';
import { Gamepad2, BookOpen, Code2, FolderTree, CheckSquare, Layers, Gauge, Compass, Activity, Download, UserCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'roadmap' | 'sandbox' | 'dashboard' | 'guide' | 'scripts' | 'hierarchy' | 'checklist'>('roadmap');
  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({
    speedKmh: 0,
    engineRpm: 800,
    currentGear: 'P',
    steerAngle: 0,
    motorTorque: 0,
    brakeTorque: 0,
    isHandbraking: false,
    distanceTraveled: 0
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* TOP NAVIGATION BAR (Complies with 3-zone contract) */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/30">
              CDS
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              Car Driving Simulator
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'roadmap' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Architecture Blueprint</span>
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'sandbox' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>3D Sandbox</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'dashboard' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Driver Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'guide' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Step-by-Step Guide</span>
            </button>

            <button
              onClick={() => setActiveTab('scripts')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'scripts' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>C# Script Hub</span>
            </button>

            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'hierarchy' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Unity Hierarchy</span>
            </button>

            <button
              onClick={() => setActiveTab('checklist')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 ${
                activeTab === 'checklist' ? 'text-blue-400 border-b-2 border-blue-500 font-semibold' : ''
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Lab Checklist</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('scripts')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export C# Scripts</span>
              <span className="sm:hidden">Scripts</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary tab strip */}
        <div className="flex md:hidden overflow-x-auto px-4 py-2 border-t border-slate-900 gap-2 text-xs">
          {(['roadmap', 'sandbox', 'dashboard', 'guide', 'scripts', 'hierarchy', 'checklist'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md capitalize whitespace-nowrap ${
                activeTab === tab ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 bg-slate-900'
              }`}
            >
              {tab === 'roadmap' ? 'Blueprint' : tab === 'sandbox' ? '3D Sandbox' : tab === 'dashboard' ? 'Dashboard' : tab}
            </button>
          ))}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 0: ARCHITECTURE BLUEPRINT & ROADMAP */}
        {activeTab === 'roadmap' && (
          <ArchitectureDashboard />
        )}

        {/* TAB 1: 3D SIMULATOR SANDBOX */}
        {activeTab === 'sandbox' && (
          <div className="space-y-6">
            {/* Context & Lab Info Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Product Development Laboratory</span>
                  <span>·</span>
                  <span className="text-sky-400 font-semibold">Phase 1-6 Full System Verified</span>
                </div>
                <h1 className="text-lg font-bold text-white">Interactive 3D Driving Simulator</h1>
              </div>

              {/* Real-time telemetry indicators */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Gauge className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-slate-400">Speed:</span>
                  <span className="text-white font-bold">{telemetry.speedKmh} km/h</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-400">Gear:</span>
                  <span className="text-amber-300 font-bold">{telemetry.currentGear}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">Distance:</span>
                  <span className="text-emerald-300 font-bold">{telemetry.distanceTraveled} m</span>
                </div>
              </div>
            </div>

            {/* 3D WebGL Vehicle Canvas */}
            <ThreeCanvas
              onTelemetryUpdate={setTelemetry}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
            />

            {/* Quick Feature Verification Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Phase 1 &amp; 2 Core</span>
                <h3 className="text-xs font-semibold text-white">Physics &amp; Cameras</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  WheelColliders, Rigidbody, center of mass, and 3-mode camera rig.
                </p>
              </div>

              <div className="p-4 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Phase 3 &amp; 4 Engine</span>
                <h3 className="text-xs font-semibold text-white">Rules &amp; Scenarios</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Speed zones, stop lines, AI traffic, crosswalks, rain, night headlights.
                </p>
              </div>

              <div className="p-4 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Phase 5 Assessment</span>
                <h3 className="text-xs font-semibold text-white">10 Hz Telemetry &amp; AI</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  100 base score deduction rubric, 4 tiers, and explainable verbal feedback.
                </p>
              </div>

              <div className="p-4 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Phase 6 Dashboard</span>
                <h3 className="text-xs font-semibold text-white">Student Progress Storage</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Driver profile roster, persistent drive history, and pairwise attempt comparison.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1.5: DRIVER DASHBOARD & RESULTS PROGRESSION */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">Driver Performance Dashboard &amp; Progress Storage</h1>
              <p className="text-xs text-slate-400">
                Phase 6: Multi-student roster management, lifetime telemetry records, pairwise attempt comparisons, and JSON persistence.
              </p>
            </div>
            <DriverDashboard onNavigateToSandbox={() => setActiveTab('sandbox')} />
          </div>
        )}

        {/* TAB 2: STEP-BY-STEP LAB GUIDE */}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">Laboratory Step-by-Step Implementation Guide</h1>
              <p className="text-xs text-slate-400">
                Follow these exact steps sequentially in Unity to build the Phase 1 prototype from scratch.
              </p>
            </div>
            <UnityStepGuide />
          </div>
        )}

        {/* TAB 3: C# SCRIPT HUB */}
        {activeTab === 'scripts' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">Modular C# Script Architecture</h1>
              <p className="text-xs text-slate-400">
                Pristine, production-grade C# scripts separated by single-responsibility principles. Ready for Unity 2022.3 LTS and Unity 6.
              </p>
            </div>
            <ScriptViewer />
          </div>
        )}

        {/* TAB 4: UNITY HIERARCHY & INSPECTOR */}
        {activeTab === 'hierarchy' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">Unity Scene Hierarchy &amp; Component Inspector</h1>
              <p className="text-xs text-slate-400">
                Interactive reference showing exactly how GameObjects, WheelColliders, and Components are structured.
              </p>
            </div>
            <HierarchyTree />
          </div>
        )}

        {/* TAB 5: PHASE 1 LAB CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">Phase 1 Completion Criteria &amp; Lab Sign-Off</h1>
              <p className="text-xs text-slate-400">
                Verify each requirement to ensure 100% compliance before advancing to subsequent project phases.
              </p>
            </div>
            <ChecklistView />
          </div>
        )}
      </main>

      {/* QUIET LAB FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Car Driving Simulator Using Unity · Product Development Laboratory (Phase 1)</span>
          <span className="font-mono text-slate-400">C# Scripts · Rigidbody Physics · WheelColliders · HUD</span>
        </div>
      </footer>
    </div>
  );
}
