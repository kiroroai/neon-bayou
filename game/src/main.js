// Neon Bayou — the game itself: renderer, loop, camera, input, combat,
// collisions, saving, and the screens that tie every system together.

import * as THREE from 'three';
import { makeRng, clamp, distance2D } from './rng.js';
import { createCity, CITY_HALF } from './city.js';
import { TrafficSystem } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { SoundEngine } from './audio.js';
import { readShotParams, stageShot } from './shots.js';

const SAVE_KEY = 'neon-bayou-save-v1';

export class Game {
  constructor() {
    this.seed = 1;
    this.shotMode = false;
    this.state = 'start';
    this.timeOfDay = 11.0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.lastDragAt = 0;
    this.gunshotPos = null;
    this.gunshotTimer = 0;
    this.saveTimer = 0;
    this.elapsed = 0;
    this.tracer = null;
    this.tracerTimer = 0;
    this.colliders = [];
    this.keys = {};
    this.mouseDown = false;
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d8);
    this.scene.fog = new THREE.Fog(0x87b5d8, 60, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    this.sun.position.set(120, 180, 60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3230, 1.1);
    this.scene.add(this.hemi);

    this.city = createCity(this.scene, this.seed);
    for (const b of this.city.buildings) {
      this.colliders.push({ x: b.x, z: b.z, hw: b.w / 2 + 0.6, hd: b.d / 2 + 0.6 });
    }
    this.colliders.push({ x: 140, z: 60, hw: 8.6, hd: 6.6 });
    this.colliders.push({ x: -140, z: -140, hw: 6.6, hd: 5.6 });

    this.traffic = new TrafficSystem(this.scene, this.seed, this.city);
    this.peds = new PedestrianSystem(this.scene, this.seed);
    this.rng = makeRng(this.seed + 999);
    this.player = new Player(this.scene, this.city.landmarks.spawn);
    this.police = new PoliceSystem(this.scene, this.rng);
    this.missions = new MissionManager(this.scene, this.city.landmarks);
    this.missions.onMissionEvent = (type, payload) => this.onMissionEvent(type, payload);
    this.hud = new Hud();
    this.sound = new SoundEngine();
    this.bindHud();
    this.bindInput();
    this.missions.startMission(0);

    const shot = readShotParams();
    if (shot) {
      this.seed = shot.seed;
      stageShot(this, shot.shot);
      this.state = 'playing';
      this.hud.hideStart();
      this.hud.hideOver();
      this.hud.hidePause();
    } else {
      const save = this.loadSave();
      this.hud.showStart(!!save);
      this.pendingSave = save;
    }

    window.addEventListener('resize', () => this.onResize());
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bindHud() {
    this.hud.onStart = () => {
      this.sound.unlock();
      this.sound.click();
      this.newGame();
    };
    this.hud.onContinue = () => {
      this.sound.unlock();
      this.sound.click();
      this.continueGame();
    };
    this.hud.onRestart = () => {
      this.sound.unlock();
      this.sound.click();
      this.restartAfterOver();
    };
    this.hud.onResume = () => {
      this.sound.unlock();
      this.sound.click();
      this.state = 'playing';
      this.hud.hidePause();
    };
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
    this.player.revive(this.city.landmarks.spawn);
    this.player.money = 250;
    this.police.clearWanted();
    this.missions.startMission(0);
    this.timeOfDay = 11.0;
    this.state = 'playing';
    this.hud.hideStart();
    this.hud.hideOver();
    this.hud.showMessage('Welcome to Cypress Bay. Delacroix needs a driver — steal a car!', 6);
  }

  continueGame() {
    const save = this.pendingSave || this.loadSave();
    if (save) this.applySave(save);
    this.state = 'playing';
    this.hud.hideStart();
    this.hud.hideOver();
    this.hud.showMessage('Welcome back to Cypress Bay.', 4);
  }

  restartAfterOver() {
    this.player.revive(this.city.landmarks.spawn);
    this.police.clearWanted();
    this.state = 'playing';
    this.hud.hideOver();
    this.hud.showMessage('You dust yourself off. Cypress Bay is still yours.', 4);
  }

  onMissionEvent(type, payload) {
    if (type === 'briefing') {
      this.hud.setObjective(`Mission ${payload.id} — ${payload.title}`, payload.briefing);
      this.hud.showMessage(`${payload.giver}: ${payload.briefing}`, 6);
    } else if (type === 'complete') {
      this.sound.missionDone();
      this.hud.showMessage(`Mission complete! +$${payload.reward}`, 5);
      this.hud.setObjective(`Mission ${payload.id} — ${payload.title}`, 'Complete!');
      this.saveGame();
      if (payload.id === 3) this.missions.armHeatWave(this.police);
    } else if (type === 'step') {
      this.sound.pickup();
    } else if (type === 'pickup') {
      this.sound.pickup();
      this.hud.showMessage('Package secured. Get it to the Garage.', 4);
    } else if (type === 'story') {
      this.sound.missionDone();
      this.hud.showMessage('Story complete! Cypress Bay is yours — free roam.', 7);
      this.saveGame();
    }
    if (this.missions.current() && this.missions.current().id === 3 && this.missions.step === 0 && type === 'briefing') {
      this.missions.armHeatWave(this.police);
    }
  }

  isBlocked(x, z) {
    for (const c of this.colliders) {
      if (Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) return true;
    }
    return false;
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyM') {
        this.sound.setMuted(!this.sound.muted);
        this.hud.showMessage(this.sound.muted ? 'Sound off' : 'Sound on', 2);
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.state === 'playing' && !this.shotMode) {
        this.state = 'paused';
        this.hud.showPause();
      } else if ((e.code === 'Escape' || e.code === 'KeyP') && this.state === 'paused') {
        this.state = 'playing';
        this.hud.hidePause();
      }
      if (e.code === 'KeyE' && this.state === 'playing') this.tryEnterExitCar();
      if (e.code === 'KeyF' && this.state === 'playing') this.tryPunch();
      if (e.code === 'KeyR' && this.state === 'playing') {
        this.player.reloadTimer = 1.4;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.lastDragAt = this.elapsed;
      this.dragX = e.clientX;
      this.dragY = e.clientY;
      if (this.state === 'playing' && !this.player.car) this.tryShoot();
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseDown || this.shotMode) return;
      const dx = e.clientX - this.dragX;
      const dy = e.clientY - this.dragY;
      this.dragX = e.clientX;
      this.dragY = e.clientY;
      this.cameraYaw -= dx * 0.005;
      this.cameraPitch = clamp(this.cameraPitch + dy * 0.003, 0.05, 1.1);
      this.lastDragAt = this.elapsed;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.mouseDown = false;
    });
  }

  readMoveInput() {
    return {
      forward: !!(this.keys.KeyW || this.keys.ArrowUp),
      backward: !!(this.keys.KeyS || this.keys.ArrowDown),
      left: !!(this.keys.KeyA || this.keys.ArrowLeft),
      right: !!(this.keys.KeyD || this.keys.ArrowRight),
      run: !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
      brake: !!this.keys.Space,
    };
  }

  tryEnterExitCar() {
    if (this.player.car) {
      this.player.exitCar();
      this.sound.engineOff();
      return;
    }
    const car = this.traffic.nearestCar(this.player.x, this.player.z, 4.5);
    if (!car) return;
    const wasTraffic = car.traffic;
    car.traffic = false;
    car.parked = false;
    this.player.enterCar(car);
    this.sound.engineOn();
    this.sound.click();
    if (wasTraffic) {
      this.police.addWanted(1, 'carjacking');
      this.sound.wantedUp();
      this.hud.showMessage('You jacked a moving car! The cops saw that.', 3);
    } else {
      this.hud.showMessage('Car stolen. Drive!', 2);
    }
  }

  tryPunch() {
    if (!this.player.punch()) return;
    this.sound.punch();
    const target = this.nearestPerson(2.4);
    if (target) {
      const killed = target.damage(30);
      const kx = Math.sin(this.player.heading) * 2;
      const kz = Math.cos(this.player.heading) * 2;
      target.mesh.position.x += kx;
      target.mesh.position.z += kz;
      this.police.addWanted(1, 'assault');
      this.sound.wantedUp();
      if (killed) this.hud.showMessage('You knocked them out cold.', 2);
    }
  }

  nearestPerson(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds.peds) {
      if (!ped.alive) continue;
      const d = distance2D(this.player.x, this.player.z, ped.x, ped.z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    for (const cop of this.police.copPeds) {
      const d = distance2D(this.player.x, this.player.z, cop.x, cop.z);
      if (d < bestD) { bestD = d; best = cop; }
    }
    return best;
  }

  tryShoot() {
    if (!this.player.shoot()) {
      if (this.player.ammo === 0) this.hud.showMessage('Reloading…', 1);
      return;
    }
    this.sound.gunshot();
    this.player.muzzleFlash(this.scene);
    this.gunshotPos = { x: this.player.x, z: this.player.z };
    this.gunshotTimer = 3;
    this.police.addWanted(1, 'shots fired');
    this.sound.wantedUp();
    // Manual ray test against people and cars along the camera forward.
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let bestT = 70;
    let bestHit = null;
    let bestKind = null;
    const testPoint = (x, z, y, radius, obj, kind) => {
      const vx = x - origin.x;
      const vy = y - origin.y;
      const vz = z - origin.z;
      const t = vx * dir.x + vy * dir.y + vz * dir.z;
      if (t < 1 || t > bestT) return;
      const px = origin.x + dir.x * t - x;
      const py = origin.y + dir.y * t - y;
      const pz = origin.z + dir.z * t - z;
      if (px * px + py * py + pz * pz < radius * radius) {
        bestT = t;
        bestHit = obj;
        bestKind = kind;
      }
    };
    for (const ped of this.peds.peds) {
      if (ped.alive) testPoint(ped.x, ped.z, 1.2, 1.1, ped, 'ped');
    }
    for (const cop of this.police.copPeds) {
      testPoint(cop.x, cop.z, 1.2, 1.1, cop, 'cop');
    }
    for (const car of this.traffic.cars) {
      testPoint(car.x, car.z, 0.8, 2.2, car, 'car');
    }
    for (const car of this.police.copCars) {
      testPoint(car.x, car.z, 0.8, 2.2, car, 'copcar');
    }
    const end = origin.clone().add(dir.clone().multiplyScalar(bestHit ? bestT : 60));
    this.showTracer(origin, end);
    if (bestHit) {
      if (bestKind === 'ped') {
        const killed = bestHit.damage(34);
        if (killed) this.hud.showMessage('You took them down.', 2);
      } else if (bestKind === 'cop') {
        bestHit.damage(34);
        this.police.addWanted(1, 'shot a cop');
      } else if (bestKind === 'car') {
        if (bestHit.damage(25)) this.hud.showMessage('That car is wrecked.', 2);
      } else if (bestKind === 'copcar') {
        if (bestHit.damage(25)) {
          this.police.destroyCopCar(bestHit);
          this.hud.showMessage('Cruiser disabled!', 3);
        }
      }
    }
  }

  showTracer(from, to) {
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
    this.scene.add(this.tracer);
    this.tracerTimer = 0.07;
  }

  updateLighting() {
    const t = this.timeOfDay;
    let sky, fog, sunI, sunColor, hemiI;
    if (t >= 6 && t < 9) { sky = 0xf2b98a; fog = 0xe8b98a; sunI = 1.6; sunColor = 0xffc98a; hemiI = 0.9; }
    else if (t >= 9 && t < 16.5) { sky = 0x87b5d8; fog = 0x87b5d8; sunI = 2.2; sunColor = 0xfff2d8; hemiI = 1.1; }
    else if (t >= 16.5 && t < 19) { sky = 0xe88a5a; fog = 0xd88a6a; sunI = 1.4; sunColor = 0xff9a55; hemiI = 0.8; }
    else { sky = 0x141c3a; fog = 0x141c3a; sunI = 0.55; sunColor = 0x8aa0ff; hemiI = 0.65; }
    this.scene.background.setHex(sky);
    this.scene.fog.color.setHex(fog);
    this.sun.intensity = sunI;
    this.sun.color.setHex(sunColor);
    this.hemi.intensity = hemiI;
  }

  updateCamera(dt) {
    const target = this.player.car
      ? new THREE.Vector3(this.player.car.x, 1.4, this.player.car.z)
      : new THREE.Vector3(this.player.x, 1.6, this.player.z);
    if (this.player.car && !this.shotMode && this.elapsed - this.lastDragAt > 2.5) {
      let diff = this.player.car.heading - this.cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.cameraYaw += diff * Math.min(1, dt * 1.2);
    }
    const dist = this.player.car ? 11 : 7.5;
    const height = this.player.car ? 4.2 : 3.0;
    const cx = target.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const cz = target.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * dist;
    const cy = target.y + Math.sin(this.cameraPitch) * dist + height * 0.4;
    this.camera.position.set(cx, Math.max(cy, 1.2), cz);
    this.camera.lookAt(target);
  }

  frame() {
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = clamp(dt, 0.001, 0.05);
    if (this.state !== 'playing') {
      if (this.state === 'start') {
        // Slow cinematic orbit over Cypress Bay behind the start screen.
        const a = performance.now() * 0.00004;
        this.camera.position.set(Math.sin(a) * 140, 70, Math.cos(a) * 140);
        this.camera.lookAt(0, 0, 0);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.elapsed += dt;
    if (!this.shotMode) this.timeOfDay = (this.timeOfDay + dt * 0.02) % 24;
    this.updateLighting();

    const input = this.readMoveInput();
    if (this.player.car) {
      const car = this.player.car;
      const ox = car.x;
      const oz = car.z;
      car.drive(input, dt);
      if (this.isBlocked(car.x, car.z)) {
        car.mesh.position.x = ox;
        car.mesh.position.z = oz;
        if (Math.abs(car.speed) > 6) {
          this.sound.crash();
          this.player.hurt(6);
          car.damage(12);
        }
        car.speed *= -0.25;
      }
      this.sound.setEngineSpeed(Math.abs(car.speed) / 24, input.forward);
      // Running over pedestrians is a crime.
      for (const ped of this.peds.peds) {
        if (!ped.alive) continue;
        if (Math.abs(car.speed) > 3 && distance2D(car.x, car.z, ped.x, ped.z) < 2.4) {
          ped.damage(60);
          this.police.addWanted(1, 'hit a pedestrian');
          this.sound.wantedUp();
          this.sound.crash();
        }
      }
    } else {
      this.player.updateOnFoot(input, this.cameraYaw, dt, this);
      this.sound.engineOff();
    }

    this.traffic.update(dt, this.player.car, this.police.copCars);
    if (this.gunshotTimer > 0) {
      this.gunshotTimer -= dt;
      if (this.gunshotTimer <= 0) this.gunshotPos = null;
    }
    this.peds.update(dt, { x: this.player.x, z: this.player.z }, this.gunshotPos);
    this.police.update(dt, this.player, this.sound);
    this.missions.update(dt, this.player, this.police);
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0 && this.tracer) {
        this.scene.remove(this.tracer);
        this.tracer = null;
      }
    }

    if (this.player.dead && this.state === 'playing') {
      this.state = 'over';
      this.sound.engineOff();
      this.sound.sirenOff();
      this.hud.showOver('WASTED', 'Rook went down in Cypress Bay. The city keeps moving without you.');
      this.saveGame();
    } else if (this.player.busted && this.state === 'playing') {
      this.state = 'over';
      this.sound.engineOff();
      this.sound.sirenOff();
      this.hud.showOver('BUSTED', 'The Cypress Bay police took you in. Bail is cheap — try again.');
      this.saveGame();
    }

    this.updateCamera(dt);
    const speedKmh = this.player.car ? this.player.car.speed * 3.6 : 0;
    this.hud.update(this.player, this.police, this.missions, speedKmh, this.timeOfDay);
    this.hud.setObjective(
      this.missions.current() ? `Mission ${this.missions.current().id} — ${this.missions.current().title}` : 'Free Roam',
      this.missions.objectiveText(),
    );
    this.hud.drawMinimap(this, this.player, this.police, this.missions, this.traffic.cars);

    this.saveTimer += dt;
    if (this.saveTimer > 12) {
      this.saveTimer = 0;
      this.saveGame();
    }
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  saveGame() {
    if (this.shotMode) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.player.money,
        health: this.player.health,
        missionIndex: this.missions.index,
        missionStep: this.missions.step,
        x: this.player.x,
        z: this.player.z,
        heading: this.player.heading,
        timeOfDay: this.timeOfDay,
      }));
    } catch (err) {}
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  applySave(save) {
    this.player.money = save.money || 250;
    this.player.health = save.health || 100;
    this.player.mesh.position.set(save.x || 0, 0, save.z || 20);
    this.player.heading = save.heading || 0;
    this.timeOfDay = save.timeOfDay || 11;
    this.missions.loadState({ index: save.missionIndex, step: save.missionStep });
    const m = this.missions.current();
    if (m) this.hud.setObjective(`Mission ${m.id} — ${m.title}`, m.briefing);
  }
}

const game = new Game();
game.init();
