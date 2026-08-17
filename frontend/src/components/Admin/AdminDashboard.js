import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import './AdminDashboard.css';

const AdminDashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('cost_desc'); // cost_desc, email, vocab_desc, stories_desc

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/admin/stats`, {
          headers: { "X-Session-Token": user.token }
        });
        if (!res.ok) {
          throw new Error('Nie udało się pobrać statystyk administratora.');
        }
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

  if (loading) {
    return (
      <div className="admin-loading-container">
        <div className="admin-spinner"></div>
        <p>Ładowanie statystyk administratora...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-container glass-panel">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--accent-red)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h3>Błąd</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  // Process data per user
  const userStatsMap = {};

  stats.users.forEach(u => {
    userStatsMap[u.email] = {
      email: u.email,
      created_at: u.created_at,
      vocabCount: stats.vocab_counts[u.email] || 0,
      storiesCount: stats.story_counts[u.email] || 0,
      callsCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      ttsChars: 0,
      whisperSecs: 0,
      costUsd: 0.0,
      costPln: 0.0,
      openaiCost: 0.0,
      deepseekCost: 0.0,
      whisperCost: 0.0,
      ttsCost: 0.0,
    };
  });

  // If there are entries in usage for unregistered/deleted users, let's create a placeholder
  stats.usage.forEach(log => {
    const email = log.user_email;
    if (!userStatsMap[email]) {
      userStatsMap[email] = {
        email: email,
        created_at: 'Niezarejestrowany / Usunięty',
        vocabCount: stats.vocab_counts[email] || 0,
        storiesCount: stats.story_counts[email] || 0,
        callsCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        ttsChars: 0,
        whisperSecs: 0,
        costUsd: 0.0,
        costPln: 0.0,
        openaiCost: 0.0,
        deepseekCost: 0.0,
        whisperCost: 0.0,
        ttsCost: 0.0,
      };
    }

    const uStat = userStatsMap[email];
    uStat.callsCount += 1;
    
    const cost_usd = log.cost_usd || 0;
    const cost_pln = log.cost_pln || 0;
    uStat.costUsd += cost_usd;
    uStat.costPln += cost_pln;

    if (log.service === 'openai') {
      if (log.model && log.model.includes('whisper')) {
        uStat.whisperSecs += log.quantity || 0;
        uStat.whisperCost += cost_usd;
      } else if (log.model && log.model.includes('tts')) {
        uStat.ttsChars += log.quantity || 0;
        uStat.ttsCost += cost_usd;
      } else {
        uStat.promptTokens += log.prompt_tokens || 0;
        uStat.completionTokens += log.completion_tokens || 0;
        uStat.openaiCost += cost_usd;
      }
    } else if (log.service === 'deepseek') {
      uStat.promptTokens += log.prompt_tokens || 0;
      uStat.completionTokens += log.completion_tokens || 0;
      uStat.deepseekCost += cost_usd;
    }
  });

  const userStatsList = Object.values(userStatsMap);

  // Global aggregate stats
  let totalCostUsd = 0;
  let totalCostPln = 0;
  let totalOpenaiTextCost = 0;
  let totalDeepseekCost = 0;
  let totalWhisperCost = 0;
  let totalTtsCost = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTtsChars = 0;
  let totalWhisperSecs = 0;
  let totalCalls = stats.usage.length;

  userStatsList.forEach(u => {
    totalCostUsd += u.costUsd;
    totalCostPln += u.costPln;
    totalOpenaiTextCost += u.openaiCost;
    totalDeepseekCost += u.deepseekCost;
    totalWhisperCost += u.whisperCost;
    totalTtsCost += u.ttsCost;
    totalPromptTokens += u.promptTokens;
    totalCompletionTokens += u.completionTokens;
    totalTtsChars += u.ttsChars;
    totalWhisperSecs += u.whisperSecs;
  });

  // Filter & Sort
  const filteredUsers = userStatsList.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  filteredUsers.sort((a, b) => {
    if (sortBy === 'cost_desc') return b.costUsd - a.costUsd;
    if (sortBy === 'email') return a.email.localeCompare(b.email);
    if (sortBy === 'vocab_desc') return b.vocabCount - a.vocabCount;
    if (sortBy === 'stories_desc') return b.storiesCount - a.storiesCount;
    return 0;
  });

  return (
    <div className="admin-dashboard-container animate-fade-in">
      <div className="admin-header-row">
        <h2>Konsola Administratora</h2>
        <div className="admin-badge">AI Cost Tracker</div>
      </div>

      {/* Overview Cards */}
      <div className="admin-summary-grid">
        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-blue">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Suma kosztów (PLN)</span>
            <span className="stat-card-value text-glow-blue">{totalCostPln.toFixed(2)} PLN</span>
            <span className="stat-card-subtext">~{totalCostUsd.toFixed(2)} USD</span>
          </div>
        </div>

        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-purple">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Łączna liczba zapytań</span>
            <span className="stat-card-value text-glow-purple">{totalCalls} zapytania</span>
            <span className="stat-card-subtext">Wszystkie usługi AI</span>
          </div>
        </div>

        <div className="admin-stat-card glass-panel">
          <div className="stat-card-icon text-glow-green">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Zarejestrowani użytkownicy</span>
            <span className="stat-card-value text-glow-green">{stats.users.length}</span>
            <span className="stat-card-subtext">Aktywne konta w Firestore</span>
          </div>
        </div>
      </div>

      {/* Service Breakdown */}
      <div className="admin-breakdown-row">
        <div className="admin-breakdown-card glass-panel">
          <h3>Szczegółowy podział kosztów</h3>
          <div className="breakdown-list">
            
            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="breakdown-name">OpenAI GPT-4o-mini (Text)</span>
                <span className="breakdown-tokens">{totalPromptTokens.toLocaleString()} prompt / {totalCompletionTokens.toLocaleString()} completion</span>
              </div>
              <div className="breakdown-cost">
                <strong>{(totalOpenaiTextCost * 4.0).toFixed(2)} PLN</strong>
                <span>${totalOpenaiTextCost.toFixed(4)} USD</span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="breakdown-name">DeepSeek Chat (Text)</span>
                <span className="breakdown-tokens">Kompatybilne modele</span>
              </div>
              <div className="breakdown-cost">
                <strong>{(totalDeepseekCost * 4.0).toFixed(2)} PLN</strong>
                <span>${totalDeepseekCost.toFixed(4)} USD</span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="breakdown-name">OpenAI Whisper (Speech to Text)</span>
                <span className="breakdown-tokens">{(totalWhisperSecs / 60.0).toFixed(1)} minut ({(totalWhisperSecs).toFixed(0)} sek.)</span>
              </div>
              <div className="breakdown-cost">
                <strong>{(totalWhisperCost * 4.0).toFixed(2)} PLN</strong>
                <span>${totalWhisperCost.toFixed(4)} USD</span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="breakdown-name">OpenAI TTS (Text to Speech)</span>
                <span className="breakdown-tokens">{totalTtsChars.toLocaleString()} wygenerowanych znaków</span>
              </div>
              <div className="breakdown-cost">
                <strong>{(totalTtsCost * 4.0).toFixed(2)} PLN</strong>
                <span>${totalTtsCost.toFixed(4)} USD</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="admin-users-card glass-panel">
        <div className="users-card-header">
          <h3>Statystyki i koszty użytkowników</h3>
          <div className="users-controls">
            <input 
              type="text" 
              placeholder="Filtruj po e-mailu..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
            />
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="admin-sort-select"
            >
              <option value="cost_desc">Sortuj: Najwyższy koszt</option>
              <option value="email">Sortuj: E-mail alfabetycznie</option>
              <option value="vocab_desc">Sortuj: Najwięcej słówek</option>
              <option value="stories_desc">Sortuj: Najwięcej historii</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Użytkownik (E-mail)</th>
                <th>Słówka / Historie</th>
                <th>Zapytania AI</th>
                <th>GPT / DeepSeek</th>
                <th>TTS (znaki)</th>
                <th>Whisper (sek.)</th>
                <th className="text-right">Suma (PLN)</th>
                <th className="text-right">Suma (USD)</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data-cell">Brak wyników dopasowania</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.email} className={u.email === user.email ? 'current-user-row' : ''}>
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
                    <td className="tokens-cell">
                      <span>{(u.promptTokens + u.completionTokens).toLocaleString()} tok.</span>
                    </td>
                    <td>{u.ttsChars.toLocaleString()}</td>
                    <td>{u.whisperSecs.toFixed(0)}s</td>
                    <td className="text-right bold-text text-color-primary">
                      {u.costPln.toFixed(2)} PLN
                    </td>
                    <td className="text-right text-sub">
                      ${u.costUsd.toFixed(4)}
                    </td>
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
