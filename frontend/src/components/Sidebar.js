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
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      )
    },
    {
      id: 'workspace',
      label: 'Practice',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
    },
    {
      id: 'stories',
      label: 'Stories',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    },
    {
      id: 'notebook',
      label: 'Vocabulary',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    },
    {
      id: 'media',
      label: 'Media Buddy',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      )
    },
    {
      id: 'academy',
      label: 'Academy',
      disabled: true,
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>
      )
    },
    {
      id: 'good-to-know',
      label: 'Good to know',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21h6" />
          <path d="M12 2v2" />
          <path d="M12 17v4" />
          <path d="M22 12h-2" />
          <path d="M4 12H2" />
          <path d="M19.07 4.93l-1.41 1.41" />
          <path d="M6.34 17.66l-1.41 1.41" />
          <path d="M19.07 19.07l-1.41-1.41" />
          <path d="M6.34 6.34L4.93 4.93" />
          <circle cx="12" cy="12" r="5" />
        </svg>
      )
    },
  ];

  if (isAdmin) {
    menuItems.push({
      id: 'admin',
      label: 'Admin Panel',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    });
  }

  return (
    <aside className={`mission-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <img src={logoImg} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h1 className="brand-name">Speakling</h1>
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
        title={isCollapsed ? "Rozwiń menu" : "Zwiń menu"}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isCollapsed ? (
            <path d="M9 18l6-6-6-6" />
          ) : (
            <path d="M15 18l-6-6 6-6" />
          )}
        </svg>
        <span>Zwiń menu</span>
      </button>

      <div className="sidebar-footer">
        {user && (
          <div className="user-profile-card">
            <div className="user-info">
              <span className="user-avatar" title={user.email}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              {!isCollapsed && <span className="user-email" title={user.email}>{user.email}</span>}
            </div>

            {!isCollapsed ? (
              <div className="user-profile-actions">
                <button className="profile-action-btn" title="Powiadomienia">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>
                <button className="profile-action-btn" title="Good to know" onClick={() => onNavigate('good-to-know')}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21h6" />
                    <path d="M12 2v2" />
                    <path d="M12 17v4" />
                    <path d="M22 12h-2" />
                    <path d="M4 12H2" />
                    <path d="M19.07 4.93l-1.41 1.41" />
                    <path d="M6.34 17.66l-1.41 1.41" />
                    <path d="M19.07 19.07l-1.41-1.41" />
                    <path d="M6.34 6.34L4.93 4.93" />
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                </button>
                <button className="logout-btn" onClick={onLogout} title="Wyloguj">
                  Wyloguj
                </button>
              </div>
            ) : (
              <>
                <button className="logout-icon-btn" title="Powiadomienia">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>
                <button className="logout-icon-btn" title="Good to know" onClick={() => onNavigate('good-to-know')}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21h6" />
                    <path d="M12 2v2" />
                    <path d="M12 17v4" />
                    <path d="M22 12h-2" />
                    <path d="M4 12H2" />
                    <path d="M19.07 4.93l-1.41 1.41" />
                    <path d="M6.34 17.66l-1.41 1.41" />
                    <path d="M19.07 19.07l-1.41-1.41" />
                    <path d="M6.34 6.34L4.93 4.93" />
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                </button>
                <button className="logout-icon-btn" onClick={onLogout} title="Wyloguj">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
