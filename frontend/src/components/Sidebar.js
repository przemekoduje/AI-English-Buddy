import React, { useState, useEffect, useRef } from 'react';
import logoImg from '../assets/logo.png';
import { API_BASE_URL } from '../config';
import './Sidebar.css';

const DAILY_GOAL_MINUTES = 20;

const Sidebar = ({ currentView, onNavigate, user, onLogout, isAdmin, subscription, onOpenPaywall }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('buddy_sidebar_collapsed');
    return stored ? JSON.parse(stored) : false;
  });

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getTodayStr();
  const storageKey = `speakling_practice_${user?.email || 'guest'}_${todayStr}`;

  const isEffectiveAdmin = Boolean(
    isAdmin || 
    subscription?.is_admin || 
    (user?.email && (user.email.includes('przemek') || user.email.includes('przemyslaw') || user.email.includes('przemokoduje')))
  );

  const [adminTickingInfo, setAdminTickingInfo] = useState({
    isTicking: true,
    status: 'active',
    reason: 'Aktywne liczenie co 1s'
  });

  const [practiceSeconds, setPracticeSeconds] = useState(() => {
    try {
      const val = localStorage.getItem(storageKey);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  });

  const lastActivityRef = useRef(Date.now());
  const practiceSecondsRef = useRef(practiceSeconds);
  practiceSecondsRef.current = practiceSeconds;

  // Inicjalizacja i pobranie zapisanego czasu z backendu
  useEffect(() => {
    if (!user?.token) return;

    fetch(`${API_BASE_URL}/api/user/daily-practice`, {
      headers: {
        'X-Session-Token': user.token
      }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.date === todayStr) {
          const serverSec = parseInt(data.seconds, 10) || 0;
          setPracticeSeconds(prev => {
            const chosen = Math.max(prev, serverSec);
            try {
              localStorage.setItem(storageKey, String(chosen));
            } catch (e) {}
            return chosen;
          });
        }
      })
      .catch(() => {});
  }, [user?.token, todayStr, storageKey]);

  // Śledzenie aktywnego czasu spędzonego na ćwiczeniach
  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const INACTIVITY_TIMEOUT_SECONDS = 8;

    const isLearningMediaActive = () => {
      // 1. Sprawdź czy trwa odtwarzanie wideo w Media Buddy (YouTube)
      if (window.__speakling_is_media_playing || document.body?.dataset?.mediaPlaying === "true") {
        return true;
      }

      // 2. Sprawdź czy trwa odtwarzanie nagrania lektora lub wideo edukacyjnego
      const mediaList = document.querySelectorAll('audio, video');
      for (const m of mediaList) {
        if (!m.paused && !m.ended && m.currentTime > 0) return true;
      }
      return false;
    };

    window.addEventListener('mousemove', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('click', markActivity, { passive: true });
    window.addEventListener('touchstart', markActivity, { passive: true });
    window.addEventListener('scroll', markActivity, { passive: true });
    document.addEventListener('selectionchange', markActivity, { passive: true });

    let tickCounter = 0;
    const interval = setInterval(() => {
      const isHidden = document.hidden;
      const secSinceLastAction = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const isMediaPlaying = isLearningMediaActive();
      const hasRecentInteraction = secSinceLastAction <= INACTIVITY_TIMEOUT_SECONDS;

      if (isEffectiveAdmin) {
        if (isHidden) {
          setAdminTickingInfo({
            isTicking: false,
            status: 'hidden',
            reason: 'Wstrzymano (karta w tle)'
          });
        } else if (isMediaPlaying) {
          setAdminTickingInfo({
            isTicking: true,
            status: 'media',
            reason: 'Naliczanie: wideo/audio włączone'
          });
        } else if (hasRecentInteraction) {
          setAdminTickingInfo({
            isTicking: true,
            status: 'active',
            reason: `Naliczanie: interakcja (${secSinceLastAction}s / max 8s)`
          });
        } else {
          setAdminTickingInfo({
            isTicking: false,
            status: 'idle',
            reason: `Wstrzymano: brak aktywności (${secSinceLastAction}s > 8s)`
          });
        }
      }

      // 1. Karta musi być aktywna/widoczna
      if (isHidden) return;

      // 2. Sprawdzamy czy użytkownik faktycznie wykonuje zajęcia lub słucha/ogląda materiał
      if (!hasRecentInteraction && !isMediaPlaying) {
        // Brak realnych działań na stronie i brak odtwarzanego materiału - nie naliczaj bezczynności
        return;
      }

      setPracticeSeconds(prev => {
        const next = prev + 1;
        tickCounter++;

        // Zapis do localStorage co 10 sekund
        if (tickCounter % 10 === 0) {
          try {
            localStorage.setItem(storageKey, String(next));
          } catch (e) {}
        }

        // Zapis do backendu co 30 sekund lub przy każdej nowo ukończonej minucie
        if ((tickCounter % 30 === 0 || next % 60 === 0) && user?.token) {
          fetch(`${API_BASE_URL}/api/user/daily-practice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': user.token
            },
            body: JSON.stringify({
              seconds: next,
              target_minutes: DAILY_GOAL_MINUTES
            })
          }).catch(() => {});
        }

        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('click', markActivity);
      window.removeEventListener('touchstart', markActivity);
      window.removeEventListener('scroll', markActivity);
      document.removeEventListener('selectionchange', markActivity);

      try {
        localStorage.setItem(storageKey, String(practiceSecondsRef.current));
      } catch (e) {}
    };
  }, [user?.token, storageKey, isEffectiveAdmin]);

  // Wyświetlanie z dokładnością do pełnej 1 minuty
  const fullPracticeMinutes = Math.floor(practiceSeconds / 60);
  const practicePercentage = Math.min(100, Math.round((fullPracticeMinutes / DAILY_GOAL_MINUTES) * 100));

  let practiceMetaText = `${fullPracticeMinutes} of ${DAILY_GOAL_MINUTES} minutes today`;
  if (fullPracticeMinutes >= DAILY_GOAL_MINUTES) {
    practiceMetaText = `${fullPracticeMinutes} of ${DAILY_GOAL_MINUTES} minutes today · Goal completed`;
  }

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('buddy_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  const isStarter = !subscription || subscription.tier === 'starter';

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

  const handleItemClick = (item) => {
    if (item.disabled) return;
    onNavigate(item.id);
  };

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
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            title={item.disabled ? `${item.label} (Wkrótce / Coming Soon)` : (isCollapsed ? item.label : undefined)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && !isCollapsed && (
              <span className="nav-badge-pill">{item.badge}</span>
            )}
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
          <div className={`daily-practice-card ${isEffectiveAdmin ? 'admin-mode-card' : ''}`}>
            <div className="practice-card-header">
              <span className="practice-card-title">Your daily practice</span>
              {isEffectiveAdmin && (
                <span className="admin-practice-badge" title="Dokładny podgląd co do sekundy w trybie administratora">
                  ADMIN ⏱️
                </span>
              )}
            </div>

            {isEffectiveAdmin ? (
              <div className="admin-practice-timer-box">
                <div className="admin-timer-row">
                  <span className="admin-timer-digits">
                    {String(Math.floor(practiceSeconds / 60)).padStart(2, '0')}:{String(practiceSeconds % 60).padStart(2, '0')}
                  </span>
                  <span className="admin-timer-goal">/ {DAILY_GOAL_MINUTES}:00 ({practiceSeconds}s)</span>
                  <span className="admin-timer-pct">
                    {Math.min(100, (practiceSeconds / (DAILY_GOAL_MINUTES * 60)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className={`admin-timer-status ${adminTickingInfo.isTicking ? 'ticking' : 'paused'}`}>
                  <span className="admin-timer-dot"></span>
                  <span className="admin-timer-reason">{adminTickingInfo.reason}</span>
                </div>
              </div>
            ) : (
              <p className="practice-card-sub">
                {practicePercentage >= 100 ? "Great job! Daily goal achieved." : "A little English, every day."}
              </p>
            )}

            <div className="practice-progress-bar">
              <div 
                className="practice-progress-fill" 
                style={{ 
                  width: `${Math.max(
                    practiceSeconds > 0 ? 3 : 0, 
                    isEffectiveAdmin ? Math.min(100, (practiceSeconds / (DAILY_GOAL_MINUTES * 60)) * 100) : practicePercentage
                  )}%` 
                }}
              ></div>
            </div>

            <span className="practice-card-meta">
              {isEffectiveAdmin ? (
                <>
                  {fullPracticeMinutes} z {DAILY_GOAL_MINUTES} min · do +1 min: {60 - (practiceSeconds % 60)}s
                </>
              ) : (
                practiceMetaText
              )}
            </span>
          </div>
        )}

        <div className="sidebar-bottom-actions">
          <button 
            className={`help-feedback-btn ${currentView === 'help-feedback' ? 'active' : ''}`} 
            onClick={() => onNavigate('help-feedback')}
            title={isCollapsed ? "Help & feedback" : undefined}
          >
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
