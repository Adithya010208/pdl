# Simulator feature verification

Verified locally on 11 October 2026 using Node.js 24 and a headless Microsoft Edge browser at desktop and 390 px mobile viewport widths.

## Automated coverage

- 26 deterministic model and assistance tests: all pass.
- 22 core 3D engine integration checks and 15 added driving-feature checks: all pass.
- Four end-to-end route drives: all complete every checkpoint and park successfully. The controller uses steering, throttle and brake through the engine; it does not teleport the car between route points.
- Browser feature checks: keyboard and touch acceleration, braking, reverse, all camera modes, rear-view mirror toggle, lights, indicators, audio activation, horn, graphics mode, fullscreen, pause, JSON/CSV downloads, local saving, scenario selection, and dashboard filtering/status.
- TypeScript check and production build pass. The simulator remains a large lazy-loaded Three.js chunk; the overview does not load it initially.

## Feature results

| Feature | Result and evidence |
| --- | --- |
| Steering and throttle | Left/right follow the displayed road orientation. Progressive acceleration and high-speed steering stability pass deterministic tests. |
| Brakes and transmission | Service brake stops without reversing. P and N reject throttle; R moves backward; changing direction requires a stop. Touch handbrake is available. |
| Grip and weather | Wet-road braking distance exceeds dry-road distance. Rain geometry animates and the rain speed limit is 40 km/h. |
| City route | Signals, crosswalks, usable right turn, ordered checkpoints and final parking bay. Automated full drive completes with 100 points. |
| Highway route | Separate six-lane road, median, guardrails, five traffic vehicles, 80 km/h limit and 740 m destination. Full drive completes with 100 points. |
| Rain and night routes | Both complete all checkpoints and park. Night starts with headlights enabled; headlights remain user-controllable. |
| Traffic and pedestrians | Traffic stops before red signals and follows a leading vehicle. Pedestrians wait at the sidewalk on green and cross during the vehicle red phase. |
| Collisions | Colliders match actual roadside objects/vehicles/pedestrians. The cross street has no invisible x-boundary. Persistent contact is deduplicated. |
| Rear-view mirror | Actual rear-facing scene follows vehicle heading; horizontal reflection, visibility restoration, viewport restoration and toggle state verified. 30 Hz balanced / 10 Hz performance. |
| Cameras | Chase, cockpit and hood views switch without resetting the world or vehicle state. |
| Pause and recovery | Timer, traffic and position freeze. Returning to a route point stops the car while keeping session distance and progress. |
| HUD and map | Live speed, RPM, gear, distance, score, timer, target direction/distance, checkpoint progress, speed limit and signal status. |
| Lights and signals | Headlight beams, brake lights and mutually exclusive turn indicators. |
| Audio | Browser audio context activates; engine, skid, collision, indicator click and horn synthesis are implemented. Perceived audio quality is not measured by automated checks. |
| Scoring | Exact deduction values, no repeated stationary red-light penalties, whole-route speed/lane checks, missed-checkpoint penalties and zero score floor. |
| Parking completion | All checkpoints are required. Entering the bay at speed does not complete a route; stopping does. |
| Reports | JSON and CSV downloads succeed. Correct start/end times, active duration, missed checkpoints, distance and route completion are saved. Finishing twice does not duplicate a record. |
| Dashboard integration | New dates display correctly; newest sorting uses actual timestamps. Rain filter includes new rain drives. Incomplete drives are labeled and excluded from pass rate. |
| Touch and responsive layout | Steering, throttle, brake and handbrake controls with pointer capture/release. No page-level horizontal overflow at 390 px. |
| Fullscreen and graphics | Fullscreen can enter/exit; quality controls switch between balanced rendering and reduced-resolution, shadow-free performance mode. |
| Accessibility | Labeled controls, pressed states, inactive controls behind dialogs, focus containment and keyboard-accessible menus. |
| Cleanup | Unmount removes the canvas, disposes scene geometry/materials/textures, closes audio and removes input/resize listeners. |

## End-to-end route results

| Environment | Checkpoints | Parked | Score | Active time |
| --- | --- | --- | --- | --- |
| City | 4/4 | Yes | 100 | 40.1 s |
| Highway | 4/4 | Yes | 100 | 48.8 s |
| Rain | 4/4 | Yes | 100 | 39.8 s |
| Night | 4/4 | Yes | 100 | 40.1 s |

These are controlled verification runs, not user performance benchmarks. Frame rate and subjective handling/audio should also be assessed on the target physical devices. The test browser confirms rendered scenes, but it does not establish identical performance on every GPU.

## Scope

This update verifies the browser simulator's implemented feature set. Full suspension/tire deformation, rigid-body rollovers, licensed driving rules by jurisdiction, multiplayer, cloud accounts, VR, gamepad support and real-world navigation are not implemented. Unity reference scripts remain separate educational resources and have not been compiled in the Unity editor during this work.


## Product navigation

Only Overview, Driving Simulator and Driver Performance are exposed. Architecture, code, Unity guide, hierarchy and checklist sections have been removed from navigation and routing. Removed sections are no longer shipped as separate application bundles.

## Expanded feature checks

The sky and roadside dressing, live cockpit gauges, rain wipers, rear camera, proximity messages, highway cruise control, gamepad input and speed-review chart are implemented. Runtime checks cover cruise speed capture/maintenance/brake cancellation, city cruise rejection, reverse camera direction, instrument updates, wiper movement/parking/pause, and gamepad input/disconnect/edge-triggered pause/resume. Six deterministic assistance tests cover sensor geometry, heading transforms, side detection, cruise response and analog controller mapping.

Gamepad tests inject standard controller data; no physical controller was connected during verification. Proximity sensors use the simulation collider footprints. Reverse guide lines are visual references. The engine remains a simplified planar driving simulator with procedural graphics and scripted traffic.
