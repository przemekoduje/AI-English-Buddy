import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import SavedStories from './components/Story/SavedStories';
import Auth from './components/Auth/Auth';
import VocabularyView from './components/Vocabulary/VocabularyView';
import MediaBuddy from './components/Media/MediaBuddy';
import Flashcards from './components/Flashcards';
import { API_BASE_URL } from './config';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("buddy_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [generatedText, setGeneratedText] = useState("");
  const [currentStoryTitle, setCurrentStoryTitle] = useState("");
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [externalFlashcardsWords, setExternalFlashcardsWords] = useState([]);

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
    setUser(null);
    setGeneratedText("");
    setCurrentStoryTitle("");
    setCurrentStoryId(null);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Chat Live';
      case 'workspace': return 'Practice Room';
      case 'stories': return 'Saved Stories';
      case 'notebook': return 'My Vocabulary';
      case 'media': return 'Media Buddy';
      default: return 'Speakling';
    }
  };

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App mission-layout">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={user} onLogout={handleLogout} />
      
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
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;