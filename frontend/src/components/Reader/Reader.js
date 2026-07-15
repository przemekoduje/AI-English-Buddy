import React, { useState, useRef } from "react";
import "./Reader.css";

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
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState(null);
  const hoverTimerRef = useRef(null);
  const hoveredTokenIndexRef = useRef(null);

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
    </div>
  );
};

export default Reader;
