require("node:fs").mkdirSync("test-results", { recursive: true });
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.PDL_BROWSER ? { channel: process.env.PDL_BROWSER } : {}),
  });
  const p = await b.newPage();
  await p.goto("http://localhost:3000/#overview");
  const result = await p.evaluate(async () => {
    const { DrivingRuntime } = await import("/src/simulator/runtime.ts");
    const mount = document.createElement("div");
    mount.style.cssText = "width:900px;height:600px";
    document.body.replaceChildren(mount);
    const r = new DrivingRuntime(
      mount,
      () => {},
      () => {},
      () => {},
    );
    const outcomes = [];
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const angle = (x) => Math.atan2(Math.sin(x), Math.cos(x));
    for (const id of ["city", "highway", "rain", "night"]) {
      r.selectScenario(id);
      r.start();
      const data = r.getData();
      const path =
        id === "highway"
          ? [{ x: 6, z: 740 }]
          : [
              { x: 3.4, z: 40 },
              { x: 3.4, z: 80 },
              { x: 3.4, z: 87 },
              { x: 3.9, z: 90 },
              { x: 5, z: 92.4 },
              { x: 7.1, z: 94.6 },
              { x: 9.6, z: 96.1 },
              { x: 13, z: 96.6 },
              { x: 30, z: 96.6 },
              { x: 85, z: 96.6 },
              { x: 141, z: 96.6 },
            ];
      let waypoint = 0;
      for (let i = 0; i < 120 * 240 && r.getMode() === "driving"; i++) {
        const v = data.vehicle,
          s = data.session;
        const point = path[waypoint];
        const distance = Math.hypot(v.x - point.x, v.z - point.z);
        if (waypoint < path.length - 1 && distance < 2) {
          waypoint++;
          continue;
        }
        const heading = Math.atan2(point.x - v.x, point.z - v.z),
          error = angle(heading - v.heading);
        const speed = Math.abs(v.speed);
        let target =
          id === "highway" ? 18 : waypoint >= 2 && waypoint < 8 ? 3.4 : 7;
        if (waypoint === path.length - 1)
          target = Math.min(target, Math.sqrt(4 * Math.max(0, distance - 0.8)));
        if (id !== "highway" && v.z < 82 && s.elapsed % 30 >= 13)
          target = Math.min(target, Math.sqrt(4 * Math.max(0, 81 - v.z)));
        for (const a of r.world.traffic) {
          const dz = a.z - v.z,
            dx = a.x - v.x,
            ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading),
            lateral = Math.abs(
              dx * Math.cos(v.heading) - dz * Math.sin(v.heading),
            );
          if (ahead > 0 && ahead < 22 && lateral < 2.3)
            target = Math.min(target, Math.sqrt(4 * Math.max(0, ahead - 7)));
        }
        for (const a of r.world.pedestrians) {
          const dz = a.z - v.z,
            dx = a.x - v.x,
            ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading),
            lateral = Math.abs(
              dx * Math.cos(v.heading) - dz * Math.sin(v.heading),
            );
          if (ahead > 0 && ahead < 14 && lateral < 1.8)
            target = Math.min(target, Math.sqrt(4 * Math.max(0, ahead - 4)));
        }
        const feed = (0.16 + 0.0038 * speed * speed) / (3.6 / (1 + speed / 28));
        r.setInput({
          throttle:
            target > speed + 0.15
              ? clamp(feed + (target - speed) * 0.4, 0, 1)
              : 0,
          brake:
            target < speed - 0.15 ? clamp((speed - target) * 0.35, 0, 0.7) : 0,
          steer: clamp(error * 2.5 - v.yawRate * 0.6, -1, 1),
          handbrake: false,
        });
        r.tick(1 / 120);
      }
      outcomes.push({
        scenario: id,
        mode: r.getMode(),
        completed: data.session.completed,
        score: data.session.score,
        seconds: Number(data.session.elapsed.toFixed(1)),
        checkpoints: data.session.checkpoint,
        x: Number(data.vehicle.x.toFixed(1)),
        z: Number(data.vehicle.z.toFixed(1)),
        events: data.session.events.map((e) => e.kind),
      });
      if (r.getMode() === "driving") r.finish();
      r.reset();
    }
    r.dispose();
    return outcomes;
  });
  console.log(JSON.stringify(result, null, 2));
  assert.ok(result.every((r) => r.completed && r.checkpoints === 4));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
