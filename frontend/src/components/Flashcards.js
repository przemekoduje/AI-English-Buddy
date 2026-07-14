import React, { useState } from "react";
import "./Flashcards.css";

function Flashcards({ notebookWords, onFinishExercises }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const total = notebookWords.length;
  const currentWord = notebookWords[currentIndex];

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleNext = (known) => {
    if (known) setScore(score + 1);
    setIsFlipped(false);
    
    setTimeout(() => {
      if (currentIndex + 1 < total) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setShowResults(true);
      }
    }, 150);
  };

  if (showResults) {
    const pct = Math.round((score / total) * 100);
    const isPerfect = score === total;
    const isGood = pct >= 70;
    const message = isPerfect
      ? "Perfect score! You nailed every word."
      : isGood
      ? "Good job! A few more rounds and you'll have them all."
      : "Keep going — repetition is how it sticks.";
    const emoji = isPerfect ? "🏆" : isGood ? "⭐" : "💪";

    return (
      <div className="flashcards-results">
        <div className="results-header">
          <span className="results-emoji">{emoji}</span>
          <h2 className="results-title">Practice Complete</h2>
          <p className="results-subtitle">{message}</p>
        </div>

        <div className="results-score-ring">
          <svg viewBox="0 0 120 120" className="score-ring-svg">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gray-200)" strokeWidth="8"/>
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - score / total)}`}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div className="score-ring-label">
            <span className="score-ring-num">{score}</span>
            <span className="score-ring-total">/ {total}</span>
          </div>
        </div>

        <div className="results-stats">
          <div className="results-stat">
            <span className="results-stat-val">{pct}%</span>
            <span className="results-stat-lbl">Accuracy</span>
          </div>
          <div className="results-stat-divider"/>
          <div className="results-stat">
            <span className="results-stat-val">{score}</span>
            <span className="results-stat-lbl">Known</span>
          </div>
          <div className="results-stat-divider"/>
          <div className="results-stat">
            <span className="results-stat-val">{total - score}</span>
            <span className="results-stat-lbl">To review</span>
          </div>
        </div>

        <div className="results-actions">
          <button onClick={onFinishExercises} className="results-btn-primary">
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcards-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${((currentIndex) / total) * 100}%` }}
        ></div>
      </div>
      
      <div className="flashcards-header">
        <button className="close-btn" onClick={onFinishExercises}>✕</button>
        <h3>Card {currentIndex + 1} of {total}</h3>
      </div>

      <div className={`flashcard-scene ${isFlipped ? "is-flipped" : ""}`} onClick={handleFlip}>
        <div className="flashcard-card">
          <div className="flashcard-face front">
            <span className="card-label">Original Phrase</span>
            <p className="card-text">{currentWord.original}</p>
            <span className="tap-hint">Tap to see translation</span>
          </div>
          <div className="flashcard-face back">
            <span className="card-label">Translation</span>
            <p className="card-text">{currentWord.translated}</p>
            <span className="tap-hint">Tap to see original</span>
          </div>
        </div>
      </div>

      <div className="evaluation-buttons">
        <button className="eval-btn secondary" onClick={() => handleNext(false)}>Still learning ❌</button>
        <button className="eval-btn primary" onClick={() => handleNext(true)}>I know this! ✅</button>
      </div>


    </div>
  );
}

export default Flashcards;