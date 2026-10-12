import * as THREE from "three";
import {
  createInterior,
  updateInterior,
  createSky,
  setSky,
} from "./presentation";
import {
  senseProximity,
  cruiseInput,
  gamepadInput,
  Proximity,
} from "./assistance";
import { ProceduralVehicleAudio } from "../utils/audioEngine";
import {
  CameraMode,
  DriveMode,
  Inputs,
  Gear,
  ScenarioId,
  SCENARIOS,
  createSession,
  createVehicle,
  isOnRoad,
  overlapsVehicle,
  recordEvent,
  shiftGear,
  signalAt,
  stepVehicle,
  updateSession,
} from "./model";
import { createCar, createWorld, disposeGroup, updateWorld } from "./world";
export interface Snapshot {
  mode: DriveMode;
  scenario: ScenarioId;
  camera: CameraMode;
  speed: number;
  rpm: number;
  gear: Gear;
  steer: number;
  distance: number;
  elapsed: number;
  score: number;
  checkpoint: number;
  targetDistance: number;
  x: number;
  z: number;
  heading: number;
  signal: "green" | "yellow" | "red";
  headlights: boolean;
  audio: boolean;
  indicator: "left" | "right" | null;
  alert: string | null;
  onRoad: boolean;
  fps: number;
  quality: "balanced" | "performance";
  mirror: boolean;
  wipers: boolean;
  cruise: number | null;
  proximity: Proximity;
  gamepad: boolean;
}
export class DrivingRuntime {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(64, 1, 0.08, 1500);
  private renderer: THREE.WebGLRenderer;
  private vehicle = createVehicle(SCENARIOS.city.start);
  private session = createSession();
  private world = createWorld(SCENARIOS.city);
  private car = createCar(0x477c9b);
  private interior = createInterior(this.car.body);
  private skyDome = createSky();
  private wipers = false;
  private cruise: number | null = null;
  private proximity: Proximity = {
    front: Infinity,
    rear: Infinity,
    left: false,
    right: false,
  };
  private gamepadConnected = false;
  private padWasActive = false;
  private padButtons = new Set<number>();
  private mode: DriveMode = "ready";
  private cameraMode: CameraMode = "chase";
  private input: Inputs = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  private lights = false;
  private sound = false;
  private indicator: "left" | "right" | null = null;
  private audio = new ProceduralVehicleAudio();
  private mirrorEnabled = true;
  private rearCamera = new THREE.PerspectiveCamera(65, 3, 0.1, 1500);
  private mirrorTarget = new THREE.WebGLRenderTarget(384, 128);
  private mirrorScene = new THREE.Scene();
  private mirrorCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mirrorMaterial = new THREE.MeshBasicMaterial({
    map: this.mirrorTarget.texture,
    depthTest: false,
    depthWrite: false,
  });
  private mirrorGeometry = new THREE.PlaneGeometry(2, 2);
  private mirrorTime = 1;
  private frame = 0;
  private lastTime = 0;
  private accumulator = 0;
  private hudTime = 0;
  private fps = 60;
  private disposed = false;
  private sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
  private sky = new THREE.HemisphereLight(0xdae9ed, 0x636e52, 2);
  private resizeObserver: ResizeObserver;
  private cameraPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private initialCamera = true;
  private quality: "balanced" | "performance" = "balanced";
  private lastBlinkPhase = -1;
  private contactUntil = 0;
  private recoveringMessageUntil = 0;
  constructor(
    private container: HTMLElement,
    private onSnapshot: (s: Snapshot) => void,
    private onFinish: () => void,
    private onError: (message: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.mirrorTarget.texture.repeat.x = -1;
    this.mirrorTarget.texture.offset.x = 1;
    this.mirrorScene.add(
      new THREE.Mesh(this.mirrorGeometry, this.mirrorMaterial),
    );
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D driving environment",
    );
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.scene.add(
      this.world.root,
      this.skyDome.root,
      this.car.root,
      this.sky,
      this.sun,
      this.sun.target,
    );
    this.sun.position.set(-35, 70, -20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    updateWorld(this.world, this.vehicle, 0, 0, 0);
    this.setAtmosphere();
    this.emit();
    this.frame = requestAnimationFrame(this.animate);
    document.addEventListener("visibilitychange", this.visibilityChange);
  }
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.onError(
      "The 3D graphics context was lost. Reload the simulator to restore it.",
    );
  };
  private visibilityChange = () => {
    if (document.hidden) this.pause();
  };
  private resize() {
    const width = this.container.clientWidth,
      height = this.container.clientHeight;
    if (width < 1 || height < 1) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  private setAtmosphere() {
    const id = this.world.config.id;
    setSky(this.skyDome, id);
    const night = id === "night",
      rain = id === "rain";
    const color = night ? 0x172b36 : rain ? 0x8e9c9f : 0xb7d0d7;
    this.scene.background = new THREE.Color(color);
    this.scene.fog = new THREE.Fog(
      color,
      night ? 30 : rain ? 55 : 120,
      night ? 170 : rain ? 210 : 650,
    );
    this.sun.intensity = night ? 0.18 : rain ? 1.1 : 2.6;
    this.sky.intensity = night ? 0.7 : rain ? 1.4 : 2;
    this.renderer.toneMappingExposure = night ? 1.4 : 1.05;
  }
  selectScenario(id: ScenarioId) {
    if (this.mode === "driving" || this.mode === "paused") return;
    this.scene.remove(this.world.root);
    disposeGroup(this.world.root);
    this.world = createWorld(SCENARIOS[id]);
    this.scene.add(this.world.root);
    this.vehicle = createVehicle(this.world.config.start);
    this.session = createSession();
    this.mode = "ready";
    this.lights = id === "night";
    this.wipers = id === "rain";
    this.cruise = null;
    this.initialCamera = true;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.indicator = null;
    updateWorld(this.world, this.vehicle, 0, 0, 0);
    this.setAtmosphere();
    this.emit();
  }
  start() {
    if (this.mode !== "ready" && this.mode !== "finished") return;
    this.vehicle = createVehicle(this.world.config.start);
    this.session = createSession();
    this.cruise = null;
    this.contactUntil = 0;
    this.recoveringMessageUntil = 0;
    this.lastBlinkPhase = -1;
    this.world.traffic.forEach((agent) => {
      agent.x = agent.initialX;
      agent.z = agent.initialZ;
      agent.speed = agent.cruise;
    });
    this.world.pedestrians.forEach((ped) => {
      ped.direction = ped.z === 89 ? 1 : -1;
      ped.x = ped.direction === 1 ? -8.5 : 8.5;
    });
    updateWorld(this.world, this.vehicle, 0, 0, 0);
    this.mode = "driving";
    this.audio.setMuted(!this.sound);
    this.indicator = null;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.initialCamera = true;
    this.accumulator = 0;
    this.emit();
  }
  pause() {
    if (this.mode !== "driving") return;
    this.mode = "paused";
    this.cruise = null;
    this.clearInput();
    this.audio.setMuted(true);
    this.emit();
  }
  resume() {
    if (this.mode !== "paused") return;
    this.mode = "driving";
    this.audio.setMuted(!this.sound);
    this.emit();
  }
  finish() {
    if (this.mode !== "driving" && this.mode !== "paused") return;
    if (!this.session.completed) {
      for (
        let i = this.session.checkpoint;
        i < this.world.config.checkpoints.length;
        i++
      )
        recordEvent(
          this.session,
          "missedCheckpoint",
          "Checkpoint " + (i + 1) + " was not reached.",
        );
    }
    this.mode = "finished";
    this.cruise = null;
    this.clearInput();
    this.audio.setMuted(true);
    this.emit();
    this.onFinish();
  }
  reset() {
    this.selectScenario(this.world.config.id);
  }
  getMode() {
    return this.mode;
  }
  setInput(input: Partial<Inputs>) {
    this.padWasActive = false;
    if (input.brake || input.handbrake) this.cruise = null;
    this.input = { ...this.input, ...input };
  }
  clearInput() {
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  }
  setQuality(quality: "balanced" | "performance") {
    this.quality = quality;
    this.renderer.setPixelRatio(
      quality === "performance" ? 1 : Math.min(devicePixelRatio, 1.5),
    );
    this.renderer.shadowMap.enabled = quality === "balanced";
    this.resize();
    this.emit();
  }
  toggleWipers() {
    this.wipers = !this.wipers;
    this.emit();
  }
  toggleCruise() {
    if (this.cruise !== null) this.cruise = null;
    else if (
      this.mode === "driving" &&
      this.world.config.id === "highway" &&
      this.vehicle.gear === "D" &&
      this.vehicle.speed * 3.6 >= 20
    )
      this.cruise = Math.min(this.vehicle.speed, this.world.config.limit / 3.6);
    this.emit();
  }
  private pollGamepad() {
    const pad = navigator
      .getGamepads?.()
      .find((p) => p?.connected && p.mapping === "standard");
    this.gamepadConnected = Boolean(pad);
    const startPressed = pad?.buttons[9]?.pressed ?? false;
    if (startPressed && !this.padButtons.has(9)) {
      if (this.mode === "driving") this.pause();
      else if (this.mode === "paused") this.resume();
    }
    if (startPressed) this.padButtons.add(9);
    else this.padButtons.delete(9);
    if (!pad || this.mode !== "driving") {
      if (this.padWasActive) this.clearInput();
      this.padWasActive = false;
      if (!pad) {
        this.padButtons.clear();
        this.cruise = null;
      }
      return;
    }
    const input = gamepadInput(pad);
    const active =
      Math.abs(input.steer) > 0.01 ||
      input.throttle > 0.01 ||
      input.brake > 0.01 ||
      input.handbrake;
    if (active || this.padWasActive) {
      this.input = input;
      if (input.brake || input.handbrake) this.cruise = null;
      this.padWasActive = active;
    }
    for (const [i, action] of [
      [3, () => this.cycleCamera()],
      [4, () => this.toggleIndicator("left")],
      [5, () => this.toggleIndicator("right")],
      [1, () => this.horn()],
    ] as [number, () => void][]) {
      const pressed = pad.buttons[i]?.pressed;
      if (pressed && !this.padButtons.has(i)) action();
      if (pressed) this.padButtons.add(i);
      else this.padButtons.delete(i);
    }
  }
  toggleMirror() {
    this.mirrorEnabled = !this.mirrorEnabled;
    this.mirrorTime = 1;
    this.emit();
  }
  setGear(gear: Gear) {
    if (shiftGear(this.vehicle, gear)) {
      this.cruise = null;
      this.emit();
      return true;
    }
    return false;
  }
  setCamera(mode: CameraMode) {
    this.cameraMode = mode;
    this.initialCamera = true;
    this.emit();
  }
  cycleCamera() {
    this.setCamera(
      this.cameraMode === "chase"
        ? "cockpit"
        : this.cameraMode === "cockpit"
          ? "hood"
          : "chase",
    );
  }
  toggleLights() {
    this.lights = !this.lights;
    this.emit();
  }
  toggleAudio() {
    this.sound = !this.sound;
    if (this.sound) {
      this.audio.init();
    }
    this.audio.setMuted(!this.sound || this.mode !== "driving");
    this.emit();
  }
  horn() {
    if (this.sound) this.audio.playHorn();
  }
  toggleIndicator(direction: "left" | "right") {
    this.indicator = this.indicator === direction ? null : direction;
    this.emit();
  }
  recover() {
    if (this.mode !== "driving" && this.mode !== "paused") return;
    const cp =
      this.world.config.checkpoints[Math.max(0, this.session.checkpoint - 1)];
    const start = this.session.checkpoint > 0 ? cp : this.world.config.start;
    const distance = this.vehicle.distance;
    this.vehicle = createVehicle(start);
    this.vehicle.distance = distance;
    if (this.world.config.id !== "highway" && this.session.checkpoint > 2)
      this.vehicle.heading = Math.PI / 2;
    this.clearInput();
    this.initialCamera = true;
    this.recoveringMessageUntil = this.session.elapsed + 3;
    this.emit();
  }
  getData() {
    return {
      session: this.session,
      vehicle: this.vehicle,
      config: this.world.config,
    };
  }
  getSnapshot(): Snapshot {
    const p = this.vehicle,
      s = this.session,
      cp =
        this.world.config.checkpoints[s.checkpoint] ??
        this.world.config.destination;
    const last = s.events.at(-1);
    return {
      mode: this.mode,
      scenario: this.world.config.id,
      camera: this.cameraMode,
      speed: Math.abs(p.speed) * 3.6,
      rpm: Math.min(6500, 850 + Math.abs(p.speed) * 110 + p.throttle * 450),
      gear: p.gear,
      steer: (p.steer * 180) / Math.PI,
      distance: p.distance,
      elapsed: s.elapsed,
      score: s.score,
      checkpoint: s.checkpoint,
      targetDistance: Math.hypot(p.x - cp.x, p.z - cp.z),
      x: p.x,
      z: p.z,
      heading: p.heading,
      signal: signalAt(s.elapsed),
      headlights: this.lights,
      audio: this.sound,
      indicator: this.indicator,
      alert:
        this.recoveringMessageUntil > s.elapsed
          ? "Returned to your last route point."
          : last && s.elapsed - last.time < 3
            ? `${last.message} −${last.points} points`
            : null,
      onRoad: isOnRoad(this.world.config.id, p.x, p.z),
      fps: this.fps,
      quality: this.quality,
      mirror: this.mirrorEnabled,
      wipers: this.wipers,
      cruise: this.cruise === null ? null : this.cruise * 3.6,
      proximity: this.proximity,
      gamepad: this.gamepadConnected,
    };
  }
  private emit() {
    this.onSnapshot(this.getSnapshot());
  }
  private animate = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = time;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.03;
    this.pollGamepad();
    if (this.mode === "driving") {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.tick(1 / 120);
        this.accumulator -= 1 / 120;
        if (this.mode !== "driving") {
          this.accumulator = 0;
          break;
        }
      }
    }
    this.updateVisuals(dt);
    this.renderViews(dt);
    this.hudTime += dt;
    if (this.hudTime >= 0.1) {
      this.hudTime = 0;
      this.emit();
    }
  };
  private renderViews(dt: number) {
    const renderer = this.renderer;
    const width = this.container.clientWidth,
      height = this.container.clientHeight;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.render(this.scene, this.camera);
    if (
      !this.mirrorEnabled ||
      (this.mode !== "driving" && this.mode !== "paused")
    )
      return;
    this.mirrorTime += dt;
    if (this.mirrorTime >= (this.quality === "performance" ? 0.1 : 1 / 30)) {
      this.mirrorTime = 0;
      const p = this.vehicle;
      const forward = new THREE.Vector3(
        Math.sin(p.heading),
        0,
        -Math.cos(p.heading),
      );
      this.rearCamera.position.set(p.x, 1.7, -p.z);
      this.rearCamera.lookAt(
        this.rearCamera.position.clone().addScaledVector(forward, -20),
      );
      const visible = this.car.root.visible;
      this.car.root.visible = false;
      renderer.setRenderTarget(this.mirrorTarget);
      renderer.render(this.scene, this.rearCamera);
      this.car.root.visible = visible;
    }
    const w = Math.min(230, width * 0.45),
      h = w / 3;
    renderer.setRenderTarget(null);
    renderer.setViewport(
      (width - w) / 2,
      height - (width < 600 ? 170 : 110) - h,
      w,
      h,
    );
    renderer.setScissor(
      (width - w) / 2,
      height - (width < 600 ? 170 : 110) - h,
      w,
      h,
    );
    renderer.setScissorTest(true);
    renderer.autoClear = false;
    renderer.render(this.mirrorScene, this.mirrorCamera);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
  }
  private tick(dt: number) {
    const p = this.vehicle,
      previous = { x: p.x, z: p.z };
    const previousSpeed = p.speed;
    stepVehicle(
      p,
      this.cruise === null
        ? this.input
        : cruiseInput(this.input, p.speed, this.cruise),
      dt,
      this.world.config.grip,
      isOnRoad(this.world.config.id, p.x, p.z),
    );
    const dynamic = updateWorld(
      this.world,
      p,
      this.session.elapsed,
      dt,
      this.session.checkpoint,
    );
    this.proximity = senseProximity(p, [...this.world.obstacles, ...dynamic]);
    const contacts = new Set<string>();
    let hit = false;
    for (const obstacle of [...this.world.obstacles, ...dynamic]) {
      if (overlapsVehicle(p, obstacle)) {
        contacts.add(obstacle.id);
        hit = true;
        if (
          !this.session.collisionContacts.has(obstacle.id) &&
          this.session.elapsed >= this.contactUntil &&
          (Math.abs(previousSpeed) > 0.3 || (obstacle.speed ?? 0) > 0.3)
        ) {
          recordEvent(
            this.session,
            "collision",
            obstacle.kind === "pedestrian"
              ? "Contact with a pedestrian."
              : obstacle.kind === "traffic"
                ? "Contact with a traffic vehicle."
                : "Contact with a roadside object.",
          );
          this.contactUntil = this.session.elapsed + 0.8;
          this.audio.playCrash(0.6);
        }
      }
    }
    if (hit) {
      this.cruise = null;
      p.x = previous.x;
      p.z = previous.z;
      p.speed = 0;
      p.vx = 0;
      p.vz = 0;
      p.acceleration = 0;
    }
    this.session.collisionContacts = contacts;
    // The terrain is finite; recover safely rather than driving into an empty world.
    if (
      Math.abs(p.x) > 260 ||
      p.z < -150 ||
      p.z > (this.world.config.id === "highway" ? 840 : 330)
    )
      this.recover();
    updateSession(this.session, p, previous, this.world.config, dt);
    if (this.session.completed) this.finish();
  }
  private updateVisuals(dt: number) {
    const p = this.vehicle;
    this.skyDome.root.position.set(p.x, 0, -p.z);
    updateInterior(
      this.interior,
      p,
      this.session.elapsed,
      this.cameraMode === "cockpit",
      this.world.config.id === "rain",
      this.wipers,
      this.lights,
    );
    this.car.root.position.set(p.x, 0, -p.z);
    this.car.root.rotation.y = Math.PI - p.heading;
    this.car.body.rotation.z = THREE.MathUtils.damp(
      this.car.body.rotation.z,
      -p.yawRate * Math.abs(p.speed) * 0.002,
      5,
      dt,
    );
    this.car.body.rotation.x = THREE.MathUtils.damp(
      this.car.body.rotation.x,
      p.acceleration * 0.003,
      5,
      dt,
    );
    this.car.frontWheels.forEach((w) => (w.rotation.y = -p.steer));
    this.car.wheels.forEach((w) => (w.rotation.x = p.wheelRotation));
    this.car.wheel.rotation.z = -p.steer * 5;
    this.car.brakeMaterial.emissiveIntensity =
      this.input.brake > 0 || this.input.handbrake ? 2 : 0.15;
    const blink = Math.floor(this.session.elapsed / 0.45) % 2 === 0;
    const phase = Math.floor(this.session.elapsed / 0.45);
    if (
      this.sound &&
      this.indicator &&
      this.mode === "driving" &&
      phase !== this.lastBlinkPhase
    )
      this.audio.playBlinkerClick();
    this.lastBlinkPhase = phase;
    this.car.leftIndicator.emissiveIntensity =
      this.indicator === "left" && blink ? 2 : 0;
    this.car.rightIndicator.emissiveIntensity =
      this.indicator === "right" && blink ? 2 : 0;
    this.car.headlights.forEach((l) => (l.intensity = this.lights ? 28 : 0));
    this.car.cabin.visible = this.cameraMode !== "cockpit";
    this.car.body.visible = this.cameraMode !== "hood";
    if (this.sound && this.mode === "driving")
      this.audio.update(
        Math.abs(p.speed) * 3.6,
        p.throttle,
        this.input.brake > 0 || this.input.handbrake,
        this.input.handbrake && Math.abs(p.speed) > 4,
      );
    const forward = new THREE.Vector3(
      Math.sin(p.heading),
      0,
      -Math.cos(p.heading),
    );
    const pos = new THREE.Vector3(p.x, 0, -p.z);
    let desired: THREE.Vector3;
    if (p.gear === "R") {
      desired = pos
        .clone()
        .addScaledVector(forward, -2.35)
        .add(new THREE.Vector3(0, 1.05, 0));
      this.cameraTarget.copy(desired).addScaledVector(forward, -20).y = 0.6;
    } else if (this.cameraMode === "chase") {
      desired = pos
        .clone()
        .addScaledVector(
          forward,
          -7.5 - Math.min(Math.abs(p.speed) * 0.05, 1.2),
        )
        .add(new THREE.Vector3(0, 3.9, 0));
      this.cameraTarget.copy(pos).addScaledVector(forward, 8).y = 1.2;
    } else {
      const local = new THREE.Vector3(
        this.cameraMode === "cockpit" ? 0.35 : 0,
        this.cameraMode === "cockpit" ? 1.36 : 1.1,
        this.cameraMode === "cockpit" ? -0.35 : 1.8,
      ).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - p.heading);
      desired = pos.clone().add(local);
      this.cameraTarget.copy(desired).addScaledVector(forward, 30);
    }
    if (this.initialCamera || this.cameraMode !== "chase" || p.gear === "R") {
      this.cameraPosition.copy(desired);
      this.initialCamera = false;
    } else this.cameraPosition.lerp(desired, 1 - Math.exp(-6 * dt));
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
    const fov = 64 + Math.min(Math.abs(p.speed) * 0.16, 6);
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.world.config.id === "night")
      this.world.lamps.forEach((light) => {
        light.intensity =
          this.quality === "performance" &&
          Math.hypot(light.position.x - p.x, light.position.z - p.z) > 50
            ? 0
            : 20;
      });
    this.sun.position.set(p.x - 35, 70, -p.z - 20);
    this.sun.target.position.set(p.x, 0, -p.z);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.visibilityChange);
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.audio.dispose();
    disposeGroup(this.world.root);
    disposeGroup(this.car.root);
    this.skyDome.root.geometry.dispose();
    this.skyDome.material.dispose();
    this.mirrorTarget.dispose();
    this.mirrorMaterial.dispose();
    this.mirrorGeometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
