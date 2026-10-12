import React from "react";
import { Sample, DriveEvent } from "../simulator/model";
export function DriveReview({
  samples,
  events,
  limit,
}: {
  samples: Sample[];
  events: DriveEvent[];
  limit: number;
}) {
  if (samples.length < 2) return null;
  const duration = samples.at(-1)!.timestamp || 1,
    max = Math.max(limit * 1.25, ...samples.map((s) => s.speedKmh), 1);
  const points = samples
    .filter((_, i) => i % Math.max(1, Math.floor(samples.length / 150)) === 0)
    .map(
      (s) =>
        `${12 + (s.timestamp / duration) * 456},${86 - (s.speedKmh / max) * 66}`,
    )
    .join(" ");
  const focus = events.some((e) => e.kind === "collision")
    ? "Leave more room around traffic and roadside objects."
    : events.some((e) => e.kind === "redLight")
      ? "Brake early for signals and stop before the line."
      : events.some((e) => e.kind === "overspeed")
        ? "Ease off the throttle before reaching the speed limit."
        : events.some((e) => e.kind === "hardBrake")
          ? "Plan your braking earlier for a smoother stop."
          : events.some((e) => e.kind === "missedCheckpoint")
            ? "Follow the route markers through to the final parking bay."
            : "Keep building consistency: smooth steering, early braking and space around traffic.";
  return (
    <section className="drive-review-chart">
      <div>
        <strong>Your speed through the drive</strong>
        <span>Limit {limit} km/h</span>
      </div>
      <svg
        viewBox="0 0 480 106"
        role="img"
        aria-label="Recorded speed over the session, with speed limit reference"
      >
        <path
          d={`M12 ${86 - (limit / max) * 66} H468`}
          stroke="#ba9671"
          strokeDasharray="4 4"
        />
        <path d="M12 86 H468" stroke="#d8dece" />
        <polyline
          points={points}
          fill="none"
          stroke="#3c786b"
          strokeWidth="2.5"
        />
        <text x="12" y="102">
          0:00
        </text>
        <text x="433" y="102">
          {Math.floor(duration / 60)}:
          {String(Math.floor(duration % 60)).padStart(2, "0")}
        </text>
      </svg>
      <p>
        <b>Next drive:</b> {focus}
      </p>
    </section>
  );
}
