import React, { useState, useEffect, useRef, useMemo } from "react";
import { API_BASE_URL } from "../../config";
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
    description: "A hilarious talk about what happens when you reply to a spam email. Learn natural humor, storytelling idioms, and persuasive tone.",
    transcript: ensureCompleteSentences(transcriptsData.james_veitch_spam)
  },
  {
    id: "james_veitch_unsubscribe",
    title: "James Veitch - The Agony of Unsubscribing",
    youtubeId: "Dceyy0cX6J4",
    description: "Everyday frustration turned into comedy. Great practice for modern conversational phrases, retail emails, and British humor.",
    transcript: ensureCompleteSentences(transcriptsData.james_veitch_unsubscribe)
  },
  {
    id: "jeff_allen_teenagers",
    title: "Jeff Allen - Teenagers (Dry Bar Comedy)",
    youtubeId: "cqjhCC4sP4Q",
    description: "Classic American stand-up comedy about family life and teenage logic. Clear pronunciation with authentic colloquial vocabulary.",
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
    name: "TED Talks (Inspirujące przemówienia)",
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

const formatTime = (secs) => {
  if (!secs || isNaN(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const loadSavedCustomVideos = () => {
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
};

const getInitialVideo = () => {
  try {
    const savedId = localStorage.getItem("media_buddy_last_video_id");
    const savedYoutubeId = localStorage.getItem("media_buddy_last_youtube_id");
    const customList = loadSavedCustomVideos();
    const allAvailable = [...CURATED_VIDEOS, ...customList];

    if (savedId || savedYoutubeId) {
      const match = allAvailable.find(
        (v) => (savedId && v.id === savedId) || (savedYoutubeId && v.youtubeId === savedYoutubeId)
      );
      if (match) return match;
    }

    // Fallback: check most recently watched in media_buddy_video_progress
    const savedProgress = localStorage.getItem("media_buddy_video_progress");
    if (savedProgress) {
      const prog = JSON.parse(savedProgress);
      const ids = Object.keys(prog);
      if (ids.length > 0) {
        ids.sort((a, b) => (prog[b]?.lastWatched || 0) - (prog[a]?.lastWatched || 0));
        const recentId = ids[0];
        const match = allAvailable.find((v) => v.id === recentId || v.youtubeId === recentId);
        if (match) return match;
      }
    }
  } catch (e) {
    console.error("Error retrieving initial video", e);
  }
  return CURATED_VIDEOS[0];
};

const getInitialVideoTime = (video) => {
  try {
    if (!video) return 0;
    const directTime = localStorage.getItem(`media_buddy_last_time_${video.id}`)
      || (video.youtubeId ? localStorage.getItem(`media_buddy_last_time_${video.youtubeId}`) : null);
    if (directTime && !isNaN(parseFloat(directTime))) {
      return Math.max(0, parseFloat(directTime));
    }
    const savedProgress = localStorage.getItem("media_buddy_video_progress");
    if (savedProgress) {
      const prog = JSON.parse(savedProgress);
      const time = prog[video.id]?.currentTime || (video.youtubeId ? prog[video.youtubeId]?.currentTime : undefined);
      if (time && !isNaN(time)) {
        return Math.max(0, time);
      }
    }
  } catch (e) {
    console.error("Error retrieving initial video time", e);
  }
  return 0;
};

function MediaBuddy({ user, subscription, onOpenPaywall }) {
  const isLocked = !user?.is_admin && !subscription?.is_admin && !subscription?.can_access_media;

  useEffect(() => {
    if (isLocked && onOpenPaywall) {
      onOpenPaywall({ feature: 'media' });
    }
  }, [isLocked]);

  const [currentVideo, setCurrentVideo] = useState(() => getInitialVideo());
  const initialTime = useMemo(() => getInitialVideoTime(currentVideo), []);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const targetSeekTimeRef = useRef(initialTime);
  const [videoDuration, setVideoDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // New Figma Layout States
  const [isVideoGalleryOpen, setIsVideoGalleryOpen] = useState(false);
  const [showBilingual, setShowBilingual] = useState(true);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [translationsCache, setTranslationsCache] = useState({});

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

  // Challenge Mode: Blur original text to practice translation
  const [blurChallengeEnabled, setBlurChallengeEnabled] = useState(() => {
    try {
      return localStorage.getItem("speakling_media_blur_challenge") === "true";
    } catch {
      return false;
    }
  });
  // Individual sentence blur overrides: { [idx]: boolean }
  const [segmentBlurOverrides, setSegmentBlurOverrides] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem("speakling_media_blur_challenge", blurChallengeEnabled ? "true" : "false");
    } catch { }
  }, [blurChallengeEnabled]);

  const toggleSegmentBlur = (e, idx, isActive) => {
    e.stopPropagation();
    const currentlyBlurred = segmentBlurOverrides[idx] !== undefined
      ? segmentBlurOverrides[idx]
      : Boolean(blurChallengeEnabled && isActive && !isPlaying);

    const willBeBlurred = !currentlyBlurred;
    setSegmentBlurOverrides((prev) => ({
      ...prev,
      [idx]: willBeBlurred
    }));

    if (willBeBlurred && !translationsCache[idx]) {
      translateActiveSegment(idx);
    }
  };

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

  const [customVideos, setCustomVideos] = useState(() => loadSavedCustomVideos());

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

  // Fetch words in vocabulary for this video
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
      const selectedWords = shuffledWords.slice(0, 30);

      const res = await fetch(`${API_BASE_URL}/api/vocabulary/generate-exercise`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({ words: selectedWords })
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

  // Sync sort orders
  useEffect(() => {
    try {
      localStorage.setItem("media_buddy_recent_sort_order", recentSortOrder);
    } catch (e) {
      console.error("Failed to save recentSortOrder to localStorage", e);
    }
  }, [recentSortOrder]);

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

  const handleDeleteCustomVideo = (e, videoId) => {
    e.stopPropagation();
    const updated = customVideos.filter((v) => v.id !== videoId);
    setCustomVideos(updated);
    if (currentVideo.id === videoId) {
      setCurrentVideo(CURATED_VIDEOS[0]);
    }
  };

  // Modals & Refs
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceText, setPracticeText] = useState("");
  const [explanationWord, setExplanationWord] = useState(null);

  const playerRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const transcriptListRef = useRef(null);
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
      const scrollAmount = 480;
      ref.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  // Level & Category helper
  const videoMeta = useMemo(() => {
    if (!currentVideo) return { level: "B2", category: "General" };
    const title = (currentVideo.title || "").toLowerCase();
    if (title.includes("spam") || title.includes("unsubscribe") || title.includes("veitch")) {
      return { level: "B2", category: "Humour & Email" };
    }
    if (title.includes("teenager") || title.includes("allen") || title.includes("dry bar")) {
      return { level: "B1", category: "Stand-up Comedy" };
    }
    if (title.includes("procrastinator") || title.includes("ted") || title.includes("urban")) {
      return { level: "B2", category: "Psychology & Ideas" };
    }
    if (title.includes("git") || title.includes("code") || title.includes("web") || title.includes("fireship")) {
      return { level: "B2", category: "Tech & Coding" };
    }
    if (title.includes("body language") || title.includes("leader")) {
      return { level: "C1", category: "Leadership & Body Language" };
    }
    return { level: "B2", category: "Business & Life" };
  }, [currentVideo]);

  // Words worth keeping pills
  const keyWordsList = useMemo(() => {
    const list = [];
    notebookWords.forEach(w => {
      if (w.original && !list.includes(w.original.toLowerCase())) {
        list.push(w.original.toLowerCase());
      }
    });
    if (currentVideo?.transcript) {
      const stopwords = new Set(["the", "and", "that", "this", "with", "from", "they", "have", "were", "what", "when", "your", "will", "would", "about", "there", "their", "which", "could", "laughter", "cheering", "applause", "hello", "going", "know", "said", "just"]);
      for (const seg of currentVideo.transcript) {
        const words = (seg.text || "").replace(/[^a-zA-Z\s]/g, "").split(/\s+/);
        for (const w of words) {
          const clean = w.toLowerCase().trim();
          if (clean.length > 5 && !stopwords.has(clean) && !list.includes(clean)) {
            list.push(clean);
            if (list.length >= 8) break;
          }
        }
        if (list.length >= 8) break;
      }
    }
    if (list.length === 0) {
      return ["adapt", "supportive", "clarify", "encourage", "perspective"];
    }
    return list.slice(0, 8);
  }, [notebookWords, currentVideo]);

  // Total Duration
  const totalDuration = useMemo(() => {
    if (videoDuration > 0) return videoDuration;
    if (currentVideo?.transcript && currentVideo.transcript.length > 0) {
      return currentVideo.transcript[currentVideo.transcript.length - 1].end || 150;
    }
    return 150;
  }, [videoDuration, currentVideo]);

  // Save playback progress and last active video
  const saveProgress = (time, duration) => {
    const activeVid = currentVideoRef.current;
    if (!activeVid) return;
    const dur = duration || videoDuration || 0;
    if (time === undefined || isNaN(time) || time < 0) return;

    try {
      localStorage.setItem("media_buddy_last_video_id", activeVid.id);
      if (activeVid.youtubeId) {
        localStorage.setItem("media_buddy_last_youtube_id", activeVid.youtubeId);
      }
      localStorage.setItem(`media_buddy_last_time_${activeVid.id}`, String(time));
      if (activeVid.youtubeId) {
        localStorage.setItem(`media_buddy_last_time_${activeVid.youtubeId}`, String(time));
      }
    } catch (e) {
      console.error("Failed to save last time", e);
    }

    setVideoProgress(prev => {
      const nextProgress = {
        ...prev,
        [activeVid.id]: {
          lastWatched: Date.now(),
          currentTime: time,
          duration: dur,
          progressPercent: dur > 0 ? (time / dur) * 100 : 0
        }
      };
      try {
        localStorage.setItem("media_buddy_video_progress", JSON.stringify(nextProgress));
      } catch (e) {
        console.error("Failed to save progress", e);
      }
      return nextProgress;
    });
  };

  const ensurePlayerPlaceholder = () => {
    let el = document.getElementById("youtube-player");
    if (!el && playerWrapperRef.current) {
      el = document.createElement("div");
      el.id = "youtube-player";
      el.className = "youtube-iframe";
      playerWrapperRef.current.appendChild(el);
    }
    return el;
  };

  // YouTube Player setup
  const createPlayer = (videoId, autoPlay = false, seekTime = 0) => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying player:", e);
      }
      playerRef.current = null;
    }

    ensurePlayerPlaceholder();
    const startSeconds = Math.max(0, Math.floor(seekTime || 0));

    try {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          start: startSeconds > 0 ? startSeconds : undefined,
          origin: window.location.origin,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            if (playerRef.current && typeof playerRef.current.getDuration === "function") {
              const dur = playerRef.current.getDuration();
              if (dur > 0) setVideoDuration(dur);
            }
            if (startSeconds > 0) {
              setCurrentTime(startSeconds);
            }
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

  const switchVideo = (videoId, seekTime = 0, autoPlay = true) => {
    const startSeconds = Math.max(0, Math.floor(seekTime || 0));
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      if (autoPlay) {
        playerRef.current.loadVideoById({
          videoId: videoId,
          startSeconds: startSeconds
        });
      } else {
        playerRef.current.cueVideoById({
          videoId: videoId,
          startSeconds: startSeconds
        });
      }
    } else {
      createPlayer(videoId, autoPlay, seekTime);
    }
  };

  useEffect(() => {
    const resumeTime = getInitialVideoTime(currentVideo);
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        createPlayer(currentVideo.youtubeId, false, resumeTime);
      };
    } else {
      createPlayer(currentVideo.youtubeId, false, resumeTime);
    }

    const handleBeforeUnload = () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        const time = playerRef.current.getCurrentTime();
        const dur = typeof playerRef.current.getDuration === "function" ? playerRef.current.getDuration() : 0;
        saveProgress(time, dur);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
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

  const handlePlayerStateChange = (state) => {
    if (state === 1) { // PLAYING
      setIsPlaying(true);
      window.__speakling_is_media_playing = true;
      document.body.dataset.mediaPlaying = "true";
      clearTrackingTimer();
      timerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);

          if (typeof playerRef.current.getDuration === "function") {
            const dur = playerRef.current.getDuration();
            if (dur > 0) setVideoDuration(dur);
          }

          const currentSecond = Math.floor(time);
          if (currentSecond !== lastSavedSecondRef.current) {
            lastSavedSecondRef.current = currentSecond;
            const duration = typeof playerRef.current.getDuration === "function" ? playerRef.current.getDuration() : 0;
            saveProgress(time, duration);
          }
        }
      }, 100);
    } else {
      setIsPlaying(false);
      window.__speakling_is_media_playing = false;
      document.body.dataset.mediaPlaying = "false";
      clearTrackingTimer();
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        const time = playerRef.current.getCurrentTime();
        const duration = typeof playerRef.current.getDuration === "function" ? playerRef.current.getDuration() : 0;
        if (!isNaN(time) && time > 0) {
          setCurrentTime(time);
          saveProgress(time, duration);
        }
      }
    }
  };

  useEffect(() => {
    window.__speakling_is_media_playing = isPlaying;
    document.body.dataset.mediaPlaying = isPlaying ? "true" : "false";
    return () => {
      window.__speakling_is_media_playing = false;
      document.body.dataset.mediaPlaying = "false";
    };
  }, [isPlaying]);

  const clearTrackingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Switch video
  useEffect(() => {
    currentVideoRef.current = currentVideo;
    if (currentVideo?.id) {
      try {
        localStorage.setItem("media_buddy_last_video_id", currentVideo.id);
        if (currentVideo.youtubeId) {
          localStorage.setItem("media_buddy_last_youtube_id", currentVideo.youtubeId);
        }
      } catch (e) {}
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const resumeTime = getInitialVideoTime(currentVideo) || 0;
    if (window.YT && window.YT.Player) {
      switchVideo(currentVideo.youtubeId, resumeTime, true);
    }

    setCurrentTime(resumeTime);
    setActiveSegmentIndex(-1);
    setIsPlaying(false);
    setSelectedWord("");
    setWordTranslation("");
    setSegmentTranslation("");
    setIsSegmentSaved(false);
    setVideoDuration(0);
    lastSavedSecondRef.current = -1;
    setTranslationsCache({});
  }, [currentVideo]);

  // Player controls
  const togglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } else {
      setIsMuted(!isMuted);
    }
  };

  const speeds = [0.75, 1, 1.25, 1.5];
  const cyclePlaybackRate = () => {
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === "function") {
      playerRef.current.setPlaybackRate(nextSpeed);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * totalDuration;
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(targetTime, true);
      setCurrentTime(targetTime);
      saveProgress(targetTime, totalDuration);
    }
  };

  const toggleFullscreen = () => {
    if (playerWrapperRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.warn(err));
      } else {
        playerWrapperRef.current.requestFullscreen().catch(err => console.warn(err));
      }
    }
  };

  // Auto-scroll and sync active segment
  useEffect(() => {
    const checkTime = isPlaying ? currentTime + 0.4 : currentTime;
    let idx = -1;
    for (let i = (currentVideo.transcript || []).length - 1; i >= 0; i--) {
      const seg = currentVideo.transcript[i];
      if (checkTime >= seg.start && checkTime <= seg.end) {
        idx = i;
        break;
      }
    }

    if (idx !== -1) {
      if (idx !== activeSegmentIndex) {
        setActiveSegmentIndex(idx);
        if (isPlaying && autoScrollEnabled) {
          const activeCard = document.querySelector(`.synced-segment-card[data-index="${idx}"]`);
          if (activeCard) {
            activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      }
    } else {
      const lastSeg = currentVideo.transcript?.[activeSegmentIndex];
      const tolerance = isPlaying ? 0.2 : 0.0;
      if (lastSeg && (checkTime < lastSeg.start - tolerance || checkTime > lastSeg.end + tolerance)) {
        setActiveSegmentIndex(-1);
      }
    }
  }, [currentTime, currentVideo, activeSegmentIndex, isPlaying, autoScrollEnabled]);

  // Translate active segment on pause
  useEffect(() => {
    if (!isPlaying && activeSegmentIndex !== -1) {
      translateActiveSegment(activeSegmentIndex);
    } else if (isPlaying) {
      // Clear translation state when playing so stale data never leaks
      setSegmentTranslation("");
      setIsTranslatingSegment(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeSegmentIndex]);

  const translateActiveSegment = async (index) => {
    const segment = currentVideo.transcript?.[index];
    if (!segment || !segment.text) return;

    if (translationsCache[index]) {
      setSegmentTranslation(translationsCache[index]);
      setIsTranslatingSegment(false);
      return;
    }

    if (latestSegmentIndexRef.current === index && isTranslatingSegment) return;

    latestSegmentIndexRef.current = index;
    setSegmentTranslation(""); // Reset so previous segment's translation never appears
    setIsTranslatingSegment(true);
    setIsSegmentSaved(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ text: segment.text })
      });
      if (latestSegmentIndexRef.current !== index) return;
      if (response.ok) {
        const data = await response.json();
        const tr = data.translation || "Brak tłumaczenia";
        setSegmentTranslation(tr);
        setTranslationsCache(prev => ({ ...prev, [index]: tr }));
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

  // Card click: seek and toggle play/pause
  const handleCardClick = (seg, index) => {
    if (playerRef.current && typeof playerRef.current.getPlayerState === "function") {
      const state = playerRef.current.getPlayerState();
      if (activeSegmentIndex === index) {
        if (state === 1) {
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
        saveProgress(seg.start, totalDuration);
      }
    } else {
      if (activeSegmentIndex === index) {
        setIsPlaying(!isPlaying);
      } else {
        setCurrentTime(seg.start);
        setActiveSegmentIndex(index);
        setIsPlaying(false);
        saveProgress(seg.start, totalDuration);
      }
    }
  };

  // Bookmark entire segment phrase
  const handleBookmarkSegment = async (e, seg, idx) => {
    e.stopPropagation();
    setActiveSegmentIndex(idx);
    let translationToSave = translationsCache[idx] || (activeSegmentIndex === idx ? segmentTranslation : "");
    if (!translationToSave) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
          body: JSON.stringify({ text: seg.text })
        });
        if (res.ok) {
          const data = await res.json();
          translationToSave = data.translation;
          setTranslationsCache(prev => ({ ...prev, [idx]: translationToSave }));
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (translationToSave) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
          body: JSON.stringify({
            original: seg.text,
            translated: translationToSave,
            story_id: `standup_phrase_${currentVideo.id}`
          })
        });
        if (response.ok) {
          const added_doc = await response.json();
          if (!notebookWords.some(w => w.original === added_doc.original)) {
            setNotebookWords(prev => [added_doc, ...prev]);
          }
          window.dispatchEvent(new CustomEvent("vocabulary-updated"));
          setIsSegmentSaved(true);
        }
      } catch (err) {
        console.error("Błąd podczas zapisywania frazy:", err);
      }
    }
  };

  const handleSaveSegmentPhrase = async () => {
    const segment = currentVideo.transcript?.[activeSegmentIndex];
    const trans = translationsCache[activeSegmentIndex] || segmentTranslation;
    if (!segment || !trans) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({
          original: segment.text,
          translated: trans,
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
      console.error(err);
    }
  };

  // Word click
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
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
        body: JSON.stringify({ text: word, context: sentenceContext })
      });
      if (latestWordRef.current !== word) return;
      if (response.ok) {
        const data = await response.json();
        setWordTranslation(data.translation || "Brak tłumaczenia");
        setWordSentenceTranslation(data.sentence_translation || "");
      } else {
        setWordTranslation("Błąd tłumaczenia");
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
        headers: { "Content-Type": "application/json", "X-Session-Token": user.token },
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

  // Video Selection with ANIMATED COLLAPSE
  const handleSelectVideo = (vid) => {
    const formattedTranscript = ensureCompleteSentences(vid.transcript);
    const savedTime = getInitialVideoTime(vid);
    targetSeekTimeRef.current = savedTime;
    setSegmentBlurOverrides({});
    setIsLoadingCustom(true);
    setTimeout(() => {
      setCurrentVideo({
        ...vid,
        transcript: formattedTranscript
      });
      setIsLoadingCustom(false);
      // PŁYNNE ZSUNIĘCIE GALERII ZGODNIE Z POLECENIEM UŻYTKOWNIKA
      setIsVideoGalleryOpen(false);
    }, 300);
  };

  const fetchAndLoadVideo = async (videoId) => {
    setCustomError("");

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
        for (const source of CURATED_SOURCES) {
          const found = source.videos.find(v => v.youtubeId === videoId);
          if (found) {
            title = found.title;
            break;
          }
        }
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

        const savedTime = getInitialVideoTime(staticVid);
        targetSeekTimeRef.current = savedTime;
        setSegmentBlurOverrides({});

        setCustomVideos(prev => {
          const filtered = prev.filter(v => v.youtubeId !== videoId);
          return [staticVid, ...filtered];
        });
        setCurrentVideo(staticVid);
        setCustomUrl("");
        setIsLoadingCustom(false);
        setIsVideoGalleryOpen(false);
      }, 400);
      return;
    }

    setIsLoadingCustom(true);
    let newTranscript = [];
    let newTitle = `Własne wideo (${videoId})`;
    try {
      const endpoint = `${API_BASE_URL}/api/media/transcript?video_id=${videoId}&use_whisper=false`;
      const response = await fetch(endpoint, {
        headers: { "X-Session-Token": user ? user.token : "" }
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
        setCustomError(errData.error || "Błąd podczas pobierania transkrypcji.");
      }
    } catch (err) {
      console.error(err);
      setCustomError("Błąd pobierania transkrypcji z serwisu YouTube.");
    } finally {
      const newCustomVid = {
        id: `custom_${videoId}`,
        title: newTitle,
        youtubeId: videoId,
        transcript: newTranscript.length > 0 ? ensureCompleteSentences(newTranscript) : []
      };

      const savedTime = getInitialVideoTime(newCustomVid);
      targetSeekTimeRef.current = savedTime;
      setSegmentBlurOverrides({});

      setCustomVideos(prev => {
        const filtered = prev.filter(v => v.youtubeId !== videoId);
        return [newCustomVid, ...filtered];
      });
      setCurrentVideo(newCustomVid);
      setCustomUrl("");
      setIsLoadingCustom(false);
      setIsVideoGalleryOpen(false);
    }
  };

  const handleLoadCustomVideo = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const videoId = extractVideoId(customUrl);
    if (!videoId || videoId.length !== 11) {
      setCustomError("Nieprawidłowy adres URL lub ID wideo (musi mieć 11 znaków).");
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
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
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
        setShowAddMediaModal(false);
      } else {
        setCustomError("Plik SRT jest pusty lub ma nieprawidłowy format.");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
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
        setShowAddMediaModal(false);
      } else {
        setCustomError("Nie rozpoznano prawidłowego formatu SRT.");
      }
    } else {
      setCustomError("Tekst musi być w formacie SRT (np. '00:00:01,000 --> 00:00:04,000').");
    }
  };

  const handleCopyTranscript = () => {
    if (!currentVideo?.transcript) return;
    const fullText = currentVideo.transcript.map(s => s.text).join("\n");
    navigator.clipboard.writeText(fullText);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleVoiceAiClick = () => {
    const textToPractice = activeSegmentIndex !== -1 && currentVideo?.transcript?.[activeSegmentIndex]?.text
      ? currentVideo.transcript[activeSegmentIndex].text
      : (currentVideo?.transcript?.[0]?.text || currentVideo?.title || "Welcome to the lesson");
    handlePracticePronunciation(textToPractice);
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

      {/* Top Header Section — Figma Design */}
      <div className="mediabuddy-header-section">
        <div className="mediabuddy-title-row">
          <div className="mediabuddy-title-col">
            <h1 className="mediabuddy-main-title">Listen closely. Learn naturally.</h1>
            <p className="mediabuddy-main-subtitle">
              Turn everyday audio and video into a focused English lesson.
            </p>
          </div>
          <button
            type="button"
            className="btn-add-media"
            onClick={() => setShowAddMediaModal(true)}
            title="Dodaj własne wideo lub napisy"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Add media
          </button>
        </div>

        {/* Toolbar Bar */}
        <div className="mediabuddy-toolbar-row">
          <button
            type="button"
            className={`toolbar-pill-btn ${recentVideos.some(v => v.id === currentVideo.id) ? "active" : ""}`}
            onClick={() => setIsVideoGalleryOpen(prev => !prev)}
            title="Pokaż moje lekcje"
          >
            My lessons
          </button>

          {/* Video Button — Toggles animated drawer */}
          <button
            type="button"
            className={`toolbar-pill-btn video-pill-btn ${isVideoGalleryOpen ? "active" : ""}`}
            onClick={() => setIsVideoGalleryOpen(prev => !prev)}
            title="Rozwiń galerię klipów"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Video
            <svg className={`chevron-indicator ${isVideoGalleryOpen ? "rotate" : ""}`} viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <button
            type="button"
            className="toolbar-pill-btn"
            onClick={() => alert("Wybierz wideo z listy poniżej, a system przetworzy jego ścieżkę audio z transkrypcją.")}
            title="Tryb Audio"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            Audio
          </button>

          <form onSubmit={handleLoadCustomVideo} className="toolbar-input-wrapper">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-link-icon">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              type="text"
              className="toolbar-input"
              placeholder="Paste a video or audio link..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          </form>

          <button
            type="button"
            className="toolbar-analyse-btn"
            onClick={handleLoadCustomVideo}
            disabled={isLoadingCustom}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            Analyse media
          </button>
        </div>
      </div>

      {/* ANIMATED HORIZONTAL CLIPS DRAWER */}
      <div className={`media-clips-drawer ${isVideoGalleryOpen ? "open" : ""}`}>
        <div className="media-clips-drawer-inner">
          <div className="drawer-header-row">
            <div className="drawer-header-left">
              <h2 className="drawer-title">Wybierz klip:</h2>
              <span className="drawer-subtitle">Wybierz wideo, aby automatycznie załadować transkrypcję i lekcję</span>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setIsVideoGalleryOpen(false)}
              title="Zwiń galerię"
            >
              ✕
            </button>
          </div>

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
                >
                  Od najnowszych
                </button>
                <button
                  type="button"
                  className={`sort-toggle-btn ${recentSortOrder === "oldest" ? "active" : ""}`}
                  onClick={() => setRecentSortOrder("oldest")}
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
                >
                  Od najnowszych
                </button>
                <button
                  type="button"
                  className={`sort-toggle-btn ${unwatchedSortOrder === "oldest" ? "active" : ""}`}
                  onClick={() => setUnwatchedSortOrder("oldest")}
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

          {/* Curated Channels & Suggestion Box */}
          <div className="curated-suggestions-section">
            <div className="suggestions-header-row">
              <h4 className="suggestions-title">
                Rekomendowane kanały z gotowymi napisami
              </h4>
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
                          onClick={() => {
                            fetchAndLoadVideo(video.youtubeId);
                            setIsVideoGalleryOpen(false);
                          }}
                          disabled={isLoadingCustom}
                        >
                          Załaduj wideo ▶
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {customError && <p className="loader-error animate-fade-in">{customError}</p>}

      {/* Main 2-column workspace */}
      <div className="media-workspace-grid">
        {/* Left Column: Player + Lesson Details + Words Worth Keeping */}
        <div className="media-left-column">
          {/* Video Player Card */}
          <div className="video-player-card">
            <div className="video-player-frame-wrapper" ref={playerWrapperRef}>
              <div className="video-level-badge">
                {videoMeta.level} · {videoMeta.category}
              </div>
              <div id="youtube-player" className="youtube-iframe"></div>
            </div>

            {/* Custom Control Bar */}
            <div className="video-custom-controls-bar">
              <button
                type="button"
                className="control-icon-btn play-pause-btn"
                onClick={togglePlayPause}
                title={isPlaying ? "Wstrzymaj" : "Odtwórz"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="control-icon-btn mute-btn"
                onClick={toggleMute}
                title={isMuted ? "Włącz dźwięk" : "Wycisz"}
              >
                {isMuted ? (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>

              <span className="video-time-display">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>

              {/* Progress Slider */}
              <div className="video-progress-slider-wrap" onClick={handleSeek} title="Przewiń">
                <div
                  className="video-progress-slider-filled"
                  style={{ width: `${Math.min(100, (currentTime / (totalDuration || 1)) * 100)}%` }}
                />
              </div>

              <button
                type="button"
                className="speed-pill-btn"
                onClick={cyclePlaybackRate}
                title="Zmień prędkość odtwarzania"
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                className={`control-icon-btn ${showBilingual ? "active" : ""}`}
                onClick={() => setShowBilingual(prev => !prev)}
                title="Przełącz napisy dwujęzyczne"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 15h3M14 15h3M7 11h10" />
                </svg>
              </button>

              <button
                type="button"
                className="control-icon-btn fullscreen-btn"
                onClick={toggleFullscreen}
                title="Pełny ekran"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>

          {/* Words Worth Keeping Card — Figma Design (Above) */}
          <div className="words-keeping-card">
            {/* <h3 className="words-keeping-title">Words worth keeping</h3> */}

            <div className="words-keeping-pills">
              {keyWordsList.map((word, idx) => {
                const isWordActive = selectedWord.toLowerCase() === word.toLowerCase();
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`word-keeping-pill ${isWordActive ? "active" : ""}`}
                    onClick={() => handleWordClick(word, currentVideo?.transcript?.[activeSegmentIndex]?.text || "")}
                  >
                    {word}
                  </button>
                );
              })}
            </div>

            <p className="words-keeping-hint">
              Select a word in the transcript to hear it or save it to your vocabulary.
            </p>

            {/* Word translation details */}
            {selectedWord && (
              <div className="word-translate-result animate-fade-in">
                <div className="word-header-row">
                  <span className="original-word">{selectedWord}</span>
                  <button
                    type="button"
                    className="word-details-btn"
                    title="Szczegółowe objaśnienie słownikowe"
                    onClick={() => setExplanationWord(selectedWord)}
                  >
                    Więcej szczegółów 💡
                  </button>
                </div>
                {isTranslating ? (
                  <div className="mini-loader">Tłumaczenie słówka...</div>
                ) : (
                  <>
                    <p className="translated-text">{wordTranslation}</p>
                    {wordSentenceTranslation && (
                      <p className="translated-sentence-text">
                        {wordSentenceTranslation}
                      </p>
                    )}
                    <button
                      type="button"
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

            {/* Interactive Notebook Exercise Section */}
            <div className="media-notebook-section">
              <h4 className="notebook-section-title">
                Słówka z tego materiału w Twoim notesie ({notebookWords.length})
              </h4>

              {notebookWords.length > 0 ? (
                <>
                  <div className="media-notebook-list">
                    {notebookWords.map((word, idx) => (
                      <div key={idx} className="notebook-word-item">
                        <strong>{word.original}</strong> — {word.translated}
                      </div>
                    ))}
                  </div>

                  {!exerciseData && !exerciseLoading && (
                    <button
                      type="button"
                      onClick={handleStartExercise}
                      className="btn-exercise-launch"
                    >
                      Przećwicz te słówka (Tłumaczenie zdania)
                    </button>
                  )}

                  {exerciseLoading && (
                    <div className="mini-loader" style={{ marginTop: "1rem" }}>Generowanie ćwiczenia...</div>
                  )}

                  {exerciseData && (
                    <div className="exercise-container">
                      <h5 className="exercise-heading">Przetłumacz na angielski:</h5>
                      <p className="exercise-prompt">{exerciseData.sentence_pl}</p>

                      <div style={{ marginBottom: "0.75rem" }}>
                        {showExerciseHint ? (
                          <p className="exercise-hint-text">
                            Użyj słów: <strong>{exerciseData.target_words.join(", ")}</strong>
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowExerciseHint(true)}
                            className="btn-hint"
                          >
                            Pokaż podpowiedź ze słówkami
                          </button>
                        )}
                      </div>

                      <textarea
                        value={exerciseTranslation}
                        onChange={e => setExerciseTranslation(e.target.value)}
                        placeholder="Wpisz swoje tłumaczenie tutaj..."
                        className="exercise-textarea"
                        disabled={exerciseChecking || exerciseResult}
                      />

                      {!exerciseResult ? (
                        <button
                          type="button"
                          onClick={handleCheckExercise}
                          className="btn-exercise-check"
                          disabled={!exerciseTranslation.trim() || exerciseChecking}
                        >
                          {exerciseChecking ? "Sprawdzanie..." : "Sprawdź tłumaczenie"}
                        </button>
                      ) : (
                        <div className={`exercise-result ${exerciseResult.status}`}>
                          <h5>
                            {exerciseResult.status === 'correct' && "✅ Rewelacja!"}
                            {exerciseResult.status === 'acceptable' && "⚠️ Dobrze, ale można lepiej!"}
                            {exerciseResult.status === 'incorrect' && "❌ Spróbuj jeszcze raz!"}
                          </h5>
                          <p>{exerciseResult.feedback}</p>
                          <button
                            type="button"
                            onClick={handleStartExercise}
                            className="btn-exercise-next"
                          >
                            Następne ćwiczenie
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="notebook-empty-hint">
                  Zapisuj nowe słówka podczas oglądania, aby generować z nich ćwiczenia tłumaczeniowe.
                </p>
              )}
            </div>
          </div>

          {/* Lesson Details Card — Figma Design (Below) */}

        </div>

        {/* Right Column: Synced transcript — Figma Design */}
        <div className="media-right-column">
          <div className="synced-transcript-card">


            <div className="synced-transcript-controls">
              <div className="transcript-controls-left">
                {/* <button
                  type="button"
                  // className={`transcript-toggle-pill ${showBilingual ? "active" : ""}`}
                  onClick={() => setShowBilingual(prev => !prev)}
                >
                  {showBilingual ? "English + Polski" : "Tylko angielski"}
                </button> */}

                <button
                  type="button"
                  className={`transcript-toggle-pill ${autoScrollEnabled ? "active" : ""}`}
                  onClick={() => setAutoScrollEnabled(prev => !prev)}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {autoScrollEnabled ? (
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </>
                    )}
                  </svg>
                  Auto-scroll {autoScrollEnabled ? "on" : "off"}
                </button>
              </div>

              {/* Przesuwny przełącznik — Tryb Wyzwania (Blur oryginału) */}
              <div
                className="transcript-switch-wrap"
                title="Włącz tryb wyzwania: po zatrzymaniu wideo tekst angielski zostanie rozmyty, a widoczne będzie tłumaczenie, aby poćwiczyć własne tłumaczenie"
              >
                <span className="transcript-switch-label" onClick={() => {
                  setBlurChallengeEnabled(prev => !prev);
                  setSegmentBlurOverrides({});
                }}>
                  <span className="switch-icon-target">🎯</span>
                  Blur oryginału
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={blurChallengeEnabled}
                  className={`ios-switch-toggle ${blurChallengeEnabled ? "active" : ""}`}
                  onClick={() => {
                    setBlurChallengeEnabled(prev => !prev);
                    setSegmentBlurOverrides({});
                  }}
                  title={blurChallengeEnabled ? "Wyłącz blur oryginału" : "Włącz blur oryginału"}
                >
                  <span className="ios-switch-thumb" />
                </button>
              </div>
            </div>

            <div className="synced-transcript-list" ref={transcriptListRef}>
              {(currentVideo.transcript || []).length > 0 ? (
                (currentVideo.transcript || []).map((seg, idx) => {
                  const isActive = activeSegmentIndex === idx;
                  const segTime = formatTime(seg.start);
                  const translation = translationsCache[idx] || (isActive ? segmentTranslation : "");
                  const isOriginalBlurred = segmentBlurOverrides[idx] !== undefined
                    ? segmentBlurOverrides[idx]
                    : Boolean(blurChallengeEnabled && isActive && !isPlaying);

                  return (
                    <div
                      key={idx}
                      data-index={idx}
                      className={`synced-segment-card ${isActive ? "active" : ""}`}
                      onClick={() => handleCardClick(seg, idx)}
                    >
                      <div className="synced-segment-top-row">
                        <span className={`synced-time-badge ${isActive ? "active-time" : ""}`}>
                          {isActive ? (isPlaying ? `${segTime} · Playing now` : `${segTime} · Paused`) : segTime}
                        </span>
                        <div className="synced-segment-actions">
                          <button
                            type="button"
                            className="synced-action-icon-btn"
                            onClick={(e) => handleBookmarkSegment(e, seg, idx)}
                            title="Zapisz to zdanie do słownika"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill={isSegmentSaved && isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`synced-action-icon-btn blur-btn ${isOriginalBlurred ? "active" : ""}`}
                            onClick={(e) => toggleSegmentBlur(e, idx, isActive)}
                            title={isOriginalBlurred ? "Odkryj oryginał (usuń blur)" : "Zamaż oryginał (Blur)"}
                          >
                            {isOriginalBlurred ? (
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            className="synced-action-icon-btn mic"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePracticePronunciation(seg.text);
                            }}
                            title="Ćwicz wymowę tego zdania"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="22" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="synced-english-wrapper">
                        <p
                          className={`synced-english-text ${isOriginalBlurred ? "is-blurred" : ""}`}
                        >
                          {renderInteractiveText(seg.text, idx)}
                        </p>
                      </div>

                      {((showBilingual || blurChallengeEnabled || isOriginalBlurred) && ((isActive && !isPlaying) || (isOriginalBlurred && !isPlaying))) && (
                        <p className="synced-polish-text animate-fade-in">
                          {isTranslatingSegment && isActive ? (
                            <span className="translation-loading">Tłumaczenie fragmentu...</span>
                          ) : (
                            translation || <span className="translation-empty">Brak tłumaczenia</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty-transcript-container">
                  <h4>Brak transkrypcji</h4>
                  <p>Ten film nie posiada napisów. Dodaj plik .srt przez przycisk „Add media”.</p>
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Button — Figma Design */}
            <div className="synced-transcript-footer">
              <button
                type="button"
                className={`btn-save-sticky-word ${isSaved ? "saved" : ""}`}
                disabled={!selectedWord || isSaved}
                onClick={handleSaveWord}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {selectedWord
                  ? (isSaved ? `Zapisano "${selectedWord}" ✓` : `Save "${selectedWord}"`)
                  : "Wybierz słowo w transkrypcji"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Media Modal */}
      {showAddMediaModal && (
        <div className="media-modal-backdrop animate-fade-in" onClick={() => setShowAddMediaModal(false)}>
          <div className="media-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="media-modal-header">
              <h3>Dodaj własne media</h3>
              <button type="button" className="drawer-close-btn" onClick={() => setShowAddMediaModal(false)}>✕</button>
            </div>

            <div className="media-modal-body">
              <div className="modal-input-group">
                <label>Link do YouTube:</label>
                <form onSubmit={handleLoadCustomVideo} className="modal-form-row">
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                  />
                  <button type="submit" className="modal-action-btn" disabled={isLoadingCustom}>
                    Załaduj
                  </button>
                </form>
              </div>

              <div className="modal-divider"><span>lub napisy</span></div>

              <div className="modal-input-group">
                <label>Wgraj plik z napisami (.srt):</label>
                <label className="modal-file-upload-label">
                  Wybierz plik .srt z dysku
                  <input type="file" accept=".srt" onChange={handleSrtUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="modal-input-group">
                <label>Wklej tekst SRT:</label>
                <textarea
                  value={pastedSrt}
                  onChange={(e) => setPastedSrt(e.target.value)}
                  placeholder="1&#10;00:00:01,000 --> 00:00:04,000&#10;Hello world..."
                  className="modal-textarea"
                />
                <button type="button" className="modal-action-btn full" onClick={handlePastedSrt}>
                  Zastosuj wklejone napisy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
