/**
 * GeminiLiveClient.js
 * 
 * Klient połączenia czasu rzeczywistego (WebSockets + Web Audio API) dla technologii 
 * Gemini Multimodal Live API (Google AI Studio oraz Vertex AI / Google Cloud Platform).
 * 
 * Cechy:
 * - Dwukierunkowe strumieniowanie audio PCM 16kHz (Linear PCM 16-bit little-endian)
 * - Bezszwowe odtwarzanie dźwięku z Gemini (PCM 24kHz) z minimalnym opóźnieniem
 * - Błyskawiczne przerywanie mowy lektora (Barge-in / Interruption handling)
 * - Przekazywanie poziomów głośności RMS do animacji Orba (user i bot)
 * - Wsparcie dla wielomodalności (Multimodal Vision: wysyłanie klatek wideo z kamery/ekranu)
 * - Śledzenie transkrypcji na żywo
 */
import { API_BASE_URL } from '../config';

export class GeminiLiveClient {
  constructor(options = {}) {
    this.provider = options.provider || 'google_ai_studio'; // 'google_ai_studio' | 'vertex_ai'
    this.apiKey = options.apiKey || '';
    this.token = options.token || '';
    this.wsUrl = options.wsUrl || '';
    this.model = options.model || 'gemini-2.5-flash-native-audio-latest';
    this.voiceName = options.voiceName || 'Puck'; // Puck, Charon, Kore, Fenrir, Aoede
    this.systemInstruction = options.systemInstruction || 
      "You are Speakling, an enthusiastic, friendly and warm native English tutor. Your goal is to help the student practice speaking English naturally. Keep your spoken responses concise, conversational, and encouraging, giving the student plenty of speaking time. Speak with a natural, friendly tone.";
    this.initialGreetingPrompt = options.initialGreetingPrompt || null;

    // Callbacks
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onBotSpeaking = options.onBotSpeaking || (() => {});
    this.onUserVolume = options.onUserVolume || (() => {});
    this.onBotVolume = options.onBotVolume || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onQuotaExceeded = options.onQuotaExceeded || (() => {});
    this.onRemainingTimeWarning = options.onRemainingTimeWarning || (() => {});
    this.maxDurationSeconds = typeof options.maxDurationSeconds === 'number' ? options.maxDurationSeconds : null;
    this.quotaTicker = null;
    this.warningGiven = false;

    // WebSocket
    this.ws = null;
    this.isConnected = false;

    // Web Audio Input (Mikrofon)
    this.inputAudioContext = null;
    this.mediaStream = null;
    this.audioSourceNode = null;
    this.scriptProcessorNode = null;
    this.speechRecognition = null;
    this.lastUserTranscript = '';
    this.savedTurnPrefixText = '';
    this.userTurnStartIndex = 0;
    this.lastSpeechResultLength = 0;
    this.isDestroyed = false;
    this.turnSeq = 0;
    this.currentUserTurnId = null;
    this.currentUserTurnText = '';
    this.hasServerUserTranscription = false;
    this.lastCompletedUserTurn = null;
    this.hasUserSpokenSinceBotStarted = false;
    this.currentUserAudioChunks = [];
    this.userPreRollChunks = [];
    this.userAudioSpeechFrames = 0;
    this.userAudioHangoverFrames = 0;

    // Web Audio Output (Odtwarzanie Gemini)
    this.outputAudioContext = null;
    this.audioQueue = [];
    this.scheduledSources = [];
    this.nextPlayTime = 0;
    this.isBotCurrentlySpeaking = false;
    this.checkSpeakingInterval = null;

    // Multimodal Video (Kamera)
    this.videoStream = null;
    this.videoFrameInterval = null;
    this.videoElement = null;

    this.apiBaseUrl = options.apiBaseUrl || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5001' : (API_BASE_URL || ''));
    this.sessionToken = options.sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    this.userEmail = options.userEmail || null;

    // Monitorowanie kosztów i zużycia tokenów Gemini Live
    this.sessionStartTime = null;
    this.sessionPromptTokens = 0;
    this.sessionCompletionTokens = 0;
    this.maxSeenTokens = 0;
    this.usageReported = false;
    this.lastTrackedSeconds = 0;

    // Bufor aktualnej wypowiedzi lektora
    this.currentBotTurnId = null;
    this.currentBotTurnText = '';
    this.hasModelTurnSpokenText = false;
    this.currentTurnAudioChunks = [];
    this.botTurnStarted = false;
    this.pendingTranscriptions = new Set();

    // Ochrona przed echem akustycznym z głośników komputera (bez słuchawek)
    this.lastBotSpeakingEndTime = 0;
    this.recentBotPhrases = [];
  }

  /**
   * Nawiązuje połączenie z Gemini Live API
   */
  async connect() {
    this.onStatusChange('connecting');

    try {
      // 1. Odblokowujemy Web Audio Output natychmiast w ramach bezpośredniego gestu użytkownika (kliknięcie Orb)
      await this.initOutputAudio();

      // 2. Ustalenie docelowego adresu WebSocket
      const url = this.buildWebSocketUrl();
      if (!url) {
        throw new Error("Brak prawidłowego adresu WebSocket lub klucza uwierzytelniającego.");
      }

      console.log(`[GeminiLive] Łączenie z WebSocket (${this.provider})...`);
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log("[GeminiLive] Połączenie WebSocket otwarte. Wysyłam ramkę setup...");
        this.sessionStartTime = Date.now();
        this.usageReported = false;
        this.sendSetupFrame();
        this.isConnected = true;

        // Inicjalizacja mikrofonu
        await this.initInputAudio();

        this.onStatusChange('listening');

        // Rozpoczęcie trackera twardego limitu czasu sesji
        if (this.quotaTicker) {
          clearInterval(this.quotaTicker);
          this.quotaTicker = null;
        }
        this.sessionStartTime = Date.now();
        this.lastTrackedSeconds = 0;

        this.quotaTicker = setInterval(async () => {
          if (!this.isConnected || !this.sessionStartTime || this.isDestroyed) return;
          const elapsedSec = Math.round((Date.now() - this.sessionStartTime) / 1000);

          if (this.maxDurationSeconds !== null) {
            const remaining = this.maxDurationSeconds - elapsedSec;
            if (remaining <= 60 && remaining > 0 && !this.warningGiven) {
              this.warningGiven = true;
              this.onRemainingTimeWarning(remaining);
            }
            if (remaining <= 0) {
              console.warn("[GeminiLive] Osiągnięto limit minut sesji Live AI.");
              clearInterval(this.quotaTicker);
              this.quotaTicker = null;
              this.onQuotaExceeded({
                elapsedSeconds: elapsedSec,
                reason: "Twój limit minut sesji Live AI został wyczerpany."
              });
              this.cleanup();
              return;
            }
          }

          // Co 30 sekund synchronizuj z backendem wyłącznie nowo upłynięte sekundy
          if (elapsedSec - this.lastTrackedSeconds >= 30) {
            const secondsToTrack = elapsedSec - this.lastTrackedSeconds;
            this.lastTrackedSeconds = elapsedSec;
            try {
              const res = await fetch(`${this.apiBaseUrl}/api/subscription/track-live-time`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Session-Token': this.sessionToken || ''
                },
                body: JSON.stringify({
                  duration_seconds: secondsToTrack,
                  user_email: this.userEmail
                })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.quota_exceeded) {
                  console.warn("[GeminiLive] Backend zgłosił wyczerpanie limitu minut!");
                  clearInterval(this.quotaTicker);
                  this.quotaTicker = null;
                  this.onQuotaExceeded({
                    elapsedSeconds: elapsedSec,
                    reason: "Twój limit minut sesji Live AI został wyczerpany."
                  });
                  this.cleanup();
                }
              }
            } catch (err) {
              // Błąd sieci przy pingu - nie przerywamy natychmiast
            }
          }
        }, 1000);
      };

      this.ws.onmessage = async (event) => {
        await this.handleServerMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error("[GeminiLive] Błąd WebSocket:", err);
        this.onError("Błąd połączenia WebSocket z Gemini Live.");
      };

      this.ws.onclose = (event) => {
        console.log(`[GeminiLive] WebSocket zamknięty (kod: ${event.code}, powód: ${event.reason})`);
        this.cleanup();
        this.isConnected = false;

        if (event.code !== 1000 && event.code !== 1005) {
          let friendlyReason = "";
          if (event.reason && (event.reason.includes("invalid authentication") || event.code === 1008)) {
            friendlyReason = "Invalid Google AI Studio API Key. Please paste a valid API key (starting with AIzaSy) in Settings or switch to Classic Mode (OpenAI).";
          } else if (event.reason) {
            friendlyReason = `Google AI Studio: ${event.reason} (code ${event.code})`;
          } else if (event.code === 1008) {
            friendlyReason = "Google AI Studio rejected connection (code 1008). Please check your Google AI Studio API key in Settings or switch to OpenAI mode.";
          } else if (event.code === 1007) {
            friendlyReason = "Google AI Studio reported data format or unsupported model error (code 1007).";
          } else if (event.code === 1006) {
            friendlyReason = "Gemini Live WebSocket connection closed unexpectedly (code 1006). Please verify your API key.";
          } else {
            friendlyReason = `Gemini Live connection closed (code ${event.code}).`;
          }
          this.onError(friendlyReason);
        }

        this.onClose(event);
        this.onStatusChange('inactive');
      };

    } catch (err) {
      console.error("[GeminiLive] Inicjalizacja nie powiodła się:", err);
      this.cleanup();
      this.onError(err.message || "Nie udało się połączyć z Gemini Live.");
      this.onStatusChange('inactive');
    }
  }

  /**
   * Buduje adres WebSocket zależnie od wybranego dostawcy
   */
  buildWebSocketUrl() {
    if (this.wsUrl) {
      if (this.wsUrl.includes("BidiGenerateContentConstrained") && this.wsUrl.includes("?key=")) {
        return this.wsUrl.replace("?key=", "?access_token=");
      }
      return this.wsUrl;
    }

    if (this.provider === 'google_ai_studio') {
      if (this.token) {
        return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(this.token)}`;
      }
      if (this.apiKey) {
        return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
      }
    }

    if (this.provider === 'vertex_ai' && this.token) {
      const region = 'us-central1';
      return `wss://${region}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?access_token=${encodeURIComponent(this.token)}`;
    }

    return null;
  }

  /**
   * Wysyła wstępną konfigurację sesji (BidiGenerateContentSetup)
   */
  sendSetupFrame() {
    const formattedModel = this.model.startsWith('models/') ? this.model : `models/${this.model}`;

    const setupMessage = {
      setup: {
        model: formattedModel,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName || "Puck"
              }
            }
          }
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
            prefixPaddingMs: 300,
            silenceDurationMs: 1600
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [
            {
              text: this.systemInstruction
            }
          ]
        }
      }
    };

    this.sendJson(setupMessage);
  }

  /**
   * Inicjalizuje odtwarzanie dźwięku z Gemini (PCM 24 kHz)
   */
  async initOutputAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.outputAudioContext || this.outputAudioContext.state === 'closed') {
        this.outputAudioContext = new AudioContextClass();
      }
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }
      this.nextPlayTime = this.outputAudioContext.currentTime;

      if (!this.outputGainNode) {
        this.outputGainNode = this.outputAudioContext.createGain();
        this.outputGainNode.gain.value = 1.0;
        this.outputGainNode.connect(this.outputAudioContext.destination);
      }

      if (!this.checkSpeakingInterval) {
        // Monitorowanie czy lektor wciąż mówi
        this.checkSpeakingInterval = setInterval(() => {
          if (this.outputAudioContext) {
            const isSpeaking = this.outputAudioContext.currentTime < this.nextPlayTime - 0.05;
            if (isSpeaking !== this.isBotCurrentlySpeaking) {
              if (this.isBotCurrentlySpeaking && !isSpeaking) {
                // Lektor właśnie skończył mówić - zapisujemy czas zakończenia; nie kasujemy buforowanej tury ucznia!
                this.lastBotSpeakingEndTime = Date.now();
                if (!this.currentUserTurnId && !this.currentUserTurnText && !this.lastUserTranscript && !this.savedTurnPrefixText && this.userAudioSpeechFrames === 0) {
                  this.userTurnStartIndex = this.lastSpeechResultLength || 0;
                }
              }
              this.isBotCurrentlySpeaking = isSpeaking;
              this.onBotSpeaking(isSpeaking);
            }
          }
        }, 80);
      }
    } catch (e) {
      console.warn("[GeminiLive] Błąd inicjalizacji odtwarzania audio:", e);
    }
  }

  /**
   * Sprawdza czy aktywna jest ochrona przed echem akustycznym (tylko gdy lektor aktualnie odtwarza dźwięk - bez sztucznego okna po zakończeniu)
   */
  isEchoSuppressionActive() {
    return Boolean(this.isBotCurrentlySpeaking);
  }

  /**
   * Sprawdza czy dany tekst z SpeechRecognition jest echem słów wypowiedzianych przez lektora przez głośniki
   */
  isMatchingRecentBotText(userText) {
    if (!userText) return false;
    const cleanUser = userText.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
    if (!cleanUser || cleanUser.length < 4) return false;

    // Zbieramy frazy lektora: bieżącą oraz ostatnie
    const candidates = [];
    if (this.currentBotTurnText && this.currentBotTurnText.trim()) {
      candidates.push(this.currentBotTurnText.trim());
    }
    if (this.recentBotPhrases && this.recentBotPhrases.length > 0) {
      candidates.push(...this.recentBotPhrases);
    }
    if (candidates.length === 0) return false;

    const userWords = cleanUser.split(/\s+/).filter(w => w.length > 2);
    if (userWords.length === 0) return false;

    for (const phrase of candidates) {
      const cleanBot = phrase.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
      if (!cleanBot) continue;

      // 1. Jeśli wypowiedź ucznia zawiera się w mowie bota (np. mikrofon wychwycił fragment zdania z głośnika)
      if (cleanUser.length >= 10 && cleanBot.includes(cleanUser)) {
        return true;
      }

      // 2. Jeśli mowa bota zawiera się w wypowiedzi (np. całe zdanie lektora wpadło do mikrofonu)
      if (cleanBot.length >= 10 && cleanUser.includes(cleanBot)) {
        return true;
      }

      // 3. Pokrycie słów: jeśli większość słów (>= 60%) to słowa z wypowiedzi lektora
      if (userWords.length >= 2) {
        const botWords = new Set(cleanBot.split(/\s+/));
        let matchCount = 0;
        for (const w of userWords) {
          if (botWords.has(w)) matchCount++;
        }
        if (matchCount / userWords.length >= 0.6) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Inicjalizuje mikrofon i konwersję do 16kHz PCM Little-Endian
   */
  async initInputAudio() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.inputAudioContext = new AudioContextClass();
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      this.audioSourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);

      // Używamy bufora 2048 próbek (około 40-50ms)
      const bufferSize = 2048;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(bufferSize, 1, 1);

      // Wyciszamy bezpośrednie wyjście mikrofonu na głośniki za pomocą GainNode o wzmocnieniu 0
      this.inputMuteGain = this.inputAudioContext.createGain();
      this.inputMuteGain.gain.value = 0;

      this.audioSourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputMuteGain);
      this.inputMuteGain.connect(this.inputAudioContext.destination);

      const targetSampleRate = 16000;
      const nativeSampleRate = this.inputAudioContext.sampleRate;

      this.scriptProcessorNode.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Obliczanie poziomu RMS głośności mowy użytkownika
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Ochrona przed echem akustycznym bez słuchawek:
        // Kiedy lektor aktywnie mówi, przepuszczamy wyraźny głos użytkownika (Barge-in >= 0.04),
        // a przy niższej głośności utrzymujemy ciągłość strumienia zerowym PCM (żeby VAD po stronie Gemini nie tracił taktowania)
        // oraz zbieramy pre-roll na wypadek wczesnego początku wypowiedzi.
        const isSuppressed = this.isEchoSuppressionActive() && rms <= 0.04;
        if (this.isEchoSuppressionActive() && rms > 0.04) {
          console.log("[GeminiLive] Wykryto wtrącenie użytkownika (Barge-in). Zatrzymuję lektora.");
          this.stopBotAudio();
        }

        this.onUserVolume(isSuppressed ? 0 : rms);

        // Resampling do 16000 Hz, jeśli natywna częstotliwość karty dźwiękowej jest inna (np. 44100 / 48000 Hz)
        const resampledData = isSuppressed
          ? new Float32Array(Math.max(1, Math.round(inputData.length / (nativeSampleRate / targetSampleRate))))
          : this.resampleAudio(inputData, nativeSampleRate, targetSampleRate);

        // Buforowanie mowy użytkownika (16kHz PCM) jako zapas dla transkrypcji EN+PL przez backend
        if (!isSuppressed) {
          const isSpeechFrame = rms > 0.006;
          if (isSpeechFrame) {
            if (this.botTurnStarted) {
              this.hasUserSpokenSinceBotStarted = true;
            }
            if (this.userAudioSpeechFrames === 0 && this.userPreRollChunks.length > 0) {
              this.currentUserAudioChunks.push(...this.userPreRollChunks);
              this.userPreRollChunks = [];
            }
            this.userAudioSpeechFrames += 1;
            this.userAudioHangoverFrames = 18; // ~0.75s ogona po zakończeniu słowa
            if (this.currentUserAudioChunks.length < 600) {
              this.currentUserAudioChunks.push(new Float32Array(resampledData));
            }
          } else if (this.userAudioHangoverFrames > 0) {
            this.userAudioHangoverFrames -= 1;
            if (this.currentUserAudioChunks.length < 600) {
              this.currentUserAudioChunks.push(new Float32Array(resampledData));
            }
          } else {
            this.userPreRollChunks.push(new Float32Array(resampledData));
            if (this.userPreRollChunks.length > 12) {
              this.userPreRollChunks.shift();
            }
          }
        } else {
          const rawResampled = this.resampleAudio(inputData, nativeSampleRate, targetSampleRate);
          this.userPreRollChunks.push(new Float32Array(rawResampled));
          if (this.userPreRollChunks.length > 12) {
            this.userPreRollChunks.shift();
          }
        }

        // Konwersja do 16-bit PCM Little Endian
        const pcm16Buffer = this.floatTo16BitPCM(resampledData);

        // Konwersja na Base64
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

        // Wysłanie paczki audio do Gemini Live
        const realtimeAudioMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        };

        this.sendJson(realtimeAudioMessage);
      };

      // Inicjalizacja pomocniczego rozpoznawania mowy dla podglądu transkrypcji ucznia
      this.initSpeechRecognition();

    } catch (err) {
      console.error("[GeminiLive] Błąd konfiguracji mikrofonu:", err);
      throw new Error("Brak dostępu do mikrofonu: " + err.message);
    }
  }

  nextTurnId(sender) {
    this.turnSeq += 1;
    return `${sender}-live-${Date.now()}-${this.turnSeq}`;
  }

  ensureUserTurnId() {
    if (!this.currentUserTurnId) {
      this.currentUserTurnId = this.nextTurnId('user');
    }
    return this.currentUserTurnId;
  }

  mergeStreamText(current, fragment) {
    if (!fragment) return current || '';
    if (!current) return fragment;
    if (fragment.startsWith(current) && fragment.length >= current.length) {
      return fragment;
    }
    const cleanCurr = current.trimEnd();
    const cleanFrag = fragment.trim();
    if (cleanFrag.length > 4 && cleanCurr.endsWith(cleanFrag)) {
      return current;
    }
    return current + fragment;
  }

  formatTranscriptText(raw) {
    return (raw || '').replace(/\s+/g, ' ').trim();
  }

  seedTurnFromBrowserPrefix(browserText, firstServerFragment) {
    const cleanBrowser = this.formatTranscriptText(browserText);
    const cleanFrag = this.formatTranscriptText(firstServerFragment);
    if (!cleanBrowser) return firstServerFragment || '';
    if (!cleanFrag) return cleanBrowser;

    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    const bWords = norm(cleanBrowser);
    const sWords = norm(cleanFrag);
    if (bWords.length === 0 || sWords.length === 0) return firstServerFragment;

    const sSet = new Set(sWords);
    let overlapCount = 0;
    for (const w of bWords) {
      if (sSet.has(w)) overlapCount += 1;
    }
    // Jeśli pierwszy fragment z serwera już zawiera początek wypowiedzi (ten sam tekst z ASR), używamy wersji serwerowej bez dublowania
    if (overlapCount / bWords.length >= 0.4 || bWords.some((w) => w === sWords[0] && w.length >= 3)) {
      return firstServerFragment;
    }
    return `${cleanBrowser} ${firstServerFragment.trimStart()}`;
  }

  finalizeUserTurn() {
    const turnId = this.currentUserTurnId || this.nextTurnId('user');
    const text = this.formatTranscriptText(this.currentUserTurnText || this.lastUserTranscript);
    const hadServerText = this.hasServerUserTranscription;
    const userAudioChunks = this.currentUserAudioChunks;
    const hadSpeechAudio = this.userAudioSpeechFrames >= 3;

    if (text) {
      this.onTranscript({
        id: turnId,
        sender: 'user',
        text,
        isFinal: true
      });
    }

    // Jeśli serwer Gemini Live nie przysłał własnej transkrypcji inputTranscription
    // (np. ChromeSpeech zawiódł, użytkownik użył polskich wtrąceń albo Safari nie ma SpeechRecognition),
    // zlecamy dokładną dwujęzyczną transkrypcję zapisanego audio ucznia w tle.
    if (!hadServerText && hadSpeechAudio && userAudioChunks && userAudioChunks.length > 0) {
      this.lastCompletedUserTurn = {
        id: turnId,
        rawText: this.currentUserTurnText || text || '',
        hadServerText: false
      };
      this.transcribeAudioTurn(userAudioChunks, 16000, 'user', turnId, 'user_turn.wav');
    } else if (text || hadServerText) {
      this.lastCompletedUserTurn = {
        id: turnId,
        rawText: this.currentUserTurnText || text || '',
        hadServerText
      };
    } else {
      this.lastCompletedUserTurn = null;
    }

    // Natychmiast po wysłaniu/zleceniu sfinalizowanej tury użytkownika, zerujemy stan nowej tury:
    this.currentUserTurnId = null;
    this.currentUserTurnText = '';
    this.lastUserTranscript = '';
    this.savedTurnPrefixText = '';
    this.hasServerUserTranscription = false;
    this.currentUserAudioChunks = [];
    this.userPreRollChunks = [];
    this.userAudioSpeechFrames = 0;
    this.userAudioHangoverFrames = 0;
    this.userTurnStartIndex = this.lastSpeechResultLength || 0;
  }

  resetUserTurnIndex() {
    this.userTurnStartIndex = this.lastSpeechResultLength || 0;
    this.savedTurnPrefixText = '';
    this.lastUserTranscript = '';
    this.currentUserTurnId = null;
    this.currentUserTurnText = '';
    this.hasServerUserTranscription = false;
    this.currentUserAudioChunks = [];
    this.userPreRollChunks = [];
    this.userAudioSpeechFrames = 0;
    this.userAudioHangoverFrames = 0;
  }

  /**
   * Pomocnicze rozpoznawanie mowy przeglądarki (do zapisu słów ucznia w transkrypcji)
   */
  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    this.userTurnStartIndex = 0;
    this.savedTurnPrefixText = '';
    this.lastSpeechResultLength = 0;
    this.lastUserTranscript = '';

    const startRec = () => {
      if (this.isDestroyed || !this.isConnected) return;

      try {
        if (this.speechRecognition) {
          try {
            this.speechRecognition.onresult = null;
            this.speechRecognition.onend = null;
            this.speechRecognition.onerror = null;
            this.speechRecognition.abort();
          } catch (e) {}
          this.speechRecognition = null;
        }

        const rec = new SpeechRec();
        this.speechRecognition = rec;
        rec.lang = 'en-US';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event) => {
          if (!event || !event.results) return;

          // Ochrona przed echem akustycznym bez słuchawek:
          // Jeśli lektor mówi lub dźwięk z głośników właśnie wygasł, odrzucamy dźwięk
          if (this.isEchoSuppressionActive()) {
            return;
          }

          this.lastSpeechResultLength = event.results.length;

          // Jeśli Chrome zresetował wyniki (nowa sesja po onend), zerujemy userTurnStartIndex
          if (event.results.length < this.userTurnStartIndex) {
            this.userTurnStartIndex = 0;
          }

          let sessionText = '';

          const startIdx = Math.min(this.userTurnStartIndex || 0, event.results.length);
          for (let i = startIdx; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res[0] && res[0].transcript) {
              sessionText += res[0].transcript + ' ';
            }
          }

          const combined = [this.savedTurnPrefixText, sessionText]
            .map((s) => (s ? s.trim() : ''))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!combined) return;

          // Odrzucenie echa lektora, jeśli treść pokrywa się ze słowami wypowiedzianymi przez bota
          if (this.isMatchingRecentBotText(combined)) {
            return;
          }

          // Jeśli otrzymujemy już dokładną transkrypcję bezpośrednio z serwera Gemini Live API,
          // unikamy nadpisywania jej przez lokalne SpeechRecognition przeglądarki
          if (this.hasServerUserTranscription && this.currentUserTurnText) {
            return;
          }

          if (combined !== this.lastUserTranscript) {
            this.lastUserTranscript = combined;
            this.onTranscript({
              id: this.ensureUserTurnId(),
              sender: 'user',
              text: combined,
              isFinal: false
            });
          }
        };

        rec.onend = () => {
          // Po automatycznym zatrzymaniu przez przeglądarkę (np. po milczeniu/pauzie):
          // Zapisujemy dotychczas wygenerowany tekst tury w savedTurnPrefixText
          if (this.lastUserTranscript && this.lastUserTranscript.trim()) {
            this.savedTurnPrefixText = this.lastUserTranscript.trim();
          }
          this.userTurnStartIndex = 0;

          // Auto-restart jeśli połączenie jest aktywne i klient nie został zniszczony
          if (this.isConnected && !this.isDestroyed) {
            setTimeout(() => {
              if (this.isConnected && !this.isDestroyed) {
                startRec();
              }
            }, 100);
          }
        };

        rec.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn("[GeminiLive] SpeechRecognition info:", e.error);
          }
        };

        rec.start();
      } catch (e) {
        console.warn("[GeminiLive] Nie udało się wystartować lokalnego SpeechRecognition:", e);
      }
    };

    startRec();
  }

  /**
   * Obsługa przychodzących wiadomości z Gemini Live API
   */
  async handleServerMessage(rawData) {
    let message;
    try {
      if (typeof rawData === 'string') {
        message = JSON.parse(rawData);
      } else if (rawData instanceof Blob) {
        const text = await rawData.text();
        message = JSON.parse(text);
      } else if (rawData instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(rawData);
        message = JSON.parse(text);
      }
    } catch (e) {
      console.warn("[GeminiLive] Błąd parsowania ramki JSON:", e);
      return;
    }

    if (!message) return;

    // Monitorowanie zużycia tokenów Gemini Live (usageMetadata)
    const usage = message.usageMetadata || (message.serverContent && message.serverContent.usageMetadata);
    if (usage) {
      const pTokens = usage.promptTokenCount || 0;
      const cTokens = usage.candidatesTokenCount || 0;
      const tTokens = usage.totalTokenCount || (pTokens + cTokens);
      if (tTokens > 0) {
        if (tTokens >= this.maxSeenTokens) {
          this.sessionPromptTokens = pTokens;
          this.sessionCompletionTokens = cTokens;
          this.maxSeenTokens = tTokens;
        } else {
          this.sessionPromptTokens += pTokens;
          this.sessionCompletionTokens += cTokens;
        }
      }
    }

    // 0. Potwierdzenie gotowości sesji przez Google AI Studio
    if (message.setupComplete) {
      console.log("[GeminiLive] Sesja skonfigurowana pomyślnie (setupComplete). Lektor rozpoczyna powitanie...");
      this.onStatusChange('active');
      this.sendInitialGreeting();
      return;
    }

    // 1. Sprawdzenie przerwania mowy lektora (Barge-in / User Interrupted)
    if (message.serverContent && message.serverContent.interrupted) {
      console.log("[GeminiLive] Wykryto przerwanie (interrupted = true). Wyciszam lektora natychmiast.");
      this.stopBotAudio();
      return;
    }

    // 2. Obsługa treści generowanych przez model
    let hasPartText = false;
    if (message.serverContent && message.serverContent.modelTurn) {
      if (!this.botTurnStarted) {
        this.botTurnStarted = true;
        this.hasUserSpokenSinceBotStarted = false;
        this.currentBotTurnId = this.nextTurnId('bot');
        this.currentBotTurnText = '';
        this.hasModelTurnSpokenText = false;
        this.finalizeUserTurn();
      }
      const parts = message.serverContent.modelTurn.parts || [];

      for (const part of parts) {
        // Audio PCM z Gemini (Google AI Studio przesyła inlineData: { mimeType: "audio/pcm;rate=24000", data: "..." })
        const audioData = part.inlineData || (part.mimeType && part.data ? part : null);
        if (audioData && audioData.mimeType && audioData.mimeType.startsWith('audio/pcm') && audioData.data) {
          let sampleRate = 24000;
          const match = audioData.mimeType.match(/rate=(\d+)/);
          if (match && match[1]) {
            sampleRate = parseInt(match[1], 10);
          }
          this.queueAudioChunk(audioData.data, sampleRate);
        }

        // Tekst wypowiedzi lektora (pomijamy myśli modelu: part.thought === true)
        if (part.text && !part.thought) {
          hasPartText = true;
          this.hasModelTurnSpokenText = true;
          this.currentBotTurnText = this.mergeStreamText(this.currentBotTurnText, part.text);
          const formattedBot = this.formatTranscriptText(this.currentBotTurnText);
          if (formattedBot) {
            this.onTranscript({
              id: this.currentBotTurnId || (this.currentBotTurnId = this.nextTurnId('bot')),
              sender: 'bot',
              text: formattedBot,
              isFinal: false
            });
          }
        }
      }
    }

    // Bezpośrednia transkrypcja mowy ucznia ze strumienia inputTranscription (jeśli przesłana przez Gemini Live)
    if (message.serverContent) {
      const inTr = message.serverContent.inputTranscription || 
                   message.serverContent.input_transcription ||
                   message.serverContent.interimInputTranscription ||
                   message.serverContent.interim_input_transcription ||
                   message.inputTranscription ||
                   message.input_transcription;
      const rawFragment = inTr && typeof inTr.text === 'string' ? inTr.text : '';
      if (rawFragment && rawFragment.trim()) {
        // Jeśli inputTranscription spłynęło z małym opóźnieniem już po starcie odpowiedzi bota,
        // przypinamy je do poprzedniej tury użytkownika (aktualizacja w miejscu zamiast dzielenia dymków).
        if (this.botTurnStarted && !this.hasUserSpokenSinceBotStarted && this.lastCompletedUserTurn) {
          this.lastCompletedUserTurn.rawText = this.mergeStreamText(
            this.lastCompletedUserTurn.hadServerText ? this.lastCompletedUserTurn.rawText : '',
            rawFragment
          );
          this.lastCompletedUserTurn.hadServerText = true;
          const updatedUserText = this.formatTranscriptText(this.lastCompletedUserTurn.rawText);
          if (updatedUserText) {
            this.onTranscript({
              id: this.lastCompletedUserTurn.id,
              sender: 'user',
              text: updatedUserText,
              isFinal: true
            });
          }
        } else {
          this.currentUserTurnText = this.hasServerUserTranscription
            ? this.mergeStreamText(this.currentUserTurnText, rawFragment)
            : this.seedTurnFromBrowserPrefix(this.lastUserTranscript || this.savedTurnPrefixText, rawFragment);
          this.hasServerUserTranscription = true;
          const formattedUser = this.formatTranscriptText(this.currentUserTurnText);
          if (formattedUser) {
            this.lastUserTranscript = formattedUser;
            this.onTranscript({
              id: this.ensureUserTurnId(),
              sender: 'user',
              text: formattedUser,
              isFinal: Boolean(inTr.finished)
            });
          }
        }
      }
    }

    // Bezpośrednia transkrypcja mowy lektora ze strumienia outputTranscription (jeśli przesłana przez Gemini)
    if (message.serverContent) {
      const outTr = message.serverContent.outputTranscription || message.serverContent.output_transcription;
      if (outTr && typeof outTr.text === 'string' && outTr.text.length > 0 && !hasPartText && !this.hasModelTurnSpokenText) {
        this.currentBotTurnText = this.mergeStreamText(this.currentBotTurnText, outTr.text);
        const formattedBot = this.formatTranscriptText(this.currentBotTurnText);
        if (formattedBot) {
          this.onTranscript({
            id: this.currentBotTurnId || (this.currentBotTurnId = this.nextTurnId('bot')),
            sender: 'bot',
            text: formattedBot,
            isFinal: false
          });
        }
      }
    }

    // 3. Koniec tury lektora
    if (message.serverContent && message.serverContent.turnComplete) {
      this.botTurnStarted = false;
      this.hasUserSpokenSinceBotStarted = false;
      const finishedBotTurnId = this.currentBotTurnId || this.nextTurnId('bot');
      const finalBotText = this.formatTranscriptText(this.currentBotTurnText);
      const chunksForFallback = this.currentTurnAudioChunks;
      this.currentBotTurnId = null;
      this.currentBotTurnText = '';
      this.hasModelTurnSpokenText = false;
      this.currentTurnAudioChunks = [];

      if (finalBotText) {
        this.recentBotPhrases.push(finalBotText);
        if (this.recentBotPhrases.length > 8) {
          this.recentBotPhrases.shift();
        }
        this.onTranscript({
          id: finishedBotTurnId,
          sender: 'bot',
          text: finalBotText,
          isFinal: true
        });
      } else {
        this.transcribeBotTurn(chunksForFallback, finishedBotTurnId);
      }
    }
  }

  /**
   * Wysyła krótką prośbę o powitanie ucznia natychmiast po połączeniu
   */
  sendInitialGreeting() {
    this.resetUserTurnIndex();
    const greetingText = this.initialGreetingPrompt || 
      "Hello! Please greet me warmly in English as my friendly tutor, introduce yourself briefly in 1-2 natural sentences, and ask how my day is going.";
    const greetingTurn = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: greetingText
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    this.sendJson(greetingTurn);
  }

  /**
   * Kolejkuje i odtwarza fragment audio 24kHz PCM
   */
  queueAudioChunk(base64Data, sampleRate = 24000) {
    if (!this.outputAudioContext) return;

    try {
      if (this.outputAudioContext.state === 'suspended') {
        this.outputAudioContext.resume().catch((err) => {
          console.warn("[GeminiLive] Wznowienie AudioContext:", err);
        });
      }

      const float32Array = this.base64ToFloat32Array(base64Data);
      if (!float32Array || float32Array.length === 0) return;

      // Zbieramy próbki bieżącej tury do późniejszej automatycznej transkrypcji
      this.currentTurnAudioChunks.push(float32Array);

      if (!this.botTurnStarted) {
        this.botTurnStarted = true;
        this.hasUserSpokenSinceBotStarted = false;
        this.currentBotTurnId = this.nextTurnId('bot');
        this.currentBotTurnText = '';
        this.hasModelTurnSpokenText = false;
        this.finalizeUserTurn();
      }
      if (!this.currentBotTurnText && !this.hasModelTurnSpokenText) {
        this.onTranscript({
          id: this.currentBotTurnId || (this.currentBotTurnId = this.nextTurnId('bot')),
          sender: 'bot',
          text: 'Speaking...',
          isFinal: false
        });
      }

      const audioBuffer = this.outputAudioContext.createBuffer(1, float32Array.length, sampleRate);
      if (audioBuffer.copyToChannel) {
        audioBuffer.copyToChannel(float32Array, 0);
      } else {
        audioBuffer.getChannelData(0).set(float32Array);
      }

      const sourceNode = this.outputAudioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputGainNode || this.outputAudioContext.destination);

      const currentTime = this.outputAudioContext.currentTime;
      const startTime = (this.nextPlayTime < currentTime) ? currentTime : this.nextPlayTime;
      sourceNode.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.scheduledSources.push(sourceNode);

      sourceNode.onended = () => {
        const index = this.scheduledSources.indexOf(sourceNode);
        if (index !== -1) {
          this.scheduledSources.splice(index, 1);
        }
      };

      if (!this.isBotCurrentlySpeaking) {
        this.isBotCurrentlySpeaking = true;
        this.onBotSpeaking(true);
      }

    } catch (e) {
      console.error("[GeminiLive] Błąd podczas odtwarzania fragmentu audio:", e);
    }
  }

  /**
   * Koduje tablicę Float32 do pliku WAV PCM 16-bit
   */
  encodeWAV(samples, sampleRate = 24000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  /**
   * Wspólny helper przesyłający bufor audio (PCM Float32) do /api/live/transcribe z aktualizacją konkretnego turnId.
   */
  transcribeAudioTurn(chunks, sampleRate, sender, turnId, filename) {
    if (!chunks || chunks.length === 0) {
      if (sender === 'bot' && turnId) {
        this.onTranscript({ id: turnId, sender: 'bot', text: '', remove: true, isFinal: true });
      }
      return Promise.resolve('');
    }

    let totalLength = 0;
    for (let i = 0; i < chunks.length; i++) {
      totalLength += chunks[i].length;
    }
    const minSamples = Math.round(sampleRate * 0.25);
    if (totalLength < minSamples) {
      if (sender === 'bot' && turnId) {
        this.onTranscript({ id: turnId, sender: 'bot', text: '', remove: true, isFinal: true });
      }
      return Promise.resolve('');
    }

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      combined.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    const promise = (async () => {
      try {
        const wavBuffer = this.encodeWAV(combined, sampleRate);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', blob, filename);
        if (this.userEmail) {
          formData.append('user_email', this.userEmail);
        }

        const headers = {};
        if (this.sessionToken) {
          headers['X-Session-Token'] = this.sessionToken;
        }

        const res = await fetch(`${this.apiBaseUrl}/api/live/transcribe`, {
          method: 'POST',
          headers,
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          const text = (data.text || '').trim();
          if (text) {
            if (sender === 'bot') {
              this.recentBotPhrases.push(text);
              if (this.recentBotPhrases.length > 8) {
                this.recentBotPhrases.shift();
              }
            }
            this.onTranscript({
              id: turnId,
              sender,
              text,
              isFinal: true
            });
            return text;
          }
        }
      } catch (e) {
        console.warn(`[GeminiLive] Błąd transkrypcji tury (${sender}):`, e);
      }

      if (sender === 'bot' && turnId) {
        this.onTranscript({ id: turnId, sender: 'bot', text: '', remove: true, isFinal: true });
      }
      return '';
    })();

    this.pendingTranscriptions.add(promise);
    promise.finally(() => this.pendingTranscriptions.delete(promise));
    return promise;
  }

  /**
   * Przesyła zarejestrowane audio tury lektora do backendu w celu uzyskania dokładnej transkrypcji
   */
  async transcribeBotTurn(explicitChunks = null, explicitTurnId = null) {
    const chunks = explicitChunks || this.currentTurnAudioChunks;
    const turnId = explicitTurnId || this.currentBotTurnId || this.nextTurnId('bot');
    if (!explicitChunks) {
      this.currentTurnAudioChunks = [];
    }
    return this.transcribeAudioTurn(chunks, 24000, 'bot', turnId, 'bot_turn.wav');
  }

  /**
   * Natychmiastowe zatrzymanie odtwarzania głosu lektora (Barge-in)
   */
  stopBotAudio() {
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    this.scheduledSources = [];

    const chunksToTranscribe = this.currentTurnAudioChunks;
    const partialBotTurnId = this.currentBotTurnId;
    const partialBotText = this.formatTranscriptText(this.currentBotTurnText);
    this.currentTurnAudioChunks = [];
    const wasTurnStarted = this.botTurnStarted;
    this.botTurnStarted = false;
    this.currentBotTurnId = null;
    this.currentBotTurnText = '';
    this.hasModelTurnSpokenText = false;

    if (this.outputAudioContext) {
      this.nextPlayTime = this.outputAudioContext.currentTime;
    }

    if (this.isBotCurrentlySpeaking) {
      this.lastBotSpeakingEndTime = Date.now();
    }
    this.isBotCurrentlySpeaking = false;
    this.onBotSpeaking(false);

    if (wasTurnStarted && partialBotText) {
      this.recentBotPhrases.push(partialBotText);
      if (this.recentBotPhrases.length > 8) {
        this.recentBotPhrases.shift();
      }
      if (partialBotTurnId) {
        this.onTranscript({
          id: partialBotTurnId,
          sender: 'bot',
          text: partialBotText,
          isFinal: true
        });
      }
    } else if (wasTurnStarted && chunksToTranscribe && chunksToTranscribe.length > 0) {
      this.transcribeBotTurn(chunksToTranscribe, partialBotTurnId);
    } else if (wasTurnStarted && partialBotTurnId) {
      this.onTranscript({ id: partialBotTurnId, sender: 'bot', text: '', remove: true, isFinal: true });
    }
  }

  /**
   * Multimodal Vision: Włączenie/Wyłączenie strumieniowania obrazu z kamery
   */
  async startCameraStream(videoElement) {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { max: 5 }
        }
      });

      this.videoElement = videoElement;
      if (this.videoElement) {
        this.videoElement.srcObject = this.videoStream;
        this.videoElement.play();
      }

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      // Wysyłamy 1 klatkę na sekundę
      this.videoFrameInterval = setInterval(() => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.videoElement || this.videoElement.readyState < 2) return;

        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64Data = dataUrl.split(',')[1];

        if (base64Data) {
          const videoFrameMessage = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              ]
            }
          };
          this.sendJson(videoFrameMessage);
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error("[GeminiLive] Błąd włączania kamery:", err);
      throw err;
    }
  }

  stopVideoStream() {
    if (this.videoFrameInterval) {
      clearInterval(this.videoFrameInterval);
      this.videoFrameInterval = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  stopCameraStream() {
    this.stopVideoStream();
  }

  stopScreenStream() {
    this.stopVideoStream();
  }

  /**
   * Multimodal Vision: Udostępnianie ekranu (Screen Sharing) w czasie rzeczywistym
   */
  async startScreenStream(videoElement, onStopCallback) {
    try {
      this.stopVideoStream();

      this.videoStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { max: 5 }
        },
        audio: false
      });

      const videoTrack = this.videoStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopVideoStream();
          if (typeof onStopCallback === 'function') {
            onStopCallback();
          }
        };
      }

      this.videoElement = videoElement;
      if (this.videoElement) {
        this.videoElement.srcObject = this.videoStream;
        this.videoElement.play().catch(e => console.warn("Video play error:", e));
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 576;
      const ctx = canvas.getContext('2d');

      // Wysyłamy klatkę co 1000ms do Gemini Multimodal Live API
      this.videoFrameInterval = setInterval(() => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.videoElement || this.videoElement.readyState < 2) return;

        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        const base64Data = dataUrl.split(',')[1];

        if (base64Data) {
          const videoFrameMessage = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              ]
            }
          };
          this.sendJson(videoFrameMessage);
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error("[GeminiLive] Błąd udostępniania ekranu:", err);
      throw err;
    }
  }

  /**
   * Wysłanie wiadomości tekstowej w trakcie aktywnej sesji Gemini Live
   */
  sendTextMessage(text) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const clientTurn = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: text
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    this.sendJson(clientTurn);
  }

  /**
   * Bezpieczne wysłanie obiektu JSON przez WebSocket
   */
  sendJson(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /**
   * Resampling tablicy Float32 z częstotliwości wejściowej na 16000 Hz
   */
  resampleAudio(audioBuffer, fromSampleRate, toSampleRate) {
    if (fromSampleRate === toSampleRate) return audioBuffer;

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(audioBuffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const leftIndex = Math.floor(originalIndex);
      const rightIndex = Math.min(leftIndex + 1, audioBuffer.length - 1);
      const interpolation = originalIndex - leftIndex;
      result[i] = audioBuffer[leftIndex] * (1 - interpolation) + audioBuffer[rightIndex] * interpolation;
    }

    return result;
  }

  /**
   * Konwersja Float32 [-1.0, 1.0] do 16-bit PCM Little Endian
   */
  floatTo16BitPCM(input) {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  /**
   * Konwersja Base64 PCM 16-bit Little Endian do Float32Array
   */
  base64ToFloat32Array(base64) {
    try {
      const sanitized = base64.replace(/\s/g, '');
      const binaryString = window.atob(sanitized);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataView = new DataView(bytes.buffer);
      const numSamples = Math.floor(bytes.length / 2);
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        samples[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
      }

      return samples;
    } catch (e) {
      console.warn("[GeminiLive] Błąd dekodowania Base64 PCM:", e);
      return null;
    }
  }

  /**
   * Konwersja ArrayBuffer na ciąg Base64
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Zgłasza do backendu statystyki sesji Gemini Live (czas trwania i zużycie tokenów) do monitora kosztów
   */
  async reportSessionUsage() {
    if (this.usageReported) return;
    this.usageReported = true;

    const durationSeconds = this.sessionStartTime
      ? Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000))
      : 0;

    // Raportuj jeśli sesja trwała co najmniej 2 sekundy lub naliczono jakiekolwiek tokeny
    if (durationSeconds < 2 && this.sessionPromptTokens === 0 && this.sessionCompletionTokens === 0) {
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.sessionToken) {
        headers['X-Session-Token'] = this.sessionToken;
      }
      await fetch(`${this.apiBaseUrl}/api/live/log-usage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: this.provider,
          model: this.model,
          prompt_tokens: this.sessionPromptTokens,
          completion_tokens: this.sessionCompletionTokens,
          duration_seconds: durationSeconds,
          user_email: this.userEmail
        })
      });
      console.log(`[GeminiLive] Zaraportowano zużycie sesji do monitora kosztów: ${durationSeconds}s, in: ${this.sessionPromptTokens}, out: ${this.sessionCompletionTokens}`);
    } catch (e) {
      console.warn("[GeminiLive] Błąd raportowania zużycia sesji do backendu:", e);
    }
  }

  /**
   * Finalizuje otwartą turę użytkownika/bota, czeka chwilę na transkrypcje w locie i sprząta zasoby
   */
  async finalizeAndCleanup(timeoutMs = 3500) {
    if (!this.isDestroyed) {
      if (this.currentUserTurnText || this.lastUserTranscript || this.userAudioSpeechFrames >= 3) {
        this.finalizeUserTurn();
      }
      this.cleanup();
    }
    if (this.pendingTranscriptions.size > 0) {
      try {
        await Promise.race([
          Promise.allSettled(Array.from(this.pendingTranscriptions)),
          new Promise((resolve) => setTimeout(resolve, timeoutMs))
        ]);
      } catch (e) {}
    }
  }

  /**
   * Pełne sprzątanie zasobów
   */
  cleanup() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.currentUserTurnText || this.lastUserTranscript || this.userAudioSpeechFrames >= 3) {
      this.finalizeUserTurn();
    }
    if (this.quotaTicker) {
      clearInterval(this.quotaTicker);
      this.quotaTicker = null;
    }

    // Dosyłamy pozostałe, niesynchronizowane sekundy z sesji (np. ostatnie 12 sekund)
    if (this.sessionStartTime) {
      const elapsedSec = Math.round((Date.now() - this.sessionStartTime) / 1000);
      const remainingSeconds = elapsedSec - (this.lastTrackedSeconds || 0);
      if (remainingSeconds >= 2) {
        this.lastTrackedSeconds = elapsedSec;
        try {
          fetch(`${this.apiBaseUrl}/api/subscription/track-live-time`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': this.sessionToken || ''
            },
            body: JSON.stringify({
              duration_seconds: remainingSeconds,
              user_email: this.userEmail
            })
          }).catch(() => {});
        } catch (eTrack) {}
      }
    }

    this.reportSessionUsage();
    this.isConnected = false;

    this.stopBotAudio();
    this.stopCameraStream();

    if (this.checkSpeakingInterval) {
      clearInterval(this.checkSpeakingInterval);
      this.checkSpeakingInterval = null;
    }

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
      this.speechRecognition = null;
    }

    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch (e) {}
      this.scriptProcessorNode = null;
    }

    if (this.inputMuteGain) {
      try {
        this.inputMuteGain.disconnect();
      } catch (e) {}
      this.inputMuteGain = null;
    }

    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect();
      } catch (e) {}
      this.audioSourceNode = null;
    }

    if (this.outputGainNode) {
      try {
        this.outputGainNode.disconnect();
      } catch (e) {}
      this.outputGainNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioContext) {
      try {
        if (this.inputAudioContext.state !== 'closed') {
          this.inputAudioContext.close();
        }
      } catch (e) {}
      this.inputAudioContext = null;
    }

    if (this.outputAudioContext) {
      try {
        if (this.outputAudioContext.state !== 'closed') {
          this.outputAudioContext.close();
        }
      } catch (e) {}
      this.outputAudioContext = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}
