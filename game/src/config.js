// Neon Bayou — tuning, districts and palette. One job: every number the
// game balances on lives here, so the other modules never hard-code one.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 64;
export const BLOCK = 320;
export const AVENUE0 = 160;
export const STREET0 = 160;

// The bayou channel on the west edge and the lagoon along the south edge.
export const BAYOU_X1 = 0;
export const BAYOU_X2 = 300;
export const LAGOON_Y1 = 2160;
export const LAGOON_Y2 = 2400;

// Bridges carry the streets across the bayou channel.
export const BRIDGE_YS = [160, 800, 1440, 2080];

export const DISTRICTS = [
  { name: 'Neon Row',        x1: 1600, y1: 160,  x2: 3040, y2: 1120, neon: '#ff2e88', tint: '#1c1030' },
  { name: 'Cypress Heights', x1: 320,  y1: 160,  x2: 1600, y2: 800,  neon: '#22d3ee', tint: '#0e1a24' },
  { name: 'The Causeway',    x1: 320,  y1: 800,  x2: 1600, y2: 1440, neon: '#f59e0b', tint: '#241a0e' },
  { name: 'Gator Flats',     x1: 320,  y1: 1440, x2: 1600, y2: 2160, neon: '#a3e635', tint: '#14210e' },
  { name: 'The Docks',       x1: 1600, y1: 1440, x2: 3040, y2: 2160, neon: '#c084fc', tint: '#1a1030' },
  { name: 'Magnolia Park',   x1: 1600, y1: 1120, x2: 3040, y2: 1440, neon: '#fbbf24', tint: '#10231a' },
];

export const PALETTE = {
  ground: '#14101d',
  road: '#232030',
  roadEdge: '#3a3550',
  lane: '#8a86a3',
  sidewalk: '#2e2a3d',
  water: '#0b3542',
  waterDeep: '#07222e',
  buildingTop: '#2a2440',
  buildingEdge: '#4a3f6e',
  grass: '#14301c',
  sand: '#3d3222',
};

export const CAR_DEFS = {
  comet:   { name: 'Comet',        accel: 420, top: 340, grip: 3.4, len: 46, wid: 22, color: '#ff2e88' },
  sunset:  { name: 'Sunset GT',    accel: 380, top: 310, grip: 3.0, len: 48, wid: 23, color: '#f59e0b' },
  hauler:  { name: 'Bayou Hauler', accel: 260, top: 230, grip: 2.6, len: 56, wid: 26, color: '#84cc16' },
  gator:   { name: 'Gator',        accel: 320, top: 280, grip: 2.9, len: 50, wid: 25, color: '#22d3ee' },
  cruiser: { name: 'CBPD Cruiser', accel: 400, top: 330, grip: 3.5, len: 48, wid: 23, color: '#e5e7eb' },
};

export const TUNING = {
  walkSpeed: 165,
  sprintMul: 1.55,
  playerRadius: 11,
  playerHp: 100,
  bulletSpeed: 620,
  bulletDamage: 34,
  enemyHp: 70,
  enemySpeed: 120,
  wantedDecay: 9,       // seconds of no crime before one star fades
  bustedRadius: 26,
  copRamDamage: 8,
  carEnterRadius: 46,
  maxCruisers: 5,
  trafficCars: 14,
  pedestrians: 26,
};

export const MISSION_CASH = [250, 400, 600, 750, 900, 1500];
