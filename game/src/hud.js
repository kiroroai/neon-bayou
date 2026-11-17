// Neon Bayou — the HUD: health, cash, wanted stars, mission objective,
// messages, the minimap, and the start / pause / game-over screens.
// All DOM, drawn over the 3D canvas.

export class Hud {
  constructor() {
    this.el = {
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      money: document.getElementById('money'),
      ammo: document.getElementById('ammo'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      objectiveTitle: document.getElementById('objective-title'),
      message: document.getElementById('message'),
      minimap: document.getElementById('minimap'),
      crosshair: document.getElementById('crosshair'),
      speed: document.getElementById('speed'),
      startScreen: document.getElementById('start-screen'),
      pauseScreen: document.getElementById('pause-screen'),
      overScreen: document.getElementById('over-screen'),
      overTitle: document.getElementById('over-title'),
      overText: document.getElementById('over-text'),
      clock: document.getElementById('clock'),
      wantedLabel: document.getElementById('wanted-label'),
    };
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.messageTimer = null;
    this.onStart = null;
    this.onContinue = null;
    this.onRestart = null;
    this.onResume = null;
    this.bindButtons();
  }

  bindButtons() {
    const startBtn = document.getElementById('btn-start');
    const continueBtn = document.getElementById('btn-continue');
    const restartBtn = document.getElementById('btn-restart');
    const resumeBtn = document.getElementById('btn-resume');
    const quitBtn = document.getElementById('btn-quit');
    if (startBtn) startBtn.addEventListener('click', () => this.onStart && this.onStart());
    if (continueBtn) continueBtn.addEventListener('click', () => this.onContinue && this.onContinue());
    if (restartBtn) restartBtn.addEventListener('click', () => this.onRestart && this.onRestart());
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.onResume && this.onResume());
    if (quitBtn) quitBtn.addEventListener('click', () => this.onRestart && this.onRestart());
  }

  showStart(hasSave) {
    this.el.startScreen.classList.remove('hidden');
    this.el.pauseScreen.classList.add('hidden');
    this.el.overScreen.classList.add('hidden');
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.style.display = hasSave ? '' : 'none';
  }

  hideStart() {
    this.el.startScreen.classList.add('hidden');
  }

  showPause() {
    this.el.pauseScreen.classList.remove('hidden');
  }

  hidePause() {
    this.el.pauseScreen.classList.add('hidden');
  }

  showOver(title, text) {
    this.el.overTitle.textContent = title;
    this.el.overText.textContent = text;
    this.el.overScreen.classList.remove('hidden');
  }

  hideOver() {
    this.el.overScreen.classList.add('hidden');
  }

  showMessage(text, seconds) {
    if (!this.el.message) return;
    this.el.message.textContent = text;
    this.el.message.classList.remove('hidden');
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.el.message.classList.add('hidden'), (seconds || 4) * 1000);
  }

  setObjective(title, text) {
    if (this.el.objectiveTitle) this.el.objectiveTitle.textContent = title;
    if (this.el.objective) this.el.objective.textContent = text;
  }

  update(player, police, mission, speedKmh, timeOfDay) {
    if (this.el.healthFill) this.el.healthFill.style.width = `${Math.max(0, player.health)}%`;
    if (this.el.healthText) this.el.healthText.textContent = `${Math.ceil(player.health)}`;
    if (this.el.money) this.el.money.textContent = `$${player.money.toLocaleString('en-US')}`;
    if (this.el.ammo) this.el.ammo.textContent = player.car ? '—' : (player.reloadTimer > 0 ? 'RELOADING' : `AMMO ${player.ammo}/${player.ammoMax}`);
    if (this.el.speed) this.el.speed.textContent = player.car ? `${Math.round(Math.abs(speedKmh))} km/h` : '';
    if (this.el.clock) {
      const hours = Math.floor(timeOfDay) % 24;
      const mins = Math.floor((timeOfDay % 1) * 60);
      this.el.clock.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    if (this.el.stars) {
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < police.wanted ? '★' : '☆';
      this.el.stars.textContent = stars;
      this.el.stars.classList.toggle('hot', police.wanted > 0);
    }
    if (this.el.wantedLabel) {
      this.el.wantedLabel.textContent = police.wanted > 0 ? 'WANTED' : '';
    }
    if (this.el.crosshair) {
      this.el.crosshair.style.display = !player.car && !player.dead ? '' : 'none';
    }
  }

  drawMinimap(world, player, police, mission, trafficCars) {
    if (!this.mapCtx) return;
    const ctx = this.mapCtx;
    const size = 180;
    const half = 210;
    const scale = size / (half * 2);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
    ctx.fillRect(0, 0, size, size);
    // Bayou water.
    ctx.fillStyle = '#0d4a4a';
    ctx.fillRect(0, size / 2 + 200 * scale, size, size);
    // Roads.
    ctx.strokeStyle = '#5a5f6e';
    ctx.lineWidth = 4;
    for (const s of world.city.streets) {
      const [x1, y1] = toMap(-210, s);
      const [x2, y2] = toMap(210, s);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(s, -210);
      const [x4, y4] = toMap(s, 210);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#3d4458';
    for (const b of world.city.buildings) {
      const [mx, mz] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(mx, mz, b.w * scale, b.d * scale);
    }
    // Mission marker.
    const step = mission.currentStep();
    if (step && step.at) {
      const spot = world.city.landmarks[step.at];
      const [mx, mz] = toMap(spot.x, spot.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx, mz, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, mz, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#c8c8c8';
    for (const car of trafficCars) {
      const [mx, mz] = toMap(car.x, car.z);
      ctx.fillRect(mx - 1, mz - 1, 2, 2);
    }
    // Police blips.
    ctx.fillStyle = '#3a7bff';
    for (const car of police.copCars) {
      const [mx, mz] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(mx, mz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of police.copPeds) {
      const [mx, mz] = toMap(cop.x, cop.z);
      ctx.fillRect(mx - 2, mz - 2, 4, 4);
    }
    // Player arrow.
    const [px, py] = toMap(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - player.heading);
    ctx.fillStyle = player.car ? '#ffd23f' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
