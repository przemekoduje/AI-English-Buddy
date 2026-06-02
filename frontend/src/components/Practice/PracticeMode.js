import React, { useState, useEffect, useRef } from "react";
import "./PracticeMode.css";

const PracticeMode = ({ text, voices, selectedVoiceURI, user, onExit }) => {
  const [phase, setPhase] = useState(1);
  const [subPhase, setSubPhase] = useState(1);
  const [masteryData, setMasteryData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const currentUtteranceRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");

  useEffect(() => {
    prepareContent();
    return () => {
      window.speechSynthesis.cancel();
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
      const response = await fetch("http://127.0.0.1:5001/api/mastery-prepare", {
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

  const getBestMaleVoice = (lang) => {
    const langVoices = voices.filter(v => v.lang.startsWith(lang));
    if (lang === "en" && selectedVoiceURI) {
      const preferred = langVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (preferred) return preferred;
    }
    const malePatterns = ["Natural", "Neural", "Evan", "Nathan", "Microsoft Guy Online", "Google UK English Male", "Google US English Male", "Alex", "Marek"];
    for (const pattern of malePatterns) {
      const found = langVoices.find(v => v.name.includes(pattern));
      if (found) return found;
    }
    return langVoices.find(v => v.name.toLowerCase().includes("male")) || langVoices[0];
  };

  const speakSentence = (index, lang = "en", segmentIdx = -1) => {
    window.speechSynthesis.cancel();
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(0);

    if (index < 0 || index >= masteryData.length) {
      setIsSpeaking(false);
      return;
    }

    setCurrentIndex(index);
    setCurrentSegmentIndex(segmentIdx);
    setCurrentLang(lang);

    const item = masteryData[index];
    const textToSpeak = (segmentIdx !== -1 && item.segments) ? item.segments[segmentIdx] : (lang === "en" ? item.en : item.pl);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.voice = getBestMaleVoice(lang === "en" ? "en" : "pl");
    utterance.lang = lang === "en" ? "en-GB" : "pl-PL";
    utterance.rate = phase === 2 ? 0.7 : phase === 3 ? 1.0 : 0.9;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      const startTime = Date.now();
      const estimatedDuration = (textToSpeak.length * 85) / utterance.rate;
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / estimatedDuration) * 100, 100);
        setProgress(newProgress);
        if (newProgress >= 100) clearInterval(progressIntervalRef.current);
      }, 50);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setProgress(100);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
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
      const res = await fetch("http://127.0.0.1:5001/api/mastery-evaluate", { 
        method: "POST", 
        headers: { "X-Session-Token": user.token },
        body: formData 
      });
      const result = await res.json();
      setEvaluation(result);
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

  const changePhase = (newPhase) => {
    setPhase(newPhase);
    setSubPhase(1);
    setCurrentIndex(0);
    setCurrentSegmentIndex(newPhase === 2 ? 0 : -1);
    setIsSpeaking(false);
    setEvaluation(null);
    window.speechSynthesis.cancel();
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
          <button className="exit-btn" onClick={onExit}>✕</button>
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
                      <p className="eval-tip">💡 {evaluation.tip}</p>
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
                    {isRecording ? "🛑" : "🎤"}
                  </button>
                ) : (
                  <button className="ctrl-btn repeat" onClick={handleRepeat}>↺</button>
                )}
                <button className="ctrl-btn next-main" onClick={handleNext} disabled={currentIndex === masteryData.length - 1 && (phase !== 2 || currentSegmentIndex === masteryData[currentIndex].segments?.length - 1)}>
                  Dalej ⏭
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
