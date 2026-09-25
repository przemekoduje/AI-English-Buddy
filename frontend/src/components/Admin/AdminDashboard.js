import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import './AdminDashboard.css';

const AdminDashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [sortBy, setSortBy] = useState('cost_desc');
  const [dateFilter, setDateFilter] = useState('all_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
          headers: { "X-Session-Token": user.token }
        });
        if (!res.ok) throw new Error('Nie udało się pobrać statystyk administratora.');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user && user.token) {
      fetchStats();
    }
  }, [user]);

  if (loading) return <div className="admin-loading-container"><div className="admin-spinner"></div><p>Ładowanie statystyk...</p></div>;
  if (error) return <div className="admin-error-container glass-panel"><h3>Błąd</h3><p>{error}</p></div>;
  if (!stats) return null;

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
      if (startDate) { startLimit = new Date(startDate); startLimit.setHours(0,0,0,0); }
      if (endDate) { endLimit = new Date(endDate); endLimit.setHours(23,59,59,999); }
    }

    return stats.usage.filter(log => {
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

  stats.users.forEach(u => {
    userStatsMap[u.email] = {
      email: u.email,
      created_at: u.created_at,
      vocabCount: stats.vocab_counts[u.email] || 0,
      storiesCount: stats.story_counts[u.email] || 0,
      callsCount: 0,
      costUsd: 0.0,
      costPln: 0.0,
      textTokens: 0,
      audioTokens: 0,
      ttsChars: 0,
      whisperSecs: 0
    };
  });

  filteredUsage.forEach(log => {
    const email = log.user_email;
    if (!userStatsMap[email]) {
      userStatsMap[email] = {
        email: email,
        created_at: 'Niezarejestrowany / Usunięty',
        vocabCount: stats.vocab_counts[email] || 0,
        storiesCount: stats.story_counts[email] || 0,
        callsCount: 0,
        costUsd: 0.0,
        costPln: 0.0,
        textTokens: 0,
        audioTokens: 0,
        ttsChars: 0,
        whisperSecs: 0
      };
    }

    const uStat = userStatsMap[email];
    uStat.callsCount += 1;
    
    const cost_usd = log.cost_usd || 0;
    const cost_pln = log.cost_pln || 0;
    uStat.costUsd += cost_usd;
    uStat.costPln += cost_pln;

    const srv = (log.service || 'unknown').toLowerCase();
    const modelName = log.model || 'Nieznany model';
    
    // Model breakdown logic
    if (selectedEmail === null || selectedEmail === email) {
        const key = `${srv}_${modelName}`;
        if (!breakdownModels[key]) {
            breakdownModels[key] = {
                service: srv,
                model: modelName,
                promptTokens: 0,
                completionTokens: 0,
                quantity: 0,
                costUsd: 0,
                costPln: 0,
                calls: 0
            };
        }
        const bModel = breakdownModels[key];
        bModel.calls += 1;
        bModel.costUsd += cost_usd;
        bModel.costPln += cost_pln;
        bModel.promptTokens += log.prompt_tokens || 0;
        bModel.completionTokens += log.completion_tokens || 0;
        bModel.quantity += log.quantity || 0;
    }

    // User table stats logic
    if (modelName.includes('whisper')) {
      uStat.whisperSecs += log.quantity || 0;
    } else if (modelName.includes('tts')) {
      uStat.ttsChars += log.quantity || 0;
    } else if (srv.includes('gemini') && modelName.includes('gemini')) {
        // Assume text token based for most things, or audio for live
        // Usually gemini currently tracks by tokens or secs.
        if (log.quantity) {
             uStat.audioTokens += (log.prompt_tokens || 0) + (log.completion_tokens || 0);
        } else {
             uStat.textTokens += (log.prompt_tokens || 0) + (log.completion_tokens || 0);
        }
    } else {
      uStat.textTokens += (log.prompt_tokens || 0) + (log.completion_tokens || 0);
    }
  });

  const userStatsList = Object.values(userStatsMap);

  let totalCostUsd = 0;
  let totalCostPln = 0;
  let totalCalls = selectedEmail ? (userStatsMap[selectedEmail]?.callsCount || 0) : filteredUsage.length;

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
        <h2>Konsola Administratora</h2>
        <div className="admin-badge">AI Cost Tracker</div>
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
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="admin-date-input"/>
            </div>
            <div className="date-input-group">
              <label>Do:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="admin-date-input"/>
            </div>
          </div>
        )}
      </div>

      {stats.current_models && (
          <div className="admin-filter-card glass-panel animate-fade-in" style={{marginBottom: '24px'}}>
              <div className="filter-card-title">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <strong>Aktywne modele w aplikacji:</strong>
              </div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px'}}>
                  <span className="badge badge-blue">Gemini: {stats.current_models.gemini}</span>
                  <span className="badge badge-purple">Gemini Adv: {stats.current_models.gemini_advanced}</span>
                  <span className="badge" style={{background: '#f8f9fa', border: '1px solid #dadce0'}}>OpenAI: {stats.current_models.openai}</span>
                  <span className="badge" style={{background: '#f8f9fa', border: '1px solid #dadce0'}}>DeepSeek: {stats.current_models.deepseek}</span>
                  <span className="badge" style={{background: '#f8f9fa', border: '1px solid #dadce0'}}>TTS: {stats.current_models.tts}</span>
                  <span className="badge" style={{background: '#f8f9fa', border: '1px solid #dadce0'}}>Whisper: {stats.current_models.whisper}</span>
              </div>
          </div>
      )}

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
            <span className="stat-card-value text-glow-purple">{totalCalls} zapytania</span>
            <span className="stat-card-subtext">{selectedEmail ? "Dla wybranego konta" : "Wszystkie usługi AI"}</span>
          </div>
        </div>

        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-green">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Zarejestrowani użytkownicy</span>
            <span className="stat-card-value text-glow-green">{stats.users.length}</span>
            <span className="stat-card-subtext">{selectedEmail ? `Wybrano: ${selectedEmail.split('@')[0]}` : "Aktywne konta w Firestore"}</span>
          </div>
        </div>
      </div>

      <div className="admin-breakdown-row">
        <div className="admin-breakdown-card glass-panel">
          <h3>Szczegółowy podział kosztów wg modeli {selectedEmail ? `(${selectedEmail})` : "(Wszyscy)"}</h3>
          <div className="breakdown-list">
            
            {Object.values(breakdownModels).sort((a,b) => b.costUsd - a.costUsd).map(m => (
              <div className="breakdown-item" key={`${m.service}_${m.model}`}>
                <div className="breakdown-info">
                  <span className="breakdown-name" style={{textTransform: 'capitalize'}}>{m.service} - {m.model}</span>
                  <span className="breakdown-tokens">
                    {m.calls} zapytań
                    {m.promptTokens > 0 || m.completionTokens > 0 ? ` • ${(m.promptTokens + m.completionTokens).toLocaleString()} tok.` : ''}
                    {m.quantity > 0 && m.model.includes('whisper') ? ` • ${(m.quantity).toFixed(0)} sek.` : ''}
                    {m.quantity > 0 && m.model.includes('tts') ? ` • ${(m.quantity).toLocaleString()} znaków` : ''}
                    {m.quantity > 0 && m.service.includes('gemini') ? ` • ${(m.quantity).toFixed(0)} sek. audio` : ''}
                  </span>
                </div>
                <div className="breakdown-cost">
                  <strong>{(m.costPln).toFixed(2)} PLN</strong>
                  <span>${m.costUsd.toFixed(4)} USD</span>
                </div>
              </div>
            ))}
            {Object.keys(breakdownModels).length === 0 && (
                <div className="no-data-cell">Brak użycia w wybranym okresie.</div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-users-card glass-panel">
        <div className="users-card-header">
          <h3>Statystyki i koszty użytkowników</h3>
          <div className="users-controls">
            <div className="admin-search-wrapper">
              <svg className="admin-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Szukaj e-maila..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSelectedEmail(null); }} className="admin-search-input"/>
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
              <span className="email-pill-dot" style={{ background: `hsl(${Math.abs(u.email.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % 360}, 70%, 60%)` }} />
              {u.email.split('@')[0]}
              <span className="email-pill-cost">{u.costPln.toFixed(2)} PLN</span>
            </button>
          ))}
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Użytkownik</th>
                <th>Słówka / Historie</th>
                <th>Zapytania AI</th>
                <th>Text Tokens</th>
                <th>Audio Tokens</th>
                <th>TTS (znaki)</th>
                <th>Whisper (sek.)</th>
                <th className="text-right">Suma (PLN)</th>
                <th className="text-right">Suma (USD)</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="9" className="no-data-cell">Brak wyników dopasowania</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.email} className={[u.email === user.email ? 'current-user-row' : '', selectedEmail === u.email ? 'selected-user-row' : ''].filter(Boolean).join(' ')} onClick={() => setSelectedEmail(prev => prev === u.email ? null : u.email)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="user-email-cell">
                        <strong>{u.email}</strong>
                        <span>Zarejestrowany: {u.created_at ? u.created_at.split('T')[0] : 'b/d'}</span>
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
                    <td className="tokens-cell">{u.audioTokens.toLocaleString()} tok.</td>
                    <td>{u.ttsChars.toLocaleString()}</td>
                    <td>{u.whisperSecs.toFixed(0)}s</td>
                    <td className="text-right bold-text text-color-primary">{u.costPln.toFixed(2)} PLN</td>
                    <td className="text-right text-sub">${u.costUsd.toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
