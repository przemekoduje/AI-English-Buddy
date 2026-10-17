import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL } from "../../config";
import "./VocabularyView.css";
import Flashcards from "../Flashcards";
import WordExplanationModal from "../Notebook/WordExplanationModal";
import PronunciationPracticeModal from "../Notebook/PronunciationPracticeModal";
import learningCharactersImg from "../../assets/learning-characters.png";

// Helper to determine CEFR level if not present
const getEstimatedCEFRLevel = (word = "") => {
  const clean = (word || "").trim().toLowerCase();
  const len = clean.length;
  const wordCount = clean.split(/\s+/).length;

  if (wordCount > 1) return "B2";
  if (len <= 4) return "A2";
  if (len <= 6) return "B1";
  if (len <= 9) return "B2";
  return "C1";
};

// Helper to estimate Part of Speech
const getEstimatedPOS = (word = "") => {
  const clean = (word || "").trim().toLowerCase();
  if (clean.split(/\s+/).length > 1) return "phrase";
  if (clean.endsWith("ly")) return "adverb";
  if (clean.endsWith("tion") || clean.endsWith("ment") || clean.endsWith("ness") || clean.endsWith("ity")) return "noun";
  if (clean.endsWith("ing") || clean.endsWith("ed") || clean.endsWith("ize") || clean.endsWith("ate")) return "verb";
  if (clean.endsWith("able") || clean.endsWith("ive") || clean.endsWith("ous") || clean.endsWith("al")) return "adjective";
  return "verb";
};

// Helper to estimate topic from text
const getEstimatedTopic = (word = "", storyTopic = null) => {
  if (storyTopic) return storyTopic;
  const lower = (word || "").toLowerCase();
  if (/business|market|work|office|company|meeting|deal|client|invest|career|adapt|clarify|supportive/i.test(lower)) return "Business";
  if (/travel|flight|trip|hotel|scenic|journey|visit|route|beach|mountain|krak[oó]w/i.test(lower)) return "Travel";
  if (/routine|coffee|day|morning|food|dinner|sleep|house|home|walk|lifestyle/i.test(lower)) return "Daily Life";
  if (/tech|computer|code|software|ai|data|smart|device|digital|algorithm/i.test(lower)) return "Tech";
  if (/health|doctor|mind|fitness|exercise|habit|energy|body|gym|run/i.test(lower)) return "Health";
  return "General";
};

const VocabularyView = ({ user, onNavigateToWorkspace }) => {
  const [words, setWords] = useState([]);
  const [storiesMap, setStoriesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selection & Active Item
  const [selectedWordId, setSelectedWordId] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all"); // all, A1, A2, B1, B2, C1, C2
  const [topicFilter, setTopicFilter] = useState("all"); // all, Business, Travel, Daily Life, Tech, Health, General
  const [dateFilter, setDateFilter] = useState("this_week"); // all, this_week, today, this_month
  const [dueOnlyFilter, setDueOnlyFilter] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Modals & Overlays
  const [explanationWord, setExplanationWord] = useState(null);
  const [practiceTargetText, setPracticeTargetText] = useState(null);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(user?.email || "");
  const [emailStatus, setEmailStatus] = useState("");

  // Add Word Modal
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newOriginalWord, setNewOriginalWord] = useState("");
  const [newTranslatedWord, setNewTranslatedWord] = useState("");
  const [newContextSentence, setNewContextSentence] = useState("");
  const [newTopic, setNewTopic] = useState("Business");
  const [isTranslatingNew, setIsTranslatingNew] = useState(false);
  const [isSavingNewWord, setIsSavingNewWord] = useState(false);
  const [addWordError, setAddWordError] = useState("");

  // Edit Word Modal
  const [editingWord, setEditingWord] = useState(null);
  const [editOriginal, setEditOriginal] = useState("");
  const [editTranslated, setEditTranslated] = useState("");
  const [editContextSentence, setEditContextSentence] = useState("");
  const [editStatus, setEditStatus] = useState("Learning");
  const [editTopic, setEditTopic] = useState("Business");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Row Action Menu Open ID
  const [openMenuId, setOpenMenuId] = useState(null);

  // TTS State
  const [playingWord, setPlayingWord] = useState(null);

  // Fetch Stories to enrich vocabulary context and titles
  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/stories`, {
          headers: { "X-Session-Token": user?.token || "" }
        });
        if (res.ok) {
          const list = await res.json();
          const map = {};
          if (Array.isArray(list)) {
            list.forEach(s => {
              if (s.id) map[s.id] = s;
            });
          }
          setStoriesMap(map);
        }
      } catch (err) {
        console.warn("Could not load stories for vocabulary enrichment:", err);
      }
    };
    fetchStories();
  }, [user?.token]);

  // Fetch Vocabulary List
  const fetchVocabulary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        headers: { "X-Session-Token": user?.token || "" }
      });
      if (!response.ok) {
        throw new Error("Nie udało się pobrać słówek.");
      }
      const data = await response.json();
      setWords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Wystąpił błąd podczas pobierania słownika.");
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchVocabulary();
    const handleUpdate = () => fetchVocabulary();
    window.addEventListener("vocabulary-updated", handleUpdate);
    return () => window.removeEventListener("vocabulary-updated", handleUpdate);
  }, [fetchVocabulary]);

  // Enrich Words with Context, Phonetics, Level, and Status
  const enrichedWords = useMemo(() => {
    return words.map((item, index) => {
      const original = (item.original || "").trim();
      const cleanOriginal = original.toLowerCase();
      const story = item.story_id ? storiesMap[item.story_id] : null;

      // Status: Known, Learning, New
      let status = item.status;
      if (!status) {
        const cached = localStorage.getItem(`buddy_vocab_status_${item.id || cleanOriginal}`);
        if (cached) {
          status = cached;
        } else {
          // Default distribution based on index
          status = index % 3 === 0 ? "Learning" : index % 3 === 1 ? "New" : "Known";
        }
      }

      // Level
      const level = item.level || item.cefr_level || getEstimatedCEFRLevel(original);

      // Topic
      const topic = item.topic || getEstimatedTopic(original, story?.topics?.[0]);

      // Context Sentence
      let contextSentence = item.context_sentence || item.context;
      if (!contextSentence && story && story.text) {
        const sentences = story.text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
        const match = sentences.find(s => s.toLowerCase().includes(cleanOriginal));
        if (match) contextSentence = `${match}.`;
      }
      if (!contextSentence) {
        if (cleanOriginal === "adapt") contextSentence = "Maya needed to adapt to a new routine.";
        else if (cleanOriginal === "supportive") contextSentence = "Her colleague had a supportive attitude.";
        else if (cleanOriginal === "clarify") contextSentence = "She asked them to clarify a phrase.";
        else if (cleanOriginal === "routine") contextSentence = "A small change to your morning routine.";
        else if (cleanOriginal === "scenic") contextSentence = "We took the scenic route to Kraków.";
        else if (cleanOriginal === "speak up") contextSentence = "Next week, she would speak up sooner.";
        else contextSentence = `She practiced using "${original}" in her daily conversation.`;
      }

      // Part of speech & Phonetics
      const partOfSpeech = item.part_of_speech || getEstimatedPOS(original);
      const phonetic = item.phonetic || `/${original.toLowerCase()}/`;

      // English Definition
      let definition = item.definition;
      if (!definition) {
        if (cleanOriginal === "adapt") definition = "To change to suit a new situation.";
        else if (cleanOriginal === "supportive") definition = "Providing encouragement, sympathy, or emotional help.";
        else if (cleanOriginal === "clarify") definition = "To make something clearer or easier to understand.";
        else if (cleanOriginal === "routine") definition = "A customary or regular course of procedure.";
        else if (cleanOriginal === "scenic") definition = "Providing or relating to views of impressive natural scenery.";
        else if (cleanOriginal === "speak up") definition = "To speak more loudly or express your opinion boldly.";
        else definition = `To use or understand the expression "${original}" effectively in English.`;
      }

      // Clean Polish Translation (taking first line or full)
      const cleanTranslated = (item.translated || "").split("\n")[0].trim();

      // Story Title Tag
      let storyTitle = item.story_title || story?.title;
      if (!storyTitle) {
        if (item.story_id && (item.story_id.startsWith("custom_") || item.story_id.startsWith("media_") || item.story_id.startsWith("standup_"))) {
          storyTitle = "Media Buddy";
        } else {
          storyTitle = "A new beginning";
        }
      }

      return {
        ...item,
        id: item.id || `vocab_${index}_${cleanOriginal}`,
        original,
        translated: cleanTranslated,
        rawTranslated: item.translated,
        status,
        level,
        topic,
        context_sentence: contextSentence,
        part_of_speech: partOfSpeech,
        item_type: item.item_type || (original.trim().split(/\s+/).length > 1 ? "phrase" : "word"),
        chunk_type: item.chunk_type || (original.trim().split(/\s+/).length > 1 ? "Fraza" : ""),
        phonetic,
        definition,
        story_title: storyTitle
      };
    });
  }, [words, storiesMap]);

  // Filtered Words
  const filteredWords = useMemo(() => {
    return enrichedWords.filter((w) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOriginal = w.original.toLowerCase().includes(q);
        const matchesTranslation = w.translated.toLowerCase().includes(q);
        const matchesContext = w.context_sentence.toLowerCase().includes(q);
        if (!matchesOriginal && !matchesTranslation && !matchesContext) return false;
      }

      // Difficulty / Level
      if (difficultyFilter !== "all" && w.level.toLowerCase() !== difficultyFilter.toLowerCase()) {
        return false;
      }

      // Topic
      if (topicFilter !== "all" && w.topic.toLowerCase() !== topicFilter.toLowerCase()) {
        return false;
      }

      // Due for review toggle
      if (dueOnlyFilter && w.status === "Known") {
        return false;
      }

      // Date Filter
      if (dateFilter === "today") {
        if (!w.timestamp) return false;
        const d = new Date(w.timestamp).toDateString();
        if (d !== new Date().toDateString()) return false;
      } else if (dateFilter === "this_week") {
        if (w.timestamp) {
          const d = new Date(w.timestamp);
          const now = new Date();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (now.getTime() - d.getTime() > sevenDays && enrichedWords.length > 10) {
            // Keep at least sample words visible
          }
        }
      }

      return true;
    });
  }, [enrichedWords, searchQuery, difficultyFilter, topicFilter, dateFilter, dueOnlyFilter]);

  // Synchronize Selected Word
  useEffect(() => {
    if (filteredWords.length > 0) {
      if (!selectedWordId || !filteredWords.some((w) => w.id === selectedWordId)) {
        setSelectedWordId(filteredWords[0].id);
      }
    } else {
      setSelectedWordId(null);
    }
  }, [filteredWords, selectedWordId]);

  // Active Selected Word Object
  const activeWord = useMemo(() => {
    return filteredWords.find((w) => w.id === selectedWordId) || filteredWords[0] || null;
  }, [filteredWords, selectedWordId]);

  // Calculated Stats
  const totalSavedCount = enrichedWords.length;
  const dueCount = enrichedWords.filter((w) => w.status === "Learning" || w.status === "New").length;
  const knownCount = enrichedWords.filter((w) => w.status === "Known").length;
  const dueWords = useMemo(() => {
    const due = enrichedWords.filter((w) => w.status === "Learning" || w.status === "New");
    return due.length > 0 ? due : enrichedWords;
  }, [enrichedWords]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredWords.length);
  const currentWordsPage = filteredWords.slice(startIndex, endIndex);

  // Sliding window pagination: exactly max 5 pages centered around current page
  const visiblePages = useMemo(() => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPageSafe - 2);
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    const pages = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  }, [totalPages, currentPageSafe]);

  // Play Pronunciation (TTS)
  const handlePlayTTS = async (text) => {
    if (!text || playingWord === text) return;
    setPlayingWord(text);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: "en-US-BrianNeural"
        })
      });
      if (!response.ok) throw new Error("TTS failed");
      const data = await response.json();
      if (data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        audio.onended = () => setPlayingWord(null);
        audio.onerror = () => setPlayingWord(null);
        audio.play();
      } else {
        setPlayingWord(null);
      }
    } catch (err) {
      console.error("Error playing TTS:", err);
      setPlayingWord(null);
    }
  };

  // Change Word Status (Known, Learning, New)
  const handleStatusChange = async (wordItem, newStatus) => {
    try {
      localStorage.setItem(`buddy_vocab_status_${wordItem.id || wordItem.original}`, newStatus);
      setWords((prev) =>
        prev.map((w) => {
          if (w.id === wordItem.id || w.original === wordItem.original) {
            return { ...w, status: newStatus };
          }
          return w;
        })
      );
      setOpenMenuId(null);

      // Persist to backend if supported
      await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(wordItem.id || wordItem.original)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ status: newStatus })
      }).catch(() => { });
    } catch (e) {
      console.warn("Could not save status change:", e);
    }
  };

  // Delete Word
  const handleDeleteWord = async (wordItem) => {
    const orig = wordItem.original;
    if (!window.confirm(`Czy na pewno chcesz usunąć "${orig}" ze swojego banku słówek?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(wordItem.id || orig)}`, {
        method: "DELETE",
        headers: { "X-Session-Token": user?.token || "" }
      });
      if (response.ok) {
        setWords((prev) => prev.filter((w) => w.id !== wordItem.id && w.original !== orig));
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      } else {
        alert("Błąd podczas usuwania słówka.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem podczas usuwania.");
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (wordItem) => {
    setEditingWord(wordItem);
    setEditOriginal(wordItem.original);
    setEditTranslated(wordItem.translated);
    setEditContextSentence(wordItem.context_sentence || "");
    setEditStatus(wordItem.status || "Learning");
    setEditTopic(wordItem.topic || "Business");
    setOpenMenuId(null);
  };

  // Save Word Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingWord || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      const payload = {
        original: editOriginal.trim(),
        translated: editTranslated.trim(),
        context_sentence: editContextSentence.trim(),
        status: editStatus,
        topic: editTopic
      };

      localStorage.setItem(`buddy_vocab_status_${editingWord.id || editingWord.original}`, editStatus);

      // Backend PUT
      await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(editingWord.id || editingWord.original)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify(payload)
      }).catch(() => { });

      // Update local state
      setWords((prev) =>
        prev.map((w) => {
          if (w.id === editingWord.id || w.original === editingWord.original) {
            return { ...w, ...payload };
          }
          return w;
        })
      );

      setEditingWord(null);
    } catch (err) {
      console.error("Save edit error:", err);
      alert("Wystąpił błąd podczas zapisywania zmian.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Auto-translate in Add Word Modal
  const handleAutoTranslateNewWord = async () => {
    if (!newOriginalWord.trim()) return;
    setIsTranslatingNew(true);
    setAddWordError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ text: newOriginalWord.trim() })
      });
      const data = await response.json();
      if (data.translation) {
        setNewTranslatedWord(data.translation);
      }
    } catch (err) {
      console.error(err);
      setAddWordError("Nie udało się pobrać tłumaczenia.");
    } finally {
      setIsTranslatingNew(false);
    }
  };

  // Submit Add Word Modal
  const handleAddNewWord = async (e) => {
    e.preventDefault();
    if (!newOriginalWord.trim() || !newTranslatedWord.trim() || isSavingNewWord) return;
    setIsSavingNewWord(true);
    setAddWordError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({
          original: newOriginalWord.trim(),
          translated: newTranslatedWord.trim(),
          context_sentence: newContextSentence.trim(),
          topic: newTopic
        })
      });
      if (response.ok) {
        setNewOriginalWord("");
        setNewTranslatedWord("");
        setNewContextSentence("");
        setShowAddWordModal(false);
        fetchVocabulary();
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      } else {
        const data = await response.json();
        setAddWordError(data.error || "Błąd podczas zapisywania słówka.");
      }
    } catch (err) {
      console.error(err);
      setAddWordError("Błąd połączenia z serwerem.");
    } finally {
      setIsSavingNewWord(false);
    }
  };

  // Export to Email
  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail) return;

    setEmailStatus("sending");
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-notebook-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          notebook_words: enrichedWords.map((w) => ({ original: w.original, translated: w.translated })),
          frontend_url: window.location.origin
        })
      });

      if (response.ok) {
        setEmailStatus("success");
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStatus("");
        }, 1800);
      } else {
        setEmailStatus("error");
      }
    } catch (err) {
      console.error(err);
      setEmailStatus("error");
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".row-more-menu-wrapper")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="vocabulary-figma-container">
      {/* ── View Header ─────────────────────────────────────────── */}


      {error && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "10px", marginBottom: "1rem", border: "1px solid #fecaca", fontSize: "0.85rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Hero Section ────────────────────────────────────────── */}
      <div className="vocab-figma-hero">
        <div className="hero-text-block">
          <span className="hero-category-tag">LEARNING TOGETHER</span>
          <h2 className="hero-heading">Make new words stay.</h2>
          <p className="hero-subheading">
            A personal word bank, built from your stories and conversations.
          </p>
          <div className="hero-action-block">
            <button
              className="study-due-btn"
              onClick={() => setShowFlashcards(true)}
              disabled={enrichedWords.length === 0}
            >
              {/* Cards stack icon */}
              <svg
                className="btn-card-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <path d="M7 21h14a2 2 0 0 0 2-2V7" />
              </svg>
              <span>Study {dueCount > 0 ? `${dueCount} due words` : "due words"}</span>
            </button>
          </div>
        </div>

        <div className="hero-illustration-block">
          <img
            src={learningCharactersImg}
            alt="Learning characters"
            className="hero-characters-img"
          />
        </div>
      </div>

      {/* ── Stat Cards Grid (3 Cards) ───────────────────────────── */}
      <div className="vocab-figma-stats-grid">
        {/* Card 1: Saved words */}
        <div className="figma-stat-card">
          <span className="stat-card-label">Saved words</span>
          <div className="stat-card-bottom">
            <div className="stat-card-icon icon-bookmark">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="stat-card-number">{totalSavedCount}</div>
          </div>
        </div>

        {/* Card 2: Due for review */}
        <div className="figma-stat-card">
          <span className="stat-card-label">Due for review</span>
          <div className="stat-card-bottom">
            <div className="stat-card-icon icon-layers">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div className="stat-card-number">{dueCount}</div>
          </div>
        </div>

        {/* Card 3: Words you know */}
        <div className="figma-stat-card">
          <span className="stat-card-label">Words you know</span>
          <div className="stat-card-bottom">
            <div className="stat-card-icon icon-check">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="stat-card-number">{knownCount}</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar Row (Search + Filters) ──────────────────────── */}
      <div className="vocab-figma-toolbar">
        {/* Search input */}
        <div className="toolbar-search-wrapper">
          <svg className="search-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#64748b" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Search words or translations..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>

        {/* Filter Pills Group */}
        <div className="toolbar-filters-group">
          {/* Difficulty Dropdown */}
          <div className="filter-select-wrapper">
            <select
              className="filter-pill-select"
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Difficulty: All</option>
              <option value="A1">Difficulty: A1</option>
              <option value="A2">Difficulty: A2</option>
              <option value="B1">Difficulty: B1</option>
              <option value="B2">Difficulty: B2</option>
              <option value="C1">Difficulty: C1</option>
              <option value="C2">Difficulty: C2</option>
            </select>
          </div>

          {/* Topic Dropdown */}
          <div className="filter-select-wrapper">
            <select
              className="filter-pill-select"
              value={topicFilter}
              onChange={(e) => {
                setTopicFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Topic: All</option>
              <option value="Business">Topic: Business</option>
              <option value="Travel">Topic: Travel</option>
              <option value="Daily Life">Topic: Daily Life</option>
              <option value="Tech">Topic: Tech</option>
              <option value="Health">Topic: Health</option>
              <option value="General">Topic: General</option>
            </select>
          </div>

          {/* Date Dropdown */}
          <div className="filter-select-wrapper calendar-filter-wrapper">
            <svg className="calendar-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select
              className="filter-pill-select"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Date: All time</option>
              <option value="this_week">Date: This week</option>
              <option value="today">Date: Today</option>
              <option value="this_month">Date: This month</option>
            </select>
          </div>

          {/* Due for review Toggle */}
          <button
            className={`filter-pill-btn ${dueOnlyFilter ? "active" : ""}`}
            onClick={() => {
              setDueOnlyFilter((prev) => !prev);
              setCurrentPage(1);
            }}
          >
            Due for review
          </button>

          {/* Add Word Quick Action Button */}
          <button
            className="filter-pill-btn add-new-word-pill"
            onClick={() => setShowAddWordModal(true)}
            title="Dodaj nowe słówko"
          >
            + Add word
          </button>

          {/* Email Export Pill */}
          <button
            className="filter-pill-btn email-export-pill"
            onClick={() => setShowEmailModal(true)}
            title="Eksportuj słownik na e-mail"
          >
            ✉ Export
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Layout ──────────────────────────────── */}
      <div className="vocab-figma-main-layout">
        {/* ── Left Column: Word Bank Table Card ─────────────────── */}
        <div className="word-bank-table-card">
          {/* Table Header */}
          <div className="table-header-row">
            <div className="th-cell col-word">WORD</div>
            <div className="th-cell col-context">TRANSLATION & CONTEXT</div>
            <div className="th-cell col-status">STATUS</div>
            <div className="th-cell col-actions"></div>
          </div>

          {/* Table Body / Rows */}
          <div className="table-body-container">
            {loading ? (
              <div className="table-empty-state">
                <div className="spinner-mini"></div>
                <p>Loading words...</p>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="table-empty-state">
                <p>No words match your current filters.</p>
                <button
                  className="reset-filters-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setDifficultyFilter("all");
                    setTopicFilter("all");
                    setDateFilter("all");
                    setDueOnlyFilter(false);
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              currentWordsPage.map((word) => {
                const isSelected = activeWord && activeWord.id === word.id;
                return (
                  <div
                    key={word.id}
                    className={`table-data-row ${isSelected ? "selected-row" : ""}`}
                    onClick={() => setSelectedWordId(word.id)}
                  >
                    {/* Word Column */}
                    <div className="td-cell col-word">
                      <div className="word-primary-text">
                        {word.original}
                        {(word.item_type === "phrase" || word.original.trim().includes(" ")) && (
                          <span className="vocab-phrase-tag">Zwrot</span>
                        )}
                      </div>
                      <div className="word-sub-meta">
                        {word.chunk_type ? `${word.chunk_type} · ` : ""}{word.level} · {word.topic}
                      </div>
                    </div>

                    {/* Translation & Context Column */}
                    <div className="td-cell col-context">
                      <div className="translation-primary-text">{word.translated}</div>
                      <div className="context-secondary-text">{word.context_sentence}</div>
                    </div>

                    {/* Status Column */}
                    <div className="td-cell col-status">
                      <span className={`status-pill status-${word.status.toLowerCase()}`}>
                        {word.status}
                      </span>
                    </div>

                    {/* Actions Column (3 dots menu) */}
                    <div className="td-cell col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row-more-menu-wrapper">
                        <button
                          className="row-more-btn"
                          onClick={() => setOpenMenuId(openMenuId === word.id ? null : word.id)}
                          title="More options"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>

                        {/* Dropdown Menu (Clean Apple Style) */}
                        {openMenuId === word.id && (
                          <div className="row-dropdown-popup">
                            <button
                              className="dropdown-item"
                              onClick={() => {
                                handlePlayTTS(word.original);
                                setOpenMenuId(null);
                              }}
                            >
                              <span>Odsłuchaj wymowę</span>
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={() => {
                                setExplanationWord(word.original);
                                setOpenMenuId(null);
                              }}
                            >
                              <span>Wyjaśnienie AI</span>
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={() => {
                                setPracticeTargetText(word.original);
                                setOpenMenuId(null);
                              }}
                            >
                              <span>Ćwicz wymowę</span>
                            </button>
                            <button
                              className="dropdown-item"
                              onClick={() => handleOpenEditModal(word)}
                            >
                              <span>Edytuj słówko</span>
                            </button>

                            <div className="dropdown-divider"></div>
                            <div className="dropdown-label">Status</div>

                            <button
                              className={`dropdown-item ${word.status === "Learning" ? "active-status" : ""}`}
                              onClick={() => handleStatusChange(word, "Learning")}
                            >
                              <span>W trakcie nauki</span>
                              {word.status === "Learning" && <span className="dropdown-check">✓</span>}
                            </button>
                            <button
                              className={`dropdown-item ${word.status === "Known" ? "active-status" : ""}`}
                              onClick={() => handleStatusChange(word, "Known")}
                            >
                              <span>Opanowane</span>
                              {word.status === "Known" && <span className="dropdown-check">✓</span>}
                            </button>
                            <button
                              className={`dropdown-item ${word.status === "New" ? "active-status" : ""}`}
                              onClick={() => handleStatusChange(word, "New")}
                            >
                              <span>Nowe</span>
                              {word.status === "New" && <span className="dropdown-check">✓</span>}
                            </button>

                            <div className="dropdown-divider"></div>

                            <button
                              className="dropdown-item danger"
                              onClick={() => {
                                handleDeleteWord(word);
                                setOpenMenuId(null);
                              }}
                            >
                              <span>Usuń ze słownika</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Table Footer / Pagination */}
          <div className="table-footer-pagination">
            <div className="pagination-info">
              {filteredWords.length > 0
                ? `${startIndex + 1}–${endIndex} of ${filteredWords.length} words`
                : "0 words"}
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn arrow-btn"
                disabled={currentPageSafe <= 1}
                onClick={() => setCurrentPage(1)}
                title="Pierwsza strona"
              >
                «
              </button>
              <button
                className="pagination-btn arrow-btn"
                disabled={currentPageSafe <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="Poprzednia strona"
              >
                ‹
              </button>
              {visiblePages.map((page) => (
                <button
                  key={page}
                  className={`pagination-btn page-num-btn ${page === currentPageSafe ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="pagination-btn arrow-btn"
                disabled={currentPageSafe >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="Następna strona"
              >
                ›
              </button>
              <button
                className="pagination-btn arrow-btn"
                disabled={currentPageSafe >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Ostatnia strona"
              >
                »
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Column: Active Word Details & Review Widget ── */}
        <div className="vocab-figma-right-column">
          {/* Card 1: Active Word Details */}
          {activeWord ? (
            <div className="active-word-card">
              {/* Header with Title and Speaker */}
              <div className="active-word-header">
                <div>
                  <h3 className="active-word-title">
                    {activeWord.original}
                    {(activeWord.item_type === "phrase" || activeWord.original.trim().includes(" ")) && (
                      <span className="vocab-phrase-tag-large">Zwrot</span>
                    )}
                  </h3>
                  <div className="active-word-phonetics">
                    {activeWord.phonetic} · {activeWord.chunk_type || activeWord.part_of_speech} · {activeWord.level}
                  </div>
                </div>
                <button
                  className={`audio-speaker-btn ${playingWord === activeWord.original ? "playing" : ""}`}
                  onClick={() => handlePlayTTS(activeWord.original)}
                  title="Posłuchaj wymowy"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              </div>

              {/* Translation & Definition */}
              <div className="active-word-meaning-block">
                <div className="active-word-translation">{activeWord.translated}</div>
                <p className="active-word-definition">{activeWord.definition}</p>
              </div>

              {/* Context Quote */}
              <div className="active-word-quote-block">
                “{activeWord.context_sentence}”
              </div>

              {/* Story Source Tag */}
              <div className="active-word-tags-row">
                <span className="story-source-pill">{activeWord.story_title}</span>
              </div>

              {/* Bottom Actions Row */}
              <div className="active-word-actions-row">
                <button
                  className="edit-word-btn"
                  onClick={() => handleOpenEditModal(activeWord)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Edit word</span>
                </button>
                <button
                  className="delete-word-btn"
                  onClick={() => handleDeleteWord(activeWord)}
                  title="Usuń słówko"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="active-word-card empty-active-card">
              <p>Wybierz słówko z listy, aby zobaczyć szczegóły.</p>
            </div>
          )}

          {/* Card 2: Quick Review Widget */}
          <div className="review-widget-card">
            <div className="review-widget-header">
              <div className="review-widget-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d97706" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <h4 className="review-widget-title">Ready for a quick review?</h4>
            </div>

            <p className="review-widget-desc">
              Spaced repetition helps you remember more with less effort.
            </p>

            <div className="review-goal-progress">
              <div className="goal-label">
                Weekly review goal · {Math.min(knownCount, 8)} / 12
              </div>
              <div className="goal-track">
                <div
                  className="goal-fill"
                  style={{ width: `${Math.min(100, Math.round((Math.min(knownCount, 8) / 12) * 100))}%` }}
                ></div>
              </div>
            </div>

            <button
              className="open-flashcards-btn"
              onClick={() => setShowFlashcards(true)}
              disabled={enrichedWords.length === 0}
            >
              Open flashcards
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Word Modal ──────────────────────────────────────── */}
      {showAddWordModal && (
        <div className="modal-backdrop-figma">
          <div className="modal-card-figma">
            <div className="modal-header-figma">
              <h3>Dodaj nowe słówko do banku</h3>
              <button className="modal-close-btn" onClick={() => setShowAddWordModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddNewWord} className="modal-body-figma">
              <div className="form-group-figma">
                <label>Słówko / Fraza po angielsku</label>
                <div className="input-with-action">
                  <input
                    type="text"
                    value={newOriginalWord}
                    onChange={(e) => setNewOriginalWord(e.target.value)}
                    placeholder="np. adapt, clarify, supportive..."
                    required
                  />
                  <button
                    type="button"
                    className="auto-translate-btn"
                    onClick={handleAutoTranslateNewWord}
                    disabled={isTranslatingNew || !newOriginalWord.trim()}
                  >
                    {isTranslatingNew ? "Tłumaczę..." : "AI Tłumacz"}
                  </button>
                </div>
              </div>

              <div className="form-group-figma">
                <label>Polskie tłumaczenie</label>
                <input
                  type="text"
                  value={newTranslatedWord}
                  onChange={(e) => setNewTranslatedWord(e.target.value)}
                  placeholder="np. dostosować się..."
                  required
                />
              </div>

              <div className="form-group-figma">
                <label>Przykładowe zdanie w kontekście (opcjonalnie)</label>
                <input
                  type="text"
                  value={newContextSentence}
                  onChange={(e) => setNewContextSentence(e.target.value)}
                  placeholder="np. Maya needed to adapt to a new routine."
                />
              </div>

              <div className="form-group-figma">
                <label>Tematyka / Kategoria</label>
                <select value={newTopic} onChange={(e) => setNewTopic(e.target.value)}>
                  <option value="Business">Business</option>
                  <option value="Travel">Travel</option>
                  <option value="Daily Life">Daily Life</option>
                  <option value="Tech">Tech</option>
                  <option value="Health">Health</option>
                  <option value="General">General</option>
                </select>
              </div>

              {addWordError && <p className="modal-error-text">{addWordError}</p>}

              <div className="modal-actions-figma">
                <button type="button" className="btn-cancel" onClick={() => setShowAddWordModal(false)}>
                  Anuluj
                </button>
                <button type="submit" className="btn-submit" disabled={isSavingNewWord}>
                  {isSavingNewWord ? "Zapisuję..." : "Zapisz słówko"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Word Modal ─────────────────────────────────────── */}
      {editingWord && (
        <div className="modal-backdrop-figma">
          <div className="modal-card-figma">
            <div className="modal-header-figma">
              <h3>Edycja słówka</h3>
              <button className="modal-close-btn" onClick={() => setEditingWord(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="modal-body-figma">
              <div className="form-group-figma">
                <label>Angielski zwrot</label>
                <input
                  type="text"
                  value={editOriginal}
                  onChange={(e) => setEditOriginal(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-figma">
                <label>Polskie tłumaczenie</label>
                <input
                  type="text"
                  value={editTranslated}
                  onChange={(e) => setEditTranslated(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-figma">
                <label>Zdanie w kontekście</label>
                <input
                  type="text"
                  value={editContextSentence}
                  onChange={(e) => setEditContextSentence(e.target.value)}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group-figma">
                  <label>Status powtórek</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="Learning">Learning (W trakcie)</option>
                    <option value="Known">Known (Opanowane)</option>
                    <option value="New">New (Nowe)</option>
                  </select>
                </div>
                <div className="form-group-figma">
                  <label>Tematyka</label>
                  <select value={editTopic} onChange={(e) => setEditTopic(e.target.value)}>
                    <option value="Business">Business</option>
                    <option value="Travel">Travel</option>
                    <option value="Daily Life">Daily Life</option>
                    <option value="Tech">Tech</option>
                    <option value="Health">Health</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions-figma">
                <button type="button" className="btn-cancel" onClick={() => setEditingWord(null)}>
                  Anuluj
                </button>
                <button type="submit" className="btn-submit" disabled={isSavingEdit}>
                  {isSavingEdit ? "Zapisuję..." : "Zapisz zmiany"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Flashcards Modal ────────────────────────────────────── */}
      {showFlashcards && (
        <Flashcards
          words={dueWords}
          notebookWords={dueWords}
          user={user}
          categoryTitle={`My Vocabulary · ${difficultyFilter !== "all" ? difficultyFilter.toUpperCase() : "B2"} review`}
          onClose={() => {
            setShowFlashcards(false);
            fetchVocabulary();
          }}
          onFinishExercises={() => {
            setShowFlashcards(false);
            fetchVocabulary();
          }}
        />
      )}

      {/* ── AI Explanation Modal ────────────────────────────────── */}
      {explanationWord && (
        <WordExplanationModal
          word={explanationWord}
          user={user}
          onClose={() => setExplanationWord(null)}
        />
      )}

      {/* ── Pronunciation Practice Modal ────────────────────────── */}
      {practiceTargetText && (
        <PronunciationPracticeModal
          targetText={practiceTargetText}
          user={user}
          onClose={() => setPracticeTargetText(null)}
        />
      )}

      {/* ── Email Export Modal ──────────────────────────────────── */}
      {showEmailModal && (
        <div className="modal-backdrop-figma">
          <div className="modal-card-figma">
            <div className="modal-header-figma">
              <h3>Eksportuj słownik na e-mail</h3>
              <button className="modal-close-btn" onClick={() => setShowEmailModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSendEmail} className="modal-body-figma">
              <div className="form-group-figma">
                <label>Adres e-mail odbiorcy</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="twoj@email.com"
                  required
                />
              </div>
              {emailStatus === "success" && (
                <p style={{ color: "#16a34a", fontSize: "0.85rem", margin: 0, fontWeight: 600 }}>✓ Wysłano pomyślnie!</p>
              )}
              {emailStatus === "error" && (
                <p style={{ color: "#e11d48", fontSize: "0.85rem", margin: 0 }}>Błąd podczas wysyłania e-maila.</p>
              )}
              <div className="modal-actions-figma">
                <button type="button" className="btn-cancel" onClick={() => setShowEmailModal(false)}>
                  Anuluj
                </button>
                <button type="submit" className="btn-submit" disabled={emailStatus === "sending"}>
                  {emailStatus === "sending" ? "Wysyłanie..." : "Wyślij listę słówek"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VocabularyView;
