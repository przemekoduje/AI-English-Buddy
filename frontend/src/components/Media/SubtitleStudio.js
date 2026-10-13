import React, { useState, useEffect, useRef, useMemo } from "react";
import { API_BASE_URL } from "../../config";
import "./SubtitleStudio.css";
import { ensureCompleteSentences } from "./sentenceGrouping";

const SAMPLE_VIDEOS = [
  {
    title: "Mark Zuckerberg - Meta AI & Future of Tech",
    url: "https://www.youtube.com/watch?v=DbfejwP1d3c",
    id: "DbfejwP1d3c"
  },
  {
    title: "Steve Jobs - 2005 Stanford Commencement",
    url: "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
    id: "UF8uR6Z6KLc"
  },
  {
    title: "James Veitch - The Agony of Unsubscribing",
    url: "https://www.youtube.com/watch?v=Dceyy0cX6J4",
    id: "Dceyy0cX6J4"
  }
];

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

const extractYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
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

  return [];
};

function SubtitleStudio({ user, subscription, onOpenPaywall, onNavigate }) {
  const isLocked = !user?.is_admin && !subscription?.is_admin && !subscription?.can_access_media;

  useEffect(() => {
    if (isLocked && onOpenPaywall) {
      onOpenPaywall({ feature: 'media' });
    }
  }, [isLocked, onOpenPaywall]);

  const [inputUrl, setInputUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [videoData, setVideoData] = useState(null);

  // Manual import / Paste modal state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [customVideoUrl, setCustomVideoUrl] = useState("");
  const fileInputRef = useRef(null);
  
  // Segmentation modes: 'linguistic' | 'ai' | 'raw'
  const [segmentMode, setSegmentMode] = useState("linguistic");
  const [rawSegments, setRawSegments] = useState([]);
  const [linguisticSegments, setLinguisticSegments] = useState([]);
  const [aiSegments, setAiSegments] = useState([]);
  const [isAiRefining, setIsAiRefining] = useState(false);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const listContainerRef = useRef(null);

  // Displayed segments depending on active mode
  const activeSegments = useMemo(() => {
    if (segmentMode === "ai" && aiSegments.length > 0) return aiSegments;
    if (segmentMode === "raw" && rawSegments.length > 0) return rawSegments;
    return linguisticSegments;
  }, [segmentMode, aiSegments, rawSegments, linguisticSegments]);

  // Filtered segments for search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return activeSegments;
    const q = searchQuery.toLowerCase();
    return activeSegments.filter((seg) => seg.text && seg.text.toLowerCase().includes(q));
  }, [activeSegments, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    if (!activeSegments || activeSegments.length === 0) {
      return { count: 0, words: 0, duration: 0, wpm: 0 };
    }
    const count = activeSegments.length;
    const words = activeSegments.reduce((acc, s) => acc + (s.text ? s.text.trim().split(/\s+/).length : 0), 0);
    const duration = activeSegments[activeSegments.length - 1].end || 0;
    const wpm = duration > 0 ? Math.round(words / (duration / 60)) : 0;
    return { count, words, duration, wpm };
  }, [activeSegments]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2800);
  };

  // Extract subtitles
  const handleExtract = async (overrideUrl) => {
    const targetUrl = (overrideUrl || inputUrl).trim();
    if (!targetUrl) {
      setErrorMessage("Wklej link do filmu YouTube, aby pobrać napisy.");
      return;
    }

    if (isLocked) {
      if (onOpenPaywall) onOpenPaywall({ feature: 'media' });
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setVideoData(null);
    setAiSegments([]);

    try {
      const headers = { "Content-Type": "application/json" };
      if (user?.token) headers["X-Session-Token"] = user.token;

      const endpoint = `${API_BASE_URL}/api/media/subtitles/extract`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: targetUrl,
          user_email: user?.email
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === "PAYWALL_REQUIRED") {
          if (onOpenPaywall) onOpenPaywall({ feature: 'media' });
          throw new Error("Funkcja dostępna w pakiecie Pro/Intensive.");
        }
        throw new Error(errData.error || "Nie udało się pobrać napisów dla tego wideo.");
      }

      const data = await res.json();
      setVideoData(data);

      const raw = data.raw_segments || [];
      setRawSegments(raw);

      // Apply our smart sentence grouping rules
      const linguistic = ensureCompleteSentences(raw.length > 0 ? raw : data.segments);
      setLinguisticSegments(linguistic);
      setSegmentMode("linguistic");

      showToast(`Pobrano i dopasowano ${linguistic.length} zdań!`);
      initYouTubePlayer(data.video_id);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Wystąpił błąd podczas pobierania napisów.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;

    const parsed = parseSubtitlesOrTranscript(pastedText);
    if (!parsed || parsed.length === 0) {
      alert("Nie udało się rozpoznać znaczników czasu w tekście. Upewnij się, że tekst zawiera czasy (np. format '0:05 Tekst' z YouTube lub format .srt/.vtt).");
      return;
    }

    const targetUrl = customVideoUrl.trim() || inputUrl.trim();
    const vidId = extractYouTubeId(targetUrl) || (targetUrl.length === 11 ? targetUrl : null);

    const linguistic = ensureCompleteSentences(parsed);
    const totalDuration = linguistic[linguistic.length - 1]?.end || 0;
    const totalWords = linguistic.reduce((acc, s) => acc + (s.text ? s.text.trim().split(/\s+/).length : 0), 0);
    const wordsPerMin = totalDuration > 0 ? Math.round(totalWords / (totalDuration / 60)) : 0;

    const title = vidId ? `YouTube (${vidId})` : "Wklejona transkrypcja";
    const newVideoData = {
      video_id: vidId || "custom",
      youtube_url: vidId ? `https://www.youtube.com/watch?v=${vidId}` : "",
      title: title,
      raw_segments: parsed,
      segments: linguistic,
      stats: {
        sentence_count: linguistic.length,
        word_count: totalWords,
        duration: totalDuration,
        words_per_minute: wordsPerMin
      }
    };

    setVideoData(newVideoData);
    setRawSegments(parsed);
    setLinguisticSegments(linguistic);
    setSegmentMode("linguistic");
    setErrorMessage("");
    setIsPasteModalOpen(false);
    setPastedText("");

    showToast(`Dopasowano ${linguistic.length} logicznych zdań!`);

    if (vidId) {
      setInputUrl(targetUrl);
      setTimeout(() => {
        initYouTubePlayer(vidId);
      }, 150);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        const parsed = parseSubtitlesOrTranscript(content);
        if (!parsed || parsed.length === 0) {
          alert("Nie udało się rozpoznać formatu napisów w pliku. Upewnij się, że to plik .srt lub .vtt.");
          return;
        }

        const targetUrl = inputUrl.trim();
        const vidId = extractYouTubeId(targetUrl) || (targetUrl.length === 11 ? targetUrl : null);

        const linguistic = ensureCompleteSentences(parsed);
        const totalDuration = linguistic[linguistic.length - 1]?.end || 0;
        const totalWords = linguistic.reduce((acc, s) => acc + (s.text ? s.text.trim().split(/\s+/).length : 0), 0);
        const wordsPerMin = totalDuration > 0 ? Math.round(totalWords / (totalDuration / 60)) : 0;

        const title = file.name.replace(/\.[^/.]+$/, "");
        const newVideoData = {
          video_id: vidId || "custom",
          youtube_url: vidId ? `https://www.youtube.com/watch?v=${vidId}` : "",
          title: title,
          raw_segments: parsed,
          segments: linguistic,
          stats: {
            sentence_count: linguistic.length,
            word_count: totalWords,
            duration: totalDuration,
            words_per_minute: wordsPerMin
          }
        };

        setVideoData(newVideoData);
        setRawSegments(parsed);
        setLinguisticSegments(linguistic);
        setSegmentMode("linguistic");
        setErrorMessage("");

        showToast(`Wgrano ${file.name} (${linguistic.length} zdań)!`);

        if (vidId) {
          setTimeout(() => {
            initYouTubePlayer(vidId);
          }, 150);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Initialize YouTube Iframe
  const initYouTubePlayer = (videoId) => {
    if (window.YT && window.YT.Player) {
      createPlayer(videoId);
    } else {
      if (!window.onYouTubeIframeAPIReady) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => {
        createPlayer(videoId);
      };
    }
  };

  const createPlayer = (videoId) => {
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {}
      playerRef.current = null;
    }

    const container = document.getElementById("subtitle-studio-player");
    if (!container) return;

    playerRef.current = new window.YT.Player("subtitle-studio-player", {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1
      },
      events: {
        onStateChange: (event) => {
          if (event.data === 1) { // Playing
            setIsPlaying(true);
            startTracking();
          } else {
            setIsPlaying(false);
            stopTracking();
          }
        }
      }
    });
  };

  const startTracking = () => {
    stopTracking();
    timerRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);

        // Find active sentence
        const idx = activeSegments.findIndex((s) => time >= s.start && time <= (s.end + 0.2));
        if (idx !== -1 && idx !== activeSegmentIndex) {
          setActiveSegmentIndex(idx);
          // Auto scroll to active sentence
          const el = document.getElementById(`studio-segment-${idx}`);
          if (el && listContainerRef.current) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      }
    }, 200);
  };

  const stopTracking = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTracking();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, []);

  const seekToSegment = (seg, idx) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seg.start, true);
      if (typeof playerRef.current.playVideo === "function") {
        playerRef.current.playVideo();
      }
    }
    setActiveSegmentIndex(idx);
    setCurrentTime(seg.start);
  };

  // AI Refine Subtitles
  const handleAiRefine = async () => {
    if (!activeSegments || activeSegments.length === 0) return;
    setIsAiRefining(true);
    setErrorMessage("");

    try {
      const headers = { "Content-Type": "application/json" };
      if (user?.token) headers["X-Session-Token"] = user.token;

      const endpoint = `${API_BASE_URL}/api/media/subtitles/refine-ai`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          segments: activeSegments,
          user_email: user?.email
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Błąd podczas optymalizacji napisów przez AI.");
      }

      const data = await res.json();
      if (data.segments && data.segments.length > 0) {
        const cleaned = ensureCompleteSentences(data.segments);
        setAiSegments(cleaned);
        setSegmentMode("ai");
        showToast("Napisy zostały pomyślnie zoptymalizowane przez sztuczną inteligencję!");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Błąd AI.");
    } finally {
      setIsAiRefining(false);
    }
  };

  // Export functions
  const generateSrtContent = () => {
    return activeSegments
      .map((seg, i) => {
        const index = i + 1;
        const start = formatTimestamp(seg.start);
        const end = formatTimestamp(seg.end);
        const text = seg.text || "";
        return `${index}\n${start} --> ${end}\n${text}\n`;
      })
      .join("\n");
  };

  const handleDownloadSrt = () => {
    if (!activeSegments.length) return;
    const content = generateSrtContent();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (videoData?.title || "subtitles").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    a.href = url;
    a.download = `${safeTitle}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Pobrano plik .SRT");
  };

  const handleDownloadTxt = () => {
    if (!activeSegments.length) return;
    const content = activeSegments
      .map((seg) => `[${formatShortTime(seg.start)} - ${formatShortTime(seg.end)}] ${seg.text}`)
      .join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (videoData?.title || "subtitles").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    a.href = url;
    a.download = `${safeTitle}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Pobrano plik .TXT");
  };

  const handleCopyClipboard = () => {
    if (!activeSegments.length) return;
    const fullText = activeSegments.map((s) => s.text).join("\n");
    navigator.clipboard.writeText(fullText);
    showToast("Skopiowano cały tekst do schowka!");
  };

  // Save to Media Buddy & navigate to learning
  const handleOpenInMediaBuddy = async () => {
    if (!videoData) return;
    try {
      const vidPayload = {
        id: `custom_${videoData.video_id}`,
        title: videoData.title,
        youtubeId: videoData.video_id,
        transcript: activeSegments,
        user_email: user?.email
      };

      // Save to cloud if logged in
      if (user?.token || user?.email) {
        const headers = { "Content-Type": "application/json" };
        if (user.token) headers["X-Session-Token"] = user.token;
        await fetch(`${API_BASE_URL}/api/media/custom-videos`, {
          method: "POST",
          headers,
          body: JSON.stringify(vidPayload)
        });

        // Set as last watched in cloud
        await fetch(`${API_BASE_URL}/api/media/state`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            last_video_id: vidPayload.id,
            last_youtube_id: vidPayload.youtubeId,
            user_email: user.email
          })
        });
      }

      // Also set in localStorage
      const userKey = user?.email?.toLowerCase().replace(/[^a-z0-9_.-]/g, '_') || 'guest';
      localStorage.setItem(`media_buddy_last_video_id_${userKey}`, vidPayload.id);
      localStorage.setItem(`media_buddy_last_youtube_id_${userKey}`, vidPayload.youtubeId);

      showToast("Dodano do Media Buddy! Przełączam do odtwarzacza...");
      setTimeout(() => {
        if (onNavigate) {
          onNavigate("media");
        }
      }, 700);
    } catch (err) {
      console.error(err);
      if (onNavigate) onNavigate("media");
    }
  };

  return (
    <div className="subtitle-studio-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="studio-toast">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="studio-header">
        <div className="studio-header-badge">
          <span className="badge-sparkle">✨</span>
          <span>Subtitle Studio PRO</span>
        </div>
        <h1 className="studio-title">Inteligentny Ekstraktor i Edytor Napisów</h1>
        <p className="studio-subtitle">
          Wklej link do dowolnego wideo YouTube. Silnik lingwistyczny i AI automatycznie pobiorą angielskie napisy,
          naprawią urwane frazy i podzielą je na perfekcyjne, logiczne zdania.
        </p>

        {/* Input & Action Bar */}
        <div className="studio-input-card">
          <div className="studio-input-wrapper">
            <svg className="studio-input-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              type="text"
              placeholder="Wklej link YouTube (np. https://www.youtube.com/watch?v=DbfejwP1d3c)..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExtract();
              }}
              disabled={isLoading}
            />
            {inputUrl && (
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setInputUrl("")}
                aria-label="Wyczyść"
              >
                ✕
              </button>
            )}
          </div>
          <button
            className="studio-submit-btn"
            onClick={() => handleExtract()}
            disabled={isLoading || !inputUrl.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Pobieranie napisów...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Pobierz i dopasuj
              </>
            )}
          </button>
        </div>

        {/* Manual Import Tools: Paste & Upload */}
        <div className="studio-manual-actions">
          <span className="manual-actions-label">Alternatywnie:</span>
          <button
            type="button"
            className="studio-manual-action-btn paste-btn"
            onClick={() => {
              setCustomVideoUrl(inputUrl);
              setIsPasteModalOpen(true);
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            Wklej transkrypcję / napisy
          </button>

          <button
            type="button"
            className="studio-manual-action-btn upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Wgraj plik (.srt / .vtt)
          </button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".srt,.vtt,.txt"
            onChange={handleFileUpload}
          />
        </div>

        {/* Sample video chips */}
        <div className="studio-samples">
          <span className="samples-label">Wypróbuj przykłady:</span>
          {SAMPLE_VIDEOS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="sample-chip"
              onClick={() => {
                setInputUrl(sample.url);
                handleExtract(sample.url);
              }}
            >
              ▶ {sample.title}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="studio-error-card">
            <div className="error-header-row">
              <div className="error-icon-box">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="error-meta">
                <h4 className="error-card-title">YouTube nie udostępnił napisów automatycznie</h4>
                <p className="error-card-desc">{errorMessage}</p>
              </div>
            </div>

            <div className="error-guide">
              <div className="guide-title">💡 Jak pobrać napisy w 5 sekund bezpośrednio z YouTube:</div>
              <ol className="guide-steps">
                <li>
                  Otwórz ten film na YouTube{" "}
                  {inputUrl && (
                    <a href={inputUrl} target="_blank" rel="noopener noreferrer" className="guide-link">
                      (kliknij tutaj, aby otworzyć)
                    </a>
                  )}.
                </li>
                <li>Pod filmem kliknij <strong>„... Więcej”</strong> (lub pod opisem) ➔ <strong>„Pokaż transkrypcję”</strong>.</li>
                <li>W otwartym panelu YouTube zaznacz tekst transkrypcji i skopiuj (<kbd>Ctrl+C</kbd> / <kbd>Cmd+C</kbd>).</li>
                <li>Kliknij poniżej <strong>„Wklej transkrypcję teraz”</strong> — silnik sam dokona podziału na logiczne zdania i zsynchronizuje wideo!</li>
              </ol>
            </div>

            <div className="error-actions-row">
              <button
                type="button"
                className="error-btn-primary"
                onClick={() => {
                  setCustomVideoUrl(inputUrl);
                  setIsPasteModalOpen(true);
                }}
              >
                📋 Wklej transkrypcję teraz
              </button>
              <button
                type="button"
                className="error-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                📂 Wgraj plik .srt / .vtt
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Workspace */}
      {videoData && (
        <section className="studio-workspace">
          {/* Top Video Overview Bar */}
          <div className="studio-overview-bar">
            <div className="overview-title-group">
              <span className="overview-source-tag">YouTube Video</span>
              <h2 className="overview-title">{videoData.title}</h2>
            </div>

            {/* Quick Metrics */}
            <div className="studio-metrics-grid">
              <div className="metric-pill">
                <span className="metric-icon">💬</span>
                <div className="metric-meta">
                  <span className="metric-val">{stats.count}</span>
                  <span className="metric-lbl">Zdań</span>
                </div>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">📝</span>
                <div className="metric-meta">
                  <span className="metric-val">{stats.words}</span>
                  <span className="metric-lbl">Słów</span>
                </div>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">⏱️</span>
                <div className="metric-meta">
                  <span className="metric-val">{formatShortTime(stats.duration)}</span>
                  <span className="metric-lbl">Długość</span>
                </div>
              </div>
              <div className="metric-pill">
                <span className="metric-icon">⚡</span>
                <div className="metric-meta">
                  <span className="metric-val">{stats.wpm}</span>
                  <span className="metric-lbl">WPM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="studio-toolbar">
            <div className="toolbar-segment-tabs">
              <button
                className={`tab-btn ${segmentMode === "linguistic" ? "active" : ""}`}
                onClick={() => setSegmentMode("linguistic")}
              >
                🎯 Zbalansowane zdania (Zalecane)
              </button>
              {aiSegments.length > 0 && (
                <button
                  className={`tab-btn ${segmentMode === "ai" ? "active" : ""}`}
                  onClick={() => setSegmentMode("ai")}
                >
                  ✨ AI Enhanced
                </button>
              )}
              <button
                className={`tab-btn ${segmentMode === "raw" ? "active" : ""}`}
                onClick={() => setSegmentMode("raw")}
              >
                📄 Surowy YouTube
              </button>
            </div>

            <div className="toolbar-actions">
              <button
                className="action-btn action-ai"
                onClick={handleAiRefine}
                disabled={isAiRefining}
                title="Wygładza interpunkcję i łączy trudne zdania za pomocą modelu Gemini"
              >
                {isAiRefining ? (
                  <>
                    <span className="spinner"></span>
                    Analiza AI...
                  </>
                ) : (
                  <>
                    <span>✨</span> Ulepsz z AI
                  </>
                )}
              </button>

              <button className="action-btn" onClick={handleDownloadSrt}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Pobierz .SRT
              </button>

              <button className="action-btn" onClick={handleDownloadTxt}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Pobierz .TXT
              </button>

              <button className="action-btn" onClick={handleCopyClipboard}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Kopiuj
              </button>

              <button className="action-btn action-learn" onClick={handleOpenInMediaBuddy}>
                <span>🎓</span> Ucz się w Media Buddy
              </button>
            </div>
          </div>

          {/* Dual Column Studio Grid */}
          <div className="studio-dual-grid">
            {/* Left: Video Player Pane */}
            <div className="studio-left-pane">
              <div className="player-aspect-wrapper">
                <div id="subtitle-studio-player" className="youtube-embed-frame"></div>
              </div>

              {/* Active Playing Sentence Card */}
              <div className="active-sentence-hero">
                <div className="hero-sentence-header">
                  <span className="hero-pulse-dot"></span>
                  <span className="hero-sentence-time">
                    {activeSegmentIndex !== -1 && activeSegments[activeSegmentIndex]
                      ? `[${formatShortTime(activeSegments[activeSegmentIndex].start)} - ${formatShortTime(activeSegments[activeSegmentIndex].end)}]`
                      : "Odtwórz wideo, aby śledzić zdania w czasie rzeczywistym"}
                  </span>
                </div>
                <p className="hero-sentence-text">
                  {activeSegmentIndex !== -1 && activeSegments[activeSegmentIndex]
                    ? activeSegments[activeSegmentIndex].text
                    : "Wybierz dowolne zdanie z listy po prawej stronie, aby odtworzyć ten fragment."}
                </p>
              </div>

              {/* Learning Highlights */}
              <div className="studio-info-card">
                <h3>💡 Zasady logicznego podziału w Speakling:</h3>
                <ul>
                  <li>Zabezpieczenie przed urywaniem zdań na przedimkach, przyimkach i spójnikach (and, but, because).</li>
                  <li>Precyzyjne wychwytywanie zmiany mówcy (symbol <code>&gt;&gt;</code>).</li>
                  <li>Zszywanie urwanych wtrąceń i zacięć (stammer carry-over).</li>
                  <li>Spójne znaczniki czasu dopasowane do rzeczywistego tempa mowy.</li>
                </ul>
              </div>
            </div>

            {/* Right: Subtitle Sentences Explorer */}
            <div className="studio-right-pane">
              {/* Search Bar */}
              <div className="segments-search-bar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Filtruj lub wyszukaj słowo w napisach..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <span className="search-count">
                    Znaleziono: {filteredSegments.length}
                  </span>
                )}
              </div>

              {/* Scrollable Sentences List */}
              <div className="segments-list-container" ref={listContainerRef}>
                {filteredSegments.length === 0 ? (
                  <div className="no-segments-found">
                    Brak zdań pasujących do wyszukiwania "{searchQuery}"
                  </div>
                ) : (
                  filteredSegments.map((seg, idx) => {
                    const originalIdx = activeSegments.indexOf(seg);
                    const isActive = originalIdx === activeSegmentIndex;
                    return (
                      <div
                        key={idx}
                        id={`studio-segment-${originalIdx}`}
                        className={`studio-sentence-card ${isActive ? "active" : ""}`}
                        onClick={() => seekToSegment(seg, originalIdx)}
                      >
                        <div className="sentence-card-header">
                          <span className="sentence-num-badge">#{originalIdx + 1}</span>
                          <span className="sentence-time-badge">
                            {formatShortTime(seg.start)} ➔ {formatShortTime(seg.end)}
                          </span>
                          <span className="sentence-duration">
                            {Math.round((seg.end - seg.start) * 10) / 10}s
                          </span>
                        </div>
                        <p className="sentence-card-body">{seg.text}</p>
                        <div className="sentence-card-footer">
                          <button
                            type="button"
                            className="play-sentence-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              seekToSegment(seg, originalIdx);
                            }}
                          >
                            ▶ Odtwórz fragment
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empty State Showcase */}
      {!videoData && !isLoading && (
        <section className="studio-empty-features">
          <div className="feature-box">
            <div className="feature-icon-badge">🎯</div>
            <h3>Inteligentny podział zdań</h3>
            <p>Koniec z napisami urywającymi się w połowie myśli na "the...", "because..." czy "you know". Każdy wers to pełne, logiczne zdanie.</p>
          </div>
          <div className="feature-box">
            <div className="feature-icon-badge">📦</div>
            <h3>Eksport do SRT i TXT</h3>
            <p>Pobierz perfekcyjnie sformatowany plik <code>.srt</code> do filmów, YouTube Studio, Premiere Pro lub odtwarzacza VLC.</p>
          </div>
          <div className="feature-box">
            <div className="feature-icon-badge">✨</div>
            <h3>Opcjonalne wsparcie AI</h3>
            <p>Dla filmów z automatycznymi napisami bez kropek możesz jednym kliknięciem zrekonstruować interpunkcję przez Gemini AI.</p>
          </div>
        </section>
      )}
      {/* Paste Transcript Modal */}
      {isPasteModalOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsPasteModalOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <div className="modal-title-group">
                <span className="modal-icon">📋</span>
                <h3 className="modal-title">Wklej transkrypcję lub napisy</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsPasteModalOpen(false)}
                aria-label="Zamknij"
              >
                ✕
              </button>
            </div>

            <div className="studio-modal-body">
              <div className="modal-info-box">
                <p>
                  Obsługiwany jest każdy format: <strong>skopiowana transkrypcja z YouTube</strong> (z minutami np. <code>0:05 Zdanie...</code>) lub format <strong>.SRT / .VTT</strong>.
                </p>
              </div>

              <div className="modal-form-group">
                <label className="modal-label">Link YouTube lub ID wideo (do synchronizacji z odtwarzaczem):</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="np. https://www.youtube.com/watch?v=_U5J8JlJq2Y..."
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                />
              </div>

              <div className="modal-form-group">
                <label className="modal-label">Tekst transkrypcji / napisów:</label>
                <textarea
                  className="modal-textarea"
                  rows={9}
                  placeholder={`Wklej tutaj tekst skopiowany z YouTube lub napisy, np:\n0:02 And today I am in conversation with Gen Kelsang...\n0:05 He has been studying Buddhism for many years...\n\nLUB format SRT:\n1\n00:00:02,440 --> 00:00:05,440\nAnd today I am in conversation...`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
              </div>
            </div>

            <div className="studio-modal-footer">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setIsPasteModalOpen(false)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="modal-btn-submit"
                disabled={!pastedText.trim()}
                onClick={handleProcessPastedText}
              >
                ✨ Przetwórz i dopasuj zdania
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubtitleStudio;
