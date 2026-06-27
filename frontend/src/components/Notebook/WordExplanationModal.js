import React, { useState, useEffect } from "react";
import { API_BASE_URL } from '../../config';
import "./WordExplanationModal.css";

const WordExplanationModal = ({ wordOrPhrase, user, onClose }) => {
  const [history, setHistory] = useState([]);
  const [activeText, setActiveText] = useState(wordOrPhrase);
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDefinition = async (text) => {
    setLoading(true);
    setError("");
    setDefinition(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/explain-word`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch word explanation.");
      }

      const data = await response.json();
      setDefinition(data);
    } catch (err) {
      console.error("Error fetching explanation:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinition(activeText);
  }, [activeText]);

  const handleDrilldown = (word) => {
    // Clean word from punctuation
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    if (!cleanWord) return;

    setHistory((prev) => [...prev, activeText]);
    setActiveText(cleanWord);
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prevText = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setActiveText(prevText);
  };

  const words = activeText.split(/\s+/).filter((w) => w.trim() !== "");
  const isPhrase = words.length > 1;

  return (
    <div className="explanation-modal-overlay">
      <div className="explanation-modal-card glass-panel">
        <header className="explanation-modal-header">
          {history.length > 0 ? (
            <button className="modal-back-btn" onClick={handleBack} title="Go back">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>
          ) : (
            <div className="modal-header-placeholder" />
          )}

          <button className="modal-close-btn" onClick={onClose} title="Close explanation">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="explanation-modal-body">
          <div className="explanation-title-container">
            {isPhrase ? (
              <div className="phrase-title-interactive">
                {words.map((w, idx) => (
                  <span
                    key={idx}
                    className="interactive-word-span"
                    onClick={() => handleDrilldown(w)}
                    title={`Click to define "${w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")}"`}
                  >
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <h2 className="word-title">{activeText}</h2>
            )}
            
            {isPhrase && (
              <p className="interactive-hint">Click any word in the expression to learn more</p>
            )}
          </div>

          {loading && (
            <div className="explanation-loading-container">
              <div className="skeleton-line title" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          )}

          {error && (
            <div className="explanation-error-container">
              <p className="error-message">{error}</p>
              <button className="btn-primary" onClick={() => fetchDefinition(activeText)}>
                Retry
              </button>
            </div>
          )}

          {definition && !loading && (
            <div className="explanation-content-container">
              {definition.direct_translations && definition.direct_translations.length > 0 && (
                <div className="direct-translations-wrapper">
                  <span className="direct-label">Tłumaczenie:</span>
                  <div className="direct-translations-list">
                    {definition.direct_translations.map((trans, tIdx) => (
                      <span key={tIdx} className="direct-trans-chip">{trans}</span>
                    ))}
                  </div>
                </div>
              )}

              {definition.phonetic && definition.phonetic !== "N/A" && definition.phonetic !== "" && (
                <div className="phonetics-wrapper">
                  <span className="phonetic-text">{definition.phonetic}</span>
                </div>
              )}

              <div className="meanings-list">
                {definition.meanings && definition.meanings.length > 0 ? (
                  definition.meanings.map((meaning, mIdx) => (
                    <div key={mIdx} className="meaning-item">
                      <div className="meaning-header">
                        <span className="part-of-speech-badge">
                          {meaning.partOfSpeech || "word"}
                        </span>
                      </div>
                      <div className="meaning-definitions">
                        <div className="definition-row">
                          <span className="lang-label">PL</span>
                          <p className="definition-text pl">{meaning.definition_pl}</p>
                        </div>
                        <div className="definition-row">
                          <span className="lang-label">EN</span>
                          <p className="definition-text en">{meaning.definition_en}</p>
                        </div>
                      </div>

                      {meaning.examples && meaning.examples.length > 0 && (
                        <div className="examples-section">
                          <h4>Examples</h4>
                          <ul className="examples-list">
                            {meaning.examples.map((ex, eIdx) => (
                              <li key={eIdx} className="example-item">
                                <p className="example-en">“{ex.en}”</p>
                                <p className="example-pl">{ex.pl}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-meanings">No detailed meanings found for this entry.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordExplanationModal;
