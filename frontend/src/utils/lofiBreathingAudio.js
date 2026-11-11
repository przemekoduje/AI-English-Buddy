/**
 * Lo-Fi Ambient Soundscapes & Phase Cue Engine (Pure Web Audio API)
 * Generates warm, low-pass filtered nature soundscapes and distinct lo-fi phase cues
 * so the user can complete the 4-7-8 breathing exercise with their eyes closed.
 */

export const LOFI_SOUNDSCAPES = [
  {
    id: 'ocean',
    label: 'Szum morza',
    icon: '🌊',
    description: 'Ciepłe fale oceanu i miękki szum taśmy',
  },
  {
    id: 'forest',
    label: 'Deszczowy las',
    icon: '🌲',
    description: 'Spokojny deszcz w koronach drzew i dalekie krople',
  },
  {
    id: 'fireplace',
    label: 'Nocny kominek',
    icon: '🔥',
    description: 'Przytulny trzask drewna i ciepły żar',
  },
  {
    id: 'wind',
    label: 'Wiatr wśród sosen',
    icon: '🍃',
    description: 'Miękki górski powiew i kojący niski ton',
  },
  {
    id: 'rain_window',
    label: 'Deszcz na szybie',
    icon: '🌧️',
    description: 'Stłumiony nocny deszcz z ciepłym pogłosem lo-fi',
  },
];

export const pickRandomSoundscape = (excludeId = null) => {
  const candidates = excludeId
    ? LOFI_SOUNDSCAPES.filter((s) => s.id !== excludeId)
    : LOFI_SOUNDSCAPES;
  return candidates[Math.floor(Math.random() * candidates.length)] || LOFI_SOUNDSCAPES[0];
};

// Create reusable 4-second seamless noise buffers
const createNoiseBuffers = (ctx) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 4;

  // Pink noise buffer (Paul Kellet filter)
  const pinkBuffer = ctx.createBuffer(1, length, sampleRate);
  const pinkData = pinkBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
    b6 = white * 0.115926;
  }

  // Brown noise buffer (deep warm rumble)
  const brownBuffer = ctx.createBuffer(1, length, sampleRate);
  const brownData = brownBuffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    brownData[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = brownData[i];
    brownData[i] *= 2.8;
  }

  // Crossfade buffer edges for clickless looping
  const fadeSamples = Math.floor(sampleRate * 0.15);
  for (const data of [pinkData, brownData]) {
    for (let i = 0; i < fadeSamples; i++) {
      const ratio = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      const blended = data[i] * ratio + data[tailIdx] * (1 - ratio);
      data[i] = blended;
      data[tailIdx] = blended;
    }
  }

  return { pinkBuffer, brownBuffer };
};

export class LoFiBreathingEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.cueBus = null;
    this.delayNode = null;
    this.buffers = null;
    this.activeSceneCleanup = null;
    this.activeBreathGuideCleanup = null;
    this.activeCueTimeouts = [];
    this.isMuted = false;
    this.volume = 0.65;
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

      // Master Lo-Fi warmth chain: Lowpass filter -> Master Gain -> Destination
      const masterLowpass = this.ctx.createBiquadFilter();
      masterLowpass.type = 'lowpass';
      masterLowpass.frequency.value = 1650; // Very warm, zero harsh highs
      masterLowpass.Q.value = 0.65;

      const warmShelf = this.ctx.createBiquadFilter();
      warmShelf.type = 'lowshelf';
      warmShelf.frequency.value = 180;
      warmShelf.gain.value = 3.5;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      warmShelf.connect(masterLowpass);
      masterLowpass.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Ambient bed gain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.0001;
      this.ambientGain.connect(warmShelf);

      // Cue bus with warm lo-fi echo/delay tail
      this.cueBus = this.ctx.createGain();
      this.cueBus.gain.value = 0.85;
      this.cueBus.connect(warmShelf);

      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = 0.31;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.28;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 820;

      this.cueBus.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delay);
      delayFilter.connect(warmShelf);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  startAmbience(sceneId = 'ocean') {
    const ctx = this._ensureContext();
    if (!ctx) return;

    this._stopCurrentScene();
    this.currentSceneId = sceneId;
    this.isRunning = true;

    const cleanups = [];
    const now = ctx.currentTime;

    // Fade ambient bed in softly
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);
    this.ambientGain.gain.linearRampToValueAtTime(0.95, now + 1.6);

    // Subtle lo-fi vinyl/tape dust layer shared by all scenes
    const vinylSrc = ctx.createBufferSource();
    vinylSrc.buffer = this.buffers.pinkBuffer;
    vinylSrc.loop = true;
    const vinylBp = ctx.createBiquadFilter();
    vinylBp.type = 'bandpass';
    vinylBp.frequency.value = 1150;
    vinylBp.Q.value = 1.4;
    const vinylGain = ctx.createGain();
    vinylGain.gain.value = 0.015;
    vinylSrc.connect(vinylBp);
    vinylBp.connect(vinylGain);
    vinylGain.connect(this.ambientGain);
    vinylSrc.start(now);
    cleanups.push(() => {
      try { vinylSrc.stop(); vinylSrc.disconnect(); } catch (e) {}
    });

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

    const addLfo = (rateHz, targetParam, amount, phaseOffsetSec = 0) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = rateHz;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = amount;
      osc.connect(lfoGain);
      lfoGain.connect(targetParam);
      osc.start(now - phaseOffsetSec);
      cleanups.push(() => {
        try { osc.stop(); osc.disconnect(); } catch (e) {}
      });
    };

    if (sceneId === 'ocean') {
      // Deep rolling swell (brown noise + slow wave LFO)
      const swell = addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 290, Q: 0.9 }, 0.34);
      addLfo(0.085, swell.filter.frequency, 175);
      addLfo(0.085, swell.gain.gain, 0.14);

      // Gentle foam wash
      const foam = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 640, Q: 0.65 }, 0.085);
      addLfo(0.085, foam.gain.gain, 0.06, 0.8);
    } else if (sceneId === 'forest') {
      // Soft rain on leaves
      const rain = addLoopSource(this.buffers.pinkBuffer, { type: 'lowpass', freq: 880, Q: 0.5 }, 0.22);
      addLfo(0.045, rain.gain.gain, 0.04);

      // Deep forest canopy rumble
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 200 }, 0.28);

      // Random soft water droplets
      const dropInterval = setInterval(() => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        if (Math.random() > 0.72) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;

        const baseFreq = 460 + Math.random() * 440;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, t + 0.09);

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028 + Math.random() * 0.018, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

        osc.connect(lp);
        lp.connect(g);
        g.connect(this.cueBus);
        osc.start(t);
        osc.stop(t + 0.14);
      }, 750);
      cleanups.push(() => clearInterval(dropInterval));
    } else if (sceneId === 'fireplace') {
      // Warm cozy ember bed
      const ember = addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 175 }, 0.42);
      addLfo(0.11, ember.gain.gain, 0.06);

      // Subtle warm crackle pops
      const crackleInterval = setInterval(() => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        if (Math.random() > 0.65) return;
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.pinkBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 850 + Math.random() * 1150;
        bp.Q.value = 2.4;
        const g = this.ctx.createGain();
        const peak = 0.03 + Math.random() * 0.055;
        const dur = 0.014 + Math.random() * 0.022;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        src.connect(bp);
        bp.connect(g);
        g.connect(this.ambientGain);
        src.start(t, Math.random() * 2.5, dur + 0.01);
      }, 240);
      cleanups.push(() => clearInterval(crackleInterval));
    } else if (sceneId === 'wind') {
      // Airy dual sweeping breeze
      const breeze1 = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 380, Q: 1.5 }, 0.16);
      addLfo(0.062, breeze1.filter.frequency, 150);
      addLfo(0.051, breeze1.gain.gain, 0.07);

      const breeze2 = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 620, Q: 1.8 }, 0.09);
      addLfo(0.043, breeze2.filter.frequency, 190, 2.5);

      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 185 }, 0.25);

      // Gentle grounding warm hum
      [110, 164.81].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        const g = ctx.createGain();
        g.gain.value = 0.024;
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.ambientGain);
        osc.start(now);
        cleanups.push(() => {
          try { osc.stop(); osc.disconnect(); } catch (e) {}
        });
      });
    } else {
      // rain_window: Warm muffled indoor rain + ultra-soft Fmaj7 tape pad
      const rain = addLoopSource(this.buffers.pinkBuffer, { type: 'lowpass', freq: 580, Q: 0.6 }, 0.30);
      addLfo(0.05, rain.gain.gain, 0.04);
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 165 }, 0.22);

      // Whisper-quiet warm lo-fi Rhodes hum (Fmaj7)
      [174.61, 220.0, 261.63, 329.63].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        const g = ctx.createGain();
        g.gain.value = idx === 0 ? 0.018 : 0.011;
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.ambientGain);
        osc.start(now);
        cleanups.push(() => {
          try { osc.stop(); osc.disconnect(); } catch (e) {}
        });
      });
    }

    this.activeSceneCleanup = () => {
      cleanups.forEach((fn) => fn());
    };
  }

  _playLoFiFeltNote(freq, delaySec = 0, durationSec = 1.6, peakGain = 0.11) {
    const ctx = this._ensureContext();
    if (!ctx || !this.cueBus) return;

    const start = ctx.currentTime + delaySec;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq, start);
    // Subtle analog tape detune
    osc2.detune.setValueAtTime(4, start);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.22;

    const feltFilter = ctx.createBiquadFilter();
    feltFilter.type = 'lowpass';
    feltFilter.frequency.setValueAtTime(760, start); // Muffled felt-piano warmth

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.055);
    env.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    osc1.connect(feltFilter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(feltFilter);
    feltFilter.connect(env);
    env.connect(this.cueBus);

    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + durationSec + 0.05);
    osc2.stop(start + durationSec + 0.05);
  }

  _playBreathAirGuide(direction = 'in', durationSec = 4) {
    const ctx = this._ensureContext();
    if (!ctx || !this.buffers || !this.cueBus) return;

    this._stopBreathGuide();

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.pinkBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;

    const g = ctx.createGain();
    if (direction === 'in') {
      // Smooth upward swell (4s inhale guide)
      bp.frequency.setValueAtTime(190, now);
      bp.frequency.exponentialRampToValueAtTime(560, now + Math.max(0.5, durationSec - 0.15));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.085, now + durationSec * 0.45);
      g.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    } else {
      // Smooth downward sigh (8s exhale guide)
      bp.frequency.setValueAtTime(520, now);
      bp.frequency.exponentialRampToValueAtTime(145, now + Math.max(0.5, durationSec - 0.25));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0005, now + durationSec);
    }

    src.connect(bp);
    bp.connect(g);
    g.connect(this.cueBus);
    src.start(now);
    src.stop(now + durationSec + 0.05);

    this.activeBreathGuideCleanup = () => {
      try { src.stop(); src.disconnect(); } catch (e) {}
    };
  }

  _stopBreathGuide() {
    if (this.activeBreathGuideCleanup) {
      this.activeBreathGuideCleanup();
      this.activeBreathGuideCleanup = null;
    }
    this.activeCueTimeouts.forEach((id) => clearTimeout(id));
    this.activeCueTimeouts = [];
  }

  /**
   * Plays distinct, soothing lo-fi sound cues separating each phase:
   * - inhale (4s): Rising warm felt two-note interval (C4 -> G4) + rising air swell
   * - hold (7s): Serene suspended bell chord (D4 + A4) + subtle mid-point pulse at 3.5s
   * - exhale (8s): Descending soothing cadence (E4 -> C4 -> G3) + falling exhale breeze
   */
  playPhaseCue(phase) {
    if (!this.isRunning) return;
    this._ensureContext();
    this._stopBreathGuide();

    if (phase === 'inhale') {
      this._playLoFiFeltNote(261.63, 0.0, 1.4, 0.10);  // C4
      this._playLoFiFeltNote(392.00, 0.24, 1.7, 0.11); // G4 (rising)
      this._playBreathAirGuide('in', 3.9);
    } else if (phase === 'hold') {
      // Serene suspended fifth
      this._playLoFiFeltNote(293.66, 0.0, 2.8, 0.075); // D4
      this._playLoFiFeltNote(440.00, 0.04, 2.8, 0.075); // A4

      // Gentle whisper-soft midpoint marker at 3.5s so user knows hold is halfway done
      const midTimer = setTimeout(() => {
        if (!this.isRunning) return;
        this._playLoFiFeltNote(440.00, 0.0, 1.4, 0.04);
      }, 3500);
      this.activeCueTimeouts.push(midTimer);
    } else if (phase === 'exhale') {
      // Warm descending release cadence
      this._playLoFiFeltNote(329.63, 0.0, 1.5, 0.095); // E4
      this._playLoFiFeltNote(261.63, 0.26, 1.8, 0.09); // C4
      this._playLoFiFeltNote(196.00, 0.54, 2.4, 0.10); // G3 (grounding)
      this._playBreathAirGuide('out', 7.8);
    }
  }

  _stopCurrentScene() {
    if (this.activeSceneCleanup) {
      this.activeSceneCleanup();
      this.activeSceneCleanup = null;
    }
  }

  stopAll() {
    this.isRunning = false;
    this._stopBreathGuide();
    if (this.ctx && this.ambientGain) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setTargetAtTime(0.0001, now, 0.18);
      setTimeout(() => {
        if (!this.isRunning) {
          this._stopCurrentScene();
        }
      }, 450);
    } else {
      this._stopCurrentScene();
    }
  }

  destroy() {
    this.isRunning = false;
    this._stopBreathGuide();
    this._stopCurrentScene();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

