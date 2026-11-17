// Neon Bayou — combat: bullets, muzzle flashes, and the Gator Kings gang.
// One job: shooting and the enemies who shoot back.
import { TUNING } from './config.js';
import { clamp, angleTo } from './rng.js';
import { spawnSparks, spawnBlood, spawnMuzzle, addShake } from './effects.js';
import { damagePlayer } from './player.js';
import { solidAt } from './world.js';

export function createCombat() {
  return { bullets: [], enemies: [], lastShotAt: -99, fireCooldown: 0 };
}

export function shotsFiredRecently(G) {
  return G.time - G.combat.lastShotAt < 1.5;
}

export function fireBullet(G, x, y, angle, fromPlayer) {
  const c = G.combat;
  if (c.fireCooldown > 0) return false;
  c.fireCooldown = fromPlayer ? 0.22 : 0.7;
  c.bullets.push({ x, y, vx: Math.cos(angle) * TUNING.bulletSpeed, vy: Math.sin(angle) * TUNING.bulletSpeed, fromPlayer, life: 1.1 });
  c.lastShotAt = G.time;
  spawnMuzzle(G.fx, x + Math.cos(angle) * 16, y + Math.sin(angle) * 16);
  G.audio.shot();
  return true;
}

export function spawnEnemies(G, n) {
  const p = G.player;
  for (let i = 0; i < n; i++) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(260, 420);
    G.combat.enemies.push({
      x: clamp(p.x + Math.cos(a) * d, 360, 3080),
      y: clamp(p.y + Math.sin(a) * d, 140, 2100),
      angle: a, hp: TUNING.enemyHp, speed: TUNING.enemySpeed,
      shootTimer: G.rng.range(0.5, 1.5), flash: 0,
    });
  }
}

function bulletHitsBuilding(G, b) {
  return solidAt(G.world, b.x, b.y, 2);
}

export function updateCombat(G, dt) {
  const c = G.combat;
  const p = G.player;
  c.fireCooldown = Math.max(0, c.fireCooldown - dt);

  // Player fires with Space or mouse click, aiming with the mouse.
  if (G.state === 'playing' && !p.inCar) {
    const wantFire = G.input.down('Space') || G.input.mouse.pressed || G.input.mouse.down;
    if (wantFire) fireBullet(G, p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle, true);
  }

  // Bullets fly, hit buildings, enemies, or the player.
  for (const b of c.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (bulletHitsBuilding(G, b)) { b.life = 0; spawnSparks(G.fx, b.x, b.y); continue; }
    if (b.fromPlayer) {
      for (const e of c.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 18) {
          e.hp -= TUNING.bulletDamage;
          e.flash = 0.12;
          b.life = 0;
          spawnBlood(G.fx, e.x, e.y);
          G.audio.hit();
          if (e.hp <= 0) {
            e.dead = true;
            spawnBlood(G.fx, e.x, e.y);
            G.missions.progress++;
            G.player.cash += 50;
          }
          break;
        }
      }
    } else if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
      b.life = 0;
      damagePlayer(G, 12);
      spawnBlood(G.fx, p.x, p.y);
    }
  }
  c.bullets = c.bullets.filter(b => b.life > 0);
  c.enemies = c.enemies.filter(e => !e.dead);

  // Enemies close in and shoot at Rook.
  for (const e of c.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const a = angleTo(e.x, e.y, p.x, p.y);
    e.angle = a;
    if (d > 220) {
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    } else if (d < 140) {
      e.x -= Math.cos(a) * e.speed * 0.6 * dt;
      e.y -= Math.sin(a) * e.speed * 0.6 * dt;
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 520 && !p.inCar) {
      fireBullet(G, e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, a, false);
      e.shootTimer = 1.4 + G.rng.range(0, 0.8);
    }
    // Melee when right on top of the player.
    if (d < 24 && !p.inCar) {
      damagePlayer(G, 10 * dt);
      addShake(G.fx, 0.1);
    }
  }
}
