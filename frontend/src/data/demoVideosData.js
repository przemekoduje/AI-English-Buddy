// Showcase demo videos and pre-baked transcripts/vocabularies for zero-cost onboarding in Start tier
import transcriptsData from "../components/Media/transcripts.json";

export const DEMO_VIDEOS = [
  {
    id: "UF8uR6Z6KLc",
    title: "Steve Jobs – Stanford Commencement Speech (2005)",
    level: "B2",
    category: "Inspiration",
    url: "https://www.youtube.com/watch?v=UF8uR6Z6KLc",
    duration: "14:33",
    description: "One of the most celebrated commencement speeches in history. Jobs shares three pivotal stories from his life about connecting dots, love and loss, and mortality.",
    keyWords: ["commencement", "curiosity", "connecting dots", "intuition", "destination", "relentless", "foolish"]
  },
  {
    id: "DbfejwP1d3c",
    title: "Mark Zuckerberg – The Vision for Meta AI & Holographic Tech",
    level: "B2",
    category: "Tech",
    url: "https://www.youtube.com/watch?v=DbfejwP1d3c",
    duration: "4:15",
    description: "Mark Zuckerberg explains the technological roadmap for generative AI, smart glasses, and multi-modal assistants in daily life.",
    keyWords: ["metaverse", "generative", "holographic", "interface", "computing", "seamless", "breakthrough"]
  },
  {
    id: "james_veitch_spam",
    youtubeId: "_QdPW8JrYzQ",
    title: "James Veitch – This Is What Happens When You Reply to Spam",
    level: "B1",
    category: "Comedy & Storytelling",
    url: "https://www.youtube.com/watch?v=_QdPW8JrYzQ",
    duration: "9:48",
    description: "Hilarious and viral TED talk about turning unsolicited spam emails into a comedic adventure. Perfect for colloquial British expressions.",
    keyWords: ["solicitation", "inbox", "hovering", "humorous", "proposal", "suspicious", "delightful"]
  },
  {
    id: "_U5J8JlJq2Y",
    title: "Buddhist Meditations – Finding Presence in a Chaotic World",
    level: "B1",
    category: "Mindfulness",
    url: "https://www.youtube.com/watch?v=_U5J8JlJq2Y",
    duration: "8:20",
    description: "A calming philosophical conversation exploring breath awareness, cognitive clarity, and letting go of digital distractions.",
    keyWords: ["meditation", "presence", "mindfulness", "tranquility", "distraction", "awareness", "resilience"]
  },
  {
    id: "5MgBikgcWnY",
    title: "How to Build Great Habits & Focus (TED-Ed)",
    level: "B2",
    category: "Self-Growth",
    url: "https://www.youtube.com/watch?v=5MgBikgcWnY",
    duration: "5:12",
    description: "An animated breakdown of the cognitive loop: cue, craving, response, and reward. Practical vocabulary for self-discipline.",
    keyWords: ["habit loop", "dopamine", "reinforcement", "consistency", "trigger", "cognitive", "momentum"]
  }
];

// Curated transcript segments for Steve Jobs speech
const STEVE_JOBS_TRANSCRIPT = [
  { start: 1.15, end: 5.2, text: "I am honored to be with you today at your commencement from one of the finest universities in the world." },
  { start: 5.85, end: 9.9, text: "I never graduated from college. Truth be told, this is the closest I've ever gotten to a college graduation." },
  { start: 11.2, end: 15.5, text: "Today, I want to tell you three stories from my life. That's it. No big deal. Just three stories." },
  { start: 16.8, end: 19.4, text: "The first story is about connecting the dots." },
  { start: 20.1, end: 25.2, text: "I dropped out of Reed College after the first six months, but then stayed around as a drop-in for another eighteen months." },
  { start: 26.5, end: 31.8, text: "So why did I drop out? It started before I was born. My biological mother was a young, unwed graduate student." },
  { start: 32.5, end: 37.2, text: "She decided to put me up for adoption. She felt very strongly that I should be adopted by college graduates." },
  { start: 38.0, end: 43.1, text: "So everything was all set for me to be adopted at birth by a lawyer and his wife." },
  { start: 44.0, end: 49.8, text: "Except that when I popped out, they decided at the last minute that they really wanted a girl." },
  { start: 50.5, end: 56.4, text: "So my parents, who were on a waiting list, got a call in the middle of the night asking: We've got an unexpected baby boy; do you want him?" },
  { start: 57.0, end: 60.2, text: "They said, of course. My biological mother found out later and refused to sign the final papers." },
  { start: 61.0, end: 66.5, text: "She only relented a few months later when my parents promised that I would go to college. This was the start in my life." },
  { start: 67.5, end: 72.8, text: "And seventeen years later, I did go to college. But I naively chose a college that was almost as expensive as Stanford." },
  { start: 73.5, end: 78.4, text: "And all of my working-class parents' savings were being spent on my college tuition." },
  { start: 79.2, end: 84.5, text: "After six months, I couldn't see the value in it. I had no idea what I wanted to do with my life." },
  { start: 85.0, end: 90.5, text: "And no idea how college was going to help me figure it out. And here I was, spending all of the money my parents had saved their entire life." },
  { start: 91.2, end: 96.0, text: "So I decided to drop out, and trust that it would all work out okay. It was pretty scary at the time." },
  { start: 97.0, end: 102.5, text: "Looking back, it was one of the best decisions I ever made." },
  { start: 103.2, end: 109.8, text: "You can't connect the dots looking forward; you can only connect them looking backwards. So you have to trust that the dots will somehow connect in your future." },
  { start: 110.5, end: 116.8, text: "You have to trust in something: your gut, destiny, life, karma, whatever. Because believing that the dots will connect gives you the confidence to follow your heart." }
];

// Curated transcript segments for Mark Zuckerberg speech
const ZUCKERBERG_TRANSCRIPT = [
  { start: 0.8, end: 4.8, text: "The next computing platform is going to be even more immersive and natural than the phones we carry today." },
  { start: 5.2, end: 10.1, text: "When you look at the evolution of modern technology, we went from text on desktop computers to photos and mobile video." },
  { start: 11.0, end: 16.5, text: "The next logical step is holographic presence, where you feel completely in the same physical space with someone else." },
  { start: 17.2, end: 22.8, text: "Generative AI models are changing how we interact with information. Instead of searching through links, the AI summarizes and synthesizes." },
  { start: 23.5, end: 28.9, text: "Imagine wearing lightweight glasses that can see what you see, hear what you hear, and offer intelligent assistance in real time." },
  { start: 29.5, end: 35.2, text: "You could be looking at a foreign language menu, and your glasses instantly translate it into your native language right before your eyes." },
  { start: 36.0, end: 41.5, text: "This isn't science fiction anymore. The foundational AI models and hardware architectures are being built right now." },
  { start: 42.2, end: 47.9, text: "Our goal is to build an open, accessible ecosystem that empowers developers and learners all around the globe." }
];

// Curated transcript for Meditation video
const MEDITATION_TRANSCRIPT = [
  { start: 0.5, end: 5.2, text: "Welcome to this session. Today, we're exploring the timeless art of stillness in an increasingly noisy world." },
  { start: 5.8, end: 11.0, text: "Most of our modern stress does not come from physical danger; it comes from continuous mental overstimulation." },
  { start: 12.0, end: 17.5, text: "Take a deep breath in through your nose, hold it gently for a moment, and exhale slowly through your mouth." },
  { start: 18.2, end: 23.8, text: "Notice the sensation of your feet resting on the ground, grounding your physical presence in this exact moment." },
  { start: 24.5, end: 30.1, text: "Thoughts will inevitably arise. The goal of meditation is not to suppress your thoughts, but to observe them without judgment." },
  { start: 31.0, end: 36.5, text: "Think of your mind as a vast blue sky, and your thoughts as passing clouds. Allow them to float by naturally." },
  { start: 37.2, end: 42.8, text: "When you return your attention to your natural breathing rhythm, you cultivate internal peace and profound clarity." }
];

const HABITS_TRANSCRIPT = [
  { start: 0.5, end: 4.8, text: "Why is it so easy to develop bad habits, and so extraordinarily hard to build good ones?" },
  { start: 5.2, end: 10.4, text: "Every habit follows a simple neurological loop consisting of four core components: cue, craving, response, and reward." },
  { start: 11.0, end: 16.2, text: "The cue triggers your brain to initiate a behavior. It is a bit of information that predicts a reward." },
  { start: 17.0, end: 22.5, text: "Cravings are the motivational force behind every habit. Without some level of motivation, we have no reason to act." },
  { start: 23.2, end: 28.7, text: "The response is the actual habit you perform, which can take the form of an action or a mental pattern." },
  { start: 29.5, end: 35.1, text: "Finally, the reward satisfies our craving and teaches our brain which actions are worth remembering in the future." },
  { start: 35.8, end: 41.5, text: "If you want to master your focus, make good habits obvious, attractive, easy, and satisfying." }
];

export const getDemoVideoTranscript = (videoId) => {
  if (!videoId) return null;
  const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");

  if (cleanId === "UF8uR6Z6KLc") {
    return STEVE_JOBS_TRANSCRIPT;
  }
  if (cleanId === "DbfejwP1d3c") {
    return ZUCKERBERG_TRANSCRIPT;
  }
  if (cleanId === "_U5J8JlJq2Y") {
    return MEDITATION_TRANSCRIPT;
  }
  if (cleanId === "5MgBikgcWnY") {
    return HABITS_TRANSCRIPT;
  }
  if (cleanId === "james_veitch_spam" || cleanId === "_QdPW8JrYzQ") {
    return transcriptsData["james_veitch_spam"] || null;
  }
  if (transcriptsData[cleanId]) {
    return transcriptsData[cleanId];
  }
  return null;
};

export const DEMO_VIDEO_VOCAB = {
  "commencement": { word: "commencement", pl: "uroczystość rozdania dyplomów, rozpoczęcie", phonetic: "/kəˈmensmənt/", pos: "noun", level: "B2", enDef: "a ceremony in which degrees or diplomas are conferred" },
  "dots": { word: "dots", pl: "kropki, punkty (życiowe doświadczenia)", phonetic: "/dɒts/", pos: "noun", level: "A2", enDef: "small round marks or distinct life events" },
  "biological": { word: "biological", pl: "biologiczny", phonetic: "/ˌbaɪəˈlɒdʒɪkl/", pos: "adjective", level: "B1", enDef: "related by blood or genetics" },
  "unwed": { word: "unwed", pl: "niezamężna", phonetic: "/ˌʌnˈwed/", pos: "adjective", level: "B2", enDef: "not married" },
  "adoption": { word: "adoption", pl: "adopcja", phonetic: "/əˈdɒpʃn/", pos: "noun", level: "B1", enDef: "the legal action of taking another's child as one's own" },
  "relented": { word: "relented", pl: "ustąpiła, ugięła się", phonetic: "/rɪˈlentɪd/", pos: "verb", level: "C1", enDef: "finally agreed to something after previously refusing" },
  "tuition": { word: "tuition", pl: "czesne za studia", phonetic: "/tjuˈɪʃn/", pos: "noun", level: "B2", enDef: "a sum of money charged for teaching by a university" },
  "scary": { word: "scary", pl: "przerażający, straszny", phonetic: "/ˈskeəri/", pos: "adjective", level: "A2", enDef: "frightening or causing fear" },
  "karma": { word: "karma", pl: "karma, przeznaczenie", phonetic: "/ˈkɑːmə/", pos: "noun", level: "B1", enDef: "destiny or fate considered as resulting from one's actions" },
  "immersive": { word: "immersive", pl: "pochłaniający, immersyjny", phonetic: "/ɪˈmɜːsɪv/", pos: "adjective", level: "B2", enDef: "providing information or entertainment with full sensory involvement" },
  "synthesizes": { word: "synthesizes", pl: "syntetyzuje, łączy informacje", phonetic: "/ˈsɪnθəsaɪzɪz/", pos: "verb", level: "C1", enDef: "combines a number of things into a coherent whole" },
  "ecosystem": { word: "ecosystem", pl: "ekosystem, środowisko technologiczne", phonetic: "/ˈiːkəʊsɪstəm/", pos: "noun", level: "B2", enDef: "a complex network or interconnected system" },
  "spam": { word: "spam", pl: "niechciane wiadomości e-mail", phonetic: "/spæm/", pos: "noun", level: "A2", enDef: "irrelevant or unsolicited messages sent over the internet" },
  "hovering": { word: "hovering", pl: "wiszący w powietrzu, krążący tuż nad", phonetic: "/ˈhɒvərɪŋ/", pos: "verb", level: "B2", enDef: "remaining in one place in the air" },
  "unsolicited": { word: "unsolicited", pl: "niezamówiony, nieproszony", phonetic: "/ˌʌnsəˈlɪsɪtɪd/", pos: "adjective", level: "C1", enDef: "not asked for; given or done voluntarily" },
  "stillness": { word: "stillness", pl: "cisza, spokój, bezruch", phonetic: "/ˈstɪlnəs/", pos: "noun", level: "B2", enDef: "the absence of movement or sound" },
  "overstimulation": { word: "overstimulation", pl: "przebodźcowanie, nadmierna stymulacja", phonetic: "/ˌəʊvəˌstɪmjuˈleɪʃn/", pos: "noun", level: "C1", enDef: "excessive physical, mental, or sensory stimulation" },
  "grounding": { word: "grounding", pl: "uziemienie, zakotwiczenie w tu i teraz", phonetic: "/ˈɡraʊndɪŋ/", pos: "noun", level: "B2", enDef: "connecting mentally and physically with the present moment" },
  "inevitably": { word: "inevitably", pl: "nieuchronnie, z pewnością", phonetic: "/ɪnˈevɪtəbli/", pos: "adverb", level: "B2", enDef: "as is certain to happen; unavoidably" },
  "suppress": { word: "suppress", pl: "tłumić, powstrzymywać", phonetic: "/səˈpres/", pos: "verb", level: "B2", enDef: "forcibly put an end to or prevent the expression of" },
  "tranquility": { word: "tranquility", pl: "spokój ducha, wyciszenie", phonetic: "/træŋˈkwɪləti/", pos: "noun", level: "C1", enDef: "the quality or state of being calm, peaceful, and quiet" }
};
