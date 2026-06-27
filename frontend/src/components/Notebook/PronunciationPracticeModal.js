import React, { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from '../../config';
import "./PronunciationPracticeModal.css";

const PronunciationPracticeModal = ({ targetText, user, onClose, onLogActivity, onLogPronunciationError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");
  const currentAudioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup audio and recognition on unmount
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Play target text pronunciation using Neural TTS
  const playTargetTTS = async () => {
    if (isSpeaking) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setIsSpeaking(false);
      }
      return;
    }

    setIsSpeaking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: targetText,
          voice: "en-US-BrianNeural"
        })
      });
      if (!response.ok) {
        throw new Error("Failed to fetch TTS audio");
      }
      const data = await response.json();
      if (data.audio_base64) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const audio = new Audio(audioUrl);
        
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setIsSpeaking(false);
          alert("Failed to play pronunciation.");
        };

        currentAudioRef.current = audio;
        audio.play();
      } else {
        throw new Error("No audio_base64 in response");
      }
    } catch (err) {
      console.error("Error playing TTS:", err);
      setIsSpeaking(false);
      alert("Failed to play pronunciation.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      speechTranscriptRef.current = "";
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onresult = (event) => {
          const resultText = event.results[0][0].transcript;
          console.log("Local transcription:", resultText);
          speechTranscriptRef.current = resultText;
        };
        rec.onerror = (e) => {
          console.warn("Local SpeechRecognition error:", e.error);
        };
        recognitionRef.current = rec;
        rec.start();
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        handleEvaluate(audioBlob, speechTranscriptRef.current);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setEvaluation(null);
      setRecordingSeconds(0);

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Dostęp do mikrofonu został zablokowany.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      const stream = mediaRecorderRef.current.stream;
      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  };

  const handleEvaluate = async (audioBlob, localTranscript = "") => {
    setIsEvaluating(true);
    setEvaluation(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "speech.webm");
      formData.append("target_text", targetText);
      if (localTranscript) {
        formData.append("transcription", localTranscript);
      }

      const res = await fetch(`${API_BASE_URL}/api/mastery-evaluate`, {
        method: "POST",
        headers: { "X-Session-Token": user.token },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to evaluate pronunciation.");
      }

      const result = await res.json();
      setEvaluation(result);

      // Log practice event to activity log
      if (onLogActivity && result && typeof result.score !== "undefined") {
        onLogActivity({
          type: "practice",
          word_or_phrase: targetText,
          timestamp: Date.now(),
          details: {
            practice_score: result.score,
            practice_sentence: targetText,
            practice_transcription: result.transcription || localTranscript || "",
          },
        });
      }

      // Log specific mispronounced words as pronunciation errors
      if (onLogPronunciationError && result.mispronounced_words && result.mispronounced_words.length > 0) {
        result.mispronounced_words.forEach((word) => {
          onLogPronunciationError(word, targetText);
        });
      }

    } catch (err) {
      console.error("Evaluation error:", err);
      alert("Nie udało się przeanalizować wymowy. Spróbuj ponownie.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="practice-modal-overlay" data-testid="pronunciation-practice-modal">
      <div className="practice-modal-content glass-panel animate-zoom">
        <header className="practice-modal-header">
          <h3>Przećwicz Wymowę Zdania</h3>
          <button className="close-btn" onClick={onClose} aria-label="Zamknij">&times;</button>
        </header>

        <div className="practice-modal-body">
          <div className="target-text-container">
            <p className="target-label">Zdanie do przeczytania:</p>
            <blockquote className="target-text">"{targetText}"</blockquote>
          </div>

          <div className="practice-actions-row">
            <button 
              className={`btn-tts-listen ${isSpeaking ? "playing" : ""}`}
              onClick={playTargetTTS}
              title="Odsłuchaj poprawną wymowę"
            >
              <span className="btn-icon">{isSpeaking ? "⏹" : "🔊"}</span>
              {isSpeaking ? "Zatrzymaj" : "Odsłuchaj wzór"}
            </button>

            {isRecording ? (
              <button className="btn-record-voice recording" onClick={stopRecording}>
                <span className="record-pulse-dot"></span>
                Zatrzymaj ({formatTime(recordingSeconds)})
              </button>
            ) : (
              <button className="btn-record-voice" onClick={startRecording} disabled={isEvaluating}>
                <span className="btn-icon">🎤</span>
                Nagraj swój głos
              </button>
            )}
          </div>

          {isEvaluating && (
            <div className="practice-evaluating">
              <div className="spinner"></div>
              <p>Analizowanie Twojej wymowy przez AI...</p>
            </div>
          )}

          {evaluation && (
            <div className="evaluation-results-box animate-zoom">
              <div className="evaluation-score-row">
                <div className={`score-ring ${evaluation.score >= 80 ? "excellent" : evaluation.score >= 60 ? "good" : "needs-practice"}`}>
                  <span className="score-number">{evaluation.score}%</span>
                  <span className="score-label">Wynik</span>
                </div>
                <div className="evaluation-tip-box">
                  <h4>Analiza Wymowy:</h4>
                  <p className="evaluation-tip">{evaluation.tip}</p>
                </div>
              </div>

              {evaluation.transcription && (
                <div className="evaluation-detail-section">
                  <strong>Twoja wymowa (tekst):</strong>
                  <p className="transcription-text">"{evaluation.transcription}"</p>
                </div>
              )}

              {evaluation.corrections && evaluation.corrections !== "Brak błędów" && (
                <div className="evaluation-detail-section corrections">
                  <strong>Wykryte błędy / luki:</strong>
                  <p className="corrections-text">{evaluation.corrections}</p>
                  {evaluation.mispronounced_words && evaluation.mispronounced_words.length > 0 && (
                    <div className="mispronounced-chips">
                      {evaluation.mispronounced_words.map((word, idx) => (
                        <span key={idx} className="mispronounced-chip">
                          ⚠️ {word}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {evaluation.corrections === "Brak błędów" && (
                <div className="evaluation-detail-section perfect">
                  <p className="perfect-text">🎉 Idealna wymowa! Brak wykrytych błędów.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="practice-modal-footer">
          <button className="btn-close-footer" onClick={onClose}>Zamknij</button>
        </footer>
      </div>
    </div>
  );
};

export default PronunciationPracticeModal;
