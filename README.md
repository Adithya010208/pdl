# PDL Drive

A browser driving practice workspace with local session reports.

## Run locally

Install [Node.js](https://nodejs.org/en/download) (version 24 recommended; 22.12+ also supported) and [Git](https://git-scm.com/downloads). Open PowerShell or a terminal in the folder where you want to keep the project.

```sh
git clone https://github.com/Adithya010208/pdl.git
cd pdl
npm ci
npm run dev
```

If you already have this project, open a terminal inside its `pdl` folder and run only `npm ci` and `npm run dev`. No API key, `.env` configuration, database, or Unity installation is required for the browser simulator. Keep the terminal running while you use the website. Press Ctrl+C to stop the server.

If PowerShell blocks `npm.ps1`, use `npm.cmd ci` and `npm.cmd run dev` instead. If port 3000 is occupied, Vite prints another local URL; use the URL shown in the terminal.

Open http://localhost:3000/#sandbox.

```sh
npm run lint
npm test
npm run build
npm run preview
```

## Driving simulator

Four environments are available: city, divided highway, rain, and night. Each has an ordered route and a marked stopping destination. Clear every checkpoint and stop below 2 km/h inside the bay to complete a session.

The simulator includes progressive throttle, a speed-sensitive steering model, tire grip and lateral inertia, reduced wet-road grip, explicit P/R/N/D transmission, service brake, handbrake, chase/cockpit/hood cameras, a live rear-view mirror, signals, lane-following traffic, pedestrians, collisions, headlights, indicators, procedural audio, a route map, live telemetry, pause, fullscreen, and vehicle recovery. Performance graphics mode lowers rendering resolution and disables shadows.

| Input | Action |
| --- | --- |
| W / Up | Throttle |
| S / Down | Service brake |
| A / D or Left / Right | Steering |
| Space | Handbrake |
| R | Switch Drive/Reverse while stopped |
| C | Change camera |
| Q / E | Left/right turn indicator |
| H | Headlights |
| M | Enable/mute audio |
| B | Horn while audio is enabled |
| Escape | Pause/resume |

Touch controls provide steering, throttle, service brake, and handbrake. Gear, camera, light, indicator, sound, horn, and session controls have on-screen buttons. Touch devices start in performance graphics mode.

## Scoring and reports

Sessions start at 100 points. Collision: -20; crossing a red stop line: -15; sustained opposing-lane driving: -10; sustained speeding: -5; hard braking: -3; unreached checkpoints at session end: -5 each. Score is bounded at zero. Continuous contacts and rule violations are deduplicated.

The driving timer, world, and telemetry recording stop while paused or when the browser loses focus. Camera and UI changes do not recreate the scene. Finishing a session freezes its report and saves it once. Reports include the actual start/end timestamps, active duration, distance, route completion, event log, and sampled speed statistics. Export session JSON or 10 Hz telemetry CSV.

## Verification

`npm test` runs 26 deterministic handling, rule, sensor and controller tests. Browser checks cover UI interactions, the 3D runtime, and end-to-end route completion for every environment.

With the dev server running in a separate terminal:

```sh
npx playwright install chromium
npm run test:browser
```

To use an installed Edge browser in PowerShell instead:

```powershell
$env:PDL_BROWSER = 'msedge'
npm run test:browser
```

Browser checks save review images in `test-results/`. See [SIMULATOR_VERIFICATION.md](SIMULATOR_VERIFICATION.md) for feature coverage.

## Workspace and storage

The website focuses on three areas: Overview, Driving Simulator, and Driver Performance. Driver history and comparisons are available in performance. The driver dashboard initially includes sample records; the simulator creates a local practice profile if no profiles are saved. New sessions attach to the selected driver. Incomplete routes are marked and excluded from the dashboard pass rate.

Profiles and sessions use browser storage and do not sync across devices. Storage failures are shown in the session review, with downloads still available. Reports are simulation assessments. The browser engine uses simplified planar vehicle dynamics, procedural visuals/audio, and scripted traffic; it is not a licensed driving assessment or full rigid-body automotive simulation.

The rear-view mirror shows the actual scene behind the vehicle and follows its heading. Toggle it in the simulator toolbar. Balanced mode updates it at 30 Hz; performance mode uses 10 Hz to reduce rendering work.

## Expanded driving experience

- Procedural sky with sun glow, night stars, clouds, distant landforms, shopfronts, roadside benches and planted strips.
- Cockpit instrument cluster displays live speed, RPM, gear and distance. Rain wipers animate in cockpit view and start enabled in rain; V toggles them.
- Reverse gear activates a rear-facing camera with visual guide lines. Clearance sensors show the measured front/rear gap below 15 km/h when an obstacle is within 6 m. Guide lines are visual references, not calibrated distance marks.
- Nearby objects on either side trigger awareness messages; a short forward gap at speed shows a following-distance reminder. These are advisory and do not brake or steer for you.
- On the highway, K captures cruise speed above 20 km/h, capped at the scenario limit. Brake, handbrake, gear change, pause and collision cancel cruise.
- Standard gamepad: left stick steering, RT throttle, LT brake, A handbrake, Y camera, LB/RB indicators, B horn, Start pause/resume. Stick deadzone avoids drift; releasing inputs or disconnecting clears held controls. Hardware must be exposed by the browser; controller mapping is tested with simulated standard gamepad data.
- Session review includes the recorded speed trace, speed-limit reference and a focused suggestion based on scored driving events.

`tests/upgrade.cjs` checks 15 new runtime behaviours and captures cockpit, rain and reversing views. It runs with the existing browser suite.
