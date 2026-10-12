require("node:fs").mkdirSync("test-results", { recursive: true });
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PDL_BROWSER ? { channel: process.env.PDL_BROWSER } : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1560, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.__pdlAudioContext = this;
      }
    };
  });
  await page.goto("http://localhost:3000/#sandbox");
  await page
    .getByRole("button", { name: "Start drive", exact: true })
    .waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "test-results/pdl-simulator-setup.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start drive", exact: true }).click();
  await page.keyboard.down("w");
  await page.waitForTimeout(3000);
  await page.keyboard.up("w");
  console.log("throttle", await page.locator(".speed-value").innerText());
  assert.ok(Number(await page.locator(".speed-value>strong").innerText()) > 12);

  assert.equal(
    await page.locator('nav[aria-label="Workspace navigation"] button').count(),
    3,
  );
  assert.equal(
    await page.getByRole("img", { name: "Live rear-view mirror" }).count(),
    1,
  );
  await page.getByRole("button", { name: "Toggle rear-view mirror" }).click();
  assert.equal(
    await page.getByRole("img", { name: "Live rear-view mirror" }).count(),
    0,
  );
  await page.getByRole("button", { name: "Toggle rear-view mirror" }).click();
  await page.getByRole("img", { name: "Live rear-view mirror" }).waitFor();
  const canvases = await page.locator(".drive-renderer canvas").count();
  await page.keyboard.press("c");
  assert.equal(await page.locator(".drive-renderer canvas").count(), canvases);
  assert.equal(
    await page.getByRole("button", { name: "Change camera" }).innerText(),
    "Cockpit",
  );
  await page.screenshot({
    path: "test-results/pdl-simulator-cockpit.png",
    fullPage: true,
  });
  await page.keyboard.press("c");
  assert.equal(
    await page.getByRole("button", { name: "Change camera" }).innerText(),
    "Hood",
  );
  await page.keyboard.press("c");
  await page.keyboard.press("h");
  assert.equal(
    await page
      .getByRole("button", { name: "Toggle headlights" })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.keyboard.press("q");
  assert.equal(
    await page
      .getByRole("button", { name: "Left indicator", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.keyboard.press("e");
  assert.equal(
    await page
      .getByRole("button", { name: "Right indicator", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.keyboard.press("m");
  assert.equal(
    await page
      .getByRole("button", { name: "Toggle engine audio" })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.__pdlAudioContext.state),
    "running",
  );
  await page.keyboard.press("b");
  await page.getByRole("button", { name: "Sound horn", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch graphics quality", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Switch graphics quality", exact: true })
      .innerText(),
    "Performance",
  );
  await page
    .locator(".drive-side-tools")
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => Boolean(document.fullscreenElement)),
    true,
  );
  await page
    .locator(".drive-side-tools")
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => Boolean(document.fullscreenElement)),
    false,
  );
  await page.getByRole("button", { name: "Pause drive", exact: true }).click();
  const time = await page.locator(".session-chip").innerText();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator(".session-chip").innerText(), time);
  console.log("pause timer frozen", time.replaceAll("\n", " "));
  await page
    .getByRole("dialog", { name: "Paused drive" })
    .getByRole("button", { name: "Resume drive", exact: true })
    .click();
  await page.keyboard.down("s");
  await page.waitForTimeout(3000);
  await page.keyboard.up("s");
  assert.equal(await page.locator(".speed-value>strong").innerText(), "0");
  await page.getByRole("button", { name: "R", exact: true }).click();
  await page.keyboard.down("w");
  await page.waitForTimeout(1200);
  await page.keyboard.up("w");
  assert.equal(
    await page
      .getByRole("button", { name: "R", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  console.log("reverse works");
  await page.screenshot({
    path: "test-results/pdl-simulator-city.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Finish and review drive", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Driving session report" }).waitFor();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cds_driving_sessions")),
  );
  assert.equal(saved.length, 1);
  assert.ok(saved[0].durationSeconds > 0);
  assert.equal(saved[0].routeCompleted, false);
  assert.ok(saved[0].missedCheckpoints > 0 && saved[0].missedCheckpoints <= 4);
  assert.equal(
    saved[0].finalScore,
    Math.max(
      0,
      100 -
        saved[0].collisionCount * 20 -
        saved[0].redLightViolations * 15 -
        saved[0].laneViolations * 10 -
        saved[0].overspeedEvents * 5 -
        saved[0].hardBrakingEvents * 3 -
        saved[0].missedCheckpoints * 5,
    ),
  );
  assert.notEqual(saved[0].startTime, saved[0].endTime);
  let dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Report JSON", exact: true }).click();
  console.log("JSON", (await dl).suggestedFilename());
  dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Telemetry CSV", exact: true })
    .click();
  console.log("CSV", (await dl).suggestedFilename());
  await page.screenshot({
    path: "test-results/pdl-simulator-report.png",
    fullPage: true,
  });
  for (const [name, id] of [
    ["Highway cruising", "highway"],
    ["Rain driving", "rain"],
    ["Night driving", "night"],
  ]) {
    await page
      .getByRole("button", { name: "Choose another route", exact: true })
      .click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page
      .getByRole("button", { name: "Start drive", exact: true })
      .click();
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `test-results/pdl-simulator-${id}.png`,
      fullPage: true,
    });
    console.log(
      "scenario",
      id,
      await page.locator(".drive-workbar strong").innerText(),
    );
    if (id === "night")
      assert.equal(
        await page
          .getByRole("button", { name: "Toggle headlights" })
          .getAttribute("aria-pressed"),
        "true",
      );
    await page
      .getByRole("button", { name: "Finish and review drive", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Choose another route", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Touch off", exact: true }).click();
  await page.getByRole("button", { name: "Start drive", exact: true }).click();
  await page
    .getByRole("button", { name: "Accelerate", exact: true })
    .scrollIntoViewIfNeeded();
  const rect = await page
    .getByRole("button", { name: "Accelerate", exact: true })
    .boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1600);
  await page.mouse.up();
  assert.ok(Number(await page.locator(".speed-value>strong").innerText()) > 7);
  console.log("touch throttle works");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/pdl-simulator-mobile.png",
    fullPage: true,
  });
  const steerBox = await page
    .getByRole("button", { name: "Steer left", exact: true })
    .boundingBox();
  await page.mouse.move(
    steerBox.x + steerBox.width / 2,
    steerBox.y + steerBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  const direction = await page
    .locator(".drive-map svg path[transform]")
    .getAttribute("transform");
  assert.ok(Number(direction.match(/rotate\(([^)]+)\)/)[1]) < 0);
  const hb = await page
    .getByRole("button", { name: "Handbrake", exact: true })
    .boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  assert.ok(Number(await page.locator(".speed-value>strong").innerText()) <= 1);
  console.log("touch steering and handbrake verified");
  await page.goto("http://localhost:3000/#dashboard");
  await page.getByRole("button", { name: "Rain", exact: true }).click();
  assert.ok(
    (await page.getByText("Rain driving", { exact: true }).count()) > 0,
  );
  assert.ok(
    (await page.getByText("Incomplete route", { exact: true }).count()) > 0,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log("dashboard rain filter and incomplete-route status verified");
  console.log("errors", errors);
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
