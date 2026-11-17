// Neon Bayou — Rook, the player. On foot he walks, runs, punches and
// shoots; in a car he drives. Health, cash and the camera follow him.

import * as THREE from 'three';
import { clamp } from './rng.js';
import { buildPersonMesh } from './pedestrians.js';

export class Player {
  constructor(scene, spawn) {
    this.scene = scene;
    this.mesh = buildPersonMesh(0xd83a3a, 0x2a2f45, false);
    // Rook's look: red jacket, dark jeans, distinct from any passer-by.
    this.mesh.position.set(spawn.x, 0, spawn.z);
    scene.add(this.mesh);
    this.heading = spawn.heading;
    this.health = 100;
    this.maxHealth = 100;
    this.money = 250;
    this.ammo = 30;
    this.ammoMax = 30;
    this.reloadTimer = 0;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.walkPhase = 0;
    this.car = null;
    this.dead = false;
    this.busted = false;
    this.muzzle = null;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  enterCar(car) {
    this.car = car;
    car.driver = this;
    this.mesh.visible = false;
    this.mesh.position.set(car.x, 0, car.z);
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.driver = null;
    this.car = null;
    const side = 2.6;
    const px = car.x + Math.cos(car.heading) * side;
    const pz = car.z - Math.sin(car.heading) * side;
    this.mesh.position.set(px, 0, pz);
    this.mesh.visible = true;
    this.heading = car.heading;
    this.mesh.rotation.y = this.heading;
  }

  updateOnFoot(input, cameraYaw, dt, world) {
    if (this.dead || this.busted || this.car) return;
    let mx = 0;
    let mz = 0;
    if (input.forward) mz += 1;
    if (input.backward) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const speed = input.run ? 9.5 : 5.2;
    if (moving) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      // Forward is (sin yaw, cos yaw); right is (-cos yaw, sin yaw).
      const wx = mz * sin - mx * cos;
      const wz = mz * cos + mx * sin;
      const nx = this.x + wx * speed * dt;
      const nz = this.z + wz * speed * dt;
      if (!world.isBlocked(nx, this.z)) this.mesh.position.x = nx;
      if (!world.isBlocked(this.x, nz)) this.mesh.position.z = nz;
      const want = Math.atan2(wx, wz);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += clamp(diff, -10 * dt, 10 * dt);
    }
    this.mesh.rotation.y = this.heading;
    this.walkPhase += dt * (moving ? speed * 1.6 : 0);
    const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    const legL = this.mesh.getObjectByName('legL');
    const legR = this.mesh.getObjectByName('legR');
    const armL = this.mesh.getObjectByName('armL');
    const armR = this.mesh.getObjectByName('armR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = this.punchTimer > 0 ? -1.6 : -swing * 0.7;
    if (armR) armR.rotation.x = swing * 0.7;
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = this.ammoMax;
    }
    if (this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 1.2 * dt);
    }
  }

  punch() {
    if (this.punchCooldown > 0 || this.car) return false;
    this.punchCooldown = 0.45;
    this.punchTimer = 0.3;
    return true;
  }

  shoot() {
    if (this.car || this.reloadTimer > 0) return false;
    if (this.ammo <= 0) {
      this.reloadTimer = 1.4;
      return false;
    }
    this.ammo -= 1;
    if (this.ammo === 0) this.reloadTimer = 1.4;
    return true;
  }

  hurt(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.3;
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  revive(spawn) {
    this.dead = false;
    this.busted = false;
    this.health = this.maxHealth;
    this.ammo = this.ammoMax;
    if (this.car) this.exitCar();
    this.mesh.rotation.x = 0;
    this.mesh.position.set(spawn.x, 0, spawn.z);
    this.mesh.visible = true;
    this.heading = spawn.heading;
  }

  muzzleFlash(scene) {
    if (this.muzzle) scene.remove(this.muzzle);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd55 }),
    );
    const fx = this.x + Math.sin(this.heading) * 0.8;
    const fz = this.z + Math.cos(this.heading) * 0.8;
    flash.position.set(fx, 1.4, fz);
    scene.add(flash);
    this.muzzle = flash;
    setTimeout(() => {
      scene.remove(flash);
      if (this.muzzle === flash) this.muzzle = null;
    }, 60);
  }
}
