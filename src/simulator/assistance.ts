import { BoxObstacle, Inputs, VehicleState } from "./model";
export interface Proximity {
  front: number;
  rear: number;
  left: boolean;
  right: boolean;
}
export function senseProximity(
  p: VehicleState,
  obstacles: BoxObstacle[],
): Proximity {
  let front = Infinity,
    rear = Infinity,
    left = false,
    right = false;
  const s = Math.sin(p.heading),
    c = Math.cos(p.heading);
  for (const o of obstacles) {
    const dx = o.x - p.x,
      dz = o.z - p.z;
    const along = dx * s + dz * c,
      side = dx * c - dz * s;
    const longitudinal = Math.abs(s) * o.halfX + Math.abs(c) * o.halfZ;
    const lateral = Math.abs(c) * o.halfX + Math.abs(s) * o.halfZ;
    if (Math.abs(side) < lateral + 1.05) {
      if (along >= 0)
        front = Math.min(front, Math.max(0, along - longitudinal - 2.2));
      else rear = Math.min(rear, Math.max(0, -along - longitudinal - 2.2));
    }
    if (
      Math.abs(along) < longitudinal + 4 &&
      Math.abs(side) < lateral + 4 &&
      Math.abs(side) > lateral + 0.9
    ) {
      if (side < 0) left = true;
      else right = true;
    }
  }
  return { front, rear, left, right };
}
export function cruiseInput(
  input: Inputs,
  speed: number,
  target: number,
): Inputs {
  const error = target - speed;
  return {
    ...input,
    throttle: Math.max(
      input.throttle,
      Math.min(1, Math.max(0, 0.18 + error * 0.48)),
    ),
    brake: Math.max(input.brake, Math.min(0.3, Math.max(0, -error * 0.2))),
  };
}
export function gamepadInput(pad: Pick<Gamepad, "axes" | "buttons">): Inputs {
  const steer = pad.axes[0] ?? 0;
  return {
    steer:
      Math.abs(steer) < 0.12
        ? 0
        : (Math.sign(steer) * (Math.abs(steer) - 0.12)) / 0.88,
    throttle: pad.buttons[7]?.value ?? 0,
    brake: (pad.buttons[6]?.value ?? 0) * 0.8,
    handbrake: pad.buttons[0]?.pressed ?? false,
  };
}
