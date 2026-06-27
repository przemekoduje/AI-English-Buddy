import React, { useState, useEffect, useRef } from "react";
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

  // Custom Video Loader states
  const [customUrl, setCustomUrl] = useState("");
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customVideos, setCustomVideos] = useState(() => {
    try {
      const saved = localStorage.getItem("media_buddy_custom_videos");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load custom videos from localStorage", e);
      return [];
    }
  });

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

  // AI Joke Explanation states
  const [selectedJokeText, setSelectedJokeText] = useState("");
  const [jokeExplanation, setJokeExplanation] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Pronunciation Practice modal states
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceText, setPracticeText] = useState("");

  // Detailed Word Explanation state (optional reuse)
  const [explanationWord, setExplanationWord] = useState(null);

  // Refs for YouTube Player and interval
  const playerRef = useRef(null);
  const timerRef = useRef(null);

  // Helper to create or recreate YouTube Player instance with a specific videoId
  const createPlayer = (videoId) => {
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
          autoplay: 1,
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
        createPlayer(currentVideo.youtubeId);
      };
    } else {
      createPlayer(currentVideo.youtubeId);
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
    if (window.YT && window.YT.Player) {
      createPlayer(currentVideo.youtubeId);
    }
    // Reset states
    setCurrentTime(0);
    setActiveSegmentIndex(-1);
    setIsPlaying(false);
    setSelectedWord("");
    setWordTranslation("");
    setSegmentTranslation("");
    setIsSegmentSaved(false);
    setSelectedJokeText("");
    setJokeExplanation(null);
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
    // Add a 0.4s anticipation bias to compensate for rendering/scroll latency and highlight early
    const checkTime = currentTime + 0.4;
    const idx = currentVideo.transcript.findIndex(
      (seg) => checkTime >= seg.start && checkTime <= seg.end
    );
    if (idx !== -1) {
      if (idx !== activeSegmentIndex) {
        setActiveSegmentIndex(idx);
        // Auto-scroll transcript container to make active card visible
        const activeCard = document.querySelector(`.transcript-segment-card[data-index="${idx}"]`);
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    } else {
      // Clear active segment highlight if we are outside the segment boundary (with a tight 0.2s tolerance using checkTime)
      const lastSeg = currentVideo.transcript[activeSegmentIndex];
      if (lastSeg && (checkTime < lastSeg.start - 0.2 || checkTime > lastSeg.end + 0.2)) {
        setActiveSegmentIndex(-1);
      }
    }
  }, [currentTime, currentVideo, activeSegmentIndex]);

  // Click card body: seek to segment start and pause video (for study)
  const handleCardClick = (seg, index) => {
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seg.start, true);
      playerRef.current.pauseVideo();
    }
  };

  // Toggle play/pause using the dedicated button on the card
  const handlePlayPauseToggle = (e, seg, index) => {
    e.stopPropagation(); // Avoid triggering card click
    if (playerRef.current && typeof playerRef.current.getPlayerState === "function") {
      const state = playerRef.current.getPlayerState();
      if (activeSegmentIndex === index) {
        if (state === 1) { // PLAYING
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      } else {
        playerRef.current.seekTo(seg.start, true);
        playerRef.current.playVideo();
      }
    }
  };

  // Translate entire active segment phrase when video is paused
  const translateActiveSegment = async (index) => {
    const segment = currentVideo.transcript[index];
    if (!segment || !segment.text) return;

    // Avoid translating if already translating or already translated
    if (isTranslatingSegment || segmentTranslation) return;

    setIsTranslatingSegment(true);
    setIsSegmentSaved(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ text: segment.text })
      });
      if (response.ok) {
        const data = await response.json();
        setSegmentTranslation(data.translation || "Brak tłumaczenia");
      } else {
        setSegmentTranslation("Błąd tłumaczenia");
      }
    } catch (err) {
      console.error(err);
      setSegmentTranslation("Błąd połączenia");
    } finally {
      setIsTranslatingSegment(false);
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
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania frazy:", err);
    }
  };

  // Click word: pause video and fetch translation
  const handleWordClick = async (word) => {
    if (!word) return;
    if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }
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
        body: JSON.stringify({ text: word })
      });
      if (response.ok) {
        const data = await response.json();
        setWordTranslation(data.translation || "Brak tłumaczenia");
      } else {
        setWordTranslation("Błąd tłumaczenia");
      }
    } catch (err) {
      console.error(err);
      setWordTranslation("Błąd połączenia");
    } finally {
      setIsTranslating(false);
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
      }
    } catch (err) {
      console.error("Błąd podczas zapisywania słówka:", err);
    }
  };

  // Click Explain Joke: pause video and fetch AI explanation with surrounding context
  const handleExplainJoke = async (text, index) => {
    if (!text) return;
    if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }

    // Compute surrounding context (e.g., 3 segments before and 2 segments after)
    const transcript = currentVideo.transcript;
    const startIdx = Math.max(0, index - 3);
    const endIdx = Math.min(transcript.length - 1, index + 2);
    
    const contextBeforeArr = [];
    for (let i = startIdx; i < index; i++) {
      contextBeforeArr.push(transcript[i].text);
    }
    const contextBefore = contextBeforeArr.join(" ");

    const contextAfterArr = [];
    for (let i = index + 1; i <= endIdx; i++) {
      contextAfterArr.push(transcript[i].text);
    }
    const contextAfter = contextAfterArr.join(" ");

    setSelectedJokeText(text);
    setJokeExplanation(null);
    setIsExplaining(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/media/explain-joke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({
          text,
          context_before: contextBefore,
          context_after: contextAfter,
          video_title: currentVideo.title
        })
      });
      if (response.ok) {
        const data = await response.json();
        setJokeExplanation(data);
      } else {
        setJokeExplanation({
          error: "Nie udało się pobrać wyjaśnienia od AI."
        });
      }
    } catch (err) {
      console.error(err);
      setJokeExplanation({
        error: "Błąd połączenia z serwerem."
      });
    } finally {
      setIsExplaining(false);
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

  const renderInteractiveText = (text) => {
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
            handleWordClick(cleanWord);
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

  const handleLoadCustomVideo = async (e) => {
    e.preventDefault();
    setCustomError("");
    const videoId = extractVideoId(customUrl);
    if (!videoId || videoId.length !== 11) {
      setCustomError("Nieprawidłowy adres URL lub ID wideo. Upewnij się, że ID ma 11 znaków.");
      return;
    }

    setIsLoadingCustom(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/transcript?video_id=${videoId}`, {
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
      setCustomError("Błąd połączenia z serwerem.");
    } finally {
      setIsLoadingCustom(false);
    }
  };

  return (
    <div className="mediabuddy-container">
      {/* Custom Video URL Loader */}
      <div className="custom-video-loader glass-panel">
        <h3 className="loader-title">🔗 Dodaj własne wideo z YouTube</h3>
        <form onSubmit={handleLoadCustomVideo} className="loader-form">
          <input
            type="text"
            className="loader-input"
            placeholder="Wklej link do YouTube (np. https://www.youtube.com/watch?v=... lub id wideo)"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
          />
          <button type="submit" className="loader-btn" disabled={isLoadingCustom}>
            {isLoadingCustom ? "Pobieranie transkrypcji..." : "Załaduj wideo 🚀"}
          </button>
        </form>
        {customError && <p className="loader-error">{customError}</p>}
      </div>

      {/* Video Selector Row */}
      <div className="media-selector-bar glass-panel">
        <h2 className="media-selector-title">Wybierz klip:</h2>
        <div className="media-selector-grid">
          {[...CURATED_VIDEOS, ...customVideos].map((vid) => {
            const isCustom = vid.id.startsWith("custom_");
            const isActive = currentVideo.id === vid.id;
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
                </div>
                <div className="video-tile-info">
                  <h4 className="video-tile-title">{vid.title}</h4>
                </div>
              </div>
            );
          })}
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
                    Więcej szczegółów 💡
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
            <h3 className="panel-header">🗣️ Transkrypcja stand-upu</h3>
            <div className="transcript-list">
              {currentVideo.transcript.map((seg, idx) => (
                <div
                  key={idx}
                  data-index={idx}
                  className={`transcript-segment-card ${activeSegmentIndex === idx ? "active" : ""}`}
                  onClick={() => handleCardClick(seg, idx)}
                >
                  <div className="segment-left-col">
                    <button
                      className="segment-play-btn"
                      onClick={(e) => handlePlayPauseToggle(e, seg, idx)}
                      title={activeSegmentIndex === idx && isPlaying ? "Pauza" : "Odtwórz ten fragment"}
                    >
                      {activeSegmentIndex === idx && isPlaying ? (
                        <svg className="play-pause-icon" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        </svg>
                      ) : (
                        <svg className="play-pause-icon" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    <span className="segment-time-badge">
                      {Math.floor(seg.start / 60)}:{(Math.floor(seg.start) % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="segment-content">
                    <p className="segment-text-line">{renderInteractiveText(seg.text)}</p>
                    <div className="segment-actions">
                      <button
                        className="segment-action-btn explain"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExplainJoke(seg.text, idx);
                        }}
                        title="Wyjaśnij humor, slang i kulturę tego żartu przez AI"
                      >
                        Wyjaśnij żart 💡
                      </button>
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

          {/* AI Explanation Panel */}
          <div className="ai-explanation-panel glass-panel">
            <h3 className="panel-header">💡 Wyjaśnienie AI (Joke Interpreter)</h3>
            {isExplaining ? (
              <div className="explanation-loading animate-pulse">
                <div className="explanation-spinner"></div>
                <p>AI analizuje humor i podtekst kulturowy żartu...</p>
              </div>
            ) : jokeExplanation ? (
              <div className="explanation-results animate-slide-up">
                {jokeExplanation.error ? (
                  <p className="error-text">{jokeExplanation.error}</p>
                ) : (
                  <div className="explanation-layout">
                    <div className="selected-joke-quote">
                      <svg className="quote-icon" viewBox="0 0 24 24">
                        <path d="M11.192 15.757c0-.754-.186-1.413-.557-1.974-.371-.56-.891-.976-1.562-1.246V12.4c1.196-.453 2.126-1.267 2.792-2.441.666-1.173.999-2.585.999-4.238h-2.932c0 2.213-.67 3.844-2.012 4.894-.852.665-1.939 1.055-3.261 1.17v6.868c1.321-.115 2.408-.505 3.26-1.17 1.343-1.05 2.013-2.68 2.013-4.894H12c0 1.653-.333 3.065-.999 4.238-.666 1.174-1.596 1.988-2.792 2.441v.137c.671.27 1.191.686 1.562 1.246.371.56.557 1.22.557 1.974h2.866zm10.808 0c0-.754-.186-1.413-.557-1.974-.371-.56-.891-.976-1.562-1.246V12.4c1.196-.453 2.126-1.267 2.792-2.441.666-1.173.999-2.585.999-4.238H20.29c0 2.213-.67 3.844-2.012 4.894-.852.665-1.939 1.055-3.261 1.17v6.868c1.321-.115 2.408-.505 3.26-1.17 1.343-1.05 2.013-2.68 2.013-4.894H21.1c0 1.653-.333 3.065-.999 4.238-.666 1.174-1.596 1.988-2.792 2.441v.137c.671.27 1.191.686 1.562 1.246.371.56.557 1.22.557 1.974h2.866z" />
                      </svg>
                      <p>"{selectedJokeText}"</p>
                    </div>

                    <div className="explanation-section literal-sec">
                      <h4>Dosłowne znaczenie</h4>
                      <p>{jokeExplanation.literal_meaning}</p>
                    </div>

                    <div className="explanation-section context-sec">
                      <h4>Kontekst kulturowy</h4>
                      <p>{jokeExplanation.cultural_context}</p>
                    </div>

                    {jokeExplanation.wordplay && jokeExplanation.wordplay !== "Brak gry słów" && (
                      <div className="explanation-section wordplay-sec">
                        <h4>Gra słów i humor</h4>
                        <p>{jokeExplanation.wordplay}</p>
                      </div>
                    )}

                    <div className="explanation-section sarcasm-sec">
                      <h4>Sarkazm i ton</h4>
                      <p>{jokeExplanation.sarcasm}</p>
                    </div>

                    <div className="explanation-section summary-sec">
                      <h4>Komentarz AI</h4>
                      <p>{jokeExplanation.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="explanation-placeholder">
                Kliknij przycisk "Wyjaśnij żart 💡" obok dowolnego segmentu transkrypcji, aby otrzymać szczegółową analizę humoru i kontekstu od AI.
              </p>
            )}
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
