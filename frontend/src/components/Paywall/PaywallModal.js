import React, { useState } from 'react';
import { API_BASE_URL } from '../../config';
import './PaywallModal.css';

const PaywallModal = ({
  isOpen,
  onClose,
  user,
  subscription,
  initialReason = null,
  onSubscriptionUpdated = () => {}
}) => {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const currentTier = subscription?.tier || 'starter';
  const minutesUsed = subscription?.live_minutes_used || 0;
  const minutesLimit = subscription?.total_minutes_allowed || subscription?.live_minutes_limit || 5;
  const minutesRemaining = subscription?.minutes_remaining ?? Math.max(0, minutesLimit - minutesUsed);
  const usagePercentage = Math.min(100, Math.round((minutesUsed / Math.max(1, minutesLimit)) * 100));

  const handleSelectPlan = async (planKey) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingPlan(planKey);

    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        },
        body: JSON.stringify({
          plan: planKey,
          user_email: user?.email,
          return_url: window.location.origin + window.location.pathname
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Nie udało się zainicjalizować sesji płatności.');
      }

      if (data.checkout_url) {
        // Prawdziwe przekierowanie do Stripe Checkout (w tym obsługa 7-dniowego triala)
        window.location.href = data.checkout_url;
      } else if (data.demo_mode) {
        // Tryb symulacyjny (gdy brak klucza Stripe API w środowisku)
        setSuccessMsg(data.message || 'Pomyślnie zaktualizowano subskrypcję!');
        if (data.subscription) {
          onSubscriptionUpdated(data.subscription);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error('Błąd wyboru pakietu:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas połączenia z bramką płatności.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleDowngradeToStarter = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (subscription?.has_stripe_subscription) {
      // Posiadacz subskrypcji Stripe musi anulować subskrypcję w portalu klienta
      setSuccessMsg('Otwieram Stripe Customer Portal, aby zarządzać subskrypcją...');
      handleOpenCustomerPortal();
      return;
    }

    setLoadingPlan('starter');
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscription/simulate-activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        },
        body: JSON.stringify({
          tier: 'starter',
          user_email: user?.email
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Nie udało się przełączyć na plan Starter.');
      }

      setSuccessMsg(data.message || 'Pomyślnie przełączono na bezpłatny plan Starter.');
      if (data.subscription) {
        onSubscriptionUpdated(data.subscription);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Błąd podczas przełączania na plan Starter.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setErrorMsg(null);
    setLoadingPlan('portal');

    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        }
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.message || data.error || 'Nie udało się otworzyć portalu klienta.');
      }

      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Brak aktywnego profilu klienta Stripe.');
    } finally {
      setLoadingPlan(null);
    }
  };

  // Kontekstowy nagłówek w zależności od przyczyny wywołania paywalla
  const getContextualHeadline = () => {
    if (initialReason?.feature === 'mastery') {
      return {
        badge: 'ODBLOKUJ MASTERY PATH',
        title: 'Mastery Path wymaga pakietu Pro',
        subtitle: 'Uwolnij pełny potencjał 3-etapowego treningu historii (rozumienie, wymowa, parafraza) z nieograniczonym dostępem.'
      };
    }
    if (initialReason?.feature === 'media') {
      return {
        badge: 'ODBLOKUJ MEDIA BUDDY',
        title: 'Analiza wideo YouTube w pakiecie Pro',
        subtitle: 'Ucz się ze swoich ulubionych filmów, podcastów i wywiadów z natychmiastową transkrypcją i lektorem AI.'
      };
    }
    if (initialReason?.feature === 'quota' || initialReason?.reason === 'quota_exceeded') {
      return {
        badge: 'LIMIT MINUT OSIĄGNIĘTY',
        title: 'Wyczerpano minuty Live Chat Orb',
        subtitle: `Twój limit minut (${minutesLimit} min) w bieżącym okresie został osiągnięty. Wybierz pakiet Pro lub Intensive, aby kontynuować rozmowę!`
      };
    }
    if (initialReason?.feature === 'industry') {
      return {
        badge: 'PAKIET INTENSIVE / FLUENCY',
        title: 'Dedykowane symulacje branżowe',
        subtitle: 'Trenuj Business English, rozmowy kwalifikacyjne i techniczny angielski z 400 minutami lektora Live AI miesięcznie.'
      };
    }
    return {
      badge: 'PLANY & SUBSKRYPCJA',
      title: 'Inwestuj w swoją swobodę mówienia',
      subtitle: 'Przewidywalna subskrypcja z gwarancją bezpieczeństwa budżetowego. Rozpocznij 7-dniowy bezpłatny okres próbny.'
    };
  };

  const headline = getContextualHeadline();

  return (
    <div className="paywall-overlay animate-fade-in" onClick={onClose}>
      <div className="paywall-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Przycisk zamknięcia */}
        <button className="paywall-close-btn" onClick={onClose} title="Zamknij">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Nagłówek modalny */}
        <div className="paywall-header">
          <div className="paywall-badge-pill">
            <span className="badge-sparkle">✨</span>
            <span className="badge-text">{headline.badge}</span>
          </div>
          <h2 className="paywall-title">{headline.title}</h2>
          <p className="paywall-subtitle">{headline.subtitle}</p>

          {/* Wizualny pasek wykorzystania minut Live AI */}
          <div className="paywall-usage-meter">
            <div className="usage-meter-header">
              <span className="usage-meter-label">
                Pula minut Live Chat Orb ({currentTier.toUpperCase()}):
              </span>
              <span className="usage-meter-values">
                <strong>{minutesUsed.toFixed(1)}</strong> z <strong>{minutesLimit} min</strong> ({usagePercentage}%)
              </span>
            </div>
            <div className="usage-meter-track">
              <div 
                className={`usage-meter-fill ${usagePercentage >= 100 ? 'meter-exhausted' : usagePercentage >= 80 ? 'meter-warning' : ''}`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="usage-meter-footer">
              <span>Pozostało: <strong>{minutesRemaining.toFixed(1)} min</strong></span>
              {subscription?.extra_live_minutes > 0 && (
                <span className="extra-mins-tag">W tym doładowania: +{subscription.extra_live_minutes} min</span>
              )}
            </div>
          </div>
        </div>

        {/* Komunikaty błędów i sukcesu */}
        {errorMsg && (
          <div className="paywall-alert paywall-alert-error animate-fade-in">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="paywall-alert paywall-alert-success animate-fade-in">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Siatka pakietów (Tiered SaaS) */}
        <div className="paywall-cards-grid">
          {/* KARTA 1: Starter (Free) */}
          <div className={`paywall-card card-starter ${currentTier === 'starter' ? 'is-current' : ''}`}>
            <div className="card-top">
              <div className="card-tier-label">Starter</div>
              <div className="card-price-row">
                <span className="card-price">0 zł</span>
                <span className="card-period">/ darmowy na zawsze</span>
              </div>
              <p className="card-desc">Dla osób zaczynających naukę z czytaniem i podstawowymi fiszkami.</p>
            </div>

            <ul className="card-features-list">
              <li>
                <span className="check-icon">✓</span>
                <span>Nieograniczone czytanie historii</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Interaktywny słownik (Word Bank)</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Fiszki i quizy powtórkowe</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span><strong>5 minut</strong> demo Live Chat (Orb)</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Ekonomiczna synteza mowy (Edge TTS)</span>
              </li>
              <li className="feature-disabled">
                <span className="cross-icon">✕</span>
                <span>Mastery Path & Media Buddy</span>
              </li>
            </ul>

            <div className="card-action">
              {currentTier === 'starter' ? (
                <button className="plan-btn btn-current" disabled>
                  Twój obecny plan
                </button>
              ) : (
                <button 
                  className="plan-btn btn-secondary"
                  disabled={loadingPlan !== null}
                  onClick={handleDowngradeToStarter}
                >
                  {loadingPlan === 'starter' ? (
                    <span className="spinner-inline" />
                  ) : (
                    'Przełącz na Starter'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* KARTA 2: Pro (Rekomendowany) */}
          <div className={`paywall-card card-pro highlighted-card ${currentTier === 'pro' ? 'is-current' : ''}`}>
            <div className="card-ribbon">
              <span>NAJPOPULARNIEJSZY · 7 DNI FREE</span>
            </div>

            <div className="card-top">
              <div className="card-tier-label">Pro</div>
              <div className="card-price-row">
                <span className="card-price">49 zł</span>
                <span className="card-period">/ miesięcznie</span>
              </div>
              <p className="card-desc">Pełny zestaw narzędzi edukacyjnych i codzienna swoboda mówienia.</p>
            </div>

            <ul className="card-features-list">
              <li>
                <span className="check-icon check-purple">✓</span>
                <span><strong>150 minut</strong> Live Chat Orb miesięcznie</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span>Pełny dostęp do <strong>Mastery Path</strong></span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span><strong>Media Buddy</strong> (filmy i YouTube)</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span>Inteligentne raporty & eksport słownictwa</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span>Wysokiej jakości synteza głosu lektora</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span><strong>7 dni darmowego okresu próbnego</strong></span>
              </li>
            </ul>

            <div className="card-action">
              {currentTier === 'pro' ? (
                <button className="plan-btn btn-current" disabled>
                  Twój obecny plan (Pro)
                </button>
              ) : (
                <button 
                  className="plan-btn btn-primary-pro"
                  disabled={loadingPlan !== null}
                  onClick={() => handleSelectPlan('pro')}
                >
                  {loadingPlan === 'pro' ? (
                    <span className="spinner-inline" />
                  ) : (
                    'Wypróbuj 7 dni bezpłatnie'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* KARTA 3: Intensive / Fluency */}
          <div className={`paywall-card card-intensive ${currentTier === 'intensive' ? 'is-current' : ''}`}>
            <div className="card-top">
              <div className="card-tier-label">Intensive / Fluency</div>
              <div className="card-price-row">
                <span className="card-price">99 zł</span>
                <span className="card-period">/ miesięcznie</span>
              </div>
              <p className="card-desc">Dla profesjonalistów dążących do natychmiastowej płynności językowej.</p>
            </div>

            <ul className="card-features-list">
              <li>
                <span className="check-icon check-blue">✓</span>
                <span><strong>400 minut</strong> Live Chat Orb miesięcznie</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span>Wszystko z planu Pro (Mastery + Media)</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span><strong>Symulacje branżowe</strong> (Business English, Tech)</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span>Opcja dokupienia paczki <strong>+60 min</strong> (+29 zł)</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span>Priorytetowe połączenia i najnowsze modele audio</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span><strong>7 dni darmowego okresu próbnego</strong></span>
              </li>
            </ul>

            <div className="card-action">
              {currentTier === 'intensive' ? (
                <button className="plan-btn btn-current" disabled>
                  Twój obecny plan (Intensive)
                </button>
              ) : (
                <button 
                  className="plan-btn btn-primary-intensive"
                  disabled={loadingPlan !== null}
                  onClick={() => handleSelectPlan('intensive')}
                >
                  {loadingPlan === 'intensive' ? (
                    <span className="spinner-inline" />
                  ) : (
                    'Wybierz Intensive (7 dni free)'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dolna sekcja: Doładowanie dodatkowych minut (Top-up) oraz Customer Portal */}
        <div className="paywall-bottom-addons">
          <div className="addon-card glass-subpanel">
            <div className="addon-info">
              <div className="addon-title-row">
                <span className="addon-icon">⚡</span>
                <span className="addon-title">Paczka dodatkowych 60 minut Live Orb</span>
                <span className="addon-price">29 zł jednorazowo</span>
              </div>
              <p className="addon-desc">
                {currentTier === 'starter'
                  ? 'Paczka dodatkowych minut jest dostępna dla subskrybentów planu Pro i Intensive. Uaktualnij pakiet, aby móc dokupować dodatkowy czas.'
                  : 'Zabrakło Ci minut przed końcem miesiąca? Dokup jednorazowy pakiet 60 minut bez zmiany obecnej subskrypcji.'}
              </p>
            </div>
            {currentTier === 'starter' ? (
              <button 
                className="addon-buy-btn addon-btn-upgrade"
                disabled={loadingPlan !== null}
                onClick={() => handleSelectPlan('pro')}
              >
                Odblokuj w pakiecie Pro
              </button>
            ) : (
              <button 
                className="addon-buy-btn"
                disabled={loadingPlan !== null}
                onClick={() => handleSelectPlan('topup_60')}
              >
                {loadingPlan === 'topup_60' ? (
                  <span className="spinner-inline" />
                ) : (
                  'Dokup +60 min (29 zł)'
                )}
              </button>
            )}
          </div>

          {subscription?.has_stripe_subscription && (
            <div className="portal-management-row">
              <span>Chcesz zmienić kartę płatniczą lub pobrać faktury VAT?</span>
              <button 
                className="portal-link-btn" 
                onClick={handleOpenCustomerPortal}
                disabled={loadingPlan === 'portal'}
              >
                {loadingPlan === 'portal' ? 'Ładowanie portalu...' : 'Otwórz Stripe Customer Portal →'}
              </button>
            </div>
          )}
        </div>

        {/* Informacja prawna i gwarancja */}
        <div className="paywall-footer-note">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>
            Bezpieczna autoryzacja Stripe. 7-dniowy okres próbny — karta nie zostanie obciążona przed upływem 7 dni. Możesz anulować w dowolnym momencie bez opłat.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaywallModal;
