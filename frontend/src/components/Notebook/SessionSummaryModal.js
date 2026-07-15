import React, { useState } from "react";
import "./SessionSummaryModal.css";

const SessionSummaryModal = ({ summary, user, onClose, onSendEmail, onAddWord }) => {
  const [email, setEmail] = useState(user?.email || "");
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // 'success' | 'error' | null
  const [savedForgottenWords, setSavedForgottenWords] = useState([]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSending(true);
    setEmailStatus(null);
    try {
      const result = await onSendEmail(email);
      const isSuccess = typeof result === 'object' && result !== null ? result.success : Boolean(result);
      const errorMsg = typeof result === 'object' && result !== null ? result.error : null;
      if (isSuccess) {
        setEmailStatus("success");
      } else {
        if (errorMsg) alert(errorMsg);
        setEmailStatus("error");
      }
    } catch (err) {
      setEmailStatus("error");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveWord = async (word, translation) => {
    if (onAddWord) {
      try {
        await onAddWord(word, translation);
        setSavedForgottenWords((prev) => [...prev, word]);
      } catch (err) {
        console.error("Błąd podczas zapisywania słówka:", err);
      }
    }
  };

  // Safely extract fields from summary with default values
  const listening = summary?.listening_analysis || {};
  const engagement = summary?.engagement_analysis || {};
  const drills = summary?.pronunciation_drills || [];
  const vocabulary = summary?.vocabulary_analysis || {};
  const addedWords = vocabulary?.added_words || [];
  const forgottenWords = vocabulary?.forgotten_words || [];

  return (
    <div className="summary-modal-overlay" data-testid="summary-modal">
      <div className="summary-modal-content glass-panel animate-zoom">
        <header className="summary-modal-header">
          <h2>Podsumowanie Aktywności AI</h2>
          <button className="close-btn" onClick={onClose} aria-label="Zamknij">&times;</button>
        </header>

        <div className="summary-modal-body">
          {/* 1. Listening completeness */}
          <section className="summary-card listening-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-icon">🎧</span>
                <h3>Odsłuch i Kompletność Tekstu</h3>
              </div>
              <span className={`status-badge ${listening.completed_entire_text ? "success" : "warning"}`}>
                {listening.completed_entire_text ? "Ukończono w całości" : "Częściowy odsłuch"}
              </span>
            </div>
            <div className="card-body">
              <div className="progress-bar-container">
                <div className="progress-bar-label">
                  <span>Przesłuchane zdania:</span>
                  <strong>{listening.sentences_listened || 0} / {listening.total_sentences || 0}</strong>
                </div>
                <div className="progress-track">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${listening.total_sentences ? (listening.sentences_listened / listening.total_sentences) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              <p className="feedback-text">{listening.feedback_pl || "Brak danych o odsłuchu tekstu."}</p>
            </div>
          </section>

          {/* 2. Engagement */}
          <section className="summary-card engagement-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-icon">🔥</span>
                <h3>Ocena Zaangażowania</h3>
              </div>
              <span className={`status-badge level-${(engagement.level || "Średnie").toLowerCase()}`}>
                Poziom: {engagement.level || "Średnie"}
              </span>
            </div>
            <div className="card-body">
              <div className="stats-row">
                <div className="stat-box">
                  <span className="stat-num">{engagement.dictionary_checks_count || 0}</span>
                  <span className="stat-lbl">Sprawdzeń słownika</span>
                </div>
                <div className="stat-box">
                  <span className="stat-num">{engagement.saved_words_count || 0}</span>
                  <span className="stat-lbl">Dodanych słówek</span>
                </div>
              </div>
              <p className="feedback-text">{engagement.feedback_pl || "Brak danych o zaangażowaniu."}</p>
            </div>
          </section>

          {/* 3. Pronunciation & Listening (odsłuchiwana wymowa) */}
          <section className="summary-section drills-section">
            <div className="section-title-wrapper">
              <span className="section-title-icon">🗣️</span>
              <h3>Ćwiczona Wymowa i Poprawny Odsłuch</h3>
            </div>
            {drills.length === 0 ? (
              <p className="no-data-text">Nie odsłuchiwałeś wymowy słówek w tej sesji.</p>
            ) : (
              <div className="drills-grid">
                {drills.map((drill, idx) => (
                  <div key={idx} className={`drill-word-card ${drill.was_mispronounced ? "mispronounced" : ""}`}>
                    <div className="drill-card-top">
                      <span className="drill-word">{drill.word}</span>
                      <span className="drill-count-badge">
                        {drill.was_mispronounced ? "Słaba wymowa ⚠️" : `Odsłuch: ${drill.times_listened || 1}x`}
                      </span>
                    </div>
                    <p className="drill-translation">{drill.translation}</p>
                    {drill.example && (
                      <div className="drill-example">
                        <strong>Przykład:</strong> <em>{drill.example}</em>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Vocabulary additions & gaps */}
          <section className="summary-section vocab-section">
            <div className="section-title-wrapper">
              <span className="section-title-icon">📓</span>
              <h3>Słownictwo i Luki w Nauce</h3>
            </div>

            <div className="vocab-sub-layout">
              <div className="added-words-container">
                <h4>Dodane do słownika w tej sesji ({addedWords.length})</h4>
                {addedWords.length === 0 ? (
                  <p className="no-data-subtext">Nie dodano żadnych słówek.</p>
                ) : (
                  <div className="added-words-chips">
                    {addedWords.map((word, idx) => (
                      <span key={idx} className="added-word-chip">✓ {word}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="forgotten-words-container">
                <h4>Słówka sprawdzone, lecz pominięte ({forgottenWords.length})</h4>
                {forgottenWords.length === 0 ? (
                  <p className="no-data-subtext success-msg">Świetnie! Wszystkie sprawdzane słowa zostały zapisane.</p>
                ) : (
                  <div className="forgotten-words-list">
                    {forgottenWords.map((item, idx) => {
                      const isSaved = savedForgottenWords.includes(item.word);
                      return (
                        <div key={idx} className="forgotten-word-card">
                          <div className="forgotten-card-header">
                            <div>
                              <h5 className="forgotten-word-title">{item.word}</h5>
                              <span className="forgotten-translation">{item.translation}</span>
                            </div>
                            <button 
                              className={`btn-save-forgotten ${isSaved ? "saved" : ""}`}
                              onClick={() => handleSaveWord(item.word, item.translation)}
                              disabled={isSaved}
                            >
                              {isSaved ? "✓ Zapisano" : "Dodaj do notesu"}
                            </button>
                          </div>
                          {item.example && (
                            <div className="forgotten-example">
                              <strong>Przykład użycia:</strong> <em>{item.example}</em>
                            </div>
                          )}
                          <p className="forgotten-reason">
                            💡 <strong>Dlaczego warto zapisać:</strong> {item.reason_pl}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Email report */}
          <section className="email-report-section">
            <h3>Wyślij raport na e-mail</h3>
            <form onSubmit={handleSend} className="email-form">
              <input
                type="email"
                placeholder="Wpisz adres e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSending}
                className="premium-text-input"
              />
              <button type="submit" disabled={isSending || !email} className="btn-send-report">
                {isSending ? "Wysyłanie..." : "Wyślij raport"}
              </button>
            </form>
            
            {emailStatus === "success" && (
              <p className="status-msg success">Raport został pomyślnie wysłany!</p>
            )}
            {emailStatus === "error" && (
              <p className="status-msg error">Nie udało się wysłać raportu. Spróbuj ponownie.</p>
            )}
          </section>
        </div>

        <footer className="summary-modal-footer">
          <button onClick={onClose} className="btn-close-footer">Zamknij podsumowanie</button>
        </footer>
      </div>
    </div>
  );
};

export default SessionSummaryModal;
