import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions,
  Switch,
  Modal,
  Image,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import YoutubePlayer from 'react-native-youtube-iframe';
import transcriptsData from '../constants/transcripts.json';

const { width } = Dimensions.get('window');

const Waveform = ({ isActive, isSpeaking, timeText }: { isActive: boolean; isSpeaking: boolean; timeText: string }) => {
  const [heights, setHeights] = useState<number[]>([10, 15, 8, 20, 14, 18, 12, 16, 22, 10]);

  useEffect(() => {
    if (!isActive || !isSpeaking) {
      setHeights([6, 8, 6, 10, 8, 6, 8, 10, 6, 8]);
      return;
    }

    const interval = setInterval(() => {
      setHeights(prev => prev.map(() => Math.floor(Math.random() * 20) + 6));
    }, 120);

    return () => clearInterval(interval);
  }, [isActive, isSpeaking]);

  return (
    <View style={styles.waveformContainer}>
      <View style={styles.waveSide}>
        {heights.slice(0, 5).map((h, i) => (
          <View key={`left-${i}`} style={[styles.waveBar, { height: h }]} />
        ))}
      </View>
      <Text style={styles.waveformTime}>{timeText}</Text>
      <View style={styles.waveSide}>
        {heights.slice(5, 10).map((h, i) => (
          <View key={`right-${i}`} style={[styles.waveBar, { height: h }]} />
        ))}
      </View>
    </View>
  );
};

const EDGE_TTS_VOICES = [
  { identifier: 'en-US-BrianNeural', name: 'Brian (US - Male) 🌟', language: 'en-US' },
  { identifier: 'en-US-AriaNeural', name: 'Aria (US - Female) 🌟', language: 'en-US' },
  { identifier: 'en-US-EmmaMultilingualNeural', name: 'Emma (US - Multilingual) 🌟', language: 'en-US' },
  { identifier: 'en-GB-SoniaNeural', name: 'Sonia (UK - Female)', language: 'en-GB' },
  { identifier: 'en-GB-RyanNeural', name: 'Ryan (UK - Male)', language: 'en-GB' },
  { identifier: 'pl-PL-ZofiaNeural', name: 'Zofia (PL - Kobieta) 🌟', language: 'pl-PL' },
  { identifier: 'pl-PL-MarekNeural', name: 'Marek (PL - Mężczyzna) 🌟', language: 'pl-PL' },
];

const CURATED_VIDEOS = [
  {
    id: "james_veitch_spam",
    youtubeId: "_QdPW8JrYzQ",
    title: "James Veitch - Spammer",
    transcript: (transcriptsData as any).james_veitch_spam || []
  },
  {
    id: "james_veitch_unsubscribe",
    youtubeId: "Dceyy0cX6J4",
    title: "James Veitch - Unsubscribe",
    transcript: (transcriptsData as any).james_veitch_unsubscribe || []
  },
  {
    id: "jeff_allen_teenagers",
    youtubeId: "cqjhCC4sP4Q",
    title: "Jeff Allen - Teenagers",
    transcript: (transcriptsData as any).jeff_allen_teenagers || []
  }
];

// Material outline SVG Icons mapped to simple components
const HomeIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 100 100" fill="none">
    <Path d="M65 30C65 20 55 15 45 15C30 15 30 35 50 45C70 55 70 75 55 85C45 90 35 85 35 75" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BookIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M12 11.55C9.64 9.35 6.48 8 3 8v11c3.48 0 6.64 1.35 9 3.55 2.36-2.2 5.52-3.55 9-3.55V8c-3.48 0-6.64 1.35-9 3.55zM12 8c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" fill={color} />
  </Svg>
);

const HistoryIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill={color} />
  </Svg>
);

const SettingsIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill={color} />
  </Svg>
);

const MediaIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill={color} />
  </Svg>
);

const getInitialBackendUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && !hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.startsWith('192.168.')) {
      return 'https://ai-english-buddy-backend.onrender.com';
    }
  }
  return 'http://192.168.100.31:5001';
};

export default function HomeScreen() {
  const [backendUrl, setBackendUrl] = useState(getInitialBackendUrl()); // Local network IP or Render production URL
  const [user, setUser] = useState<{ token: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'stories' | 'notebook' | 'settings' | 'media'>('dashboard');

  const customFetch = async (url: string, options: any = {}) => {
    const headers = {
      ...(options.headers || {}),
      'bypass-tunnel-reminder': 'true',
    };
    return fetch(url, { ...options, headers });
  };

  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Story / Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyPrompt, setStoryPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [currentStoryTitle, setCurrentStoryTitle] = useState('');
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedTopicChip, setSelectedTopicChip] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<'simple' | 'medium' | 'advanced'>('medium');
  const [selectedLength, setSelectedLength] = useState<'short' | 'medium' | 'long'>('medium');

  // Reader States
  const [sentences, setSentences] = useState<string[]>([]);
  const [speakingSentenceIndex, setSpeakingSentenceIndex] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [readMode, setReadMode] = useState<'single' | 'all'>('single');
  const speakingRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const prefetchCache = useRef<{[key: number]: string}>({});
  const chatScrollRef = useRef<ScrollView>(null);
  const workspaceScrollRef = useRef<ScrollView>(null);
  const storyCardYRef = useRef<number>(0);               // Y offset of storyTextCard in the ScrollView
  const paragraphHeightRef = useRef<number>(0);          // Total height of the paragraph text
  const chatSessionStarted = useRef<boolean>(false);     // ensures chat starts only once

  // Sentence Translation States
  const [translatedSentenceIdx, setTranslatedSentenceIdx] = useState<number | null>(null);
  const [translationText, setTranslationText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // --- Media Buddy States ---
  const [customVideos, setCustomVideos] = useState<any[]>([]);
  const [currentVideo, setCurrentVideo] = useState<any>(CURATED_VIDEOS[0]);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoIsPlaying, setVideoIsPlaying] = useState<boolean>(false);
  const [videoActiveSegmentIdx, setVideoActiveSegmentIdx] = useState<number>(-1);
  const [videoCustomUrl, setVideoCustomUrl] = useState<string>('');
  const [videoIsLoadingCustom, setVideoIsLoadingCustom] = useState<boolean>(false);
  const [videoCustomError, setVideoCustomError] = useState<string>('');
  
  // Translation
  const [videoSelectedWord, setVideoSelectedWord] = useState<string>('');
  const [videoWordTranslation, setVideoWordTranslation] = useState<string>('');
  const [videoIsTranslatingWord, setVideoIsTranslatingWord] = useState<boolean>(false);
  const [videoIsWordSaved, setVideoIsWordSaved] = useState<boolean>(false);
  
  const [videoSegmentTranslation, setVideoSegmentTranslation] = useState<string>('');
  const [videoIsTranslatingSegment, setVideoIsTranslatingSegment] = useState<boolean>(false);
  const [videoIsSegmentSaved, setVideoIsSegmentSaved] = useState<boolean>(false);
  
  // Joke Explanation
  const [videoSelectedJokeText, setVideoSelectedJokeText] = useState<string>('');
  const [videoJokeExplanation, setVideoJokeExplanation] = useState<any>(null);
  const [videoIsExplainingJoke, setVideoIsExplainingJoke] = useState<boolean>(false);
  const [videoShowJokeModal, setVideoShowJokeModal] = useState<boolean>(false);
  const [videoShowSelectorModal, setVideoShowSelectorModal] = useState<boolean>(false);
  
  // Refs
  const playerRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const transcriptScrollRef = useRef<ScrollView>(null);

  // Voice Chatbot States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isProcessingChat, setIsProcessingChat] = useState<boolean>(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState<boolean>(false);
  const [isRecordingAnswer, setIsRecordingAnswer] = useState<boolean>(false);
  const [recordingObject, setRecordingObject] = useState<Audio.Recording | null>(null);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
        workspaceScrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [chatMessages]);

  // --- Voice Tutor (Tutor Głosowy) Constants & States ---
  const VOICE_DB_THRESHOLD = -42;
  const INTERRUPTION_DB_THRESHOLD = -35;
  const VOICE_SILENCE_DURATION = 800;

  const [isVoiceTutorActive, setIsVoiceTutorActive] = useState<boolean>(false);
  const [voiceTutorMessages, setVoiceTutorMessages] = useState<any[]>([]);
  const [isVoiceTutorRecording, setIsVoiceTutorRecording] = useState<boolean>(false);
  const [isVoiceTutorProcessing, setIsVoiceTutorProcessing] = useState<boolean>(false);
  const [isVoiceTutorBotSpeaking, setIsVoiceTutorBotSpeaking] = useState<boolean>(false);
  const [voiceTutorRmsVolume, setVoiceTutorRmsVolume] = useState<number>(0);
  const [voiceTutorUserIsSpeaking, setVoiceTutorUserIsSpeaking] = useState<boolean>(false);
  const [voiceTutorShowTranscript, setVoiceTutorShowTranscript] = useState<boolean>(false);
  const [voiceTutorSummary, setVoiceTutorSummary] = useState<any>(null);
  const [isVoiceTutorGeneratingSummary, setIsVoiceTutorGeneratingSummary] = useState<boolean>(false);
  const [voiceTutorSavedWords, setVoiceTutorSavedWords] = useState<string[]>([]);
  const [voiceTutorEmail, setVoiceTutorEmail] = useState<string>('');
  const [voiceSessionDuration, setVoiceSessionDuration] = useState<number>(0);
  const voiceSessionTimerRef = useRef<any>(null);

  useEffect(() => {
    if (user && user.email) {
      setVoiceTutorEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (isVoiceTutorActive) {
      setVoiceSessionDuration(0);
      voiceSessionTimerRef.current = setInterval(() => {
        setVoiceSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (voiceSessionTimerRef.current) {
        clearInterval(voiceSessionTimerRef.current);
        voiceSessionTimerRef.current = null;
      }
    }
    return () => {
      if (voiceSessionTimerRef.current) {
        clearInterval(voiceSessionTimerRef.current);
      }
    };
  }, [isVoiceTutorActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Refs for VAD loops & state sync
  const voiceTutorRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceTutorSoundRef = useRef<Audio.Sound | null>(null);
  const voiceTutorSilenceTimerRef = useRef<any>(null);
  const voiceTutorIsUserSpeakingRef = useRef<boolean>(false);
  const voiceTutorInterruptionCounterRef = useRef<number>(0);
  const voiceTutorMaxDurationTimerRef = useRef<any>(null);

  const voiceTutorIsBotSpeakingRef = useRef<boolean>(false);
  const voiceTutorIsRecordingRef = useRef<boolean>(false);
  const voiceTutorIsProcessingRef = useRef<boolean>(false);

  // Web-specific audio/recording refs
  const webStreamRef = useRef<any>(null);
  const webMediaRecorderRef = useRef<any>(null);
  const webAudioContextRef = useRef<any>(null);
  const webAnalyserRef = useRef<any>(null);
  const webAnimationFrameRef = useRef<any>(null);

  useEffect(() => {
    voiceTutorIsBotSpeakingRef.current = isVoiceTutorBotSpeaking;
  }, [isVoiceTutorBotSpeaking]);

  useEffect(() => {
    voiceTutorIsRecordingRef.current = isVoiceTutorRecording;
  }, [isVoiceTutorRecording]);

  useEffect(() => {
    voiceTutorIsProcessingRef.current = isVoiceTutorProcessing;
  }, [isVoiceTutorProcessing]);

  // Clean up Voice Tutor on unmount
  useEffect(() => {
    return () => {
      stopVoiceTutorAudio();
      stopVoiceTutorRecordingLocally();
      cleanupVoiceTutorVAD();
    };
  }, []);

  const stopVoiceTutorAudio = async () => {
    if (voiceTutorSoundRef.current) {
      try {
        await voiceTutorSoundRef.current.stopAsync();
        await voiceTutorSoundRef.current.unloadAsync();
      } catch (e) {
        console.warn("Failed to stop sound:", e);
      }
      voiceTutorSoundRef.current = null;
    }
    setIsVoiceTutorBotSpeaking(false);
  };

  const stopVoiceTutorRecordingLocally = async () => {
    if (Platform.OS === 'web') {
      if (webMediaRecorderRef.current && webMediaRecorderRef.current.state !== 'inactive') {
        try {
          webMediaRecorderRef.current.stop();
        } catch (e) {}
      }
      webMediaRecorderRef.current = null;

      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach((track: any) => track.stop());
        webStreamRef.current = null;
      }

      if (webAnimationFrameRef.current) {
        cancelAnimationFrame(webAnimationFrameRef.current);
        webAnimationFrameRef.current = null;
      }

      if (webAudioContextRef.current) {
        try {
          webAudioContextRef.current.close();
        } catch (e) {}
          webAudioContextRef.current = null;
      }
      webAnalyserRef.current = null;
      setIsVoiceTutorRecording(false);
    } else {
      if (voiceTutorRecordingRef.current) {
        try {
          await voiceTutorRecordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          console.warn("Failed to stop recording locally:", e);
        }
        voiceTutorRecordingRef.current = null;
      }
      setIsVoiceTutorRecording(false);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn("Failed to reset audio mode after recording:", e);
      }
    }
  };

  const cleanupVoiceTutorVAD = () => {
    if (voiceTutorSilenceTimerRef.current) {
      clearTimeout(voiceTutorSilenceTimerRef.current);
      voiceTutorSilenceTimerRef.current = null;
    }
    if (voiceTutorMaxDurationTimerRef.current) {
      clearTimeout(voiceTutorMaxDurationTimerRef.current);
      voiceTutorMaxDurationTimerRef.current = null;
    }
    voiceTutorIsUserSpeakingRef.current = false;
    setVoiceTutorUserIsSpeaking(false);
    voiceTutorInterruptionCounterRef.current = 0;
    setVoiceTutorRmsVolume(0);
  };

  const startVoiceTutorRecording = async () => {
    if (voiceTutorIsProcessingRef.current) return;

    // Reset VAD state
    voiceTutorIsUserSpeakingRef.current = false;
    setVoiceTutorUserIsSpeaking(false);
    if (voiceTutorSilenceTimerRef.current) {
      clearTimeout(voiceTutorSilenceTimerRef.current);
      voiceTutorSilenceTimerRef.current = null;
    }
    if (voiceTutorMaxDurationTimerRef.current) {
      clearTimeout(voiceTutorMaxDurationTimerRef.current);
      voiceTutorMaxDurationTimerRef.current = null;
    }

    try {
      if (Platform.OS === 'web') {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;

        // Configure AudioContext & Analyser for metering/VAD
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        webAudioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        webAnalyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // VAD/Volume loop
        const updateVolume = () => {
          if (!webAnalyserRef.current) return;
          webAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normVol = Math.min(1, avg / 128);
          setVoiceTutorRmsVolume(normVol);

          // VAD Logic
          if (voiceTutorIsBotSpeakingRef.current) {
            // A. Interruption Check
            if (normVol > 0.15) {
              voiceTutorInterruptionCounterRef.current += 1;
              if (voiceTutorInterruptionCounterRef.current > 6) { // ~150ms
                console.log("Web interruption detected: stopping playback.");
                voiceTutorInterruptionCounterRef.current = 0;
                stopVoiceTutorAudio();
                startVoiceTutorRecording();
              }
            } else {
              voiceTutorInterruptionCounterRef.current = Math.max(0, voiceTutorInterruptionCounterRef.current - 1);
            }
          } else {
            // B. Turn-taking Silence Check
            if (!voiceTutorIsProcessingRef.current) {
              if (normVol > 0.08) { // Próg czułości dostosowany do eliminacji szumów tła
                if (!voiceTutorIsUserSpeakingRef.current) {
                  voiceTutorIsUserSpeakingRef.current = true;
                  setVoiceTutorUserIsSpeaking(true);
                }
                if (voiceTutorSilenceTimerRef.current) {
                  clearTimeout(voiceTutorSilenceTimerRef.current);
                  voiceTutorSilenceTimerRef.current = null;
                }
              } else { // User is silent
                if (voiceTutorIsUserSpeakingRef.current && !voiceTutorSilenceTimerRef.current) {
                  voiceTutorSilenceTimerRef.current = setTimeout(async () => {
                    console.log("Web silence detected: ending turn.");
                    voiceTutorIsUserSpeakingRef.current = false;
                    setVoiceTutorUserIsSpeaking(false);
                    voiceTutorSilenceTimerRef.current = null;
                    
                    await stopVoiceTutorRecordingAndSend();
                  }, 800); // 800ms ciszy dla szybszego przepływu rozmowy
                }
              }
            }
          }
          webAnimationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        webAnimationFrameRef.current = requestAnimationFrame(updateVolume);

        // Configure MediaRecorder
        let options = { mimeType: "audio/webm" };
        if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/mp4" };
        }
        
        let mediaRecorder: any;
        try {
          mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream);
        }
        
        webMediaRecorderRef.current = mediaRecorder;
        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e: any) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const mimeType = mediaRecorder.mimeType || "audio/webm";
          const audioBlob = new Blob(chunks, { type: mimeType });
          
          const webUri = URL.createObjectURL(audioBlob);
          (window as any)._lastVoiceTutorBlob = audioBlob;
          
          await handleSendVoiceTutor(webUri);
        };

        mediaRecorder.start();
        setIsVoiceTutorRecording(true);

        // Max 12-second recording safety net
        voiceTutorMaxDurationTimerRef.current = setTimeout(async () => {
          console.log("Web max recording duration reached (12s). Force sending...");
          await stopVoiceTutorRecordingAndSend();
        }, 12000);
      } else {
        // 1. Request microphone permission
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Błąd', 'Zezwól na dostęp do mikrofonu, aby rozmawiać z lektorem.');
          setIsVoiceTutorActive(false);
          return;
        }

        // 2. Configure audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        // Stop previous recording if any
        if (voiceTutorRecordingRef.current) {
          try {
            await voiceTutorRecordingRef.current.stopAndUnloadAsync();
          } catch (e) {}
        }

        // Create new recording with metering
        const recording = new Audio.Recording();
        
        // Set status update handler
        recording.setOnRecordingStatusUpdate((status) => {
          if (!status.isRecording) return;
          
          // Convert status.metering (dB: -160 to 0) to normalized volume (0 to 1) for orb animation
          const db = status.metering ?? -160;
          const normVol = Math.max(0, (db + 60) / 60); // -60dB -> 0, 0dB -> 1
          setVoiceTutorRmsVolume(normVol);

          // VAD Logic
          if (voiceTutorIsBotSpeakingRef.current) {
            // A. Interruption Check (User speaks over Tutor)
            if (db > INTERRUPTION_DB_THRESHOLD) {
              voiceTutorInterruptionCounterRef.current += 1;
              if (voiceTutorInterruptionCounterRef.current > 6) { // ~600ms of active speech
                console.log("Mobile interruption detected: stopping tutor playback.");
                voiceTutorInterruptionCounterRef.current = 0;
                stopVoiceTutorAudio(); // Stops bot speaking state and unloads sound
                // Start a new recording session to capture fresh user speech (discarding current)
                startVoiceTutorRecording();
              }
            } else {
              voiceTutorInterruptionCounterRef.current = Math.max(0, voiceTutorInterruptionCounterRef.current - 1);
            }
          } else {
            // B. Turn-taking Silence Check (User speaks and finishes)
            if (!voiceTutorIsProcessingRef.current) {
              if (db > VOICE_DB_THRESHOLD) {
                if (!voiceTutorIsUserSpeakingRef.current) {
                  voiceTutorIsUserSpeakingRef.current = true;
                  setVoiceTutorUserIsSpeaking(true);
                }
                if (voiceTutorSilenceTimerRef.current) {
                  clearTimeout(voiceTutorSilenceTimerRef.current);
                  voiceTutorSilenceTimerRef.current = null;
                }
              } else {
                if (voiceTutorIsUserSpeakingRef.current && !voiceTutorSilenceTimerRef.current) {
                  voiceTutorSilenceTimerRef.current = setTimeout(async () => {
                    console.log("Mobile silence detected: ending turn.");
                    voiceTutorIsUserSpeakingRef.current = false;
                    setVoiceTutorUserIsSpeaking(false);
                    voiceTutorSilenceTimerRef.current = null;
                    
                    // Stop recording and send audio
                    await stopVoiceTutorRecordingAndSend();
                  }, VOICE_SILENCE_DURATION);
                }
              }
            }
          }
        });

        // Use the high quality preset but enable metering for VAD / volume levels
        const recordingOptions = {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        };

        await recording.prepareToRecordAsync(recordingOptions);
        await recording.startAsync();
        voiceTutorRecordingRef.current = recording;
        setIsVoiceTutorRecording(true);

        // Max 12-second recording safety net
        voiceTutorMaxDurationTimerRef.current = setTimeout(async () => {
          console.log("Native max recording duration reached (12s). Force sending...");
          await stopVoiceTutorRecordingAndSend();
        }, 12000);
      }
    } catch (err: any) {
      console.error('Failed to start voice tutor recording:', err);
      Alert.alert('Błąd mikrofonu', 'Nie udało się uzyskać dostępu do mikrofonu lub uruchomić nagrywania: ' + err.message);
      setIsVoiceTutorActive(false);
    }
  };

  const stopVoiceTutorRecordingAndSend = async () => {
    const hasRecording = Platform.OS === 'web' ? !!webMediaRecorderRef.current : !!voiceTutorRecordingRef.current;
    if (!hasRecording || voiceTutorIsProcessingRef.current) return;

    setIsVoiceTutorProcessing(true);
    setIsVoiceTutorRecording(false);
    cleanupVoiceTutorVAD();

    try {
      if (Platform.OS === 'web') {
        const mediaRecorder = webMediaRecorderRef.current;
        webMediaRecorderRef.current = null;
        
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((track: any) => track.stop());
          webStreamRef.current = null;
        }

        if (webAnimationFrameRef.current) {
          cancelAnimationFrame(webAnimationFrameRef.current);
          webAnimationFrameRef.current = null;
        }

        if (webAudioContextRef.current) {
          try { webAudioContextRef.current.close(); } catch (e) {}
          webAudioContextRef.current = null;
        }
        webAnalyserRef.current = null;

        mediaRecorder.stop();
      } else {
        const recording = voiceTutorRecordingRef.current;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        voiceTutorRecordingRef.current = null;

        if (!uri) {
          console.warn("No recording URI generated");
          setIsVoiceTutorProcessing(false);
          voiceTutorIsProcessingRef.current = false;
          startVoiceTutorRecording();
          return;
        }

        await handleSendVoiceTutor(uri);
      }
    } catch (err) {
      console.error("Error stopping recording and sending:", err);
      setIsVoiceTutorProcessing(false);
      voiceTutorIsProcessingRef.current = false;
      startVoiceTutorRecording();
    }
  };

  const handleSendVoiceTutor = async (uri: string) => {
    if (!user) return;
    setIsVoiceTutorProcessing(true);

    try {
      const historyForApi = voiceTutorMessages.map((msg) => ({
        sender: msg.sender,
        text: msg.text,
      }));

      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const audioBlob = (window as any)._lastVoiceTutorBlob;
        let mimeType = audioBlob?.type || "audio/webm";
        let fileExtension = "webm";
        if (mimeType.includes("mp4")) {
          fileExtension = "mp4";
        } else if (mimeType.includes("m4a")) {
          fileExtension = "m4a";
        } else if (mimeType.includes("aac")) {
          fileExtension = "aac";
        } else if (mimeType.includes("ogg")) {
          fileExtension = "ogg";
        } else if (mimeType.includes("wav")) {
          fileExtension = "wav";
        }
        formData.append("audio", audioBlob, `user_speech.${fileExtension}`);
      } else {
        formData.append("audio", {
          uri: uri,
          name: "user_speech.m4a",
          type: "audio/m4a",
        } as any);
      }
      
      formData.append("history", JSON.stringify(historyForApi));
      formData.append("voice", selectedVoice || "en-US-BrianNeural");

      const response = await fetch(`${backendUrl}/api/chat-free`, {
        method: "POST",
        headers: {
          "X-Session-Token": user.token,
          "bypass-tunnel-reminder": "true",
        },
        body: formData,
      });

      if (!response.ok) throw new Error("API connection error");
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const userMsgId = "user-" + Date.now();
      const userMsg = {
        id: userMsgId,
        sender: "user",
        text: result.transcription || "(Brak transkrypcji)",
        evaluation: result.user_evaluation,
      };

      const botMsg = {
        id: "bot-" + (Date.now() + 1),
        sender: "bot",
        text: result.bot_response,
      };

      setVoiceTutorMessages((prev) => [...prev, userMsg, botMsg]);

      // Wyczyszczenie flagi ładowania przed odtwarzaniem, aby zapobiec zablokowaniu restartu mikrofonu
      setIsVoiceTutorProcessing(false);
      voiceTutorIsProcessingRef.current = false;

      await playVoiceTutorAudio(result.bot_response, result.audio_base64);
    } catch (err: any) {
      console.error("Error sending voice tutor speech:", err);
      Alert.alert("Błąd połączenia", "Nie udało się przesłać dźwięku: " + err.message);
      setIsVoiceTutorProcessing(false);
      voiceTutorIsProcessingRef.current = false;
      startVoiceTutorRecording();
    } finally {
      setIsVoiceTutorProcessing(false);
      voiceTutorIsProcessingRef.current = false;
    }
  };

  const playVoiceTutorAudio = async (text: string, cachedBase64?: string) => {
    await stopVoiceTutorAudio();
    setIsVoiceTutorBotSpeaking(true);

    try {
      let base64_data = cachedBase64;
      if (!base64_data) {
        console.log("Mobile: TTS base64 not pre-generated, fetching from api...");
        const response = await fetch(`${backendUrl}/api/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "bypass-tunnel-reminder": "true",
          },
          body: JSON.stringify({
            text: text,
            voice: selectedVoice || "en-US-BrianNeural",
          }),
        });

        if (!response.ok) throw new Error("TTS generation failed");
        const data = await response.json();
        base64_data = data.audio_base64;
      } else {
        console.log("Mobile: Using pre-generated TTS audio base64.");
      }

      if (!base64_data) throw new Error("No audio base64 returned");

      const uri = `data:audio/mpeg;base64,${base64_data}`;

      if (Platform.OS === 'web') {
        const webAudio = new Audio(uri);
        voiceTutorSoundRef.current = {
          stopAsync: async () => { webAudio.pause(); },
          unloadAsync: async () => { webAudio.pause(); },
          setOnPlaybackStatusUpdate: (cb: any) => {
            webAudio.onended = () => cb({ isLoaded: true, didJustFinish: true });
          }
        } as any;

        webAudio.play().catch(async (e) => {
          console.warn("Failed to play web audio (possibly blocked by Safari):", e);
          setIsVoiceTutorBotSpeaking(false);
          voiceTutorIsBotSpeakingRef.current = false;
          voiceTutorSoundRef.current = null;
          
          // Lokalna synteza mowy w przeglądarce jako rezerwowy i szybki fallback
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            console.log("Web: fallback do SpeechSynthesis...");
            try {
              const utterance = new SpeechSynthesisUtterance(text);
              const voices = window.speechSynthesis.getVoices();
              const englishVoice = voices.find(v => v.lang.startsWith('en'));
              if (englishVoice) utterance.voice = englishVoice;
              
              setIsVoiceTutorBotSpeaking(true);
              voiceTutorIsBotSpeakingRef.current = true;
              
              utterance.onend = async () => {
                setIsVoiceTutorBotSpeaking(false);
                voiceTutorIsBotSpeakingRef.current = false;
                await startVoiceTutorRecording();
              };
              utterance.onerror = async () => {
                setIsVoiceTutorBotSpeaking(false);
                voiceTutorIsBotSpeakingRef.current = false;
                await startVoiceTutorRecording();
              };
              
              window.speechSynthesis.speak(utterance);
              return;
            } catch (ttsErr) {
              console.error("SpeechSynthesis failed:", ttsErr);
            }
          }
          await startVoiceTutorRecording();
        });
        
        webAudio.onended = async () => {
          setIsVoiceTutorBotSpeaking(false);
          voiceTutorIsBotSpeakingRef.current = false;
          voiceTutorSoundRef.current = null;
          voiceTutorIsUserSpeakingRef.current = false;
          setVoiceTutorUserIsSpeaking(false);
          voiceTutorInterruptionCounterRef.current = 0;
          await startVoiceTutorRecording();
        };
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true }
        );

        voiceTutorSoundRef.current = sound;

        sound.setOnPlaybackStatusUpdate(async (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsVoiceTutorBotSpeaking(false);
            voiceTutorIsBotSpeakingRef.current = false;
            sound.unloadAsync();
            voiceTutorSoundRef.current = null;
            // Keep recording, but reset VAD flags for user speech
            voiceTutorIsUserSpeakingRef.current = false;
            setVoiceTutorUserIsSpeaking(false);
            voiceTutorInterruptionCounterRef.current = 0;
            // Start voice recording when tutor finishes speaking
            await startVoiceTutorRecording();
          }
        });
      }
    } catch (err) {
      console.error("Error playing Voice Tutor TTS:", err);
      setIsVoiceTutorBotSpeaking(false);
      voiceTutorIsBotSpeakingRef.current = false;
      
      // Fallback lokalnej syntezy mowy jeśli wygenerowanie mowy z serwera nie powiodło się
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        console.log("Web: TTS generation error, falling back to local SpeechSynthesis...");
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          const voices = window.speechSynthesis.getVoices();
          const englishVoice = voices.find(v => v.lang.startsWith('en'));
          if (englishVoice) utterance.voice = englishVoice;
          
          setIsVoiceTutorBotSpeaking(true);
          voiceTutorIsBotSpeakingRef.current = true;
          
          utterance.onend = async () => {
            setIsVoiceTutorBotSpeaking(false);
            voiceTutorIsBotSpeakingRef.current = false;
            await startVoiceTutorRecording();
          };
          utterance.onerror = async () => {
            setIsVoiceTutorBotSpeaking(false);
            voiceTutorIsBotSpeakingRef.current = false;
            await startVoiceTutorRecording();
          };
          
          window.speechSynthesis.speak(utterance);
          return;
        } catch (ttsErr) {
          console.error("SpeechSynthesis failed:", ttsErr);
        }
      }
      
      await startVoiceTutorRecording();
    }
  };

  const handleStartVoiceTutorSession = async () => {
    // Odblokowanie odtwarzania audio i syntezy mowy na iOS/Safari (musi nastąpić bezpośrednio w akcji kliknięcia)
    if (Platform.OS === 'web') {
      try {
        const dummyAudio = new Audio();
        dummyAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA"; // krótki cichy szum
        dummyAudio.play().catch(() => {});

        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const dummyUtterance = new SpeechSynthesisUtterance(" ");
          dummyUtterance.volume = 0;
          window.speechSynthesis.speak(dummyUtterance);
        }
        console.log("Web: Odblokowano Audio i SpeechSynthesis.");
      } catch (e) {
        console.warn("Failed to unlock web audio:", e);
      }
    }

    cleanupVoiceTutorVAD();
    setIsVoiceTutorActive(true);
    setVoiceTutorMessages([]);
    setVoiceTutorSummary(null);
    setVoiceTutorSavedWords([]);
    await stopVoiceTutorAudio();
    setVoiceTutorShowTranscript(false);

    await startVoiceTutorRecording();
  };

  const handleEndVoiceTutorSession = async () => {
    await stopVoiceTutorAudio();
    await stopVoiceTutorRecordingLocally();
    cleanupVoiceTutorVAD();
    setIsVoiceTutorActive(false);
    setVoiceTutorShowTranscript(false);

    if (voiceTutorMessages.length > 0) {
      setIsVoiceTutorGeneratingSummary(true);
      try {
        const response = await fetch(`${backendUrl}/api/chat-free/summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
            "bypass-tunnel-reminder": "true",
          },
          body: JSON.stringify({
            history: voiceTutorMessages.map((msg) => ({
              sender: msg.sender,
              text: msg.text,
            })),
          }),
        });

        if (response.ok) {
          const summaryData = await response.json();
          setVoiceTutorSummary(summaryData);
        } else {
          Alert.alert("Błąd", "Nie udało się wygenerować podsumowania sesji.");
        }
      } catch (err) {
        console.error("Error generating session summary on mobile:", err);
        Alert.alert("Błąd połączenia", "Problem z wygenerowaniem podsumowania sesji.");
      } finally {
        setIsVoiceTutorGeneratingSummary(false);
      }
    } else {
      setVoiceTutorMessages([]);
    }
  };

  const handleCloseVoiceTutorSummary = () => {
    setVoiceTutorSummary(null);
    setVoiceTutorMessages([]);
    setVoiceTutorSavedWords([]);
  };

  const handleSaveWordFromVoiceTutor = async (word: string, translation: string) => {
    if (!user) return false;
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token,
        },
        body: JSON.stringify({
          original: word,
          translated: translation,
          story_id: "chat-free",
        }),
      });
      if (response.ok) {
        Alert.alert("Sukces", `Słowo "${word}" zostało zapisane do notesu.`);
        fetchNotebookWords();
        return true;
      } else {
        const errData = await response.json();
        Alert.alert("Błąd", errData.error || "Nie udało się zapisać słowa");
      }
    } catch (err) {
      console.error("Error saving word:", err);
      Alert.alert("Błąd", "Błąd połączenia z serwerem");
    }
    return false;
  };

  const handleSendVoiceTutorEmail = async (recipientEmail: string) => {
    if (!user || !voiceTutorSummary) return false;
    try {
      const response = await customFetch(`${backendUrl}/api/send-chat-summary-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token,
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          summary: voiceTutorSummary,
        }),
      });
      if (response.ok) {
        Alert.alert("Sukces", "E-mail z podsumowaniem został wysłany!");
        return true;
      } else {
        Alert.alert("Błąd", "Nie udało się wysłać e-maila.");
      }
    } catch (err) {
      console.error("Error sending email:", err);
      Alert.alert("Błąd połączenia", "Problem z wysłaniem e-maila.");
    }
    return false;
  };



  // Saved Stories List
  const [savedStories, setSavedStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);

  // Notebook Vocabulary
  const [notebookWords, setNotebookWords] = useState<any[]>([]);
  const [loadingVocabulary, setLoadingVocabulary] = useState(false);

  // Load session and settings on startup
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-BrianNeural');

  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem('buddy_user');
        let storedIP = await AsyncStorage.getItem('buddy_backend_url');
        if (storedIP && storedIP.includes('192.168.100.27')) {
          storedIP = 'http://192.168.100.31:5001';
          await AsyncStorage.setItem('buddy_backend_url', storedIP);
        }

        // Jeśli aplikacja działa w przeglądarce na produkcji, a zapisane IP jest adresem lokalnym, wymuś zmianę na Render
        if (typeof window !== 'undefined' && window.location) {
          const hostname = window.location.hostname;
          if (hostname && !hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.startsWith('192.168.')) {
            if (!storedIP || storedIP.includes('192.168.') || storedIP.includes('127.0.0.1') || storedIP.includes('localhost')) {
              storedIP = 'https://ai-english-buddy-backend.onrender.com';
              await AsyncStorage.setItem('buddy_backend_url', storedIP);
            }
          }
        }

        if (!storedIP) {
          storedIP = getInitialBackendUrl();
        }
        const storedVoice = await AsyncStorage.getItem('buddy_tts_voice');
        const storedCustomVideos = await AsyncStorage.getItem('buddy_custom_videos');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedIP) {
          setBackendUrl(storedIP);
        }
        if (storedVoice && EDGE_TTS_VOICES.some(v => v.identifier === storedVoice)) {
          setSelectedVoice(storedVoice);
        } else {
          setSelectedVoice('en-US-BrianNeural');
          await AsyncStorage.setItem('buddy_tts_voice', 'en-US-BrianNeural');
        }
        if (storedCustomVideos) {
          setCustomVideos(JSON.parse(storedCustomVideos));
        }

        // Configure Audio session for playback
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
            staysActiveInBackground: false,
            playThroughEarpieceAndroid: false,
          });
        } catch (audioErr) {
          console.log('Error setting audio mode', audioErr);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch topics
  const fetchTopics = useCallback(async () => {
    try {
      const response = await customFetch(`${backendUrl}/api/get-topics`);
      if (response.ok) {
        const data = await response.json();
        setSuggestedTopics(data.topics || ['Technology', 'Nature', 'Business', 'Travel', 'Daily Life']);
      }
    } catch (err) {
      console.log('Failed to fetch topics, using fallbacks');
      setSuggestedTopics(['Technology', 'Nature', 'Business', 'Travel', 'Daily Life']);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (user) {
      fetchTopics();
    }
  }, [user, fetchTopics]);

  // Load Saved Stories
  const fetchSavedStories = async () => {
    if (!user) return;
    setLoadingStories(true);
    try {
      const response = await customFetch(`${backendUrl}/api/stories`, {
        headers: { 'X-Session-Token': user.token },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedStories(data);
      }
    } catch (err) {
      console.error('Stories fetch error:', err);
    } finally {
      setLoadingStories(false);
    }
  };

  // Load Notebook Words
  const fetchNotebookWords = async () => {
    if (!user) return;
    setLoadingVocabulary(true);
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary`, {
        headers: { 'X-Session-Token': user.token },
      });
      if (response.ok) {
        const data = await response.json();
        setNotebookWords(data);
      }
    } catch (err) {
      console.error('Vocabulary fetch error:', err);
    } finally {
      setLoadingVocabulary(false);
    }
  };

  useEffect(() => {
    if (user && currentView === 'stories') {
      fetchSavedStories();
    } else if (user && currentView === 'notebook') {
      fetchNotebookWords();
    }
  }, [user, currentView]);

  // --- Media Buddy Hooks and Handlers ---
  // Poll player current time when playing
  useEffect(() => {
    if (currentView !== 'media') return;
    if (videoIsPlaying) {
      timerRef.current = setInterval(() => {
        if (playerRef.current) {
          playerRef.current.getCurrentTime().then((time: number) => {
            setVideoCurrentTime(time);
          }).catch(() => {});
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [videoIsPlaying, currentView]);

  // Synchronize active segment index based on currentTime + 0.4s early offset
  useEffect(() => {
    if (currentView !== 'media') return;
    const checkTime = videoCurrentTime + 0.4;
    const idx = currentVideo.transcript.findIndex(
      (seg: any) => checkTime >= seg.start && checkTime <= seg.end
    );
    if (idx !== -1) {
      if (idx !== videoActiveSegmentIdx) {
        setVideoActiveSegmentIdx(idx);
        // Scroll active card into view
        if (transcriptScrollRef.current) {
          transcriptScrollRef.current.scrollTo({ y: idx * 95, animated: true });
        }
      }
    } else {
      // Clear active segment highlight if we are outside the segment boundary (with a tight 0.2s tolerance using checkTime)
      const lastSeg = currentVideo.transcript[videoActiveSegmentIdx];
      if (lastSeg && (checkTime < lastSeg.start - 0.2 || checkTime > lastSeg.end + 0.2)) {
        setVideoActiveSegmentIdx(-1);
      }
    }
  }, [videoCurrentTime, currentVideo, videoActiveSegmentIdx, currentView]);

  // Auto-translate active segment when video is paused
  useEffect(() => {
    if (currentView !== 'media') return;
    if (!videoIsPlaying && videoActiveSegmentIdx !== -1) {
      const activeSeg = currentVideo.transcript[videoActiveSegmentIdx];
      if (activeSeg) {
        const text = activeSeg.text;
        setVideoIsTranslatingSegment(true);
        setVideoIsSegmentSaved(false);
        customFetch(`${backendUrl}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        })
          .then(res => res.json())
          .then(data => {
            if (data.translation) {
              setVideoSegmentTranslation(data.translation);
            } else {
              setVideoSegmentTranslation("(Błąd tłumaczenia)");
            }
          })
          .catch(() => {
            setVideoSegmentTranslation("(Błąd połączenia)");
          })
          .finally(() => {
            setVideoIsTranslatingSegment(false);
          });
      }
    } else {
      setVideoSegmentTranslation('');
    }
  }, [videoIsPlaying, videoActiveSegmentIdx, currentVideo, currentView]);

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
  };

  const handleLoadCustomVideo = async () => {
    if (!videoCustomUrl.trim()) {
      setVideoCustomError("Wpisz link lub ID wideo");
      return;
    }
    const yId = extractYoutubeId(videoCustomUrl.trim());
    if (yId.length !== 11) {
      setVideoCustomError("Niepoprawny identyfikator YouTube ID (musi mieć 11 znaków)");
      return;
    }
    
    // Check if already in curated or custom list
    const existingCurated = CURATED_VIDEOS.find(v => v.youtubeId === yId);
    if (existingCurated) {
      setCurrentVideo(existingCurated);
      setVideoCustomUrl('');
      setVideoCustomError('');
      setVideoIsPlaying(false);
      setVideoCurrentTime(0);
      setVideoActiveSegmentIdx(-1);
      return;
    }
    
    const existingCustom = customVideos.find(v => v.youtubeId === yId);
    if (existingCustom) {
      setCurrentVideo(existingCustom);
      setVideoCustomUrl('');
      setVideoCustomError('');
      setVideoIsPlaying(false);
      setVideoCurrentTime(0);
      setVideoActiveSegmentIdx(-1);
      return;
    }

    setVideoIsLoadingCustom(true);
    setVideoCustomError('');
    try {
      const response = await customFetch(`${backendUrl}/api/media/transcript?video_id=${yId}`);
      if (!response.ok) {
        throw new Error("Nie udało się pobrać transkrypcji z serwera");
      }
      const data = await response.json();
      
      const newVideo = {
        id: "custom_" + yId,
        youtubeId: yId,
        title: data.title || "Custom Video",
        transcript: data.transcript || []
      };
      
      const updatedCustom = [newVideo, ...customVideos];
      setCustomVideos(updatedCustom);
      await AsyncStorage.setItem('buddy_custom_videos', JSON.stringify(updatedCustom));
      
      setCurrentVideo(newVideo);
      setVideoCustomUrl('');
      setVideoIsPlaying(false);
      setVideoCurrentTime(0);
      setVideoActiveSegmentIdx(-1);
    } catch (err: any) {
      console.error(err);
      setVideoCustomError(err.message || "Błąd pobierania transkrypcji");
    } finally {
      setVideoIsLoadingCustom(false);
    }
  };

  const handleDeleteCustomVideo = async (yId: string) => {
    const updatedCustom = customVideos.filter(v => v.youtubeId !== yId);
    setCustomVideos(updatedCustom);
    await AsyncStorage.setItem('buddy_custom_videos', JSON.stringify(updatedCustom));
    
    if (currentVideo.youtubeId === yId) {
      setCurrentVideo(CURATED_VIDEOS[0]);
      setVideoIsPlaying(false);
      setVideoCurrentTime(0);
      setVideoActiveSegmentIdx(-1);
    }
  };

  const handleWordClick = async (word: string) => {
    setVideoIsPlaying(false); // Pause wideo
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    if (!cleanWord) return;
    
    setVideoSelectedWord(cleanWord);
    setVideoWordTranslation('');
    setVideoIsTranslatingWord(true);
    setVideoIsWordSaved(false);
    
    try {
      const response = await customFetch(`${backendUrl}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanWord })
      });
      if (response.ok) {
        const data = await response.json();
        setVideoWordTranslation(data.translation || "(Brak tłumaczenia)");
      } else {
        setVideoWordTranslation("(Błąd serwera)");
      }
    } catch (e) {
      setVideoWordTranslation("(Błąd połączenia)");
    } finally {
      setVideoIsTranslatingWord(false);
    }
  };

  const handleSaveWord = async () => {
    if (!user || !videoSelectedWord || !videoWordTranslation) return;
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token,
        },
        body: JSON.stringify({
          original: videoSelectedWord,
          translated: videoWordTranslation,
          story_id: "media_" + currentVideo.youtubeId
        })
      });
      if (response.ok) {
        setVideoIsWordSaved(true);
        Alert.alert("Sukces", `Słowo "${videoSelectedWord}" zostało zapisane.`);
        fetchNotebookWords();
      }
    } catch (e) {
      Alert.alert("Błąd", "Błąd zapisu słowa");
    }
  };

  const handleSaveSegmentPhrase = async () => {
    if (!user || videoActiveSegmentIdx === -1 || !videoSegmentTranslation) return;
    const originalText = currentVideo.transcript[videoActiveSegmentIdx].text;
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token,
        },
        body: JSON.stringify({
          original: originalText,
          translated: videoSegmentTranslation,
          story_id: "media_" + currentVideo.youtubeId
        })
      });
      if (response.ok) {
        setVideoIsSegmentSaved(true);
        Alert.alert("Sukces", "Tłumaczenie całej frazy zostało zapisane.");
        fetchNotebookWords();
      }
    } catch (e) {
      Alert.alert("Błąd", "Błąd zapisu frazy");
    }
  };

  const handleExplainJoke = async (segmentText: string) => {
    setVideoIsPlaying(false);
    setVideoSelectedJokeText(segmentText);
    setVideoJokeExplanation(null);
    setVideoIsExplainingJoke(true);
    setVideoShowJokeModal(true);
    
    try {
      const response = await customFetch(`${backendUrl}/api/media/explain-joke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: segmentText })
      });
      if (response.ok) {
        const data = await response.json();
        setVideoJokeExplanation(data.explanation || {});
      } else {
        setVideoJokeExplanation({ error: "Błąd serwera podczas wyjaśniania żartu." });
      }
    } catch (e) {
      setVideoJokeExplanation({ error: "Błąd połączenia z serwerem." });
    } finally {
      setVideoIsExplainingJoke(false);
    }
  };

  // Handle Auth
  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Błąd', 'Wpisz email i hasło');
      return;
    }
    setAuthLoading(true);
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    try {
      await AsyncStorage.setItem('buddy_backend_url', backendUrl);
      const response = await customFetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await response.json();
      if (response.ok && data.token) {
        const userData = { token: data.token, email: data.email };
        await AsyncStorage.setItem('buddy_user', JSON.stringify(userData));
        setUser(userData);
        setEmail('');
        setPassword('');
      } else {
        Alert.alert('Błąd', data.error || 'Niepoprawne dane logowania');
      }
    } catch (err) {
      Alert.alert('Błąd połączenia', 'Nie udało się połączyć z serwerem. Upewnij się, że serwer działa pod wskazanym adresem IP.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await customFetch(`${backendUrl}/api/logout`, {
          method: 'POST',
          headers: { 'X-Session-Token': user.token },
        });
      } catch (err) {}
    }
    await AsyncStorage.removeItem('buddy_user');
    setUser(null);
    setGeneratedText('');
    setCurrentStoryTitle('');
    setSentences([]);
    setCurrentView('dashboard');
  };

  // Generate Story
  const handleGenerateStory = async () => {
    if (!storyPrompt.trim() && !selectedTopicChip) {
      Alert.alert('Info', 'Wpisz temat opowiadania lub wybierz z kafelków');
      return;
    }
    setIsGenerating(true);
    const promptValue = storyPrompt.trim() || `Story about ${selectedTopicChip}`;
    try {
      const response = await customFetch(`${backendUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || '',
        },
        body: JSON.stringify({
          topics: [promptValue],
          settings: {
            language_level: selectedLevel,
            length: selectedLength,
            is_factual: false,
            genre: 'educational'
          },
        }),
      });
      const data = await response.json();
      // Backend returns [{generated_text: "...", title: "..."}]
      const item = Array.isArray(data) ? data[0] : data;
      const storyText = item?.generated_text || item?.text;
      if (response.ok && storyText) {
        setGeneratedText(storyText);
        const title = item?.title || promptValue.substring(0, 30);
        setCurrentStoryTitle(title);
        setCurrentStoryId(item?.story_id || null);
        
        // Clean sentences
        const parsedSentences = storyText
          .split(/(?<=[.!?])\s+/)
          .filter((s: string) => s.trim().length > 0);
        setSentences(parsedSentences);
        setStoryPrompt('');
        setSelectedTopicChip(null);
        // Reset chat state
        setChatMessages([]);
        chatSessionStarted.current = false;
        paragraphHeightRef.current = 0;
        setCurrentView('workspace');
        // Scroll to top of workspace after a short delay so content is rendered
        setTimeout(() => {
          workspaceScrollRef.current?.scrollTo({ y: 0, animated: false });
        }, 100);
      } else {
        Alert.alert('Błąd', item?.error || data?.error || 'Nie udało się wygenerować opowiadania');
      }
    } catch (err) {
      Alert.alert('Błąd', 'Problem z połączeniem z API');
    } finally {
      setIsGenerating(false);
    }
  };

  // Select Saved Story
  const handleSelectStory = (story: any) => {
    setGeneratedText(story.text);
    setCurrentStoryTitle(story.title);
    setCurrentStoryId(story.id);
    const parsedSentences = story.text
      .split(/(?<=[.!?])\s+/)
      .filter((s: string) => s.trim().length > 0);
    setSentences(parsedSentences);
    // Reset chat state
    setChatMessages([]);
    chatSessionStarted.current = false;
    paragraphHeightRef.current = 0;
    setCurrentView('workspace');
    // Scroll to top
    setTimeout(() => {
      workspaceScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 100);
  };

  // Auto-scroll to active sentence using text proportion (since inline Text onLayout is unreliable)
  const scrollToSentence = (index: number) => {
    if (workspaceScrollRef.current && paragraphHeightRef.current > 0) {
      // Calculate how many characters are before this sentence
      const charsBefore = sentences.slice(0, index).join(' ').length;
      const totalChars = sentences.join(' ').length;
      
      const ratio = totalChars > 0 ? charsBefore / totalChars : 0;
      
      // Approximate Y offset of the sentence within the paragraph
      const estimatedSentenceY = ratio * paragraphHeightRef.current;
      
      // Absolute Y = storyCard offset + estimated sentence offset
      const absoluteY = storyCardYRef.current + estimatedSentenceY;
      const targetY = Math.max(0, absoluteY - 100);
      
      console.log(`[AutoScroll] idx=${index}, ratio=${ratio.toFixed(2)}, estY=${estimatedSentenceY}, absoluteY=${absoluteY}, scrolling to targetY=${targetY}`);
      
      workspaceScrollRef.current.scrollTo({
        y: targetY,
        animated: true,
      });
    }
  };

  // TTS — single sentence
  const speakSentence = async (index: number) => {
    try {
      await stopSpeech();
      setSpeakingSentenceIndex(index);
      setIsSpeaking(true);
      scrollToSentence(index);

      const response = await customFetch(`${backendUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sentences[index],
          voice: selectedVoice || 'en-US-BrianNeural',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.audio_base64) {
        throw new Error(data.error || 'Nie udało się pobrać dźwięku z serwera');
      }

      const uri = `data:audio/mpeg;base64,${data.audio_base64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setSpeakingSentenceIndex(null);
          setIsSpeaking(false);
          sound.unloadAsync();
          soundRef.current = null;
          // If this was the last sentence, auto-start chat
          if (index === sentences.length - 1 && !chatSessionStarted.current) {
            chatSessionStarted.current = true;
            startChatSession(generatedText);
          }
        }
      });
    } catch (err: any) {
      console.log('Error playing sound', err);
      Alert.alert('Błąd odtwarzania', `Nie udało się odtworzyć dźwięku: ${err?.message || String(err)}`);
      setSpeakingSentenceIndex(null);
      setIsSpeaking(false);
    }
  };

  const stopSpeech = async () => {
    speakingRef.current = false;
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // Ignore errors from stopping
      }
      soundRef.current = null;
    }
    await Speech.stop();
    setSpeakingSentenceIndex(null);
    setIsSpeaking(false);
  };

  const speakAll = async (sentenceList: string[]) => {
    if (sentenceList.length === 0) return;
    try {
      await stopSpeech();
      speakingRef.current = true;
      setIsSpeaking(true);
      prefetchCache.current = {}; // Reset cache

      let currentIdx = 0;

      const fetchSentenceBase64 = async (idx: number): Promise<string> => {
        if (prefetchCache.current[idx]) {
          return prefetchCache.current[idx];
        }
        const response = await customFetch(`${backendUrl}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: sentenceList[idx],
            voice: selectedVoice || 'en-US-BrianNeural',
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.audio_base64) {
          throw new Error(data.error || 'Failed to fetch audio');
        }
        const uri = `data:audio/mpeg;base64,${data.audio_base64}`;
        prefetchCache.current[idx] = uri;
        return uri;
      };

      const playNext = async () => {
        if (!speakingRef.current || currentIdx >= sentenceList.length) {
          // All sentences finished — auto-start chat if not already started
          setIsSpeaking(false);
          setSpeakingSentenceIndex(null);
          speakingRef.current = false;
          if (!chatSessionStarted.current) {
            chatSessionStarted.current = true;
            startChatSession(generatedText);
          }
          return;
        }

        setSpeakingSentenceIndex(currentIdx);
        // Auto-scroll to current sentence
        scrollToSentence(currentIdx);

        try {
          // Get audio uri for current sentence
          const uri = await fetchSentenceBase64(currentIdx);

          // Start prefetching next sentence in background
          if (currentIdx + 1 < sentenceList.length) {
            fetchSentenceBase64(currentIdx + 1).catch(() => {});
          }

          // Play sound
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true }
          );
          soundRef.current = sound;

          sound.setOnPlaybackStatusUpdate(async (status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync();
              soundRef.current = null;
              currentIdx++;
              playNext();
            }
          });
        } catch (playErr) {
          console.log('Error playing in speakAll sequence', playErr);
          currentIdx++;
          playNext();
        }
      };

      playNext();
    } catch (err: any) {
      console.log('Error starting speakAll', err);
      Alert.alert('Błąd odtwarzania', `Nie udało się rozpocząć czytania: ${err?.message || String(err)}`);
      setIsSpeaking(false);
      speakingRef.current = false;
    }
  };

  const handleLongPressSentence = async (index: number) => {
    if (translatedSentenceIdx === index) {
      setTranslatedSentenceIdx(null);
      setTranslationText('');
      return;
    }
    
    setIsTranslating(true);
    setTranslatedSentenceIdx(index);
    setTranslationText('Tłumaczenie...');
    
    try {
      const response = await customFetch(`${backendUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentences[index] }),
      });
      const data = await response.json();
      if (response.ok && data.translation) {
        setTranslationText(data.translation);
      } else {
        setTranslationText('Błąd tłumaczenia');
      }
    } catch (err) {
      setTranslationText('Błąd połączenia');
    } finally {
      setIsTranslating(false);
    }
  };

  const deleteWord = async (originalWord: string) => {
    if (!user) return;
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary/${encodeURIComponent(originalWord)}`, {
        method: 'DELETE',
        headers: {
          'X-Session-Token': user.token,
        },
      });
      if (response.ok) {
        setNotebookWords(prev => prev.filter(w => w.original !== originalWord));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToVocabulary = async (original: string, translated: string) => {
    if (!user) {
      Alert.alert('Błąd', 'Musisz być zalogowany, aby dodać słowo do słownika.');
      return;
    }
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user.token,
        },
        body: JSON.stringify({
          original: original,
          translated: translated,
          story_id: currentStoryId,
        }),
      });
      if (response.ok) {
        Alert.alert('Sukces', 'Dodano zdanie do słowniczka!');
        fetchNotebookWords();
      } else {
        const errData = await response.json();
        Alert.alert('Błąd', errData.error || 'Nie udało się dodać do słowniczka');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Błąd', 'Wystąpił błąd połączenia');
    }
  };

  const speakBotText = async (text: string) => {
    try {
      await stopSpeech();
      setIsBotSpeaking(true);

      const response = await customFetch(`${backendUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice || 'en-US-BrianNeural',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.audio_base64) {
        throw new Error(data.error || 'Nie udało się pobrać dźwięku z serwera');
      }

      const uri = `data:audio/mpeg;base64,${data.audio_base64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsBotSpeaking(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (err: any) {
      console.log('Error playing bot speech', err);
      setIsBotSpeaking(false);
    }
  };

  const startChatSession = async (storyText: string) => {
    if (!user) return;
    setIsProcessingChat(true);
    setChatMessages([]);
    try {
      const formData = new FormData();
      formData.append('story_text', storyText);
      formData.append('history', JSON.stringify([]));

      const response = await customFetch(`${backendUrl}/api/stories/chat-next`, {
        method: 'POST',
        headers: {
          'X-Session-Token': user.token,
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.bot_response) {
        const botMsg = {
          id: String(Date.now()),
          sender: 'bot',
          text: result.bot_response,
        };
        setChatMessages([botMsg]);
        speakBotText(result.bot_response);
      }
    } catch (err) {
      console.error('Error starting chat:', err);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const startRecordingAnswer = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Błąd', 'Wymagane jest zezwolenie na korzystanie z mikrofonu.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecordingObject(recording);
      setIsRecordingAnswer(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Błąd', 'Nie udało się rozpocząć nagrywania.');
    }
  };

  const sendVoiceAnswerToChat = async () => {
    if (!recordingObject) return;
    setIsRecordingAnswer(false);
    setIsProcessingChat(true);
    try {
      await recordingObject.stopAndUnloadAsync();
      const uri = recordingObject.getURI();
      setRecordingObject(null);

      if (!uri) {
        Alert.alert('Błąd', 'Brak nagrania audio.');
        setIsProcessingChat(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const historyForAPI = chatMessages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const formData = new FormData();
      formData.append('story_text', generatedText);
      formData.append('history', JSON.stringify(historyForAPI));
      formData.append('audio', {
        uri: uri,
        name: 'answer.m4a',
        type: 'audio/m4a',
      } as any);

      const response = await customFetch(`${backendUrl}/api/stories/chat-next`, {
        method: 'POST',
        headers: {
          'X-Session-Token': user?.token || '',
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        const userMsg = {
          id: String(Date.now()) + '_user',
          sender: 'user',
          text: result.user_transcription || '...',
          evaluation: result.user_evaluation,
        };

        const botMsg = {
          id: String(Date.now() + 1) + '_bot',
          sender: 'bot',
          text: result.bot_response,
        };

        setChatMessages(prev => [...prev, userMsg, botMsg]);
        speakBotText(result.bot_response);
      } else {
        Alert.alert('Błąd', result.error || 'Nie udało się przetworzyć odpowiedzi.');
      }
    } catch (err) {
      console.error('Error sending voice chat answer:', err);
      Alert.alert('Błąd', 'Wystąpił problem z połączeniem podczas przesyłania odpowiedzi.');
    } finally {
      setIsProcessingChat(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.headerSpacer} />
          <Text style={styles.authLogo}>AI English Buddy</Text>
          <Text style={styles.authSub}>Twoja inteligentna nauka języka angielskiego</Text>

          <View style={styles.authCard}>
            <Text style={styles.authLabel}>Adres IP komputera (Backend)</Text>
            <TextInput
              style={styles.authInput}
              value={backendUrl}
              onChangeText={setBackendUrl}
              placeholder="http://192.168.1.100:5001"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.authLabel}>Email</Text>
            <TextInput
              style={styles.authInput}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.authLabel}>Hasło</Text>
            <TextInput
              style={styles.authInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity style={styles.authButton} onPress={handleAuth} disabled={authLoading}>
              {authLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.authButtonText}>
                  {authMode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchAuth}
              onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              <Text style={styles.switchAuthText}>
                {authMode === 'login'
                  ? 'Nie masz konta? Zarejestruj się'
                  : 'Masz już konto? Zaloguj się'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appContainer}>
      {/* Top Header */}
      {/* Header — schowany gdy workspace z historią */}
      {!(currentView === 'workspace' && generatedText) && (
        <View style={styles.appHeader}>
          {currentView === 'dashboard' ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 32, alignItems: 'flex-start' }}>
                <Svg width={28} height={28} viewBox="0 0 100 100" fill="none">
                  <Path d="M65 30C65 20 55 15 45 15C30 15 30 35 50 45C70 55 70 75 55 85C45 90 35 85 35 75" stroke="#111827" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={[styles.appTitle, { textAlign: 'center', flex: 1 }]}>Chat Live</Text>
              <View style={{ width: 32 }} />
            </View>
          ) : (
            <>
              <Text style={styles.appTitle}>
                {currentView === 'workspace' && 'Practice Room'}
                {currentView === 'stories' && 'Saved Stories'}
                {currentView === 'notebook' && 'Vocabulary'}
                {currentView === 'media' && 'Media Buddy'}
                {currentView === 'settings' && 'Settings'}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Przełącznik trybu czytania — tylko w workspace z historią */}
      {currentView === 'workspace' && generatedText ? (
        <View style={styles.readerToolbar}>
          <Text style={[styles.readerModeLabel, readMode === 'single' && styles.readerModeLabelActive]}>
            Zdanie
          </Text>
          <Switch
            value={readMode === 'all'}
            onValueChange={(val) => {
              if (val) {
                setReadMode('all');
                speakAll(sentences);
              } else {
                setReadMode('single');
                stopSpeech();
              }
            }}
            trackColor={{ false: '#DADCE0', true: '#1A73E8' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#DADCE0"
            style={{ marginHorizontal: 8 }}
          />
          <Text style={[styles.readerModeLabel, readMode === 'all' && styles.readerModeLabelActive]}>
            Cały tekst
          </Text>

          {isSpeaking && (
            <TouchableOpacity
              style={styles.readerStopBtn}
              onPress={() => {
                stopSpeech();
                setReadMode('single');
              }}
            >
              <Text style={styles.readerStopBtnText}>⏹ Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Primary Content Switcher */}
      <View style={styles.contentArea}>
        {currentView === 'dashboard' && (() => {
          // Determine current active state for the voice orb
          let orbStatus = "inactive";
          if (isVoiceTutorActive) {
            if (isVoiceTutorProcessing) {
              orbStatus = "thinking";
            } else if (isVoiceTutorBotSpeaking) {
              orbStatus = "speaking";
            } else if (isVoiceTutorRecording) {
              orbStatus = voiceTutorUserIsSpeaking ? "user-speaking" : "listening";
            }
          }

          // Scale value based on volume metering level
          const lastUserMessage = [...voiceTutorMessages].reverse().find(msg => msg.sender === 'user');
          const transcriptionText = lastUserMessage ? `"${lastUserMessage.text}"` : '...';

          return (
            <View style={styles.voiceTutorContainer}>
              
              {/* Main Stage */}
              <View style={styles.voiceTutorStage}>
                
                {/* Outlined Microphone Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.voiceOrbButton}
                  onPress={isVoiceTutorActive ? handleEndVoiceTutorSession : handleStartVoiceTutorSession}
                >
                  <Svg width={80} height={80} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" stroke={isVoiceTutorActive ? "#1A73E8" : "#9CA3AF"} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M19 10v1a7 7 0 0 1-14 0v-1" stroke={isVoiceTutorActive ? "#1A73E8" : "#9CA3AF"} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M12 18v3" stroke={isVoiceTutorActive ? "#1A73E8" : "#9CA3AF"} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M9 21h6" stroke={isVoiceTutorActive ? "#1A73E8" : "#9CA3AF"} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>

                {/* Status label (large, light sans-serif) */}
                <Text style={{ fontSize: 28, fontWeight: '300', color: '#1F2937', marginTop: 32, textAlign: 'center' }}>
                  {!isVoiceTutorActive && "Tap to Start"}
                  {isVoiceTutorActive && orbStatus === "inactive" && "Connecting..."}
                  {isVoiceTutorActive && orbStatus === "speaking" && "Speaking"}
                  {isVoiceTutorActive && orbStatus === "listening" && "Listening"}
                  {isVoiceTutorActive && orbStatus === "user-speaking" && "Listening"}
                  {isVoiceTutorActive && orbStatus === "thinking" && "Thinking..."}
                </Text>

                {/* Waveform component with session timer in the middle */}
                {isVoiceTutorActive && (
                  <Waveform 
                    isActive={isVoiceTutorActive} 
                    isSpeaking={orbStatus === "speaking" || orbStatus === "user-speaking"} 
                    timeText={formatDuration(voiceSessionDuration)} 
                  />
                )}

                {/* User transcription */}
                {isVoiceTutorActive && (
                  <Text style={styles.transcriptText}>
                    {transcriptionText}
                  </Text>
                )}

                {/* Toggle Transcript button */}
                {isVoiceTutorActive && voiceTutorMessages.length > 0 && (
                  <TouchableOpacity
                    style={[styles.transcriptToggleBtn, { marginTop: 24 }, voiceTutorShowTranscript ? styles.transcriptToggleBtnActive : null]}
                    onPress={() => setVoiceTutorShowTranscript(!voiceTutorShowTranscript)}
                  >
                    <Text style={[styles.transcriptToggleBtnText, voiceTutorShowTranscript ? styles.transcriptToggleBtnTextActive : null]}>
                      {voiceTutorShowTranscript ? "🙈 Ukryj tekst" : "👁 Pokaż tekst"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tips when inactive */}
              {!isVoiceTutorActive && !voiceTutorSummary && (
                <View style={styles.voiceTutorTips}>
                  <Text style={styles.voiceTutorTipsText}>
                    🎧 Używaj słuchawek, aby zapobiec zapętleniu dźwięku.
                  </Text>
                </View>
              )}

              {/* Slide-up Transcript Drawer */}
              {isVoiceTutorActive && voiceTutorMessages.length > 0 && voiceTutorShowTranscript && (
                <View style={styles.mobileTranscriptDrawer}>
                  <View style={styles.drawerHeader}>
                    <Text style={styles.drawerTitle}>Zapis rozmowy</Text>
                    <TouchableOpacity onPress={() => setVoiceTutorShowTranscript(false)}>
                      <Text style={styles.drawerCloseText}>Ukryj</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.drawerScroll}
                    contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
                    nestedScrollEnabled={true}
                  >
                    {voiceTutorMessages.map((msg) => {
                      const isBot = msg.sender === "bot";
                      return (
                        <View
                          key={msg.id}
                          style={[
                            styles.mobileBubbleContainer,
                            isBot ? styles.mobileBubbleContainerBot : styles.mobileBubbleContainerUser
                          ]}
                        >
                          <View
                            style={[
                              styles.mobileBubble,
                              isBot ? styles.mobileBubbleBot : styles.mobileBubbleUser
                            ]}
                          >
                            <Text style={styles.mobileBubbleSpeaker}>{isBot ? "Lektor:" : "Ty:"}</Text>
                            <Text style={[
                              styles.mobileBubbleText,
                              isBot ? styles.mobileBubbleTextBot : styles.mobileBubbleTextUser
                            ]}>
                              {msg.text}
                            </Text>
                            {!isBot && msg.evaluation && (
                              <View style={styles.mobileBubbleEval}>
                                <Text style={styles.mobileBubbleEvalScore}>
                                  🏆 Ocena: <strong>{msg.evaluation.score}/100</strong>
                                </Text>
                                {msg.evaluation.feedback && (
                                  <Text style={styles.mobileBubbleEvalFeedback}>
                                    💡 {msg.evaluation.feedback}
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })()}

        {currentView === 'workspace' && (
          <ScrollView ref={workspaceScrollRef} contentContainerStyle={styles.workspaceContainer}>
            {/* Generator input if no story generated */}
            {!generatedText ? (
              <View style={styles.generatorCard}>
                <Text style={styles.generatorHeader}>O czym chcesz stworzyć opowiadanie?</Text>
                <TextInput
                  style={styles.promptInput}
                  value={storyPrompt}
                  onChangeText={setStoryPrompt}
                  placeholder="Wpisz temat np. 'A lost astronaut on an alien planet...'"
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.chipsHeader}>Sugerowane tematy (opcjonalnie):</Text>
                <View style={styles.chipsContainer}>
                  {suggestedTopics.map((topic, i) => {
                    const isSelected = selectedTopicChip === topic;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.chip, isSelected ? styles.chipSelected : null]}
                        onPress={() => setSelectedTopicChip(isSelected ? null : topic)}
                      >
                        <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                          {topic}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Poziom trudności */}
                <Text style={styles.selectorLabel}>Poziom trudności angielskiego:</Text>
                <View style={styles.selectorRow}>
                  {[
                    { id: 'simple', label: 'Prosty (A1-A2)' },
                    { id: 'medium', label: 'Średni (B1-B2)' },
                    { id: 'advanced', label: 'Zaawansowany (C1-C2)' }
                  ].map((lvl) => {
                    const isSel = selectedLevel === lvl.id;
                    return (
                      <TouchableOpacity
                        key={lvl.id}
                        style={[styles.selectorBtn, isSel ? styles.selectorBtnActive : null]}
                        onPress={() => setSelectedLevel(lvl.id as any)}
                      >
                        <Text style={[styles.selectorBtnText, isSel ? styles.selectorBtnTextActive : null]}>
                          {lvl.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Długość */}
                <Text style={styles.selectorLabel}>Długość opowiadania:</Text>
                <View style={styles.selectorRow}>
                  {[
                    { id: 'short', label: 'Krótkie' },
                    { id: 'medium', label: 'Średnie' },
                    { id: 'long', label: 'Długie' }
                  ].map((len) => {
                    const isSel = selectedLength === len.id;
                    return (
                      <TouchableOpacity
                        key={len.id}
                        style={[styles.selectorBtn, isSel ? styles.selectorBtnActive : null]}
                        onPress={() => setSelectedLength(len.id as any)}
                      >
                        <Text style={[styles.selectorBtnText, isSel ? styles.selectorBtnTextActive : null]}>
                          {len.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={handleGenerateStory}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.generateButtonText}>Generuj opowiadanie</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.readerContainer}>
                {/* Active story title */}
                <View style={styles.readerHeaderRow}>
                  <Text style={styles.readerStoryTitle}>{currentStoryTitle}</Text>
                  <TouchableOpacity
                    style={styles.clearStoryButton}
                    onPress={() => {
                      setGeneratedText('');
                      setCurrentStoryTitle('');
                      setSentences([]);
                      setChatMessages([]);
                      setIsBotSpeaking(false);
                    }}
                  >
                    <Text style={styles.clearStoryButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={styles.storyTextCard}
                  onLayout={(e) => {
                    // Track where storyTextCard starts in the ScrollView
                    storyCardYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.instructionsText}>
                    Dotknij zdania, aby je odsłuchać. Przytrzymaj, aby zobaczyć tłumaczenie.
                  </Text>

                  {/* Paragraph Text with onLayout to capture total height */}
                  <Text 
                    style={styles.paragraphText}
                    onLayout={(e) => {
                      paragraphHeightRef.current = e.nativeEvent.layout.height;
                    }}
                  >
                    {sentences.map((sentence, idx) => {
                      const isSpeakingSentence = speakingSentenceIndex === idx;
                      return (
                        <Text
                          key={idx}
                          style={[
                            styles.sentenceText,
                            isSpeakingSentence ? styles.sentenceTextActive : null,
                          ]}
                          onPress={() => readMode === 'single' ? speakSentence(idx) : null}
                          onLongPress={() => handleLongPressSentence(idx)}
                        >
                          {sentence}{' '}
                        </Text>
                      );
                    })}
                  </Text>
                </View>

                {/* Loader rozpoczynania rozmowy */}
                {isProcessingChat && chatMessages.length === 0 && (
                  <View style={styles.loadingQuestionsContainer}>
                    <ActivityIndicator size="small" color="#1A73E8" />
                    <Text style={styles.loadingQuestionsText}>Rozpoczynanie rozmowy audio z lektorem...</Text>
                  </View>
                )}

                {/* Rozmowa audio z lektorem */}
                {chatMessages.length > 0 && (
                  <View style={styles.chatCard}>
                    <Text style={styles.questionsHeader}>Rozmowa z lektorem (Audio Chat):</Text>
                    
                    <ScrollView
                      ref={chatScrollRef}
                      style={styles.chatContainer}
                      contentContainerStyle={{ gap: 12 }}
                      nestedScrollEnabled={true}
                    >
                      {chatMessages.map((msg) => {
                        const isBot = msg.sender === 'bot';
                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.chatBubbleContainer,
                              isBot ? styles.chatBubbleContainerBot : styles.chatBubbleContainerUser
                            ]}
                          >
                            <View
                              style={[
                                styles.chatBubble,
                                isBot ? styles.chatBubbleBot : styles.chatBubbleUser
                              ]}
                            >
                              <Text style={[
                                styles.chatBubbleText,
                                isBot ? styles.chatBubbleTextBot : styles.chatBubbleTextUser
                              ]}>
                                {msg.text}
                              </Text>

                              {/* Ocenianie wypowiedzi użytkownika */}
                              {!isBot && msg.evaluation && (
                                <View style={styles.chatEvaluationBox}>
                                  <View style={styles.evaluationScoreRow}>
                                    <Text style={styles.chatEvalScore}>
                                      Wynik: {msg.evaluation.score}/100 ({msg.evaluation.is_correct ? 'Ok' : 'Popraw'})
                                    </Text>
                                  </View>
                                  {msg.evaluation.feedback && (
                                    <Text style={styles.chatEvalFeedback}>
                                      💡 {msg.evaluation.feedback}
                                    </Text>
                                  )}
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>

                    {/* Przyciski sterowania głosem */}
                    <View style={styles.chatControlsContainer}>
                      {isProcessingChat ? (
                        <View style={styles.evaluatingLoader}>
                          <ActivityIndicator size="small" color="#1A73E8" />
                          <Text style={styles.evaluatingText}>
                            {chatMessages.length > 1 ? 'Bot słucha i analizuje...' : 'Bot myśli...'}
                          </Text>
                        </View>
                      ) : isRecordingAnswer ? (
                        <TouchableOpacity
                          style={styles.recordButtonActive}
                          onPress={sendVoiceAnswerToChat}
                        >
                          <Text style={styles.recordButtonText}>⏹ Wyślij odpowiedź</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={styles.recordButton}
                            onPress={startRecordingAnswer}
                            disabled={isBotSpeaking}
                          >
                            <Text style={styles.recordButtonText}>
                              🎙 {isBotSpeaking ? 'Bot mówi...' : 'Odpowiedz głosem'}
                            </Text>
                          </TouchableOpacity>

                          {isBotSpeaking && (
                            <TouchableOpacity
                              style={[styles.recordButtonActive, { backgroundColor: '#5F6368' }]}
                              onPress={() => {
                                stopSpeech();
                                setIsBotSpeaking(false);
                              }}
                            >
                              <Text style={styles.recordButtonText}>🔇 Wycisz</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}

              </View>
            )}
          </ScrollView>
        )}

        {currentView === 'stories' && (
          <View style={{ flex: 1 }}>
            {loadingStories ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#1A73E8" />
            ) : (
              <ScrollView contentContainerStyle={styles.listContainer}>
                {savedStories.length === 0 ? (
                  <Text style={styles.emptyText}>Brak zapisanych opowiadań.</Text>
                ) : (
                  savedStories.map((story) => (
                    <TouchableOpacity
                      key={story.id}
                      style={styles.storyListItem}
                      onPress={() => handleSelectStory(story)}
                    >
                      <Text style={styles.storyListTitle}>{story.title}</Text>
                      <Text style={styles.storyListSnippet} numberOfLines={2}>
                        {story.text}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        )}

        {currentView === 'notebook' && (
          <View style={{ flex: 1 }}>
            {loadingVocabulary ? (
              <ActivityIndicator style={{ marginTop: 24 }} color="#1A73E8" />
            ) : (
              <ScrollView contentContainerStyle={styles.listContainer}>
                {notebookWords.length === 0 ? (
                  <Text style={styles.emptyText}>Twój słowniczek jest pusty.</Text>
                ) : (
                  notebookWords.map((item, idx) => (
                    <View key={idx} style={styles.vocabItem}>
                      <View style={styles.vocabTextContainer}>
                        <Text style={styles.vocabOriginal}>{item.original}</Text>
                        <Text style={styles.vocabTranslation}>{item.translated}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={styles.deleteVocabBtn}
                          onPress={() => speakBotText(item.original)}
                        >
                          <Text style={{ color: '#1A73E8', fontSize: 13, fontWeight: '600' }}>🎧 Odtwórz</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteVocabBtn}
                          onPress={() => deleteWord(item.original)}
                        >
                          <Text style={styles.deleteVocabText}>Usuń</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        )}

        {currentView === 'media' && (
          <View style={styles.mediaMainContainer}>
            {/* Header Bar with Dropdown/Selector trigger */}
            <View style={styles.mediaHeaderBar}>
              <Text style={styles.mediaVideoTitle} numberOfLines={1}>
                {currentVideo.title}
              </Text>
              <TouchableOpacity 
                style={styles.selectVideoHeaderBtn}
                onPress={() => setVideoShowSelectorModal(true)}
              >
                <Text style={styles.selectVideoHeaderBtnText}>Wybierz film 🎬</Text>
              </TouchableOpacity>
            </View>

            {/* YouTube Player Card (Fixed Height at top) */}
            <View style={styles.playerCardCompact}>
              <YoutubePlayer
                ref={playerRef}
                height={((width - 32) * 9) / 16}
                width={width - 32}
                videoId={currentVideo.youtubeId}
                play={videoIsPlaying}
                onChangeState={(state: any) => {
                  if (state === "playing") setVideoIsPlaying(true);
                  if (state === "paused") setVideoIsPlaying(false);
                  if (state === "ended") setVideoIsPlaying(false);
                }}
              />
              <View style={styles.playerControlsCompact}>
                <TouchableOpacity 
                  style={[styles.controlBtnCompact, videoIsPlaying ? styles.controlBtnCompactActive : null]}
                  onPress={() => setVideoIsPlaying(!videoIsPlaying)}
                >
                  <Text style={[styles.controlBtnCompactText, videoIsPlaying ? styles.controlBtnCompactTextActive : null]}>
                    {videoIsPlaying ? "⏸ Pauza" : "▶ Odtwórz"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.playerTimeTextCompact}>
                  {Math.floor(videoCurrentTime)}s / {currentVideo.transcript.length > 0 ? Math.floor(currentVideo.transcript[currentVideo.transcript.length - 1].end) : 0}s
                </Text>
              </View>
            </View>

            {/* Transcript Scroll Container (Flexible height) */}
            <View style={styles.mediaTranscriptFlexContainer}>
              <ScrollView 
                ref={transcriptScrollRef}
                style={styles.transcriptScrollView}
                contentContainerStyle={styles.transcriptScrollContent}
                nestedScrollEnabled={true}
              >
                {currentVideo.transcript.length === 0 ? (
                  <Text style={styles.emptyText}>Brak transkrypcji dla tego wideo.</Text>
                ) : (
                  currentVideo.transcript.map((seg: any, idx: number) => {
                    const isActive = idx === videoActiveSegmentIdx;
                    const words = seg.text.split(" ");
                    
                    return (
                      <View 
                        key={idx} 
                        style={[styles.segmentCard, isActive && styles.segmentCardActive]}
                      >
                        <View style={styles.segmentHeader}>
                          <Text style={styles.segmentTime}>
                            {Math.floor(seg.start)}s - {Math.floor(seg.end)}s
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity 
                              style={styles.cardActionBtn}
                              onPress={() => handleExplainJoke(seg.text)}
                            >
                              <Text style={styles.cardActionBtnText}>💡 Wyjaśnij żart</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.cardActionBtn}
                              onPress={async () => {
                                setVideoIsPlaying(false);
                                if (playerRef.current) {
                                  await playerRef.current.seekTo(seg.start, true);
                                  setVideoCurrentTime(seg.start);
                                  setVideoActiveSegmentIdx(idx);
                                }
                              }}
                            >
                              <Text style={styles.cardActionBtnText}>▶ Odtwórz stąd</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.wordsRow}>
                          {words.map((w: string, wIdx: number) => (
                            <TouchableOpacity 
                              key={wIdx} 
                              onPress={() => handleWordClick(w)}
                              style={styles.wordTouch}
                            >
                              <Text style={styles.wordText}>{w}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Floating Dictionary & Translation Sheet */}
            {(videoSelectedWord !== '' || videoSegmentTranslation !== '') && (
              <View style={styles.floatingDictCard}>
                <View style={styles.dictCardHeader}>
                  <Text style={styles.dictCardTitle}>📓 Słownik i Tłumaczenie</Text>
                  <TouchableOpacity 
                    style={styles.dictCardCloseBtn}
                    onPress={() => {
                      setVideoSelectedWord('');
                      setVideoWordTranslation('');
                      setVideoSegmentTranslation('');
                    }}
                  >
                    <Text style={styles.dictCardCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled={true}>
                  {/* Word translation */}
                  {videoSelectedWord !== '' && (
                    <View style={styles.dictSection}>
                      <Text style={styles.dictLabel}>TŁUMACZENIE SŁOWA:</Text>
                      <View style={styles.dictRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dictOriginal}>"{videoSelectedWord}"</Text>
                          <Text style={styles.dictTranslated}>{videoWordTranslation || "Tłumaczenie..."}</Text>
                        </View>
                        <TouchableOpacity 
                          style={[styles.dictSaveBtn, videoIsWordSaved && styles.dictSaveBtnDisabled]}
                          onPress={handleSaveWord}
                          disabled={videoIsWordSaved}
                        >
                          <Text style={styles.dictSaveBtnText}>
                            {videoIsWordSaved ? "Zapisane" : "Zapisz (+)"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Phrase translation */}
                  {videoSegmentTranslation !== '' && (
                    <View style={[styles.dictSection, videoSelectedWord !== '' && styles.dictSectionDivider]}>
                      <Text style={styles.dictLabel}>TŁUMACZENIE FRAZY:</Text>
                      <View style={styles.dictRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.dictOriginalPhrase}>
                            "{currentVideo.transcript[videoActiveSegmentIdx]?.text}"
                          </Text>
                          <Text style={styles.dictTranslatedPhrase}>{videoSegmentTranslation}</Text>
                        </View>
                        <TouchableOpacity 
                          style={[styles.dictSaveBtn, videoIsSegmentSaved && styles.dictSaveBtnDisabled]}
                          onPress={handleSaveSegmentPhrase}
                          disabled={videoIsSegmentSaved}
                        >
                          <Text style={styles.dictSaveBtnText}>
                            {videoIsSegmentSaved ? "Zapisane" : "Zapisz (+)"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Video Selector Modal */}
        <Modal
          visible={videoShowSelectorModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setVideoShowSelectorModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.videoSelectorModalContent}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalHeading}>Wybierz lub dodaj film</Text>
                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => setVideoShowSelectorModal(false)}
                >
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.videoSelectorModalScroll}>
                <Text style={styles.modalSectionLabel}>Dostępne wideo:</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.videoCarouselModal}
                >
                  {/* Curated Videos */}
                  {CURATED_VIDEOS.map((vid) => {
                    const isSelected = currentVideo.youtubeId === vid.youtubeId;
                    return (
                      <TouchableOpacity
                        key={vid.id}
                        style={[styles.videoCard, isSelected && styles.videoCardActive]}
                        onPress={() => {
                          setCurrentVideo(vid);
                          setVideoIsPlaying(false);
                          setVideoCurrentTime(0);
                          setVideoActiveSegmentIdx(-1);
                          setVideoSelectedWord('');
                          setVideoWordTranslation('');
                          setVideoSegmentTranslation('');
                          setVideoShowSelectorModal(false);
                        }}
                      >
                        <View style={styles.thumbnailWrapper}>
                          <Image 
                            source={{ uri: `https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg` }}
                            style={styles.videoThumbnail}
                            resizeMode="cover"
                          />
                          {isSelected && (
                            <View style={styles.activeVideoOverlay}>
                              <Text style={styles.activeOverlayText}>▶ Aktywny</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.videoCardTitle, isSelected && styles.videoCardTitleActive]} numberOfLines={2}>
                          {vid.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Custom Videos */}
                  {customVideos.map((vid) => {
                    const isSelected = currentVideo.youtubeId === vid.youtubeId;
                    return (
                      <TouchableOpacity
                        key={vid.id}
                        style={[styles.videoCard, isSelected && styles.videoCardActive]}
                        onPress={() => {
                          setCurrentVideo(vid);
                          setVideoIsPlaying(false);
                          setVideoCurrentTime(0);
                          setVideoActiveSegmentIdx(-1);
                          setVideoSelectedWord('');
                          setVideoWordTranslation('');
                          setVideoSegmentTranslation('');
                          setVideoShowSelectorModal(false);
                        }}
                      >
                        <View style={styles.thumbnailWrapper}>
                          <Image 
                            source={{ uri: `https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg` }}
                            style={styles.videoThumbnail}
                            resizeMode="cover"
                          />
                          <TouchableOpacity 
                            style={styles.deleteCustomVideoBadge}
                            onPress={() => handleDeleteCustomVideo(vid.youtubeId)}
                          >
                            <Text style={styles.deleteCustomVideoText}>✕</Text>
                          </TouchableOpacity>
                          {isSelected && (
                            <View style={styles.activeVideoOverlay}>
                              <Text style={styles.activeOverlayText}>▶ Aktywny</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.videoCardTitle, isSelected && styles.videoCardTitleActive]} numberOfLines={2}>
                          {vid.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Custom Video Form inside selector modal */}
                <View style={styles.customVideoFormModal}>
                  <Text style={styles.formLabel}>Dodaj własny film z YouTube:</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.formInput}
                      value={videoCustomUrl}
                      onChangeText={setVideoCustomUrl}
                      placeholder="Wklej link YouTube..."
                      placeholderTextColor="#9AA0A6"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity 
                      style={styles.formBtn}
                      onPress={async () => {
                        await handleLoadCustomVideo();
                      }}
                      disabled={videoIsLoadingCustom}
                    >
                      {videoIsLoadingCustom ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.formBtnText}>Dodaj</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {videoCustomError ? (
                    <Text style={styles.errorText}>{videoCustomError}</Text>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Joke Explanation Modal */}
        <Modal
          visible={videoShowJokeModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setVideoShowJokeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.jokeModalContent}>
              <View style={styles.jokeModalHeaderRow}>
                <Text style={styles.modalHeading}>Wyjaśnienie humoru</Text>
                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => setVideoShowJokeModal(false)}
                >
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView contentContainerStyle={styles.jokeModalScroll}>
                <View style={styles.quoteCard}>
                  <Text style={styles.quoteLabel}>CYTAT:</Text>
                  <Text style={styles.quoteText}>"{videoSelectedJokeText}"</Text>
                </View>

                {videoIsExplainingJoke ? (
                  <View style={styles.jokeLoadingContainer}>
                    <ActivityIndicator size="large" color="#1A73E8" />
                    <Text style={styles.loadingText}>Analizuję kontekst i humor...</Text>
                  </View>
                ) : videoJokeExplanation ? (
                  videoJokeExplanation.error ? (
                    <Text style={styles.errorText}>{videoJokeExplanation.error}</Text>
                  ) : (
                    <View style={styles.explanationGrid}>
                      <View style={styles.expCard}>
                        <Text style={styles.expTitle}>📝 Dosłowne znaczenie</Text>
                        <Text style={styles.expDesc}>{videoJokeExplanation.literal_meaning || "N/A"}</Text>
                      </View>

                      <View style={styles.expCard}>
                        <Text style={styles.expTitle}>🌍 Kontekst kulturowy</Text>
                        <Text style={styles.expDesc}>{videoJokeExplanation.cultural_context || "N/A"}</Text>
                      </View>

                      <View style={styles.expCard}>
                        <Text style={styles.expTitle}>🎭 Sarkazm i ton</Text>
                        <Text style={styles.expDesc}>{videoJokeExplanation.sarcasm_and_tone || "N/A"}</Text>
                      </View>

                      <View style={styles.expCard}>
                        <Text style={styles.expTitle}>💬 Gra słów i humor</Text>
                        <Text style={styles.expDesc}>{videoJokeExplanation.wordplay_and_humor || "N/A"}</Text>
                      </View>

                      <View style={styles.expCardPrimary}>
                        <Text style={styles.expTitlePrimary}>💡 Komentarz AI</Text>
                        <Text style={styles.expDescPrimary}>{videoJokeExplanation.ai_comment || "N/A"}</Text>
                      </View>
                    </View>
                  )
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {currentView === 'settings' && (
          <ScrollView contentContainerStyle={styles.dashboardContainer}>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeTitle}>Ustawienia</Text>

              <Text style={styles.authLabel}>Adres IP Backendu</Text>
              <TextInput
                style={styles.authInput}
                value={backendUrl}
                onChangeText={async (text) => {
                  setBackendUrl(text);
                  await AsyncStorage.setItem('buddy_backend_url', text);
                }}
                placeholder="http://192.168.1.100:5001"
                autoCapitalize="none"
              />

              <Text style={styles.authLabel}>Głos lektora (Neural TTS):</Text>
              <ScrollView 
                style={styles.voiceSelectorContainer}
                nestedScrollEnabled={true}
              >
                {EDGE_TTS_VOICES.map((voice) => {
                  const isSelected = selectedVoice === voice.identifier;
                  return (
                    <TouchableOpacity
                      key={voice.identifier}
                      style={[
                        styles.voiceItem,
                        isSelected ? styles.voiceItemActive : null
                      ]}
                      onPress={async () => {
                        setSelectedVoice(voice.identifier);
                        await AsyncStorage.setItem('buddy_tts_voice', voice.identifier);
                      }}
                    >
                      <Text style={[
                        styles.voiceItemText,
                        isSelected ? styles.voiceItemTextActive : null
                      ]}>
                        {voice.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Wyloguj się</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>



      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentView('dashboard')}
        >
          <HomeIcon color={currentView === 'dashboard' ? '#1A73E8' : '#5F6368'} />
          <Text style={[styles.navText, currentView === 'dashboard' ? styles.navTextActive : null]}>
            Chat Live
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentView('workspace')}
        >
          <BookIcon color={currentView === 'workspace' ? '#1A73E8' : '#5F6368'} />
          <Text style={[styles.navText, currentView === 'workspace' ? styles.navTextActive : null]}>
            Practice
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentView('stories')}
        >
          <HistoryIcon color={currentView === 'stories' ? '#1A73E8' : '#5F6368'} />
          <Text style={[styles.navText, currentView === 'stories' ? styles.navTextActive : null]}>
            Stories
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentView('notebook')}
        >
          <BookIcon color={currentView === 'notebook' ? '#1A73E8' : '#5F6368'} />
          <Text style={[styles.navText, currentView === 'notebook' ? styles.navTextActive : null]}>
            Vocab
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setCurrentView('media');
            // Pause pronunciation or speech tutor if switching to media
            stopVoiceTutorAudio();
          }}
        >
          <MediaIcon color={currentView === 'media' ? '#1A73E8' : '#5F6368'} />
          <Text style={[styles.navText, currentView === 'media' ? styles.navTextActive : null]}>
            Media
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentView('settings')}
        >
          <SettingsIcon color={currentView === 'settings' ? '#1A73E8' : '#5F6368'} />
          <Text style={[styles.navText, currentView === 'settings' ? styles.navTextActive : null]}>
            Config
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dymek z tłumaczeniem zdania (renderowany na poziomie głównym, aby poprawnie pozycjonował się na górze ekranu) */}
      {translatedSentenceIdx !== null && translationText ? (
        <Modal
          transparent={true}
          visible={true}
          animationType="fade"
          onRequestClose={() => {
            setTranslatedSentenceIdx(null);
            setTranslationText('');
          }}
        >
          <View style={styles.modalOverlay}>
            {/* Backdrop to close the modal */}
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => {
                setTranslatedSentenceIdx(null);
                setTranslationText('');
              }}
            />

            {/* Floating translation card bubble */}
            <View style={styles.translationBubble}>
              <View style={styles.bubbleHeader}>
                <Text style={styles.bubbleHeaderTitle}>Tłumaczenie</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTranslatedSentenceIdx(null);
                    setTranslationText('');
                  }}
                >
                  <Text style={styles.bubbleCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.bubbleOriginalText}>
                {sentences[translatedSentenceIdx]}
              </Text>
              
              <Text style={styles.bubbleTranslatedText}>
                {translationText}
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.bubbleListenBtn, { flex: 1 }]}
                  onPress={() => speakSentence(translatedSentenceIdx)}
                >
                  <Text style={styles.bubbleListenBtnText}>🔊 Odsłuchaj</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bubbleSaveBtn, { flex: 1 }]}
                  onPress={() => addToVocabulary(sentences[translatedSentenceIdx], translationText)}
                >
                  <Text style={styles.bubbleSaveBtnText}>💾 Zapisz</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Voice Session Summary Modal */}
      {voiceTutorSummary && (
        <Modal
          transparent={true}
          visible={true}
          animationType="slide"
          onRequestClose={handleCloseVoiceTutorSummary}
        >
          <View style={styles.summaryModalOverlay}>
            <View style={styles.summaryModalContent}>
              <View style={styles.summaryModalHeader}>
                <Text style={styles.summaryModalTitle}>Podsumowanie Lekcji Głosowej AI</Text>
                <TouchableOpacity onPress={handleCloseVoiceTutorSummary}>
                  <Text style={styles.summaryModalCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.summaryModalBody} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
                {/* 1. Score Card */}
                <View style={[styles.summaryCard, { borderLeftColor: '#1A73E8' }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>🏆 Wynik i ocena lekcji</Text>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreBadgeText}>Średnia: {voiceTutorSummary.average_score || 0}/100</Text>
                    </View>
                  </View>
                  <Text style={styles.feedbackText}>{voiceTutorSummary.feedback_pl || ''}</Text>
                </View>

                {/* 2. Issues to reinforce */}
                <Text style={styles.sectionTitle}>🗣️ Zagadnienia do utrwalenia</Text>
                {(!voiceTutorSummary.issues || voiceTutorSummary.issues.length === 0) ? (
                  <Text style={styles.noDataText}>Świetnie! Nie zanotowano poważniejszych błędów językowych.</Text>
                ) : (
                  voiceTutorSummary.issues.map((item: any, idx: number) => (
                    <View key={idx} style={styles.issueCard}>
                      <Text style={styles.issueLabelOriginal}>❌ Twoja wypowiedź:</Text>
                      <Text style={styles.issueTextOriginal}>"{item.original}"</Text>
                      
                      <View style={styles.issueCorrectContainer}>
                        <Text style={styles.issueLabelCorrect}>👉 Propozycja poprawy / urozmaicenia:</Text>
                        <Text style={styles.issueTextCorrect}>"{item.corrected}"</Text>
                      </View>
                      
                      <View style={styles.issueExplanationContainer}>
                        <Text style={styles.issueTextExplanation}>💡 Komentarz: {item.explanation_pl}</Text>
                      </View>
                    </View>
                  ))
                )}

                {/* 3. Session Vocabulary */}
                <Text style={styles.sectionTitle}>📓 Słownictwo z lekcji</Text>
                {(!voiceTutorSummary.vocabulary || voiceTutorSummary.vocabulary.length === 0) ? (
                  <Text style={styles.noDataText}>Brak nowego słownictwa do wyodrębnienia z tej sesji.</Text>
                ) : (
                  voiceTutorSummary.vocabulary.map((item: any, idx: number) => {
                    const isSaved = voiceTutorSavedWords.includes(item.word);
                    return (
                      <View key={idx} style={styles.vocabularyCard}>
                        <View style={styles.vocabRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.vocabWord}>{item.word}</Text>
                            <Text style={styles.summaryVocabTranslation}>— {item.translation}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.vocabSaveBtn, isSaved && styles.vocabSaveBtnActive]}
                            disabled={isSaved}
                            onPress={async () => {
                              const success = await handleSaveWordFromVoiceTutor(item.word, item.translation);
                              if (success) {
                                setVoiceTutorSavedWords(prev => [...prev, item.word]);
                              }
                            }}
                          >
                            <Text style={[styles.vocabSaveBtnText, isSaved && styles.vocabSaveBtnTextActive]}>
                              {isSaved ? "✓ Zapisano" : "Zapisz"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}

                {/* 4. Email report form */}
                <View style={styles.emailSection}>
                  <Text style={styles.emailSectionTitle}>Wyślij podsumowanie na e-mail</Text>
                  <View style={styles.emailInputRow}>
                    <TextInput
                      style={styles.emailTextInput}
                      placeholder="Wpisz adres e-mail"
                      value={voiceTutorEmail}
                      onChangeText={setVoiceTutorEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.emailSendBtn}
                      onPress={async () => {
                        if (!voiceTutorEmail.trim()) {
                          Alert.alert("Info", "Wpisz adres e-mail.");
                          return;
                        }
                        await handleSendVoiceTutorEmail(voiceTutorEmail.trim());
                      }}
                    >
                      <Text style={styles.emailSendBtnText}>Wyślij</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.summaryCloseFooterBtn} onPress={handleCloseVoiceTutorSummary}>
                <Text style={styles.summaryCloseFooterBtnText}>Zamknij podsumowanie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Loading Overlay for Summary Generation */}
      {isVoiceTutorGeneratingSummary && (
        <Modal transparent={true} visible={true} animationType="fade">
          <View style={styles.summaryLoadingOverlay}>
            <View style={styles.summaryLoadingContent}>
              <ActivityIndicator size="large" color="#1A73E8" />
              <Text style={styles.summaryLoadingTitle}>Generowanie podsumowania lekcji...</Text>
              <Text style={styles.summaryLoadingDesc}>
                Analizuję Twoje błędy gramatyczne, wymowę oraz nowe słownictwo, aby przygotować raport.
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- Voice Tutor (Tutor Głosowy) Styles ---
  voiceTutorContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    gap: 16,
    width: '100%',
  },
  waveSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
    justifyContent: 'center',
  },
  waveBar: {
    width: 3,
    backgroundColor: '#9CA3AF',
    borderRadius: 1.5,
  },
  waveformTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  transcriptText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
    lineHeight: 22,
  },
  voiceTutorHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: '#202124',
    textAlign: 'center',
    marginTop: 12,
  },
  blueGradientText: {
    color: '#1A73E8',
  },
  voiceTutorStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  orbWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 220,
    height: 220,
    marginBottom: 36,
  },
  voiceOrbButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  orbInactive: {
    backgroundColor: '#5F6368',
  },
  orbListening: {
    backgroundColor: '#1A73E8',
  },
  orbUserSpeaking: {
    backgroundColor: '#34A853',
  },
  orbSpeaking: {
    backgroundColor: '#4285F4',
  },
  orbThinking: {
    backgroundColor: '#8AB4F8',
  },
  orbCore: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbPulseRing: {
    position: 'absolute',
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: 'rgba(26, 115, 232, 0.25)',
  },
  orbPulseRing1: {
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  orbPulseRing2: {
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  ringGreen: {
    borderColor: 'rgba(52, 168, 83, 0.25)',
  },
  ringBlue: {
    borderColor: 'rgba(138, 180, 248, 0.25)',
  },
  orbPulseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  orbWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orbWaveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  orbWaveBarGreen: {
    backgroundColor: '#FFFFFF',
  },
  voiceTutorStatusText: {
    fontSize: 15,
    color: '#5F6368',
    textAlign: 'center',
    fontWeight: '500',
    marginHorizontal: 32,
    lineHeight: 22,
    marginBottom: 24,
  },
  transcriptToggleBtn: {
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  transcriptToggleBtnActive: {
    backgroundColor: '#E8F0FE',
    borderColor: '#1A73E8',
  },
  transcriptToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C4043',
  },
  transcriptToggleBtnTextActive: {
    color: '#1A73E8',
  },
  voiceTutorTips: {
    padding: 12,
    backgroundColor: 'rgba(241, 243, 244, 0.8)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto',
  },
  voiceTutorTipsText: {
    fontSize: 12,
    color: '#5F6368',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  mobileTranscriptDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#DADCE0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  drawerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#202124',
  },
  drawerCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A73E8',
  },
  drawerScroll: {
    flex: 1,
    padding: 16,
  },
  mobileBubbleContainer: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 4,
  },
  mobileBubbleContainerBot: {
    justifyContent: 'flex-start',
  },
  mobileBubbleContainerUser: {
    justifyContent: 'flex-end',
  },
  mobileBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mobileBubbleBot: {
    backgroundColor: '#F1F3F4',
    borderTopLeftRadius: 0,
  },
  mobileBubbleUser: {
    backgroundColor: '#E8F0FE',
    borderTopRightRadius: 0,
  },
  mobileBubbleSpeaker: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5F6368',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mobileBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mobileBubbleTextBot: {
    color: '#202124',
  },
  mobileBubbleTextUser: {
    color: '#1A73E8',
    fontWeight: '500',
  },
  mobileBubbleEval: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 115, 232, 0.15)',
  },
  mobileBubbleEvalScore: {
    fontSize: 11,
    fontWeight: '700',
    color: '#137333',
  },
  mobileBubbleEvalFeedback: {
    fontSize: 11,
    color: '#5F6368',
    marginTop: 2,
  },

  // --- Voice Session Summary Modal Styles ---
  summaryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  summaryModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  summaryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
    backgroundColor: '#E8F0FE',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  summaryModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A73E8',
  },
  summaryModalCloseBtn: {
    fontSize: 20,
    color: '#5F6368',
    padding: 4,
  },
  summaryModalBody: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderLeftWidth: 5,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#202124',
  },
  scoreBadge: {
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreBadgeText: {
    color: '#1A73E8',
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 14,
    color: '#3C4043',
    lineHeight: 20,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
    marginTop: 16,
    marginBottom: 10,
  },
  noDataText: {
    fontSize: 13,
    color: '#5F6368',
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  issueCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  issueLabelOriginal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 4,
  },
  issueTextOriginal: {
    fontSize: 14,
    color: '#7F1D1D',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  issueCorrectContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  issueLabelCorrect: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
    marginBottom: 2,
  },
  issueTextCorrect: {
    fontSize: 14,
    color: '#14532D',
    fontWeight: '700',
    lineHeight: 18,
  },
  issueExplanationContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    padding: 8,
    borderRadius: 6,
  },
  issueTextExplanation: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '500',
  },
  vocabularyCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  vocabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vocabWord: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 2,
  },
  summaryVocabTranslation: {
    fontSize: 13,
    color: '#14532D',
  },
  vocabSaveBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  vocabSaveBtnActive: {
    backgroundColor: '#16A34A',
  },
  vocabSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  vocabSaveBtnTextActive: {
    color: '#FFFFFF',
  },
  emailSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  emailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 10,
  },
  emailInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  emailTextInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#202124',
  },
  emailSendBtn: {
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emailSendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryCloseFooterBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderTopWidth: 1,
    borderTopColor: '#DADCE0',
  },
  summaryCloseFooterBtnText: {
    color: '#3C4043',
    fontSize: 15,
    fontWeight: '700',
  },

  // --- Voice Session Summary Loading Styles ---
  summaryLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  summaryLoadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  summaryLoadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
    textAlign: 'center',
  },
  summaryLoadingDesc: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  authScroll: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerSpacer: {
    height: 60,
  },
  authLogo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSub: {
    fontSize: 14,
    color: '#5F6368',
    marginBottom: 36,
    textAlign: 'center',
  },
  authCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  authLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F6368',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  authInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 15,
    backgroundColor: '#F8F9FA',
    color: '#202124',
  },
  authButton: {
    backgroundColor: '#1A73E8',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchAuth: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchAuthText: {
    color: '#1A73E8',
    fontSize: 14,
    fontWeight: '500',
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  appHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
  },
  readerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#DADCE0',
    gap: 8,
  },
  readerModeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9AA0A6',
  },
  readerModeLabelActive: {
    color: '#202124',
    fontWeight: '700',
  },
  readerStopBtn: {
    marginLeft: 'auto' as any,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EA4335',
  },
  readerStopBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  userEmail: {
    fontSize: 12,
    color: '#5F6368',
    maxWidth: 150,
  },
  contentArea: {
    flex: 1,
  },
  dashboardContainer: {
    padding: 16,
    gap: 16,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    padding: 20,
  },
  welcomeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A73E8',
    marginBottom: 8,
    letterSpacing: 1,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 12,
  },
  welcomeDesc: {
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
    marginBottom: 20,
  },
  welcomeActions: {
    flexDirection: 'row',
  },
  btnPrimary: {
    backgroundColor: '#1A73E8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    padding: 16,
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F6368',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metricDesc: {
    fontSize: 12,
    color: '#5F6368',
  },
  streakRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  streakDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8EAED',
  },
  streakDotActive: {
    backgroundColor: '#34A853',
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gaugeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
    marginRight: 12,
  },
  gaugeContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E8EAED',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeBar: {
    height: '100%',
    backgroundColor: '#1A73E8',
  },
  workspaceContainer: {
    padding: 16,
  },
  generatorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    padding: 20,
  },
  generatorHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 12,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    height: 80,
    textAlignVertical: 'top',
    backgroundColor: '#F8F9FA',
    marginBottom: 16,
    color: '#202124',
  },
  chipsHeader: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'white',
  },
  chipSelected: {
    borderColor: '#1A73E8',
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
  },
  chipText: {
    fontSize: 13,
    color: '#3C4043',
  },
  chipTextSelected: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: '#1A73E8',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    marginTop: 16,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectorBtnActive: {
    borderColor: '#1A73E8',
    backgroundColor: 'rgba(26, 115, 232, 0.04)',
  },
  selectorBtnText: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '500',
  },
  selectorBtnTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  paragraphText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3C4043',
  },
  translationLineText: {
    fontSize: 13,
    color: '#137333',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  translationBubble: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
    paddingBottom: 8,
  },
  bubbleHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A73E8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bubbleCloseBtn: {
    fontSize: 18,
    color: '#5F6368',
    padding: 4,
  },
  bubbleOriginalText: {
    fontSize: 14,
    color: '#5F6368',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 20,
  },
  bubbleTranslatedText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 18,
    lineHeight: 26,
  },
  bubbleListenBtn: {
    backgroundColor: '#E8F0FE',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleListenBtnText: {
    color: '#1A73E8',
    fontWeight: '600',
    fontSize: 14,
  },
  bubbleSaveBtn: {
    backgroundColor: '#E6F4EA',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSaveBtnText: {
    color: '#137333',
    fontWeight: '600',
    fontSize: 14,
  },
  questionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  questionsHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 12,
  },
  questionNavRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  qNavDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qNavDotActive: {
    backgroundColor: '#1A73E8',
  },
  qNavDotText: {
    fontSize: 14,
    color: '#3C4043',
    fontWeight: '600',
  },
  qNavDotTextActive: {
    color: '#FFFFFF',
  },
  questionBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1A73E8',
    marginBottom: 16,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202124',
    lineHeight: 22,
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  evaluatingLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  evaluatingText: {
    fontSize: 14,
    color: '#5F6368',
  },
  recordButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  recordButtonActive: {
    backgroundColor: '#EA4335',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA4335',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  evaluationCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DADCE0',
    marginTop: 8,
  },
  evaluationScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  evaluationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5F6368',
    marginRight: 6,
  },
  evaluationScore: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreCorrect: {
    color: '#137333',
  },
  scoreIncorrect: {
    color: '#C5221F',
  },
  evaluationSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5F6368',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  evaluationTranscription: {
    fontSize: 14,
    color: '#202124',
    fontStyle: 'italic',
  },
  evaluationFeedback: {
    fontSize: 14,
    color: '#202124',
    lineHeight: 20,
  },
  loadingQuestionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  loadingQuestionsText: {
    fontSize: 14,
    color: '#5F6368',
  },
  voiceSelectorContainer: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    padding: 6,
    marginTop: 8,
    marginBottom: 16,
  },
  voiceItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    borderRadius: 6,
  },
  voiceItemActive: {
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
  },
  voiceItemText: {
    fontSize: 13,
    color: '#3C4043',
  },
  voiceItemTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  noVoicesText: {
    fontSize: 13,
    color: '#5F6368',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
  },
  readerContainer: {
    gap: 16,
  },
  readerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readerStoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
    flex: 1,
    marginRight: 8,
  },
  clearStoryButton: {
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  clearStoryButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  storyTextCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    padding: 16,
  },
  instructionsText: {
    fontSize: 11,
    color: '#5F6368',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sentencesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sentenceTouchable: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 4,
  },
  sentenceActive: {
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
  },
  sentenceSpeaking: {
    backgroundColor: 'rgba(52, 168, 83, 0.12)',
  },
  sentenceText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3C4043',
    marginBottom: 6,
  },
  sentenceTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
    backgroundColor: '#E8F0FE',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#5F6368',
    marginTop: 40,
    fontSize: 15,
  },
  storyListItem: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 12,
    padding: 16,
  },
  storyListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 6,
  },
  storyListSnippet: {
    fontSize: 13,
    color: '#5F6368',
    lineHeight: 18,
  },
  vocabItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 12,
    padding: 16,
  },
  vocabTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  vocabOriginal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  vocabTranslation: {
    fontSize: 14,
    color: '#1A73E8',
  },
  deleteVocabBtn: {
    padding: 8,
  },
  deleteVocabText: {
    color: '#DC2626',
    fontSize: 13,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomNav: {
    height: 64,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 10,
    color: '#5F6368',
    marginTop: 4,
  },
  navTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  modalCloseX: {
    fontSize: 20,
    color: '#5F6368',
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5F6368',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },
  modalOriginalText: {
    fontSize: 16,
    color: '#202124',
    lineHeight: 22,
  },
  modalTranslatedText: {
    fontSize: 16,
    color: '#1A73E8',
    fontWeight: '600',
    lineHeight: 22,
  },
  wordsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordBubble: {
    backgroundColor: '#F1F3F4',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  wordBubbleText: {
    fontSize: 14,
    color: '#3C4043',
  },
  grammarButton: {
    borderWidth: 1,
    borderColor: '#1A73E8',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  grammarButtonText: {
    color: '#1A73E8',
    fontSize: 14,
    fontWeight: '500',
  },
  modalGrammarText: {
    fontSize: 14,
    color: '#3C4043',
    lineHeight: 20,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  chatCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  chatContainer: {
    gap: 12,
    marginBottom: 16,
    maxHeight: 400,
  },
  chatBubbleContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  chatBubbleContainerBot: {
    justifyContent: 'flex-start',
  },
  chatBubbleContainerUser: {
    justifyContent: 'flex-end',
  },
  chatBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chatBubbleBot: {
    backgroundColor: '#F1F3F4',
    borderTopLeftRadius: 0,
  },
  chatBubbleUser: {
    backgroundColor: '#E8F0FE',
    borderTopRightRadius: 0,
  },
  chatBubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  chatBubbleTextBot: {
    color: '#202124',
  },
  chatBubbleTextUser: {
    color: '#1A73E8',
    fontWeight: '500',
  },
  chatEvaluationBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 115, 232, 0.15)',
  },
  chatEvalScore: {
    fontSize: 11,
    fontWeight: '700',
    color: '#137333',
    textTransform: 'uppercase',
  },
  chatEvalFeedback: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 4,
    lineHeight: 16,
  },
  chatControlsContainer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
    paddingTop: 12,
  },

  // --- Media Buddy (Lekcje Wideo) Styles ---
  // --- Media Buddy (Optimized Layout) Styles ---
  mediaMainContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  mediaHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    gap: 12,
  },
  mediaVideoTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#202124',
  },
  selectVideoHeaderBtn: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#1A73E8',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectVideoHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A73E8',
  },
  playerCardCompact: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DADCE0',
    alignItems: 'center',
  },
  playerControlsCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  controlBtnCompact: {
    backgroundColor: '#1A73E8',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  controlBtnCompactActive: {
    backgroundColor: '#5F6368',
  },
  controlBtnCompactText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  controlBtnCompactTextActive: {
    color: '#FFFFFF',
  },
  playerTimeTextCompact: {
    fontSize: 13,
    color: '#5F6368',
    fontWeight: '500',
  },
  mediaTranscriptFlexContainer: {
    flex: 1,
  },
  transcriptScrollView: {
    flex: 1,
  },
  transcriptScrollContent: {
    padding: 16,
    paddingBottom: 220,
  },
  segmentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F1F3F4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentCardActive: {
    borderColor: '#1A73E8',
    backgroundColor: '#F8F9FF',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
    paddingBottom: 6,
  },
  segmentTime: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '600',
  },
  cardActionBtn: {
    backgroundColor: '#F1F3F4',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cardActionBtnText: {
    fontSize: 11,
    color: '#3C4043',
    fontWeight: '600',
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 4,
  },
  wordTouch: {
    backgroundColor: '#F1F3F4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  wordText: {
    fontSize: 14,
    color: '#3C4043',
  },

  // Floating Dictionary styles
  floatingDictCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 16,
  },
  dictCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
    paddingBottom: 8,
  },
  dictCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
  },
  dictCardCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dictCardCloseBtnText: {
    fontSize: 11,
    color: '#5F6368',
    fontWeight: '700',
  },
  dictSection: {
    marginVertical: 4,
  },
  dictSectionDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
    paddingTop: 12,
    marginTop: 12,
  },
  dictLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A73E8',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  dictRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dictOriginal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    fontStyle: 'italic',
  },
  dictTranslated: {
    fontSize: 15,
    fontWeight: '700',
    color: '#137333',
    marginTop: 2,
  },
  dictOriginalPhrase: {
    fontSize: 13,
    color: '#5F6368',
    fontStyle: 'italic',
  },
  dictTranslatedPhrase: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    marginTop: 2,
    lineHeight: 18,
  },
  dictSaveBtn: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#1A73E8',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  dictSaveBtnDisabled: {
    backgroundColor: '#E6F4EA',
    borderColor: '#137333',
  },
  dictSaveBtnText: {
    color: '#1A73E8',
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal selector styles
  videoSelectorModalContent: {
    width: '95%',
    height: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 24,
  },
  videoSelectorModalScroll: {
    paddingBottom: 24,
  },
  modalSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 10,
    marginTop: 4,
  },
  videoCarouselModal: {
    paddingBottom: 16,
    gap: 12,
  },
  customVideoFormModal: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  videoCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8EAED',
    padding: 6,
    marginRight: 10,
  },
  videoCardActive: {
    borderColor: '#1A73E8',
    backgroundColor: '#F8F9FF',
  },
  thumbnailWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: '#F1F3F4',
  },
  videoThumbnail: {
    width: 124,
    height: 70,
    borderRadius: 8,
  },
  activeVideoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 115, 232, 0.95)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  activeOverlayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  deleteCustomVideoBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteCustomVideoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  videoCardTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3C4043',
    lineHeight: 14,
    textAlign: 'center',
  },
  videoCardTitleActive: {
    color: '#1A73E8',
    fontWeight: '700',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C4043',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formInput: {
    flex: 1,
    height: 38,
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#202124',
    backgroundColor: '#FFFFFF',
  },
  formBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#D93025',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },
  jokeModalContent: {
    width: '90%',
    height: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 24,
  },
  jokeModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#F1F3F4',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: '#5F6368',
    fontWeight: '700',
  },
  jokeModalScroll: {
    paddingBottom: 24,
  },
  quoteCard: {
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1A73E8',
  },
  quoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A73E8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 14,
    color: '#202124',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  jokeLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#5F6368',
  },
  explanationGrid: {
    gap: 12,
  },
  expCard: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 12,
    padding: 12,
  },
  expCardPrimary: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1.5,
    borderColor: '#1A73E8',
    borderRadius: 12,
    padding: 12,
  },
  expTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
    marginBottom: 6,
  },
  expTitlePrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A73E8',
    marginBottom: 6,
  },
  expDesc: {
    fontSize: 13,
    color: '#5F6368',
    lineHeight: 18,
  },
  expDescPrimary: {
    fontSize: 13,
    color: '#1A73E8',
    lineHeight: 18,
    fontWeight: '500',
  },
});
