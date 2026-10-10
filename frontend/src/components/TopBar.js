import React from 'react';
import './TopBar.css';

const TopBar = ({ title, user }) => {
  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'Anna Kowalska');
  
  return (
    <header className="mission-topbar">
      <div className="topbar-left">
        <h2 className="page-title">{title}</h2>
      </div>

      <div className="topbar-right">
        <button className="topbar-lang-pill" title="Zmień język docelowy (EN → PL)">
          <span className="lang-icon">🌐</span>
          <span className="lang-text">EN → PL</span>
        </button>

        <button className="topbar-icon-btn" title="Powiadomienia">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        <div className="topbar-user-pill">
          <span className="topbar-avatar">{userName.charAt(0).toUpperCase()}</span>
          <span className="topbar-username">{userName}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
