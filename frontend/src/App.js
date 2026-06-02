// frontend/src/App.js
import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import SavedStories from './components/Story/SavedStories';
import Auth from './components/Auth/Auth';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("buddy_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [generatedText, setGeneratedText] = useState("");
  const [currentStoryTitle, setCurrentStoryTitle] = useState("");
  const [currentStoryId, setCurrentStoryId] = useState(null);

  const handleLoginSuccess = (userData) => {
    localStorage.setItem("buddy_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = async () => {
    if (user && user.token) {
      try {
        await fetch("http://127.0.0.1:5001/api/logout", {
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
      case 'dashboard': return 'Mission Control';
      case 'workspace': return 'Practice Room';
      case 'stories': return 'Saved Stories';
      case 'notebook': return 'My Vocabulary';
      default: return 'AI English Buddy';
    }
  };

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App mission-layout">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} user={user} onLogout={handleLogout} />
      
      <main className="main-content">
        <TopBar title={getPageTitle()} />
        <div className="view-container">
          {currentView === 'dashboard' ? (
            <Dashboard onNavigateToWorkspace={() => handleNavigate('workspace')} />
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
    </div>
  );
}

export default App;