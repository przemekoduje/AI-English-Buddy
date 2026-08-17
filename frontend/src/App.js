import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import SavedStories from './components/Story/SavedStories';
import Auth from './components/Auth/Auth';
import VocabularyView from './components/Vocabulary/VocabularyView';
import VocabularyDrawer from './components/Vocabulary/VocabularyDrawer';
import MediaBuddy from './components/Media/MediaBuddy';
import Flashcards from './components/Flashcards';
import { API_BASE_URL } from './config';
import AdminDashboard from './components/Admin/AdminDashboard';

function App() {
  const [currentView, setCurrentView] = useState(() => {
    const savedView = localStorage.getItem("buddy_current_view");
    if (savedView) return savedView;
    return window.innerWidth <= 768 ? 'dashboard' : 'workspace';
  });
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("buddy_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user && user.token) {
      fetch(`${API_BASE_URL}/api/admin/verify`, {
        headers: { "X-Session-Token": user.token }
      })
      .then(res => {
        if (res.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  const [generatedText, setGeneratedText] = useState(() => {
    return localStorage.getItem("buddy_generated_text") || "";
  });
  const [currentStoryTitle, setCurrentStoryTitle] = useState(() => {
    return localStorage.getItem("buddy_current_story_title") || "";
  });
  const [currentStoryId, setCurrentStoryId] = useState(() => {
    const id = localStorage.getItem("buddy_current_story_id");
    return id ? JSON.parse(id) : null;
  });

  useEffect(() => {
    localStorage.setItem("buddy_generated_text", generatedText);
  }, [generatedText]);

  useEffect(() => {
    localStorage.setItem("buddy_current_story_title", currentStoryTitle);
  }, [currentStoryTitle]);

  useEffect(() => {
    if (currentStoryId !== null) {
      localStorage.setItem("buddy_current_story_id", JSON.stringify(currentStoryId));
    } else {
      localStorage.removeItem("buddy_current_story_id");
    }
  }, [currentStoryId]);

  const [externalFlashcardsWords, setExternalFlashcardsWords] = useState([]);

  const [customAlert, setCustomAlert] = useState(null);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setCustomAlert(message);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playFlashcards = params.get('play_flashcards') === 'true';
    const wordsB64 = params.get('words');
    if (playFlashcards && wordsB64) {
      try {
        const decoded = decodeURIComponent(escape(window.atob(wordsB64)));
        const parsedWords = JSON.parse(decoded);
        if (Array.isArray(parsedWords) && parsedWords.length > 0) {
          setExternalFlashcardsWords(parsedWords);
        }
      } catch (e) {
        console.error("Failed to parse external flashcards words from URL:", e);
      }
      
      // Clean query parameters from URL without reloading
      const url = new URL(window.location);
      url.searchParams.delete('play_flashcards');
      url.searchParams.delete('words');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    localStorage.setItem("buddy_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = async () => {
    if (user && user.token) {
      try {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: "POST",
          headers: { "X-Session-Token": user.token }
        });
      } catch (e) {
        console.error("Błąd API wylogowania:", e);
      }
    }
    localStorage.removeItem("buddy_user");
    localStorage.removeItem("buddy_current_view");
    localStorage.removeItem("buddy_generated_text");
    localStorage.removeItem("buddy_current_story_title");
    localStorage.removeItem("buddy_current_story_id");
    setUser(null);
    setGeneratedText("");
    setCurrentStoryTitle("");
    setCurrentStoryId(null);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    localStorage.setItem("buddy_current_view", view);
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Chat Live';
      case 'workspace': return 'Practice Room';
      case 'stories': return 'Saved Stories';
      case 'notebook': return 'My Vocabulary';
      case 'media': return 'Media Buddy';
      case 'admin': return 'Panel Administratora';
      default: return 'Speakling';
    }
  };

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App mission-layout">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={user} onLogout={handleLogout} isAdmin={isAdmin} />
      
      <main className="main-content">
        {currentView !== 'workspace' && <TopBar title={getPageTitle()} />}
        <div className="view-container">
          {currentView === 'dashboard' ? (
            <Dashboard onNavigateToWorkspace={() => handleNavigate('workspace')} user={user} />
          ) : currentView === 'stories' ? (
            <SavedStories 
              user={user} 
              onSelectStory={(text, title, id) => {
                setGeneratedText(text);
                setCurrentStoryTitle(title);
                setCurrentStoryId(id);
                handleNavigate('workspace');
              }}
            />
          ) : currentView === 'notebook' ? (
            <VocabularyView 
              user={user}
              onNavigateToWorkspace={() => handleNavigate('workspace')}
            />
          ) : currentView === 'media' ? (
            <MediaBuddy 
              user={user}
            />
          ) : currentView === 'admin' ? (
            <AdminDashboard 
              user={user}
            />
          ) : (
            <Workspace 
              onNavigateToDashboard={() => handleNavigate('dashboard')} 
              user={user}
              generatedText={generatedText}
              setGeneratedText={setGeneratedText}
              currentStoryTitle={currentStoryTitle}
              setCurrentStoryTitle={setCurrentStoryTitle}
              currentStoryId={currentStoryId}
              setCurrentStoryId={setCurrentStoryId}
            />
          )}
        </div>
      </main>
      {externalFlashcardsWords.length > 0 && (
        <div className="flashcards-fullpage-overlay">
          <div className="flashcards-wrapper-modal glass-panel">
            <Flashcards 
              notebookWords={externalFlashcardsWords} 
              onFinishExercises={() => setExternalFlashcardsWords([])} 
              user={user}
            />
          </div>
        </div>
      )}

      {currentView !== 'notebook' && <VocabularyDrawer user={user} />}

      {customAlert && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content">
            <h3>Notification</h3>
            <p>{customAlert}</p>
            <div className="modal-actions">
              <button onClick={() => setCustomAlert(null)} className="btn-primary">OK</button>
            </div>
          </div>
        </div>
      )}
      {currentView !== 'dashboard' && (
        <button 
          className="live-chat-floating-bubble" 
          onClick={() => handleNavigate('dashboard')}
          title="Chat Live"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;