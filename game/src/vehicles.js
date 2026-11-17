// Neon Bayou — cars: the low-poly vehicles you can steal and drive,
// plus the traffic system that keeps the avenues moving.

import * as THREE from 'three';
import { makeRng, clamp, angleLerp, distance2D } from './rng.js';
import { STREET_STEP, CITY_HALF } from './city.js';

const CAR_COLORS = [0xd83a3a, 0x3a7bd8, 0x3ad8a0, 0xd8c53a, 0xe8e8e8, 0x222226, 0xb967ff, 0xff8c42, 0x4fd8d8];

export function buildCarMesh(color, isCop) {
  const group = new THREE.Group();
  const paint = isCop ? 0x111114 : color;
  const bodyMat = new THREE.MeshLambertMaterial({ color: paint });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.58, 2.2),
    new THREE.MeshLambertMaterial({ color: isCop ? 0xe8e8e8 : 0x1a2028 }),
  );
  cabin.position.set(0, 1.2, -0.2);
  group.add(cabin);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.4, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }),
  );
  glass.position.set(0, 1.15, 1.0);
  group.add(glass);
  if (isCop) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    stripe.position.y = 0.72;
    group.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar.position.set(0, 1.56, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(0, 1.56, 0.25);
    bar2.name = 'lightbar';
    group.add(bar2);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0c });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  group.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    group.userData.wheels.push(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    lamp.position.set(hx, 0.62, 2.22);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const hx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    lamp.position.set(hx, 0.62, -2.22);
    group.add(lamp);
  }
  return group;
}

export class Car {
  constructor(scene, x, z, heading, color, isCop) {
    this.scene = scene;
    this.isCop = !!isCop;
    this.color = color;
    this.mesh = buildCarMesh(color, this.isCop);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.traffic = false;
    this.parked = false;
    this.route = null;
    this.routeIndex = 0;
    this.driver = null;
    this.sirenPhase = 0;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  drive(input, dt) {
    const maxSpeed = this.isCop ? 26 : 24;
    const accel = input.forward ? 16 : input.backward ? -12 : 0;
    this.speed += accel * dt;
    if (!input.forward && !input.backward) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 10 * dt);
    }
    if (input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 26 * dt);
    this.speed = clamp(this.speed, -9, maxSpeed);
    const steerTarget = input.left ? 0.55 : input.right ? -0.55 : 0;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const turnRate = this.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9;
    this.heading += turnRate * Math.sign(this.speed) * dt;
    this.mesh.position.x += Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    this.mesh.position.x = clamp(this.mesh.position.x, -CITY_HALF - 6, CITY_HALF + 6);
    this.mesh.position.z = clamp(this.mesh.position.z, -CITY_HALF - 6, CITY_HALF + 12);
    const spin = this.speed * dt * 2.6;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    const front = this.mesh.userData.wheels[0];
    if (front) front.rotation.y = this.steer * 0.4;
    const front2 = this.mesh.userData.wheels[1];
    if (front2) front2.rotation.y = this.steer * 0.4;
    return Math.abs(this.speed) > 0.5;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      return true;
    }
    return false;
  }
}

export class TrafficSystem {
  constructor(scene, seed, city) {
    this.scene = scene;
    this.rng = makeRng(seed + 77);
    this.cars = [];
    this.city = city;
    this.spawnParkedCars();
    this.spawnTrafficCars(14);
  }

  randomBlockLoop() {
    const bx = this.rng.int(-4, 3) * STREET_STEP + 20;
    const bz = this.rng.int(-4, 3) * STREET_STEP + 20;
    const half = 20;
    const lane = 2.6;
    return [
      { x: bx - half + lane, z: bz - half + lane },
      { x: bx + half - lane, z: bz - half + lane },
      { x: bx + half - lane, z: bz + half - lane },
      { x: bx - half + lane, z: bz + half - lane },
    ];
  }

  spawnTrafficCars(count) {
    for (let i = 0; i < count; i++) {
      const route = this.randomBlockLoop();
      const start = route[this.rng.int(0, 3)];
      const car = new Car(this.scene, start.x, start.z, 0, this.rng.pick(CAR_COLORS), false);
      car.traffic = true;
      car.route = route;
      car.routeIndex = this.rng.int(0, 3);
      car.speed = this.rng.range(5, 8);
      this.cars.push(car);
    }
  }

  spawnParkedCars() {
    const spots = [
      [30, 8, 0], [-30, -8, Math.PI], [70, 48, Math.PI / 2], [-70, 88, -Math.PI / 2],
      [110, 8, 0], [-110, -48, Math.PI], [20, -72, Math.PI], [-20, 128, 0],
      [150, 48, -Math.PI / 2], [-150, 8, Math.PI / 2], [90, -120, 0], [-90, -160, Math.PI],
    ];
    for (const [x, z, h] of spots) {
      const car = new Car(this.scene, x, z, h, this.rng.pick(CAR_COLORS), false);
      car.parked = true;
      this.cars.push(car);
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.driver) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  update(dt, playerCar, cops) {
    for (const car of this.cars) {
      if (car === playerCar || car.driver) continue;
      if (!car.traffic || !car.route) continue;
      const target = car.route[car.routeIndex % car.route.length];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 3) {
        car.routeIndex++;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 2.2));
      let blocked = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const ahead = distance2D(car.x + Math.sin(car.heading) * 6, car.z + Math.cos(car.heading) * 6, other.x, other.z);
        if (ahead < 3.5) { blocked = true; break; }
      }
      if (!blocked && cops) {
        for (const cop of cops) {
          const ahead = distance2D(car.x + Math.sin(car.heading) * 6, car.z + Math.cos(car.heading) * 6, cop.x, cop.z);
          if (ahead < 3.5) { blocked = true; break; }
        }
      }
      const targetSpeed = blocked ? 0 : 7;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
      car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.6;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
}
