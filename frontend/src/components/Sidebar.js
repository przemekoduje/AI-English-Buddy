import React from 'react';
import './Sidebar.css';

const Sidebar = ({ currentView, onNavigate }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'workspace', label: 'Practice Room', icon: '📝' },
    { id: 'notebook', label: 'Vocabulary', icon: '📓' },
    { id: 'academy', label: 'Academy', icon: '🎓' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="mission-sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">✨</div>
        <h1 className="brand-name">English Buddy</h1>
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
        <div className="agent-card">
          <div className="agent-status">
            <span className="status-dot"></span>
            LIVE AGENT
          </div>
          <p className="agent-quote">"Focusing on your pronunciation today."</p>
          <div className="agent-icon">🤖</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
