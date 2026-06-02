import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

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
  const [backendUrl, setBackendUrl] = useState('https://angry-spoons-knock.loca.lt'); // Default local dev tunnel
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

  // Reader States
  const [sentences, setSentences] = useState<string[]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [speakingSentenceIndex, setSpeakingSentenceIndex] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Translation Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'sentence' | 'word'>('sentence');
  const [modalOriginalText, setModalOriginalText] = useState('');
  const [modalTranslatedText, setModalTranslatedText] = useState('');
  const [modalGrammarAnalysis, setModalGrammarAnalysis] = useState('');
  const [modalActionLoading, setModalActionLoading] = useState(false);

  // Saved Stories List
  const [savedStories, setSavedStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);

  // Notebook Vocabulary
  const [notebookWords, setNotebookWords] = useState<any[]>([]);
  const [loadingVocabulary, setLoadingVocabulary] = useState(false);

  // Load session and settings on startup
  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem('buddy_user');
        const storedIP = await AsyncStorage.getItem('buddy_backend_url');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedIP) {
          setBackendUrl(storedIP);
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
    setActiveSentenceIndex(null);
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
          prompt: promptValue,
          settings: { level: 'B2', length: 'medium' },
        }),
      });
      const data = await response.json();
      if (response.ok && data.text) {
        setGeneratedText(data.text);
        const title = data.title || promptValue.substring(0, 30);
        setCurrentStoryTitle(title);
        setCurrentStoryId(data.story_id || null);
        
        // Clean sentences
        const parsedSentences = data.text
          .split(/(?<=[.!?])\s+/)
          .filter((s: string) => s.trim().length > 0);
        setSentences(parsedSentences);
        setActiveSentenceIndex(null);
        setStoryPrompt('');
        setSelectedTopicChip(null);
      } else {
        Alert.alert('Błąd', data.error || 'Nie udało się wygenerować opowiadania');
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
    setActiveSentenceIndex(null);
    setCurrentView('workspace');
  };

  // TTS
  const speakSentence = async (index: number) => {
    await Speech.stop();
    setSpeakingSentenceIndex(index);
    setIsSpeaking(true);
    Speech.speak(sentences[index], {
      rate: 0.85,
      onDone: () => {
        setSpeakingSentenceIndex(null);
        setIsSpeaking(false);
      },
      onError: () => {
        setSpeakingSentenceIndex(null);
        setIsSpeaking(false);
      },
    });
  };

  const stopSpeech = async () => {
    await Speech.stop();
    setSpeakingSentenceIndex(null);
    setIsSpeaking(false);
  };

  // Translate Sentence
  const translateSentence = async (text: string) => {
    setModalType('sentence');
    setModalOriginalText(text);
    setModalTranslatedText('');
    setModalGrammarAnalysis('');
    setModalVisible(true);
    setModalActionLoading(true);
    try {
      const response = await customFetch(`${backendUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || '',
        },
        body: JSON.stringify({ text, target_lang: 'PL' }),
      });
      if (response.ok) {
        const data = await response.json();
        setModalTranslatedText(data.translation);
      }
    } catch (err) {
      setModalTranslatedText('Błąd tłumaczenia.');
    } finally {
      setModalActionLoading(false);
    }
  };

  // Analyze Grammar
  const analyzeSentenceGrammar = async () => {
    setModalActionLoading(true);
    try {
      const response = await customFetch(`${backendUrl}/api/analyze-grammar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || '',
        },
        body: JSON.stringify({ text: modalOriginalText }),
      });
      if (response.ok) {
        const data = await response.json();
        setModalGrammarAnalysis(data.analysis);
      }
    } catch (err) {
      setModalGrammarAnalysis('Błąd analizy gramatycznej.');
    } finally {
      setModalActionLoading(false);
    }
  };

  // Add word to notebook
  const addWordToNotebook = async (word: string, translation: string) => {
    if (!user) return;
    try {
      const response = await customFetch(`${backendUrl}/api/vocabulary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user.token,
        },
        body: JSON.stringify({
          original: word,
          translation: translation,
          story_id: currentStoryId || 'general',
        }),
      });
      if (response.ok) {
        Alert.alert('Sukces', `Słowo "${word}" zostało zapisane.`);
      }
    } catch (err) {
      console.error(err);
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

  // Translate Word
  const translateWord = async (word: string) => {
    setModalType('word');
    setModalOriginalText(word);
    setModalTranslatedText('');
    setModalGrammarAnalysis('');
    setModalVisible(true);
    setModalActionLoading(true);
    try {
      const response = await customFetch(`${backendUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || '',
        },
        body: JSON.stringify({ text: word, target_lang: 'PL' }),
      });
      if (response.ok) {
        const data = await response.json();
        setModalTranslatedText(data.translation);
      }
    } catch (err) {
      setModalTranslatedText('Błąd.');
    } finally {
      setModalActionLoading(false);
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
          <ScrollView contentContainerStyle={styles.workspaceContainer}>
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
                      setActiveSentenceIndex(null);
                    }}
                  >
                    <Text style={styles.clearStoryButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>

                {/* Sentences flow */}
                <View style={styles.storyTextCard}>
                  <Text style={styles.instructionsText}>
                    Dotknij dowolnego zdania, aby odsłuchać, przetłumaczyć lub przeanalizować.
                  </Text>
                  <View style={styles.sentencesWrapper}>
                    {sentences.map((sentence, idx) => {
                      const isActive = activeSentenceIndex === idx;
                      const isSpeakingSentence = speakingSentenceIndex === idx;
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.7}
                          style={[
                            styles.sentenceTouchable,
                            isActive ? styles.sentenceActive : null,
                            isSpeakingSentence ? styles.sentenceSpeaking : null,
                          ]}
                          onPress={() => {
                            setActiveSentenceIndex(idx);
                            translateSentence(sentence);
                          }}
                        >
                          <Text
                            style={[
                              styles.sentenceText,
                              isActive ? styles.sentenceTextActive : null,
                            ]}
                          >
                            {sentence}{' '}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
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

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Wyloguj się</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Interactive Sentence/Word Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {modalType === 'sentence' ? 'Zdanie' : 'Słowo'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalLabel}>Oryginał</Text>
              <Text style={styles.modalOriginalText}>{modalOriginalText}</Text>

              <Text style={styles.modalLabel}>Tłumaczenie</Text>
              {modalActionLoading && !modalTranslatedText ? (
                <ActivityIndicator color="#1A73E8" size="small" />
              ) : (
                <Text style={styles.modalTranslatedText}>
                  {modalTranslatedText || 'Brak tłumaczenia'}
                </Text>
              )}

              {modalType === 'sentence' && (
                <>
                  <Text style={styles.modalLabel}>Rozbicie na słowa</Text>
                  <View style={styles.wordsWrapper}>
                    {(modalOriginalText || '')
                      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                      .split(/\s+/)
                      .filter(w => w.trim().length > 0)
                      .map((word, wIdx) => (
                        <TouchableOpacity
                          key={wIdx}
                          style={styles.wordBubble}
                          onPress={() => translateWord(word)}
                        >
                          <Text style={styles.wordBubbleText}>{word}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>

                  <Text style={styles.modalLabel}>Analiza Gramatyczna</Text>
                  {modalGrammarAnalysis ? (
                    <Text style={styles.modalGrammarText}>{modalGrammarAnalysis}</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.grammarButton}
                      onPress={analyzeSentenceGrammar}
                      disabled={modalActionLoading}
                    >
                      <Text style={styles.grammarButtonText}>Wygeneruj analizę gramatyki</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              {modalType === 'sentence' && activeSentenceIndex !== null && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#1A73E8' }]}
                  onPress={() => {
                    speakSentence(activeSentenceIndex);
                  }}
                >
                  <Text style={styles.modalActionBtnText}>Czytaj audio</Text>
                </TouchableOpacity>
              )}

              {modalType === 'word' && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#34A853' }]}
                  onPress={() => {
                    addWordToNotebook(modalOriginalText, modalTranslatedText);
                  }}
                >
                  <Text style={styles.modalActionBtnText}>Dodaj do słownika</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#DADCE0' }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalActionBtnText, { color: '#3C4043' }]}>Zamknij</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
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
});
