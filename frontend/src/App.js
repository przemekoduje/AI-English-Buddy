import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import SavedStories from './components/Story/SavedStories';
import Auth from './components/Auth/Auth';
import VocabularyView from './components/Vocabulary/VocabularyView';
import VocabularyDrawer from './components/Vocabulary/VocabularyDrawer';
import TranslatorDrawer from './components/Translator/TranslatorDrawer';
import MediaBuddy from './components/Media/MediaBuddy';
import Flashcards from './components/Flashcards';
import { API_BASE_URL } from './config';
import AdminDashboard from './components/Admin/AdminDashboard';
import GoodToKnow from './components/GoodToKnow';
import HelpFeedback from './components/Help/HelpFeedback';
import PaywallModal from './components/Paywall/PaywallModal';

function App() {
  const [currentView, setCurrentView] = useState(() => {
    const savedView = localStorage.getItem("buddy_current_view");
    if (savedView && savedView !== 'dashboard') return savedView;
    return 'workspace';
  });
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("buddy_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    return localStorage.getItem("buddy_selected_voice") || "en-US-BrianNeural";
  });

  const handleVoiceChange = (newVoice) => {
    if (!newVoice) return;
    setSelectedVoice(newVoice);
    localStorage.setItem("buddy_selected_voice", newVoice);
  };

  const [subscription, setSubscription] = useState(() => {
    return user?.subscription || null;
  });
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);

  const openPaywall = (reason = null) => {
    setPaywallReason(reason);
    setPaywallOpen(true);
  };

  const fetchSubscription = async () => {
    if (!user || !user.token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/subscription/status`, {
        headers: { "X-Session-Token": user.token }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      } else {
        setSubscription(prev => prev || {
          tier: 'starter',
          status: 'free',
          name: 'Starter (Free)',
          can_access_mastery: false,
          can_access_media: false,
          can_access_industry_modes: false,
          can_buy_topup: false,
          minutes_remaining: 5.0,
          live_minutes_limit: 5.0,
          is_admin: false
        });
      }
    } catch (e) {
      console.warn("Błąd pobierania subskrypcji:", e);
      setSubscription(prev => prev || {
        tier: 'starter',
        status: 'free',
        name: 'Starter (Free)',
        can_access_mastery: false,
        can_access_media: false,
        can_access_industry_modes: false,
        can_buy_topup: false,
        minutes_remaining: 5.0,
        live_minutes_limit: 5.0,
        is_admin: false
      });
    }
  };

  useEffect(() => {
    if (user && user.token) {
      fetchSubscription();
      fetch(`${API_BASE_URL}/api/admin/verify`, {
        headers: { "X-Session-Token": user.token }
      })
      .then(res => {
        if (res.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
      setSubscription(null);
    }
  }, [user]);

  const [generatedText, setGeneratedText] = useState(() => {
    return localStorage.getItem("buddy_generated_text") || "";
  });
  const [currentStoryTitle, setCurrentStoryTitle] = useState(() => {
    return localStorage.getItem("buddy_current_story_title") || "";
  });
  const [currentStoryId, setCurrentStoryId] = useState(() => {
    const id = localStorage.getItem("buddy_current_story_id");
    return id ? JSON.parse(id) : null;
  });

  useEffect(() => {
    localStorage.setItem("buddy_generated_text", generatedText);
  }, [generatedText]);

  useEffect(() => {
    localStorage.setItem("buddy_current_story_title", currentStoryTitle);
  }, [currentStoryTitle]);

  useEffect(() => {
    if (currentStoryId !== null) {
      localStorage.setItem("buddy_current_story_id", JSON.stringify(currentStoryId));
    } else {
      localStorage.removeItem("buddy_current_story_id");
    }
  }, [currentStoryId]);

  const [externalFlashcardsWords, setExternalFlashcardsWords] = useState([]);

  const [customAlert, setCustomAlert] = useState(null);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setCustomAlert(message);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Dynamiczne wykrywanie urządzeń mobilnych oraz zmniejszenia ekranu i przekierowanie na wersję mobilną
  useEffect(() => {
    const checkMobileRedirect = () => {
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                       window.innerWidth < 768 ||
                       (window.screen && Math.min(window.screen.width, window.screen.height) < 768);
      if (isMobile) {
        const path = window.location.pathname;
        if (!path.startsWith('/speakling/mobile') && !path.startsWith('/speakling/mobile/')) {
          const separator = window.location.search ? '&' : '?';
          const target = window.location.origin + '/speakling/mobile/' + window.location.search + separator + 'cb=' + Date.now() + window.location.hash;
          window.location.replace(target);
        }
      }
    };

    checkMobileRedirect();
    window.addEventListener('resize', checkMobileRedirect);
    
    return () => window.removeEventListener('resize', checkMobileRedirect);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playFlashcards = params.get('play_flashcards') === 'true';
    const wordsB64 = params.get('words');
    if (playFlashcards && wordsB64) {
      try {
        const decoded = decodeURIComponent(escape(window.atob(wordsB64)));
        const parsedWords = JSON.parse(decoded);
        if (Array.isArray(parsedWords) && parsedWords.length > 0) {
          setExternalFlashcardsWords(parsedWords);
        }
      } catch (e) {
        console.error("Failed to parse external flashcards words from URL:", e);
      }
      
      // Clean query parameters from URL without reloading
      const url = new URL(window.location);
      url.searchParams.delete('play_flashcards');
      url.searchParams.delete('words');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

  // Obsługa powrotu z bramki Stripe (Stripe Checkout)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success') {
      if (sessionId && user?.token) {
        fetch(`${API_BASE_URL}/api/stripe/verify-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': user.token
          },
          body: JSON.stringify({ session_id: sessionId })
        })
        .then(res => res.json())
        .then(data => {
          if (data.subscription) {
            setSubscription(data.subscription);
          }
          setCustomAlert("Dziękujemy! Twój pakiet został pomyślnie zaktualizowany. Ciesz się pełnymi możliwościami Speakling!");
        })
        .catch(err => {
          console.error("Błąd weryfikacji sesji Stripe:", err);
          fetchSubscription();
        });
      } else {
        setCustomAlert("Dziękujemy! Płatność przebiegła pomyślnie.");
        fetchSubscription();
      }

      const url = new URL(window.location);
      url.searchParams.delete('payment');
      url.searchParams.delete('session_id');
      url.searchParams.delete('plan');
      url.searchParams.delete('topup');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } else if (payment === 'cancelled') {
      setCustomAlert("Płatność została anulowana. Możesz powrócić do wyboru planu w dowolnym momencie.");
      const url = new URL(window.location);
      url.searchParams.delete('payment');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, [user]);

  const handleLoginSuccess = (userData) => {
    localStorage.setItem("buddy_user", JSON.stringify(userData));
    setUser(userData);
    if (userData.subscription) {
      setSubscription(userData.subscription);
    }
  };

  const handleLogout = async () => {
    if (user && user.token) {
      try {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: "POST",
          headers: { "X-Session-Token": user.token }
        });
      } catch (e) {
        console.error("Błąd API wylogowania:", e);
      }
    }
    localStorage.removeItem("buddy_user");
    localStorage.removeItem("buddy_current_view");
    localStorage.removeItem("buddy_generated_text");
    localStorage.removeItem("buddy_current_story_title");
    localStorage.removeItem("buddy_current_story_id");
    setUser(null);
    setSubscription(null);
    setGeneratedText("");
    setCurrentStoryTitle("");
    setCurrentStoryId(null);
  };

  const handleNavigate = (view) => {
    // Blokada wejścia w Media Buddy dla pakietu Starter
    if (view === 'media' && subscription && !subscription.can_access_media && !isAdmin) {
      openPaywall({ feature: 'media' });
      return;
    }
    setCurrentView(view);
    localStorage.setItem("buddy_current_view", view);
  };

  const [openLiveSettingsTrigger, setOpenLiveSettingsTrigger] = useState(0);

  const handleOpenLiveSettings = () => {
    if (currentView !== 'dashboard') {
      setCurrentView('dashboard');
      localStorage.setItem("buddy_current_view", 'dashboard');
    }
    setOpenLiveSettingsTrigger(Date.now());
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Chat Live';
      case 'workspace': return 'Practice Room';
      case 'stories': return 'Saved Stories';
      case 'notebook': return 'My Vocabulary';
      case 'media': return 'Media Buddy';
      case 'admin': return 'Panel Administratora';
      case 'good-to-know': return 'Good to know';
      case 'help-feedback': return 'Help & Feedback';
      default: return 'Speakling';
    }
  };

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App mission-layout">
      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        user={user} 
        onLogout={handleLogout} 
        isAdmin={isAdmin}
        subscription={subscription}
        onOpenPaywall={openPaywall}
      />
      
      <main className="main-content">
        <TopBar 
          title={getPageTitle()} 
          user={user} 
          subscription={subscription}
          onOpenPaywall={openPaywall}
          selectedVoice={selectedVoice}
          onVoiceChange={handleVoiceChange}
          onOpenLiveSettings={handleOpenLiveSettings}
          onLogout={handleLogout}
        />
        <div className="view-container">
          {currentView === 'dashboard' ? (
            <Dashboard 
              onNavigateToWorkspace={() => handleNavigate('workspace')} 
              user={user} 
              subscription={subscription}
              onOpenPaywall={openPaywall}
              onSubscriptionUpdated={setSubscription}
              openSettingsTrigger={openLiveSettingsTrigger}
            />
          ) : currentView === 'stories' ? (
            <SavedStories 
              user={user} 
              onSelectStory={(text, title, id) => {
                setGeneratedText(text);
                setCurrentStoryTitle(title);
                setCurrentStoryId(id);
                handleNavigate('workspace');
              }}
              onStartLiveChat={(storyId) => {
                localStorage.setItem("buddy_selected_story_id", storyId);
                handleNavigate('dashboard');
              }}
              onCreateStory={() => handleNavigate('workspace')}
            />
          ) : currentView === 'notebook' ? (
            <VocabularyView 
              user={user}
              onNavigateToWorkspace={() => handleNavigate('workspace')}
              subscription={subscription}
              onOpenPaywall={openPaywall}
            />
          ) : currentView === 'media' || currentView === 'subtitle-studio' ? (
            <MediaBuddy 
              user={user}
              subscription={subscription}
              onOpenPaywall={openPaywall}
              onNavigate={handleNavigate}
            />
          ) : currentView === 'admin' ? (
            <AdminDashboard 
              user={user}
            />
          ) : currentView === 'help-feedback' ? (
            <HelpFeedback 
              user={user} 
              onNavigate={handleNavigate} 
            />
          ) : currentView === 'good-to-know' ? (
            <GoodToKnow />
          ) : (
            <Workspace 
              onNavigateToDashboard={() => handleNavigate('dashboard')} 
              onNavigateToVocabulary={() => handleNavigate('notebook')}
              user={user}
              isAdmin={isAdmin}
              generatedText={generatedText}
              setGeneratedText={setGeneratedText}
              currentStoryTitle={currentStoryTitle}
              setCurrentStoryTitle={setCurrentStoryTitle}
              currentStoryId={currentStoryId}
              setCurrentStoryId={setCurrentStoryId}
              subscription={subscription}
              onOpenPaywall={openPaywall}
              selectedVoice={selectedVoice}
              onVoiceChange={handleVoiceChange}
            />
          )}
        </div>
      </main>
      {externalFlashcardsWords.length > 0 && (
        <div className="flashcards-fullpage-overlay">
          <div className="flashcards-wrapper-modal glass-panel">
            <Flashcards 
              notebookWords={externalFlashcardsWords} 
              onFinishExercises={() => setExternalFlashcardsWords([])} 
              user={user}
            />
          </div>
        </div>
      )}

      {currentView !== 'notebook' && (
        <>
          <VocabularyDrawer user={user} />
          <TranslatorDrawer user={user} />
        </>
      )}

      {/* Modal Paywalla */}
      <PaywallModal 
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        user={user}
        subscription={subscription}
        initialReason={paywallReason}
        onSubscriptionUpdated={(newSub) => setSubscription(newSub)}
      />

      {customAlert && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content">
            <h3>Notification</h3>
            <p>{customAlert}</p>
            <div className="modal-actions">
              <button onClick={() => setCustomAlert(null)} className="btn-primary">OK</button>
            </div>
          </div>
        </div>
      )}
      {currentView !== 'dashboard' && (
        <button 
          className="live-chat-floating-bubble" 
          onClick={() => handleNavigate('dashboard')}
          title="Chat Live"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;