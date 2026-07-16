import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from '../../config';
import "./StoryGenerator.css";

const GENERATION_PHASES = [
  { label: "Analizuję temat...",        targetPct: 12, durationMs: 1800  },
  { label: "Tworzę strukturę lekcji...", targetPct: 28, durationMs: 2800  },
  { label: "Generuję treść...",          targetPct: 55, durationMs: 6000  },
  { label: "Opracowuję tłumaczenia...",  targetPct: 72, durationMs: 5000  },
  { label: "Finalizuję sekcje...",       targetPct: 88, durationMs: 5000  },
  { label: "Prawie gotowe...",           targetPct: 95, durationMs: 4000  },
];

const getTopicIcon = (topicName) => {
  if (!topicName) return "✨";
  const t = topicName.toLowerCase();
  if (t.includes("business")) return "💼";
  if (t.includes("discovery")) return "🚀";
  if (t.includes("ai") || t.includes("tech")) return "🤖";
  if (t.includes("nature") || t.includes("environment")) return "🌿";
  if (t.includes("history") || t.includes("past")) return "🏛️";
  if (t.includes("science")) return "🔬";
  if (t.includes("travel")) return "✈️";
  if (t.includes("culture") || t.includes("art")) return "🎨";
  if (t.includes("health") || t.includes("sport")) return "💪";
  return "✨";
};

const StoryGenerator = ({ onGenerate, onGenerateDefault, onPasteText, isLoading, suggestedTopics, user }) => {
  const [activeTab, setActiveTab] = useState("ai");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customDetails, setCustomDetails] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    language_level: "medium",
    length: "medium",
    is_factual: false,
    protagonist: "",
    genre: "adventure",
    focus_area: "none",
    is_popular_science: false,
    scientific_bias: false,
    scientific_communication: false,
    scientific_language_link: false
  });

  // Progress bar state
  const [genProgress, setGenProgress] = useState(0);
  const [genPhaseLabel, setGenPhaseLabel] = useState("");
  const progressTimersRef = useRef([]);

  const clearProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach(t => clearTimeout(t));
    progressTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (isLoading) {
      setGenProgress(0);
      setGenPhaseLabel(GENERATION_PHASES[0].label);
      clearProgressTimers();

      let elapsed = 0;
      GENERATION_PHASES.forEach((phase, idx) => {
        const t = setTimeout(() => {
          setGenProgress(phase.targetPct);
          setGenPhaseLabel(phase.label);
        }, elapsed);
        progressTimersRef.current.push(t);
        elapsed += phase.durationMs;
      });
    } else {
      // Generation done — snap to 100 then reset
      setGenProgress(100);
      const t = setTimeout(() => {
        setGenProgress(0);
        setGenPhaseLabel("");
        clearProgressTimers();
      }, 500);
      progressTimersRef.current.push(t);
    }
    return () => clearProgressTimers();
  }, [isLoading, clearProgressTimers]);



  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
          headers: { "X-Session-Token": user.token }
        });
        if (response.ok) {
          const data = await response.json();
          setSettings(prev => ({ ...prev, ...data }));
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
      await fetch(`${API_BASE_URL}/api/user-settings`, {
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
      {isLoading && (
        <div className="generation-progress-overlay">
          <div className="gen-progress-card">
            <div className="gen-progress-ring-wrapper">
              <svg className="gen-progress-ring" viewBox="0 0 120 120">
                <circle
                  className="gen-progress-ring-track"
                  cx="60" cy="60" r="50"
                  fill="none" strokeWidth="8"
                />
                <circle
                  className="gen-progress-ring-fill"
                  cx="60" cy="60" r="50"
                  fill="none" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - genProgress / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="gen-progress-pct">{Math.round(genProgress)}%</div>
            </div>
            <div className="gen-progress-label">{genPhaseLabel}</div>
            <div className="gen-progress-title">Tworzę Twoją lekcję</div>
            <div className="gen-progress-subtitle">To może potrwać do 30 sekund...</div>
          </div>
        </div>
      )}

      {!isLoading && (
      <>
      <div className="generator-top-tabs">
        <button
          type="button"
          className={`gen-tab-btn ${activeTab === "ai" ? "active" : ""}`}
          onClick={() => setActiveTab("ai")}
        >
          <span className="gen-tab-icon">✨</span>
          <span>AI Lesson Generator</span>
        </button>
        <button
          type="button"
          className={`gen-tab-btn ${activeTab === "paste" ? "active" : ""}`}
          onClick={() => setActiveTab("paste")}
        >
          <span className="gen-tab-icon">📋</span>
          <span>...or Paste External Text</span>
          <span className="gen-tab-badge">Instant Practice</span>
        </button>
      </div>

      {activeTab === "ai" ? (
      <>
      <div className="generator-header">
        <h2>Generate Your Story</h2>
        <p>Choose topics and add details to create a unique learning experience.</p>
      </div>

      <div className="topic-grid">
        {suggestedTopics.map((topic) => {
          const isSelected = selectedTopics.includes(topic);
          return (
            <button
              key={topic}
              onClick={() => handleTopicToggle(topic)}
              className={`topic-chip ${isSelected ? "selected" : ""}`}
              disabled={isLoading}
            >
              <span className="topic-chip-icon">{getTopicIcon(topic)}</span>
              <span className="topic-chip-text">{topic}</span>
              {isSelected && <span className="topic-chip-check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="settings-toggle-container">
        <button 
          type="button"
          className={`settings-toggle-btn ${showSettings ? "active" : ""}`}
          onClick={() => setShowSettings(!showSettings)}
          disabled={isLoading}
        >
          <span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Story Style & Settings
          </span>
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
                <option value="none">General English</option>
                <option value="phrasal_verbs">Phrasal Verbs</option>
                <option value="idioms">English Idioms</option>
                <option value="past_tenses">Past Tenses focus</option>
                <option value="business">Business English</option>
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
                <span className="checkbox-text">Based on real-world facts</span>
              </label>
            </div>

            <div className="setting-group checkbox-group popular-science-section">
              <label className="switch-label main-popular-science-switch">
                <input
                  type="checkbox"
                  checked={settings.is_popular_science || false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSettings(prev => ({
                      ...prev,
                      is_popular_science: checked,
                      scientific_bias: checked ? true : prev.scientific_bias,
                      scientific_communication: checked ? true : prev.scientific_communication,
                      scientific_language_link: checked ? true : prev.scientific_language_link
                    }));
                  }}
                  disabled={isLoading}
                />
                <span className="checkbox-text">Popular science style (Styl popularnonaukowy)</span>
              </label>

              {settings.is_popular_science && (
                <div className="popular-science-suboptions">
                  <label className="switch-label sub-checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.scientific_bias || false}
                      onChange={(e) => setSettings(prev => ({ ...prev, scientific_bias: e.target.checked }))}
                      disabled={isLoading}
                    />
                    <span className="checkbox-text">Explain cognitive biases & psychology</span>
                  </label>

                  <label className="switch-label sub-checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.scientific_communication || false}
                      onChange={(e) => setSettings(prev => ({ ...prev, scientific_communication: e.target.checked }))}
                      disabled={isLoading}
                    />
                    <span className="checkbox-text">Focus on communication barriers & paradoxes</span>
                  </label>

                  <label className="switch-label sub-checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.scientific_language_link || false}
                      onChange={(e) => setSettings(prev => ({ ...prev, scientific_language_link: e.target.checked }))}
                      disabled={isLoading}
                    />
                    <span className="checkbox-text">Relate to language learning & agility</span>
                  </label>
                </div>
              )}
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

      <div className="generator-actions">
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
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              </span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onGenerateDefault}
          disabled={isLoading}
          className="generate-default-btn"
        >
          {isLoading ? (
            <span className="loader-inner">Developing Lesson...</span>
          ) : (
            <>
              <span>Generuj lekcję domyślną</span>
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </span>
            </>
          )}
        </button>
      </div>

      <div className="paste-quick-trigger-banner" onClick={() => setActiveTab("paste")}>
        <div className="trigger-content">
          <span className="trigger-icon">📋</span>
          <div>
            <strong>...or paste text</strong> from external sources (articles, emails, books)
            <p>Click here to import your own text with full interactive vocabulary & TTS →</p>
          </div>
        </div>
      </div>
      </>
      ) : (
      <div className="paste-mode-panel glass-panel">
        <div className="paste-header">
          <h3>📋 ...or paste text (Import External Content)</h3>
          <p>Got an article from BBC News, a business report, or a story excerpt? Paste it below! We will save it to your server library and give you instant access to interactive word definitions, neural TTS pronunciation, grammar checks, and flashcards—just like an AI-generated lesson.</p>
        </div>

        <div className="paste-form-group">
          <label htmlFor="pasted-title-input">Story or Article Title (Optional)</label>
          <input
            id="pasted-title-input"
            type="text"
            className="premium-text-input"
            placeholder="e.g. BBC News: Deep Ocean Biology, My English Essay..."
            value={pastedTitle}
            onChange={(e) => setPastedTitle(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="paste-form-group">
          <label htmlFor="pasted-text-textarea" className="paste-textarea-label">
            <span>Paste English Content Here:</span>
            {pastedText && (
              <span className="paste-counter-badge">
                {pastedText.trim().split(/\s+/).filter(Boolean).length} words | {pastedText.length} chars
              </span>
            )}
          </label>
          <textarea
            id="pasted-text-textarea"
            className="paste-textarea"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste your ready-made external text right here... Any word you click while reading will be explained and automatically saved to your notebook!"
            rows="12"
            disabled={isLoading}
          />
        </div>

        <div className="paste-actions">
          <button
            type="button"
            className="load-pasted-btn"
            onClick={() => {
              if (!pastedText.trim()) {
                alert("Please paste some text before starting practice mode.");
                return;
              }
              if (onPasteText) {
                onPasteText(pastedText, pastedTitle);
              }
            }}
            disabled={isLoading || !pastedText.trim()}
          >
            <span className="btn-icon">🚀</span>
            <span>Save to Server & Start Practicing</span>
          </button>
          <button
            type="button"
            className="paste-clear-btn"
            onClick={() => {
              setPastedText("");
              setPastedTitle("");
            }}
            disabled={isLoading || (!pastedText && !pastedTitle)}
          >
            Clear Text
          </button>
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
};

export default StoryGenerator;
