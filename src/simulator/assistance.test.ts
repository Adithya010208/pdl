import { test } from "node:test";
import assert from "node:assert/strict";
import { createVehicle } from "./model";
import { senseProximity, cruiseInput, gamepadInput } from "./assistance";
const input = { throttle: 0, brake: 0, steer: 0.2, handbrake: false };
test("proximity returns bumper clearance ahead and behind, ignoring adjacent objects", () => {
  const p = createVehicle({ x: 0, z: 0 });
  const o = (x: number, z: number) => ({
    id: "a",
    x,
    z,
    halfX: 1,
    halfZ: 2,
    kind: "traffic" as const,
  });
  const d = senseProximity(p, [o(0, 10), o(0, -7), o(5, 4)]);
  assert.ok(Math.abs(d.front - 5.8) < 1e-8);
  assert.ok(Math.abs(d.rear - 2.8) < 1e-8);
});
test("proximity rotates with the car and clamps overlapping clearance at zero", () => {
  const p = createVehicle({ x: 0, z: 0 });
  p.heading = Math.PI / 2;
  const d = senseProximity(p, [
    { id: "b", x: 3, z: 0, halfX: 1, halfZ: 2, kind: "obstacle" },
  ]);
  assert.equal(d.front, 0);
  assert.equal(d.rear, Infinity);
});
test("blind spot detection distinguishes left and right", () => {
  const p = createVehicle({ x: 0, z: 0 });
  const d = senseProximity(p, [
    { id: "a", x: -3, z: 1, halfX: 1, halfZ: 2, kind: "traffic" },
  ]);
  assert.equal(d.left, true);
  assert.equal(d.right, false);
});
test("cruise responds to speed error without changing steering or handbrake", () => {
  assert.equal(cruiseInput(input, 5, 15).throttle, 1);
  assert.ok(cruiseInput(input, 17, 15).brake > 0);
  assert.equal(cruiseInput(input, 10, 15).steer, 0.2);
  assert.equal(
    cruiseInput({ ...input, handbrake: true }, 10, 15).handbrake,
    true,
  );
});
test("gamepad deadzone removes stick noise and maps analog triggers", () => {
  const buttons = Array.from({ length: 8 }, () => ({
    value: 0,
    pressed: false,
    touched: false,
  }));
  buttons[7].value = 0.6;
  buttons[6].value = 0.5;
  let d = gamepadInput({ axes: [0.08], buttons });
  assert.equal(d.steer, 0);
  assert.equal(d.throttle, 0.6);
  assert.equal(d.brake, 0.4);
  d = gamepadInput({ axes: [-1], buttons });
  assert.equal(d.steer, -1);
});
test("gamepad handbrake and fully neutral input are explicit", () => {
  const buttons = Array.from({ length: 8 }, () => ({
    value: 0,
    pressed: false,
    touched: false,
  }));
  assert.deepEqual(gamepadInput({ axes: [], buttons }), {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
  });
  buttons[0].pressed = true;
  assert.equal(gamepadInput({ axes: [1], buttons }).handbrake, true);
});
