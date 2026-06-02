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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

const EDGE_TTS_VOICES = [
  { identifier: 'en-US-BrianNeural', name: 'Brian (US - Male) 🌟', language: 'en-US' },
  { identifier: 'en-US-AriaNeural', name: 'Aria (US - Female) 🌟', language: 'en-US' },
  { identifier: 'en-US-EmmaMultilingualNeural', name: 'Emma (US - Multilingual) 🌟', language: 'en-US' },
  { identifier: 'en-GB-SoniaNeural', name: 'Sonia (UK - Female)', language: 'en-GB' },
  { identifier: 'en-GB-RyanNeural', name: 'Ryan (UK - Male)', language: 'en-GB' },
  { identifier: 'pl-PL-ZofiaNeural', name: 'Zofia (PL - Kobieta) 🌟', language: 'pl-PL' },
  { identifier: 'pl-PL-MarekNeural', name: 'Marek (PL - Mężczyzna) 🌟', language: 'pl-PL' },
];

// Material outline SVG Icons mapped to simple components
const HomeIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={color} />
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

export default function HomeScreen() {
  const [backendUrl, setBackendUrl] = useState('http://192.168.100.27:5001'); // Local network IP
  const [user, setUser] = useState<{ token: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'stories' | 'notebook' | 'settings'>('dashboard');

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

  // Sentence Translation States
  const [translatedSentenceIdx, setTranslatedSentenceIdx] = useState<number | null>(null);
  const [translationText, setTranslationText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

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
        const storedIP = await AsyncStorage.getItem('buddy_backend_url');
        const storedVoice = await AsyncStorage.getItem('buddy_tts_voice');
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

        // Configure Audio session for playback
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
            staysActiveInBackground: false,
            shouldRouteThroughEarpieceAndroid: false,
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
        setCurrentView('workspace');
        startChatSession(storyText);
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
    setCurrentView('workspace');
    startChatSession(story.text);
  };

  // TTS
  const speakSentence = async (index: number) => {
    try {
      await stopSpeech();
      setSpeakingSentenceIndex(index);
      setIsSpeaking(true);

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
          setIsSpeaking(false);
          setSpeakingSentenceIndex(null);
          speakingRef.current = false;
          return;
        }

        setSpeakingSentenceIndex(currentIdx);

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
          <Text style={styles.appTitle}>
            {currentView === 'dashboard' && 'Mission Control'}
            {currentView === 'workspace' && 'Practice Room'}
            {currentView === 'stories' && 'Saved Stories'}
            {currentView === 'notebook' && 'Vocabulary'}
            {currentView === 'settings' && 'Settings'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
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
        {currentView === 'dashboard' && (
          <ScrollView contentContainerStyle={styles.dashboardContainer}>
            {/* Welcome Google Style Card */}
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeBadge}>SUPER BRAIN EDITION</Text>
              <Text style={styles.welcomeTitle}>Meet Your AI English Assistant</Text>
              <Text style={styles.welcomeDesc}>
                Your personalized mission to master English. Context-aware learning, native-level feedback, and real-time evolution.
              </Text>
              <View style={styles.welcomeActions}>
                <TouchableOpacity
                  style={[styles.btnPrimary, { marginRight: 8 }]}
                  onPress={() => setCurrentView('workspace')}
                >
                  <Text style={styles.btnPrimaryText}>Start Practice</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Streak card */}
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>DAILY STREAK</Text>
              <View style={styles.streakRow}>
                {[0, 1, 2, 3, 4, 5, 6].map((_, i) => (
                  <View
                    key={i}
                    style={[styles.streakDot, i < 5 ? styles.streakDotActive : null]}
                  />
                ))}
              </View>
              <Text style={styles.metricDesc}>5 days strong! Keep evolving.</Text>
            </View>

            {/* General metrics */}
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>LANGUAGE LEVEL</Text>
              <View style={styles.gaugeRow}>
                <Text style={styles.gaugeValue}>B2</Text>
                <View style={styles.gaugeContainer}>
                  <View style={[styles.gaugeBar, { width: '78%' }]} />
                </View>
              </View>
              <Text style={styles.metricDesc}>Strongly Improving</Text>
            </View>
          </ScrollView>
        )}

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

                <View style={styles.storyTextCard}>
                  <Text style={styles.instructionsText}>
                    Dotknij zdania, aby je odsłuchać. Przytrzymaj, aby zobaczyć tłumaczenie.
                  </Text>
                  <Text style={styles.paragraphText}>
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
                        <Text style={styles.vocabTranslation}>{item.translation}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteVocabBtn}
                        onPress={() => deleteWord(item.original)}
                      >
                        <Text style={styles.deleteVocabText}>Usuń</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        )}

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
            Home
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  sentenceTextActive: {
    color: '#1A73E8',
    fontWeight: '600',
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
});
