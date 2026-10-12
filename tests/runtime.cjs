require("node:fs").mkdirSync("test-results", { recursive: true });
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.PDL_BROWSER ? { channel: process.env.PDL_BROWSER } : {}),
  });
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://localhost:3000/#overview");
  const checks = await page.evaluate(async () => {
    const { DrivingRuntime } = await import("/src/simulator/runtime.ts");
    const { createWorld, updateWorld, disposeGroup } =
      await import("/src/simulator/world.ts");
    const { SCENARIOS, createVehicle } =
      await import("/src/simulator/model.ts");
    const results = [];
    const check = (name, value) => {
      if (!value) throw new Error(name);
      results.push(name);
    };
    const city = createWorld(SCENARIOS.city),
      p = createVehicle({ x: 50, z: 50 });
    for (let i = 0; i < 600; i++) updateWorld(city, p, 20 + i * 0.01, 0.01, 0);
    check(
      "Traffic stops before a red signal",
      city.traffic
        .filter((a) => a.axis === "z" && a.direction === 1)
        .every((a) => a.z < 82 && a.speed < 0.1),
    );
    check(
      "Pedestrians cross while vehicle signal is red",
      city.pedestrians.some((a) => Math.abs(a.x) < 8),
    );
    const ped = city.pedestrians[0];
    ped.x = -8.5;
    ped.direction = 1;
    for (let i = 0; i < 100; i++) updateWorld(city, p, 2, 0.01, 0);
    check("Pedestrians wait at the sidewalk on green", ped.x === -8.5);
    const highway = createWorld(SCENARIOS.highway);
    check(
      "Highway has its own median and guardrails",
      highway.obstacles.some((o) => o.id === "median") &&
        highway.traffic.length === 5 &&
        highway.pedestrians.length === 0,
    );
    const rain = createWorld(SCENARIOS.rain);
    check("Rain has animated precipitation geometry", rain.rain !== null);
    const y = rain.rain.geometry.attributes.position.getY(0);
    updateWorld(rain, p, 0, 0.1, 0);
    check(
      "Rain geometry changes over time",
      rain.rain.geometry.attributes.position.getY(0) !== y,
    );
    [city, highway, rain].forEach((w) => disposeGroup(w.root));
    const mount = document.createElement("div");
    mount.style.cssText = "width:1000px;height:600px";
    document.body.replaceChildren(mount);
    let finished = 0;
    const r = new DrivingRuntime(
      mount,
      () => {},
      () => finished++,
      (message) => {
        throw new Error(message);
      },
    );
    r.start();
    const worldId = r.world.root.uuid;
    r.setCamera("cockpit");
    r.setCamera("hood");
    r.setCamera("chase");
    check("Camera changes preserve the scene", r.world.root.uuid === worldId);
    const data = r.getData();
    data.vehicle.x = 70;
    data.vehicle.z = 96.6;
    data.vehicle.heading = Math.PI / 2;
    r.setInput({ throttle: 0.3 });
    for (let i = 0; i < 300; i++) r.tick(1 / 120);
    check(
      "Cross street is physically traversable",
      data.vehicle.x > 71 &&
        data.session.events.every((e) => e.kind !== "collision"),
    );
    // Collision detection against a known visible tree, then ensure it does not repeat every frame.
    data.vehicle.x = 13;
    data.vehicle.z = -101;
    data.vehicle.heading = 0;
    data.vehicle.speed = 5;
    data.vehicle.vz = 5;
    for (let i = 0; i < 120; i++) r.tick(1 / 120);
    check(
      "Visible objects produce collision events",
      data.session.events.some((e) => e.kind === "collision"),
    );
    const collisions = data.session.events.filter(
      (e) => e.kind === "collision",
    ).length;
    for (let i = 0; i < 120; i++) r.tick(1 / 120);
    check(
      "Persistent collision contact is deduplicated",
      data.session.events.filter((e) => e.kind === "collision").length ===
        collisions,
    );
    r.pause();
    const before = r.getSnapshot(),
      trafficBefore = r.world.traffic.map((a) => [a.x, a.z]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    check(
      "Pause freezes time, position and traffic",
      r.getSnapshot().elapsed === before.elapsed &&
        r.getSnapshot().x === before.x &&
        JSON.stringify(r.world.traffic.map((a) => [a.x, a.z])) ===
          JSON.stringify(trafficBefore),
    );
    r.resume();
    data.vehicle.x = 141;
    data.vehicle.z = 96.6;
    data.vehicle.speed = 0;
    data.vehicle.vx = 0;
    data.vehicle.vz = 0;
    data.session.checkpoint = 4;
    r.clearInput();
    r.tick(1 / 120);
    check(
      "Parking completes and finalizes the route",
      r.getMode() === "finished" && finished === 1 && data.session.completed,
    );
    r.finish();
    check("Finishing twice does not duplicate the report", finished === 1);
    r.reset();
    r.start();
    r.setInput({ throttle: 1 });
    for (let i = 0; i < 120; i++) r.tick(1 / 120);
    r.recover();
    check(
      "Recovery returns vehicle to route without losing distance",
      Math.abs(r.getSnapshot().x - 3.4) < 0.01 &&
        r.getSnapshot().distance > 0 &&
        r.getSnapshot().speed === 0,
    );
    r.finish();
    check(
      "Unreached checkpoints reduce the final score",
      r.getData().session.events.filter((e) => e.kind === "missedCheckpoint")
        .length === 4 && r.getSnapshot().score <= 80,
    );
    r.start();
    check(
      "Retry resets score, contacts, traffic and pedestrians",
      r.getSnapshot().score === 100 &&
        r.contactUntil === 0 &&
        r.world.traffic.every(
          (a) => a.x === a.initialX && a.z === a.initialZ,
        ) &&
        r.world.pedestrians.every((p) => Math.abs(p.x) === 8.5),
    );
    const stopped = r.getData();
    stopped.vehicle.x = 3.4;
    stopped.vehicle.z = 30;
    stopped.vehicle.speed = 0;
    stopped.vehicle.vx = 0;
    stopped.vehicle.vz = 0;
    const moving = r.world.traffic.find(
      (a) => a.axis === "z" && a.direction === 1,
    );
    moving.x = 3.4;
    moving.z = 28;
    moving.speed = 4;
    r.tick(1 / 120);
    check(
      "Moving traffic contact is scored when player is stopped",
      stopped.session.events.some((e) => e.kind === "collision"),
    );
    r.updateVisuals(0);
    check(
      "Rendered vehicle matches north-up route coordinates",
      r.car.root.position.z === -stopped.vehicle.z &&
        r.car.root.rotation.y === Math.PI - stopped.vehicle.heading,
    );
    r.updateVisuals(0);
    r.renderViews(1);
    const rearDirection = r.rearCamera.getWorldDirection(
      r.rearCamera.position.clone(),
    );
    check(
      "Rear mirror looks opposite the vehicle heading",
      Math.abs(rearDirection.x + Math.sin(stopped.vehicle.heading)) < 0.001 &&
        Math.abs(rearDirection.z - Math.cos(stopped.vehicle.heading)) < 0.001,
    );
    check(
      "Mirror restores player visibility and primary viewport",
      r.car.root.visible &&
        r.renderer.getRenderTarget() === null &&
        !r.renderer.getScissorTest(),
    );
    r.toggleMirror();
    check(
      "Mirror toggle is reflected in HUD state",
      r.getSnapshot().mirror === false,
    );
    r.dispose();
    check("Renderer cleanup removes the canvas", mount.children.length === 0);
    return results;
  });
  console.log(checks.map((x) => "PASS " + x).join("\n"));
  assert.equal(checks.length, 22);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
