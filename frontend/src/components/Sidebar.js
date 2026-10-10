import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import './Sidebar.css';

const Sidebar = ({ currentView, onNavigate, user, onLogout, isAdmin }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('buddy_sidebar_collapsed');
    return stored ? JSON.parse(stored) : false;
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('buddy_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Chat Live',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      )
    },
    {
      id: 'workspace',
      label: 'Workspace',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    },
    {
      id: 'stories',
      label: 'Saved Stories',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      id: 'notebook',
      label: 'My Vocabulary',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l6 6M4 14l6-6 2 3M2 5h12M9 2v3M22 22l-5-10-5 10M14 18h6" />
        </svg>
      )
    },
    {
      id: 'media',
      label: 'Media Buddy',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      )
    },
    {
      id: 'good-to-know',
      label: 'Good to Know',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.59 2.97 1.5 4 .76.76 1.23 1.52 1.41 2.5h6.18z" />
        </svg>
      )
    }
  ];

  if (isAdmin) {
    menuItems.push({
      id: 'admin',
      label: 'Admin Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      )
    });
  }

  return (
    <aside className={`mission-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon-figma">
          <img src={logoImg} alt="Speakling Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h1 className="brand-name-figma">speakling</h1>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item nav-item-${item.id} ${currentView === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => !item.disabled && onNavigate(item.id)}
            disabled={item.disabled}
            title={item.disabled ? `${item.label} (Wkrótce / Coming Soon)` : (isCollapsed ? item.label : undefined)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <button 
        className="collapse-toggle-btn" 
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isCollapsed ? (
            <path d="M9 18l6-6-6-6" />
          ) : (
            <path d="M15 18l-6-6 6-6" />
          )}
        </svg>
        <span>Collapse</span>
      </button>

      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="daily-practice-card">
            <div className="practice-card-header">
              <span className="practice-card-title">Your daily practice</span>
            </div>
            <p className="practice-card-sub">A little English, every day.</p>
            <div className="practice-progress-bar">
              <div className="practice-progress-fill" style={{ width: '60%' }}></div>
            </div>
            <span className="practice-card-meta">12 of 20 minutes today</span>
          </div>
        )}

        <div className="sidebar-bottom-actions">
          <button className="help-feedback-btn" onClick={() => onNavigate('good-to-know')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {!isCollapsed && <span>Help & feedback</span>}
          </button>
          
          {user && !isCollapsed && (
            <button className="logout-btn-minimal" onClick={onLogout} title="Wyloguj">
              Wyloguj ({user.email.split('@')[0]})
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
