import React from "react";
import "./NotebookSidebar.css";

const NotebookSidebar = ({
  notebookWords,
  onSpeakWord,
  onDeleteWord,
  onOpenEmailModal,
  onOpenFlashcards,
}) => {
  return (
    <aside className="notebook-sidebar">
      <div className="sidebar-header">
        <h2>📝 Vocabulary</h2>
        <div className="header-actions">
          <button 
            className="action-icon-btn" 
            onClick={onOpenEmailModal}
            title="Export to Email"
            disabled={notebookWords.length === 0}
          >
            ✉️
          </button>
          <button 
            className="action-icon-btn practice" 
            onClick={onOpenFlashcards}
            title="Practice Flashcards"
            disabled={notebookWords.length === 0}
          >
            🗂️
          </button>
        </div>
      </div>

      <div className="word-count">
        {notebookWords.length} phrase{notebookWords.length === 1 ? "" : "s"} collected
      </div>

      <div className="notebook-scroll-area">
        {notebookWords.length > 0 ? (
          <ul className="notebook-list">
            {notebookWords.map((entry, index) => (
              <li key={index} className="notebook-card">
                <div className="word-content">
                  <span className="original-word">{entry.original}</span>
                  <span className="translated-word">{entry.translated}</span>
                </div>
                <div className="card-actions">
                  <button
                    className="pronounce-btn"
                    onClick={() => onSpeakWord(entry.original)}
                    title="Listen"
                  >
                    🔊
                  </button>
                  <button
                    className="delete-word-btn"
                    onClick={() => onDeleteWord(entry.original)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <p>Your notebook is empty.</p>
            <p className="hint">Highlight text in the story to add phrases here.</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NotebookSidebar;
