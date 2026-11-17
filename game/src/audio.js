// Neon Bayou — procedural sound. No audio files: every sound is built
// from WebAudio oscillators and filtered noise, so the game stays offline.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.ambientStarted = false;
  }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
      this.startAmbient();
    } catch (err) {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  now() {
    return this.context ? this.context.currentTime : 0;
  }

  startAmbient() {
    if (!this.context || this.ambientStarted) return;
    this.ambientStarted = true;
    try {
      const notes = [55, 65.41, 82.41, 98];
      for (const freq of notes) {
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = this.context.createGain();
        gain.gain.value = 0.018;
        const lfo = this.context.createOscillator();
        lfo.frequency.value = 0.07 + freq * 0.0004;
        const lfoGain = this.context.createGain();
        lfoGain.gain.value = 0.008;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        lfo.start();
      }
    } catch (err) {
      /* ambient is decoration; silence is fine */
    }
  }

  engineOn() {
    if (!this.context || this.engineOsc) return;
    try {
      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (err) {
      this.engineOsc = null;
    }
  }

  engineOff() {
    if (this.engineOsc) {
      try {
        this.engineGain.gain.setTargetAtTime(0, this.now(), 0.1);
        const osc = this.engineOsc;
        setTimeout(() => {
          try {
            osc.stop();
          } catch (err) {}
        }, 400);
      } catch (err) {}
      this.engineOsc = null;
    }
  }

  setEngineSpeed(speed01, revving) {
    if (!this.engineOsc || !this.context) return;
    const t = this.now();
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130 + (revving ? 25 : 0), t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.045 + speed01 * 0.05, t, 0.1);
  }

  sirenOn() {
    if (!this.context || this.sirenOsc) return;
    try {
      this.sirenOsc = this.context.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.context.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenGain.gain.setTargetAtTime(0.035, this.now(), 0.2);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let high = true;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        high = !high;
        this.sirenOsc.frequency.setTargetAtTime(high ? 950 : 650, this.now(), 0.05);
      }, 420);
    } catch (err) {
      this.sirenOsc = null;
    }
  }

  sirenOff() {
    if (this.sirenTimer) clearInterval(this.sirenTimer);
    this.sirenTimer = null;
    if (this.sirenOsc) {
      try {
        this.sirenGain.gain.setTargetAtTime(0, this.now(), 0.1);
        const osc = this.sirenOsc;
        setTimeout(() => {
          try {
            osc.stop();
          } catch (err) {}
        }, 300);
      } catch (err) {}
      this.sirenOsc = null;
    }
  }

  noiseBurst(duration, volume, filterFreq) {
    if (!this.context) return;
    try {
      const len = Math.max(1, Math.floor(this.context.sampleRate * duration));
      const buffer = this.context.createBuffer(1, len, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.context.createBufferSource();
      src.buffer = buffer;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.context.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
    } catch (err) {}
  }

  tone(freq, duration, type, volume, slideTo) {
    if (!this.context) return;
    try {
      const osc = this.context.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, this.now());
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.now() + duration);
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(volume, this.now());
      gain.gain.exponentialRampToValueAtTime(0.001, this.now() + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.now() + duration + 0.02);
    } catch (err) {}
  }

  gunshot() {
    this.noiseBurst(0.16, 0.5, 2400);
    this.tone(140, 0.12, 'square', 0.25, 60);
  }

  punch() {
    this.noiseBurst(0.09, 0.35, 500);
  }

  crash() {
    this.noiseBurst(0.35, 0.5, 900);
    this.tone(90, 0.25, 'sawtooth', 0.2, 40);
  }

  pickup() {
    this.tone(660, 0.12, 'sine', 0.25);
    setTimeout(() => this.tone(990, 0.18, 'sine', 0.25), 90);
  }

  missionDone() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.28), i * 110));
  }

  wantedUp() {
    this.tone(220, 0.3, 'sawtooth', 0.2, 110);
  }

  click() {
    this.tone(880, 0.06, 'sine', 0.18);
  }
}
