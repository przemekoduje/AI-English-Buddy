import React, { useState, useEffect, useRef } from "react";
import "./NotebookSidebar.css";

const NotebookSidebar = ({
  notebookWords,
  onSpeakWord,
  onDeleteWord,
  onOpenEmailModal,
  onOpenFlashcards,
  onExplainWord,
  activityLog = [],
  onOpenSummary,
}) => {
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !e.target.closest(".menu-trigger-btn")
      ) {
        setActiveMenuIndex(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

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
          <button 
            className="action-icon-btn summary" 
            onClick={onOpenSummary}
            title="AI Session Summary"
            disabled={activityLog.length === 0}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
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
                    className="menu-trigger-btn"
                    onClick={() => setActiveMenuIndex(activeMenuIndex === index ? null : index)}
                    title="Options"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>

                  {activeMenuIndex === index && (
                    <div className="card-dropdown-menu" ref={dropdownRef}>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          onSpeakWord(entry.original);
                          setActiveMenuIndex(null);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-icon">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        Listen
                      </button>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          onExplainWord(entry.original);
                          setActiveMenuIndex(null);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-icon">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        Explain
                      </button>
                      <button
                        className="dropdown-item delete"
                        onClick={() => {
                          onDeleteWord(entry.original);
                          setActiveMenuIndex(null);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-icon">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
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
