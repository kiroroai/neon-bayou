// Neon Bayou — the city of Cypress Bay: districts, roads, buildings,
// bayou channel, lagoon, docks, and collision. One job: the map itself.
import { WORLD_W, WORLD_H, ROAD_W, BAYOU_X1, BAYOU_X2, LAGOON_Y1, LAGOON_Y2, BRIDGE_YS, DISTRICTS, PALETTE } from './config.js';
import { makeRng } from './rng.js';

export const AVENUES = [480, 800, 1120, 1440, 1760, 2080, 2400, 2720, 3040];
export const STREETS = [160, 480, 800, 1120, 1440, 1760, 2080];

const SIGNS = ['NEON', 'BAYOU', '24H', 'HOTEL', 'BAR', 'CLUB', 'PIER', 'CAFE', 'MOTEL', 'DANCE', 'TACOS', 'CASH', 'GYM', 'LIQUOR', 'ARCADE', 'ROOMS'];
const NEON_COLORS = ['#ff2e88', '#22d3ee', '#f59e0b', '#a3e635', '#c084fc', '#fbbf24', '#fb7185'];

export function buildWorld() {
  const rng = makeRng(20261117);
  const buildings = [];
  const lamps = [];
  const trees = [];
  const billboards = [];

  // Buildings fill the blocks between avenues and streets.
  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const bx1 = AVENUES[i] + ROAD_W / 2 + 14;
      const bx2 = AVENUES[i + 1] - ROAD_W / 2 - 14;
      const by1 = STREETS[j] + ROAD_W / 2 + 14;
      const by2 = STREETS[j + 1] - ROAD_W / 2 - 14;
      const bw = bx2 - bx1, bh = by2 - by1;
      // Magnolia Park block: trees and grass, no buildings.
      if (i === 6 && j === 3) {
        for (let t = 0; t < 14; t++) {
          trees.push({ x: bx1 + rng.range(20, bw - 20), y: by1 + rng.range(20, bh - 20), r: rng.range(10, 18) });
        }
        continue;
      }
      // Docks block: warehouses near the lagoon, low and wide.
      const dockRow = j === STREETS.length - 2;
      const count = dockRow ? 2 : rng.int(2, 3);
      for (let k = 0; k < count; k++) {
        const w = dockRow ? rng.range(120, 180) : rng.range(70, 130);
        const h = dockRow ? rng.range(50, 70) : rng.range(60, 120);
        const x = bx1 + rng.range(6, Math.max(7, bw - w - 6));
        const y = by1 + rng.range(6, Math.max(7, bh - h - 6));
        const district = DISTRICTS.find(d => x >= d.x1 && x < d.x2 && y >= d.y1 && y < d.y2);
        buildings.push({
          x, y, w, h,
          color: PALETTE.buildingTop,
          edge: PALETTE.buildingEdge,
          neon: rng.pick(NEON_COLORS),
          sign: rng.chance(0.75) ? rng.pick(SIGNS) : '',
          district: district ? district.name : 'Cypress Bay',
          roof: rng.pick(['#3b2d5c', '#2d3b5c', '#5c2d3b', '#2d5c3b']),
        });
      }
    }
  }

  // Lamps along every avenue and street intersection approach.
  for (const ax of AVENUES) for (const sy of STREETS) {
    lamps.push({ x: ax - ROAD_W / 2 - 6, y: sy - ROAD_W / 2 - 6 });
    lamps.push({ x: ax + ROAD_W / 2 + 6, y: sy + ROAD_W / 2 + 6 });
  }
  // Trees along the bayou promenade and the park edge.
  for (let y = 200; y < 2100; y += 130) trees.push({ x: 330 + rng.range(-8, 8), y, r: rng.range(10, 16) });
  // Billboards on a few tall blocks.
  billboards.push({ x: 1120, y: 480, w: 120, h: 26, text: 'NEON BAYOU', color: '#ff2e88' });
  billboards.push({ x: 2080, y: 1440, w: 120, h: 26, text: 'VISIT CYPRESS BAY', color: '#22d3ee' });
  billboards.push({ x: 800, y: 1760, w: 120, h: 26, text: 'GATOR COLA', color: '#a3e635' });

  // Docks: piers reaching into the lagoon.
  const piers = [];
  for (let k = 0; k < 4; k++) piers.push({ x: 700 + k * 520, y: LAGOON_Y1, w: 60, h: 150 });

  return {
    avenues: AVENUES, streets: STREETS,
    buildings, lamps, trees, billboards, piers,
    spawn: { player: { x: 800, y: 720 }, garage: { x: 800, y: 800 } },
  };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x1 && x < d.x2 && y >= d.y1 && y < d.y2) return d;
  if (x < BAYOU_X2) return { name: 'The Bayou', neon: '#22d3ee', tint: '#0b2a33' };
  if (y >= LAGOON_Y1) return { name: 'The Lagoon', neon: '#38bdf8', tint: '#0b2a33' };
  return { name: 'Cypress Bay', neon: '#ff2e88', tint: '#14101d' };
}

export function onBridge(x, y) {
  if (x < BAYOU_X1 || x > BAYOU_X2) return false;
  return BRIDGE_YS.some(by => Math.abs(y - by) <= ROAD_W / 2);
}

export function inWater(x, y) {
  if (x >= BAYOU_X1 && x <= BAYOU_X2 && !onBridge(x, y)) return true;
  if (y >= LAGOON_Y1 && y <= LAGOON_Y2) return true;
  return false;
}

export function roadAt(x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function solidAt(world, x, y, r) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  if (inWater(x, y)) return true;
  for (const b of world.buildings) if (circleHitsRect(x, y, r, b)) return true;
  return false;
}

// Move a circle by (dx, dy) with axis-separated sliding collision.
export function moveWithCollision(world, e, dx, dy, r) {
  const nx = e.x + dx;
  if (!solidAt(world, nx, e.y, r)) e.x = nx;
  const ny = e.y + dy;
  if (!solidAt(world, e.x, ny, r)) e.y = ny;
}

export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) return { x: rng.pick(AVENUES), y: rng.range(200, 2050) };
  return { x: rng.range(500, 3000), y: rng.pick(STREETS) };
}
