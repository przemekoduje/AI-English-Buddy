import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from '../config';
import "./Dashboard.css";
import VoiceSessionSummaryModal from "./Notebook/VoiceSessionSummaryModal";
import { GeminiLiveClient } from "../services/GeminiLiveClient";

// Voice Activity Detection (VAD) thresholds for Classic Mode
const VOICE_THRESHOLD = 0.012;
const INTERRUPTION_THRESHOLD = 0.18; // Podniesiony próg, aby dźwięk z głośników komputera (ok. 0.04-0.10) nie przerywał lektora
const SILENCE_DURATION = 1500;

// Wbudowane czytanki wzorcowe (dostępne od razu dla każdego ucznia)
export const SAMPLE_STORIES = [
  {
    id: "sample-coffee-blend",
    title: "The Secret Coffee Blend",
    level: "A2 - B1",
    category: "Życie codzienne & Kawiarnia",
    summary: "Tajemniczy klient w starym płaszczu zamawia sekretny napar w edynburskiej piekarni.",
    text: `Every morning at seven o'clock, Clara opens the doors of 'The Copper Kettle', a small artisan bakery in Edinburgh. The air is always filled with the warm aroma of fresh sourdough bread and ground roasted beans.

Today, a peculiar customer in a vintage tweed coat walked up to the counter. Instead of ordering a regular latte, he glanced around and whispered, "I would like the traveller's blend, extra cinnamon, and no sugar."

Clara was puzzled because that secret recipe had not been on the menu for over ten years. Intrigued, she prepared the drink and asked how he knew about it. It turned out the stranger was the nephew of the original baker from 1954, visiting Scotland for the very first time. They spent the next hour chatting about old family traditions and the secret ingredients of authentic Scottish pastries.`
  },
  {
    id: "sample-job-interview",
    title: "Job Interview in London",
    level: "B1 - B2",
    category: "Kariera & Biznes",
    summary: "Rozmowa rekrutacyjna na stanowisko Senior Strategist w wieżowcu w Canary Wharf.",
    text: `David adjusted his tie in the mirrored glass of the high-speed elevator on the thirty-second floor of a skyscraper in Canary Wharf. He was interviewing for the role of Senior Product Strategist at a leading international fintech firm.

The interview panel consisted of three senior executives who welcomed him with firm handshakes. After a brief introduction, the chief executive asked: "How would you handle a critical product launch during an unexpected market downturn?"

David took a steady breath, smiled calmly, and presented a detailed case study from his previous position. He explained how innovative cross-team collaboration and transparent user feedback turned a potential crisis into record-breaking quarterly growth. The interviewers nodded with visible approval and invited him to discuss their upcoming European expansion.`
  },
  {
    id: "sample-jfk-airport",
    title: "Lost at JFK Airport",
    level: "A2 - B1",
    category: "Podróże & Lotnisko",
    summary: "Przesiadka podczas śnieżycy na lotnisku w Nowym Jorku i wyścig z czasem.",
    text: `After an exhausting eight-hour transatlantic flight from Warsaw, Mark finally arrived at John F. Kennedy International Airport in New York. Outside the terminal windows, a heavy winter snowstorm was causing chaotic flight delays across the eastern coast.

Looking up at the massive departure monitor, Mark realized with sudden panic that his connecting flight to Chicago had been rescheduled and relocated to Terminal 7. To make matters worse, the boarding gate was scheduled to close in only twenty-five minutes.

He immediately hurried to the customer assistance desk. A cheerful airport officer named Carlos calmly explained the fastest route: "Take the AirTrain red line to Terminal 7, and use the priority transit lane at security." Thanks to the officer's clear directions, Mark dashed through the terminal and reached his gate right as the final boarding announcement was called.`
  },
  {
    id: "sample-startup-pitch",
    title: "The Eco-Tech Startup Pitch",
    level: "B1 - B2",
    category: "Technologia & Ekologia",
    summary: "Prezentacja innowacyjnej biodegradowalnej baterii przed inwestorami w Berlinie.",
    text: `In a bright, open co-working space in Berlin, Maya stood confidently in front of five venture capital investors to pitch her clean-tech startup, 'AuraEnergy'.

Her engineering team had engineered a revolutionary biodegradable battery made from organic forest waste. Not only did it eliminate toxic heavy metals, but it could also recharge smartphones in under three minutes without overheating.

While the senior investment partner expressed polite skepticism about scaling mass manufacturing, Maya reached into her backpack, placed a working prototype on the conference table, and plugged in an empty tablet. Within two minutes, the battery indicator jumped to ninety percent. Impressed by the live demonstration, the lead investor leaned forward and proposed a formal term sheet discussion for the following morning.`
  }
];

// Dostępne tryby ćwiczeń z lektorem AI
export const EXERCISE_TYPES = [
  {
    id: "story_discussion",
    icon: "💬",
    name: "💬 Dyskusja i opinie o fabule",
    badge: "Dyskusja",
    description: "Rozmawiajmy o bohaterach, motywach i wydarzeniach. Lektor zadaje pytania otwarte i pyta o Twoje zdanie."
  },
  {
    id: "vocabulary_quiz",
    icon: "🧠",
    name: "🧠 Trening słownictwa i quiz słowny",
    badge: "Słownictwo",
    description: "Lektor pyta o znaczenie trudniejszych słówek z czytanki, synonimy i prosi o ułożenie zdań."
  },
  {
    id: "roleplay",
    icon: "🎭",
    name: "🎭 Odgrywanie ról (Role-Play)",
    badge: "Role-Play",
    description: "Wciel się w jednego z bohaterów czytanki! Lektor wcieli się w drugą postać w żywym dialogu."
  },
  {
    id: "summary_challenge",
    icon: "🎙️",
    name: "🎙️ Wyzwanie streszczenia (Summary)",
    badge: "Streszczenie",
    description: "Opowiedz czytankę własnymi słowami. Lektor słucha, dopytuje o szczegóły i chwali za płynność."
  },
  {
    id: "comprehension_qa",
    icon: "❓",
    name: "❓ Pytania ze zrozumienia tekstu (Q&A)",
    badge: "Zrozumienie",
    description: "Quiz ze zrozumienia faktów i detali czytanki – sprawdź ile zapamiętałeś z lektury."
  },
  {
    id: "grammar_context",
    icon: "🔍",
    name: "🔍 Gramatyka i zwroty w kontekście",
    badge: "Gramatyka",
    description: "Ćwiczenie ciekawych struktur zdaniowych, czasów i zwrotów użytych w tym opowiadaniu."
  }
];

export function extractStoryTargetWords(story, userSavedVocab = []) {
  if (!story || !story.text) return [];
  
  const storyLower = story.text.toLowerCase();

  // 1. User saved words for this story or in story text
  const savedMatches = (userSavedVocab || [])
    .filter(v => v && v.original)
    .filter(v => (v.story_id && story.id && v.story_id === story.id) || storyLower.includes(v.original.trim().toLowerCase()))
    .map(v => ({ original: v.original.trim(), translated: v.translated ? v.translated.trim() : '' }));

  // 2. Story predefined vocabulary
  let predefined = [];
  if (Array.isArray(story.vocabulary)) {
    predefined = story.vocabulary;
  } else if (typeof story.vocabulary === 'string') {
    predefined = story.vocabulary.split(',').map(s => s.trim());
  } else if (story.vocabulary_analysis?.key_words) {
    predefined = story.vocabulary_analysis.key_words;
  }

  const predefinedClean = predefined.map(w => {
    if (typeof w === 'string' && w.includes('-')) {
      const parts = w.split('-');
      return { original: parts[0].trim(), translated: parts[1].trim() };
    }
    return { original: typeof w === 'string' ? w.trim() : (w?.original || ''), translated: w?.translated || '' };
  }).filter(w => w.original && w.original.length > 0);

  // Combine saved first, then predefined
  const combined = [...savedMatches, ...predefinedClean];
  
  // Deduplicate by lowercased original word
  const seen = new Set();
  const result = [];
  for (const item of combined) {
    const key = item.original.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  // If still fewer than 5 words, extract prominent English words/phrases from text
  if (result.length < 5) {
    const rawWords = story.text.match(/\b[A-Za-z]{5,}\b/g) || [];
    const stopWords = new Set(["about", "after", "again", "always", "because", "before", "being", "between", "could", "first", "found", "great", "having", "other", "their", "there", "these", "thing", "think", "those", "through", "under", "where", "which", "while", "would"]);
    for (const w of rawWords) {
      const lower = w.toLowerCase();
      if (!seen.has(lower) && !stopWords.has(lower)) {
        seen.add(lower);
        result.push({ original: w, translated: '' });
        if (result.length >= 6) break;
      }
    }
  }

  return result;
}

export function buildTutorPrompts(story, exerciseType, userSavedVocab = []) {
  if (!story) {
    return {
      systemInstruction: "You are Speakling, an enthusiastic, friendly and warm native English tutor. Your goal is to help the student practice speaking English naturally. Keep your spoken responses concise (1-2 sentences at a time), conversational, and encouraging, giving the student plenty of speaking time. Speak with a natural, friendly tone. Speak only in English.",
      greetingPrompt: "Hello! Please greet me warmly in English as my friendly tutor, introduce yourself briefly in 1-2 natural sentences, and ask how my day is going."
    };
  }

  const title = story.title || "Selected Story";
  const text = story.text || "";

  // Sequenced target words for this session
  const targetWordsList = extractStoryTargetWords(story, userSavedVocab);
  const targetWordsFormatted = targetWordsList.map((w, idx) => 
    `  Word ${idx + 1}: ENGLISH TARGET WORD "${w.original}"${w.translated ? ` (Polish translation hint: "${w.translated}")` : ''}`
  ).join("\n");

  const word1 = targetWordsList[0]?.original || "key word";
  const word2 = targetWordsList[1]?.original || "next word";
  const word3 = targetWordsList[2]?.original || "third word";
  const word4 = targetWordsList[3]?.original || "fourth word";

  let exerciseInstructions = "";
  let greetingPrompt = "";

  switch (exerciseType) {
    case "vocabulary_quiz":
      exerciseInstructions = `EXERCISE FOCUS: MULTI-TURN VOCABULARY QUIZ & PRACTICE
- You are an ENGLISH tutor practicing key ENGLISH vocabulary taken EXCLUSIVELY from the selected story "${title}".
- PRE-APPROVED SEQUENTIAL TARGET WORDS FOR THIS SESSION:
${targetWordsFormatted}

CRITICAL RULES FOR VOCABULARY EXERCISES (MUST FOLLOW AT ALL COSTS):
1. MULTI-TURN SEQUENTIAL PROGRESSION:
   - Turn 1: Greet the student and quiz them on Word 1 ("${word1}"). Ask if they know what "${word1}" means in the story "${title}".
   - Turn 2: Once the student answers or attempts Word 1, provide brief praise/correction, and IMMEDIATELY move on to Word 2 ("${word2}")!
   - Turn 3: Next, move on to Word 3 ("${word3}"), then Word 4 ("${word4}"), and so on.
   - NEVER stop after only 1 word! Always continue to the next Word in the sequential list above.

2. TARGET TERMS MUST BE IN ENGLISH ONLY:
   - You are teaching ENGLISH to a Polish speaker.
   - The target word presented to the student MUST ALWAYS BE THE ENGLISH WORD (e.g. "Do you know what the English word '${word1}' means in our story?", "Can you use '${word2}' in a sentence?").
   - NEVER quiz Polish words or ask "Co oznacza zbieracz?".
   - Polish translations are ONLY helpful hints/meanings FOR the English target word.

3. STRICT GROUNDING IN STORY FACTS:
   - All questions, context sentences, definitions, and explanations MUST relate to the events, characters, and facts in "${title}".`;

      greetingPrompt = `Hello! Greet me warmly as my English tutor. Mention enthusiastically that today we are going to practice key ENGLISH vocabulary from the story "${title}". Immediately introduce our first target ENGLISH word ("${word1}") and ask me if I know what it means in 1-2 friendly spoken sentences.`;
      break;

    case "story_discussion":
      exerciseInstructions = `EXERCISE FOCUS: STORY DISCUSSION & KNOWLEDGE CHECK
- You are discussing the reading passage "${title}" with the student.
- DEMONSTRATE FULL MASTERY OF THE STORY: You know every detail, plot point, character, and event in this story.
- If the student asks what the story is about, give a concise, engaging 2-sentence summary of the story facts.
- Discuss ONLY the plot, character decisions, turning points, facts, and underlying themes directly present in this reading text.
- Ask open-ended, thought-provoking questions about story events and invite the student's personal opinions.
- Strictly adhere to the story context and facts without inventing outside plots, off-topic stories, or fake events ("Bez wymyślania nowych treści").
- Keep responses short (1-2 sentences per turn).`;
      greetingPrompt = `Hello! Greet me warmly as my English tutor. Mention that we are going to discuss the story "${title}". Ask me an engaging opening question about what caught my attention in the story, in 1-2 friendly sentences.`;
      break;

    case "roleplay":
      exerciseInstructions = `EXERCISE FOCUS: INTERACTIVE ROLE-PLAY
- Conduct an immersive role-play based strictly on the characters and situation in "${title}".
- Adopt the persona of one of the specific characters from the story.
- Treat the student as another character from the story.
- Stay strictly in character according to the story setting, react dynamically to their words, and advance the scene based on the story plot. Do not invent unrelated fantasy or off-topic plots ("Bez wymyślania nowych treści").
- Keep each turn to 1-2 spoken sentences.`;
      greetingPrompt = `Hello! Greet me enthusiastically as my English tutor. Propose a fun role-play scenario based directly on the story "${title}". Tell me which role I can play and which role you will take, and invite me to take the first line!`;
      break;

    case "summary_challenge":
      exerciseInstructions = `EXERCISE FOCUS: SUMMARY & RETELLING CHALLENGE
- Invite the student to summarize or retell the story "${title}" in their own words based on the provided text.
- Listen attentively without interrupting unnecessarily.
- When they finish a part of their summary, praise their fluency, highlight 1 or 2 great ENGLISH vocabulary choices from the story, check accuracy against actual story events, and ask a follow-up question to help them conclude or expand.`;
      greetingPrompt = `Hello! Greet me warmly as my English tutor. Tell me that today we have a fun Retelling Challenge for the story "${title}". Invite me to summarize what happened in my own words whenever I'm ready!`;
      break;

    case "comprehension_qa":
      exerciseInstructions = `EXERCISE FOCUS: COMPREHENSION Q&A
- Test the student's reading and listening comprehension strictly of "${title}".
- Ask clear, specific questions about key events, character actions, facts, and details directly mentioned in the text.
- Ask ONE question at a time.
- Verify that their answer matches the facts of the story. If correct, enthusiastically confirm and ask the next question. If they hesitate or get it wrong, give a friendly hint based on the story text!`;
      greetingPrompt = `Hello! Greet me warmly as my English tutor. Tell me we are going to do a quick comprehension quiz on the story "${title}", and immediately ask me the very first question about the story!`;
      break;

    case "grammar_context":
      exerciseInstructions = `EXERCISE FOCUS: GRAMMAR IN CONTEXT
- Help the student practice grammar patterns and sentence structures used in "${title}" (e.g. past narratives, modal verbs, conditionals, or reporting speech).
- Ask the student questions about story events that naturally elicit those grammar structures.
- All sentence examples and contexts must be based on the story text.
- If the student makes a grammatical slip, gently model the natural phrasing in your response while keeping the conversation flowing.`;
      greetingPrompt = `Hello! Greet me warmly as my English tutor. Mention that we're going to practice grammar structures and sentence patterns based on the story "${title}". Ask me a quick opening question in 1-2 friendly sentences.`;
      break;

    default:
      exerciseInstructions = `EXERCISE FOCUS: GENERAL STORY DISCUSSION
- Discuss the story "${title}" with the student. Stick strictly to the content and vocabulary of this story. Keep turns concise (1-2 sentences) and interactive.`;
      greetingPrompt = `Hello! Greet me warmly as my English tutor. Mention that we are talking about the story "${title}", and ask how I'd like to begin!`;
      break;
  }

  const systemInstruction = `You are Speakling, an enthusiastic, friendly and warm native English tutor.
Your goal is to conduct an engaging, interactive spoken English session with a student who is learning ENGLISH.
Speak with a natural, friendly native tone.
Keep your spoken responses concise (1-2 sentences at a time), conversational, and encouraging, always giving the student plenty of speaking time.
Speak only in English.

STRICT CONSTRAINTS & GROUNDING (MUST FOLLOW AT ALL TIMES):
1. MANDATORY STORY FAMILIARITY & BOUNDARY: You must thoroughly read, familiarize yourself with, and memorize the selected story text provided below ("${title}"). You MUST ONLY refer to, discuss, ask about, and use content, characters, facts, and events from THIS SPECIFIC STORY. Absolutely NO inventing outside stories, external topics, or hallucinating facts outside this text ("Bez wymyślania nowych treści"). If the student asks you what the text is about, give a clear, accurate summary of the story text below.
2. TARGET TERMS MUST BE IN ENGLISH: You are an ENGLISH tutor teaching ENGLISH to a Polish native speaker. The target term presented in any exercise, question, or quiz MUST ALWAYS BE THE ENGLISH WORD (e.g. "Do you know what '${word1}' means?", "How would you use '${word2}' in a sentence?"). NEVER quiz Polish words or ask "Co oznacza zbieracz?". Polish translations may only be given as helpful hints/meanings FOR the English target word.
3. MULTI-TURN SEQUENTIAL VOCABULARY QUIZ: In vocabulary practice, progress sequentially through the target ENGLISH words list: Word 1 -> Word 2 -> Word 3 -> Word 4. Never stop after just one word.

SELECTED STORY IN CONTEXT:
${targetWordsFormatted ? `\nPRE-APPROVED SEQUENTIAL TARGET WORDS FOR THIS SESSION:\n${targetWordsFormatted}\n` : ''}Full Story Text:
"""
${text}
"""

${exerciseInstructions}`;

  const storyHeaderPrompt = `[STRICT CONTEXT FOR THIS VOICE SESSION - READ AND MEMORIZE THIS STORY]
Story Title: "${title}"
Full Reading Passage Text:
"""
${text}
"""
${targetWordsFormatted ? `Pre-approved Target English Vocabulary:\n${targetWordsFormatted}\n` : ''}`;

  const finalGreetingPrompt = `${storyHeaderPrompt}\nINSTRUCTION FOR TUTOR (FIRST TURN):\n${greetingPrompt}`;

  return { systemInstruction, greetingPrompt: finalGreetingPrompt };
}

function Dashboard({ user }) {
  // Tryb rozmowy: 'live' (Gemini Multimodal Live) lub 'classic' (Whisper + OpenAI/DeepSeek + TTS)
  const [chatMode, setChatMode] = useState(() => {
    return localStorage.getItem("buddy_live_chat_mode") || "live";
  });

  // Ustawienia Gemini Live
  const [liveProvider, setLiveProvider] = useState(() => {
    return localStorage.getItem("buddy_live_provider") || "google_ai_studio";
  });
  const [liveVoice, setLiveVoice] = useState(() => {
    return localStorage.getItem("buddy_live_voice") || "Puck";
  });
  const [liveModel, setLiveModel] = useState(() => {
    const saved = localStorage.getItem("buddy_live_model");
    if (!saved || saved === "gemini-2.0-flash-exp") {
      localStorage.setItem("buddy_live_model", "gemini-2.5-flash-native-audio-latest");
      return "gemini-2.5-flash-native-audio-latest";
    }
    return saved;
  });
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem("buddy_gemini_api_key") || "";
  });
  const [inlineKeyInput, setInlineKeyInput] = useState("");
  const [isSavingInlineKey, setIsSavingInlineKey] = useState(false);

  // Konfiguracja serwera
  const [serverConfig, setServerConfig] = useState(null);

  // Wybór czytanki (Stories) oraz typu ćwiczenia z lektorem
  const [userStories, setUserStories] = useState([]);
  const [userVocabulary, setUserVocabulary] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState(() => {
    return localStorage.getItem("buddy_selected_story_id") || SAMPLE_STORIES[0].id;
  });
  const [exerciseType, setExerciseType] = useState(() => {
    return localStorage.getItem("buddy_exercise_type") || "story_discussion";
  });
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const [isLoadingStories, setIsLoadingStories] = useState(false);

  // Pobieranie zapisanych czytanek użytkownika z backendu
  const loadStories = useCallback(async () => {
    if (!user?.token) return;
    setIsLoadingStories(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stories`, {
        headers: { "X-Session-Token": user.token }
      });
      if (response.ok) {
        const data = await response.json();
        const mainStories = Array.isArray(data) ? data.filter((s) => !s.parent_id) : [];
        setUserStories(mainStories);
      }
    } catch (err) {
      console.warn("Nie udało się pobrać zapisanych historii użytkownika:", err);
    } finally {
      setIsLoadingStories(false);
    }
  }, [user]);

  // Pobieranie podręcznego słownika użytkownika (zapisane nieznane słówka)
  const loadUserVocabulary = useCallback(async () => {
    if (!user?.token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
        headers: { "X-Session-Token": user.token }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setUserVocabulary(data);
        }
      }
    } catch (err) {
      console.warn("Nie udało się pobrać słownika użytkownika:", err);
    }
  }, [user]);

  useEffect(() => {
    loadStories();
    loadUserVocabulary();
  }, [loadStories, loadUserVocabulary]);

  // Lista wszystkich dostępnych czytanek (wzorcowe + własne użytkownika)
  const allStories = [
    ...SAMPLE_STORIES,
    ...userStories
  ];

  const selectedStory = allStories.find((s) => s.id === selectedStoryId) || null;
  const currentExerciseObj = EXERCISE_TYPES.find((ex) => ex.id === exerciseType) || EXERCISE_TYPES[0];

  const handleStorySelectChange = (e) => {
    const newId = e.target.value;
    setSelectedStoryId(newId);
    localStorage.setItem("buddy_selected_story_id", newId);
    if (newId && exerciseType === "free") {
      setExerciseType("story_discussion");
      localStorage.setItem("buddy_exercise_type", "story_discussion");
    }
  };

  const handleExerciseTypeChange = (e) => {
    const newType = e.target.value;
    setExerciseType(newType);
    localStorage.setItem("buddy_exercise_type", newType);
  };

  // Stany ogólne czatu
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [voiceSummary, setVoiceSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Refs do płynnej, sprzętowo akcelerowanej animacji orba na GPU bez re-renderowania komponentu
  const orbButtonRef = useRef(null);
  const targetScaleRef = useRef(1.0);
  const currentScaleRef = useRef(1.0);
  const rafScaleLoopRef = useRef(null);
  const liveHangoverTimerRef = useRef(null);

  // Stany specyficzne dla Gemini Live
  const [liveStatus, setLiveStatus] = useState("inactive"); // 'inactive' | 'connecting' | 'listening' | 'user-speaking' | 'speaking'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Stany dla Classic Mode
  const [isClassicRecording, setIsClassicRecording] = useState(false);
  const [isClassicProcessing, setIsClassicProcessing] = useState(false);
  const [isClassicBotSpeaking, setIsClassicBotSpeaking] = useState(false);
  const [classicUserSpeakingState, setClassicUserSpeakingState] = useState(false);

  // Refs
  const geminiLiveRef = useRef(null);
  const videoElementRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const chatMessagesRef = useRef(chatMessages);
  const liveStatusRef = useRef(liveStatus);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    liveStatusRef.current = liveStatus;
  }, [liveStatus]);

  // Classic Mode Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const localTranscriptRef = useRef("");
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isUserSpeakingRef = useRef(false);
  const interruptionCounterRef = useRef(0);
  const checkVolumeAnimationRef = useRef(null);
  const isBotSpeakingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Płynna pętla interpolacji skali orba na GPU (60 FPS bez dotykania React Virtual DOM)
  const startScaleLoop = useCallback(() => {
    if (rafScaleLoopRef.current) return;

    const tick = () => {
      const diff = targetScaleRef.current - currentScaleRef.current;
      if (Math.abs(diff) > 0.001) {
        currentScaleRef.current += diff * 0.25;
        if (orbButtonRef.current) {
          orbButtonRef.current.style.transform = `scale(${currentScaleRef.current.toFixed(3)}) translateZ(0)`;
        }
        rafScaleLoopRef.current = requestAnimationFrame(tick);
      } else {
        currentScaleRef.current = targetScaleRef.current;
        if (orbButtonRef.current) {
          if (currentScaleRef.current === 1.0) {
            orbButtonRef.current.style.transform = "";
          } else {
            orbButtonRef.current.style.transform = `scale(${currentScaleRef.current.toFixed(3)}) translateZ(0)`;
          }
        }
        if (targetScaleRef.current !== 1.0) {
          rafScaleLoopRef.current = requestAnimationFrame(tick);
        } else {
          rafScaleLoopRef.current = null;
        }
      }
    };

    rafScaleLoopRef.current = requestAnimationFrame(tick);
  }, []);

  const stopScaleLoop = useCallback(() => {
    if (rafScaleLoopRef.current) {
      cancelAnimationFrame(rafScaleLoopRef.current);
      rafScaleLoopRef.current = null;
    }
    targetScaleRef.current = 1.0;
    currentScaleRef.current = 1.0;
    if (orbButtonRef.current) {
      orbButtonRef.current.style.transform = "";
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScaleLoop();
      if (liveHangoverTimerRef.current) {
        clearTimeout(liveHangoverTimerRef.current);
      }
    };
  }, [stopScaleLoop]);

  useEffect(() => {
    isBotSpeakingRef.current = isClassicBotSpeaking;
  }, [isClassicBotSpeaking]);

  useEffect(() => {
    isRecordingRef.current = isClassicRecording;
  }, [isClassicRecording]);

  useEffect(() => {
    isProcessingRef.current = isClassicProcessing;
  }, [isClassicProcessing]);

  // Pobranie konfiguracji serwera dla Live API przy montowaniu
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/live/config`)
      .then((res) => res.json())
      .then((data) => {
        setServerConfig(data);
      })
      .catch((err) => {
        console.warn("Nie udało się pobrać konfiguracji /api/live/config:", err);
      });
  }, []);

  // Czyszczenie przy odmontowaniu
  useEffect(() => {
    return () => {
      stopLiveSession();
      cleanupClassicVAD();
      stopClassicAudio();
      stopClassicRecordingLocally();
    };
  }, []);

  // Automatyczne przewijanie transkrypcji
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [chatMessages, showTranscript]);

  // Zapis ustawień do localStorage i opcjonalne natychmiastowe uruchomienie
  const handleSaveSettings = async (newSettings, shouldStart = false) => {
    setErrorMessage(null);
    const trimmedKey = newSettings.apiKey !== undefined ? newSettings.apiKey.trim() : customApiKey.trim();
    if (newSettings.mode) {
      setChatMode(newSettings.mode);
      localStorage.setItem("buddy_live_chat_mode", newSettings.mode);
    }
    if (newSettings.provider) {
      setLiveProvider(newSettings.provider);
      localStorage.setItem("buddy_live_provider", newSettings.provider);
    }
    if (newSettings.voice) {
      setLiveVoice(newSettings.voice);
      localStorage.setItem("buddy_live_voice", newSettings.voice);
    }
    if (newSettings.model) {
      setLiveModel(newSettings.model);
      localStorage.setItem("buddy_live_model", newSettings.model);
    }
    if (newSettings.apiKey !== undefined) {
      setCustomApiKey(trimmedKey);
      localStorage.setItem("buddy_gemini_api_key", trimmedKey);

      // Zapisz na serwerze jeśli klucz jest obecny i użytkownik ma token
      if (trimmedKey && user?.token) {
        fetch(`${API_BASE_URL}/api/live/save-key`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user.token,
          },
          body: JSON.stringify({ api_key: trimmedKey }),
        }).catch((e) => console.warn("Nie udało się zapisać klucza na serwerze:", e));
      }
    }
    setShowSettings(false);

    if (shouldStart) {
      if (newSettings.mode === "classic") {
        await handleSwitchToClassicAndStart();
      } else {
        await startLiveSession({
          apiKey: trimmedKey,
          provider: newSettings.provider || liveProvider,
          voice: newSettings.voice || liveVoice,
          model: newSettings.model || liveModel,
        });
      }
    }
  };

  const handleInlineKeySubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = inlineKeyInput.trim();
    if (!trimmed) return;
    setIsSavingInlineKey(true);
    setErrorMessage(null);
    setCustomApiKey(trimmed);
    localStorage.setItem("buddy_gemini_api_key", trimmed);

    if (user?.token) {
      fetch(`${API_BASE_URL}/api/live/save-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token,
        },
        body: JSON.stringify({ api_key: trimmed }),
      }).catch((e) => console.warn("Nie udało się zapisać klucza na serwerze:", e));
    }

    setIsSavingInlineKey(false);
    await startLiveSession({ apiKey: trimmed });
  };

  // ==========================================
  // GEMINI MULTIMODAL LIVE API LOGIC
  // ==========================================

  const startLiveSession = async (overrideOptions = {}) => {
    setErrorMessage(null);
    setLiveStatus("connecting");
    setIsChatActive(true);
    setChatMessages([]);
    setShowTranscript(false);

    const activeProvider = overrideOptions.provider || liveProvider;
    const activeModel = overrideOptions.model || liveModel;
    const activeVoice = overrideOptions.voice || liveVoice;
    const activeKey = (overrideOptions.apiKey !== undefined ? overrideOptions.apiKey : customApiKey).trim();

    try {
      const currentStory = allStories.find((s) => s.id === selectedStoryId) || null;
      const { systemInstruction: contextualInstruction, greetingPrompt: contextualGreeting } = buildTutorPrompts(currentStory, exerciseType, userVocabulary);

      let clientConfig = {
        provider: activeProvider,
        model: activeModel,
        voiceName: activeVoice,
        apiBaseUrl: API_BASE_URL,
        sessionToken: user?.token || null,
        userEmail: user?.email || null,
        systemInstruction: contextualInstruction,
        initialGreetingPrompt: contextualGreeting,
        onStatusChange: (status) => {
          setLiveStatus(status);
        },
        onUserVolume: (volume) => {
          if (volume > 0.025) {
            targetScaleRef.current = 1 + Math.min(volume * 2.2, 0.22);
            startScaleLoop();
            if (liveHangoverTimerRef.current) {
              clearTimeout(liveHangoverTimerRef.current);
              liveHangoverTimerRef.current = null;
            }
            setLiveStatus((prev) => (prev === "listening" ? "user-speaking" : prev));
          } else {
            targetScaleRef.current = 1.0;
            startScaleLoop();
            if (!liveHangoverTimerRef.current) {
              liveHangoverTimerRef.current = setTimeout(() => {
                setLiveStatus((prev) => (prev === "user-speaking" ? "listening" : prev));
                liveHangoverTimerRef.current = null;
              }, 450);
            }
          }
        },
        onBotSpeaking: (isSpeaking) => {
          if (isSpeaking) {
            if (liveHangoverTimerRef.current) {
              clearTimeout(liveHangoverTimerRef.current);
              liveHangoverTimerRef.current = null;
            }
            targetScaleRef.current = 1.0;
            startScaleLoop();
            setLiveStatus("speaking");
          } else {
            setLiveStatus((prev) => (prev === "speaking" ? "listening" : prev));
          }
        },
        onTranscript: ({ sender, text, isFinal }) => {
          if (!text || !text.trim()) return;

          // Ochrona przed echem akustycznym bez słuchawek:
          if (sender === "user" && (liveStatusRef.current === "speaking" || geminiLiveRef.current?.isEchoSuppressionActive?.())) {
            return;
          }

          setChatMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.sender === sender) {
              const updated = [...prev];
              const newText = text.trim();
              const existingText = (lastMsg.text || "").trim();

              let textToUse = newText;
              if (existingText && !lastMsg.isFinal && newText.length < existingText.length && !isFinal) {
                if (existingText.toLowerCase().includes(newText.toLowerCase())) {
                  textToUse = existingText;
                }
              }

              updated[updated.length - 1] = {
                ...lastMsg,
                text: textToUse,
                isFinal: lastMsg.isFinal || isFinal,
              };
              return updated;
            } else {
              return [
                ...prev,
                {
                  id: `${sender}-${Date.now()}`,
                  sender: sender,
                  text: text.trim(),
                  isFinal: isFinal,
                },
              ];
            }
          });
        },
        onError: (err) => {
          console.error("Gemini Live Error:", err);
          setErrorMessage(err);
          setLiveStatus("inactive");
          setIsChatActive(false);
        },
        onClose: () => {
          setLiveStatus("inactive");
          setIsChatActive(false);
        },
      };

      // 1. Sprawdzamy czy użytkownik ma wpisany własny klucz API w ustawieniach
      if (activeProvider === "google_ai_studio" && activeKey) {
        clientConfig.apiKey = activeKey;
      } else if (activeProvider === "google_ai_studio") {
        // Jeśli nie ma klucza w przeglądarce i serwer nie ma GEMINI_API_KEY
        if (!serverConfig?.gemini_api_key_configured) {
          setShowSettings(true);
          setErrorMessage(
            "Wklej swój bezpłatny klucz API z Google AI Studio poniżej lub przełącz jednym kliknięciem na tryb OpenAI / DeepSeek!"
          );
          setIsChatActive(false);
          setLiveStatus("inactive");
          return;
        }

        // Pobieramy token efemeryczny z backendu
        const tokenRes = await fetch(`${API_BASE_URL}/api/live/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
          body: JSON.stringify({
            model: activeModel,
            api_key: activeKey || undefined,
          }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || tokenData.error) {
          if (tokenData.error === "NO_API_KEY") {
            setShowSettings(true);
            setErrorMessage(
              "Wymagany bezpłatny klucz Gemini API. Wklej go poniżej lub uruchom tryb klasyczny (OpenAI), który nie wymaga konfiguracji."
            );
            setIsChatActive(false);
            setLiveStatus("inactive");
            return;
          }
          throw new Error(tokenData.error || tokenData.message || "Błąd generowania tokena sesji.");
        }

        clientConfig.token = tokenData.token;
        clientConfig.wsUrl = tokenData.ws_url;
      } else if (activeProvider === "vertex_ai") {
        // Pobieramy token OAuth2 dla Vertex AI z backendu
        const vertexRes = await fetch(`${API_BASE_URL}/api/live/vertex-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
        });

        const vertexData = await vertexRes.json();
        if (!vertexRes.ok || vertexData.error) {
          throw new Error(vertexData.error || "Błąd uwierzytelniania w Google Cloud Vertex AI.");
        }

        clientConfig.token = vertexData.access_token;
        clientConfig.wsUrl = vertexData.ws_url;
      }

      // Inicjalizacja klienta WebSocket
      const client = new GeminiLiveClient(clientConfig);
      geminiLiveRef.current = client;
      await client.connect();

      // Jeśli kamera była włączona, uruchamiamy strumień
      if (isCameraActive && videoElementRef.current) {
        await client.startCameraStream(videoElementRef.current);
      }
    } catch (err) {
      console.error("Nie udało się rozpocząć sesji Gemini Live:", err);
      setErrorMessage(err.message || "Wystąpił błąd podczas łączenia z Gemini Live.");
      setIsChatActive(false);
      setLiveStatus("inactive");
    }
  };

  const stopLiveSession = () => {
    if (liveHangoverTimerRef.current) {
      clearTimeout(liveHangoverTimerRef.current);
      liveHangoverTimerRef.current = null;
    }
    stopScaleLoop();
    if (geminiLiveRef.current) {
      geminiLiveRef.current.cleanup();
      geminiLiveRef.current = null;
    }
    setIsCameraActive(false);
    setLiveStatus("inactive");
  };

  const handleToggleCamera = async () => {
    if (!isChatActive || !geminiLiveRef.current) {
      setIsCameraActive(!isCameraActive);
      return;
    }

    try {
      if (isCameraActive) {
        geminiLiveRef.current.stopCameraStream();
        setIsCameraActive(false);
      } else {
        setIsCameraActive(true);
        // Poczekajmy na wyrenderowanie elementu video
        setTimeout(async () => {
          if (videoElementRef.current && geminiLiveRef.current) {
            await geminiLiveRef.current.startCameraStream(videoElementRef.current);
          }
        }, 150);
      }
    } catch (err) {
      alert("Nie udało się uzyskać dostępu do kamery: " + err.message);
      setIsCameraActive(false);
    }
  };

  // ==========================================
  // CLASSIC MODE FALLBACK LOGIC
  // ==========================================

  const stopClassicAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsClassicBotSpeaking(false);
  };

  const stopClassicRecordingLocally = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsClassicRecording(false);
  };

  const cleanupClassicVAD = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (checkVolumeAnimationRef.current) {
      cancelAnimationFrame(checkVolumeAnimationRef.current);
      checkVolumeAnimationRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }
      audioContextRef.current = null;
    }
    if (microphoneRef.current) {
      try {
        microphoneRef.current.disconnect();
      } catch (e) {}
      microphoneRef.current = null;
    }
    analyserRef.current = null;
    isUserSpeakingRef.current = false;
    setClassicUserSpeakingState(false);
    interruptionCounterRef.current = 0;
    if (liveHangoverTimerRef.current) {
      clearTimeout(liveHangoverTimerRef.current);
      liveHangoverTimerRef.current = null;
    }
    stopScaleLoop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const setupClassicVAD = (stream) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const deviation = (dataArray[i] - 128) / 128;
          sum += deviation * deviation;
        }
        const rms = Math.sqrt(sum / bufferLength);

        if (isUserSpeakingRef.current) {
          targetScaleRef.current = 1 + Math.min(rms * 2.2, 0.22);
          startScaleLoop();
        } else {
          targetScaleRef.current = 1.0;
          startScaleLoop();
        }
        handleClassicVoiceActivity(rms);

        checkVolumeAnimationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error("Classic VAD initialization failed:", e);
    }
  };

  const handleClassicVoiceActivity = (rms) => {
    if (isBotSpeakingRef.current) {
      if (rms > INTERRUPTION_THRESHOLD) {
        interruptionCounterRef.current += 1;
        if (interruptionCounterRef.current > 10) {
          interruptionCounterRef.current = 0;
          stopClassicAudio();
          startClassicRecording();
        }
      } else {
        interruptionCounterRef.current = Math.max(0, interruptionCounterRef.current - 1);
      }
      return;
    }

    if (isRecordingRef.current && !isProcessingRef.current) {
      if (rms > VOICE_THRESHOLD) {
        if (!isUserSpeakingRef.current) {
          isUserSpeakingRef.current = true;
          setClassicUserSpeakingState(true);
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        if (isUserSpeakingRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stopClassicRecording();
            isUserSpeakingRef.current = false;
            setClassicUserSpeakingState(false);
            silenceTimerRef.current = null;
          }, SILENCE_DURATION);
        }
      }
    }
  };

  const startClassicRecording = () => {
    if (!streamRef.current || isProcessingRef.current || isRecordingRef.current) return;

    stopClassicAudio();
    audioChunksRef.current = [];
    isUserSpeakingRef.current = false;
    setClassicUserSpeakingState(false);
    localTranscriptRef.current = "";

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (event) => {
          let fullTranscript = "";
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript + " ";
          }
          if (fullTranscript.trim()) {
            localTranscriptRef.current = fullTranscript.trim();
          }
        };
        recognitionRef.current = rec;
        rec.start();
      } catch (e) {}
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSendClassicVoice(audioBlob);
      };
      mediaRecorder.start();
      setIsClassicRecording(true);
    } catch (err) {
      try {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current);
          await handleSendClassicVoice(audioBlob);
        };
        mediaRecorder.start();
        setIsClassicRecording(true);
      } catch (e) {}
    }
  };

  const stopClassicRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsClassicRecording(false);
  };

  const handleSendClassicVoice = async (audioBlob) => {
    setIsClassicProcessing(true);
    try {
      const historyForApi = chatMessages.map((msg) => ({
        sender: msg.sender,
        text: msg.text,
      }));

      const formData = new FormData();
      formData.append("audio", audioBlob, "user_speech.webm");
      formData.append("history", JSON.stringify(historyForApi));
      formData.append("voice", "en-US-BrianNeural");
      if (selectedStory) {
        formData.append("story_title", selectedStory.title || "");
        formData.append("story_text", selectedStory.text || "");
        formData.append("exercise_type", exerciseType || "");
      }
      if (localTranscriptRef.current) {
        formData.append("transcription", localTranscriptRef.current);
      }
      if ('speechSynthesis' in window) {
        formData.append("skip_tts", "true");
      }

      const response = await fetch(`${API_BASE_URL}/api/chat-free`, {
        method: "POST",
        headers: {
          "X-Session-Token": user?.token || "",
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Błąd połączenia z API");
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const userMsg = {
        id: "user-" + Date.now(),
        sender: "user",
        text: result.transcription || localTranscriptRef.current || "(Brak transkrypcji)",
        evaluation: result.user_evaluation,
      };

      const botMsg = {
        id: "bot-" + (Date.now() + 1),
        sender: "bot",
        text: result.bot_response,
      };

      setChatMessages((prev) => [...prev, userMsg, botMsg]);
      playClassicTutorAudio(result.bot_response, result.audio_base64);
    } catch (err) {
      console.error("Error in classic voice:", err);
      alert("Wystąpił problem z połączeniem: " + err.message);
      startClassicRecording();
    } finally {
      setIsClassicProcessing(false);
    }
  };

  const playClassicTutorAudio = (text, cachedBase64) => {
    stopClassicAudio();
    setIsClassicBotSpeaking(true);

    if (!cachedBase64 && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.onend = () => {
          setIsClassicBotSpeaking(false);
          startClassicRecording();
        };
        utterance.onerror = () => {
          setIsClassicBotSpeaking(false);
          startClassicRecording();
        };
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {}
    }

    if (cachedBase64) {
      const audioUrl = `data:audio/mp3;base64,${cachedBase64}`;
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsClassicBotSpeaking(false);
        currentAudioRef.current = null;
        startClassicRecording();
      };
      audio.onerror = () => {
        setIsClassicBotSpeaking(false);
        currentAudioRef.current = null;
        startClassicRecording();
      };
      currentAudioRef.current = audio;
      audio.play();
    } else {
      setIsClassicBotSpeaking(false);
      startClassicRecording();
    }
  };

  // ==========================================
  // UNIFIED SESSION START / END
  // ==========================================

  const handleStartSession = async () => {
    if (chatMode === "live") {
      await startLiveSession();
    } else {
      // Classic Mode
      cleanupClassicVAD();
      setIsChatActive(true);
      setChatMessages([]);
      stopClassicAudio();
      setShowTranscript(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;
        setupClassicVAD(stream);
        startClassicRecording();
      } catch (err) {
        alert("Nie udało się uzyskać dostępu do mikrofonu: " + err.message);
        setIsChatActive(false);
      }
    }
  };

  const handleSwitchToClassicAndStart = async () => {
    setChatMode("classic");
    localStorage.setItem("buddy_live_chat_mode", "classic");
    setShowSettings(false);
    setErrorMessage(null);
    cleanupClassicVAD();
    stopLiveSession();
    setIsChatActive(true);
    setChatMessages([]);
    stopClassicAudio();
    setShowTranscript(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;
      setupClassicVAD(stream);
      startClassicRecording();
    } catch (err) {
      alert("Nie udało się uzyskać dostępu do mikrofonu: " + err.message);
      setIsChatActive(false);
    }
  };

  const handleEndSession = async () => {
    if (chatMode === "live") {
      stopLiveSession();
    } else {
      stopClassicAudio();
      stopClassicRecordingLocally();
      cleanupClassicVAD();
    }

    setIsChatActive(false);

    // Pobieramy historię z refa, aby uniknąć problemu z przestarzałym domknięciem stanu
    const messagesToSummarize = chatMessagesRef.current || [];

    // Generowanie podsumowania, jeśli są jakiekolwiek wiadomości
    if (messagesToSummarize.length > 0) {
      setIsGeneratingSummary(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat-free/summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || "",
          },
          body: JSON.stringify({
            history: messagesToSummarize.map((msg) => ({
              sender: msg.sender,
              text: msg.text,
            })),
          }),
        });

        if (response.ok) {
          const summaryData = await response.json();
          setVoiceSummary(summaryData);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error("Błąd tworzenia podsumowania:", errData);
          setErrorMessage(errData.error || "Serwer nie mógł przygotować podsumowania rozmowy.");
        }
      } catch (err) {
        console.error("Błąd podczas tworzenia podsumowania sesji:", err);
        setErrorMessage("Błąd połączenia z serwerem podczas generowania podsumowania.");
      } finally {
        setIsGeneratingSummary(false);
      }
    } else {
      setErrorMessage("Rozmowa była zbyt krótka, aby wygenerować podsumowanie. Porozmawiaj chwilę z lektorem i spróbuj ponownie!");
    }
  };

  const handleCloseSummary = () => {
    setVoiceSummary(null);
    setChatMessages([]);
  };

  // Wyliczanie statusu Orba
  let orbStatus = "inactive";
  if (isChatActive) {
    if (chatMode === "live") {
      orbStatus = liveStatus;
    } else {
      if (isClassicProcessing) {
        orbStatus = "thinking";
      } else if (isClassicBotSpeaking) {
        orbStatus = "speaking";
      } else if (isClassicRecording) {
        orbStatus = classicUserSpeakingState ? "user-speaking" : "listening";
      }
    }
  }

  const handleOrbClick = () => {
    if (!isChatActive) {
      handleStartSession();
      return;
    }
    // Jeśli lektor mówi, kliknięcie orba natychmiast przerywa jego wypowiedź (Barge-in / przerwanie mowy lektora)
    if (orbStatus === "speaking") {
      if (chatMode === "live" && geminiLiveRef.current) {
        geminiLiveRef.current.stopBotAudio();
        return;
      } else if (chatMode === "classic") {
        stopClassicAudio();
        startClassicRecording();
        return;
      }
    }
    // W przeciwnym razie kliknięcie kończy rozmowę
    handleEndSession();
  };

  const isSplitLayout = isChatActive && showTranscript && chatMessages.length > 0;

  return (
    <div className="tutor-gemini-container">
      {/* Settings Icon placed over TopBar */}
      <div style={{ position: 'fixed', top: '15px', right: '32px', zIndex: 60 }}>
        <button
          onClick={() => setShowSettings(true)}
          title="Ustawienia"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Floating Error Notification */}
      {errorMessage && (
        <div className="tutor-error-banner animate-fade-in">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="error-close-btn">×</button>
        </div>
      )}

      {/* Main Action Stage */}
      <div className={`tutor-main-stage ${isSplitLayout ? "split" : "centered"}`}>
        
        {/* Orb Section */}
        <div className="tutor-orb-section">
          {/* Story & Exercise Selection Bar */}
          <div className="tutor-context-bar glass-panel animate-fade-in">
            <div className="context-bar-header">
              <div className="context-bar-title-row">
                <span className="context-icon">📚</span>
                <div className="context-title-wrap">
                  <h3 className="context-heading">Rozmowa o czytance i ćwiczenia z AI</h3>
                  <p className="context-subheading">
                    Wybierz czytankę i cel ćwiczenia, aby rozmawiać na konkretny temat lub szlifować słownictwo!
                  </p>
                </div>
              </div>
              {selectedStory && (
                <button
                  type="button"
                  className="btn-preview-story"
                  onClick={() => setShowStoryPreview(true)}
                  title="Zobacz pełny tekst czytanki"
                >
                  📖 Zobacz tekst
                </button>
              )}
            </div>

            <div className="context-selectors-grid">
              {/* 1. Lista rozwijana czytanek do wyboru */}
              <div className="context-field">
                <label className="context-label" htmlFor="story-select">
                  <span className="field-icon">📖</span> Czytanka do rozmowy:
                </label>
                <div className="select-wrapper">
                  <select
                    id="story-select"
                    className="context-select"
                    value={selectedStoryId}
                    onChange={handleStorySelectChange}
                    disabled={isChatActive}
                  >
                    <option value="">🗣️ Rozmowa swobodna (dowolny temat / bez czytanki)</option>
                    {userStories.length > 0 && (
                      <optgroup label="📁 Twoje zapisane czytanki">
                        {userStories.map((story) => (
                          <option key={story.id} value={story.id}>
                            📖 {story.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="🌟 Gotowe czytanki Speakling">
                      {SAMPLE_STORIES.map((story) => (
                        <option key={story.id} value={story.id}>
                          🌟 {story.title} ({story.level})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* 2. Lista rozwijana typów ćwiczeń do wykonania z AI */}
              <div className="context-field">
                <label className="context-label" htmlFor="exercise-select">
                  <span className="field-icon">🎯</span> Typ ćwiczenia z AI:
                </label>
                <div className="select-wrapper">
                  <select
                    id="exercise-select"
                    className="context-select"
                    value={selectedStoryId ? exerciseType : "free"}
                    onChange={handleExerciseTypeChange}
                    disabled={isChatActive || !selectedStoryId}
                  >
                    {!selectedStoryId ? (
                      <option value="free">💬 Swobodna konwersacja z lektorem</option>
                    ) : (
                      EXERCISE_TYPES.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Informacja o wybranym trybie */}
            {selectedStory ? (
              <div className="selected-context-info">
                <span className="context-pill story-pill">
                  📖 <strong>{selectedStory.title}</strong>
                  {selectedStory.level && ` (${selectedStory.level})`}
                </span>
                <span className="context-pill exercise-pill" title={currentExerciseObj?.description}>
                  🎯 <strong>{currentExerciseObj?.badge}:</strong> {currentExerciseObj?.description}
                </span>
                {isChatActive && (
                  <span className="context-pill active-call-pill">
                    🔒 Aktywne połączenie
                  </span>
                )}
              </div>
            ) : (
              <div className="selected-context-info free-mode">
                <span className="context-pill neutral-pill">
                  🗣️ Tryb otwarty – swobodna rozmowa po angielsku na dowolny temat.
                </span>
              </div>
            )}
          </div>

          {/* Central Gemini Orb Control */}
          <div className="tutor-orb-wrapper">
            <button
              ref={orbButtonRef}
              className={`tutor-gemini-orb ${orbStatus}`}
              onClick={handleOrbClick}
              title={isChatActive ? (orbStatus === "speaking" ? "Kliknij, aby przerwać lektorowi i odpowiedzieć" : "Kliknij, aby zakończyć rozmowę") : "Kliknij, aby rozpocząć rozmowę w czasie rzeczywistym"}
            >
              <div className="orb-pulse-ring-1"></div>
              <div className="orb-pulse-ring-2"></div>
              <div className="orb-core">
                {orbStatus === "inactive" && (
                  <svg viewBox="0 0 24 24" className="orb-mic-svg">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
                {orbStatus === "speaking" && (
                  <div className="orb-wave-container">
                    <span className="wave-bar bar-1"></span>
                    <span className="wave-bar bar-2"></span>
                    <span className="wave-bar bar-3"></span>
                  </div>
                )}
                {orbStatus === "listening" && (
                  <div className="orb-pulse-dot"></div>
                )}
                {orbStatus === "user-speaking" && (
                  <div className="orb-wave-container green">
                    <span className="wave-bar bar-1"></span>
                    <span className="wave-bar bar-2"></span>
                    <span className="wave-bar bar-3"></span>
                  </div>
                )}
                {(orbStatus === "thinking" || orbStatus === "connecting") && (
                  <div className="orb-spinner"></div>
                )}
              </div>
            </button>
          </div>

          {/* Status text label */}
          <div className="tutor-status-label">
            {orbStatus === "inactive" && "Naciśnij orb, aby rozpocząć rozmowę w czasie rzeczywistym"}
            {orbStatus === "connecting" && "Łączenie z Gemini Live API..."}
            {orbStatus === "speaking" && "Lektor mówi (zacznij mówić, aby wtrącić!)"}
            {orbStatus === "listening" && "Słucham... powiedz coś po angielsku"}
            {orbStatus === "user-speaking" && "Mówisz..."}
            {orbStatus === "thinking" && "Lektor myśli..."}
          </div>



          {/* Przycisk zakończenia rozmowy i przejścia do podsumowania */}
          {isChatActive && (
            <div className="tutor-active-call-controls animate-fade-in">
              <button
                type="button"
                className="btn-end-call-prominent"
                onClick={handleEndSession}
                title="Zakończ rozmowę i wygeneruj raport postępów"
              >
                <span className="end-call-icon">🛑</span> Zakończ rozmowę i zobacz podsumowanie
              </button>
            </div>
          )}

          {/* Controls Bar: Transcript Button (Only visible after initiating chat) */}
          <div className="tutor-action-buttons-row">

            {/* Toggle Transcript button */}
            {chatMessages.length > 0 && (
              <button 
                className={`tutor-transcript-toggle-btn ${showTranscript ? "active" : ""}`}
                onClick={() => setShowTranscript(!showTranscript)}
              >
                {showTranscript ? "🙈 Ukryj tekst" : "👁 Pokaż tekst"}
              </button>
            )}
          </div>
        </div>

        {/* Side Transcript Section */}
        {(isChatActive || isGeneratingSummary || showTranscript) && chatMessages.length > 0 && (
          <div className={`tutor-side-transcript glass-panel ${showTranscript ? "open" : ""}`}>
            <div className="side-transcript-header-row">
              <h3 className="side-transcript-header">Zapis rozmowy na żywo</h3>
              <span className="live-tag">LIVE</span>
            </div>
            <div className="transcript-scroll-area" ref={transcriptScrollRef}>
              {chatMessages.map((msg) => {
                const isBot = msg.sender === "bot";
                return (
                  <div key={msg.id} className={`transcript-bubble ${isBot ? "bot" : "user"}`}>
                    <span className="bubble-speaker">{isBot ? "Lektor:" : "Ty:"}</span>
                    <p className="bubble-text">{msg.text}</p>
                    {!isBot && msg.evaluation && (
                      <div className="transcript-evaluation">
                        🏆 Ocena: <strong>{msg.evaluation.score}/100</strong>. {msg.evaluation.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Multimodal Camera PIP Window */}
      {isCameraActive && (
        <div className="tutor-camera-pip glass-panel animate-zoom">
          <div className="pip-header">
            <span className="pip-badge">📷 Multimodal Vision</span>
            <button className="pip-close-btn" onClick={handleToggleCamera}>✕</button>
          </div>
          <video
            ref={videoElementRef}
            className="pip-video-feed"
            autoPlay
            playsInline
            muted
          />
          <div className="pip-footer">Lektor analizuje obraz z kamery w czasie rzeczywistym.</div>
        </div>
      )}


      {/* Voice Session Summary Modal */}
      {voiceSummary && (
        <VoiceSessionSummaryModal
          summary={voiceSummary}
          user={user}
          onClose={handleCloseSummary}
        />
      )}

      {/* Loading Overlay for Summary Generation */}
      {isGeneratingSummary && (
        <div className="summary-modal-overlay" style={{ zIndex: 1100 }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div className="summary-modal-content glass-panel animate-zoom" style={{ maxWidth: "420px", padding: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", background: "white" }}>
            <div className="spinner" style={{ width: "40px", height: "40px", border: "4px solid #e2e8f0", borderTop: "4px solid #1a73e8", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <h3 style={{ margin: 0, textAlign: "center", fontSize: "1.2rem", color: "var(--slate-800)" }}>Generowanie podsumowania lekcji...</h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--slate-500)", textAlign: "center", lineHeight: "1.4" }}>
              Analizuję Twoje błędy gramatyczne, płynność oraz nowe słownictwo, aby przygotować raport z lekcji.
            </p>
          </div>
        </div>
      )}

      {/* Live Settings Modal */}
      {showSettings && (
        <LiveSettingsModal
          currentSettings={{
            mode: chatMode,
            provider: liveProvider,
            voice: liveVoice,
            model: liveModel,
            apiKey: customApiKey,
          }}
          serverConfig={serverConfig}
          onSave={handleSaveSettings}
          onSwitchToClassicAndStart={handleSwitchToClassicAndStart}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Story Preview Modal */}
      {showStoryPreview && selectedStory && (
        <div className="story-preview-modal-overlay animate-fade-in" onClick={() => setShowStoryPreview(false)}>
          <div className="story-preview-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="story-preview-header">
              <div className="story-preview-titles">
                <span className="story-preview-badge">{selectedStory.level || "Czytanka"}</span>
                <h3>{selectedStory.title}</h3>
                {selectedStory.category && <span className="story-preview-category">{selectedStory.category}</span>}
              </div>
              <button
                type="button"
                className="story-preview-close-btn"
                onClick={() => setShowStoryPreview(false)}
                title="Zamknij"
              >
                ✕
              </button>
            </div>
            <div className="story-preview-body">
              {selectedStory.text.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="story-preview-paragraph">{paragraph.trim()}</p>
              ))}
            </div>
            <div className="story-preview-footer">
              <div className="story-exercise-reminder">
                🎯 Wybrany cel rozmowy: <strong>{currentExerciseObj?.name}</strong>
              </div>
              <button
                type="button"
                className="btn-start-from-preview"
                onClick={() => {
                  setShowStoryPreview(false);
                  if (!isChatActive) handleOrbClick();
                }}
              >
                {isChatActive ? "Wróć do rozmowy" : "🚀 Rozpocznij rozmowę z lektorem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Ustawień Live Chat
function LiveSettingsModal({ currentSettings, serverConfig, onSave, onSwitchToClassicAndStart, onClose }) {
  const [mode, setMode] = useState(currentSettings.mode);
  const [provider, setProvider] = useState(currentSettings.provider);
  const [voice, setVoice] = useState(currentSettings.voice);
  const [model, setModel] = useState(currentSettings.model);
  const [apiKey, setApiKey] = useState(currentSettings.apiKey || "");
  const [showKey, setShowKey] = useState(false);

  const handleSaveAndStart = (e) => {
    if (e) e.preventDefault();
    onSave({ mode, provider, voice, model, apiKey: apiKey.trim() }, true);
  };

  const handleSaveOnly = (e) => {
    if (e) e.preventDefault();
    onSave({ mode, provider, voice, model, apiKey: apiKey.trim() }, false);
  };

  const voicesList = serverConfig?.voices || [
    { id: "Puck", name: "Puck (Energetyczny męski)", gender: "male" },
    { id: "Charon", name: "Charon (Głęboki męski)", gender: "male" },
    { id: "Fenrir", name: "Fenrir (Spokojny męski)", gender: "male" },
    { id: "Aoede", name: "Aoede (Ciepły żeński)", gender: "female" },
    { id: "Kore", name: "Kore (Naturalny żeński)", gender: "female" },
  ];

  return (
    <div className="live-settings-modal-overlay">
      <div className="live-settings-modal-card glass-panel animate-zoom">
        <div className="live-settings-modal-header">
          <h3>⚙️ Settings</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Status Pill Badge Moved to Settings */}
        <div className="tutor-badge-container" style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
          {currentSettings.mode === "live" ? (
            <span className="live-technology-badge">
              <span className="badge-pulse-dot"></span>
              ⚡ Gemini Multimodal Live API • {currentSettings.provider === "vertex_ai" ? "Vertex AI (GCP)" : "Google AI Studio"} ({currentSettings.voice})
            </span>
          ) : (
            <span className="classic-technology-badge">
              🎙️ Tryb Klasyczny (Whisper + OpenAI / DeepSeek)
            </span>
          )}
        </div>

        {/* Shortcut to switch to Classic Mode */}
        <div className="modal-classic-shortcut">
          <div className="shortcut-text">
            <strong>💡 Nie masz klucza Gemini API?</strong>
            <p>Możesz od razu rozmawiać w trybie OpenAI / DeepSeek (nie wymaga klucza Gemini).</p>
          </div>
          <button
            type="button"
            className="btn-shortcut-classic"
            onClick={onSwitchToClassicAndStart}
          >
            🚀 Włącz tryb OpenAI
          </button>
        </div>

        <form onSubmit={handleSaveAndStart} className="live-settings-form">
          {/* Wybór Trybu */}
          <div className="settings-field-group">
            <label className="settings-label">Tryb działania:</label>
            <div className="settings-radio-toggle">
              <button
                type="button"
                className={`toggle-option ${mode === "live" ? "active" : ""}`}
                onClick={() => setMode("live")}
              >
                ⚡ Gemini Multimodal Live (Czas rzeczywisty)
              </button>
              <button
                type="button"
                className={`toggle-option ${mode === "classic" ? "active" : ""}`}
                onClick={() => setMode("classic")}
              >
                🎙️ Klasyczny (Whisper + OpenAI / TTS)
              </button>
            </div>
          </div>

          {mode === "live" && (
            <>
              {/* Wybór Dostawcy */}
              <div className="settings-field-group">
                <label className="settings-label">Dostawca technologii Live:</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="settings-select"
                >
                  <option value="google_ai_studio">Google AI Studio (Gemini Developer API)</option>
                  <option value="vertex_ai">Vertex AI (Google Cloud Platform)</option>
                </select>
                <span className="settings-hint">
                  {provider === "google_ai_studio"
                    ? "Domyślna, ultra-szybka opcja z natywnym przesyłem JSON WebSockets."
                    : "Wymaga uwierzytelnienia GCP dla konta chmurowego z usługą Vertex AI."}
                </span>
              </div>

              {/* Wybór Głosu Gemini */}
              <div className="settings-field-group">
                <label className="settings-label">Głos lektora Gemini:</label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="settings-select"
                >
                  {voicesList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wybór Modelu */}
              <div className="settings-field-group">
                <label className="settings-label">Model Gemini Live:</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="settings-select"
                >
                  <option value="gemini-2.5-flash-native-audio-latest">Gemini 2.5 Flash Native Audio (Zalecany - najszybszy)</option>
                  <option value="gemini-3.8-live">Gemini 3.8 Live (Nowa generacja)</option>
                  <option value="gemini-3.1-flash-live-preview">Gemini 3.1 Flash Live</option>
                  <option value="gemini-2.5-flash-native-audio-preview-09-2025">Gemini 2.5 Flash Preview</option>
                </select>
              </div>

              {/* Opcjonalny Własny Klucz Google AI Studio */}
              {provider === "google_ai_studio" && (
                <div className="settings-field-group">
                  <div className="label-with-badge">
                    <label className="settings-label">
                      Klucz API Google AI Studio:
                      {apiKey.trim() ? (
                        <span className="status-badge-ok"> (Wprowadzony)</span>
                      ) : serverConfig?.gemini_api_key_configured ? (
                        <span className="status-badge-ok"> (Skonfigurowany na serwerze)</span>
                      ) : null}
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="api-key-link"
                    >
                      Pobierz bezpłatny klucz ↗
                    </a>
                  </div>
                  <div className="input-with-action">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={serverConfig?.gemini_api_key_configured ? "Używam klucza skonfigurowanego na serwerze (opcjonalnie podaj własny)" : "Wklej swój klucz API z Google AI Studio (AIzaSy...)"}
                      className="settings-input"
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? "Ukryj" : "Pokaż"}
                    </button>
                  </div>
                  <span className="settings-hint">
                    Klucz jest bezpiecznie zapamiętywany w Twojej przeglądarce i przekazywany bezpośrednio do Google.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="live-settings-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Anuluj
            </button>
            <button type="button" className="btn-save-only" onClick={handleSaveOnly}>
              Tylko zapisz
            </button>
            <button type="button" className="btn-primary btn-save-start" onClick={handleSaveAndStart}>
              🟢 Zapisz i Włącz Orb
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Dashboard;
