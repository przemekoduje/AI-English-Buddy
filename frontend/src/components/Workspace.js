import React, { useState, useEffect, useRef, useCallback } from "react";
import "../App.css";
import "./Workspace.css";
import Flashcards from "./Flashcards";
import StoryGenerator from "./Story/StoryGenerator";
import Reader from "./Reader/Reader";
import NotebookSidebar from "./Notebook/NotebookSidebar";
import PracticeMode from "./Practice/PracticeMode";

const getInitialVoiceURI = (voices) => {
  if (!voices || voices.length === 0) return null;
  const englishVoices = voices.filter((voice) => voice.lang.startsWith("en-"));
  if (englishVoices.length === 0) return null;

  // 1. Priorytet: Głosy oznaczone jako "Natural" lub "Neural" (np. w Edge/Chrome)
  const naturalVoices = englishVoices.filter(v => 
    v.name.toLowerCase().includes("natural") || 
    v.name.toLowerCase().includes("neural")
  );
  if (naturalVoices.length > 0) {
    const maleNatural = naturalVoices.find(v => v.name.toLowerCase().includes("male"));
    if (maleNatural) return maleNatural.voiceURI;
    return naturalVoices[0].voiceURI;
  }

  // 2. Priorytet: Sprawdzone, wysokiej jakości męskie głosy systemowe (Mac, Windows, Google)
  const preferredNames = [
    "Evan",               // Mac (High quality male)
    "Nathan",             // Mac (High quality male)
    "Google US English Male",
    "Google UK English Male",
    "Microsoft Nathan Online (Natural)",
    "Microsoft Guy Online (Natural)",
    "Microsoft Mark",     // Windows
    "Alex",               // Mac standard male
  ];

  for (const name of preferredNames) {
    const found = englishVoices.find(v => v.name.includes(name));
    if (found) return found.voiceURI;
  }

  // 3. Fallback: Jakikolwiek męski
  const anyMale = englishVoices.find(v => v.name.toLowerCase().includes("male"));
  if (anyMale) return anyMale.voiceURI;

  return englishVoices[0].voiceURI;
};

function Workspace({
  onNavigateToDashboard,
  user,
  generatedText,
  setGeneratedText,
  currentStoryTitle,
  setCurrentStoryTitle,
  currentStoryId,
  setCurrentStoryId,
}) {
  const [showPracticeMode, setShowPracticeMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(null);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [notebookWords, setNotebookWords] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translationContent, setTranslationContent] = useState({ original: "", translated: "" });
  const [textChunks, setTextChunks] = useState([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [playSingle, setPlaySingle] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  
  const currentUtteranceRef = useRef(null);

  const loadVocabulary = useCallback(async () => {
    if (!user) return;
    if (!currentStoryId) {
      setNotebookWords([]);
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:5001/api/vocabulary?story_id=${currentStoryId}`, {
        headers: { "X-Session-Token": user.token }
      });
      if (response.ok) {
        const data = await response.json();
        setNotebookWords(data);
      }
    } catch (err) {
      console.error("Błąd podczas ładowania słownika:", err);
    }
  }, [user, currentStoryId]);

  useEffect(() => {
    loadVocabulary();
  }, [loadVocabulary]);

  useEffect(() => {
    const populateVoiceList = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const englishVoices = availableVoices.filter((v) => v.lang.startsWith("en-"));
      setVoices(englishVoices);
      if (!selectedVoiceURI && availableVoices.length > 0) {
        setSelectedVoiceURI(getInitialVoiceURI(availableVoices));
      }
    };
    populateVoiceList();
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI]);

  useEffect(() => {
    fetch("http://127.0.0.1:5001/api/get-topics")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setSuggestedTopics(data))
      .catch((err) => console.error("Błąd tematów:", err));
  }, []);

  useEffect(() => {
    if (generatedText) {
      const abbreviations = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Co|Corp|Inc|Ltd|e\.g|i\.e|vs|a\.m|p\.m)\.$/i;
      const markedText = generatedText.replace(/([.?!]["')\]]*)\s+/g, (match, p1, offset, string) => {
        const beforeText = string.substring(0, offset + 1);
        if (abbreviations.test(beforeText)) {
          return match;
        }
        return p1 + "\u0000";
      });
      const sentences = markedText.split("\u0000").filter((s) => s.trim() !== "");
      setTextChunks(sentences);
      setCurrentChunkIndex(-1);
    } else {
      setTextChunks([]);
      setCurrentChunkIndex(-1);
    }
  }, [generatedText]);

  const saveStoryToDb = async (title, text) => {
    if (!user) return null;
    try {
      const response = await fetch("http://127.0.0.1:5001/api/stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ title, text })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Błąd zapisu historii:", err);
    }
    return null;
  };

  const generateStory = async (topics, customDetails, settings) => {
    handleStop();
    setIsLoading(true);
    setGeneratedText("");
    setCurrentStoryTitle("");
    setCurrentStoryId(null);
    try {
      const response = await fetch("http://127.0.0.1:5001/api/generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ topics, customDetails, settings }),
      });
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        setGeneratedText(data[0].generated_text);
        const title = data[0].title || "My AI Story";
        setCurrentStoryTitle(title);
        // Automatycznie zapisz historię w bazie danych
        const savedStory = await saveStoryToDb(title, data[0].generated_text);
        if (savedStory && savedStory.id) {
          setCurrentStoryId(savedStory.id);
        }
      }
    } catch (error) {
      console.error("Błąd generowania:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const speakChunk = (index, single = false) => {
    if (index >= textChunks.length) {
      handleStop();
      return;
    }
    setCurrentChunkIndex(index);
    const utterance = new SpeechSynthesisUtterance(textChunks[index] + " ");
    const selectedVoice = voices.find((v) => v.voiceURI === selectedVoiceURI);
    utterance.voice = selectedVoice;
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setPlaySingle(single);
    };
    utterance.onend = () => {
      if (single) {
        handleStop();
      } else {
        if (!isPaused) speakChunk(index + 1, false);
        else setIsSpeaking(false);
      }
    };
    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayback = () => {
    if (!generatedText || textChunks.length === 0) return;
    if (window.speechSynthesis.speaking) {
      if (isPaused) { window.speechSynthesis.resume(); setIsPaused(false); }
      else { window.speechSynthesis.pause(); setIsPaused(true); }
    } else {
      speakChunk(currentChunkIndex === -1 || currentChunkIndex >= textChunks.length ? 0 : currentChunkIndex, false);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunkIndex(-1);
    setPlaySingle(false);
  };

  const handlePlaySentence = (index, single = false) => {
    if (isSpeaking && currentChunkIndex === index && playSingle === single) {
      handlePlayback();
    } else {
      window.speechSynthesis.cancel();
      speakChunk(index, single);
    }
  };

  const handleTextSelection = () => {
    const text = window.getSelection().toString().trim();
    if (text) {
      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      setSelectedText(text);
      setMenuPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX + rect.width / 2 });
      setMenuVisible(true);
    }
  };

  const handleTranslate = async () => {
    if (!selectedText) return;
    try {
      const response = await fetch("http://127.0.0.1:5001/api/translate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: selectedText }),
      });
      const data = await response.json();
      if (data.translation) {
        setTranslationContent({ original: selectedText, translated: data.translation });
        setShowTranslationModal(true);
      }
    } catch (err) { console.error("Błąd tłumaczenia:", err); }
    setMenuVisible(false);
  };

  const handleSaveToNotebook = async () => {
    if (translationContent.original && translationContent.translated) {
      const newEntry = { original: translationContent.original, translated: translationContent.translated };
      if (!notebookWords.some(e => e.original === newEntry.original)) {
        setNotebookWords(prev => [...prev, newEntry]);
      }

      try {
        await fetch("http://127.0.0.1:5001/api/vocabulary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user.token
          },
          body: JSON.stringify({ ...newEntry, story_id: currentStoryId })
        });
      } catch (err) {
        console.error("Błąd podczas zapisywania słówka:", err);
      }
    }
    setShowTranslationModal(false);
  };

  const handleAddDirectly = async () => {
    if (!selectedText) return;
    const textToTranslate = selectedText;
    setMenuVisible(false);

    // Dodanie optymistyczne z komunikatem oczekiwania
    const tempEntry = { original: textToTranslate, translated: "Tłumaczenie..." };
    setNotebookWords(prev => {
      if (!prev.some(e => e.original === tempEntry.original)) {
        return [...prev, tempEntry];
      }
      return prev;
    });

    try {
      const response = await fetch("http://127.0.0.1:5001/api/translate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: textToTranslate }),
      });
      const data = await response.json();
      if (data.translation) {
        setNotebookWords(prev =>
          prev.map(item =>
            item.original === textToTranslate
              ? { ...item, translated: data.translation }
              : item
          )
        );

        // Zapisz słówko w bazie danych
        await fetch("http://127.0.0.1:5001/api/vocabulary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user.token
          },
          body: JSON.stringify({ original: textToTranslate, translated: data.translation, story_id: currentStoryId })
        });
      } else {
        setNotebookWords(prev =>
          prev.map(item =>
            item.original === textToTranslate && item.translated === "Tłumaczenie..."
              ? { ...item, translated: "(brak tłumaczenia)" }
              : item
          )
        );
      }
    } catch (err) {
      console.error("Błąd automatycznego tłumaczenia:", err);
      setNotebookWords(prev =>
        prev.map(item =>
          item.original === textToTranslate && item.translated === "Tłumaczenie..."
            ? { ...item, translated: "(błąd połączenia)" }
            : item
        )
      );
    }
  };

  const handleDeleteWord = async (wordToDelete) => {
    setNotebookWords(prev => prev.filter(w => w.original !== wordToDelete));
    try {
      const url = `http://127.0.0.1:5001/api/vocabulary/${encodeURIComponent(wordToDelete)}` + 
        (currentStoryId ? `?story_id=${currentStoryId}` : "");
      await fetch(url, {
        method: "DELETE",
        headers: { "X-Session-Token": user.token }
      });
    } catch (err) {
      console.error("Błąd usuwania słówka z bazy:", err);
    }
  };

  // Usunięto handleDeleteStory, ponieważ historia jest teraz zarządzana w dedykowanej zakładce.

  const handleSendEmail = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5001/api/send-notebook-email", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ recipient_email: recipientEmail, notebook_words: notebookWords }),
      });
      if (response.ok) {
        alert("Email sent!");
        setShowSendEmailModal(false);
      }
    } catch (err) { console.error("Błąd email:", err); }
  };

  return (
    <div className="workspace-layout">
      {menuVisible && (
        <div className="context-menu" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <button onClick={handleTranslate}>Translate</button>
          <button onClick={handleAddDirectly}>Add directly</button>
        </div>
      )}

      {showTranslationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Translation</h3>
            <p><strong>{translationContent.original}</strong></p>
            <p>{translationContent.translated}</p>
            <button onClick={handleSaveToNotebook} className="btn-primary">Save to Notebook</button>
            <button onClick={() => setShowTranslationModal(false)} className="btn-secondary">Close</button>
          </div>
        </div>
      )}

      {showSendEmailModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Send Notebook</h3>
            <input 
              type="email" 
              placeholder="Your email" 
              value={recipientEmail} 
              onChange={e => setRecipientEmail(e.target.value)}
              className="premium-input"
            />
            <button onClick={handleSendEmail} className="btn-primary">Send Now</button>
            <button onClick={() => setShowSendEmailModal(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <main className="workspace-main">
        <header className="workspace-header">
           <button onClick={onNavigateToDashboard} className="back-btn">← Back to Dashboard</button>
           <h1>{currentStoryTitle || "English Buddy Workspace"}</h1>
        </header>

        {!generatedText && !isLoading ? (
          <StoryGenerator 
            onGenerate={generateStory} 
            isLoading={isLoading} 
            suggestedTopics={suggestedTopics} 
            user={user}
          />
        ) : (
          <Reader 
            generatedText={generatedText}
            textChunks={textChunks}
            currentChunkIndex={currentChunkIndex}
            isSpeaking={isSpeaking}
            isPaused={isPaused}
            onPlayback={handlePlayback}
            onStop={handleStop}
            onPlaySentence={handlePlaySentence}
            playSingle={playSingle}
            voices={voices}
            selectedVoiceURI={selectedVoiceURI}
            setSelectedVoiceURI={setSelectedVoiceURI}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            speechPitch={speechPitch}
            setSpeechPitch={setSpeechPitch}
            onTextSelection={handleTextSelection}
            onStartMastery={() => setShowPracticeMode(true)}
            onClearStory={() => {
              handleStop();
              setGeneratedText("");
              setCurrentStoryTitle("");
              setCurrentStoryId(null);
            }}
          />
        )}
      </main>

      <NotebookSidebar 
        notebookWords={notebookWords}
        onSpeakWord={(text) => {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.voice = voices.find(v => v.voiceURI === selectedVoiceURI);
          window.speechSynthesis.speak(u);
        }}
        onDeleteWord={handleDeleteWord}
        onOpenEmailModal={() => setShowSendEmailModal(true)}
        onOpenFlashcards={() => setShowFlashcards(true)}
      />

      {showPracticeMode && (
        <PracticeMode 
          text={generatedText}
          voices={voices}
          selectedVoiceURI={selectedVoiceURI}
          user={user}
          onExit={() => setShowPracticeMode(false)}
        />
      )}

      {showFlashcards && (
        <div className="flashcards-overlay">
          <Flashcards 
            notebookWords={notebookWords} 
            onFinishExercises={() => setShowFlashcards(false)} 
          />
        </div>
      )}
    </div>
  );
}

export default Workspace;
