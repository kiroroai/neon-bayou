// Neon Bayou — the Cypress Bay Police Department: wanted stars, cruiser
// pursuit, foot cops, and getting busted. One job: the heat.
import { TUNING, CAR_DEFS } from './config.js';
import { createCar } from './vehicles.js';
import { clamp, angleLerp, dist2 } from './rng.js';
import { spawnSparks, addShake } from './effects.js';
import { damagePlayer } from './player.js';

export function createPolice() {
  return {
    wanted: 0,
    quietTimer: 0,   // seconds since the last crime
    sirenTimer: 0,
    spawnTimer: 0,
    cops: [],        // foot cops {x, y, angle, speed}
  };
}

export function addWanted(G, stars, reason) {
  const pol = G.police;
  if (stars > 0) {
    pol.wanted = clamp(pol.wanted + stars, 0, 5);
    pol.quietTimer = 0;
  }
  void reason;
}

export function cruiserCountFor(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(TUNING.maxCruisers, wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 5);
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;

  // Stars fade after a stretch with no crime.
  if (pol.wanted > 0) {
    pol.quietTimer += dt;
    if (pol.quietTimer >= TUNING.wantedDecay) {
      pol.wanted--;
      pol.quietTimer = 0;
    }
  }

  // Sirens while wanted.
  if (pol.wanted > 0) {
    pol.sirenTimer -= dt;
    if (pol.sirenTimer <= 0) { G.audio.siren(); pol.sirenTimer = 1.4; }
  }

  // Spawn cruisers up to the wanted level's cap.
  const wantCruisers = cruiserCountFor(pol.wanted);
  const haveCruisers = G.cars.filter(c => c.driver === 'police').length;
  pol.spawnTimer -= dt;
  if (haveCruisers < wantCruisers && pol.spawnTimer <= 0) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = 620;
    const car = createCar('cruiser', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, a, 'police');
    // Keep spawns on roads: nudge onto the nearest road.
    car.x = clamp(car.x, 380, 3060); car.y = clamp(car.y, 140, 2100);
    G.cars.push(car);
    pol.spawnTimer = 2.5;
  }

  // Cruiser pursuit: steer at the player, ram on contact.
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle = angleLerp(car.angle, want, Math.min(1, 3.2 * dt));
    const target = car.def.top * (0.55 + pol.wanted * 0.09);
    car.speed += (target - car.speed) * Math.min(1, 1.1 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx; car.y = ny;
    // Ram the player's car or the player on foot.
    const targetEnt = p.inCar || p;
    const d2 = dist2(car.x, car.y, targetEnt.x, targetEnt.y);
    const hitR = (car.def.len + (p.inCar ? p.inCar.def.len : 22)) * 0.42;
    if (d2 < hitR * hitR) {
      if (p.inCar) {
        p.inCar.hp = Math.max(0, p.inCar.hp - TUNING.copRamDamage * dt * 3);
        p.inCar.speed *= 0.92;
        spawnSparks(G.fx, car.x, car.y);
        addShake(G.fx, 0.15);
      } else {
        damagePlayer(G, 26 * dt);
      }
    }
    // Cops give up far away and despawn.
    if (d2 > 1600 * 1600) { car.despawn = true; }
  }
  G.cars = G.cars.filter(c => !c.despawn);

  // Foot cops at 2+ stars: they run at the player and bust on contact.
  const wantCops = pol.wanted >= 4 ? 3 : pol.wanted >= 2 ? 2 : 0;
  while (pol.cops.length < wantCops) {
    const a = G.rng.range(0, Math.PI * 2);
    pol.cops.push({ x: p.x + Math.cos(a) * 420, y: p.y + Math.sin(a) * 420, angle: a, speed: 150 });
  }
  while (pol.cops.length > wantCops) pol.cops.pop();
  for (const cop of pol.cops) {
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    if (!p.inCar && d < TUNING.bustedRadius && p.hp > 0) {
      G.state = 'busted';
      G.audio.busted();
    }
  }
  void CAR_DEFS;
}
