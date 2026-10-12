import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleHelp,
  CloudRain,
  Compass,
  Download,
  Eye,
  Flag,
  Lightbulb,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  VehicleTelemetry,
  DrivingSessionData,
  DriverProfile,
} from "../types/simulator";
import { Gear, SCENARIOS } from "../simulator/model";
import { DrivingRuntime, Snapshot } from "../simulator/runtime";
import "./simulator.css";
import { DriveReview } from "./DriveReview";
interface Props {
  onTelemetryUpdate?: (telemetry: VehicleTelemetry) => void;
  onNavigateToDashboard?: () => void;
  onRequestOpenCode?: (id: string) => void;
}
interface Report {
  record: DrivingSessionData;
  distance: number;
  completed: boolean;
  samples: ReturnType<DrivingRuntime["getData"]>["session"]["samples"];
  events: ReturnType<DrivingRuntime["getData"]>["session"]["events"];
  saveError: boolean;
}
const defaultProfile: DriverProfile = {
  id: "DRV-101",
  name: "Practice driver",
  licenseType: "Student Permit",
  badge: "Learner",
  createdDate: new Date().toISOString().slice(0, 10),
  totalSessions: 0,
  totalDistanceKm: 0,
  totalDriveTimeMinutes: 0,
  averageScore: 0,
  bestScore: 0,
  safetyTier: "Needs Improvement",
};
function readProfiles(): DriverProfile[] {
  try {
    const data = JSON.parse(
      localStorage.getItem("cds_driver_profiles") || "null",
    );
    if (
      Array.isArray(data) &&
      data.length &&
      data.every(
        (p) => p && typeof p.id === "string" && typeof p.name === "string",
      )
    )
      return data;
  } catch {}
  return [defaultProfile];
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function clock(time: number) {
  const seconds = Math.floor(time);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
const INITIAL: Snapshot = {
  mode: "ready",
  scenario: "city",
  camera: "chase",
  speed: 0,
  rpm: 850,
  gear: "D",
  steer: 0,
  distance: 0,
  elapsed: 0,
  score: 100,
  checkpoint: 0,
  targetDistance: 40,
  x: 3.4,
  z: 0,
  heading: 0,
  signal: "green",
  headlights: false,
  audio: false,
  indicator: null,
  alert: null,
  onRoad: true,
  fps: 60,
  quality: "balanced",
  mirror: true,
  wipers: false,
  cruise: null,
  proximity: { front: Infinity, rear: Infinity, left: false, right: false },
  gamepad: false,
};
function RouteMap({ state }: { state: Snapshot }) {
  const highway = state.scenario === "highway";
  const config = SCENARIOS[state.scenario];
  const project = (x: number, z: number) =>
    highway
      ? { x: 80 + x * 3, y: 145 - z * 0.17 }
      : { x: 45 + x * 0.65, y: 145 - z * 0.92 };
  const points = [config.start, ...config.checkpoints, config.destination];
  const current = project(state.x, state.z);
  const target = config.checkpoints[state.checkpoint] ?? config.destination;
  return (
    <div className="drive-map">
      <div>
        <Compass size={12} />
        <span>ROUTE</span>
        <span>N ↑</span>
      </div>
      <svg
        viewBox="0 0 160 165"
        role="img"
        aria-label="Route map with vehicle position, checkpoints and destination"
      >
        <path
          d={
            highway ? "M 62 162 V 3 M 97 162 V 3" : "M 45 162 V 3 M 8 53 H 155"
          }
          stroke="#62756a"
          strokeWidth={highway ? 12 : 13}
          fill="none"
        />
        <polyline
          points={points
            .map((p) => {
              const xy = project(p.x, p.z);
              return `${xy.x},${xy.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#d5db9a"
          strokeWidth="2.5"
          strokeDasharray="4 4"
        />
        {config.checkpoints.map((cp, i) => {
          const xy = project(cp.x, cp.z);
          return (
            <circle
              key={i}
              cx={xy.x}
              cy={xy.y}
              r="3"
              fill={i < state.checkpoint ? "#779384" : "#d5db9a"}
            />
          );
        })}
        <circle
          cx={project(target.x, target.z).x}
          cy={project(target.x, target.z).y}
          r="5"
          fill="none"
          stroke="#d5db9a"
        />
        <path
          d="M 0 -6 L -4 5 L 0 3 L 4 5 Z"
          transform={`translate(${Math.max(5, Math.min(155, current.x))},${Math.max(5, Math.min(159, current.y))}) rotate(${(state.heading * 180) / Math.PI})`}
          fill="#fff"
        />
      </svg>
    </div>
  );
}
export const ThreeCanvas: React.FC<Props> = ({
  onTelemetryUpdate,
  onNavigateToDashboard,
}) => {
  const mountRef = useRef<HTMLDivElement>(null),
    panelRef = useRef<HTMLDivElement>(null),
    runtimeRef = useRef<DrivingRuntime | null>(null);
  const callbackRef = useRef(onTelemetryUpdate);
  callbackRef.current = onTelemetryUpdate;
  const [state, setState] = useState<Snapshot>(INITIAL),
    [error, setError] = useState<string | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [help, setHelp] = useState(false),
    [full, setFull] = useState(false),
    [touch, setTouch] = useState(false),
    [gearMessage, setGearMessage] = useState("");
  const [profiles] = useState(readProfiles);
  const [driverId, setDriverId] = useState(() => {
    try {
      const id = localStorage.getItem("cds_active_profile_id");
      return profiles.some((p) => p.id === id) ? id! : profiles[0].id;
    } catch {
      return profiles[0].id;
    }
  });
  const driverRef = useRef(driverId);
  driverRef.current = driverId;
  const helpRef = useRef(help);
  helpRef.current = help;
  const finalizeRef = useRef<() => void>(() => {});
  finalizeRef.current = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { session, vehicle, config } = runtime.getData();
    const count = (kind: string) =>
      session.events.filter((e) => e.kind === kind).length;
    const classification =
      session.score >= 90
        ? "Excellent"
        : session.score >= 75
          ? "Good"
          : session.score >= 60
            ? "Needs Improvement"
            : "Unsafe Driving";
    const summary = session.completed
      ? "Route completed and vehicle stopped in the parking bay."
      : "Practice ended before completing the route.";
    const notes = [
      summary,
      session.events.length
        ? `${session.events.length} scored events. Review the event log and try the route again.`
        : "No scored rule violations recorded during this attempt.",
      ...(count("overspeed")
        ? [
            "Reduce speed before intersections and keep within the posted limit.",
          ]
        : []),
      ...(count("collision")
        ? [
            "Leave more clearance around traffic, pedestrians, and roadside objects.",
          ]
        : []),
      ...(count("redLight")
        ? ["Stop before the line and wait for the green signal."]
        : []),
    ];
    const record: DrivingSessionData = {
      sessionId: `SESS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      driverId: driverRef.current,
      scenarioName: config.name,
      startTime: session.startTime,
      endTime: new Date().toISOString(),
      durationSeconds: Number(session.elapsed.toFixed(1)),
      averageSpeedKmh: session.samples.length
        ? Number(
            (
              session.samples.reduce((sum, s) => sum + s.speedKmh, 0) /
              session.samples.length
            ).toFixed(1),
          )
        : 0,
      maximumSpeedKmh: Number(session.maxSpeed.toFixed(1)),
      collisionCount: count("collision"),
      overspeedEvents: count("overspeed"),
      redLightViolations: count("redLight"),
      laneViolations: count("wrongLane"),
      hardBrakingEvents: count("hardBrake"),
      missedCheckpoints: config.checkpoints.length - session.checkpoint,
      finalScore: session.score,
      classification,
      feedbackNotes: notes,
      distanceMeters: Number(vehicle.distance.toFixed(1)),
      routeCompleted: session.completed,
    };
    let saveError = false;
    try {
      const stored = JSON.parse(
        localStorage.getItem("cds_driving_sessions") || "[]",
      );
      const sessions = Array.isArray(stored) ? stored : [];
      localStorage.setItem(
        "cds_driving_sessions",
        JSON.stringify([record, ...sessions].slice(0, 50)),
      );
      localStorage.setItem("cds_active_profile_id", driverRef.current);
      const all = readProfiles();
      const match = all.find((p) => p.id === driverRef.current);
      if (match) {
        match.totalSessions = (Number(match.totalSessions) || 0) + 1;
        match.totalDistanceKm =
          (Number(match.totalDistanceKm) || 0) + vehicle.distance / 1000;
        match.totalDriveTimeMinutes =
          (Number(match.totalDriveTimeMinutes) || 0) + session.elapsed / 60;
        match.averageScore = Math.round(
          ((Number(match.averageScore) || 0) * (match.totalSessions - 1) +
            record.finalScore) /
            match.totalSessions,
        );
        match.bestScore = Math.max(
          Number(match.bestScore) || 0,
          record.finalScore,
        );
        match.safetyTier = classification;
      }
      localStorage.setItem("cds_driver_profiles", JSON.stringify(all));
    } catch {
      saveError = true;
    }
    setReport({
      record,
      distance: vehicle.distance,
      completed: session.completed,
      samples: [...session.samples],
      events: [...session.events],
      saveError,
    });
  };
  useEffect(() => {
    if (!mountRef.current) return;
    let runtime: DrivingRuntime;
    const held = new Set<string>();
    try {
      runtime = new DrivingRuntime(
        mountRef.current,
        (s) => {
          if (s.mode !== "driving") held.clear();
          setState(s);
          callbackRef.current?.({
            speedKmh: Math.round(s.speed),
            engineRpm: Math.round(s.rpm),
            currentGear: s.gear,
            steerAngle: Math.round(s.steer),
            distanceTraveled: Math.round(s.distance),
            motorTorque: 0,
            brakeTorque: 0,
            isHandbraking: false,
          });
        },
        () => finalizeRef.current(),
        setError,
      );
      runtimeRef.current = runtime;
    } catch {
      setError(
        "The 3D environment could not start. Check that WebGL hardware acceleration is available in your browser.",
      );
      return;
    }
    setTouch(matchMedia("(pointer: coarse)").matches);
    if (matchMedia("(pointer: coarse)").matches)
      runtime.setQuality("performance");
    const sync = () =>
      runtime.setInput({
        throttle: held.has("w") || held.has("ArrowUp") ? 1 : 0,
        brake: held.has("s") || held.has("ArrowDown") ? 0.65 : 0,
        steer:
          (held.has("a") || held.has("ArrowLeft") ? -1 : 0) +
          (held.has("d") || held.has("ArrowRight") ? 1 : 0),
        handbrake: held.has(" "),
      });
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,select,textarea,[contenteditable=true]",
        )
      )
        return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
          key,
        ) &&
        runtime.getMode() === "driving"
      )
        e.preventDefault();
      if (
        (e.target as HTMLElement)?.closest("button, a") &&
        (key === " " || key === "Enter")
      )
        return;
      if (key === "Escape") {
        if (helpRef.current) {
          setHelp(false);
          return;
        }
        if (runtime.getMode() === "driving") runtime.pause();
        else if (runtime.getMode() === "paused") runtime.resume();
        held.clear();
        return;
      }
      if (runtime.getMode() !== "driving") return;
      if (
        [
          "w",
          "s",
          "a",
          "d",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          " ",
        ].includes(key)
      ) {
        held.add(key);
        sync();
      }
      if (e.repeat) return;
      if (key === "c") runtime.cycleCamera();
      if (key === "h") runtime.toggleLights();
      if (key === "m") runtime.toggleAudio();
      if (key === "q") runtime.toggleIndicator("left");
      if (key === "e") runtime.toggleIndicator("right");
      if (key === "b") runtime.horn();
      if (key === "v") runtime.toggleWipers();
      if (key === "k") runtime.toggleCruise();
      if (key === "r") {
        if (!runtime.setGear(runtime.getSnapshot().gear === "R" ? "D" : "R"))
          setGearMessage("Stop the vehicle before changing gear.");
      }
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      sync();
    };
    const blur = () => {
      held.clear();
      runtime.clearInput();
      runtime.pause();
    };
    const fullChange = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("fullscreenchange", fullChange);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("fullscreenchange", fullChange);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!gearMessage) return;
    const timer = setTimeout(() => setGearMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [gearMessage]);
  useEffect(() => {
    if (!help && !report && state.mode !== "paused") return;
    const dialog = panelRef.current?.querySelector<HTMLElement>(
      '.drive-dialog[role="dialog"]',
    );
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.tabIndex = -1;
    dialog.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select, a[href], [tabindex="0"]',
        ),
      );
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [help, report, state.mode]);
  const runtime = () => runtimeRef.current;
  const config = SCENARIOS[state.scenario];
  const target = config.checkpoints[state.checkpoint];
  const changeGear = (gear: Gear) => {
    if (!runtime()?.setGear(gear))
      setGearMessage("Stop the vehicle before changing gear.");
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await panelRef.current?.requestFullscreen();
    } catch {
      setGearMessage("Fullscreen is unavailable in this browser.");
    }
  };
  const start = () => {
    setReport(null);
    runtime()?.start();
  };
  const togglePause = () => {
    if (state.mode === "driving") runtime()?.pause();
    else runtime()?.resume();
  };
  const hold =
    (
      field: "throttle" | "brake" | "steer" | "handbrake",
      value: number | boolean,
    ) =>
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      runtime()?.setInput({ [field]: value });
    };
  const release = (field: "throttle" | "brake" | "steer" | "handbrake") => () =>
    runtime()?.setInput({ [field]: field === "handbrake" ? false : 0 });
  const touchButton = (
    label: string,
    field: "throttle" | "brake" | "steer" | "handbrake",
    value: number | boolean,
    child: React.ReactNode,
  ) => (
    <button
      aria-label={label}
      onPointerDown={hold(field, value)}
      onPointerUp={release(field)}
      onPointerCancel={release(field)}
      onLostPointerCapture={release(field)}
    >
      {child}
    </button>
  );
  const csv = () => {
    if (!report || !report.samples.length) return;
    const fields = Object.keys(report.samples[0]);
    download(
      `pdl-telemetry-${report.record.sessionId}.csv`,
      [
        fields.join(","),
        ...report.samples.map((s) =>
          fields.map((f) => s[f as keyof typeof s]).join(","),
        ),
      ].join("\n"),
      "text/csv;charset=utf-8",
    );
  };
  return (
    <section className="driving-product" aria-label="Driving simulator">
      <div className="drive-workbar">
        <div>
          <span className="drive-live-dot" />
          <strong>{config.name}</strong>
          <span className="drive-workbar-divider" />
          <span>
            {state.mode === "ready"
              ? "Ready to practice"
              : state.mode === "finished"
                ? "Session finished"
                : state.mode === "paused"
                  ? "Paused"
                  : "Session in progress"}
          </span>
        </div>
        <div>
          <button
            onClick={() => {
              runtime()?.pause();
              setHelp(true);
            }}
          >
            <CircleHelp size={15} /> Controls
          </button>
          <button
            onClick={() =>
              runtime()?.setQuality(
                state.quality === "balanced" ? "performance" : "balanced",
              )
            }
            aria-label="Switch graphics quality"
          >
            {state.quality === "balanced" ? "Balanced" : "Performance"}
          </button>
          <button
            onClick={() => runtime()?.toggleMirror()}
            aria-pressed={state.mirror}
            aria-label="Toggle rear-view mirror"
          >
            Mirror {state.mirror ? "on" : "off"}
          </button>
          <button onClick={() => setTouch(!touch)} aria-pressed={touch}>
            Touch {touch ? "on" : "off"}
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label={full ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <div className="drive-stage" ref={panelRef}>
        <div className="drive-renderer" ref={mountRef} />
        {state.mirror &&
          (state.mode === "driving" || state.mode === "paused") && (
            <div
              className="drive-mirror"
              role="img"
              aria-label="Live rear-view mirror"
            >
              <span>REAR VIEW</span>
            </div>
          )}
        {error ? (
          <div className="drive-screen">
            <div className="drive-dialog">
              <h2>3D environment unavailable</h2>
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>
                Reload simulator
              </button>
            </div>
          </div>
        ) : (
          <>
            {state.mode !== "ready" && state.mode !== "finished" && (
              <div
                className="drive-hud"
                inert={state.mode === "paused" || help}
              >
                <div className="drive-top-hud">
                  <div className="route-instruction">
                    <span className="route-icon">
                      {state.checkpoint === 2 &&
                      state.scenario !== "highway" ? (
                        <ArrowRight size={24} />
                      ) : state.checkpoint === 4 ? (
                        <Flag size={22} />
                      ) : (
                        <ArrowUp size={24} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {target?.label ?? "Stop in the parking bay"}
                      </strong>
                      <span>
                        {Math.round(state.targetDistance)} m ·{" "}
                        {state.checkpoint}/{config.checkpoints.length}{" "}
                        checkpoints
                      </span>
                    </div>
                  </div>
                  <div className="session-chip">
                    <ShieldCheck size={16} />
                    <strong>{state.score}</strong>
                    <span>/100</span>
                    <i />
                    <span>{clock(state.elapsed)}</span>
                  </div>
                </div>
                <div className="drive-side-tools">
                  <button
                    aria-label={full ? "Exit fullscreen" : "Enter fullscreen"}
                    onClick={toggleFullscreen}
                  >
                    {full ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  </button>
                  <button
                    aria-label="Change camera"
                    title="Camera (C)"
                    onClick={() => runtime()?.cycleCamera()}
                  >
                    <Eye size={17} />
                    <span>{state.camera}</span>
                  </button>
                  <button
                    aria-label="Toggle headlights"
                    aria-pressed={state.headlights}
                    onClick={() => runtime()?.toggleLights()}
                  >
                    <Lightbulb size={17} />
                  </button>
                  {state.scenario === "rain" && (
                    <button
                      aria-label="Toggle windshield wipers"
                      aria-pressed={state.wipers}
                      title="Wipers (V). Visible in cockpit."
                      onClick={() => runtime()?.toggleWipers()}
                    >
                      V
                    </button>
                  )}
                  {state.scenario === "highway" && (
                    <button
                      aria-label="Toggle cruise control"
                      aria-pressed={state.cruise !== null}
                      title="Cruise (K). Set above 20 km/h; brake to cancel."
                      disabled={state.speed < 20 && state.cruise === null}
                      onClick={() => runtime()?.toggleCruise()}
                    >
                      K
                    </button>
                  )}
                  <button
                    aria-label="Toggle engine audio"
                    aria-pressed={state.audio}
                    onClick={() => runtime()?.toggleAudio()}
                  >
                    {state.audio ? (
                      <Volume2 size={17} />
                    ) : (
                      <VolumeX size={17} />
                    )}
                  </button>
                  <button
                    aria-label={
                      state.mode === "paused" ? "Resume drive" : "Pause drive"
                    }
                    onClick={togglePause}
                  >
                    {state.mode === "paused" ? (
                      <Play size={17} />
                    ) : (
                      <Pause size={17} />
                    )}
                  </button>
                  <button
                    aria-label="Sound horn"
                    disabled={!state.audio}
                    title="Horn (B). Enable audio first."
                    onClick={() => runtime()?.horn()}
                  >
                    B
                  </button>
                  <button
                    aria-label="Finish and review drive"
                    onClick={() => runtime()?.finish()}
                  >
                    <Flag size={17} />
                  </button>
                </div>
                <RouteMap state={state} />
                <div className="drive-assistance" aria-live="polite">
                  {state.cruise !== null && (
                    <span className="cruise-tag">
                      CRUISE · {Math.round(state.cruise)} km/h
                    </span>
                  )}
                  {state.gamepad && (
                    <span className="controller-tag">GAMEPAD CONNECTED</span>
                  )}
                  {state.proximity.left && (
                    <span className="blind-spot">
                      ↖ Vehicle / object on left
                    </span>
                  )}
                  {state.proximity.right && (
                    <span className="blind-spot">
                      Vehicle / object on right ↗
                    </span>
                  )}
                  {state.speed > 20 &&
                    state.proximity.front < (state.speed / 3.6) * 1.4 && (
                      <span className="following-warning">
                        Increase your following distance
                      </span>
                    )}
                </div>
                {state.gear === "R" && (
                  <div
                    className="reverse-overlay"
                    aria-label="Reversing camera with distance guides"
                  >
                    <span>REAR CAMERA · Check your surroundings</span>
                    <svg viewBox="0 0 600 260" aria-hidden="true">
                      <path
                        d={`M 105 245 Q ${180 + state.steer * 2} 140 ${225 + state.steer * 3} 40 M 495 245 Q ${420 + state.steer * 2} 140 ${375 + state.steer * 3} 40`}
                        stroke="#c8ef9b"
                        fill="none"
                        strokeWidth="4"
                      />
                      <path
                        d="M 120 220 H 480"
                        stroke="#e57c69"
                        strokeWidth="4"
                      />
                      <path
                        d="M 165 145 H 435"
                        stroke="#e9c875"
                        strokeWidth="4"
                      />
                      <path
                        d="M 205 75 H 395"
                        stroke="#c8ef9b"
                        strokeWidth="4"
                      />
                    </svg>
                  </div>
                )}
                {state.speed < 15 &&
                  (state.gear === "R"
                    ? state.proximity.rear
                    : state.proximity.front) < 6 && (
                    <div className="parking-sensor" role="status">
                      <span>
                        {state.gear === "R" ? "REAR" : "FRONT"} CLEARANCE
                      </span>
                      <strong>
                        {(state.gear === "R"
                          ? state.proximity.rear
                          : state.proximity.front
                        ).toFixed(1)}{" "}
                        m
                      </strong>
                      <i
                        style={{
                          width: `${Math.max(5, 100 - ((state.gear === "R" ? state.proximity.rear : state.proximity.front) / 6) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                <div className="drive-speedometer">
                  <div className="speed-top">
                    <span
                      className={
                        state.indicator === "left" ? "indicator-active" : ""
                      }
                    >
                      <button
                        aria-label="Left indicator"
                        aria-pressed={state.indicator === "left"}
                        onClick={() => runtime()?.toggleIndicator("left")}
                      >
                        <ArrowLeft size={19} />
                      </button>
                    </span>
                    <span>{state.headlights ? "LIGHTS ON" : "LIGHTS OFF"}</span>
                    <span
                      className={
                        state.indicator === "right" ? "indicator-active" : ""
                      }
                    >
                      <button
                        aria-label="Right indicator"
                        aria-pressed={state.indicator === "right"}
                        onClick={() => runtime()?.toggleIndicator("right")}
                      >
                        <ArrowRight size={19} />
                      </button>
                    </span>
                  </div>
                  <div className="speed-value">
                    <strong
                      className={
                        state.speed > config.limit + 3 ? "over-limit" : ""
                      }
                    >
                      {Math.round(state.speed)}
                    </strong>
                    <span>km/h</span>
                    <div className="speed-limit">{config.limit}</div>
                  </div>
                  <div className="rpm-bar">
                    <i style={{ width: `${(state.rpm / 6500) * 100}%` }} />
                  </div>
                  <div className="speed-meta">
                    <span>{Math.round(state.rpm)} RPM</span>
                    <span>{(state.distance / 1000).toFixed(2)} km</span>
                  </div>
                  <div className="gear-control" aria-label="Transmission">
                    {(["P", "R", "N", "D"] as Gear[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => changeGear(g)}
                        aria-pressed={state.gear === g}
                        disabled={state.speed > 1.8}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                {state.scenario !== "highway" && (
                  <div className="signal-hud">
                    <span className={`signal-light signal-${state.signal}`} />
                    <span>
                      {state.signal === "green"
                        ? "Proceed when clear"
                        : state.signal === "yellow"
                          ? "Prepare to stop"
                          : "Stop before the line"}
                    </span>
                  </div>
                )}
                {(state.alert || gearMessage || !state.onRoad) && (
                  <div className="drive-alert" role="status">
                    {gearMessage ||
                      state.alert ||
                      "Off road — slow down and return to the marked lane."}
                  </div>
                )}
                {!touch && (
                  <div className="keyboard-hint">
                    W throttle · S brake · A/D steer · Space handbrake · R
                    reverse · Esc pause
                  </div>
                )}
                {touch && state.mode === "driving" && (
                  <div className="touch-controls">
                    <div>
                      {touchButton(
                        "Steer left",
                        "steer",
                        -1,
                        <ArrowLeft size={24} />,
                      )}
                      {touchButton(
                        "Steer right",
                        "steer",
                        1,
                        <ArrowRight size={24} />,
                      )}
                    </div>
                    <div className="touch-emergency">
                      {touchButton(
                        "Handbrake",
                        "handbrake",
                        true,
                        <span>
                          HAND
                          <br />
                          BRAKE
                        </span>,
                      )}
                    </div>
                    <div>
                      {touchButton("Brake", "brake", 0.7, "BRAKE")}
                      {touchButton("Accelerate", "throttle", 1, "DRIVE")}
                    </div>
                  </div>
                )}
              </div>
            )}
            {state.mode === "ready" && (
              <div className="drive-screen ready-screen">
                <div className="drive-dialog drive-setup">
                  <span className="drive-eyebrow">PDL / DRIVING LAB</span>
                  <h2>Your next drive.</h2>
                  <p>
                    Pick a route and take the wheel. Follow the checkpoints and
                    stop in the marked bay to complete your session.
                  </p>
                  <div className="scenario-grid">
                    {Object.values(SCENARIOS).map((s) => {
                      const Icon =
                        s.id === "rain"
                          ? CloudRain
                          : s.id === "night"
                            ? Moon
                            : s.id === "highway"
                              ? Compass
                              : Sun;
                      return (
                        <button
                          key={s.id}
                          aria-pressed={s.id === state.scenario}
                          onClick={() => runtime()?.selectScenario(s.id)}
                        >
                          <Icon size={18} />
                          <strong>{s.name}</strong>
                          <span>
                            {s.limit} km/h ·{" "}
                            {s.id === "highway" ? "740 m route" : "245 m route"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="scenario-note">
                    <strong>{config.name}</strong>
                    <p>{config.description}</p>
                    <span>{config.instruction}</span>
                  </div>
                  <label className="driver-select">
                    Driver
                    <select
                      value={driverId}
                      onChange={(e) => setDriverId(e.target.value)}
                    >
                      {profiles.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="drive-primary" onClick={start}>
                    <Play size={17} /> Start drive <ArrowRight size={17} />
                  </button>
                  <div className="setup-controls">
                    <span>
                      {touch
                        ? "Touch controls enabled"
                        : "Keyboard or touch controls"}
                    </span>
                    <button onClick={() => setHelp(true)}>
                      View controls <CircleHelp size={13} />
                    </button>
                  </div>
                </div>
                <div className="ready-caption">
                  {state.scenario === "highway"
                    ? "NORTHBOUND HIGHWAY"
                    : "AVENUE / CITY PRACTICE"}
                  <span>Right-hand traffic · Automatic transmission</span>
                </div>
              </div>
            )}
            {state.mode === "paused" && !help && (
              <div className="drive-screen">
                <div
                  className="drive-dialog pause-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Paused drive"
                >
                  <span className="drive-eyebrow">SESSION PAUSED</span>
                  <h2>Take a breather.</h2>
                  <p>Your timer, traffic, and score are paused.</p>
                  <button
                    className="drive-primary"
                    onClick={() => runtime()?.resume()}
                  >
                    <Play size={16} /> Resume drive
                  </button>
                  <button
                    onClick={() => {
                      runtime()?.recover();
                      runtime()?.resume();
                    }}
                  >
                    <RotateCcw size={16} /> Return car to route
                  </button>
                  <button onClick={() => runtime()?.finish()}>
                    <Flag size={16} /> Finish & review
                  </button>
                </div>
              </div>
            )}
            {report && (
              <div className="drive-screen report-screen">
                <div
                  className="drive-dialog drive-report"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Driving session report"
                >
                  <span className="drive-eyebrow">SESSION REVIEW</span>
                  <h2>
                    {report.completed
                      ? "Route complete."
                      : "Practice makes progress."}
                  </h2>
                  <p>{report.record.feedbackNotes[0]}</p>
                  <div className="report-grade">
                    <strong>
                      {report.record.finalScore}
                      <small>/100</small>
                    </strong>
                    <div>
                      <b>{report.record.classification}</b>
                      <span>
                        {report.completed
                          ? "All checkpoints cleared"
                          : "Route incomplete"}{" "}
                        ·{" "}
                        {report.saveError
                          ? "Not saved locally"
                          : "Saved on this device"}
                      </span>
                    </div>
                  </div>
                  <div className="report-metrics">
                    <div>
                      <strong>{clock(report.record.durationSeconds)}</strong>
                      <span>Driving time</span>
                    </div>
                    <div>
                      <strong>{Math.round(report.distance)} m</strong>
                      <span>Distance</span>
                    </div>
                    <div>
                      <strong>{report.record.averageSpeedKmh}</strong>
                      <span>Average km/h</span>
                    </div>
                    <div>
                      <strong>{report.record.maximumSpeedKmh}</strong>
                      <span>Peak km/h</span>
                    </div>
                  </div>
                  <DriveReview
                    samples={report.samples}
                    events={report.events}
                    limit={config.limit}
                  />
                  <div className="report-events">
                    <h3>Event log</h3>
                    {report.events.length ? (
                      report.events.map((event, i) => (
                        <div key={i}>
                          <span>{clock(event.time)}</span>
                          <p>{event.message}</p>
                          <b>−{event.points}</b>
                        </div>
                      ))
                    ) : (
                      <p>No scored violations recorded.</p>
                    )}
                  </div>
                  <p className="report-note">
                    {report.record.feedbackNotes[1]} Results describe this
                    simulation session.
                  </p>
                  {report.saveError && (
                    <p role="alert">
                      Browser storage is unavailable. Download the report to
                      keep your result.
                    </p>
                  )}
                  <div className="report-downloads">
                    <button
                      onClick={() =>
                        download(
                          `pdl-report-${report.record.sessionId}.json`,
                          JSON.stringify(
                            { ...report.record, events: report.events },
                            null,
                            2,
                          ),
                          "application/json",
                        )
                      }
                    >
                      <Download size={15} /> Report JSON
                    </button>
                    <button disabled={!report.samples.length} onClick={csv}>
                      <Download size={15} /> Telemetry CSV
                    </button>
                  </div>
                  <div className="report-actions">
                    <button
                      onClick={() => {
                        setReport(null);
                        runtime()?.reset();
                      }}
                    >
                      Choose another route
                    </button>
                    <button className="drive-primary" onClick={start}>
                      Drive again <ArrowRight size={16} />
                    </button>
                    {onNavigateToDashboard && (
                      <button onClick={onNavigateToDashboard}>
                        View driver performance
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {help && (
              <div className="drive-screen">
                <div
                  className="drive-dialog help-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Driving controls"
                >
                  <button
                    className="dialog-close"
                    aria-label="Close controls"
                    onClick={() => setHelp(false)}
                  >
                    <X size={18} />
                  </button>
                  <span className="drive-eyebrow">BEFORE YOU DRIVE</span>
                  <h2>Stay in control.</h2>
                  <div className="control-table">
                    {[
                      ["W / ↑", "Throttle"],
                      ["S / ↓", "Service brake"],
                      ["A D / ← →", "Steering"],
                      ["Space", "Handbrake"],
                      ["R", "Drive / reverse (stop first)"],
                      ["C", "Chase / cockpit / hood camera"],
                      ["Q / E", "Left / right turn indicator"],
                      ["H", "Headlights"],
                      ["V", "Rain wipers"],
                      ["K", "Highway cruise control"],
                      ["M / B", "Enable sound / horn"],
                      ["Esc", "Pause / resume"],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <kbd>{key}</kbd>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                  <p>
                    Standard gamepad: left stick steering, RT throttle, LT
                    brake, A handbrake, Y camera, LB/RB indicators, B horn,
                    Start pause. Cruise holds speed; brake, gear change, pause
                    or collision cancels it. Touch controls provide steering,
                    throttle, and brake. Use the gear buttons to reverse. P and
                    N do not apply throttle.
                  </p>
                  <p>
                    Follow the numbered route markers. Clear all checkpoints,
                    then stop below 2 km/h inside the parking bay. Speeding, red
                    lights, wrong lanes, collisions, hard braking, and missed
                    checkpoints reduce your score.
                  </p>
                  <button
                    className="drive-primary"
                    onClick={() => setHelp(false)}
                  >
                    Got it <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="drive-bottom-note">
        <span>
          <ShieldCheck size={14} /> Scored practice · Data stays on your device
        </span>
        <span>Vehicle dynamics and traffic are simulated for learning.</span>
      </div>
    </section>
  );
};
