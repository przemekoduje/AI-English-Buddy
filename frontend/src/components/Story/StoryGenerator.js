import React, { useState, useEffect } from "react";
import "./StoryGenerator.css";

const StoryGenerator = ({ onGenerate, isLoading, suggestedTopics, user }) => {
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customDetails, setCustomDetails] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    language_level: "medium",
    length: "medium",
    is_factual: false,
    protagonist: "",
    genre: "adventure",
    focus_area: "none"
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const response = await fetch("http://127.0.0.1:5001/api/user-settings", {
          headers: { "X-Session-Token": user.token }
        });
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (err) {
        console.error("Błąd podczas ładowania ustawień:", err);
      }
    };
    fetchSettings();
  }, [user]);

  const handleTopicToggle = (topic) => {
    setSelectedTopics((prevSelected) =>
      prevSelected.includes(topic)
        ? prevSelected.filter((t) => t !== topic)
        : [...prevSelected, topic]
    );
  };

  const handleGenerateStory = async () => {
    if (selectedTopics.length === 0 && !customDetails.trim()) {
      alert("Proszę wybrać co najmniej jeden temat lub opisać szczegóły w polu tekstowym.");
      return;
    }

    try {
      await fetch("http://127.0.0.1:5001/api/user-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify(settings)
      });
    } catch (err) {
      console.error("Błąd zapisu ustawień:", err);
    }

    onGenerate(selectedTopics, customDetails, settings);
  };

  return (
    <div className="story-generator">
      <div className="generator-header">
        <h2>Generate Your Story</h2>
        <p>Choose topics and add details to create a unique learning experience.</p>
      </div>

      <div className="topic-grid">
        {suggestedTopics.map((topic) => (
          <button
            key={topic}
            onClick={() => handleTopicToggle(topic)}
            className={`topic-chip ${selectedTopics.includes(topic) ? "selected" : ""}`}
            disabled={isLoading}
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="settings-toggle-container">
        <button 
          type="button"
          className={`settings-toggle-btn ${showSettings ? "active" : ""}`}
          onClick={() => setShowSettings(!showSettings)}
          disabled={isLoading}
        >
          <span>⚙️ Story Style & Settings</span>
          <span>{showSettings ? "▲" : "▼"}</span>
        </button>
      </div>

      {showSettings && (
        <div className="generator-settings-panel glass-panel">
          <div className="settings-grid">
            <div className="setting-group">
              <label>Language Level</label>
              <div className="setting-chips">
                {["simple", "medium", "advanced"].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`setting-chip ${settings.language_level === lvl ? "active" : ""}`}
                    onClick={() => setSettings(prev => ({ ...prev, language_level: lvl }))}
                    disabled={isLoading}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label>Story Length</label>
              <div className="setting-chips">
                {["short", "medium", "long"].map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`setting-chip ${settings.length === len ? "active" : ""}`}
                    onClick={() => setSettings(prev => ({ ...prev, length: len }))}
                    disabled={isLoading}
                  >
                    {len.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>


            <div className="setting-group">
              <label>Grammar & Vocab Focus</label>
              <select
                className="premium-select"
                value={settings.focus_area}
                onChange={(e) => setSettings(prev => ({ ...prev, focus_area: e.target.value }))}
                disabled={isLoading}
              >
                <option value="none">✨ General English</option>
                <option value="phrasal_verbs">📚 Phrasal Verbs</option>
                <option value="idioms">💬 English Idioms</option>
                <option value="past_tenses">⏳ Past Tenses focus</option>
                <option value="business">📈 Business English</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Main Character Name (Optional)</label>
              <input
                type="text"
                className="premium-text-input"
                placeholder="e.g. Professor Albert, Emily..."
                value={settings.protagonist}
                onChange={(e) => setSettings(prev => ({ ...prev, protagonist: e.target.value }))}
                disabled={isLoading}
              />
            </div>

            <div className="setting-group checkbox-group">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={settings.is_factual}
                  onChange={(e) => setSettings(prev => ({ ...prev, is_factual: e.target.checked }))}
                  disabled={isLoading}
                />
                <span className="checkbox-text">📖 Based on real-world facts</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="details-composer">
        <textarea
          value={customDetails}
          onChange={(e) => setCustomDetails(e.target.value)}
          placeholder="Describe any specific events, characters, or context you'd like to include..."
          rows="4"
          disabled={isLoading}
        />
      </div>

      <button
        onClick={handleGenerateStory}
        disabled={isLoading || (selectedTopics.length === 0 && !customDetails.trim())}
        className="generate-story-btn"
      >
        {isLoading ? (
          <span className="loader-inner">Developing Story...</span>
        ) : (
          <>
            <span>Craft My Story</span>
            <span className="btn-icon">✨</span>
          </>
        )}
      </button>
    </div>
  );
};

export default StoryGenerator;
