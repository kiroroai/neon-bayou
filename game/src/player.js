// Neon Bayou — Rook on foot: walking, sprinting, entering and leaving
// cars, health and cash. One job: the player character.
import { TUNING } from './config.js';
import { moveWithCollision } from './world.js';
import { clamp } from './rng.js';
import { addShake } from './effects.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: TUNING.playerHp, cash: 0,
    inCar: null, moving: false, sprinting: false,
  };
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const ax = G.input.axis();
  const sprint = G.input.down('ShiftLeft') || G.input.down('ShiftRight');
  p.sprinting = sprint && (ax.x !== 0 || ax.y !== 0);
  const speed = TUNING.walkSpeed * (p.sprinting ? TUNING.sprintMul : 1);
  let dx = ax.x, dy = ax.y;
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (len > 0) {
    dx /= len; dy /= len;
    p.angle = Math.atan2(dy, dx);
    moveWithCollision(G.world, p, dx * speed * dt, dy * speed * dt, TUNING.playerRadius);
  }
  // Aim at the mouse while shooting.
  if (G.input.mouse.down || G.input.mouse.pressed) {
    const m = screenToWorld(G, G.input.mouse.x, G.input.mouse.y);
    p.angle = Math.atan2(m.y - p.y, m.x - p.x);
  }
}

export function screenToWorld(G, sx, sy) {
  const c = G.camera;
  return { x: c.x + (sx - G.view.w / 2) / c.zoom, y: c.y + (sy - G.view.h / 2) / c.zoom };
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.hp <= 0) return;
  p.hp = clamp(p.hp - amount, 0, TUNING.playerHp);
  addShake(G.fx, 0.35);
  if (p.hp <= 0) {
    G.state = 'busted';
    G.audio.busted();
    addShake(G.fx, 0.7);
  }
}

export function addCash(G, amount) {
  G.player.cash += amount;
  G.stats.cashEarned += amount;
}

export function nearestEnterableCar(G) {
  const p = G.player;
  let best = null, bestD = TUNING.carEnterRadius * TUNING.carEnterRadius;
  for (const car of G.cars) {
    if (car.driver === 'police') continue;
    const dx = car.x - p.x, dy = car.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  // A wrecked car (hp 0) is scrap — it will not drive again.
  if (car.hp <= 0) return false;
  const p = G.player;
  p.inCar = car;
  car.driver = 'player';
  car.parked = false;
  G.audio.unlock();
  if (!car.stolen) {
    car.stolen = true;
    G.stats.carsStolen++;
    G.police.addWanted(1, 'car theft');
  }
  return true;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  // Step out to the side of the car.
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  p.inCar = null;
  p.angle = car.angle;
}
