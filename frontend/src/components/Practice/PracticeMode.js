import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from '../../config';
import "./PracticeMode.css";

const PracticeMode = ({ text, voices, selectedVoiceURI, user, onExit, onLogActivity, onOpenPaywall }) => {
  const [phase, setPhase] = useState(1);
  const [subPhase, setSubPhase] = useState(1);
  const [masteryData, setMasteryData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Live Chat inside Practice
  const [visitedIndices, setVisitedIndices] = useState(new Set([0]));
  const [liveChatActive, setLiveChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [pendingFirstQuestion, setPendingFirstQuestion] = useState(null);
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [isChatRecording, setIsChatRecording] = useState(false);
  const [chatOrbStatus, setChatOrbStatus] = useState("inactive");
  const [isChatPaused, setIsChatPaused] = useState(false);

  const [translationModalData, setTranslationModalData] = useState(null);

  const showSentenceTranslationModal = (item, index) => {
    setTranslationModalData({
      en: item.en,
      pl: item.pl,
      index: index
    });
  };

  const handleContextMenu = (e, item, index) => {
    e.preventDefault();
    e.stopPropagation();
    showSentenceTranslationModal(item, index);
  };


  const currentAudioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");
  const accumulatedTranscriptRef = useRef("");
  const sessionFinalTranscriptRef = useRef("");
  const sessionInterimTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const recordingTargetIndexRef = useRef(-1);
  const skipNextEvalRef = useRef(false);
  const evalRequestIdRef = useRef(0);
  const mediaMimeTypeRef = useRef("audio/webm");
  const handleTogglePlayPauseRef = useRef(null);
  const handleNextRef = useRef(null);
  const isPausedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const hasFinishedSentenceRef = useRef(false);
  const translationModalOpenRef = useRef(false);

  // Live Chat Refs
  const chatMediaRecorderRef = useRef(null);
  const chatAudioChunksRef = useRef([]);
  const chatRecognitionRef = useRef(null);
  const chatTranscriptRef = useRef("");
  const chatAudioRef = useRef(null);
  const chatMessagesRef = useRef([]);
  const liveChatStageRef = useRef(null);
  const liveChatActiveRef = useRef(false);
  const chatHistoryEndRef = useRef(null);

  const activeTTSRequestIdRef = useRef(0);
  const activeChatTTSRequestIdRef = useRef(0);

  const isChatPausedRef = useRef(false);
  const chatSafetyTimerRef = useRef(null);
  const pendingSpeakTextRef = useRef(null);
  const pendingSpeakAudioUrlRef = useRef(null);
  const prePauseOrbStatusRef = useRef("inactive");

  useEffect(() => {
    if (liveChatActive && liveChatStageRef.current) {
      liveChatStageRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [liveChatActive]);

  useEffect(() => {
    if (chatHistoryEndRef.current) {
      chatHistoryEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    // Double insurance: also scroll the main modal scroll container if present
    const practiceBody = document.querySelector('.practice-body');
    if (practiceBody) {
      setTimeout(() => {
        practiceBody.scrollTo({
          top: practiceBody.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [chatMessages]);

  useEffect(() => {
    prepareContent();
    return () => {
      liveChatActiveRef.current = false;
      isRecordingRef.current = false;
      skipNextEvalRef.current = true;
      evalRequestIdRef.current += 1;
      activeTTSRequestIdRef.current++;
      activeChatTTSRequestIdRef.current++;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        } catch (e) {}
      }
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (chatAudioRef.current) {
        chatAudioRef.current.pause();
        chatAudioRef.current = null;
      }
      if (chatRecognitionRef.current) {
        try { chatRecognitionRef.current.stop(); } catch (e) {}
      }
      if (chatSafetyTimerRef.current) {
        clearTimeout(chatSafetyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Wyczyść ocenę/diagnozę czytania po przejściu do kolejnego lub innego zdania
    evalRequestIdRef.current += 1;
    setEvaluation(null);
    setIsEvaluating(false);
    hasFinishedSentenceRef.current = false;
    if (currentIndex !== -1) {
      const element = document.getElementById(`sentence-${currentIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('speakling-user-active', { detail: { type: 'sentence_change', index: currentIndex } }));
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__speakling_has_active_reading = true;
      window.dispatchEvent(new CustomEvent('speakling-user-active', { detail: { type: 'practice_opened' } }));
    }
    return () => {
      if (typeof window !== "undefined") {
        window.__speakling_has_active_reading = false;
        window.__speakling_is_reading_aloud = false;
      }
    };
  }, []);

  useEffect(() => {
    const isPlayingOrBusy = Boolean(
      isSpeaking ||
      isRecording ||
      isEvaluating ||
      (liveChatActive && (chatOrbStatus === "speaking" || chatOrbStatus === "listening" || chatOrbStatus === "thinking" || isChatRecording))
    );
    if (typeof window !== "undefined") {
      window.__speakling_is_reading_aloud = isPlayingOrBusy;
      if (isPlayingOrBusy) {
        window.dispatchEvent(new CustomEvent('speakling-user-active', { detail: { type: 'practice_active_task' } }));
      }
    }
  }, [isSpeaking, isRecording, isEvaluating, liveChatActive, chatOrbStatus, isChatRecording]);

  const prepareContent = async () => {
    setIsPreparing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mastery-prepare`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ text }),
      });
      if (response.status === 403) {
        if (onOpenPaywall) onOpenPaywall({ feature: 'mastery' });
        if (onExit) onExit();
        return;
      }
      const data = await response.json();
      if (data?.error === "PAYWALL_REQUIRED") {
        if (onOpenPaywall) onOpenPaywall({ feature: 'mastery' });
        if (onExit) onExit();
        return;
      }
      if (Array.isArray(data)) {
        setMasteryData(data);
        if (data.length > 0) {
          setCurrentIndex(0);
          setCurrentLang("en");
          setVisitedIndices(new Set([0]));
        }
      }
    } catch (err) {
      console.error("Error preparing mastery:", err);
    } finally {
      setIsPreparing(false);
    }
  };

  const cancelRecordingSilently = () => {
    skipNextEvalRef.current = true;
    isRecordingRef.current = false;
    evalRequestIdRef.current += 1;
    setIsRecording(false);
    setIsEvaluating(false);
    setEvaluation(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }
  };

  const speakSentence = async (index, lang = "en", segmentIdx = -1) => {
    const requestId = ++activeTTSRequestIdRef.current;

    if (index !== currentIndex) {
      if (isRecordingRef.current) {
        cancelRecordingSilently();
      } else {
        evalRequestIdRef.current += 1;
        setEvaluation(null);
        setIsEvaluating(false);
      }
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(0);
    setIsPaused(false);
    isPausedRef.current = false;
    isSpeakingRef.current = true;
    hasFinishedSentenceRef.current = false;

    if (index < 0 || index >= masteryData.length) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      setIsPaused(false);
      return;
    }

    setCurrentIndex(index);
    setCurrentSegmentIndex(segmentIdx);
    setCurrentLang(lang);
    setVisitedIndices(prev => new Set(prev).add(index));

    const item = masteryData[index];
    const textToSpeak = (segmentIdx !== -1 && item.segments) ? item.segments[segmentIdx] : (lang === "en" ? item.en : item.pl);

    let voiceToUse = "en-US-BrianNeural";
    if (lang === "en") {
      voiceToUse = selectedVoiceURI || "en-US-BrianNeural";
    } else {
      voiceToUse = "pl-PL-MarekNeural";
    }

    const rate = phase === 2 ? 0.85 : 0.9;

    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          voice: voiceToUse
        })
      });

      if (requestId !== activeTTSRequestIdRef.current) {
        return;
      }

      if (!response.ok) throw new Error("TTS generation failed");
      const data = await response.json();
      if (!data.audio_base64) throw new Error("No audio data returned");

      if (requestId !== activeTTSRequestIdRef.current || isPausedRef.current) {
        if (requestId === activeTTSRequestIdRef.current) {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        }
        return;
      }

      const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;

      audio.onplay = () => {
        if (requestId !== activeTTSRequestIdRef.current) return;
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        setIsPaused(false);
        isPausedRef.current = false;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        
        const updateProgress = () => {
          if (!currentAudioRef.current || currentAudioRef.current.paused || requestId !== activeTTSRequestIdRef.current) return;
          const duration = currentAudioRef.current.duration || (textToSpeak.length * 0.085);
          if (duration > 0) {
            const newProgress = Math.min((currentAudioRef.current.currentTime / duration) * 100, 100);
            setProgress(newProgress);
            if (newProgress >= 100) {
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
          }
        };

        progressIntervalRef.current = setInterval(updateProgress, 50);
      };

      audio.onpause = () => {
        if (requestId !== activeTTSRequestIdRef.current) return;
        setIsPaused(true);
        isPausedRef.current = true;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      };

      audio.onended = () => {
        if (requestId !== activeTTSRequestIdRef.current) return;
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setIsPaused(false);
        isPausedRef.current = false;
        hasFinishedSentenceRef.current = true;
        setProgress(100);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        if (requestId !== activeTTSRequestIdRef.current) return;
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setIsPaused(false);
        isPausedRef.current = false;
        setProgress(0);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        currentAudioRef.current = null;
      };

      currentAudioRef.current = audio;
      audio.play();

    } catch (err) {
      if (requestId === activeTTSRequestIdRef.current) {
        console.error("Error playing practice voice:", err);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setProgress(0);
      }
    }
  };

  const launchSpeechRecognitionSession = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !isRecordingRef.current) return;

    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      sessionFinalTranscriptRef.current = "";
      sessionInterimTranscriptRef.current = "";

      rec.onresult = (event) => {
        let finalPart = "";
        let interimPart = "";
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) {
            finalPart += (finalPart ? " " : "") + transcript.trim();
          } else {
            interimPart += (interimPart ? " " : "") + transcript.trim();
          }
        }
        sessionFinalTranscriptRef.current = finalPart;
        sessionInterimTranscriptRef.current = interimPart;
        speechTranscriptRef.current = [
          accumulatedTranscriptRef.current,
          finalPart,
          interimPart,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
      };

      rec.onerror = (e) => {
        if (e.error !== "aborted" && e.error !== "no-speech") {
          console.warn("Local speech recognition error:", e.error);
        }
      };

      rec.onend = () => {
        const finalized = [
          accumulatedTranscriptRef.current,
          sessionFinalTranscriptRef.current || sessionInterimTranscriptRef.current,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        accumulatedTranscriptRef.current = finalized;
        sessionFinalTranscriptRef.current = "";
        sessionInterimTranscriptRef.current = "";
        speechTranscriptRef.current = finalized;

        if (isRecordingRef.current) {
          // Automatyczne wznowienie nasłuchu w razie krótkiej przerwy w trakcie długiego zdania
          setTimeout(() => {
            if (isRecordingRef.current) launchSpeechRecognitionSession();
          }, 80);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.warn("SpeechRecognition start warning:", e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const supportedMime =
        typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
          ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ""
          : "";

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      mediaMimeTypeRef.current = recorder.mimeType || supportedMime || "audio/webm";
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      speechTranscriptRef.current = "";
      accumulatedTranscriptRef.current = "";
      sessionFinalTranscriptRef.current = "";
      sessionInterimTranscriptRef.current = "";
      skipNextEvalRef.current = false;
      recordingTargetIndexRef.current = currentIndex;
      isRecordingRef.current = true;

      launchSpeechRecognitionSession();

      recorder.onstop = () => {
        if (skipNextEvalRef.current) return;
        const targetIdx = recordingTargetIndexRef.current;
        const blobMime = mediaMimeTypeRef.current || "audio/webm";
        setTimeout(() => {
          if (skipNextEvalRef.current) return;
          const fullTranscript = [
            accumulatedTranscriptRef.current,
            sessionFinalTranscriptRef.current,
            sessionInterimTranscriptRef.current,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || speechTranscriptRef.current;
          handleEvaluate(new Blob(audioChunksRef.current, { type: blobMime }), fullTranscript, targetIdx);
        }, 350);
      };

      recorder.start(250);
      setIsRecording(true);
      setEvaluation(null);
    } catch (err) {
      isRecordingRef.current = false;
      console.error(err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
    }
    if (mediaRecorderRef.current && isRecording) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        console.warn("Error stopping MediaRecorder:", e);
      }
      setIsRecording(false);
    }
  };

  const handleEvaluate = async (audioBlob, localTranscript = "", targetIdx = currentIndex) => {
    const requestId = ++evalRequestIdRef.current;
    const targetItem = masteryData[targetIdx];
    if (!targetItem) return;

    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const formData = new FormData();
      const isMp4 = (audioBlob?.type || mediaMimeTypeRef.current || "").includes("mp4");
      formData.append('audio', audioBlob, isMp4 ? 'speech.mp4' : 'speech.webm');
      formData.append('target_text', targetItem.en);
      if (localTranscript) {
        formData.append('transcription', localTranscript);
      }
      const res = await fetch(`${API_BASE_URL}/api/mastery-evaluate`, {
        method: "POST",
        headers: { "X-Session-Token": user?.token || "" },
        body: formData
      });
      if (requestId !== evalRequestIdRef.current) return;

      if (res.status === 403) {
        if (onOpenPaywall) onOpenPaywall({ feature: 'mastery' });
        return;
      }
      const result = await res.json();
      if (requestId !== evalRequestIdRef.current) return;

      if (result?.error === "PAYWALL_REQUIRED") {
        if (onOpenPaywall) onOpenPaywall({ feature: 'mastery' });
        return;
      }
      setEvaluation(result);
      hasFinishedSentenceRef.current = true;

      if (onLogActivity && result && typeof result.score !== 'undefined') {
        onLogActivity({
          type: "practice",
          word_or_phrase: targetItem.en,
          timestamp: Date.now(),
          details: {
            practice_score: result.score,
            practice_sentence: targetItem.en,
            practice_transcription: result.transcription || localTranscript || ""
          }
        });
      }
    } catch (err) {
      console.error("Evaluation error:", err);
    } finally {
      if (requestId === evalRequestIdRef.current) {
        setIsEvaluating(false);
      }
    }
  };

  const handleNext = () => {
    if (isRecordingRef.current) {
      cancelRecordingSilently();
    } else {
      evalRequestIdRef.current += 1;
      setEvaluation(null);
      setIsEvaluating(false);
    }
    if (phase === 2) {
      const currentItem = masteryData[currentIndex];
      if (currentItem.segments && currentSegmentIndex + 1 < currentItem.segments.length) {
        speakSentence(currentIndex, "en", currentSegmentIndex + 1);
      } else if (currentIndex + 1 < masteryData.length) {
        speakSentence(currentIndex + 1, "en", 0);
      }
    } else {
      if (currentIndex + 1 < masteryData.length) {
        speakSentence(currentIndex + 1, phase === 3 ? "en" : (subPhase === 1 ? "en" : "pl"));
      }
    }
  };

  const handleRepeat = () => {
    if (currentIndex !== -1) speakSentence(currentIndex, currentLang, currentSegmentIndex);
  };

  const handleTogglePlayPause = () => {
    if (currentAudioRef.current) {
      if (isPaused || currentAudioRef.current.paused) {
        currentAudioRef.current.play();
        setIsPaused(false);
        isPausedRef.current = false;
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      } else {
        currentAudioRef.current.pause();
        setIsPaused(true);
        isPausedRef.current = true;
      }
    } else if (isSpeaking || isSpeakingRef.current) {
      setIsPaused(true);
      isPausedRef.current = true;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    } else {
      const targetSegment = phase === 2 ? (currentSegmentIndex === -1 ? 0 : currentSegmentIndex) : -1;
      speakSentence(currentIndex === -1 ? 0 : currentIndex, currentLang, targetSegment);
    }
  };
  handleTogglePlayPauseRef.current = handleTogglePlayPause;
  handleNextRef.current = handleNext;
  translationModalOpenRef.current = Boolean(translationModalData);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) return;
      if (liveChatActiveRef.current || translationModalOpenRef.current) return;

      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (handleTogglePlayPauseRef.current) {
          handleTogglePlayPauseRef.current();
        }
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (isRecordingRef.current) return;
        if (currentAudioRef.current || isSpeakingRef.current || isPausedRef.current) {
          if (handleTogglePlayPauseRef.current) {
            handleTogglePlayPauseRef.current();
          }
        } else if (hasFinishedSentenceRef.current) {
          if (handleNextRef.current) {
            handleNextRef.current();
          }
        } else {
          if (handleTogglePlayPauseRef.current) {
            handleTogglePlayPauseRef.current();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Calculate read progress percentage
  const readProgressRatio = masteryData.length > 0 
    ? Math.max((currentIndex + 1) / masteryData.length, visitedIndices.size / masteryData.length)
    : 0;
  const showLiveChatBadge = readProgressRatio >= 0.70;

  const startPracticeChatSession = async () => {
    unlockDesktopAudio();
    activeTTSRequestIdRef.current++;
    activeChatTTSRequestIdRef.current++;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setIsSpeaking(false);
    setIsPaused(false);

    setIsChatPaused(false);
    isChatPausedRef.current = false;
    pendingSpeakTextRef.current = null;
    pendingSpeakAudioUrlRef.current = null;
    prePauseOrbStatusRef.current = "inactive";
    if (chatSafetyTimerRef.current) {
      clearTimeout(chatSafetyTimerRef.current);
      chatSafetyTimerRef.current = null;
    }

    liveChatActiveRef.current = true;
    setLiveChatActive(true);
    setChatOrbStatus("thinking");
    setIsChatProcessing(true);
    setChatMessages([]);
    chatMessagesRef.current = [];

    const startTime = Date.now();
    try {
      const storyText = masteryData.map(item => item.en).join(" ");
      const formData = new FormData();
      formData.append('story_text', storyText);
      formData.append('history', JSON.stringify([]));

      const response = await fetch(`${API_BASE_URL}/api/stories/chat-next`, {
        method: 'POST',
        headers: {
          'X-Session-Token': user?.token || '',
        },
        body: formData,
      });

      const result = await response.json();

      // Gwarantujemy, że loader wstepny bedzie widoczny przynajmniej 2 sekundy (2000ms)
      const elapsedTime = Date.now() - startTime;
      const remainingTime = 2000 - elapsedTime;
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      if (response.ok && result.bot_response) {
        setPendingFirstQuestion(result.bot_response);
      } else {
        alert(result.error || 'Nie udało się rozpocząć rozmowy AI');
        setChatOrbStatus("inactive");
      }
    } catch (err) {
      console.error('Error starting practice chat:', err);
      setChatOrbStatus("inactive");
    } finally {
      setIsChatProcessing(false);
    }
  };

  function unlockDesktopAudio() {
    try {
      if (!chatAudioRef.current) {
        chatAudioRef.current = new Audio();
      }
      chatAudioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
      chatAudioRef.current.play().catch(e => console.log("Unlock audio catch:", e));
    } catch (err) {
      console.warn("Error unlocking desktop audio:", err);
    }
  }

  const speakChatBotText = async (textToSpeak) => {
    if (!liveChatActiveRef.current) return;
    if (isChatPausedRef.current) {
      pendingSpeakTextRef.current = textToSpeak;
      return;
    }
    const requestId = ++activeChatTTSRequestIdRef.current;

    unlockDesktopAudio();

    if (chatAudioRef.current) {
      chatAudioRef.current.pause();
      chatAudioRef.current = null;
    }

    const safetyTimer = setTimeout(() => {
      console.warn("Safety timeout triggered for speakChatBotText");
      if (requestId !== activeChatTTSRequestIdRef.current || !liveChatActiveRef.current || isChatPausedRef.current) return;
      startChatRecording();
    }, Math.max(4000, textToSpeak.split(/\s+/).length * 500 + 2000));
    chatSafetyTimerRef.current = safetyTimer;

    setChatOrbStatus("speaking");
    try {
      const res = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSpeak,
          voice: selectedVoiceURI || "en-US-BrianNeural"
        })
      });

      if (requestId !== activeChatTTSRequestIdRef.current || !liveChatActiveRef.current) {
        clearTimeout(safetyTimer);
        return;
      }

      const data = await res.json();
      if (data.audio_base64) {
        if (requestId !== activeChatTTSRequestIdRef.current || !liveChatActiveRef.current) {
          clearTimeout(safetyTimer);
          return;
        }
        const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
        if (isChatPausedRef.current) {
          clearTimeout(safetyTimer);
          pendingSpeakAudioUrlRef.current = audioUrl;
          return;
        }
        if (!chatAudioRef.current) {
          chatAudioRef.current = new Audio();
        }
        chatAudioRef.current.src = audioUrl;
        chatAudioRef.current.onended = () => {
          clearTimeout(safetyTimer);
          if (requestId !== activeChatTTSRequestIdRef.current || !liveChatActiveRef.current) return;
          if (isChatPausedRef.current) return;
          chatAudioRef.current = null;
          startChatRecording();
        };
        chatAudioRef.current.onerror = () => {
          clearTimeout(safetyTimer);
          if (requestId !== activeChatTTSRequestIdRef.current) return;
          chatAudioRef.current = null;
          setChatOrbStatus("inactive");
        };
        chatAudioRef.current.play().catch(e => {
          console.error("Audio playback error:", e);
          clearTimeout(safetyTimer);
          setChatOrbStatus("inactive");
        });
      } else {
        clearTimeout(safetyTimer);
        if (requestId === activeChatTTSRequestIdRef.current) {
          setChatOrbStatus("inactive");
        }
      }
    } catch (e) {
      clearTimeout(safetyTimer);
      if (requestId === activeChatTTSRequestIdRef.current) {
        console.error("TTS chat error:", e);
        setChatOrbStatus("inactive");
      }
    }
  };

  const startChatRecording = async () => {
    if (!liveChatActiveRef.current) return;
    if (isChatPausedRef.current) return;
    try {
      if (chatAudioRef.current) {
        chatAudioRef.current.pause();
        chatAudioRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chatMediaRecorderRef.current = new MediaRecorder(stream);
      chatAudioChunksRef.current = [];
      chatMediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chatAudioChunksRef.current.push(e.data);
      };

      chatTranscriptRef.current = "";
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (event) => {
          chatTranscriptRef.current = event.results[0][0].transcript;
        };
        chatRecognitionRef.current = rec;
        rec.start();
      }

      chatMediaRecorderRef.current.onstop = () => {
        if (!liveChatActiveRef.current) return;
        if (isChatPausedRef.current) return;
        const blob = new Blob(chatAudioChunksRef.current, { type: 'audio/webm' });
        sendChatAnswer(blob, chatTranscriptRef.current);
      };

      chatMediaRecorderRef.current.start();
      setChatOrbStatus("listening");
      setIsChatRecording(true);
    } catch (err) {
      console.error("Microphone error in live chat:", err);
      alert("Dostęp do mikrofonu został zablokowany.");
      setChatOrbStatus("inactive");
      setIsChatRecording(false);
    }
  };

  const stopChatRecording = () => {
    if (chatRecognitionRef.current) {
      try { chatRecognitionRef.current.stop(); } catch (e) {}
    }
    if (chatMediaRecorderRef.current && isChatRecording) {
      chatMediaRecorderRef.current.stop();
      setIsChatRecording(false);
      chatMediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const sendChatAnswer = async (audioBlob, localTranscript = "") => {
    if (!liveChatActiveRef.current) return;
    setIsChatProcessing(true);
    setChatOrbStatus("thinking");
    try {
      const storyText = masteryData.map(item => item.en).join(" ");
      const formData = new FormData();
      formData.append('story_text', storyText);
      formData.append('history', JSON.stringify(chatMessagesRef.current.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }))));
      if (audioBlob && audioBlob.size > 0) {
        formData.append('audio', audioBlob, 'answer.webm');
      }
      if (localTranscript) {
        formData.append('transcription', localTranscript);
      }

      const response = await fetch(`${API_BASE_URL}/api/stories/chat-next`, {
        method: 'POST',
        headers: {
          'X-Session-Token': user?.token || '',
        },
        body: formData,
      });

      if (!liveChatActiveRef.current) return;
      const result = await response.json();
      if (!liveChatActiveRef.current) return;
      if (response.ok) {
        const userText = result.transcription || localTranscript || "(Nagranie audio)";
        const newMessages = [
          ...chatMessagesRef.current,
          {
            id: String(Date.now()) + '_u',
            sender: 'user',
            text: userText,
            evaluation: result.user_evaluation,
            polish_insertions: result.polish_insertions
          },
          {
            id: String(Date.now()) + '_b',
            sender: 'bot',
            text: result.bot_response
          }
        ];
        setChatMessages(newMessages);
        chatMessagesRef.current = newMessages;
        if (isChatPausedRef.current) {
          pendingSpeakTextRef.current = result.bot_response;
          setChatOrbStatus("inactive");
        } else {
          speakChatBotText(result.bot_response);
        }
      } else {
        alert(result.error || "Błąd podczas oceny odpowiedzi.");
        setChatOrbStatus("inactive");
      }
    } catch (err) {
      console.error('Error sending chat answer:', err);
      setChatOrbStatus("inactive");
    } finally {
      setIsChatProcessing(false);
    }
  };

  const handleOrbClickInChat = () => {
    unlockDesktopAudio();
    if (isChatPausedRef.current) return;
    if (chatOrbStatus === "speaking") {
      if (chatAudioRef.current) {
        chatAudioRef.current.pause();
        chatAudioRef.current = null;
      }
      startChatRecording();
    } else if (chatOrbStatus === "listening" || isChatRecording) {
      stopChatRecording();
    } else if (chatOrbStatus === "inactive" || chatOrbStatus === "standby" || chatOrbStatus === "thinking") {
      startChatRecording();
    }
  };

  const toggleChatPause = () => {
    const nextPaused = !isChatPaused;
    setIsChatPaused(nextPaused);
    isChatPausedRef.current = nextPaused;

    if (nextPaused) {
      // PAUSING
      prePauseOrbStatusRef.current = chatOrbStatus;
      setChatOrbStatus("inactive");
      if (chatAudioRef.current && !chatAudioRef.current.paused) {
        chatAudioRef.current.pause();
      }
      if (chatSafetyTimerRef.current) {
        clearTimeout(chatSafetyTimerRef.current);
        chatSafetyTimerRef.current = null;
      }
      if (chatMediaRecorderRef.current && isChatRecording) {
        stopChatRecording();
      }
    } else {
      // RESUMING
      const previousStatus = prePauseOrbStatusRef.current;
      prePauseOrbStatusRef.current = "inactive";

      if (pendingSpeakAudioUrlRef.current) {
        const audioUrl = pendingSpeakAudioUrlRef.current;
        pendingSpeakAudioUrlRef.current = null;

        if (!chatAudioRef.current) {
          chatAudioRef.current = new Audio();
        }
        chatAudioRef.current.src = audioUrl;
        const requestId = activeChatTTSRequestIdRef.current;

        const safetyTimer = setTimeout(() => {
          if (!liveChatActiveRef.current || isChatPausedRef.current || requestId !== activeChatTTSRequestIdRef.current) return;
          startChatRecording();
        }, 5000);
        chatSafetyTimerRef.current = safetyTimer;

        chatAudioRef.current.onended = () => {
          clearTimeout(safetyTimer);
          if (!liveChatActiveRef.current || isChatPausedRef.current || requestId !== activeChatTTSRequestIdRef.current) return;
          chatAudioRef.current = null;
          startChatRecording();
        };
        chatAudioRef.current.onerror = () => {
          clearTimeout(safetyTimer);
          chatAudioRef.current = null;
          setChatOrbStatus("inactive");
        };

        setChatOrbStatus("speaking");
        chatAudioRef.current.play().catch(e => {
          console.error("Audio playback error on resume:", e);
          clearTimeout(safetyTimer);
          setChatOrbStatus("inactive");
        });
      } else if (pendingSpeakTextRef.current) {
        const text = pendingSpeakTextRef.current;
        pendingSpeakTextRef.current = null;
        speakChatBotText(text);
      } else if (chatAudioRef.current && chatAudioRef.current.paused) {
        const requestId = activeChatTTSRequestIdRef.current;
        const remainingTime = Math.max(2000, (chatAudioRef.current.duration - chatAudioRef.current.currentTime) * 1000 + 2000);

        const safetyTimer = setTimeout(() => {
          if (!liveChatActiveRef.current || isChatPausedRef.current || requestId !== activeChatTTSRequestIdRef.current) return;
          startChatRecording();
        }, isNaN(remainingTime) ? 5000 : remainingTime);
        chatSafetyTimerRef.current = safetyTimer;

        chatAudioRef.current.onended = () => {
          clearTimeout(safetyTimer);
          if (!liveChatActiveRef.current || isChatPausedRef.current || requestId !== activeChatTTSRequestIdRef.current) return;
          chatAudioRef.current = null;
          startChatRecording();
        };

        setChatOrbStatus("speaking");
        chatAudioRef.current.play().catch(e => {
          console.error("Audio resume error:", e);
          clearTimeout(safetyTimer);
          setChatOrbStatus("inactive");
        });
      } else if (previousStatus === "listening") {
        startChatRecording();
      } else {
        setChatOrbStatus(previousStatus);
      }
    }
  };

  const changePhase = (newPhase) => {
    liveChatActiveRef.current = false;
    activeTTSRequestIdRef.current++;
    activeChatTTSRequestIdRef.current++;
    if (isRecordingRef.current) {
      cancelRecordingSilently();
    } else {
      evalRequestIdRef.current += 1;
      setEvaluation(null);
      setIsEvaluating(false);
    }
    setPhase(newPhase);
    setSubPhase(1);
    setCurrentIndex(0);
    setCurrentSegmentIndex(newPhase === 2 ? 0 : -1);
    setIsSpeaking(false);
    setIsPaused(false);
    setEvaluation(null);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (chatAudioRef.current) {
      chatAudioRef.current.pause();
      chatAudioRef.current = null;
    }
    if (chatMediaRecorderRef.current && isChatRecording) {
      try { stopChatRecording(); } catch (e) {}
    }
    setIsChatPaused(false);
    isChatPausedRef.current = false;
    pendingSpeakTextRef.current = null;
    pendingSpeakAudioUrlRef.current = null;
    prePauseOrbStatusRef.current = "inactive";
    if (chatSafetyTimerRef.current) {
      clearTimeout(chatSafetyTimerRef.current);
      chatSafetyTimerRef.current = null;
    }
    setLiveChatActive(false);
    setChatOrbStatus("inactive");
  };

  const startPhaseSubStep = (step) => {
    setSubPhase(step);
    if (phase === 2) speakSentence(0, "en", 0);
    else speakSentence(0, step === 1 ? "en" : "pl");
  };

  if (isPreparing) {
    return (
      <div className="practice-overlay">
        <div className="practice-loader glass-panel">
          <div className="spinner"></div>
          <p>Preparing training path...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="practice-overlay">
      <div className="practice-content">
        <header className="practice-header">
          <div className="phase-indicator">
            {[1, 2, 3].map(p => (
              <span key={p} className={`dot ${phase >= p ? "active" : ""} ${p === phase ? "current" : ""}`} onClick={() => changePhase(p)}>
                {p}
              </span>
            ))}
          </div>
          <div className="header-titles">
             <h2>Phase {phase}: {phase === 1 ? "Immersion" : phase === 2 ? "Shadowing" : "Mastery"}</h2>
             <p className="sub-hint">{phase === 1 ? "Absorb the rhythm" : phase === 2 ? "Break down & Synchronize" : "Final Challenge"}</p>
          </div>
          <button className="exit-btn" onClick={onExit}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="practice-body">
          {phase === 1 && (
            <div className="phase-1-controls">
              <button className={`step-btn ${subPhase === 1 ? "active" : ""}`} onClick={() => startPhaseSubStep(1)}>Listen EN</button>
              <button className={`step-btn ${subPhase === 2 ? "active" : ""}`} onClick={() => startPhaseSubStep(2)}>Listen Translation</button>
            </div>
          )}

          <div className="training-area">
            <div className="training-text-scroll">
              {masteryData.map((item, index) => {
                const targetLang = phase >= 2 ? "en" : currentLang;
                const targetSegment = phase === 2 ? 0 : -1;
                return (
                  <span 
                    key={index} 
                    id={`sentence-${index}`} 
                    className={`training-sentence ${index === currentIndex ? "active" : ""}`}
                    onClick={() => speakSentence(index, targetLang, targetSegment)}
                    onDoubleClick={() => showSentenceTranslationModal(item, index)}
                    onContextMenu={(e) => handleContextMenu(e, item, index)}
                  >
                    {item.en}{" "}
                  </span>
                );
              })}
            </div>

            <div className="sentence-controller">
              <div className="controller-info">
                <span className="index-badge">
                  {phase === 2 ? `Part ${currentSegmentIndex + 1}` : `Sent. ${currentIndex + 1} / ${masteryData.length}`}
                </span>
                
                {(isSpeaking || isRecording) && (
                  <div className="speak-progress-container">
                    <div className={`speak-progress-bar ${isRecording ? "pulse" : ""}`} style={{ width: isRecording ? "100%" : `${progress}%` }}></div>
                  </div>
                )}

                {phase === 3 && evaluation && !isEvaluating && (
                  <div className="evaluation-result-box">
                    <div className="eval-score-circle">{evaluation.score}%</div>
                    <div className="eval-feedback">
                      <p className="eval-transcription">Transcription: "{evaluation.transcription}"</p>
                      <div className="eval-corrections" dangerouslySetInnerHTML={{ __html: evaluation.corrections }}></div>
                      <p className="eval-tip">Tip: {evaluation.tip}</p>
                    </div>
                  </div>
                )}
                
                {isEvaluating && <div className="evaluating-loader">Analyzing voice...</div>}
              </div>

              <div className="controller-actions">
                {subPhase === 2 && phase === 1 && (
                  <button className="ctrl-btn lang-toggle" style={{width: 'auto', padding: '0 1rem', borderRadius: '4px', fontSize: '0.8rem'}} onClick={() => speakSentence(currentIndex, currentLang === "pl" ? "en" : "pl")}>
                    {currentLang === "pl" ? "Hear EN" : "Hear PL"}
                  </button>
                )}
                {phase === 3 ? (
                  <>
                    <button className={`ctrl-btn record-btn ${isRecording ? "active" : ""}`} onClick={isRecording ? stopRecording : startRecording}>
                      {isRecording ? (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                      )}
                    </button>
                    <button className="ctrl-btn translate-btn" onClick={() => {
                      if (currentIndex !== -1 && masteryData[currentIndex]) {
                        showSentenceTranslationModal(masteryData[currentIndex], currentIndex);
                      }
                    }} title="Tłumaczenie zdania">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 8h14M5 12h14M11 16h3" />
                        <path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ctrl-btn play-pause" onClick={handleTogglePlayPause} title="Odtwarzaj / Pauza (Skrót: Spacja lub P)">
                      {isSpeaking && !isPaused ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </button>
                    <button className="ctrl-btn repeat" onClick={handleRepeat} title="Powtórz">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                    </button>
                    <button className="ctrl-btn translate-btn" onClick={() => {
                      if (currentIndex !== -1 && masteryData[currentIndex]) {
                        showSentenceTranslationModal(masteryData[currentIndex], currentIndex);
                      }
                    }} title="Tłumaczenie zdania">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 8h14M5 12h14M11 16h3" />
                        <path d="M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                      </svg>
                    </button>
                  </>
                )}
                <button className="ctrl-btn next-main" onClick={handleNext} disabled={currentIndex === masteryData.length - 1 && (phase !== 2 || currentSegmentIndex === masteryData[currentIndex].segments?.length - 1)}>
                  Dalej
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="practice-footer">
           <button className="step-btn" onClick={onExit}>Close</button>
           <button className="step-btn active" onClick={() => changePhase(phase < 3 ? phase + 1 : phase)}>Next Phase →</button>
        </footer>
      </div>
      {translationModalData && (
        <div className="modal-overlay" style={{ zIndex: 11000 }} onClick={() => setTranslationModalData(null)}>
          <div className="modal-content sentence-translation-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Tłumaczenie zdania</h3>
            <div className="sentence-modal-body" style={{ margin: '1.5rem 0', textAlign: 'left' }}>
              <p className="english-sentence" style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                {translationModalData.en}
              </p>
              <p className="polish-sentence" style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontStyle: 'italic' }}>
                {translationModalData.pl}
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                className="btn-primary listen-btn" 
                onClick={() => speakSentence(translationModalData.index, "en")}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                Odsłuchaj
              </button>
              <button className="btn-secondary" onClick={() => setTranslationModalData(null)}>
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeMode;
