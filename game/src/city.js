// Neon Bayou — Cypress Bay, an original fictional city.
// Builds the whole explorable map from a seeded generator: streets on a
// 40-unit grid, buildings with lit windows, neon signs, palms, a bayou
// canal to the south, and the named landmarks the missions use.

import * as THREE from 'three';
import { makeRng } from './rng.js';

export const CITY_HALF = 200;
export const STREET_STEP = 40;
export const ROAD_WIDTH = 12;

const PALETTE = {
  asphalt: 0x23242c,
  sidewalk: 0x3a3b44,
  ground: 0x2e2a26,
  water: 0x0d3a3a,
  buildingTops: [0x8a7f8d, 0x7d8a94, 0x9c8a7a, 0x6f7d6a],
  wallTints: [0x5a5468, 0x4e5a66, 0x6b5a52, 0x515c54, 0x635a6e, 0x715f6b],
  neon: [0xff2e88, 0x00e5ff, 0xffd23f, 0x7cff4f, 0xff6b35, 0xb967ff],
  palmTrunk: 0x6b4a2f,
  palmLeaf: 0x2f7d4f,
};

function lightenHex(hex, amount) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) + (255 - ((hex >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) + (255 - ((hex >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((hex & 255) + (255 - (hex & 255)) * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function makeWindowTexture(rng, tint, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 12;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.next() < litRatio;
      if (lit) {
        ctx.fillStyle = rng.pick(['#ffd98a', '#ffe9b0', '#9be8ff', '#ffb46b']);
      } else {
        ctx.fillStyle = '#14161f';
      }
      ctx.fillRect(8 + c * 20, 10 + r * 20, 13, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNeonTexture(word, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.fillText(word, 128, 34);
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(word, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material || new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export function createCity(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'CypressBay';
  const buildings = [];
  const lamps = [];
  const palms = [];

  // One window texture per wall tint: a light base so the walls read in
  // daylight, with lit windows that glow at night via the emissive map.
  const wallMats = PALETTE.wallTints.map((c) => {
    const tex = makeWindowTexture(rng, lightenHex(c, 0.55), 0.55);
    return new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.28,
    });
  });

  // Ground slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, CITY_HALF * 2 + 160),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  group.add(ground);

  // Roads: a grid of asphalt strips with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const streets = [];
  for (let i = -5; i <= 5; i++) streets.push(i * STREET_STEP);
  for (const s of streets) {
    const alongX = box(CITY_HALF * 2, 0.1, ROAD_WIDTH, 0, 0, 0, s, roadMat);
    alongX.position.y = 0;
    group.add(alongX);
    const alongZ = box(ROAD_WIDTH, 0.1, CITY_HALF * 2, 0, s, 0, 0, roadMat);
    alongZ.position.y = 0;
    group.add(alongZ);
    for (let d = -CITY_HALF + 10; d < CITY_HALF; d += 20) {
      group.add(box(6, 0.12, 0.7, 0, d, 0.06, s, dashMat));
      group.add(box(0.7, 0.12, 6, 0, s, 0.06, d, dashMat));
    }
  }

  // Sidewalk slabs at every block.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (let i = -5; i < 5; i++) {
    for (let j = -5; j < 5; j++) {
      const slab = box(26, 0.08, 26, 0, i * STREET_STEP + 20, 0, j * STREET_STEP + 20, walkMat);
      slab.position.y = -0.01;
      group.add(slab);
    }
  }

  // Buildings, parks and parking lots, one per block.
  const neonWords = ['HOTEL', 'BAR', 'TACOS', '24H', 'CLUB', 'PIER', 'DANCE', 'CAFE', 'MOTEL', 'NEON'];
  for (let i = -5; i < 5; i++) {
    for (let j = -5; j < 5; j++) {
      const cx = i * STREET_STEP + 20;
      const cz = j * STREET_STEP + 20;
      const roll = rng.next();
      if (roll < 0.14) {
        // Park: grass square with palms.
        const park = box(24, 0.15, 24, 0, cx, 0.02, cz, new THREE.MeshLambertMaterial({ color: 0x2c5a34 }));
        group.add(park);
        for (let p = 0; p < 4; p++) {
          const px = cx + rng.range(-9, 9);
          const pz = cz + rng.range(-9, 9);
          group.add(makePalm(px, pz, rng));
          palms.push({ x: px, z: pz });
        }
        continue;
      }
      if (roll < 0.24) {
        // Parking lot.
        const lot = box(24, 0.12, 24, 0, cx, 0.01, cz, new THREE.MeshLambertMaterial({ color: 0x2a2b31 }));
        group.add(lot);
        continue;
      }
      const tall = rng.chance(0.3);
      const w = rng.range(14, 22);
      const d = rng.range(14, 22);
      const h = tall ? rng.range(28, 52) : rng.range(8, 18);
      const mat = rng.pick(wallMats);
      const b = box(w, h, d, 0, cx, h / 2, cz, mat);
      group.add(b);
      const roof = box(w + 0.6, 0.5, d + 0.6, 0, cx, h + 0.25, cz, new THREE.MeshLambertMaterial({ color: rng.pick(PALETTE.buildingTops) }));
      group.add(roof);
      if (tall && rng.chance(0.5)) {
        group.add(box(0.4, 6, 0.4, 0, cx, h + 3, cz, new THREE.MeshLambertMaterial({ color: 0x222222 })));
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff3355 }),
        );
        beacon.position.set(cx, h + 6.2, cz);
        beacon.name = 'beacon';
        group.add(beacon);
      }
      if (rng.chance(0.6)) {
        const word = rng.pick(neonWords);
        const color = rng.pick(PALETTE.neon);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 3),
          new THREE.MeshBasicMaterial({ map: makeNeonTexture(word, color) }),
        );
        const face = rng.pick([0, 1, 2, 3]);
        const off = d / 2 + 0.15;
        if (face === 0) { sign.position.set(cx, Math.min(h - 2, 10), cz + off); }
        else if (face === 1) { sign.position.set(cx, Math.min(h - 2, 10), cz - off); sign.rotation.y = Math.PI; }
        else if (face === 2) { sign.position.set(cx + w / 2 + 0.15, Math.min(h - 2, 10), cz); sign.rotation.y = Math.PI / 2; }
        else { sign.position.set(cx - w / 2 - 0.15, Math.min(h - 2, 10), cz); sign.rotation.y = -Math.PI / 2; }
        sign.name = 'neon';
        group.add(sign);
      }
      buildings.push({ x: cx, z: cz, w, d, h });
    }
  }

  // Street lamps along the avenues.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const s of streets) {
    for (let d = -CITY_HALF + 20; d < CITY_HALF; d += 80) {
      group.add(box(0.3, 7, 0.3, 0, d, 3.5, s + 8, poleMat));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), bulbMat);
      bulb.position.set(d, 7.1, s + 8);
      bulb.name = 'lamp';
      group.add(bulb);
      lamps.push(bulb);
    }
  }

  // The bayou: dark water south of the city, with a wooden dock.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, CITY_HALF + 45);
  water.name = 'bayouWater';
  group.add(water);
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x5a4026 });
  group.add(box(30, 0.6, 8, 0, -60, 0.4, CITY_HALF + 6, dockMat));
  for (let p = 0; p < 5; p++) {
    group.add(makePalm(-160 + p * 80 + rng.range(-8, 8), CITY_HALF - 12, rng));
  }

  // Landmarks the missions and the save system use.
  const landmarks = {
    spawn: { x: 0, z: 20, heading: Math.PI },
    pier: { x: 0, z: -CITY_HALF - 2, heading: 0 },
    dock: { x: -60, z: CITY_HALF + 2, heading: 0 },
    garage: { x: 140, z: 60, heading: Math.PI / 2 },
    safehouse: { x: -140, z: -140, heading: -Math.PI / 2 },
    club: { x: 60, z: -60, heading: 0 },
  };

  // Safehouse: a small house with a glowing porch sign.
  group.add(box(12, 6, 10, 0, landmarks.safehouse.x, 3, landmarks.safehouse.z, new THREE.MeshLambertMaterial({ color: 0x7a5a8a })));
  const porch = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 2),
    new THREE.MeshBasicMaterial({ map: makeNeonTexture('SAFE', '#7cff4f') }),
  );
  porch.position.set(landmarks.safehouse.x, 4.5, landmarks.safehouse.z + 5.2);
  group.add(porch);

  // Garage: Delacroix's workshop, marked in cyan.
  group.add(box(16, 7, 12, 0, landmarks.garage.x, 3.5, landmarks.garage.z, new THREE.MeshLambertMaterial({ color: 0x3a4a5a })));
  const gsign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: makeNeonTexture('GARAGE', '#00e5ff') }),
  );
  gsign.position.set(landmarks.garage.x, 6, landmarks.garage.z + 6.2);
  group.add(gsign);

  // Pier sign at the north edge.
  const psign = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: makeNeonTexture('PIER', '#ff2e88') }),
  );
  psign.position.set(landmarks.pier.x, 8, landmarks.pier.z + 2);
  group.add(psign);

  scene.add(group);
  return { group, buildings, lamps, palms, landmarks, streets };
}

function makePalm(x, z, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.45, 6, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }),
  );
  trunk.position.y = 3;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, 6.2, Math.sin(a) * 1.2);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}
