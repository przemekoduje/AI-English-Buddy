import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../../config";
import "./TranslatorDrawer.css";

const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "uk", name: "Українська" },
  { code: "pt", name: "Português" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
];

const TranslatorDrawer = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceLang, setSourceLang] = useState("English");
  const [targetLang, setTargetLang] = useState("Polski");
  const [sentence, setSentence] = useState("Maya knew she would need to adapt to a new routine.");
  const [polishTranslation, setPolishTranslation] = useState("Maya wiedziała, że będzie musiała dostosować się do nowej rutyny.");
  const [phrase, setPhrase] = useState("adapt to a new routine");
  const [contextExplanation, setContextExplanation] = useState('Translations depend on context. Here, "adapt to" means "dostosować się do".');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlayingEnglish, setIsPlayingEnglish] = useState(false);
  const [isPlayingPolish, setIsPlayingPolish] = useState(false);
  const [isSavingPhrase, setIsSavingPhrase] = useState(false);
  const [phraseSaved, setPhraseSaved] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedTrans, setCopiedTrans] = useState(false);
  const [isInputMode, setIsInputMode] = useState(false);

  // AI Assistant State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAssistantExpanded, setAiAssistantExpanded] = useState(true);
  const [aiCustomQuestion, setAiCustomQuestion] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState([]);

  const debounceTimerRef = useRef(null);

  const handleOpenDrawer = () => setIsOpen(true);
  const handleCloseDrawer = () => setIsOpen(false);

  // Close when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Listen to open-instant-translator events from Workspace and other components
  useEffect(() => {
    const handleOpenCustom = (e) => {
      setIsOpen(true);
      if (e.detail) {
        const {
          sentence: incomingSentence,
          sentenceTranslation: incomingSentenceTranslation,
          phrase: incomingPhrase,
          word: incomingWord,
          wordTranslation: incomingWordTranslation
        } = e.detail;

        const activeSentence = incomingSentence || sentence;
        if (incomingSentence) {
          setSentence(incomingSentence);
        }

        if (incomingPhrase) {
          setPhrase(incomingPhrase);
        } else if (incomingWord) {
          setPhrase(incomingWord);
        }

        if (incomingSentenceTranslation) {
          setPolishTranslation(incomingSentenceTranslation);
          fetchAiAssistant(activeSentence, incomingSentenceTranslation, sourceLang, targetLang);
        } else if (incomingSentence) {
          fetchTranslation(incomingSentence, incomingWord, sourceLang, targetLang);
        }

        if (incomingWord && incomingWordTranslation) {
          setContextExplanation(`Translations depend on context. Here, "${incomingWord}" means "${incomingWordTranslation}".`);
        }
      }
    };

    window.addEventListener("open-instant-translator", handleOpenCustom);
    return () => window.removeEventListener("open-instant-translator", handleOpenCustom);
  }, [sentence, sourceLang, targetLang]);

  const fetchTranslation = async (textToTranslate, wordContext, sLang = sourceLang, tLang = targetLang) => {
    if (!textToTranslate || !textToTranslate.trim()) return;
    setIsTranslating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({
          text: textToTranslate.trim(),
          context: wordContext || textToTranslate.trim(),
          source_lang: sLang,
          target_lang: tLang
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const resText = data.sentence_translation || data.translation || "Brak tłumaczenia.";
        setPolishTranslation(resText);
        // Automatically fetch AI Assistant insights
        fetchAiAssistant(textToTranslate.trim(), resText, sLang, tLang);
      } else {
        setPolishTranslation("Translation error.");
      }
    } catch (err) {
      console.error("Instant translation error:", err);
      setPolishTranslation("Connection error.");
    } finally {
      setIsTranslating(false);
    }
  };

  const fetchAiAssistant = async (srcText, transText, sLang = sourceLang, tLang = targetLang, customQ = "") => {
    if (!srcText) return;
    setIsAiLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate/ai-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({
          text: srcText,
          translation: transText,
          source_lang: sLang,
          target_lang: tLang,
          question: customQ
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (customQ) {
          setAiChatMessages(prev => [
            ...prev,
            { type: "user", text: customQ },
            { type: "assistant", text: data.explanation }
          ]);
        } else {
          setContextExplanation(data.explanation);
        }
      }
    } catch (err) {
      console.warn("AI Assistant fetch error:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    const newSource = targetLang;
    const newTarget = sourceLang;
    setSourceLang(newSource);
    setTargetLang(newTarget);

    const prevSentence = sentence;
    const prevTrans = polishTranslation;

    setSentence(prevTrans);
    setPolishTranslation(prevSentence);

    if (prevTrans) {
      fetchTranslation(prevTrans, phrase, newSource, newTarget);
    }
  };

  const handleSourceLangChange = (e) => {
    const newLang = e.target.value;
    setSourceLang(newLang);
    if (sentence) {
      fetchTranslation(sentence, phrase, newLang, targetLang);
    }
  };

  const handleTargetLangChange = (e) => {
    const newLang = e.target.value;
    setTargetLang(newLang);
    if (sentence) {
      fetchTranslation(sentence, phrase, sourceLang, newLang);
    }
  };

  const handleSentenceInputChange = (e) => {
    const val = e.target.value;
    setSentence(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (val.trim()) {
        fetchTranslation(val, "", sourceLang, targetLang);
        setPhrase(val.trim().split(" ").slice(0, 4).join(" "));
      }
    }, 900);
  };

  const handleAskAiQuestion = (qText) => {
    const query = qText || aiCustomQuestion;
    if (!query.trim()) return;
    fetchAiAssistant(sentence, polishTranslation, sourceLang, targetLang, query);
    setAiCustomQuestion("");
  };

  const handlePlayAudio = async (textToPlay, langName, setIsPlaying) => {
    if (!textToPlay) return;
    setIsPlaying(true);

    if (langName === "English") {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
          body: JSON.stringify({
            text: textToPlay,
            voice: "en-US-BrianNeural",
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.audio_base64) {
            const audio = new Audio("data:audio/mp3;base64," + data.audio_base64);
            audio.play().catch(() => {});
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => setIsPlaying(false);
            return;
          }
        }
      } catch (e) {
        console.warn("TTS API fallback:", e);
      }
    }

    // Web Speech fallback for Polish and other languages
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(textToPlay);
      const langCodeMap = {
        English: "en-US",
        Polski: "pl-PL",
        Español: "es-ES",
        Deutsch: "de-DE",
        Français: "fr-FR",
        Italiano: "it-IT",
        Українська: "uk-UA",
        Português: "pt-PT",
        日本語: "ja-JP",
        中文: "zh-CN"
      };
      utter.lang = langCodeMap[langName] || "en-US";
      utter.onend = () => setIsPlaying(false);
      utter.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utter);
    } else {
      setIsPlaying(false);
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "source") {
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    } else {
      setCopiedTrans(true);
      setTimeout(() => setCopiedTrans(false), 2000);
    }
  };

  const handleSavePhraseToVocabulary = async () => {
    if (isSavingPhrase) return;
    const targetWord = phrase || sentence;
    const targetTranslation = polishTranslation;
    if (!targetWord || !targetTranslation) return;

    setIsSavingPhrase(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || "",
        },
        body: JSON.stringify({
          original: targetWord.trim(),
          translated: targetTranslation.trim(),
          context_sentence: sentence.trim(),
        }),
      });
      if (response.ok) {
        setPhraseSaved(true);
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
        setTimeout(() => setPhraseSaved(false), 3000);
      }
    } catch (e) {
      console.error("Error saving phrase to vocabulary:", e);
    } finally {
      setIsSavingPhrase(false);
    }
  };

  return (
    <>
      {/* Floating Edge Trigger Tab (visible when drawer is closed) */}
      <button 
        className={`translator-drawer-trigger ${isOpen ? "hidden" : ""}`}
        onClick={handleOpenDrawer}
        title="Open Instant Translator"
      >
        <div className="trigger-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M5 8l6 6" />
            <path d="M4 14l6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="M22 22l-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        </div>
        <div className="trigger-label">Translator</div>
      </button>

      {/* Main Slide-out Drawer */}
      <div className={`translator-drawer-container ${isOpen ? "open" : ""}`}>
        <div className="instant-translator-content">
          {/* Top Header */}
          <div className="instant-translator-header">
            <div className="instant-translator-title-group">
              <h2 className="instant-translator-title">Instant translator</h2>
              <p className="instant-translator-subtitle">
                A little clarity, without leaving your story.
              </p>
            </div>
            <button 
              className="instant-translator-close-btn"
              onClick={handleCloseDrawer}
              aria-label="Close translator"
              title="Close translator"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Interactive Language Selector & Swap Bar */}
          <div className="instant-translator-lang-bar">
            <div className="lang-select-wrapper">
              <select 
                className="lang-pill-select active"
                value={sourceLang}
                onChange={handleSourceLangChange}
                title="Select source language"
              >
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <option key={`src-${lang.code}`} value={lang.name}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <button 
              className="lang-swap-btn"
              onClick={handleSwapLanguages}
              title="Swap languages (zamień kierunek tłumaczenia)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            <div className="lang-select-wrapper">
              <select 
                className="lang-pill-select"
                value={targetLang}
                onChange={handleTargetLangChange}
                title="Select target language"
              >
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <option key={`tgt-${lang.code}`} value={lang.name}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 1: SELECTED SENTENCE */}
          <div className="translator-card-section">
            <span className="translator-card-label">
              SELECTED SENTENCE ({sourceLang.toUpperCase()})
            </span>
            <div className="translator-white-card">
              {isInputMode ? (
                <div className="custom-sentence-input-wrapper">
                  <textarea
                    className="custom-sentence-textarea"
                    placeholder="Type or paste a sentence to translate..."
                    value={sentence}
                    onChange={handleSentenceInputChange}
                    rows={3}
                    autoFocus
                  />
                  <div className="custom-sentence-input-actions">
                    <button 
                      className="custom-sentence-submit-btn"
                      onClick={() => {
                        fetchTranslation(sentence, "", sourceLang, targetLang);
                        setIsInputMode(false);
                      }}
                      disabled={isTranslating || !sentence.trim()}
                    >
                      {isTranslating ? "Translating..." : "Done"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="sentence-text">
                  {sentence || "Maya knew she would need to adapt to a new routine."}
                </p>
              )}

              <div className="card-actions-row">
                <button 
                  className={`card-action-icon-btn ${isPlayingEnglish ? 'playing' : ''}`}
                  onClick={() => handlePlayAudio(sentence, sourceLang, setIsPlayingEnglish)}
                  title={`Listen to ${sourceLang} pronunciation`}
                  disabled={isPlayingEnglish}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
                <button 
                  className="card-action-icon-btn"
                  onClick={() => handleCopy(sentence, "source")}
                  title={copiedSource ? "Copied!" : "Copy sentence"}
                >
                  {copiedSource ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: TARGET LANGUAGE TRANSLATION */}
          <div className="translator-card-section">
            <span className="translator-card-label translation-label">
              {targetLang.toUpperCase()} TRANSLATION
            </span>
            <div className="translator-white-card">
              {isTranslating ? (
                <div className="translation-loading-placeholder">
                  <span className="translation-mini-spinner" />
                  <span>Translating with AI...</span>
                </div>
              ) : (
                <p className="translation-bold-text">
                  {polishTranslation || "Maya wiedziała, że będzie musiała dostosować się do nowej rutyny."}
                </p>
              )}

              <div className="card-actions-row">
                <button 
                  className={`card-action-icon-btn ${isPlayingPolish ? 'playing' : ''}`}
                  onClick={() => handlePlayAudio(polishTranslation, targetLang, setIsPlayingPolish)}
                  title={`Posłuchaj wymowy (${targetLang})`}
                  disabled={isPlayingPolish}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
                <button 
                  className="card-action-icon-btn"
                  onClick={() => handleCopy(polishTranslation, "trans")}
                  title={copiedTrans ? "Skopiowano!" : "Kopiuj tłumaczenie"}
                >
                  {copiedTrans ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* AI Assistant Section (Active AI Linguistic Intelligence) */}
          <div className="translator-context-section">
            <div className="ai-assistant-header-row">
              <span className="ai-assisted-badge">
                <span className="ai-badge-dot">●</span> AI-assisted translation
              </span>
              <button 
                className="ai-toggle-btn"
                onClick={() => setAiAssistantExpanded(prev => !prev)}
                title="Toggle AI Assistant"
              >
                {aiAssistantExpanded ? "Hide" : "Ask AI"}
              </button>
            </div>

            {isAiLoading && (
              <div className="ai-loading-indicator">
                <span className="ai-mini-pulse" />
                <span>AI Assistant analyzing nuances...</span>
              </div>
            )}

            {contextExplanation && (
              <p className="context-note-text">
                {contextExplanation}
              </p>
            )}

            {aiAssistantExpanded && (
              <div className="ai-interactive-panel">
                {/* Chat responses if user asked follow-up */}
                {aiChatMessages.length > 0 && (
                  <div className="ai-chat-thread">
                    {aiChatMessages.map((msg, idx) => (
                      <div key={idx} className={`ai-chat-bubble ${msg.type}`}>
                        {msg.type === "assistant" && <span className="ai-chat-label">AI:</span>}
                        <span>{msg.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick AI Prompt Chips */}
                <div className="ai-prompt-chips">
                  <button 
                    className="ai-prompt-chip"
                    onClick={() => handleAskAiQuestion("Why this translation fits best?")}
                  >
                    Why this translation?
                  </button>
                  <button 
                    className="ai-prompt-chip"
                    onClick={() => handleAskAiQuestion("Give 2 alternative natural phrases")}
                  >
                    Alternatives
                  </button>
                  <button 
                    className="ai-prompt-chip"
                    onClick={() => handleAskAiQuestion("Is this formal or casual?")}
                  >
                    Formality
                  </button>
                </div>

                {/* Ask AI Input Field */}
                <form 
                  className="ai-ask-input-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskAiQuestion();
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ask AI Assistant about this translation..."
                    value={aiCustomQuestion}
                    onChange={(e) => setAiCustomQuestion(e.target.value)}
                    disabled={isAiLoading}
                  />
                  <button 
                    type="submit" 
                    className="ai-ask-submit-btn" 
                    disabled={isAiLoading || !aiCustomQuestion.trim()}
                    title="Send question to AI"
                  >
                    ↑
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Section: Keep this phrase */}
          <div className="keep-phrase-section">
            <h3 className="keep-phrase-heading">Keep this phrase</h3>
            <p className="keep-phrase-subtitle">
              {phrase || "adapt to a new routine"}
            </p>

            <button 
              className={`save-phrase-btn ${phraseSaved ? "saved" : ""}`}
              onClick={handleSavePhraseToVocabulary}
              disabled={isSavingPhrase}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {phraseSaved ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                )}
              </svg>
              <span>{phraseSaved ? "Saved to vocabulary!" : "Save phrase to vocabulary"}</span>
            </button>

            <button 
              className="translate-another-btn"
              onClick={() => setIsInputMode(prev => !prev)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
              </svg>
              <span>{isInputMode ? "Cancel edit" : "Translate another sentence"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop overlay */}
      {isOpen && (
        <div className="translator-drawer-overlay" onClick={handleCloseDrawer} />
      )}
    </>
  );
};

export default TranslatorDrawer;
