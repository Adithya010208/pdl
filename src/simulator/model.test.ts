import test from "node:test";
import assert from "node:assert/strict";
import {
  createVehicle,
  stepVehicle,
  shiftGear,
  createSession,
  updateSession,
  recordEvent,
  isOnRoad,
  overlapsVehicle,
  signalAt,
  SCENARIOS,
} from "./model.ts";
const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };
function drive(seconds: number, input = idle, grip = 1, dt = 1 / 120) {
  const p = createVehicle({ x: 3.4, z: 0 });
  for (let t = 0; t < seconds - dt / 2; t += dt)
    stepVehicle(p, input, dt, grip, true);
  return p;
}
test("normal acceleration is progressive and in a plausible range", () => {
  const p = drive(5, { ...idle, throttle: 1 });
  assert.ok(p.speed * 3.6 > 40 && p.speed * 3.6 < 60);
  assert.ok(p.z > 20 && p.z < 50);
});
test("left steering moves left; right steering moves right", () => {
  const left = drive(4, { ...idle, throttle: 0.5, steer: -0.5 }),
    right = drive(4, { ...idle, throttle: 0.5, steer: 0.5 });
  assert.ok(left.x < 3.4);
  assert.ok(right.x > 3.4);
  assert.ok(left.heading < 0);
  assert.ok(right.heading > 0);
});
test("handling remains stable at high speed", () => {
  const p = createVehicle({ x: 0, z: 0 });
  p.speed = 30;
  for (let i = 0; i < 120; i++)
    stepVehicle(p, { ...idle, steer: 1 }, 1 / 120, 1, true);
  assert.ok(Math.abs(p.yawRate) < 0.4);
  assert.ok(Number.isFinite(p.x));
});
test("physics is consistent between 60 and 120 Hz", () => {
  const a = drive(10, { ...idle, throttle: 0.7, steer: 0.1 }, 1, 1 / 60),
    b = drive(10, { ...idle, throttle: 0.7, steer: 0.1 }, 1, 1 / 120);
  assert.ok(Math.abs(a.speed - b.speed) < 0.1);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.5);
});
test("wet roads need longer stopping distances", () => {
  const stop = (grip: number) => {
    const p = createVehicle({ x: 0, z: 0 });
    p.speed = 15;
    p.vz = 15;
    for (let i = 0; i < 1000 && p.speed > 0.05; i++)
      stepVehicle(p, { ...idle, brake: 1 }, 1 / 120, grip, true);
    return p.distance;
  };
  assert.ok(stop(0.6) > stop(1) * 1.4);
});
test("braking stops the car without automatically reversing", () => {
  const p = createVehicle({ x: 0, z: 0 });
  p.speed = 10;
  p.vz = 10;
  for (let i = 0; i < 600; i++)
    stepVehicle(p, { ...idle, brake: 1 }, 1 / 120, 1, true);
  assert.equal(p.speed, 0);
  assert.equal(p.gear, "D");
});
test("reverse is explicit and gear changes require a stop", () => {
  const p = createVehicle({ x: 0, z: 0 });
  p.speed = 5;
  assert.equal(shiftGear(p, "R"), false);
  p.speed = 0;
  assert.equal(shiftGear(p, "R"), true);
  for (let i = 0; i < 240; i++)
    stepVehicle(p, { ...idle, throttle: 1 }, 1 / 120, 1, true);
  assert.ok(p.z < 0);
  assert.ok(p.speed < 0);
});
test("park and neutral do not accelerate from throttle", () => {
  for (const gear of ["P", "N"] as const) {
    const p = createVehicle({ x: 0, z: 0 });
    shiftGear(p, gear);
    for (let i = 0; i < 240; i++)
      stepVehicle(p, { ...idle, throttle: 1 }, 1 / 120, 1, true);
    assert.equal(p.speed, 0);
    assert.equal(p.z, 0);
  }
});
test("service brake and handbrake both slow the vehicle", () => {
  for (const input of [
    { ...idle, brake: 1 },
    { ...idle, handbrake: true },
  ]) {
    const p = createVehicle({ x: 0, z: 0 });
    p.speed = 15;
    p.vz = 15;
    stepVehicle(p, input, 0.1, 1, true);
    assert.ok(p.speed < 15);
  }
});
test("cross street remains drivable beyond the old invisible boundary", () => {
  assert.equal(isOnRoad("city", 100, 96.6), true);
  assert.equal(isOnRoad("city", 30, 30), false);
  assert.equal(isOnRoad("highway", 6, 740), true);
  assert.equal(isOnRoad("highway", 0, 400), false);
});
test("collisions follow the visible obstacle footprint, including front bumper", () => {
  const p = createVehicle({ x: 3.4, z: 0 });
  assert.equal(
    overlapsVehicle(p, {
      id: "front",
      x: 3.4,
      z: 2.3,
      halfX: 1,
      halfZ: 0.3,
      kind: "obstacle",
    }),
    true,
  );
  assert.equal(
    overlapsVehicle(p, {
      id: "away",
      x: 10,
      z: 10,
      halfX: 1,
      halfZ: 1,
      kind: "obstacle",
    }),
    false,
  );
});
test("signal cycle has green, yellow, and red phases", () => {
  assert.equal(signalAt(0), "green");
  assert.equal(signalAt(14), "yellow");
  assert.equal(signalAt(20), "red");
  assert.equal(signalAt(31), "green");
});
test("red-light scoring triggers crossing, not waiting at the line", () => {
  const p = createVehicle({ x: 3.4, z: 82.2 }),
    s = createSession();
  s.elapsed = 20;
  updateSession(s, p, { x: 3.4, z: 81.8 }, SCENARIOS.city, 0.01);
  assert.equal(s.score, 85);
  updateSession(s, p, { x: 3.4, z: 82.2 }, SCENARIOS.city, 0.01);
  assert.equal(s.events.length, 1);
});
test("highway has no city red-light penalty", () => {
  const p = createVehicle({ x: 6, z: 82.2 }),
    s = createSession();
  s.elapsed = 20;
  updateSession(s, p, { x: 6, z: 81.8 }, SCENARIOS.highway, 0.01);
  assert.equal(s.events.length, 0);
});
test("speed detection covers the full route and deduplicates a continuous event", () => {
  const p = createVehicle({ x: 70, z: 96.6 }),
    s = createSession();
  p.speed = 20;
  for (let i = 0; i < 360; i++) updateSession(s, p, p, SCENARIOS.city, 1 / 120);
  assert.equal(s.events.filter((e) => e.kind === "overspeed").length, 1);
  assert.equal(s.score, 95);
});
test("wrong-lane detection covers the cross street", () => {
  const p = createVehicle({ x: 70, z: 103.4 }),
    s = createSession();
  p.speed = 10;
  for (let i = 0; i < 240; i++) updateSession(s, p, p, SCENARIOS.city, 1 / 120);
  assert.equal(s.events.filter((e) => e.kind === "wrongLane").length, 1);
});
test("telemetry records at 10 Hz using only active simulation time", () => {
  const p = createVehicle({ x: 3.4, z: 0 }),
    s = createSession();
  for (let i = 0; i < 1200; i++)
    updateSession(s, p, p, SCENARIOS.rain, 1 / 120);
  assert.ok(s.samples.length >= 99 && s.samples.length <= 100);
  assert.ok(Math.abs(s.elapsed - 10) < 0.001);
  assert.equal(s.samples[0].speedLimitKmh, 40);
});
test("parking requires every checkpoint and a stopped vehicle", () => {
  const config = SCENARIOS.city,
    p = createVehicle(config.destination),
    s = createSession();
  updateSession(s, p, p, config, 0.01);
  assert.equal(s.completed, false);
  s.checkpoint = 4;
  p.speed = 5;
  updateSession(s, p, p, config, 0.01);
  assert.equal(s.completed, false);
  p.speed = 0;
  updateSession(s, p, p, config, 0.01);
  assert.equal(s.completed, true);
});
test("route checkpoints must be reached in order", () => {
  const s = createSession(),
    p = createVehicle(SCENARIOS.city.checkpoints[2]);
  updateSession(s, p, p, SCENARIOS.city, 0.01);
  assert.equal(s.checkpoint, 0);
  for (const cp of SCENARIOS.city.checkpoints) {
    p.x = cp.x;
    p.z = cp.z;
    updateSession(s, p, p, SCENARIOS.city, 0.01);
  }
  assert.equal(s.checkpoint, 4);
});
test("all configured penalties are exact and score never drops below zero", () => {
  const s = createSession();
  recordEvent(s, "collision", "");
  recordEvent(s, "redLight", "");
  recordEvent(s, "wrongLane", "");
  recordEvent(s, "overspeed", "");
  recordEvent(s, "hardBrake", "");
  recordEvent(s, "missedCheckpoint", "");
  assert.equal(s.score, 42);
  for (let i = 0; i < 20; i++) recordEvent(s, "collision", "");
  assert.equal(s.score, 0);
});
