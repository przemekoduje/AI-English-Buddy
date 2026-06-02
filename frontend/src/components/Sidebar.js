import React from 'react';
import './Sidebar.css';

const Sidebar = ({ currentView, onNavigate, user, onLogout }) => {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
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
      id: 'academy',
      label: 'Academy',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>
      )
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    },
  ];

  return (
    <aside className="mission-sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 className="brand-name">Buddy AI</h1>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-profile-card">
            <div className="user-info">
              <span className="user-avatar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="user-email" title={user.email}>{user.email}</span>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Logout">
              Wyloguj
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
