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
        <h2>Vocabulary</h2>
        <div className="header-actions">
          <button 
            className="action-icon-btn" 
            onClick={onOpenEmailModal}
            title="Export to Email"
            disabled={notebookWords.length === 0}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </button>
          <button 
            className="action-icon-btn practice" 
            onClick={onOpenFlashcards}
            title="Practice Flashcards"
            disabled={notebookWords.length === 0}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
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
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  </button>
                  <button
                    className="delete-word-btn"
                    onClick={() => onDeleteWord(entry.original)}
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <p>Your notebook is empty.</p>
            <p className="hint">Highlight text in the story to add phrases here.</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NotebookSidebar;
