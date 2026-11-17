// Neon Bayou — story missions. Three jobs for Rook in Cypress Bay,
// each with an objective, a glowing marker, and a cash reward.

import * as THREE from 'three';
import { distance2D } from './rng.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Gear',
    giver: 'Delacroix',
    briefing: 'Delacroix needs a driver. Steal any car and bring it to the Pier — fast, before the sun sets.',
    steps: [
      { text: 'Get a car — press E near any parked car', need: 'car', at: null },
      { text: 'Drive to the Pier marker', need: 'reach', at: 'pier', radius: 10 },
    ],
    reward: 500,
  },
  {
    id: 2,
    title: 'Bayou Package',
    giver: 'Delacroix',
    briefing: 'A package is waiting on the Bayou dock. Pick it up on foot and bring it back to the Garage.',
    steps: [
      { text: 'Go to the Bayou dock and pick up the package', need: 'reach', at: 'dock', radius: 8 },
      { text: 'Deliver the package to the Garage', need: 'reach', at: 'garage', radius: 9 },
    ],
    reward: 800,
  },
  {
    id: 3,
    title: 'Heat Wave',
    giver: 'Mama Odette',
    briefing: 'The cops saw too much. Lose the heat, then slip back to the Safehouse. Do not get caught.',
    steps: [
      { text: 'Lose the wanted level — lay low until the stars clear', need: 'nowanted', at: null },
      { text: 'Reach the Safehouse', need: 'reach', at: 'safehouse', radius: 9 },
    ],
    reward: 1500,
  },
];

export class MissionManager {
  constructor(scene, landmarks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.index = 0;
    this.step = 0;
    this.done = false;
    this.storyComplete = false;
    this.marker = this.buildMarker();
    this.marker.visible = false;
    scene.add(this.marker);
    this.packageMesh = this.buildPackage();
    this.packageMesh.visible = false;
    scene.add(this.packageMesh);
    this.onMissionEvent = null;
  }

  buildMarker() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    group.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    diamond.position.y = 8;
    diamond.name = 'diamond';
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3, 4.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    return group;
  }

  buildPackage() {
    const group = new THREE.Group();
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2a }),
    );
    boxMesh.position.y = 0.6;
    group.add(boxMesh);
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(1.14, 0.82, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xd8c53a }),
    );
    tape.position.y = 0.6;
    group.add(tape);
    return group;
  }

  current() {
    return this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return 'Free roam — Cypress Bay is yours. Earn cash, dodge the law.';
    const step = m.steps[this.step];
    return `Mission ${m.id} — ${m.title}: ${step.text}`;
  }

  emit(type, payload) {
    if (this.onMissionEvent) this.onMissionEvent(type, payload);
  }

  startMission(index) {
    this.index = index;
    this.step = 0;
    this.done = false;
    const m = this.current();
    if (m) this.emit('briefing', m);
    this.refreshMarker();
  }

  refreshMarker() {
    const step = this.currentStep();
    if (!step || !step.at) {
      this.marker.visible = false;
      return;
    }
    const spot = this.landmarks[step.at];
    if (!spot) {
      this.marker.visible = false;
      return;
    }
    this.marker.position.set(spot.x, 0, spot.z);
    this.marker.visible = true;
    // The package sits on the dock for mission 2's first step.
    const showPackage = this.current() && this.current().id === 2 && this.step === 0;
    this.packageMesh.visible = !!showPackage;
    if (showPackage) this.packageMesh.position.set(spot.x + 2, 0, spot.z);
  }

  update(dt, player, police) {
    const m = this.current();
    if (!m) return;
    const diamond = this.marker.getObjectByName('diamond');
    if (diamond) {
      diamond.rotation.y += dt * 1.5;
      diamond.position.y = 8 + Math.sin(Date.now() * 0.002) * 0.6;
    }
    if (this.packageMesh.visible) this.packageMesh.rotation.y += dt * 0.8;
    const step = m.steps[this.step];
    if (!step) return;

    if (step.need === 'car') {
      if (player.car) this.advance(player);
      return;
    }
    if (step.need === 'nowanted') {
      if (police.wanted === 0) this.advance(player);
      return;
    }
    if (step.need === 'reach' && step.at) {
      const spot = this.landmarks[step.at];
      if (distance2D(player.x, player.z, spot.x, spot.z) < step.radius) {
        if (m.id === 2 && this.step === 0) this.emit('pickup', m);
        this.advance(player);
      }
    }
  }

  advance(player) {
    const m = this.current();
    this.step += 1;
    if (this.step >= m.steps.length) {
      player.money += m.reward;
      this.emit('complete', m);
      this.index += 1;
      this.step = 0;
      if (this.index >= MISSIONS.length) {
        this.storyComplete = true;
        this.marker.visible = false;
        this.packageMesh.visible = false;
        this.emit('story', null);
      } else {
        const next = this.current();
        this.emit('briefing', next);
        this.refreshMarker();
      }
      return;
    }
    this.emit('step', m);
    this.refreshMarker();
  }

  // Mission 3 opens with the heat already on.
  armHeatWave(police) {
    if (this.current() && this.current().id === 3 && this.step === 0) {
      police.wanted = 3;
      police.heatTimer = 0;
    }
  }

  saveState() {
    return { index: this.index, step: this.step, storyComplete: this.storyComplete };
  }

  loadState(saved) {
    if (!saved) return;
    this.index = saved.index || 0;
    this.step = saved.step || 0;
    this.storyComplete = !!saved.storyComplete;
    this.refreshMarker();
  }
}
