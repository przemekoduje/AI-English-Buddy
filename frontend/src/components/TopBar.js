import React, { useState, useRef, useEffect } from 'react';
import './TopBar.css';
import { API_BASE_URL } from '../config';

const AVAILABLE_NARRATORS = [
  { id: 'en-US-BrianNeural', name: 'Brian (US — Natural)' },
  { id: 'en-US-GuyNeural', name: 'Guy (US — Warm)' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (US — Radio)' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US — Friendly)' },
  { id: 'en-US-AriaNeural', name: 'Aria (US — Expressive)' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK — British)' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK — British)' },
];

const TopBar = ({ 
  title, 
  user, 
  subscription, 
  onOpenPaywall,
  selectedVoice = 'en-US-BrianNeural',
  onVoiceChange,
  onOpenLiveSettings,
  onLogout
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [imgError, setImgError] = useState(false);
  const dropdownRef = useRef(null);
  const previewAudioRef = useRef(null);

  const userName = user?.name || user?.full_name || (user?.email ? user.email.split('@')[0] : 'Użytkownik');
  const userEmail = user?.email || '';
  const userPhoto = user?.photoURL || user?.avatar_url || (typeof user?.picture === 'string' ? user?.picture : user?.picture?.data?.url) || user?.photo_url || null;
  const avatarUrl = userPhoto || (userEmail ? `https://unavatar.io/${encodeURIComponent(userEmail)}?fallback=false` : null);
  const userInitial = (userName || 'U').charAt(0).toUpperCase();

  const tier = subscription?.tier || 'starter';
  const remaining = subscription?.minutes_remaining !== undefined ? subscription.minutes_remaining : 5;
  const isProOrIntensive = tier === 'pro' || tier === 'intensive';

  // Zamknięcie rozwijanego menu po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handlePreviewVoice = async (voiceToTest) => {
    const v = voiceToTest || selectedVoice;
    if (isPlayingPreview) {
      if (previewAudioRef.current) {
        try { previewAudioRef.current.pause(); } catch (e) {}
        previewAudioRef.current = null;
      }
      setIsPlayingPreview(false);
      return;
    }

    setIsPlayingPreview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello! I am your Speakling voice tutor. Ready to practice?",
          voice: v
        })
      });
      const data = await response.json();
      if (data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        previewAudioRef.current = audio;
        audio.onended = () => {
          setIsPlayingPreview(false);
          previewAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlayingPreview(false);
          previewAudioRef.current = null;
        };
        await audio.play();
      } else {
        setIsPlayingPreview(false);
      }
    } catch (err) {
      console.warn("Preview error:", err);
      setIsPlayingPreview(false);
    }
  };

  return (
    <header className="mission-topbar">
      <div className="topbar-left">
        <h2 className="page-title">{title}</h2>
      </div>

      <div className="topbar-right">
        {/* Pigułka subskrypcji i minut Live AI */}
        <button 
          className={`topbar-plan-pill ${isProOrIntensive ? 'plan-pill-premium' : 'plan-pill-free'}`}
          onClick={() => onOpenPaywall && onOpenPaywall()}
          title="Zarządzaj pakietem i limitami minut Live AI"
        >
          <span className="plan-pill-badge">{tier.toUpperCase()}</span>
          <span className="plan-pill-mins">{remaining.toFixed(1)}m</span>
          <span className="plan-pill-action">{tier === 'starter' ? '⚡ Uaktualnij' : 'Plan'}</span>
        </button>

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

        {/* Menu profilu użytkownika z Settings & Głos lektora */}
        <div className="topbar-user-wrapper" ref={dropdownRef}>
          <div 
            className={`topbar-user-pill ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen(prev => !prev)}
            title="Kliknij, aby otworzyć ustawienia profilu i lektora"
          >
            {avatarUrl && !imgError ? (
              <img 
                src={avatarUrl} 
                alt={userName} 
                className="topbar-avatar topbar-avatar-img" 
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="topbar-avatar">{userInitial}</span>
            )}
            <span className="topbar-username">{userName}</span>
            <svg 
              className={`topbar-chevron ${isDropdownOpen ? 'open' : ''}`} 
              viewBox="0 0 24 24" 
              width="14" 
              height="14" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Rozwijane menu z ustawieniami */}
          {isDropdownOpen && (
            <div className="topbar-user-dropdown animate-fade-in">
              <div className="dropdown-user-header">
                {avatarUrl && !imgError ? (
                  <img 
                    src={avatarUrl} 
                    alt={userName} 
                    className="dropdown-avatar-img" 
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="dropdown-avatar-initial">{userInitial}</span>
                )}
                <div className="dropdown-user-meta">
                  <div className="dropdown-user-name">{userName}</div>
                  {userEmail && <div className="dropdown-user-email">{userEmail}</div>}
                  <span className={`dropdown-plan-badge ${isProOrIntensive ? 'badge-pro' : 'badge-free'}`}>
                    {tier.toUpperCase()} PLAN
                  </span>
                </div>
              </div>

              <div className="dropdown-divider" />

              {/* Sekcja Ustawienia Lektora */}
              <div className="dropdown-settings-section">
                <div className="dropdown-section-title">
                  Głos lektora (Narrator Voice)
                </div>
                <div className="dropdown-section-desc">
                  Stały lektor czytający teksty w całej aplikacji
                </div>

                <div className="dropdown-voice-selector">
                  <select
                    className="dropdown-voice-select"
                    value={selectedVoice}
                    onChange={(e) => {
                      if (onVoiceChange) onVoiceChange(e.target.value);
                    }}
                  >
                    {AVAILABLE_NARRATORS.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>

                  <button
                    className={`dropdown-voice-preview-btn ${isPlayingPreview ? 'playing' : ''}`}
                    onClick={() => handlePreviewVoice(selectedVoice)}
                    title="Posłuchaj próbki głosu"
                  >
                    {isPlayingPreview ? 'Stop' : 'Próbka'}
                  </button>
                </div>
              </div>

              <div className="dropdown-divider" />

              {/* Opcje dodatkowe */}
              {onOpenLiveSettings && (
                <button 
                  className="dropdown-action-item"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenLiveSettings();
                  }}
                >
                  <span>Ustawienia Chat Live</span>
                </button>
              )}

              <button 
                className="dropdown-action-item"
                onClick={() => {
                  setIsDropdownOpen(false);
                  if (onOpenPaywall) onOpenPaywall();
                }}
              >
                <span>Zarządzaj subskrypcją i minutami</span>
              </button>

              {onLogout && (
                <button 
                  className="dropdown-action-item dropdown-logout-item"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout();
                  }}
                >
                  <span>Wyloguj się</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
