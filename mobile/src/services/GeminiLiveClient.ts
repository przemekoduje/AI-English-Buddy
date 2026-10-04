/**
 * GeminiLiveClient.ts (Mobile Web & React Native)
 * 
 * Klient połączenia czasu rzeczywistego (WebSockets + Web Audio API) dla technologii 
 * Gemini Multimodal Live API w aplikacji mobilnej Speakling.
 */

export interface GeminiLiveOptions {
  provider?: 'google_ai_studio' | 'vertex_ai';
  apiKey?: string;
  token?: string;
  wsUrl?: string;
  model?: string;
  voiceName?: string;
  systemInstruction?: string;
  apiBaseUrl?: string;
  sessionToken?: string | null;
  userEmail?: string | null;
  onStatusChange?: (status: 'inactive' | 'connecting' | 'listening' | 'user-speaking' | 'speaking') => void;
  onBotSpeaking?: (isSpeaking: boolean) => void;
  onUserVolume?: (volume: number) => void;
  onBotVolume?: (volume: number) => void;
  onTranscript?: (transcript: { sender: 'user' | 'bot'; text: string; isFinal: boolean }) => void;
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
  public apiBaseUrl: string;
  public sessionToken: string | null;
  public userEmail: string | null;

  public onStatusChange: (status: 'inactive' | 'connecting' | 'listening' | 'user-speaking' | 'speaking') => void;
  public onBotSpeaking: (isSpeaking: boolean) => void;
  public onUserVolume: (volume: number) => void;
  public onBotVolume: (volume: number) => void;
  public onTranscript: (transcript: { sender: 'user' | 'bot'; text: string; isFinal: boolean }) => void;
  public onError: (err: string) => void;
  public onClose: (event: any) => void;

  private ws: WebSocket | null = null;
  public isConnected = false;

  private inputAudioContext: any = null;
  private mediaStream: any = null;
  private audioSourceNode: any = null;
  private scriptProcessorNode: any = null;
  private inputMuteGain: any = null;
  private speechRecognition: any = null;
  private lastUserTranscript = '';

  private outputAudioContext: any = null;
  private outputGainNode: any = null;
  private scheduledSources: any[] = [];
  private nextPlayTime = 0;
  private isBotCurrentlySpeaking = false;
  private checkSpeakingInterval: any = null;

  private sessionStartTime: number | null = null;
  private sessionPromptTokens = 0;
  private sessionCompletionTokens = 0;
  private maxSeenTokens = 0;
  private usageReported = false;

  private currentBotTurnText = '';
  private currentTurnAudioChunks: Float32Array[] = [];
  private botTurnStarted = false;

  constructor(options: GeminiLiveOptions = {}) {
    this.provider = options.provider || 'google_ai_studio';
    this.apiKey = options.apiKey || '';
    this.token = options.token || '';
    this.wsUrl = options.wsUrl || '';
    this.model = options.model || 'gemini-2.5-flash-native-audio-latest';
    this.voiceName = options.voiceName || 'Puck';
    this.systemInstruction = options.systemInstruction || 
      "You are Speakling, an enthusiastic, friendly and warm native English tutor. Your goal is to help the student practice speaking English naturally. Keep your spoken responses concise, conversational, and encouraging, giving the student plenty of speaking time. Speak with a natural, friendly tone.";

    this.onStatusChange = options.onStatusChange || (() => {});
    this.onBotSpeaking = options.onBotSpeaking || (() => {});
    this.onUserVolume = options.onUserVolume || (() => {});
    this.onBotVolume = options.onBotVolume || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onClose = options.onClose || (() => {});

    this.apiBaseUrl = options.apiBaseUrl || '';
    this.sessionToken = options.sessionToken || null;
    this.userEmail = options.userEmail || null;
  }

  async connect(): Promise<void> {
    this.onStatusChange('connecting');

    try {
      await this.initOutputAudio();

      const url = this.buildWebSocketUrl();
      if (!url) {
        throw new Error("Brak prawidłowego adresu WebSocket lub klucza uwierzytelniającego.");
      }

      console.log(`[GeminiLive Mobile] Łączenie z WebSocket (${this.provider})...`);
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log("[GeminiLive Mobile] Połączenie WebSocket otwarte. Wysyłam ramkę setup...");
        this.sessionStartTime = Date.now();
        this.usageReported = false;
        this.sendSetupFrame();
        this.isConnected = true;

        await this.initInputAudio();
        this.onStatusChange('listening');
      };

      this.ws.onmessage = async (event: any) => {
        await this.handleServerMessage(event.data);
      };

      this.ws.onerror = (err: any) => {
        console.error("[GeminiLive Mobile] Błąd WebSocket:", err);
        this.onError("Błąd połączenia WebSocket z Gemini Live.");
      };

      this.ws.onclose = (event: any) => {
        console.log(`[GeminiLive Mobile] WebSocket zamknięty (kod: ${event.code}, powód: ${event.reason})`);
        this.cleanup();
        this.isConnected = false;

        if (event.code !== 1000 && event.code !== 1005) {
          let friendlyReason = "";
          if (event.reason) {
            friendlyReason = `Google AI Studio: ${event.reason} (kod ${event.code})`;
          } else if (event.code === 1008) {
            friendlyReason = "Google AI Studio odrzuciło połączenie (kod 1008: Błąd uprawnień). Wybierz model Gemini 2.5 Flash Native Audio.";
          } else if (event.code === 1006) {
            friendlyReason = "Połączenie WebSocket z Gemini Live zostało przerwane (kod 1006). Sprawdź sieć.";
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

  async initOutputAudio(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

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
        this.checkSpeakingInterval = setInterval(() => {
          if (this.outputAudioContext) {
            const isSpeaking = this.outputAudioContext.currentTime < this.nextPlayTime - 0.05;
            if (isSpeaking !== this.isBotCurrentlySpeaking) {
              this.isBotCurrentlySpeaking = isSpeaking;
              this.onBotSpeaking(isSpeaking);
            }
          }
        }, 80);
      }
    } catch (e) {
      console.warn("[GeminiLive Mobile] Błąd inicjalizacji odtwarzania audio:", e);
    }
  }

  async initInputAudio(): Promise<void> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error("Brak wsparcia dla nagrywania audio w tym środowisku.");
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.inputAudioContext = new AudioContextClass();
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      this.audioSourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);

      const bufferSize = 2048;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(bufferSize, 1, 1);

      this.inputMuteGain = this.inputAudioContext.createGain();
      this.inputMuteGain.gain.value = 0;

      this.audioSourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputMuteGain);
      this.inputMuteGain.connect(this.inputAudioContext.destination);

      const targetSampleRate = 16000;
      const nativeSampleRate = this.inputAudioContext.sampleRate;

      this.scriptProcessorNode.onaudioprocess = (e: any) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onUserVolume(rms);

        const resampledData = this.resampleAudio(inputData, nativeSampleRate, targetSampleRate);
        const pcm16Buffer = this.floatTo16BitPCM(resampledData);
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

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

      this.initSpeechRecognition();
    } catch (err: any) {
      console.error("[GeminiLive Mobile] Błąd konfiguracji mikrofonu:", err);
      throw new Error("Brak dostępu do mikrofonu: " + err.message);
    }
  }

  initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.lang = 'en-US';
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = (finalTranscript || interimTranscript).trim();
        if (text && text !== this.lastUserTranscript) {
          this.lastUserTranscript = text;
          this.onTranscript({
            sender: 'user',
            text: text,
            isFinal: Boolean(finalTranscript)
          });
        }
      };

      this.speechRecognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn("[GeminiLive Mobile] SpeechRecognition:", e.error);
        }
      };

      this.speechRecognition.start();
    } catch (e) {
      console.warn("[GeminiLive Mobile] Nie udało się wystartować lokalnego SpeechRecognition:", e);
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
      console.warn("[GeminiLive Mobile] Błąd parsowania ramki JSON:", e);
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
      this.onStatusChange('active' as any);
      this.sendInitialGreeting();
      return;
    }

    if (message.serverContent && message.serverContent.interrupted) {
      console.log("[GeminiLive Mobile] Wykryto przerwanie (barge-in). Wyciszam bota.");
      this.stopBotAudio();
      return;
    }

    if (message.serverContent && message.serverContent.modelTurn) {
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
          this.currentBotTurnText += part.text;
          this.onTranscript({
            sender: 'bot',
            text: this.currentBotTurnText,
            isFinal: false
          });
        }
      }
    }

    if (message.serverContent && message.serverContent.turnComplete) {
      this.botTurnStarted = false;
      if (this.currentBotTurnText) {
        this.onTranscript({
          sender: 'bot',
          text: this.currentBotTurnText,
          isFinal: true
        });
        this.currentBotTurnText = '';
        this.currentTurnAudioChunks = [];
      } else {
        this.transcribeBotTurn();
      }
    }
  }

  sendInitialGreeting(): void {
    const greetingTurn = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: "Hello! Please greet me warmly in English as my friendly tutor, introduce yourself briefly in 1-2 natural sentences, and ask how my day is going."
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
    if (!this.outputAudioContext) return;

    try {
      if (this.outputAudioContext.state === 'suspended') {
        this.outputAudioContext.resume().catch((err: any) => {
          console.warn("[GeminiLive Mobile] AudioContext resume error:", err);
        });
      }

      const float32Array = this.base64ToFloat32Array(base64Data);
      if (!float32Array || float32Array.length === 0) return;

      this.currentTurnAudioChunks.push(float32Array);

      if (!this.botTurnStarted) {
        this.botTurnStarted = true;
        this.onTranscript({
          sender: 'bot',
          text: '🎙️ Speaking...',
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
      console.error("[GeminiLive Mobile] Błąd odtwarzania audio:", e);
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

  async transcribeBotTurn(): Promise<void> {
    if (!this.currentTurnAudioChunks || this.currentTurnAudioChunks.length === 0) return;

    const chunks = this.currentTurnAudioChunks;
    this.currentTurnAudioChunks = [];

    let totalLength = 0;
    for (let i = 0; i < chunks.length; i++) {
      totalLength += chunks[i].length;
    }
    if (totalLength < 4800) return;

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      combined.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    try {
      const wavBuffer = this.encodeWAV(combined, 24000);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', blob, 'bot_turn.wav');
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
          this.onTranscript({
            sender: 'bot',
            text: text,
            isFinal: true
          });
          return;
        }
      }
    } catch (e) {
      console.warn("[GeminiLive Mobile] Błąd transkrypcji:", e);
    }

    this.onTranscript({
      sender: 'bot',
      text: '🎙️ (Voice response)',
      isFinal: true
    });
  }

  stopBotAudio(): void {
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    this.scheduledSources = [];
    this.currentTurnAudioChunks = [];
    this.botTurnStarted = false;

    if (this.outputAudioContext) {
      this.nextPlayTime = this.outputAudioContext.currentTime;
    }

    this.isBotCurrentlySpeaking = false;
    this.onBotSpeaking(false);
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
      console.log(`[GeminiLive Mobile] Zużycie zapisane: ${durationSeconds}s`);
    } catch (e) {
      console.warn("[GeminiLive Mobile] Błąd raportowania zużycia:", e);
    }
  }

  cleanup(): void {
    this.reportSessionUsage();
    this.isConnected = false;

    this.stopBotAudio();

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
      this.mediaStream.getTracks().forEach((track: any) => track.stop());
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
