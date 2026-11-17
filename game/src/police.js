// Neon Bayou — the Cypress Bay police: wanted stars, chasing cruisers,
// foot officers, arrests, and the heat cooling off when you lay low.

import * as THREE from 'three';
import { clamp, angleLerp, distance2D } from './rng.js';
import { Car } from './vehicles.js';
import { Pedestrian } from './pedestrians.js';
import { CITY_HALF } from './city.js';

export class PoliceSystem {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.wanted = 0;
    this.heatTimer = 0;
    this.copCars = [];
    this.copPeds = [];
    this.spawnTimer = 0;
    this.arrestProgress = 0;
    this.sirenOn = false;
  }

  get maxStars() { return 5; }

  addWanted(stars, reason) {
    if (this.wanted >= this.maxStars) return;
    this.wanted = Math.min(this.maxStars, this.wanted + stars);
    this.heatTimer = 0;
    return reason;
  }

  clearWanted() {
    this.wanted = 0;
    this.arrestProgress = 0;
    this.removeAllCops();
  }

  removeAllCops() {
    for (const car of this.copCars) this.scene.remove(car.mesh);
    for (const cop of this.copPeds) cop.remove();
    this.copCars = [];
    this.copPeds = [];
  }

  wantedTarget() {
    if (this.wanted === 0) return { cars: 0, peds: 0 };
    if (this.wanted === 1) return { cars: 1, peds: 0 };
    if (this.wanted === 2) return { cars: 2, peds: 1 };
    if (this.wanted === 3) return { cars: 3, peds: 2 };
    if (this.wanted === 4) return { cars: 4, peds: 3 };
    return { cars: 5, peds: 4 };
  }

  spawnCopCarNear(playerX, playerZ) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(45, 70);
    const x = clamp(playerX + Math.cos(angle) * dist, -CITY_HALF, CITY_HALF);
    const z = clamp(playerZ + Math.sin(angle) * dist, -CITY_HALF, CITY_HALF);
    const car = new Car(this.scene, x, z, 0, 0x111114, true);
    car.traffic = false;
    this.copCars.push(car);
    return car;
  }

  spawnCopPedNear(playerX, playerZ) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(18, 30);
    const x = clamp(playerX + Math.cos(angle) * dist, -CITY_HALF, CITY_HALF);
    const z = clamp(playerZ + Math.sin(angle) * dist, -CITY_HALF, CITY_HALF);
    const cop = new Pedestrian(this.scene, x, z, this.rng, true);
    this.copPeds.push(cop);
    return cop;
  }

  update(dt, player, sound) {
    // Heat cools off after a while with no new crime.
    if (this.wanted > 0) {
      this.heatTimer += dt;
      if (this.heatTimer > 28) {
        this.wanted -= 1;
        this.heatTimer = 0;
        if (this.wanted === 0) this.removeAllCops();
      }
    }
    if (this.wanted > 0 && sound) {
      if (!this.sirenOn) {
        sound.sirenOn();
        this.sirenOn = true;
      }
    } else if (this.sirenOn && sound) {
      sound.sirenOff();
      this.sirenOn = false;
    }

    const target = this.wantedTarget();
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      if (this.copCars.length < target.cars) this.spawnCopCarNear(player.x, player.z);
      if (!player.car && this.copPeds.length < target.peds) this.spawnCopPedNear(player.x, player.z);
    }

    // Cruiser chase: steer toward the player and ram.
    for (const car of this.copCars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const want = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, want, Math.min(1, dt * 2.4));
      const speedTarget = dist > 8 ? 24 + this.wanted : 10;
      car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.2);
      car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
      car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.6;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
      car.sirenPhase += dt * 6;
      const bars = car.mesh.children.filter((c) => c.name === 'lightbar');
      bars.forEach((b, i) => {
        b.material.color.setHex(Math.sin(car.sirenPhase + i * Math.PI) > 0 ? 0xff2233 : 0x2244ff);
      });
      if (dist < 4.5) {
        if (player.car) {
          player.car.damage(8 * dt);
          if (player.car.health <= 0 && sound) sound.crash();
        } else {
          player.hurt(14 * dt);
        }
      }
    }

    // Foot officers chase and try to arrest the player on foot.
    let arresting = false;
    for (const cop of this.copPeds) {
      const d = distance2D(cop.x, cop.z, player.x, player.z);
      if (player.car || player.dead) {
        cop.update(dt, this.rng, null, null);
        continue;
      }
      if (d < 2.2) {
        arresting = true;
        this.arrestProgress += dt;
        cop.animate(0, dt);
        if (this.arrestProgress > 2.0) {
          player.busted = true;
        }
      } else {
        cop.update(dt, this.rng, { x: player.x, z: player.z }, null);
      }
    }
    if (!arresting) this.arrestProgress = Math.max(0, this.arrestProgress - dt * 2);

    // Despawn far-away cops when the heat is gone.
    if (this.wanted === 0) {
      this.removeAllCops();
    }
  }

  // A cop car the player shot or rammed: remove it and raise the heat.
  destroyCopCar(car) {
    const idx = this.copCars.indexOf(car);
    if (idx >= 0) this.copCars.splice(idx, 1);
    this.scene.remove(car.mesh);
    this.addWanted(1, 'cop down');
  }
}
