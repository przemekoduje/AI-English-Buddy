import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from '../../config';
import "./VocabularyView.css";
import Flashcards from "../Flashcards";
import WordExplanationModal from "../Notebook/WordExplanationModal";
import PronunciationPracticeModal from "../Notebook/PronunciationPracticeModal";

const VocabularyView = ({ user, onNavigateToWorkspace }) => {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, words, phrases
  const [timeFilter, setTimeFilter] = useState("all"); // all, today, week
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, az, za

  // Modals state
  const [explanationWord, setExplanationWord] = useState(null);
  const [practiceTargetText, setPracticeTargetText] = useState(null);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(user?.email || "");
  const [emailStatus, setEmailStatus] = useState(""); // success, error, sending
  
  // TTS State
  const [playingWord, setPlayingWord] = useState(null);

  // Quiz Accordion State
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [loadingQuizIds, setLoadingQuizIds] = useState({});
  const [quizErrors, setQuizErrors] = useState({});
  const [selectedAnswers, setSelectedAnswers] = useState({});

  // Additional Exercises State
  const [activeExerciseTabs, setActiveExerciseTabs] = useState({}); // wordId -> 'synonyms' | 'pl_to_en' | 'en_blank'
  const [plToEnAnswers, setPlToEnAnswers] = useState({}); // wordId -> { 0: '', 1: '', 2: '' }
  const [plToEnChecked, setPlToEnChecked] = useState({}); // wordId -> { 0: {correct, status, feedback}, ... }
  const [checkingPlToEn, setCheckingPlToEn] = useState({}); // wordId -> { 0: boolean, ... }
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


  // Fetch vocabulary
  const fetchVocabulary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        headers: {
          "X-Session-Token": user?.token || "",
        },
      });
      if (!response.ok) {
        throw new Error("Nie udało się pobrać słówek.");
      }
      const data = await response.json();
      setWords(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Wystąpił błąd podczas pobierania danych.");
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  // Handle Delete
  const handleDeleteWord = async (originalWord) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć "${originalWord}" ze swojego słownika?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(originalWord)}`, {
        method: "DELETE",
        headers: {
          "X-Session-Token": user?.token || "",
        },
      });
      if (response.ok) {
        setWords(prev => prev.filter(w => w.original !== originalWord));
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      } else {
        alert("Błąd podczas usuwania słówka.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem podczas usuwania.");
    }
  };

  // Play Pronunciation
  const handlePlayTTS = async (text) => {
    if (playingWord === text) return;
    setPlayingWord(text);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: "en-US-BrianNeural"
        })
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
      console.error("Error playing TTS:", err);
      setPlayingWord(null);
    }
  };

  // Handle Quiz Accordion Toggle (Lazy Loading)
  const handleToggleQuiz = async (item) => {
    const wordId = item.id || item.original;
    const isExpanded = expandedQuizId === wordId;
    const hasQuizAndExercises = item.quiz && item.quiz.extra_exercises;

    if (isExpanded) {
      setExpandedQuizId(null);
      return;
    }

    if (hasQuizAndExercises) {
      setExpandedQuizId(wordId);
      return;
    }

    setLoadingQuizIds(prev => ({ ...prev, [wordId]: true }));
    setQuizErrors(prev => ({ ...prev, [wordId]: "" }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(wordId)}/quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        }
      });

      if (!response.ok) {
        throw new Error("Nie udało się pobrać quizu.");
      }

      const quizData = await response.json();
      
      setWords(prev => prev.map(w => {
        if ((w.id && w.id === item.id) || w.original === item.original) {
          return { ...w, quiz: quizData };
        }
        return w;
      }));

      // Now expand with smooth animation!
      setExpandedQuizId(wordId);
    } catch (err) {
      console.error(err);
      setQuizErrors(prev => ({
        ...prev,
        [wordId]: err.message || "Błąd generowania quizu."
      }));
      setExpandedQuizId(wordId);
    } finally {
      setLoadingQuizIds(prev => ({ ...prev, [wordId]: false }));
    }
  };

  // Handle Email Export
  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail) return;

    setEmailStatus("sending");
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-notebook-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          notebook_words: words.map(w => ({ original: w.original, translated: w.translated })),
          frontend_url: window.location.origin
        }),
      });

      if (response.ok) {
        setEmailStatus("success");
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStatus("");
        }, 2000);
      } else {
        const errData = await response.json().catch(() => ({}));
        if (errData.error) alert(errData.error);
        setEmailStatus("error");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem przy wysyłaniu e-maila.");
      setEmailStatus("error");
    }
  };

  // Stats calculations
  const totalCount = words.length;
  
  const todayCount = words.filter(w => {
    if (!w.timestamp) return false;
    const addedDate = new Date(w.timestamp).toDateString();
    const today = new Date().toDateString();
    return addedDate === today;
  }).length;

  const phrasesCount = words.filter(w => w.original.trim().split(/\s+/).length > 1).length;
  const wordsOnlyCount = totalCount - phrasesCount;

  // Filter & Sort
  const filteredWords = words
    .filter(w => {
      // Search
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        w.original.toLowerCase().includes(query) || 
        w.translated.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;

      // Type
      const isExpression = w.original.trim().split(/\s+/).length > 1;
      if (filterType === "words" && isExpression) return false;
      if (filterType === "phrases" && !isExpression) return false;

      // Time Filter
      if (timeFilter === "today") {
        if (!w.timestamp) return false;
        const addedDate = new Date(w.timestamp).toDateString();
        const today = new Date().toDateString();
        if (addedDate !== today) return false;
      } else if (timeFilter === "week") {
        if (!w.timestamp) return false;
        const addedDate = new Date(w.timestamp);
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (addedDate < oneWeekAgo) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
      }
      if (sortBy === "az") {
        return a.original.localeCompare(b.original);
      }
      if (sortBy === "za") {
        return b.original.localeCompare(a.original);
      }
      return 0;
    });

  return (
    <div className="vocabulary-dashboard">
      <div className="vocab-header-panel">
        <div className="vocab-title-block">
          <p className="vocab-subtitle">Przeglądaj zebrane słownictwo, ćwicz wymowę oraz powtarzaj materiał z fiszkami.</p>
        </div>

        <div className="vocab-header-actions">

          <button 
            className="action-premium-btn flashcards-btn"
            onClick={() => setShowFlashcards(true)}
            disabled={totalCount === 0}
          >
            <span className="btn-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <span>Uruchom Fiszki</span>
          </button>
          
          <button 
            className="action-premium-btn email-btn"
            onClick={() => setShowEmailModal(true)}
            disabled={totalCount === 0}
          >
            <span className="btn-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>
            <span>Eksportuj na E-mail</span>
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="vocab-stats-grid">
        <div 
          className={`vocab-stat-card glass-panel animate-fade-in clickable ${timeFilter === "all" ? "active-filter" : ""}`}
          onClick={() => setTimeFilter("all")}
          title="Kliknij, aby pokazać wszystkie zwroty"
        >
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">Wszystkie zwroty</span>
          </div>
          <div className="stat-sub">
            <span>{wordsOnlyCount} słów / {phrasesCount} wyrażeń</span>
          </div>
        </div>

        <div 
          className={`vocab-stat-card glass-panel animate-fade-in delay-1 clickable ${timeFilter === "today" ? "active-filter" : ""}`}
          onClick={() => setTimeFilter(prev => prev === "today" ? "all" : "today")}
          title="Kliknij, aby filtrować słówka dodane dzisiaj"
        >
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{todayCount}</span>
            <span className="stat-label">Dodane dzisiaj</span>
          </div>
          <div className="stat-sub">
            <span>{timeFilter === "today" ? "Filtrowanie aktywne (kliknij by odznaczyć)" : "Kliknij, by filtrować"}</span>
          </div>
        </div>

        <div className="vocab-stat-card glass-panel animate-fade-in delay-2">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
              <path d="M12 2a6 6 0 0 1 6 6v3c0 3.3-2.7 6-6 6s-6-2.7-6-6V8c0-3.3 2.7-6 6-6z" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {totalCount >= 20 ? "Złoty" : totalCount >= 10 ? "Srebrny" : "Brązowy"}
            </span>
            <span className="stat-label">Poziom Postępu</span>
          </div>
          <div className="stat-sub">
            <span>{totalCount >= 20 ? "Mistrz słownictwa!" : totalCount >= 10 ? "Częsta praktyka przynosi efekty!" : "Zapisz więcej słów z czytanek"}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="vocab-controls-bar glass-panel">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Szukaj angielskiego zwrotu lub polskiego tłumaczenia..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>

        <div className="filters-group">
          <div className="select-wrapper">
            <label htmlFor="filter-time">Czas:</label>
            <select 
              id="filter-time"
              value={timeFilter} 
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">Wszystko</option>
              <option value="today">Dzisiaj</option>
              <option value="week">Ostatnie 7 dni</option>
            </select>
          </div>

          <div className="select-wrapper">
            <label htmlFor="filter-type">Typ:</label>
            <select 
              id="filter-type"
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Wszystko</option>
              <option value="words">Tylko słowa</option>
              <option value="phrases">Tylko frazy</option>
            </select>
          </div>

          <div className="select-wrapper">
            <label htmlFor="sort-by">Sortuj:</label>
            <select 
              id="sort-by"
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Od najnowszych</option>
              <option value="oldest">Od najstarszych</option>
              <option value="az">Alfabetycznie A-Z</option>
              <option value="za">Alfabetycznie Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="vocab-loading-wrapper">
          <div className="spinner"></div>
          <p>Ładowanie Twojego słownika...</p>
        </div>
      ) : error ? (
        <div className="vocab-error-wrapper glass-panel">
          <p className="error-text">⚠️ {error}</p>
          <button className="action-premium-btn" onClick={fetchVocabulary}>Spróbuj ponownie</button>
        </div>
      ) : filteredWords.length > 0 ? (
        <div className="vocab-grid animate-fade-in">
          {filteredWords.map((item) => (
            <div key={item.id || item.original} className="vocab-word-card glass-panel">
              <div className="card-top">
                <span className="word-tag">
                  {item.original.trim().split(/\s+/).length > 1 ? "Fraza" : "Słowo"}
                </span>
                <span className="word-date">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ""}
                </span>
              </div>

              <div className="word-display-area">
                <h3 className="original-text">{item.original}</h3>
                <p className="translated-text">{item.translated}</p>
                 {item.original.trim().split(/\s+/).length === 1 && (
                   <button 
                     className={`mnemonic-trigger-btn ${expandedQuizId === (item.id || item.original) ? 'active' : ''} ${loadingQuizIds[item.id || item.original] ? 'loading' : ''}`}
                     onClick={() => handleToggleQuiz(item)}
                     title="Ćwiczenie sprawdzające znajomość słowa"
                     disabled={loadingQuizIds[item.id || item.original]}
                   >
                     <span>{loadingQuizIds[item.id || item.original] ? 'Generowanie ćwiczeń...' : 'Ćwiczenia (AI Quiz & Zadania)'}</span>
                     {loadingQuizIds[item.id || item.original] ? (
                       <div className="spinner-mini" style={{ width: '12px', height: '12px', display: 'inline-block', border: '2px solid rgba(0,0,0,0.1)', borderLeftColor: 'currentColor', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginLeft: '5px' }}></div>
                     ) : (
                       <span className="bulb-icon">💡</span>
                     )}
                   </button>
                 )}
              </div>

              {expandedQuizId === (item.id || item.original) && (
                <div className="mnemonic-accordion-content">
                  {loadingQuizIds[item.id || item.original] ? (
                    <div className="mnemonic-loading">
                      <div className="spinner-mini"></div>
                      <span>Tworzenie quizu i ćwiczeń...</span>
                    </div>
                  ) : quizErrors[item.id || item.original] ? (
                    <div className="mnemonic-error">
                      <span>⚠️ {quizErrors[item.id || item.original]}</span>
                    </div>
                  ) : item.quiz ? (
                    <div className="drawer-quiz-wrapper animate-slide-down">
                      {/* Tabs */}
                      <div className="exercises-tabs">
                        <button
                          type="button"
                          className={`exercise-tab-btn ${(!activeExerciseTabs[item.id || item.original] || activeExerciseTabs[item.id || item.original] === 'synonyms') ? 'active' : ''}`}
                          onClick={() => setActiveExerciseTabs(prev => ({ ...prev, [item.id || item.original]: 'synonyms' }))}
                        >
                          Synonimy
                        </button>
                        {item.quiz.extra_exercises && (
                          <>
                            <button
                              type="button"
                              className={`exercise-tab-btn ${activeExerciseTabs[item.id || item.original] === 'pl_to_en' ? 'active' : ''}`}
                              onClick={() => setActiveExerciseTabs(prev => ({ ...prev, [item.id || item.original]: 'pl_to_en' }))}
                            >
                              PL ➡️ EN
                            </button>
                            <button
                              type="button"
                              className={`exercise-tab-btn ${activeExerciseTabs[item.id || item.original] === 'en_blank' ? 'active' : ''}`}
                              onClick={() => setActiveExerciseTabs(prev => ({ ...prev, [item.id || item.original]: 'en_blank' }))}
                            >
                              Luki EN
                            </button>
                          </>
                        )}
                      </div>

                      {/* Content: Synonyms */}
                      {(!activeExerciseTabs[item.id || item.original] || activeExerciseTabs[item.id || item.original] === 'synonyms') && (
                        <div className="synonyms-quiz-container">
                          <p className="drawer-quiz-question">{item.quiz.question}</p>
                          <div className="drawer-quiz-options">
                            {item.quiz.options.map((option, idx) => {
                              const isSelected = selectedAnswers[item.id || item.original] === option.text;
                              const hasAnswered = selectedAnswers[item.id || item.original] !== undefined;
                              
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
                                  onClick={() => setSelectedAnswers(prev => ({ ...prev, [item.id || item.original]: option.text }))}
                                >
                                  {option.text}
                                  {hasAnswered && option.translation && ` (${option.translation})`}
                                  {hasAnswered && option.is_correct && " ➡️ PRAWIDŁOWA ODPOWIEDŹ"}
                                </button>
                              );
                            })}
                          </div>
                          {selectedAnswers[item.id || item.original] && (
                            <button 
                              className="drawer-quiz-reset-btn"
                              onClick={() => setSelectedAnswers(prev => {
                                const updated = { ...prev };
                                delete updated[item.id || item.original];
                                return updated;
                              })}
                            >
                              Spróbuj ponownie
                            </button>
                          )}
                        </div>
                      )}

                      {/* Content: PL to EN translation */}
                      {activeExerciseTabs[item.id || item.original] === 'pl_to_en' && item.quiz.extra_exercises && (
                        <div className="extra-exercise-container">
                          {item.quiz.extra_exercises.pl_to_en.map((ex, idx) => {
                            const wordId = item.id || item.original;
                            const currentVal = (plToEnAnswers[wordId] && plToEnAnswers[wordId][idx]) || '';
                            const feedbackObj = plToEnChecked[wordId] && plToEnChecked[wordId][idx];
                            const isChecked = feedbackObj !== undefined;
                            const isCorrect = isChecked && (feedbackObj.status === 'correct' || feedbackObj.status === 'acceptable');
                            const isAcceptable = isChecked && feedbackObj.status === 'acceptable';
                            const isChecking = checkingPlToEn[wordId] && checkingPlToEn[wordId][idx];

                            const handleCheck = async () => {
                              if (!currentVal.trim()) return;
                              setCheckingPlToEn(prev => ({
                                ...prev,
                                [wordId]: { ...(prev[wordId] || {}), [idx]: true }
                              }));
                              try {
                                const response = await fetch(`${API_BASE_URL}/api/vocabulary/check-translation`, {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    "X-Session-Token": user?.token || "",
                                  },
                                  body: JSON.stringify({
                                    target_word: item.original,
                                    sentence_pl: ex.sentence_pl,
                                    correct_en: ex.correct_en,
                                    user_translation: currentVal
                                  })
                                });
                                if (response.ok) {
                                  const result = await response.json();
                                  setPlToEnChecked(prev => ({
                                    ...prev,
                                    [wordId]: { 
                                      ...(prev[wordId] || {}), 
                                      [idx]: {
                                        correct: result.status === 'correct' || result.status === 'acceptable',
                                        status: result.status,
                                        feedback: result.feedback
                                      } 
                                    }
                                  }));
                                } else {
                                  throw new Error("API check failed");
                                }
                              } catch (e) {
                                console.error(e);
                                const cleanUser = cleanStringForComparison(currentVal);
                                const cleanCorrect = cleanStringForComparison(ex.correct_en);
                                const correct = cleanUser === cleanCorrect;
                                setPlToEnChecked(prev => ({
                                  ...prev,
                                  [wordId]: { 
                                    ...(prev[wordId] || {}), 
                                    [idx]: {
                                      correct,
                                      status: correct ? 'correct' : 'incorrect',
                                      feedback: correct ? '✓ Poprawnie!' : `✗ Spróbuj jeszcze raz. Wzór: "${ex.correct_en}"`
                                    } 
                                  }
                                }));
                              } finally {
                                setCheckingPlToEn(prev => ({
                                  ...prev,
                                  [wordId]: { ...(prev[wordId] || {}), [idx]: false }
                                }));
                              }
                            };

                            let inputClass = "exercise-input";
                            if (isChecked) {
                              if (feedbackObj.status === 'correct') inputClass += " correct";
                              else if (feedbackObj.status === 'acceptable') inputClass += " acceptable-input";
                              else inputClass += " incorrect";
                            }

                            return (
                              <div key={idx} className="exercise-item">
                                <span className="exercise-sentence">PL: {ex.sentence_pl}</span>
                                <div className="exercise-input-wrapper">
                                  <input
                                    type="text"
                                    placeholder="Wpisz wersję angielską..."
                                    className={inputClass}
                                    value={currentVal}
                                    onChange={(e) => setPlToEnAnswers(prev => ({
                                      ...prev,
                                      [wordId]: { ...(prev[wordId] || {}), [idx]: e.target.value }
                                    }))}
                                    disabled={isChecked || isChecking}
                                  />
                                  {!isChecked && (
                                    <button 
                                      className="exercise-check-btn" 
                                      onClick={handleCheck}
                                      disabled={isChecking || !currentVal.trim()}
                                    >
                                      {isChecking ? "Sprawdzanie..." : "Sprawdź"}
                                    </button>
                                  )}
                                </div>
                                {isChecked && (
                                  <div className={`exercise-feedback ${feedbackObj.status}`}>
                                    {feedbackObj.feedback}
                                    {!isCorrect && (
                                      <div style={{ marginTop: '0.2rem', color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                                        Wzorcowe tłumaczenie: "{ex.correct_en}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {(plToEnChecked[item.id || item.original] && Object.keys(plToEnChecked[item.id || item.original]).length > 0) && (
                            <button
                              className="drawer-quiz-reset-btn"
                              onClick={() => {
                                setPlToEnAnswers(prev => {
                                  const updated = { ...prev };
                                  delete updated[item.id || item.original];
                                  return updated;
                                });
                                setPlToEnChecked(prev => {
                                  const updated = { ...prev };
                                  delete updated[item.id || item.original];
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
                      {activeExerciseTabs[item.id || item.original] === 'en_blank' && item.quiz.extra_exercises && (
                        <div className="extra-exercise-container">
                          {item.quiz.extra_exercises.en_blank.map((ex, idx) => {
                            const wordId = item.id || item.original;
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
                                    style={{ width: `${Math.max(80, ex.correct_word.length * 9)}px` }}
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
                                    {isCorrect ? '✓ Świetnie!' : `✗ Brakujące słowo: "${ex.correct_word}"`}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {(enBlankChecked[item.id || item.original] && Object.keys(enBlankChecked[item.id || item.original]).length > 0) && (
                            <button
                              className="drawer-quiz-reset-btn"
                              onClick={() => {
                                setEnBlankAnswers(prev => {
                                  const updated = { ...prev };
                                  delete updated[item.id || item.original];
                                  return updated;
                                });
                                setEnBlankChecked(prev => {
                                  const updated = { ...prev };
                                  delete updated[item.id || item.original];
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
                  ) : null}
                </div>
              )}

              <div className="card-actions-bar">
                <button 
                  className={`card-action-icon-btn ${playingWord === item.original ? 'speaking' : ''}`}
                  onClick={() => handlePlayTTS(item.original)}
                  title="Odsłuchaj poprawną wymowę"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>

                <button 
                  className="card-action-icon-btn"
                  onClick={() => setExplanationWord(item.original)}
                  title="Wyjaśnij słówko przez AI"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>

                <button 
                  className="card-action-icon-btn practice-btn"
                  onClick={() => setPracticeTargetText(item.original)}
                  title="Przećwicz swoją wymowę mikrofonem"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/>
                  </svg>
                </button>

                <button 
                  className="card-action-icon-btn delete-btn"
                  onClick={() => handleDeleteWord(item.original)}
                  title="Usuń ze słownika"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vocab-empty-state glass-panel animate-fade-in">
          <div className="empty-state-illustration">📖</div>
          <h3>Brak słówek do wyświetlenia</h3>
          {searchQuery || filterType !== "all" ? (
            <p>Spróbuj zmienić filtry lub wyczyścić pole wyszukiwania.</p>
          ) : (
            <>
              <p>Twój słownik jest pusty. Zapisuj nieznane słowa i wyrażenia podczas czytania opowiadań!</p>
              <button className="action-premium-btn" onClick={onNavigateToWorkspace}>
                Przejdź do Czytania
              </button>
            </>
          )}
        </div>
      )}

      {/* --- Overlay Modals --- */}

      {/* 1. Flashcards Full-screen overlay */}
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

      {/* 2. Word Explanation Modal */}
      {explanationWord && (
        <WordExplanationModal 
          wordOrPhrase={explanationWord}
          user={user}
          onClose={() => setExplanationWord(null)}
        />
      )}

      {/* 3. Pronunciation Practice Modal */}
      {practiceTargetText && (
        <PronunciationPracticeModal 
          targetText={practiceTargetText}
          user={user}
          onClose={() => setPracticeTargetText(null)}
          onLogActivity={() => {}}
          onLogPronunciationError={() => {}}
        />
      )}

      {showEmailModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSendEmail}>
            <h3>Eksportuj słownik na e-mail</h3>
            <p className="modal-description">Wprowadź swój adres e-mail. Wyślemy listę Twoich zapisanych słów wraz z tłumaczeniami.</p>
            
            <input 
              type="email" 
              placeholder="Twój adres email..." 
              value={recipientEmail} 
              onChange={e => setRecipientEmail(e.target.value)}
              className="premium-input"
              required
              disabled={emailStatus === "sending"}
            />

            {emailStatus === "success" && <div className="email-status-text success" style={{ marginBottom: "1rem" }}>✓ Słówka zostały wysłane!</div>}
            {emailStatus === "error" && <div className="email-status-text error" style={{ marginBottom: "1rem" }}>✕ Wystąpił błąd. Spróbuj ponownie.</div>}

            <div className="modal-actions">
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={emailStatus === "sending" || !recipientEmail}
              >
                {emailStatus === "sending" ? (
                  <>
                    <span className="spinner-inline"></span>
                    Wysyłanie...
                  </>
                ) : "Wyślij"}
              </button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailStatus("");
                }}
                disabled={emailStatus === "sending"}
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default VocabularyView;
