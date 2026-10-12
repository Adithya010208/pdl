import * as THREE from "three";
import { ScenarioId } from "./model";
export function dressRoad(root: THREE.Group, id: ScenarioId) {
  const night = id === "night",
    rain = id === "rain",
    highway = id === "highway";
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb7b3a8 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x7d6752 });
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x507653,
    roughness: 1,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: night ? 0xf7d29b : 0x7297a9,
    metalness: 0.3,
    roughness: 0.2,
    emissive: night ? 0xe4a95e : 0x000000,
    emissiveIntensity: night ? 0.4 : 0,
  });
  const mesh = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const cube = (
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  // Low-poly landforms create a horizon beyond the playable road; no collision or hidden barriers.
  const hills = new THREE.MeshStandardMaterial({
    color: night ? 0x273c39 : rain ? 0x6e817c : 0x698d77,
    roughness: 1,
  });
  for (const side of [-1, 1])
    for (let i = 0; i < 14; i++) {
      const mountain = mesh(
        new THREE.ConeGeometry(65 + (i % 3) * 20, 55 + (i % 4) * 14, 7),
        hills,
        side * (220 + (i % 3) * 65),
        15,
        i * 90 - 170,
      );
      mountain.rotation.y = i * 0.8;
      mountain.scale.z = 1.8;
    }
  if (!night && !rain) {
    const cloud = new THREE.MeshBasicMaterial({
      color: 0xf0f5f6,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 3; j++) {
        const m = mesh(
          new THREE.SphereGeometry(1, 12, 8),
          cloud,
          (i % 2 ? -1 : 1) * (80 + i * 13) + j * 15,
          85 + (i % 3) * 9,
          i * 80 - 150,
        );
        m.scale.set(24, 5 + j, 12);
        m.castShadow = false;
      }
  }
  if (highway) {
    for (let z = 50; z < 800; z += 65) {
      for (const x of [-35, 35]) {
        cube(0.18, 1.1, 0.18, concrete, x, 0.55, z);
        cube(4, 0.18, 0.12, timber, x, 1, z);
        cube(4, 0.18, 0.12, timber, x, 0.65, z);
      }
    }
    return;
  }
  const shopNames = [
    "CORNER COFFEE",
    "NORTHSIDE MARKET",
    "STUDIO 24",
    "THE BOOKSHOP",
    "AVENUE BAKERY",
  ];
  for (const side of [-1, 1])
    for (const [i, z] of [-47, -10, 30, 64, 135, 170, 210].entries()) {
      const x = side * (side < 0 ? 22 : 24),
        face = x - side * 8.7;
      // Road-facing windows, entrance, awning and signage give the city ground-floor activity.
      for (let floor = 0; floor < 4; floor++)
        for (let j = -2; j <= 2; j++)
          cube(0.035, 1.65, 1.15, glass, face, 2.2 + floor * 2.65, z + j * 2.6);
      cube(0.08, 2.5, 1.2, timber, face - side * 0.03, 1.25, z);
      const awning = new THREE.MeshStandardMaterial({
        color: [0x426e69, 0xa16b4e, 0x687b91][i % 3],
      });
      cube(1.65, 0.18, 8.5, awning, face - side * 0.65, 3.3, z);
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 80;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#253e42";
      c.fillRect(0, 0, 512, 80);
      c.fillStyle = "#f3ecd6";
      c.font = "500 29px sans-serif";
      c.textAlign = "center";
      c.fillText(shopNames[i % 5], 256, 51);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sign = mesh(
        new THREE.PlaneGeometry(7, 0.95),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
        face - side * 0.1,
        3.8,
        z,
      );
      sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      sign.userData.isLabel = true;
    }
  // Benches, bins and planting strips stay on the pavement, clear of all driveable lanes.
  for (const side of [-1, 1])
    for (let z = -60; z < 260; z += 45) {
      if (Math.abs(z - 100) < 25) continue;
      const x = side * 10;
      cube(0.65, 0.13, 1.8, timber, x, 0.58, z);
      cube(0.1, 0.6, 1.7, timber, x + side * 0.3, 0.8, z);
      for (const dz of [-0.65, 0.65])
        cube(0.12, 0.55, 0.12, concrete, x, 0.28, z + dz);
      cube(0.5, 0.9, 0.5, concrete, x, 0.45, z + 3);
      cube(1.1, 0.35, 2.7, concrete, side * 11.7, 0.175, z + 7);
      for (let j = 0; j < 3; j++) {
        const plant = mesh(
          new THREE.IcosahedronGeometry(0.6, 1),
          foliage,
          side * 11.7,
          0.6,
          z + 6 + j,
        );
        plant.scale.y = 0.7;
      }
    }
}
