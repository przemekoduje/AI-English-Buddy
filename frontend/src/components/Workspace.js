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

function Workspace({ onNavigateToDashboard }) {
  const [generatedText, setGeneratedText] = useState("");
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
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [savedStories, setSavedStories] = useState([]);
  const [isCurrentStorySaved, setIsCurrentStorySaved] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [showGrammarAnalysis, setShowGrammarAnalysis] = useState(false);
  const [grammarResults, setGrammarResults] = useState([]);
  const [isAnalyzingGrammar, setIsAnalyzingGrammar] = useState(false);
  const [currentStoryTitle, setCurrentStoryTitle] = useState("");
  
  const currentUtteranceRef = useRef(null);

  const loadStories = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:5001/api/stories");
      if (response.ok) {
        const data = await response.json();
        setSavedStories(data);
      }
    } catch (error) {
      console.error("Błąd podczas wczytywania historii:", error);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

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
      const sentences = generatedText.split(/(?<=[.?!])\s+/g).filter((s) => s.trim() !== "");
      setTextChunks(sentences);
      setCurrentChunkIndex(-1);
    } else {
      setTextChunks([]);
      setCurrentChunkIndex(-1);
    }
  }, [generatedText]);

  const generateStory = async (promptToGenerate) => {
    handleStop();
    setIsLoading(true);
    setGeneratedText("");
    setIsCurrentStorySaved(false);
    setCurrentStoryTitle("");
    try {
      const response = await fetch("http://127.0.0.1:5001/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToGenerate }),
      });
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        setGeneratedText(data[0].generated_text);
        setCurrentStoryTitle(data[0].title || "My AI Story");
      }
    } catch (error) {
      console.error("Błąd generowania:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const speakChunk = (index) => {
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
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend = () => { if (!isPaused) speakChunk(index + 1); else setIsSpeaking(false); };
    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayback = () => {
    if (!generatedText || textChunks.length === 0) return;
    if (window.speechSynthesis.speaking) {
      if (isPaused) { window.speechSynthesis.resume(); setIsPaused(false); }
      else { window.speechSynthesis.pause(); setIsPaused(true); }
    } else {
      speakChunk(currentChunkIndex === -1 || currentChunkIndex >= textChunks.length ? 0 : currentChunkIndex);
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunkIndex(-1);
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
        headers: { "Content-Type": "application/json" },
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

  const handleSaveToNotebook = () => {
    if (translationContent.original && translationContent.translated) {
      const newEntry = { original: translationContent.original, translated: translationContent.translated };
      if (!notebookWords.some(e => e.original === newEntry.original)) {
        setNotebookWords(prev => [...prev, newEntry]);
      }
    }
    setShowTranslationModal(false);
  };

  const handleSendEmail = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5001/api/send-notebook-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          <button onClick={() => { setTranslationContent({ original: selectedText, translated: "..." }); handleSaveToNotebook(); }}>Add directly</button>
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
            voices={voices}
            selectedVoiceURI={selectedVoiceURI}
            setSelectedVoiceURI={setSelectedVoiceURI}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            speechPitch={speechPitch}
            setSpeechPitch={setSpeechPitch}
            onTextSelection={handleTextSelection}
            onStartMastery={() => setShowPracticeMode(true)}
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
        onOpenEmailModal={() => setShowSendEmailModal(true)}
        onOpenFlashcards={() => setShowFlashcards(true)}
      />

      {showPracticeMode && (
        <PracticeMode 
          text={generatedText}
          voices={voices}
          selectedVoiceURI={selectedVoiceURI}
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
