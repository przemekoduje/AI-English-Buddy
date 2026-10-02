import React, { useState, useEffect, useRef, useMemo } from "react";
import { API_BASE_URL } from '../../config';
import "./MediaBuddy.css";
import PronunciationPracticeModal from "../Notebook/PronunciationPracticeModal";
import WordExplanationModal from "../Notebook/WordExplanationModal";
import transcriptsData from "./transcripts.json";
import { ensureCompleteSentences } from "./sentenceGrouping";

const CURATED_VIDEOS = [
  {
    id: "james_veitch_spam",
    title: "James Veitch - Replying to Spam Email",
    youtubeId: "_QdPW8JrYzQ",
    transcript: ensureCompleteSentences(transcriptsData.james_veitch_spam)
  },
  {
    id: "james_veitch_unsubscribe",
    title: "James Veitch - The Agony of Unsubscribing",
    youtubeId: "Dceyy0cX6J4",
    transcript: ensureCompleteSentences(transcriptsData.james_veitch_unsubscribe)
  },
  {
    id: "jeff_allen_teenagers",
    title: "Jeff Allen - Teenagers (Dry Bar Comedy)",
    youtubeId: "cqjhCC4sP4Q",
    transcript: ensureCompleteSentences(transcriptsData.jeff_allen_teenagers)
  }
];

const CURATED_SOURCES = [
  {
    id: "dry_bar_comedy",
    name: "🎭 Dry Bar Comedy (Humor, stand-up)",
    videos: [
      {
        youtubeId: "cqjhCC4sP4Q",
        title: "Jeff Allen - I'm Not Married to a Woman, I'm Married to a Logic",
        description: "Klasyczny, świetny stand-up o małżeństwie, idealne napisy."
      }
    ]
  },
  {
    id: "ted_talks",
    name: "💡 TED Talks (Inspirujące przemówienia)",
    videos: [
      {
        youtubeId: "5MgBikgcWnY",
        title: "Tim Urban - Inside the mind of a master procrastinator",
        description: "Jeden z najpopularniejszych i najzabawniejszych wykładów TED."
      },
      {
        youtubeId: "iCvmsMzlF7o",
        title: "Amy Cuddy - Your body language may shape who you are",
        description: "Poruszający wykład o mowie ciała i pewności siebie."
      },
      {
        youtubeId: "w-HYZv6HzAs",
        title: "Simon Sinek - How great leaders inspire action",
        description: "Klasyczna prezentacja o złotej zasadzie przywództwa."
      }
    ]
  },
  {
    id: "tech_fireship",
    name: "💻 Fireship (Technologie, szybkie tempo)",
    videos: [
      {
        youtubeId: "Sxxw3qtb3_g",
        title: "What is Git? (in 100 Seconds)",
        description: "Bardzo dynamiczny, techniczny angielski z bezbłędnymi napisami."
      },
      {
        youtubeId: "erEgovG9WBs",
        title: "100+ Web Development Terms you need to know",
        description: "Szybki angielski, masa żartów, świetne napisy automatyczne."
      }
    ]
  },
  {
    id: "james_veitch",
    name: "✉️ James Veitch (Rozrywka, e-maile)",
    videos: [
      {
        youtubeId: "_QdPW8JrYzQ",
        title: "This is what happens when you reply to spam email",
        description: "Niezwykle zabawna historia korespondencji ze spamerem."
      },
      {
        youtubeId: "Dceyy0cX6J4",
        title: "The agony of trying to unsubscribe",
        description: "Komiczna walka z próbą wypisania się z newslettera supermarketu."
      }
    ]
  }
];

const shuffleAndSlice = (array, count = 3) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
};

function MediaBuddy({ user }) {
  const [currentVideo, setCurrentVideo] = useState(CURATED_VIDEOS[0]);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Interaction states
  const [selectedWord, setSelectedWord] = useState("");
  const [wordTranslation, setWordTranslation] = useState("");
  const [wordSentenceTranslation, setWordSentenceTranslation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Segment phrase translation states
  const [segmentTranslation, setSegmentTranslation] = useState("");
  const [isTranslatingSegment, setIsTranslatingSegment] = useState(false);
  const [isSegmentSaved, setIsSegmentSaved] = useState(false);

  const [customUrl, setCustomUrl] = useState("");
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const randomizedSources = useMemo(() => {
    return CURATED_SOURCES.map(source => ({
      ...source,
      videos: shuffleAndSlice(source.videos, 3)
    }));
  }, []);
  const [customVideos, setCustomVideos] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_custom_videos");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return parsed.map((v) => ({
        ...v,
        transcript: ensureCompleteSentences(v.transcript)
      }));
    } catch (e) {
      console.error("Failed to load custom videos from localStorage", e);
      return [];
    }
  });

  const [videoProgress, setVideoProgress] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_video_progress");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to load video progress from localStorage", e);
      return {};
    }
  });

  const [recentSortOrder, setRecentSortOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_recent_sort_order");
      return saved === "oldest" ? "oldest" : "newest";
    } catch (e) {
      return "newest";
    }
  });

  const [unwatchedSortOrder, setUnwatchedSortOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_unwatched_sort_order");
      return saved === "oldest" ? "oldest" : "newest";
    } catch (e) {
      return "newest";
    }
  });

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_autoscroll_enabled");
      return saved === "false" ? false : true;
    } catch (e) {
      return true;
    }
  });

  // Sync autoScrollEnabled to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("media_buddy_autoscroll_enabled", autoScrollEnabled.toString());
      console.log("Autoscroll persisted to localStorage:", autoScrollEnabled);
    } catch (e) {
      console.error("Failed to save autoScrollEnabled to localStorage", e);
    }
  }, [autoScrollEnabled]);

  const [pastedSrt, setPastedSrt] = useState("");
  const [notebookWords, setNotebookWords] = useState([]);
  
  // Exercise State
  const [exerciseData, setExerciseData] = useState(null);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseTranslation, setExerciseTranslation] = useState("");
  const [exerciseResult, setExerciseResult] = useState(null);
  const [exerciseChecking, setExerciseChecking] = useState(false);
  const [showExerciseHint, setShowExerciseHint] = useState(false);

  useEffect(() => {
    if (!currentVideo || !user?.token) {
      setNotebookWords([]);
      return;
    }
    const storyId = currentVideo.youtubeId || currentVideo.id;
    fetch(`${API_BASE_URL}/api/vocabulary?story_id=${storyId}`, {
      headers: { "X-Session-Token": user.token }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotebookWords(data);
        }
      })
      .catch(err => console.error("Error fetching notebook words:", err));
  }, [currentVideo, user?.token]);

  const handleStartExercise = async () => {
    if (notebookWords.length === 0) return;
    setExerciseLoading(true);
    setExerciseData(null);
    setExerciseResult(null);
    setExerciseTranslation("");
    setShowExerciseHint(false);
    try {
      const shuffledWords = [...notebookWords].sort(() => 0.5 - Math.random());
      const selectedWords = shuffledWords.slice(0, 10);
      
      const res = await fetch(`${API_BASE_URL}/api/vocabulary/generate-exercise`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({ words: selectedWords }) // AI will pick 1-3
      });
      if (res.ok) {
        const data = await res.json();
        setExerciseData(data);
      } else {
        alert("Błąd podczas generowania ćwiczenia.");
      }
    } catch (e) {
      console.error(e);
      alert("Błąd sieci podczas generowania ćwiczenia.");
    } finally {
      setExerciseLoading(false);
    }
  };

  const handleCheckExercise = async () => {
    if (!exerciseTranslation.trim() || !exerciseData) return;
    setExerciseChecking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vocabulary/check-translation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({
          target_word: exerciseData.target_words.join(", "),
          sentence_pl: exerciseData.sentence_pl,
          correct_en: exerciseData.correct_en,
          user_translation: exerciseTranslation
        })
      });
      if (res.ok) {
        const data = await res.json();
        setExerciseResult(data);
      } else {
        alert("Błąd sprawdzania.");
      }
    } catch (e) {
      console.error(e);
      alert("Błąd sieci podczas sprawdzania.");
    } finally {
      setExerciseChecking(false);
    }
  };



  // Pause video on vocabulary drawer open
  useEffect(() => {
    const handleDrawerOpen = () => {
      if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
        playerRef.current.pauseVideo();
      }
    };
    window.addEventListener("vocabulary-drawer-opened", handleDrawerOpen);
    return () => {
      window.removeEventListener("vocabulary-drawer-opened", handleDrawerOpen);
    };
  }, []);

  // Sync recentSortOrder to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("media_buddy_recent_sort_order", recentSortOrder);
    } catch (e) {
      console.error("Failed to save recentSortOrder to localStorage", e);
    }
  }, [recentSortOrder]);

  // Sync unwatchedSortOrder to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("media_buddy_unwatched_sort_order", unwatchedSortOrder);
    } catch (e) {
      console.error("Failed to save unwatchedSortOrder to localStorage", e);
    }
  }, [unwatchedSortOrder]);

  const allVideos = useMemo(() => {
    return [...CURATED_VIDEOS, ...customVideos];
  }, [customVideos]);

  const recentVideos = useMemo(() => {
    const watched = allVideos.filter(v => videoProgress[v.id]);
    watched.sort((a, b) => {
      const timeA = videoProgress[a.id]?.lastWatched || 0;
      const timeB = videoProgress[b.id]?.lastWatched || 0;
      return recentSortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
    
    if (watched.length < 10) {
      const unwatched = allVideos.filter(v => !videoProgress[v.id]);
      const padded = recentSortOrder === "newest" ? unwatched : [...unwatched].reverse();
      return [...watched, ...padded].slice(0, 10);
    }
    return watched.slice(0, 10);
  }, [allVideos, videoProgress, recentSortOrder]);

  const unwatchedVideos = useMemo(() => {
    const list = allVideos.filter(v => {
      const prog = videoProgress[v.id];
      return !prog || prog.progressPercent < 25;
    });
    list.sort((a, b) => {
      const progA = videoProgress[a.id];
      const progB = videoProgress[b.id];
      const timeA = progA?.lastWatched || 0;
      const timeB = progB?.lastWatched || 0;
      
      if (timeA && timeB) {
        return unwatchedSortOrder === "newest" ? timeB - timeA : timeA - timeB;
      }
      if (timeA) return unwatchedSortOrder === "newest" ? -1 : 1;
      if (timeB) return unwatchedSortOrder === "newest" ? 1 : -1;
      
      const idxA = allVideos.indexOf(a);
      const idxB = allVideos.indexOf(b);
      return unwatchedSortOrder === "newest" ? idxB - idxA : idxA - idxB;
    });
    return list;
  }, [allVideos, videoProgress, unwatchedSortOrder]);

  // Sync customVideos to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("media_buddy_custom_videos", JSON.stringify(customVideos));
    } catch (e) {
      console.error("Failed to save custom videos to localStorage", e);
    }
  }, [customVideos]);

  // Automatyczna migracja i normalizacja customVideos z localStorage do pełnych zdań
  useEffect(() => {
    if (Array.isArray(customVideos) && customVideos.length > 0) {
      let changed = false;
      const updated = customVideos.map((v) => {
        if (!Array.isArray(v.transcript) || v.transcript.length === 0) return v;
        const needsSplit = v.transcript.length === 1 ||
          v.transcript.some(t => !t.text || t.text.split(/\s+/).length > 22 || (t.end - t.start > 25));
        if (needsSplit) {
          const resegmented = ensureCompleteSentences(v.transcript);
          if (resegmented.length !== v.transcript.length) {
            changed = true;
            return {
              ...v,
              transcript: resegmented
            };
          }
        }
        return v;
      });

      if (changed) {
        setCustomVideos(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatyczna weryfikacja currentVideo - jeśli zawiera gigantyczny blok, natychmiast go rozbijamy
  useEffect(() => {
    if (currentVideo && Array.isArray(currentVideo.transcript) && currentVideo.transcript.length > 0) {
      const needsSplit = currentVideo.transcript.length === 1 || 
        currentVideo.transcript.some(t => !t.text || t.text.split(/\s+/).length > 22 || (t.end - t.start > 25));
      
      if (needsSplit) {
        const resegmented = ensureCompleteSentences(currentVideo.transcript);
        if (resegmented.length !== currentVideo.transcript.length) {
          setCurrentVideo(prev => ({
            ...prev,
            transcript: resegmented
          }));
        }
      }
    }
  }, [currentVideo]);

  const handleDeleteCustomVideo = (e, videoId) => {
    e.stopPropagation();
    const updated = customVideos.filter((v) => v.id !== videoId);
    setCustomVideos(updated);
    if (currentVideo.id === videoId) {
      setCurrentVideo(CURATED_VIDEOS[0]);
    }
  };



  // Pronunciation Practice modal states
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceText, setPracticeText] = useState("");

  // Detailed Word Explanation state (optional reuse)
  const [explanationWord, setExplanationWord] = useState(null);

  // Refs for YouTube Player and interval
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const isInitialMount = useRef(true);
  const latestWordRef = useRef("");
  const latestSegmentIndexRef = useRef(-1);
  const lastSavedSecondRef = useRef(-1);
  const currentVideoRef = useRef(currentVideo);
  const recentScrollRef = useRef(null);
  const unwatchedScrollRef = useRef(null);

  const scrollRow = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = 480; // Scroll by two video tiles
      ref.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  // Helper to create or recreate YouTube Player instance with a specific videoId
  const createPlayer = (videoId, autoPlay = true) => {
    // If a player already exists, destroy it to restore original placeholder div
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying player:", e);
      }
      playerRef.current = null;
    }

    try {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          origin: window.location.origin,
          enablejsapi: 1,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            console.log("YouTube Player is ready for video:", videoId);
          },
          onStateChange: (event) => {
            handlePlayerStateChange(event.data);
          }
        }
      });
    } catch (err) {
      console.error("Failed to initialize YT Player:", err);
    }
  };

  // Load YouTube Player API and initialize on mount
  useEffect(() => {
    // Inject the YouTube IFrame API script if not already present
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // Define callback
      window.onYouTubeIframeAPIReady = () => {
        createPlayer(currentVideo.youtubeId, false);
      };
    } else {
      createPlayer(currentVideo.youtubeId, false);
    }

    return () => {
      clearTrackingTimer();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player:", e);
        }
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track playback time and play/pause state
  const handlePlayerStateChange = (state) => {
    if (state === 1) { // PLAYING
      setIsPlaying(true);

      // Auto-scroll on desktop when video starts playing
      // so the video and dictionary are clearly visible
      if (window.innerWidth >= 1024) {
        const videoElement = document.querySelector('.media-workspace-grid');
        if (videoElement) {
          const targetY = videoElement.getBoundingClientRect().top + window.scrollY - 80;
          if (Math.abs(window.scrollY - targetY) > 50) {
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          }
        }
      }

      clearTrackingTimer();
      timerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
          
          const currentSecond = Math.floor(time);
          if (currentSecond !== lastSavedSecondRef.current && typeof playerRef.current.getDuration === "function") {
            lastSavedSecondRef.current = currentSecond;
            const duration = playerRef.current.getDuration();
            const activeVid = currentVideoRef.current;
            if (duration > 0 && activeVid) {
              setVideoProgress(prev => {
                const nextProgress = {
                  ...prev,
                  [activeVid.id]: {
                    lastWatched: Date.now(),
                    currentTime: time,
                    duration: duration,
                    progressPercent: (time / duration) * 100
                  }
                };
                try {
                  localStorage.setItem("media_buddy_video_progress", JSON.stringify(nextProgress));
                } catch (e) {
                  console.error("Failed to save progress", e);
                }
                return nextProgress;
              });
            }
          }
        }
      }, 100);
    } else {
      setIsPlaying(false);
      clearTrackingTimer();
    }
  };

  const clearTrackingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Switch video and recreate player when currentVideo changes
  useEffect(() => {
    currentVideoRef.current = currentVideo;
    if (window.YT && window.YT.Player) {
      createPlayer(currentVideo.youtubeId, !isInitialMount.current);
    }
    isInitialMount.current = false;
    // Reset states
    setCurrentTime(0);
    setActiveSegmentIndex(-1);
    setIsPlaying(false);
    setSelectedWord("");
    setWordTranslation("");
    setSegmentTranslation("");
    setIsSegmentSaved(false);
    lastSavedSecondRef.current = -1; // Reset last saved second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo]);

  // Clear segment translation when active segment changes to avoid stale text
  useEffect(() => {
    setSegmentTranslation("");
    setIsSegmentSaved(false);
  }, [activeSegmentIndex]);

  // Automatically translate active segment when video is paused
  useEffect(() => {
    if (!isPlaying && activeSegmentIndex !== -1) {
      translateActiveSegment(activeSegmentIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeSegmentIndex]);

  // Synchronize active segment and trigger auto-scrolling
  useEffect(() => {
    // Add a 0.4s anticipation bias when playing to compensate for rendering/scroll latency.
    // When paused, use exact currentTime.
    const checkTime = isPlaying ? currentTime + 0.4 : currentTime;

    // Search from the end to prefer newer overlapping segments
    let idx = -1;
    for (let i = currentVideo.transcript.length - 1; i >= 0; i--) {
      const seg = currentVideo.transcript[i];
      if (checkTime >= seg.start && checkTime <= seg.end) {
        idx = i;
        break;
      }
    }

    if (idx !== -1) {
      if (idx !== activeSegmentIndex) {
        setActiveSegmentIndex(idx);
        // Auto-scroll transcript container to make active card visible (only when playing and enabled)
        if (isPlaying && autoScrollEnabled) {
          const activeCard = document.querySelector(`.transcript-segment-card[data-index="${idx}"]`);
          if (activeCard) {
            activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      }
    } else {
      // Clear active segment highlight if we are outside the segment boundary (with a tight tolerance when playing)
      const lastSeg = currentVideo.transcript[activeSegmentIndex];
      const tolerance = isPlaying ? 0.2 : 0.0;
      if (lastSeg && (checkTime < lastSeg.start - tolerance || checkTime > lastSeg.end + tolerance)) {
        setActiveSegmentIndex(-1);
      }
    }
  }, [currentTime, currentVideo, activeSegmentIndex, isPlaying, autoScrollEnabled]);

  // Click card body: seek to segment start and pause video (for study) / toggle play state if active
  const handleCardClick = (seg, index) => {
    if (playerRef.current && typeof playerRef.current.getPlayerState === "function") {
      const state = playerRef.current.getPlayerState();
      if (activeSegmentIndex === index) {
        if (state === 1) { // PLAYING
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      } else {
        if (typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(seg.start, true);
        }
        playerRef.current.pauseVideo();
        setCurrentTime(seg.start);
        setActiveSegmentIndex(index);
      }
    } else {
      // Fallback if player API is not ready
      if (activeSegmentIndex === index) {
        setIsPlaying(!isPlaying);
      } else {
        setCurrentTime(seg.start);
        setActiveSegmentIndex(index);
        setIsPlaying(false);
      }
    }
  };

  // Translate entire active segment phrase when video is paused
  const translateActiveSegment = async (index) => {
    const segment = currentVideo.transcript[index];
    if (!segment || !segment.text) return;

    // If we are already translating the SAME segment, or already have its translation, skip
    if (latestSegmentIndexRef.current === index && (isTranslatingSegment || segmentTranslation)) {
      return;
    }

    latestSegmentIndexRef.current = index;
    setIsTranslatingSegment(true);
    setIsSegmentSaved(false);
    setSegmentTranslation(""); // Clear previous translation to show loader

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: segment.text })
      });
      if (latestSegmentIndexRef.current !== index) return;
      if (response.ok) {
        const data = await response.json();
        setSegmentTranslation(data.translation || "Brak tłumaczenia");
      } else {
        setSegmentTranslation("Błąd tłumaczenia");
      }
    } catch (err) {
      if (latestSegmentIndexRef.current !== index) return;
      console.error(err);
      setSegmentTranslation("Błąd połączenia");
    } finally {
      if (latestSegmentIndexRef.current === index) {
        setIsTranslatingSegment(false);
      }
    }
  };

  // Save full phrase to vocabulary notebook
  const handleSaveSegmentPhrase = async () => {
    const segment = currentVideo.transcript[activeSegmentIndex];
    if (!segment || !segmentTranslation) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({
          original: segment.text,
          translated: segmentTranslation,
          story_id: `standup_phrase_${currentVideo.id}`
        })
      });
      if (response.ok) {
        const added_doc = await response.json();
        setIsSegmentSaved(true);
        if (!notebookWords.some(w => w.original === added_doc.original)) {
          setNotebookWords(prev => [added_doc, ...prev]);
        }
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania frazy:", err);
    }
  };

  // Click word: pause video and fetch translation
  const handleWordClick = async (word, sentenceContext) => {
    if (!word) return;
    if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }
    latestWordRef.current = word;
    setSelectedWord(word);
    setWordTranslation("");
    setWordSentenceTranslation("");
    setIsTranslating(true);
    setIsSaved(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: word, context: sentenceContext })
      });
      if (latestWordRef.current !== word) return;
      if (response.ok) {
        const data = await response.json();
        setWordTranslation(data.translation || "Brak tłumaczenia");
        setWordSentenceTranslation(data.sentence_translation || "");
      } else {
        setWordTranslation("Błąd tłumaczenia");
        setWordSentenceTranslation("");
      }
    } catch (err) {
      if (latestWordRef.current !== word) return;
      console.error(err);
      setWordTranslation("Błąd połączenia");
    } finally {
      if (latestWordRef.current === word) {
        setIsTranslating(false);
      }
    }
  };

  const handleSaveWord = async () => {
    if (!selectedWord || !wordTranslation) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({
          original: selectedWord,
          translated: wordTranslation,
          story_id: `standup_${currentVideo.id}`
        })
      });
      if (response.ok) {
        const added_doc = await response.json();
        setIsSaved(true);
        if (!notebookWords.some(w => w.original === added_doc.original)) {
          setNotebookWords(prev => [added_doc, ...prev]);
        }
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania słówka:", err);
    }
  };


  // Click Practice Pronunciation: pause video and open modal
  const handlePracticePronunciation = (text) => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }
    setPracticeText(text);
    setShowPracticeModal(true);
  };

  const renderInteractiveText = (text, segmentIndex) => {
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, idx) => {
      if (/^\s+$/.test(token)) {
        return token;
      }
      const cleanWord = token.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
      return (
        <span
          key={idx}
          className="media-interactive-word"
          onClick={(e) => {
            e.stopPropagation();
            if (segmentIndex !== undefined && segmentIndex !== -1) {
              setActiveSegmentIndex(segmentIndex);
            }
            handleWordClick(cleanWord, text);
          }}
        >
          {token}
        </span>
      );
    });
  };

  const extractVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url.trim();
  };

  const handleSelectVideo = (vid) => {
    const formattedTranscript = ensureCompleteSentences(vid.transcript);
    if (currentVideo && currentVideo.id === vid.id && currentVideo.transcript && currentVideo.transcript.length === formattedTranscript.length) return;
    setIsLoadingCustom(true);
    setTimeout(() => {
      setCurrentVideo({
        ...vid,
        transcript: formattedTranscript
      });
      setIsLoadingCustom(false);
    }, 300);
  };

  const fetchAndLoadVideo = async (videoId) => {
    setCustomError("");
    
    // Check if we have a static transcript locally in transcripts.json
    const getStaticTranscript = (id) => {
      if (transcriptsData[id]) return transcriptsData[id];
      if (id === "_QdPW8JrYzQ") return transcriptsData.james_veitch_spam;
      if (id === "Dceyy0cX6J4") return transcriptsData.james_veitch_unsubscribe;
      if (id === "cqjhCC4sP4Q") return transcriptsData.jeff_allen_teenagers;
      return null;
    };

    const staticTranscript = getStaticTranscript(videoId);
    if (staticTranscript) {
      setIsLoadingCustom(true);
      setTimeout(() => {
        let title = `Wideo (${videoId})`;
        // Try to find the title in CURATED_SOURCES
        for (const source of CURATED_SOURCES) {
          const found = source.videos.find(v => v.youtubeId === videoId);
          if (found) {
            title = found.title;
            break;
          }
        }
        // Or in CURATED_VIDEOS
        const foundCurated = CURATED_VIDEOS.find(v => v.youtubeId === videoId);
        if (foundCurated) {
          title = foundCurated.title;
        }

        const staticVid = {
          id: `custom_${videoId}`,
          title: title,
          youtubeId: videoId,
          transcript: ensureCompleteSentences(staticTranscript)
        };

        setCustomVideos(prev => {
          const filtered = prev.filter(v => v.youtubeId !== videoId);
          return [staticVid, ...filtered];
        });
        setCurrentVideo(staticVid);
        setCustomUrl("");
        setIsLoadingCustom(false);
      }, 500);
      return;
    }

    setIsLoadingCustom(true);
    let newTranscript = [];
    let newTitle = `Własne wideo (${videoId})`;
    try {
      const endpoint = `${API_BASE_URL}/api/media/transcript?video_id=${videoId}&use_whisper=false`;

      const response = await fetch(endpoint, {
        headers: {
          "X-Session-Token": user ? user.token : ""
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.transcript && data.transcript.length > 0) {
          newTranscript = data.transcript;
        } else {
          setCustomError("Ten film nie posiada angielskich napisów. Możesz dodać własne napisy .srt po załadowaniu.");
        }
        if (data.title) newTitle = data.title;
      } else {
        const errData = await response.json();
        setCustomError(errData.error || "Błąd podczas pobierania transkrypcji. Możesz dodać własne napisy.");
      }
    } catch (err) {
      console.error(err);
      setCustomError("Błąd pobierania transkrypcji z serwisu YouTube. Możesz dodać własne napisy.");
    } finally {
      const newCustomVid = {
        id: `custom_${videoId}`,
        title: newTitle,
        youtubeId: videoId,
        transcript: newTranscript.length > 0 ? ensureCompleteSentences(newTranscript) : []
      };

      setCustomVideos(prev => {
        const filtered = prev.filter(v => v.youtubeId !== videoId);
        return [newCustomVid, ...filtered];
      });
      setCurrentVideo(newCustomVid);
      setCustomUrl("");
      setIsLoadingCustom(false);
    }
  };

  const handleLoadCustomVideo = async (e) => {
    e.preventDefault();
    const videoId = extractVideoId(customUrl);
    if (!videoId || videoId.length !== 11) {
      setCustomError("Nieprawidłowy adres URL lub ID wideo. Upewnij się, że ID ma 11 znaków.");
      return;
    }
    await fetchAndLoadVideo(videoId);
  };

  const timeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(',');
    const hms = parts[0];
    const ms = parts[1] || '000';
    const timeParts = hms.split(':');
    let h = 0, m = 0, s = 0;
    if (timeParts.length === 3) {
      h = parseInt(timeParts[0], 10);
      m = parseInt(timeParts[1], 10);
      s = parseInt(timeParts[2], 10);
    } else if (timeParts.length === 2) {
      m = parseInt(timeParts[0], 10);
      s = parseInt(timeParts[1], 10);
    }
    return (h * 3600) + (m * 60) + s + (parseInt(ms, 10) / 1000);
  };

  const parseSrt = (srtText) => {
    const segments = [];
    const blocks = srtText.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);
    blocks.forEach(block => {
      const lines = block.split('\n');
      let timeLineIdx = -1;
      for(let i=0; i<lines.length; i++) {
        if(lines[i].includes('-->')) {
          timeLineIdx = i;
          break;
        }
      }
      if (timeLineIdx !== -1 && lines.length > timeLineIdx + 1) {
        const timeLine = lines[timeLineIdx];
        const times = timeLine.split('-->').map(t => t.trim());
        if (times.length === 2) {
          const start = timeToSeconds(times[0]);
          const end = timeToSeconds(times[1]);
          const text = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
          if (text) {
             segments.push({ start, end, text });
          }
        }
      }
    });
    return segments;
  };

  const handleSrtUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const srtText = evt.target.result;
      const parsed = parseSrt(srtText);
      if (parsed.length > 0) {
        const formatted = ensureCompleteSentences(parsed);
        setCurrentVideo(prev => ({ ...prev, transcript: formatted }));
        setCustomVideos(prev => 
          prev.map(v => v.id === currentVideo.id ? { ...v, transcript: formatted } : v)
        );
        setCustomError("");
      } else {
        setCustomError("Plik SRT jest pusty lub ma nieprawidłowy format.");
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  const handlePastedSrt = () => {
    if (!pastedSrt.trim()) return;
    if (pastedSrt.includes('-->')) {
      const parsed = parseSrt(pastedSrt);
      if (parsed.length > 0) {
        const formatted = ensureCompleteSentences(parsed);
        setCurrentVideo(prev => ({ ...prev, transcript: formatted }));
        setCustomVideos(prev => 
          prev.map(v => v.id === currentVideo.id ? { ...v, transcript: formatted } : v)
        );
        setPastedSrt("");
        setCustomError("");
      } else {
         setCustomError("Nie rozpoznano prawidłowego formatu SRT.");
      }
    } else {
      setCustomError("Tekst musi być w formacie SRT (zawierać czasy np. '00:00:01,000 --> 00:00:04,000').");
    }
  };

  return (
    <div className="mediabuddy-container">
      {isLoadingCustom && (
        <div className="media-loading-overlay">
          <div className="media-loading-card glass-panel animate-fade-in">
            <div className="media-spinner"></div>
            <p className="media-loading-text">Pobieranie transkrypcji i przygotowywanie wideo...</p>
          </div>
        </div>
      )}
      {/* Custom Video URL Loader */}
      <div className="custom-video-loader glass-panel">
        <h3 className="loader-title">Dodaj własne wideo z YouTube</h3>
        <form onSubmit={handleLoadCustomVideo} className="loader-form">
          <input
            type="text"
            className="loader-input"
            placeholder="Wklej link do YouTube (np. https://www.youtube.com/watch?v=... lub id wideo)"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
          <button type="submit" className="loader-btn" disabled={isLoadingCustom}>
            {isLoadingCustom ? "Pobieranie transkrypcji..." : "Załaduj wideo"}
          </button>
        </form>


        {customError && <p className="loader-error">{customError}</p>}


        {/* Curated Channels & Suggestion Box */}
        <div className="curated-suggestions-section">
          <h4 className="suggestions-title">
            Rekomendowane kanały z gotowymi napisami
          </h4>
          <div className="suggestions-controls">
            <select 
              className="suggestions-select"
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
            >
              <option value="">-- Wybierz kategorię / kanał --</option>
              {randomizedSources.map(source => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const selectedSource = randomizedSources.find(s => s.id === selectedSourceId);
            if (!selectedSource) return null;
            return (
              <div className="suggestions-grid animate-fade-in">
                {selectedSource.videos.map(video => (
                  <div key={video.youtubeId} className="suggestion-item-card">
                    <div className="suggestion-thumbnail-wrapper">
                      <img 
                        src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                        alt={video.title}
                        className="suggestion-thumbnail"
                      />
                    </div>
                    <div className="suggestion-info">
                      <h5 className="suggestion-video-title">{video.title}</h5>
                      <p className="suggestion-video-desc">{video.description}</p>
                      <button 
                        type="button" 
                        className="suggestion-load-btn"
                        onClick={() => fetchAndLoadVideo(video.youtubeId)}
                        disabled={isLoadingCustom}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          Załaduj wideo
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Video Selector Row */}
      <div className="media-selector-bar glass-panel">
        <h2 className="media-selector-title">Wybierz klip:</h2>
        
        {/* Row 1: Ostatnio oglądane */}
        <div className="media-selector-row">
          <div className="media-selector-row-header">
            <div className="media-selector-row-title">
              <span>🕒 Ostatnio oglądane</span>
            </div>
            <div className="media-selector-sort-controls">
              <span className="sort-label">Sortowanie:</span>
              <button 
                type="button" 
                className={`sort-toggle-btn ${recentSortOrder === "newest" ? "active" : ""}`}
                onClick={() => setRecentSortOrder("newest")}
                title="Sortuj od najnowszych"
              >
                Od najnowszych
              </button>
              <button 
                type="button" 
                className={`sort-toggle-btn ${recentSortOrder === "oldest" ? "active" : ""}`}
                onClick={() => setRecentSortOrder("oldest")}
                title="Sortuj od najstarszych"
              >
                Od najstarszych
              </button>
            </div>
          </div>
          <div className="media-selector-scroll-wrapper">
            <button 
              type="button" 
              className="scroll-btn left" 
              onClick={() => scrollRow(recentScrollRef, "left")}
              title="Przewiń w lewo"
            >
              ‹
            </button>
            <div className="media-selector-scroll" ref={recentScrollRef}>
              {recentVideos.map((vid) => {
                const isCustom = vid.id.startsWith("custom_");
                const isActive = currentVideo.id === vid.id;
                const prog = videoProgress[vid.id];
                return (
                  <div
                    key={vid.id}
                    className={`video-tile ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectVideo(vid)}
                  >
                    <div className="video-tile-thumbnail-wrapper">
                      <img
                        src={`https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg`}
                        alt={vid.title}
                        className="video-tile-thumbnail"
                      />
                      {isActive && <div className="video-tile-active-badge">Aktualny</div>}
                      {isCustom && (
                        <button
                          className="video-tile-delete-btn"
                          onClick={(e) => handleDeleteCustomVideo(e, vid.id)}
                          title="Usuń z historii"
                        >
                          ✕
                        </button>
                      )}
                      {prog && prog.progressPercent > 0 && (
                        <div className="video-tile-progress-bar-wrapper">
                          <div 
                            className="video-tile-progress-bar" 
                            style={{ width: `${Math.min(100, prog.progressPercent)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="video-tile-info">
                      <h4 className="video-tile-title">{vid.title}</h4>
                    </div>
                  </div>
                );
              })}
            </div>
            <button 
              type="button" 
              className="scroll-btn right" 
              onClick={() => scrollRow(recentScrollRef, "right")}
              title="Przewiń w prawo"
            >
              ›
            </button>
          </div>
        </div>

        {/* Row 2: Nieoglądane */}
        <div className="media-selector-row">
          <div className="media-selector-row-header">
            <div className="media-selector-row-title">
              <span>📺 Nieoglądane</span>
            </div>
            <div className="media-selector-sort-controls">
              <span className="sort-label">Sortowanie:</span>
              <button 
                type="button" 
                className={`sort-toggle-btn ${unwatchedSortOrder === "newest" ? "active" : ""}`}
                onClick={() => setUnwatchedSortOrder("newest")}
                title="Sortuj od najnowszych"
              >
                Od najnowszych
              </button>
              <button 
                type="button" 
                className={`sort-toggle-btn ${unwatchedSortOrder === "oldest" ? "active" : ""}`}
                onClick={() => setUnwatchedSortOrder("oldest")}
                title="Sortuj od najstarszych"
              >
                Od najstarszych
              </button>
            </div>
          </div>
          {unwatchedVideos.length === 0 ? (
            <div className="media-selector-empty-text">Wszystkie wideo zostały obejrzane! 🎉</div>
          ) : (
            <div className="media-selector-scroll-wrapper">
              <button 
                type="button" 
                className="scroll-btn left" 
                onClick={() => scrollRow(unwatchedScrollRef, "left")}
                title="Przewiń w lewo"
              >
                ‹
              </button>
              <div className="media-selector-scroll" ref={unwatchedScrollRef}>
                {unwatchedVideos.map((vid) => {
                  const isCustom = vid.id.startsWith("custom_");
                  const isActive = currentVideo.id === vid.id;
                  const prog = videoProgress[vid.id];
                  return (
                    <div
                      key={vid.id}
                      className={`video-tile ${isActive ? "active" : ""}`}
                      onClick={() => handleSelectVideo(vid)}
                    >
                      <div className="video-tile-thumbnail-wrapper">
                        <img
                          src={`https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg`}
                          alt={vid.title}
                          className="video-tile-thumbnail"
                        />
                        {isActive && <div className="video-tile-active-badge">Aktualny</div>}
                        {isCustom && (
                          <button
                            className="video-tile-delete-btn"
                            onClick={(e) => handleDeleteCustomVideo(e, vid.id)}
                            title="Usuń z historii"
                          >
                            ✕
                          </button>
                        )}
                        {prog && prog.progressPercent > 0 && (
                          <div className="video-tile-progress-bar-wrapper">
                            <div 
                              className="video-tile-progress-bar" 
                              style={{ width: `${Math.min(100, prog.progressPercent)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="video-tile-info">
                        <h4 className="video-tile-title">{vid.title}</h4>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button 
                type="button" 
                className="scroll-btn right" 
                onClick={() => scrollRow(unwatchedScrollRef, "right")}
                title="Przewiń w prawo"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Video + Subtitles & Explanations */}
      <div className="media-workspace-grid">
        
        {/* Left Side: Video + Dictionary Info */}
        <div className="media-left-column">
          <div className="video-player-wrapper glass-panel">
            <div id="youtube-player" className="youtube-iframe"></div>
          </div>

          {/* Quick Dictionary Panel */}
          <div className="quick-dictionary-panel glass-panel">
            <h3 className="panel-header">📓 Słownik i Tłumaczenie</h3>
            
            {/* Word translation (if a word is clicked) */}
            {selectedWord && (
              <div className="word-translate-result animate-fade-in" style={{ marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.25rem" }}>
                <div className="word-header-row">
                  <span className="original-word">{selectedWord}</span>
                  <button 
                    className="word-details-btn" 
                    title="Szczegółowe objaśnienie słownikowe"
                    onClick={() => setExplanationWord(selectedWord)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Więcej szczegółów
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                      </svg>
                    </span>
                  </button>
                </div>
                {isTranslating ? (
                  <div className="mini-loader">Tłumaczenie słówka...</div>
                ) : (
                  <>
                    <p className="translated-text">{wordTranslation}</p>
                    {wordSentenceTranslation && (
                      <p className="translated-sentence-text" style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--slate-500)", marginTop: "4px", marginBottom: "8px", lineHeight: "1.35" }}>
                        {wordSentenceTranslation}
                      </p>
                    )}
                    <button
                      className={`btn-save-vocabulary ${isSaved ? "saved" : ""}`}
                      onClick={handleSaveWord}
                      disabled={isSaved}
                    >
                      {isSaved ? "Zapisano słówko! ✓" : "Zapisz słówko (+)"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Segment phrase translation (if active segment is present) */}
            {activeSegmentIndex !== -1 ? (
              <div className="phrase-translate-result animate-fade-in">
                <div className="phrase-header-row">
                  <span className="phrase-label">Tłumaczenie całej frazy:</span>
                  {!isPlaying && (
                    <span className="phrase-status-badge">Wideo wstrzymane ⏸</span>
                  )}
                </div>
                <p className="phrase-english-text">
                  "{currentVideo.transcript[activeSegmentIndex].text}"
                </p>
                {isTranslatingSegment ? (
                  <div className="mini-loader">Tłumaczenie całej frazy...</div>
                ) : segmentTranslation ? (
                  <>
                    <p className="translated-text phrase-translated">{segmentTranslation}</p>
                    <button
                      className={`btn-save-vocabulary ${isSegmentSaved ? "saved" : ""}`}
                      onClick={handleSaveSegmentPhrase}
                      disabled={isSegmentSaved}
                      style={{ background: "linear-gradient(135deg, var(--secondary-500), var(--secondary-600))", borderColor: "transparent" }}
                    >
                      {isSegmentSaved ? "Zapisano frazę! ✓" : "Zapisz całą frazę (+)"}
                    </button>
                  </>
                ) : (
                  <p className="phrase-placeholder-text" style={{ fontSize: "0.9rem", color: "var(--slate-500)", fontStyle: "italic" }}>
                    Zatrzymaj wideo lub kliknij linię tekstu, aby automatycznie wyświetlić tłumaczenie całej frazy.
                  </p>
                )}
              </div>
            ) : (
              <p className="dictionary-placeholder">
                Kliknij słowo w transkrypcji po prawej, aby je przetłumaczyć, lub zatrzymaj wideo, aby zobaczyć tłumaczenie całej wypowiedzi.
              </p>
            )}

            {/* Notebook Words & Exercise */}
            <div className="media-notebook-section" style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
              <h4 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--slate-800)" }}>
                Słówka z tego tekstu ({notebookWords.length})
              </h4>
              
              {notebookWords.length > 0 ? (
                <>
                  <div className="media-notebook-list" style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
                    {notebookWords.map((word, idx) => (
                      <div key={idx} style={{ padding: "0.5rem", background: "var(--slate-50)", borderRadius: "8px", fontSize: "0.9rem" }}>
                        <strong>{word.original}</strong> — {word.translated}
                      </div>
                    ))}
                  </div>

                  {!exerciseData && !exerciseLoading && (
                    <button 
                      onClick={handleStartExercise}
                      className="btn-primary" 
                      style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "8px" }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
                      </svg>
                      Przećwicz te słówka (Tłumaczenie zdania)
                    </button>
                  )}

                  {exerciseLoading && (
                    <div className="mini-loader" style={{ marginTop: "1rem" }}>Generowanie ćwiczenia...</div>
                  )}

                  {exerciseData && (
                    <div className="exercise-container glass-panel" style={{ marginTop: "1rem", padding: "1rem", background: "var(--primary-50)", border: "1px solid var(--primary-200)" }}>
                      <h5 style={{ color: "var(--primary-700)", marginBottom: "0.5rem" }}>Przetłumacz na angielski:</h5>
                      <p style={{ fontSize: "1.05rem", marginBottom: "1rem", fontWeight: "500" }}>{exerciseData.sentence_pl}</p>
                      
                      <div style={{ marginBottom: "1rem" }}>
                        {showExerciseHint ? (
                          <p style={{ fontSize: "0.85rem", color: "var(--slate-600)" }}>
                            Użyj słów: <strong>{exerciseData.target_words.join(", ")}</strong>
                          </p>
                        ) : (
                          <button 
                            onClick={() => setShowExerciseHint(true)}
                            className="btn-secondary"
                            style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                          >
                            💡 Pokaż podpowiedź ze słówkami
                          </button>
                        )}
                      </div>

                      <textarea
                        value={exerciseTranslation}
                        onChange={e => setExerciseTranslation(e.target.value)}
                        placeholder="Wpisz swoje tłumaczenie tutaj..."
                        className="premium-input"
                        style={{ minHeight: "80px", marginBottom: "1rem", resize: "vertical" }}
                        disabled={exerciseChecking || exerciseResult}
                      />

                      {!exerciseResult ? (
                        <button 
                          onClick={handleCheckExercise} 
                          className="btn-primary" 
                          disabled={!exerciseTranslation.trim() || exerciseChecking}
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          {exerciseChecking ? "Sprawdzanie..." : "Sprawdź tłumaczenie"}
                        </button>
                      ) : (
                        <div className={`exercise-result ${exerciseResult.status}`} style={{ marginTop: "1rem", padding: "1rem", borderRadius: "8px", background: exerciseResult.status === 'correct' ? '#ecfdf5' : exerciseResult.status === 'acceptable' ? '#fffbeb' : '#fef2f2', border: `1px solid ${exerciseResult.status === 'correct' ? '#10b981' : exerciseResult.status === 'acceptable' ? '#f59e0b' : '#ef4444'}` }}>
                          <h5 style={{ color: exerciseResult.status === 'correct' ? '#047857' : exerciseResult.status === 'acceptable' ? '#b45309' : '#b91c1c', marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {exerciseResult.status === 'correct' && "✅ Rewelacja!"}
                            {exerciseResult.status === 'acceptable' && "⚠️ Dobrze, ale można lepiej!"}
                            {exerciseResult.status === 'incorrect' && "❌ Spróbuj jeszcze raz!"}
                          </h5>
                          <p style={{ fontSize: "0.95rem", whiteSpace: "pre-wrap", color: "var(--slate-800)" }}>{exerciseResult.feedback}</p>
                          <button 
                            onClick={handleStartExercise}
                            className="btn-secondary" 
                            style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}
                          >
                            Następne ćwiczenie
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: "0.9rem", color: "var(--slate-500)", fontStyle: "italic" }}>
                  Zapisuj nowe słówka podczas oglądania, aby generować z nich ćwiczenia tłumaczeniowe.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Transcript & Joke Explanation */}
        <div className="media-right-column">
          
          {/* Transcript Panel */}
          <div className="transcript-panel glass-panel">
            <div className="panel-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M12 2a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                Transkrypcja stand-upu
              </span>
              <button
                type="button"
                className={`autoscroll-toggle-btn ${autoScrollEnabled ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Autoscroll toggle button clicked! Current state:", autoScrollEnabled, " -> Toggling to:", !autoScrollEnabled);
                  setAutoScrollEnabled(!autoScrollEnabled);
                }}
                title={autoScrollEnabled ? "Wyłącz automatyczne przewijanie napisów" : "Włącz automatyczne przewijanie napisów"}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {autoScrollEnabled ? (
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </>
                    )}
                  </svg>
                  Autoscroll: {autoScrollEnabled ? "WŁ" : "WYŁ"}
                </span>
              </button>
            </div>
            <div className="transcript-list">
              {(currentVideo.transcript || []).length > 0 ? (
                (currentVideo.transcript || []).map((seg, idx) => (
                  <div
                    key={idx}
                    data-index={idx}
                    className={`transcript-segment-card ${activeSegmentIndex === idx ? "active" : ""}`}
                    onClick={() => handleCardClick(seg, idx)}
                  >
                    <div className="segment-left-col">
                      <span className="segment-time-badge">
                        {Math.floor(seg.start / 60)}:{(Math.floor(seg.start) % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <div className="segment-content">
                      <p className="segment-text-line">{renderInteractiveText(seg.text, idx)}</p>
                      <div className="segment-actions">
                        <button
                          className="segment-action-btn practice"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePracticePronunciation(seg.text);
                          }}
                          title="Przećwicz wymowę i intonację z mikrofonem"
                        >
                          Ćwicz wymowę 🎤
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-transcript-container" style={{ padding: '2rem', textAlign: 'center' }}>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--slate-800)' }}>Brak transkrypcji</h4>
                  <p style={{ marginBottom: '1.5rem', color: 'var(--slate-600)' }}>Ten film nie posiada angielskich napisów. Możesz wgrać własny plik .srt lub wkleić jego zawartość.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <label className="btn-save-vocabulary" style={{ cursor: 'pointer', background: 'var(--primary-600)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px' }}>
                      Załaduj plik .srt
                      <input type="file" accept=".srt" onChange={handleSrtUpload} style={{ display: 'none' }} />
                    </label>
                    
                    <span style={{ color: 'var(--slate-400)' }}>lub wklej tekst SRT</span>
                    
                    <textarea 
                      value={pastedSrt} 
                      onChange={(e) => setPastedSrt(e.target.value)}
                      placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;Przykładowy tekst..."
                      style={{ width: '100%', minHeight: '120px', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', fontFamily: 'monospace' }}
                    />
                    <button 
                      className="btn-save-vocabulary" 
                      onClick={handlePastedSrt}
                      style={{ width: '100%', background: 'linear-gradient(135deg, var(--secondary-500), var(--secondary-600))', color: 'white' }}
                    >
                      Wgraj wklejone napisy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Reused Modals */}
      {showPracticeModal && (
        <PronunciationPracticeModal
          targetText={practiceText}
          user={user}
          onClose={() => setShowPracticeModal(false)}
        />
      )}

      {explanationWord && (
        <WordExplanationModal
          wordOrPhrase={explanationWord}
          user={user}
          onClose={() => setExplanationWord(null)}
        />
      )}
    </div>
  );
}

export default MediaBuddy;
