import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import Flashcards from "./components/Flashcards";

// Funkcja pomocnicza do inicjalizacji głosu
const getInitialVoiceURI = (voices) => {
  if (!voices || voices.length === 0) {
    return null;
  }
  const englishVoices = voices.filter((voice) => voice.lang.startsWith("en-"));
  if (englishVoices.length === 0) {
    return null;
  }
  // Preferujemy Google UK English Male, jeśli dostępny
  const googleUkMaleVoice = englishVoices.find(
    (voice) => voice.name === "Google UK English Male" && voice.lang === "en-GB"
  );
  if (googleUkMaleVoice) {
    return googleUkMaleVoice.voiceURI;
  }
  // Jeśli nie, szukamy jakiegokolwiek męskiego głosu z UK
  const anyUkEnglishMaleVoice = englishVoices.find(
    (voice) =>
      voice.lang === "en-GB" && voice.name.toLowerCase().includes("male")
  );
  if (anyUkEnglishMaleVoice) {
    return anyUkEnglishMaleVoice.voiceURI;
  }
  // W ostateczności pierwszy dostępny angielski głos
  return englishVoices[0].voiceURI;
};

function App() {
  const [generatedText, setGeneratedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customDetails, setCustomDetails] = useState("");
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(null);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [speechPitch, setSpeechPitch] = useState(1);
  const utteranceRef = useRef(null);
  const [notebookWords, setNotebookWords] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");

  const [isPaused, setIsPaused] = useState(false);
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translationContent, setTranslationContent] = useState({
    original: "",
    translated: "",
  });
  // const [storyText, setStoryText] = useState("");

  const [textChunks, setTextChunks] = useState([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const currentUtteranceRef = useRef(null);

  const [showFlashcards, setShowFlashcards] = useState(false);

  const [savedStories, setSavedStories] = useState([]);
  const [isCurrentStorySaved, setIsCurrentStorySaved] = useState(false);

  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const [showGrammarAnalysis, setShowGrammarAnalysis] = useState(false);
  const [grammarResults, setGrammarResults] = useState([]);
  const [isAnalyzingGrammar, setIsAnalyzingGrammar] = useState(false);
  const [currentStoryTitle, setCurrentStoryTitle] = useState("");
  const [lastStoryChunkIndex, setLastStoryChunkIndex] = useState(-1); // Nowy stan

  // --- ZMIANA: loadStories ZGODNE Z NOWYM BACKENDEM ---
  const loadStories = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:5001/api/stories");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSavedStories(data);
    } catch (error) {
      console.error(
        "Błąd podczas wczytywania historii z backendu (Firebase):",
        error
      );
    }
  }, []); // Brak zależności, funkcja jest stabilna

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // --- useEffect: POBIERANIE GŁOSÓW (bez zmian) ---
  useEffect(() => {
    const populateVoiceList = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const englishVoices = availableVoices.filter((voice) =>
        voice.lang.startsWith("en-")
      );
      setVoices(englishVoices);
      // Ustaw preferowany głos TYLKO JEŚLI jeszcze nie jest ustawiony
      // i jeśli głosy są już dostępne
      if (!selectedVoiceURI && availableVoices.length > 0) {
        setSelectedVoiceURI(getInitialVoiceURI(availableVoices));
      }
    };

    populateVoiceList(); // Wywołaj raz na początku
    window.speechSynthesis.onvoiceschanged = populateVoiceList; // Słuchaj zmian

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI]);

  // --- useEffect: POBIERANIE TEMATÓW (bez zmian) ---
  useEffect(() => {
    fetch("http://127.0.0.1:5001/api/get-topics")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setSuggestedTopics(data))
      .catch((err) => console.error("Błąd podczas pobierania tematów:", err));
  }, []);

  // --- useEffect dla menu kontekstowego (bez zmian) ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuVisible && !event.target.closest(".context-menu")) {
        setMenuVisible(false);
      }
      if (
        showTranslationModal &&
        !event.target.closest(".translation-modal-content")
      ) {
        setShowTranslationModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuVisible, showTranslationModal]);

  // --- useEffect dla podziału tekstu na chunki (bez zmian) ---
  useEffect(() => {
    if (generatedText) {
      const sentences = generatedText
        .split(/(?<=[.?!])\s+/g)
        .filter((s) => s.trim() !== "");
      setTextChunks(sentences);
      setCurrentChunkIndex(-1);
    } else {
      setTextChunks([]);
      setCurrentChunkIndex(-1);
    }
  }, [generatedText]);

  // Funkcja generująca historię (bez zmian)
  const generateStory = async (promptToGenerate) => {
    handleStop();
    setIsLoading(true);
    setGeneratedText("");
    setIsCurrentStorySaved(false);
    setCurrentStoryTitle(""); // Resetuj tytuł
    try {
      const response = await fetch("http://127.0.0.1:5001/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToGenerate }),
      });
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        setGeneratedText(data[0].generated_text);
        // TUTAJ ZAKŁADAMY, ŻE BACKEND ZWRACA RÓWNIEŻ TYTUŁ W 'data[0].title'
        // Jeśli Twój backend zwraca tylko 'generated_text', musisz go zmodyfikować,
        // aby zwracał również tytuł (np. pierwsze kilka słów historii)
        setCurrentStoryTitle(data[0].title || "Moja Historia AI"); // Ustaw tytuł
      } else {
        setGeneratedText(
          `Wystąpił błąd: ${data.error || "Sprawdź konsolę backendu."}`
        );
        setCurrentStoryTitle("");
      }
    } catch (error) {
      setGeneratedText("Błąd: Nie udało się połączyć z backendem.");
      setCurrentStoryTitle("");
    } finally {
      setIsLoading(false);
    }
  };

  // --- ZMIANA: handleSaveStory TERAZ WYSYŁA DO BACKENDU/FIREBASE ---
  const handleSaveStory = async () => {
    if (!generatedText || isCurrentStorySaved) return;

    // Używamy currentStoryTitle, które powinno być ustawione po wygenerowaniu
    const title =
      currentStoryTitle ||
      generatedText.split(" ").slice(0, 5).join(" ") + "...";

    try {
      const response = await fetch("http://127.0.0.1:5001/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text: generatedText }),
      });

      if (response.status === 200) {
        // Obsługa statusu 200 dla duplikatu
        alert("Ta historia jest już zapisana.");
        setIsCurrentStorySaved(true);
        return;
      }
      if (!response.ok) {
        // Inne błędy HTTP
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      // Dodaj nowo zapisaną historię do stanu lokalnego i odśwież listę w select
      setSavedStories((prevStories) =>
        [data, ...prevStories].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
      );
      setIsCurrentStorySaved(true);
      alert("Historia zapisana pomyślnie!");
    } catch (error) {
      console.error(
        "Błąd podczas zapisywania historii w bazie danych (Firebase):",
        error
      );
      alert(`Nie udało się zapisać historii: ${error.message}`);
    }
  };

  // --- handleLoadStory (bez zmian, bo nadal wczytuje z lokalnego stanu savedStories) ---
  const handleLoadStory = (event) => {
    const storyId = event.target.value;
    if (!storyId) {
      setGeneratedText("");
      setIsCurrentStorySaved(false);
      setCurrentStoryTitle(""); // Resetuj tytuł
      return;
    }

    const storyToLoad = savedStories.find((story) => story.id === storyId);
    if (storyToLoad) {
      setGeneratedText(storyToLoad.text);
      setCurrentStoryTitle(storyToLoad.title); // Ustaw tytuł załadowanej historii
      setIsCurrentStorySaved(true);
      setSelectedTopics([]);
      setCustomDetails("");
    }
  };

  // --- ZMIANA: handleRemoveStory ZGODNE Z NOWYM BACKENDEM/FIREBASE ---
  const handleRemoveStory = async (storyIdToRemove) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę historię?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5001/api/stories/${storyIdToRemove}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      // Po usunięciu z backendu, odśwież listę historii
      setSavedStories((prevStories) =>
        prevStories.filter((story) => story.id !== storyIdToRemove)
      );
      alert("Historia usunięta pomyślnie!");

      // Jeśli usunięto aktualnie wyświetlaną historię, wyczyść ją
      // Porównujemy po ID, bo to teraz unikalny identyfikator
      if (
        generatedText &&
        savedStories.find(
          (s) => s.id === storyIdToRemove && s.text === generatedText
        )
      ) {
        setGeneratedText("");
        setIsCurrentStorySaved(false);
      }
    } catch (error) {
      console.error(
        "Błąd podczas usuwania historii z bazy danych (Firebase):",
        error
      );
      alert(`Nie udało się usunąć historii: ${error.message}`);
    }
  };

  // ... (pozostałe funkcje handleTopicToggle, handleGenerateFromSelection, speakChunk, handlePlayback, handleStop, handleTextSelection, handleSaveToNotebook, handleTranslate, closeTranslationModal, handleSaveTranslatedToNotebook - bez zmian) ...
  const handleTopicToggle = (topic) => {
    setSelectedTopics((prevSelected) =>
      prevSelected.includes(topic)
        ? prevSelected.filter((t) => t !== topic)
        : [...prevSelected, topic]
    );
  };
  const handleGenerateFromSelection = () => {
    if (selectedTopics.length === 0) {
      alert("Proszę wybrać co najmniej jeden temat.");
      return;
    }
    const combinedTopics = selectedTopics.join(", ");
    let fullPrompt = `Write a creative story (about 300 words) that combines the following topics: ${combinedTopics}.`;
    if (customDetails.trim() !== "") {
      fullPrompt += ` Additionally, please incorporate these details: "${customDetails}"`;
    }
    generateStory(fullPrompt);
  };

  const speakChunk = (index) => {
    if (index >= textChunks.length) {
      handleStop();
      return;
    }

    setCurrentChunkIndex(index);

    const textToSpeak =
      textChunks[index] + (index < textChunks.length - 1 ? " " : "");
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const selectedVoice = voices.find(
      (voice) => voice.voiceURI === selectedVoiceURI
    );

    utterance.voice = selectedVoice;
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      if (!isPaused) {
        speakChunk(index + 1);
      } else {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = (event) => {
      console.error("Błąd syntezy mowy:", event);
      handleStop();
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayback = () => {
    if (!generatedText || textChunks.length === 0) return;
  
    if (window.speechSynthesis.speaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      // Jeśli nie jest odtwarzane i nie ma zapisanego indeksu, zacznij od początku
      if (currentChunkIndex === -1 || currentChunkIndex >= textChunks.length) {
        setLastStoryChunkIndex(-1); // Resetuj, jeśli zaczynamy od nowa
        speakChunk(0);
      } else {
        // Wznów od zapisanego currentChunkIndex
        speakChunk(currentChunkIndex);
      }
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunkIndex(-1);
    setLastStoryChunkIndex(-1); // Resetuj również ten stan
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current.onend = null;
      currentUtteranceRef.current.onerror = null;
      currentUtteranceRef.current = null;
    }
  };

  const handleTextSelection = () => {
    const text = window.getSelection().toString().trim();
    if (text) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectedText(text);
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setMenuVisible(true);
    }
  };

  const handleSaveToNotebook = async () => {
    if (!selectedText) return;
  
    // --- ZMIANA TUTAJ: Oczyszczanie zaznaczonego tekstu ---
    let cleanedText = selectedText.trim();
    // Usuń znaki interpunkcyjne z początku i końca
    cleanedText = cleanedText.replace(/^[.,;:!?"'‘“„”()\[\]{}—–-]/, '').replace(/[.,;:!?"'‘“„”()\[\]{}—–-]$/, '');
    cleanedText = cleanedText.trim(); // Ponownie usuń spacje, jeśli zostały
  
    if (!cleanedText) {
      alert("Zaznaczony tekst jest pusty lub składa się tylko ze znaków interpunkcyjnych.");
      return;
    }
    // --- KONIEC ZMIANY ---
  
    try {
      const response = await fetch("http://127.0.0.1:5001/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanedText }), // Użyj cleanedText
      });
      const data = await response.json();
      if (data.translation) {
        const newWordEntry = {
          original: cleanedText, // Użyj cleanedText
          translated: data.translation,
        };
        if (
          !notebookWords.some(
            (entry) => entry.original === newWordEntry.original
          )
        ) {
          setNotebookWords((prevWords) => [...prevWords, newWordEntry]);
        }
      } else {
        alert(`Błąd tłumaczenia podczas zapisywania: ${data.error}`);
      }
    } catch (err) {
      alert("Nie udało się połączyć z serwerem tłumacza, aby zapisać słowo.");
    }
    setMenuVisible(false);
  };

  const handleTranslate = async () => {
    if (!selectedText) return;
  
    // --- ZMIANA TUTAJ: Oczyszczanie zaznaczonego tekstu ---
    let cleanedText = selectedText.trim();
    // Usuń znaki interpunkcyjne z początku i końca
    cleanedText = cleanedText.replace(/^[.,;:!?"'‘“„”()\[\]{}—–-]/, '').replace(/[.,;:!?"'‘“„”()\[\]{}—–-]$/, '');
    cleanedText = cleanedText.trim(); // Ponownie usuń spacje, jeśli zostały
  
    if (!cleanedText) {
      alert("Zaznaczony tekst jest pusty lub składa się tylko ze znaków interpunkcyjnych.");
      return;
    }
    // --- KONIEC ZMIANY ---
  
    try {
      const response = await fetch("http://127.0.0.1:5001/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanedText }), // Użyj cleanedText
      });
      const data = await response.json();
      if (data.translation) {
        setTranslationContent({
          original: cleanedText, // Użyj cleanedText
          translated: data.translation,
        });
        setShowTranslationModal(true);
      } else {
        alert(`Błąd tłumaczenia: ${data.error}`);
      }
    } catch (err) {
      alert("Nie udało się połączyć z serwerem tłumacza.");
    }
    setMenuVisible(false);
  };


  const closeTranslationModal = () => {
    setShowTranslationModal(false);
  };

  const handleSaveTranslatedToNotebook = () => {
    if (translationContent.original && translationContent.translated) {
      const newWordEntry = {
        original: translationContent.original,
        translated: translationContent.translated,
      };
      if (
        !notebookWords.some((entry) => entry.original === newWordEntry.original)
      ) {
        setNotebookWords((prevWords) => [...prevWords, newWordEntry]);
      }
    }
    closeTranslationModal();
  };

  // --- NOWA FUNKCJA: WYSYŁANIE E-MAILA Z NOTATNIKA ---
  const handleSendNotebookEmail = async () => {
    if (!recipientEmail || !notebookWords.length) {
      alert(
        "Proszę podać adres e-mail i upewnić się, że notatnik nie jest pusty."
      );
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:5001/api/send-notebook-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: recipientEmail,
            notebook_words: notebookWords,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        setShowSendEmailModal(false);
        setRecipientEmail(""); // Wyczyść adres po wysłaniu
      } else {
        alert(
          `Błąd: ${data.error || "Nieznany błąd podczas wysyłania e-maila."}`
        );
      }
    } catch (error) {
      console.error("Błąd podczas wysyłania e-maila:", error);
      alert("Nie udało się połączyć z serwerem, aby wysłać e-mail.");
    }
  };

  const handleSpeakNotebookWord = (textToSpeak) => {
    if (!textToSpeak) return;
  
    // Sprawdź, czy główna historia jest w trakcie odtwarzania
    if (isSpeaking && !isPaused) {
      // Jeśli tak, zatrzymaj ją i zapisz aktualny indeks
      window.speechSynthesis.cancel();
      setLastStoryChunkIndex(currentChunkIndex); // Zapisz aktualny indeks
      setIsSpeaking(false); // Aktualizuj stan, że "główny lektor" już nie mówi
    } else if (isSpeaking && isPaused) {
      // Jeśli historia jest zapauzowana, po prostu anuluj bieżące
      window.speechSynthesis.cancel();
    }
  
    // Resetujemy stan odtwarzania historii TYLKO jeśli była aktywna
    // ale chcemy, żeby user mógł wznowić od miejsca gdzie skończył
    setIsPaused(false); // Upewnij się, że nie ma stanu pauzy z głównego playera
  
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const selectedVoice = voices.find(
      (voice) => voice.voiceURI === selectedVoiceURI
    );
  
    utterance.voice = selectedVoice;
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
  
    // Po zakończeniu słówka z notatnika, niech nic się nie dzieje dalej automatycznie
    utterance.onend = () => {
      // Możesz tutaj dodać logikę, aby wznowić historię, jeśli była odtwarzana,
      // ale lepiej pozostawić to użytkownikowi, aby wznowił ręcznie.
      // Jeśli chcesz automatycznego wznowienia, dodaj:
      // if (lastStoryChunkIndex !== -1) {
      //     speakChunk(lastStoryChunkIndex);
      //     setLastStoryChunkIndex(-1); // Wyzeruj po wznowieniu
      // }
    };
  
    utterance.onerror = (event) => {
        console.error("Błąd odtwarzania słówka z notatnika:", event);
    };
  
    window.speechSynthesis.speak(utterance);
  };

  const handleAnalyzeGrammar = async () => {
    if (!generatedText.trim()) {
      // <--- ZMIANA TUTAJ: używamy generatedText
      alert(
        "Proszę wygenerować historię, zanim przystąpisz do analizy gramatycznej."
      );
      return;
    }

    setIsAnalyzingGrammar(true);
    setGrammarResults([]); // Wyczyść poprzednie wyniki

    try {
      const response = await fetch(
        "http://127.0.0.1:5001/api/analyze-grammar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: generatedText }), // <--- ZMIANA TUTAJ: wysyłamy generatedText
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGrammarResults(data);
        setShowGrammarAnalysis(true); // Pokaż modal po otrzymaniu wyników
      } else {
        alert(`Błąd analizy gramatycznej: ${data.error || "Nieznany błąd."}`);
      }
    } catch (error) {
      console.error("Błąd podczas analizy gramatycznej:", error);
      alert("Nie udało się połączyć z serwerem w celu analizy gramatycznej.");
    } finally {
      setIsAnalyzingGrammar(false);
    }
  };

  return (
    <div className="App">
      {menuVisible && (
        <div
          className="context-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <button onClick={handleTranslate}>Przetłumacz</button>
          <button onClick={handleSaveToNotebook}>Zapisz w notatniku</button>
        </div>
      )}

      {showSendEmailModal && (
        <div className="translation-modal-overlay">
          <div className="translation-modal-content">
            <button
              className="close-modal-button"
              onClick={() => setShowSendEmailModal(false)}
            >
              ×
            </button>
            <h3>Wyślij notatnik na e-mail</h3>
            <p>Wprowadź adres e-mail, na który chcesz wysłać swoje słówka:</p>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Adres e-mail odbiorcy"
              className="email-input"
            />
            <button
              className="add-to-notebook-button"
              onClick={handleSendNotebookEmail}
              disabled={!recipientEmail || notebookWords.length === 0}
            >
              Wyślij słówka
            </button>
          </div>
        </div>
      )}

      {showTranslationModal && (
        <div className="translation-modal-overlay">
          <div className="translation-modal-content">
            <button
              className="close-modal-button"
              onClick={closeTranslationModal}
            >
              ×
            </button>
            <h3>Tłumaczenie:</h3>
            <p className="original-text">**{translationContent.original}**</p>
            <p className="translated-text">{translationContent.translated}</p>
            <button
              className="add-to-notebook-button"
              onClick={handleSaveTranslatedToNotebook}
            >
              Dodaj do notatnika
            </button>
          </div>
        </div>
      )}

      <header className="App-header">
        <h1>AI English Buddy</h1>
        <p>
          1. Wybierz tematy. 2. Dodaj szczegóły. 3. Wygeneruj, dostosuj i
          odsłuchaj historię.
        </p>

        {/* --- PRZYWRÓCONE PRZYCISKI TEMATÓW --- */}
        <div className="topic-buttons">
          {suggestedTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopicToggle(topic)}
              className={selectedTopics.includes(topic) ? "selected" : ""}
              disabled={isLoading}
            >
              {topic}
            </button>
          ))}
        </div>
        <div className="details-section">
          <textarea
            value={customDetails}
            onChange={(e) => setCustomDetails(e.target.value)}
            placeholder="Dodaj własne szczegóły..."
            rows="3"
            disabled={isLoading}
          />
        </div>
        <div className="generate-section">
          <button
            onClick={handleGenerateFromSelection}
            disabled={isLoading || selectedTopics.length === 0}
            className="generate-button"
          >
            {isLoading ? "Generowanie..." : "Wygeneruj Opowieść"}
          </button>
        </div>
        {/* --- KONIEC PRZYWRÓCONYCH PRZYCISKÓW TEMATÓW --- */}

        <div className="action-buttons-group">
          <button
            className="exercise-button"
            onClick={() => setShowFlashcards(true)}
            disabled={notebookWords.length === 0}
          >
            Ćwicz Notatnik
          </button>
          <button
            className="email-notebook-button"
            onClick={() => setShowSendEmailModal(true)}
            disabled={notebookWords.length === 0}
          >
            ✉️ Wyślij notatnik
          </button>
          <button
            className="grammar-analysis-button"
            onClick={handleAnalyzeGrammar}
            disabled={!generatedText.trim() || isAnalyzingGrammar}
          >
            {isAnalyzingGrammar ? "Analizowanie..." : "📊 Analiza Gramatyczna"}
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="story-container">
          <div className="story-loader">
            <label htmlFor="story-select">Wczytaj zapisaną historię:</label>
            <select id="story-select" onChange={handleLoadStory} value="">
              <option value="">Wybierz z listy...</option>
              {savedStories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.title}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const selectedStoryId =
                  document.getElementById("story-select").value;
                if (selectedStoryId) {
                  handleRemoveStory(selectedStoryId);
                } else {
                  alert("Proszę wybrać historię do usunięcia.");
                }
              }}
              disabled={!savedStories.length}
              className="remove-story-button"
            >
              Usuń wybraną
            </button>
          </div>
          {isLoading && <p>AI myśli...</p>}
          {generatedText && (
            <div className="response-container">
              <h3>Twoja spersonalizowana historia:</h3>

              <div className="audio-controls">
                <div className="voice-selector">
                  <label htmlFor="voice-select">Głos Lektora:</label>
                  <select
                    id="voice-select"
                    value={selectedVoiceURI || ""}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  >
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="speech-sliders">
                  <div>
                    <label htmlFor="rate">Szybkość:</label>
                    <input
                      type="range"
                      id="rate"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) =>
                        setSpeechRate(parseFloat(e.target.value))
                      }
                    />
                    <span>{speechRate.toFixed(1)}</span>
                  </div>
                  <div>
                    <label htmlFor="pitch">Ton:</label>
                    <input
                      type="range"
                      id="pitch"
                      min="0"
                      max="2"
                      step="0.1"
                      value={speechPitch}
                      onChange={(e) =>
                        setSpeechPitch(parseFloat(e.target.value))
                      }
                    />
                    <span>{speechPitch.toFixed(1)}</span>
                  </div>
                </div>
                <div className="playback-buttons">
                  <button onClick={handlePlayback}>
                    {isSpeaking && !isPaused
                      ? "⏸️ Pauza"
                      : "▶️ Odsłuchaj/Wznów"}
                  </button>
                  <button onClick={handleStop} disabled={!isSpeaking}>
                    ⏹️ Zatrzymaj
                  </button>
                </div>
              </div>

              <p onMouseUp={handleTextSelection} className="story-text-display">
                {textChunks.map((chunk, index) => (
                  <span
                    key={index}
                    className={
                      index === currentChunkIndex ? "highlighted-text" : ""
                    }
                  >
                    {chunk}
                    {index < textChunks.length - 1 ? " " : ""}
                  </span>
                ))}
              </p>
              <div className="save-story-container">
                <button
                  onClick={handleSaveStory}
                  disabled={isCurrentStorySaved}
                  className="save-story-button"
                >
                  {isCurrentStorySaved ? "✔ Zapisano" : "Zapisz historię"}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="notebook-sidebar">
          <h2>📝 Mój Notatnik</h2>
          {notebookWords.length > 0 ? (
            <ul className="notebook-list">
              {notebookWords.map((entry, index) => (
                <li key={index} className="notebook-item">
                  <div className="notebook-text">
                    <span className="notebook-original-word">
                      {entry.original}
                    </span>
                    <span className="notebook-translated-word">
                      {entry.translated}
                    </span>
                  </div>
                  <button
                    className="speak-notebook-word-button"
                    onClick={() => handleSpeakNotebookWord(entry.original)}
                  >
                    🔊
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-notebook">
              Zaznacz tekst w historii, aby dodać słówka.
            </p>
          )}
        </aside>

        {/* --- MODAL ANALIZY GRAMATYCZNEJ (Zostaje bez zmian) --- */}
        {showGrammarAnalysis && (
          <div className="grammar-modal-overlay">
            <div className="grammar-modal-content">
              <button
                className="close-modal-button"
                onClick={() => setShowGrammarAnalysis(false)}
              >
                ×
              </button>
              <h3>Analiza Gramatyczna Twojej Historii</h3>
              {grammarResults.length > 0 ? (
                <div className="grammar-results-list">
                  {grammarResults.map((item, index) => (
                    <div key={index} className="grammar-item">
                      <h4>{item.title}</h4>
                      <p className="grammar-example-sentence">
                        **Przykład:** "{item.example_sentence}"
                      </p>
                      <p className="grammar-explanation">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Brak wyników analizy gramatycznej lub wystąpił błąd.</p>
              )}
              <button
                className="add-to-notebook-button"
                onClick={() => setShowGrammarAnalysis(false)}
              >
                Zamknij
              </button>
            </div>
          </div>
        )}
        {/* --- KONIEC MODALA --- */}
      </main>
      {showFlashcards && (
        <div className="flashcards-section-wrapper">
          <Flashcards
            notebookWords={notebookWords}
            onFinishExercises={() => setShowFlashcards(false)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
