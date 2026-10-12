import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Award,
  TrendingUp,
  Clock,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileDown,
  Upload,
  RefreshCw,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Car,
  RotateCcw,
  PlusCircle,
  BarChart2,
  ArrowRight,
  Check,
  Eye,
  Activity,
  Layers,
  Printer,
  FileText,
  X,
} from "lucide-react";
import { DriverProfile, DrivingSessionData } from "../types/simulator";

const DEFAULT_PROFILES: DriverProfile[] = [
  {
    id: "DRV-101",
    name: "Alex Carter",
    licenseType: "Provisional License",
    badge: "Provisional Tier II",
    createdDate: "2025-01-15",
    totalSessions: 8,
    totalDistanceKm: 14.2,
    totalDriveTimeMinutes: 42.5,
    averageScore: 88.5,
    bestScore: 97,
    safetyTier: "Good",
  },
  {
    id: "DRV-102",
    name: "Jordan Lee",
    licenseType: "Student Permit",
    badge: "Cadet Trainee",
    createdDate: "2025-02-01",
    totalSessions: 5,
    totalDistanceKm: 7.8,
    totalDriveTimeMinutes: 26.0,
    averageScore: 68.0,
    bestScore: 78,
    safetyTier: "Needs Improvement",
  },
  {
    id: "DRV-103",
    name: "Taylor Reed",
    licenseType: "Class C Driver",
    badge: "Certified Driver",
    createdDate: "2024-11-20",
    totalSessions: 14,
    totalDistanceKm: 31.4,
    totalDriveTimeMinutes: 95.0,
    averageScore: 94.2,
    bestScore: 100,
    safetyTier: "Excellent",
  },
];

const INITIAL_SESSIONS: DrivingSessionData[] = [
  {
    sessionId: "SESS-20250210-0930",
    driverId: "DRV-101",
    scenarioName: "Standard City",
    startTime: "2025-02-10 09:30:12",
    endTime: "2025-02-10 09:35:45",
    durationSeconds: 333,
    averageSpeedKmh: 34.2,
    maximumSpeedKmh: 48.7,
    collisionCount: 0,
    overspeedEvents: 0,
    redLightViolations: 0,
    laneViolations: 0,
    hardBrakingEvents: 1,
    missedCheckpoints: 0,
    finalScore: 97,
    classification: "Excellent",
    feedbackNotes: [
      "Exemplary defensive control with zero collisions or signal violations.",
      "Smooth throttle modulation throughout urban corridors.",
      "Single minor hard brake before destination bay.",
    ],
  },
  {
    sessionId: "SESS-20250209-1415",
    driverId: "DRV-101",
    scenarioName: "Heavy Rain",
    startTime: "2025-02-09 14:15:22",
    endTime: "2025-02-09 14:21:05",
    durationSeconds: 343,
    averageSpeedKmh: 29.5,
    maximumSpeedKmh: 46.1,
    collisionCount: 0,
    overspeedEvents: 1,
    redLightViolations: 0,
    laneViolations: 1,
    hardBrakingEvents: 2,
    missedCheckpoints: 0,
    finalScore: 82,
    classification: "Good",
    feedbackNotes: [
      "Managed wet tire friction reduction with cautious cornering speeds.",
      "Exceeded the rain scenario speed limit briefly on the open straight.",
      "Two hard deceleration spikes on slick asphalt.",
    ],
  },
  {
    sessionId: "SESS-20250208-1100",
    driverId: "DRV-101",
    scenarioName: "Midnight City",
    startTime: "2025-02-08 11:00:41",
    endTime: "2025-02-08 11:06:12",
    durationSeconds: 331,
    averageSpeedKmh: 32.1,
    maximumSpeedKmh: 51.2,
    collisionCount: 0,
    overspeedEvents: 1,
    redLightViolations: 0,
    laneViolations: 0,
    hardBrakingEvents: 0,
    missedCheckpoints: 0,
    finalScore: 95,
    classification: "Excellent",
    feedbackNotes: [
      "Headlights enabled and effective illumination maintained.",
      "Smooth stop before intersection crosswalk.",
      "Minor speed limit alert on outbound boulevard.",
    ],
  },
  {
    sessionId: "SESS-20250205-1620",
    driverId: "DRV-102",
    scenarioName: "Standard City",
    startTime: "2025-02-05 16:20:10",
    endTime: "2025-02-05 16:25:30",
    durationSeconds: 320,
    averageSpeedKmh: 38.6,
    maximumSpeedKmh: 59.4,
    collisionCount: 1,
    overspeedEvents: 2,
    redLightViolations: 1,
    laneViolations: 1,
    hardBrakingEvents: 3,
    missedCheckpoints: 0,
    finalScore: 55,
    classification: "Unsafe Driving",
    feedbackNotes: [
      "Critical collision impact with intersection roadside barrier (-20 pts).",
      "Entered intersection during active Red signal phase (-15 pts).",
      "Frequent abrupt braking exceeding -6.5 m/s².",
    ],
  },
  {
    sessionId: "SESS-20250204-1015",
    driverId: "DRV-102",
    scenarioName: "Standard City",
    startTime: "2025-02-04 10:15:00",
    endTime: "2025-02-04 10:20:50",
    durationSeconds: 350,
    averageSpeedKmh: 31.0,
    maximumSpeedKmh: 49.0,
    collisionCount: 0,
    overspeedEvents: 1,
    redLightViolations: 0,
    laneViolations: 2,
    hardBrakingEvents: 1,
    missedCheckpoints: 0,
    finalScore: 78,
    classification: "Good",
    feedbackNotes: [
      "Significant improvement: zero collisions or red light violations.",
      "Sustained lane drift over center line on left curve.",
      "Braked comfortably for pedestrian crossing.",
    ],
  },
];

const displaySessionTime = (value: string) => {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};
export const DriverDashboard: React.FC<{
  onNavigateToSandbox?: () => void;
}> = ({ onNavigateToSandbox }) => {
  const [profiles, setProfiles] = useState<DriverProfile[]>(() => {
    const saved = localStorage.getItem("cds_driver_profiles");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        /* fallback */
      }
    }
    return DEFAULT_PROFILES;
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    return localStorage.getItem("cds_active_profile_id") || "DRV-101";
  });

  const [sessions, setSessions] = useState<DrivingSessionData[]>(() => {
    const saved = localStorage.getItem("cds_driving_sessions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        /* fallback */
      }
    }
    return INITIAL_SESSIONS;
  });

  const [selectedScenarioFilter, setSelectedScenarioFilter] =
    useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "score_high" | "score_low">(
    "newest",
  );
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null,
  );

  // Comparison State
  const [compareSessionA, setCompareSessionA] = useState<string>("");
  const [compareSessionB, setCompareSessionB] = useState<string>("");
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileTier, setNewProfileTier] =
    useState<DriverProfile["licenseType"]>("Student Permit");

  // Phase 7: Session report & Lab Evaluation Modal State
  const [selectedCertSession, setSelectedCertSession] =
    useState<DrivingSessionData | null>(null);
  const [showCertModal, setShowCertModal] = useState<boolean>(false);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem("cds_driver_profiles", JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem("cds_active_profile_id", activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    localStorage.setItem("cds_driving_sessions", JSON.stringify(sessions));
  }, [sessions]);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const driverSessions = sessions.filter(
    (s) => s.driverId === activeProfile.id,
  );

  const filteredSessions = driverSessions
    .filter((s) => {
      if (selectedScenarioFilter === "All") return true;
      return s.scenarioName
        .toLowerCase()
        .includes(selectedScenarioFilter.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === "newest")
        return (
          new Date(b.startTime.replace(" ", "T")).getTime() -
          new Date(a.startTime.replace(" ", "T")).getTime()
        );
      if (sortBy === "score_high") return b.finalScore - a.finalScore;
      return a.finalScore - b.finalScore;
    });

  // Analytics Computations
  const totalDrives = driverSessions.length;
  const avgScore =
    totalDrives > 0
      ? driverSessions.reduce((acc, s) => acc + s.finalScore, 0) / totalDrives
      : 0;
  const bestScore =
    totalDrives > 0 ? Math.max(...driverSessions.map((s) => s.finalScore)) : 0;
  const cleanDrives = driverSessions.filter(
    (s) => s.collisionCount === 0 && s.redLightViolations === 0,
  ).length;
  const cleanDrivePct =
    totalDrives > 0 ? Math.round((cleanDrives / totalDrives) * 100) : 0;
  const passRate =
    totalDrives > 0
      ? Math.round(
          (driverSessions.filter(
            (s) => s.finalScore >= 75 && s.routeCompleted !== false,
          ).length /
            totalDrives) *
            100,
        )
      : 0;

  // Violation Aggregates
  const totalCollisions = driverSessions.reduce(
    (acc, s) => acc + s.collisionCount,
    0,
  );
  const totalRedLights = driverSessions.reduce(
    (acc, s) => acc + s.redLightViolations,
    0,
  );
  const totalOverspeeds = driverSessions.reduce(
    (acc, s) => acc + s.overspeedEvents,
    0,
  );
  const totalLaneViolations = driverSessions.reduce(
    (acc, s) => acc + s.laneViolations,
    0,
  );
  const totalHardBrakes = driverSessions.reduce(
    (acc, s) => acc + s.hardBrakingEvents,
    0,
  );

  const mostFrequentInfraction = () => {
    const list = [
      { name: "Overspeeding Zones", count: totalOverspeeds },
      { name: "Hard Braking (< -6.5 m/s²)", count: totalHardBrakes },
      { name: "Lane Boundary Drifts", count: totalLaneViolations },
      { name: "Red Light Violations", count: totalRedLights },
      { name: "Obstacle / Vehicle Collisions", count: totalCollisions },
    ];
    list.sort((a, b) => b.count - a.count);
    return list[0].count > 0
      ? list[0]
      : { name: "Clean Record (No recurring infractions)", count: 0 };
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const newId = `DRV-${crypto.randomUUID()}`;
    const created: DriverProfile = {
      id: newId,
      name: newProfileName.trim(),
      licenseType: newProfileTier,
      badge:
        newProfileTier === "Class C Driver"
          ? "Certified Driver"
          : "Cadet Trainee",
      createdDate: new Date().toISOString().split("T")[0],
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDriveTimeMinutes: 0,
      averageScore: 100,
      bestScore: 100,
      safetyTier: "Excellent",
    };
    setProfiles((prev) => [...prev, created]);
    setActiveProfileId(newId);
    setNewProfileName("");
    setShowNewProfileModal(false);
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: activeProfile,
      sessions: driverSessions,
      analytics: {
        totalDrives,
        avgScore,
        bestScore,
        passRate,
        cleanDrivePct,
        violations: {
          collisions: totalCollisions,
          redLights: totalRedLights,
          overspeeds: totalOverspeeds,
          laneViolations: totalLaneViolations,
          hardBrakes: totalHardBrakes,
        },
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `driver_dossier_${activeProfile.name.toLowerCase().replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetSampleData = () => {
    setProfiles(DEFAULT_PROFILES);
    setSessions(INITIAL_SESSIONS);
    setActiveProfileId("DRV-101");
  };

  // Pairwise Comparison Calculation
  const sA = sessions.find((s) => s.sessionId === compareSessionA);
  const sB = sessions.find((s) => s.sessionId === compareSessionB);

  const getTierColor = (score: number) => {
    if (score >= 90)
      return "text-emerald-700 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 75) return "text-teal-700 bg-teal-500/10 border-teal-500/30";
    if (score >= 60)
      return "text-amber-700 bg-amber-500/10 border-amber-500/30";
    return "text-rose-700 bg-rose-500/10 border-rose-500/30";
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR: PROFILE SWITCHER & ACTIONS */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-indigo-700 flex items-center justify-center font-bold text-xl text-stone-900 shadow-lg shadow-teal-600/30 shrink-0">
            {activeProfile.name.charAt(0)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {activeProfile.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getTierColor(avgScore)}`}
              >
                {activeProfile.licenseType}
              </span>
              <span className="text-xs text-stone-500 font-mono">
                ID: {activeProfile.id}
              </span>
            </div>
            <p className="text-xs text-stone-600 flex items-center gap-2">
              <span>Registered: {activeProfile.createdDate}</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium">
                {activeProfile.badge}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons & Profile Picker */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-600 font-medium">
              Driver Roster:
            </label>
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-stone-800 font-semibold focus:outline-none focus:border-teal-500"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.licenseType})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowNewProfileModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold border border-stone-300 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-teal-700" />
            <span>New Profile</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-stone-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export Dossier (JSON)</span>
          </button>

          <button
            onClick={() => {
              const target = driverSessions[0];
              if (!target) return;
              setSelectedCertSession(target);
              setShowCertModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-stone-900 rounded-lg text-xs font-semibold shadow-sm transition-colors border border-emerald-400/40"
            disabled={driverSessions.length === 0}
            title="View latest session report"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Session report</span>
          </button>

          <button
            onClick={handleResetSampleData}
            title="Reset to default lab data"
            className="p-2 bg-stone-200 hover:bg-stone-300 text-stone-600 hover:text-stone-900 rounded-lg transition-colors border border-stone-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CAREER AGGREGATE STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Career Drives
            </span>
            <Car className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">
            {totalDrives}
          </div>
          <span className="text-[11px] text-stone-500">recorded sessions</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Average Score
            </span>
            <Award className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700">
            {avgScore.toFixed(1)}
          </div>
          <span className="text-[11px] text-stone-500">out of 100 points</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Personal Best
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {bestScore}
          </div>
          <span className="text-[11px] text-stone-500">
            highest score achieved
          </span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Pass Rate
            </span>
            <ShieldCheck className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700">
            {passRate}%
          </div>
          <span className="text-[11px] text-stone-500">benchmark ≥ 75 pts</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Clean Drive Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700">
            {cleanDrivePct}%
          </div>
          <span className="text-[11px] text-stone-500">
            zero collisions / signals
          </span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-600 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Logged Distance
            </span>
            <Compass className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700">
            {activeProfile.totalDistanceKm.toFixed(1)} km
          </div>
          <span className="text-[11px] text-stone-500">
            safe transit logged
          </span>
        </div>
      </div>

      {/* VIOLATION RISK PROFILE & DIAGNOSTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Lifetime Infraction Frequency Analysis
              </h3>
              <p className="text-xs text-stone-600">
                Total accumulated penalties across recorded driving sessions
              </p>
            </div>
            <span className="text-xs font-semibold text-stone-600">
              Total Violations:{" "}
              <strong className="text-stone-900">
                {totalCollisions +
                  totalRedLights +
                  totalOverspeeds +
                  totalLaneViolations +
                  totalHardBrakes}
              </strong>
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-700">
                  Collisions (-20 pts each)
                </span>
                <span className="font-mono font-bold text-rose-700">
                  {totalCollisions} events
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${Math.min(100, totalCollisions * 25)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-700">
                  Red-Light Signal Crossings (-15 pts each)
                </span>
                <span className="font-mono font-bold text-orange-700">
                  {totalRedLights} events
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${Math.min(100, totalRedLights * 30)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-700">
                  Wrong-Lane Center Drift (-10 pts each)
                </span>
                <span className="font-mono font-bold text-amber-700">
                  {totalLaneViolations} events
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${Math.min(100, totalLaneViolations * 20)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-700">
                  Speed Limit Zone Overages (-5 pts each)
                </span>
                <span className="font-mono font-bold text-yellow-400">
                  {totalOverspeeds} events
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${Math.min(100, totalOverspeeds * 20)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-700">
                  Hard Braking &lt; -6.5 m/s² (-3 pts each)
                </span>
                <span className="font-mono font-bold text-teal-700">
                  {totalHardBrakes} events
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full"
                  style={{ width: `${Math.min(100, totalHardBrakes * 15)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* COACHING DIAGNOSTIC CARD */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-700">
              <TrendingUp className="w-4 h-4" />
              <h3 className="text-sm font-bold text-stone-900">
                Academic Coaching Diagnosis
              </h3>
            </div>
            <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">
                Primary Risk Vector
              </span>
              <p className="text-xs font-semibold text-amber-700">
                {mostFrequentInfraction().name}
              </p>
              <p className="text-[11px] text-stone-600">
                {mostFrequentInfraction().count > 0
                  ? `Responsible for the highest point deductions across ${activeProfile.name}'s test history.`
                  : "Demonstrates stellar situational awareness with no recurring penalty trends."}
              </p>
            </div>
            <div className="text-xs text-stone-700 space-y-1.5 leading-relaxed">
              <p className="font-medium text-stone-800">
                Recommended Lab Action:
              </p>
              <p className="text-stone-600">
                {totalCollisions > 0
                  ? "Engage in City scenario at reduced speeds to refine steering clearances around parked vehicles."
                  : totalRedLights > 0
                    ? "Approach intersections with foot hovering over brake pedal as soon as yellow phase triggers."
                    : totalHardBrakes > 1
                      ? "Increase following distances and begin progressive braking earlier to protect passenger comfort."
                      : "Ready for certification assessment in dynamic Rain and Night low-visibility scenarios."}
              </p>
            </div>
          </div>

          {onNavigateToSandbox && (
            <button
              onClick={onNavigateToSandbox}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-stone-900 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Car className="w-4 h-4" />
              <span>Launch 3D Simulator Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* MULTI-SESSION PAIRWISE COMPARISON TOOL */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-teal-700" />
              Pairwise Multi-Session Comparison Tool (ResultsManager Engine)
            </h3>
            <p className="text-xs text-stone-600">
              Compare two distinct driving attempts to track progression and
              deltas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Session A (Baseline / Older Drive):
            </label>
            <select
              value={compareSessionA}
              onChange={(e) => setCompareSessionA(e.target.value)}
              className="w-full bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 font-medium focus:outline-none focus:border-teal-500"
            >
              <option value="">-- Select Session A --</option>
              {driverSessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  [{displaySessionTime(s.startTime)}] {s.scenarioName} — Score:{" "}
                  {s.finalScore}/100 ({s.classification})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Session B (Current / Evaluation Drive):
            </label>
            <select
              value={compareSessionB}
              onChange={(e) => setCompareSessionB(e.target.value)}
              className="w-full bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-800 font-medium focus:outline-none focus:border-teal-500"
            >
              <option value="">-- Select Session B --</option>
              {driverSessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  [{displaySessionTime(s.startTime)}] {s.scenarioName} — Score:{" "}
                  {s.finalScore}/100 ({s.classification})
                </option>
              ))}
            </select>
          </div>
        </div>

        {sA && sB && (
          <div className="mt-4 p-4 bg-stone-100 border border-stone-200 rounded-xl space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-600 block mb-1">
                  Score Delta
                </span>
                <span
                  className={`text-xl font-bold font-mono ${sB.finalScore >= sA.finalScore ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {sB.finalScore - sA.finalScore >= 0
                    ? `+${sB.finalScore - sA.finalScore}`
                    : sB.finalScore - sA.finalScore}{" "}
                  pts
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  {sA.finalScore} → {sB.finalScore}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-600 block mb-1">
                  Speed Delta
                </span>
                <span className="text-xl font-bold font-mono text-stone-900">
                  {(sB.averageSpeedKmh - sA.averageSpeedKmh).toFixed(1)} km/h
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  {sA.averageSpeedKmh.toFixed(1)} →{" "}
                  {sB.averageSpeedKmh.toFixed(1)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-600 block mb-1">
                  Collisions Delta
                </span>
                <span
                  className={`text-xl font-bold font-mono ${sB.collisionCount <= sA.collisionCount ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {sB.collisionCount - sA.collisionCount}
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  {sA.collisionCount} → {sB.collisionCount}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-600 block mb-1">
                  Hard Brakes Delta
                </span>
                <span
                  className={`text-xl font-bold font-mono ${sB.hardBrakingEvents <= sA.hardBrakingEvents ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {sB.hardBrakingEvents - sA.hardBrakingEvents}
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  {sA.hardBrakingEvents} → {sB.hardBrakingEvents}
                </span>
              </div>
            </div>

            <div className="p-3 bg-teal-50/20 border border-teal-900/40 rounded-lg text-xs flex items-center gap-2 text-teal-700">
              <Check className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                <strong>Analytical Verdict: </strong>
                {sB.finalScore > sA.finalScore + 5
                  ? `Clear performance progression (+${sB.finalScore - sA.finalScore} pts). Safer defensive habits demonstrated in ${sB.scenarioName}.`
                  : sB.finalScore < sA.finalScore - 5
                    ? `Performance dropped by ${Math.abs(sB.finalScore - sA.finalScore)} pts. Additional road practice recommended.`
                    : "Consistent driving technique across both evaluation runs."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SESSION HISTORY LOG */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              Driving Session Log &amp; Explainable Reports (
              {filteredSessions.length})
            </h3>
            <p className="text-xs text-stone-600">
              All authenticated drives preserved in persistent storage
            </p>
          </div>

          {/* Filters & Sorting */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-600">Scenario:</span>
              {(["All", "City", "Highway", "Rain", "Night"] as const).map(
                (sc) => (
                  <button
                    key={sc}
                    onClick={() => setSelectedScenarioFilter(sc)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      selectedScenarioFilter === sc
                        ? "bg-teal-600 text-stone-900"
                        : "bg-stone-100 text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {sc}
                  </button>
                ),
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-stone-100 border border-stone-200 rounded-md px-2.5 py-1 text-xs text-stone-700 font-medium focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="score_high">Highest Score</option>
              <option value="score_low">Lowest Score</option>
            </select>
          </div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-stone-500 border border-dashed border-stone-200 rounded-xl space-y-2">
            <Car className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">
              No sessions match the selected filter for {activeProfile.name}.
            </p>
            <p className="text-[11px] text-slate-600">
              Run a drive in the 3D sandbox or select a different scenario
              preset.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => {
              const isExpanded = expandedSessionId === session.sessionId;

              return (
                <div
                  key={session.sessionId}
                  className="bg-stone-100 border border-stone-200 hover:border-stone-300 rounded-xl p-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold font-mono text-sm border ${getTierColor(session.finalScore)}`}
                      >
                        <span>{session.finalScore}</span>
                        <span className="text-[9px] uppercase font-sans font-semibold tracking-tighter">
                          pts
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-stone-900">
                            {session.scenarioName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getTierColor(session.finalScore)}`}
                          >
                            {session.routeCompleted === false
                              ? "Incomplete route"
                              : session.classification}
                          </span>
                          <span className="text-[11px] font-mono text-stone-500 break-all">
                            {session.sessionId}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 flex items-center gap-3 flex-wrap">
                          <span>{displaySessionTime(session.startTime)}</span>
                          <span>•</span>
                          <span>
                            Duration: {Math.round(session.durationSeconds)}s
                          </span>
                          <span>•</span>
                          <span>
                            Avg Speed: {session.averageSpeedKmh.toFixed(1)} km/h
                          </span>
                          <span>•</span>
                          <span>
                            Top Speed: {session.maximumSpeedKmh.toFixed(1)} km/h
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span
                          className={`px-2 py-1 rounded text-[11px] ${session.collisionCount > 0 ? "bg-rose-50/60 text-rose-700 border border-rose-900/50" : "bg-white text-stone-500"}`}
                        >
                          Col: {session.collisionCount}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-[11px] ${session.redLightViolations > 0 ? "bg-orange-50/60 text-orange-700 border border-orange-900/50" : "bg-white text-stone-500"}`}
                        >
                          Red: {session.redLightViolations}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-[11px] ${session.hardBrakingEvents > 0 ? "bg-teal-50/60 text-teal-700 border border-teal-900/50" : "bg-white text-stone-500"}`}
                        >
                          HardBrk: {session.hardBrakingEvents}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedCertSession(session);
                          setShowCertModal(true);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-50/40 hover:bg-emerald-50/50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-800/60 transition-colors flex items-center gap-1"
                        title="View Official Session report for this drive"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Report</span>
                      </button>

                      <button
                        onClick={() =>
                          setExpandedSessionId(
                            isExpanded ? null : session.sessionId,
                          )
                        }
                        className="px-3 py-1.5 bg-white hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold border border-stone-200 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-700" />
                        <span>{isExpanded ? "Hide" : "Report"}</span>
                      </button>
                    </div>
                  </div>

                  {/* EXPANDABLE EXPLAINABLE REPORT CARD */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-stone-200 space-y-3">
                      <div className="p-3 bg-white/80 rounded-lg border border-stone-200 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">
                          Feedback Narrative
                        </span>
                        <ul className="text-xs text-stone-700 space-y-1 list-disc list-inside">
                          {session.feedbackNotes.map((note, idx) => (
                            <li key={idx}>{note}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 bg-white rounded-lg border border-stone-200/80">
                          <span className="text-[10px] uppercase text-stone-500 block">
                            Overspeeds
                          </span>
                          <span className="font-mono font-bold text-stone-900">
                            {session.overspeedEvents}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-stone-200/80">
                          <span className="text-[10px] uppercase text-stone-500 block">
                            Lane Violations
                          </span>
                          <span className="font-mono font-bold text-stone-900">
                            {session.laneViolations}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-stone-200/80">
                          <span className="text-[10px] uppercase text-stone-500 block">
                            Missed Checkpoints
                          </span>
                          <span className="font-mono font-bold text-stone-900">
                            {session.missedCheckpoints}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-stone-200/80">
                          <span className="text-[10px] uppercase text-stone-500 block">
                            Timestamp
                          </span>
                          <span className="font-mono text-[11px] text-stone-600">
                            {displaySessionTime(session.startTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW PROFILE MODAL */}
      {showNewProfileModal && (
        <div className="fixed inset-0 bg-stone-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-stone-900">
              Create Student Driver Profile
            </h3>
            <p className="text-xs text-stone-600">
              Register a new student into the laboratory roster for independent
              performance tracking.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Student Full Name:
                </label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="e.g. Morgan Vance"
                  className="w-full bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Starting License Level:
                </label>
                <select
                  value={newProfileTier}
                  onChange={(e) => setNewProfileTier(e.target.value as any)}
                  className="w-full bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-teal-500"
                >
                  <option value="Student Permit">
                    Student Permit (Trainee)
                  </option>
                  <option value="Provisional License">
                    Provisional License (Intermediate)
                  </option>
                  <option value="Class C Driver">
                    Class C Driver (Standard)
                  </option>
                  <option value="Professional Instructor">
                    Professional Instructor
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewProfileModal(false)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-stone-900 rounded-lg text-xs font-semibold transition-colors"
              >
                Create Profile
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ACADEMIC LABORATORY COMPETENCY CERTIFICATE MODAL (PHASE 7) */}
      {showCertModal && selectedCertSession && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Driving session assessment"
          className="assessment-overlay fixed inset-0 bg-stone-100/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
        >
          <div className="assessment-report bg-white border-2 border-teal-600/60 rounded-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-thin">
            {/* Certificate Header Banner */}
            <div className="text-center pb-5 border-b border-stone-200 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-700 text-[11px] font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PDL Drive &bull; Practice session report</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-stone-900 tracking-tight uppercase">
                Driving Session Assessment
              </h2>
              <p className="text-xs text-stone-600">
                Simulation results for learning and review. This report does not
                certify driving competency.
              </p>
            </div>

            {/* Candidate & Session Info Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-stone-100/70 rounded-xl border border-stone-200 text-xs">
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase block">
                  Candidate Name
                </span>
                <span className="font-bold text-stone-900">
                  {activeProfile.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase block">
                  Student ID / Tier
                </span>
                <span className="font-mono text-stone-800">
                  {activeProfile.id} &bull; {activeProfile.licenseType}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase block">
                  Scenario Completed
                </span>
                <span className="font-semibold text-teal-700">
                  {selectedCertSession.scenarioName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase block">
                  Session Timestamp
                </span>
                <span className="font-mono text-stone-700">
                  {displaySessionTime(selectedCertSession.startTime)}
                </span>
              </div>
            </div>

            {/* Grade Badge & Scoring Callout */}
            {(() => {
              const score = selectedCertSession.finalScore;
              const isPass =
                score >= 75 && selectedCertSession.routeCompleted !== false;
              const letter =
                score >= 95
                  ? "A+"
                  : score >= 90
                    ? "A"
                    : score >= 80
                      ? "B"
                      : score >= 75
                        ? "C+"
                        : score >= 70
                          ? "C"
                          : score >= 60
                            ? "D"
                            : "F";
              const gpa =
                score >= 95
                  ? "4.0"
                  : score >= 90
                    ? "3.8"
                    : score >= 80
                      ? "3.0"
                      : score >= 75
                        ? "2.5"
                        : score >= 70
                          ? "2.0"
                          : score >= 60
                            ? "1.0"
                            : "0.0";

              return (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950/90 via-slate-900 to-slate-950/90 border border-stone-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border-2 shadow-lg ${
                        isPass
                          ? "bg-emerald-50/60 border-emerald-500 text-emerald-700 shadow-emerald-950/50"
                          : "bg-rose-50/60 border-rose-500 text-rose-700 shadow-rose-950/50"
                      }`}
                    >
                      <span className="text-2xl leading-none">{letter}</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
                        {selectedCertSession.routeCompleted === false
                          ? "INCOMPLETE"
                          : isPass
                            ? "PASS"
                            : "RETRY"}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black font-mono text-stone-900">
                          {score}
                        </span>
                        <span className="text-xs text-stone-600 font-mono">
                          / 100 Base Score
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 font-medium">
                        Evaluation:{" "}
                        <span className="font-bold text-stone-900">
                          {selectedCertSession.classification}
                        </span>{" "}
                        &bull; GPA Equivalent:{" "}
                        <span className="font-mono text-teal-700">{gpa}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs space-y-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-stone-600">
                      Assessment method
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Automated simulation rubric</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4-Pillar Competency Rubric Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 block">
                Standardized 4-Pillar Competency Evaluation Matrix
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Pillar 1 */}
                <div className="p-3 bg-stone-100/60 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">
                      1. Vehicle Dynamics &amp; Pedal Control
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {Math.max(
                        15,
                        25 - selectedCertSession.hardBrakingEvents * 3,
                      )}{" "}
                      / 25
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Smoothness of throttle application, G-force regulation, and
                    deceleration damping (
                    {selectedCertSession.hardBrakingEvents} hard brake events).
                  </p>
                </div>

                {/* Pillar 2 */}
                <div className="p-3 bg-stone-100/60 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">
                      2. Regulatory &amp; Signal Adherence
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {Math.max(
                        0,
                        25 -
                          (selectedCertSession.redLightViolations * 15 +
                            selectedCertSession.overspeedEvents * 5),
                      )}{" "}
                      / 25
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Traffic light stop line adherence and zone speed limit
                    compliance ({selectedCertSession.redLightViolations} red
                    lights, {selectedCertSession.overspeedEvents} overspeeds).
                  </p>
                </div>

                {/* Pillar 3 */}
                <div className="p-3 bg-stone-100/60 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">
                      3. Roadway &amp; Lane Discipline
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {Math.max(
                        0,
                        25 -
                          (selectedCertSession.laneViolations * 10 +
                            selectedCertSession.missedCheckpoints * 5),
                      )}{" "}
                      / 25
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Maintenance of proper lane boundaries and sequential
                    checkpoint navigation ({selectedCertSession.laneViolations}{" "}
                    lane drifts).
                  </p>
                </div>

                {/* Pillar 4 */}
                <div className="p-3 bg-stone-100/60 rounded-xl border border-stone-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">
                      4. Hazard Avoidance &amp; Safety
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {Math.max(
                        0,
                        25 - selectedCertSession.collisionCount * 20,
                      )}{" "}
                      / 25
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Proactive collision avoidance with obstacles, AI traffic
                    cars, and crosswalk pedestrian hazards (
                    {selectedCertSession.collisionCount} collisions).
                  </p>
                </div>
              </div>
            </div>

            {/* Examiner Remarks Callout */}
            <div className="p-3.5 rounded-xl bg-stone-100/80 border-l-4 border-teal-500 border border-stone-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
                Session feedback
              </span>
              <p className="text-xs text-stone-700 leading-relaxed">
                {selectedCertSession.feedbackNotes[0] ||
                  (selectedCertSession.finalScore >= 75
                    ? "The score meets the simulation practice threshold. Review route completion and recorded events."
                    : "Review the recorded events and practice this route again.")}
              </p>
            </div>

            {/* Verification Barcode & Cryptographic Checksum */}
            <div className="p-3 bg-stone-100/50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 flex flex-wrap items-center justify-between gap-2 font-mono">
              <div>
                <span className="text-stone-500 block text-[9px] uppercase">
                  Report reference
                </span>
                <span>CERT-{selectedCertSession.sessionId}</span>
              </div>
              <div className="text-right">
                <span className="text-stone-500 block text-[9px] uppercase">
                  Session reference
                </span>
                <span className="text-teal-700 text-[10px]">
                  {`${selectedCertSession.sessionId}`}
                </span>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setShowCertModal(false)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Close report
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const certPayload = {
                      certificateId: `CERT-${selectedCertSession.sessionId}`,
                      institution: "Automotive Simulation & Safety Laboratory",
                      studentId: activeProfile.id,
                      studentName: activeProfile.name,
                      licenseTier: activeProfile.licenseType,
                      sessionDate: selectedCertSession.startTime,
                      scenario: selectedCertSession.scenarioName,
                      finalScore: selectedCertSession.finalScore,
                      letterGrade:
                        selectedCertSession.finalScore >= 90
                          ? "A"
                          : selectedCertSession.finalScore >= 75
                            ? "B"
                            : "C",
                      isPass:
                        selectedCertSession.finalScore >= 75 &&
                        selectedCertSession.routeCompleted !== false,
                      metrics: {
                        durationSec: selectedCertSession.durationSeconds,
                        avgSpeedKmh: selectedCertSession.averageSpeedKmh,
                        maxSpeedKmh: selectedCertSession.maximumSpeedKmh,
                        collisions: selectedCertSession.collisionCount,
                        redLights: selectedCertSession.redLightViolations,
                        overspeeds: selectedCertSession.overspeedEvents,
                        hardBrakes: selectedCertSession.hardBrakingEvents,
                      },
                      examinerRemarks: selectedCertSession.feedbackNotes,
                      sessionReference: `${selectedCertSession.sessionId}`,
                    };

                    const blob = new Blob(
                      [JSON.stringify(certPayload, null, 2)],
                      { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `session_report_${selectedCertSession.sessionId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-semibold border border-stone-300 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5 text-teal-700" />
                  <span>Download JSON</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-stone-900 rounded-xl text-xs font-semibold shadow-md shadow-teal-600/30 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
