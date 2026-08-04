import React, { useState, useEffect, useRef, useMemo } from "react";
import { API_BASE_URL } from '../../config';
import "./MediaBuddy.css";
import PronunciationPracticeModal from "../Notebook/PronunciationPracticeModal";
import WordExplanationModal from "../Notebook/WordExplanationModal";
import transcriptsData from "./transcripts.json";

const CURATED_VIDEOS = [
  {
    id: "james_veitch_spam",
    title: "James Veitch - Replying to Spam Email",
    youtubeId: "_QdPW8JrYzQ",
    transcript: transcriptsData.james_veitch_spam
  },
  {
    id: "james_veitch_unsubscribe",
    title: "James Veitch - The Agony of Unsubscribing",
    youtubeId: "Dceyy0cX6J4",
    transcript: transcriptsData.james_veitch_unsubscribe
  },
  {
    id: "jeff_allen_teenagers",
    title: "Jeff Allen - Teenagers (Dry Bar Comedy)",
    youtubeId: "cqjhCC4sP4Q",
    transcript: transcriptsData.jeff_allen_teenagers
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
      return saved ? JSON.parse(saved) : [];
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

  const [useWhisper, setUseWhisper] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_use_whisper");
      return saved === "false" ? false : true;
    } catch (e) {
      return true;
    }
  });

  // Sync useWhisper to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("media_buddy_use_whisper", useWhisper.toString());
      console.log("useWhisper persisted to localStorage:", useWhisper);
    } catch (e) {
      console.error("Failed to save useWhisper to localStorage", e);
    }
  }, [useWhisper]);



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
        setIsSegmentSaved(true);
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
        setIsSaved(true);
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
        transcript: staticTranscript
      };

      if (!customVideos.some(v => v.youtubeId === videoId)) {
        setCustomVideos([...customVideos, staticVid]);
      }
      setCurrentVideo(staticVid);
      setCustomUrl("");
      return;
    }

    setIsLoadingCustom(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/transcript?video_id=${videoId}&use_whisper=${useWhisper}`, {
        headers: {
          "X-Session-Token": user.token
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (!data.transcript || data.transcript.length === 0) {
          setCustomError("Ten film nie posiada angielskich napisów.");
          return;
        }

        const newCustomVid = {
          id: `custom_${videoId}`,
          title: data.title || `Własne wideo (${videoId})`,
          youtubeId: videoId,
          transcript: data.transcript
        };

        if (!customVideos.some(v => v.youtubeId === videoId)) {
          setCustomVideos([...customVideos, newCustomVid]);
        }
        setCurrentVideo(newCustomVid);
        setCustomUrl("");
      } else {
        const errData = await response.json();
        setCustomError(errData.error || "Błąd podczas pobierania transkrypcji.");
      }
    } catch (err) {
      console.error(err);
      setCustomError("Błąd pobierania transkrypcji z serwisu YouTube.");
    } finally {
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
        
        <div className="transcript-mode-toggle-container">
          <span className="toggle-label-text">Tryb pobierania transkrypcji:</span>
          <div className="toggle-switch-wrapper">
            <button
              type="button"
              className={`toggle-option-btn ${!useWhisper ? "active" : ""}`}
              onClick={() => setUseWhisper(false)}
              title="Darmowe automatyczne napisy z YouTube (brak interpunkcji)"
            >
              <span>Darmowy (Nap. automatyczne)</span>
            </button>
            <button
              type="button"
              className={`toggle-option-btn ${useWhisper ? "active" : ""}`}
              onClick={() => setUseWhisper(true)}
              title="Płatna transkrypcja AI przez Whisper (świetna interpunkcja i wielkie litery)"
            >
              <span>Premium AI (Whisper)</span>
            </button>
          </div>
        </div>

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
                    onClick={() => setCurrentVideo(vid)}
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
                      onClick={() => setCurrentVideo(vid)}
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
              {currentVideo.transcript.map((seg, idx) => (
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
              ))}
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
