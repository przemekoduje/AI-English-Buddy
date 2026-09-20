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

    // Callbacks
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onBotSpeaking = options.onBotSpeaking || (() => {});
    this.onUserVolume = options.onUserVolume || (() => {});
    this.onBotVolume = options.onBotVolume || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onClose = options.onClose || (() => {});

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

    // Bufor aktualnej wypowiedzi lektora
    this.currentBotTurnText = '';
  }

  /**
   * Nawiązuje połączenie z Gemini Live API
   */
  async connect() {
    this.onStatusChange('connecting');

    try {
      // 1. Ustalenie docelowego adresu WebSocket
      const url = this.buildWebSocketUrl();
      if (!url) {
        throw new Error("Brak prawidłowego adresu WebSocket lub klucza uwierzytelniającego.");
      }

      console.log(`[GeminiLive] Łączenie z WebSocket (${this.provider})...`);
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log("[GeminiLive] Połączenie WebSocket otwarte. Wysyłam ramkę setup...");
        this.sendSetupFrame();
        this.isConnected = true;

        // Inicjalizacja Audio Contexts
        await this.initOutputAudio();
        await this.initInputAudio();

        this.onStatusChange('listening');
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
          if (event.reason) {
            friendlyReason = `Google AI Studio: ${event.reason} (kod ${event.code})`;
          } else if (event.code === 1008) {
            friendlyReason = "Google AI Studio odrzuciło połączenie (kod 1008: Błąd modelu lub uprawnień). Wybierz model Gemini 2.5 Flash Native Audio lub sprawdź klucz API.";
          } else if (event.code === 1007) {
            friendlyReason = "Google AI Studio zgłosiło błąd formatu danych lub nieobsługiwany model (kod 1007).";
          } else if (event.code === 1006) {
            friendlyReason = "Połączenie WebSocket z Gemini Live zostało przerwane (kod 1006). Sprawdź czy klucz API jest aktywny i czy sieć nie blokuje WebSockets.";
          } else {
            friendlyReason = `Połączenie z Gemini Live zostało zakończone (kod ${event.code}).`;
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
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.outputAudioContext = new AudioContextClass();
    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }
    this.nextPlayTime = this.outputAudioContext.currentTime;

    // Monitorowanie czy lektor wciąż mówi
    this.checkSpeakingInterval = setInterval(() => {
      if (this.outputAudioContext) {
        const isSpeaking = this.outputAudioContext.currentTime < this.nextPlayTime - 0.05;
        if (isSpeaking !== this.isBotCurrentlySpeaking) {
          this.isBotCurrentlySpeaking = isSpeaking;
          this.onBotSpeaking(isSpeaking);
        }
      }
    }, 100);
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

      this.audioSourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

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
        this.onUserVolume(rms);

        // Resampling do 16000 Hz, jeśli natywna częstotliwość karty dźwiękowej jest inna (np. 44100 / 48000 Hz)
        const resampledData = this.resampleAudio(inputData, nativeSampleRate, targetSampleRate);

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

  /**
   * Pomocnicze rozpoznawanie mowy przeglądarki (do zapisu słów ucznia w transkrypcji)
   */
  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.lang = 'en-US';
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onresult = (event) => {
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

      this.speechRecognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn("[GeminiLive] SpeechRecognition info:", e.error);
        }
      };

      this.speechRecognition.start();
    } catch (e) {
      console.warn("[GeminiLive] Nie udało się wystartować lokalnego SpeechRecognition:", e);
    }
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

    // 1. Sprawdzenie przerwania mowy lektora (Barge-in / User Interrupted)
    if (message.serverContent && message.serverContent.interrupted) {
      console.log("[GeminiLive] Wykryto przerwanie (interrupted = true). Wyciszam lektora natychmiast.");
      this.stopBotAudio();
      return;
    }

    // 2. Obsługa treści generowanych przez model
    if (message.serverContent && message.serverContent.modelTurn) {
      const parts = message.serverContent.modelTurn.parts || [];

      for (const part of parts) {
        // Audio PCM z Gemini (zazwyczaj audio/pcm;rate=24000)
        if (part.mimeType && part.mimeType.startsWith('audio/pcm') && part.data) {
          this.queueAudioChunk(part.data, 24000);
        }

        // Tekst wypowiedzi lektora
        if (part.text) {
          this.currentBotTurnText += part.text;
          this.onTranscript({
            sender: 'bot',
            text: this.currentBotTurnText,
            isFinal: false
          });
        }
      }
    }

    // 3. Koniec tury lektora
    if (message.serverContent && message.serverContent.turnComplete) {
      if (this.currentBotTurnText) {
        this.onTranscript({
          sender: 'bot',
          text: this.currentBotTurnText,
          isFinal: true
        });
        this.currentBotTurnText = '';
      }
    }
  }

  /**
   * Kolejkuje i odtwarza fragment audio 24kHz PCM
   */
  queueAudioChunk(base64Data, sampleRate = 24000) {
    if (!this.outputAudioContext) return;

    try {
      const float32Array = this.base64ToFloat32Array(base64Data);
      if (!float32Array || float32Array.length === 0) return;

      const audioBuffer = this.outputAudioContext.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.copyToChannel(float32Array, 0);

      const sourceNode = this.outputAudioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputAudioContext.destination);

      const currentTime = this.outputAudioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
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

    if (this.outputAudioContext) {
      this.nextPlayTime = this.outputAudioContext.currentTime;
    }

    this.isBotCurrentlySpeaking = false;
    this.onBotSpeaking(false);
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

  stopCameraStream() {
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
    const binaryString = window.atob(base64);
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
   * Pełne sprzątanie zasobów
   */
  cleanup() {
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

    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect();
      } catch (e) {}
      this.audioSourceNode = null;
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
