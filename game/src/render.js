// Neon Bayou — the renderer: dusk city, camera, and every entity drawn.
// One job: turn game state into pixels on the canvas.
import { WORLD_W, WORLD_H, ROAD_W, PALETTE } from './config.js';
import { BAYOU_X1, BAYOU_X2, LAGOON_Y1, LAGOON_Y2 } from './config.js';
import { clamp, lerp } from './rng.js';
import { shakeOffset } from './effects.js';
import { districtAt } from './world.js';

export function createCamera() {
  return { x: 800, y: 800, zoom: 1 };
}

export function updateCamera(G, dt) {
  const c = G.camera;
  const target = G.player.inCar || G.player;
  const k = 1 - Math.pow(0.0015, dt);
  c.x = lerp(c.x, clamp(target.x, G.view.w / 2 / c.zoom, WORLD_W - G.view.w / 2 / c.zoom), k);
  c.y = lerp(c.y, clamp(target.y, G.view.h / 2 / c.zoom, WORLD_H - G.view.h / 2 / c.zoom), k);
  const wantZoom = G.view.w < 900 ? 0.85 : 1;
  c.zoom = lerp(c.zoom, wantZoom, Math.min(1, 2 * dt));
}

function drawCarShape(ctx, car) {
  const def = car.def;
  const len = def.len, wid = def.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.18, -wid / 2 + 3, len * 0.34, wid - 6, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
  // Taillights.
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 3, 3, 5);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 8, 3, 5);
  if (car.driver === 'police') {
    // Light bar.
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = blink ? '#ef4444' : '#3b82f6';
    ctx.fillRect(-6, -wid / 2 + 2, 12, 5);
    ctx.fillStyle = blink ? '#3b82f6' : '#ef4444';
    ctx.fillRect(-6, wid / 2 - 7, 12, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CBPD', 0, 3);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, isPlayer, hp) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(1, 2, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  // Direction tick + face.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath(); ctx.arc(5, 0, 4, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  if (hp !== undefined && hp < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 12, y - 20, 24, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - 12, y - 20, 24 * Math.max(0, hp / 100), 4);
  }
}

export function render(G) {
  const ctx = G.ctx;
  const view = G.view;
  const cam = G.camera;
  const sh = shakeOffset(G.fx);
  const vw = view.w / cam.zoom, vh = view.h / cam.zoom;

  ctx.save();
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + sh.x, -cam.y + sh.y);

  const vx1 = cam.x - vw / 2 - 40, vy1 = cam.y - vh / 2 - 40;
  const vx2 = cam.x + vw / 2 + 40, vy2 = cam.y + vh / 2 + 40;

  // Ground, tinted by district.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(vx1, vy1, vx2 - vx1, vy2 - vy1);
  for (const d of G.world.districts || []) {
    if (d.x2 < vx1 || d.x1 > vx2 || d.y2 < vy1 || d.y1 > vy2) continue;
    ctx.fillStyle = d.tint;
    ctx.fillRect(Math.max(d.x1, vx1), Math.max(d.y1, vy1), Math.min(d.x2, vx2) - Math.max(d.x1, vx1), Math.min(d.y2, vy2) - Math.max(d.y1, vy1));
  }

  // Water: bayou channel + lagoon, with a slow shimmer.
  const t = G.time;
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(BAYOU_X1, Math.max(vy1, 0), BAYOU_X2 - BAYOU_X1, Math.min(vy2, WORLD_H) - Math.max(vy1, 0));
  ctx.fillRect(Math.max(vx1, 0), LAGOON_Y1, Math.min(vx2, WORLD_W) - Math.max(vx1, 0), LAGOON_Y2 - LAGOON_Y1);
  ctx.strokeStyle = 'rgba(120,200,230,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const wy = 200 + i * 340 + Math.sin(t * 0.7 + i) * 8;
    if (wy < vy1 || wy > vy2) continue;
    ctx.beginPath();
    ctx.moveTo(BAYOU_X1 + 20, wy);
    ctx.lineTo(BAYOU_X2 - 20, wy + Math.sin(t + i) * 6);
    ctx.stroke();
  }

  // Docks piers.
  ctx.fillStyle = '#4a3520';
  for (const pier of G.world.piers) {
    if (pier.x + pier.w < vx1 || pier.x > vx2) continue;
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = '#6b4a2a';
    ctx.strokeRect(pier.x, pier.y, pier.w, pier.h);
  }

  // Roads: asphalt, edge lines, lane dashes.
  ctx.fillStyle = PALETTE.road;
  for (const ax of G.world.avenues) {
    if (ax + ROAD_W / 2 < vx1 || ax - ROAD_W / 2 > vx2) continue;
    ctx.fillRect(ax - ROAD_W / 2, Math.max(vy1, 0), ROAD_W, Math.min(vy2, WORLD_H) - Math.max(vy1, 0));
  }
  for (const sy of G.world.streets) {
    if (sy + ROAD_W / 2 < vy1 || sy - ROAD_W / 2 > vy2) continue;
    ctx.fillRect(Math.max(vx1, 0), sy - ROAD_W / 2, Math.min(vx2, WORLD_W) - Math.max(vx1, 0), ROAD_W);
  }
  // Lane dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const ax of G.world.avenues) {
    if (ax < vx1 || ax > vx2) continue;
    ctx.beginPath(); ctx.moveTo(ax, Math.max(vy1, 0)); ctx.lineTo(ax, Math.min(vy2, WORLD_H)); ctx.stroke();
  }
  for (const sy of G.world.streets) {
    if (sy < vy1 || sy > vy2) continue;
    ctx.beginPath(); ctx.moveTo(Math.max(vx1, 0), sy); ctx.lineTo(Math.min(vx2, WORLD_W), sy); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Sidewalk edges.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 5;
  for (const ax of G.world.avenues) {
    if (ax < vx1 || ax > vx2) continue;
    ctx.beginPath(); ctx.moveTo(ax - ROAD_W / 2 - 3, Math.max(vy1, 0)); ctx.lineTo(ax - ROAD_W / 2 - 3, Math.min(vy2, WORLD_H)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + ROAD_W / 2 + 3, Math.max(vy1, 0)); ctx.lineTo(ax + ROAD_W / 2 + 3, Math.min(vy2, WORLD_H)); ctx.stroke();
  }

  // Park grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(2080 + 40, 1120 + 40, 2720 - 2080 - 80, 1440 - 1120 - 80);

  // Skid marks.
  ctx.strokeStyle = 'rgba(10,10,14,0.7)';
  ctx.lineWidth = 4;
  for (const s of G.fx.skids) {
    if (s.x < vx1 || s.x > vx2 || s.y < vy1 || s.y > vy2) continue;
    ctx.globalAlpha = Math.min(0.7, s.life / 6);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Trees.
  for (const tr of G.world.trees) {
    if (tr.x < vx1 || tr.x > vx2 || tr.y < vy1 || tr.y > vy2) continue;
    ctx.fillStyle = '#14532d';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Buildings with neon signs and rooftop detail.
  for (const b of G.world.buildings) {
    if (b.x + b.w < vx1 || b.x > vx2 || b.y + b.h < vy1 || b.y > vy2) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    // Neon sign on the south face.
    if (b.sign) {
      ctx.save();
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.neon;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h - 8);
      ctx.restore();
    }
  }

  // Billboards.
  for (const bb of G.world.billboards) {
    if (bb.x < vx1 || bb.x > vx2 || bb.y < vy1 || bb.y > vy2) continue;
    ctx.save();
    ctx.shadowColor = bb.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#1a1024';
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
    ctx.fillStyle = bb.color;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bb.text, bb.x + bb.w / 2, bb.y + 18);
    ctx.restore();
  }

  // Lamps glow at dusk.
  for (const lamp of G.world.lamps) {
    if (lamp.x < vx1 || lamp.x > vx2 || lamp.y < vy1 || lamp.y > vy2) continue;
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Mission packages.
  for (const pkg of G.missions.packages) {
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    ctx.save();
    ctx.translate(pkg.x, pkg.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
    ctx.restore();
  }

  // Cars.
  for (const car of G.cars) {
    if (car.x < vx1 - 60 || car.x > vx2 + 60 || car.y < vy1 - 60 || car.y > vy2 + 60) continue;
    drawCarShape(ctx, car);
  }
  // Pedestrians.
  for (const p of G.peds) {
    if (p.x < vx1 || p.x > vx2 || p.y < vy1 || p.y > vy2) continue;
    drawPerson(ctx, p.x, p.y, p.angle, p.shirt, false);
  }
  // Foot cops.
  for (const cop of G.police.cops) {
    if (cop.x < vx1 || cop.x > vx2 || cop.y < vy1 || cop.y > vy2) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#1e3a8a', false);
  }
  // Enemies (Gator Kings).
  for (const e of G.combat.enemies) {
    if (e.x < vx1 || e.x > vx2 || e.y < vy1 || e.y > vy2) continue;
    drawPerson(ctx, e.x, e.y, e.angle, e.flash > 0 ? '#fff' : '#16a34a', false, e.hp);
  }
  // Player.
  const p = G.player;
  if (!p.inCar) drawPerson(ctx, p.x, p.y, p.angle, '#ff2e88', true, p.hp);

  // Bullets.
  ctx.fillStyle = '#fde68a';
  for (const b of G.combat.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Particles.
  for (const pt of G.fx.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating texts.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const ft of G.fx.texts) {
    ctx.globalAlpha = Math.min(1, ft.life);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Dusk gradient + vignette.
  const grad = ctx.createLinearGradient(0, vy1, 0, vy2);
  grad.addColorStop(0, 'rgba(255,80,120,0.05)');
  grad.addColorStop(0.6, 'rgba(30,10,60,0.0)');
  grad.addColorStop(1, 'rgba(10,5,30,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(vx1, vy1, vx2 - vx1, vy2 - vy1);

  ctx.restore();

  // District watermark, faint, over the world edge.
  const d = districtAt(p.x, p.y);
  void d;
}
