import React, { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "../../config";
import "./Reader.css";
import "../Practice/PracticeMode.css";

const Reader = ({
  generatedText,
  textChunks,
  currentChunkIndex,
  isSpeaking,
  isPaused,
  onPlayback,
  onStop,
  onPlaySentence,
  playSingle,
  voices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  speechRate,
  setSpeechRate,
  speechPitch,
  setSpeechPitch,
  onTextSelection,
  showVoiceControls,
  onWordClick,
  activeWordId,
  user,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState(null);
  const hoverTimerRef = useRef(null);
  const hoveredTokenIndexRef = useRef(null);

  // Live Chat State & Refs
  const [liveChatActive, setLiveChatActive] = useState(false);
  const [chatOrbStatus, setChatOrbStatus] = useState("inactive"); // "inactive" | "thinking" | "speaking" | "listening" | "standby"
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [isChatRecording, setIsChatRecording] = useState(false);

  const chatMediaRecorderRef = useRef(null);
  const chatAudioChunksRef = useRef([]);
  const chatRecognitionRef = useRef(null);
  const chatTranscriptRef = useRef("");
  const chatAudioRef = useRef(null);
  const chatMessagesRef = useRef([]);
  const liveChatStageRef = useRef(null);

  useEffect(() => {
    if (liveChatActive && liveChatStageRef.current) {
      liveChatStageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [liveChatActive]);

  const readProgressRatio = textChunks && textChunks.length > 0 
    ? Math.max((currentChunkIndex + 1) / textChunks.length, (currentChunkIndex === -1 && !isSpeaking) ? 1 : 0)
    : 0;
  const showLiveChatBadge = readProgressRatio >= 0.70 || (currentChunkIndex === -1 && !isSpeaking && textChunks && textChunks.length > 0);

  const startPracticeChatSession = async () => {
    if (onStop) onStop();
    setLiveChatActive(true);
    setChatOrbStatus("thinking");
    setIsChatProcessing(true);
    setChatMessages([]);
    chatMessagesRef.current = [];

    try {
      const formData = new FormData();
      formData.append('story_text', generatedText || "");
      formData.append('history', JSON.stringify([]));

      const response = await fetch(`${API_BASE_URL}/api/stories/chat-next`, {
        method: 'POST',
        headers: {
          'X-Session-Token': user?.token || '',
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.bot_response) {
        const botMsg = {
          id: String(Date.now()),
          sender: 'bot',
          text: result.bot_response,
        };
        setChatMessages([botMsg]);
        chatMessagesRef.current = [botMsg];
        speakChatBotText(result.bot_response);
      } else {
        alert(result.error || 'Nie udało się rozpocząć rozmowy AI');
        setChatOrbStatus("inactive");
      }
    } catch (err) {
      console.error('Error starting practice chat:', err);
      setChatOrbStatus("inactive");
    } finally {
      setIsChatProcessing(false);
    }
  };

  const speakChatBotText = async (text) => {
    setChatOrbStatus("speaking");
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: selectedVoiceURI || "en-US-BrianNeural"
        })
      });
      const data = await response.json();
      if (data.audio_base64) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const audio = new Audio(audioUrl);
        chatAudioRef.current = audio;
        audio.onended = () => {
          setChatOrbStatus("standby");
          startChatRecording();
        };
        audio.play();
      } else {
        setChatOrbStatus("standby");
        startChatRecording();
      }
    } catch (err) {
      console.error("Chat TTS error:", err);
      setChatOrbStatus("standby");
      startChatRecording();
    }
  };

  const startChatRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chatMediaRecorderRef.current = new MediaRecorder(stream);
      chatAudioChunksRef.current = [];

      chatMediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chatAudioChunksRef.current.push(event.data);
        }
      };

      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (event) => {
          chatTranscriptRef.current = event.results[0][0].transcript;
        };
        chatRecognitionRef.current = rec;
        rec.start();
      }

      chatMediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chatAudioChunksRef.current, { type: 'audio/webm' });
        sendChatAnswer(blob, chatTranscriptRef.current);
      };

      chatMediaRecorderRef.current.start();
      setChatOrbStatus("listening");
      setIsChatRecording(true);
    } catch (err) {
      console.error("Microphone error in live chat:", err);
      alert("Dostęp do mikrofonu został zablokowany lub wystąpił błąd.");
      setChatOrbStatus("inactive");
      setIsChatRecording(false);
    }
  };

  const stopChatRecording = () => {
    if (chatRecognitionRef.current) {
      try { chatRecognitionRef.current.stop(); } catch (e) {}
    }
    if (chatMediaRecorderRef.current && isChatRecording) {
      chatMediaRecorderRef.current.stop();
      setIsChatRecording(false);
      chatMediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const sendChatAnswer = async (audioBlob, localTranscript = "") => {
    setIsChatProcessing(true);
    setChatOrbStatus("thinking");
    try {
      const formData = new FormData();
      formData.append('story_text', generatedText || "");
      formData.append('history', JSON.stringify(chatMessagesRef.current.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }))));
      if (audioBlob && audioBlob.size > 0) {
        formData.append('audio', audioBlob, 'answer.webm');
      }
      if (localTranscript) {
        formData.append('transcription', localTranscript);
      }

      const response = await fetch(`${API_BASE_URL}/api/stories/chat-next`, {
        method: 'POST',
        headers: {
          'X-Session-Token': user?.token || '',
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        const userText = result.transcription || localTranscript || "(Nagranie audio)";
        const newMessages = [
          ...chatMessagesRef.current,
          {
            id: String(Date.now()) + '_u',
            sender: 'user',
            text: userText,
            evaluation: result.user_evaluation,
            polish_insertions: result.polish_insertions
          },
          {
            id: String(Date.now()) + '_b',
            sender: 'bot',
            text: result.bot_response
          }
        ];
        setChatMessages(newMessages);
        chatMessagesRef.current = newMessages;
        speakChatBotText(result.bot_response);
      } else {
        alert(result.error || "Błąd podczas oceny odpowiedzi.");
        setChatOrbStatus("inactive");
      }
    } catch (err) {
      console.error('Error sending chat answer:', err);
      setChatOrbStatus("inactive");
    } finally {
      setIsChatProcessing(false);
    }
  };

  const handleOrbClickInChat = () => {
    if (chatOrbStatus === "speaking") {
      if (chatAudioRef.current) {
        chatAudioRef.current.pause();
        chatAudioRef.current = null;
      }
      startChatRecording();
    } else if (chatOrbStatus === "listening" || isChatRecording) {
      stopChatRecording();
    } else if (chatOrbStatus === "inactive" || chatOrbStatus === "standby" || chatOrbStatus === "thinking") {
      startChatRecording();
    }
  };

  // Auto-scroll currently read sentence into view
  React.useEffect(() => {
    if (currentChunkIndex !== -1) {
      const activeEl = document.querySelector(".story-sentence.reading-now");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentChunkIndex]);

  const handleMouseEnter = (index) => {
    const isDesktop = window.matchMedia("(hover: hover)").matches;
    if (!isDesktop) return;

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    if (hoveredIndex === index) return;

    hoverTimerRef.current = setTimeout(() => {
      setHoveredIndex(index);
    }, 600); // 600ms responsive delay
  };

  const handleTokenHover = (index, tIdx) => {
    const isDesktop = window.matchMedia("(hover: hover)").matches;
    if (!isDesktop) return;

    setHoveredTokenIndex(tIdx);
    hoveredTokenIndexRef.current = tIdx;

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    if (hoveredIndex === index) {
      return;
    }

    hoverTimerRef.current = setTimeout(() => {
      setHoveredIndex(index);
      if (hoveredTokenIndexRef.current !== null) {
        setHoveredTokenIndex(hoveredTokenIndexRef.current);
      }
    }, 600);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setHoveredIndex(null);
      setHoveredTokenIndex(null);
      hoveredTokenIndexRef.current = null;
    }, 300); // 300ms debounce
  };

  const handleTextSelectionWrapper = (e) => {
    if (onTextSelection) onTextSelection(e);
  };

  return (
    <div className="reader-container">
      {showVoiceControls && (
        <div className="audio-dashboard">
          <div className="control-group">
            <label htmlFor="voice-select">Voice Persona</label>
            <select
              id="voice-select"
              value={selectedVoiceURI || ""}
              onChange={(e) => setSelectedVoiceURI(e.target.value)}
              className="premium-select"
            >
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="sliders-row">
            <div className="slider-item">
              <div className="slider-label">
                <span>Speed</span>
                <span className="value-chip">{speechRate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              />
            </div>
            <div className="slider-item">
              <div className="slider-label">
                <span>Pitch</span>
                <span className="value-chip">{speechPitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={speechPitch}
                onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
              />
            </div>
          </div>


        </div>
      )}

      <div className="story-typography" onMouseUp={handleTextSelectionWrapper}>
        {textChunks.map((chunk, index) => {
          const isCurrentReading = index === currentChunkIndex;
          
          // Tokenize the sentence chunk into words and other characters
          const tokens = chunk.split(/([\w\u00C0-\u017F'-]+)/g);

          // Find if there is an active highlighted word belonging to this sentence
          let activeTokenIdx = -1;
          if (activeWordId && activeWordId.startsWith(`chunk-${index}-token-`)) {
            const parts = activeWordId.split('-token-');
            if (parts.length === 2) {
              activeTokenIdx = parseInt(parts[1], 10);
            }
          }

          // Find the index of the first word/token as fallback
          const firstWordIdx = tokens.findIndex(token => /[\w\u00C0-\u017F'-]+/.test(token));
          let popupTokenIdx = firstWordIdx !== -1 ? firstWordIdx : 0;

          if (hoveredIndex === index && hoveredTokenIndex !== null && hoveredTokenIndex < tokens.length) {
            let targetIdx = hoveredTokenIndex;
            if (!/[\w\u00C0-\u017F'-]+/.test(tokens[targetIdx])) {
              if (targetIdx > 0 && /[\w\u00C0-\u017F'-]+/.test(tokens[targetIdx - 1])) {
                targetIdx = targetIdx - 1;
              } else if (targetIdx + 1 < tokens.length && /[\w\u00C0-\u017F'-]+/.test(tokens[targetIdx + 1])) {
                targetIdx = targetIdx + 1;
              }
            }
            popupTokenIdx = targetIdx;
          } else if (activeTokenIdx !== -1 && activeTokenIdx < tokens.length) {
            popupTokenIdx = activeTokenIdx;
          }

          const renderHoverPopup = () => (
            <span 
              className="sentence-hover-popup-wrapper" 
              onClick={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="sentence-hover-popup">
                <button
                  className={`sentence-hover-btn play-btn ${
                    isSpeaking && !isPaused && isCurrentReading && playSingle ? "active" : ""
                  }`}
                  onClick={() => onPlaySentence(index, true)}
                  title="Play only this sentence"
                >
                  {isSpeaking && !isPaused && isCurrentReading && playSingle ? (
                    <svg className="hover-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="hover-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                  <span className="btn-text">Only Sentence</span>
                </button>
                
                <button
                  className={`sentence-hover-btn play-all-btn ${
                    isSpeaking && !isPaused && isCurrentReading && !playSingle ? "active" : ""
                  }`}
                  onClick={() => onPlaySentence(index, false)}
                  title="Play from this sentence onwards"
                >
                  {isSpeaking && !isPaused && isCurrentReading && !playSingle ? (
                    <svg className="hover-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg className="hover-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42 5.43 5.43H5v2z"/>
                    </svg>
                  )}
                  <span className="btn-text">From Here</span>
                </button>
                
                <button
                  className="sentence-hover-btn stop-btn"
                  onClick={onStop}
                  disabled={!(isSpeaking && isCurrentReading)}
                  title="Stop playback"
                >
                  <svg className="hover-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                  <span className="btn-text">Stop</span>
                </button>
              </span>
            </span>
          );

          return (
            <span
              key={index}
              className={`story-sentence ${isCurrentReading ? "reading-now" : ""}`}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
            >
              {tokens.map((token, tIdx) => {
                const isWord = /[\w\u00C0-\u017F'-]+/.test(token);
                const isPopupTarget = hoveredIndex === index && tIdx === popupTokenIdx;

                if (isWord) {
                  const wordId = `chunk-${index}-token-${tIdx}`;
                  const isHighlighted = activeWordId === wordId;
                  return (
                    <span
                      key={tIdx}
                      className={`reader-word ${isHighlighted ? "active-highlight" : ""}`}
                      onMouseEnter={() => handleTokenHover(index, tIdx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onWordClick) {
                          onWordClick(token, wordId, e.currentTarget, chunk);
                        }
                      }}
                    >
                      {token}
                      {isPopupTarget && renderHoverPopup()}
                    </span>
                  );
                } else {
                  return (
                    <span 
                      key={tIdx}
                      style={isPopupTarget ? { position: "relative", display: "inline-block" } : undefined}
                      onMouseEnter={() => handleTokenHover(index, tIdx)}
                    >
                      {token}
                      {isPopupTarget && renderHoverPopup()}
                    </span>
                  );
                }
              })}
              {index < textChunks.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>

      {/* Live Chat Section right below Reader text */}
      <div className="practice-live-chat-section" ref={liveChatStageRef} style={{ marginTop: '3rem', marginBottom: '3rem' }}>
        {!liveChatActive ? (
          <div className="practice-live-chat-trigger glass-panel" onClick={startPracticeChatSession}>
            <div className="live-chat-trigger-orb">
              <div className="tutor-gemini-orb standby mini-orb">
                <div className="orb-pulse-ring-1"></div>
                <div className="orb-pulse-ring-2"></div>
                <div className="orb-core">
                  <svg viewBox="0 0 24 24" className="orb-mic-svg" width="26" height="26">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="live-chat-trigger-text">
              <div className="live-chat-trigger-title">
                <span className="live-dot-pulse"></span>
                <h4>Chat Live o Tekście</h4>
                <span className="read-percent-badge">
                  {showLiveChatBadge ? "GOTOWE (ODBLOKOWANO)" : `POSTĘP: ${Math.min(100, Math.round(readProgressRatio * 100))}%`}
                </span>
              </div>
              <p>
                {showLiveChatBadge
                  ? "Przeanalizowałeś już większość tekstu! Kliknij w kulę lub ten panel, aby lektor AI zadał Ci pytanie na żywo dotyczące tej czytanki i ocenił Twoją odpowiedź głosem."
                  : "Możesz kontynuować czytanie lub kliknąć w kulę już teraz, aby AI natychmiast zadało Ci pytanie dotyczące tekstu i oceniło Twoją wymowę!"}
              </p>
            </div>
            <div className="live-chat-trigger-btn">
              <span>{showLiveChatBadge ? "Otwórz Kulę Live" : "Rozpocznij Czat teraz"}</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        ) : (
          <div className="practice-live-chat-stage glass-panel">
            <div className="practice-live-header">
              <div className="live-title-row">
                <span className="live-dot-pulse active"></span>
                <h4>Rozmowa Audio o Lekturze (Chat Live)</h4>
              </div>
              <button className="close-live-chat-btn" onClick={() => {
                if (chatAudioRef.current) chatAudioRef.current.pause();
                if (chatMediaRecorderRef.current && isChatRecording) stopChatRecording();
                setLiveChatActive(false);
                setChatOrbStatus("inactive");
              }}>
                Zakończ rozmowę
              </button>
            </div>

            <div className="practice-live-orb-container">
              <button
                className={`tutor-gemini-orb ${chatOrbStatus}`}
                onClick={handleOrbClickInChat}
                title={
                  chatOrbStatus === "speaking" ? "Kliknij, aby przerwać i odpowiedzieć" :
                  chatOrbStatus === "listening" || isChatRecording ? "Kliknij, aby zakończyć nagrywanie i wysłać" :
                  "Kliknij, aby mówić"
                }
              >
                <div className="orb-pulse-ring-1"></div>
                <div className="orb-pulse-ring-2"></div>
                <div className="orb-core">
                  {chatOrbStatus === "inactive" || chatOrbStatus === "standby" ? (
                    <svg viewBox="0 0 24 24" className="orb-mic-svg">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  ) : chatOrbStatus === "speaking" ? (
                    <div className="orb-wave-container">
                      <span className="wave-bar bar-1"></span>
                      <span className="wave-bar bar-2"></span>
                      <span className="wave-bar bar-3"></span>
                    </div>
                  ) : chatOrbStatus === "listening" || isChatRecording ? (
                    <svg viewBox="0 0 24 24" className="orb-mic-svg" style={{fill: '#E8EAED'}}>
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <div className="spinner-small" style={{borderTopColor: '#fff', width: '28px', height: '28px'}}></div>
                  )}
                </div>
              </button>
              <div className="practice-live-status-label">
                {chatOrbStatus === "thinking" && "✨ AI analizuje czytankę i przygotowuje pierwsze pytanie..."}
                {chatOrbStatus === "speaking" && "AI zadaje pytanie... (Kliknij kulę, aby przerwać i odpowiedzieć)"}
                {(chatOrbStatus === "listening" || isChatRecording) && "🎙️ Słucham Twojej odpowiedzi... (Mów do mikrofonu, kliknij kulę, gdy skończysz)"}
                {chatOrbStatus === "inactive" && "Kliknij kulę, aby odpowiedzieć głosem"}
              </div>
            </div>

            <div className="practice-live-chat-history">
              {chatMessages.length === 0 && isChatProcessing && (
                <div className="live-chat-msg bot-msg">
                  <div className="msg-avatar">AI</div>
                  <div className="msg-content">
                    <div className="msg-bubble thinking-bubble">
                      <span className="dot-anim">.</span><span className="dot-anim">.</span><span className="dot-anim">.</span>
                    </div>
                  </div>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`live-chat-msg ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
                  <div className="msg-avatar">{msg.sender === 'user' ? 'TY' : 'AI'}</div>
                  <div className="msg-content">
                    <div className="msg-bubble">{msg.text}</div>
                    {msg.sender === 'user' && msg.evaluation && (
                      <div className="msg-evaluation-card">
                        <div className="eval-score-badge" style={{
                          backgroundColor: msg.evaluation.score >= 80 ? '#10B981' : msg.evaluation.score >= 60 ? '#F59E0B' : '#EF4444'
                        }}>
                          {msg.evaluation.score}/100
                        </div>
                        <p className="eval-feedback-text">{msg.evaluation.feedback}</p>
                        {msg.evaluation.better_version && (
                          <div className="eval-better-version">
                            <strong>Lepiej powiedzieć:</strong> {msg.evaluation.better_version}
                          </div>
                        )}
                        {msg.polish_insertions && msg.polish_insertions.length > 0 && (
                          <div className="eval-polish-note">
                            <strong>🇵🇱 Zauważono polskie słówka:</strong> {msg.polish_insertions.join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reader;
