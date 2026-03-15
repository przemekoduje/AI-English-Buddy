import React, { useState } from "react";
import "./Reader.css";

const Reader = ({
  generatedText,
  textChunks,
  currentChunkIndex,
  isSpeaking,
  isPaused,
  onPlayback,
  onStop,
  voices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  speechRate,
  setSpeechRate,
  speechPitch,
  setSpeechPitch,
  onTextSelection,
  onStartMastery,
}) => {
  const [controlsVisible, setControlsVisible] = useState(true);

  const handleTextSelectionWrapper = (e) => {
    if (onTextSelection) onTextSelection(e);
  };

  return (
    <div className="reader-container">
      <div className="reader-header">
        <button 
          className="mastery-btn" 
          onClick={onStartMastery}
        >
          ✨ Mastery Path Training
        </button>
        <button 
          className="toggle-controls" 
          onClick={() => setControlsVisible(!controlsVisible)}
        >
          {controlsVisible ? "Collapse Controls" : "Show Voice Controls"}
        </button>
      </div>

      {controlsVisible && (
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

          <div className="playback-actions">
            <button 
              className={`playback-btn ${isSpeaking && !isPaused ? 'active' : ''}`}
              onClick={onPlayback}
            >
              {isSpeaking && !isPaused ? "⏸ Pause Reading" : "▶ Start Listening"}
            </button>
            <button className="stop-btn" onClick={onStop} disabled={!isSpeaking}>
              ⏹ Stop
            </button>
          </div>
        </div>
      )}

      <div className="story-typography" onMouseUp={handleTextSelectionWrapper}>
        {textChunks.map((chunk, index) => (
          <span
            key={index}
            className={`story-sentence ${index === currentChunkIndex ? "reading-now" : ""}`}
          >
            {chunk}
            {index < textChunks.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Reader;
