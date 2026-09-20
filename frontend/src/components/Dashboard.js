import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from '../config';
import "./Dashboard.css";
import VoiceSessionSummaryModal from "./Notebook/VoiceSessionSummaryModal";
import { GeminiLiveClient } from "../services/GeminiLiveClient";

// Voice Activity Detection (VAD) thresholds for Classic Mode
const VOICE_THRESHOLD = 0.012;
const INTERRUPTION_THRESHOLD = 0.022;
const SILENCE_DURATION = 1500;

function Dashboard({ user }) {
  // Tryb rozmowy: 'live' (Gemini Multimodal Live) lub 'classic' (Whisper + OpenAI/DeepSeek + TTS)
  const [chatMode, setChatMode] = useState(() => {
    return localStorage.getItem("buddy_live_chat_mode") || "live";
  });

  // Ustawienia Gemini Live
  const [liveProvider, setLiveProvider] = useState(() => {
    return localStorage.getItem("buddy_live_provider") || "google_ai_studio";
  });
  const [liveVoice, setLiveVoice] = useState(() => {
    return localStorage.getItem("buddy_live_voice") || "Puck";
  });
  const [liveModel, setLiveModel] = useState(() => {
    return localStorage.getItem("buddy_live_model") || "gemini-2.0-flash-exp";
  });
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem("buddy_gemini_api_key") || "";
  });

  // Konfiguracja serwera
  const [serverConfig, setServerConfig] = useState(null);

  // Stany ogólne czatu
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [rmsVolume, setRmsVolume] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [voiceSummary, setVoiceSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Stany specyficzne dla Gemini Live
  const [liveStatus, setLiveStatus] = useState("inactive"); // 'inactive' | 'connecting' | 'listening' | 'user-speaking' | 'speaking'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Stany dla Classic Mode
  const [isClassicRecording, setIsClassicRecording] = useState(false);
  const [isClassicProcessing, setIsClassicProcessing] = useState(false);
  const [isClassicBotSpeaking, setIsClassicBotSpeaking] = useState(false);
  const [classicUserSpeakingState, setClassicUserSpeakingState] = useState(false);

  // Refs
  const geminiLiveRef = useRef(null);
  const videoElementRef = useRef(null);
  const transcriptScrollRef = useRef(null);

  // Classic Mode Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const localTranscriptRef = useRef("");
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isUserSpeakingRef = useRef(false);
  const interruptionCounterRef = useRef(0);
  const checkVolumeAnimationRef = useRef(null);
  const isBotSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isBotSpeakingRef.current = isClassicBotSpeaking;
  }, [isClassicBotSpeaking]);

  useEffect(() => {
    isRecordingRef.current = isClassicRecording;
  }, [isClassicRecording]);

  useEffect(() => {
    isProcessingRef.current = isClassicProcessing;
  }, [isClassicProcessing]);

  // Pobranie konfiguracji serwera dla Live API przy montowaniu
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/live/config`)
      .then((res) => res.json())
      .then((data) => {
        setServerConfig(data);
      })
      .catch((err) => {
        console.warn("Nie udało się pobrać konfiguracji /api/live/config:", err);
      });
  }, []);

  // Czyszczenie przy odmontowaniu
  useEffect(() => {
    return () => {
      stopLiveSession();
      cleanupClassicVAD();
      stopClassicAudio();
      stopClassicRecordingLocally();
    };
  }, []);

  // Automatyczne przewijanie transkrypcji
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [chatMessages, showTranscript]);

  // Zapis ustawień do localStorage
  const handleSaveSettings = (newSettings) => {
    if (newSettings.mode) {
      setChatMode(newSettings.mode);
      localStorage.setItem("buddy_live_chat_mode", newSettings.mode);
    }
    if (newSettings.provider) {
      setLiveProvider(newSettings.provider);
      localStorage.setItem("buddy_live_provider", newSettings.provider);
    }
    if (newSettings.voice) {
      setLiveVoice(newSettings.voice);
      localStorage.setItem("buddy_live_voice", newSettings.voice);
    }
    if (newSettings.model) {
      setLiveModel(newSettings.model);
      localStorage.setItem("buddy_live_model", newSettings.model);
    }
    if (newSettings.apiKey !== undefined) {
      setCustomApiKey(newSettings.apiKey);
      localStorage.setItem("buddy_gemini_api_key", newSettings.apiKey);
    }
    setShowSettings(false);
  };

  // ==========================================
  // GEMINI MULTIMODAL LIVE API LOGIC
  // ==========================================

  const startLiveSession = async () => {
    setErrorMessage(null);
    setLiveStatus("connecting");
    setIsChatActive(true);
    setChatMessages([]);
    setShowTranscript(false);

    try {
      let clientConfig = {
        provider: liveProvider,
        model: liveModel,
        voiceName: liveVoice,
        systemInstruction:
          "You are Speakling, a friendly, charismatic and encouraging native English tutor. Help the student practice conversational English naturally. Keep responses lively, spoken and concise (1-3 sentences) so the conversation flows seamlessly back and forth.",
        onStatusChange: (status) => {
          setLiveStatus(status);
        },
        onUserVolume: (volume) => {
          setRmsVolume(volume);
          if (volume > 0.02) {
            setLiveStatus("user-speaking");
          } else if (liveStatus === "user-speaking") {
            setLiveStatus("listening");
          }
        },
        onBotSpeaking: (isSpeaking) => {
          if (isSpeaking) {
            setLiveStatus("speaking");
          } else {
            setLiveStatus("listening");
          }
        },
        onTranscript: ({ sender, text, isFinal }) => {
          setChatMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            // Jeśli ostatnia wiadomość jest od tego samego nadawcy i nie była sfinalizowana, aktualizujemy ją
            if (lastMsg && lastMsg.sender === sender && !lastMsg.isFinal) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastMsg,
                text: text,
                isFinal: isFinal,
              };
              return updated;
            } else {
              // W przeciwnym razie dodajemy nową wiadomość
              return [
                ...prev,
                {
                  id: `${sender}-${Date.now()}`,
                  sender: sender,
                  text: text,
                  isFinal: isFinal,
                },
              ];
            }
          });
        },
        onError: (err) => {
          console.error("Gemini Live Error:", err);
          setErrorMessage(err);
          setLiveStatus("inactive");
          setIsChatActive(false);
        },
        onClose: () => {
          setLiveStatus("inactive");
          setIsChatActive(false);
        },
      };

      // 1. Sprawdzamy czy użytkownik ma wpisany własny klucz API w ustawieniach
      if (liveProvider === "google_ai_studio" && customApiKey.trim()) {
        clientConfig.apiKey = customApiKey.trim();
      } else if (liveProvider === "google_ai_studio") {
        // Jeśli nie ma klucza w przeglądarce i serwer nie ma GEMINI_API_KEY
        if (!serverConfig?.gemini_api_key_configured) {
          setShowSettings(true);
          setErrorMessage(
            "Do uruchomienia Gemini Live w czasie rzeczywistym wymagany jest bezpłatny klucz API z Google AI Studio. Wklej klucz poniżej lub przełącz jednym kliknięciem na tryb OpenAI / DeepSeek!"
          );
          setIsChatActive(false);
          setLiveStatus("inactive");
          return;
        }

        // Pobieramy token efemeryczny z backendu
        const tokenRes = await fetch(`${API_BASE_URL}/api/live/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
          body: JSON.stringify({
            model: liveModel,
            api_key: customApiKey.trim() || undefined,
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) {
          if (tokenData.error === "NO_API_KEY") {
            setShowSettings(true);
            setErrorMessage(
              "Wymagany bezpłatny klucz Gemini API. Wklej go poniżej lub uruchom tryb klasyczny (OpenAI), który nie wymaga konfiguracji."
            );
            setIsChatActive(false);
            setLiveStatus("inactive");
            return;
          }
          throw new Error(tokenData.error || tokenData.message || "Błąd generowania tokena sesji.");
        }

        clientConfig.token = tokenData.token;
        clientConfig.wsUrl = tokenData.ws_url;
      } else if (liveProvider === "vertex_ai") {
        // Pobieramy token OAuth2 dla Vertex AI z backendu
        const vertexRes = await fetch(`${API_BASE_URL}/api/live/vertex-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
        });

        const vertexData = await vertexRes.json();
        if (!vertexRes.ok || vertexData.error) {
          throw new Error(vertexData.error || "Błąd uwierzytelniania w Google Cloud Vertex AI.");
        }

        clientConfig.token = vertexData.access_token;
        clientConfig.wsUrl = vertexData.ws_url;
      }

      // Inicjalizacja klienta WebSocket
      const client = new GeminiLiveClient(clientConfig);
      geminiLiveRef.current = client;
      await client.connect();

      // Jeśli kamera była włączona, uruchamiamy strumień
      if (isCameraActive && videoElementRef.current) {
        await client.startCameraStream(videoElementRef.current);
      }
    } catch (err) {
      console.error("Nie udało się rozpocząć sesji Gemini Live:", err);
      setErrorMessage(err.message || "Wystąpił błąd podczas łączenia z Gemini Live.");
      setIsChatActive(false);
      setLiveStatus("inactive");
    }
  };

  const stopLiveSession = () => {
    if (geminiLiveRef.current) {
      geminiLiveRef.current.cleanup();
      geminiLiveRef.current = null;
    }
    setIsCameraActive(false);
    setLiveStatus("inactive");
  };

  const handleToggleCamera = async () => {
    if (!isChatActive || !geminiLiveRef.current) {
      setIsCameraActive(!isCameraActive);
      return;
    }

    try {
      if (isCameraActive) {
        geminiLiveRef.current.stopCameraStream();
        setIsCameraActive(false);
      } else {
        setIsCameraActive(true);
        // Poczekajmy na wyrenderowanie elementu video
        setTimeout(async () => {
          if (videoElementRef.current && geminiLiveRef.current) {
            await geminiLiveRef.current.startCameraStream(videoElementRef.current);
          }
        }, 150);
      }
    } catch (err) {
      alert("Nie udało się uzyskać dostępu do kamery: " + err.message);
      setIsCameraActive(false);
    }
  };

  // ==========================================
  // CLASSIC MODE FALLBACK LOGIC
  // ==========================================

  const stopClassicAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsClassicBotSpeaking(false);
  };

  const stopClassicRecordingLocally = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsClassicRecording(false);
  };

  const cleanupClassicVAD = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (checkVolumeAnimationRef.current) {
      cancelAnimationFrame(checkVolumeAnimationRef.current);
      checkVolumeAnimationRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }
      audioContextRef.current = null;
    }
    if (microphoneRef.current) {
      try {
        microphoneRef.current.disconnect();
      } catch (e) {}
      microphoneRef.current = null;
    }
    analyserRef.current = null;
    isUserSpeakingRef.current = false;
    setClassicUserSpeakingState(false);
    interruptionCounterRef.current = 0;
    setRmsVolume(0);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const setupClassicVAD = (stream) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const deviation = (dataArray[i] - 128) / 128;
          sum += deviation * deviation;
        }
        const rms = Math.sqrt(sum / bufferLength);

        setRmsVolume(rms);
        handleClassicVoiceActivity(rms);

        checkVolumeAnimationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error("Classic VAD initialization failed:", e);
    }
  };

  const handleClassicVoiceActivity = (rms) => {
    if (isBotSpeakingRef.current) {
      if (rms > INTERRUPTION_THRESHOLD) {
        interruptionCounterRef.current += 1;
        if (interruptionCounterRef.current > 10) {
          interruptionCounterRef.current = 0;
          stopClassicAudio();
          startClassicRecording();
        }
      } else {
        interruptionCounterRef.current = Math.max(0, interruptionCounterRef.current - 1);
      }
      return;
    }

    if (isRecordingRef.current && !isProcessingRef.current) {
      if (rms > VOICE_THRESHOLD) {
        if (!isUserSpeakingRef.current) {
          isUserSpeakingRef.current = true;
          setClassicUserSpeakingState(true);
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        if (isUserSpeakingRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopClassicRecording();
            isUserSpeakingRef.current = false;
            setClassicUserSpeakingState(false);
            silenceTimerRef.current = null;
          }, SILENCE_DURATION);
        }
      }
    }
  };

  const startClassicRecording = () => {
    if (!streamRef.current || isProcessingRef.current || isRecordingRef.current) return;

    stopClassicAudio();
    audioChunksRef.current = [];
    isUserSpeakingRef.current = false;
    setClassicUserSpeakingState(false);
    localTranscriptRef.current = "";

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (event) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            }
          }
          if (finalTranscript.trim()) {
            localTranscriptRef.current = (localTranscriptRef.current + " " + finalTranscript.trim()).trim();
          }
        };
        recognitionRef.current = rec;
        rec.start();
      } catch (e) {}
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSendClassicVoice(audioBlob);
      };
      mediaRecorder.start();
      setIsClassicRecording(true);
    } catch (err) {
      try {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current);
          await handleSendClassicVoice(audioBlob);
        };
        mediaRecorder.start();
        setIsClassicRecording(true);
      } catch (e) {}
    }
  };

  const stopClassicRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsClassicRecording(false);
  };

  const handleSendClassicVoice = async (audioBlob) => {
    setIsClassicProcessing(true);
    try {
      const historyForApi = chatMessages.map((msg) => ({
        sender: msg.sender,
        text: msg.text,
      }));

      const formData = new FormData();
      formData.append("audio", audioBlob, "user_speech.webm");
      formData.append("history", JSON.stringify(historyForApi));
      formData.append("voice", "en-US-BrianNeural");
      if (localTranscriptRef.current) {
        formData.append("transcription", localTranscriptRef.current);
      }
      if ('speechSynthesis' in window) {
        formData.append("skip_tts", "true");
      }

      const response = await fetch(`${API_BASE_URL}/api/chat-free`, {
        method: "POST",
        headers: {
          "X-Session-Token": user?.token || "",
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Błąd połączenia z API");
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const userMsg = {
        id: "user-" + Date.now(),
        sender: "user",
        text: result.transcription || localTranscriptRef.current || "(Brak transkrypcji)",
        evaluation: result.user_evaluation,
      };

      const botMsg = {
        id: "bot-" + (Date.now() + 1),
        sender: "bot",
        text: result.bot_response,
      };

      setChatMessages((prev) => [...prev, userMsg, botMsg]);
      playClassicTutorAudio(result.bot_response, result.audio_base64);
    } catch (err) {
      console.error("Error in classic voice:", err);
      alert("Wystąpił problem z połączeniem: " + err.message);
      startClassicRecording();
    } finally {
      setIsClassicProcessing(false);
    }
  };

  const playClassicTutorAudio = (text, cachedBase64) => {
    stopClassicAudio();
    setIsClassicBotSpeaking(true);

    if (!cachedBase64 && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.onend = () => {
          setIsClassicBotSpeaking(false);
          startClassicRecording();
        };
        utterance.onerror = () => {
          setIsClassicBotSpeaking(false);
          startClassicRecording();
        };
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {}
    }

    if (cachedBase64) {
      const audioUrl = `data:audio/mp3;base64,${cachedBase64}`;
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsClassicBotSpeaking(false);
        currentAudioRef.current = null;
        startClassicRecording();
      };
      audio.onerror = () => {
        setIsClassicBotSpeaking(false);
        currentAudioRef.current = null;
        startClassicRecording();
      };
      currentAudioRef.current = audio;
      audio.play();
    } else {
      setIsClassicBotSpeaking(false);
      startClassicRecording();
    }
  };

  // ==========================================
  // UNIFIED SESSION START / END
  // ==========================================

  const handleStartSession = async () => {
    if (chatMode === "live") {
      await startLiveSession();
    } else {
      // Classic Mode
      cleanupClassicVAD();
      setIsChatActive(true);
      setChatMessages([]);
      stopClassicAudio();
      setShowTranscript(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setupClassicVAD(stream);
        startClassicRecording();
      } catch (err) {
        alert("Nie udało się uzyskać dostępu do mikrofonu: " + err.message);
        setIsChatActive(false);
      }
    }
  };

  const handleSwitchToClassicAndStart = async () => {
    setChatMode("classic");
    localStorage.setItem("buddy_live_chat_mode", "classic");
    setShowSettings(false);
    setErrorMessage(null);
    cleanupClassicVAD();
    stopLiveSession();
    setIsChatActive(true);
    setChatMessages([]);
    stopClassicAudio();
    setShowTranscript(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setupClassicVAD(stream);
      startClassicRecording();
    } catch (err) {
      alert("Nie udało się uzyskać dostępu do mikrofonu: " + err.message);
      setIsChatActive(false);
    }
  };

  const handleEndSession = async () => {
    if (chatMode === "live") {
      stopLiveSession();
    } else {
      stopClassicAudio();
      stopClassicRecordingLocally();
      cleanupClassicVAD();
    }

    setIsChatActive(false);
    setShowTranscript(false);

    // Generowanie podsumowania, jeśli są jakiekolwiek wiadomości
    if (chatMessages.length > 0) {
      setIsGeneratingSummary(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat-free/summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
          body: JSON.stringify({
            history: chatMessages.map((msg) => ({
              sender: msg.sender,
              text: msg.text,
            })),
          }),
        });

        if (response.ok) {
          const summaryData = await response.json();
          setVoiceSummary(summaryData);
        }
      } catch (err) {
        console.error("Błąd podczas tworzenia podsumowania sesji:", err);
      } finally {
        setIsGeneratingSummary(false);
      }
    } else {
      setChatMessages([]);
    }
  };

  const handleCloseSummary = () => {
    setVoiceSummary(null);
    setChatMessages([]);
  };

  // Wyliczanie statusu Orba
  let orbStatus = "inactive";
  if (isChatActive) {
    if (chatMode === "live") {
      orbStatus = liveStatus;
    } else {
      if (isClassicProcessing) {
        orbStatus = "thinking";
      } else if (isClassicBotSpeaking) {
        orbStatus = "speaking";
      } else if (isClassicRecording) {
        orbStatus = classicUserSpeakingState ? "user-speaking" : "listening";
      }
    }
  }

  const scaleValue = orbStatus === "user-speaking" ? 1 + rmsVolume * 3.8 : 1;
  const isSplitLayout = isChatActive && showTranscript && chatMessages.length > 0;

  return (
    <div className="tutor-gemini-container">
      {/* Top Header & Mode Badge */}
      <div className="tutor-header-area">
        <div className="tutor-title-row">
          <h1 className="tutor-minimal-title">
            Chat <span className="blue-gradient-text">Live</span>
          </h1>
          <button
            className="tutor-settings-icon-btn"
            onClick={() => setShowSettings(true)}
            title="Ustawienia połączenia i głosu"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Status Pill Badge */}
        <div className="tutor-badge-container">
          {chatMode === "live" ? (
            <span className="live-technology-badge">
              <span className="badge-pulse-dot"></span>
              ⚡ Gemini Multimodal Live API • {liveProvider === "vertex_ai" ? "Vertex AI (GCP)" : "Google AI Studio"} ({liveVoice})
            </span>
          ) : (
            <span className="classic-technology-badge">
              🎙️ Tryb Klasyczny (Whisper + OpenAI / DeepSeek)
            </span>
          )}
        </div>
      </div>

      {/* Floating Error Notification */}
      {errorMessage && (
        <div className="tutor-error-banner animate-fade-in">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="error-close-btn">×</button>
        </div>
      )}

      {/* Main Action Stage */}
      <div className={`tutor-main-stage ${isSplitLayout ? "split" : "centered"}`}>
        
        {/* Orb Section */}
        <div className="tutor-orb-section">
          {/* Central Gemini Orb Control */}
          <div className="tutor-orb-wrapper">
            <button
              className={`tutor-gemini-orb ${orbStatus}`}
              onClick={isChatActive ? handleEndSession : handleStartSession}
              style={{ transform: `scale(${scaleValue})` }}
              title={isChatActive ? "Kliknij, aby zakończyć rozmowę" : "Kliknij, aby rozpocząć rozmowę w czasie rzeczywistym"}
            >
              <div className="orb-pulse-ring-1"></div>
              <div className="orb-pulse-ring-2"></div>
              <div className="orb-core">
                {orbStatus === "inactive" && (
                  <svg viewBox="0 0 24 24" className="orb-mic-svg">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
                {orbStatus === "speaking" && (
                  <div className="orb-wave-container">
                    <span className="wave-bar bar-1"></span>
                    <span className="wave-bar bar-2"></span>
                    <span className="wave-bar bar-3"></span>
                  </div>
                )}
                {orbStatus === "listening" && (
                  <div className="orb-pulse-dot"></div>
                )}
                {orbStatus === "user-speaking" && (
                  <div className="orb-wave-container green">
                    <span className="wave-bar bar-1"></span>
                    <span className="wave-bar bar-2"></span>
                    <span className="wave-bar bar-3"></span>
                  </div>
                )}
                {(orbStatus === "thinking" || orbStatus === "connecting") && (
                  <div className="orb-spinner"></div>
                )}
              </div>
            </button>
          </div>

          {/* Status text label */}
          <div className="tutor-status-label">
            {orbStatus === "inactive" && (
              chatMode === "live" && !customApiKey.trim() && !serverConfig?.gemini_api_key_configured ? (
                <span>⚠️ Wymagany klucz Gemini API — kliknij poniżej, aby go podać lub włącz tryb OpenAI</span>
              ) : (
                "Naciśnij orb, aby rozpocząć rozmowę w czasie rzeczywistym"
              )
            )}
            {orbStatus === "connecting" && "Łączenie z Gemini Live API..."}
            {orbStatus === "speaking" && "Lektor mówi (zacznij mówić, aby wtrącić!)"}
            {orbStatus === "listening" && "Słucham... powiedz coś po angielsku"}
            {orbStatus === "user-speaking" && "Mówisz..."}
            {orbStatus === "thinking" && "Lektor myśli..."}
          </div>

          {/* Quick-start helper when Gemini key is not configured */}
          {orbStatus === "inactive" && chatMode === "live" && !customApiKey.trim() && !serverConfig?.gemini_api_key_configured && (
            <div className="tutor-quick-start-box animate-fade-in">
              <button
                className="quick-btn-key"
                onClick={() => setShowSettings(true)}
              >
                🔑 Wpisz bezpłatny klucz Gemini
              </button>
              <button
                className="quick-btn-classic"
                onClick={handleSwitchToClassicAndStart}
              >
                🚀 Uruchom od razu z OpenAI (Działa bez klucza)
              </button>
            </div>
          )}

          {/* Controls Bar: Camera Toggle & Transcript Button */}
          <div className="tutor-action-buttons-row">
            {/* Multimodal Camera Button */}
            {chatMode === "live" && (
              <button
                className={`tutor-pill-btn ${isCameraActive ? "camera-active" : ""}`}
                onClick={handleToggleCamera}
                title={isCameraActive ? "Wyłącz podgląd wideo" : "Włącz kamerę (Multimodal Vision)"}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {isCameraActive ? "Kamera włączona" : "Włącz kamerę"}
              </button>
            )}

            {/* Toggle Transcript button */}
            {isChatActive && chatMessages.length > 0 && (
              <button 
                className={`tutor-transcript-toggle-btn ${showTranscript ? "active" : ""}`}
                onClick={() => setShowTranscript(!showTranscript)}
              >
                {showTranscript ? "🙈 Ukryj tekst" : "👁 Pokaż tekst"}
              </button>
            )}
          </div>
        </div>

        {/* Side Transcript Section */}
        {isChatActive && chatMessages.length > 0 && (
          <div className={`tutor-side-transcript glass-panel ${showTranscript ? "open" : ""}`}>
            <div className="side-transcript-header-row">
              <h3 className="side-transcript-header">Zapis rozmowy na żywo</h3>
              <span className="live-tag">LIVE</span>
            </div>
            <div className="transcript-scroll-area" ref={transcriptScrollRef}>
              {chatMessages.map((msg) => {
                const isBot = msg.sender === "bot";
                return (
                  <div key={msg.id} className={`transcript-bubble ${isBot ? "bot" : "user"}`}>
                    <span className="bubble-speaker">{isBot ? "Lektor:" : "Ty:"}</span>
                    <p className="bubble-text">{msg.text}</p>
                    {!isBot && msg.evaluation && (
                      <div className="transcript-evaluation">
                        🏆 Ocena: <strong>{msg.evaluation.score}/100</strong>. {msg.evaluation.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Multimodal Camera PIP Window */}
      {isCameraActive && (
        <div className="tutor-camera-pip glass-panel animate-zoom">
          <div className="pip-header">
            <span className="pip-badge">📷 Multimodal Vision</span>
            <button className="pip-close-btn" onClick={handleToggleCamera}>✕</button>
          </div>
          <video
            ref={videoElementRef}
            className="pip-video-feed"
            autoPlay
            playsInline
            muted
          />
          <div className="pip-footer">Lektor analizuje obraz z kamery w czasie rzeczywistym.</div>
        </div>
      )}

      {/* Tips */}
      {!isChatActive && !voiceSummary && (
        <div className="tutor-minimal-tips">
          🎧 Używaj słuchawek, aby zapobiec zapętleniu dźwięku. W trybie Live możesz wtrącać się w mowę lektora w dowolnym momencie.
        </div>
      )}

      {/* Voice Session Summary Modal */}
      {voiceSummary && (
        <VoiceSessionSummaryModal
          summary={voiceSummary}
          user={user}
          onClose={handleCloseSummary}
        />
      )}

      {/* Loading Overlay for Summary Generation */}
      {isGeneratingSummary && (
        <div className="summary-modal-overlay" style={{ zIndex: 1100 }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div className="summary-modal-content glass-panel animate-zoom" style={{ maxWidth: "420px", padding: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", background: "white" }}>
            <div className="spinner" style={{ width: "40px", height: "40px", border: "4px solid #e2e8f0", borderTop: "4px solid #1a73e8", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <h3 style={{ margin: 0, textAlign: "center", fontSize: "1.2rem", color: "var(--slate-800)" }}>Generowanie podsumowania lekcji...</h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--slate-500)", textAlign: "center", lineHeight: "1.4" }}>
              Analizuję Twoje błędy gramatyczne, płynność oraz nowe słownictwo, aby przygotować raport z lekcji.
            </p>
          </div>
        </div>
      )}

      {/* Live Settings Modal */}
      {showSettings && (
        <LiveSettingsModal
          currentSettings={{
            mode: chatMode,
            provider: liveProvider,
            voice: liveVoice,
            model: liveModel,
            apiKey: customApiKey,
          }}
          serverConfig={serverConfig}
          onSave={handleSaveSettings}
          onSwitchToClassicAndStart={handleSwitchToClassicAndStart}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// Modal Ustawień Live Chat
function LiveSettingsModal({ currentSettings, serverConfig, onSave, onSwitchToClassicAndStart, onClose }) {
  const [mode, setMode] = useState(currentSettings.mode);
  const [provider, setProvider] = useState(currentSettings.provider);
  const [voice, setVoice] = useState(currentSettings.voice);
  const [model, setModel] = useState(currentSettings.model);
  const [apiKey, setApiKey] = useState(currentSettings.apiKey || "");
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ mode, provider, voice, model, apiKey });
  };

  const voicesList = serverConfig?.voices || [
    { id: "Puck", name: "Puck (Energetyczny męski)", gender: "male" },
    { id: "Charon", name: "Charon (Głęboki męski)", gender: "male" },
    { id: "Fenrir", name: "Fenrir (Spokojny męski)", gender: "male" },
    { id: "Aoede", name: "Aoede (Ciepły żeński)", gender: "female" },
    { id: "Kore", name: "Kore (Naturalny żeński)", gender: "female" },
  ];

  return (
    <div className="live-settings-modal-overlay">
      <div className="live-settings-modal-card glass-panel animate-zoom">
        <div className="live-settings-modal-header">
          <h3>⚙️ Ustawienia Chat Live</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Shortcut to switch to Classic Mode */}
        <div className="modal-classic-shortcut">
          <div className="shortcut-text">
            <strong>💡 Nie masz klucza Gemini API?</strong>
            <p>Możesz od razu rozmawiać w trybie OpenAI / DeepSeek (nie wymaga klucza Gemini).</p>
          </div>
          <button
            type="button"
            className="btn-shortcut-classic"
            onClick={onSwitchToClassicAndStart}
          >
            🚀 Włącz tryb OpenAI
          </button>
        </div>

        <form onSubmit={handleSubmit} className="live-settings-form">
          {/* Wybór Trybu */}
          <div className="settings-field-group">
            <label className="settings-label">Tryb działania:</label>
            <div className="settings-radio-toggle">
              <button
                type="button"
                className={`toggle-option ${mode === "live" ? "active" : ""}`}
                onClick={() => setMode("live")}
              >
                ⚡ Gemini Multimodal Live (Czas rzeczywisty)
              </button>
              <button
                type="button"
                className={`toggle-option ${mode === "classic" ? "active" : ""}`}
                onClick={() => setMode("classic")}
              >
                🎙️ Klasyczny (Whisper + OpenAI / TTS)
              </button>
            </div>
          </div>

          {mode === "live" && (
            <>
              {/* Wybór Dostawcy */}
              <div className="settings-field-group">
                <label className="settings-label">Dostawca technologii Live:</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="settings-select"
                >
                  <option value="google_ai_studio">Google AI Studio (Gemini Developer API)</option>
                  <option value="vertex_ai">Vertex AI (Google Cloud Platform)</option>
                </select>
                <span className="settings-hint">
                  {provider === "google_ai_studio"
                    ? "Domyślna, ultra-szybka opcja z natywnym przesyłem JSON WebSockets."
                    : "Wymaga uwierzytelnienia GCP dla konta chmurowego z usługą Vertex AI."}
                </span>
              </div>

              {/* Wybór Głosu Gemini */}
              <div className="settings-field-group">
                <label className="settings-label">Głos lektora Gemini:</label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="settings-select"
                >
                  {voicesList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wybór Modelu */}
              <div className="settings-field-group">
                <label className="settings-label">Model Gemini Live:</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="settings-select"
                >
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Live (Eksperymentalny - najszybszy)</option>
                  <option value="gemini-2.5-flash-native-audio-preview-09-2025">Gemini 2.5 Flash Native Audio</option>
                </select>
              </div>

              {/* Opcjonalny Własny Klucz Google AI Studio */}
              {provider === "google_ai_studio" && (
                <div className="settings-field-group">
                  <div className="label-with-badge">
                    <label className="settings-label">Własny klucz API Google AI Studio (Opcjonalny):</label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="api-key-link"
                    >
                      Pobierz bezpłatny klucz ↗
                    </a>
                  </div>
                  <div className="input-with-action">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={serverConfig?.gemini_api_key_configured ? "Używam klucza skonfigurowanego na serwerze (opcjonalnie podaj własny)" : "Wklej swój klucz API z Google AI Studio (AIzaSy...)"}
                      className="settings-input"
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? "Ukryj" : "Pokaż"}
                    </button>
                  </div>
                  <span className="settings-hint">
                    Klucz jest zapisywany lokalnie w Twojej przeglądarce i nie jest współdzielony z innymi użytkownikami.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="live-settings-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className="btn-primary">
              Zapisz ustawienia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Dashboard;
