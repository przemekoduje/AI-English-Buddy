import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config';
import './AdminDashboard.css';

const ACTIVE_MODELS_CONFIG = [
  {
    key: 'gemini_fast',
    id: 'gemini-flash-lite-latest',
    service: 'gemini',
    name: 'Gemini Flash Lite',
    role: 'Tłumaczenia, generowanie historii, słownik, quizy i fiszki'
  },
  {
    key: 'gemini_advanced',
    id: 'gemini-3.5-flash',
    service: 'gemini',
    name: 'Gemini 3.5 Flash',
    role: 'Zaawansowana ewaluacja odpowiedzi i czat kontekstowy'
  },
  {
    key: 'gemini_stt',
    id: 'gemini-3.5-transcribe',
    service: 'gemini',
    name: 'Gemini 3.5 Transcribe',
    role: 'Rozpoznawanie i transkrypcja mowy na tekst (STT)'
  },
  {
    key: 'gemini_live',
    id: 'gemini-2.5-flash-native-audio-latest',
    service: 'google_gemini',
    name: 'Gemini 2.5 Flash Native Audio',
    role: 'Konwersacje głosowe w czasie rzeczywistym (Live Orb)'
  }
];

const ACTIVE_MODEL_IDS_SET = new Set(ACTIVE_MODELS_CONFIG.map(m => m.id));

const AdminDashboard = ({ user, subscription, onSubscriptionUpdated = () => {} }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [sortBy, setSortBy] = useState('cost_desc');
  const [dateFilter, setDateFilter] = useState('all_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Stan weryfikacji przed załadowaniem panelu
  const [verificationStep, setVerificationStep] = useState(1);
  const [loaderStatusText, setLoaderStatusText] = useState(
    'Inicjalizacja weryfikacji bazy danych Firestore i modeli językowych...'
  );
  const [verificationReport, setVerificationReport] = useState({
    accountsVerified: null,
    orphansRemoved: 0,
    orphanedEmails: [],
    modelsVerified: null,
    legacyLogsRemoved: 0,
    legacyModels: [],
    checkedAt: null
  });
  const [deletingEmail, setDeletingEmail] = useState(null);

  // Stan symulatora roli dla administratora
  const currentPreview = subscription?.admin_preview_role || 'admin';
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleSetRole = async (targetRole) => {
    setRoleUpdating(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/set-preview-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        },
        body: JSON.stringify({ role: targetRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd przełączania roli');
      setStatusMsg(`Przełączono na tryb: ${targetRole.toUpperCase()}`);
      if (data.subscription) {
        onSubscriptionUpdated(data.subscription);
      }
    } catch (err) {
      setStatusMsg(`Błąd: ${err.message}`);
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleResetMinutes = async () => {
    setRoleUpdating(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reset-minutes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd resetu');
      setStatusMsg('Zresetowano wykorzystane minuty do 0.0 min');
      if (data.subscription) {
        onSubscriptionUpdated(data.subscription);
      }
    } catch (err) {
      setStatusMsg(`Błąd: ${err.message}`);
    } finally {
      setRoleUpdating(false);
    }
  };

  const runVerificationAndFetchStats = useCallback(async () => {
    if (!user || !user.token) return;
    setLoading(true);
    setError(null);

    let accountsVerified = 0;
    let orphansRemoved = 0;
    let orphanedEmails = [];
    let modelsVerified = ACTIVE_MODELS_CONFIG.length;
    let legacyLogsRemoved = 0;
    let legacyModels = [];

    try {
      // KROK 1: Weryfikacja kont w Firestore i usunięcie pozostałości po nieistniejących kontach
      setVerificationStep(1);
      setLoaderStatusText(
        'Krok 1/3: Weryfikacja kont użytkowników w Firestore i usuwanie pozostałości po usuniętych kontach...'
      );
      const accRes = await fetch(`${API_BASE_URL}/api/admin/verify-accounts`, {
        method: 'POST',
        headers: { 'X-Session-Token': user.token }
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        accountsVerified = accData.verified_users_count ?? 0;
        orphansRemoved = accData.orphaned_docs_deleted ?? 0;
        orphanedEmails = accData.orphaned_emails_cleaned || [];
      }

      // KROK 2: Weryfikacja aktywnych modeli językowych w projekcie i czyszczenie wycofanych modeli
      setVerificationStep(2);
      setLoaderStatusText(
        'Krok 2/3: Weryfikacja aktywnych modeli językowych Gemini w projekcie i odrzucanie nieużywanych modeli...'
      );
      const modRes = await fetch(`${API_BASE_URL}/api/admin/verify-models`, {
        method: 'POST',
        headers: { 'X-Session-Token': user.token }
      });
      if (modRes.ok) {
        const modData = await modRes.json();
        modelsVerified = (modData.active_models || ACTIVE_MODELS_CONFIG).length;
        legacyLogsRemoved = modData.legacy_docs_deleted ?? 0;
        legacyModels = modData.legacy_models_removed || [];
      }

      // KROK 3: Pobieranie zweryfikowanych statystyk dla aktywnych kont i modeli
      setVerificationStep(3);
      setLoaderStatusText(
        'Krok 3/3: Pobieranie aktualnych statystyk, słowników, historii i kosztów dla zweryfikowanych kont...'
      );
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
        headers: { 'X-Session-Token': user.token }
      });
      if (!res.ok) throw new Error('Nie udało się pobrać statystyk administratora.');
      const data = await res.json();

      setVerificationReport({
        accountsVerified: accountsVerified || (data.users ? data.users.length : 0),
        orphansRemoved,
        orphanedEmails,
        modelsVerified,
        legacyLogsRemoved,
        legacyModels,
        checkedAt: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    runVerificationAndFetchStats();
  }, [runVerificationAndFetchStats]);

  const handleDeleteUserAccount = async (e, targetEmail) => {
    e.stopPropagation();
    if (!targetEmail || targetEmail === user?.email || targetEmail === 'przemek.rakotny@gmail.com') return;
    const confirmed = window.confirm(
      `Czy na pewno chcesz trwale usunąć konto "${targetEmail}" oraz wszystkie jego pozostałości w Firestore (słówka, historie, sesje, logi użycia)?`
    );
    if (!confirmed) return;

    setDeletingEmail(targetEmail);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(targetEmail)}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': user.token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd usuwania konta');
      if (selectedEmail === targetEmail) {
        setSelectedEmail(null);
      }
      await runVerificationAndFetchStats();
    } catch (err) {
      alert(`Błąd: ${err.message}`);
    } finally {
      setDeletingEmail(null);
    }
  };

  if (loading) {
    const progressPercent = verificationStep === 1 ? 33 : verificationStep === 2 ? 66 : 95;
    return (
      <div className="admin-loading-container animate-fade-in">
        <div className="admin-spinner"></div>
        <h3 className="admin-loader-title">Weryfikacja stanu projektu przed otwarciem panelu</h3>
        <p className="admin-loader-status">{loaderStatusText}</p>

        <div className="admin-loader-progress-track">
          <div className="admin-loader-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="admin-loader-steps">
          <div className={`admin-loader-step ${verificationStep > 1 ? 'done' : verificationStep === 1 ? 'active' : ''}`}>
            <span className="step-indicator">{verificationStep > 1 ? '✓' : '1'}</span>
            <span>Weryfikacja aktywnych kont w Firestore i czyszczenie pozostałości</span>
          </div>
          <div className={`admin-loader-step ${verificationStep > 2 ? 'done' : verificationStep === 2 ? 'active' : ''}`}>
            <span className="step-indicator">{verificationStep > 2 ? '✓' : '2'}</span>
            <span>Weryfikacja aktywnych modeli językowych (Google Gemini)</span>
          </div>
          <div className={`admin-loader-step ${verificationStep === 3 ? 'active' : ''}`}>
            <span className="step-indicator">3</span>
            <span>Synchronizacja statystyk użytkowników i kosztów AI</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-container glass-panel">
        <h3>Błąd weryfikacji lub pobierania danych</h3>
        <p>{error}</p>
        <button type="button" className="btn-reset-minutes" style={{ marginTop: '16px' }} onClick={runVerificationAndFetchStats}>
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const activeModelsList = stats.active_models || ACTIVE_MODELS_CONFIG;

  const getFilteredUsage = () => {
    if (!stats.usage) return [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let startLimit = null;
    let endLimit = null;

    if (dateFilter === 'this_month') startLimit = new Date(currentYear, currentMonth, 1);
    else if (dateFilter === 'last_2_weeks') startLimit = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    else if (dateFilter === 'first_half_month') {
      startLimit = new Date(currentYear, currentMonth, 1);
      endLimit = new Date(currentYear, currentMonth, 15, 23, 59, 59, 999);
    } else if (dateFilter === 'custom') {
      if (startDate) { startLimit = new Date(startDate); startLimit.setHours(0, 0, 0, 0); }
      if (endDate) { endLimit = new Date(endDate); endLimit.setHours(23, 59, 59, 999); }
    }

    return stats.usage.filter(log => {
      // Odnoś się wyłącznie do aktywnych modeli w projekcie
      if (!log.model || !ACTIVE_MODEL_IDS_SET.has(log.model)) return false;
      if (!log.timestamp) return true;
      const logDate = new Date(log.timestamp);
      if (startLimit && logDate < startLimit) return false;
      if (endLimit && logDate > endLimit) return false;
      return true;
    });
  };

  const filteredUsage = getFilteredUsage();
  const userStatsMap = {};
  const breakdownModels = {};

  // Inicjalizuj wyłącznie istniejące i zweryfikowane w Firestore konta
  (stats.users || []).forEach(u => {
    if (!u.email) return;
    userStatsMap[u.email] = {
      email: u.email,
      full_name: u.full_name || '',
      created_at: u.created_at,
      vocabCount: stats.vocab_counts?.[u.email] || 0,
      storiesCount: stats.story_counts?.[u.email] || 0,
      callsCount: 0,
      costUsd: 0.0,
      costPln: 0.0,
      textTokens: 0,
      sttCalls: 0,
      sttTokens: 0,
      liveAudioTokens: 0,
      liveAudioSecs: 0
    };
  });

  // Inicjalizuj podział kosztów wyłącznie dla 4 aktywnych modeli w projekcie
  activeModelsList.forEach(mCfg => {
    breakdownModels[mCfg.id] = {
      id: mCfg.id,
      name: mCfg.name,
      role: mCfg.role,
      service: mCfg.service,
      model: mCfg.id,
      promptTokens: 0,
      completionTokens: 0,
      quantity: 0,
      costUsd: 0,
      costPln: 0,
      calls: 0
    };
  });

  let validFilteredCallsCount = 0;

  filteredUsage.forEach(log => {
    const email = log.user_email;
    const modelName = log.model;

    // Pomiń wszelkie wpisy należące do kont nieistniejących w Firestore lub modeli spoza projektu
    if (!email || !userStatsMap[email]) return;
    if (!modelName || !ACTIVE_MODEL_IDS_SET.has(modelName)) return;

    validFilteredCallsCount += 1;
    const uStat = userStatsMap[email];
    uStat.callsCount += 1;

    const cost_usd = log.cost_usd || 0;
    const cost_pln = log.cost_pln || 0;
    uStat.costUsd += cost_usd;
    uStat.costPln += cost_pln;

    const totalTok = (log.prompt_tokens || 0) + (log.completion_tokens || 0);

    if (selectedEmail === null || selectedEmail === email) {
      const bModel = breakdownModels[modelName];
      if (bModel) {
        bModel.calls += 1;
        bModel.costUsd += cost_usd;
        bModel.costPln += cost_pln;
        bModel.promptTokens += log.prompt_tokens || 0;
        bModel.completionTokens += log.completion_tokens || 0;
        bModel.quantity += log.quantity || 0;
      }
    }

    if (modelName === 'gemini-3.5-transcribe') {
      uStat.sttCalls += 1;
      uStat.sttTokens += totalTok;
    } else if (modelName === 'gemini-2.5-flash-native-audio-latest') {
      uStat.liveAudioTokens += totalTok;
      uStat.liveAudioSecs += log.quantity || 0;
    } else {
      uStat.textTokens += totalTok;
    }
  });

  const userStatsList = Object.values(userStatsMap);

  let totalCostUsd = 0;
  let totalCostPln = 0;
  let totalCalls = selectedEmail ? (userStatsMap[selectedEmail]?.callsCount || 0) : validFilteredCallsCount;

  const usersToAggregate = selectedEmail
    ? userStatsList.filter(u => u.email === selectedEmail)
    : userStatsList;

  usersToAggregate.forEach(u => {
    totalCostUsd += u.costUsd;
    totalCostPln += u.costPln;
  });

  const filteredUsers = userStatsList.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSelected = selectedEmail ? u.email === selectedEmail : true;
    return matchesSearch && matchesSelected;
  });

  filteredUsers.sort((a, b) => {
    if (sortBy === 'cost_desc') return b.costUsd - a.costUsd;
    if (sortBy === 'email') return a.email.localeCompare(b.email);
    if (sortBy === 'vocab_desc') return b.vocabCount - a.vocabCount;
    if (sortBy === 'stories_desc') return b.storiesCount - a.storiesCount;
    return 0;
  });

  const allUsersSorted = [...userStatsList].sort((a, b) => b.costUsd - a.costUsd);
  const emailsMatchingSearch = allUsersSorted.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-dashboard-container animate-fade-in">
      <div className="admin-header-row">
        <div>
          <h2>Konsola Administratora</h2>
          <p className="admin-Verification-sub">
            Zweryfikowano bazę Firestore ({verificationReport.accountsVerified ?? stats.users.length} aktywnych kont) • Modele w projekcie: {activeModelsList.length} (Google Gemini)
            {verificationReport.orphansRemoved > 0 && ` • Usunięto pozostałości: ${verificationReport.orphansRemoved}`}
            {verificationReport.legacyLogsRemoved > 0 && ` • Wyczyszczono stare logi modeli: ${verificationReport.legacyLogsRemoved}`}
            {verificationReport.checkedAt && ` • Ostatnia weryfikacja: ${verificationReport.checkedAt}`}
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="btn-verify-refresh"
            onClick={runVerificationAndFetchStats}
            title="Ponownie zweryfikuj konta w Firestore oraz aktywne modele językowe"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Weryfikuj bazę i modele</span>
          </button>
          <div className="admin-badge">AI Cost Tracker & Permissions</div>
        </div>
      </div>

      {/* SEKCJA TESTERA UPRAWNIEŃ I PAKIETÓW DLA ADMINA */}
      <div className="admin-simulator-card glass-panel animate-fade-in">
        <div className="simulator-header">
          <div className="simulator-badge">TESTER UPRAWNIEŃ & BLOKAD</div>
          <h3 className="simulator-title">Przełącznik trybu testowego aplikacji</h3>
          <p className="simulator-subtitle">
            Wciel się natychmiast w dowolną rolę, aby przetestować działanie przycisków, blokad paywalla, 5 historii demonstracyjnych i ograniczeń wideo bez przechodzenia przez Stripe.
          </p>
        </div>

        <div className="simulator-roles-grid">
          <button
            type="button"
            className={`simulator-btn ${currentPreview === 'admin' ? 'active-admin' : ''}`}
            onClick={() => handleSetRole('admin')}
            disabled={roleUpdating}
          >
            <span className="role-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <div className="role-text">
              <span className="role-name">Administrator</span>
              <span className="role-desc">Pełny dostęp do wszystkiego (9999 min)</span>
            </div>
          </button>

          <button
            type="button"
            className={`simulator-btn ${currentPreview === 'starter' ? 'active-starter' : ''}`}
            onClick={() => handleSetRole('starter')}
            disabled={roleUpdating}
          >
            <span className="role-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </span>
            <div className="role-text">
              <span className="role-name">Starter (Free)</span>
              <span className="role-desc">Test blokad: 5 historii demo, blokada YouTube & tworzenia</span>
            </div>
          </button>

          <button
            type="button"
            className={`simulator-btn ${currentPreview === 'pro' ? 'active-pro' : ''}`}
            onClick={() => handleSetRole('pro')}
            disabled={roleUpdating}
          >
            <span className="role-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            <div className="role-text">
              <span className="role-name">Pro (150 min)</span>
              <span className="role-desc">Tworzenie historii, YouTube i Mastery Path odblokowane</span>
            </div>
          </button>

          <button
            type="button"
            className={`simulator-btn ${currentPreview === 'intensive' ? 'active-intensive' : ''}`}
            onClick={() => handleSetRole('intensive')}
            disabled={roleUpdating}
          >
            <span className="role-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
            <div className="role-text">
              <span className="role-name">Intensive (400 min)</span>
              <span className="role-desc">Wszystko + symulacje branżowe</span>
            </div>
          </button>
        </div>

        <div className="simulator-footer">
          <div className="simulator-status-info">
            Aktywny tryb: <strong className="simulator-active-pill">{currentPreview.toUpperCase()}</strong>
            {subscription && (
              <span className="simulator-meta"> • Pula minut Live Orb: <strong>{subscription.live_minutes_used}</strong> / <strong>{subscription.live_minutes_limit} min</strong></span>
            )}
            {statusMsg && <span className="simulator-alert animate-fade-in">{statusMsg}</span>}
          </div>
          <button
            type="button"
            className="btn-reset-minutes"
            onClick={handleResetMinutes}
            disabled={roleUpdating}
          >
            Zresetuj zużyte minuty na 0
          </button>
        </div>
      </div>

      {/* SEKCJA AKTYWNYCH MODELI JĘZYKOWYCH W PROJEKCIE */}
      <div className="admin-filter-card glass-panel animate-fade-in" style={{ marginBottom: '24px' }}>
        <div className="filter-card-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <strong>Zweryfikowane aktywne modele językowe w projekcie (wyłącznie Google Gemini):</strong>
        </div>
        <div className="admin-active-models-grid">
          {activeModelsList.map((m) => (
            <div key={m.id} className="admin-active-model-item">
              <div className="admin-active-model-top">
                <span className="admin-active-model-name">{m.name}</span>
                <code className="admin-active-model-code">{m.id}</code>
              </div>
              <span className="admin-active-model-role">{m.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-filter-card glass-panel animate-fade-in">
        <div className="filter-card-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <strong>Okres wyświetlania kosztów i zapytań:</strong>
        </div>
        <div className="filter-buttons-row">
          <button className={`filter-btn ${dateFilter === 'all_time' ? 'active' : ''}`} onClick={() => setDateFilter('all_time')}>Cały czas</button>
          <button className={`filter-btn ${dateFilter === 'this_month' ? 'active' : ''}`} onClick={() => setDateFilter('this_month')}>Bieżący miesiąc</button>
          <button className={`filter-btn ${dateFilter === 'last_2_weeks' ? 'active' : ''}`} onClick={() => setDateFilter('last_2_weeks')}>Ostatnie 2 tyg.</button>
          <button className={`filter-btn ${dateFilter === 'first_half_month' ? 'active' : ''}`} onClick={() => setDateFilter('first_half_month')}>Pierwsza połowa mc.</button>
          <button className={`filter-btn ${dateFilter === 'custom' ? 'active' : ''}`} onClick={() => setDateFilter('custom')}>Niestandardowy...</button>
        </div>

        {dateFilter === 'custom' && (
          <div className="custom-date-inputs animate-fade-in">
            <div className="date-input-group">
              <label>Od:</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="admin-date-input" />
            </div>
            <div className="date-input-group">
              <label>Do:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="admin-date-input" />
            </div>
          </div>
        )}
      </div>

      <div className="admin-summary-grid">
        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-blue">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">{selectedEmail ? "Koszty użytkownika (PLN)" : "Suma kosztów (PLN)"}</span>
            <span className="stat-card-value text-glow-blue">{totalCostPln.toFixed(2)} PLN</span>
            <span className="stat-card-subtext">{selectedEmail ? `Konto: ${selectedEmail}` : `~${totalCostUsd.toFixed(2)} USD`}</span>
          </div>
        </div>

        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-purple">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">{selectedEmail ? "Zapytania użytkownika" : "Łączna liczba zapytań"}</span>
            <span className="stat-card-value text-glow-purple">{totalCalls} zapytań</span>
            <span className="stat-card-subtext">{selectedEmail ? "Dla wybranego konta" : "Tylko aktywne modele Gemini"}</span>
          </div>
        </div>

        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-green">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Zweryfikowane konta</span>
            <span className="stat-card-value text-glow-green">{userStatsList.length}</span>
            <span className="stat-card-subtext">{selectedEmail ? `Wybrano: ${selectedEmail.split('@')[0]}` : "Aktywne konta w kolekcji users"}</span>
          </div>
        </div>
      </div>

      <div className="admin-breakdown-row">
        <div className="admin-breakdown-card glass-panel">
          <h3>Szczegółowy podział kosztów wg aktywnych modeli w projekcie {selectedEmail ? `(${selectedEmail})` : "(Wszyscy)"}</h3>
          <div className="breakdown-list">
            {Object.values(breakdownModels)
              .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls)
              .map(m => (
                <div className="breakdown-item" key={m.model}>
                  <div className="breakdown-info">
                    <span className="breakdown-name">
                      {m.name} <code className="admin-active-model-code">{m.model}</code>
                    </span>
                    <span className="breakdown-tokens">
                      {m.role} • <strong>{m.calls} zapytań</strong>
                      {m.promptTokens > 0 || m.completionTokens > 0
                        ? ` • ${(m.promptTokens + m.completionTokens).toLocaleString()} tok.`
                        : ''}
                      {m.quantity > 0 && m.model.includes('native-audio')
                        ? ` • ${m.quantity.toFixed(0)} sek. audio`
                        : ''}
                    </span>
                  </div>
                  <div className="breakdown-cost">
                    <strong>{m.costPln.toFixed(2)} PLN</strong>
                    <span>${m.costUsd.toFixed(4)} USD</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="admin-users-card glass-panel">
        <div className="users-card-header">
          <h3>Zweryfikowane konta użytkowników w Firestore ({userStatsList.length})</h3>
          <div className="users-controls">
            <div className="admin-search-wrapper">
              <svg className="admin-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Szukaj e-maila..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSelectedEmail(null); }} className="admin-search-input" />
              {searchQuery && <button className="admin-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="admin-sort-select">
              <option value="cost_desc">Sortuj: Najwyższy koszt</option>
              <option value="email">Sortuj: E-mail alfabetycznie</option>
              <option value="vocab_desc">Sortuj: Najwięcej słówek</option>
              <option value="stories_desc">Sortuj: Najwięcej historii</option>
            </select>
          </div>
        </div>

        <div className="email-pills-container">
          <button className={`email-pill ${selectedEmail === null ? 'email-pill-active' : ''}`} onClick={() => { setSelectedEmail(null); setSearchQuery(''); }}>Wszyscy ({userStatsList.length})</button>
          {emailsMatchingSearch.map(u => (
            <button key={u.email} className={`email-pill ${selectedEmail === u.email ? 'email-pill-active' : ''}`} onClick={() => setSelectedEmail(prev => prev === u.email ? null : u.email)} title={`${u.costPln.toFixed(2)} PLN | ${u.callsCount} zapytań`}>
              <span className="email-pill-dot" style={{ background: '#0f172a' }} />
              {u.email.split('@')[0]}
              <span className="email-pill-cost">{u.costPln.toFixed(2)} PLN</span>
            </button>
          ))}
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Użytkownik (Firestore)</th>
                <th>Słówka / Historie</th>
                <th>Zapytania AI</th>
                <th>Tekst (Flash Lite / 3.5)</th>
                <th>STT (3.5 Transcribe)</th>
                <th>Live Audio (2.5 Native)</th>
                <th className="text-right">Suma (PLN)</th>
                <th className="text-right">Suma (USD)</th>
                <th className="text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="9" className="no-data-cell">Brak wyników dopasowania</td></tr>
              ) : (
                filteredUsers.map(u => {
                  const isMainAdmin = u.email === 'przemek.rakotny@gmail.com' || u.email === user?.email;
                  return (
                    <tr
                      key={u.email}
                      className={[u.email === user.email ? 'current-user-row' : '', selectedEmail === u.email ? 'selected-user-row' : ''].filter(Boolean).join(' ')}
                      onClick={() => setSelectedEmail(prev => prev === u.email ? null : u.email)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="user-email-cell">
                          <strong>{u.email}</strong>
                          <span>
                            {u.full_name ? `${u.full_name} • ` : ''}
                            Zarejestrowany: {u.created_at ? u.created_at.split('T')[0].split(' ')[0] : 'b/d'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="badge-row">
                          <span className="badge badge-blue">{u.vocabCount} sł.</span>
                          <span className="badge badge-purple">{u.storiesCount} hist.</span>
                        </div>
                      </td>
                      <td>{u.callsCount}</td>
                      <td className="tokens-cell">{u.textTokens.toLocaleString()} tok.</td>
                      <td className="tokens-cell">{u.sttCalls} zap. ({u.sttTokens.toLocaleString()} tok.)</td>
                      <td className="tokens-cell">{u.liveAudioTokens.toLocaleString()} tok.</td>
                      <td className="text-right bold-text text-color-primary">{u.costPln.toFixed(2)} PLN</td>
                      <td className="text-right text-sub">${u.costUsd.toFixed(4)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {!isMainAdmin ? (
                          <button
                            type="button"
                            className="btn-delete-user-row"
                            disabled={deletingEmail === u.email}
                            onClick={(e) => handleDeleteUserAccount(e, u.email)}
                            title="Usuń konto i wszystkie jego dane z Firestore"
                          >
                            {deletingEmail === u.email ? 'Usuwanie...' : 'Usuń'}
                          </button>
                        ) : (
                          <span className="admin-owner-tag">ADMIN</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
