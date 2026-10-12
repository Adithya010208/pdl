import * as THREE from "three";
import { VehicleState, ScenarioId } from "./model";

export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color("#477da7") },
    horizon: { value: new THREE.Color("#dce6df") },
    sunColor: { value: new THREE.Color("#fff0ce") },
    sunDirection: { value: new THREE.Vector3(-0.45, 0.55, -0.35).normalize() },
    night: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 direction; uniform vec3 top,horizon,sunColor,sunDirection; uniform float night;
    float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
    void main(){ vec3 d=normalize(direction); float t=pow(max(d.y,0.),.55); vec3 c=mix(horizon,top,t); float sun=max(dot(d,sunDirection),0.); c+=sunColor*(pow(sun,500.)*.7+pow(sun,12.)*.12)*(1.-night); float stars=step(.9985,hash(floor(d*650.)))*smoothstep(.05,.4,d.y); c+=vec3(stars*.65*night); gl_FragColor=vec4(c,1.); }`,
  });
  const root = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), material);
  root.frustumCulled = false;
  root.renderOrder = -10;
  return { root, material, uniforms };
}
export function setSky(sky: ReturnType<typeof createSky>, id: ScenarioId) {
  sky.uniforms.top.value.set(
    id === "night" ? "#071322" : id === "rain" ? "#5b6979" : "#397fb3",
  );
  sky.uniforms.horizon.value.set(
    id === "night" ? "#293b49" : id === "rain" ? "#b1b9ba" : "#e2eced",
  );
  sky.uniforms.night.value = id === "night" ? 1 : id === "rain" ? 0.8 : 0;
}

export function createInterior(body: THREE.Group) {
  const root = new THREE.Group();
  body.add(root);
  const trim = new THREE.MeshStandardMaterial({
    color: 0x1a2025,
    roughness: 0.85,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x657582,
    metalness: 0.7,
    roughness: 0.3,
  });
  const add = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  add(1.5, 0.23, 0.35, 0, 0.99, 0.73, trim);
  add(1.45, 0.018, 0.04, 0, 1.07, 0.52, accent);
  for (const x of [-0.6, 0.62]) {
    add(0.22, 0.065, 0.025, x, 1.06, 0.53, trim);
    for (let i = 0; i < 4; i++)
      add(0.19, 0.005, 0.01, x, 1.04 + i * 0.015, 0.51, accent);
  }
  // Windscreen pillars and mirror housing remain visible when the exterior roof is hidden.
  for (const x of [-0.73, 0.73]) {
    const pillar = add(0.025, 0.5, 0.04, x, 1.42, 1.05, trim);
    pillar.rotation.x = 0.5;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.225),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  panel.position.set(0.35, 1.22, 0.7);
  panel.rotation.y = Math.PI;
  root.add(panel);
  const wipers: THREE.Group[] = [];
  for (const x of [-0.45, 0.22]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.02, 1.05);
    root.add(pivot);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.55, 0.015),
      trim,
    );
    blade.position.y = 0.25;
    pivot.add(blade);
    wipers.push(pivot);
  }
  return { root, canvas, texture, wipers, lastDraw: -1 };
}
export function updateInterior(
  interior: ReturnType<typeof createInterior>,
  p: VehicleState,
  time: number,
  cockpit: boolean,
  rain: boolean,
  wipers: boolean,
  lights: boolean,
) {
  interior.root.visible = cockpit;
  for (const [i, w] of interior.wipers.entries()) {
    w.visible = rain && cockpit;
    w.rotation.z = wipers ? -0.7 + Math.sin(time * 5 + i * 0.12) * 0.75 : -1.25;
  }
  if (!cockpit || Math.floor(time * 10) === interior.lastDraw) return;
  interior.lastDraw = Math.floor(time * 10);
  const c = interior.canvas.getContext("2d")!;
  c.fillStyle = "#080e16";
  c.fillRect(0, 0, 512, 192);
  c.strokeStyle = "#253544";
  c.lineWidth = 5;
  for (const x of [98, 405]) {
    c.beginPath();
    c.arc(x, 102, 66, Math.PI * 0.75, Math.PI * 2.25);
    c.stroke();
  }
  const dial = (x: number, v: number, max: number, color: string) => {
    c.strokeStyle = color;
    c.lineWidth = 7;
    c.beginPath();
    c.arc(
      x,
      102,
      66,
      Math.PI * 0.75,
      Math.PI * 0.75 + Math.min(v / max, 1) * Math.PI * 1.5,
    );
    c.stroke();
  };
  const speed = Math.abs(p.speed) * 3.6;
  dial(98, speed, 160, "#76d6c5");
  dial(405, 850 + Math.abs(p.speed) * 110, 6500, "#c0d1ec");
  c.textAlign = "center";
  c.fillStyle = "#edf6fb";
  c.font = "500 42px sans-serif";
  c.fillText(String(Math.round(speed)), 98, 117);
  c.font = "18px sans-serif";
  c.fillText("km/h", 98, 145);
  c.fillText(
    String(Math.round((850 + Math.abs(p.speed) * 110) / 100) / 10),
    405,
    114,
  );
  c.font = "13px sans-serif";
  c.fillText("×1000 RPM", 405, 140);
  c.font = "32px sans-serif";
  c.fillText(p.gear, 256, 97);
  c.fillStyle = "#8bacae";
  c.font = "14px sans-serif";
  c.fillText((p.distance / 1000).toFixed(2) + " km", 256, 133);
  c.fillText(lights ? "LIGHTS ON" : "PDL DRIVE", 256, 162);
  interior.texture.needsUpdate = true;
}
