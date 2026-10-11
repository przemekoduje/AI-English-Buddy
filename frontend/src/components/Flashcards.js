import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL } from "../config";
import logoImg from "../assets/logo.png";
import "./Flashcards.css";

function Flashcards({
  words,
  notebookWords,
  onClose,
  onFinishExercises,
  user,
  categoryTitle = "My Vocabulary · B2 review",
}) {
  const handleExit = onClose || onFinishExercises || (() => {});

  // Determine card list from props, with rich fallback for standalone practice
  const initialCards = useMemo(() => {
    const rawList = words || notebookWords || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList.map((item, idx) => {
        const original = typeof item === "string" ? item : item.original || item.word || "adapt";
        const translated = typeof item === "string" ? "tłumaczenie" : item.translated || "dostosować się";
        const cleanOriginal = original.trim().toLowerCase();

        // Default or enriched phonetic
        const phonetic = item.phonetic || (cleanOriginal === "adapt" ? "/əˈdæpt/" : `/${cleanOriginal}/`);

        // Default or enriched part of speech
        const partOfSpeech = item.part_of_speech || (cleanOriginal === "adapt" ? "verb" : "expression");

        // Context sentence
        const contextSentence = item.context_sentence || 
          (cleanOriginal === "adapt" 
            ? "Maya knew she would need to adapt to a new routine."
            : `“${original} is an important expression to remember.”`);

        // Polish context sentence or translation
        const contextSentencePl = item.context_sentence_pl ||
          (cleanOriginal === "adapt"
            ? "Maya wiedziała, że będzie musiała dostosować się do nowej rutyny."
            : translated);

        // Definition
        const definition = item.definition ||
          (cleanOriginal === "adapt"
            ? "To change to suit a new situation."
            : `To understand and use "${original}" confidently in everyday conversation.`);

        // Topic and Story title
        const topic = item.topic || "Business";
        const storyTitle = item.story_title || "A new beginning";

        return {
          id: item.id || `card_${idx}`,
          original,
          translated,
          phonetic,
          part_of_speech: partOfSpeech,
          context_sentence: contextSentence,
          context_sentence_pl: contextSentencePl,
          definition,
          topic,
          story_title: storyTitle,
          status: item.status || "Learning",
        };
      });
    }

    // Default sample set if list is completely empty
    return [
      {
        id: "sample_1",
        original: "adapt",
        translated: "dostosować się",
        phonetic: "/əˈdæpt/",
        part_of_speech: "verb",
        context_sentence: "Maya knew she would need to adapt to a new routine.",
        context_sentence_pl: "Maya wiedziała, że będzie musiała dostosować się do nowej rutyny.",
        definition: "To change to suit a new situation.",
        topic: "Business",
        story_title: "A new beginning",
        status: "Learning",
      },
      {
        id: "sample_2",
        original: "supportive",
        translated: "wspierający",
        phonetic: "/səˈpɔː.tɪv/",
        part_of_speech: "adjective",
        context_sentence: "Her manager was extremely supportive during her first week.",
        context_sentence_pl: "Jej przełożony był niezwykle wspierający podczas pierwszego tygodnia.",
        definition: "Providing encouragement, sympathy, or emotional help.",
        topic: "Workplace",
        story_title: "A new beginning",
        status: "Learning",
      },
      {
        id: "sample_3",
        original: "clarify",
        translated: "wyjaśnić, doprecyzować",
        phonetic: "/ˈklær.ɪ.faɪ/",
        part_of_speech: "verb",
        context_sentence: "Could you please clarify the main objective of this task?",
        context_sentence_pl: "Czy mógłbyś proszę doprecyzować główny cel tego zadania?",
        definition: "To make something clearer or easier to understand.",
        topic: "Communication",
        story_title: "Team Meeting",
        status: "Learning",
      },
    ];
  }, [words, notebookWords]);

  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Stats counters matching the design
  const [reviewedCount, setReviewedCount] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [reviewAgainCount, setReviewAgainCount] = useState(0);

  // Practice Timer
  const [timerSeconds, setTimerSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSec % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const total = cards.length;
  const currentWord = cards[currentIndex] || cards[0];

  // Flip card
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Answer handler
  const handleAnswer = useCallback(
    async (isKnown) => {
      if (!currentWord) return;

      if (isKnown) {
        setKnownCount((prev) => prev + 1);
      } else {
        setReviewAgainCount((prev) => prev + 1);
      }
      setReviewedCount((prev) => prev + 1);

      // Persist status update to backend if user token is present
      if (user?.token && currentWord?.original) {
        const newStatus = isKnown ? "Known" : "Learning";
        fetch(
          `${API_BASE_URL}/api/vocabulary/${encodeURIComponent(
            currentWord.id || currentWord.original
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Token": user.token,
            },
            body: JSON.stringify({ status: newStatus }),
          }
        ).catch((err) => {
          console.warn("Could not sync flashcard status:", err);
        });
      }

      setIsFlipped(false);

      setTimeout(() => {
        if (currentIndex + 1 < total) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setShowResults(true);
        }
      }, 160);
    },
    [currentIndex, total, currentWord, user]
  );

  // Pronounce word via SpeechSynthesis
  const handlePronounce = (e) => {
    e.stopPropagation();
    if (!currentWord?.original) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentWord.original);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Keyboard navigation: Space (flip), ArrowLeft (Review again), ArrowRight (Know it)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showResults) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleAnswer(false);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleAnswer(true);
      } else if (e.code === "Escape") {
        handleExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleAnswer, handleExit, showResults]);

  // Restart practice session
  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowResults(false);
    setReviewedCount(0);
    setKnownCount(0);
    setReviewAgainCount(0);
    setTimerSeconds(0);
  };

  // Progress percentage
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <div className="flashcards-fullscreen-view">
      {/* ── Top Header Bar ──────────────────────────────────────── */}
      <header className="flashcards-topbar">
        {/* Speakling brand */}
        <div className="flashcards-brand">
          <div className="flashcards-logo-badge">
            <img src={logoImg} alt="Speakling Logo" />
          </div>
          <span className="flashcards-brand-name">speakling</span>
        </div>

        {/* Center Category Indicator */}
        <div className="flashcards-category-pill">
          <svg className="category-stack-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="category-title-text">{categoryTitle}</span>
        </div>

        {/* Back to Vocabulary */}
        <button
          type="button"
          className="flashcards-back-link"
          onClick={handleExit}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span>Back to vocabulary</span>
        </button>
      </header>

      {/* ── Main Review Area ─────────────────────────────────────── */}
      <main className="flashcards-main-body">
        {showResults ? (
          /* Results Complete Screen */
          <div className="flashcards-complete-card">
            <div className="complete-badge-circle">🏆</div>
            <h2 className="complete-title">Review Session Complete!</h2>
            <p className="complete-subtitle">
              You reviewed {reviewedCount} words in {formatTimer(timerSeconds)}.
            </p>

            <div className="complete-stats-row">
              <div className="complete-stat-box">
                <span className="complete-stat-number">{knownCount}</span>
                <span className="complete-stat-label">Known</span>
              </div>
              <div className="complete-stat-box">
                <span className="complete-stat-number">{reviewAgainCount}</span>
                <span className="complete-stat-label">To review again</span>
              </div>
              <div className="complete-stat-box">
                <span className="complete-stat-number">
                  {reviewedCount > 0 ? `${Math.round((knownCount / reviewedCount) * 100)}%` : "100%"}
                </span>
                <span className="complete-stat-label">Accuracy</span>
              </div>
            </div>

            <div className="complete-actions">
              <button
                type="button"
                className="complete-btn-primary"
                onClick={handleExit}
              >
                Back to vocabulary
              </button>
              <button
                type="button"
                className="complete-btn-secondary"
                onClick={handleRestart}
              >
                Review again
              </button>
            </div>
          </div>
        ) : (
          <div className="flashcards-stage-wrapper">
            {/* Meta bar above card */}
            <div className="flashcards-meta-row">
              <span className="meta-card-count">
                Card {currentIndex + 1} of {total}
              </span>

              <span className="meta-topic-pill">
                {currentWord.topic} · {currentWord.story_title}
              </span>

              <span className="meta-practice-timer">
                {formatTimer(timerSeconds)} practice
              </span>
            </div>

            {/* Progress line track */}
            <div className="flashcards-progress-track">
              <div
                className="flashcards-progress-fill"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* ── Interactive Card ───────────────────────────────── */}
            <div className="flashcard-canvas">
              <div className={`flashcard-sheet ${isFlipped ? "is-flipped-mode" : ""}`}>
                {!isFlipped ? (
                  /* FRONT OF CARD: English · Think First */
                  <div className="card-side-front">
                    <div className="card-badge badge-think-first">
                      ENGLISH · THINK FIRST
                    </div>

                    <h1 className="card-headline-word">
                      {currentWord.original}
                    </h1>

                    {currentWord.context_sentence && (
                      <p className="card-context-quote">
                        {currentWord.context_sentence.startsWith("“") || currentWord.context_sentence.startsWith('"')
                          ? currentWord.context_sentence
                          : `“${currentWord.context_sentence}”`}
                      </p>
                    )}

                    <button
                      type="button"
                      className="card-flip-btn"
                      onClick={handleFlip}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Reveal translation</span>
                    </button>
                  </div>
                ) : (
                  /* BACK OF CARD: Polski · Answer */
                  <div className="card-side-back">
                    <div className="card-badge badge-answer-pl">
                      POLSKI · ANSWER
                    </div>

                    <h1 className="card-headline-word pl-answer">
                      {currentWord.translated}
                    </h1>

                    <div className="card-phonetic-row">
                      <span className="card-phonetic-meta">
                        {currentWord.original} · {currentWord.phonetic} · {currentWord.part_of_speech}
                      </span>
                      <button
                        type="button"
                        className="card-audio-speaker-btn"
                        onClick={handlePronounce}
                        title="Listen pronunciation"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                      </button>
                    </div>

                    {currentWord.context_sentence_pl && (
                      <p className="card-context-pl">
                        {currentWord.context_sentence_pl}
                      </p>
                    )}

                    {currentWord.definition && (
                      <p className="card-definition-en">
                        {currentWord.definition}
                      </p>
                    )}

                    <button
                      type="button"
                      className="card-flip-btn"
                      onClick={handleFlip}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Show English</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Evaluation Controls ────────────────────────────── */}
            <div className="flashcards-footer-actions">
              <p className="evaluation-prompt">
                How well did you remember this word?
              </p>

              <div className="evaluation-buttons-group">
                <button
                  type="button"
                  className="eval-btn-review-again"
                  onClick={() => handleAnswer(false)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Review again</span>
                </button>

                <button
                  type="button"
                  className="eval-btn-know-it"
                  onClick={() => handleAnswer(true)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Know it</span>
                </button>
              </div>

              {/* Keyboard shortcuts reminder */}
              <div className="keyboard-shortcuts-hint">
                <span>← Review again</span>
                <span>Space · Flip card</span>
                <span>→ Know it</span>
              </div>

              {/* Review session live summary */}
              <div className="session-progress-summary">
                {reviewedCount} {reviewedCount === 1 ? "word" : "words"} reviewed · {knownCount} known · {reviewAgainCount} to review again
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Flashcards;