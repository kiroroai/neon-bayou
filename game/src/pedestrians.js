// Neon Bayou — pedestrians: the people of Cypress Bay.
// They stroll the sidewalks, wait at corners, and run when shots ring out.

import * as THREE from 'three';
import { makeRng, clamp, distance2D } from './rng.js';
import { STREET_STEP, CITY_HALF } from './city.js';

const SHIRT_COLORS = [0xe86a6a, 0x6aa8e8, 0x7ad87a, 0xe8d26a, 0xc96ae8, 0xe8e8e8, 0x6ad8d0, 0xe89a5a];
const PANTS_COLORS = [0x2a2f45, 0x3a2f2a, 0x2a3a2f, 0x4a4a4a, 0x332a45];

export function buildPersonMesh(shirt, pants, isCop) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x1c2a4a : shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: isCop ? 0x141c30 : pants });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirtMat);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.78;
  group.add(head);
  if (isCop) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x0c1424 }));
    cap.position.y = 1.98;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a1a12 }));
    hair.position.y = 1.8;
    group.add(hair);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pantsMat);
  legL.position.set(-0.16, 0.35, 0);
  legL.name = 'legL';
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pantsMat);
  legR.position.set(0.16, 0.35, 0);
  legR.name = 'legR';
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), shirtMat);
  armL.position.set(-0.42, 1.15, 0);
  armL.name = 'armL';
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), shirtMat);
  armR.position.set(0.42, 1.15, 0);
  armR.name = 'armR';
  group.add(armR);
  return group;
}

export class Pedestrian {
  constructor(scene, x, z, rng, isCop) {
    this.scene = scene;
    this.isCop = !!isCop;
    this.mesh = buildPersonMesh(rng.pick(SHIRT_COLORS), rng.pick(PANTS_COLORS), this.isCop);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = this.isCop ? 4.5 : rng.range(1.2, 2.2);
    this.walkPhase = rng.range(0, Math.PI * 2);
    this.target = null;
    this.idleTimer = 0;
    this.fleeFrom = null;
    this.health = 100;
    this.alive = true;
    this.arrestTimer = 0;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  pickSidewalkTarget(rng) {
    const street = rng.int(-5, 5) * STREET_STEP;
    const along = rng.range(-CITY_HALF, CITY_HALF);
    const side = rng.pick([-9, 9]);
    if (rng.chance(0.5)) return { x: along, z: street + side };
    return { x: street + side, z: along };
  }

  update(dt, rng, playerPos, gunshotPos) {
    if (!this.alive) return;
    if (gunshotPos && !this.isCop && distance2D(this.x, this.z, gunshotPos.x, gunshotPos.z) < 40) {
      this.fleeFrom = gunshotPos;
    }
    let speed = this.speed;
    let target = this.target;
    if (this.fleeFrom) {
      const dx = this.x - this.fleeFrom.x;
      const dz = this.z - this.fleeFrom.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      target = { x: this.x + (dx / d) * 30, z: this.z + (dz / d) * 30 };
      speed = 5.5;
      if (distance2D(this.x, this.z, this.fleeFrom.x, this.fleeFrom.z) > 45) this.fleeFrom = null;
    } else if (this.isCop && playerPos) {
      target = { x: playerPos.x, z: playerPos.z };
      speed = this.speed;
    }
    if (!target) {
      if (this.idleTimer > 0) {
        this.idleTimer -= dt;
        this.animate(0, dt);
        return;
      }
      this.target = this.pickSidewalkTarget(rng);
      target = this.target;
    }
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.5) {
      this.target = null;
      this.idleTimer = rng.range(0, 4);
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
    this.mesh.position.x += Math.sin(this.heading) * speed * dt;
    this.mesh.position.z += Math.cos(this.heading) * speed * dt;
    this.mesh.position.x = clamp(this.mesh.position.x, -CITY_HALF - 4, CITY_HALF + 10);
    this.mesh.position.z = clamp(this.mesh.position.z, -CITY_HALF - 4, CITY_HALF + 10);
    this.mesh.rotation.y = this.heading;
    this.animate(speed, dt);
  }

  animate(speed, dt) {
    this.walkPhase += dt * (2 + speed * 2.2);
    const swing = Math.sin(this.walkPhase) * clamp(speed / 5, 0.1, 1) * 0.55;
    const legL = this.mesh.getObjectByName('legL');
    const legR = this.mesh.getObjectByName('legR');
    const armL = this.mesh.getObjectByName('armL');
    const armR = this.mesh.getObjectByName('armR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.7;
    if (armR) armR.rotation.x = swing * 0.7;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.3;
      return true;
    }
    return false;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

export class PedestrianSystem {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed + 31);
    this.peds = [];
    for (let i = 0; i < 26; i++) {
      const street = this.rng.int(-5, 5) * STREET_STEP;
      const along = this.rng.range(-CITY_HALF + 10, CITY_HALF - 10);
      const side = this.rng.pick([-9, 9]);
      const x = this.rng.chance(0.5) ? along : street + side;
      const z = this.rng.chance(0.5) ? street + side : along;
      this.peds.push(new Pedestrian(scene, x, z, this.rng, false));
    }
  }

  update(dt, playerPos, gunshotPos) {
    for (const ped of this.peds) ped.update(dt, this.rng, null, gunshotPos);
  }

  nearest(x, z, maxDist, aliveOnly) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (aliveOnly && !ped.alive) continue;
      const d = distance2D(x, z, ped.x, ped.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }
}
