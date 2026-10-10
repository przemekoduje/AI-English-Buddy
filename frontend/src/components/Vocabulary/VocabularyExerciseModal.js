import React, { useState } from "react";
import { API_BASE_URL } from "../../config";

const VocabularyExerciseModal = ({ notebookWords, user, onClose }) => {
  const [exerciseData, setExerciseData] = useState(null);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseTranslation, setExerciseTranslation] = useState("");
  const [exerciseResult, setExerciseResult] = useState(null);
  const [exerciseChecking, setExerciseChecking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleStartExercise = async () => {
    if (notebookWords.length === 0) return;
    setHasStarted(true);
    setExerciseLoading(true);
    setExerciseData(null);
    setExerciseResult(null);
    setExerciseTranslation("");
    setShowHint(false);
    try {
      // Shuffle words to ensure variety
      const shuffledWords = [...notebookWords].sort(() => 0.5 - Math.random());
      const selectedWords = shuffledWords.slice(0, 30);
      
      const res = await fetch(`${API_BASE_URL}/api/vocabulary/generate-exercise`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({ words: selectedWords }) // Send up to 30 shuffled words, AI picks a subset
      });
      if (res.ok) {
        const data = await res.json();
        setExerciseData(data);
      } else {
        alert("Błąd podczas generowania ćwiczenia.");
      }
    } catch (e) {
      console.error(e);
      alert("Błąd sieci podczas generowania ćwiczenia.");
    } finally {
      setExerciseLoading(false);
    }
  };

  const handleCheckExercise = async () => {
    if (!exerciseTranslation.trim() || !exerciseData) return;
    setExerciseChecking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vocabulary/check-translation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({
          target_word: exerciseData.target_words.join(", "),
          sentence_pl: exerciseData.sentence_pl,
          correct_en: exerciseData.correct_en,
          user_translation: exerciseTranslation
        })
      });
      if (res.ok) {
        const data = await res.json();
        setExerciseResult(data);
      } else {
        alert("Błąd sprawdzania.");
      }
    } catch (e) {
      console.error(e);
      alert("Błąd sieci podczas sprawdzania.");
    } finally {
      setExerciseChecking(false);
    }
  };

  if (!hasStarted) {
    handleStartExercise();
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: "1rem" }}>Przygotowywanie ćwiczenia...</h3>
          <div className="mini-loader">Generowanie zdania...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Ćwiczenie - Tłumaczenie</h3>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>✕ Zamknij</button>
        </div>

        {exerciseLoading && (
          <div className="mini-loader" style={{ margin: "2rem 0" }}>Trwa generowanie zadania...</div>
        )}

        {exerciseData && !exerciseLoading && (
          <div className="exercise-container">
            <h5 style={{ color: "var(--primary-700)", marginBottom: "0.5rem" }}>Przetłumacz poniższe zdanie na język angielski:</h5>
            <p style={{ fontSize: "1.1rem", marginBottom: "1rem", fontWeight: "600", padding: "1rem", background: "var(--slate-50)", borderRadius: "8px", borderLeft: "4px solid var(--primary-500)" }}>
              {exerciseData.sentence_pl}
            </p>
            
            <div style={{ marginBottom: "1rem" }}>
              {showHint ? (
                <p style={{ fontSize: "0.85rem", color: "var(--slate-600)" }}>
                  Użyj słów ze słownika: <strong>{exerciseData.target_words.join(", ")}</strong>
                </p>
              ) : (
                <button 
                  onClick={() => setShowHint(true)}
                  className="btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                >
                  Pokaż słówka, których należy użyć
                </button>
              )}
            </div>

            <textarea
              value={exerciseTranslation}
              onChange={e => setExerciseTranslation(e.target.value)}
              placeholder="Wpisz swoje tłumaczenie tutaj..."
              className="premium-input"
              style={{ minHeight: "100px", marginBottom: "1.5rem", width: "100%", fontSize: "1rem" }}
              disabled={exerciseChecking || exerciseResult}
            />

            {!exerciseResult ? (
              <button 
                onClick={handleCheckExercise} 
                className="btn-primary" 
                disabled={!exerciseTranslation.trim() || exerciseChecking}
                style={{ width: "100%", padding: "1rem", fontSize: "1rem", justifyContent: "center" }}
              >
                {exerciseChecking ? "Sprawdzanie..." : "Sprawdź tłumaczenie"}
              </button>
            ) : (
              <div className={`exercise-result ${exerciseResult.status}`} style={{ marginTop: "1rem", padding: "1.5rem", borderRadius: "8px", background: exerciseResult.status === 'correct' ? '#ecfdf5' : exerciseResult.status === 'acceptable' ? '#fffbeb' : '#fef2f2', border: `1px solid ${exerciseResult.status === 'correct' ? '#10b981' : exerciseResult.status === 'acceptable' ? '#f59e0b' : '#ef4444'}` }}>
                <h4 style={{ color: exerciseResult.status === 'correct' ? '#047857' : exerciseResult.status === 'acceptable' ? '#b45309' : '#b91c1c', marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {exerciseResult.status === 'correct' && "✅ Rewelacja!"}
                  {exerciseResult.status === 'acceptable' && "⚠️ Dobrze, ale można lepiej!"}
                  {exerciseResult.status === 'incorrect' && "❌ Spróbuj jeszcze raz!"}
                </h4>
                <p style={{ fontSize: "1rem", whiteSpace: "pre-wrap", color: "var(--slate-800)", lineHeight: "1.5" }}>{exerciseResult.feedback}</p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button 
                    onClick={handleStartExercise}
                    className="btn-primary" 
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Kolejne zdanie
                  </button>
                  {exerciseResult.status === 'incorrect' && (
                    <button 
                      onClick={() => setExerciseResult(null)}
                      className="btn-secondary" 
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      Popraw błędy
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VocabularyExerciseModal;
