// frontend/src/App.js
import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Mission Control';
      case 'workspace': return 'Practice Room';
      case 'notebook': return 'My Vocabulary';
      default: return 'AI English Buddy';
    }
  };

  return (
    <div className="App mission-layout">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} />
      
      <main className="main-content">
        <TopBar title={getPageTitle()} />
        <div className="view-container">
          {currentView === 'dashboard' ? (
            <Dashboard onNavigateToWorkspace={() => handleNavigate('workspace')} />
          ) : (
            <Workspace onNavigateToDashboard={() => handleNavigate('dashboard')} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;