// Neon Bayou — all sound is synthesised with WebAudio. No audio files,
// no network. One job: bleeps, booms and a synthwave loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      engineOsc.connect(filt);
      filt.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch (e) { ctx = null; return false; }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is garnish; never break the game */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      if (lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = lowpass;
        src.connect(f); f.connect(g);
      } else { src.connect(g); }
      g.connect(master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  // A tiny synthwave loop: bassline + hats, 112 BPM, A minor.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const LEAD = [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 196, 220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; },
    setEngine(speed01, driving) {
      if (!ctx || muted || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, ctx.currentTime, 0.08);
    },
    shot() { noise(0.12, 0.5, 1800); tone(180, 0.08, 'square', 0.25, 60); },
    hit() { noise(0.08, 0.3, 900); },
    crash() { noise(0.3, 0.5, 500); tone(70, 0.25, 'sawtooth', 0.3, 35); },
    pickup() { tone(660, 0.1, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 90); },
    mission() { tone(523.25, 0.12, 'triangle', 0.3); setTimeout(() => tone(659.25, 0.12, 'triangle', 0.3), 120); setTimeout(() => tone(783.99, 0.22, 'triangle', 0.3), 240); },
    siren() { tone(750, 0.28, 'sine', 0.08, 950); setTimeout(() => tone(950, 0.28, 'sine', 0.08, 750), 300); },
    busted() { tone(392, 0.2, 'sawtooth', 0.25, 196); setTimeout(() => tone(311, 0.35, 'sawtooth', 0.25, 155), 200); },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const i = musicStep % 16;
        const b = BASS[i];
        if (b) tone(b, 0.22, 'sawtooth', 0.12);
        if (musicStep % 4 === 0) tone(LEAD[i], 0.3, 'triangle', 0.07);
        if (musicStep % 2 === 1) noise(0.03, 0.05, 6000);
        musicStep++;
      }, 134);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
}
