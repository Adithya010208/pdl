import * as THREE from "three";
import { dressRoad } from "./scenery";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BoxObstacle, Scenario, VehicleState, signalAt } from "./model";
const material = (color: number, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness });
function box(
  group: THREE.Group | THREE.Scene,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  shadow = true,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function plane(
  group: THREE.Group,
  w: number,
  d: number,
  x: number,
  z: number,
  mat: THREE.Material,
  y = 0.03,
) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function label(
  text: string,
  color = "#26382e",
  background = "#ecefe3",
  width = 4,
  height = 1.4,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 180;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 488, 156);
  ctx.fillStyle = color;
  ctx.font = "600 48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 90, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  mesh.userData.isLabel = true;
  return mesh;
}
export interface CarVisual {
  root: THREE.Group;
  body: THREE.Group;
  cabin: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  brakeMaterial: THREE.MeshStandardMaterial;
  leftIndicator: THREE.MeshStandardMaterial;
  rightIndicator: THREE.MeshStandardMaterial;
  headlights: THREE.SpotLight[];
  wheel: THREE.Group;
}
export function createCar(color = 0xb9c8b1, reflected = false): CarVisual {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    cabin = new THREE.Group();
  root.add(body);
  body.add(cabin);
  const paint = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.45,
    roughness: 0.27,
  });
  const black = material(0x172223, 0.4),
    chrome = new THREE.MeshStandardMaterial({
      color: 0x8c9a9b,
      metalness: 0.8,
      roughness: 0.25,
    });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x34464a,
    metalness: 0.4,
    roughness: 0.12,
  });
  const shape = new THREE.Shape();
  shape.moveTo(-0.88, -0.25);
  shape.lineTo(0.88, -0.25);
  shape.lineTo(0.88, 0.25);
  shape.lineTo(-0.88, 0.25);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 4.1,
    bevelEnabled: true,
    bevelSize: 0.09,
    bevelThickness: 0.1,
    bevelSegments: 2,
    steps: 1,
  });
  bodyGeo.translate(0, 0.66, -2.05);
  const chassis = new THREE.Mesh(bodyGeo, paint);
  chassis.castShadow = true;
  body.add(chassis);
  box(body, 1.76, 0.13, 4.15, 0, 0.4, 0, black);
  const sideShape = new THREE.Shape();
  sideShape.moveTo(-1.35, 0.89);
  sideShape.lineTo(-0.82, 1.47);
  sideShape.lineTo(0.5, 1.47);
  sideShape.lineTo(1.2, 0.89);
  sideShape.closePath();
  const cabinGeo = new THREE.ExtrudeGeometry(sideShape, {
    depth: 1.52,
    bevelEnabled: true,
    bevelSize: 0.045,
    bevelThickness: 0.035,
    bevelSegments: 1,
  });
  cabinGeo.translate(0, 0, -0.76);
  cabinGeo.rotateY(-Math.PI / 2);
  const roof = new THREE.Mesh(cabinGeo, glass);
  roof.castShadow = true;
  cabin.add(roof);
  box(cabin, 1.48, 0.055, 1.2, 0, 1.51, -0.15, paint);
  box(cabin, 0.07, 0.55, 1.9, -0.77, 1.16, -0.1, paint);
  box(cabin, 0.07, 0.55, 1.9, 0.77, 1.16, -0.1, paint);
  for (const x of [-0.8, 0.8]) {
    box(cabin, 0.06, 0.52, 0.075, x, 1.16, -0.35, paint);
    box(body, 0.12, 0.035, 0.23, x * 1.14, 0.83, -0.45, chrome);
    box(body, 0.2, 0.11, 0.32, x * 1.24, 1.02, 0.65, paint);
  }
  box(body, 1.55, 0.16, 0.05, 0, 0.55, 2.18, black);
  box(body, 1.52, 0.14, 0.06, 0, 0.5, -2.18, black);
  const plate = label("PDL · DRIVE", "#23372f", "#ecedde", 0.62, 0.16);
  plate.position.set(0, 0.61, -2.23);
  plate.rotation.y = Math.PI;
  if (reflected) plate.scale.x = -1;
  body.add(plate);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xe7ecdc,
    emissive: 0xe7ecdc,
    emissiveIntensity: 0.8,
  });
  for (const x of [-0.64, 0.64])
    box(body, 0.43, 0.14, 0.07, x, 0.76, 2.16, headMat);
  const brakeMaterial = new THREE.MeshStandardMaterial({
    color: 0x772427,
    emissive: 0xc52228,
    emissiveIntensity: 0.15,
  });
  for (const x of [-0.64, 0.64])
    box(body, 0.43, 0.14, 0.07, x, 0.76, -2.16, brakeMaterial);
  const leftIndicator = new THREE.MeshStandardMaterial({
    color: 0x9a5d23,
    emissive: 0xffad24,
    emissiveIntensity: 0,
  });
  const rightIndicator = leftIndicator.clone();
  for (const z of [-2.18, 2.18]) {
    box(body, 0.12, 0.1, 0.05, -0.86, 0.76, z, rightIndicator);
    box(body, 0.12, 0.1, 0.05, 0.86, 0.76, z, leftIndicator);
  }
  const wheels: THREE.Group[] = [],
    frontWheels: THREE.Group[] = [];
  for (const z of [1.3, -1.3])
    for (const x of [-0.93, 0.93]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.37, z);
      const spin = new THREE.Group();
      pivot.add(spin);
      root.add(pivot);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.37, 0.37, 0.25, 20),
        black,
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spin.add(tire);
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.27, 12),
        chrome,
      );
      rim.rotation.z = Math.PI / 2;
      spin.add(rim);
      for (let a = 0; a < 5; a++) {
        const spoke = box(spin, 0.28, 0.035, 0.4, 0, 0, 0, chrome, false);
        spoke.rotation.x = (a * Math.PI) / 5;
      }
      wheels.push(spin);
      if (z > 0) frontWheels.push(pivot);
    }
  // Interior remains visible in cockpit mode while the roof shell is hidden.
  box(body, 1.45, 0.14, 0.42, 0, 0.94, 0.78, black);
  box(body, 1.45, 0.08, 0.32, 0, 0.85, 0.58, black);
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 8, 24), black);
  wheel.add(rim);
  box(wheel, 0.34, 0.03, 0.025, 0, 0, 0, chrome);
  box(wheel, 0.03, 0.17, 0.025, 0, -0.07, 0, chrome);
  wheel.position.set(0.35, 1.04, 0.42);
  wheel.rotation.x = -0.25;
  body.add(wheel);
  const headlights: THREE.SpotLight[] = [];
  for (const x of [-0.64, 0.64]) {
    const light = new THREE.SpotLight(0xffeac1, 0, 65, 0.42, 0.45, 1);
    light.position.set(x, 0.75, 2.15);
    const target = new THREE.Object3D();
    target.position.set(x, 0.12, 40);
    root.add(light, target);
    light.target = target;
    headlights.push(light);
  }
  return {
    root,
    body,
    cabin,
    wheels,
    frontWheels,
    brakeMaterial,
    leftIndicator,
    rightIndicator,
    headlights,
    wheel,
  };
}
export interface TrafficAgent {
  car: CarVisual;
  x: number;
  z: number;
  axis: "x" | "z";
  direction: number;
  speed: number;
  cruise: number;
  initialX: number;
  initialZ: number;
}
export interface Pedestrian {
  root: THREE.Group;
  x: number;
  z: number;
  direction: number;
  legs: THREE.Mesh[];
}
export interface World {
  root: THREE.Group;
  obstacles: BoxObstacle[];
  traffic: TrafficAgent[];
  pedestrians: Pedestrian[];
  signals: THREE.Mesh[];
  checkpoints: THREE.Group[];
  rain: THREE.LineSegments | null;
  lamps: THREE.PointLight[];
  config: Scenario;
}
export function createWorld(config: Scenario): World {
  const root = new THREE.Group(),
    obstacles: BoxObstacle[] = [],
    traffic: TrafficAgent[] = [],
    pedestrians: Pedestrian[] = [],
    signals: THREE.Mesh[] = [],
    checkpoints: THREE.Group[] = [],
    lamps: THREE.PointLight[] = [];
  const highway = config.id === "highway";
  const ground = material(highway ? 0x87977b : 0x95a384);
  const pavement = material(0xa6aaa0),
    curb = material(0xc3c6bb),
    white = material(0xe5e6d7),
    yellow = material(0xbfac65),
    metal = material(0x505d56, 0.4);
  // Fine asphalt grain, generated locally. No network asset dependency.
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const cx = c.getContext("2d")!;
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let x = 0; x < 128; x++)
    for (let y = 0; y < 128; y++) {
      const g = 53 + Math.floor(rnd() * 18);
      cx.fillStyle = `rgb(${g},${g + 3},${g + 2})`;
      cx.fillRect(x, y, 1, 1);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 70);
  tex.colorSpace = THREE.SRGBColorSpace;
  const road = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xc3c8c1,
    roughness: config.id === "rain" ? 0.32 : 0.9,
    metalness: config.id === "rain" ? 0.25 : 0,
  });
  plane(root, 1200, 1600, 0, 300, ground, 0);
  plane(
    root,
    highway ? 24 : 14,
    highway ? 940 : 440,
    0,
    highway ? 350 : 90,
    road,
    0.015,
  );
  if (!highway) {
    const crossMat = road.clone();
    crossMat.map = tex.clone();
    crossMat.map.repeat.set(55, 2);
    plane(root, 360, 14, 0, 100, crossMat, 0.016);
    for (const x of [-9, 9]) {
      plane(root, 4, 440, x, 90, pavement, 0.07);
      box(root, 0.3, 0.18, 440, x < 0 ? -7.15 : 7.15, 0.09, 90, curb, false);
    }
    for (const z of [91, 109]) {
      plane(root, 360, 4, 0, z, pavement, 0.071);
      box(root, 360, 0.18, 0.3, 0, 0.09, z < 100 ? 92.85 : 107.15, curb, false);
    }
    // Interrupt sidewalk strips through the intersection so roads remain unobstructed.
    plane(root, 22, 22, 0, 100, road, 0.1);
    for (let z = -120; z < 310; z += 9) {
      if (z > 83 && z < 117) continue;
      plane(root, 0.16, 4, 0, z, white, 0.11);
      for (const x of [-6.5, 6.5]) plane(root, 0.12, 5, x, z, white, 0.11);
    }
    for (let x = -170; x < 180; x += 9) {
      if (Math.abs(x) < 14) continue;
      plane(root, 4, 0.16, x, 100, white, 0.11);
    }
    for (let x = -6; x < 7; x += 1.5) {
      plane(root, 0.75, 3.5, x, 89, white, 0.12);
      plane(root, 0.75, 3.5, x, 111, white, 0.12);
    }
    for (let z = 94; z < 107; z += 1.5) {
      plane(root, 3.5, 0.75, 11, z, white, 0.12);
      plane(root, 3.5, 0.75, -11, z, white, 0.12);
    }
    plane(root, 6.3, 0.45, 3.4, 84, white, 0.12);
    plane(root, 6.3, 0.45, -3.4, 116, white, 0.12);
    for (const [x, z, rotation] of [
      [8.5, 86, Math.PI],
      [-8.5, 114, 0],
    ] as number[][]) {
      box(root, 0.13, 5, 0.13, x, 2.5, z, metal);
      const pole = new THREE.Group();
      pole.position.set(x, 0, z);
      pole.rotation.y = rotation;
      box(pole, 6, 0.12, 0.12, 2.7, 4.8, 0, metal);
      box(pole, 0.55, 1.55, 0.35, 5.2, 4, 0, material(0x25332d));
      for (let i = 0; i < 3; i++) {
        const lens = new THREE.Mesh(
          new THREE.CircleGeometry(0.17, 16),
          new THREE.MeshBasicMaterial({ color: 0x233c31 }),
        );
        lens.position.set(5.2, 4.5 - i * 0.5, 0.19);
        pole.add(lens);
        signals.push(lens);
      }
      root.add(pole);
    }
    // Buildings with coherent facades, windows, rooftop details and actual colliders.
    const buildingMaterials = [0xc3b6a1, 0x8b9b92, 0xb6b5a6, 0x989c94].map(
      (color) => material(color),
    );
    const windowMat = new THREE.MeshStandardMaterial({
      color: config.id === "night" ? 0xe6c78b : 0x536d70,
      emissive: config.id === "night" ? 0xbda565 : 0x000000,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    for (const x of [-42, -22, 24, 48, 73, 102, 128, 158])
      for (const z of [-85, -47, -10, 30, 64, 135, 170, 210, 255]) {
        const width = 11 + rnd() * 6,
          depth = 13 + rnd() * 7,
          h = 7 + Math.floor(rnd() * 5) * 3;
        const mat = buildingMaterials[Math.floor(rnd() * 4)];
        box(root, width, h, depth, x, h / 2, z, mat);
        box(root, width + 0.5, 0.2, depth + 0.5, x, h + 0.1, z, curb);
        obstacles.push({
          id: `building-${x}-${z}`,
          x,
          z,
          halfX: width / 2,
          halfZ: depth / 2,
          kind: "obstacle",
        });
        for (let y = 2; y < h - 1; y += 3)
          for (let wx = -width / 2 + 1.5; wx < width / 2 - 1; wx += 2.7) {
            box(
              root,
              1.2,
              1.6,
              0.04,
              x + wx,
              y,
              z - depth / 2 - 0.03,
              windowMat,
              false,
            );
            box(
              root,
              1.2,
              1.6,
              0.04,
              x + wx,
              y,
              z + depth / 2 + 0.03,
              windowMat,
              false,
            );
          }
      }
  } else {
    // Separate highway geometry: six lanes, concrete median and visible guardrails.
    box(root, 1.4, 0.75, 940, 0, 0.375, 350, curb);
    obstacles.push({
      id: "median",
      x: 0,
      z: 350,
      halfX: 0.7,
      halfZ: 470,
      kind: "obstacle",
    });
    for (const x of [-12.4, 12.4]) {
      box(root, 0.2, 0.5, 940, x, 0.9, 350, metal, false);
      obstacles.push({
        id: `rail${x}`,
        x,
        z: 350,
        halfX: 0.1,
        halfZ: 470,
        kind: "obstacle",
      });
      for (let z = -110; z < 820; z += 12)
        box(root, 0.12, 0.9, 0.12, x, 0.45, z, metal, false);
    }
    for (const x of [-8, -4, 4, 8])
      for (let z = -110; z < 820; z += 12)
        plane(root, 0.16, 5, x, z, white, 0.04);
    for (const x of [-11.5, -1.3, 1.3, 11.5])
      plane(
        root,
        0.15,
        940,
        x,
        350,
        x === 1.3 || x === -1.3 ? yellow : white,
        0.04,
      );
    const overhead = new THREE.Group();
    box(overhead, 0.25, 7, 0.25, -14, 3.5, 160, metal);
    box(overhead, 0.25, 7, 0.25, 14, 3.5, 160, metal);
    box(overhead, 28, 0.25, 0.25, 0, 7, 160, metal);
    const sign = label("NORTH / PRACTICE ROUTE", "#e1e8d9", "#2f5b48", 10, 2);
    sign.position.set(6, 6, 160);
    sign.rotation.y = Math.PI;
    overhead.add(sign);
    root.add(overhead);
  }
  // Trees use rounded canopies and trunks, at deterministic roadside positions.
  const trunk = material(0x6d6450),
    leaf = material(0x536f52);
  for (let z = -100; z < (highway ? 820 : 300); z += 17)
    for (const side of [-1, 1]) {
      if (!highway && Math.abs(z - 100) < 19) continue;
      const x = side * (highway ? 18 : 13);
      box(root, 0.35, 2, 0.35, x, 1, z, trunk);
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.8, 1),
        leaf,
      );
      foliage.position.set(x, 3, z);
      foliage.scale.y = 1.15;
      foliage.castShadow = true;
      root.add(foliage);
      obstacles.push({
        id: `tree${x}-${z}`,
        x,
        z,
        halfX: 0.25,
        halfZ: 0.25,
        kind: "obstacle",
      });
    }
  // Street lighting on city routes, active for the night scenario.
  if (!highway)
    for (let z = -80; z < 290; z += 30) {
      for (const x of [-8.5, 8.5]) {
        box(root, 0.1, 5, 0.1, x, 2.5, z, metal);
        box(root, 1.5, 0.1, 0.1, x - Math.sign(x) * 0.7, 5, z, metal);
        box(root, 0.4, 0.08, 0.3, x - Math.sign(x) * 1.4, 4.95, z, white);
        const light = new THREE.PointLight(
          0xffdba0,
          config.id === "night" ? 20 : 0,
          18,
          2,
        );
        light.position.set(x - Math.sign(x) * 1.4, 4.8, z);
        root.add(light);
        lamps.push(light);
      }
    }
  // Regulatory speed signs and wayfinding along the entire route.
  for (const z of highway ? [30, 270, 520, 680] : [20, 60, 130]) {
    box(root, 0.06, 2.8, 0.06, highway ? 13.3 : 8, 1.4, z, metal);
    const sign = label(`${config.limit}`, "#313e35", "#eeede1", 1, 1);
    sign.position.set(highway ? 13.3 : 8, 2.4, z);
    sign.rotation.y = Math.PI;
    root.add(sign);
  }
  config.checkpoints.forEach((cp, index) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.8, 3, 40),
      new THREE.MeshBasicMaterial({
        color: 0xbdd09e,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    g.add(ring);
    const marker = label(String(index + 1), "#e9ecd9", "#416347", 0.85, 0.85);
    marker.position.set(0, 3.5, 0);
    g.add(marker);
    g.position.set(cp.x, 0, cp.z);
    root.add(g);
    checkpoints.push(g);
  });
  const bay = new THREE.Group();
  const { x, z } = config.destination;
  plane(
    bay,
    highway ? 4 : 8,
    highway ? 8 : 4,
    x,
    z,
    new THREE.MeshBasicMaterial({
      color: 0x628370,
      transparent: true,
      opacity: 0.55,
    }),
    0.15,
  );
  for (const dz of [-2, 2]) plane(bay, 8, 0.12, x, z + dz, white, 0.16);
  for (const dx of [-4, 4]) plane(bay, 0.12, 4, x + dx, z, white, 0.16);
  const park = label("P / STOP HERE", "#e1eadb", "#2e5944", 3, 0.85);
  park.position.set(x, 2.4, z + 6);
  park.rotation.y = Math.PI;
  bay.add(park);
  root.add(bay);
  dressRoad(root, config.id);
  root.traverse((object) => {
    if (object.userData.isLabel) object.scale.x = -1;
  });
  // Batch static meshes by material to keep city draw calls manageable.
  root.updateMatrixWorld(true);
  const excluded = new Set<THREE.Object3D>([
    ...signals,
    ...checkpoints.flatMap((g) => g.children),
  ]);
  const batches = new Map<
    THREE.Material,
    {
      objects: THREE.Mesh[];
      geometries: THREE.BufferGeometry[];
      shadow: boolean;
    }
  >();
  root.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      excluded.has(object) ||
      Array.isArray(object.material)
    )
      return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const batch = batches.get(object.material) ?? {
      objects: [],
      geometries: [],
      shadow: false,
    };
    batch.objects.push(object);
    batch.geometries.push(geometry);
    batch.shadow ||= object.castShadow;
    batches.set(object.material, batch);
  });
  batches.forEach((batch, mat) => {
    if (batch.objects.length < 2) {
      batch.geometries.forEach((g) => g.dispose());
      return;
    }
    const merged = mergeGeometries(batch.geometries);
    batch.geometries.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = batch.shadow;
    mesh.receiveShadow = true;
    batch.objects.forEach((o) => {
      o.parent?.remove(o);
      o.geometry.dispose();
    });
    root.add(mesh);
  });
  // Traffic agents use lane-following and intersection right-of-way in the runtime.
  const agents = highway
    ? [
        { x: 2, z: 55, axis: "z", direction: 1, cruise: 15 },
        { x: 6, z: 105, axis: "z", direction: 1, cruise: 17 },
        { x: 10, z: 200, axis: "z", direction: 1, cruise: 20 },
        { x: -6, z: 220, axis: "z", direction: -1, cruise: 20 },
        { x: -2, z: 520, axis: "z", direction: -1, cruise: 18 },
      ]
    : [
        { x: -3.4, z: 160, axis: "z", direction: -1, cruise: 8 },
        { x: 3.4, z: 65, axis: "z", direction: 1, cruise: 8 },
        { x: -70, z: 96.6, axis: "x", direction: 1, cruise: 7 },
        { x: 100, z: 103.4, axis: "x", direction: -1, cruise: 7 },
      ];
  agents.forEach((agent, i) => {
    const car = createCar(
      [0x9bafa5, 0xc6ac83, 0x859dac, 0xa57968, 0xb9b6a6][i],
      true,
    );
    root.add(car.root);
    traffic.push({
      ...agent,
      initialX: agent.x,
      initialZ: agent.z,
      axis: agent.axis as "x" | "z",
      speed: agent.cruise,
      car,
    });
  });
  if (!highway)
    for (const [z, direction] of [
      [89, 1],
      [111, -1],
    ]) {
      const g = new THREE.Group();
      const clothes = material(direction === 1 ? 0xae835a : 0x6d8791),
        skin = material(0xc7a282);
      box(g, 0.36, 0.6, 0.23, 0, 1.1, 0, clothes);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
      head.position.y = 1.56;
      g.add(head);
      const legs = [
        box(g, 0.13, 0.65, 0.15, -0.12, 0.48, 0, metal),
        box(g, 0.13, 0.65, 0.15, 0.12, 0.48, 0, metal),
      ];
      for (const x of [-0.25, 0.25])
        box(g, 0.12, 0.55, 0.12, x, 1.08, 0, clothes);
      root.add(g);
      pedestrians.push({
        root: g,
        x: direction === 1 ? -8.5 : 8.5,
        z,
        direction,
        legs,
      });
    }
  let rain: THREE.LineSegments | null = null;
  if (config.id === "rain") {
    const pos = new Float32Array(700 * 6);
    for (let i = 0; i < 700; i++) {
      const x = (rnd() - 0.5) * 65,
        y = rnd() * 22,
        z = (rnd() - 0.5) * 65;
      pos.set([x, y, z, x - 0.1, y - 1, z + 0.1], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xb8cbd2,
        transparent: true,
        opacity: 0.35,
      }),
    );
    root.add(rain);
  }
  root.scale.z = -1;
  return {
    root,
    obstacles,
    traffic,
    pedestrians,
    signals,
    checkpoints,
    rain,
    lamps,
    config,
  };
}

export function updateWorld(
  world: World,
  p: VehicleState,
  elapsed: number,
  dt: number,
  checkpoint: number,
): BoxObstacle[] {
  const highway = world.config.id === "highway",
    signal = signalAt(elapsed),
    dynamic: BoxObstacle[] = [];
  world.signals.forEach((lens, i) => {
    const on =
      (i % 3 === 0 && signal === "red") ||
      (i % 3 === 1 && signal === "yellow") ||
      (i % 3 === 2 && signal === "green");
    (lens.material as THREE.MeshBasicMaterial).color.setHex(
      on ? [0xf04736, 0xf7c34c, 0x7ac77a][i % 3] : 0x293831,
    );
  });
  world.traffic.forEach((a, i) => {
    const coord = a.axis === "z" ? a.z : a.x;
    let target = a.cruise;
    if (!highway) {
      const limit =
        a.axis === "z"
          ? a.direction > 0
            ? 81
            : 119
          : a.direction > 0
            ? -14
            : 14;
      const before = (limit - coord) * a.direction;
      const stop = a.axis === "z" ? signal !== "green" : signal !== "red";
      if (stop && before > 0 && before < 23)
        target = Math.min(target, Math.sqrt(2 * 3 * Math.max(0, before - 1)));
    }
    // Following distance includes the player and other vehicles in the same lane.
    const ahead = (a.axis === "z" ? p.z - a.z : p.x - a.x) * a.direction;
    const lateral = Math.abs(a.axis === "z" ? p.x - a.x : p.z - a.z);
    if (lateral < 2.4 && ahead > 0 && ahead < 20)
      target = Math.min(target, Math.max(0, (ahead - 7) * 0.8));
    world.traffic.forEach((other) => {
      if (
        a === other ||
        a.axis !== other.axis ||
        a.direction !== other.direction
      )
        return;
      const gap =
          (a.axis === "z" ? other.z - a.z : other.x - a.x) * a.direction,
        lat = Math.abs(a.axis === "z" ? other.x - a.x : other.z - a.z);
      if (lat < 2 && gap > 0 && gap < 20)
        target = Math.min(target, Math.max(0, (gap - 7) * 0.8));
    });
    a.speed += Math.max(-4 * dt, Math.min(2 * dt, target - a.speed));
    if (a.axis === "z") a.z += a.direction * a.speed * dt;
    else a.x += a.direction * a.speed * dt;
    if (highway) {
      if (a.z > 800) a.z = -100;
      if (a.z < -110) a.z = 790;
    } else {
      if (a.z > 290) a.z = -100;
      if (a.z < -110) a.z = 280;
      if (a.x > 165) a.x = -165;
      if (a.x < -170) a.x = 160;
    }
    a.car.root.position.set(a.x, 0, a.z);
    a.car.root.rotation.y =
      a.axis === "z"
        ? a.direction > 0
          ? 0
          : Math.PI
        : a.direction > 0
          ? Math.PI / 2
          : -Math.PI / 2;
    a.car.wheels.forEach((w) => (w.rotation.x += (a.speed * dt) / 0.37));
    a.car.brakeMaterial.emissiveIntensity = target < a.speed ? 0.9 : 0.15;
    a.car.headlights.forEach(
      (light) => (light.intensity = world.config.id === "night" ? 14 : 0),
    );
    dynamic.push({
      id: `traffic-${i}`,
      x: a.x,
      z: a.z,
      halfX: a.axis === "z" ? 0.95 : 2.2,
      halfZ: a.axis === "z" ? 2.2 : 0.95,
      kind: "traffic",
      speed: a.speed,
    });
  });
  world.pedestrians.forEach((ped, i) => {
    const crossing = ped.x > -8 && ped.x < 8;
    if (signal === "red" || crossing) {
      ped.x += ped.direction * 1.2 * dt;
      if (ped.x > 8.5) {
        ped.x = 8.5;
        ped.direction = -1;
      }
      if (ped.x < -8.5) {
        ped.x = -8.5;
        ped.direction = 1;
      }
    }
    ped.root.position.set(ped.x, 0, ped.z);
    ped.root.rotation.y = (ped.direction * Math.PI) / 2;
    ped.legs.forEach(
      (leg, j) =>
        (leg.rotation.x = crossing
          ? Math.sin(elapsed * 7 + j * Math.PI) * 0.3
          : 0),
    );
    dynamic.push({
      id: `pedestrian-${i}`,
      x: ped.x,
      z: ped.z,
      halfX: 0.25,
      halfZ: 0.25,
      kind: "pedestrian",
      speed: crossing ? 1.2 : 0,
    });
  });
  world.checkpoints.forEach((cp, i) => {
    cp.visible = i >= checkpoint;
    cp.children[1].rotation.y = Math.atan2(
      p.x - cp.position.x,
      p.z - cp.position.z,
    );
  });
  if (world.rain) {
    world.rain.position.set(p.x, 0, p.z);
    const attr = world.rain.geometry.getAttribute("position");
    for (let i = 0; i < attr.count; i += 2) {
      const y = attr.getY(i) - 22 * dt;
      attr.setY(i, y < 0 ? 22 : y);
      attr.setY(i + 1, (y < 0 ? 22 : y) - 1);
    }
    attr.needsUpdate = true;
  }
  return dynamic;
}
export function disposeGroup(root: THREE.Group) {
  const materials = new Set<THREE.Material>(),
    geometries = new Set<THREE.BufferGeometry>(),
    textures = new Set<THREE.Texture>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      geometries.add(obj.geometry);
      for (const mat of Array.isArray(obj.material)
        ? obj.material
        : [obj.material])
        materials.add(mat);
    }
  });
  materials.forEach((mat) => {
    for (const value of Object.values(mat))
      if (value instanceof THREE.Texture) textures.add(value);
    mat.dispose();
  });
  textures.forEach((t) => t.dispose());
  geometries.forEach((g) => g.dispose());
}
