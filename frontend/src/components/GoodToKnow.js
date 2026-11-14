import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../config';
import {
  LOFI_SOUNDSCAPES,
  pickRandomSoundscape,
  LoFiBreathingEngine,
} from '../utils/lofiBreathingAudio';
import './GoodToKnow.css';

const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];
const GRID_POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8]; // 8 outer cells around center fixation cross (index 4)
const STORAGE_KEY = 'speakling_dual_nback_stats_v1';

// Cache studio-quality neural letter audio (en-US-AriaNeural has full, non-whispered articulation for all 8 letters)
const NBACK_VOICE = 'en-US-AriaNeural';
const NBACK_AUDIO_CACHE = new Map();
const NBACK_BUFFER_CACHE = new Map();
const NBACK_PREFETCH_INFLIGHT = new Set();

const NOVELTY_VOICES_REGEX = /zarvox|trinoids|bells|bubbles|boing|cellos|deranged|good news|bad news|hysterical|whisper|albert|fred|junior|kathy|organ|princess|ralph|wobble|bahh|jester|superstar/i;

const pickCleanEnglishVoice = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const englishVoices = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith('en') && !NOVELTY_VOICES_REGEX.test(v.name || '')
  );
  if (englishVoices.length === 0) return null;

  const preferredNames = [
    'Google US English',
    'Samantha',
    'Daniel',
    'Karen',
    'Alex',
    'Ava',
    'Allison',
    'Microsoft Aria',
    'Microsoft Jenny',
    'Microsoft Guy',
    'Google UK English Female',
    'Google UK English Male',
  ];

  for (const name of preferredNames) {
    const match = englishVoices.find((v) => v.name && v.name.includes(name));
    if (match) return match;
  }

  return englishVoices.find((v) => v.lang.toLowerCase() === 'en-us') || englishVoices[0];
};

const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const decodeAndNormalizeLetterBuffer = async (ctx, letter, base64Data) => {
  if (!ctx || !base64Data) return null;
  const key = `${NBACK_VOICE}:${letter}`;
  if (NBACK_BUFFER_CACHE.has(key)) return NBACK_BUFFER_CACHE.get(key);

  try {
    const arrayBuf = base64ToArrayBuffer(base64Data);
    const audioBuffer = await ctx.decodeAudioData(arrayBuf);
    // Compute peak amplitude to normalize all 8 letters to uniform crisp loudness
    let maxPeak = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }
    const normGain = maxPeak > 0.02 ? Math.min(2.2, 0.85 / maxPeak) : 1.0;
    const entry = { buffer: audioBuffer, gain: normGain };
    NBACK_BUFFER_CACHE.set(key, entry);
    return entry;
  } catch (e) {
    return null;
  }
};

const fetchNBackLetterAudio = async (letter, audioCtx = null) => {
  const key = `${NBACK_VOICE}:${letter}`;
  if (NBACK_AUDIO_CACHE.has(key)) {
    if (audioCtx && !NBACK_BUFFER_CACHE.has(key)) {
      decodeAndNormalizeLetterBuffer(audioCtx, letter, NBACK_AUDIO_CACHE.get(key).base64);
    }
    return;
  }
  if (NBACK_PREFETCH_INFLIGHT.has(key)) return;
  NBACK_PREFETCH_INFLIGHT.add(key);

  try {
    let headers = getAuthHeaders({ 'Content-Type': 'application/json' });

    const res = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: letter.toUpperCase(), voice: NBACK_VOICE }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.audio_base64) {
        NBACK_AUDIO_CACHE.set(key, {
          base64: data.audio_base64,
          dataUri: `data:audio/mp3;base64,${data.audio_base64}`,
        });
        if (audioCtx) {
          decodeAndNormalizeLetterBuffer(audioCtx, letter, data.audio_base64);
        }
      }
    }
  } catch (e) {
    // fallback to browser speechSynthesis if offline
  } finally {
    NBACK_PREFETCH_INFLIGHT.delete(key);
  }
};

const loadStats = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: 0, bestScore: 0, maxLevelUnlocked: 2, history: [] };
    return JSON.parse(raw);
  } catch (e) {
    return { sessions: 0, bestScore: 0, maxLevelUnlocked: 2, history: [] };
  }
};

const saveStats = (stats) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // ignore storage errors
  }
};

/**
 * Generates a scientifically balanced Dual N-Back sequence of length (20 + N).
 * Ensures ~6 position matches and ~6 audio letter matches across the 20 evaluable trials.
 */
const generateNBackSequence = (nLevel, baseTrials = 20) => {
  const totalLength = baseTrials + nLevel;
  const seq = Array.from({ length: totalLength }, () => ({
    pos: GRID_POSITIONS[Math.floor(Math.random() * GRID_POSITIONS.length)],
    letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
    isPosMatch: false,
    isLetterMatch: false,
  }));

  const evaluableIndices = [];
  for (let i = nLevel; i < totalLength; i++) {
    evaluableIndices.push(i);
  }

  const pickRandomSubset = (arr, count) => {
    const copy = [...arr];
    const picked = new Set();
    while (picked.size < count && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.add(copy.splice(idx, 1)[0]);
    }
    return picked;
  };

  const targetCount = 6; // 30% of 20 trials
  const posMatchIndices = pickRandomSubset(evaluableIndices, targetCount);
  const letterMatchIndices = pickRandomSubset(evaluableIndices, targetCount);

  for (let i = nLevel; i < totalLength; i++) {
    const prev = seq[i - nLevel];

    if (posMatchIndices.has(i)) {
      seq[i].pos = prev.pos;
      seq[i].isPosMatch = true;
    } else {
      const otherPos = GRID_POSITIONS.filter((p) => p !== prev.pos);
      seq[i].pos = otherPos[Math.floor(Math.random() * otherPos.length)];
      seq[i].isPosMatch = false;
    }

    if (letterMatchIndices.has(i)) {
      seq[i].letter = prev.letter;
      seq[i].isLetterMatch = true;
    } else {
      const otherLetters = LETTERS.filter((l) => l !== prev.letter);
      seq[i].letter = otherLetters[Math.floor(Math.random() * otherLetters.length)];
      seq[i].isLetterMatch = false;
    }
  }

  return seq;
};

export const DualNBackGame = ({ onClose }) => {
  const [nLevel, setNLevel] = useState(2);
  const [stepDurationMs, setStepDurationMs] = useState(2500);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showLetterHint, setShowLetterHint] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [sequence, setSequence] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isFlashActive, setIsFlashActive] = useState(false);

  // User responses for the current step: null | 'hit' | 'false_alarm'
  const [posFeedback, setPosFeedback] = useState(null);
  const [letterFeedback, setLetterFeedback] = useState(null);

  // Cumulative round metrics
  const [roundResult, setRoundResult] = useState(null);
  const [stats, setStats] = useState(loadStats);

  // Refs for accurate synchronous tracking inside timers/key handlers
  const responsesRef = useRef({});
  const sequenceRef = useRef([]);
  const currentStepRef = useRef(-1);
  const isRunningRef = useRef(false);
  const nLevelRef = useRef(nLevel);
  const audioEnabledRef = useRef(audioEnabled);
  const stepTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const letterAudioRef = useRef(null);
  const speakTimeoutRef = useRef(null);
  const nbackAudioCtxRef = useRef(null);
  const activeSourceRef = useRef(null);
  const keepaliveOscRef = useRef(null);

  const ensureNBackAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!nbackAudioCtxRef.current || nbackAudioCtxRef.current.state === 'closed') {
      nbackAudioCtxRef.current = new AudioCtx();
    }
    if (nbackAudioCtxRef.current.state === 'suspended') {
      nbackAudioCtxRef.current.resume().catch(() => {});
    }
    return nbackAudioCtxRef.current;
  }, []);

  const startKeepalive = useCallback((ctx) => {
    if (!ctx || keepaliveOscRef.current) return;
    try {
      // Sub-audible -100dB signal keeps Bluetooth/CoreAudio active so letters never clip at the start
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 30;
      gain.gain.value = 0.00001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      keepaliveOscRef.current = osc;
    } catch (e) {}
  }, []);

  const stopKeepalive = useCallback(() => {
    if (keepaliveOscRef.current) {
      try {
        keepaliveOscRef.current.stop();
        keepaliveOscRef.current.disconnect();
      } catch (e) {}
      keepaliveOscRef.current = null;
    }
  }, []);

  useEffect(() => {
    nLevelRef.current = nLevel;
  }, [nLevel]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Preload crystal-clear neural voice audio for all 8 Dual N-Back letters
  useEffect(() => {
    LETTERS.forEach((ltr) => {
      fetchNBackLetterAudio(ltr, nbackAudioCtxRef.current);
    });
  }, []);

  const stopLetterAudio = useCallback(() => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch (e) {}
      activeSourceRef.current = null;
    }
    if (letterAudioRef.current) {
      try {
        letterAudioRef.current.pause();
        letterAudioRef.current.currentTime = 0;
      } catch (e) {}
      letterAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}
    }
  }, []);

  const speakLetter = useCallback((letter) => {
    if (!audioEnabledRef.current || typeof window === 'undefined') {
      return;
    }
    stopLetterAudio();

    const key = `${NBACK_VOICE}:${letter}`;
    const ctx = ensureNBackAudioContext();
    const normEntry = NBACK_BUFFER_CACHE.get(key);

    // 1) Best path: Peak-normalized decoded PCM via kept-warm AudioContext (zero startup clipping)
    if (ctx && normEntry && normEntry.buffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = normEntry.buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = normEntry.gain;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        activeSourceRef.current = source;
        return;
      } catch (e) {}
    }

    // 2) Second path: Cached MP3 data URI (while decoding buffer for next use)
    const cachedObj = NBACK_AUDIO_CACHE.get(key);
    if (cachedObj && cachedObj.dataUri) {
      if (ctx && cachedObj.base64) {
        decodeAndNormalizeLetterBuffer(ctx, letter, cachedObj.base64);
      }
      try {
        const audio = new Audio(cachedObj.dataUri);
        letterAudioRef.current = audio;
        audio.play().catch(() => {});
        return;
      } catch (e) {}
    } else {
      fetchNBackLetterAudio(letter, ctx);
    }

    // 3) Offline fallback: OS speechSynthesis
    if (!('speechSynthesis' in window)) return;
    const triggerFallbackSpeech = () => {
      if (!isRunningRef.current || !audioEnabledRef.current) return;
      try {
        const utterance = new SpeechSynthesisUtterance(letter.toUpperCase());
        const cleanVoice = pickCleanEnglishVoice();
        if (cleanVoice) utterance.voice = cleanVoice;
        utterance.lang = cleanVoice?.lang || 'en-US';
        utterance.rate = 0.98;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    };

    speakTimeoutRef.current = setTimeout(triggerFallbackSpeech, 25);
  }, [ensureNBackAudioContext, stopLetterAudio]);

  const clearTimers = useCallback(() => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  }, []);

  const finishRound = useCallback(() => {
    clearTimers();
    stopKeepalive();
    isRunningRef.current = false;
    setIsRunning(false);
    setIsFlashActive(false);

    const seq = sequenceRef.current;
    const n = nLevelRef.current;
    const resp = responsesRef.current;

    let posHits = 0;
    let posMisses = 0;
    let posFalseAlarms = 0;

    let letterHits = 0;
    let letterMisses = 0;
    let letterFalseAlarms = 0;

    for (let i = n; i < seq.length; i++) {
      const item = seq[i];
      const userResp = resp[i] || { posPressed: false, letterPressed: false };

      if (item.isPosMatch) {
        if (userResp.posPressed) posHits++;
        else posMisses++;
      } else if (userResp.posPressed) {
        posFalseAlarms++;
      }

      if (item.isLetterMatch) {
        if (userResp.letterPressed) letterHits++;
        else letterMisses++;
      } else if (userResp.letterPressed) {
        letterFalseAlarms++;
      }
    }

    const posDenom = posHits + posMisses + posFalseAlarms;
    const letterDenom = letterHits + letterMisses + letterFalseAlarms;

    const posAccuracy = posDenom > 0 ? Math.round((posHits / posDenom) * 100) : 100;
    const letterAccuracy = letterDenom > 0 ? Math.round((letterHits / letterDenom) * 100) : 100;
    const totalAccuracy = Math.round((posAccuracy + letterAccuracy) / 2);

    const summary = {
      nLevel: n,
      totalAccuracy,
      posAccuracy,
      letterAccuracy,
      posHits,
      posMisses,
      posFalseAlarms,
      letterHits,
      letterMisses,
      letterFalseAlarms,
      timestamp: new Date().toISOString(),
    };

    setRoundResult(summary);

    setStats((prev) => {
      const updated = {
        sessions: (prev.sessions || 0) + 1,
        bestScore: Math.max(prev.bestScore || 0, totalAccuracy),
        maxLevelUnlocked:
          totalAccuracy >= 80
            ? Math.max(prev.maxLevelUnlocked || 2, Math.min(6, n + 1))
            : prev.maxLevelUnlocked || 2,
        history: [summary, ...(prev.history || [])].slice(0, 10),
      };
      saveStats(updated);
      return updated;
    });
  }, [clearTimers, stopKeepalive]);

  const runStep = useCallback(
    (stepIdx) => {
      const seq = sequenceRef.current;
      if (!isRunningRef.current || stepIdx >= seq.length) {
        finishRound();
        return;
      }

      currentStepRef.current = stepIdx;
      setCurrentStep(stepIdx);
      setPosFeedback(null);
      setLetterFeedback(null);
      setIsFlashActive(true);

      const currentItem = seq[stepIdx];
      speakLetter(currentItem.letter);

      const flashDuration = Math.min(950, Math.floor(stepDurationMs * 0.45));
      flashTimerRef.current = setTimeout(() => {
        setIsFlashActive(false);
      }, flashDuration);

      stepTimerRef.current = setTimeout(() => {
        runStep(stepIdx + 1);
      }, stepDurationMs);
    },
    [finishRound, speakLetter, stepDurationMs]
  );

  const startGame = () => {
    clearTimers();
    const ctx = ensureNBackAudioContext();
    if (ctx) {
      startKeepalive(ctx);
      LETTERS.forEach((ltr) => {
        const cached = NBACK_AUDIO_CACHE.get(`${NBACK_VOICE}:${ltr}`);
        if (cached && cached.base64) {
          decodeAndNormalizeLetterBuffer(ctx, ltr, cached.base64);
        } else {
          fetchNBackLetterAudio(ltr, ctx);
        }
      });
    }

    const newSeq = generateNBackSequence(nLevel, 20);
    sequenceRef.current = newSeq;
    responsesRef.current = {};
    currentStepRef.current = -1;
    isRunningRef.current = true;

    setSequence(newSeq);
    setRoundResult(null);
    setIsRunning(true);
    setCurrentStep(0);

    runStep(0);
  };

  const stopGame = useCallback(() => {
    clearTimers();
    stopLetterAudio();
    stopKeepalive();
    isRunningRef.current = false;
    setIsRunning(false);
    setIsFlashActive(false);
    setCurrentStep(-1);
    setPosFeedback(null);
    setLetterFeedback(null);
  }, [clearTimers, stopKeepalive, stopLetterAudio]);

  useEffect(() => {
    return () => {
      clearTimers();
      stopLetterAudio();
      stopKeepalive();
      if (nbackAudioCtxRef.current && nbackAudioCtxRef.current.state !== 'closed') {
        nbackAudioCtxRef.current.close().catch(() => {});
        nbackAudioCtxRef.current = null;
      }
    };
  }, [clearTimers, stopKeepalive, stopLetterAudio]);

  const handleUserResponse = useCallback((type) => {
    if (!isRunningRef.current) return;
    const stepIdx = currentStepRef.current;
    const n = nLevelRef.current;
    const seq = sequenceRef.current;

    if (stepIdx < n || stepIdx >= seq.length) return;

    const currentItem = seq[stepIdx];
    const existing = responsesRef.current[stepIdx] || {
      posPressed: false,
      letterPressed: false,
    };

    if (type === 'pos' && !existing.posPressed) {
      existing.posPressed = true;
      responsesRef.current[stepIdx] = existing;
      setPosFeedback(currentItem.isPosMatch ? 'hit' : 'false_alarm');
    } else if (type === 'letter' && !existing.letterPressed) {
      existing.letterPressed = true;
      responsesRef.current[stepIdx] = existing;
      setLetterFeedback(currentItem.isLetterMatch ? 'hit' : 'false_alarm');
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        stopGame();
        onClose();
        return;
      }
      if (!isRunningRef.current) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleUserResponse('pos');
      } else if (key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleUserResponse('letter');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUserResponse, onClose, stopGame]);

  const activeItem =
    isRunning && currentStep >= 0 && currentStep < sequence.length
      ? sequence[currentStep]
      : null;

  const totalSteps = sequence.length || 20 + nLevel;
  const canRespond = isRunning && currentStep >= nLevel;
  const progressPercent =
    isRunning && currentStep >= 0
      ? Math.min(100, Math.round(((currentStep + 1) / totalSteps) * 100))
      : 0;

  return (
    <div className="nback-card nback-modal-card">
      <div className="nback-top-row">
        <div className="nback-title-group">
          <div className="nback-badge-row">
            <span className="nback-mono-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              TRENING PAMIĘCI ROBOCZEJ (dlPFC)
            </span>
            <span className="nback-stat-pill">Sesje: {stats.sessions}</span>
            <span className="nback-stat-pill">Rekord: {stats.bestScore}%</span>
          </div>
          <h3>N-Back (Dual N-Back)</h3>
          <p className="nback-scientific-desc">
            Darmowa aplikacja/gra naukowa trenująca fizyczną pojemność bufora pamięci roboczej (śledzenie pozycji kwadratu na siatce i jednoczesne zapamiętywanie liter sprzed <strong>N kroków</strong>). Udowodniono, że regularny trening N-Back zwiększa gęstość receptorów dopaminowych w <strong>dlPFC</strong>.
          </p>
        </div>

        <div className="nback-header-actions">
          <button
            type="button"
            className="nback-help-toggle"
            onClick={() => setShowInstructions((prev) => !prev)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {showInstructions ? 'Ukryj instrukcję' : 'Jak grać?'}
          </button>

          {onClose && (
            <button
              type="button"
              className="nback-modal-close-btn"
              onClick={() => {
                stopGame();
                onClose();
              }}
              title="Zamknij (Esc)"
              aria-label="Zamknij modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showInstructions && (
        <div className="nback-instructions-panel">
          <div className="nback-instruction-step">
            <span className="nback-step-num">1</span>
            <div>
              <strong>Obserwuj i słuchaj:</strong> Co {stepDurationMs / 1000}s na siatce 3×3 podświetla się jeden kwadrat oraz wypowiadana jest angielska litera.
            </div>
          </div>
          <div className="nback-instruction-step">
            <span className="nback-step-num">2</span>
            <div>
              <strong>Porównuj z krokiem N wstecz:</strong> Dla poziomu <strong>{nLevel}-Back</strong> porównujesz obecny bodziec z tym, który pojawił się dokładnie <strong>{nLevel} {nLevel === 1 ? 'krok' : 'kroki'} temu</strong>.
            </div>
          </div>
          <div className="nback-instruction-step">
            <span className="nback-step-num">3</span>
            <div>
              <strong>Reaguj:</strong> Naciśnij <strong>Pozycja [A]</strong> jeśli kwadrat zapalił się w tym samym miejscu co {nLevel} {nLevel === 1 ? 'krok' : 'kroki'} temu, lub <strong>Litera [L]</strong> jeśli usłyszałeś tę samą literę. Możesz nacisnąć oba!
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="nback-toolbar">
        <div className="nback-control-group">
          <span className="nback-control-label">Poziom N:</span>
          <div className="nback-segmented">
            {[1, 2, 3, 4].map((lvl) => (
              <button
                key={lvl}
                type="button"
                disabled={isRunning}
                className={`nback-seg-btn ${nLevel === lvl ? 'active' : ''}`}
                onClick={() => setNLevel(lvl)}
              >
                {lvl}-Back
              </button>
            ))}
          </div>
        </div>

        <div className="nback-control-group">
          <span className="nback-control-label">Tempo:</span>
          <div className="nback-segmented">
            {[
              { label: '2.0s', val: 2000 },
              { label: '2.5s', val: 2500 },
              { label: '3.0s', val: 3000 },
            ].map((t) => (
              <button
                key={t.val}
                type="button"
                disabled={isRunning}
                className={`nback-seg-btn ${stepDurationMs === t.val ? 'active' : ''}`}
                onClick={() => setStepDurationMs(t.val)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="nback-control-group nback-toggles">
          <button
            type="button"
            className={`nback-icon-chip ${audioEnabled ? 'active' : ''}`}
            onClick={() => setAudioEnabled((prev) => !prev)}
            title="Dźwięk lektora (Web Speech EN)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {audioEnabled ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              )}
            </svg>
            <span>Audio {audioEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            className={`nback-icon-chip ${showLetterHint ? 'active' : ''}`}
            onClick={() => setShowLetterHint((prev) => !prev)}
            title="Pokazuj literę na środku siatki"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
            <span>Litera {showLetterHint ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Arena */}
      <div className="nback-arena">
        <div className="nback-status-strip">
          <div className="nback-step-counter">
            {isRunning ? (
              <>
                <span className="nback-live-dot" />
                <span>
                  Krok <strong>{currentStep + 1}</strong> z {totalSteps}
                </span>
                {currentStep < nLevel && (
                  <span className="nback-warmup-tag">
                    Buforowanie pierwszych {nLevel} {nLevel === 1 ? 'kroku' : 'kroków'}...
                  </span>
                )}
              </>
            ) : (
              <span>Gotowy do sesji Dual {nLevel}-Back ({20 + nLevel} kroków)</span>
            )}
          </div>
          <div className="nback-progress-track">
            <div className="nback-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* 3x3 Spatial Grid */}
        <div className="nback-grid" role="grid" aria-label="Siatka 3 na 3 Dual N-Back">
          {Array.from({ length: 9 }).map((_, idx) => {
            const isCenter = idx === 4;
            const isHighlighted = isRunning && isFlashActive && activeItem && activeItem.pos === idx;

            return (
              <div
                key={idx}
                className={`nback-cell ${isCenter ? 'center-cell' : ''} ${
                  isHighlighted ? 'active' : ''
                }`}
              >
                {isCenter && (
                  <div className="nback-center-indicator">
                    {isRunning && isFlashActive && activeItem && showLetterHint ? (
                      <span className="nback-center-letter">{activeItem.letter}</span>
                    ) : (
                      <span className="nback-crosshair">+</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Response Controls */}
        <div className="nback-actions-row">
          <button
            type="button"
            disabled={!canRespond}
            className={`nback-match-btn ${posFeedback ? `feedback-${posFeedback}` : ''}`}
            onClick={() => handleUserResponse('pos')}
          >
            <div className="nback-match-btn-top">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="7" y="7" width="4" height="4" fill="currentColor" />
              </svg>
              <span>Pozycja</span>
              <kbd className="nback-kbd">A</kbd>
            </div>
            <span className="nback-match-sub">
              {posFeedback === 'hit'
                ? 'Trafienie!'
                : posFeedback === 'false_alarm'
                ? 'Pomyłka'
                : `Taka sama pozycja co ${nLevel} wstecz`}
            </span>
          </button>

          {!isRunning ? (
            <button type="button" className="nback-primary-btn" onClick={startGame}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              <span>Start Dual {nLevel}-Back</span>
            </button>
          ) : (
            <button type="button" className="nback-stop-btn" onClick={stopGame}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>Zatrzymaj</span>
            </button>
          )}

          <button
            type="button"
            disabled={!canRespond}
            className={`nback-match-btn ${letterFeedback ? `feedback-${letterFeedback}` : ''}`}
            onClick={() => handleUserResponse('letter')}
          >
            <div className="nback-match-btn-top">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span>Litera / Dźwięk</span>
              <kbd className="nback-kbd">L</kbd>
            </div>
            <span className="nback-match-sub">
              {letterFeedback === 'hit'
                ? 'Trafienie!'
                : letterFeedback === 'false_alarm'
                ? 'Pomyłka'
                : `Taka sama litera co ${nLevel} wstecz`}
            </span>
          </button>
        </div>
      </div>

      {/* Round Result Summary */}
      {roundResult && !isRunning && (
        <div className="nback-results-box">
          <div className="nback-results-header">
            <div>
              <span className="nback-results-eyebrow">WYNIK SESJI DUAL {roundResult.nLevel}-BACK</span>
              <h4>Skuteczność całkowita: {roundResult.totalAccuracy}%</h4>
            </div>
            <div className="nback-recommendation-pill">
              {roundResult.totalAccuracy >= 80
                ? `Świetny wynik! Twój bufor jest gotowy na poziom ${Math.min(4, roundResult.nLevel + 1)}-Back.`
                : roundResult.totalAccuracy >= 50
                ? `Optymalna strefa neuroplastyczności. Kontynuuj poziom ${roundResult.nLevel}-Back.`
                : `Zalecana rozgrzewka na poziomie ${Math.max(1, roundResult.nLevel - 1)}-Back.`}
            </div>
          </div>

          <div className="nback-results-grid">
            <div className="nback-metric-card">
              <div className="nback-metric-top">
                <span>Pamięć przestrzenna (Pozycja)</span>
                <strong>{roundResult.posAccuracy}%</strong>
              </div>
              <div className="nback-metric-details">
                <span>Trafienia: <strong>{roundResult.posHits}</strong></span>
                <span>Pominięcia: <strong>{roundResult.posMisses}</strong></span>
                <span>Błędy: <strong>{roundResult.posFalseAlarms}</strong></span>
              </div>
            </div>

            <div className="nback-metric-card">
              <div className="nback-metric-top">
                <span>Pamięć fonologiczna (Litery EN)</span>
                <strong>{roundResult.letterAccuracy}%</strong>
              </div>
              <div className="nback-metric-details">
                <span>Trafienia: <strong>{roundResult.letterHits}</strong></span>
                <span>Pominięcia: <strong>{roundResult.letterMisses}</strong></span>
                <span>Błędy: <strong>{roundResult.letterFalseAlarms}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DualNBackModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="nback-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="nback-modal-dialog" role="dialog" aria-modal="true" aria-label="Gra naukowa Dual N-Back">
        <DualNBackGame onClose={onClose} />
      </div>
    </div>
  );
};

const BREATHING_PHASES = {
  inhale: { durationSec: 4, next: 'hold' },
  hold: { durationSec: 7, next: 'exhale' },
  exhale: { durationSec: 8, next: 'inhale' },
};

const formatSessionTime = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BreathingExercise = ({ onClose }) => {
  const [phase, setPhase] = useState('idle'); // idle, inhale, hold, exhale
  const [timeLeft, setTimeLeft] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [soundscape, setSoundscape] = useState(() => pickRandomSoundscape());
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const [cueVolume, setCueVolume] = useState(0.45);
  const [sessionMinutes, setSessionMinutes] = useState(3);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [isFinishingCycle, setIsFinishingCycle] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const audioEngineRef = useRef(null);
  const phaseEndAtRef = useRef(0);
  const sessionStartAtRef = useRef(0);
  const sessionEndAtRef = useRef(0);
  const currentPhaseRef = useRef('idle');

  const getAudioEngine = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new LoFiBreathingEngine();
    }
    return audioEngineRef.current;
  }, []);

  // Cleanup Web Audio engine when widget/modal unmounts
  useEffect(() => {
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.destroy();
        audioEngineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        currentPhaseRef.current = 'idle';
        audioEngineRef.current?.stopAll();
        setPhase('idle');
        setTimeLeft(0);
        setSessionTimeLeft(0);
        setIsFinishingCycle(false);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Drift-free 4-7-8 phase & session scheduler anchored to monotonic performance.now()
  const isExerciseRunning = phase !== 'idle';
  useEffect(() => {
    if (!isExerciseRunning) return;

    const tick = () => {
      if (currentPhaseRef.current === 'idle') return;
      const now = performance.now();
      const sessionRemainingMs = sessionEndAtRef.current - now;
      const finishingNow = sessionRemainingMs <= 0;

      const nextSessionSec = Math.max(0, Math.ceil(sessionRemainingMs / 1000));
      setSessionTimeLeft((prev) => (prev !== nextSessionSec ? nextSessionSec : prev));
      setIsFinishingCycle((prev) => (prev !== finishingNow ? finishingNow : prev));

      const remainingMs = phaseEndAtRef.current - now;

      if (remainingMs <= 0) {
        const current = currentPhaseRef.current;
        const spec = BREATHING_PHASES[current];
        if (!spec) return;

        if (current === 'exhale') {
          setCycles((c) => c + 1);
          // When target duration has elapsed, always finish the active cycle before ending
          if (finishingNow) {
            currentPhaseRef.current = 'idle';
            audioEngineRef.current?.stopAll();
            setPhase('idle');
            setTimeLeft(0);
            setSessionTimeLeft(0);
            setIsFinishingCycle(false);
            setSessionCompleted(true);
            return;
          }
        }

        const nextPhase = spec.next;
        const nextDuration = BREATHING_PHASES[nextPhase].durationSec;
        // Compensate overshoot so long breathing sessions stay locked to exact 4-7-8 cadence
        phaseEndAtRef.current = now + nextDuration * 1000 + Math.max(-250, remainingMs);
        currentPhaseRef.current = nextPhase;

        setPhase(nextPhase);
        setTimeLeft(nextDuration);
        audioEngineRef.current?.playPhaseCue(nextPhase);
      } else {
        const nextSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
        setTimeLeft((prev) => (prev !== nextSeconds ? nextSeconds : prev));
      }
    };

    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [isExerciseRunning]);

  // Keep mute and volume synchronized
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    engine.setVolume(volume);
    engine.setCueVolume(cueVolume);
    engine.setMuted(isMuted);
  }, [volume, cueVolume, isMuted]);

  const selectSoundscape = (nextScene) => {
    setSoundscape(nextScene);
    const engine = getAudioEngine();
    engine.setVolume(volume);
    engine.setCueVolume(cueVolume);
    engine.setMuted(isMuted);
    if (phase !== 'idle') {
      engine.cancelPreviewTimeout();
      engine.startAmbience(nextScene.id);
    } else if (!isMuted) {
      engine.previewAmbience(nextScene.id, 5500);
    }
  };

  const randomizeSoundscape = () => {
    const nextScene = pickRandomSoundscape(soundscape.id);
    selectSoundscape(nextScene);
  };

  const toggleExercise = () => {
    const engine = getAudioEngine();
    if (phase === 'idle') {
      const activeScene = soundscape || pickRandomSoundscape();
      const initialDuration = BREATHING_PHASES.inhale.durationSec;
      const now = performance.now();
      engine.cancelPreviewTimeout();
      engine.setVolume(volume);
      engine.setCueVolume(cueVolume);
      engine.setMuted(isMuted);
      engine.startAmbience(activeScene.id);
      phaseEndAtRef.current = now + initialDuration * 1000;
      sessionStartAtRef.current = now;
      sessionEndAtRef.current = now + sessionMinutes * 60 * 1000;
      currentPhaseRef.current = 'inhale';
      setSessionCompleted(false);
      setIsFinishingCycle(false);
      setSessionTimeLeft(sessionMinutes * 60);
      setCycles(0);
      setPhase('inhale');
      setTimeLeft(initialDuration);
      engine.playPhaseCue('inhale');
    } else {
      currentPhaseRef.current = 'idle';
      engine.stopAll();
      setPhase('idle');
      setTimeLeft(0);
      setSessionTimeLeft(0);
      setIsFinishingCycle(false);
    }
  };

  const getPhaseText = () => {
    if (phase === 'idle') return 'Start 4-7-8';
    if (phase === 'inhale') return 'Wdech (4s)';
    if (phase === 'hold') return 'Zatrzymaj (7s)';
    if (phase === 'exhale') return 'Wydech (8s)';
  };

  return (
    <div className="breathing-widget breathing-modal-card">
      <div className="breathing-modal-header">
        <span className="nback-mono-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          PARASYMPATYCZNY RESET UKŁADU NERWOWEGO
        </span>
        {onClose && (
          <button
            type="button"
            className="nback-modal-close-btn"
            onClick={() => {
              currentPhaseRef.current = 'idle';
              audioEngineRef.current?.stopAll();
              setPhase('idle');
              setTimeLeft(0);
              setSessionTimeLeft(0);
              setIsFinishingCycle(false);
              onClose();
            }}
            title="Zamknij (Esc)"
            aria-label="Zamknij modal ćwiczenia oddechowego"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <h4>Ćwiczenie Oddechowe (4-7-8)</h4>
      <p className="breathing-hint">
        Zamknij oczy i podążaj za kojącymi dźwiękami lo-fi. Każda faza ma swój unikalny sygnał dźwiękowy, więc nie musisz patrzeć w ekran.
      </p>

      {/* Lo-Fi Soundscape Panel */}
      <div className="breathing-lofi-panel">
        <div className="breathing-lofi-top">
          <div className="breathing-lofi-active">
            <span className="breathing-lofi-icon" aria-hidden="true">{soundscape.icon}</span>
            <div className="breathing-lofi-meta">
              <span className="breathing-lofi-title">{soundscape.label} <span className="breathing-lofi-tag">LO-FI</span></span>
              <span className="breathing-lofi-desc">{soundscape.description}</span>
            </div>
          </div>
          <div className="breathing-lofi-controls">
            <button
              type="button"
              className="breathing-lofi-btn"
              onClick={randomizeSoundscape}
              title="Wylosuj inną scenerię dźwiękową"
            >
              🎲 Losuj
            </button>
            <button
              type="button"
              className={`breathing-lofi-btn ${isMuted ? 'is-muted' : ''}`}
              onClick={() => setIsMuted((m) => !m)}
              title={isMuted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
              aria-label={isMuted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        <div className="breathing-lofi-scenes" role="group" aria-label="Wybór dźwięków tła lo-fi">
          {LOFI_SOUNDSCAPES.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={`breathing-scene-pill ${soundscape.id === scene.id ? 'active' : ''}`}
              onClick={() => selectSoundscape(scene)}
            >
              <span>{scene.icon}</span>
              <span>{scene.label}</span>
            </button>
          ))}
        </div>

        <div className="breathing-lofi-sliders">
          <div className="breathing-sliders-row">
            <div className="breathing-slider-group">
              <div className="breathing-slider-header">
                <span className="breathing-volume-label">Głośność efektów</span>
                <span className="breathing-slider-value">
                  {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setIsMuted(false);
                  setVolume(val);
                }}
                className="breathing-volume-slider"
                aria-label="Głośność efektów dźwiękowych tła"
              />
            </div>

            <div className="breathing-slider-group">
              <div className="breathing-slider-header">
                <span className="breathing-volume-label">Dźwięki fazy</span>
                <span className="breathing-slider-value">
                  {Math.round(cueVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={cueVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCueVolume(val);
                  const engine = getAudioEngine();
                  engine.setCueVolume(val);
                }}
                className="breathing-volume-slider"
                aria-label="Głośność dźwięków zmiany fazy oddechu"
              />
            </div>
          </div>

          <div className="breathing-sliders-row breathing-sliders-row-session">
            <div className="breathing-slider-group">
              <div className="breathing-slider-header">
                <span className="breathing-volume-label">Długość sesji</span>
                <span className="breathing-slider-value">
                  {phase !== 'idle'
                    ? (isFinishingCycle ? 'Ostatni cykl' : `${formatSessionTime(sessionTimeLeft)} / ${sessionMinutes} min`)
                    : `${sessionMinutes} min`}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={sessionMinutes}
                onChange={(e) => {
                  const nextMin = parseInt(e.target.value, 10);
                  setSessionMinutes(nextMin);
                  if (phase !== 'idle') {
                    const nextEndAt = sessionStartAtRef.current + nextMin * 60 * 1000;
                    sessionEndAtRef.current = nextEndAt;
                    const remMs = nextEndAt - performance.now();
                    setIsFinishingCycle(remMs <= 0);
                    setSessionTimeLeft(Math.max(0, Math.ceil(remMs / 1000)));
                  }
                }}
                className="breathing-volume-slider"
                aria-label="Długość sesji oddechowej w minutach"
              />
            </div>
          </div>
        </div>

        {(cycles > 0 || sessionCompleted || isFinishingCycle) && (
          <div className="breathing-session-status-row">
            {isFinishingCycle && (
              <span className="breathing-cycles-badge">Dokańczanie cyklu...</span>
            )}
            {sessionCompleted && (
              <span className="breathing-cycles-badge is-completed">✓ Sesja ukończona</span>
            )}
            {cycles > 0 && (
              <span className="breathing-cycles-badge">Cykle: {cycles}</span>
            )}
          </div>
        )}
      </div>

      <div className="breathing-circle-container">
        <div className={`breathing-circle ${phase}`} onClick={toggleExercise}>
          <span className="breathing-text">{getPhaseText()}</span>
          {phase !== 'idle' && <span className="breathing-timer">{timeLeft}s</span>}
        </div>
      </div>

      {/* Screen-free Audio Phase Legend */}
      <div className="breathing-audio-legend">
        <div className={`breathing-legend-item ${phase === 'inhale' ? 'is-current' : ''}`}>
          <span className="legend-arrow">↗</span>
          <div>
            <strong>Wdech 4s</strong>
            <span>rosnący akord</span>
          </div>
        </div>
        <div className={`breathing-legend-item ${phase === 'hold' ? 'is-current' : ''}`}>
          <span className="legend-arrow">⏸</span>
          <div>
            <strong>Pauza 7s</strong>
            <span>ciepły gong</span>
          </div>
        </div>
        <div className={`breathing-legend-item ${phase === 'exhale' ? 'is-current' : ''}`}>
          <span className="legend-arrow">↘</span>
          <div>
            <strong>Wydech 8s</strong>
            <span>opadający akord</span>
          </div>
        </div>
      </div>

      <button className={`btn-breathing ${phase !== 'idle' ? 'active' : ''}`} onClick={toggleExercise}>
        {phase === 'idle' ? 'Rozpocznij relaks z Lo-Fi' : 'Zakończ ćwiczenie'}
      </button>
    </div>
  );
};

export const BreathingModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="nback-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="nback-modal-dialog breathing-modal-dialog" role="dialog" aria-modal="true" aria-label="Ćwiczenie Oddechowe 4-7-8">
        <BreathingExercise onClose={onClose} />
      </div>
    </div>
  );
};

const PHONEMIC_LETTERS = ['K', 'S', 'P', 'M', 'B', 'T', 'C', 'R', 'D', 'W', 'F', 'L'];
const PHONEMIC_STORAGE_KEY = 'speakling_phonemic_fluency_v1';

// Speech Recognition support check
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// Normalize stem / plural to eliminate duplicate forms (e.g. cat vs cats, drill vs drilling)
const normalizeStem = (word) => {
  if (!word) return '';
  let w = word.toLowerCase().trim();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 4 && (w.endsWith('shes') || w.endsWith('ches') || w.endsWith('xes') || w.endsWith('sses'))) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ami') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ach') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ów') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('om') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('y') && w.length > 4) return w.slice(0, -1);
  if (w.endsWith('i') && w.length > 4) return w.slice(0, -1);
  if (w.endsWith('e') && w.length > 4) return w.slice(0, -1);
  return w;
};

// Acoustic feedback chime (Web Audio API)
const playChime = (type = 'success') => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'duplicate') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(260, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch (e) {
    // audio context restrictions
  }
};

const COMMON_SEMANTIC_WORDS = {
  tools: new Set(['hammer', 'drill', 'screwdriver', 'wrench', 'saw', 'pliers', 'axe', 'chisel', 'level', 'tape measure', 'sander', 'vise', 'nail', 'screw', 'bolt', 'spanner', 'file', 'plane', 'crowbar', 'młotek', 'wiertarka', 'śrubokręt', 'piła', 'klucz', 'kombinerki', 'szczypce', 'siekiera', 'dłuto', 'poziomica', 'imadło', 'pilnik', 'strug', 'gwóźdź', 'śruba', 'wkrętarka', 'szlifierka', 'cęgi', 'lutownica', 'miarka']),
  trees: new Set(['oak', 'pine', 'birch', 'maple', 'willow', 'spruce', 'beech', 'elm', 'ash', 'poplar', 'cedar', 'fir', 'chestnut', 'linden', 'palm', 'cactus', 'fern', 'rose', 'tulip', 'daisy', 'dąb', 'sosna', 'brzoza', 'klon', 'wierzba', 'świerk', 'buk', 'wiąz', 'jesion', 'topola', 'cedr', 'jodła', 'kasztan', 'lipa', 'palma', 'paproć', 'róża', 'tulipan', 'modrzew', 'olcha', 'jarzębina', 'kaktus', 'orchidea', 'fiołek']),
  africa: new Set(['lion', 'giraffe', 'zebra', 'elephant', 'cheetah', 'leopard', 'rhino', 'hippo', 'hyena', 'buffalo', 'antelope', 'gorilla', 'chimpanzee', 'baboon', 'ostrich', 'warthog', 'crocodile', 'meerkat', 'gazelle', 'lew', 'żyrafa', 'zebra', 'słoń', 'gepard', 'lampart', 'nosorożec', 'hipopotam', 'hiena', 'bawół', 'antylopa', 'goryl', 'szympans', 'pawian', 'struś', 'guziec', 'krokodyl', 'surykatka', 'gazela', 'kobra', 'flaming']),
  kitchen: new Set(['pan', 'pot', 'knife', 'fork', 'spoon', 'kettle', 'blender', 'toaster', 'microwave', 'fridge', 'oven', 'stove', 'plate', 'bowl', 'cup', 'mug', 'glass', 'cutting board', 'spatula', 'whisk', 'colander', 'garnek', 'patelnia', 'nóż', 'widelec', 'łyżka', 'czajnik', 'blender', 'toster', 'mikrofalówka', 'lodówka', 'piekarnik', 'kuchenka', 'talerz', 'miska', 'kubek', 'filiżanka', 'szklanka', 'deska', 'łopatka', 'trzepaczka', 'durszlak', 'chlebak']),
  transport: new Set(['car', 'bus', 'train', 'plane', 'bicycle', 'bike', 'motorcycle', 'boat', 'ship', 'tram', 'subway', 'metro', 'helicopter', 'ferry', 'truck', 'scooter', 'taxi', 'van', 'samochód', 'auto', 'autobus', 'pociąg', 'samolot', 'rower', 'motocykl', 'łódź', 'statek', 'tramwaj', 'metro', 'helikopter', 'śmigłowiec', 'prom', 'ciężarówka', 'hulajnoga', 'taksówka', 'furgonetka']),
  jobs: new Set(['doctor', 'teacher', 'engineer', 'lawyer', 'nurse', 'chef', 'cook', 'pilot', 'architect', 'artist', 'driver', 'police officer', 'firefighter', 'dentist', 'programmer', 'accountant', 'scientist', 'mechanic', 'lekarz', 'nauczyciel', 'inżynier', 'prawnik', 'pielęgniarka', 'kucharz', 'szef kuchni', 'pilot', 'architekt', 'artysta', 'kierowca', 'policjant', 'strażak', 'dentysta', 'programista', 'księgowy', 'naukowiec', 'mechanik', 'aktor', 'pisarz']),
  fruits: new Set(['apple', 'banana', 'orange', 'strawberry', 'carrot', 'potato', 'tomato', 'cucumber', 'grape', 'peach', 'plum', 'pear', 'lemon', 'watermelon', 'onion', 'garlic', 'broccoli', 'pepper', 'cabbage', 'jabłko', 'banan', 'pomarańcza', 'truskawka', 'marchew', 'marchewka', 'ziemniak', 'pomidor', 'ogórek', 'winogrono', 'brzoskwinia', 'śliwka', 'gruszka', 'cytryna', 'arbuz', 'cebula', 'czosnek', 'brokuł', 'papryka', 'kapusta', 'malina', 'jagoda', 'borówka']),
  office: new Set(['desk', 'chair', 'computer', 'laptop', 'monitor', 'keyboard', 'mouse', 'printer', 'stapler', 'paper', 'pen', 'pencil', 'notebook', 'folder', 'binder', 'scissors', 'tape', 'envelope', 'calendar', 'biurko', 'krzesło', 'fotel', 'komputer', 'laptop', 'monitor', 'klawiatura', 'myszka', 'drukarka', 'zszywacz', 'papier', 'długopis', 'ołówek', 'zeszyt', 'notatnik', 'segregator', 'nożyczki', 'taśma', 'koperta', 'kalendarz', 'teczka'])
};

export const PhonemicFluencyGame = ({ onClose }) => {
  const [selectedLetter, setSelectedLetter] = useState('K');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [wordsList, setWordsList] = useState([]);
  const [rejectedWords, setRejectedWords] = useState([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [wordInput, setWordInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [roundFinished, setRoundFinished] = useState(false);
  const [bestScore, setBestScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem(PHONEMIC_STORAGE_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  });

  // Speech Recognition state
  const [isMicActive, setIsMicActive] = useState(true);
  const [speechLang, setSpeechLang] = useState('en-US'); // 'en-US' or 'pl-PL'
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micError, setMicError] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Synchronous refs for accurate duplicate rejection
  const acceptedSetRef = useRef(new Set());
  const recognitionRef = useRef(null);
  const isRunningRef = useRef(false);
  const isMicActiveRef = useRef(true);
  const speechLangRef = useRef('en-US');
  const selectedLetterRef = useRef(selectedLetter);
  const noticeTimerRef = useRef(null);

  useEffect(() => {
    selectedLetterRef.current = selectedLetter;
  }, [selectedLetter]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  useEffect(() => {
    speechLangRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsRunning(false);
      isRunningRef.current = false;
      setRoundFinished(true);
      if (wordCount > bestScore) {
        setBestScore(wordCount);
        try {
          localStorage.setItem(PHONEMIC_STORAGE_KEY, String(wordCount));
        } catch (e) {}
      }
    }
  }, [isRunning, timeLeft, wordCount, bestScore]);

  const showFeedback = useCallback((notice) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setFeedbackNotice(notice);
    noticeTimerRef.current = setTimeout(() => {
      setFeedbackNotice(null);
    }, 3800);
  }, []);

  const evaluateWord = useCallback(async (rawWord) => {
    if (!rawWord) return;
    const clean = rawWord.toLowerCase().replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ'-]/g, '').trim();
    if (!clean || clean.length < 2) return;

    const stem = normalizeStem(clean);

    // 1. DUPLICATE CHECK (Odrzucanie powtórzeń)
    if (acceptedSetRef.current.has(clean) || acceptedSetRef.current.has(stem)) {
      playChime('duplicate');
      setDuplicatesCount((prev) => prev + 1);
      showFeedback({
        type: 'duplicate',
        word: clean,
        message: `Powtórzenie: słowo „${clean}” padło już wcześniej! (0 pkt)`
      });
      setRejectedWords((prev) => [
        { word: clean, reason: 'Powtórzenie (już zaliczone)', type: 'duplicate', timestamp: Date.now() },
        ...prev.filter((r) => r.word !== clean)
      ]);
      return;
    }

    // 2. PHONEMIC LETTER CHECK
    const targetChar = selectedLetterRef.current.toLowerCase();
    if (clean[0] !== targetChar) {
      playChime('error');
      showFeedback({
        type: 'error',
        word: clean,
        message: `Błąd: „${clean}” nie zaczyna się na literę „${selectedLetterRef.current}”! (0 pkt)`
      });
      setRejectedWords((prev) => [
        { word: clean, reason: `Nie zaczyna się na „${selectedLetterRef.current}”`, type: 'wrong_letter', timestamp: Date.now() },
        ...prev.filter((r) => r.word !== clean)
      ]);
      return;
    }

    // 3. AI VALIDATION VIA BACKEND
    setIsEvaluating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fluency/validate`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'phonemic',
          word: clean,
          target: targetChar,
          language: speechLangRef.current.startsWith('pl') ? 'pl' : 'en'
        })
      });
      const data = await res.json();
      if (data.valid) {
        acceptedSetRef.current.add(clean);
        acceptedSetRef.current.add(stem);
        if (data.normalized) {
          acceptedSetRef.current.add(normalizeStem(data.normalized.toLowerCase()));
        }
        playChime('success');
        setWordsList((prev) => [
          { word: clean, normalized: data.normalized || clean, reason: data.reason || 'Poprawne słowo', timestamp: Date.now() },
          ...prev
        ]);
        setWordCount((c) => c + 1);
        showFeedback({
          type: 'success',
          word: clean,
          message: `Zaakceptowano: „${clean}” (+1)`
        });
        setInputError('');
      } else {
        playChime('error');
        setRejectedWords((prev) => [
          { word: clean, reason: data.reason || 'Odrzucone przez AI', type: data.is_proper_noun ? 'proper_noun' : 'invalid', timestamp: Date.now() },
          ...prev.filter((r) => r.word !== clean)
        ]);
        showFeedback({
          type: 'error',
          word: clean,
          message: data.reason || `Odrzucono słowo „${clean}” (0 pkt)`
        });
      }
    } catch (err) {
      // offline/fallback: word starts with correct letter
      acceptedSetRef.current.add(clean);
      acceptedSetRef.current.add(stem);
      playChime('success');
      setWordsList((prev) => [
        { word: clean, normalized: clean, reason: 'Zaakceptowano', timestamp: Date.now() },
        ...prev
      ]);
      setWordCount((c) => c + 1);
      showFeedback({
        type: 'success',
        word: clean,
        message: `Zaakceptowano: „${clean}” (+1)`
      });
      setInputError('');
    } finally {
      setIsEvaluating(false);
    }
  }, [showFeedback]);

  // Continuous Speech Recognition listener
  useEffect(() => {
    if (!isRunning || !isMicActive || !SpeechRecognition) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let rec = null;

    try {
      rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechLang;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        if (!isRunningRef.current) return;
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            const tokens = text.trim().split(/\s+/);
            tokens.forEach((tok) => {
              const clean = tok.toLowerCase().replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ'-]/g, '').trim();
              if (clean && clean.length >= 2) {
                evaluateWord(clean);
              }
            });
          } else {
            interim += ' ' + text;
          }
        }
        setLiveTranscript(interim.trim());
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setMicError('Brak uprawnień do mikrofonu w przeglądarce.');
          setIsMicActive(false);
        }
      };

      rec.onend = () => {
        if (isMounted && isRunningRef.current && isMicActiveRef.current) {
          try {
            rec.start();
          } catch (e) {
            setTimeout(() => {
              if (isMounted && isRunningRef.current && isMicActiveRef.current) {
                try { rec.start(); } catch (err) {}
              }
            }, 200);
          }
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setMicError('');
    } catch (err) {
      console.warn('Speech recognition init error:', err);
      setMicError('Nie udało się uruchomić nasłuchu mowy.');
    }

    return () => {
      isMounted = false;
      if (rec) {
        try {
          rec.onend = null;
          rec.onerror = null;
          rec.stop();
        } catch (e) {}
      }
      recognitionRef.current = null;
    };
  }, [isRunning, isMicActive, speechLang, evaluateWord]);

  const startRound = () => {
    acceptedSetRef.current = new Set();
    setWordCount(0);
    setWordsList([]);
    setRejectedWords([]);
    setDuplicatesCount(0);
    setWordInput('');
    setInputError('');
    setFeedbackNotice(null);
    setLiveTranscript('');
    setRoundFinished(false);
    setTimeLeft(60);
    isRunningRef.current = true;
    setIsRunning(true);
  };

  const stopRound = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (timeLeft < 60 && wordCount > 0) {
      setRoundFinished(true);
      if (wordCount > bestScore) {
        setBestScore(wordCount);
        try {
          localStorage.setItem(PHONEMIC_STORAGE_KEY, String(wordCount));
        } catch (e) {}
      }
    }
  }, [timeLeft, wordCount, bestScore]);

  const randomizeLetter = () => {
    if (isRunning) return;
    const candidates = PHONEMIC_LETTERS.filter((l) => l !== selectedLetter);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    setSelectedLetter(next);
    setRoundFinished(false);
    setWordCount(0);
    setWordsList([]);
    setRejectedWords([]);
    setDuplicatesCount(0);
    acceptedSetRef.current = new Set();
  };

  const handleManualIncrement = useCallback(() => {
    if (!isRunning) return;
    setWordCount((c) => c + 1);
    setInputError('');
    playChime('success');
  }, [isRunning]);

  const handleAddTypedWord = (e) => {
    e.preventDefault();
    if (!isRunning) return;
    const cleaned = wordInput.trim();
    if (!cleaned) return;
    evaluateWord(cleaned);
    setWordInput('');
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        isRunningRef.current = false;
        setIsRunning(false);
        onClose();
        return;
      }
      if (!isRunning) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleManualIncrement();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRunning, onClose, handleManualIncrement]);

  const progressPct = Math.round(((60 - timeLeft) / 60) * 100);

  return (
    <div className="nback-card nback-modal-card fluency-modal-card">
      <div className="nback-top-row">
        <div className="nback-title-group">
          <div className="nback-badge-row">
            <span className="nback-mono-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7V4h16v3" />
                <path d="M9 20h6" />
                <path d="M12 4v16" />
              </svg>
              DOSTĘP LEKSYKALNY (OŚRODEK BROKI)
            </span>
            <span className="nback-stat-pill">Norma: 12–15 słów / 60s</span>
            <span className="nback-stat-pill">Rekord: {bestScore} słów</span>
          </div>
          <h3>Płynność fonemiczna</h3>
          <p className="nback-scientific-desc">
            Ustaw stoper na <strong>60 sekund</strong>. Wymieniaj na głos słowa na literę „<strong>{selectedLetter}</strong>”. <strong>AI automatycznie nasłuchuje Twojego głosu</strong>, zlicza poprawne słowa, odrzuca powtórzenia i nazwy własne.
          </p>
        </div>

        <div className="nback-header-actions">
          <button
            type="button"
            className="nback-help-toggle"
            disabled={isRunning}
            onClick={randomizeLetter}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            Losuj literę
          </button>

          {onClose && (
            <button
              type="button"
              className="nback-modal-close-btn"
              onClick={() => {
                isRunningRef.current = false;
                setIsRunning(false);
                onClose();
              }}
              title="Zamknij (Esc)"
              aria-label="Zamknij modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Letter Selector Toolbar */}
      <div className="nback-toolbar">
        <div className="nback-control-group" style={{ flexWrap: 'wrap' }}>
          <span className="nback-control-label">Wybierz literę:</span>
          <div className="nback-segmented fluency-letter-pills">
            {PHONEMIC_LETTERS.map((ltr) => (
              <button
                key={ltr}
                type="button"
                disabled={isRunning}
                className={`nback-seg-btn ${selectedLetter === ltr ? 'active' : ''}`}
                onClick={() => {
                  setSelectedLetter(ltr);
                  setRoundFinished(false);
                }}
              >
                {ltr}
              </button>
            ))}
          </div>
        </div>

        {/* Language & Voice Selector */}
        <div className="nback-control-group nback-toggles">
          <span className="nback-control-label">Język mowy:</span>
          <div className="nback-segmented">
            <button
              type="button"
              className={`nback-seg-btn ${speechLang === 'en-US' ? 'active' : ''}`}
              onClick={() => setSpeechLang('en-US')}
              title="Rozpoznawaj słowa w języku angielskim"
            >
              🇺🇸 EN
            </button>
            <button
              type="button"
              className={`nback-seg-btn ${speechLang === 'pl-PL' ? 'active' : ''}`}
              onClick={() => setSpeechLang('pl-PL')}
              title="Rozpoznawaj słowa w języku polskim"
            >
              🇵🇱 PL
            </button>
          </div>
        </div>
      </div>

      {/* Main Fluency Arena */}
      <div className="fluency-arena">
        <div className="fluency-metrics-row">
          <div className="fluency-hero-box">
            <span className="fluency-box-label">LITERA DOCELOWA</span>
            <span className="fluency-big-value">{selectedLetter}</span>
          </div>

          <div className={`fluency-hero-box ${isRunning ? 'active-timer' : ''}`}>
            <span className="fluency-box-label">POZOSTAŁY CZAS</span>
            <span className="fluency-big-value">{timeLeft}s</span>
          </div>

          <div className="fluency-hero-box">
            <span className="fluency-box-label">ZAAKCEPTOWANE SŁOWA</span>
            <span className="fluency-big-value">{wordCount}</span>
          </div>
        </div>

        <div className="nback-progress-track" style={{ maxWidth: '560px', marginBottom: '1rem' }}>
          <div className="nback-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Live Microphone Panel during round */}
        {isRunning && (
          <div className={`fluency-mic-panel ${isMicActive ? 'listening' : 'muted'}`}>
            <div className="fluency-mic-header">
              <div className="fluency-mic-status-wrap">
                <span className={`fluency-mic-dot ${isMicActive ? 'active' : ''}`} />
                <div className="fluency-mic-info">
                  <strong>
                    {isMicActive ? 'AI nasłuchuje Twojego głosu' : 'Mikrofon wyciszony'}
                  </strong>
                  <span>
                    {isMicActive
                      ? `Mów płynnie na literę „${selectedLetter}” (${speechLang === 'en-US' ? 'angielski' : 'polski'}). AI automatycznie zlicza słowa i odrzuca powtórzenia.`
                      : 'Włącz mikrofon lub wpisuj słowa w formularzu poniżej.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`fluency-mic-toggle-btn ${isMicActive ? 'active' : ''}`}
                onClick={() => setIsMicActive((prev) => !prev)}
                title={isMicActive ? 'Wycisz mikrofon' : 'Włącz mikrofon'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {isMicActive ? (
                    <>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                  ) : (
                    <>
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                  )}
                </svg>
                <span>{isMicActive ? 'Mikrofon ON' : 'Włącz nasłuch'}</span>
              </button>
            </div>

            {liveTranscript && (
              <div className="fluency-live-transcript">
                <span className="live-hearing-tag">Słyszę:</span> „{liveTranscript}”
              </div>
            )}
            {micError && <div className="fluency-mic-error">{micError}</div>}
          </div>
        )}

        {/* Live Evaluation Notice / Toast */}
        {feedbackNotice && (
          <div className={`fluency-feedback-banner ${feedbackNotice.type}`}>
            {feedbackNotice.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {feedbackNotice.type === 'duplicate' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {feedbackNotice.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            <span>{feedbackNotice.message}</span>
          </div>
        )}

        <div className="fluency-controls-row">
          {!isRunning ? (
            <button type="button" className="nback-primary-btn" onClick={startRound}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              <span>Start 60 sekund z nasłuchem AI (Litera „{selectedLetter}”)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="fluency-tap-btn fluency-manual-btn"
                onClick={handleManualIncrement}
                title="Ręczne zaliczenie słowa (np. gdy brak mikrofonu)"
              >
                <div className="nback-match-btn-top">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Zalicz ręcznie (+1)</span>
                  <kbd className="nback-kbd">Spacja</kbd>
                </div>
                <span className="nback-match-sub">Opcjonalny przycisk ręczny (AI zlicza mowę automatycznie)</span>
              </button>

              <button type="button" className="nback-stop-btn" onClick={stopRound}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <span>Zakończ</span>
              </button>
            </>
          )}
        </div>

        {isRunning && (
          <form className="fluency-word-form" onSubmit={handleAddTypedWord}>
            <input
              type="text"
              className="fluency-word-input"
              placeholder={`Możesz też wpisać słowo na „${selectedLetter}” i nacisnąć Enter...`}
              value={wordInput}
              disabled={isEvaluating}
              onChange={(e) => setWordInput(e.target.value)}
            />
            <button type="submit" className="fluency-word-submit" disabled={isEvaluating || !wordInput.trim()}>
              {isEvaluating ? 'Sprawdzam...' : 'Dodaj'}
            </button>
          </form>
        )}
        {inputError && <div className="fluency-input-error">{inputError}</div>}

        {/* Accepted words list */}
        {wordsList.length > 0 && (
          <div className="fluency-list-wrap">
            <span className="fluency-list-heading">
              Zaakceptowane słowa ({wordsList.length}):
            </span>
            <div className="fluency-tags-list">
              {wordsList.map((item, idx) => (
                <span key={idx} className="fluency-word-tag accepted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <strong>{item.word}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rejected or Duplicate words list */}
        {rejectedWords.length > 0 && (
          <div className="fluency-list-wrap rejected-wrap">
            <span className="fluency-list-heading rejected-heading">
              Odrzucone lub powtórzenia ({rejectedWords.length}):
            </span>
            <div className="fluency-tags-list">
              {rejectedWords.map((item, idx) => (
                <span key={idx} className={`fluency-word-tag ${item.type}`}>
                  <span>{item.type === 'duplicate' ? '⚠️' : '✕'}</span>
                  <span>{item.word}</span>
                  <em className="fluency-reject-reason">({item.reason})</em>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {roundFinished && !isRunning && (
        <div className="nback-results-box">
          <div className="nback-results-header">
            <div>
              <span className="nback-results-eyebrow">PODSUMOWANIE — LITERA „{selectedLetter}”</span>
              <h4>Wynik: {wordCount} {wordCount === 1 ? 'słowo' : 'słów'} w 60 sekund</h4>
              {duplicatesCount > 0 && (
                <span className="fluency-dups-note">
                  (AI odrzuciło {duplicatesCount} {duplicatesCount === 1 ? 'powtórzenie' : 'powtórzeń'})
                </span>
              )}
            </div>
            <div className="nback-recommendation-pill">
              {wordCount >= 16
                ? 'Powyżej normy (16+ słów)! Błyskawiczny dostęp do słownika mentalnego.'
                : wordCount >= 12
                ? 'Wynik w normie (12–15 słów). Twój bufor werbalny pracuje prawidłowo.'
                : 'Poniżej normy (<12 słów). Spróbuj jeszcze raz, mówiąc po angielsku lub po polsku!'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PhonemicFluencyModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="nback-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="nback-modal-dialog" role="dialog" aria-modal="true" aria-label="Ćwiczenie Płynności Fonemicznej">
        <PhonemicFluencyGame onClose={onClose} />
      </div>
    </div>
  );
};

const SEMANTIC_CATEGORIES = [
  { id: 'tools', label: 'Narzędzia warsztatowe', hintEn: 'Workshop tools (hammer, drill, wrench...)' },
  { id: 'trees', label: 'Drzewa i rośliny', hintEn: 'Trees & plants (oak, pine, birch...)' },
  { id: 'africa', label: 'Zwierzęta afrykańskie', hintEn: 'African animals (lion, giraffe, zebra...)' },
  { id: 'kitchen', label: 'Wyposażenie kuchni', hintEn: 'Kitchen items (pan, blender, kettle...)' },
  { id: 'transport', label: 'Środki transportu', hintEn: 'Means of transport (train, ferry, tram...)' },
  { id: 'jobs', label: 'Zawody i profesje', hintEn: 'Professions & jobs (architect, surgeon, pilot...)' },
  { id: 'fruits', label: 'Owoce i warzywa', hintEn: 'Fruits & vegetables (peach, broccoli, plum...)' },
  { id: 'office', label: 'Przedmioty w biurze', hintEn: 'Office supplies (stapler, folder, monitor...)' },
];
const SEMANTIC_STORAGE_KEY = 'speakling_semantic_fluency_v1';

export const SemanticFluencyGame = ({ onClose }) => {
  const [selectedCat, setSelectedCat] = useState(SEMANTIC_CATEGORIES[0]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [itemsList, setItemsList] = useState([]);
  const [rejectedItems, setRejectedItems] = useState([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [itemInput, setItemInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [roundFinished, setRoundFinished] = useState(false);
  const [bestScore, setBestScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem(SEMANTIC_STORAGE_KEY), 10) || 0;
    } catch (e) {
      return 0;
    }
  });

  // Speech Recognition state
  const [isMicActive, setIsMicActive] = useState(true);
  const [speechLang, setSpeechLang] = useState('en-US'); // 'en-US' or 'pl-PL'
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micError, setMicError] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Synchronous refs
  const acceptedSetRef = useRef(new Set());
  const recognitionRef = useRef(null);
  const isRunningRef = useRef(false);
  const isMicActiveRef = useRef(true);
  const speechLangRef = useRef('en-US');
  const selectedCatRef = useRef(selectedCat);
  const noticeTimerRef = useRef(null);

  useEffect(() => {
    selectedCatRef.current = selectedCat;
  }, [selectedCat]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  useEffect(() => {
    speechLangRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsRunning(false);
      isRunningRef.current = false;
      setRoundFinished(true);
      if (itemCount > bestScore) {
        setBestScore(itemCount);
        try {
          localStorage.setItem(SEMANTIC_STORAGE_KEY, String(itemCount));
        } catch (e) {}
      }
    }
  }, [isRunning, timeLeft, itemCount, bestScore]);

  const showFeedback = useCallback((notice) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setFeedbackNotice(notice);
    noticeTimerRef.current = setTimeout(() => {
      setFeedbackNotice(null);
    }, 3800);
  }, []);

  const evaluateItem = useCallback(async (rawItem) => {
    if (!rawItem) return;
    const clean = rawItem.toLowerCase().replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ'-]/g, '').trim();
    if (!clean || clean.length < 2) return;

    const stem = normalizeStem(clean);

    // 1. DUPLICATE CHECK (Odrzucanie powtórzeń)
    if (acceptedSetRef.current.has(clean) || acceptedSetRef.current.has(stem)) {
      playChime('duplicate');
      setDuplicatesCount((prev) => prev + 1);
      showFeedback({
        type: 'duplicate',
        word: clean,
        message: `Powtórzenie: „${clean}” padło już wcześniej! (0 pkt)`
      });
      setRejectedItems((prev) => [
        { word: clean, reason: 'Powtórzenie (już zaliczone)', type: 'duplicate', timestamp: Date.now() },
        ...prev.filter((r) => r.word !== clean)
      ]);
      return;
    }

    // 2. FAST LOCAL CATEGORY CHECK (Zero-latency hit for common words)
    const activeCatId = selectedCatRef.current.id;
    const commonSet = COMMON_SEMANTIC_WORDS[activeCatId];
    if (commonSet && (commonSet.has(clean) || commonSet.has(stem))) {
      acceptedSetRef.current.add(clean);
      acceptedSetRef.current.add(stem);
      playChime('success');
      setItemsList((prev) => [
        { word: clean, normalized: clean, reason: `Kategoria: ${selectedCatRef.current.label}`, timestamp: Date.now() },
        ...prev
      ]);
      setItemCount((c) => c + 1);
      showFeedback({
        type: 'success',
        word: clean,
        message: `Zaakceptowano: „${clean}” (+1)`
      });
      setInputError('');
      return;
    }

    // 3. AI VALIDATION VIA BACKEND
    setIsEvaluating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fluency/validate`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'semantic',
          word: clean,
          target: activeCatId,
          category_label: selectedCatRef.current.label,
          language: speechLangRef.current.startsWith('pl') ? 'pl' : 'en'
        })
      });
      const data = await res.json();
      if (data.valid) {
        acceptedSetRef.current.add(clean);
        acceptedSetRef.current.add(stem);
        if (data.normalized) {
          acceptedSetRef.current.add(normalizeStem(data.normalized.toLowerCase()));
        }
        playChime('success');
        setItemsList((prev) => [
          { word: clean, normalized: data.normalized || clean, reason: data.reason || `Kategoria: ${selectedCatRef.current.label}`, timestamp: Date.now() },
          ...prev
        ]);
        setItemCount((c) => c + 1);
        showFeedback({
          type: 'success',
          word: clean,
          message: `Zaakceptowano: „${clean}” (+1)`
        });
        setInputError('');
      } else {
        playChime('error');
        setRejectedItems((prev) => [
          { word: clean, reason: data.reason || `Nie pasuje do kategorii: ${selectedCatRef.current.label}`, type: 'invalid_category', timestamp: Date.now() },
          ...prev.filter((r) => r.word !== clean)
        ]);
        showFeedback({
          type: 'error',
          word: clean,
          message: data.reason || `Słowo „${clean}” nie należy do tej kategorii (0 pkt)`
        });
      }
    } catch (err) {
      // fallback
      acceptedSetRef.current.add(clean);
      acceptedSetRef.current.add(stem);
      playChime('success');
      setItemsList((prev) => [
        { word: clean, normalized: clean, reason: 'Zaakceptowano', timestamp: Date.now() },
        ...prev
      ]);
      setItemCount((c) => c + 1);
      showFeedback({
        type: 'success',
        word: clean,
        message: `Zaakceptowano: „${clean}” (+1)`
      });
      setInputError('');
    } finally {
      setIsEvaluating(false);
    }
  }, [showFeedback]);

  // Continuous Speech Recognition listener
  useEffect(() => {
    if (!isRunning || !isMicActive || !SpeechRecognition) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let rec = null;

    try {
      rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechLang;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        if (!isRunningRef.current) return;
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            const tokens = text.trim().split(/\s+/);
            tokens.forEach((tok) => {
              const clean = tok.toLowerCase().replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ'-]/g, '').trim();
              if (clean && clean.length >= 2) {
                evaluateItem(clean);
              }
            });
          } else {
            interim += ' ' + text;
          }
        }
        setLiveTranscript(interim.trim());
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setMicError('Brak uprawnień do mikrofonu w przeglądarce.');
          setIsMicActive(false);
        }
      };

      rec.onend = () => {
        if (isMounted && isRunningRef.current && isMicActiveRef.current) {
          try {
            rec.start();
          } catch (e) {
            setTimeout(() => {
              if (isMounted && isRunningRef.current && isMicActiveRef.current) {
                try { rec.start(); } catch (err) {}
              }
            }, 200);
          }
        }
      };

      rec.start();
      recognitionRef.current = rec;
      setMicError('');
    } catch (err) {
      console.warn('Speech recognition init error:', err);
      setMicError('Nie udało się uruchomić nasłuchu mowy.');
    }

    return () => {
      isMounted = false;
      if (rec) {
        try {
          rec.onend = null;
          rec.onerror = null;
          rec.stop();
        } catch (e) {}
      }
      recognitionRef.current = null;
    };
  }, [isRunning, isMicActive, speechLang, evaluateItem]);

  const startRound = () => {
    acceptedSetRef.current = new Set();
    setItemCount(0);
    setItemsList([]);
    setRejectedItems([]);
    setDuplicatesCount(0);
    setItemInput('');
    setInputError('');
    setFeedbackNotice(null);
    setLiveTranscript('');
    setRoundFinished(false);
    setTimeLeft(60);
    isRunningRef.current = true;
    setIsRunning(true);
  };

  const stopRound = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (timeLeft < 60 && itemCount > 0) {
      setRoundFinished(true);
      if (itemCount > bestScore) {
        setBestScore(itemCount);
        try {
          localStorage.setItem(SEMANTIC_STORAGE_KEY, String(itemCount));
        } catch (e) {}
      }
    }
  }, [timeLeft, itemCount, bestScore]);

  const randomizeCategory = () => {
    if (isRunning) return;
    const candidates = SEMANTIC_CATEGORIES.filter((c) => c.id !== selectedCat.id);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    setSelectedCat(next);
    setRoundFinished(false);
    setItemCount(0);
    setItemsList([]);
    setRejectedItems([]);
    setDuplicatesCount(0);
    acceptedSetRef.current = new Set();
  };

  const handleManualIncrement = useCallback(() => {
    if (!isRunning) return;
    setItemCount((c) => c + 1);
    setInputError('');
    playChime('success');
  }, [isRunning]);

  const handleAddTypedItem = (e) => {
    e.preventDefault();
    if (!isRunning) return;
    const cleaned = itemInput.trim();
    if (!cleaned) return;
    evaluateItem(cleaned);
    setItemInput('');
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        isRunningRef.current = false;
        setIsRunning(false);
        onClose();
        return;
      }
      if (!isRunning) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleManualIncrement();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRunning, onClose, handleManualIncrement]);

  const progressPct = Math.round(((60 - timeLeft) / 60) * 100);

  return (
    <div className="nback-card nback-modal-card fluency-modal-card">
      <div className="nback-top-row">
        <div className="nback-title-group">
          <div className="nback-badge-row">
            <span className="nback-mono-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              SIECI SKOJARZENIOWE (PŁAT SKRONIOWY)
            </span>
            <span className="nback-stat-pill">Czas: 60s</span>
            <span className="nback-stat-pill">Rekord: {bestScore} obiektów</span>
          </div>
          <h3>Płynność semantyczna</h3>
          <p className="nback-scientific-desc">
            <strong>60 sekund</strong> na wymienienie jak największej liczby obiektów z kategorii „<strong>{selectedCat.label}</strong>”. <strong>AI aktywnie nasłuchuje</strong>, weryfikuje czy słowa pasują do kategorii i odrzuca powtórzenia.
          </p>
        </div>

        <div className="nback-header-actions">
          <button
            type="button"
            className="nback-help-toggle"
            disabled={isRunning}
            onClick={randomizeCategory}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
            Losuj kategorię
          </button>

          {onClose && (
            <button
              type="button"
              className="nback-modal-close-btn"
              onClick={() => {
                isRunningRef.current = false;
                setIsRunning(false);
                onClose();
              }}
              title="Zamknij (Esc)"
              aria-label="Zamknij modal"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category Selector Toolbar */}
      <div className="nback-toolbar">
        <div className="nback-control-group" style={{ flexWrap: 'wrap', width: '100%' }}>
          <span className="nback-control-label">Kategoria:</span>
          <div className="fluency-category-chips">
            {SEMANTIC_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                disabled={isRunning}
                className={`nback-icon-chip ${selectedCat.id === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCat(cat);
                  setRoundFinished(false);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language Selector */}
        <div className="nback-control-group nback-toggles" style={{ marginTop: '0.4rem' }}>
          <span className="nback-control-label">Język mowy:</span>
          <div className="nback-segmented">
            <button
              type="button"
              className={`nback-seg-btn ${speechLang === 'en-US' ? 'active' : ''}`}
              onClick={() => setSpeechLang('en-US')}
              title="Rozpoznawaj słowa w języku angielskim"
            >
              🇺🇸 EN
            </button>
            <button
              type="button"
              className={`nback-seg-btn ${speechLang === 'pl-PL' ? 'active' : ''}`}
              onClick={() => setSpeechLang('pl-PL')}
              title="Rozpoznawaj słowa w języku polskim"
            >
              🇵🇱 PL
            </button>
          </div>
        </div>
      </div>

      {/* Main Fluency Arena */}
      <div className="fluency-arena">
        <div className="fluency-category-banner">
          <span className="fluency-box-label">AKTYWNA KATEGORIA</span>
          <strong>{selectedCat.label}</strong>
          <span className="fluency-category-en">{selectedCat.hintEn}</span>
        </div>

        <div className="fluency-metrics-row">
          <div className={`fluency-hero-box ${isRunning ? 'active-timer' : ''}`}>
            <span className="fluency-box-label">POZOSTAŁY CZAS</span>
            <span className="fluency-big-value">{timeLeft}s</span>
          </div>

          <div className="fluency-hero-box">
            <span className="fluency-box-label">ZAAKCEPTOWANE OBIEKTY</span>
            <span className="fluency-big-value">{itemCount}</span>
          </div>
        </div>

        <div className="nback-progress-track" style={{ maxWidth: '560px', marginBottom: '1rem' }}>
          <div className="nback-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Live Microphone Panel during round */}
        {isRunning && (
          <div className={`fluency-mic-panel ${isMicActive ? 'listening' : 'muted'}`}>
            <div className="fluency-mic-header">
              <div className="fluency-mic-status-wrap">
                <span className={`fluency-mic-dot ${isMicActive ? 'active' : ''}`} />
                <div className="fluency-mic-info">
                  <strong>
                    {isMicActive ? 'AI nasłuchuje Twojego głosu' : 'Mikrofon wyciszony'}
                  </strong>
                  <span>
                    {isMicActive
                      ? `Mów na głos obiekty z kategorii „${selectedCat.label}”. AI sprawdza poprawność i odrzuca powtórzenia.`
                      : 'Włącz mikrofon lub wpisuj obiekty poniżej.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`fluency-mic-toggle-btn ${isMicActive ? 'active' : ''}`}
                onClick={() => setIsMicActive((prev) => !prev)}
                title={isMicActive ? 'Wycisz mikrofon' : 'Włącz mikrofon'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {isMicActive ? (
                    <>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                  ) : (
                    <>
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                  )}
                </svg>
                <span>{isMicActive ? 'Mikrofon ON' : 'Włącz nasłuch'}</span>
              </button>
            </div>

            {liveTranscript && (
              <div className="fluency-live-transcript">
                <span className="live-hearing-tag">Słyszę:</span> „{liveTranscript}”
              </div>
            )}
            {micError && <div className="fluency-mic-error">{micError}</div>}
          </div>
        )}

        {/* Live Evaluation Notice / Toast */}
        {feedbackNotice && (
          <div className={`fluency-feedback-banner ${feedbackNotice.type}`}>
            {feedbackNotice.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {feedbackNotice.type === 'duplicate' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {feedbackNotice.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            <span>{feedbackNotice.message}</span>
          </div>
        )}

        <div className="fluency-controls-row">
          {!isRunning ? (
            <button type="button" className="nback-primary-btn" onClick={startRound}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              <span>Start 60 sekund z nasłuchem AI ({selectedCat.label})</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="fluency-tap-btn fluency-manual-btn"
                onClick={handleManualIncrement}
                title="Ręczne zaliczenie obiektu (np. gdy brak mikrofonu)"
              >
                <div className="nback-match-btn-top">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Zalicz ręcznie (+1)</span>
                  <kbd className="nback-kbd">Spacja</kbd>
                </div>
                <span className="nback-match-sub">Opcjonalny przycisk ręczny (AI zlicza mowę automatycznie)</span>
              </button>

              <button type="button" className="nback-stop-btn" onClick={stopRound}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <span>Zakończ</span>
              </button>
            </>
          )}
        </div>

        {isRunning && (
          <form className="fluency-word-form" onSubmit={handleAddTypedItem}>
            <input
              type="text"
              className="fluency-word-input"
              placeholder={`Możesz też wpisać obiekt z kategorii „${selectedCat.label}” i nacisnąć Enter...`}
              value={itemInput}
              disabled={isEvaluating}
              onChange={(e) => setItemInput(e.target.value)}
            />
            <button type="submit" className="fluency-word-submit" disabled={isEvaluating || !itemInput.trim()}>
              {isEvaluating ? 'Sprawdzam...' : 'Dodaj'}
            </button>
          </form>
        )}
        {inputError && <div className="fluency-input-error">{inputError}</div>}

        {/* Accepted items list */}
        {itemsList.length > 0 && (
          <div className="fluency-list-wrap">
            <span className="fluency-list-heading">
              Zaakceptowane obiekty ({itemsList.length}):
            </span>
            <div className="fluency-tags-list">
              {itemsList.map((item, idx) => (
                <span key={idx} className="fluency-word-tag accepted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <strong>{item.word}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rejected or Duplicate items list */}
        {rejectedItems.length > 0 && (
          <div className="fluency-list-wrap rejected-wrap">
            <span className="fluency-list-heading rejected-heading">
              Odrzucone lub powtórzenia ({rejectedItems.length}):
            </span>
            <div className="fluency-tags-list">
              {rejectedItems.map((item, idx) => (
                <span key={idx} className={`fluency-word-tag ${item.type}`}>
                  <span>{item.type === 'duplicate' ? '⚠️' : '✕'}</span>
                  <span>{item.word}</span>
                  <em className="fluency-reject-reason">({item.reason})</em>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {roundFinished && !isRunning && (
        <div className="nback-results-box">
          <div className="nback-results-header">
            <div>
              <span className="nback-results-eyebrow">PODSUMOWANIE — {selectedCat.label.toUpperCase()}</span>
              <h4>Wynik: {itemCount} {itemCount === 1 ? 'obiekt' : 'obiektów'} w 60 sekund</h4>
              {duplicatesCount > 0 && (
                <span className="fluency-dups-note">
                  (AI odrzuciło {duplicatesCount} {duplicatesCount === 1 ? 'powtórzenie' : 'powtórzeń'})
                </span>
              )}
            </div>
            <div className="nback-recommendation-pill">
              {itemCount >= 18
                ? 'Znakomita płynność semantyczna (18+ obiektów)! Sieci skojarzeń są w pełni rozgrzane.'
                : itemCount >= 12
                ? 'Dobry wynik (12–17 obiektów). Kontynuuj rozgrzewkę na kolejnej kategorii.'
                : 'Rozgrzewka (<12 obiektów). Spróbuj wizualizować miejsce związane z tą kategorią!'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SemanticFluencyModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="nback-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="nback-modal-dialog" role="dialog" aria-modal="true" aria-label="Ćwiczenie Płynności Semantycznej">
        <SemanticFluencyGame onClose={onClose} />
      </div>
    </div>
  );
};

const GoodToKnow = ({ onOpenNBack, onOpenBreathing, onOpenPhonemic, onOpenSemantic }) => {
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [localBreathingOpen, setLocalBreathingOpen] = useState(false);
  const [localPhonemicOpen, setLocalPhonemicOpen] = useState(false);
  const [localSemanticOpen, setLocalSemanticOpen] = useState(false);
  const [gamesMenuOpen, setGamesMenuOpen] = useState(false);

  const handleOpenGame = () => {
    setGamesMenuOpen(false);
    if (onOpenNBack) {
      onOpenNBack();
    } else {
      setLocalModalOpen(true);
    }
  };

  const handleOpenBreathing = () => {
    setGamesMenuOpen(false);
    if (onOpenBreathing) {
      onOpenBreathing();
    } else {
      setLocalBreathingOpen(true);
    }
  };

  const handleOpenPhonemic = () => {
    setGamesMenuOpen(false);
    if (onOpenPhonemic) {
      onOpenPhonemic();
    } else {
      setLocalPhonemicOpen(true);
    }
  };

  const handleOpenSemantic = () => {
    setGamesMenuOpen(false);
    if (onOpenSemantic) {
      onOpenSemantic();
    } else {
      setLocalSemanticOpen(true);
    }
  };

  return (
    <div className="good-to-know-container">
      <div className="good-to-know-content">
        <div className="gtk-header">
          <span className="gtk-eyebrow">NEURONAUKA I TRENING POZNAWCZY</span>
          <h2>Jak przygotować mózg do angielskiego</h2>
          <p className="subtitle">
            Proste zasady dla maksymalnych efektów oparte na neuronauce oraz treningu pamięci roboczej i płynności słownej.
          </p>

          {/* Submenu Bar in GoodToKnow */}
          <div className="gtk-submenu-bar">
            <button
              type="button"
              className="gtk-submenu-item active"
              onClick={() => {
                setGamesMenuOpen(false);
                const el = document.getElementById('gtk-sec-1');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.59 2.97 1.5 4 .76.76 1.23 1.52 1.41 2.5h6.18z" />
              </svg>
              <span>Zasady neuronauki</span>
            </button>

            <button
              type="button"
              className="gtk-submenu-item gtk-submenu-nback-btn"
              onClick={handleOpenBreathing}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Oddech 4-7-8</span>
              <span className="gtk-submenu-pill">RELAKS</span>
            </button>

            {/* Expandable Gry Dropdown in Submenu */}
            <div className="gtk-games-dropdown-wrapper">
              <button
                type="button"
                className="gtk-submenu-item gtk-submenu-nback-btn"
                onClick={() => setGamesMenuOpen((prev) => !prev)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                <span>Gry poznawcze (3)</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: gamesMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.18s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {gamesMenuOpen && (
                <div className="gtk-games-dropdown-menu">
                  <button type="button" className="gtk-dropdown-game-item" onClick={handleOpenGame}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                    <div className="gtk-dropdown-game-text">
                      <strong>Dual N-Back</strong>
                      <span>Pojemność pamięci roboczej (dlPFC)</span>
                    </div>
                  </button>

                  <button type="button" className="gtk-dropdown-game-item" onClick={handleOpenPhonemic}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7V4h16v3" />
                      <path d="M9 20h6" />
                      <path d="M12 4v16" />
                    </svg>
                    <div className="gtk-dropdown-game-text">
                      <strong>Płynność fonemiczna</strong>
                      <span>Słowa na jedną literę w 60s (norma 12–15)</span>
                    </div>
                  </button>

                  <button type="button" className="gtk-dropdown-game-item" onClick={handleOpenSemantic}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <div className="gtk-dropdown-game-text">
                      <strong>Płynność semantyczna</strong>
                      <span>Obiekty z jednej kategorii w 60s</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="gtk-body">
          <div className="gtk-section" id="gtk-sec-1">
            <h3 className="section-title"><span className="section-number">1</span> Wyciszenie i start (Reset układu nerwowego)</h3>
            <div className="gtk-cards">
              <div className="gtk-card">
                <h4>Zresetuj stres w 30 sekund</h4>
                <p>Przed rozpoczęciem sesji wykonaj 2–3 „fizjologiczne westchnięcia” (dwa szybkie wdechy nosem i długi wydech ustami). To fizycznie obniża tętno i wyłącza tryb walki lub ucieczki.</p>
              </div>
              <div className="gtk-card">
                <h4>Rozszerz pole widzenia</h4>
                <p>Rozluźnij wzrok i obejmij nim całe pomieszczenie. Szeroka perspektywa sygnalizuje mózgowi bezpieczeństwo, przełączając go w stan otwarty na naukę.</p>
              </div>
              <div className="gtk-card">
                <h4>Wyrzuć rozpraszacze na papier</h4>
                <p>Zapisz w 60 sekund wszystko, co masz dziś do zrobienia, na boku. Odciążysz pamięć roboczą i zrobisz miejsce na angielski.</p>
              </div>
              <div className="gtk-card">
                <h4>Zasada mikro-startu (kontrakt na 5 minut)</h4>
                <p>Umów się ze sobą tylko na 5 minut kontaktu z aplikacją. Pokonanie oporu startowego jest kluczowe – potem zadziała bezwładność.</p>
              </div>
              <div className="gtk-card">
                <h4>Mikro-odpoczynek po sesji</h4>
                <p>Po skończonej nauce posiedź 3 minuty w ciszy bez telefonu. W tym czasie mózg utrwala nowo powstałe połączenia nerwowe.</p>
              </div>
              <div className="gtk-card gtk-card-nback-launcher">
                <div className="gtk-card-nback-top">
                  <h4>Ćwiczenie Oddechowe (4-7-8)</h4>
                  <span className="gtk-nback-tag">4-7-8</span>
                </div>
                <p>
                  Interaktywny trenażer oddechu (wdech 4s, zatrzymanie 7s, wydech 8s). Wykonaj kilka cykli przed nauką, aby wyciszyć układ współczulny i przygotować mózg do skupienia.
                </p>
                <button type="button" className="gtk-open-nback-btn" onClick={handleOpenBreathing}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Otwórz ćwiczenie 4-7-8</span>
                </button>
              </div>
              <div className="gtk-card gtk-card-nback-launcher">
                <div className="gtk-card-nback-top">
                  <h4>N-Back (Dual N-Back)</h4>
                  <span className="gtk-nback-tag">dlPFC</span>
                </div>
                <p>
                  Darmowa aplikacja/gra naukowa trenująca fizyczną pojemność bufora pamięci roboczej (śledzenie pozycji kwadratu na siatce i jednoczesne zapamiętywanie liter sprzed N kroków). Udowodniono, że regularny trening N-Back zwiększa gęstość receptorów dopaminowych w <strong>dlPFC</strong>.
                </p>
                <button type="button" className="gtk-open-nback-btn" onClick={handleOpenGame}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span>Otwórz grę Dual N-Back</span>
                </button>
              </div>
              <div className="gtk-card gtk-card-nback-launcher">
                <div className="gtk-card-nback-top">
                  <h4>Płynność fonemiczna</h4>
                  <span className="gtk-nback-tag">60s</span>
                </div>
                <p>
                  Ustaw stoper na 60 sekund. Wymień na głos jak najwięcej słów na jedną literę (np. na literę „K”, omijając imiona). Norma to <strong>12–15 słów</strong>.
                </p>
                <button type="button" className="gtk-open-nback-btn" onClick={handleOpenPhonemic}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7V4h16v3" />
                    <path d="M9 20h6" />
                    <path d="M12 4v16" />
                  </svg>
                  <span>Otwórz Płynność fonemiczną</span>
                </button>
              </div>
              <div className="gtk-card gtk-card-nback-launcher">
                <div className="gtk-card-nback-top">
                  <h4>Płynność semantyczna</h4>
                  <span className="gtk-nback-tag">60s</span>
                </div>
                <p>
                  60 sekund na wymienienie jak największej liczby obiektów z jednej kategorii (np. „narzędzia warsztatowe”, „drzewa”, „zwierzęta afrykańskie”).
                </p>
                <button type="button" className="gtk-open-nback-btn" onClick={handleOpenSemantic}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>Otwórz Płynność semantyczną</span>
                </button>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">2</span> Trening tematyczny i przyswajanie</h3>
            <div className="gtk-cards">
              <div className="gtk-card">
                <h4>Zasada wąskiego kontekstu (Narrow Input)</h4>
                <p>Ucz się przez kilka kolejnych dni z materiałów i tekstów o bardzo zbliżonej tematyce. Powtarzające się naturalnie słownictwo, stałe kolokacje i struktury utrwalają się automatycznie bez wkuwania, zdejmując z mózgu wysiłek ciągłego skakania po obcych dziedzinach.</p>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">3</span> Czytanie bez słownika (Wzorce zamiast analizy)</h3>
            <div className="gtk-cards">
              <div className="gtk-card">
                <h4>Poluj na szkielet zdania</h4>
                <p>Szukaj wyłącznie schematu: <strong>Kto? + Co robi?</strong>. Reszta to tło – gdy znasz wykonawcę i czynność, rozumiesz 70% sensu.</p>
              </div>
              <div className="gtk-card">
                <h4>Czytaj całymi klockami (Chunks)</h4>
                <p>Zapamiętuj gotowe zbitki słów (as far as I know, at the end of the day), a nie pojedyncze wyrazy.</p>
              </div>
              <div className="gtk-card">
                <h4>Zasada czarnej skrzynki [X]</h4>
                <p>Kiedy trafiasz na nieznane słowo, wstaw w myślach znak zapytania i czytaj dalej do kropki. Kontekst zdania niemal zawsze sam wyjaśni znaczenie.</p>
              </div>
              <div className="gtk-card">
                <h4>Bądź detektywem internacjonalizmów</h4>
                <p>Słowa kończące się na -tion, -able, -ment czy -ity mają zazwyczaj bezpośrednie odpowiedniki w języku polskim.</p>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">4</span> Rozumienie ze słuchu (Wyłapywanie rytmu)</h3>
            <div className="gtk-cards">
              <div className="gtk-card">
                <h4>Słuchaj tylko słów z akcentem</h4>
                <p>Native speakerzy „połykają” słówka gramatyczne. Skup się wyłącznie na głośniejszych, wyrazistych uderzeniach rytmu (rzeczowniki, czasowniki, przeczenia).</p>
              </div>
              <div className="gtk-card">
                <h4>Mowa to jeden ciągły dźwięk</h4>
                <p>Angielski nie ma spacji (hold on brzmi jak hol-don). Zamiast szukać pojedynczych słówek, łap całe melodie wypowiedzi.</p>
              </div>
              <div className="gtk-card">
                <h4>Wyłącz panikę opóźnienia</h4>
                <p>Zrozumienie często przychodzi 2 sekundy po tym, jak zdanie dobiegnie końca. Daj mózgowi chwilę na złożenie sensu z kontekstu.</p>
              </div>
              <div className="gtk-card">
                <h4>Cieniowanie (Shadowing)</h4>
                <p>Powtarzaj na głos krótkie fragmenty audio, kopiując dokładnie ich intonację i melodię.</p>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">5</span> Mówienie bez paraliżu (Komunikacja, nie egzamin)</h3>
            <div className="gtk-cards">
              <div className="gtk-card">
                <h4>Reguła 80% prostoty</h4>
                <p>Przestań tłumaczyć skomplikowane polskie myśli 1:1. Zamiast „zaistniały nieprzewidziane okoliczności”, powiedz prosto: <em>a problem happened</em>.</p>
              </div>
              <div className="gtk-card">
                <h4>Gotowe szablony na start</h4>
                <p>Używaj automatycznych zwrotów (The point is..., To be honest..., As far as I know...), by zyskać 3 sekundy na ułożenie myśli.</p>
              </div>
              <div className="gtk-card">
                <h4>Opisuj zamiast się zacinać (Circumlocution)</h4>
                <p>Nie pamiętasz słowa? Opisz jego funkcję (the tool for..., the thing to open wine). Robią tak nawet rodzimi użytkownicy języka.</p>
              </div>
              <div className="gtk-card">
                <h4>Głośny monolog bez świadków</h4>
                <p>Opisuj na głos proste czynności w domu lub samochodzie (I'm making tea, the traffic is terrible). Budujesz w ten sposób pamięć mięśniową aparatu mowy.</p>
              </div>
              <div className="gtk-card">
                <h4>Naturalne pauzery</h4>
                <p>Gdy potrzebujesz chwili do namysłu, powiedz <em>Well...</em>, <em>Let me think...</em> zamiast zapadać w paraliżującą ciszę.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {!onOpenNBack && (
        <DualNBackModal isOpen={localModalOpen} onClose={() => setLocalModalOpen(false)} />
      )}
      {!onOpenBreathing && (
        <BreathingModal isOpen={localBreathingOpen} onClose={() => setLocalBreathingOpen(false)} />
      )}
      {!onOpenPhonemic && (
        <PhonemicFluencyModal isOpen={localPhonemicOpen} onClose={() => setLocalPhonemicOpen(false)} />
      )}
      {!onOpenSemantic && (
        <SemanticFluencyModal isOpen={localSemanticOpen} onClose={() => setLocalSemanticOpen(false)} />
      )}
    </div>
  );
};

export default GoodToKnow;
