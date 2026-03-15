import React from "react";
import "./Dashboard.css";

function Dashboard({ onNavigateToWorkspace }) {
  const metrics = [
    {
      title: "LANGUAGE PROFICIENCY",
      value: "B2",
      subValue: "Strongly Improving",
      type: "gauge",
      percent: 78
    },
    {
      title: "AI CONFIDENCE",
      value: "94.2%",
      subValue: "Grammar Stability",
      type: "status",
      isPositive: true
    },
    {
      title: "ACTIVE SESSIONS",
      value: "12",
      subValue: "Today's Progress",
      type: "signal"
    }
  ];

  return (
    <div className="dashboard-mission-control">
      <div className="mission-grid">
        {/* Main Welcome Card */}
        <div className="mission-card welcome-card">
          <div className="card-badge">SUPER BRAIN EDITION</div>
          <h1 className="welcome-title">
            Meet Your <span className="pink-text">AI English</span> <br /> Assistant
          </h1>
          <p className="welcome-desc">
            Your personalized mission to master English. Context-aware learning, native-level feedback, and real-time evolution.
          </p>
          <div className="welcome-actions">
            <button className="btn-primary" onClick={onNavigateToWorkspace}>Start Practice</button>
            <button className="btn-secondary">View Logic</button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="metrics-row">
          {metrics.map((m, i) => (
            <div key={i} className="mission-card metric-card">
              <span className="metric-title">{m.title}</span>
              <div className="metric-main">
                <span className="metric-value">{m.value}</span>
                {m.type === 'gauge' && (
                   <div className="gauge-container">
                      <div className="gauge-bar" style={{width: `${m.percent}%`}}></div>
                   </div>
                )}
                {m.isPositive && <span className="metric-check">✓</span>}
              </div>
              <span className="metric-sub">{m.subValue}</span>
            </div>
          ))}
        </div>

        {/* Secondary Info Area */}
        <div className="info-grid">
           <div className="mission-card data-source-card">
              <h3>DAILY STREAK</h3>
              <div className="streak-viz">
                 {[...Array(7)].map((_, i) => (
                    <div key={i} className={`streak-day ${i < 5 ? 'active' : ''}`}></div>
                 ))}
              </div>
              <p>5 days strong! Keep evolving.</p>
           </div>
           
           <div className="mission-card recent-activity">
              <h3>RECENT WORDS</h3>
              <ul className="word-list">
                 <li><strong>Paradigm</strong> - a typical example or pattern of something.</li>
                 <li><strong>Evolution</strong> - the gradual development of something.</li>
                 <li><strong>Context</strong> - the circumstances that form the setting.</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
