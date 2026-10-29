import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { API_BASE_URL } from "../../config";
import "./MediaBuddy.css";
import PronunciationPracticeModal from "../Notebook/PronunciationPracticeModal";
import WordExplanationModal from "../Notebook/WordExplanationModal";
import transcriptsData from "./transcripts.json";
import { ensureCompleteSentences, splitBlockIntoSentences } from "./sentenceGrouping";
import { DEMO_VIDEOS, getDemoVideoTranscript, DEMO_VIDEO_VOCAB } from "../../data/demoVideosData";
import { DEMO_DICTIONARY, DEMO_SENTENCES } from "../../data/demoStoriesData";

const SAMPLE_VIDEOS = DEMO_VIDEOS;

const formatTimestamp = (secs) => {
  if (isNaN(secs) || secs < 0) return "00:00:00,000";
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  const milliseconds = Math.floor((secs % 1) * 1000);
  const h = String(hours).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");
  const s = String(seconds).padStart(2, "0");
  const ms = String(milliseconds).padStart(3, "0");
  return `${h}:${m}:${s},${ms}`;
};

const formatShortTime = (secs) => {
  if (isNaN(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const downloadSrtFile = (segments, title) => {
  if (!segments || segments.length === 0) return;
  const srtContent = segments.map((seg, idx) => {
    return `${idx + 1}\n${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}\n${seg.text}\n`;
  }).join("\n");
  const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = (title || "subtitles").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  a.download = `${safeTitle}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const parseSubtitlesOrTranscript = (rawText) => {
  if (!rawText || !rawText.trim()) return [];
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // 1. SRT / VTT cue pattern
  const srtPattern = /(?:(\d+):)?(\d{1,2}):(\d{2})[,\.](\d+)\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[,\.](\d+)/;
  if (text.includes("-->")) {
    const lines = text.split("\n");
    const entries = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      const match = line.match(srtPattern);
      if (match) {
        const [, sh1, sm1, ss1, sms1, sh2, sm2, ss2, sms2] = match;
        const h1 = sh1 ? parseInt(sh1, 10) : 0;
        const start = +(h1 * 3600 + parseInt(sm1, 10) * 60 + parseInt(ss1, 10) + parseInt(sms1, 10) / Math.pow(10, sms1.length)).toFixed(2);
        const h2 = sh2 ? parseInt(sh2, 10) : 0;
        const end = +(h2 * 3600 + parseInt(sm2, 10) * 60 + parseInt(ss2, 10) + parseInt(sms2, 10) / Math.pow(10, sms2.length)).toFixed(2);

        i++;
        const textLines = [];
        while (i < lines.length && lines[i].trim() && !lines[i].match(srtPattern)) {
          const clean = lines[i].replace(/<[^>]+>/g, "").trim();
          if (clean && !clean.match(/^\d+$/)) {
            textLines.push(clean);
          }
          i++;
        }
        const cueText = textLines.join(" ").trim();
        if (cueText) {
          entries.push({ start, end, text: cueText });
        }
      } else {
        i++;
      }
    }
    if (entries.length > 0) return entries;
  }

  // 2. YouTube transcript copy-paste format
  const tsToSec = (str) => {
    const parts = str.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const tsRegex = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
  const temp = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (tsRegex.test(line)) {
      const ts = tsToSec(line);
      i++;
      const parts = [];
      while (i < lines.length && !tsRegex.test(lines[i])) {
        const firstWord = lines[i].split(" ")[0];
        if (tsRegex.test(firstWord)) break;
        parts.push(lines[i]);
        i++;
      }
      const segmentText = parts.join(" ").trim();
      if (segmentText) {
        temp.push({ start: ts, text: segmentText });
      }
    } else {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (match) {
        const ts = tsToSec(match[1]);
        temp.push({ start: ts, text: match[2].trim() });
      }
      i++;
    }
  }

  if (temp.length > 0) {
    temp.sort((a, b) => a.start - b.start);
    return temp.map((item, idx) => {
      let end = idx < temp.length - 1 ? temp[idx + 1].start : item.start + 4.0;
      if (end <= item.start) end = item.start + 3.0;
      return {
        start: +item.start.toFixed(2),
        end: +end.toFixed(2),
        text: item.text
      };
    });
  }

  // 3. Fallback: plain un-timestamped text/script
  const sentences = splitBlockIntoSentences(text);
  if (sentences.length > 0) {
    let curTime = 0.0;
    return sentences.map((s) => {
      const wordsCount = s.split(/\s+/).length;
      const duration = Math.max(2.5, +(wordsCount * 0.45).toFixed(2));
      const seg = {
        start: +curTime.toFixed(2),
        end: +(curTime + duration).toFixed(2),
        text: s
      };
      curTime += duration;
      return seg;
    });
  }

  return [];
};

const CURATED_VIDEOS = DEMO_VIDEOS.map((vid) => ({
  id: vid.id,
  title: vid.title,
  youtubeId: vid.youtubeId || vid.id,
  description: vid.description,
  level: vid.level,
  category: vid.category,
  keyWords: vid.keyWords,
  transcript: ensureCompleteSentences(getDemoVideoTranscript(vid.id || vid.youtubeId) || [])
}));

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

const getUserKey = (user) => {
  if (user?.email) {
    return user.email.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '_');
  }
  return user?.token ? 'auth_user' : 'guest';
};

const checkIsAdmin = (user, subscription) => {
  const isSimulatingUser = subscription?.admin_preview_role && subscription?.admin_preview_role !== 'admin';
  if (isSimulatingUser) return false;
  const email = (user?.email || '').trim().toLowerCase();
  return Boolean(
    user?.is_admin ||
    user?.role === 'admin' ||
    subscription?.is_admin ||
    user?.subscription?.is_admin ||
    email === 'przemek.rakotny@gmail.com' ||
    email === 'przemokoduje@gmail.com'
  );
};

const isProOrAdmin = (user, subscription) => {
  if (checkIsAdmin(user, subscription)) return true;
  const tier = subscription?.tier;
  const status = subscription?.status;
  const canAccess = subscription?.can_access_media;
  return Boolean(canAccess || ((tier === 'pro' || tier === 'intensive') && status !== 'expired'));
};

const loadSavedCustomVideos = (user, subscription) => {
  const userKey = getUserKey(user);
  if (userKey === 'guest') return [];
  try {
    const saved = localStorage.getItem(`media_buddy_custom_videos_${userKey}`);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => ({
      ...v,
      transcript: ensureCompleteSentences(v.transcript)
    }));
  } catch (e) {
    console.error("Failed to load custom videos from localStorage", e);
    return [];
  }
};

const getInitialVideo = (user, subscription) => {
  const userKey = getUserKey(user);
  try {
    let savedId = localStorage.getItem(`media_buddy_last_video_id_${userKey}`);
    let savedYoutubeId = localStorage.getItem(`media_buddy_last_youtube_id_${userKey}`);
    const customList = loadSavedCustomVideos(user, subscription);
    const allAvailable = [...CURATED_VIDEOS, ...customList];

    if (savedId || savedYoutubeId) {
      const match = allAvailable.find(
        (v) => (savedId && v.id === savedId) || (savedYoutubeId && v.youtubeId === savedYoutubeId)
      );
      if (match) return match;
    }

    // Fallback: check most recently watched in media_buddy_video_progress
    const savedProgress = localStorage.getItem(`media_buddy_video_progress_${userKey}`);
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

const getInitialVideoTime = (video, user) => {
  const userKey = getUserKey(user);
  try {
    if (!video) return 0;
    const directTime = localStorage.getItem(`media_buddy_last_time_${userKey}_${video.id}`)
      || (video.youtubeId ? localStorage.getItem(`media_buddy_last_time_${userKey}_${video.youtubeId}`) : null)
      || (userKey === 'guest' ? (localStorage.getItem(`media_buddy_last_time_${video.id}`) || (video.youtubeId ? localStorage.getItem(`media_buddy_last_time_${video.youtubeId}`) : null)) : null);
    if (directTime && !isNaN(parseFloat(directTime))) {
      return Math.max(0, parseFloat(directTime));
    }
    const savedProgress = localStorage.getItem(`media_buddy_video_progress_${userKey}`) || (userKey === 'guest' ? localStorage.getItem("media_buddy_video_progress") : null);
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

function MediaBuddy({ user, subscription, onOpenPaywall, onNavigate }) {
  const userKey = useMemo(() => getUserKey(user), [user]);
  const isPlatformAdmin = checkIsAdmin(user, subscription);
  const isStarterUser = !isProOrAdmin(user, subscription);

  const [currentVideo, setCurrentVideo] = useState(() => getInitialVideo(user, subscription));
  const initialTime = useMemo(() => getInitialVideoTime(currentVideo, user), [currentVideo, user]);
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
  const [addMediaTab, setAddMediaTab] = useState("youtube"); // 'youtube' | 'paste' | 'file'
  const [modalVideoUrl, setModalVideoUrl] = useState("");
  const [isExtractingSubtitles, setIsExtractingSubtitles] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [manualPastedText, setManualPastedText] = useState("");
  const [manualTargetVideoId, setManualTargetVideoId] = useState("");
  const [manualCustomTitle, setManualCustomTitle] = useState("");
  const [uploadedFileStatus, setUploadedFileStatus] = useState(null);
  const fileInputRef = useRef(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [translationsCache, setTranslationsCache] = useState({});

  // Interaction states
  const [selectedWord, setSelectedWord] = useState("");
  const [wordTranslation, setWordTranslation] = useState("");
  const [wordSentenceTranslation, setWordSentenceTranslation] = useState("");
  const [detectedChunk, setDetectedChunk] = useState(null);
  const [chunkTranslation, setChunkTranslation] = useState(null);
  const [chunkType, setChunkType] = useState(null);
  const [isChunkSaved, setIsChunkSaved] = useState(false);
  const [selectedSentenceContext, setSelectedSentenceContext] = useState("");
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

  const [customVideos, setCustomVideos] = useState(() => loadSavedCustomVideos(user, subscription));

  const [videoProgress, setVideoProgress] = useState(() => {
    try {
      const activeKey = user?.email || (user?.uid ? `uid_${user.uid}` : 'guest');
      const saved = localStorage.getItem(`media_buddy_video_progress_${activeKey}`) || localStorage.getItem("media_buddy_video_progress");
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

  const getLocalStorageWordsKey = useCallback((video) => {
    const userKey = user?.email || user?.uid || "guest";
    const vidKey = video?.youtubeId || video?.id || "default";
    return `media_buddy_notebook_words_${userKey}_${vidKey}`;
  }, [user?.email, user?.uid]);

  const getVideoStoryIds = useCallback((video) => {
    if (!video) return [];
    const ordered = [];
    const seen = new Set();
    const addId = (id) => {
      if (id && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    };

    const rawList = [video.youtubeId, video.id].filter(Boolean);
    rawList.forEach(raw => {
      const clean = raw.replace(/^(standup_phrase_custom_|standup_phrase_|standup_custom_|standup_|media_custom_|media_|custom_)+/, "");
      if (clean) {
        addId(`custom_${clean}`);
        addId(clean);
        addId(`media_${clean}`);
        addId(`media_custom_${clean}`);
        addId(`standup_${clean}`);
        addId(`standup_custom_${clean}`);
        addId(`standup_phrase_${clean}`);
        addId(`standup_phrase_custom_${clean}`);
      }
      addId(raw);
    });
    return ordered;
  }, []);

  const [notebookWords, setNotebookWords] = useState(() => {
    if (!currentVideo) return [];
    const userKey = user?.email || user?.uid || "guest";
    const vidKey = currentVideo?.youtubeId || currentVideo?.id || "default";
    const validStoryIds = new Set(getVideoStoryIds(currentVideo));
    try {
      const cached = localStorage.getItem(`media_buddy_notebook_words_${userKey}_${vidKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(w => !w.story_id || validStoryIds.has(w.story_id));
        }
      }
    } catch (e) { }
    return [];
  });

  // Exercise State
  const [exerciseData, setExerciseData] = useState(null);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseTranslation, setExerciseTranslation] = useState("");
  const [exerciseResult, setExerciseResult] = useState(null);
  const [exerciseChecking, setExerciseChecking] = useState(false);
  const [showExerciseHint, setShowExerciseHint] = useState(false);

  // Sync added words immediately to state and localStorage (strictly for current video)
  const saveToNotebookStateAndStorage = useCallback((added_doc) => {
    if (!added_doc) return;
    const activeVid = currentVideoRef.current || currentVideo;
    if (!activeVid) return;
    const validStoryIds = new Set(getVideoStoryIds(activeVid));

    if (!added_doc.story_id && activeVid.youtubeId) {
      added_doc.story_id = `custom_${activeVid.youtubeId}`;
    }

    setNotebookWords(prev => {
      const cleanedPrev = prev.filter(w => !w.story_id || validStoryIds.has(w.story_id));
      const origKey = (added_doc.original || "").trim().toLowerCase();
      const filtered = cleanedPrev.filter(w => (w.original || "").trim().toLowerCase() !== origKey);
      const updated = [added_doc, ...filtered];
      try {
        const storageKey = getLocalStorageWordsKey(activeVid);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        if (activeVid?.youtubeId) {
          const userKey = user?.email || user?.uid || "guest";
          localStorage.setItem(`media_buddy_notebook_words_${userKey}_${activeVid.youtubeId}`, JSON.stringify(updated));
        }
      } catch (e) { }
      return updated;
    });
  }, [currentVideo, user, getLocalStorageWordsKey, getVideoStoryIds]);

  // Fetch words in vocabulary strictly for this video (syncs with Firestore and local storage)
  const fetchNotebookWords = useCallback((targetVideo) => {
    const video = targetVideo || currentVideoRef.current || currentVideo;
    if (!video || !user?.token) return;
    const storageKey = getLocalStorageWordsKey(video);
    const validStoryIds = new Set(getVideoStoryIds(video));
    const storyIds = getVideoStoryIds(video).slice(0, 10).join(",");

    fetch(`${API_BASE_URL}/api/vocabulary?story_id=${encodeURIComponent(storyIds)}`, {
      headers: { "X-Session-Token": user.token }
    })
      .then(res => res.json())
      .then(data => {
        // Discard stale response if active video changed
        if (currentVideoRef.current && currentVideoRef.current.id !== video.id && currentVideoRef.current.youtubeId !== video.youtubeId) {
          return;
        }
        if (Array.isArray(data)) {
          // Strictly filter only words that belong to this video's story_id
          const strictlyThisVideoWords = data.filter(item => {
            if (!item.story_id) return true;
            return validStoryIds.has(item.story_id);
          });

          // De-duplicate by original, keeping both server items and freshly saved video words
          setNotebookWords(prev => {
            const map = new Map();
            strictlyThisVideoWords.forEach(item => {
              const k = (item.original || "").trim().toLowerCase();
              if (k && !map.has(k)) map.set(k, item);
            });

            // Also keep any words currently in prev that strictly belong to this video
            prev.forEach(item => {
              if (item && (!item.story_id || validStoryIds.has(item.story_id))) {
                const k = (item.original || "").trim().toLowerCase();
                if (k && !map.has(k)) map.set(k, item);
              }
            });

            const list = Array.from(map.values());
            try {
              localStorage.setItem(storageKey, JSON.stringify(list));
              if (video.youtubeId) {
                const userKey = user?.email || user?.uid || "guest";
                localStorage.setItem(`media_buddy_notebook_words_${userKey}_${video.youtubeId}`, JSON.stringify(list));
              }
            } catch (e) { }
            return list;
          });
        }
      })
      .catch(err => console.error("Error fetching notebook words:", err));
  }, [currentVideo, user, getLocalStorageWordsKey, getVideoStoryIds]);

  useEffect(() => {
    if (!currentVideo) {
      setNotebookWords([]);
      return;
    }
    const storageKey = getLocalStorageWordsKey(currentVideo);
    const validStoryIds = new Set(getVideoStoryIds(currentVideo));

    // 1. Immediately reset state to this video's cache (or empty array)
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const validCached = parsed.filter(w => !w.story_id || validStoryIds.has(w.story_id));
          setNotebookWords(validCached);
        } else {
          setNotebookWords([]);
        }
      } else {
        setNotebookWords([]);
      }
    } catch (e) {
      setNotebookWords([]);
    }

    // Reset exercise state when video switches
    setExerciseData(null);
    setExerciseResult(null);
    setExerciseTranslation("");
    setShowExerciseHint(false);

    // 2. Fetch fresh words from server for this specific video
    fetchNotebookWords(currentVideo);

    const handleVocabUpdated = () => fetchNotebookWords(currentVideo);
    window.addEventListener("vocabulary-updated", handleVocabUpdated);
    return () => window.removeEventListener("vocabulary-updated", handleVocabUpdated);
  }, [currentVideo, fetchNotebookWords, getLocalStorageWordsKey, getVideoStoryIds]);

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
        headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
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
        headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
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
    return isStarterUser ? CURATED_VIDEOS : [...CURATED_VIDEOS, ...customVideos];
  }, [customVideos, isStarterUser]);

  const getVideoProg = useCallback((vid) => {
    if (!vid) return null;
    return videoProgress[vid.id] || (vid.youtubeId ? videoProgress[vid.youtubeId] : null) || null;
  }, [videoProgress]);

  const recentVideos = useMemo(() => {
    const watched = allVideos.filter(v => Boolean(getVideoProg(v)));
    watched.sort((a, b) => {
      const timeA = getVideoProg(a)?.lastWatched || 0;
      const timeB = getVideoProg(b)?.lastWatched || 0;
      return recentSortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

    if (watched.length < 10) {
      const unwatched = allVideos.filter(v => !getVideoProg(v));
      const padded = recentSortOrder === "newest" ? unwatched : [...unwatched].reverse();
      return [...watched, ...padded].slice(0, 10);
    }
    return watched.slice(0, 10);
  }, [allVideos, getVideoProg, recentSortOrder]);

  const unwatchedVideos = useMemo(() => {
    const list = allVideos.filter(v => {
      const prog = getVideoProg(v);
      return !prog || prog.progressPercent < 25;
    });
    list.sort((a, b) => {
      const progA = getVideoProg(a);
      const progB = getVideoProg(b);
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
  }, [allVideos, getVideoProg, unwatchedSortOrder]);

  // Sync customVideos to user-scoped localStorage
  useEffect(() => {
    if (userKey === 'guest') return;
    try {
      if (customVideos && customVideos.length > 0) {
        localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(customVideos));
      }
    } catch (e) {
      console.error("Failed to save custom videos to localStorage", e);
    }
  }, [customVideos, userKey]);

  // Cloud sync helpers
  const saveCustomVideoToCloud = useCallback((vid) => {
    if (!user || (!user.token && !user.email) || !vid) return;
    const headers = { "Content-Type": "application/json" };
    if (user.token) headers["X-Session-Token"] = user.token;
    fetch(`${API_BASE_URL}/api/media/custom-videos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...vid, user_email: user.email })
    }).catch(err => console.warn("Cloud video save error:", err));
  }, [user?.token, user?.email]);

  const deleteCustomVideoFromCloud = useCallback((videoId) => {
    if (!user || (!user.token && !user.email) || !videoId) return;
    const headers = {};
    if (user.token) headers["X-Session-Token"] = user.token;
    const emailParam = user.email ? `?user_email=${encodeURIComponent(user.email)}` : "";
    fetch(`${API_BASE_URL}/api/media/custom-videos/${encodeURIComponent(videoId)}${emailParam}`, {
      method: "DELETE",
      headers
    }).catch(err => console.warn("Cloud video delete error:", err));
  }, [user?.token, user?.email]);

  const pendingCloudSyncRef = useRef(null);
  const cloudSyncTimerRef = useRef(null);

  const flushProgressToCloud = useCallback(() => {
    if (!pendingCloudSyncRef.current || !user || (!user.token && !user.email)) return;
    const payload = pendingCloudSyncRef.current;
    pendingCloudSyncRef.current = null;
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
      cloudSyncTimerRef.current = null;
    }

    const headers = { "Content-Type": "application/json" };
    if (user.token) headers["X-Session-Token"] = user.token;
    fetch(`${API_BASE_URL}/api/media/state`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, user_email: user.email })
    }).catch(err => console.warn("Failed to sync progress to cloud:", err));
  }, [user?.token, user?.email]);

  const scheduleProgressToCloud = useCallback((activeVid, time, dur) => {
    if (!activeVid || !user || (!user.token && !user.email)) return;
    const progData = {
      lastWatched: Date.now(),
      currentTime: time,
      duration: dur,
      progressPercent: dur > 0 ? (time / dur) * 100 : 0
    };
    const curProgress = {
      [activeVid.id]: progData
    };
    if (activeVid.youtubeId && activeVid.youtubeId !== activeVid.id) {
      curProgress[activeVid.youtubeId] = progData;
    }
    pendingCloudSyncRef.current = {
      video_progress: curProgress,
      last_video_id: activeVid.id,
      last_youtube_id: activeVid.youtubeId || null
    };

    if (!cloudSyncTimerRef.current) {
      cloudSyncTimerRef.current = setTimeout(() => {
        cloudSyncTimerRef.current = null;
        flushProgressToCloud();
      }, 5000);
    }
  }, [user, flushProgressToCloud]);

  // Cloud Sync on Mount or User/Subscription Change
  useEffect(() => {
    const activeKey = getUserKey(user);
    const localVideos = loadSavedCustomVideos(user, subscription);
    if (!isStarterUser && localVideos.length > 0) {
      setCustomVideos(prev => {
        const prevIds = new Set(prev.map(v => v.id));
        const missing = localVideos.filter(v => !prevIds.has(v.id));
        return missing.length > 0 ? [...prev, ...missing] : (prev.length > 0 ? prev : localVideos);
      });
    }
    try {
      const saved = localStorage.getItem(`media_buddy_video_progress_${activeKey}`) || localStorage.getItem("media_buddy_video_progress");
      if (saved) {
        setVideoProgress(JSON.parse(saved));
      }
    } catch (e) { }

    if (!user || (!user.token && !user.email)) return;

    let isMounted = true;
    const fetchCloudData = async () => {
      try {
        const headers = {};
        if (user.token) headers["X-Session-Token"] = user.token;
        const emailParam = user.email ? `?user_email=${encodeURIComponent(user.email.toLowerCase().trim())}` : "";

        // 1. Pobierz własne filmy z bazy danych (tylko PRO / Admin)
        let latestVideos = localVideos;
        if (!isStarterUser) {
          const vidRes = await fetch(`${API_BASE_URL}/api/media/custom-videos${emailParam}`, { headers });
          if (vidRes.ok && isMounted) {
            const vidData = await vidRes.json();
            if (Array.isArray(vidData.videos)) {
              const cloudVideos = vidData.videos.map(v => ({
                ...v,
                transcript: ensureCompleteSentences(v.transcript)
              }));
              if (cloudVideos.length > 0) {
                latestVideos = cloudVideos;
                setCustomVideos(cloudVideos);
                localStorage.setItem(`media_buddy_custom_videos_${activeKey}`, JSON.stringify(cloudVideos));
              } else if (localVideos.length > 0) {
                for (const v of localVideos) {
                  try {
                    await fetch(`${API_BASE_URL}/api/media/custom-videos`, {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({ ...v, user_email: user.email })
                    });
                  } catch (err) { }
                }
              }
            }
          }
        }

        // 2. Pobierz postęp i ostatnio odtwarzany film z chmury (dla wszystkich użytkowników)
        const stateRes = await fetch(`${API_BASE_URL}/api/media/state${emailParam}`, { headers });
        if (stateRes.ok && isMounted) {
          const stateData = await stateRes.json();
          if (stateData.video_progress && Object.keys(stateData.video_progress).length > 0) {
            setVideoProgress(prev => {
              const merged = { ...prev, ...stateData.video_progress };
              localStorage.setItem(`media_buddy_video_progress_${activeKey}`, JSON.stringify(merged));
              return merged;
            });
          }
          const targetLastId = stateData.last_video_id || localStorage.getItem(`media_buddy_last_video_id_${activeKey}`);
          const targetLastYt = stateData.last_youtube_id || localStorage.getItem(`media_buddy_last_youtube_id_${activeKey}`);
          if (targetLastId || targetLastYt) {
            const allAvailable = [...CURATED_VIDEOS, ...latestVideos];
            const matched = allAvailable.find(v => (targetLastId && v.id === targetLastId) || (targetLastYt && v.youtubeId === targetLastYt));
            if (matched && isMounted) {
              setCurrentVideo(matched);
            }
          }
        }
      } catch (err) {
        console.warn("Błąd synchronizacji Media Buddy z chmurą:", err);
      }
    };

    fetchCloudData();
    return () => {
      isMounted = false;
    };
  }, [user, subscription, isStarterUser]);

  const handleDeleteCustomVideo = (e, videoId) => {
    e.stopPropagation();
    const updated = customVideos.filter((v) => v.id !== videoId);
    setCustomVideos(updated);
    try {
      localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(updated));
    } catch (err) { }
    if (currentVideo.id === videoId) {
      setCurrentVideo(CURATED_VIDEOS[0]);
      try {
        localStorage.setItem(`media_buddy_last_video_id_${userKey}`, CURATED_VIDEOS[0].id);
      } catch (err) {}
    }
    deleteCustomVideoFromCloud(videoId);
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
  const customVideosScrollRef = useRef(null);
  const recentScrollRef = useRef(null);
  const unwatchedScrollRef = useRef(null);
  const videoPlayerCardRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const isVideoGalleryOpenRef = useRef(isVideoGalleryOpen);
  const currentVideoId = currentVideo?.id || currentVideo?.youtubeId;
  const prevVideoIdRef = useRef(currentVideoId);

  useEffect(() => {
    isVideoGalleryOpenRef.current = isVideoGalleryOpen;
  }, [isVideoGalleryOpen]);

  useEffect(() => {
    if (prevVideoIdRef.current !== currentVideoId) {
      prevVideoIdRef.current = currentVideoId;
      hasAutoScrolledRef.current = false;
    }
  }, [currentVideoId]);

  const performScrollToPlayer = useCallback(() => {
    requestAnimationFrame(() => {
      const targetElement = videoPlayerCardRef.current || document.querySelector(".video-player-card") || document.querySelector(".media-workspace-grid");
      if (!targetElement) return;

      const topbar = document.querySelector(".mission-topbar") || document.querySelector("header");
      const scrollContainer = targetElement.closest(".view-container") || document.querySelector(".view-container");

      const elementRect = targetElement.getBoundingClientRect();
      const headerBottom = topbar
        ? topbar.getBoundingClientRect().bottom
        : (scrollContainer ? scrollContainer.getBoundingClientRect().top : 0);
      const currentGapBelowHeader = elementRect.top - headerBottom;

      if (scrollContainer) {
        const targetScrollTop = Math.max(0, Math.round(scrollContainer.scrollTop + (currentGapBelowHeader - 20)));
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: "smooth"
        });
      } else {
        const currentScroll = window.scrollY || document.documentElement.scrollTop;
        const targetScrollTop = Math.max(0, Math.round(currentScroll + (currentGapBelowHeader - 20)));
        window.scrollTo({
          top: targetScrollTop,
          behavior: "smooth"
        });
      }
    });
  }, []);

  const scrollToPlayer = useCallback(() => {
    if (hasAutoScrolledRef.current) return;
    hasAutoScrolledRef.current = true;

    if (isVideoGalleryOpenRef.current) {
      setIsVideoGalleryOpen(false);
      setTimeout(() => {
        performScrollToPlayer();
      }, 350);
    } else {
      performScrollToPlayer();
    }
  }, [performScrollToPlayer]);

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
      localStorage.setItem(`media_buddy_last_video_id_${userKey}`, activeVid.id);
      if (activeVid.youtubeId) {
        localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, activeVid.youtubeId);
      }
      localStorage.setItem(`media_buddy_last_time_${userKey}_${activeVid.id}`, String(time));
      if (activeVid.youtubeId) {
        localStorage.setItem(`media_buddy_last_time_${userKey}_${activeVid.youtubeId}`, String(time));
      }
    } catch (e) {
      console.error("Failed to save last time", e);
    }

    setVideoProgress(prev => {
      const progData = {
        lastWatched: Date.now(),
        currentTime: time,
        duration: dur,
        progressPercent: dur > 0 ? (time / dur) * 100 : 0
      };
      const nextProgress = {
        ...prev,
        [activeVid.id]: progData
      };
      if (activeVid.youtubeId && activeVid.youtubeId !== activeVid.id) {
        nextProgress[activeVid.youtubeId] = progData;
      }
      try {
        localStorage.setItem(`media_buddy_video_progress_${userKey}`, JSON.stringify(nextProgress));
      } catch (e) {
        console.error("Failed to save progress", e);
      }
      return nextProgress;
    });

    scheduleProgressToCloud(activeVid, time, dur);
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
      scrollToPlayer();
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
      flushProgressToCloud();
    }
  };

  useEffect(() => {
    return () => {
      flushProgressToCloud();
    };
  }, [flushProgressToCloud]);

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
        localStorage.setItem(`media_buddy_last_video_id_${userKey}`, currentVideo.id);
        if (currentVideo.youtubeId) {
          localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, currentVideo.youtubeId);
        }
      } catch (e) { }
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const resumeTime = getInitialVideoTime(currentVideo, user) || 0;
    if (window.YT && window.YT.Player) {
      switchVideo(currentVideo.youtubeId, resumeTime, true);
    }

    setCurrentTime(resumeTime);
    setActiveSegmentIndex(-1);
    setIsPlaying(false);
    setSelectedWord("");
    setWordTranslation("");
    setWordSentenceTranslation("");
    setDetectedChunk(null);
    setChunkTranslation(null);
    setChunkType(null);
    setIsChunkSaved(false);
    setSelectedSentenceContext("");
    setSegmentTranslation("");
    setIsSegmentSaved(false);
    setIsSaved(false);
    setExerciseData(null);
    setExerciseResult(null);
    setExerciseTranslation("");
    setShowExerciseHint(false);
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
        scrollToPlayer();
        playerRef.current.playVideo();
      }
    } else {
      if (!isPlaying) {
        scrollToPlayer();
      }
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

  const isSeekingRef = useRef(false);

  const calculateSeekTime = (clientX, element) => {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return 0;
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    return ratio * totalDuration;
  };

  const handleSeek = (e) => {
    const targetTime = calculateSeekTime(e.clientX, e.currentTarget);
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(targetTime, true);
      setCurrentTime(targetTime);
      saveProgress(targetTime, totalDuration);
    }
  };

  const handleSeekMouseDown = (e) => {
    const sliderEl = e.currentTarget;
    isSeekingRef.current = true;
    const targetTime = calculateSeekTime(e.clientX, sliderEl);
    setCurrentTime(targetTime);
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(targetTime, true);
    }

    const onMouseMove = (moveEvt) => {
      if (!isSeekingRef.current) return;
      const moveTime = calculateSeekTime(moveEvt.clientX, sliderEl);
      setCurrentTime(moveTime);
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        playerRef.current.seekTo(moveTime, true);
      }
    };

    const onMouseUp = (upEvt) => {
      if (isSeekingRef.current) {
        isSeekingRef.current = false;
        const finalTime = calculateSeekTime(upEvt.clientX, sliderEl);
        setCurrentTime(finalTime);
        if (playerRef.current && typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(finalTime, true);
        }
        saveProgress(finalTime, totalDuration);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleSeekTouchStart = (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const sliderEl = e.currentTarget;
    const targetTime = calculateSeekTime(touch.clientX, sliderEl);
    setCurrentTime(targetTime);
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(targetTime, true);
    }

    const onTouchMove = (moveEvt) => {
      const moveTouch = moveEvt.touches[0];
      if (!moveTouch) return;
      const moveTime = calculateSeekTime(moveTouch.clientX, sliderEl);
      setCurrentTime(moveTime);
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        playerRef.current.seekTo(moveTime, true);
      }
    };

    const onTouchEnd = (endEvt) => {
      const endTouch = endEvt.changedTouches[0];
      if (endTouch) {
        const finalTime = calculateSeekTime(endTouch.clientX, sliderEl);
        setCurrentTime(finalTime);
        if (playerRef.current && typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(finalTime, true);
        }
        saveProgress(finalTime, totalDuration);
      }
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };

    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
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

  // Center active segment vertically (~44% from top of transcript container)
  const centerSegmentInTranscript = useCallback((index, smooth = true) => {
    if (index === null || index === undefined || index < 0) return;
    const listEl = transcriptListRef.current;
    if (!listEl) return;
    const card = listEl.querySelector(`.synced-segment-card[data-index="${index}"]`);
    if (!card) return;

    const listRect = listEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    // Absolute offset of the card's top relative to the list's scrollable content
    const relativeCardTop = cardRect.top - listRect.top + listEl.scrollTop;
    const cardHeight = cardRect.height || 60;
    const containerHeight = listEl.clientHeight || 500;

    // Position the card's vertical center at ~44% from the top of the container.
    // This leaves ~56% of the transcript window below it so the Polish translation
    // is immediately and comfortably visible without being hidden below the bottom edge.
    const targetScrollTop = relativeCardTop + (cardHeight * 0.5) - (containerHeight * 0.44);

    listEl.scrollTo({
      top: Math.max(0, Math.round(targetScrollTop)),
      behavior: smooth ? "smooth" : "auto"
    });
  }, []);

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
        if (autoScrollEnabled) {
          centerSegmentInTranscript(idx, true);
        }
      }
    } else {
      const lastSeg = currentVideo.transcript?.[activeSegmentIndex];
      const tolerance = isPlaying ? 0.2 : 0.0;
      if (lastSeg && (checkTime < lastSeg.start - tolerance || checkTime > lastSeg.end + tolerance)) {
        setActiveSegmentIndex(-1);
      }
    }
  }, [currentTime, currentVideo, activeSegmentIndex, isPlaying, autoScrollEnabled, centerSegmentInTranscript]);

  // Translate active segment on pause
  useEffect(() => {
    if (!isPlaying && activeSegmentIndex !== -1) {
      if (autoScrollEnabled) {
        centerSegmentInTranscript(activeSegmentIndex, true);
      }
      translateActiveSegment(activeSegmentIndex);
    } else if (isPlaying) {
      // Clear translation state when playing so stale data never leaks
      setSegmentTranslation("");
      setIsTranslatingSegment(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeSegmentIndex, autoScrollEnabled, centerSegmentInTranscript]);

  const translateActiveSegment = async (index) => {
    const segment = currentVideo.transcript?.[index];
    if (!segment || !segment.text) return;

    if (translationsCache[index]) {
      setSegmentTranslation(translationsCache[index]);
      setIsTranslatingSegment(false);
      if (autoScrollEnabled) {
        setTimeout(() => centerSegmentInTranscript(index, true), 80);
      }
      return;
    }

    if (DEMO_SENTENCES[segment.text.trim()]) {
      const tr = DEMO_SENTENCES[segment.text.trim()];
      setSegmentTranslation(tr);
      setTranslationsCache(prev => ({ ...prev, [index]: tr }));
      setIsTranslatingSegment(false);
      if (autoScrollEnabled) {
        setTimeout(() => centerSegmentInTranscript(index, true), 80);
      }
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
        if (autoScrollEnabled) {
          setTimeout(() => centerSegmentInTranscript(index, true), 80);
        }
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
        if (autoScrollEnabled) {
          centerSegmentInTranscript(index, true);
        }
      }
    } else {
      if (activeSegmentIndex === index) {
        setIsPlaying(!isPlaying);
      } else {
        setCurrentTime(seg.start);
        setActiveSegmentIndex(index);
        setIsPlaying(false);
        saveProgress(seg.start, totalDuration);
        if (autoScrollEnabled) {
          centerSegmentInTranscript(index, true);
        }
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
          headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
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
      const targetStoryId = currentVideo.youtubeId ? `custom_${currentVideo.youtubeId}` : (currentVideo.id || "media");
      try {
        const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
          body: JSON.stringify({
            original: seg.text,
            translated: translationToSave,
            story_id: targetStoryId,
            item_type: "phrase",
            chunk_type: "Fraza"
          })
        });
        if (response.ok) {
          const added_doc = await response.json();
          saveToNotebookStateAndStorage(added_doc);
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
    const targetStoryId = currentVideo.youtubeId ? `custom_${currentVideo.youtubeId}` : (currentVideo.id || "media");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
        body: JSON.stringify({
          original: segment.text,
          translated: trans,
          story_id: targetStoryId,
          item_type: "phrase",
          chunk_type: "Fraza"
        })
      });
      if (response.ok) {
        const added_doc = await response.json();
        setIsSegmentSaved(true);
        saveToNotebookStateAndStorage(added_doc);
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
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, "").toLowerCase();
    latestWordRef.current = word;
    setSelectedWord(word);
    setWordTranslation("");
    setWordSentenceTranslation("");
    setDetectedChunk(null);
    setChunkTranslation(null);
    setChunkType(null);
    setIsChunkSaved(false);
    setSelectedSentenceContext(sentenceContext || "");
    setIsTranslating(true);
    setIsSaved(false);

    // Check if word is already saved in notebook
    const alreadySaved = notebookWords.some(
      w => (w.original || "").trim().toLowerCase() === cleanWord
    );
    if (alreadySaved) {
      setIsSaved(true);
    }

    // Check hidden offline dictionary (DEMO_VIDEO_VOCAB or DEMO_DICTIONARY) for zero-cost instant lookup
    const offlineDef = DEMO_VIDEO_VOCAB[cleanWord] || DEMO_DICTIONARY[cleanWord];
    const offlineSentence = (sentenceContext && DEMO_SENTENCES[sentenceContext.trim()]) || "";
    if (offlineDef) {
      setTimeout(() => {
        if (latestWordRef.current !== word) return;
        const plTrans = typeof offlineDef === 'string' ? offlineDef : (offlineDef.pl || offlineDef.translation);
        setWordTranslation(plTrans);
        setWordSentenceTranslation(offlineSentence || (sentenceContext ? `(Zdanie): ${sentenceContext}` : ""));
        setIsTranslating(false);
      }, 180);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
        body: JSON.stringify({ text: word, context: sentenceContext })
      });
      if (latestWordRef.current !== word) return;
      if (response.ok) {
        const data = await response.json();
        setWordTranslation(data.translation || "Brak tłumaczenia");
        setWordSentenceTranslation(data.sentence_translation || "");

        if (data.detected_chunk && data.detected_chunk.toLowerCase() !== cleanWord) {
          setDetectedChunk(data.detected_chunk);
          setChunkTranslation(data.chunk_translation || "");
          setChunkType(data.chunk_type || "Fraza");
          const chunkSaved = notebookWords.some(
            w => (w.original || "").trim().toLowerCase() === data.detected_chunk.trim().toLowerCase()
          );
          setIsChunkSaved(chunkSaved);
        } else {
          setDetectedChunk(null);
          setChunkTranslation(null);
          setChunkType(null);
        }
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
    const targetStoryId = currentVideo.youtubeId ? `custom_${currentVideo.youtubeId}` : (currentVideo.id || "media");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
        body: JSON.stringify({
          original: selectedWord,
          translated: wordTranslation,
          story_id: targetStoryId,
          context_sentence: selectedSentenceContext || "",
          item_type: "word",
          chunk_type: ""
        })
      });
      if (response.ok) {
        const added_doc = await response.json();
        setIsSaved(true);
        saveToNotebookStateAndStorage(added_doc);
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania słówka:", err);
    }
  };

  const handleSaveChunk = async () => {
    if (!detectedChunk || !chunkTranslation) return;
    const targetStoryId = currentVideo.youtubeId ? `custom_${currentVideo.youtubeId}` : (currentVideo.id || "media");
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": user?.token || "" },
        body: JSON.stringify({
          original: detectedChunk,
          translated: chunkTranslation,
          story_id: targetStoryId,
          context_sentence: selectedSentenceContext || "",
          item_type: "phrase",
          chunk_type: chunkType || "Fraza"
        })
      });
      if (response.ok) {
        const added_doc = await response.json();
        setIsChunkSaved(true);
        saveToNotebookStateAndStorage(added_doc);
        window.dispatchEvent(new CustomEvent("vocabulary-updated"));
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania zwrotu:", err);
    }
  };

  const handleDeleteNotebookWord = async (wordToDelete) => {
    const origKey = (wordToDelete.original || "").trim().toLowerCase();
    const activeVid = currentVideoRef.current || currentVideo;
    setNotebookWords(prev => {
      const updated = prev.filter(w => (w.original || "").trim().toLowerCase() !== origKey);
      try {
        const storageKey = getLocalStorageWordsKey(activeVid);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        if (activeVid?.youtubeId) {
          const userKey = user?.email || user?.uid || "guest";
          localStorage.setItem(`media_buddy_notebook_words_${userKey}_${activeVid.youtubeId}`, JSON.stringify(updated));
        }
      } catch (e) { }
      return updated;
    });

    try {
      const deleteIdentifier = wordToDelete.id || wordToDelete.original;
      await fetch(`${API_BASE_URL}/api/vocabulary/${encodeURIComponent(deleteIdentifier)}`, {
        method: "DELETE",
        headers: { "X-Session-Token": user?.token || "" }
      });
      window.dispatchEvent(new CustomEvent("vocabulary-updated"));
    } catch (err) {
      console.error("Błąd podczas usuwania słówka:", err);
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
    const savedTime = getInitialVideoTime(vid, user);
    targetSeekTimeRef.current = savedTime;
    setSegmentBlurOverrides({});
    try {
      localStorage.setItem(`media_buddy_last_video_id_${userKey}`, vid.id);
      if (vid.youtubeId) {
        localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, vid.youtubeId);
      }
    } catch (e) {}
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
    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }
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

        const savedTime = getInitialVideoTime(staticVid, user);
        targetSeekTimeRef.current = savedTime;
        setSegmentBlurOverrides({});

        try {
          localStorage.setItem(`media_buddy_last_video_id_${userKey}`, staticVid.id);
          if (staticVid.youtubeId) {
            localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, staticVid.youtubeId);
          }
        } catch (e) {}

        setCustomVideos(prev => {
          const filtered = prev.filter(v => v.youtubeId !== videoId);
          const updated = [staticVid, ...filtered];
          try {
            localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
        saveCustomVideoToCloud(staticVid);
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

      const savedTime = getInitialVideoTime(newCustomVid, user);
      targetSeekTimeRef.current = savedTime;
      setSegmentBlurOverrides({});

      try {
        localStorage.setItem(`media_buddy_last_video_id_${userKey}`, newCustomVid.id);
        if (newCustomVid.youtubeId) {
          localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, newCustomVid.youtubeId);
        }
      } catch (e) {}

      setCustomVideos(prev => {
        const filtered = prev.filter(v => v.youtubeId !== videoId);
        const updated = [newCustomVid, ...filtered];
        try {
          localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      saveCustomVideoToCloud(newCustomVid);
      setCurrentVideo(newCustomVid);
      setCustomUrl("");
      setIsLoadingCustom(false);
      setIsVideoGalleryOpen(false);
    }
  };

  const handleOpenAddMediaModal = () => {
    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }
    setExtractionError("");
    setExtractedData(null);
    setUploadedFileStatus(null);
    setModalVideoUrl(customUrl || "");
    setShowAddMediaModal(true);
  };

  const handleExtractFromYouTube = async (urlInput) => {
    const rawUrl = urlInput || modalVideoUrl || customUrl;
    if (!rawUrl || !rawUrl.trim()) {
      setExtractionError("Wprowadź adres URL filmu YouTube lub identyfikator wideo.");
      return;
    }
    const videoId = extractVideoId(rawUrl);
    if (!videoId) {
      setExtractionError("Nieprawidłowy adres URL filmu YouTube.");
      return;
    }

    const demoFound = DEMO_VIDEOS.find(v => v.id === videoId || v.youtubeId === videoId);
    if (demoFound) {
      const demoTranscript = getDemoVideoTranscript(demoFound.id || demoFound.youtubeId);
      if (demoTranscript && demoTranscript.length > 0) {
        setExtractedData({
          videoId: demoFound.youtubeId || demoFound.id,
          youtubeUrl: `https://www.youtube.com/watch?v=${demoFound.youtubeId || demoFound.id}`,
          title: demoFound.title,
          segments: demoTranscript,
          stats: {
            sentence_count: demoTranscript.length,
            word_count: demoTranscript.reduce((acc, s) => acc + (s.text || "").split(/\s+/).length, 0),
            duration: demoTranscript[demoTranscript.length - 1]?.end || 0
          }
        });
        return;
      }
    }

    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }

    setIsExtractingSubtitles(true);
    setExtractionError("");
    setExtractedData(null);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/media/subtitles/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { "X-Session-Token": user.token } : {})
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          video_id: videoId,
          user_email: user?.email
        })
      });

      const data = await resp.json();

      if (resp.ok && data.segments && data.segments.length > 0) {
        setExtractedData({
          videoId: data.video_id,
          youtubeUrl: data.youtube_url || `https://www.youtube.com/watch?v=${data.video_id}`,
          title: data.title || `Wideo YouTube (${data.video_id})`,
          segments: data.segments,
          source: data.source,
          from_cache: data.from_cache,
          stats: data.stats || {
            sentence_count: data.segments.length,
            word_count: data.segments.reduce((acc, s) => acc + (s.text || "").split(/\s+/).length, 0),
            duration: data.segments[data.segments.length - 1]?.end || 0
          }
        });
      } else {
        setExtractionError(data.error || "Nie udało się pobrać napisów dla tego filmu.");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      setExtractionError("Wystąpił problem z połączeniem podczas pobierania transkrypcji.");
    } finally {
      setIsExtractingSubtitles(false);
    }
  };

  const handleApplyExtractedVideo = (videoInfo) => {
    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }
    const dataToApply = videoInfo || extractedData;
    if (!dataToApply || !dataToApply.videoId) return;

    const formatted = ensureCompleteSentences(dataToApply.segments);
    const newVid = {
      id: `custom_${dataToApply.videoId}`,
      title: dataToApply.title || `Wideo (${dataToApply.videoId})`,
      youtubeId: dataToApply.videoId,
      transcript: formatted
    };

    const savedTime = getInitialVideoTime(newVid, user);
    targetSeekTimeRef.current = savedTime;
    setSegmentBlurOverrides({});

    try {
      localStorage.setItem(`media_buddy_last_video_id_${userKey}`, newVid.id);
      if (newVid.youtubeId) {
        localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, newVid.youtubeId);
      }
    } catch (e) {}

    setCustomVideos(prev => {
      const filtered = prev.filter(v => v.youtubeId !== dataToApply.videoId);
      const updated = [newVid, ...filtered];
      try {
        localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    saveCustomVideoToCloud(newVid);
    setCurrentVideo(newVid);
    setCustomUrl("");
    setModalVideoUrl("");
    setExtractedData(null);
    setShowAddMediaModal(false);
    setIsVideoGalleryOpen(false);
  };

  const handleApplyManualText = () => {
    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }
    if (!manualPastedText || !manualPastedText.trim()) {
      setExtractionError("Wklej tekst transkrypcji lub napisy.");
      return;
    }
    const parsed = parseSubtitlesOrTranscript(manualPastedText);
    if (!parsed || parsed.length === 0) {
      setExtractionError("Nie udało się rozpoznać formatu napisów ani tekstu.");
      return;
    }

    const targetVidId = extractVideoId(manualTargetVideoId) || currentVideo?.youtubeId || "custom_video";
    const targetTitle = manualCustomTitle.trim() || currentVideo?.title || `Własne napisy (${targetVidId})`;
    const formatted = ensureCompleteSentences(parsed);

    const newVid = {
      id: `custom_${targetVidId}`,
      title: targetTitle,
      youtubeId: targetVidId,
      transcript: formatted
    };

    try {
      localStorage.setItem(`media_buddy_last_video_id_${userKey}`, newVid.id);
      if (newVid.youtubeId) {
        localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, newVid.youtubeId);
      }
    } catch (e) {}

    setCustomVideos(prev => {
      const filtered = prev.filter(v => v.id !== newVid.id);
      const updated = [newVid, ...filtered];
      try {
        localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    saveCustomVideoToCloud(newVid);
    setCurrentVideo(newVid);
    setManualPastedText("");
    setManualTargetVideoId("");
    setManualCustomTitle("");
    setExtractionError("");
    setShowAddMediaModal(false);
    setIsVideoGalleryOpen(false);
  };

  const handleFileUpload = (e) => {
    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      const parsed = parseSubtitlesOrTranscript(content);
      if (parsed && parsed.length > 0) {
        setUploadedFileStatus({
          name: file.name,
          segmentsCount: parsed.length,
          parsedSegments: parsed
        });
        setExtractionError("");
      } else {
        setExtractionError("Plik nie zawiera rozpoznawalnych napisów ani zdań.");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleApplyUploadedFile = () => {
    if (isStarterUser) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
      return;
    }
    if (!uploadedFileStatus || !uploadedFileStatus.parsedSegments) return;
    const formatted = ensureCompleteSentences(uploadedFileStatus.parsedSegments);
    const targetVidId = extractVideoId(manualTargetVideoId) || currentVideo?.youtubeId || "uploaded_file";
    const targetTitle = manualCustomTitle.trim() || uploadedFileStatus.name.replace(/\.[^/.]+$/, "") || currentVideo?.title;

    const newVid = {
      id: `custom_${targetVidId}`,
      title: targetTitle,
      youtubeId: targetVidId,
      transcript: formatted
    };

    try {
      localStorage.setItem(`media_buddy_last_video_id_${userKey}`, newVid.id);
      if (newVid.youtubeId) {
        localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, newVid.youtubeId);
      }
    } catch (e) {}

    setCustomVideos(prev => {
      const filtered = prev.filter(v => v.id !== newVid.id);
      const updated = [newVid, ...filtered];
      try {
        localStorage.setItem(`media_buddy_custom_videos_${userKey}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    saveCustomVideoToCloud(newVid);
    setCurrentVideo(newVid);
    setUploadedFileStatus(null);
    setExtractionError("");
    setShowAddMediaModal(false);
    setIsVideoGalleryOpen(false);
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
            className={`btn-add-media ${isStarterUser ? "pro-locked" : ""}`}
            onClick={handleOpenAddMediaModal}
            title={isStarterUser ? "Dodawanie i ściąganie własnych materiałów wideo wymaga pakietu PRO" : "Dodaj własne wideo lub napisy"}
          >
            {isStarterUser ? (
              <span className="media-pro-btn-content">
                <span>🔒 Add media</span>
                <span className="media-pro-badge">PRO</span>
              </span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Add media
              </>
            )}
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

          {/* Row 0: Moje dodane filmy */}
          {customVideos && customVideos.length > 0 && (
            <div className="media-selector-row my-custom-videos-row">
              <div className="media-selector-row-header">
                <div className="media-selector-row-title">
                  <span>🎬 Moje dodane filmy ({customVideos.length})</span>
                </div>
              </div>
              <div className="media-selector-scroll-wrapper">
                <button
                  type="button"
                  className="scroll-btn left"
                  onClick={() => scrollRow(customVideosScrollRef, "left")}
                  title="Przewiń w lewo"
                >
                  ‹
                </button>
                <div className="media-selector-scroll" ref={customVideosScrollRef}>
                  {customVideos.map((vid) => {
                    const isActive = currentVideo.id === vid.id;
                    const prog = getVideoProg(vid);
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
                          <button
                            className="video-tile-delete-btn"
                            onClick={(e) => handleDeleteCustomVideo(e, vid.id)}
                            title="Usuń z bazy i historii"
                          >
                            ✕
                          </button>
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
                  onClick={() => scrollRow(customVideosScrollRef, "right")}
                  title="Przewiń w prawo"
                >
                  ›
                </button>
              </div>
            </div>
          )}

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
                  const prog = getVideoProg(vid);
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
                    const prog = getVideoProg(vid);
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
                          className={`suggestion-load-btn ${isStarterUser ? "pro-locked" : ""}`}
                          onClick={() => {
                            if (isStarterUser) {
                              if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
                              return;
                            }
                            fetchAndLoadVideo(video.youtubeId);
                            setIsVideoGalleryOpen(false);
                          }}
                          disabled={isLoadingCustom}
                          title={isStarterUser ? "Ładowanie filmów z zewnętrznych kanałów wymaga pakietu PRO" : "Załaduj wideo"}
                        >
                          {isStarterUser ? "🔒 Załaduj (PRO)" : "Załaduj wideo ▶"}
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
          <div className="video-player-card" ref={videoPlayerCardRef}>
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

              {/* Progress Slider with Active Thumb Marker */}
              <div
                className="video-progress-slider-wrap"
                onMouseDown={handleSeekMouseDown}
                onTouchStart={handleSeekTouchStart}
                onClick={handleSeek}
                title="Przewiń wideo (kliknij lub przeciągnij)"
              >
                <div
                  className="video-progress-slider-filled"
                  style={{ width: `${Math.min(100, (currentTime / (totalDuration || 1)) * 100)}%` }}
                >
                  <span className="video-progress-slider-thumb" />
                </div>
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
                {detectedChunk && (
                  <div className="media-detected-chunk-box animate-fade-in">
                    <div className="chunk-badge-row">
                      <span className="chunk-badge-pill">
                        <span className="chunk-sparkle">✨</span>
                        {chunkType || "Rekomendowany zwrot"}
                      </span>
                      <span className="chunk-hint">Ucz się zwrotów dla naturalnej płynności</span>
                    </div>
                    <div className="chunk-content-row">
                      <div className="chunk-text-group">
                        <span className="chunk-phrase-title">{detectedChunk}</span>
                        <span className="chunk-translation-text">{chunkTranslation}</span>
                      </div>
                      <button
                        type="button"
                        className={`btn-save-chunk-recommended ${isChunkSaved ? "saved" : ""}`}
                        onClick={handleSaveChunk}
                        disabled={isChunkSaved}
                      >
                        {isChunkSaved ? (
                          <>
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Zapisano zwrot! ✓</span>
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>Zapisz zwrot (+)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="word-header-row">
                  <div className="word-header-title-wrap">
                    <span className="original-word">{selectedWord}</span>
                    {detectedChunk && <span className="single-word-sublabel">(pojedyncze słowo)</span>}
                  </div>
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
                    {notebookWords.map((word, idx) => {
                      const isPhrase = word.item_type === "phrase" || (word.original && word.original.trim().includes(" "));
                      return (
                        <div key={word.id || `${word.original}_${idx}`} className="notebook-word-item">
                          <span className="notebook-word-text">
                            {isPhrase && <span className="notebook-phrase-badge">Zwrot</span>}
                            <strong>{word.original}</strong> — {word.translated}
                          </span>
                          <button
                            type="button"
                            className="notebook-word-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotebookWord(word);
                            }}
                            title="Usuń z notesu"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
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
                  onClick={() => {
                    setAutoScrollEnabled(prev => {
                      const next = !prev;
                      if (next && activeSegmentIndex !== -1) {
                        setTimeout(() => centerSegmentInTranscript(activeSegmentIndex, true), 60);
                      }
                      return next;
                    });
                  }}
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

                      {((showBilingual && (translation || (isActive && !isPlaying))) || ((blurChallengeEnabled || isOriginalBlurred) && ((isActive && !isPlaying) || (isOriginalBlurred && !isPlaying)))) && (
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
              {detectedChunk ? (
                <div className="sticky-footer-chunk-actions">
                  <button
                    type="button"
                    className={`btn-save-sticky-word btn-save-sticky-chunk ${isChunkSaved ? "saved" : ""}`}
                    disabled={isChunkSaved}
                    onClick={handleSaveChunk}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {isChunkSaved ? `Zapisano zwrot "${detectedChunk}" ✓` : `✨ Zapisz zwrot "${detectedChunk}"`}
                  </button>
                  <button
                    type="button"
                    className={`btn-save-sticky-secondary ${isSaved ? "saved" : ""}`}
                    disabled={isSaved}
                    onClick={handleSaveWord}
                    title={`Zapisz tylko pojedyncze słowo: "${selectedWord}"`}
                  >
                    {isSaved ? `Słowo "${selectedWord}" ✓` : `Samo słowo "${selectedWord}"`}
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Add Media & Subtitle Studio Modal */}
      {showAddMediaModal && (
        <div className="media-modal-backdrop animate-fade-in" onClick={() => setShowAddMediaModal(false)}>
          <div className="media-modal-card glass-panel enhanced-add-media-card" onClick={(e) => e.stopPropagation()}>
            <div className="media-modal-header">
              <div className="media-modal-title-wrap">
                <div className="media-modal-icon-badge">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <div className="media-modal-title-row">
                    <h3>Dodaj wideo i napisy</h3>
                    <span className="add-media-ai-badge">AI Subtitles</span>
                  </div>
                  <p className="media-modal-subtitle">
                    Automatycznie pobieraj napisy z YouTube (bez blokad) lub dodaj własną transkrypcję.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowAddMediaModal(false)}
                title="Zamknij"
              >
                ✕
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="add-media-tabs">
              <button
                type="button"
                className={`add-media-tab-btn ${addMediaTab === "youtube" ? "active" : ""}`}
                onClick={() => { setAddMediaTab("youtube"); setExtractionError(""); }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                YouTube (Auto-napisy)
              </button>
              <button
                type="button"
                className={`add-media-tab-btn ${addMediaTab === "paste" ? "active" : ""}`}
                onClick={() => { setAddMediaTab("paste"); setExtractionError(""); }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                Wklej tekst / napisy
              </button>
              <button
                type="button"
                className={`add-media-tab-btn ${addMediaTab === "file" ? "active" : ""}`}
                onClick={() => { setAddMediaTab("file"); setExtractionError(""); }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                Wgraj plik (.srt/.vtt)
              </button>
            </div>

            <div className="media-modal-body">
              {/* TAB 1: YOUTUBE */}
              {addMediaTab === "youtube" && (
                <div className="add-media-tab-content">
                  <div className="modal-input-group">
                    <label>Wklej link do wideo z YouTube:</label>
                    <div className="modal-form-row">
                      <input
                        type="text"
                        className="modal-input"
                        placeholder="https://www.youtube.com/watch?v=_U5J8JlJq2Y lub ID filmu"
                        value={modalVideoUrl}
                        onChange={(e) => {
                          setModalVideoUrl(e.target.value);
                          setCustomUrl(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleExtractFromYouTube();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="modal-action-btn primary"
                        disabled={isExtractingSubtitles || !modalVideoUrl.trim()}
                        onClick={() => handleExtractFromYouTube()}
                      >
                        {isExtractingSubtitles ? "Pobieranie..." : "Pobierz napisy"}
                      </button>
                    </div>
                  </div>

                  {/* Sample Video Pills */}
                  <div className="add-media-samples">
                    <span className="samples-label">Wypróbuj przykład:</span>
                    <div className="samples-pills-row">
                      {SAMPLE_VIDEOS.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          className="sample-pill-btn"
                          onClick={() => {
                            setModalVideoUrl(sample.url);
                            setCustomUrl(sample.url);
                            handleExtractFromYouTube(sample.url);
                          }}
                        >
                          {sample.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loading State */}
                  {isExtractingSubtitles && (
                    <div className="add-media-loading-card animate-fade-in">
                      <div className="add-media-spinner"></div>
                      <div>
                        <strong>Pobieranie lub generowanie napisów AI...</strong>
                        <p>Sprawdzamy napisy YouTube. Jeśli są niedostępne, system AI (Gemini/Groq) odsłucha ścieżkę dźwiękową i przygotuje zsynchronizowane zdania.</p>
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {extractionError && !isExtractingSubtitles && (
                    <div className="add-media-error-card animate-fade-in">
                      <div className="error-icon">⚠️</div>
                      <div className="error-details">
                        <strong>{extractionError}</strong>
                        <p>Jeśli film nie posiada angielskich napisów na YouTube, możesz wkleić transkrypcję ręcznie:</p>
                        <button
                          type="button"
                          className="error-action-btn"
                          onClick={() => {
                            setAddMediaTab("paste");
                            setManualTargetVideoId(extractVideoId(modalVideoUrl) || "");
                          }}
                        >
                          Przejdź do wklejania transkrypcji →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Extracted Success Preview Card */}
                  {extractedData && !isExtractingSubtitles && (
                    <div className="add-media-preview-card animate-fade-in">
                      <div className="preview-header-row">
                        <img
                          src={`https://img.youtube.com/vi/${extractedData.videoId}/mqdefault.jpg`}
                          alt="Thumbnail"
                          className="preview-thumbnail"
                        />
                        <div className="preview-meta">
                          <span className="preview-ready-badge">
                            {extractedData.source && extractedData.source.startsWith('ai_audio')
                              ? "✨ Wygenerowano ze ścieżki audio przez AI"
                              : extractedData.from_cache
                                ? "⚡ Wczytano błyskawicznie z pamięci"
                                : "✓ Napisy gotowe"}
                          </span>
                          <h4 className="preview-title">{extractedData.title}</h4>
                          <span className="preview-url">{extractedData.youtubeUrl}</span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="add-media-stats-grid">
                        <div className="stat-card">
                          <span className="stat-val">{extractedData.stats?.sentence_count || extractedData.segments.length}</span>
                          <span className="stat-lbl">Zdań do nauki</span>
                        </div>
                        <div className="stat-card">
                          <span className="stat-val">{extractedData.stats?.word_count || 0}</span>
                          <span className="stat-lbl">Słów</span>
                        </div>
                        <div className="stat-card">
                          <span className="stat-val">{formatShortTime(extractedData.stats?.duration || 0)}</span>
                          <span className="stat-lbl">Czas filmu</span>
                        </div>
                        <div className="stat-card">
                          <span className="stat-val">{extractedData.stats?.words_per_minute || 0}</span>
                          <span className="stat-lbl">Słów / min</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="preview-action-row">
                        <button
                          type="button"
                          className="btn-start-learning"
                          onClick={() => handleApplyExtractedVideo()}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Rozpocznij naukę z tym filmem
                        </button>
                        <button
                          type="button"
                          className="btn-download-srt"
                          onClick={() => {
                            if (isStarterUser) {
                              if (onOpenPaywall) onOpenPaywall({ feature: 'media_custom_video' });
                              return;
                            }
                            downloadSrtFile(extractedData.segments, extractedData.title);
                          }}
                          title={isStarterUser ? "Pobieranie plików .srt wymaga pakietu PRO" : "Pobierz plik .srt"}
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Pobierz .SRT
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PASTE TRANSCRIPT / TEXT */}
              {addMediaTab === "paste" && (
                <div className="add-media-tab-content">
                  <div className="modal-input-group">
                    <label>Link do wideo YouTube (opcjonalnie):</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder={currentVideo ? `Domyślnie bieżący film: ${currentVideo.title}` : "https://www.youtube.com/watch?v=..."}
                      value={manualTargetVideoId}
                      onChange={(e) => setManualTargetVideoId(e.target.value)}
                    />
                  </div>

                  <div className="modal-input-group">
                    <label>Wklej napisy, transkrypcję lub skrypt:</label>
                    <textarea
                      className="modal-textarea enhanced-textarea"
                      placeholder={"Obsługuje każdy format:\n• Plik SRT (00:00:01,000 --> 00:00:04,000 Hello)\n• Format VTT\n• Transkrypcję skopiowaną z YouTube (0:00 Hello everyone...)\n• Zwykły artykuł lub tekst (automatycznie podzielimy na zdania)"}
                      value={manualPastedText}
                      onChange={(e) => setManualPastedText(e.target.value)}
                      rows={7}
                    />
                  </div>

                  {extractionError && (
                    <div className="add-media-error-card small animate-fade-in">
                      <span>⚠️ {extractionError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="modal-action-btn full primary-large"
                    disabled={!manualPastedText.trim()}
                    onClick={handleApplyManualText}
                  >
                    Zastosuj napisy i rozpocznij naukę
                  </button>
                </div>
              )}

              {/* TAB 3: FILE UPLOAD */}
              {addMediaTab === "file" && (
                <div className="add-media-tab-content">
                  <div className="modal-input-group">
                    <label>Powiąż z filmem YouTube (opcjonalnie):</label>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder={currentVideo ? `Bieżący film: ${currentVideo.title}` : "https://www.youtube.com/watch?v=..."}
                      value={manualTargetVideoId}
                      onChange={(e) => setManualTargetVideoId(e.target.value)}
                    />
                  </div>

                  <div className="file-dropzone-box" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".srt,.vtt,.txt"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                    <div className="dropzone-icon">📁</div>
                    <strong>Kliknij, aby wybrać plik .srt, .vtt lub .txt</strong>
                    <span>lub przeciągnij plik tutaj</span>
                  </div>

                  {uploadedFileStatus && (
                    <div className="uploaded-file-summary animate-fade-in">
                      <div className="summary-info">
                        <span className="file-name">📄 {uploadedFileStatus.name}</span>
                        <span className="segments-badge">{uploadedFileStatus.segmentsCount} zdań rozpoznano</span>
                      </div>
                      <button
                        type="button"
                        className="modal-action-btn full primary-large"
                        onClick={handleApplyUploadedFile}
                      >
                        Zastosuj ten plik i rozpocznij naukę
                      </button>
                    </div>
                  )}

                  {extractionError && (
                    <div className="add-media-error-card small animate-fade-in">
                      <span>⚠️ {extractionError}</span>
                    </div>
                  )}
                </div>
              )}
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
