import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { API_BASE_URL } from '../config';
import "../App.css";
import "./Workspace.css";
import globalAudioManager from '../globalAudioManager';
import Flashcards from "./Flashcards";
import VocabularyExerciseModal from "./Vocabulary/VocabularyExerciseModal";
import StoryGenerator from "./Story/StoryGenerator";
import PracticeMode from "./Practice/PracticeMode";
import WordExplanationModal from "./Notebook/WordExplanationModal";
import SessionSummaryModal from "./Notebook/SessionSummaryModal";
import PronunciationPracticeModal from "./Notebook/PronunciationPracticeModal";
import { calculateCEFRLevel } from "./Story/SavedStories";

// Curated vocabulary metadata for rich inline word card details & key story words
const VOCABULARY_INFO = {
  adapt: {
    phonetic: "/əˈdæpt/",
    pos: "verb",
    level: "B2",
    pl: "dostosować się",
    enDef: "to change to suit a new situation"
  },
  supportive: {
    phonetic: "/səˈpɔːtɪv/",
    pos: "adjective",
    level: "B2",
    pl: "wspierający",
    enDef: "providing encouragement or emotional help"
  },
  clarify: {
    phonetic: "/ˈklærɪfaɪ/",
    pos: "verb",
    level: "B2",
    pl: "wyjaśnić",
    enDef: "to make something clear or easier to understand"
  },
  routine: {
    phonetic: "/ruːˈtiːn/",
    pos: "noun",
    level: "B1",
    pl: "rutyna",
    enDef: "a sequence of actions regularly followed"
  },
  confidence: {
    phonetic: "/ˈkɒnfɪdəns/",
    pos: "noun",
    level: "B2",
    pl: "pewność siebie",
    enDef: "the feeling of being sure of your ability"
  },
  curious: {
    phonetic: "/ˈkjʊəriəs/",
    pos: "adjective",
    level: "B1",
    pl: "ciekawy",
    enDef: "eager to know or learn something"
  },
  unfamiliar: {
    phonetic: "/ˌʌnfəˈmɪliə/",
    pos: "adjective",
    level: "B2",
    pl: "nieznany",
    enDef: "not known or recognized"
  },
  beginning: {
    phonetic: "/bɪˈɡɪnɪŋ/",
    pos: "noun",
    level: "A2",
    pl: "początek",
    enDef: "the start of something"
  },
  mistakes: {
    phonetic: "/mɪˈsteɪks/",
    pos: "noun",
    level: "A2",
    pl: "błędy",
    enDef: "actions or judgments that are misguided"
  },
  progress: {
    phonetic: "/ˈprəʊɡres/",
    pos: "noun",
    level: "B1",
    pl: "postęp",
    enDef: "movement forward toward a goal"
  },
  apologising: {
    phonetic: "/əˈpɒlədʒaɪzɪŋ/",
    pos: "verb",
    level: "B2",
    pl: "przepraszać",
    enDef: "expressing regret for something done"
  },
  studio: {
    phonetic: "/ˈstjuːdiəʊ/",
    pos: "noun",
    level: "B1",
    pl: "studio",
    enDef: "a room where a designer or artist works"
  },
  colleague: {
    phonetic: "/ˈkɒliːɡ/",
    pos: "noun",
    level: "B1",
    pl: "współpracownik",
    enDef: "a person with whom one works"
  }
};

const getWordMeta = (rawWord) => {
  const clean = (rawWord || "").toLowerCase().replace(/[^a-z]/g, "");
  if (VOCABULARY_INFO[clean]) {
    return VOCABULARY_INFO[clean];
  }
  let pos = "noun";
  if (clean.endsWith("ing") || clean.endsWith("ed") || clean.endsWith("ize") || clean.endsWith("ise") || clean.endsWith("ate")) {
    pos = "verb";
  } else if (clean.endsWith("ly")) {
    pos = "adverb";
  } else if (clean.endsWith("ive") || clean.endsWith("ous") || clean.endsWith("al") || clean.endsWith("able") || clean.endsWith("ful") || clean.endsWith("ish") || clean.endsWith("less")) {
    pos = "adjective";
  }
  return {
    phonetic: `/${clean}/`,
    pos: pos,
    level: clean.length > 8 ? "B2" : clean.length > 5 ? "B1" : "A2",
    pl: "",
    enDef: ""
  };
};

const FIGMA_SAMPLE_TITLE = "A new beginning";
const FIGMA_SAMPLE_TEXT = `On her first Monday at a small design studio, Maya arrived ten minutes early. She had a notebook, a fresh cup of coffee, and more questions than answers. Everything felt unfamiliar: the office, the people, and even the way they planned their day.

Maya knew she would need to adapt to a new routine. At her previous job, she worked alone most of the time. Here, everyone shared ideas around a large table each morning. At first, she worried that her English would slow the conversation down.

Her colleague Leo noticed that she was quiet. “You don't need the perfect words,” he said. “Tell us what you think. We can figure out the details together.” His supportive attitude helped Maya relax. She opened her notebook and explained a simple idea for the next project.

The team listened carefully. Someone asked a question, and Maya took a moment before answering. Instead of apologising for her English, she asked them to clarify one unfamiliar phrase. The conversation continued naturally, and her confidence began to grow.

By Friday, the office no longer felt like a place full of strangers. Maya knew where to find the best coffee and who to ask for help. She had also learned that progress did not mean speaking without mistakes. It meant being willing to try again.

That evening, she wrote one sentence in her notebook: “A new beginning is not about knowing everything. It is about being curious enough to learn.” Next week, she decided, she would speak up a little sooner.`;

const getTopicIcon = (topicName) => {
  const size = 16;
  const strokeWidth = 2.5;
  const style = { display: 'inline-block', verticalAlign: 'middle' };

  if (!topicName) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }

  const t = topicName.toLowerCase();

  if (t.includes("business")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  if (t.includes("discovery") || t.includes("future")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    );
  }
  if (t.includes("ai") || t.includes("tech") || t.includes("technology") || t.includes("robot")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4M8 15h.01M16 15h.01" />
      </svg>
    );
  }
  if (t.includes("nature") || t.includes("environment")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M2 22c1.25-6.75 6.75-12.25 13.5-13.5M22 2c-1.25 6.75-6.75 12.25-13.5 13.5M9 15c0-4.5 3.5-8 8-8M15 9c0 4.5-3.5 8-8 8" />
      </svg>
    );
  }
  if (t.includes("history") || t.includes("past")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M4 18h16M10 9v9M14 9v9M18 9v9M6 9v9M3 9h18M12 2L3 9h18z" />
      </svg>
    );
  }
  if (t.includes("science")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M6 3h12M12 3v14M9 12h6M5 21h14M8 12a4 4 0 0 0-4 4v5h16v-5a4 4 0 0 0-4-4" />
      </svg>
    );
  }
  if (t.includes("travel") || t.includes("adventure")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    );
  }
  if (t.includes("culture") || t.includes("art") || t.includes("music")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 6.00857 19 6.50857 18.5C7.00857 18 7.50857 17.5 8.50857 17.5C9.50857 17.5 9.50857 19 9.50857 20C9.50857 21 11.0086 22 12 22Z" />
        <circle cx="7.5" cy="10.5" r="1.5" />
        <circle cx="11.5" cy="7.5" r="1.5" />
        <circle cx="16.5" cy="9.5" r="1.5" />
      </svg>
    );
  }
  if (t.includes("health") || t.includes("sport")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
};

const GENERATION_PHASES = [
  { label: "Analizuję temat...", targetPct: 12, durationMs: 1800 },
  { label: "Tworzę strukturę lekcji...", targetPct: 28, durationMs: 2800 },
  { label: "Generuję treść...", targetPct: 55, durationMs: 6000 },
  { label: "Opracowuję tłumaczenia...", targetPct: 72, durationMs: 5000 },
  { label: "Finalizuję sekcje...", targetPct: 88, durationMs: 5000 },
  { label: "Prawie gotowe...", targetPct: 95, durationMs: 4000 },
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
  onNavigateToVocabulary,
  user,
  generatedText,
  setGeneratedText,
  currentStoryTitle,
  setCurrentStoryTitle,
  currentStoryId,
  setCurrentStoryId,
}) {
  const [dismissedStoryWords, setDismissedStoryWords] = useState(new Set());
  const [showPracticeMode, setShowPracticeMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const voices = PREMIUM_VOICES;
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('en-US-BrianNeural');
  const [speechRate, setSpeechRate] = useState(1.0);
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
  const [contextMenuTranslation, setContextMenuTranslation] = useState("");
  const [isContextMenuTranslating, setIsContextMenuTranslating] = useState(false);
  const [playSingle, setPlaySingle] = useState(false);
  const [showVoiceControls, setShowVoiceControls] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
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

  // Reading progress tracking (narrator sentence counting)
  const [readingProgress, setReadingProgress] = useState(0);
  const [readSentenceIndices, setReadSentenceIndices] = useState(new Set());
  const progressDebounceTimerRef = useRef(null);

  // States for word translation tooltip
  const [activeWordId, setActiveWordId] = useState(null);
  const [activeWordHighlight, setActiveWordHighlight] = useState(null);
  const [wordTooltipTranslation, setWordTooltipTranslation] = useState("");
  const [wordTooltipSentenceTranslation, setWordTooltipSentenceTranslation] = useState("");
  const [wordTooltipLoading, setWordTooltipLoading] = useState(false);
  const [showWordTooltip, setShowWordTooltip] = useState(false);

  // Figma Workspace redesign state
  const [fontSizeMode, setFontSizeMode] = useState("normal"); // "normal" | "large" | "xlarge"
  const [isStoryBookmarked, setIsStoryBookmarked] = useState(false);
  const [showFullTranslation, setShowFullTranslation] = useState(false);
  const [paragraphTranslations, setParagraphTranslations] = useState({});
  const [storyCopiedToast, setStoryCopiedToast] = useState(false);
  const [buddyQuestion, setBuddyQuestion] = useState("");
  const [buddyAnswer, setBuddyAnswer] = useState("");
  const [isBuddyLoading, setIsBuddyLoading] = useState(false);
  const [inlineWordData, setInlineWordData] = useState(null);
  const [showInlineSentenceTrans, setShowInlineSentenceTrans] = useState(false);

  const currentAudioRef = useRef(null);
  const contextMenuRef = useRef(null);
  const activeSelectionRangeRef = useRef(null);
  const activeSelectionTextRef = useRef(null);
  const activeTTSRequestIdRef = useRef(0);
  // Tracks whether story playback was active when a word tooltip was opened
  const wasPlayingBeforeTooltipRef = useRef(false);
  // Tracks the chunk index at pause-for-tooltip moment
  const pausedChunkIndexRef = useRef(-1);
  const speakChunkRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentChunkIndexRef = useRef(-1);
  // Mutex blokujący równoległe wywołania speakChunk
  const isChunkFetchingRef = useRef(false);

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

  useEffect(() => {
    return () => {
      activeTTSRequestIdRef.current++;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      loadVocabulary();
    };
    window.addEventListener("vocabulary-updated", handleUpdate);
    return () => {
      window.removeEventListener("vocabulary-updated", handleUpdate);
    };
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
            if (typeof activePart.read_progress === 'number') {
              setReadingProgress(activePart.read_progress);
            }
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

  const syncProgressDebounced = useCallback((storyId, progressVal) => {
    if (!storyId || !user) return;
    const clamped = Math.max(0, Math.min(100, Math.round(progressVal)));
    try {
      localStorage.setItem(`buddy_story_progress_${storyId}`, clamped);
    } catch (e) { }

    if (progressDebounceTimerRef.current) {
      clearTimeout(progressDebounceTimerRef.current);
    }
    progressDebounceTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user.token
          },
          body: JSON.stringify({ read_progress: clamped })
        });
      } catch (err) {
        console.error("Błąd zapisu postępu czytania:", err);
      }
    }, 1200);
  }, [user]);

  // Load initial progress and read sentences strictly on story / textChunks change
  useEffect(() => {
    if (!currentStoryId) {
      setReadingProgress(0);
      setReadSentenceIndices(new Set());
      return;
    }

    let initialSet = new Set();
    try {
      const saved = localStorage.getItem(`buddy_story_read_sentences_${currentStoryId}`);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          initialSet = new Set(arr);
        }
      }
    } catch (e) { }

    let initialProgress = 0;
    try {
      const cached = localStorage.getItem(`buddy_story_progress_${currentStoryId}`);
      if (cached !== null) {
        initialProgress = parseInt(cached, 10) || 0;
      }
    } catch (e) { }

    if (initialSet.size === 0 && initialProgress > 0 && textChunks && textChunks.length > 0) {
      const count = Math.min(textChunks.length, Math.round((initialProgress / 100) * textChunks.length));
      for (let i = 0; i < count; i++) {
        initialSet.add(i);
      }
    }

    setReadSentenceIndices(initialSet);

    const total = textChunks && textChunks.length > 0 ? textChunks.length : 0;
    const calculated = total > 0 ? Math.min(100, Math.round((initialSet.size / total) * 100)) : initialProgress;
    setReadingProgress(calculated);
  }, [currentStoryId, textChunks]);

  const markSentenceAsRead = useCallback((index) => {
    if (!currentStoryId || !textChunks || textChunks.length === 0) return;
    setReadSentenceIndices(prev => {
      const next = new Set(prev);
      next.add(index);

      const total = textChunks.length;
      const count = next.size;
      const calculated = Math.min(100, Math.round((count / total) * 100));

      setReadingProgress(calculated);
      try {
        localStorage.setItem(`buddy_story_read_sentences_${currentStoryId}`, JSON.stringify(Array.from(next)));
        localStorage.setItem(`buddy_story_progress_${currentStoryId}`, calculated);
      } catch (e) { }

      syncProgressDebounced(currentStoryId, calculated);
      return next;
    });
  }, [currentStoryId, textChunks, syncProgressDebounced]);

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
      if (!response.ok || (data && data.error)) {
        const errorMsg = data?.error || data?.details || "Wystąpił błąd podczas generowania kontynuacji opowiadania.";
        alert(errorMsg);
        return;
      }
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
      alert("Nie udało się wygenerować kontynuacji. Sprawdź połączenie z internetem lub spróbuj ponownie za chwilę.");
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

  useEffect(() => {
    if (menuVisible && selectedText) {
      const fetchTranslation = async () => {
        setContextMenuTranslation("");
        setIsContextMenuTranslating(true);
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
            setContextMenuTranslation(data.translation);
          } else {
            setContextMenuTranslation("Brak tłumaczenia");
          }
        } catch (err) {
          console.error("Błąd tłumaczenia w menu kontekstowym:", err);
          setContextMenuTranslation("Błąd połączenia");
        } finally {
          setIsContextMenuTranslating(false);
        }
      };
      fetchTranslation();
    }
  }, [menuVisible, selectedText, user.token]);

  const pauseAudioForTooltip = useCallback(() => {
    const audio = currentAudioRef.current;
    if ((audio && !audio.paused) || (isSpeakingRef.current && !isPausedRef.current) || (isSpeakingRef.current && currentChunkIndexRef.current >= 0)) {
      wasPlayingBeforeTooltipRef.current = true;
      if (pausedChunkIndexRef.current < 0) {
        pausedChunkIndexRef.current = currentChunkIndexRef.current >= 0 ? currentChunkIndexRef.current : 0;
      }
      if (audio) {
        audio.pause();
      }
      setIsPaused(true);
      isPausedRef.current = true;
    }
  }, []);

  const resumeAudioAfterTooltip = useCallback(() => {
    if (wasPlayingBeforeTooltipRef.current) {
      const chunkToReplay = pausedChunkIndexRef.current >= 0 ? pausedChunkIndexRef.current : currentChunkIndexRef.current;
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
        }, 50);
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
        setWordTooltipSentenceTranslation(data.sentence_translation || "");
      } else {
        setWordTooltipTranslation("Brak tłumaczenia");
        setWordTooltipSentenceTranslation("");
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
      if (!response.ok || (data && data.error)) {
        const errorMsg = data?.error || data?.details || "Wystąpił błąd podczas generowania opowiadania.";
        alert(errorMsg);
        return;
      }
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
      alert("Nie udało się wygenerować opowiadania. Sprawdź połączenie z internetem lub spróbuj ponownie za chwilę.");
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
          "X-Session-Token": user?.token || ""
        },
      });
      const data = await response.json();
      if (data && data[0] && data[0].generated_text) {
        setGeneratedText(data[0].generated_text);
        const title = data[0].title || "Default Lesson";
        setCurrentStoryTitle(title);
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
      } else {
        setGeneratedText(FIGMA_SAMPLE_TEXT);
        setCurrentStoryTitle(FIGMA_SAMPLE_TITLE);
      }
    } catch (error) {
      console.warn("Błąd generowania domyślnej lekcji, fallback do czytanki wzorcowej:", error);
      setGeneratedText(FIGMA_SAMPLE_TEXT);
      setCurrentStoryTitle(FIGMA_SAMPLE_TITLE);
    } finally {
      setIsLoading(false);
    }
  };

  const pasteStory = async (pastedText, customTitle = "") => {
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
      const title = customTitle.trim() || "Imported Practice Text";
      setGeneratedText(pastedText);
      setCurrentStoryTitle(title);
      // Automatycznie zapisz wklejony tekst w bazie danych na serwerze (identycznie jak AI)
      const savedStory = await saveStoryToDb(title, pastedText);
      if (savedStory && savedStory.id) {
        const newPart = {
          id: savedStory.id,
          title: title,
          text: pastedText,
          part_number: 1
        };
        setStoryParts([newPart]);
        setActivePartIndex(0);
        setLoadedRootId(savedStory.id);
        setCurrentStoryId(savedStory.id);
      }
    } catch (error) {
      console.error("Błąd podczas zapisywania wklejonego tekstu:", error);
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
    // Zajmij globalny slot — anuluje poprzednie odtwarzanie z dowolnego źródła
    const requestId = globalAudioManager.acquire();
    activeTTSRequestIdRef.current = requestId;

    if (index >= textChunks.length) {
      isChunkFetchingRef.current = false;
      handleStop();
      setReadingProgress(100);
      syncProgressDebounced(currentStoryId, 100);
      return;
    }

    currentAudioRef.current = null;
    setCurrentChunkIndex(index);
    currentChunkIndexRef.current = index;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    setPlaySingle(single);

    // Zlicz zdanie czytane przez lektora
    markSentenceAsRead(index);

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

      if (!globalAudioManager.isValid(requestId)) {
        return;
      }

      if (!response.ok) throw new Error("Failed to generate audio");
      const data = await response.json();
      if (!data.audio_base64) throw new Error("No audio data returned");

      if (!globalAudioManager.isValid(requestId) || wasPlayingBeforeTooltipRef.current || isPausedRef.current) {
        return;
      }

      const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = speechRate;

      audio.onended = () => {
        if (!globalAudioManager.isValid(requestId)) return;
        globalAudioManager.release(requestId);
        markSentenceAsRead(index);

        if (index === textChunks.length - 1) {
          // Lektor ukończył ostatnie zdanie tekstu -> 100%
          setReadingProgress(100);
          syncProgressDebounced(currentStoryId, 100);
          try {
            localStorage.setItem(`buddy_story_progress_${currentStoryId}`, 100);
          } catch (e) { }
        }

        if (single) {
          handleStop();
        } else {
          speakChunk(index + 1, false);
        }
      };

      audio.onerror = () => {
        if (!globalAudioManager.isValid(requestId)) return;
        globalAudioManager.release(requestId);
        handleStop();
      };

      if (!globalAudioManager.setAudio(requestId, audio)) {
        return;
      }
      currentAudioRef.current = audio;

      try {
        await audio.play();
      } catch (playErr) {
        if (playErr.name !== 'AbortError') {
          console.warn("Chunk play error:", playErr);
        }
        currentAudioRef.current = null;
      }
    } catch (err) {
      if (globalAudioManager.isValid(requestId)) {
        console.error("Error generating/playing speech:", err);
        globalAudioManager.release(requestId);
        handleStop();
      }
    }
  };
  speakChunkRef.current = speakChunk;

  const handlePlayback = () => {
    if (!generatedText || textChunks.length === 0) return;
    if (currentAudioRef.current) {
      if (isPausedRef.current || currentAudioRef.current.paused) {
        currentAudioRef.current.play().catch(() => { });
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
    // Zatrzymuje WSZYSTKIE aktywne audio w całej aplikacji
    globalAudioManager.stopAll();
    isChunkFetchingRef.current = false; // resetuj mutex
    activeTTSRequestIdRef.current = globalAudioManager.currentRequestId;
    currentAudioRef.current = null;
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;
    setCurrentChunkIndex(-1);
    currentChunkIndexRef.current = -1;
    setPlaySingle(false);
    wasPlayingBeforeTooltipRef.current = false;
    pausedChunkIndexRef.current = -1;
  };

  const handlePlaySentence = (index, single = false) => {
    if (isSpeaking && currentChunkIndex === index && playSingle === single) {
      handlePlayback();
    } else {
      handleStop();
      speakChunk(index, single);
    }
  };

  const handleTextSelection = (e) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange();

      const isTouch = e && (e.type === 'touchend' || (e.nativeEvent && e.nativeEvent.type === 'touchend'));
      const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || ('ontouchstart' in window);

      const wordCount = text.split(/\s+/).length;

      if (!isTouch && !isMobileDevice && wordCount > 1) {
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setMenuPosition({
          top: rect.top + window.scrollY - 10,
          left: rect.left + window.scrollX + rect.width / 2,
        });
        setMenuVisible(true);
        activeSelectionRangeRef.current = null;
        activeSelectionTextRef.current = null;
      } else {
        activeSelectionRangeRef.current = range;
        activeSelectionTextRef.current = text;

        if (isTouch || isMobileDevice) {
          setTimeout(() => {
            const currentSel = window.getSelection();
            if (currentSel && currentSel.toString().trim() === text) {
              triggerSelectionTranslation(text, range);
              activeSelectionRangeRef.current = null;
              activeSelectionTextRef.current = null;
            }
          }, 150);
        }
      }
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
    setWordTooltipSentenceTranslation("");
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
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
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
        setWordTooltipSentenceTranslation(data.sentence_translation || "");
      } else {
        setWordTooltipTranslation("Brak tłumaczenia");
        setWordTooltipSentenceTranslation("");
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
    // Zajmij globalny slot — zatrzymuje również czytanie historii
    const requestId = globalAudioManager.acquire();
    isChunkFetchingRef.current = false; // przerywa również speakChunk
    currentAudioRef.current = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: word,
          voice: selectedVoiceURI || "en-US-BrianNeural"
        })
      });
      if (!globalAudioManager.isValid(requestId)) return;
      if (!response.ok) throw new Error("Failed to generate audio");
      const data = await response.json();
      if (data.audio_base64 && globalAudioManager.isValid(requestId)) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const wordAudio = new Audio(audioUrl);
        wordAudio.onended = () => globalAudioManager.release(requestId);
        if (!globalAudioManager.setAudio(requestId, wordAudio)) return;
        currentAudioRef.current = wordAudio;
        wordAudio.play().catch(() => { });
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
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
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
    const preTranslated = contextMenuTranslation;
    setMenuVisible(false);

    if (preTranslated && preTranslated !== "Brak tłumaczenia" && preTranslated !== "Błąd połączenia") {
      const newEntry = { original: textToTranslate, translated: preTranslated };
      setNotebookWords(prev => {
        if (!prev.some(e => e.original === newEntry.original)) {
          return [newEntry, ...prev];
        }
        return prev;
      });
      setTimeout(() => {
        const scrollArea = document.querySelector(".notebook-scroll-area");
        if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
      try {
        await fetch(`${API_BASE_URL}/api/vocabulary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user.token
          },
          body: JSON.stringify({ original: textToTranslate, translated: preTranslated, story_id: currentStoryId })
        });
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      } catch (err) {
        console.error("Błąd zapisywania frazy:", err);
      }
      return;
    }

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
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
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
    const requestId = globalAudioManager.acquire();
    activeTTSRequestIdRef.current = requestId;
    isChunkFetchingRef.current = false;
    currentAudioRef.current = null;

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
      if (!globalAudioManager.isValid(requestId)) return;
      const data = await response.json();
      if (data.audio_base64 && globalAudioManager.isValid(requestId)) {
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        const audio = new Audio(audioUrl);
        audio.playbackRate = speechRate;
        audio.onended = () => globalAudioManager.release(requestId);
        if (!globalAudioManager.setAudio(requestId, audio)) return;
        currentAudioRef.current = audio;
        audio.play().catch(() => { });
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
      window.dispatchEvent(new CustomEvent("vocabulary-updated"));
    } catch (err) {
      console.error("Błąd usuwania słówka z bazy:", err);
    }
  };

  // Usunięto handleDeleteStory, ponieważ historia jest teraz zarządzana w dedykowanej zakładce.

  // ─── Figma Workspace Redesign Helpers & State Selectors ───
  const isWordInNotebook = useCallback((word) => {
    if (!word) return false;
    const clean = word.toLowerCase().trim();
    return notebookWords.some(w => {
      const orig = (w.original || w.word || "").toLowerCase().trim();
      return orig === clean;
    });
  }, [notebookWords]);

  const handleToggleWordSaved = useCallback(async (wordItem) => {
    const rawWord = typeof wordItem === 'string' ? wordItem : (wordItem.word || wordItem.original);
    const rawTranslation = typeof wordItem === 'string' ? "" : (wordItem.translation || wordItem.translated || "");
    const clean = (rawWord || "").trim();
    if (!clean) return;

    if (isWordInNotebook(clean)) {
      handleDeleteWord(clean);
    } else {
      const meta = getWordMeta(clean);
      const newEntry = {
        original: clean,
        translated: rawTranslation || meta.pl || "zapisane słówko",
        created_at: new Date().toISOString(),
        story_id: currentStoryId || undefined
      };
      setNotebookWords(prev => [newEntry, ...prev.filter(w => (w.original || w.word) !== clean)]);
      try {
        await fetch(`${API_BASE_URL}/api/vocabulary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || ""
          },
          body: JSON.stringify(newEntry)
        });
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      } catch (err) {
        console.error("Error saving word:", err);
      }
    }
  }, [isWordInNotebook, notebookWords, currentStoryId, user, handleDeleteWord]);

  const handleFigmaWordClick = async (rawWord, pIdx, paragraphText) => {
    const cleanWord = rawWord.replace(/[^a-zA-Z'-]/g, "");
    if (!cleanWord) return;

    if (inlineWordData && inlineWordData.word.toLowerCase() === cleanWord.toLowerCase() && inlineWordData.paragraphIndex === pIdx) {
      setInlineWordData(null);
      setShowInlineSentenceTrans(false);
      resumeAudioAfterTooltip();
      return;
    }

    pauseAudioForTooltip();

    const meta = getWordMeta(cleanWord);
    const sentences = paragraphText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const sentenceContext = sentences.find(s => s.toLowerCase().includes(cleanWord.toLowerCase())) || paragraphText;

    const initialData = {
      word: cleanWord,
      phonetic: meta.phonetic || `/${cleanWord.toLowerCase()}/`,
      pos: meta.pos || "word",
      level: meta.level || "B2",
      pl: meta.pl || "Wczytuję...",
      enDef: meta.enDef || "",
      sentence: sentenceContext,
      sentenceTranslation: "",
      paragraphIndex: pIdx
    };
    setInlineWordData(initialData);
    setShowInlineSentenceTrans(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ text: cleanWord, context: sentenceContext })
      });
      const data = await response.json();
      setInlineWordData(prev => {
        if (!prev || prev.word.toLowerCase() !== cleanWord.toLowerCase()) return prev;
        return {
          ...prev,
          pl: data.translation || meta.pl || "Brak tłumaczenia",
          sentenceTranslation: data.sentence_translation || ""
        };
      });
    } catch (err) {
      console.error("Error translating word:", err);
      setInlineWordData(prev => {
        if (!prev || prev.word.toLowerCase() !== cleanWord.toLowerCase()) return prev;
        return {
          ...prev,
          pl: meta.pl || "Błąd połączenia"
        };
      });
    }
  };

  const handleAskBuddy = async (queryText) => {
    const q = (queryText || buddyQuestion || "").trim();
    if (!q) return;
    setIsBuddyLoading(true);
    setBuddyAnswer("");
    try {
      const formData = new FormData();
      formData.append("story_text", generatedText || "");
      formData.append("transcription", q);
      formData.append("history", JSON.stringify([]));

      const response = await fetch(`${API_BASE_URL}/api/stories/chat-next`, {
        method: "POST",
        headers: {
          "X-Session-Token": user?.token || ""
        },
        body: formData
      });
      const data = await response.json();
      if (data.bot_response) {
        setBuddyAnswer(data.bot_response);
      } else {
        setBuddyAnswer("Nie udało się uzyskać odpowiedzi od asystenta AI.");
      }
    } catch (err) {
      console.error("Error asking buddy:", err);
      setBuddyAnswer("Błąd połączenia z asystentem AI.");
    } finally {
      setIsBuddyLoading(false);
    }
  };

  const handleToggleFullTranslation = async () => {
    const next = !showFullTranslation;
    setShowFullTranslation(next);
    if (next && Object.keys(paragraphTranslations).length === 0 && generatedText) {
      const paras = generatedText.split(/\n+/).map(p => p.trim()).filter(Boolean);
      const newMap = {};
      for (let i = 0; i < paras.length; i++) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/translate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Token": user?.token || ""
            },
            body: JSON.stringify({ text: paras[i] })
          });
          const d = await res.json();
          if (d.translation) {
            newMap[i] = d.translation;
          }
        } catch (e) {
          console.error("Error translating paragraph:", e);
        }
      }
      setParagraphTranslations(newMap);
    }
  };

  const cycleFontSize = () => {
    setFontSizeMode(prev => prev === "normal" ? "large" : prev === "large" ? "xlarge" : "normal");
  };

  const handleCopyStoryText = () => {
    if (!generatedText) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(generatedText).then(() => {
        setStoryCopiedToast(true);
        setTimeout(() => setStoryCopiedToast(false), 2200);
      }).catch(() => { });
    }
  };

  // Auto-init inline card on 'adapt' when Maya's story is loaded
  useEffect(() => {
    if (generatedText && generatedText.includes("Maya knew she would need to adapt")) {
      const meta = VOCABULARY_INFO.adapt;
      setInlineWordData({
        word: "adapt",
        phonetic: meta.phonetic,
        pos: meta.pos,
        level: meta.level,
        pl: meta.pl,
        enDef: meta.enDef,
        sentenceTranslation: "Maya wiedziała, że będzie musiała dostosować się do nowej rutyny.",
        paragraphIndex: 1
      });
    }
  }, [generatedText]);

  const paragraphs = useMemo(() => {
    if (!generatedText) return [];
    const raw = generatedText.split(/\n+/).map(p => p.trim()).filter(Boolean);
    if (raw.length <= 1 && raw[0] && raw[0].length > 400) {
      const sents = raw[0].split(/(?<=[.!?])\s+/);
      const grouped = [];
      for (let i = 0; i < sents.length; i += 3) {
        grouped.push(sents.slice(i, i + 3).join(" "));
      }
      return grouped;
    }
    return raw;
  }, [generatedText]);

  // Map each paragraph to its constituent sentence chunks with exact textChunks indices
  const paragraphSentences = useMemo(() => {
    if (!paragraphs || paragraphs.length === 0) return [];
    if (!textChunks || textChunks.length === 0) {
      return paragraphs.map(p => [{ chunkIndex: -1, text: p }]);
    }

    let chunkCursor = 0;
    return paragraphs.map((pText) => {
      const list = [];
      let remaining = pText;

      while (remaining && chunkCursor < textChunks.length) {
        const nextChunk = textChunks[chunkCursor];
        const trimmedChunk = nextChunk.trim();
        const foundIdx = remaining.indexOf(trimmedChunk);

        if (foundIdx !== -1) {
          if (foundIdx > 0) {
            const before = remaining.substring(0, foundIdx).trim();
            if (before) {
              list.push({ chunkIndex: -1, text: before });
            }
          }
          list.push({
            chunkIndex: chunkCursor,
            text: trimmedChunk
          });
          remaining = remaining.substring(foundIdx + trimmedChunk.length).trim();
          chunkCursor++;
        } else {
          break;
        }
      }

      if (remaining && remaining.trim()) {
        list.push({ chunkIndex: -1, text: remaining.trim() });
      }

      return list;
    });
  }, [paragraphs, textChunks]);

  // Auto-scroll currently read sentence into view
  useEffect(() => {
    if (currentChunkIndex !== -1 && isSpeaking && !isPaused) {
      const activeEl = document.querySelector(".story-sentence.reading-now");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentChunkIndex, isSpeaking, isPaused]);

  const storyLevel = useMemo(() => {
    if (!generatedText) return "B2";
    return calculateCEFRLevel(generatedText, currentStoryTitle) || "B2";
  }, [generatedText, currentStoryTitle]);

  const storyCategory = useMemo(() => {
    const combined = `${currentStoryTitle || ""} ${generatedText || ""}`.toLowerCase();
    if (combined.includes("office") || combined.includes("business") || combined.includes("job") || combined.includes("routine") || combined.includes("colleague")) {
      return "Business";
    }
    if (combined.includes("travel") || combined.includes("trip") || combined.includes("journey") || combined.includes("city")) {
      return "Travel";
    }
    if (combined.includes("tech") || combined.includes("ai") || combined.includes("software") || combined.includes("code")) {
      return "Technology";
    }
    if (combined.includes("health") || combined.includes("doctor") || combined.includes("fitness")) {
      return "Health";
    }
    return "General";
  }, [currentStoryTitle, generatedText]);

  const wordCount = useMemo(() => {
    if (!generatedText) return 0;
    return generatedText.trim().split(/\s+/).filter(Boolean).length;
  }, [generatedText]);

  const readingTime = useMemo(() => {
    return Math.max(1, Math.ceil(wordCount / 130));
  }, [wordCount]);

  const computedReadingProgress = useMemo(() => {
    if (textChunks.length === 0) return readingProgress || 65;
    if (currentChunkIndex >= 0) {
      return Math.min(100, Math.round(((currentChunkIndex + 1) / textChunks.length) * 100));
    }
    return readingProgress || 65;
  }, [currentChunkIndex, textChunks, readingProgress]);

  const handleDeleteStoryWord = async (word) => {
    if (!word) return;
    setDismissedStoryWords(prev => {
      const next = new Set(prev);
      next.add(word.toLowerCase());
      return next;
    });
    await handleDeleteWord(word);
  };

  const keyStoryWords = useMemo(() => {
    if (!generatedText) return [];
    const textLower = generatedText.toLowerCase();
    const matched = [];
    const targetWords = ["adapt", "supportive", "clarify", "routine", "confidence", "curious", "unfamiliar", "progress", "beginning"];

    for (const w of targetWords) {
      if (dismissedStoryWords.has(w.toLowerCase())) continue;
      const regex = new RegExp(`\\b${w}\\b`, "i");
      if (regex.test(textLower)) {
        const info = VOCABULARY_INFO[w] || getWordMeta(w);
        matched.push({
          word: w,
          translation: info.pl || "",
          pos: info.pos || "word",
          level: info.level || "B2"
        });
      }
    }

    for (const nw of notebookWords) {
      const w = (nw.original || nw.word || "").toLowerCase();
      if (dismissedStoryWords.has(w)) continue;
      if (w && textLower.includes(w) && !matched.some(m => m.word.toLowerCase() === w)) {
        const info = getWordMeta(w);
        matched.push({
          word: nw.original || nw.word,
          translation: nw.translated || nw.translation || info.pl || "",
          pos: info.pos || "word",
          level: info.level || "B2"
        });
      }
    }

    if (matched.length === 0) {
      const fallbackList = [
        { word: "adapt", translation: "dostosować się", pos: "verb", level: "B2" },
        { word: "supportive", translation: "wspierający", pos: "adjective", level: "B2" },
        { word: "clarify", translation: "wyjaśnić", pos: "verb", level: "B2" }
      ];
      for (const item of fallbackList) {
        if (!dismissedStoryWords.has(item.word.toLowerCase())) {
          matched.push(item);
        }
      }
    }
    return matched.slice(0, 5);
  }, [generatedText, notebookWords, dismissedStoryWords]);

  const effectivePracticeWords = useMemo(() => {
    if (notebookWords && notebookWords.length > 0) {
      return notebookWords;
    }
    if (keyStoryWords && keyStoryWords.length > 0) {
      return keyStoryWords.map(w => ({
        original: w.word,
        translated: w.translation
      }));
    }
    return [];
  }, [notebookWords, keyStoryWords]);

  const handleOpenFlashcards = () => {
    if (effectivePracticeWords.length === 0) {
      alert("No vocabulary to practice yet. Click words in the story to add them!");
      return;
    }
    handleStop();
    setShowFlashcards(true);
  };

  const handleOpenExercises = () => {
    if (effectivePracticeWords.length === 0) {
      alert("No vocabulary to practice yet. Click words in the story to add them!");
      return;
    }
    handleStop();
    setShowExerciseModal(true);
  };

  const handleOpenEmail = () => {
    if (effectivePracticeWords.length === 0) {
      alert("Your vocabulary notebook is empty. Click words in the story to add them first!");
      return;
    }
    setShowSendEmailModal(true);
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
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
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOpenSummary = async () => {
    if (activityLog.length === 0) {
      alert("No activity recorded yet. Listen to narration or explore vocabulary to generate a summary.");
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
      window.dispatchEvent(new CustomEvent("vocabulary-updated"));
    } catch (err) {
      console.error("Błąd podczas zapisywania słówka z podsumowania:", err);
    }
  };

  const renderParagraphTokens = (pText, pIdx) => {
    const sents = (paragraphSentences && paragraphSentences[pIdx]) ? paragraphSentences[pIdx] : [{ chunkIndex: -1, text: pText }];
    return sents.map((sentence, sIdx) => {
      const isCurrentReading = (isSpeaking || isPaused || wasPlayingBeforeTooltipRef.current) && currentChunkIndex >= 0 && sentence.chunkIndex === currentChunkIndex;
      const tokens = sentence.text.split(/([\w\u00C0-\u017F'-]+)/g);

      return (
        <React.Fragment key={sentence.chunkIndex >= 0 ? `chunk-${sentence.chunkIndex}` : `p-${pIdx}-s-${sIdx}`}>
          <span
            className={`story-sentence ${isCurrentReading ? "reading-now" : ""}`}
            data-chunk-index={sentence.chunkIndex}
          >
            {tokens.map((token, tIdx) => {
              const isWord = /[\w\u00C0-\u017F'-]+/.test(token);
              if (!isWord) {
                return <span key={tIdx}>{token}</span>;
              }
              const cleanWord = token.toLowerCase();
              const isSelected = inlineWordData && inlineWordData.word.toLowerCase() === cleanWord && inlineWordData.paragraphIndex === pIdx;

              return (
                <span
                  key={tIdx}
                  className={`reader-word ${isSelected ? "selected-pill" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFigmaWordClick(token, pIdx, sentence.text);
                  }}
                >
                  {token}
                </span>
              );
            })}
          </span>
          {sIdx < sents.length - 1 ? " " : ""}
        </React.Fragment>
      );
    });
  };

  const renderInlineCard = () => {
    if (!inlineWordData) return null;
    const isSaved = isWordInNotebook(inlineWordData.word);

    return (
      <div className="workspace-inline-word-card">
        <div className="inline-word-header">
          <div className="inline-word-title-group">
            <span className="inline-word-title">{inlineWordData.word}</span>
            <span className="inline-word-phonetic">{inlineWordData.phonetic}</span>
            <span className="inline-word-pos">· {inlineWordData.pos}</span>
          </div>
          <div className="inline-word-header-actions">
            <button
              className="inline-word-speaker-btn"
              onClick={() => handleSpeakWord(inlineWordData.word)}
              title="Odsłuchaj wymowę słowa"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </button>
            <button
              className="inline-word-close-btn"
              onClick={() => {
                setInlineWordData(null);
                setShowInlineSentenceTrans(false);
                resumeAudioAfterTooltip();
              }}
              title="Zamknij podgląd i kontynuuj czytanie"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="inline-word-def">
          <span className="inline-word-pl">{inlineWordData.pl}</span>
          {inlineWordData.enDef && (
            <span className="inline-word-en"> — {inlineWordData.enDef}</span>
          )}
        </div>

        <div className="inline-word-actions">
          <button
            className={`inline-save-btn ${isSaved ? "saved" : ""}`}
            onClick={() => handleToggleWordSaved({
              word: inlineWordData.word,
              translation: inlineWordData.pl,
              pos: inlineWordData.pos,
              level: inlineWordData.level
            })}
          >
            {isSaved ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Saved</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Save word</span>
              </>
            )}
          </button>

          <button
            className="inline-trans-sentence-btn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-instant-translator', {
                detail: {
                  sentence: inlineWordData.sentence || "Maya knew she would need to adapt to a new routine.",
                  sentenceTranslation: inlineWordData.sentenceTranslation,
                  phrase: inlineWordData.word ? `${inlineWordData.word} to a new routine` : "adapt to a new routine",
                  word: inlineWordData.word,
                  wordTranslation: inlineWordData.pl
                }
              }));
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
            </svg>
            <span>Translate sentence</span>
          </button>
        </div>
      </div>
    );
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
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
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
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        </div>
      )}

      {menuVisible && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            transform: 'translate(-50%, -100%)'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="context-menu-translation-box" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: "4px", fontSize: "0.95rem", fontWeight: "500", color: "var(--slate-800)", whiteSpace: "pre-line", minHeight: "40px", display: "flex", alignItems: "center" }}>
            {isContextMenuTranslating ? (
              <span className="tooltip-loading-spinner" style={{ width: 16, height: 16, display: "inline-block" }} />
            ) : (
              <span>{contextMenuTranslation}</span>
            )}
          </div>
          <div className="context-menu-actions">
            <button className="ctx-speak-btn" onClick={handleSpeakSelectedText}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Czytaj
            </button>
            <button className="ctx-vocab-btn" onClick={handleAddDirectly}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="12" y1="9" x2="12" y2="15" />
                <line x1="9" y1="12" x2="15" y2="12" />
              </svg>
              Słownik
            </button>
            <button className="ctx-practice-btn" onClick={handlePracticeSelectedText}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
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
            <div className="modal-actions">
              <button onClick={handleSaveToNotebook} className="btn-primary">Save to Notebook</button>
              <button onClick={() => {
                setShowTranslationModal(false);
                resumeAudioAfterTooltip();
              }} className="btn-secondary">Close</button>
            </div>
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
              disabled={isSendingEmail}
            />
            <div className="modal-actions">
              <button
                onClick={handleSendEmail}
                className="btn-primary"
                disabled={isSendingEmail || !recipientEmail}
              >
                {isSendingEmail ? (
                  <>
                    <span className="spinner-inline"></span>
                    Sending...
                  </>
                ) : "Send Now"}
              </button>
              <button
                onClick={() => setShowSendEmailModal(false)}
                className="btn-secondary"
                disabled={isSendingEmail}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!generatedText ? (
        <main className="workspace-main">
          <StoryGenerator
            onGenerate={generateStory}
            onGenerateDefault={generateDefaultText}
            onPasteText={pasteStory}
            isLoading={isLoading}
            suggestedTopics={suggestedTopics}
            user={user}
          />
        </main>
      ) : isContinuing ? (
        <main className="workspace-main">
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
                  {suggestedTopics.map((topic) => {
                    const isSelected = selectedContinuationTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        onClick={() => {
                          setSelectedContinuationTopics(prev =>
                            prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
                          );
                        }}
                        className={`topic-chip ${isSelected ? "selected" : ""}`}
                        disabled={isLoading}
                      >
                        <span className="topic-chip-icon">{getTopicIcon(topic)}</span>
                        <span className="topic-chip-text">{topic}</span>
                        {isSelected && <span className="topic-chip-check">✓</span>}
                      </button>
                    );
                  })}
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
                    disabled={isLoading}
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
        </main>
      ) : (
        <div className="workspace-figma-container">
          <div className="workspace-figma-top-bar">
            <button
              onClick={handleBackButtonClick}
              className="workspace-back-pill-btn"
              title="Wróć do wyboru tematów / utwórz nową historię"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Nowa opowieść</span>
            </button>

            {storyParts.length > 0 && (
              <div className="chapter-tabs" style={{ margin: 0 }}>
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
          </div>

          <div className="workspace-figma-grid">
            {/* LEFT COLUMN: Story Reading Card */}
            <article className="story-reading-card">
              <div className="story-card-top-row">
                <div className="story-card-badges">
                  <span className="story-badge-level">
                    {storyLevel}
                  </span>
                  <span className="story-badge-category">
                    {storyCategory}
                  </span>
                </div>
                <div className="story-top-actions">
                  <button
                    className={`story-bookmark-btn ${isStoryBookmarked ? "active" : ""}`}
                    onClick={() => setIsStoryBookmarked(!isStoryBookmarked)}
                    title={isStoryBookmarked ? "Zapisana w ulubionych" : "Zapisz w ulubionych"}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={isStoryBookmarked ? "#2563eb" : "none"} stroke={isStoryBookmarked ? "#2563eb" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <h1 className="story-reading-title">
                {currentStoryTitle || "A new beginning"}
              </h1>

              <p className="story-reading-meta">
                {wordCount} words · {readingTime} min read · Created today
              </p>

              {/* Reading toolbar */}
              <div className="story-reading-toolbar">
                <button
                  className={`toolbar-pill-btn ${isSpeaking && !isPaused ? "active" : ""}`}
                  onClick={handlePlayback}
                >
                  {isSpeaking && !isPaused ? (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                      <span>Listen</span>
                    </>
                  )}
                </button>

                <button
                  className="toolbar-pill-btn"
                  onClick={() => {
                    const activeSentence = (textChunks && textChunks[currentChunkIndex]) || (generatedText ? generatedText.split(/[.!?]+/)[0] + "." : "") || "Maya knew she would need to adapt to a new routine.";
                    window.dispatchEvent(new CustomEvent('open-instant-translator', {
                      detail: {
                        sentence: activeSentence.trim(),
                        phrase: inlineWordData ? inlineWordData.word : "adapt to a new routine",
                        word: inlineWordData ? inlineWordData.word : "adapt",
                        wordTranslation: inlineWordData ? inlineWordData.pl : "dostosować się"
                      }
                    }));
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
                  </svg>
                  <span>Translate</span>
                </button>

                <button
                  className="toolbar-icon-btn"
                  onClick={cycleFontSize}
                  title={`Zmień rozmiar czcionki (obecnie: ${fontSizeMode})`}
                >
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>T</span>
                </button>

                <button
                  className="toolbar-icon-btn"
                  onClick={handleCopyStoryText}
                  title="Skopiuj treść opowiadania"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>

                <span className="toolbar-hint-text">
                  Click any word to explore it.
                </span>
              </div>

              <div className="story-divider" />

              {/* Paragraphs */}
              <div className={`story-body-content font-size-${fontSizeMode}`}>
                {paragraphs.map((pText, pIdx) => {
                  const isInlineInThisParagraph = inlineWordData && inlineWordData.paragraphIndex === pIdx;
                  return (
                    <React.Fragment key={pIdx}>
                      <p className="story-paragraph">
                        {renderParagraphTokens(pText, pIdx)}
                      </p>
                      {showFullTranslation && paragraphTranslations[pIdx] && (
                        <div className="story-paragraph-translation">
                          {paragraphTranslations[pIdx]}
                        </div>
                      )}
                      {isInlineInThisParagraph && renderInlineCard()}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="story-divider" />

              {/* Reading Progress */}
              <div className="story-reading-progress-section">
                <div className="progress-labels-row">
                  <span className="progress-label-main">
                    Reading progress · {computedReadingProgress}%
                  </span>
                  <span className="progress-label-sub">
                    Continue where you left off
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, computedReadingProgress))}%` }}
                  />
                </div>
              </div>
            </article>

            {/* RIGHT COLUMN: 3 Figma Cards */}
            <aside className="workspace-figma-sidebar">
              {/* Card 1: Words in this story (top & always visible) */}
              <div className="story-words-card">
                <div className="story-words-header">
                  <h3>Words in this story</h3>
                  <span className="story-words-count-badge">
                    {keyStoryWords.length}
                  </span>
                </div>

                <div className="story-words-list">
                  {keyStoryWords.map((item, idx) => {
                    return (
                      <div key={item.word || idx} className="story-word-item">
                        <div className="story-word-item-top">
                          <span
                            className="story-word-name"
                            onClick={() => handleSpeakWord(item.word)}
                            title="Kliknij, aby posłuchać wymowy"
                          >
                            {item.word}
                          </span>
                          <div className="story-word-item-actions">
                            <button
                              className="story-word-speaker-btn"
                              onClick={() => handleSpeakWord(item.word)}
                              title="Posłuchaj wymowy"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                              </svg>
                            </button>
                            <button
                              className="story-word-delete-btn"
                              onClick={() => handleDeleteStoryWord(item.word)}
                              title="Usuń słowo ze słownika"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="story-word-item-sub">
                          <span>{item.translation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="open-vocabulary-btn"
                  onClick={() => {
                    if (onNavigateToVocabulary) {
                      onNavigateToVocabulary();
                    } else if (onNavigateToDashboard) {
                      onNavigateToDashboard();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  <span>Open vocabulary</span>
                </button>
              </div>

              {/* Card 2: Your learning buddy */}
              <div className="learning-buddy-card">
                <div className="buddy-card-header">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="buddy-sparkle-icon">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <h3>Your learning buddy</h3>
                </div>
                <p className="buddy-card-desc">
                  Make this story your own. Practice with Mastery Path or train your vocabulary.
                </p>

                <button
                  className="buddy-voice-ai-btn"
                  onClick={() => {
                    handleStop();
                    setShowPracticeMode(true);
                  }}
                  title="Mastery Path — 3 steps to master this story"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                  <span>Mastery Path · 3 steps</span>
                </button>

                <div className="buddy-practice-section">
                  <span className="practice-section-label">PRACTICE TOOLS</span>
                  <div className="buddy-practice-chips">
                    <button
                      className="buddy-practice-chip"
                      onClick={handleOpenFlashcards}
                      title="Practice vocabulary with flashcards"
                    >
                      Flashcards
                    </button>
                    <button
                      className="buddy-practice-chip"
                      onClick={handleOpenExercises}
                      title="AI vocabulary translation quiz"
                    >
                      Vocabulary quiz
                    </button>
                    <button
                      className="buddy-practice-chip"
                      onClick={handleOpenSummary}
                      title="Generate AI session summary"
                    >
                      Session summary
                    </button>
                    <button
                      className="buddy-practice-chip"
                      onClick={handleOpenEmail}
                      title="Export vocabulary to your email"
                    >
                      Export to email
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 3: Small steps count */}
              <div className="small-steps-card">
                <div className="small-steps-header">
                  <span className="small-steps-bulb">💡</span>
                  <h3>Small steps count</h3>
                </div>
                <p className="small-steps-text">
                  Read a sentence aloud, then say it in your own words. Retrieval makes learning stick.
                </p>
              </div>
            </aside>
          </div>

          {/* Floating Chat Live Button */}
          <button
            className="chat-live-floating-btn"
            onClick={() => {
              handleStop();
              setShowPracticeMode(true);
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M8 8v8M4 11v2M16 6v12M20 10v4" />
            </svg>
            <span>Chat Live</span>
          </button>

          {storyCopiedToast && (
            <div className="story-copied-toast">
              Skopiowano treść opowiadania do schowka!
            </div>
          )}
        </div>
      )}

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
            notebookWords={effectivePracticeWords}
            onFinishExercises={() => setShowFlashcards(false)}
          />
        </div>
      )}

      {showExerciseModal && (
        <VocabularyExerciseModal
          notebookWords={effectivePracticeWords}
          user={user}
          onClose={() => setShowExerciseModal(false)}
        />
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
                {wordTooltipSentenceTranslation && (
                  <div className="tooltip-sentence-translation">
                    {wordTooltipSentenceTranslation}
                  </div>
                )}
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
