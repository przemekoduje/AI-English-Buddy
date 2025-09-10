// src/components/Flashcards.js
import React, { useState, useEffect } from 'react';
import './Flashcards.css'; // Nowy plik CSS dla fiszek

function Flashcards({ notebookWords, onFinishExercises }) {
  const [shuffledWords, setShuffledWords] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  useEffect(() => {
    // Mieszanie słówek tylko raz, przy starcie sesji
    const shuffled = [...notebookWords].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsSessionFinished(false);
  }, [notebookWords]); // Zresetuj fiszki, jeśli notatnik się zmieni

  if (notebookWords.length === 0) {
    return (
      <div className="flashcards-container">
        <p className="empty-message">Twój notatnik jest pusty. Dodaj słówka, aby rozpocząć ćwiczenia!</p>
        <button className="back-to-main-button" onClick={onFinishExercises}>Wróć</button>
      </div>
    );
  }

  const currentCard = shuffledWords[currentCardIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = (known) => {
    // Tutaj w przyszłości można dodać logikę SRS (Spaced Repetition System)
    // np. na podstawie 'known' (true/false) ustalić następny termin powtórki dla danego słowa.
    
    setIsFlipped(false); // Odwróć z powrotem na następną kartę

    if (currentCardIndex < shuffledWords.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      setIsSessionFinished(true); // Koniec sesji
    }
  };

  return (
    <div className="flashcards-container">
      <h2>Ćwiczenia - Fiszki</h2>

      {isSessionFinished ? (
        <div className="session-summary">
          <h3>Gratulacje! Ukończyłeś sesję!</h3>
          <p>Przejrzałeś {shuffledWords.length} słówek.</p>
          <button className="back-to-main-button" onClick={onFinishExercises}>Wróć do głównej</button>
          <button className="start-new-session-button" onClick={() => {
            const shuffled = [...notebookWords].sort(() => Math.random() - 0.5);
            setShuffledWords(shuffled);
            setCurrentCardIndex(0);
            setIsFlipped(false);
            setIsSessionFinished(false);
          }}>Rozpocznij nową sesję</button>
        </div>
      ) : (
        <>
          <p className="progress-info">
            Karta {currentCardIndex + 1} z {shuffledWords.length}
          </p>
          <div className="flashcard" onClick={handleFlip}>
            <div className={`flashcard-inner ${isFlipped ? 'is-flipped' : ''}`}>
              <div className="flashcard-front">
                <p className="flashcard-text">{currentCard?.original}</p>
              </div>
              <div className="flashcard-back">
                <p className="flashcard-text">{currentCard?.translated}</p>
              </div>
            </div>
          </div>
          <div className="flashcard-actions">
            {!isFlipped ? (
              <button className="flip-button" onClick={handleFlip}>Pokaż tłumaczenie</button>
            ) : (
              <>
                <button className="action-button-known" onClick={() => handleNext(true)}>✅ Znam</button>
                <button className="action-button-unknown" onClick={() => handleNext(false)}>❌ Nie znam</button>
              </>
            )}
            {/* Przycisk do przejścia bez oceniania (np. po pomyłce) */}
            {isFlipped && <button className="skip-button" onClick={() => handleNext(false)}>Następne</button>}
          </div>
          <button className="end-session-button" onClick={onFinishExercises}>Zakończ sesję</button>
        </>
      )}
    </div>
  );
}

export default Flashcards;