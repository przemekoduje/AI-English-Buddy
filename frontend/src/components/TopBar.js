import React from 'react';
import './TopBar.css';

const TopBar = ({ title }) => {
  return (
    <header className="mission-topbar">
      <div className="topbar-left">
        <h2 className="page-title">{title}</h2>
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Search lessons, words, or grammar..." className="search-input" />
        </div>
      </div>
      
      <div className="topbar-right">
        <button className="topbar-btn">🔔</button>
        <button className="topbar-btn">⚙️</button>
        <div className="user-profile">
          <div className="user-avatar">PR</div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
