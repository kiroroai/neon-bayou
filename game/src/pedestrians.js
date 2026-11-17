// Neon Bayou — pedestrians: sidewalk strollers who flee from gunfire
// and screeching tyres. One job: the city's foot traffic.
import { AVENUES, STREETS } from './world.js';
import { clamp } from './rng.js';
import { shotsFiredRecently } from './combat.js';

const SHIRTS = ['#f472b6', '#38bdf8', '#fbbf24', '#a3e635', '#c084fc', '#fb7185', '#e5e7eb', '#f97316'];

export function createPed(rng) {
  const onAvenue = rng.chance(0.5);
  const x = onAvenue ? rng.pick(AVENUES) + (rng.chance(0.5) ? -44 : 44) : rng.range(500, 3000);
  const y = onAvenue ? rng.range(220, 2040) : rng.pick(STREETS) + (rng.chance(0.5) ? -44 : 44);
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52),
    shirt: rng.pick(SHIRTS), fleeing: 0, tx: x, ty: y, retarget: 0,
  };
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) G.peds.push(createPed(G.rng));
}

function pickStrollTarget(p, rng) {
  if (rng.chance(0.5)) { p.tx = rng.pick(AVENUES) + (rng.chance(0.5) ? -44 : 44); p.ty = p.y + rng.range(-300, 300); }
  else { p.tx = p.x + rng.range(-300, 300); p.ty = rng.pick(STREETS) + (rng.chance(0.5) ? -44 : 44); }
  p.tx = clamp(p.tx, 340, 3080);
  p.ty = clamp(p.ty, 120, 2120);
}

export function updatePeds(G, dt) {
  const px = G.player.x, py = G.player.y;
  for (const p of G.peds) {
    // Flee from the player when the heat is on or shots were just fired.
    const dPlayer = Math.hypot(px - p.x, py - p.y);
    if (G.police.wanted >= 2 && dPlayer < 260) p.fleeing = 1.2;
    if (shotsFiredRecently(G)) p.fleeing = Math.max(p.fleeing, 0.8);
    if (p.fleeing > 0) {
      p.fleeing -= dt;
      const a = Math.atan2(p.y - py, p.x - px);
      p.x += Math.cos(a) * 95 * dt;
      p.y += Math.sin(a) * 95 * dt;
      p.angle = a;
      p.x = clamp(p.x, 320, 3100); p.y = clamp(p.y, 120, 2120);
      continue;
    }
    p.retarget -= dt;
    if (p.retarget <= 0 || Math.hypot(p.tx - p.x, p.ty - p.y) < 20) {
      pickStrollTarget(p, G.rng);
      p.retarget = 6;
    }
    const a = Math.atan2(p.ty - p.y, p.tx - p.x);
    p.angle = a;
    p.x += Math.cos(a) * p.speed * dt;
    p.y += Math.sin(a) * p.speed * dt;
    p.x = clamp(p.x, 320, 3100); p.y = clamp(p.y, 120, 2120);
  }
}
