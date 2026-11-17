// Neon Bayou — the game loop: state machine, staging for screenshots,
// and the window.__game debug handle. One job: run the whole game.
import { TUNING } from './config.js';
import { makeRng, clamp } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayerOnFoot, enterCar, exitCar, nearestEnterableCar } from './player.js';
import { createCar, updatePlayerCar, updateTraffic, spawnParkedCars, spawnTraffic } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { createPolice, addWanted, updatePolice } from './police.js';
import { createMissions, startMission, updateMissions, currentObjective } from './missions.js';
import { createCombat, updateCombat } from './combat.js';
import { createEffects, updateEffects, addShake } from './effects.js';
import { drawHUD } from './hud.js';
import { createCamera, updateCamera, render } from './render.js';
import { saveGame, loadGame, clearSave } from './save.js';

function createGame(canvas) {
  const world = buildWorld();
  const G = {
    time: 0,
    state: 'title', // title | playing | paused | busted
    view: { w: window.innerWidth, h: window.innerHeight },
    canvas,
    ctx: canvas.getContext('2d'),
    rng: makeRng(1337),
    world,
    input: createInput(canvas),
    audio: createAudio(),
    camera: createCamera(),
    fx: createEffects(),
    police: createPolice(),
    missions: createMissions(),
    combat: createCombat(),
    player: createPlayer(world.spawn.player.x, world.spawn.player.y),
    cars: [],
    peds: [],
    stats: { missionsDone: 0, carsStolen: 0, cashEarned: 0 },
    save: loadGame(),
    stage: null,
  };
  // Bound helpers the other modules call through G.
  G.police.addWanted = (stars, reason) => addWanted(G, stars, reason);
  G.saveProgress = () => saveGame({
    cash: G.player.cash,
    missionIndex: G.missions.index,
    missionsDone: G.stats.missionsDone,
  });
  spawnParkedCars(G);
  spawnTraffic(G);
  spawnPeds(G, TUNING.pedestrians);
  return G;
}

function startNewGame(G) {
  clearSave();
  G.player = createPlayer(G.world.spawn.player.x, G.world.spawn.player.y);
  G.police = createPolice();
  G.police.addWanted = (stars, reason) => addWanted(G, stars, reason);
  G.missions = createMissions();
  G.combat = createCombat();
  G.stats = { missionsDone: 0, carsStolen: 0, cashEarned: 0 };
  G.state = 'playing';
  startMission(G, 0);
  G.audio.unlock();
  G.audio.startMusic();
}

function continueGame(G) {
  const s = G.save;
  G.player = createPlayer(G.world.spawn.player.x, G.world.spawn.player.y);
  G.player.cash = (s && s.cash) || 0;
  G.police = createPolice();
  G.police.addWanted = (stars, reason) => addWanted(G, stars, reason);
  G.missions = createMissions();
  G.combat = createCombat();
  G.stats = { missionsDone: (s && s.missionsDone) || 0, carsStolen: 0, cashEarned: 0 };
  G.state = 'playing';
  startMission(G, (s && s.missionIndex) || 0);
  G.audio.unlock();
  G.audio.startMusic();
}

function respawnAfterBusted(G) {
  const p = G.player;
  p.hp = TUNING.playerHp;
  p.cash = Math.max(0, p.cash - 100);
  p.x = G.world.spawn.player.x;
  p.y = G.world.spawn.player.y;
  if (p.inCar) { p.inCar.driver = 'parked'; p.inCar = null; }
  G.police.wanted = 0;
  G.police.cops = [];
  G.state = 'playing';
}

// Staging for screenshots: deterministic scenes via ?stage=...
function applyStage(G, stage) {
  const p = G.player;
  G.stage = stage;
  G.state = 'playing';
  G.audio.unlock();
  if (stage === 'menu') { G.state = 'title'; return; }
  if (stage === 'chase') {
    const car = createCar('comet', 2400, 800, 0, 'player');
    G.cars.push(car);
    p.inCar = car;
    car.speed = 300;
    p.x = car.x; p.y = car.y;
    G.police.wanted = 3;
    for (let i = 0; i < 3; i++) {
      const c = createCar('cruiser', 2400 - 140 - i * 90, 800 + (i - 1) * 44, 0, 'police');
      c.speed = 280;
      G.cars.push(c);
    }
    startMission(G, 1);
    G.missions.banner = null;
  } else if (stage === 'drive') {
    const car = createCar('sunset', 1760, 480, Math.PI / 2, 'player');
    G.cars.push(car);
    p.inCar = car;
    car.speed = 260;
    p.x = car.x; p.y = car.y;
    G.police.wanted = 1;
    startMission(G, 0);
    G.missions.banner = null;
  } else if (stage === 'foot') {
    p.x = 2400; p.y = 1760;
    startMission(G, 4);
    G.missions.banner = null;
  } else if (stage === 'bayou') {
    const car = createCar('gator', 700, 1900, -Math.PI / 2, 'player');
    G.cars.push(car);
    p.inCar = car;
    car.speed = 120;
    p.x = car.x; p.y = car.y;
    G.police.wanted = 0;
    startMission(G, 2);
    G.missions.banner = null;
  }
  // Snap the camera onto the player for a settled first frame.
  G.camera.x = clamp(p.x, 0, 3200);
  G.camera.y = clamp(p.y, 0, 2400);
}

function updatePlaying(G, dt) {
  const p = G.player;
  const input = G.input;

  // Pause.
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    G.state = 'paused';
    G.audio.setEngine(0, false);
    return;
  }
  // Enter / exit a car.
  if (input.pressed('KeyE')) {
    if (p.inCar) exitCar(G);
    else {
      const car = nearestEnterableCar(G);
      if (car) enterCar(G, car);
    }
  }

  if (p.inCar) updatePlayerCar(G, dt);
  else updatePlayerOnFoot(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  updateEffects(G.fx, dt);
  updateCamera(G, dt);
  if (G.missions.banner) G.missions.banner.t -= dt;

  // Engine hum follows the driven car.
  if (p.inCar) G.audio.setEngine(Math.abs(p.inCar.speed) / p.inCar.def.top, true);
  else G.audio.setEngine(0, false);
}

function drawTitle(ctx, G) {
  const w = G.view.w, h = G.view.h;
  ctx.save();
  // Dusk sky gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a0b2e');
  grad.addColorStop(0.55, '#3b1155');
  grad.addColorStop(1, '#0b3542');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Neon sun.
  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 60;
  ctx.fillStyle = '#ff5e3a';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.32, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1a0b2e';
  for (let i = 0; i < 5; i++) ctx.fillRect(w / 2 - 110, h * 0.32 - 40 + i * 22, 220, 7);
  // Title.
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('NEON BAYOU', w / 2, h * 0.52);
  ctx.restore();
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('A CYPRESS BAY CRIME STORY', w / 2, h * 0.52 + 38);
  // Menu.
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  if (G.save) {
    ctx.fillText(`ENTER — Continue: Mission ${G.save.missionIndex + 1}  •  $${G.save.cash}`, w / 2, h * 0.66);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('N — New game', w / 2, h * 0.66 + 30);
  } else {
    ctx.fillText('ENTER — New game', w / 2, h * 0.66);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD drive & walk  •  E steal / exit car  •  SPACE shoot  •  SHIFT sprint  •  P pause', w / 2, h * 0.78);
  ctx.fillText('Steal cars, run missions, outrun the CBPD — and mind the Gator Kings.', w / 2, h * 0.78 + 24);
  ctx.restore();
}

function drawPaused(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,5,15,0.72)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('PAUSED', G.view.w / 2, G.view.h / 2 - 10);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('P / ESC — resume    •    M — mute    •    R — restart from garage', G.view.w / 2, G.view.h / 2 + 34);
  ctx.restore();
}

function drawBusted(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,0,0,0.78)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('BUSTED', G.view.w / 2, G.view.h / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('The CBPD took you in. Bail cost you $100.', G.view.w / 2, G.view.h / 2 + 34);
  ctx.fillText('ENTER — back on the streets', G.view.w / 2, G.view.h / 2 + 64);
  ctx.restore();
}

function frame(G, now) {
  requestAnimationFrame(t => frame(G, t));
  const dt = Math.min(0.05, (now - (G._last || now)) / 1000 || 0.016);
  G._last = now;
  const input = G.input;

  if (G.state === 'title') {
    if (input.pressed('Enter')) {
      if (G.save && !input.down('KeyN')) continueGame(G);
      else startNewGame(G);
    }
    if (input.pressed('KeyN')) startNewGame(G);
    if (input.pressed('KeyM')) G.audio.setMuted(true);
    drawTitle(G.ctx, G);
    input.endFrame();
    return;
  }

  if (G.state === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) G.state = 'playing';
    if (input.pressed('KeyR')) { respawnAfterBusted(G); G.state = 'playing'; }
    render(G);
    drawHUD(G.ctx, G);
    drawPaused(G.ctx, G);
    input.endFrame();
    return;
  }

  if (G.state === 'busted') {
    if (input.pressed('Enter')) respawnAfterBusted(G);
    render(G);
    drawHUD(G.ctx, G);
    drawBusted(G.ctx, G);
    input.endFrame();
    return;
  }

  // playing
  G.time += dt;
  updatePlaying(G, dt);
  render(G);
  drawHUD(G.ctx, G);
  if (input.pressed('KeyM')) G.audio.setMuted(true);
  input.endFrame();
}

function resize(G) {
  G.view.w = window.innerWidth;
  G.view.h = window.innerHeight;
  G.canvas.width = G.view.w;
  G.canvas.height = G.view.h;
}

export function boot() {
  const canvas = document.getElementById('game');
  const G = createGame(canvas);
  resize(G);
  window.addEventListener('resize', () => resize(G));

  const params = new URLSearchParams(window.location.search);
  const stage = params.get('stage');
  if (stage) applyStage(G, stage);

  // Debug handle for play-testing and screenshots (harmless in review).
  window.__game = {
    state: G,
    start: () => { if (G.state === 'title') startNewGame(G); },
    teleport: (x, y) => { G.player.x = x; G.player.y = y; if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.y = y; } },
    setWanted: n => { G.police.wanted = n; },
    startMission: i => startMission(G, i),
    stage: s => applyStage(G, s),
  };

  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  requestAnimationFrame(t => frame(G, t));
  return G;
}

boot();
