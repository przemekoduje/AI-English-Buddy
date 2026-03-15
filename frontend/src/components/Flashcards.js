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
    return (
      <div className="flashcards-results glass-panel">
        <h2>Practice Complete! 🎉</h2>
        <div className="score-circle">
          <span className="score-num">{score}</span>
          <span className="score-total">/ {total}</span>
        </div>
        <p>{score === total ? "Perfect! You're a pro." : "Great job! Keep practicing."}</p>
        <button onClick={onFinishExercises} className="premium-btn">Back to Workspace</button>
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