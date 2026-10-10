import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE_URL } from '../../config';
import "./SavedStories.css";

// Curated stock photos for aesthetic story covers
const CATEGORY_IMAGES = {
  business: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80",
  travel: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=600&q=80",
  "daily life": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80",
  tech: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
  food: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
  culture: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80",
  general: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80"
};

const DEFAULT_COVER_IMAGES = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80"
];

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
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      const saved = localStorage.getItem("buddy_bookmarked_stories");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

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

  // Helper calculations per story
  const enrichedStories = useMemo(() => {
    return stories
      .filter(s => !s.parent_id)
      .map((story, index) => {
        const words = story.text ? story.text.split(/\s+/).filter(Boolean).length : 0;
        const readTimeMin = Math.max(1, Math.ceil(words / 130));
        
        // Calculate or retrieve progress (mock/saved)
        let progress = story.read_progress || story.progress;
        if (progress === undefined) {
          // Stable fallback progress calculation based on story ID
          const hash = String(story.id || index).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const progressOptions = [0, 15, 30, 65, 100];
          progress = progressOptions[hash % progressOptions.length];
        }

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

        // Cover image
        const catKey = category.toLowerCase();
        const coverImage = CATEGORY_IMAGES[catKey] || DEFAULT_COVER_IMAGES[index % DEFAULT_COVER_IMAGES.length];
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
                <img src={story.coverImage} alt={story.title} className="card-cover-img" />
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
                  <span className={`progress-status-badge ${story.progress === 100 ? "completed" : ""}`}>
                    {story.progress === 100 ? "Completed" : story.progress > 0 ? `${story.progress}% read` : "0% read"}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="card-progress-track">
                  <div
                    className={`card-progress-bar ${story.progress === 100 ? "completed" : ""}`}
                    style={{ width: `${Math.max(4, story.progress)}%` }}
                  ></div>
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
