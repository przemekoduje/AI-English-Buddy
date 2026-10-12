import React, { useState } from 'react';
import { API_BASE_URL } from '../../config';
import './HelpFeedback.css';

const HelpFeedback = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'troubleshooting' | 'feedback'
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // { type: 'success' | 'error', text: string }

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setSubmitStatus({ type: 'error', text: 'Proszę wpisać treść wiadomości przed wysłaniem.' });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        },
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: email.trim() || user?.email || 'guest@speakling.ai'
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSubmitStatus({
          type: 'success',
          text: data.message || 'Dziękujemy! Twoja opinia została pomyślnie wysłana i przekazana do zespołu.'
        });
        setMessage('');
      } else {
        setSubmitStatus({
          type: 'error',
          text: data.error || 'Wystąpił problem podczas wysyłania wiadomości. Spróbuj ponownie za chwilę.'
        });
      }
    } catch (err) {
      setSubmitStatus({
        type: 'error',
        text: 'Błąd połączenia z serwerem. Sprawdź połączenie internetowe i spróbuj ponownie.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="help-feedback-container">
      <div className="help-feedback-wrapper">
        
        {/* Header */}
        <header className="help-header">
          <span className="help-kicker">Centrum Pomocy & Opinie</span>
          <h1 className="help-title">Help & Feedback</h1>
          <p className="help-subtitle">
            Dowiedz się jak w pełni wykorzystać możliwości Speakling, rozwiąż ewentualne problemy techniczne lub podziel się z nami swoimi sugestiami i uwagami.
          </p>

          <div className="help-nav-tabs">
            <button 
              className={`help-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              Przewodnik po platformie
            </button>
            <button 
              className={`help-tab-btn ${activeTab === 'troubleshooting' ? 'active' : ''}`}
              onClick={() => setActiveTab('troubleshooting')}
            >
              Rozwiązywanie problemów & FAQ
            </button>
            <button 
              className={`help-tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
              onClick={() => setActiveTab('feedback')}
            >
              Prześlij feedback lub zgłoś błąd
            </button>
          </div>
        </header>

        {/* Tab 1: Przewodnik po platformie */}
        {activeTab === 'guide' && (
          <div className="help-section-content">
            
            <article className="help-card">
              <div className="help-card-header">
                <span className="help-module-tag">Moduł Konwersacji</span>
                <h2>Chat Live (Rozmowa z lektorem AI)</h2>
              </div>
              <p className="help-card-lead">
                Chat Live pozwala na naturalną, płynną rozmowę głosową z inteligentnym native speakerem. AI słucha Twojej wypowiedzi, odpowiada na żywo i wspiera Cię w pokonywaniu bariery językowej.
              </p>
              <ul className="help-feature-list">
                <li>
                  <strong>Dwa tryby rozmowy:</strong> Zaawansowany model Gemini Live (naturalny dialog audio w czasie rzeczywistym) oraz tryb Classic (silnik transkrypcji mowy i odpowiedzi tekstowej).
                </li>
                <li>
                  <strong>Korekta błędów i polskie wtrącenia:</strong> Jeśli w trakcie mówienia zabraknie Ci słowa i powiesz je po polsku, lektor natychmiast podpowie właściwy angielski odpowiednik w naturalnym kontekście zdania.
                </li>
                <li>
                  <strong>Udostępnianie ekranu i kamera:</strong> Możesz udostępnić lektorowi swój ekran lub obraz z kamery, aby wspólnie analizować artykuł, prezentację lub sytuację na żywo.
                </li>
                <li>
                  <strong>Podsumowanie sesji (Session Summary):</strong> Po zakończeniu rozmowy otrzymujesz kompleksowy raport z punktacją, listą nowo poznanego słownictwa oraz omówieniem kwestii do powtórzenia.
                </li>
              </ul>
            </article>

            <article className="help-card">
              <div className="help-card-header">
                <span className="help-module-tag">Moduł Tekstowy</span>
                <h2>Practice Room & Generator Opowieści (Workspace)</h2>
              </div>
              <p className="help-card-lead">
                Serce treningu biernego i leksykalnego. Ucz się angielskiego przez wciągające historie dopasowane do Twojego poziomu.
              </p>
              <ul className="help-feature-list">
                <li>
                  <strong>Tworzenie i kontynuowanie historii:</strong> Wpisz dowolny pomysł lub wybierz temat. Dzięki przyciskowi "Continue Story" możesz rozwijać opowiadanie o kolejne części, a sztuczna inteligencja zachowuje pełny kontekst postaci i fabuły.
                </li>
                <li>
                  <strong>Lektor zsynchronizowany z tekstem:</strong> Kliknij przycisk odtwarzania, aby słuchać lektora z precyzyjnym podświetlaniem aktualnie czytanego zdania.
                </li>
                <li>
                  <strong>Tłumaczenie jednym kliknięciem:</strong> Kliknij na dowolne słowo lub zaznacz fragment tekstu, aby natychmiast wyświetlić polskie tłumaczenie i dodać je do własnego notesu.
                </li>
              </ul>
            </article>

            <article className="help-card">
              <div className="help-card-header">
                <span className="help-module-tag">Słownictwo & Pamięć</span>
                <h2>My Vocabulary (Word Bank & Inteligentne Powtórki)</h2>
              </div>
              <p className="help-card-lead">
                Automatyczny system utrwalania słówek oparty na algorytmie powtórek w optymalnych odstępach czasu (Spaced Repetition).
              </p>
              <ul className="help-feature-list">
                <li>
                  <strong>Zeszyt słówek:</strong> Każde słowo dodane podczas czytania lub rozmowy trafia do Twojej bazy z przykładem użycia i wymową.
                </li>
                <li>
                  <strong>Fiszki i quizy:</strong> Trenuj pamięć z wykorzystaniem interaktywnych fiszek oraz quizów sprawdzających rozumienie słów w pełnym zdaniu.
                </li>
                <li>
                  <strong>Eksport słownictwa:</strong> Możliwość wysłania zestawu słówek na swój adres e-mail lub pobrania do wydruku.
                </li>
              </ul>
            </article>

            <article className="help-card">
              <div className="help-card-header">
                <span className="help-module-tag">Zasady Treningu</span>
                <h2>Your Daily Practice (Licznik dziennego zaangażowania)</h2>
              </div>
              <p className="help-card-lead">
                Licznik w lewym panelu pomaga utrzymać regularność w nauce angielskiego.
              </p>
              <ul className="help-feature-list">
                <li>
                  <strong>Realny czas nauki:</strong> System zlicza czas tylko wtedy, gdy aktywnie korzystasz z platformy — rozmawiasz w Chat Live, rozwiązujesz ćwiczenia, słuchasz lektora lub czytasz.
                </li>
                <li>
                  <strong>Ochrona przed bezczynnością:</strong> Jeśli odejdziesz od komputera na ponad 45 sekund, naliczanie automatycznie się zatrzymuje, dając Ci rzetelny obraz włożonej pracy.
                </li>
                <li>
                  <strong>Dzienny cel:</strong> Rekomendowany dzienny cel to 20 minut regularnego kontaktu z językiem każdego dnia.
                </li>
              </ul>
            </article>

          </div>
        )}

        {/* Tab 2: Rozwiązywanie problemów & FAQ */}
        {activeTab === 'troubleshooting' && (
          <div className="help-section-content">
            
            <div className="faq-grid">
              
              <div className="faq-item">
                <h3>Brak dostępu do mikrofonu w przeglądarce</h3>
                <p>
                  Upewnij się, że przeglądarka posiada uprawnienia do nagrywania dźwięku. W przeglądarce Google Chrome kliknij ikonę kłódki lub suwaków po lewej stronie paska adresu URL i upewnij się, że opcja „Mikrofon” jest ustawiona na „Zezwalaj”. Następnie odśwież stronę.
                </p>
              </div>

              <div className="faq-item">
                <h3>Echo lub powtarzanie wypowiedzi lektora</h3>
                <p>
                  Gdy mikrofon wychwytuje dźwięk dochodzący z Twoich głośników, może powstać pętla akustyczna. Zdecydowanie zalecamy korzystanie ze słuchawek podczas sesji Chat Live, aby zapewnić najwyższą czystość dźwięku i bezbłędne rozpoznawanie mowy.
                </p>
              </div>

              <div className="faq-item">
                <h3>Czy potrzebuję własnego klucza API?</h3>
                <p>
                  Nie, platforma posiada domyślnie skonfigurowane modele. Jeśli jednak chcesz korzystać z własnego klucza Google AI Studio (Gemini), możesz go bezpiecznie wprowadzić w oknie ustawień Chat Live.
                </p>
              </div>

              <div className="faq-item">
                <h3>Przerywanie połączenia WebSocket w Chat Live</h3>
                <p>
                  Połączenie z modelem Gemini Live wymaga stabilnego łącza internetowego. Jeśli połączenie zostanie przerwane, kliknij przycisk „Zakończ” i rozpocznij sesję ponownie.
                </p>
              </div>

              <div className="faq-item">
                <h3>Jak działa limit minut rozmów Live?</h3>
                <p>
                  Każda sekunda aktywnej rozmowy jest precyzyjnie odejmowana z Twojej puli w planie subskrypcyjnym. Jeśli skończą Ci się minuty, możesz doładować konto lub przełączyć się jednym kliknięciem na tryb Classic.
                </p>
              </div>

              <div className="faq-item">
                <h3>Synchronizacja postępów między urządzeniami</h3>
                <p>
                  Wszystkie Twoje opowiadania, słówka i statystyki są bezpiecznie zapisywane w chmurze i przypisane do Twojego konta e-mail. Po zalogowaniu na innym komputerze lub telefonie masz natychmiastowy dostęp do wszystkich materiałów.
                </p>
              </div>

            </div>

            <div className="help-contact-box">
              <h3>Potrzebujesz bezpośredniej pomocy?</h3>
              <p>Napisz do nas bezpośrednio na adres: <strong>kontakt@przemokoduje.com</strong></p>
            </div>

          </div>
        )}

        {/* Tab 3: Formularz opinii i zgłoszeń */}
        {activeTab === 'feedback' && (
          <div className="help-section-content">
            <div className="feedback-form-card">
              <h2>Prześlij opinię lub zgłoś usterkę</h2>
              <p className="feedback-intro">
                Twoje uwagi mają bezpośredni wpływ na rozwój Speakling. Niezależnie od tego, czy masz pomysł na nową funkcję, napotkałeś błąd czy chcesz podzielić się wrażeniami z nauki — czekamy na Twoją wiadomość!
              </p>

              {submitStatus && (
                <div className={`feedback-alert ${submitStatus.type}`}>
                  <span>{submitStatus.text}</span>
                  <button 
                    type="button" 
                    className="alert-dismiss" 
                    onClick={() => setSubmitStatus(null)}
                  >
                    ×
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} className="feedback-form">
                
                <div className="form-group">
                  <label htmlFor="fb-category">Kategoria zgłoszenia</label>
                  <select 
                    id="fb-category" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-select"
                  >
                    <option value="suggestion">Pomysł na nową funkcję / Rozwój aplikacji</option>
                    <option value="bug">Zgłoszenie błędu / Problem techniczny</option>
                    <option value="praise">Pozytywna opinia / Wrażenia z nauki</option>
                    <option value="question">Pytanie dotyczące działania platformy</option>
                    <option value="other">Inna sprawa</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="fb-email">Twój adres e-mail do odpowiedzi</label>
                  <input 
                    type="email" 
                    id="fb-email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="twoj-email@example.com"
                    className="form-input"
                  />
                  <span className="form-hint">Na ten adres prześlemy odpowiedź, jeśli zgłoszenie wymaga kontaktu.</span>
                </div>

                <div className="form-group">
                  <label htmlFor="fb-message">Treść Twojej wiadomości</label>
                  <textarea 
                    id="fb-message" 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Opisz swój pomysł, zaobserwowany problem lub podziel się wrażeniami..."
                    rows={6}
                    className="form-textarea"
                    required
                  />
                  <span className="form-hint">Im dokładniejszy opis, tym szybciej będziemy mogli wprowadzić ulepszenia.</span>
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn-submit-feedback"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Wysyłanie wiadomości...' : 'Wyślij wiadomość'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HelpFeedback;
