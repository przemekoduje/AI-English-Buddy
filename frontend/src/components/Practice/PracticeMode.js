import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from '../../config';
import "./PracticeMode.css";

const PracticeMode = ({ text, voices, selectedVoiceURI, user, onExit, onLogActivity }) => {
  const [phase, setPhase] = useState(1);
  const [subPhase, setSubPhase] = useState(1);
  const [masteryData, setMasteryData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const currentAudioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");
  const handleTogglePlayPauseRef = useRef(null);

  useEffect(() => {
    prepareContent();
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentIndex !== -1) {
      const element = document.getElementById(`sentence-${currentIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentIndex]);

  const prepareContent = async () => {
    setIsPreparing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mastery-prepare`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setMasteryData(data);
        if (data.length > 0) {
          setCurrentIndex(0);
          setCurrentLang("en");
        }
      }
    } catch (err) {
      console.error("Error preparing mastery:", err);
    } finally {
      setIsPreparing(false);
    }
  };

  const speakSentence = async (index, lang = "en", segmentIdx = -1) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(0);
    setIsPaused(false);

    if (index < 0 || index >= masteryData.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      return;
    }

    setCurrentIndex(index);
    setCurrentSegmentIndex(segmentIdx);
    setCurrentLang(lang);

    const item = masteryData[index];
    const textToSpeak = (segmentIdx !== -1 && item.segments) ? item.segments[segmentIdx] : (lang === "en" ? item.en : item.pl);

    let voiceToUse = "en-US-BrianNeural";
    if (lang === "en") {
      voiceToUse = selectedVoiceURI || "en-US-BrianNeural";
    } else {
      voiceToUse = "pl-PL-MarekNeural";
    }

    const rate = phase === 2 ? 0.7 : phase === 3 ? 1.0 : 0.9;

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          voice: voiceToUse
        })
      });

      if (!response.ok) throw new Error("TTS generation failed");
      const data = await response.json();
      if (!data.audio_base64) throw new Error("No audio data returned");

      const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        
        const updateProgress = () => {
          if (!currentAudioRef.current || currentAudioRef.current.paused) return;
          const duration = currentAudioRef.current.duration || (textToSpeak.length * 0.085);
          if (duration > 0) {
            const newProgress = Math.min((currentAudioRef.current.currentTime / duration) * 100, 100);
            setProgress(newProgress);
            if (newProgress >= 100) {
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
          }
        };

        progressIntervalRef.current = setInterval(updateProgress, 50);
      };

      audio.onpause = () => {
        setIsPaused(true);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setProgress(100);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setProgress(0);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        currentAudioRef.current = null;
      };

      currentAudioRef.current = audio;
      audio.play();

    } catch (err) {
      console.error("Error playing practice voice:", err);
      setIsSpeaking(false);
      setProgress(0);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
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
          console.log("Local speech recognition transcript:", resultText);
          speechTranscriptRef.current = resultText;
        };
        rec.onerror = (e) => {
          console.warn("Local speech recognition error:", e.error);
        };
        recognitionRef.current = rec;
        rec.start();
      }

      mediaRecorderRef.current.onstop = () => {
        setTimeout(() => {
          handleEvaluate(new Blob(audioChunksRef.current, { type: 'audio/webm' }), speechTranscriptRef.current);
        }, 500);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setEvaluation(null);
    } catch (err) { 
      console.error(err);
      alert("Microphone access denied."); 
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleEvaluate = async (audioBlob, localTranscript = "") => {
    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.webm');
      formData.append('target_text', masteryData[currentIndex].en);
      if (localTranscript) {
        formData.append('transcription', localTranscript);
      }
      const res = await fetch(`${API_BASE_URL}/api/mastery-evaluate`, { 
        method: "POST", 
        headers: { "X-Session-Token": user.token },
        body: formData 
      });
      const result = await res.json();
      setEvaluation(result);

      if (onLogActivity && result && typeof result.score !== 'undefined') {
        onLogActivity({
          type: "practice",
          word_or_phrase: masteryData[currentIndex].en,
          timestamp: Date.now(),
          details: {
            practice_score: result.score,
            practice_sentence: masteryData[currentIndex].en,
            practice_transcription: result.transcription || localTranscript || ""
          }
        });
      }
    } catch (err) { console.error("Evaluation error:", err); }
    finally { setIsEvaluating(false); }
  };

  const handleNext = () => {
    if (phase === 2) {
      const currentItem = masteryData[currentIndex];
      if (currentItem.segments && currentSegmentIndex + 1 < currentItem.segments.length) {
        speakSentence(currentIndex, "en", currentSegmentIndex + 1);
      } else if (currentIndex + 1 < masteryData.length) {
        speakSentence(currentIndex + 1, "en", 0);
      }
    } else {
      if (currentIndex + 1 < masteryData.length) {
        speakSentence(currentIndex + 1, phase === 3 ? "en" : (subPhase === 1 ? "en" : "pl"));
      }
    }
  };

  const handleRepeat = () => {
    if (currentIndex !== -1) speakSentence(currentIndex, currentLang, currentSegmentIndex);
  };

  const handleTogglePlayPause = () => {
    if (currentAudioRef.current) {
      if (isPaused || currentAudioRef.current.paused) {
        currentAudioRef.current.play();
      } else {
        currentAudioRef.current.pause();
      }
    } else {
      speakSentence(currentIndex === -1 ? 0 : currentIndex, currentLang, currentSegmentIndex);
    }
  };
  handleTogglePlayPauseRef.current = handleTogglePlayPause;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (handleTogglePlayPauseRef.current) {
          handleTogglePlayPauseRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const changePhase = (newPhase) => {
    setPhase(newPhase);
    setSubPhase(1);
    setCurrentIndex(0);
    setCurrentSegmentIndex(newPhase === 2 ? 0 : -1);
    setIsSpeaking(false);
    setIsPaused(false);
    setEvaluation(null);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const startPhaseSubStep = (step) => {
    setSubPhase(step);
    if (phase === 2) speakSentence(0, "en", 0);
    else speakSentence(0, step === 1 ? "en" : "pl");
  };

  if (isPreparing) {
    return (
      <div className="practice-overlay">
        <div className="practice-loader glass-panel">
          <div className="spinner"></div>
          <p>Preparing training path...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-overlay">
      <div className="practice-content">
        <header className="practice-header">
          <div className="phase-indicator">
            {[1, 2, 3, 4].map(p => (
              <span key={p} className={`dot ${phase >= p ? "active" : ""} ${p === phase ? "current" : ""}`} onClick={() => changePhase(p)}>
                {p}
              </span>
            ))}
          </div>
          <div className="header-titles">
             <h2>Phase {phase}: {phase === 1 ? "Immersion" : phase === 2 ? "Precision" : phase === 3 ? "Shadowing" : "Mastery"}</h2>
             <p className="sub-hint">{phase === 1 ? "Absorb the rhythm" : phase === 2 ? "Break it down" : phase === 3 ? "Synchronize" : "Final Challenge"}</p>
          </div>
          <button className="exit-btn" onClick={onExit}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="practice-body">
          {phase === 1 && (
            <div className="phase-1-controls">
              <button className={`step-btn ${subPhase === 1 ? "active" : ""}`} onClick={() => startPhaseSubStep(1)}>Listen EN</button>
              <button className={`step-btn ${subPhase === 2 ? "active" : ""}`} onClick={() => startPhaseSubStep(2)}>Listen Translation</button>
            </div>
          )}

          <div className="training-area">
            <div className="training-text-scroll">
              {masteryData.map((item, index) => (
                <span key={index} id={`sentence-${index}`} className={`training-sentence ${index === currentIndex ? "active" : ""}`} onClick={() => speakSentence(index, phase >= 2 ? "en" : currentLang, phase === 2 ? 0 : -1)}>
                  {item.en}{" "}
                </span>
              ))}
            </div>

            <div className="sentence-controller">
              <div className="controller-info">
                <span className="index-badge">
                  {phase === 2 ? `Part ${currentSegmentIndex + 1}` : `Sent. ${currentIndex + 1} / ${masteryData.length}`}
                </span>
                
                {(isSpeaking || isRecording) && (
                  <div className="speak-progress-container">
                    <div className={`speak-progress-bar ${isRecording ? "pulse" : ""}`} style={{ width: isRecording ? "100%" : `${progress}%` }}></div>
                  </div>
                )}

                {phase === 4 && evaluation && !isEvaluating && (
                  <div className="evaluation-result-box">
                    <div className="eval-score-circle">{evaluation.score}%</div>
                    <div className="eval-feedback">
                      <p className="eval-transcription">Transcription: "{evaluation.transcription}"</p>
                      <div className="eval-corrections" dangerouslySetInnerHTML={{ __html: evaluation.corrections }}></div>
                      <p className="eval-tip">Tip: {evaluation.tip}</p>
                    </div>
                  </div>
                )}
                
                {isEvaluating && <div className="evaluating-loader">Analyzing voice...</div>}
              </div>

              <div className="controller-actions">
                {subPhase === 2 && phase === 1 && (
                  <button className="ctrl-btn lang-toggle" style={{width: 'auto', padding: '0 1rem', borderRadius: '4px', fontSize: '0.8rem'}} onClick={() => speakSentence(currentIndex, currentLang === "pl" ? "en" : "pl")}>
                    {currentLang === "pl" ? "Hear EN" : "Hear PL"}
                  </button>
                )}
                {phase === 4 ? (
                  <button className={`ctrl-btn record-btn ${isRecording ? "active" : ""}`} onClick={isRecording ? stopRecording : startRecording}>
                    {isRecording ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    )}
                  </button>
                ) : (
                  <>
                    <button className="ctrl-btn play-pause" onClick={handleTogglePlayPause} title="Odtwarzaj / Pauza (Skrót klawiaturowy: P)">
                      {isSpeaking && !isPaused ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </button>
                    <button className="ctrl-btn repeat" onClick={handleRepeat} title="Powtórz">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                    </button>
                  </>
                )}
                <button className="ctrl-btn next-main" onClick={handleNext} disabled={currentIndex === masteryData.length - 1 && (phase !== 2 || currentSegmentIndex === masteryData[currentIndex].segments?.length - 1)}>
                  Dalej
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="practice-footer">
           <button className="step-btn" onClick={onExit}>Close</button>
           <button className="step-btn active" onClick={() => changePhase(phase < 4 ? phase + 1 : phase)}>Next Phase →</button>
        </footer>
      </div>
    </div>
  );
};

export default PracticeMode;
