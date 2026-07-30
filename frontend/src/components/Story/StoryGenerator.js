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
  const size = 16;
  const strokeWidth = 2.5;
  const style = { display: 'inline-block', verticalAlign: 'middle' };
  
  if (!topicName) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }
  
  const t = topicName.toLowerCase();
  
  if (t.includes("business")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  if (t.includes("discovery") || t.includes("future")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    );
  }
  if (t.includes("ai") || t.includes("tech") || t.includes("technology") || t.includes("robot")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4M8 15h.01M16 15h.01" />
      </svg>
    );
  }
  if (t.includes("nature") || t.includes("environment")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M2 22c1.25-6.75 6.75-12.25 13.5-13.5M22 2c-1.25 6.75-6.75 12.25-13.5 13.5M9 15c0-4.5 3.5-8 8-8M15 9c0 4.5-3.5 8-8 8" />
      </svg>
    );
  }
  if (t.includes("history") || t.includes("past")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M4 18h16M10 9v9M14 9v9M18 9v9M6 9v9M3 9h18M12 2L3 9h18z" />
      </svg>
    );
  }
  if (t.includes("science")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M6 3h12M12 3v14M9 12h6M5 21h14M8 12a4 4 0 0 0-4 4v5h16v-5a4 4 0 0 0-4-4" />
      </svg>
    );
  }
  if (t.includes("travel") || t.includes("adventure")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    );
  }
  if (t.includes("culture") || t.includes("art") || t.includes("music")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 6.00857 19 6.50857 18.5C7.00857 18 7.50857 17.5 8.50857 17.5C9.50857 17.5 9.50857 19 9.50857 20C9.50857 21 11.0086 22 12 22Z" />
        <circle cx="7.5" cy="10.5" r="1.5" />
        <circle cx="11.5" cy="7.5" r="1.5" />
        <circle cx="16.5" cy="9.5" r="1.5" />
      </svg>
    );
  }
  if (t.includes("health") || t.includes("sport")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
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
          <span className="gen-tab-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </span>
          <span>AI Lesson Generator</span>
        </button>
        <button
          type="button"
          className={`gen-tab-btn ${activeTab === "paste" ? "active" : ""}`}
          onClick={() => setActiveTab("paste")}
        >
          <span className="gen-tab-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </span>
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
            <span className="btn-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
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
