export type ScenarioId = "city" | "highway" | "rain" | "night";
export type Gear = "P" | "R" | "N" | "D";
export type CameraMode = "chase" | "cockpit" | "hood";
export type DriveMode = "ready" | "driving" | "paused" | "finished";
export interface Point {
  x: number;
  z: number;
}
export interface Checkpoint extends Point {
  label: string;
  radius: number;
}
export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  limit: number;
  grip: number;
  start: Point;
  checkpoints: Checkpoint[];
  destination: Point;
  instruction: string;
}
const urbanCheckpoints: Checkpoint[] = [
  { x: 3.4, z: 40, radius: 7, label: "Follow the avenue" },
  { x: 3.4, z: 80, radius: 3, label: "Approach the signal" },
  { x: 30, z: 96.6, radius: 9, label: "Turn right at the intersection" },
  { x: 85, z: 96.6, radius: 9, label: "Continue toward the parking bay" },
];
export const SCENARIOS: Record<ScenarioId, Scenario> = {
  city: {
    id: "city",
    name: "City driving",
    description: "An urban route with signals, crosswalks, and moving traffic.",
    limit: 50,
    grip: 1,
    start: { x: 3.4, z: 0 },
    checkpoints: urbanCheckpoints,
    destination: { x: 141, z: 96.6 },
    instruction:
      "Follow the avenue, turn right at the signal, then stop in the marked bay.",
  },
  highway: {
    id: "highway",
    name: "Highway cruising",
    description:
      "A divided, multi-lane highway with faster traffic and a long stopping distance.",
    limit: 80,
    grip: 1,
    start: { x: 6, z: 0 },
    checkpoints: [
      { x: 6, z: 120, radius: 12, label: "Join the highway flow" },
      { x: 6, z: 300, radius: 12, label: "Maintain a safe cruising speed" },
      { x: 6, z: 500, radius: 12, label: "Keep a safe following distance" },
      { x: 6, z: 650, radius: 12, label: "Prepare to stop in the bay" },
    ],
    destination: { x: 6, z: 740 },
    instruction:
      "Stay on the northbound carriageway and stop in the marked bay at the end.",
  },
  rain: {
    id: "rain",
    name: "Rain driving",
    description:
      "Rain, reduced visibility, and less grip. Brake early and steer smoothly.",
    limit: 40,
    grip: 0.6,
    start: { x: 3.4, z: 0 },
    checkpoints: urbanCheckpoints,
    destination: { x: 141, z: 96.6 },
    instruction:
      "Follow the city route. Keep below 40 km/h and allow more room to brake.",
  },
  night: {
    id: "night",
    name: "Night driving",
    description:
      "An illuminated city route with headlights and limited visibility.",
    limit: 40,
    grip: 1,
    start: { x: 3.4, z: 0 },
    checkpoints: urbanCheckpoints,
    destination: { x: 141, z: 96.6 },
    instruction:
      "Follow the lit avenue, turn right at the signal, then park. Headlights start on.",
  },
};
export interface Inputs {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}
export interface VehicleState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  yawRate: number;
  vx: number;
  vz: number;
  distance: number;
  acceleration: number;
  gear: Gear;
  throttle: number;
  brake: number;
  wheelRotation: number;
}
export function createVehicle(start: Point): VehicleState {
  return {
    ...start,
    heading: 0,
    speed: 0,
    steer: 0,
    yawRate: 0,
    vx: 0,
    vz: 0,
    distance: 0,
    acceleration: 0,
    gear: "D",
    throttle: 0,
    brake: 0,
    wheelRotation: 0,
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function shiftGear(p: VehicleState, gear: Gear): boolean {
  if (Math.abs(p.speed) > 0.5) return false;
  p.gear = gear;
  p.speed = 0;
  p.vx = 0;
  p.vz = 0;
  return true;
}
/** Speed-sensitive bicycle model with tire grip, lateral inertia and time-based damping. SI units. */
export function stepVehicle(
  p: VehicleState,
  input: Inputs,
  dt: number,
  grip: number,
  onRoad: boolean,
) {
  const oldSpeed = p.speed;
  const v = Math.abs(p.speed);
  const steeringLimit = 0.56 / (1 + v / 13);
  const steerTarget = clamp(input.steer, -1, 1) * steeringLimit;
  p.steer += (steerTarget - p.steer) * (1 - Math.exp(-7 * dt));
  p.throttle +=
    (clamp(input.throttle, 0, 1) - p.throttle) * (1 - Math.exp(-4 * dt));
  p.brake = clamp(input.brake, 0, 1);
  const direction = p.gear === "R" ? -1 : p.gear === "D" ? 1 : 0;
  const drivingForce = direction * p.throttle * (3.6 / (1 + v / 28));
  const resistance =
    v > 0.02
      ? Math.sign(p.speed) * (0.16 + 0.0038 * v * v + (onRoad ? 0 : 1.5))
      : 0;
  const braking = (input.handbrake ? 9 : 7.8 * p.brake) * grip;
  p.speed += (drivingForce - resistance) * dt;
  if (braking > 0)
    p.speed =
      Math.sign(p.speed) * Math.max(0, Math.abs(p.speed) - braking * dt);
  if (p.gear === "P") p.speed = 0;
  if (p.gear === "N" && Math.abs(p.speed) < 0.02) p.speed = 0;
  p.speed = clamp(p.speed, -6, 38);
  if (p.throttle < 0.02 && Math.abs(p.speed) < 0.04) p.speed = 0;
  const tireGrip = grip * (onRoad ? 1 : 0.55) * (input.handbrake ? 0.38 : 1);
  const wantedYaw = (p.speed / 2.7) * Math.tan(p.steer);
  const maxYaw = (8.2 * tireGrip) / Math.max(v, 1);
  p.yawRate +=
    (clamp(wantedYaw, -maxYaw, maxYaw) - p.yawRate) *
    (1 - Math.exp(-8 * tireGrip * dt));
  p.heading += p.yawRate * dt;
  const desiredVx = Math.sin(p.heading) * p.speed,
    desiredVz = Math.cos(p.heading) * p.speed;
  const adherence = 1 - Math.exp(-12 * tireGrip * dt);
  p.vx += (desiredVx - p.vx) * adherence;
  p.vz += (desiredVz - p.vz) * adherence;
  if (v < 0.1) {
    p.vx = desiredVx;
    p.vz = desiredVz;
  }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.distance += Math.hypot(p.vx, p.vz) * dt;
  p.wheelRotation += (p.speed / 0.36) * dt;
  p.acceleration = (p.speed - oldSpeed) / dt;
}
export interface BoxObstacle {
  id: string;
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  speed?: number;
  kind: "obstacle" | "traffic" | "pedestrian";
}
export function overlapsVehicle(p: VehicleState, b: BoxObstacle): boolean {
  for (const offset of [-1.25, 0, 1.25]) {
    const x = p.x + Math.sin(p.heading) * offset,
      z = p.z + Math.cos(p.heading) * offset;
    const dx = Math.max(Math.abs(x - b.x) - b.halfX, 0),
      dz = Math.max(Math.abs(z - b.z) - b.halfZ, 0);
    if (dx * dx + dz * dz < 0.8 * 0.8) return true;
  }
  return false;
}
export function isOnRoad(s: ScenarioId, x: number, z: number) {
  return s === "highway"
    ? Math.abs(x) > 1.2 && Math.abs(x) < 12 && z > -120 && z < 820
    : (Math.abs(x) < 7 && z > -130 && z < 310) ||
        (Math.abs(z - 100) < 7 && x > -180 && x < 180);
}
export function signalAt(seconds: number): "green" | "yellow" | "red" {
  const cycle = seconds % 30;
  return cycle < 13 ? "green" : cycle < 16 ? "yellow" : "red";
}
export type EventKind =
  | "collision"
  | "redLight"
  | "wrongLane"
  | "overspeed"
  | "hardBrake"
  | "missedCheckpoint";
export const PENALTIES: Record<EventKind, number> = {
  collision: 20,
  redLight: 15,
  wrongLane: 10,
  overspeed: 5,
  hardBrake: 3,
  missedCheckpoint: 5,
};
export interface DriveEvent {
  kind: EventKind;
  message: string;
  points: number;
  time: number;
}
export interface Sample {
  timestamp: number;
  speedKmh: number;
  accelerationMs2: number;
  throttle: number;
  brake: number;
  steerAngleDeg: number;
  posX: number;
  posY: number;
  posZ: number;
  speedLimitKmh: number;
  isHardBraking: boolean;
  isAggressiveAccel: boolean;
}
export interface SessionState {
  elapsed: number;
  score: number;
  checkpoint: number;
  events: DriveEvent[];
  samples: Sample[];
  maxSpeed: number;
  overspeedTime: number;
  wrongLaneTime: number;
  sampleTime: number;
  overspeedLatched: boolean;
  wrongLaneLatched: boolean;
  lastHardBrake: number;
  collisionContacts: Set<string>;
  startTime: string;
  completed: boolean;
}
export function createSession(): SessionState {
  return {
    elapsed: 0,
    score: 100,
    checkpoint: 0,
    events: [],
    samples: [],
    maxSpeed: 0,
    overspeedTime: 0,
    wrongLaneTime: 0,
    sampleTime: 0,
    overspeedLatched: false,
    wrongLaneLatched: false,
    lastHardBrake: -10,
    collisionContacts: new Set(),
    startTime: new Date().toISOString(),
    completed: false,
  };
}
export function recordEvent(
  session: SessionState,
  kind: EventKind,
  message: string,
) {
  const event = {
    kind,
    message,
    points: PENALTIES[kind],
    time: session.elapsed,
  };
  session.events.push(event);
  session.score = Math.max(0, session.score - event.points);
  return event;
}
export function updateSession(
  session: SessionState,
  p: VehicleState,
  previous: Point,
  config: Scenario,
  dt: number,
) {
  session.elapsed += dt;
  const kmh = Math.abs(p.speed) * 3.6;
  session.maxSpeed = Math.max(session.maxSpeed, kmh);
  if (kmh > config.limit + 3) {
    session.overspeedTime += dt;
    if (session.overspeedTime >= 2 && !session.overspeedLatched) {
      session.overspeedLatched = true;
      recordEvent(
        session,
        "overspeed",
        `Speed exceeded ${config.limit} km/h for 2 seconds.`,
      );
    }
  } else {
    session.overspeedTime = 0;
    session.overspeedLatched = false;
  }
  const wrongLane =
    config.id === "highway"
      ? p.x < -1.2
      : (Math.abs(p.x) < 7 && p.z < 86 && p.x < -0.8) ||
        (Math.abs(p.z - 100) < 7 && p.x > 14 && p.z > 100.8);
  if (wrongLane && kmh > 8) {
    session.wrongLaneTime += dt;
    if (session.wrongLaneTime >= 1.5 && !session.wrongLaneLatched) {
      session.wrongLaneLatched = true;
      recordEvent(session, "wrongLane", "Driving in the opposing lane.");
    }
  } else {
    session.wrongLaneTime = 0;
    session.wrongLaneLatched = false;
  }
  if (
    config.id !== "highway" &&
    previous.z + Math.cos(p.heading) * 2 < 84 &&
    p.z + Math.cos(p.heading) * 2 >= 84 &&
    Math.cos(p.heading) > 0.3 &&
    p.x > 0 &&
    p.x < 7 &&
    signalAt(session.elapsed) === "red"
  )
    recordEvent(session, "redLight", "Crossed the stop line on red.");
  if (
    p.acceleration < -6.5 &&
    kmh > 15 &&
    session.elapsed - session.lastHardBrake > 3
  ) {
    session.lastHardBrake = session.elapsed;
    recordEvent(
      session,
      "hardBrake",
      "Hard braking. Allow more stopping distance.",
    );
  }
  const cp = config.checkpoints[session.checkpoint];
  if (cp && Math.hypot(p.x - cp.x, p.z - cp.z) < cp.radius)
    session.checkpoint++;
  if (
    session.checkpoint === config.checkpoints.length &&
    Math.hypot(p.x - config.destination.x, p.z - config.destination.z) < 4 &&
    kmh < 2
  ) {
    session.completed = true;
  }
  session.sampleTime += dt;
  if (session.sampleTime >= 0.1) {
    session.sampleTime -= 0.1;
    session.samples.push({
      timestamp: Number(session.elapsed.toFixed(2)),
      speedKmh: Number(kmh.toFixed(2)),
      accelerationMs2: Number(p.acceleration.toFixed(2)),
      throttle: Number(p.throttle.toFixed(2)),
      brake: p.brake,
      steerAngleDeg: Number(((p.steer * 180) / Math.PI).toFixed(2)),
      posX: Number(p.x.toFixed(2)),
      posY: 0,
      posZ: Number(p.z.toFixed(2)),
      speedLimitKmh: config.limit,
      isHardBraking: p.acceleration < -6.5,
      isAggressiveAccel: p.acceleration > 4.8,
    });
  }
}
