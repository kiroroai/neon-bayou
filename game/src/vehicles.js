// Neon Bayou — cars: player driving physics, traffic AI, parked cars,
// collisions. One job: everything with four wheels.
import { CAR_DEFS, ROAD_W } from './config.js';
import { AVENUES, STREETS, roadAt, solidAt } from './world.js';
import { clamp, angleLerp, dist2 } from './rng.js';
import { addSkid, spawnSmoke, addShake } from './effects.js';
import { exitCar } from './player.js';

export function createCar(defKey, x, y, angle, driver) {
  const def = CAR_DEFS[defKey];
  return {
    defKey, def, x, y, angle, speed: 0, steer: 0,
    driver: driver || 'parked', parked: driver === 'parked',
    color: def.color, hp: 100, stolen: false,
    // traffic AI state
    wp: null, wpAxis: 'x', wpDir: 1, stuck: 0,
  };
}

function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function carHitsBuilding(world, car) {
  const r = car.def.len * 0.42;
  for (const b of world.buildings) if (circleHitsRect(car.x, car.y, r, b)) return true;
  return false;
}

export function updatePlayerCar(G, dt) {
  const car = G.player.inCar;
  if (!car) return;
  const input = G.input;
  const def = car.def;
  const forward = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');

  if (forward) car.speed += def.accel * dt;
  else if (back) car.speed -= (car.speed > 5 ? def.accel * 0.9 : def.accel * 0.55) * dt;
  else car.speed -= car.speed * 1.4 * dt; // coast down
  // Handbrake drift.
  const drifting = input.down('Space');
  if (drifting) car.speed -= car.speed * 0.6 * dt;
  car.speed = clamp(car.speed, -def.top * 0.45, def.top);

  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  const steerTarget = steerInput * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, 8 * dt);
  const grip = drifting ? def.grip * 0.45 : def.grip;
  car.angle += car.steer * grip * (Math.abs(car.speed) / def.top) * dt * (car.speed >= 0 ? 1 : -1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = car.def.len * 0.42;
  if (!solidAt(G.world, nx, car.y, r) && !carHitsBuilding(G.world, { ...car, x: nx })) {
    car.x = nx;
  } else if (Math.abs(car.speed) > 60) { crashCar(G, car); }
  if (!solidAt(G.world, car.x, ny, r) && !carHitsBuilding(G.world, { ...car, y: ny })) {
    car.y = ny;
  } else if (Math.abs(car.speed) > 60) { crashCar(G, car); }

  // Skid marks at speed while steering hard.
  if (Math.abs(car.steer) > 0.6 && Math.abs(car.speed) > 120) {
    addSkid(G.fx, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
  }
  // The player rides the car: keep the player's position on the car, so
  // the camera, police, missions, minimap and combat all track the car.
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
  // A wrecked car throws Rook out on foot — the CBPD can finish the job.
  if (car.hp <= 0) {
    spawnSmoke(G.fx, car.x, car.y);
    car.speed = 0;
    exitCar(G);
  }
  G.audio.setEngine(Math.abs(car.speed) / def.top, true);
}

function crashCar(G, car) {
  car.speed *= -0.25;
  car.hp = Math.max(0, car.hp - 12);
  spawnSmoke(G.fx, car.x, car.y);
  addShake(G.fx, 0.25);
  G.audio.crash();
  if (car.driver === 'player') G.police.addWanted(0, 'reckless driving');
}

function pickTrafficWaypoint(car, rng) {
  // Drive along avenues and streets: pick an axis and a direction.
  if (rng.chance(0.5)) {
    car.wpAxis = 'x';
    car.wp = { x: rng.pick(AVENUES), y: car.y };
    car.wpDir = car.wp.x > car.x ? 1 : -1;
  } else {
    car.wpAxis = 'y';
    car.wp = { x: car.x, y: rng.pick(STREETS) };
    car.wpDir = car.wp.y > car.y ? 1 : -1;
  }
}

export function updateTrafficCar(G, car, dt, rng) {
  if (!car.wp) pickTrafficWaypoint(car, rng);
  const def = car.def;
  const tx = car.wp.x, ty = car.wp.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  car.angle = angleLerp(car.angle, want, Math.min(1, 2.2 * dt));
  const target = def.top * 0.42;
  car.speed += (target - car.speed) * Math.min(1, 0.8 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = car.def.len * 0.42;
  if (!solidAt(G.world, nx, ny, r) && !carHitsBuilding(G.world, { ...car, x: nx, y: ny })) {
    car.x = nx; car.y = ny; car.stuck = 0;
  } else {
    car.stuck += dt;
    if (car.stuck > 1.2) { pickTrafficWaypoint(car, rng); car.stuck = 0; }
  }
  const arrived = Math.hypot(tx - car.x, ty - car.y) < 40;
  if (arrived || !roadAt(car.x, car.y)) pickTrafficWaypoint(car, rng);
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt, G.rng);
  }
  // Gentle car-car separation so traffic does not pile up.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      const min = (a.def.len + b.def.len) * 0.42;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
  }
}

export function spawnParkedCars(G) {
  const rng = G.rng;
  const defs = ['comet', 'sunset', 'hauler', 'gator'];
  for (let i = 0; i < 16; i++) {
    const onAvenue = rng.chance(0.5);
    const x = onAvenue ? rng.pick(AVENUES) + (rng.chance(0.5) ? -ROAD_W / 2 + 12 : ROAD_W / 2 - 12) : rng.range(500, 3000);
    const y = onAvenue ? rng.range(220, 2040) : rng.pick(STREETS) + (rng.chance(0.5) ? -ROAD_W / 2 + 12 : ROAD_W / 2 - 12);
    if (x < 340) continue; // keep the bayou promenade clear
    const angle = onAvenue ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(rng.pick(defs), x, y, angle, 'parked');
    car.color = ['#ff2e88', '#f59e0b', '#84cc16', '#22d3ee', '#e5e7eb', '#c084fc'][rng.int(0, 5)];
    G.cars.push(car);
  }
}

export function spawnTraffic(G) {
  const rng = G.rng;
  const defs = ['comet', 'sunset', 'hauler', 'gator'];
  for (let i = 0; i < 14; i++) {
    const onAvenue = rng.chance(0.5);
    const x = onAvenue ? rng.pick(AVENUES) : rng.range(500, 3000);
    const y = onAvenue ? rng.range(220, 2040) : rng.pick(STREETS);
    const car = createCar(rng.pick(defs), x, y, rng.chance(0.5) ? 0 : Math.PI / 2, 'traffic');
    car.color = ['#f59e0b', '#84cc16', '#22d3ee', '#e5e7eb', '#c084fc', '#fb7185'][rng.int(0, 5)];
    G.cars.push(car);
  }
}
