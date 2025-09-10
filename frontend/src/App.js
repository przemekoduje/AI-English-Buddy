// frontend/src/App.js
import React, { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import Navbar from './components/Navbar';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' lub 'workspace'

  // Funkcja, którą przekażemy do Dashboard, aby mógł zmienić widok
  const navigateToWorkspace = () => {
    setCurrentView('workspace');
  };

  // Funkcja do powrotu do Dashboard (na przyszłość)
  const navigateToDashboard = () => {
    setCurrentView('dashboard');
  };

  return (
    <div className="App">
      {/* Navbar będzie renderowany zawsze, niezależnie od widoku */}
      <Navbar currentView={currentView} onNavigateToDashboard={navigateToDashboard} /> 

      {currentView === 'dashboard' ? (
        <Dashboard onNavigateToWorkspace={navigateToWorkspace} />
      ) : (
        <Workspace onNavigateToDashboard={navigateToDashboard} />
      )}
    </div>
  );
}

export default App;