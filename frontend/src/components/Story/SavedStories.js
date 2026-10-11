import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL } from '../../config';
import "./SavedStories.css";

// Bogata baza tematycznych zdjęć wysokiej rozdzielczości z wieloma wariantami dla każdego motywu
const THEMATIC_SCENES = [
  {
    keywords: ["coffee", "kawa", "cafe", "espresso", "latte", "cappuccino", "breakfast", "morning", "poranek"],
    images: [
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "cozy coffee shop with steaming cappuccino"
  },
  {
    keywords: ["kraków", "krakow", "cracow", "wawel", "rynek", "sukiennice", "poland", "polska"],
    images: [
      "https://images.unsplash.com/photo-1519197924294-4ba991a11128?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "historic Krakow Old Town marketplace with historic buildings"
  },
  {
    keywords: ["airport", "flight", "plane", "travel", "journey", "vacation", "holiday", "luggage", "passport", "lotnisko", "podróż", "samolot"],
    images: [
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "modern international airport terminal and runway airplane"
  },
  {
    keywords: ["london", "londyn", "england", "uk", "british", "big ben", "thames"],
    images: [
      "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "atmospheric London street with classic red telephone booth"
  },
  {
    keywords: ["new york", "nyc", "manhattan", "broadway", "central park", "america"],
    images: [
      "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "lively New York City Manhattan street with yellow cabs"
  },
  {
    keywords: ["interview", "job", "career", "office", "meeting", "resume", "boss", "colleague", "work", "biuro", "praca", "rekrutacja", "korporacja"],
    images: [
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "professional job interview in a sleek modern sunny office"
  },
  {
    keywords: ["business", "finance", "money", "deal", "startup", "invest", "stock", "biznes", "finanse"],
    images: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "sleek modern financial skyscraper architecture"
  },
  {
    keywords: ["tech", "ai", "artificial intelligence", "coding", "code", "programming", "software", "computer", "developer", "robot", "cyber"],
    images: [
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "software engineer programmer desk with modern monitors"
  },
  {
    keywords: ["space", "mars", "moon", "star", "galaxy", "planet", "astronaut", "rocket", "universe", "kosmos"],
    images: [
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "astronaut exploring glowing red planet in deep space"
  },
  {
    keywords: ["forest", "woods", "tree", "mountain", "hiking", "hike", "nature", "fog", "las", "góry", "szlak"],
    images: [
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "mystical green misty pine forest and mountain hiking trail"
  },
  {
    keywords: ["sea", "ocean", "beach", "coast", "island", "summer", "waves", "morze", "plaża", "ocean", "wakacje"],
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "golden sand beach with turquoise ocean waves and gentle sunshine"
  },
  {
    keywords: ["food", "restaurant", "chef", "cooking", "kitchen", "dinner", "lunch", "meal", "pizza", "pasta", "recipe", "jedzenie", "restauracja", "obiad"],
    images: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "delicious gourmet meal in cozy warm ambient restaurant"
  },
  {
    keywords: ["book", "library", "bookstore", "reading", "study", "writer", "novel", "książka", "biblioteka", "czytanie"],
    images: [
      "https://images.unsplash.com/photo-1507842229458-577749e472c3?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "warm vintage wooden library with endless rows of classic books"
  },
  {
    keywords: ["mystery", "detective", "crime", "investigation", "shadow", "night", "dark", "secret", "tajemnica", "deszcz", "rain", "rainy"],
    images: [
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "cinematic detective mystery scene in rainy night street"
  },
  {
    keywords: ["music", "concert", "guitar", "jazz", "piano", "song", "band", "muzyka", "gitara"],
    images: [
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "acoustic guitar player in warm atmospheric musical stage"
  },
  {
    keywords: ["dog", "puppy", "cat", "pet", "animal", "walk", "pies", "kot", "zwierzę"],
    images: [
      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "happy loyal golden retriever dog running in green park"
  },
  {
    keywords: ["health", "fitness", "gym", "run", "running", "doctor", "hospital", "sport", "bieganie", "zdrowie", "lekarz"],
    images: [
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "energetic morning runner in sunny urban outdoor park"
  },
  {
    keywords: ["art", "museum", "gallery", "painting", "artist", "exhibition", "sztuka", "obraz"],
    images: [
      "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "fine art paintings in elegant spacious museum gallery"
  },
  {
    keywords: ["school", "university", "college", "exam", "test", "student", "teacher", "nauka", "szkoła", "egzamin"],
    images: [
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "university campus students collaborating with notebooks"
  },
  {
    keywords: ["winter", "snow", "cold", "christmas", "ice", "zima", "śnieg"],
    images: [
      "https://images.unsplash.com/photo-1517299321929-30a7063a34db?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "peaceful snowy winter mountain landscape with pine trees"
  },
  {
    keywords: ["car", "drive", "driving", "road", "roadtrip", "highway", "samochód", "droga", "auto"],
    images: [
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "scenic highway road trip through breathtaking panoramic landscape"
  },
  {
    keywords: ["train", "railway", "station", "subway", "metro", "pociąg", "stacja"],
    images: [
      "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1515165562839-978bbcf18277?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "classic railway station platform with train arriving"
  },
  {
    keywords: ["friend", "friends", "party", "laugh", "talk", "conversation", "przyjaciele", "spotkanie"],
    images: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80"
    ],
    theme: "cheerful group of close friends laughing together outdoors"
  }
];

// Dopasowanie najlepszej grupy scenariuszy na podstawie tytułu i tekstu
const findMatchingScene = (title = "", text = "") => {
  const combined = `${title || ""} ${text || ""}`.toLowerCase();
  let bestMatch = null;
  let maxScore = 0;

  for (const scene of THEMATIC_SCENES) {
    let score = 0;
    const tLower = (title || "").toLowerCase();
    for (const kw of scene.keywords) {
      if (tLower.includes(kw)) score += 4;
      if (combined.includes(kw)) score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = scene;
    }
  }

  return bestMatch || THEMATIC_SCENES[0];
};

// Zwraca deterministyczne zdjęcie z pasującego scenariusza
const findBestMatchingSceneImage = (title = "", text = "", seed = 0) => {
  const scene = findMatchingScene(title, text);
  const images = scene.images;
  const hash = Math.abs(String(title || seed).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + Number(seed || 0));
  return images[hash % images.length];
};

// Pobiera następne zdjęcie w rotacji tego samego motywu (gwarancja nowej, innej ilustracji!)
const getNextSceneImage = (title = "", text = "", currentUrl = "") => {
  const scene = findMatchingScene(title, text);
  const images = scene.images;
  const currIdx = images.indexOf(currentUrl);
  if (currIdx === -1) {
    return images[1 % images.length];
  }
  return images[(currIdx + 1) % images.length];
};

// Generowanie angielskiego promptu wizualnego odzwierciedlającego fabułę
const buildEnglishImagePrompt = (title = "", text = "") => {
  const scene = findMatchingScene(title, text);
  const cleanTitle = (title || "").replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const themePart = scene.theme || cleanTitle;
  return `${themePart}, cinematic photography, photorealistic, 4k detailed, storytelling art, natural soft lighting`;
};

const SavedStories = ({ user, onSelectStory, onStartLiveChat, onCreateStory }) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'in_progress' | 'completed' | 'bookmarked'
  const [levelFilter, setLevelFilter] = useState("all");
  const [sortOption, setSortOption] = useState("recent"); // 'recent' | 'oldest' | 'title'
  const [error, setError] = useState("");
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [selectedPromptStory, setSelectedPromptStory] = useState(null);
  const [regeneratingImageIds, setRegeneratingImageIds] = useState(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      const saved = localStorage.getItem("buddy_bookmarked_stories");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Regenerate / rotate image tailored to story text (100% reliable)
  const handleRegenerateStoryImage = async (e, story) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!story || !story.id) return;

    // Natychmiast aktywuj stan ładowania na danej karcie
    setRegeneratingImageIds(prev => new Set(prev).add(story.id));

    const applyImage = (finalUrl) => {
      setStories(prev =>
        prev.map(s => (s.id === story.id ? { ...s, image_url: finalUrl, cover_image: finalUrl, coverImage: finalUrl } : s))
      );
      try {
        localStorage.setItem(`buddy_story_image_${story.id}`, finalUrl);
        fetch(`${API_BASE_URL}/api/stories/${story.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Token": user?.token || ""
          },
          body: JSON.stringify({ image_url: finalUrl })
        }).catch(() => {});
      } catch (err) {}

      setRegeneratingImageIds(prev => {
        const next = new Set(prev);
        next.delete(story.id);
        return next;
      });
    };

    // Oblicz natychmiastowe alternatywne zdjęcie z motywu
    const nextThematicPhoto = getNextSceneImage(story.title, story.text, story.coverImage);

    // Próba pobrania i skonwertowania obrazu AI do lokalnego Data URL
    try {
      const prompt = buildEnglishImagePrompt(story.title, story.text);
      const newSeed = Math.floor(Math.random() * 900000) + 1000;
      const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=400&seed=${newSeed}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(aiUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (resp.ok) {
        const blob = await resp.blob();
        if (blob && blob.size > 2000) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            applyImage(dataUrl);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    } catch (err) {
      console.warn("AI generation network timeout/blocked, switching to next thematic photo:", err);
    }

    // Jeśli zapytanie AI napotkało błąd lub limit, aplikujemy nowe zdjęcie z motywu
    applyImage(nextThematicPhoto);
  };

  // Toggle bookmark for a story
  const toggleBookmark = (e, storyId) => {
    e.stopPropagation();
    setBookmarkedIds(prev => {
      const updated = prev.includes(storyId)
        ? prev.filter(id => id !== storyId)
        : [...prev, storyId];
      try {
        localStorage.setItem("buddy_bookmarked_stories", JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };

  const handleStartEdit = (e, storyId, currentTitle) => {
    e.stopPropagation();
    setEditingStoryId(storyId);
    setEditTitle(currentTitle);
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingStoryId(null);
    setEditTitle("");
  };

  const handleUpdateTitle = async (storyId) => {
    if (!editTitle.trim()) {
      alert("Tytuł nie może być pusty.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ title: editTitle.trim() })
      });

      if (response.ok) {
        setStories(prev =>
          prev.map(s => (s.id === storyId ? { ...s, title: editTitle.trim() } : s))
        );
        setEditingStoryId(null);
        setEditTitle("");
      } else {
        const errData = await response.json();
        alert(errData.error || "Błąd podczas aktualizowania tytułu.");
      }
    } catch (err) {
      console.error("Błąd podczas aktualizowania tytułu:", err);
      alert("Błąd połączenia podczas aktualizowania tytułu.");
    }
  };

  const loadStories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/stories`, {
        headers: { "X-Session-Token": user.token }
      });
      if (response.ok) {
        const data = await response.json();
        setStories(data);
      } else {
        setError("Nie udało się pobrać zapisanych historii.");
      }
    } catch (err) {
      console.error("Błąd podczas wczytywania historii:", err);
      setError("Nie udało się połączyć z serwerem.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const handleDeleteStory = async (e, storyId) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć tę historię?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
        method: "DELETE",
        headers: { "X-Session-Token": user.token }
      });
      if (response.ok) {
        setStories(prev => prev.filter(s => s.id !== storyId));
      } else {
        alert("Błąd podczas usuwania historii.");
      }
    } catch (err) {
      console.error("Błąd podczas usuwania:", err);
      alert("Błąd połączenia podczas usuwania.");
    }
  };

  // Update reading progress
  const handleUpdateProgress = async (e, storyId, newProgress) => {
    if (e) e.stopPropagation();
    const clamped = Math.max(0, Math.min(100, Math.round(newProgress)));

    // Optimistic UI update
    setStories(prev =>
      prev.map(s => (s.id === storyId ? { ...s, read_progress: clamped, progress: clamped } : s))
    );

    try {
      localStorage.setItem(`buddy_story_progress_${storyId}`, clamped);
      if (clamped === 0) {
        localStorage.removeItem(`buddy_story_read_sentences_${storyId}`);
      }
    } catch (err) {}

    try {
      await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user?.token || ""
        },
        body: JSON.stringify({ read_progress: clamped })
      });
    } catch (err) {
      console.error("Błąd podczas aktualizowania postępu:", err);
    }
  };

  // Helper calculations per story
  const enrichedStories = useMemo(() => {
    return stories
      .filter(s => !s.parent_id)
      .map((story, index) => {
        const words = story.text ? story.text.split(/\s+/).filter(Boolean).length : 0;
        const readTimeMin = Math.max(1, Math.ceil(words / 130));
        
        // Retrieve real progress (backend or local cache fallback)
        let rawProgress = story.read_progress !== undefined ? story.read_progress : story.progress;
        if (rawProgress === undefined || rawProgress === null) {
          try {
            const cached = localStorage.getItem(`buddy_story_progress_${story.id}`);
            if (cached !== null) {
              rawProgress = parseInt(cached, 10);
            }
          } catch (e) {}
        }
        const progress = Math.max(0, Math.min(100, typeof rawProgress === 'number' && !isNaN(rawProgress) ? Math.round(rawProgress) : 0));

        // Determine level
        const level = story.level || story.cefr_level || (index % 4 === 0 ? "B2" : index % 4 === 1 ? "B1" : index % 4 === 2 ? "A2" : "C1");

        // Determine category
        let category = "General";
        if (story.topics && story.topics.length > 0) {
          category = story.topics[0];
        } else if (story.title) {
          const t = story.title.toLowerCase();
          if (t.includes("business") || t.includes("team") || t.includes("office") || t.includes("work")) category = "Business";
          else if (t.includes("kraków") || t.includes("trip") || t.includes("travel") || t.includes("scenic")) category = "Travel";
          else if (t.includes("coffee") || t.includes("day") || t.includes("routine") || t.includes("life")) category = "Daily Life";
          else if (t.includes("tech") || t.includes("smart") || t.includes("invention") || t.includes("future")) category = "Tech";
          else if (t.includes("market") || t.includes("food") || t.includes("recipe")) category = "Food & Market";
        }

        // Dopasowane zdjęcie odzwierciedlające treść opowiadania
        let coverImage = story.image_url || story.cover_image;
        if (!coverImage) {
          try {
            const cachedImg = localStorage.getItem(`buddy_story_image_${story.id}`);
            if (cachedImg) coverImage = cachedImg;
          } catch (e) {}
        }
        if (!coverImage) {
          coverImage = findBestMatchingSceneImage(story.title, story.text, index);
        }
        const isBookmarked = bookmarkedIds.includes(story.id);

        return {
          ...story,
          words,
          readTimeMin,
          progress,
          level,
          category,
          coverImage,
          isBookmarked
        };
      });
  }, [stories, bookmarkedIds]);

  // Counts for status pills
  const counts = useMemo(() => {
    const total = enrichedStories.length;
    const inProgress = enrichedStories.filter(s => s.progress > 0 && s.progress < 100).length;
    const completed = enrichedStories.filter(s => s.progress === 100).length;
    const bookmarked = enrichedStories.filter(s => s.isBookmarked).length;
    return { total, inProgress, completed, bookmarked };
  }, [enrichedStories]);

  // Filter and sort stories
  const filteredStories = useMemo(() => {
    return enrichedStories.filter(story => {
      // Search filter
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        story.title.toLowerCase().includes(term) ||
        (story.text && story.text.toLowerCase().includes(term)) ||
        story.category.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === "in_progress" && (story.progress === 0 || story.progress === 100)) return false;
      if (statusFilter === "completed" && story.progress < 100) return false;
      if (statusFilter === "bookmarked" && !story.isBookmarked) return false;

      // Level filter
      if (levelFilter !== "all" && story.level.toLowerCase() !== levelFilter.toLowerCase()) return false;

      return true;
    }).sort((a, b) => {
      if (sortOption === "recent") {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      }
      if (sortOption === "oldest") {
        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
      }
      if (sortOption === "title") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [enrichedStories, searchTerm, statusFilter, levelFilter, sortOption]);

  return (
    <div className="saved-stories-wrapper">
      {/* Header Section */}
      <header className="saved-stories-hero">
        <div className="hero-text-block">
          <h1 className="hero-title">Good stories. Better English.</h1>
          <p className="hero-subtitle">Your personal reading shelf — ready whenever you are.</p>
        </div>
        <button
          type="button"
          className="create-story-btn"
          onClick={() => {
            if (onCreateStory) onCreateStory();
            else if (onSelectStory) onSelectStory("", "", null);
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Create a story</span>
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className="stories-controls-bar">
        {/* Search Input */}
        <div className="stories-search-box">
          <span className="search-icon-svg">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            className="stories-search-input"
            placeholder="Search your stories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm("")}>×</button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="filter-pills-group">
          <button
            className={`filter-pill ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All stories · {counts.total}
          </button>
          <button
            className={`filter-pill ${statusFilter === "in_progress" ? "active" : ""}`}
            onClick={() => setStatusFilter("in_progress")}
          >
            In progress · {counts.inProgress}
          </button>
          <button
            className={`filter-pill ${statusFilter === "completed" ? "active" : ""}`}
            onClick={() => setStatusFilter("completed")}
          >
            Completed · {counts.completed}
          </button>
          {counts.bookmarked > 0 && (
            <button
              className={`filter-pill ${statusFilter === "bookmarked" ? "active" : ""}`}
              onClick={() => setStatusFilter("bookmarked")}
            >
              Bookmarked · {counts.bookmarked}
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="dropdowns-group">
          <div className="custom-select-wrapper">
            <select
              className="stories-select"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="all">Level: All</option>
              <option value="A1">Level: A1</option>
              <option value="A2">Level: A2</option>
              <option value="B1">Level: B1</option>
              <option value="B2">Level: B2</option>
              <option value="C1">Level: C1</option>
              <option value="C2">Level: C2</option>
            </select>
          </div>

          <div className="custom-select-wrapper">
            <select
              className="stories-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="recent">Recent first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="stories-error-banner">{error}</div>}

      {/* Main Grid */}
      {loading ? (
        <div className="stories-loading-box">
          <div className="stories-spinner"></div>
          <p>Loading your personal reading shelf...</p>
        </div>
      ) : filteredStories.length > 0 ? (
        <div className="stories-card-grid">
          {filteredStories.map((story) => (
            <div
              key={story.id}
              className={`story-figma-card ${editingStoryId === story.id ? "editing" : ""}`}
              onClick={() => {
                if (editingStoryId !== story.id) {
                  onSelectStory(story.text, story.title, story.id);
                }
              }}
            >
              {/* Cover Image */}
              <div className="card-cover-wrapper">
                <img
                  src={story.coverImage}
                  alt={story.title}
                  className="card-cover-img"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getNextSceneImage(story.title, story.text, story.coverImage);
                  }}
                />

                {regeneratingImageIds.has(story.id) && (
                  <div className="card-generating-overlay">
                    <div className="btn-spinner-micro pulse-spinner" />
                    <span>AI tworzy nowe zdjęcie...</span>
                  </div>
                )}

                <button
                  type="button"
                  className="card-refresh-image-btn"
                  onClick={(e) => handleRegenerateStoryImage(e, story)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  title="Wygeneruj lub odnajdź nowe zdjęcie dopasowane do opowiadania"
                  disabled={regeneratingImageIds.has(story.id)}
                >
                  {regeneratingImageIds.has(story.id) ? (
                    <div className="btn-spinner-micro" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                  )}
                  <span>{regeneratingImageIds.has(story.id) ? "Tworzę..." : "Nowe zdjęcie AI"}</span>
                </button>
              </div>

              {/* Card Body */}
              <div className="card-content-body">
                {/* Meta Header Row */}
                <div className="card-meta-row">
                  <span className={`level-badge level-${story.level.toLowerCase()}`}>
                    {story.level}
                  </span>
                  <span className="category-label">{story.category}</span>

                  <div className="card-top-actions" onClick={(e) => e.stopPropagation()}>
                    {/* Bookmark Button */}
                    <button
                      className={`icon-action-btn bookmark-btn ${story.isBookmarked ? "active" : ""}`}
                      onClick={(e) => toggleBookmark(e, story.id)}
                      title={story.isBookmarked ? "Remove bookmark" : "Bookmark story"}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill={story.isBookmarked ? "#0284c7" : "none"} stroke={story.isBookmarked ? "#0284c7" : "currentColor"} strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>

                    {/* Regenerate AI Image */}
                    <button
                      className="icon-action-btn"
                      onClick={(e) => handleRegenerateStoryImage(e, story)}
                      title="Wygeneruj nowe zdjęcie AI dla tego opowiadania"
                      disabled={regeneratingImageIds.has(story.id)}
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </button>

                    {/* Prompt Info */}
                    <button
                      className="icon-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPromptStory(story);
                      }}
                      title="Exact Prompt Details"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>

                    {/* Edit Title */}
                    <button
                      className="icon-action-btn"
                      onClick={(e) => handleStartEdit(e, story.id, story.title)}
                      title="Edit title"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      className="icon-action-btn delete-btn"
                      onClick={(e) => handleDeleteStory(e, story.id)}
                      title="Delete story"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Title or Inline Edit Input */}
                {editingStoryId === story.id ? (
                  <div className="inline-title-edit-box" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      className="inline-edit-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateTitle(story.id);
                        if (e.key === "Escape") handleCancelEdit(e);
                      }}
                      autoFocus
                    />
                    <div className="inline-edit-buttons">
                      <button className="edit-confirm-btn" onClick={() => handleUpdateTitle(story.id)}>Save</button>
                      <button className="edit-cancel-btn" onClick={(e) => handleCancelEdit(e)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <h3 className="card-story-title">{story.title}</h3>
                )}

                {/* Excerpt Snippet */}
                <p className="card-story-snippet">
                  {story.text ? `${story.text.substring(0, 110).trim()}...` : ""}
                </p>

                {/* Stats & Reading Progress Row */}
                <div className="card-stats-row">
                  <span className="stats-text">
                    {story.words} words · {story.readTimeMin} min
                  </span>
                  <div className="card-progress-right-side" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`quick-toggle-status-btn ${story.progress === 100 ? "completed" : ""}`}
                      onClick={(e) => handleUpdateProgress(e, story.id, story.progress === 100 ? 0 : 100)}
                      title={story.progress === 100 ? "Resetuj do 0%" : "Oznacz jako przeczytane (100%)"}
                    >
                      {story.progress === 100 ? "✓ Przeczytane" : "Oznacz"}
                    </button>
                    <span className={`progress-status-badge ${story.progress === 100 ? "completed" : ""}`}>
                      {story.progress === 100 ? "Completed" : `${story.progress}% read`}
                    </span>
                  </div>
                </div>

                {/* Interactive Progress Slider / Track */}
                <div
                  className="card-progress-track interactive"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                    const targetProgress = Math.round(ratio * 100);
                    handleUpdateProgress(e, story.id, targetProgress);
                  }}
                  title={`Postęp: ${story.progress}% (kliknij, aby zmienić)`}
                >
                  <div
                    className={`card-progress-bar ${story.progress === 100 ? "completed" : ""}`}
                    style={{ width: `${Math.max(story.progress > 0 ? 4 : 0, story.progress)}%` }}
                  >
                    <div className="card-progress-thumb" />
                  </div>
                </div>

                {/* Action Buttons Stack */}
                <div className="card-action-stack" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-read-now"
                    onClick={() => onSelectStory(story.text, story.title, story.id)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                    <span>Read Now</span>
                  </button>

                  <button
                    type="button"
                    className="btn-voice-practice"
                    onClick={() => {
                      if (onStartLiveChat) onStartLiveChat(story.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    <span>Practice with Voice AI</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-stories-box">
          <div className="empty-icon-circle">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3>No stories found</h3>
          <p>
            {searchTerm || statusFilter !== "all" || levelFilter !== "all"
              ? "No stories match your active filters. Try resetting search or filter criteria."
              : "Your reading shelf is empty. Create your first English story to get started!"}
          </p>
          {onCreateStory && (
            <button className="empty-create-btn" onClick={onCreateStory}>
              Create a story
            </button>
          )}
        </div>
      )}

      {/* Footer Info Note */}
      <footer className="stories-shelf-footer">
        Showing {filteredStories.length} {filteredStories.length === 1 ? "story" : "stories"} · Your reading progress is saved for your next visit.
      </footer>

      {/* Floating Chat Live FAB */}
      {onStartLiveChat && (
        <div className="floating-chat-fab-wrapper">
          <button
            type="button"
            className="floating-chat-fab"
            onClick={() => onStartLiveChat(null)}
            title="Start Live Voice Practice"
          >
            <div className="fab-sound-bars">
              <span className="fab-bar bar-1"></span>
              <span className="fab-bar bar-2"></span>
              <span className="fab-bar bar-3"></span>
            </div>
            <span>Chat Live</span>
          </button>
        </div>
      )}

      {/* Modal for Prompt Details */}
      {selectedPromptStory && (
        <div className="story-modal-backdrop" onClick={() => setSelectedPromptStory(null)}>
          <div className="story-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>Exact Story Metadata</h3>
              <button className="modal-close-x" onClick={() => setSelectedPromptStory(null)}>×</button>
            </div>
            <div className="modal-body-content">
              {selectedPromptStory.topics && selectedPromptStory.topics.length > 0 && (
                <div className="prompt-meta-field">
                  <span className="meta-label">Selected Topics:</span>
                  <div className="meta-tags-list">
                    {selectedPromptStory.topics.map((t, idx) => (
                      <span key={idx} className="meta-topic-tag">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedPromptStory.custom_details ? (
                <div className="prompt-meta-field">
                  <span className="meta-label">Custom Instructions:</span>
                  <pre className="meta-pre-text">{selectedPromptStory.custom_details}</pre>
                </div>
              ) : (
                (!selectedPromptStory.topics || selectedPromptStory.topics.length === 0) && (
                  <p className="no-meta-text">This story was added manually or has no detailed prompt metadata.</p>
                )
              )}
            </div>
            <div className="modal-footer-actions">
              <button className="modal-close-btn" onClick={() => setSelectedPromptStory(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedStories;
