/**
 * Lo-Fi Ambient Soundscapes & Phase Cue Engine (Pure Web Audio API)
 * Each nature scene uses distinct acoustic synthesis so they sound clearly different
 * while preserving a warm, cozy lo-fi tape character.
 */

export const LOFI_SOUNDSCAPES = [
  {
    id: 'ocean',
    label: 'Szum morza',
    icon: '🌊',
    description: 'Rytmiczne fale oceanu przypływające i odpływające po piasku',
  },
  {
    id: 'forest',
    label: 'Deszczowy las',
    icon: '🌲',
    description: 'Krople wody na liściach, strumyk i dalekie ptaki w lesie',
  },
  {
    id: 'fireplace',
    label: 'Nocny kominek',
    icon: '🔥',
    description: 'Wyraźne trzaski palącego się drewna i ciepły żar',
  },
  {
    id: 'wind',
    label: 'Wiatr wśród sosen',
    icon: '🍃',
    description: 'Śpiewny, kojący powiew wiatru w koronach sosen',
  },
  {
    id: 'rain_window',
    label: 'Deszcz i Lo-Fi Pad',
    icon: '🌧️',
    description: 'Deszcz na szybie z miękkim, ciągłym ciepłem lo-fi',
  },
];

export const pickRandomSoundscape = (excludeId = null) => {
  const candidates = excludeId
    ? LOFI_SOUNDSCAPES.filter((s) => s.id !== excludeId)
    : LOFI_SOUNDSCAPES;
  return candidates[Math.floor(Math.random() * candidates.length)] || LOFI_SOUNDSCAPES[0];
};

// Create reusable seamless noise buffers + impulse crackle buffer
const createNoiseBuffers = (ctx) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 4;

  // White noise buffer (for crisp fire pops / surf foam)
  const whiteBuffer = ctx.createBuffer(1, length, sampleRate);
  const whiteData = whiteBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    whiteData[i] = Math.random() * 2 - 1;
  }

  // Pink noise buffer (Paul Kellet filter)
  const pinkBuffer = ctx.createBuffer(1, length, sampleRate);
  const pinkData = pinkBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = whiteData[i];
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  // Brown noise buffer (deep warm rumble)
  const brownBuffer = ctx.createBuffer(1, length, sampleRate);
  const brownData = brownBuffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < length; i++) {
    const white = whiteData[i];
    brownData[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = brownData[i];
    brownData[i] *= 2.6;
  }

  // Crossfade edges for clickless looping
  const fadeSamples = Math.floor(sampleRate * 0.12);
  for (const data of [pinkData, brownData]) {
    for (let i = 0; i < fadeSamples; i++) {
      const ratio = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      const blended = data[i] * ratio + data[tailIdx] * (1 - ratio);
      data[i] = blended;
      data[tailIdx] = blended;
    }
  }

  return { whiteBuffer, pinkBuffer, brownBuffer };
};

export class LoFiBreathingEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientBus = null;
    this.phaseCueGain = null;
    this.buffers = null;
    this.activeSceneCleanup = null;
    this.activeCueCleanups = [];
    this.activeCueTimeouts = [];
    this.previewTimeout = null;
    this.stopSceneTimeout = null;
    this.isMuted = false;
    this.volume = 0.7;
    this.cueVolume = 0.45;
    this.currentSceneId = null;
    this.isRunning = false;
  }

  _ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
      this.buffers = createNoiseBuffers(this.ctx);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Warm tape roll-off exclusively for background ambient soundscapes
      const masterLowpass = this.ctx.createBiquadFilter();
      masterLowpass.type = 'lowpass';
      masterLowpass.frequency.value = 2600;
      masterLowpass.Q.value = 0.6;

      const warmShelf = this.ctx.createBiquadFilter();
      warmShelf.type = 'lowshelf';
      warmShelf.frequency.value = 160;
      warmShelf.gain.value = 2.0;

      warmShelf.connect(masterLowpass);
      masterLowpass.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.0001;
      this.ambientGain.connect(warmShelf);

      // Soft non-pitched ambient FX bus routed into ambientGain (never mixed with phase cues)
      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0.85;
      this.ambientBus.connect(this.ambientGain);

      // Dedicated clean channel for breathing phase cues (inhale / hold / exhale)
      // Bypasses heavy lo-fi ambient filtering so cues are always crisp & unmistakable
      const cueFilter = this.ctx.createBiquadFilter();
      cueFilter.type = 'lowpass';
      cueFilter.frequency.value = 3400;
      cueFilter.Q.value = 0.5;

      this.phaseCueGain = this.ctx.createGain();
      this.phaseCueGain.gain.value = this.cueVolume;

      const cueDelay = this.ctx.createDelay(1.0);
      cueDelay.delayTime.value = 0.22;
      const cueFeedback = this.ctx.createGain();
      cueFeedback.gain.value = 0.16;
      const cueDelayFilter = this.ctx.createBiquadFilter();
      cueDelayFilter.type = 'lowpass';
      cueDelayFilter.frequency.value = 1800;
      const cueDelayWet = this.ctx.createGain();
      cueDelayWet.gain.value = 0.28;

      this.phaseCueGain.connect(cueFilter);
      cueFilter.connect(this.masterGain);

      cueFilter.connect(cueDelay);
      cueDelay.connect(cueDelayFilter);
      cueDelayFilter.connect(cueFeedback);
      cueFeedback.connect(cueDelay);
      cueDelayFilter.connect(cueDelayWet);
      cueDelayWet.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.06);
    }
  }

  setCueVolume(val) {
    this.cueVolume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.phaseCueGain) {
      this.phaseCueGain.gain.setTargetAtTime(this.cueVolume, this.ctx.currentTime, 0.04);
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
    }
  }

  previewAmbience(sceneId, durationMs = 5500) {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.startAmbience(sceneId);
    this.previewTimeout = setTimeout(() => {
      this.previewTimeout = null;
      this.stopAll();
    }, durationMs);
  }

  cancelPreviewTimeout() {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
  }

  startAmbience(sceneId = 'ocean') {
    const ctx = this._ensureContext();
    if (!ctx) return;

    if (this.stopSceneTimeout) {
      clearTimeout(this.stopSceneTimeout);
      this.stopSceneTimeout = null;
    }

    this._stopCurrentScene();
    this.currentSceneId = sceneId;
    this.isRunning = true;

    const cleanups = [];
    const now = ctx.currentTime;

    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);
    this.ambientGain.gain.linearRampToValueAtTime(0.85, now + 0.8);

    const addLoopSource = (buffer, filterCfg, gainVal) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterCfg.type || 'lowpass';
      filter.frequency.value = filterCfg.freq || 500;
      if (filterCfg.Q) filter.Q.value = filterCfg.Q;
      const g = ctx.createGain();
      g.gain.value = gainVal;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.ambientGain);
      src.start(now);
      cleanups.push(() => {
        try { src.stop(); src.disconnect(); } catch (e) {}
      });
      return { src, filter, gain: g };
    };

    if (sceneId === 'ocean') {
      // Clear, soothing rolling waves that stay strictly non-tonal so phase cues stay unmistakable
      const waveBody = addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 240 }, 0.04);
      const waveFoam = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 820, Q: 0.7 }, 0.01);

      const scheduleWave = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'ocean') return;
        const t = this.ctx.currentTime;
        const cycle = 6.2;

        waveBody.gain.gain.cancelScheduledValues(t);
        waveBody.gain.gain.setValueAtTime(0.035, t);
        waveBody.gain.gain.linearRampToValueAtTime(0.28, t + 2.4);
        waveBody.gain.gain.exponentialRampToValueAtTime(0.04, t + cycle - 0.15);

        waveBody.filter.frequency.cancelScheduledValues(t);
        waveBody.filter.frequency.setValueAtTime(150, t);
        waveBody.filter.frequency.linearRampToValueAtTime(520, t + 2.5);
        waveBody.filter.frequency.exponentialRampToValueAtTime(145, t + cycle - 0.15);

        waveFoam.gain.gain.cancelScheduledValues(t);
        waveFoam.gain.gain.setValueAtTime(0.006, t);
        waveFoam.gain.gain.linearRampToValueAtTime(0.16, t + 2.7);
        waveFoam.gain.gain.exponentialRampToValueAtTime(0.006, t + cycle - 0.2);

        waveFoam.filter.frequency.cancelScheduledValues(t);
        waveFoam.filter.frequency.setValueAtTime(380, t);
        waveFoam.filter.frequency.linearRampToValueAtTime(1150, t + 2.7);
        waveFoam.filter.frequency.exponentialRampToValueAtTime(340, t + cycle - 0.2);
      };

      scheduleWave();
      const waveInterval = setInterval(scheduleWave, 6200);
      cleanups.push(() => clearInterval(waveInterval));

    } else if (sceneId === 'forest') {
      // Gentle canopy rain + calm woodland brook texture (no random pitched blips or sharp bird whistles)
      addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 950, Q: 0.8 }, 0.08);
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 240 }, 0.10);

      const streamMod = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 1450, Q: 1.4 }, 0.02);
      const scheduleBrook = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'forest') return;
        const t = this.ctx.currentTime;
        streamMod.gain.gain.cancelScheduledValues(t);
        streamMod.gain.gain.setValueAtTime(0.015, t);
        streamMod.gain.gain.linearRampToValueAtTime(0.045, t + 1.8);
        streamMod.gain.gain.exponentialRampToValueAtTime(0.015, t + 3.8);
      };
      scheduleBrook();
      const brookInterval = setInterval(scheduleBrook, 3900);
      cleanups.push(() => clearInterval(brookInterval));

    } else if (sceneId === 'fireplace') {
      // Warm low ember rumble + gentle dry wood crackles well below phase-cue loudness
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 145 }, 0.12);

      const triggerCrackleBurst = () => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running' || this.currentSceneId !== 'fireplace') return;
        const popsCount = Math.random() > 0.65 ? 2 : 1;

        for (let p = 0; p < popsCount; p++) {
          const t = this.ctx.currentTime + p * (0.03 + Math.random() * 0.06);
          const src = this.ctx.createBufferSource();
          src.buffer = this.buffers.whiteBuffer;

          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 1350 + Math.random() * 1100;
          bp.Q.value = 2.8;

          const g = this.ctx.createGain();
          const isBigSnap = Math.random() > 0.78;
          const peak = isBigSnap ? (0.16 + Math.random() * 0.10) : (0.07 + Math.random() * 0.08);
          const dur = isBigSnap ? 0.022 : 0.012;

          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.0015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

          src.connect(bp);
          bp.connect(g);
          g.connect(this.ambientBus);
          src.start(t, Math.random() * 2.5, dur + 0.01);
        }
      };

      triggerCrackleBurst();
      const crackleInterval = setInterval(triggerCrackleBurst, 190);
      cleanups.push(() => clearInterval(crackleInterval));

    } else if (sceneId === 'wind') {
      // Smooth sweeping breeze through pines — purely wind resonance so no random bells confuse phase cues
      const gust = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 380, Q: 3.6 }, 0.06);
      const canopy = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 920, Q: 1.1 }, 0.035);

      const scheduleGust = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'wind') return;
        const t = this.ctx.currentTime;
        const pitchPeak = 440 + Math.random() * 220;
        gust.filter.frequency.cancelScheduledValues(t);
        gust.filter.frequency.setValueAtTime(240, t);
        gust.filter.frequency.linearRampToValueAtTime(pitchPeak, t + 2.1);
        gust.filter.frequency.exponentialRampToValueAtTime(235, t + 4.8);

        gust.gain.gain.cancelScheduledValues(t);
        gust.gain.gain.setValueAtTime(0.035, t);
        gust.gain.gain.linearRampToValueAtTime(0.16, t + 2.0);
        gust.gain.gain.exponentialRampToValueAtTime(0.04, t + 4.8);

        canopy.gain.gain.cancelScheduledValues(t);
        canopy.gain.gain.setValueAtTime(0.025, t);
        canopy.gain.gain.linearRampToValueAtTime(0.08, t + 2.2);
        canopy.gain.gain.exponentialRampToValueAtTime(0.025, t + 4.8);
      };

      scheduleGust();
      const gustInterval = setInterval(scheduleGust, 5000);
      cleanups.push(() => clearInterval(gustInterval));

    } else {
      // rain_window: Crisp indoor rain patter + slow-attack muted warm pad chords (no bell-like transients)
      addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 1350, Q: 0.7 }, 0.11);
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 210 }, 0.09);

      const LOFI_CHORDS = [
        [174.61, 220.0, 261.63], // Fmaj
        [164.81, 196.0, 246.94], // Em
        [146.83, 174.61, 220.0], // Dm
        [130.81, 164.81, 196.0], // Cmaj
      ];
      let chordIdx = 0;
      const activePadOscs = new Set();

      const playPadChord = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'rain_window') return;
        const t = this.ctx.currentTime + 0.02;
        const chord = LOFI_CHORDS[chordIdx % LOFI_CHORDS.length];
        chordIdx += 1;
        chord.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(420, t);

          const env = this.ctx.createGain();
          env.gain.setValueAtTime(0.0001, t);
          env.gain.linearRampToValueAtTime(0.026, t + 1.4);
          env.gain.exponentialRampToValueAtTime(0.0001, t + 4.6);

          osc.connect(lp);
          lp.connect(env);
          env.connect(this.ambientBus);
          activePadOscs.add(osc);
          osc.onended = () => {
            activePadOscs.delete(osc);
            try { osc.disconnect(); } catch (e) {}
          };
          osc.start(t);
          osc.stop(t + 4.7);
        });
      };

      playPadChord();
      const chordInterval = setInterval(playPadChord, 4600);
      cleanups.push(() => {
        clearInterval(chordInterval);
        activePadOscs.forEach((osc) => {
          try { osc.stop(); osc.disconnect(); } catch (e) {}
        });
        activePadOscs.clear();
      });
    }

    this.activeSceneCleanup = () => {
      cleanups.forEach((fn) => fn());
    };
  }

  _duckAmbience(duckLevel = 0.60, recoverySec = 1.35) {
    if (!this.ctx || !this.ambientGain || !this.isRunning) return;
    const now = this.ctx.currentTime;
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);
    // Subtle ducking proportional to cueVolume so background effects stay present and natural
    const duckDepth = (0.85 - duckLevel) * Math.min(1, Math.max(0, this.cueVolume * 1.5));
    const targetDuck = Math.max(0.45, 0.85 - duckDepth);
    this.ambientGain.gain.linearRampToValueAtTime(targetDuck, now + 0.08);
    this.ambientGain.gain.linearRampToValueAtTime(0.85, now + recoverySec);
  }

  _playCueChimeNote(freq, delaySec = 0, durationSec = 1.1, peakGain = 0.24) {
    const ctx = this._ensureContext();
    if (!ctx || !this.phaseCueGain) return;

    const start = ctx.currentTime + 0.025 + delaySec;
    const fundamental = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    fundamental.type = 'sine';
    harmonic.type = 'triangle';
    fundamental.frequency.setValueAtTime(freq, start);
    harmonic.frequency.setValueAtTime(freq * 2, start);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.22, start);
    harmonicGain.gain.exponentialRampToValueAtTime(0.02, start + Math.min(0.45, durationSec * 0.5));

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    fundamental.connect(env);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(env);
    env.connect(this.phaseCueGain);

    fundamental.start(start);
    harmonic.start(start);
    fundamental.stop(start + durationSec + 0.05);
    harmonic.stop(start + durationSec + 0.05);

    this.activeCueCleanups.push(() => {
      try {
        const t = ctx.currentTime;
        env.gain.cancelScheduledValues(t);
        env.gain.setTargetAtTime(0.0001, t, 0.03);
        fundamental.stop(t + 0.08);
        harmonic.stop(t + 0.08);
      } catch (e) {}
    });
  }

  _playWarmGongCue(durationSec = 4.2, peakGain = 0.24) {
    const ctx = this._ensureContext();
    if (!ctx || !this.phaseCueGain) return;

    const start = ctx.currentTime + 0.025;
    // Resonant Tibetan singing bowl / warm zen gong partials
    const partials = [
      { freq: 146.83, amp: 0.45, decay: durationSec },       // D3 deep warm body
      { freq: 293.66, amp: 1.0, decay: durationSec * 0.95 }, // D4 core tone
      { freq: 295.16, amp: 0.75, decay: durationSec * 0.92 },// Gentle 1.5Hz warm shimmer
      { freq: 440.00, amp: 0.40, decay: durationSec * 0.72 },// A4 harmonic fifth
      { freq: 587.33, amp: 0.18, decay: durationSec * 0.45 },// D5 bell bloom
    ];

    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, start);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(peakGain * p.amp, start + 0.065);
      env.gain.exponentialRampToValueAtTime(0.0001, start + p.decay);

      osc.connect(env);
      env.connect(this.phaseCueGain);
      osc.start(start);
      osc.stop(start + p.decay + 0.06);

      this.activeCueCleanups.push(() => {
        try {
          const t = ctx.currentTime;
          env.gain.cancelScheduledValues(t);
          env.gain.setTargetAtTime(0.0001, t, 0.04);
          osc.stop(t + 0.1);
        } catch (e) {}
      });
    });
  }

  _playBreathAirGuide(direction = 'in', durationSec = 4) {
    const ctx = this._ensureContext();
    if (!ctx || !this.buffers || !this.phaseCueGain) return;

    const start = ctx.currentTime + 0.025;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.pinkBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.6;

    const g = ctx.createGain();
    if (direction === 'in') {
      bp.frequency.setValueAtTime(260, start);
      bp.frequency.exponentialRampToValueAtTime(880, start + Math.max(0.5, durationSec - 0.15));
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.06, start + durationSec * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0005, start + durationSec);
    } else {
      bp.frequency.setValueAtTime(760, start);
      bp.frequency.exponentialRampToValueAtTime(190, start + Math.max(0.5, durationSec - 0.25));
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.065, start + 0.55);
      g.gain.exponentialRampToValueAtTime(0.0004, start + durationSec);
    }

    src.connect(bp);
    bp.connect(g);
    g.connect(this.phaseCueGain);
    src.start(start);
    src.stop(start + durationSec + 0.05);

    this.activeCueCleanups.push(() => {
      try {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0.0001, t, 0.03);
        src.stop(t + 0.08);
      } catch (e) {}
    });
  }

  _stopPhaseCues() {
    this.activeCueCleanups.forEach((fn) => fn());
    this.activeCueCleanups = [];
    this.activeCueTimeouts.forEach((id) => clearTimeout(id));
    this.activeCueTimeouts = [];
  }

  /**
   * Plays a deterministic, distinct, unmistakable cue exclusively on phase transitions:
   * - inhale (4s): Clear ascending 4-note chord (C5 -> E5 -> G5 -> C6) + rising air inflow
   * - hold (7s): Single sustained warm Tibetan gong / singing bowl (no misleading mid-hold beeps)
   * - exhale (8s): Clear descending 4-note cadence (G5 -> E5 -> C5 -> G4) + falling air release
   */
  playPhaseCue(phase) {
    if (!this.isRunning) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    this._stopPhaseCues();
    if (this.cueVolume <= 0.005) return;
    this._duckAmbience(0.60, 1.35);

    if (phase === 'inhale') {
      // Unmistakable upward climbing arpeggio: C5 -> E5 -> G5 -> C6
      this._playCueChimeNote(523.25, 0.00, 1.0, 0.20);
      this._playCueChimeNote(659.25, 0.14, 1.1, 0.22);
      this._playCueChimeNote(783.99, 0.28, 1.2, 0.24);
      this._playCueChimeNote(1046.50, 0.42, 1.6, 0.25);
      this._playBreathAirGuide('in', 3.85);
    } else if (phase === 'hold') {
      // Single centered warm singing bowl gong: clear stillness signal for the full 7s hold
      this._playWarmGongCue(4.2, 0.22);
    } else if (phase === 'exhale') {
      // Unmistakable downward relaxing cadence: G5 -> E5 -> C5 -> G4 (+ soft C4 ground)
      this._playCueChimeNote(783.99, 0.00, 1.1, 0.22);
      this._playCueChimeNote(659.25, 0.18, 1.2, 0.21);
      this._playCueChimeNote(523.25, 0.36, 1.4, 0.20);
      this._playCueChimeNote(392.00, 0.54, 2.2, 0.22);
      this._playCueChimeNote(261.63, 0.56, 2.4, 0.14);
      this._playBreathAirGuide('out', 7.6);
    }
  }

  _stopCurrentScene() {
    if (this.activeSceneCleanup) {
      this.activeSceneCleanup();
      this.activeSceneCleanup = null;
    }
  }

  stopAll() {
    this.cancelPreviewTimeout();
    this.isRunning = false;
    this._stopPhaseCues();
    if (this.stopSceneTimeout) {
      clearTimeout(this.stopSceneTimeout);
      this.stopSceneTimeout = null;
    }
    if (this.ctx && this.ambientGain) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setTargetAtTime(0.0001, now, 0.12);
      this.stopSceneTimeout = setTimeout(() => {
        this.stopSceneTimeout = null;
        if (!this.isRunning) {
          this._stopCurrentScene();
        }
      }, 320);
    } else {
      this._stopCurrentScene();
    }
  }

  destroy() {
    this.cancelPreviewTimeout();
    if (this.stopSceneTimeout) {
      clearTimeout(this.stopSceneTimeout);
      this.stopSceneTimeout = null;
    }
    this.isRunning = false;
    this._stopPhaseCues();
    this._stopCurrentScene();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
