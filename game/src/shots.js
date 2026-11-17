// Neon Bayou — deterministic screenshot staging.
// ?shot=<name>&seed=1 puts the game in a fixed, readable scene so the
// screenshots are real renders of the same code the player plays.

export const SHOT_NAMES = ['chase', 'city', 'mission', 'night'];

export function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '1', 10);
  if (!shot || !SHOT_NAMES.includes(shot)) return null;
  return { shot, seed: Number.isFinite(seed) ? seed : 1 };
}

export function stageShot(game, shot) {
  const { player, police, missions, traffic, city } = game;
  // Keep traffic out of the staged frame: a car mid-turn crossing the
  // hero car reads as a broken car. They drive back on their own loops.
  const clearNearbyTraffic = (px, pz, radius) => {
    let k = 0;
    for (const car of traffic.cars) {
      if (car.driver) continue;
      const dx = car.x - px;
      const dz = car.z - pz;
      if (dx * dx + dz * dz < radius * radius) {
        car.mesh.position.set(170, 0, -170 + k * 14);
        car.heading = 0;
        k++;
      }
    }
  };
  if (shot === 'chase') {
    // Cover: Rook fleeing in a stolen car, three cruisers behind, 3 stars.
    const car = traffic.cars.find((c) => c.parked) || traffic.cars[0];
    car.parked = false;
    car.traffic = false;
    player.enterCar(car);
    car.mesh.position.set(-20, 0, 40);
    car.heading = Math.PI / 2;
    car.speed = 16;
    player.heading = car.heading;
    police.wanted = 3;
    police.heatTimer = 0;
    for (let i = 0; i < 3; i++) {
      const cop = police.spawnCopCarNear(car.x, car.z);
      cop.mesh.position.set(-20 - (i + 1) * 12, 0, 40 - 4 + i * 4);
      cop.heading = Math.PI / 2;
      cop.speed = 18;
    }
    missions.index = 2;
    missions.step = 0;
    missions.refreshMarker();
    game.cameraYaw = Math.PI / 2 + Math.PI;
    game.timeOfDay = 17.5;
    clearNearbyTraffic(-20, 40, 45);
  } else if (shot === 'city') {
    // On foot downtown at midday, traffic and pedestrians around.
    player.mesh.position.set(0, 0, 0);
    player.heading = Math.PI * 0.75;
    missions.index = 0;
    missions.step = 0;
    missions.refreshMarker();
    game.cameraYaw = Math.PI * 0.75 + Math.PI;
    game.timeOfDay = 12.0;
    clearNearbyTraffic(0, 0, 30);
  } else if (shot === 'mission') {
    // Mission 1 in progress: Rook parked on the avenue to the Pier,
    // the mission beam glowing ahead. Static, so the shot is clean.
    const car = traffic.cars.find((c) => c.parked) || traffic.cars[0];
    car.parked = false;
    car.traffic = false;
    player.enterCar(car);
    car.mesh.position.set(0, 0, -80);
    car.heading = Math.PI;
    car.mesh.rotation.y = Math.PI;
    car.speed = 0;
    missions.index = 0;
    missions.step = 1;
    missions.refreshMarker();
    game.cameraYaw = Math.PI;
    game.timeOfDay = 15.5;
    clearNearbyTraffic(0, -80, 45);
  } else if (shot === 'night') {
    // Night in the neon quarter, on foot by the bayou-side streets.
    player.mesh.position.set(-40, 0, 120);
    player.heading = Math.PI * 0.9;
    missions.index = 1;
    missions.step = 0;
    missions.refreshMarker();
    game.cameraYaw = Math.PI * 0.9 + Math.PI;
    game.timeOfDay = 22.0;
    clearNearbyTraffic(-40, 120, 35);
  }
  game.shotMode = true;
}
