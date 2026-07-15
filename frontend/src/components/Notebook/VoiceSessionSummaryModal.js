import React, { useState } from "react";
import { API_BASE_URL } from '../../config';
import "./SessionSummaryModal.css"; // Reuse the beautiful layout styling

const VoiceSessionSummaryModal = ({ summary, user, onClose, onAddWord }) => {
  const [email, setEmail] = useState(user?.email || "");
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // 'success' | 'error' | null
  const [savedWords, setSavedWords] = useState([]); // List of original words that were saved

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSending(true);
    setEmailStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-chat-summary-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({
          recipient_email: email,
          summary: summary,
        }),
      });
      if (response.ok) {
        setEmailStatus("success");
      } else {
        const errData = await response.json().catch(() => ({}));
        if (errData.error) alert(errData.error);
        setEmailStatus("error");
      }
    } catch (err) {
      console.error("Error sending summary email:", err);
      alert("Błąd połączenia z serwerem przy wysyłaniu e-maila.");
      setEmailStatus("error");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveWord = async (word, translation) => {
    if (onAddWord) {
      try {
        await onAddWord(word, translation);
        setSavedWords((prev) => [...prev, word]);
      } catch (err) {
        console.error("Error saving vocabulary word:", err);
      }
    } else {
      // In-line fallback POST request in case prop is not provided
      try {
        const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
          body: JSON.stringify({
            original: word,
            translated: translation,
            story_id: "chat-free",
          }),
        });
        if (response.ok) {
          setSavedWords((prev) => [...prev, word]);
        }
      } catch (err) {
        console.error("Error saving vocabulary word fallback:", err);
      }
    }
  };

  const issues = summary?.issues || [];
  const vocabulary = summary?.vocabulary || [];
  const averageScore = summary?.average_score || 0;
  const feedbackPl = summary?.feedback_pl || "Brak szczegółowego podsumowania lekcji.";

  return (
    <div className="summary-modal-overlay" data-testid="voice-summary-modal">
      <div className="summary-modal-content glass-panel animate-zoom">
        <header className="summary-modal-header" style={{ background: "linear-gradient(135deg, #e0f2fe, #f0f9ff)" }}>
          <h2>Podsumowanie Lekcji Głosowej AI</h2>
          <button className="close-btn" onClick={onClose} aria-label="Zamknij">&times;</button>
        </header>

        <div className="summary-modal-body">
          {/* 1. Score and Feedback */}
          <section className="summary-card" style={{ borderLeft: "4px solid #1a73e8" }}>
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-icon">🏆</span>
                <h3>Twój wynik i ocena lekcji</h3>
              </div>
              <span className="status-badge level-wysokie" style={{ fontSize: "1rem" }}>
                Średnia: {averageScore}/100
              </span>
            </div>
            <div className="card-body">
              <p className="feedback-text" style={{ fontSize: "1.05rem", fontWeight: "500" }}>{feedbackPl}</p>
            </div>
          </section>

          {/* 2. Issues to reinforce */}
          <section className="summary-section">
            <div className="section-title-wrapper">
              <span className="section-title-icon">🗣️</span>
              <h3>Zagadnienia do utrwalenia</h3>
            </div>
            {issues.length === 0 ? (
              <p className="no-data-text">Świetnie! Nie zanotowano poważniejszych błędów językowych.</p>
            ) : (
              <div className="forgotten-words-list">
                {issues.map((item, idx) => (
                  <div key={idx} className="forgotten-word-card" style={{ borderLeft: "4px solid #ef4444", background: "#fef2f2", borderColor: "#fee2e2" }}>
                    <div className="forgotten-card-header">
                      <div>
                        <h5 className="forgotten-word-title" style={{ color: "#dc2626" }}>
                          ❌ Twoja wypowiedź:
                        </h5>
                        <p style={{ margin: "5px 0", fontStyle: "italic", fontSize: "0.95rem", color: "#7f1d1d" }}>
                          "{item.original}"
                        </p>
                      </div>
                    </div>
                    <div className="forgotten-example" style={{ border: "1px solid #fecaca", background: "white", padding: "10px" }}>
                      <strong style={{ color: "#16a34a" }}>👉 Propozycja poprawy / urozmaicenia:</strong>
                      <p style={{ margin: "5px 0", fontWeight: "600", fontSize: "0.95rem", color: "#14532d" }}>
                        "{item.corrected}"
                      </p>
                    </div>
                    <p className="forgotten-reason" style={{ background: "rgba(239, 68, 68, 0.05)", color: "#991b1b" }}>
                      💡 <strong>Komentarz:</strong> {item.explanation_pl}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Session Vocabulary */}
          <section className="summary-section">
            <div className="section-title-wrapper">
              <span className="section-title-icon">📓</span>
              <h3>Słownictwo z lekcji</h3>
            </div>
            {vocabulary.length === 0 ? (
              <p className="no-data-text">Brak nowego słownictwa do wyodrębnienia z tej sesji.</p>
            ) : (
              <div className="forgotten-words-list">
                {vocabulary.map((item, idx) => {
                  const isSaved = savedWords.includes(item.word);
                  return (
                    <div key={idx} className="forgotten-word-card" style={{ borderLeft: "4px solid #16a34a", background: "#f0fdf4", borderColor: "#dcfce7" }}>
                      <div className="forgotten-card-header" style={{ alignItems: "center" }}>
                        <div>
                          <h5 className="forgotten-word-title" style={{ color: "#15803d" }}>
                            {item.word}
                          </h5>
                          <span className="forgotten-translation" style={{ color: "#14532d" }}>
                            — {item.translation}
                          </span>
                        </div>
                        <button 
                          className={`btn-save-forgotten ${isSaved ? "saved" : ""}`}
                          onClick={() => handleSaveWord(item.word, item.translation)}
                          disabled={isSaved}
                          style={{
                            background: isSaved ? "#16a34a" : "#1a73e8",
                            padding: "0.4rem 1rem",
                            fontSize: "0.85rem"
                          }}
                        >
                          {isSaved ? "✓ Zapisano" : "Dodaj do notesu"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Email report */}
          <section className="email-report-section">
            <h3>Wyślij podsumowanie na e-mail</h3>
            <form onSubmit={handleSendEmail} className="email-form">
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
                {isSending ? "Wysyłanie..." : "Wyślij e-mail"}
              </button>
            </form>
            
            {emailStatus === "success" && (
              <p className="status-msg success">Podsumowanie zostało wysłane!</p>
            )}
            {emailStatus === "error" && (
              <p className="status-msg error">Nie udało się wysłać e-maila. Spróbuj ponownie.</p>
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

export default VoiceSessionSummaryModal;
