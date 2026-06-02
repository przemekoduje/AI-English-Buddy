import React, { useState, useEffect, useCallback } from "react";
import "./SavedStories.css";

const SavedStories = ({ user, onSelectStory }) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

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
      const response = await fetch(`http://127.0.0.1:5001/api/stories/${storyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": user.token
        },
        body: JSON.stringify({ title: editTitle.trim() })
      });

      if (response.ok) {
        setStories(prev => 
          prev.map(s => s.id === storyId ? { ...s, title: editTitle.trim() } : s)
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
      const response = await fetch("http://127.0.0.1:5001/api/stories", {
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
    e.stopPropagation(); // Zapobiegaj wywołaniu kliknięcia w całą kartę
    if (!window.confirm("Czy na pewno chcesz usunąć tę historię?")) return;
    
    try {
      const response = await fetch(`http://127.0.0.1:5001/api/stories/${storyId}`, {
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

  const filteredStories = stories.filter(story => {
    const term = searchTerm.toLowerCase();
    return (
      story.title.toLowerCase().includes(term) ||
      (story.text && story.text.toLowerCase().includes(term))
    );
  });

  return (
    <div className="saved-stories-container">
      <div className="saved-stories-header">
        <div className="header-meta">
          <h2>Saved Stories</h2>
          <p className="subtitle">Manage and read your generated stories</p>
        </div>
        <div className="search-wrapper">
          <input
            type="text"
            className="story-search-input"
            placeholder="Search stories by title or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your story library...</p>
        </div>
      ) : filteredStories.length > 0 ? (
        <div className="stories-grid">
          {filteredStories.map((story) => (
            <div 
              key={story.id} 
              className={`story-card ${editingStoryId === story.id ? 'editing' : ''}`}
              onClick={() => {
                if (editingStoryId !== story.id) {
                  onSelectStory(story.text, story.title, story.id);
                }
              }}
            >
              <div className="story-card-body">
                {editingStoryId === story.id ? (
                  <div className="story-card-title-row editing-row" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      className="edit-title-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTitle(story.id);
                        if (e.key === 'Escape') handleCancelEdit(e);
                      }}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button 
                        className="save-btn" 
                        onClick={() => handleUpdateTitle(story.id)}
                        title="Save title"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>
                      <button 
                        className="cancel-btn" 
                        onClick={(e) => handleCancelEdit(e)}
                        title="Cancel"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="story-card-title-row">
                    <h3 className="story-title">{story.title}</h3>
                    <div className="card-actions-wrapper" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="edit-btn" 
                        onClick={(e) => handleStartEdit(e, story.id, story.title)}
                        title="Edit title"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button 
                        className="delete-btn" 
                        onClick={(e) => handleDeleteStory(e, story.id)}
                        title="Delete story"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                <span className="story-date">
                  {story.timestamp ? new Date(story.timestamp).toLocaleDateString("pl-PL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }) : "Niedawno dodana"}
                </span>
                <p className="story-snippet">
                  {story.text ? `${story.text.substring(0, 180)}...` : ""}
                </p>
              </div>
              <div className="story-card-footer">
                <span className="read-action-text">
                  {editingStoryId === story.id ? "Editing mode" : "Read & Practice →"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-stories-state glass-panel">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3>No stories found</h3>
          <p>
            {searchTerm 
              ? "No stories match your search criteria. Try a different query." 
              : "You haven't generated any stories yet. Head over to the Practice Room to create one!"}
          </p>
        </div>
      )}
    </div>
  );
};

export default SavedStories;
