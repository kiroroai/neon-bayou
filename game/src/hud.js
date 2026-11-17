// Neon Bayou — the HUD: wanted stars, cash, health, objective banner,
// minimap, speed and prompts. One job: everything drawn over the game.
import { WORLD_W, WORLD_H, PALETTE } from './config.js';
import { currentObjective } from './missions.js';
import { districtAt } from './world.js';
import { nearestEnterableCar } from './player.js';

function drawStars(ctx, x, y, wanted) {
  ctx.save();
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd166' : 'rgba(255,255,255,0.18)';
    ctx.fillText('★', x + i * 28, y);
  }
  ctx.restore();
}

function drawMinimap(ctx, G) {
  const w = 218, h = 162;
  const x = G.view.w - w - 14, y = G.view.h - h - 14;
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  // Water.
  ctx.fillStyle = '#0b3542';
  ctx.fillRect(x, y, 300 * sx, h);
  ctx.fillRect(x, y + 2160 * sy, w, h - 2160 * sy);
  // Roads.
  ctx.strokeStyle = '#3a3550';
  ctx.lineWidth = 2;
  for (const ax of G.world.avenues) {
    ctx.beginPath(); ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + h); ctx.stroke();
  }
  for (const sy2 of G.world.streets) {
    ctx.beginPath(); ctx.moveTo(x, y + sy2 * sy); ctx.lineTo(x + w, y + sy2 * sy); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#2a2440';
  for (const b of G.world.buildings) ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Packages.
  ctx.fillStyle = '#fbbf24';
  for (const pkg of G.missions.packages) {
    ctx.beginPath(); ctx.arc(x + pkg.x * sx, y + pkg.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Enemies.
  ctx.fillStyle = '#ef4444';
  for (const e of G.combat.enemies) {
    ctx.beginPath(); ctx.arc(x + e.x * sx, y + e.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Police cruisers.
  ctx.fillStyle = '#60a5fa';
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    ctx.beginPath(); ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Mission objective.
  const obj = currentObjective(G);
  if (obj.x !== null && obj.x !== undefined) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x + obj.x * sx, y + obj.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x + obj.x * sx, y + obj.y * sy, 9, 0, Math.PI * 2); ctx.stroke();
  }
  // Player arrow.
  const px = x + G.player.x * sx, py = y + G.player.y * sy;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke();
  // North + district label.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 4, y + 12);
  ctx.restore();
}

export function drawHUD(ctx, G) {
  const p = G.player;
  ctx.save();
  // Top-left: wanted stars, cash, health.
  drawStars(ctx, 16, 26, G.police.wanted);
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a3e635';
  ctx.fillText(`$${p.cash}`, 16, 56);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(16, 72, 150, 12);
  ctx.fillStyle = p.hp > 40 ? '#22c55e' : '#ef4444';
  ctx.fillRect(16, 72, 150 * Math.max(0, p.hp / 100), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 72, 150, 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('HEALTH', 172, 78);

  // Objective banner, top-center.
  const obj = currentObjective(G);
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui, sans-serif';
  const banner = obj.text;
  const bw = ctx.measureText(banner).width + 28;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect((G.view.w - bw) / 2, 10, bw, 30);
  ctx.strokeStyle = '#ff2e88';
  ctx.strokeRect((G.view.w - bw) / 2, 10, bw, 30);
  ctx.fillStyle = '#fff';
  ctx.fillText(banner, G.view.w / 2, 26);

  // Mission story banner.
  if (G.missions.banner && G.missions.banner.t > 0) {
    ctx.font = '15px system-ui, sans-serif';
    const bt = G.missions.banner.text;
    const bbw = Math.min(G.view.w - 80, ctx.measureText(bt).width + 28);
    ctx.fillStyle = 'rgba(20,10,40,0.85)';
    ctx.fillRect((G.view.w - bbw) / 2, 48, bbw, 30);
    ctx.strokeStyle = '#fbbf24';
    ctx.strokeRect((G.view.w - bbw) / 2, 48, bbw, 30);
    ctx.fillStyle = '#fde68a';
    ctx.fillText(bt, G.view.w / 2, 64);
  }

  // District name, bottom-left.
  const d = districtAt(p.x, p.y);
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = d.neon;
  ctx.fillText(d.name.toUpperCase(), 16, G.view.h - 44);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('CYPRESS BAY', 16, G.view.h - 26);

  // Speed + car name while driving.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.55);
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${kmh}`, G.view.w - 250, G.view.h - 30);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h  •  ' + p.inCar.def.name, G.view.w - 250, G.view.h - 52);
    ctx.textAlign = 'left';
  }

  // Context prompt: steal a car.
  if (!p.inCar && G.state === 'playing') {
    const car = nearestEnterableCar(G);
    if (car) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Press E to steal the ${car.def.name}`, G.view.w / 2, G.view.h - 110);
      ctx.textAlign = 'left';
    }
  }

  // Off-screen objective arrow.
  if (obj.x !== null && obj.x !== undefined) {
    const sx = (obj.x - G.camera.x) * G.camera.zoom + G.view.w / 2;
    const sy = (obj.y - G.camera.y) * G.camera.zoom + G.view.h / 2;
    if (sx < 40 || sx > G.view.w - 40 || sy < 40 || sy > G.view.h - 40) {
      const cx = Math.max(60, Math.min(G.view.w - 60, sx));
      const cy = Math.max(60, Math.min(G.view.h - 60, sy));
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawMinimap(ctx, G);
  void PALETTE;
  ctx.restore();
}
