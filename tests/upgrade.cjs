const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.PDL_BROWSER ? { channel: process.env.PDL_BROWSER } : {}),
  });
  const p = await b.newPage({ viewport: { width: 1560, height: 1100 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:3000/#overview");
  const checks = await p.evaluate(async () => {
    const { DrivingRuntime } = await import("/src/simulator/runtime.ts");
    const mount = document.createElement("div");
    Object.assign(mount.style, { width: "1000px", height: "650px" });
    document.body.append(mount);
    const r = new DrivingRuntime(
      mount,
      () => {},
      () => {},
      (e) => {
        throw Error(e);
      },
    );
    cancelAnimationFrame(r.frame);
    let results = [];
    const check = (name, value) => {
      if (!value) throw Error(name);
      results.push(name);
    };
    r.selectScenario("rain");
    check("Rain starts with windshield wipers enabled", r.getSnapshot().wipers);
    r.start();
    r.setCamera("cockpit");
    r.updateVisuals(0.1);
    const angle = r.interior.wipers[0].rotation.z;
    r.tick(0.2);
    r.updateVisuals(0.1);
    check(
      "Rain cockpit wipers sweep with simulation time",
      r.interior.wipers[0].rotation.z !== angle,
    );
    r.toggleWipers();
    r.updateVisuals(0.1);
    check("Wipers can be parked", r.interior.wipers[0].rotation.z === -1.25);
    check(
      "Cockpit has a live instrument texture",
      r.interior.lastDraw >= 0 && r.interior.root.visible,
    );
    r.pause();
    const frozen = r.interior.wipers[0].rotation.z;
    r.updateVisuals(0.3);
    check(
      "Paused wiper phase stays fixed",
      r.interior.wipers[0].rotation.z === frozen,
    );
    r.resume();
    r.finish();
    r.selectScenario("highway");
    r.start();
    r.getData().vehicle.speed = 15;
    r.toggleCruise();
    check(
      "Highway cruise captures current speed",
      r.getSnapshot().cruise === 54,
    );
    for (let i = 0; i < 480; i++) r.tick(1 / 120);
    check(
      "Cruise maintains captured speed",
      Math.abs(r.getSnapshot().speed - 54) < 3,
    );
    r.setInput({ brake: 0.5 });
    check("Service brake cancels cruise", r.getSnapshot().cruise === null);
    r.getData().vehicle.speed = 0;
    r.setGear("R");
    r.updateVisuals(0);
    const dir = r.camera.getWorldDirection(r.camera.position.clone());
    check("Reverse camera looks behind the vehicle", dir.z > 0.99);
    r.finish();
    r.selectScenario("city");
    r.start();
    r.getData().vehicle.speed = 12;
    r.toggleCruise();
    check(
      "City does not enable highway cruise",
      r.getSnapshot().cruise === null,
    );
    const buttons = Array.from({ length: 10 }, () => ({
      value: 0,
      pressed: false,
    }));
    buttons[7].value = 0.7;
    const native = navigator.getGamepads;
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        { connected: true, mapping: "standard", axes: [-0.5], buttons },
      ],
    });
    r.pollGamepad();
    check(
      "Gamepad input reaches throttle and steering",
      r.input.throttle === 0.7 && r.input.steer < 0 && r.getSnapshot().gamepad,
    );
    buttons[9].pressed = true;
    r.pollGamepad();
    check("Gamepad Start pauses on a single press", r.getMode() === "paused");
    r.pollGamepad();
    check(
      "Holding Start does not repeatedly toggle pause",
      r.getMode() === "paused",
    );
    buttons[9].pressed = false;
    r.pollGamepad();
    buttons[9].pressed = true;
    r.pollGamepad();
    check(
      "Gamepad Start resumes after release and repress",
      r.getMode() === "driving",
    );
    buttons[9].pressed = false;
    buttons[7].value = 0;
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [],
    });
    r.pollGamepad();
    check(
      "Gamepad disconnect clears held controls",
      r.input.throttle === 0 && !r.getSnapshot().gamepad,
    );
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: native.bind(navigator),
    });
    r.dispose();
    mount.remove();
    return results;
  });
  console.log(checks.map((x) => "PASS " + x).join("\n"));
  assert.equal(checks.length, 15);
  await p.goto("http://localhost:3000/#sandbox");
  await p.getByRole("button", { name: "Start drive", exact: true }).click();
  await p.keyboard.press("c");
  await p.waitForTimeout(700);
  await p.screenshot({
    path: "test-results/pdl-nextlevel-cockpit.png",
    fullPage: true,
  });
  await p.getByRole("button", { name: "Finish and review drive" }).click();
  await p.getByRole("button", { name: "Choose another route" }).click();
  await p
    .locator(".scenario-grid button")
    .filter({ hasText: "Rain driving" })
    .click();
  await p.getByRole("button", { name: "Start drive", exact: true }).click();
  await p.waitForTimeout(700);
  await p.screenshot({
    path: "test-results/pdl-nextlevel-rain-cockpit.png",
    fullPage: true,
  });
  await p.getByRole("button", { name: "Toggle windshield wipers" }).click();
  assert.equal(
    await p
      .getByRole("button", { name: "Toggle windshield wipers" })
      .getAttribute("aria-pressed"),
    "false",
  );
  await p.keyboard.press("r");
  await p.waitForTimeout(300);
  await p.getByLabel("Reversing camera with distance guides").waitFor();
  await p.screenshot({
    path: "test-results/pdl-nextlevel-reverse.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await b.close();
})();
