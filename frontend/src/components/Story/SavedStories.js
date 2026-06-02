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
          <h2>📚 Saved Stories</h2>
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
          <span className="search-icon">🔍</span>
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
                        💾
                      </button>
                      <button 
                        className="cancel-btn" 
                        onClick={(e) => handleCancelEdit(e)}
                        title="Cancel"
                      >
                        ❌
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
                        ✏️
                      </button>
                      <button 
                        className="delete-btn" 
                        onClick={(e) => handleDeleteStory(e, story.id)}
                        title="Delete story"
                      >
                        🗑️
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
          <div className="empty-icon">📖</div>
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
