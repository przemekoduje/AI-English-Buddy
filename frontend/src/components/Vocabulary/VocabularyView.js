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

  // Mnemonic Accordion State
  const [expandedMnemonicIds, setExpandedMnemonicIds] = useState({});
  const [loadingMnemonicIds, setLoadingMnemonicIds] = useState({});
  const [mnemonicErrors, setMnemonicErrors] = useState({});

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

  // Handle Mnemonic Accordion Toggle (Lazy Loading)
  const handleToggleMnemonic = async (item) => {
    const wordId = item.id || item.original;
    const isExpanded = expandedMnemonicIds[wordId];

    // Toggle expanded state
    setExpandedMnemonicIds(prev => ({
      ...prev,
      [wordId]: !isExpanded
    }));

    // If expanding and mnemonic not present, fetch from API
    if (!isExpanded && !item.mnemonic) {
      setLoadingMnemonicIds(prev => ({ ...prev, [wordId]: true }));
      setMnemonicErrors(prev => ({ ...prev, [wordId]: "" }));

      try {
        const response = await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(item.id)}/mnemonic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          }
        });

        if (!response.ok) {
          throw new Error("Nie udało się pobrać haka pamięciowego.");
        }

        const mnemonicData = await response.json();
        
        // Update words state to include the new mnemonic
        setWords(prev => prev.map(w => {
          if (w.id === item.id) {
            return { ...w, mnemonic: mnemonicData };
          }
          return w;
        }));
      } catch (err) {
        console.error(err);
        setMnemonicErrors(prev => ({
          ...prev,
          [wordId]: err.message || "Błąd generowania mnemotechniki."
        }));
      } finally {
        setLoadingMnemonicIds(prev => ({ ...prev, [wordId]: false }));
      }
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
          notebook_words: words.map(w => ({ original: w.original, translated: w.translated }))
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
          <h1>Słownik i Fiszki</h1>
          <p className="vocab-subtitle">Przeglądaj zebrane słownictwo, ćwicz wymowę oraz powtarzaj materiał z fiszkami.</p>
        </div>

        <div className="vocab-header-actions">

          <button 
            className="action-premium-btn flashcards-btn"
            onClick={() => setShowFlashcards(true)}
            disabled={totalCount === 0}
          >
            <span className="btn-icon">⚡</span>
            <span>Uruchom Fiszki</span>
          </button>
          
          <button 
            className="action-premium-btn email-btn"
            onClick={() => setShowEmailModal(true)}
            disabled={totalCount === 0}
          >
            <span className="btn-icon">✉️</span>
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
          <div className="stat-icon">📚</div>
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
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <span className="stat-value">{todayCount}</span>
            <span className="stat-label">Dodane dzisiaj</span>
          </div>
          <div className="stat-sub">
            <span>{timeFilter === "today" ? "Filtrowanie aktywne (kliknij by odznaczyć)" : "Kliknij, by filtrować"}</span>
          </div>
        </div>

        <div className="vocab-stat-card glass-panel animate-fade-in delay-2">
          <div className="stat-icon">🏆</div>
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
                    className={`mnemonic-trigger-btn ${expandedMnemonicIds[item.id || item.original] ? 'active' : ''}`}
                    onClick={() => handleToggleMnemonic(item)}
                    title="Pokaż skojarzenie ułatwiające zapamiętanie"
                  >
                    <span>Mnemotechnika</span>
                    <span className="bulb-icon">💡</span>
                  </button>
                )}
              </div>

              {expandedMnemonicIds[item.id || item.original] && (
                <div className="mnemonic-accordion-content">
                  {loadingMnemonicIds[item.id || item.original] ? (
                    <div className="mnemonic-loading">
                      <div className="spinner-mini"></div>
                      <span>Tworzenie haka pamięciowego...</span>
                    </div>
                  ) : mnemonicErrors[item.id || item.original] ? (
                    <div className="mnemonic-error">
                      <span>⚠️ {mnemonicErrors[item.id || item.original]}</span>
                    </div>
                  ) : item.mnemonic ? (
                    <div className="mnemonic-data animate-slide-down">
                      <div className="mnemonic-section audio-anchor-section">
                        <span className="mnemonic-label">Skojarzenie dźwiękowe:</span>
                        <strong className="mnemonic-val anchor-val">{item.mnemonic.audio_anchor}</strong>
                      </div>
                      <div className="mnemonic-section">
                        <span className="mnemonic-label">Abstrakcyjny obraz:</span>
                        <p className="mnemonic-val">{item.mnemonic.abstract_image}</p>
                      </div>
                      <div className="mnemonic-section">
                        <span className="mnemonic-label">Dynamiczna scena:</span>
                        <p className="mnemonic-val scene-val">
                          {item.mnemonic.dynamic_scene.split(/(\s+)/).map((word, idx) => {
                            const isAllCapitals = /^[A-ZĘÓĄŚŁŻŹĆŃ\s\W\d_]{2,}$/.test(word.trim());
                            if (isAllCapitals && word.trim().length > 1) {
                              return <strong key={idx} className="bold-uppercase-term">{word}</strong>;
                            }
                            return word;
                          })}
                        </p>
                      </div>
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

      {/* 4. Export Email Modal */}
      {showEmailModal && (
        <div className="vocab-modal-overlay">
          <form className="vocab-modal-card glass-panel" onSubmit={handleSendEmail}>
            <h3>Eksportuj słownik na e-mail</h3>
            <p className="modal-description">Wprowadź swój adres e-mail. Wyślemy listę Twoich zapisanych słów wraz z tłumaczeniami.</p>
            
            <input 
              type="email" 
              placeholder="Twój adres email..." 
              value={recipientEmail} 
              onChange={e => setRecipientEmail(e.target.value)}
              className="premium-modal-input"
              required
              disabled={emailStatus === "sending"}
            />

            {emailStatus === "sending" && <div className="email-status-text loading">Trwa wysyłanie...</div>}
            {emailStatus === "success" && <div className="email-status-text success">✓ Słówka zostały wysłane!</div>}
            {emailStatus === "error" && <div className="email-status-text error">✕ Wystąpił błąd. Spróbuj ponownie.</div>}

            <div className="modal-actions">
              <button 
                type="submit" 
                className="action-premium-btn" 
                disabled={emailStatus === "sending"}
              >
                Wyślij
              </button>
              <button 
                type="button" 
                className="action-premium-btn secondary-btn"
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
