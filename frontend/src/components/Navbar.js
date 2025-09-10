// frontend/src/components/Navbar.js
import React from 'react';
import './Navbar.css';

function Navbar({ currentView, onNavigateToDashboard }) {
  // Nawigacja dla widoku Dashboard (główna strona)
  const dashboardNavLinks = (
    <>
      <a href="#discover" className="nav-link">discover</a>
      <a href="#dashboard" className="nav-link"><span className="nav-link-my">my</span>dashboard</a>
    </>
  );

  // Nawigacja dla widoku Workspace (strona robocza)
  const workspaceNavLinks = (
    <>
      <a href="#ideas" className="nav-link">Ideas</a>
      <a href="#mydashboard" className="nav-link" onClick={onNavigateToDashboard}>my dashboard</a>
    </>
  );

  return (
    <nav className="main-navbar">
      {/* Możesz tu dodać logo po lewej stronie, jeśli chcesz */}
      {/* <div className="navbar-logo">
        <h1 className="logo-text">AI Buddy</h1>
        <span className="logo-subtext">English</span>
      </div> */}

      <div className="navbar-links">
        {currentView === 'dashboard' ? dashboardNavLinks : workspaceNavLinks}
      </div>
    </nav>
  );
}

export default Navbar;