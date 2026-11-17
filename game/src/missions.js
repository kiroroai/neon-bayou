// Neon Bayou — the story: six linked jobs for Rook, from first light to
// the big score. One job: objectives, progress and payouts.
import { MISSION_CASH } from './config.js';
import { addCash } from './player.js';
import { addText } from './effects.js';
import { spawnEnemies } from './combat.js';

// Objective types: goto (walk/drive there), collect (grab N packages),
// escape (stay alive with the wanted level for T seconds), combat (drop N).
export const MISSIONS = [
  {
    id: 'first-light', name: 'First Light', giver: 'Delia',
    brief: 'Delia needs a driver she can trust. Meet her at the garage on Cypress Row.',
    steps: [
      { type: 'goto', x: 800, y: 800, label: 'Meet Delia at the garage' },
      { type: 'goto', x: 2080, y: 480, label: 'Drive Delia to Neon Row' },
    ],
  },
  {
    id: 'the-getaway', name: 'The Getaway', giver: 'Delia',
    brief: 'A Comet is parked on Neon Row with the keys in it. Take it — and take it fast.',
    steps: [
      { type: 'goto', x: 2400, y: 800, label: 'Steal the Comet on Neon Row' },
      { type: 'drive', x: 480, y: 1760, label: 'Deliver the Comet to the Causeway lockup' },
    ],
  },
  {
    id: 'swamp-run', name: 'Swamp Run', giver: 'Big Marv',
    brief: 'Three packages stashed along the bayou. Collect them all, no questions asked.',
    steps: [
      { type: 'collect', n: 3, label: 'Collect the bayou packages (0/3)' },
    ],
  },
  {
    id: 'heat-wave', name: 'Heat Wave', giver: 'Delia',
    brief: 'The CBPD is on your tail after that last job. Lose them — stay out of sight.',
    steps: [
      { type: 'escape', seconds: 20, label: 'Lose the cops — stay clean for 20s' },
    ],
  },
  {
    id: 'gator-bite', name: 'Gator Bite', giver: 'Big Marv',
    brief: 'The Gator Kings are muscling in on Marv’s turf at the Docks. Send a message.',
    steps: [
      { type: 'combat', n: 4, label: 'Take down the Gator Kings (0/4)' },
    ],
  },
  {
    id: 'the-big-score', name: 'The Big Score', giver: 'Delia',
    brief: 'One last job: the cash vault under the Docks. Grab it and vanish into the lagoon mist.',
    steps: [
      { type: 'goto', x: 2720, y: 1760, label: 'Reach the vault under the Docks' },
      { type: 'collect', n: 1, label: 'Grab the vault cash' },
      { type: 'escape', seconds: 25, label: 'Escape to the bayou — stay clean for 25s' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    step: 0,
    progress: 0,       // collected count / combat count / escape seconds banked
    packages: [],      // collectable package positions for the active step
    enemiesSpawned: false,
    done: false,
    banner: null,      // {text, t} shown when a mission starts/completes
    escapeTimer: 0,
  };
}

function currentDef(M) { return MISSIONS[M.index] || null; }
function currentStep(M) {
  const def = currentDef(M);
  return def ? def.steps[M.step] : null;
}

export function currentObjective(G) {
  const M = G.missions;
  if (M.done) return { text: 'Free roam — Cypress Bay is yours.', x: null, y: null };
  const def = currentDef(M);
  if (!def) return { text: 'Free roam — Cypress Bay is yours.', x: null, y: null };
  const step = currentStep(M);
  if (!step) return { text: def.name, x: null, y: null };
  if (step.type === 'goto' || step.type === 'drive') {
    return { text: step.label, x: step.x, y: step.y };
  }
  if (step.type === 'collect') {
    const pkg = M.packages[0];
    const n = M.progress;
    return { text: step.label.replace(/\(\d+\/\d+\)/, `(${n}/${step.n})`), x: pkg ? pkg.x : null, y: pkg ? pkg.y : null };
  }
  if (step.type === 'combat') {
    return { text: step.label.replace(/\(\d+\/\d+\)/, `(${M.progress}/${step.n})`), x: null, y: null };
  }
  if (step.type === 'escape') {
    const left = Math.max(0, Math.ceil(step.seconds - M.escapeTimer));
    return { text: `Lose the cops — stay clean for ${left}s`, x: null, y: null };
  }
  return { text: step.label, x: null, y: null };
}

function startStep(G) {
  const M = G.missions;
  const step = currentStep(M);
  if (!step) return;
  M.progress = 0;
  M.escapeTimer = 0;
  M.packages = [];
  M.enemiesSpawned = false;
  if (step.type === 'collect') {
    const spots = step.n === 1
      ? [{ x: 2720, y: 1760 }]
      : [{ x: 420, y: 480 }, { x: 420, y: 1440 }, { x: 420, y: 2080 }];
    for (const s of spots) M.packages.push({ x: s.x, y: s.y, taken: false });
  }
  if (step.type === 'combat') {
    spawnEnemies(G, step.n);
    M.enemiesSpawned = true;
  }
  if (step.type === 'escape') {
    G.police.addWanted(3, 'mission heat');
    M.escapeTimer = 0;
  }
}

export function startMission(G, index) {
  const M = G.missions;
  M.index = index;
  M.step = 0;
  M.done = false;
  const def = currentDef(M);
  if (def) {
    M.banner = { text: `${def.name} — ${def.giver}: ${def.brief}`, t: 5 };
    G.audio.mission();
  }
  startStep(G);
}

function completeStep(G) {
  const M = G.missions;
  const def = currentDef(M);
  M.step++;
  if (M.step >= def.steps.length) {
    // Mission complete: pay out and advance the story.
    const cash = MISSION_CASH[M.index] || 250;
    addCash(G, cash);
    addText(G.fx, G.player.x, G.player.y - 30, `+$${cash}`, '#a3e635');
    G.stats.missionsDone++;
    G.audio.mission();
    M.banner = { text: `${def.name} complete — $${cash} earned`, t: 4 };
    if (M.index + 1 < MISSIONS.length) startMission(G, M.index + 1);
    else {
      M.done = true;
      M.banner = { text: 'STORY COMPLETE — Cypress Bay is yours, Rook.', t: 6 };
    }
    // Save AFTER advancing, so Continue resumes the next mission, not the one just finished.
    G.saveProgress();
  } else {
    startStep(G);
  }
}

export function updateMissions(G, dt) {
  const M = G.missions;
  if (M.done) return;
  const def = currentDef(M);
  if (!def) return;
  const step = currentStep(M);
  if (!step) return;
  const p = G.player;

  if (step.type === 'goto' || step.type === 'drive') {
    const d = Math.hypot(step.x - p.x, step.y - p.y);
    if (d < 55) completeStep(G);
  } else if (step.type === 'collect') {
    for (const pkg of M.packages) {
      if (!pkg.taken && Math.hypot(pkg.x - p.x, pkg.y - p.y) < 42) {
        pkg.taken = true;
        M.progress++;
        G.audio.pickup();
        addText(G.fx, pkg.x, pkg.y - 20, 'Package secured', '#fbbf24');
      }
    }
    M.packages = M.packages.filter(pkg => !pkg.taken);
    if (M.progress >= step.n) completeStep(G);
  } else if (step.type === 'combat') {
    if (M.progress >= step.n) completeStep(G);
  } else if (step.type === 'escape') {
    if (G.police.wanted === 0) {
      M.escapeTimer += dt;
      if (M.escapeTimer >= step.seconds) completeStep(G);
    } else {
      M.escapeTimer = Math.max(0, M.escapeTimer - dt * 0.5);
    }
  }
}
