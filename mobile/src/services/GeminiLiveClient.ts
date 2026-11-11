/**
 * GeminiLiveClient.ts (Mobile Web & React Native)
 * 
 * Klient połączenia czasu rzeczywistego (WebSockets + Web Audio API) dla technologii 
 * Gemini Multimodal Live API w aplikacji mobilnej Speakling.
 * 
 * Zoptymalizowany pod kątem iOS Safari:
 * - Pojedynczy współdzielony AudioContext dla nagrywania i odtwarzania
 * - Obsługa pre-inicjalizowanego MediaStream bezpośrednio z gestu użytkownika
 * - Odporność na ograniczenia WebKit
 */

export interface GeminiLiveOptions {
  provider?: 'google_ai_studio' | 'vertex_ai';
  apiKey?: string;
  token?: string;
  wsUrl?: string;
  model?: string;
  voiceName?: string;
  systemInstruction?: string;
  initialGreetingPrompt?: string;
  apiBaseUrl?: string;
  sessionToken?: string | null;
  userEmail?: string | null;
  mediaStream?: any;
  audioContext?: any;
  reuseMediaStream?: boolean;
  maxDurationSeconds?: number | null;
  idleTimeoutSeconds?: number;
  onRemainingTimeWarning?: (remainingSeconds: number) => void;
  onQuotaExceeded?: (info: { elapsedSeconds: number; reason: string }) => void;
  onStatusChange?: (status: 'inactive' | 'connecting' | 'listening' | 'user-speaking' | 'speaking' | 'active') => void;
  onBotSpeaking?: (isSpeaking: boolean) => void;
  onUserVolume?: (volume: number) => void;
  onBotVolume?: (volume: number) => void;
  onTranscript?: (transcript: { id?: string; sender: 'user' | 'bot'; text: string; isFinal: boolean; remove?: boolean }) => void;
  onError?: (err: string) => void;
  onClose?: (event: any) => void;
}

export class GeminiLiveClient {
  public provider: 'google_ai_studio' | 'vertex_ai';
  public apiKey: string;
  public token: string;
  public wsUrl: string;
  public model: string;
  public voiceName: string;
  public systemInstruction: string;
  public initialGreetingPrompt: string | null = null;
  public apiBaseUrl: string;
  public sessionToken: string | null;
  public userEmail: string | null;
  public reuseMediaStream: boolean = false;

  public onStatusChange: (status: 'inactive' | 'connecting' | 'listening' | 'user-speaking' | 'speaking' | 'active') => void;
  public onBotSpeaking: (isSpeaking: boolean) => void;
  public onUserVolume: (volume: number) => void;
  public onBotVolume: (volume: number) => void;
  public onTranscript: (transcript: { id?: string; sender: 'user' | 'bot'; text: string; isFinal: boolean; remove?: boolean }) => void;
  public onError: (err: string) => void;
  public onClose: (event: any) => void;
  public onRemainingTimeWarning: (remainingSeconds: number) => void;
  public onQuotaExceeded: (info: { elapsedSeconds: number; reason: string }) => void;

  private maxDurationSeconds: number | null = null;
  private idleTimeoutMs: number = 180000;
  private quotaTicker: any = null;
  private lastActivityTime: number | null = null;
  private lastTrackedSeconds: number = 0;
  private warningGiven: boolean = false;
  private isDestroyed: boolean = false;

  private ws: WebSocket | null = null;
  public isConnected = false;

  private audioContext: any = null;
  private mediaStream: any = null;
  private audioSourceNode: any = null;
  private scriptProcessorNode: any = null;
  private inputMuteGain: any = null;

  private outputGainNode: any = null;
  private keepAliveOsc: any = null;
  private keepAliveGain: any = null;
  private scheduledSources: any[] = [];
  private nextPlayTime = 0;
  private isBotCurrentlySpeaking = false;
  private checkSpeakingInterval: any = null;

  private sessionStartTime: number | null = null;
  private sessionPromptTokens = 0;
  private sessionCompletionTokens = 0;
  private maxSeenTokens = 0;
  private usageReported = false;

  private turnSeq = 0;
  private currentBotTurnId: string | null = null;
  private currentBotTurnText = '';
  private hasModelTurnSpokenText = false;
  private currentTurnAudioChunks: Float32Array[] = [];
  private botTurnStarted = false;
  private currentUserTurnId: string | null = null;
  private currentUserTurnText = '';
  private hasServerUserTranscription = false;
  private lastCompletedUserTurn: { id: string; text: string; hasServerTranscription: boolean; finalizedAt: number } | null = null;
  private currentUserAudioChunks: Float32Array[] = [];
  private userPreRollChunks: Float32Array[] = [];
  private userAudioSpeechFrames = 0;
  private isCapturingUserAudio = false;
  private pendingTranscriptions: Set<Promise<void>> = new Set();
  private recentBotPhrases: string[] = [];

  constructor(options: GeminiLiveOptions = {}) {
    this.provider = options.provider || 'google_ai_studio';
    this.apiKey = options.apiKey || '';
    this.token = options.token || '';
    this.wsUrl = options.wsUrl || '';
    this.model = options.model || 'gemini-2.5-flash-native-audio-latest';
    this.voiceName = options.voiceName || 'Puck';
    this.systemInstruction = options.systemInstruction || 
      "You are Speakling, an enthusiastic, friendly and warm native English tutor. Your goal is to help the student practice speaking English naturally. Keep your spoken responses concise, conversational, and encouraging, giving the student plenty of speaking time. Speak with a natural, friendly tone. If the student inserts any Polish word or phrase into their English sentence, gently teach them the natural English equivalent right away and model the corrected phrase warmly before continuing.";
    this.initialGreetingPrompt = options.initialGreetingPrompt || null;

    this.audioContext = options.audioContext || null;
    this.mediaStream = options.mediaStream || null;
    this.reuseMediaStream = !!options.reuseMediaStream;

    this.onStatusChange = options.onStatusChange || (() => {});
    this.onBotSpeaking = options.onBotSpeaking || (() => {});
    this.onUserVolume = options.onUserVolume || (() => {});
    this.onBotVolume = options.onBotVolume || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onRemainingTimeWarning = options.onRemainingTimeWarning || (() => {});
    this.onQuotaExceeded = options.onQuotaExceeded || (() => {});
    this.maxDurationSeconds = typeof options.maxDurationSeconds === 'number' ? options.maxDurationSeconds : null;
    if (typeof options.idleTimeoutSeconds === 'number' && options.idleTimeoutSeconds > 0) {
      this.idleTimeoutMs = options.idleTimeoutSeconds * 1000;
    }

    this.apiBaseUrl = options.apiBaseUrl || '';
    this.sessionToken = options.sessionToken || null;
    this.userEmail = options.userEmail || null;
  }

  async connect(): Promise<void> {
    this.onStatusChange('connecting');

    try {
      await this.initAudio();

      const url = this.buildWebSocketUrl();
      if (!url) {
        throw new Error("Brak prawidłowego adresu WebSocket lub tokena uwierzytelniającego.");
      }

      console.log(`[GeminiLive Mobile] Łączenie z WebSocket (${this.provider})...`);
      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.warn("[GeminiLive Mobile] Timeout połączenia WebSocket (12s)");
          this.cleanup();
          this.onError("Przekroczono limit czasu łączenia z Gemini Live. Sprawdź połączenie.");
        }
      }, 12000);

      this.ws.onopen = async () => {
        clearTimeout(connectTimeout);
        console.log("[GeminiLive Mobile] WebSocket otwarty. Wysyłam ramkę setup...");
        this.sessionStartTime = Date.now();
        this.lastActivityTime = Date.now();
        this.lastTrackedSeconds = 0;
        this.warningGiven = false;
        this.isDestroyed = false;
        this.usageReported = false;
        this.isConnected = true;

        try {
          this.sendSetupFrame();
          await this.startRecordingStream();
          this.onStatusChange('listening');
        } catch (setupErr: any) {
          console.error("[GeminiLive Mobile] Błąd w onopen:", setupErr);
          this.onError("Błąd mikrofonu po połączeniu: " + (setupErr.message || setupErr));
          return;
        }

        if (this.quotaTicker) {
          clearInterval(this.quotaTicker);
          this.quotaTicker = null;
        }
        this.quotaTicker = setInterval(async () => {
          if (!this.isConnected || !this.sessionStartTime || this.isDestroyed) return;
          const nowTs = Date.now();
          const elapsedSec = Math.round((nowTs - this.sessionStartTime) / 1000);

          if (this.lastActivityTime && (nowTs - this.lastActivityTime) >= this.idleTimeoutMs) {
            console.warn("[GeminiLive Mobile] Auto-rozłączenie po 3 minutach bezczynności.");
            clearInterval(this.quotaTicker);
            this.quotaTicker = null;
            this.onQuotaExceeded({
              elapsedSeconds: elapsedSec,
              reason: "Sesja Live AI została automatycznie wstrzymana po 3 minutach ciszy, aby chronić Twój limit minut."
            });
            this.cleanup();
            return;
          }

          if (this.maxDurationSeconds !== null) {
            const remaining = this.maxDurationSeconds - elapsedSec;
            if (remaining <= 60 && remaining > 0 && !this.warningGiven) {
              this.warningGiven = true;
              this.onRemainingTimeWarning(remaining);
            }
            if (remaining <= 0) {
              console.warn("[GeminiLive Mobile] Osiągnięto limit minut sesji Live AI.");
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

          if (elapsedSec - this.lastTrackedSeconds >= 30) {
            const deltaSeconds = elapsedSec - this.lastTrackedSeconds;
            this.lastTrackedSeconds = elapsedSec;
            try {
              const res = await fetch(`${this.apiBaseUrl}/api/subscription/track-live-time`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(this.sessionToken ? { 'X-Session-Token': this.sessionToken } : {})
                },
                body: JSON.stringify({ duration_seconds: deltaSeconds })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.quota_exceeded) {
                  clearInterval(this.quotaTicker);
                  this.quotaTicker = null;
                  this.onQuotaExceeded({
                    elapsedSeconds: elapsedSec,
                    reason: "Twój limit minut sesji Live AI został wyczerpany."
                  });
                  this.cleanup();
                }
              }
            } catch (e) {}
          }
        }, 1000);
      };

      this.ws.onmessage = async (event: any) => {
        try {
          await this.handleServerMessage(event.data);
        } catch (msgErr) {
          console.error("[GeminiLive Mobile] Błąd wiadomości serwera:", msgErr);
        }
      };

      this.ws.onerror = (err: any) => {
        clearTimeout(connectTimeout);
        console.error("[GeminiLive Mobile] Błąd WebSocket:", err);
        this.onError("Błąd połączenia WebSocket z Gemini Live.");
      };

      this.ws.onclose = (event: any) => {
        clearTimeout(connectTimeout);
        console.log(`[GeminiLive Mobile] WebSocket zamknięty (kod: ${event.code}, powód: ${event.reason})`);
        this.cleanup();
        this.isConnected = false;

        if (event.code !== 1000 && event.code !== 1005) {
          let friendlyReason = "";
          if (event.reason) {
            friendlyReason = `Google AI Studio: ${event.reason} (kod ${event.code})`;
          } else if (event.code === 1008) {
            friendlyReason = "Google AI Studio odrzuciło połączenie (kod 1008: Błąd uprawnień).";
          } else if (event.code === 1006) {
            friendlyReason = "Połączenie WebSocket z Gemini Live zostało przerwane (kod 1006).";
          } else {
            friendlyReason = `Połączenie z Gemini Live zakończone (kod ${event.code}).`;
          }
          this.onError(friendlyReason);
        }

        this.onClose(event);
        this.onStatusChange('inactive');
      };

    } catch (err: any) {
      console.error("[GeminiLive Mobile] Inicjalizacja nie powiodła się:", err);
      this.cleanup();
      this.onError(err.message || "Nie udało się połączyć z Gemini Live.");
      this.onStatusChange('inactive');
    }
  }

  buildWebSocketUrl(): string | null {
    if (this.wsUrl) {
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

  sendSetupFrame(): void {
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

  async initAudio(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.nextPlayTime = this.audioContext.currentTime;

      if (!this.outputGainNode) {
        this.outputGainNode = this.audioContext.createGain();
        this.outputGainNode.gain.value = 1.0;
        this.outputGainNode.connect(this.audioContext.destination);
      }

      // Keep-alive oscillator (zapobiega uśpieniu AudioContext przez iOS WebKit)
      if (!this.keepAliveOsc) {
        try {
          const osc = this.audioContext.createOscillator();
          const silentGain = this.audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.value = 440;
          silentGain.gain.value = 0.00001; // Całkowicie niesłyszalne (-100 dBFS), lecz utrzymuje wątek Web Audio aktywny
          osc.connect(silentGain);
          silentGain.connect(this.audioContext.destination);
          osc.start();
          this.keepAliveOsc = osc;
          this.keepAliveGain = silentGain;
          console.log("[GeminiLive Mobile] Aktywowano keep-alive oscylator (ochrona przed zawieszeniem WebKit).");
        } catch (oscErr) {
          console.warn("[GeminiLive Mobile] Błąd inicjalizacji keep-alive oscylatora:", oscErr);
        }
      }

      if (!this.checkSpeakingInterval) {
        this.checkSpeakingInterval = setInterval(() => {
          if (this.audioContext) {
            // W razie nieoczekiwanego uśpienia przez system próbujemy wznowić
            if (this.audioContext.state === 'suspended' && this.isConnected) {
              this.audioContext.resume().catch(() => {});
            }

            const isSpeaking = this.audioContext.currentTime < this.nextPlayTime - 0.05;
            if (isSpeaking !== this.isBotCurrentlySpeaking) {
              this.isBotCurrentlySpeaking = isSpeaking;
              this.onBotSpeaking(isSpeaking);
              if (!isSpeaking && this.isConnected) {
                this.onStatusChange('listening');
              }
            }
          }
        }, 80);
      }
    } catch (e) {
      console.warn("[GeminiLive Mobile] Błąd AudioContext:", e);
    }
  }

  public async resumeAudioContextIfSuspended(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log("[GeminiLive Mobile] AudioContext wznowiony przez akcję użytkownika.");
      } catch (e) {
        console.warn("[GeminiLive Mobile] Błąd resumeAudioContext:", e);
      }
    }
  }

  async startRecordingStream(): Promise<void> {
    try {
      if (!this.mediaStream) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
          throw new Error("Brak wsparcia dla nagrywania audio w tym środowisku.");
        }
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (e) {
          console.warn("[GeminiLive Mobile] Fallback do podstawowego audio: true:", e);
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }

      if (!this.audioContext) {
        await this.initAudio();
      }

      this.audioSourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      const bufferSize = 4096;
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.inputMuteGain = this.audioContext.createGain();
      this.inputMuteGain.gain.value = 0;

      this.audioSourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputMuteGain);
      this.inputMuteGain.connect(this.audioContext.destination);

      const targetSampleRate = 16000;
      const nativeSampleRate = this.audioContext.sampleRate;

      this.scriptProcessorNode.onaudioprocess = (e: any) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const isSuppressed = this.isBotCurrentlySpeaking && rms <= 0.16;
        if (this.isBotCurrentlySpeaking && rms > 0.16) {
          this.stopBotAudio();
        }
        this.onUserVolume(isSuppressed ? 0 : rms);

        const resampledData = isSuppressed
          ? new Float32Array(Math.max(1, Math.round(inputData.length / (nativeSampleRate / targetSampleRate))))
          : this.resampleAudio(inputData, nativeSampleRate, targetSampleRate);
        const pcm16Buffer = this.floatTo16BitPCM(resampledData);
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

        // Buforowanie 16kHz audio użytkownika do fallbackowego STT (/api/live/transcribe)
        if (!isSuppressed) {
          const SPEECH_RMS_THRESHOLD = 0.006;
          const chunkCopy = new Float32Array(resampledData);
          if (rms >= SPEECH_RMS_THRESHOLD) {
            if (!this.isCapturingUserAudio) {
              this.isCapturingUserAudio = true;
              if (this.userPreRollChunks.length > 0) {
                this.currentUserAudioChunks.push(...this.userPreRollChunks);
                this.userPreRollChunks = [];
              }
            }
            this.userAudioSpeechFrames += 1;
            this.lastActivityTime = Date.now();
          }
          if (this.isCapturingUserAudio) {
            if (this.currentUserAudioChunks.length < 450) {
              this.currentUserAudioChunks.push(chunkCopy);
            }
          } else {
            this.userPreRollChunks.push(chunkCopy);
            if (this.userPreRollChunks.length > 12) {
              this.userPreRollChunks.shift();
            }
          }
        }

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

    } catch (err: any) {
      console.error("[GeminiLive Mobile] Błąd mikrofonu:", err);
      throw new Error("Brak dostępu do mikrofonu: " + (err.message || err));
    }
  }

  private nextTurnId(sender: 'user' | 'bot'): string {
    this.turnSeq += 1;
    return `${sender}-turn-${Date.now()}-${this.turnSeq}`;
  }

  private ensureUserTurnId(): string {
    if (!this.currentUserTurnId) {
      this.currentUserTurnId = this.nextTurnId('user');
    }
    return this.currentUserTurnId;
  }

  private ensureBotTurnId(): string {
    if (!this.currentBotTurnId) {
      this.currentBotTurnId = this.nextTurnId('bot');
    }
    return this.currentBotTurnId;
  }

  private mergeStreamText(current: string, fragment: string): string {
    if (!fragment) return current;
    if (!current) return fragment;
    if (fragment.startsWith(current) && fragment.length > current.length) {
      return fragment;
    }
    if (current.endsWith(fragment) && fragment.trim().length > 2) {
      return current;
    }
    const needsSpace =
      /[A-Za-z0-9\p{L}.,!?;:)]$/u.test(current) &&
      /^[A-Za-z0-9\p{L}(]/u.test(fragment) &&
      !/\s$/.test(current) &&
      !/^\s/.test(fragment) &&
      fragment.length > 3 &&
      !fragment.startsWith("'") &&
      !fragment.startsWith("’");
    return needsSpace ? `${current} ${fragment}` : `${current}${fragment}`;
  }

  private formatTranscriptText(raw: string): string {
    return (raw || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private isMatchingRecentBotText(userText: string): boolean {
    if (!userText) return false;
    const cleanUser = userText.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
    if (!cleanUser || cleanUser.length < 4) return false;

    const candidates: string[] = [];
    if (this.currentBotTurnText && this.currentBotTurnText.trim()) {
      candidates.push(this.currentBotTurnText.trim());
    }
    if (this.recentBotPhrases.length > 0) {
      candidates.push(...this.recentBotPhrases);
    }
    if (candidates.length === 0) return false;

    const userWords = cleanUser.split(/\s+/).filter((w) => w.length > 2);
    if (userWords.length === 0) return false;

    for (const phrase of candidates) {
      const cleanBot = phrase.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
      if (!cleanBot) continue;
      if (cleanUser.length >= 12 && cleanBot.includes(cleanUser)) return true;
      if (cleanBot.length >= 12 && cleanUser.includes(cleanBot)) return true;
      if (userWords.length >= 3) {
        const botWords = new Set(cleanBot.split(/\s+/));
        let matchCount = 0;
        for (const w of userWords) {
          if (botWords.has(w)) matchCount++;
        }
        if (matchCount / userWords.length >= 0.65) return true;
      }
    }
    return false;
  }

  private pushBotPhrase(phrase: string): void {
    const clean = (phrase || '').trim();
    if (!clean) return;
    this.recentBotPhrases.push(clean);
    if (this.recentBotPhrases.length > 8) {
      this.recentBotPhrases.shift();
    }
    if (this.currentUserTurnId && this.isMatchingRecentBotText(this.currentUserTurnText)) {
      this.onTranscript({ id: this.currentUserTurnId, sender: 'user', text: '', isFinal: true, remove: true });
      this.currentUserTurnId = null;
      this.currentUserTurnText = '';
    }
    if (this.lastCompletedUserTurn && this.isMatchingRecentBotText(this.lastCompletedUserTurn.text)) {
      this.onTranscript({ id: this.lastCompletedUserTurn.id, sender: 'user', text: '', isFinal: true, remove: true });
      this.lastCompletedUserTurn = null;
    }
  }

  private finalizeUserTurn(): void {
    const turnId = this.currentUserTurnId;
    const finalizedText = this.formatTranscriptText(this.currentUserTurnText);
    const hadServerTr = this.hasServerUserTranscription;
    const chunks = this.currentUserAudioChunks;
    const speechFrames = this.userAudioSpeechFrames;

    this.currentUserTurnId = null;
    this.currentUserTurnText = '';
    this.hasServerUserTranscription = false;
    this.currentUserAudioChunks = [];
    this.userPreRollChunks = [];
    this.userAudioSpeechFrames = 0;
    this.isCapturingUserAudio = false;

    if (finalizedText) {
      const resolvedId = turnId || this.nextTurnId('user');
      this.lastCompletedUserTurn = {
        id: resolvedId,
        text: finalizedText,
        hasServerTranscription: hadServerTr,
        finalizedAt: Date.now()
      };
      this.onTranscript({
        id: resolvedId,
        sender: 'user',
        text: finalizedText,
        isFinal: true
      });
      return;
    }

    if (!hadServerTr && speechFrames >= 3 && chunks.length >= 4) {
      const resolvedId = turnId || this.nextTurnId('user');
      this.lastCompletedUserTurn = {
        id: resolvedId,
        text: '',
        hasServerTranscription: false,
        finalizedAt: Date.now()
      };
      this.onTranscript({
        id: resolvedId,
        sender: 'user',
        text: '🎙️ Speaking...',
        isFinal: false
      });
      this.transcribeAudioTurn(chunks, {
        sender: 'user',
        turnId: resolvedId,
        sampleRate: 16000,
        filename: 'user_turn.wav'
      });
    } else if (turnId) {
      this.onTranscript({
        id: turnId,
        sender: 'user',
        text: '',
        isFinal: true,
        remove: true
      });
    }
  }

  async handleServerMessage(rawData: any): Promise<void> {
    let message: any;
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
      console.warn("[GeminiLive Mobile] Błąd parsowania JSON:", e);
      return;
    }

    if (!message) return;

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

    if (message.setupComplete) {
      console.log("[GeminiLive Mobile] setupComplete odebrane. Wysyłam powitanie...");
      this.onStatusChange('listening');
      this.sendInitialGreeting();
      return;
    }

    if (message.serverContent && message.serverContent.interrupted) {
      console.log("[GeminiLive Mobile] Wykryto przerwanie (barge-in). Wyciszam lektora.");
      this.stopBotAudio();
      return;
    }

    let hasPartText = false;
    if (message.serverContent && message.serverContent.modelTurn) {
      if (!this.botTurnStarted) {
        this.finalizeUserTurn();
        this.botTurnStarted = true;
        this.currentBotTurnId = this.nextTurnId('bot');
        this.currentBotTurnText = '';
        this.hasModelTurnSpokenText = false;
      }
      const parts = message.serverContent.modelTurn.parts || [];

      for (const part of parts) {
        const audioData = part.inlineData || (part.mimeType && part.data ? part : null);
        if (audioData && audioData.mimeType && audioData.mimeType.startsWith('audio/pcm') && audioData.data) {
          let sampleRate = 24000;
          const match = audioData.mimeType.match(/rate=(\d+)/);
          if (match && match[1]) {
            sampleRate = parseInt(match[1], 10);
          }
          this.queueAudioChunk(audioData.data, sampleRate);
        }

        if (part.text && !part.thought) {
          hasPartText = true;
          this.hasModelTurnSpokenText = true;
          const botTurnId = this.ensureBotTurnId();
          this.currentBotTurnText = this.mergeStreamText(this.currentBotTurnText, part.text);
          const formatted = this.formatTranscriptText(this.currentBotTurnText);
          if (formatted) {
            this.onTranscript({
              id: botTurnId,
              sender: 'bot',
              text: formatted,
              isFinal: false
            });
          }
        }
      }
    }

    // Bezpośrednia transkrypcja mowy ucznia ze strumienia inputTranscription
    if (message.serverContent) {
      const inTr = message.serverContent.inputTranscription || 
                   message.serverContent.input_transcription ||
                   message.serverContent.interimInputTranscription ||
                   message.serverContent.interim_input_transcription ||
                   message.inputTranscription ||
                   message.input_transcription;
      if (inTr && typeof inTr.text === 'string' && inTr.text.trim()) {
        if (!this.botTurnStarted || this.currentUserTurnId) {
          const userTurnId = this.ensureUserTurnId();
          this.hasServerUserTranscription = true;
          this.currentUserTurnText = this.mergeStreamText(this.currentUserTurnText, inTr.text);
          const formatted = this.formatTranscriptText(this.currentUserTurnText);
          if (formatted) {
            this.onTranscript({
              id: userTurnId,
              sender: 'user',
              text: formatted,
              isFinal: false
            });
          }
        } else if (this.lastCompletedUserTurn && Date.now() - this.lastCompletedUserTurn.finalizedAt < 6000) {
          this.lastCompletedUserTurn.hasServerTranscription = true;
          this.lastCompletedUserTurn.text = this.mergeStreamText(this.lastCompletedUserTurn.text, inTr.text);
          const formatted = this.formatTranscriptText(this.lastCompletedUserTurn.text);
          if (formatted) {
            this.onTranscript({
              id: this.lastCompletedUserTurn.id,
              sender: 'user',
              text: formatted,
              isFinal: true
            });
          }
        }
      }
    }

    if (message.serverContent) {
      const outTr = message.serverContent.outputTranscription || message.serverContent.output_transcription;
      if (outTr && typeof outTr.text === 'string' && outTr.text.trim() && !hasPartText && !this.hasModelTurnSpokenText) {
        const botTurnId = this.ensureBotTurnId();
        this.currentBotTurnText = this.mergeStreamText(this.currentBotTurnText, outTr.text);
        const formatted = this.formatTranscriptText(this.currentBotTurnText);
        if (formatted) {
          this.onTranscript({
            id: botTurnId,
            sender: 'bot',
            text: formatted,
            isFinal: false
          });
        }
      }
    }

    if (message.serverContent && message.serverContent.turnComplete) {
      const botTurnId = this.currentBotTurnId;
      const finalizedBotText = this.formatTranscriptText(this.currentBotTurnText);
      const botChunks = this.currentTurnAudioChunks;
      this.botTurnStarted = false;
      this.hasModelTurnSpokenText = false;
      this.currentBotTurnId = null;
      this.currentBotTurnText = '';
      this.currentTurnAudioChunks = [];

      if (finalizedBotText) {
        this.pushBotPhrase(finalizedBotText);
        this.onTranscript({
          id: botTurnId || this.nextTurnId('bot'),
          sender: 'bot',
          text: finalizedBotText,
          isFinal: true
        });
      } else if (botChunks.length > 0) {
        this.transcribeAudioTurn(botChunks, {
          sender: 'bot',
          turnId: botTurnId || this.nextTurnId('bot'),
          sampleRate: 24000,
          filename: 'bot_turn.wav'
        });
      } else if (botTurnId) {
        this.onTranscript({
          id: botTurnId,
          sender: 'bot',
          text: '',
          isFinal: true,
          remove: true
        });
      }
    }
  }

  sendInitialGreeting(): void {
    const greetingText = this.initialGreetingPrompt || 
      "Hello! Please greet me warmly in English as my friendly tutor in 1 natural spoken sentence, and ask what we should talk about today.";
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

  queueAudioChunk(base64Data: string, sampleRate = 24000): void {
    if (!this.audioContext) return;

    try {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch((err: any) => {
          console.warn("[GeminiLive Mobile] AudioContext resume error:", err);
        });
      }

      const float32Array = this.base64ToFloat32Array(base64Data);
      if (!float32Array || float32Array.length === 0) return;

      this.currentTurnAudioChunks.push(float32Array);

      if (!this.botTurnStarted) {
        this.finalizeUserTurn();
        this.botTurnStarted = true;
        this.hasModelTurnSpokenText = false;
        const botTurnId = this.ensureBotTurnId();
        if (!this.currentBotTurnText) {
          this.onTranscript({
            id: botTurnId,
            sender: 'bot',
            text: 'Speaking...',
            isFinal: false
          });
        }
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, sampleRate);
      if (audioBuffer.copyToChannel) {
        audioBuffer.copyToChannel(float32Array, 0);
      } else {
        audioBuffer.getChannelData(0).set(float32Array);
      }

      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputGainNode || this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      if (this.nextPlayTime < currentTime || this.nextPlayTime > currentTime + 1.5) {
        this.nextPlayTime = currentTime;
      }
      const startTime = this.nextPlayTime;
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
        this.onStatusChange('speaking');
      }
    } catch (e) {
      console.error("[GeminiLive Mobile] Błąd odtwarzania fragmentu audio:", e);
    }
  }

  encodeWAV(samples: Float32Array, sampleRate = 24000): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  async transcribeBotTurn(explicitChunks?: Float32Array[] | null, botTurnId?: string | null): Promise<void> {
    return this.transcribeAudioTurn(explicitChunks, {
      sender: 'bot',
      turnId: botTurnId || this.currentBotTurnId || this.nextTurnId('bot'),
      sampleRate: 24000,
      filename: 'bot_turn.wav'
    });
  }

  transcribeAudioTurn(
    explicitChunks?: Float32Array[] | null,
    options: { sender?: 'user' | 'bot'; turnId?: string; sampleRate?: number; filename?: string } = {}
  ): Promise<void> {
    const sender = options.sender || 'bot';
    const turnId = options.turnId || this.nextTurnId(sender);
    const sampleRate = options.sampleRate || (sender === 'user' ? 16000 : 24000);
    const filename = options.filename || `${sender}_turn.wav`;

    const chunks = explicitChunks || (sender === 'bot' ? this.currentTurnAudioChunks : this.currentUserAudioChunks);
    if (!chunks || chunks.length === 0) return Promise.resolve();
    if (!explicitChunks && sender === 'bot') {
      this.currentTurnAudioChunks = [];
    }

    let totalLength = 0;
    for (let i = 0; i < chunks.length; i++) {
      totalLength += chunks[i].length;
    }
    const minSamples = sampleRate === 16000 ? 4000 : 4800;
    if (totalLength < minSamples) {
      if (sender === 'user' && !(this.lastCompletedUserTurn && this.lastCompletedUserTurn.id === turnId && this.lastCompletedUserTurn.text)) {
        this.onTranscript({ id: turnId, sender, text: '', isFinal: true, remove: true });
      }
      return Promise.resolve();
    }

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      combined.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    const task = (async () => {
      try {
        const wavBuffer = this.encodeWAV(combined, sampleRate);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', blob, filename);
        if (this.userEmail) {
          formData.append('user_email', this.userEmail);
        }

        const headers: Record<string, string> = {};
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
              this.pushBotPhrase(text);
            } else if (sender === 'user' && this.isMatchingRecentBotText(text)) {
              this.onTranscript({
                id: turnId,
                sender: 'user',
                text: '',
                isFinal: true,
                remove: true
              });
              return;
            }
            if (sender === 'user' && this.lastCompletedUserTurn && this.lastCompletedUserTurn.id === turnId) {
              this.lastCompletedUserTurn.text = text;
            }
            this.onTranscript({
              id: turnId,
              sender,
              text,
              isFinal: true
            });
            return;
          }
        }
      } catch (e) {
        console.warn("[GeminiLive Mobile] Błąd transkrypcji:", e);
      }

      if (sender === 'user' && this.lastCompletedUserTurn && this.lastCompletedUserTurn.id === turnId && this.lastCompletedUserTurn.text) {
        return;
      }
      this.onTranscript({
        id: turnId,
        sender,
        text: '',
        isFinal: true,
        remove: true
      });
    })();

    this.pendingTranscriptions.add(task);
    task.finally(() => {
      this.pendingTranscriptions.delete(task);
    });
    return task;
  }

  stopBotAudio(): void {
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    this.scheduledSources = [];
    const chunksToTranscribe = this.currentTurnAudioChunks;
    this.currentTurnAudioChunks = [];
    const wasTurnStarted = this.botTurnStarted;
    const botTurnId = this.currentBotTurnId;
    const existingBotText = this.formatTranscriptText(this.currentBotTurnText);
    this.botTurnStarted = false;
    this.hasModelTurnSpokenText = false;
    this.currentBotTurnId = null;
    this.currentBotTurnText = '';

    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }

    this.isBotCurrentlySpeaking = false;
    this.onBotSpeaking(false);

    if (wasTurnStarted && existingBotText && botTurnId) {
      this.onTranscript({
        id: botTurnId,
        sender: 'bot',
        text: existingBotText,
        isFinal: true
      });
    } else if (wasTurnStarted && !existingBotText && chunksToTranscribe && chunksToTranscribe.length > 0) {
      this.transcribeAudioTurn(chunksToTranscribe, {
        sender: 'bot',
        turnId: botTurnId || this.nextTurnId('bot'),
        sampleRate: 24000,
        filename: 'bot_turn.wav'
      });
    } else if (wasTurnStarted && !existingBotText && botTurnId) {
      this.onTranscript({
        id: botTurnId,
        sender: 'bot',
        text: '',
        isFinal: true,
        remove: true
      });
    }
  }

  sendJson(obj: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  resampleAudio(audioBuffer: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
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

  floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  base64ToFloat32Array(base64: string): Float32Array | null {
    try {
      const sanitized = base64.replace(/\s/g, '');
      const binaryString = typeof window !== 'undefined' ? window.atob(sanitized) : '';
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
      console.warn("[GeminiLive Mobile] Błąd Base64 PCM:", e);
      return null;
    }
  }

  arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return typeof window !== 'undefined' ? window.btoa(binary) : '';
  }

  async reportSessionUsage(): Promise<void> {
    if (this.usageReported) return;
    this.usageReported = true;

    const durationSeconds = this.sessionStartTime
      ? Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000))
      : 0;

    if (durationSeconds < 2 && this.sessionPromptTokens === 0 && this.sessionCompletionTokens === 0) {
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

      // Śledzenie wyłącznie niezsynchronizowanej dotąd reszty czasu sesji
      const unsyncedSeconds = Math.max(0, durationSeconds - this.lastTrackedSeconds);
      if (unsyncedSeconds > 0) {
        this.lastTrackedSeconds = durationSeconds;
        await fetch(`${this.apiBaseUrl}/api/subscription/track-live-time`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            duration_seconds: unsyncedSeconds
          })
        }).catch(() => {});
      }

      console.log(`[GeminiLive Mobile] Zużycie zapisane: ${durationSeconds}s`);
    } catch (e) {
      console.warn("[GeminiLive Mobile] Błąd raportowania zużycia:", e);
    }
  }

  async finalizeAndCleanup(timeoutMs = 3500): Promise<void> {
    if (this.currentUserTurnText || this.currentUserAudioChunks.length > 0) {
      this.finalizeUserTurn();
    }
    this.stopBotAudio();

    if (this.pendingTranscriptions.size > 0) {
      const pending = Array.from(this.pendingTranscriptions);
      await Promise.race([
        Promise.allSettled(pending),
        new Promise((resolve) => setTimeout(resolve, timeoutMs))
      ]);
    }
    this.cleanup();
  }

  cleanup(): void {
    this.reportSessionUsage();
    this.isDestroyed = true;
    this.isConnected = false;

    if (this.quotaTicker) {
      clearInterval(this.quotaTicker);
      this.quotaTicker = null;
    }

    this.stopBotAudio();

    if (this.checkSpeakingInterval) {
      clearInterval(this.checkSpeakingInterval);
      this.checkSpeakingInterval = null;
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

    if (this.keepAliveOsc) {
      try {
        this.keepAliveOsc.stop();
        this.keepAliveOsc.disconnect();
      } catch (e) {}
      this.keepAliveOsc = null;
    }

    if (this.keepAliveGain) {
      try {
        this.keepAliveGain.disconnect();
      } catch (e) {}
      this.keepAliveGain = null;
    }

    if (this.outputGainNode) {
      try {
        this.outputGainNode.disconnect();
      } catch (e) {}
      this.outputGainNode = null;
    }

    if (this.mediaStream) {
      try {
        if (this.reuseMediaStream) {
          // Wyciszamy ścieżki, żeby mikrofon nie był aktywny, ale nie niszczymy MediaStream
          this.mediaStream.getTracks().forEach((track: any) => {
            track.enabled = false;
          });
        } else {
          this.mediaStream.getTracks().forEach((track: any) => track.stop());
        }
      } catch (e) {}
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
      } catch (e) {}
      this.audioContext = null;
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
