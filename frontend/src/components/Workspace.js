import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from '../config';
import "../App.css";
import "./Workspace.css";
import Flashcards from "./Flashcards";
import StoryGenerator from "./Story/StoryGenerator";
import Reader from "./Reader/Reader";
import NotebookSidebar from "./Notebook/NotebookSidebar";
import PracticeMode from "./Practice/PracticeMode";
import WordExplanationModal from "./Notebook/WordExplanationModal";
import SessionSummaryModal from "./Notebook/SessionSummaryModal";
import PronunciationPracticeModal from "./Notebook/PronunciationPracticeModal";

const GENERATION_PHASES = [
  { label: "Analizuję temat...",        targetPct: 12, durationMs: 1800  },
  { label: "Tworzę strukturę lekcji...", targetPct: 28, durationMs: 2800  },
  { label: "Generuję treść...",          targetPct: 55, durationMs: 6000  },
  { label: "Opracowuję tłumaczenia...",  targetPct: 72, durationMs: 5000  },
  { label: "Finalizuję sekcje...",       targetPct: 88, durationMs: 5000  },
  { label: "Prawie gotowe...",           targetPct: 95, durationMs: 4000  },
];

const PREMIUM_VOICES = [
  { voiceURI: 'en-US-BrianNeural', name: 'Brian (US - Male) 🌟', lang: 'en-US' },
  { voiceURI: 'en-US-AriaNeural', name: 'Aria (US - Female) 🌟', lang: 'en-US' },
  { voiceURI: 'en-US-EmmaMultilingualNeural', name: 'Emma (US - Multilingual) 🌟', lang: 'en-US' },
  { voiceURI: 'en-GB-RyanNeural', name: 'Ryan (UK - Male)', lang: 'en-GB' },
  { voiceURI: 'en-GB-SoniaNeural', name: 'Sonia (UK - Female)', lang: 'en-GB' },
];

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
  const voices = PREMIUM_VOICES;
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('en-US-BrianNeural');
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
  const [showVoiceControls, setShowVoiceControls] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [explanationWord, setExplanationWord] = useState(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceTargetText, setPracticeTargetText] = useState("");
  
  // States for story parts / continuation
  const [storyParts, setStoryParts] = useState([]);
  const [activePartIndex, setActivePartIndex] = useState(-1);
  const [isContinuing, setIsContinuing] = useState(false);
  const [continuationDetails, setContinuationDetails] = useState("");
  const [selectedContinuationTopics, setSelectedContinuationTopics] = useState([]);
  const [loadedRootId, setLoadedRootId] = useState(null);
  
  const [genProgress, setGenProgress] = useState(0);
  const [genPhaseLabel, setGenPhaseLabel] = useState("");
  const progressTimersRef = useRef([]);
  
  // States for word translation tooltip
  const [activeWordId, setActiveWordId] = useState(null);
  const [activeWordHighlight, setActiveWordHighlight] = useState(null);
  const [wordTooltipTranslation, setWordTooltipTranslation] = useState("");
  const [wordTooltipLoading, setWordTooltipLoading] = useState(false);
  const [showWordTooltip, setShowWordTooltip] = useState(false);
  
  const currentAudioRef = useRef(null);
  const contextMenuRef = useRef(null);
  const activeSelectionRangeRef = useRef(null);
  const activeSelectionTextRef = useRef(null);
  // Tracks whether story playback was active when a word tooltip was opened
  const wasPlayingBeforeTooltipRef = useRef(false);
  // Tracks the chunk index at pause-for-tooltip moment
  const pausedChunkIndexRef = useRef(-1);
  const speakChunkRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentChunkIndexRef = useRef(-1);
  
  // Telemetry & summary states
  const [activityLog, setActivityLog] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const explanationStartTimeRef = useRef(null);
  const prevExplanationWordRef = useRef(null);
  const handlePlaybackRef = useRef(null);

  // Floating player dragging state & event handlers
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 });
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);
  const playerDragStartRef = useRef({ x: 0, y: 0 });
  const floatingPlayerRef = useRef(null);

  const handlePlayerMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest('.player-btn')) return;
    setIsDraggingPlayer(true);
    playerDragStartRef.current = {
      x: e.clientX - playerPosition.x,
      y: e.clientY - playerPosition.y
    };
    
    const handleMouseMove = (moveEvent) => {
      setPlayerPosition({
        x: moveEvent.clientX - playerDragStartRef.current.x,
        y: moveEvent.clientY - playerDragStartRef.current.y
      });
    };
    
    const handleMouseUp = () => {
      setIsDraggingPlayer(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handlePlayerTouchStart = (e) => {
    if (e.target.closest('.player-btn')) return;
    const touch = e.touches[0];
    setIsDraggingPlayer(true);
    playerDragStartRef.current = {
      x: touch.clientX - playerPosition.x,
      y: touch.clientY - playerPosition.y
    };
    
    const handleTouchMove = (moveEvent) => {
      const moveTouch = moveEvent.touches[0];
      setPlayerPosition({
        x: moveTouch.clientX - playerDragStartRef.current.x,
        y: moveTouch.clientY - playerDragStartRef.current.y
      });
    };
    
    const handleTouchEnd = () => {
      setIsDraggingPlayer(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const loadVocabulary = useCallback(async () => {
    if (!user) return;
    if (!currentStoryId) {
      setNotebookWords([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary?story_id=${currentStoryId}`, {
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

  // Effect to load story parts when currentStoryId changes
  useEffect(() => {
    if (!user || !currentStoryId) {
      if (storyParts.length > 0) setStoryParts([]);
      if (activePartIndex !== -1) setActivePartIndex(-1);
      if (loadedRootId !== null) setLoadedRootId(null);
      return;
    }
    
    if (loadedRootId) {
      const existingIndex = storyParts.findIndex(p => p.id === currentStoryId);
      if (existingIndex !== -1) {
        setActivePartIndex(existingIndex);
        return;
      }
    }
    
    const loadStoryParts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/stories/${currentStoryId}/parts`, {
          headers: { "X-Session-Token": user.token }
        });
        if (response.ok) {
          const data = await response.json();
          setStoryParts(data);
          const rootId = data[0]?.id || currentStoryId;
          setLoadedRootId(rootId);
          
          const index = data.findIndex(p => p.id === currentStoryId);
          const activeIdx = index !== -1 ? index : 0;
          setActivePartIndex(activeIdx);
          
          const activePart = data[activeIdx] || data[0];
          if (activePart) {
            setGeneratedText(activePart.text);
            setCurrentStoryTitle(activePart.title);
          }
        }
      } catch (err) {
        console.error("Błąd ładowania części historii:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStoryParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId, user, setGeneratedText, setCurrentStoryTitle]);

  const handleSelectPart = (index) => {
    handleStop();
    const part = storyParts[index];
    if (part) {
      setIsContinuing(false);
      setActivePartIndex(index);
      setGeneratedText(part.text);
      setCurrentStoryTitle(part.title);
      setCurrentStoryId(part.id);
    }
  };

  const handleGenerateContinuation = async () => {
    handleStop();
    setIsLoading(true);
    
    const rootStoryId = loadedRootId || currentStoryId;
    
    try {
      let settings = {
        language_level: "medium",
        length: "medium",
        is_factual: false,
        protagonist: "",
        genre: "adventure",
        focus_area: "none"
      };
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/user-settings`, {
          headers: { "X-Session-Token": user.token }
        });
        if (res.ok) {
          settings = await res.json();
        }
      } catch (e) {
        console.error("Błąd pobierania ustawień dla kontynuacji:", e);
      }

      const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ 
          topics: selectedContinuationTopics, 
          customDetails: continuationDetails, 
          settings,
          parent_id: rootStoryId
        }),
      });
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        const newPart = {
          id: data[0].story_id,
          title: data[0].title || `Chapter ${storyParts.length + 1}`,
          text: data[0].generated_text,
          part_number: storyParts.length + 1
        };
        
        const updatedParts = [...storyParts, newPart];
        setStoryParts(updatedParts);
        setActivePartIndex(updatedParts.length - 1);
        
        setGeneratedText(newPart.text);
        setCurrentStoryTitle(newPart.title);
        setCurrentStoryId(newPart.id);
        
        setContinuationDetails("");
        setSelectedContinuationTopics([]);
        setIsContinuing(false);
      }
    } catch (error) {
      console.error("Błąd generowania kontynuacji:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Premium neural voices are loaded statically and processed by backend edge-tts.

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/get-topics`)
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setSuggestedTopics(data))
      .catch((err) => console.error("Błąd tematów:", err));
  }, []);

  const clearProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach(t => clearTimeout(t));
    progressTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (isLoading && isContinuing) {
      setGenProgress(0);
      setGenPhaseLabel(GENERATION_PHASES[0].label);
      clearProgressTimers();

      let elapsed = 0;
      GENERATION_PHASES.forEach((phase, idx) => {
        const t = setTimeout(() => {
          setGenProgress(phase.targetPct);
          setGenPhaseLabel(phase.label);
        }, elapsed);
        progressTimersRef.current.push(t);
        elapsed += phase.durationMs;
      });
    } else {
      // Generation done — snap to 100 then reset
      setGenProgress(100);
      const t = setTimeout(() => {
        setGenProgress(0);
        setGenPhaseLabel("");
        clearProgressTimers();
      }, 500);
      progressTimersRef.current.push(t);
    }
    return () => clearProgressTimers();
  }, [isLoading, isContinuing, clearProgressTimers]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuVisible && contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setMenuVisible(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [menuVisible]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key.toLowerCase() === 'p') {
        if (showPracticeMode || showPracticeModal || showTranslationModal || explanationWord || showWordTooltip || showFlashcards || showSummaryModal) {
          return;
        }
        e.preventDefault();
        if (handlePlaybackRef.current) {
          handlePlaybackRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPracticeMode, showPracticeModal, showTranslationModal, explanationWord, showWordTooltip, showFlashcards, showSummaryModal]);

  const pauseAudioForTooltip = useCallback(() => {
    const audio = currentAudioRef.current;
    if ((audio && !audio.paused) || (isSpeakingRef.current && !isPausedRef.current)) {
      wasPlayingBeforeTooltipRef.current = true;
      pausedChunkIndexRef.current = currentChunkIndexRef.current >= 0 ? currentChunkIndexRef.current : 0;
      if (audio) {
        audio.pause();
      }
      setIsPaused(true);
      isPausedRef.current = true;
    }
  }, []);

  const resumeAudioAfterTooltip = useCallback(() => {
    if (wasPlayingBeforeTooltipRef.current) {
      const chunkToReplay = pausedChunkIndexRef.current;
      wasPlayingBeforeTooltipRef.current = false;
      pausedChunkIndexRef.current = -1;
      isPausedRef.current = false;
      setIsPaused(false);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (chunkToReplay >= 0) {
        setTimeout(() => {
          if (speakChunkRef.current) {
            speakChunkRef.current(chunkToReplay, false);
          }
        }, 60);
      }
    } else {
      wasPlayingBeforeTooltipRef.current = false;
    }
  }, []);

  const triggerSelectionTranslation = async (text, range) => {
    pauseAudioForTooltip();

    const rect = range.getBoundingClientRect();

    const layoutEl = document.querySelector('.workspace-layout');
    const layoutRect = layoutEl ? layoutEl.getBoundingClientRect() : { top: 0, left: 0 };

    const top = rect.top - layoutRect.top;
    const left = rect.left - layoutRect.left;
    const width = rect.width;
    const height = rect.height;

    setActiveWordId(null);
    setActiveWordHighlight({
      word: text,
      id: null,
      rect: { top, left, width, height }
    });

    setWordTooltipLoading(true);
    setShowWordTooltip(true);

    try {
      let sentenceContext = undefined;
      let node = range.startContainer;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains('story-sentence')) {
          sentenceContext = node.textContent;
          break;
        }
        node = node.parentNode;
      }

      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: text, context: sentenceContext }),
      });
      const data = await response.json();
      if (data.translation) {
        setWordTooltipTranslation(data.translation);
      } else {
        setWordTooltipTranslation("Brak tłumaczenia");
      }
    } catch (err) {
      console.error("Błąd tłumaczenia zaznaczenia:", err);
      setWordTooltipTranslation("Błąd połączenia");
    } finally {
      setWordTooltipLoading(false);
    }
  };

  useEffect(() => {
    const handleGlobalMouseDown = (e) => {
      if (activeSelectionRangeRef.current) {
        const rect = activeSelectionRangeRef.current.getBoundingClientRect();
        const { clientX, clientY } = e;
        const pad = 5;
        const isInside = (
          clientX >= rect.left - pad &&
          clientX <= rect.right + pad &&
          clientY >= rect.top - pad &&
          clientY <= rect.bottom + pad
        );
        if (!isInside) {
          activeSelectionRangeRef.current = null;
          activeSelectionTextRef.current = null;
        }
      }
    };
    document.addEventListener("mousedown", handleGlobalMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", handleGlobalMouseDown, true);
    };
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (activeSelectionRangeRef.current && !showWordTooltip) {
        const rect = activeSelectionRangeRef.current.getBoundingClientRect();
        const { clientX, clientY } = e;
        
        const pad = 5;
        const isInside = (
          clientX >= rect.left - pad &&
          clientX <= rect.right + pad &&
          clientY >= rect.top - pad &&
          clientY <= rect.bottom + pad
        );
        
        if (isInside) {
          const text = activeSelectionTextRef.current;
          const range = activeSelectionRangeRef.current;
          
          activeSelectionRangeRef.current = null;
          activeSelectionTextRef.current = null;
          
          triggerSelectionTranslation(text, range);
        }
      }
    };
    
    document.addEventListener("mousemove", handleGlobalMouseMove, true);
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove, true);
    };
  }, [showWordTooltip]);

  useEffect(() => {
    const now = Date.now();
    if (prevExplanationWordRef.current && prevExplanationWordRef.current !== explanationWord) {
      const duration = Math.round((now - explanationStartTimeRef.current) / 1000);
      if (duration >= 1) {
        setActivityLog(prev => [
          ...prev,
          {
            type: "explain",
            word_or_phrase: prevExplanationWordRef.current,
            timestamp: now,
            details: { duration_seconds: duration }
          }
        ]);
      }
    }
    if (explanationWord) {
      explanationStartTimeRef.current = now;
    }
    prevExplanationWordRef.current = explanationWord;
  }, [explanationWord]);

  useEffect(() => {
    if (generatedText) {
      const abbreviations = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Co|Corp|Inc|Ltd|e\.g|i\.e|vs|a\.m|p\.m)\.$/i;
      let markedText = generatedText.replace(/([.?!]["')\]]*)\s+/g, (match, p1, offset, string) => {
        const beforeText = string.substring(0, offset + 1);
        if (abbreviations.test(beforeText)) {
          return match;
        }
        const newlines = match.substring(p1.length).replace(/[^\n]/g, "");
        return p1 + "\u0000" + newlines;
      });
      markedText = markedText.replace(/(?<!\u0000)(\n+)/g, "\u0000$1");
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
      const response = await fetch(`${API_BASE_URL}/api/stories`, {
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
    setStoryParts([]);
    setActivePartIndex(-1);
    setLoadedRootId(null);
    setIsContinuing(false);
    setContinuationDetails("");
    setSelectedContinuationTopics([]);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate`, {
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
          const newPart = {
            id: savedStory.id,
            title: title,
            text: data[0].generated_text,
            part_number: 1
          };
          setStoryParts([newPart]);
          setActivePartIndex(0);
          setLoadedRootId(savedStory.id);
          setCurrentStoryId(savedStory.id);
        }
      }
    } catch (error) {
      console.error("Błąd generowania:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateDefaultText = async () => {
    handleStop();
    setIsLoading(true);
    setGeneratedText("");
    setCurrentStoryTitle("");
    setCurrentStoryId(null);
    setStoryParts([]);
    setActivePartIndex(-1);
    setLoadedRootId(null);
    setIsContinuing(false);
    setContinuationDetails("");
    setSelectedContinuationTopics([]);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-default`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
      });
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        setGeneratedText(data[0].generated_text);
        const title = data[0].title || "Default Lesson";
        setCurrentStoryTitle(title);
        // Automatycznie zapisz historię w bazie danych
        const savedStory = await saveStoryToDb(title, data[0].generated_text);
        if (savedStory && savedStory.id) {
          const newPart = {
            id: savedStory.id,
            title: title,
            text: data[0].generated_text,
            part_number: 1
          };
          setStoryParts([newPart]);
          setActivePartIndex(0);
          setLoadedRootId(savedStory.id);
          setCurrentStoryId(savedStory.id);
        }
      }
    } catch (error) {
      console.error("Błąd generowania lekcji domyślnej:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackButtonClick = () => {
    if (generatedText) {
      handleStop();
      setGeneratedText("");
      setCurrentStoryTitle("");
      setCurrentStoryId(null);
      setStoryParts([]);
      setActivePartIndex(-1);
      setLoadedRootId(null);
      setIsContinuing(false);
    } else {
      onNavigateToDashboard();
    }
  };

  const speakChunk = async (index, single = false) => {
    if (index >= textChunks.length) {
      handleStop();
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setCurrentChunkIndex(index);
    currentChunkIndexRef.current = index;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    setPlaySingle(single);

    setActivityLog(prev => [
      ...prev,
      {
        type: "listen_sentence",
        sentence_index: index,
        total_sentences: textChunks.length,
        timestamp: Date.now()
      }
    ]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textChunks[index],
          voice: selectedVoiceURI || "en-US-BrianNeural"
        })
      });

      if (!response.ok) throw new Error("Failed to generate audio");
      const data = await response.json();
      if (!data.audio_base64) throw new Error("No audio data returned");

      if (wasPlayingBeforeTooltipRef.current || isPausedRef.current) {
        return;
      }

      const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = speechRate;

      audio.onended = () => {
        if (single) {
          handleStop();
        } else {
          speakChunk(index + 1, false);
        }
      };

      audio.onerror = () => {
        handleStop();
      };

      currentAudioRef.current = audio;
      audio.play();
    } catch (err) {
      console.error("Error generating/playing speech:", err);
      handleStop();
    }
  };
  speakChunkRef.current = speakChunk;

  const handlePlayback = () => {
    if (!generatedText || textChunks.length === 0) return;
    if (currentAudioRef.current) {
      if (isPausedRef.current || currentAudioRef.current.paused) {
        currentAudioRef.current.play();
        setIsPaused(false);
        isPausedRef.current = false;
      } else {
        currentAudioRef.current.pause();
        setIsPaused(true);
        isPausedRef.current = true;
      }
    } else if (isSpeakingRef.current) {
      setIsPaused(true);
      isPausedRef.current = true;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    } else {
      const idx = currentChunkIndexRef.current === -1 || currentChunkIndexRef.current >= textChunks.length ? 0 : currentChunkIndexRef.current;
      speakChunk(idx, false);
    }
  };
  handlePlaybackRef.current = handlePlayback;

  const handleStop = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    setCurrentChunkIndex(-1);
    currentChunkIndexRef.current = -1;
    setPlaySingle(false);
  };

  const handlePlaySentence = (index, single = false) => {
    if (isSpeaking && currentChunkIndex === index && playSingle === single) {
      handlePlayback();
    } else {
      handleStop();
      speakChunk(index, single);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text && selection.rangeCount > 0) {
      activeSelectionRangeRef.current = selection.getRangeAt(0).cloneRange();
      activeSelectionTextRef.current = text;
    } else {
      activeSelectionRangeRef.current = null;
      activeSelectionTextRef.current = null;
    }
  };

  const handleTranslate = async () => {
    if (!selectedText) return;
    pauseAudioForTooltip();
    setActivityLog(prev => [
      ...prev,
      {
        type: "translate",
        word_or_phrase: selectedText,
        timestamp: Date.now()
      }
    ]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
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

  const handleCloseWordTooltip = useCallback(() => {
    setShowWordTooltip(false);
    setActiveWordHighlight(null);
    setActiveWordId(null);
    setWordTooltipTranslation("");
    resumeAudioAfterTooltip();
  }, [resumeAudioAfterTooltip]);

  const handleSaveWordFromTooltip = async () => {
    if (!activeWordHighlight || !wordTooltipTranslation) return;
    const word = activeWordHighlight.word;
    const translation = wordTooltipTranslation;
    setActivityLog(prev => [
      ...prev,
      { type: "add_to_notebook", word, translation, timestamp: Date.now() }
    ]);
    const newEntry = { original: word, translated: translation };
    if (!notebookWords.some(e => e.original === newEntry.original)) {
      setNotebookWords(prev => [newEntry, ...prev]);
      setTimeout(() => {
        const scrollArea = document.querySelector(".notebook-scroll-area");
        if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
      try {
        await fetch(`${API_BASE_URL}/api/vocabulary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
          body: JSON.stringify({ ...newEntry, story_id: currentStoryId })
        });
      } catch (err) {
        console.error("Błąd zapisywania słówka:", err);
      }
    }
    handleCloseWordTooltip();
  };

  const handleWordClick = async (word, wordId, element, sentenceContext) => {
    pauseAudioForTooltip();

    const layoutEl = document.querySelector('.workspace-layout');
    const layoutRect = layoutEl ? layoutEl.getBoundingClientRect() : { top: 0, left: 0 };

    const rect = element.getBoundingClientRect();
    const top = rect.top - layoutRect.top;
    const left = rect.left - layoutRect.left;
    const width = rect.width;
    const height = rect.height;

    setActiveWordId(wordId);
    setActiveWordHighlight({
      word: word,
      id: wordId,
      rect: { top, left, width, height }
    });
    setWordTooltipLoading(true);
    setShowWordTooltip(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: word, context: sentenceContext }),
      });
      const data = await response.json();
      if (data.translation) {
        setWordTooltipTranslation(data.translation);
      } else {
        setWordTooltipTranslation("Brak tłumaczenia");
      }
    } catch (err) {
      console.error("Błąd tłumaczenia słowa:", err);
      setWordTooltipTranslation("Błąd połączenia");
    } finally {
      setWordTooltipLoading(false);
    }
  };

  const handleSpeakWord = async (word) => {
    if (!word) return;
    // Keep a reference to the paused story audio so we can restore it after word TTS finishes
    const storyAudio = currentAudioRef.current;
    const storyWasPaused = storyAudio ? storyAudio.paused : true;
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: word,
          voice: selectedVoiceURI || "en-US-BrianNeural"
        })
      });
      if (!response.ok) throw new Error("Failed to generate audio");
      const data = await response.json();
      if (data.audio_base64) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const wordAudio = new Audio(audioUrl);
        // Temporarily swap so we can play the word pronunciation
        if (storyAudio && !storyWasPaused) storyAudio.pause();
        wordAudio.play();
        // After word pronunciation ends, restore story audio ref (do NOT auto-resume — user controls that)
        wordAudio.onended = () => {
          // Restore story audio reference so play/pause buttons still work
          currentAudioRef.current = storyAudio;
        };
        // Temporarily point ref at word audio; don't lose story audio
        // We store word audio separately and keep story audio ref intact
      }
    } catch (err) {
      console.error("Błąd TTS dla wyrazu:", err);
    }
  };

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (
        !e.target.closest('.reader-word') && 
        !e.target.closest('.word-translation-tooltip')
      ) {
        handleCloseWordTooltip();
      }
    };
    if (showWordTooltip) {
      document.addEventListener('click', handleGlobalClick);
    }
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [showWordTooltip, handleCloseWordTooltip]);

  const handleSaveToNotebook = async () => {
    if (translationContent.original && translationContent.translated) {
      setActivityLog(prev => [
        ...prev,
        {
          type: "add_to_notebook",
          word: translationContent.original,
          translation: translationContent.translated,
          timestamp: Date.now()
        }
      ]);
      const newEntry = { original: translationContent.original, translated: translationContent.translated };
      if (!notebookWords.some(e => e.original === newEntry.original)) {
        setNotebookWords(prev => [newEntry, ...prev]);

        // Auto-scroll the sidebar to the top to ensure the newly added word is shown
        setTimeout(() => {
          const scrollArea = document.querySelector(".notebook-scroll-area");
          if (scrollArea) {
            scrollArea.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 100);
      }

      try {
        await fetch(`${API_BASE_URL}/api/vocabulary`, {
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
    resumeAudioAfterTooltip();
  };

  const handleAddDirectly = async () => {
    if (!selectedText) return;
    setActivityLog(prev => [
      ...prev,
      {
        type: "translate",
        word_or_phrase: selectedText,
        timestamp: Date.now()
      }
    ]);
    const textToTranslate = selectedText;
    setMenuVisible(false);

    // Dodanie optymistyczne z komunikatem oczekiwania
    const tempEntry = { original: textToTranslate, translated: "Tłumaczenie..." };
    setNotebookWords(prev => {
      if (!prev.some(e => e.original === tempEntry.original)) {
        return [tempEntry, ...prev];
      }
      return prev;
    });

    // Auto-scroll the sidebar to the top to ensure the newly added word is shown
    setTimeout(() => {
      const scrollArea = document.querySelector(".notebook-scroll-area");
      if (scrollArea) {
        scrollArea.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: textToTranslate }),
      });
      const data = await response.json();
      if (data.translation) {
        setActivityLog(prev => [
          ...prev,
          {
            type: "add_to_notebook",
            word: textToTranslate,
            translation: data.translation,
            timestamp: Date.now()
          }
        ]);
        setNotebookWords(prev =>
          prev.map(item =>
            item.original === textToTranslate
              ? { ...item, translated: data.translation }
              : item
          )
        );

        // Zapisz słówko w bazie danych
        await fetch(`${API_BASE_URL}/api/vocabulary`, {
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

  const handleSpeakSelectedText = async () => {
    if (!selectedText) return;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setActivityLog(prev => [
      ...prev,
      {
        type: "listen_word_pronunciation",
        word: selectedText,
        timestamp: Date.now()
      }
    ]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectedText,
          voice: selectedVoiceURI || "en-US-BrianNeural"
        })
      });
      const data = await response.json();
      if (data.audio_base64) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const audio = new Audio(audioUrl);
        audio.playbackRate = speechRate;
        currentAudioRef.current = audio;
        audio.play();
      }
    } catch (err) {
      console.error("Error speaking selected text:", err);
    }
    setMenuVisible(false);
  };

  const handlePracticeSelectedText = () => {
    if (!selectedText) return;
    setPracticeTargetText(selectedText);
    setShowPracticeModal(true);
    setMenuVisible(false);
  };

  const handleLogPronunciationError = (word, targetSentence) => {
    setActivityLog(prev => [
      ...prev,
      {
        type: "pronunciation_error",
        word: word.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ""),
        sentence: targetSentence,
        timestamp: Date.now()
      }
    ]);
  };

  const handleDeleteWord = async (wordToDelete) => {
    setNotebookWords(prev => prev.filter(w => w.original !== wordToDelete));
    try {
      const url = `${API_BASE_URL}/api/vocabulary/${encodeURIComponent(wordToDelete)}` + 
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
      const response = await fetch(`${API_BASE_URL}/api/send-notebook-email`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ recipient_email: recipientEmail, notebook_words: notebookWords }),
      });
      if (response.ok) {
        alert("Email sent!");
        setShowSendEmailModal(false);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || "Wystąpił błąd podczas wysyłania e-maila.");
      }
    } catch (err) {
      console.error("Błąd email:", err);
      alert("Błąd połączenia z serwerem przy wysyłaniu e-maila.");
    }
  };

  const handleOpenSummary = async () => {
    if (activityLog.length === 0) {
      alert("Brak zarejestrowanej aktywności w tej sesji. Aby wygenerować podsumowanie, odsłuchaj nagranie lub skorzystaj ze słownika.");
      return;
    }
    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({
          activity_log: activityLog,
          notebook_words: notebookWords
        })
      });
      if (response.ok) {
        const data = await response.json();
        setSummaryData(data);
        setShowSummaryModal(true);
      } else {
        alert("Failed to generate session summary.");
      }
    } catch (err) {
      console.error("Error generating session summary:", err);
      alert("Failed to generate session summary.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSendSummaryEmail = async (email) => {
    if (!summaryData) return { success: false, error: "Brak danych podsumowania." };
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-summary-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({
          recipient_email: email,
          summary: summaryData
        })
      });
      if (response.ok) {
        return { success: true };
      } else {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.error || "Nie udało się wysłać e-maila." };
      }
    } catch (err) {
      console.error("Error sending summary email:", err);
      return { success: false, error: "Błąd połączenia z serwerem przy wysyłaniu e-maila." };
    }
  };

  const handleAddWordFromSummary = async (word, translation) => {
    setActivityLog(prev => [
      ...prev,
      {
        type: "add_to_notebook",
        word: word,
        translation: translation,
        timestamp: Date.now()
      }
    ]);

    const newEntry = { original: word, translated: translation };
    if (!notebookWords.some(e => e.original === newEntry.original)) {
      setNotebookWords(prev => [newEntry, ...prev]);

      setTimeout(() => {
        const scrollArea = document.querySelector(".notebook-scroll-area");
        if (scrollArea) {
          scrollArea.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 100);
    }

    try {
      await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ ...newEntry, story_id: currentStoryId })
      });
    } catch (err) {
      console.error("Błąd podczas zapisywania słówka z podsumowania:", err);
    }
  };

  return (
    <div className="workspace-layout">
      {generatedText && (
        <div 
          ref={floatingPlayerRef}
          className={`apple-player-controls-floating ${isDraggingPlayer ? 'dragging' : ''}`}
          style={{
            transform: `translate(calc(-50% + ${playerPosition.x}px), ${playerPosition.y}px)`,
            cursor: isDraggingPlayer ? 'grabbing' : 'grab'
          }}
          onMouseDown={handlePlayerMouseDown}
          onTouchStart={handlePlayerTouchStart}
        >
          <div className="drag-handle" title="Przeciągnij odtwarzacz">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
          <button 
            className={`player-btn play-pause-btn ${isSpeaking && !isPaused ? 'playing' : ''}`}
            onClick={handlePlayback}
            title={isSpeaking && !isPaused ? "Pauza (Skrót: P)" : "Odtwarzaj (Skrót: P)"}
          >
            {isSpeaking && !isPaused ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          <button 
            className="player-btn player-stop-btn"
            onClick={handleStop}
            disabled={!isSpeaking}
            title="Zatrzymaj"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        </div>
      )}

      {menuVisible && (
        <div ref={contextMenuRef} className="context-menu" style={{ top: menuPosition.top, left: menuPosition.left }}>
          <div className="context-menu-actions">
            <button className="ctx-translate-btn" onClick={handleTranslate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 8l6 6"/>
                <path d="M4 6h7M2 12h4"/>
                <path d="M12 4l-2 8"/>
                <rect x="12" y="12" width="10" height="8" rx="1"/>
                <path d="M15 16h4M17 14v4"/>
              </svg>
              Tłumacz
            </button>
            <button className="ctx-speak-btn" onClick={handleSpeakSelectedText}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              Czytaj
            </button>
            <button className="ctx-vocab-btn" onClick={handleAddDirectly}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                <line x1="12" y1="9" x2="12" y2="15"/>
                <line x1="9" y1="12" x2="15" y2="12"/>
              </svg>
              Słownik
            </button>
            <button className="ctx-practice-btn" onClick={handlePracticeSelectedText}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
              </svg>
              Przećwicz wymowę
            </button>
          </div>
        </div>
      )}

      {showTranslationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Translation</h3>
            <p><strong>{translationContent.original}</strong></p>
            <p>{translationContent.translated}</p>
            <button onClick={handleSaveToNotebook} className="btn-primary">Save to Notebook</button>
            <button onClick={() => {
              setShowTranslationModal(false);
              resumeAudioAfterTooltip();
            }} className="btn-secondary">Close</button>
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
          <div className="header-left-group">
            <button onClick={handleBackButtonClick} className="back-btn-inline" title={generatedText ? "Wróć do filtrów" : "Wróć do pulpitu"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1>{currentStoryTitle || "English Buddy Workspace"}</h1>
            
            {generatedText && (
              <div className="header-actions-group">
                <button 
                  onClick={() => {
                    handleStop();
                    setShowPracticeMode(true);
                  }} 
                  className="header-action-text-btn mastery-btn" 
                  title="Mastery Path Training — ćwicz słownictwo z tej historii"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8"/>
                  </svg>
                  <span>Mastery Path</span>
                </button>
                
                <button 
                  onClick={() => setShowVoiceControls(!showVoiceControls)} 
                  className={`header-action-btn voice-btn ${showVoiceControls ? 'active' : ''}`} 
                  title={showVoiceControls ? "Ukryj panel głosu" : "Pokaż panel głosu"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {storyParts.length > 0 && (
          <div className="chapter-tabs">
            {storyParts.map((part, index) => (
              <button
                key={part.id}
                className={`chapter-tab ${!isContinuing && activePartIndex === index ? "active" : ""}`}
                onClick={() => handleSelectPart(index)}
              >
                Part {part.part_number || index + 1}
              </button>
            ))}
            <button
              className={`chapter-tab continue-tab ${isContinuing ? "active" : ""}`}
              onClick={() => {
                handleStop();
                setIsContinuing(true);
              }}
            >
              + Continue Story
            </button>
          </div>
        )}

        {isContinuing ? (
          <div className="story-generator continuation-panel">
            {isLoading ? (
              <div className="generation-progress-overlay">
                <div className="gen-progress-card">
                  <div className="gen-progress-ring-wrapper">
                    <svg className="gen-progress-ring" viewBox="0 0 120 120">
                      <circle
                        className="gen-progress-ring-track"
                        cx="60" cy="60" r="50"
                        fill="none" strokeWidth="8"
                      />
                      <circle
                        className="gen-progress-ring-fill"
                        cx="60" cy="60" r="50"
                        fill="none" strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 50}`}
                        strokeDashoffset={`${2 * Math.PI * 50 * (1 - genProgress / 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="gen-progress-pct">{Math.round(genProgress)}%</div>
                  </div>
                  <div className="gen-progress-label">{genPhaseLabel}</div>
                  <div className="gen-progress-title">Tworzę kontynuację Twojej opowieści</div>
                  <div className="gen-progress-subtitle">To może potrwać do 30 sekund...</div>
                </div>
              </div>
            ) : (
              <>
                <div className="generator-header">
                  <h2>Continue Story</h2>
                  <p>Tell the AI what should happen next in Part {storyParts.length + 1} of this story.</p>
                </div>
                
                <div className="topic-grid">
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => {
                        setSelectedContinuationTopics(prev => 
                          prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
                        );
                      }}
                      className={`topic-chip ${selectedContinuationTopics.includes(topic) ? "selected" : ""}`}
                      disabled={isLoading}
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="details-composer">
                  <textarea
                    value={continuationDetails}
                    onChange={(e) => setContinuationDetails(e.target.value)}
                    placeholder="Describe what happens next (e.g. Alex meets a new friend, finds a key, goes to the forest...)"
                    rows="4"
                    disabled={isLoading}
                  />
                </div>

                <div className="continuation-actions">
                  <button
                    onClick={handleGenerateContinuation}
                    disabled={isLoading || (selectedContinuationTopics.length === 0 && !continuationDetails.trim())}
                    className="generate-story-btn"
                  >
                    {isLoading ? "Generating sequel..." : `Generate Part ${storyParts.length + 1}`}
                  </button>
                  <button
                    onClick={() => setIsContinuing(false)}
                    disabled={isLoading}
                    className="cancel-continuation-btn"
                    style={{ marginLeft: '12px', padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'var(--font-main)', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        ) : !generatedText ? (
          <StoryGenerator 
            onGenerate={generateStory} 
            onGenerateDefault={generateDefaultText}
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
            showVoiceControls={showVoiceControls}
            onWordClick={handleWordClick}
            activeWordId={activeWordId}
          />
        )}
      </main>

      <NotebookSidebar 
        notebookWords={notebookWords}
        onSpeakWord={async (text) => {
          setActivityLog(prev => [
            ...prev,
            {
              type: "listen_word_pronunciation",
              word: text,
              timestamp: Date.now()
            }
          ]);
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          try {
            const response = await fetch(`${API_BASE_URL}/api/tts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: text,
                voice: selectedVoiceURI || "en-US-BrianNeural"
              })
            });
            const data = await response.json();
            if (data.audio_base64) {
              const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
              const audio = new Audio(audioUrl);
              currentAudioRef.current = audio;
              audio.play();
            }
          } catch (err) {
            console.error("Error speaking word:", err);
          }
        }}
        onDeleteWord={handleDeleteWord}
        onOpenEmailModal={() => setShowSendEmailModal(true)}
        onOpenFlashcards={() => setShowFlashcards(true)}
        onExplainWord={(word) => {
          pauseAudioForTooltip();
          setExplanationWord(word);
        }}
        activityLog={activityLog}
        onOpenSummary={handleOpenSummary}
      />

      {showPracticeMode && (
        <PracticeMode 
          text={generatedText}
          voices={voices}
          selectedVoiceURI={selectedVoiceURI}
          user={user}
          onExit={() => setShowPracticeMode(false)}
          onLogActivity={(act) => setActivityLog(prev => [...prev, act])}
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

      {explanationWord && (
        <WordExplanationModal 
          wordOrPhrase={explanationWord}
          user={user}
          onClose={() => {
            setExplanationWord(null);
            resumeAudioAfterTooltip();
          }}
        />
      )}

      {showSummaryModal && (
        <SessionSummaryModal 
          summary={summaryData}
          user={user}
          onClose={() => setShowSummaryModal(false)}
          onSendEmail={handleSendSummaryEmail}
          onAddWord={handleAddWordFromSummary}
        />
      )}

      {showPracticeModal && (
        <PronunciationPracticeModal 
          targetText={practiceTargetText}
          user={user}
          onClose={() => {
            setShowPracticeModal(false);
            resumeAudioAfterTooltip();
          }}
          onLogActivity={(activity) => setActivityLog(prev => [...prev, activity])}
          onLogPronunciationError={handleLogPronunciationError}
        />
      )}

      {isGeneratingSummary && (
        <div className="practice-overlay">
          <div className="practice-loader glass-panel">
            <div className="spinner"></div>
            <p>Analyzing session activity...</p>
          </div>
        </div>
      )}
      {showWordTooltip && activeWordHighlight && (
        <div 
          className="word-translation-tooltip"
          style={{
            position: 'absolute',
            top: `${activeWordHighlight.rect.top - 10}px`,
            left: `${activeWordHighlight.rect.left + activeWordHighlight.rect.width / 2}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 10000
          }}
        >
          <div className="tooltip-content">
            {wordTooltipLoading ? (
              <div className="tooltip-loading-wrapper">
                <span className="tooltip-loading-spinner" />
              </div>
            ) : (
              <>
                <div className="tooltip-original">{activeWordHighlight.word}</div>
                <div className="tooltip-translation">{wordTooltipTranslation}</div>
                <div className="tooltip-actions">
                  <button className="tooltip-btn read-btn" onClick={() => handleSpeakWord(activeWordHighlight.word)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                    Czytaj
                  </button>
                  <button className="tooltip-btn vocab-btn" onClick={handleSaveWordFromTooltip}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      <line x1="12" y1="9" x2="12" y2="15"></line>
                      <line x1="9" y1="12" x2="15" y2="12"></line>
                    </svg>
                    Słownik
                  </button>
                  <button className="tooltip-btn close-btn" onClick={handleCloseWordTooltip}>
                    Zamknij
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Workspace;
