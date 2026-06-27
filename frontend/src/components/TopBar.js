import React from 'react';
import './TopBar.css';

const TopBar = ({ title }) => {
  return (
    <header className="mission-topbar">
      <div className="topbar-left">
        <h2 className="page-title">{title}</h2>
      </div>
    </header>
  );
};

export default TopBar;
