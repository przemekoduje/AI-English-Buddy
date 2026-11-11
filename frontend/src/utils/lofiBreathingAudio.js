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
    description: 'Śpiewny powiew wiatru w koronach drzew i delikatne dzwonki',
  },
  {
    id: 'rain_window',
    label: 'Deszcz i Lo-Fi Piano',
    icon: '🌧️',
    description: 'Deszcz na szybie z kojącymi ciepłymi akordami lo-fi',
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
    this.cueBus = null;
    this.buffers = null;
    this.activeSceneCleanup = null;
    this.activeBreathGuideCleanup = null;
    this.activeCueTimeouts = [];
    this.previewTimeout = null;
    this.isMuted = false;
    this.volume = 0.7;
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

      // Warm tape roll-off (2900 Hz keeps crackles/droplets clear yet silky lo-fi)
      const masterLowpass = this.ctx.createBiquadFilter();
      masterLowpass.type = 'lowpass';
      masterLowpass.frequency.value = 2900;
      masterLowpass.Q.value = 0.6;

      const warmShelf = this.ctx.createBiquadFilter();
      warmShelf.type = 'lowshelf';
      warmShelf.frequency.value = 160;
      warmShelf.gain.value = 2.0;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      warmShelf.connect(masterLowpass);
      masterLowpass.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.0001;
      this.ambientGain.connect(warmShelf);

      // Cue & textural FX bus with cozy lo-fi echo
      this.cueBus = this.ctx.createGain();
      this.cueBus.gain.value = 0.9;
      this.cueBus.connect(warmShelf);

      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = 0.32;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.28;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 1100;

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
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.06);
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

    this._stopCurrentScene();
    this.currentSceneId = sceneId;
    this.isRunning = true;

    const cleanups = [];
    const now = ctx.currentTime;

    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);
    this.ambientGain.gain.linearRampToValueAtTime(1.0, now + 0.9);

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
      // Clear, unmistakable rolling waves: builds up strongly then fades almost silent every ~6.5s
      const waveBody = addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 260 }, 0.05);
      const waveFoam = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 880, Q: 0.7 }, 0.01);

      const scheduleWave = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'ocean') return;
        const t = this.ctx.currentTime;
        const cycle = 6.2;

        // Swell in over 2.6s -> crash foam peak -> pull back smoothly over 3.4s
        waveBody.gain.gain.cancelScheduledValues(t);
        waveBody.gain.gain.setValueAtTime(0.04, t);
        waveBody.gain.gain.linearRampToValueAtTime(0.38, t + 2.4);
        waveBody.gain.gain.exponentialRampToValueAtTime(0.045, t + cycle - 0.15);

        waveBody.filter.frequency.cancelScheduledValues(t);
        waveBody.filter.frequency.setValueAtTime(160, t);
        waveBody.filter.frequency.linearRampToValueAtTime(580, t + 2.5);
        waveBody.filter.frequency.exponentialRampToValueAtTime(150, t + cycle - 0.15);

        waveFoam.gain.gain.cancelScheduledValues(t);
        waveFoam.gain.gain.setValueAtTime(0.008, t);
        waveFoam.gain.gain.linearRampToValueAtTime(0.24, t + 2.7);
        waveFoam.gain.gain.exponentialRampToValueAtTime(0.008, t + cycle - 0.2);

        waveFoam.filter.frequency.cancelScheduledValues(t);
        waveFoam.filter.frequency.setValueAtTime(420, t);
        waveFoam.filter.frequency.linearRampToValueAtTime(1350, t + 2.7);
        waveFoam.filter.frequency.exponentialRampToValueAtTime(380, t + cycle - 0.2);
      };

      scheduleWave();
      const waveInterval = setInterval(scheduleWave, 6200);
      cleanups.push(() => clearInterval(waveInterval));

    } else if (sceneId === 'forest') {
      // Very quiet gentle leaf rustle so droplets & distant birds stand out clearly
      addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 1100, Q: 0.9 }, 0.045);

      // Authentic water droplets (upward pitch bubble-plop!)
      const dropInterval = setInterval(() => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        if (Math.random() > 0.78) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const fStart = 420 + Math.random() * 480;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(fStart, t);
        osc.frequency.exponentialRampToValueAtTime(fStart * 2.15, t + 0.055);

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11 + Math.random() * 0.07, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);

        osc.connect(g);
        g.connect(this.cueBus);
        osc.start(t);
        osc.stop(t + 0.09);
      }, 420);
      cleanups.push(() => clearInterval(dropInterval));

      // Gentle distant lo-fi woodland bird call every 2.8 - 4.5s
      const triggerBird = () => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime;
        const notes = Math.random() > 0.5
          ? [1320, 1580, 1420]
          : [1050, 1280];

        notes.forEach((freq, idx) => {
          const start = t + idx * 0.14;
          const osc = this.ctx.createOscillator();
          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1750;
          const g = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * 0.92, start);
          osc.frequency.exponentialRampToValueAtTime(freq, start + 0.05);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.96, start + 0.11);

          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime(0.045, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

          osc.connect(lp);
          lp.connect(g);
          g.connect(this.cueBus);
          osc.start(start);
          osc.stop(start + 0.14);
        });
      };
      setTimeout(triggerBird, 550);
      const birdInterval = setInterval(triggerBird, 3400);
      cleanups.push(() => clearInterval(birdInterval));

    } else if (sceneId === 'fireplace') {
      // NO loud static hiss! Just warm low ember rumble + unmistakable crisp wood crackles & pops
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 140 }, 0.14);

      const triggerCrackleBurst = () => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        const popsCount = Math.random() > 0.65 ? 2 : 1;

        for (let p = 0; p < popsCount; p++) {
          const t = this.ctx.currentTime + p * (0.03 + Math.random() * 0.06);
          const src = this.ctx.createBufferSource();
          src.buffer = this.buffers.whiteBuffer;

          // Sharp wood-snap resonance
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 1400 + Math.random() * 1400;
          bp.Q.value = 2.8;

          const g = this.ctx.createGain();
          const isBigSnap = Math.random() > 0.72;
          const peak = isBigSnap ? (0.35 + Math.random() * 0.25) : (0.14 + Math.random() * 0.16);
          const dur = isBigSnap ? 0.028 : 0.014;

          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.0015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

          src.connect(bp);
          bp.connect(g);
          g.connect(this.ambientGain);
          src.start(t, Math.random() * 2.5, dur + 0.01);
        }
      };

      triggerCrackleBurst();
      const crackleInterval = setInterval(triggerCrackleBurst, 150);
      cleanups.push(() => clearInterval(crackleInterval));

    } else if (sceneId === 'wind') {
      // Sweeping melodic wind gusts + soft pentatonic bamboo wind-chimes
      const gust = addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 420, Q: 4.5 }, 0.07);

      const scheduleGust = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'wind') return;
        const t = this.ctx.currentTime;
        const pitchPeak = 460 + Math.random() * 340;
        gust.filter.frequency.cancelScheduledValues(t);
        gust.filter.frequency.setValueAtTime(260, t);
        gust.filter.frequency.linearRampToValueAtTime(pitchPeak, t + 2.1);
        gust.filter.frequency.exponentialRampToValueAtTime(250, t + 4.8);

        gust.gain.gain.cancelScheduledValues(t);
        gust.gain.gain.setValueAtTime(0.04, t);
        gust.gain.gain.linearRampToValueAtTime(0.22, t + 2.0);
        gust.gain.gain.exponentialRampToValueAtTime(0.045, t + 4.8);
      };

      scheduleGust();
      const gustInterval = setInterval(scheduleGust, 5000);
      cleanups.push(() => clearInterval(gustInterval));

      // Gentle pentatonic wind chimes on breeze peaks
      const CHIME_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 D5 E5 G5 A5
      const triggerChime = () => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        const count = Math.random() > 0.45 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const note = CHIME_SCALE[Math.floor(Math.random() * CHIME_SCALE.length)];
          this._playLoFiFeltNote(note, i * 0.28, 1.9, 0.055);
        }
      };
      setTimeout(triggerChime, 400);
      const chimeInterval = setInterval(triggerChime, 3200);
      cleanups.push(() => clearInterval(chimeInterval));

    } else {
      // rain_window: Crisp indoor rain patter + slow, dreamy Lo-Fi piano chords!
      addLoopSource(this.buffers.pinkBuffer, { type: 'bandpass', freq: 1450, Q: 0.7 }, 0.13);
      addLoopSource(this.buffers.brownBuffer, { type: 'lowpass', freq: 220 }, 0.11);

      const LOFI_CHORDS = [
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [164.81, 196.0, 246.94, 293.66], // Em7
        [146.83, 174.61, 220.0, 261.63], // Dm7
        [130.81, 164.81, 196.0, 246.94], // Cmaj7
      ];
      let chordIdx = 0;

      const playNextChord = () => {
        if (!this.isRunning || !this.ctx || this.currentSceneId !== 'rain_window') return;
        const chord = LOFI_CHORDS[chordIdx % LOFI_CHORDS.length];
        chordIdx += 1;
        chord.forEach((freq, i) => {
          // Strummed lo-fi Rhodes voicing
          this._playLoFiFeltNote(freq, i * 0.06, 4.2, 0.048);
        });
      };

      playNextChord();
      const chordInterval = setInterval(playNextChord, 4600);
      cleanups.push(() => clearInterval(chordInterval));
    }

    this.activeSceneCleanup = () => {
      cleanups.forEach((fn) => fn());
    };
  }

  _playLoFiFeltNote(freq, delaySec = 0, durationSec = 1.6, peakGain = 0.12) {
    const ctx = this._ensureContext();
    if (!ctx || !this.cueBus) return;

    const start = ctx.currentTime + delaySec;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq, start);
    osc2.detune.setValueAtTime(5, start);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.24;

    const feltFilter = ctx.createBiquadFilter();
    feltFilter.type = 'lowpass';
    feltFilter.frequency.setValueAtTime(840, start);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peakGain, start + 0.05);
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
    bp.Q.value = 2.0;

    const g = ctx.createGain();
    if (direction === 'in') {
      bp.frequency.setValueAtTime(220, now);
      bp.frequency.exponentialRampToValueAtTime(620, now + Math.max(0.5, durationSec - 0.15));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.08, now + durationSec * 0.45);
      g.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    } else {
      bp.frequency.setValueAtTime(580, now);
      bp.frequency.exponentialRampToValueAtTime(150, now + Math.max(0.5, durationSec - 0.25));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.085, now + 0.6);
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
      this._playLoFiFeltNote(261.63, 0.0, 1.4, 0.12);  // C4
      this._playLoFiFeltNote(392.00, 0.24, 1.8, 0.13); // G4 (rising)
      this._playBreathAirGuide('in', 3.9);
    } else if (phase === 'hold') {
      this._playLoFiFeltNote(293.66, 0.0, 2.8, 0.09);  // D4
      this._playLoFiFeltNote(440.00, 0.04, 2.8, 0.09); // A4

      const midTimer = setTimeout(() => {
        if (!this.isRunning) return;
        this._playLoFiFeltNote(440.00, 0.0, 1.4, 0.05);
      }, 3500);
      this.activeCueTimeouts.push(midTimer);
    } else if (phase === 'exhale') {
      this._playLoFiFeltNote(329.63, 0.0, 1.5, 0.11);  // E4
      this._playLoFiFeltNote(261.63, 0.26, 1.8, 0.11); // C4
      this._playLoFiFeltNote(196.00, 0.54, 2.5, 0.12); // G3 (grounding)
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
    this.cancelPreviewTimeout();
    this.isRunning = false;
    this._stopBreathGuide();
    if (this.ctx && this.ambientGain) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setTargetAtTime(0.0001, now, 0.12);
      setTimeout(() => {
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
    this.isRunning = false;
    this._stopBreathGuide();
    this._stopCurrentScene();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
