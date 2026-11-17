// Neon Bayou — particles, skid marks, screen shake, floating texts.
// One job: the juice. No game logic lives here.
export function createEffects() {
  return { particles: [], skids: [], texts: [], trauma: 0 };
}

export function spawnParticles(fx, x, y, color, n, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    fx.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.5 + Math.random() * 0.5), maxLife: life,
      color, size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

export function spawnSparks(fx, x, y) { spawnParticles(fx, x, y, '#ffd166', 10, 260, 0.45, 3); }
export function spawnSmoke(fx, x, y) { spawnParticles(fx, x, y, '#6b7280', 6, 40, 0.9, 7); }
export function spawnBlood(fx, x, y) { spawnParticles(fx, x, y, '#dc2626', 8, 180, 0.5, 3); }
export function spawnMuzzle(fx, x, y) { spawnParticles(fx, x, y, '#fde68a', 4, 320, 0.12, 4); }

export function addSkid(fx, x, y, angle) {
  fx.skids.push({ x, y, angle, life: 6 });
  if (fx.skids.length > 220) fx.skids.splice(0, fx.skids.length - 220);
}

export function addText(fx, x, y, text, color) {
  fx.texts.push({ x, y, text, color: color || '#fff', life: 1.4 });
}

export function addShake(fx, amount) { fx.trauma = Math.min(1, fx.trauma + amount); }

export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 2.4 * dt); p.vy *= (1 - 2.4 * dt);
    p.life -= dt;
  }
  fx.particles = fx.particles.filter(p => p.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter(s => s.life > 0);
  for (const t of fx.texts) { t.y -= 28 * dt; t.life -= dt; }
  fx.texts = fx.texts.filter(t => t.life > 0);
  fx.trauma = Math.max(0, fx.trauma - 1.6 * dt);
}

export function shakeOffset(fx) {
  const s = fx.trauma * fx.trauma * 14;
  return { x: (Math.random() * 2 - 1) * s, y: (Math.random() * 2 - 1) * s };
}
