import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from '../config';
import "./Dashboard.css";
import VoiceSessionSummaryModal from "./Notebook/VoiceSessionSummaryModal";

// Voice Activity Detection (VAD) thresholds
const VOICE_THRESHOLD = 0.012;        // RMS level to trigger speaking state
const INTERRUPTION_THRESHOLD = 0.022; // RMS level to trigger interruption when bot is speaking
const SILENCE_DURATION = 1500;        // Silence duration (ms) to assume user finished speaking

function Dashboard({ user }) {
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [rmsVolume, setRmsVolume] = useState(0);
  const [userIsSpeakingState, setUserIsSpeakingState] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false); // Transcript visibility state
  const [voiceSummary, setVoiceSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Audio/VAD Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptScrollRef = useRef(null); // Ref for scroll container

  // VAD state refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isUserSpeakingRef = useRef(false);
  const interruptionCounterRef = useRef(0);
  const checkVolumeAnimationRef = useRef(null);

  // Sync state refs to prevent React closure stale states in requestAnimationFrame loop
  const isBotSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isBotSpeakingRef.current = isBotSpeaking;
  }, [isBotSpeaking]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
      stopRecordingLocally();
      cleanupVAD();
    };
  }, []);

  // Scroll to bottom of transcript history
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [chatMessages, showTranscript]);

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsBotSpeaking(false);
  };

  const stopRecordingLocally = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Failed to stop mediarecorder:", e);
      }
    }
    setIsRecording(false);
  };

  const cleanupVAD = () => {
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
    setUserIsSpeakingState(false);
    interruptionCounterRef.current = 0;
    setRmsVolume(0);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Setup Voice Activity Detection (VAD)
  const setupVAD = (stream) => {
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

        // Calculate Root Mean Square (RMS) volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const deviation = (dataArray[i] - 128) / 128;
          sum += deviation * deviation;
        }
        const rms = Math.sqrt(sum / bufferLength);

        setRmsVolume(rms);

        // Process VAD rules
        handleVoiceActivity(rms);

        checkVolumeAnimationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error("VAD initialization failed:", e);
    }
  };

  // VAD checks
  const handleVoiceActivity = (rms) => {
    // 1. Interruption Check (User speaks over Tutor)
    if (isBotSpeakingRef.current) {
      if (rms > INTERRUPTION_THRESHOLD) {
        interruptionCounterRef.current += 1;
        if (interruptionCounterRef.current > 10) {
          console.log("Interruption detected: stopping tutor playback.");
          interruptionCounterRef.current = 0;
          stopAudio();
          startRecording();
        }
      } else {
        interruptionCounterRef.current = Math.max(0, interruptionCounterRef.current - 1);
      }
      return;
    }

    // 2. Turn-taking Silence Check (User speaks and finishes)
    if (isRecordingRef.current && !isProcessingRef.current) {
      if (rms > VOICE_THRESHOLD) {
        if (!isUserSpeakingRef.current) {
          isUserSpeakingRef.current = true;
          setUserIsSpeakingState(true);
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        if (isUserSpeakingRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            console.log("Silence detected: ending turn.");
            stopRecording();
            isUserSpeakingRef.current = false;
            setUserIsSpeakingState(false);
            silenceTimerRef.current = null;
          }, SILENCE_DURATION);
        }
      }
    }
  };

  const startRecording = () => {
    if (!streamRef.current || isProcessingRef.current || isRecordingRef.current) return;

    stopAudio();
    audioChunksRef.current = [];
    isUserSpeakingRef.current = false;
    setUserIsSpeakingState(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSendVoice(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.warn("MediaRecorder start failed, retrying with default mimeType:", err);
      try {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current);
          await handleSendVoice(audioBlob);
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (errFallback) {
        console.error("Failed to initialize recorder:", errFallback);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Failed to stop mediarecorder inside stopRecording:", e);
      }
    }
    setIsRecording(false);
  };

  // Play audio response from Tutor
  const playTutorAudio = async (text, cachedBase64) => {
    stopAudio();
    setIsBotSpeaking(true);
    try {
      let base64_data = cachedBase64;
      if (!base64_data) {
        console.log("Web: TTS base64 not pre-generated, fetching from api...");
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text,
            voice: "en-US-BrianNeural", // Default premium voice
          }),
        });

        if (!response.ok) throw new Error("TTS generation failed");
        const data = await response.json();
        base64_data = data.audio_base64;
      } else {
        console.log("Web: Using pre-generated TTS audio base64.");
      }

      if (!base64_data) throw new Error("No audio base64 returned");

      const audioUrl = `data:audio/mp3;base64,${base64_data}`;
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsBotSpeaking(false);
        currentAudioRef.current = null;
        startRecording();
      };

      audio.onerror = () => {
        setIsBotSpeaking(false);
        currentAudioRef.current = null;
        startRecording();
      };

      currentAudioRef.current = audio;
      audio.play();
    } catch (err) {
      console.error("Error playing TTS:", err);
      setIsBotSpeaking(false);
      startRecording();
    }
  };

  // Start the free conversation session
  const handleStartSession = async () => {
    cleanupVAD();
    setIsChatActive(true);
    setChatMessages([]);
    stopAudio();
    setShowTranscript(false); // Hide transcript on new session start

    try {
      // Access mic stream once and keep it open
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setupVAD(stream);

      // Student is always the first speaker! Immediately start recording.
      startRecording();
    } catch (err) {
      console.error("Error starting session:", err);
      alert("Nie udało się rozpocząć rozmowy. Zezwól na dostęp do mikrofonu: " + err.message);
      setIsChatActive(false);
      cleanupVAD();
    }
  };

  // End discussion and reset states
  const handleEndSession = async () => {
    stopAudio();
    stopRecordingLocally();
    cleanupVAD();
    setIsChatActive(false);
    setShowTranscript(false);

    if (chatMessages.length > 0) {
      setIsGeneratingSummary(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat-free/summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user.token,
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
        console.error("Error generating session summary:", err);
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

  // Send Voice Blob to API
  const handleSendVoice = async (audioBlob) => {
    setIsProcessing(true);
    try {
      const historyForApi = chatMessages.map((msg) => ({
        sender: msg.sender,
        text: msg.text,
      }));

      const formData = new FormData();
      formData.append("audio", audioBlob, "user_speech.webm");
      formData.append("history", JSON.stringify(historyForApi));
      formData.append("voice", "en-US-BrianNeural");

      const response = await fetch(`${API_BASE_URL}/api/chat-free`, {
        method: "POST",
        headers: {
          "X-Session-Token": user.token,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("API connection error");
      const result = await response.json();

      if (result.error) throw new Error(result.error);

      const userMsgId = "user-" + Date.now();
      const userMsg = {
        id: userMsgId,
        sender: "user",
        text: result.transcription || "(Brak transkrypcji)",
        evaluation: result.user_evaluation,
      };

      const botMsg = {
        id: "bot-" + (Date.now() + 1),
        sender: "bot",
        text: result.bot_response,
      };

      setChatMessages((prev) => [...prev, userMsg, botMsg]);

      playTutorAudio(result.bot_response, result.audio_base64);
    } catch (err) {
      console.error("Error sending speech:", err);
      alert("Wystąpił problem z połączeniem: " + err.message);
      startRecording(); // Restart loop
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine current active state for the Gemini Orb
  let orbStatus = "inactive";
  if (isChatActive) {
    if (isProcessing) {
      orbStatus = "thinking";
    } else if (isBotSpeaking) {
      orbStatus = "speaking";
    } else if (isRecording) {
      orbStatus = userIsSpeakingState ? "user-speaking" : "listening";
    }
  }

  // Scale value based on RMS volume for uczeń mówiący
  const scaleValue = orbStatus === "user-speaking" ? 1 + rmsVolume * 3.8 : 1;

  const isSplitLayout = isChatActive && showTranscript && chatMessages.length > 0;

  return (
    <div className="tutor-gemini-container">
      
      {/* Title / Brand */}
      <h1 className="tutor-minimal-title">
        Tutor <span className="blue-gradient-text">AI Voice</span>
      </h1>

      {/* Main Action Stage (Can be centered or split row-wise on desktop) */}
      <div className={`tutor-main-stage ${isSplitLayout ? "split" : "centered"}`}>
        
        {/* Orb Section */}
        <div className="tutor-orb-section">
          {/* Central Gemini-like Orb Control */}
          <div className="tutor-orb-wrapper">
            <button
              className={`tutor-gemini-orb ${orbStatus}`}
              onClick={isChatActive ? handleEndSession : handleStartSession}
              style={{ transform: `scale(${scaleValue})` }}
              title={isChatActive ? "Kliknij, aby zakończyć rozmowę" : "Kliknij, aby rozpocząć rozmowę"}
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
                {orbStatus === "thinking" && (
                  <div className="orb-spinner"></div>
                )}
              </div>
            </button>
          </div>

          {/* Status text label */}
          <div className="tutor-status-label">
            {orbStatus === "inactive" && "Naciśnij orb, aby rozpocząć rozmowę"}
            {orbStatus === "speaking" && "Lektor mówi (zacznij mówić, aby wtrącić)"}
            {orbStatus === "listening" && "Słucham... powiedz coś"}
            {orbStatus === "user-speaking" && "Mówisz..."}
            {orbStatus === "thinking" && "Lektor myśli..."}
          </div>

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

        {/* Side Transcript Section */}
        {isChatActive && chatMessages.length > 0 && (
          <div className={`tutor-side-transcript glass-panel ${showTranscript ? "open" : ""}`}>
            <h3 className="side-transcript-header">Zapis rozmowy</h3>
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

      {/* Tips */}
      {!isChatActive && !voiceSummary && (
        <div className="tutor-minimal-tips">
          🎧 Używaj słuchawek, aby zapobiec zapętleniu dźwięku.
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
              Analizuję Twoje błędy gramatyczne, wymowę oraz nowe słownictwo, aby przygotować raport.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
