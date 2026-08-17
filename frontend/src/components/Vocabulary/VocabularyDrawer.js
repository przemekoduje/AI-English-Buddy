import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../../config";
import "./VocabularyDrawer.css";
import Flashcards from "../Flashcards";
import WordExplanationModal from "../Notebook/WordExplanationModal";
import PronunciationPracticeModal from "../Notebook/PronunciationPracticeModal";

const VocabularyDrawer = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, words, phrases

  // Detail Expansion
  const [expandedWordId, setExpandedWordId] = useState(null);

  // Lazy Loading Quiz State
  const [loadingQuizIds, setLoadingQuizIds] = useState({});
  const [selectedAnswers, setSelectedAnswers] = useState({});

  // Additional Exercises State
  const [activeExerciseTabs, setActiveExerciseTabs] = useState({}); // wordId -> 'synonyms' | 'pl_to_en' | 'en_blank'
  const [plToEnAnswers, setPlToEnAnswers] = useState({}); // wordId -> { 0: '', 1: '', 2: '' }
  const [plToEnChecked, setPlToEnChecked] = useState({}); // wordId -> { 0: boolean, 1: boolean, 2: boolean }
  const [enBlankAnswers, setEnBlankAnswers] = useState({}); // wordId -> { 0: '', 1: '', 2: '' }
  const [enBlankChecked, setEnBlankChecked] = useState({}); // wordId -> { 0: boolean, 1: boolean, 2: boolean }

  const cleanStringForComparison = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\"']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Modals state
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [explanationWord, setExplanationWord] = useState(null);
  const [practiceTargetText, setPracticeTargetText] = useState(null);

  // TTS State
  const [playingWord, setPlayingWord] = useState(null);

  // Email status
  const [sendingEmail, setSendingEmail] = useState(false);

  // Fetch vocabulary
  const fetchVocabulary = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        headers: {
          "X-Session-Token": user.token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWords(data);
      }
    } catch (err) {
      console.error("Error fetching vocabulary in drawer:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load & Event Listeners
  useEffect(() => {
    fetchVocabulary();

    const handleUpdate = () => {
      fetchVocabulary();
    };

    window.addEventListener("vocabulary-updated", handleUpdate);
    return () => {
      window.removeEventListener("vocabulary-updated", handleUpdate);
    };
  }, [fetchVocabulary]);

  // Handle TTS
  const handlePlayTTS = async (e, text) => {
    e.stopPropagation();
    if (playingWord === text) return;
    setPlayingWord(text);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: "en-US-BrianNeural",
        }),
      });
      if (!response.ok) throw new Error("TTS failed");
      const data = await response.json();
      if (data.audio_base64) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const audio = new Audio(audioUrl);
        audio.onended = () => setPlayingWord(null);
        audio.onerror = () => setPlayingWord(null);
        audio.play();
      } else {
        setPlayingWord(null);
      }
    } catch (err) {
      console.error("Error playing TTS in drawer:", err);
      setPlayingWord(null);
    }
  };

  // Handle Delete
  const handleDeleteWord = async (e, originalWord) => {
    e.stopPropagation();
    if (!window.confirm(`Czy na pewno chcesz usunąć "${originalWord}" ze swojego słownika?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(originalWord)}`, {
        method: "DELETE",
        headers: {
          "X-Session-Token": user?.token || "",
        },
      });
      if (response.ok) {
        setWords((prev) => prev.filter((w) => w.original !== originalWord));
        // Notify other views
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      } else {
        alert("Błąd podczas usuwania słówka.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem podczas usuwania.");
    }
  };

  // Fetch or Generate Quiz (lazy)
  const handleToggleQuiz = async (e, item) => {
    e.stopPropagation();
    const wordId = item.id || item.original;

    if (item.quiz && item.quiz.extra_exercises) return; // already loaded with extra exercises

    setLoadingQuizIds((prev) => ({ ...prev, [wordId]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(item.id || item.original)}/quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
      });

      if (response.ok) {
        const quizData = await response.json();
        setWords((prev) =>
          prev.map((w) => {
            if ((w.id && w.id === item.id) || w.original === item.original) {
              return { ...w, quiz: quizData };
            }
            return w;
          })
        );
      }
    } catch (err) {
      console.error("Error loading quiz:", err);
    } finally {
      setLoadingQuizIds((prev) => ({ ...prev, [wordId]: false }));
    }
  };

  // Export to Email
  const handleExportEmail = async () => {
    if (!user?.email || words.length === 0) return;
    setSendingEmail(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-notebook-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({
          recipient_email: user.email,
          notebook_words: words.map((w) => ({ original: w.original, translated: w.translated })),
        }),
      });

      if (response.ok) {
        alert(`Słownik został pomyślnie wysłany na adres: ${user.email}`);
      } else {
        alert("Wystąpił błąd podczas wysyłania e-maila.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia podczas wysyłania e-maila.");
    } finally {
      setSendingEmail(false);
    }
  };

  // Filter & Sort logic
  const filteredWords = words.filter((w) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      w.original.toLowerCase().includes(query) || w.translated.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    const isExpression = w.original.trim().split(/\s+/).length > 1;
    if (filterType === "words" && isExpression) return false;
    if (filterType === "phrases" && !isExpression) return false;

    return true;
  });

  const handleOpenDrawer = () => {
    setIsOpen(true);
    window.dispatchEvent(new CustomEvent("vocabulary-drawer-opened"));
  };

  return (
    <>
      {/* Floating Trigger Tab */}
      <button className="vocabulary-drawer-trigger" onClick={handleOpenDrawer}>
        <div className="trigger-icon">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <span className="trigger-badge">{words.length}</span>
        <span className="trigger-label">Słownik</span>
      </button>

      {/* Backdrop Overlay */}
      <div
        className={`vocabulary-drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sliding Drawer Panel */}
      <div className={`vocabulary-drawer-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-row">
            <h2>Słownik AI</h2>
            <button className="drawer-close-btn" onClick={() => setIsOpen(false)}>
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="drawer-quick-actions">
            <button
              className="drawer-action-btn accent-action"
              onClick={() => setShowFlashcards(true)}
              disabled={words.length === 0}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              Ćwicz Fiszki
            </button>
            <button
              className="drawer-action-btn"
              onClick={handleExportEmail}
              disabled={words.length === 0 || sendingEmail}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {sendingEmail ? "Wysyłanie..." : "Wyślij E-mail"}
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="drawer-filter-bar">
          <div className="drawer-search-wrapper">
            <input
              type="text"
              className="drawer-search-input"
              placeholder="Szukaj słówka lub frazy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="drawer-search-clear" onClick={() => setSearchQuery("")}>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="drawer-type-tabs">
            <button
              className={`drawer-type-tab ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              Wszystkie
            </button>
            <button
              className={`drawer-type-tab ${filterType === "words" ? "active" : ""}`}
              onClick={() => setFilterType("words")}
            >
              Słowa
            </button>
            <button
              className={`drawer-type-tab ${filterType === "phrases" ? "active" : ""}`}
              onClick={() => setFilterType("phrases")}
            >
              Frazy
            </button>
          </div>
        </div>

        {/* Word List Scroll Area */}
        <div className="drawer-content">
          {filteredWords.length > 0 ? (
            filteredWords.map((item, idx) => {
              const wordId = item.id || item.original;
              const isExpanded = expandedWordId === wordId;

              return (
                <div
                  key={idx}
                  className={`drawer-card ${isExpanded ? "expanded" : ""}`}
                  onClick={() => {
                    setExpandedWordId(isExpanded ? null : wordId);
                  }}
                >
                  <div className="drawer-card-header">
                    <div className="drawer-card-text">
                      <span className="drawer-word-original">{item.original}</span>
                      <span className="drawer-word-translated">{item.translated}</span>
                    </div>

                    <div className="drawer-card-header-actions">
                      <button
                        className={`drawer-icon-btn ${playingWord === item.original ? "playing" : ""}`}
                        onClick={(e) => handlePlayTTS(e, item.original)}
                        title="Odsłuchaj"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </button>
                      <button
                        className="drawer-icon-btn delete-btn"
                        onClick={(e) => handleDeleteWord(e, item.original)}
                        title="Usuń"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="drawer-card-details" onClick={(e) => e.stopPropagation()}>
                      {/* Context / Example */}
                      {item.context && (
                        <div className="drawer-detail-section">
                          <span className="drawer-detail-label">Kontekst:</span>
                          <p className="drawer-context-text">"{item.context}"</p>
                        </div>
                      )}

                      {/* Synonym Quiz & Extra Exercises */}
                      <div className="drawer-detail-section">
                        <span className="drawer-detail-label">Ćwiczenie (AI Quiz & Zadania):</span>
                        {item.quiz ? (
                          <div className="drawer-quiz-wrapper">
                            {/* Tabs */}
                            <div className="exercises-tabs">
                              <button
                                type="button"
                                className={`exercise-tab-btn ${(!activeExerciseTabs[wordId] || activeExerciseTabs[wordId] === 'synonyms') ? 'active' : ''}`}
                                onClick={() => setActiveExerciseTabs(prev => ({ ...prev, [wordId]: 'synonyms' }))}
                              >
                                Synonimy (Quiz)
                              </button>
                              {item.quiz.extra_exercises && (
                                <>
                                  <button
                                    type="button"
                                    className={`exercise-tab-btn ${activeExerciseTabs[wordId] === 'pl_to_en' ? 'active' : ''}`}
                                    onClick={() => setActiveExerciseTabs(prev => ({ ...prev, [wordId]: 'pl_to_en' }))}
                                  >
                                    PL ➡️ EN
                                  </button>
                                  <button
                                    type="button"
                                    className={`exercise-tab-btn ${activeExerciseTabs[wordId] === 'en_blank' ? 'active' : ''}`}
                                    onClick={() => setActiveExerciseTabs(prev => ({ ...prev, [wordId]: 'en_blank' }))}
                                  >
                                    Luki (EN)
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Content: Synonyms */}
                            {(!activeExerciseTabs[wordId] || activeExerciseTabs[wordId] === 'synonyms') && (
                              <div className="synonyms-quiz-container">
                                <p className="drawer-quiz-question">{item.quiz.question}</p>
                                <div className="drawer-quiz-options">
                                  {item.quiz.options.map((option, idx) => {
                                    const isSelected = selectedAnswers[wordId] === option.text;
                                    const hasAnswered = selectedAnswers[wordId] !== undefined;
                                    
                                    let optionClass = "drawer-quiz-option";
                                    if (hasAnswered) {
                                      if (option.is_correct) {
                                        optionClass += " correct";
                                      } else if (isSelected) {
                                        optionClass += " incorrect";
                                      } else {
                                        optionClass += " disabled";
                                      }
                                    }

                                    return (
                                      <button
                                        key={idx}
                                        className={optionClass}
                                        disabled={hasAnswered}
                                        onClick={() => setSelectedAnswers(prev => ({ ...prev, [wordId]: option.text }))}
                                      >
                                        {option.text}
                                        {hasAnswered && option.translation && ` (${option.translation})`}
                                        {hasAnswered && option.is_correct && " ➡️ POPRAWNA"}
                                      </button>
                                    );
                                  })}
                                </div>
                                {selectedAnswers[wordId] && (
                                  <button 
                                    className="drawer-quiz-reset-btn"
                                    onClick={() => setSelectedAnswers(prev => {
                                      const updated = { ...prev };
                                      delete updated[wordId];
                                      return updated;
                                    })}
                                  >
                                    Spróbuj ponownie
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Content: PL to EN translation */}
                            {activeExerciseTabs[wordId] === 'pl_to_en' && item.quiz.extra_exercises && (
                              <div className="extra-exercise-container">
                                {item.quiz.extra_exercises.pl_to_en.map((ex, idx) => {
                                  const currentVal = (plToEnAnswers[wordId] && plToEnAnswers[wordId][idx]) || '';
                                  const isChecked = plToEnChecked[wordId] && plToEnChecked[wordId][idx] !== undefined;
                                  const isCorrect = isChecked && plToEnChecked[wordId][idx];

                                  const handleCheck = () => {
                                    const cleanUser = cleanStringForComparison(currentVal);
                                    const cleanCorrect = cleanStringForComparison(ex.correct_en);
                                    const correct = cleanUser === cleanCorrect;
                                    setPlToEnChecked(prev => ({
                                      ...prev,
                                      [wordId]: { ...(prev[wordId] || {}), [idx]: correct }
                                    }));
                                  };

                                  return (
                                    <div key={idx} className="exercise-item">
                                      <span className="exercise-sentence">PL: {ex.sentence_pl}</span>
                                      <div className="exercise-input-wrapper">
                                        <input
                                          type="text"
                                          placeholder="Wpisz wersję angielską..."
                                          className={`exercise-input ${isChecked ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
                                          value={currentVal}
                                          onChange={(e) => setPlToEnAnswers(prev => ({
                                            ...prev,
                                            [wordId]: { ...(prev[wordId] || {}), [idx]: e.target.value }
                                          }))}
                                          disabled={isChecked}
                                        />
                                        {!isChecked && (
                                          <button className="exercise-check-btn" onClick={handleCheck}>
                                            Sprawdź
                                          </button>
                                        )}
                                      </div>
                                      {isChecked && (
                                        <div className={`exercise-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
                                          {isCorrect ? '✓ OK!' : `✗ Poprawnie: "${ex.correct_en}"`}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {(plToEnChecked[wordId] && Object.keys(plToEnChecked[wordId]).length > 0) && (
                                  <button
                                    className="drawer-quiz-reset-btn"
                                    onClick={() => {
                                      setPlToEnAnswers(prev => {
                                        const updated = { ...prev };
                                        delete updated[wordId];
                                        return updated;
                                      });
                                      setPlToEnChecked(prev => {
                                        const updated = { ...prev };
                                        delete updated[wordId];
                                        return updated;
                                      });
                                    }}
                                  >
                                    Resetuj ćwiczenie
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Content: EN blank fill */}
                            {activeExerciseTabs[wordId] === 'en_blank' && item.quiz.extra_exercises && (
                              <div className="extra-exercise-container">
                                {item.quiz.extra_exercises.en_blank.map((ex, idx) => {
                                  const currentVal = (enBlankAnswers[wordId] && enBlankAnswers[wordId][idx]) || '';
                                  const isChecked = enBlankChecked[wordId] && enBlankChecked[wordId][idx] !== undefined;
                                  const isCorrect = isChecked && enBlankChecked[wordId][idx];

                                  const handleCheck = () => {
                                    const cleanUser = cleanStringForComparison(currentVal);
                                    const cleanCorrect = cleanStringForComparison(ex.correct_word);
                                    const correct = cleanUser === cleanCorrect;
                                    setEnBlankChecked(prev => ({
                                      ...prev,
                                      [wordId]: { ...(prev[wordId] || {}), [idx]: correct }
                                    }));
                                  };

                                  const parts = ex.sentence_en.split("___");

                                  return (
                                    <div key={idx} className="exercise-item">
                                      <div className="exercise-sentence-en-blank">
                                        <span>{parts[0]}</span>
                                        <input
                                          type="text"
                                          placeholder="wpisz..."
                                          className={`exercise-input-blank ${isChecked ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
                                          value={currentVal}
                                          onChange={(e) => setEnBlankAnswers(prev => ({
                                            ...prev,
                                            [wordId]: { ...(prev[wordId] || {}), [idx]: e.target.value }
                                          }))}
                                          disabled={isChecked}
                                          style={{ width: `${Math.max(70, ex.correct_word.length * 8)}px` }}
                                        />
                                        <span>{parts[1]}</span>
                                        {!isChecked && (
                                          <button className="exercise-check-btn" onClick={handleCheck} style={{ marginLeft: 'auto' }}>
                                            Sprawdź
                                          </button>
                                        )}
                                      </div>
                                      {isChecked && (
                                        <div className={`exercise-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
                                          {isCorrect ? '✓ OK!' : `✗ Słowo: "${ex.correct_word}"`}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {(enBlankChecked[wordId] && Object.keys(enBlankChecked[wordId]).length > 0) && (
                                  <button
                                    className="drawer-quiz-reset-btn"
                                    onClick={() => {
                                      setEnBlankAnswers(prev => {
                                        const updated = { ...prev };
                                        delete updated[wordId];
                                        return updated;
                                      });
                                      setEnBlankChecked(prev => {
                                        const updated = { ...prev };
                                        delete updated[wordId];
                                        return updated;
                                      });
                                    }}
                                  >
                                    Resetuj ćwiczenie
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            className="drawer-mnemonic-btn"
                            disabled={loadingQuizIds[wordId]}
                            onClick={(e) => handleToggleQuiz(e, item)}
                          >
                            {loadingQuizIds[wordId] ? "Generowanie..." : "✨ Generuj Quiz i Ćwiczenia"}
                          </button>
                        )}
                      </div>

                      {/* Extra Actions */}
                      <div className="drawer-details-actions">
                        <button
                          className="drawer-details-btn practice-btn"
                          onClick={() => setPracticeTargetText(item.original)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                          Mów
                        </button>
                        <button
                          className="drawer-details-btn"
                          onClick={() => setExplanationWord(item.original)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          Wyjaśnij
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : loading ? (
            <div className="drawer-empty">
              <p className="drawer-empty-text">Ładowanie...</p>
            </div>
          ) : (
            <div className="drawer-empty">
              <div className="drawer-empty-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="drawer-empty-text">Brak słówek</p>
              <p className="drawer-empty-hint">
                Twój słownik jest pusty lub nic nie pasuje do filtrów.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Global Modals from Drawer */}
      {showFlashcards && (
        <div className="flashcards-fullpage-overlay">
          <div className="flashcards-wrapper-modal glass-panel">
            <Flashcards
              notebookWords={words}
              onFinishExercises={() => setShowFlashcards(false)}
            />
          </div>
        </div>
      )}
      {explanationWord && (
        <WordExplanationModal
          wordOrPhrase={explanationWord}
          user={user}
          onClose={() => setExplanationWord(null)}
        />
      )}
      {practiceTargetText && (
        <PronunciationPracticeModal
          targetText={practiceTargetText}
          user={user}
          onClose={() => setPracticeTargetText(null)}
          onLogActivity={() => {}}
          onLogPronunciationError={() => {}}
        />
      )}
    </>
  );
};

export default VocabularyDrawer;
