import React, { useState, useEffect } from 'react';
import './GoodToKnow.css';

const BreathingExercise = () => {
  const [phase, setPhase] = useState('idle'); // idle, inhale, hold, exhale
  const [timeLeft, setTimeLeft] = useState(0);
  const [cycles, setCycles] = useState(0);

  useEffect(() => {
    if (phase === 'idle') return;

    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      if (phase === 'inhale') {
        setPhase('hold');
        setTimeLeft(7);
      } else if (phase === 'hold') {
        setPhase('exhale');
        setTimeLeft(8);
      } else if (phase === 'exhale') {
        setCycles(prev => prev + 1);
        setPhase('inhale');
        setTimeLeft(4);
      }
    }
  }, [phase, timeLeft]);

  const toggleExercise = () => {
    if (phase === 'idle') {
      setPhase('inhale');
      setTimeLeft(4);
      setCycles(0);
    } else {
      setPhase('idle');
      setTimeLeft(0);
    }
  };

  const getPhaseTitle = () => {
    if (phase === 'idle') return 'Gotowy?';
    if (phase === 'inhale') return 'WDECH';
    if (phase === 'hold') return 'ZATRZYMAJ';
    if (phase === 'exhale') return 'WYDECH';
  };

  const getPhaseInstruction = () => {
    if (phase === 'idle') return 'Kliknij, aby zacząć';
    if (phase === 'inhale') return 'Nosem, powoli i głęboko';
    if (phase === 'hold') return 'Utrzymaj powietrze w płucach';
    if (phase === 'exhale') return 'Ustami, swobodnie i długo';
  };

  return (
    <div className={`breathing-widget-container ${phase}`}>
      <div className="breathing-widget-glow" />
      
      {/* Header */}
      <div className="breathing-header">
        <div className="breathing-badge">
          <svg className="breath-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4" />
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.8" />
          </svg>
          Technika Oddechowa 4-7-8
        </div>
        <h3 className="breathing-title">Ćwiczenie Oddechowe</h3>
        <p className="breathing-subtitle">Przed sesją zrób kilka cykli. To wyciszy Twój układ nerwowy i przygotuje mózg do nauki.</p>
      </div>

      {/* Phase Steps Indicator */}
      <div className="breathing-steps-bar">
        <div className={`step-item ${phase === 'inhale' ? 'active inhale' : ''}`}>
          <span className="step-num">1</span>
          <span className="step-label">Wdech</span>
          <span className="step-duration">4s</span>
        </div>
        <div className="step-divider">›</div>
        <div className={`step-item ${phase === 'hold' ? 'active hold' : ''}`}>
          <span className="step-num">2</span>
          <span className="step-label">Zatrzymaj</span>
          <span className="step-duration">7s</span>
        </div>
        <div className="step-divider">›</div>
        <div className={`step-item ${phase === 'exhale' ? 'active exhale' : ''}`}>
          <span className="step-num">3</span>
          <span className="step-label">Wydech</span>
          <span className="step-duration">8s</span>
        </div>
      </div>

      {/* Circle & Animation Area */}
      <div className="breathing-stage">
        <div className="ripple-aura aura-1"></div>
        <div className="ripple-aura aura-2"></div>

        <div className={`breathing-orb ${phase}`} onClick={toggleExercise}>
          <div className="orb-content">
            <span className="orb-phase-name">{getPhaseTitle()}</span>
            {phase !== 'idle' ? (
              <span className="orb-countdown">{timeLeft}<sub>s</sub></span>
            ) : (
              <div className="orb-play-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
            <span className="orb-instruction">{getPhaseInstruction()}</span>
          </div>
        </div>
      </div>

      {/* Footer & Controls */}
      <div className="breathing-controls">
        <button className={`btn-breathing-action ${phase !== 'idle' ? 'stop' : 'start'}`} onClick={toggleExercise}>
          {phase === 'idle' ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M8 5v14l11-7z" />
              </svg>
              Rozpocznij relaks
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M6 6h12v12H6z" />
              </svg>
              Zakończ ćwiczenie
            </>
          )}
        </button>

        {cycles > 0 && (
          <div className="cycles-counter">
            <span className="cycles-icon">✨</span> Ukończone cykle: <strong>{cycles}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

const GoodToKnow = () => {
  return (
    <div className="good-to-know-container">
      <div className="good-to-know-content">
        <div className="gtk-header">
          <h2>Jak przygotować mózg do angielskiego</h2>
          <p className="subtitle">Proste zasady dla maksymalnych efektów oparte na neuronauce.</p>
        </div>

        <div className="gtk-body">
          
          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">1</span> Wyciszenie i start (Reset układu nerwowego)</h3>
            <div className="gtk-cards">
              <div className="gtk-card glass-panel">
                <h4>Zresetuj stres w 30 sekund</h4>
                <p>Przed rozpoczęciem sesji wykonaj 2–3 „fizjologiczne westchnięcia” (dwa szybkie wdechy nosem i długi wydech ustami). To fizycznie obniża tętno i wyłącza tryb walki lub ucieczki.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Rozszerz pole widzenia</h4>
                <p>Rozluźnij wzrok i obejmij nim całe pomieszczenie. Szeroka perspektywa sygnalizuje mózgowi bezpieczeństwo, przełączając go w stan otwarty na naukę.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Wyrzuć rozpraszacze na papier</h4>
                <p>Zapisz w 60 sekund wszystko, co masz dziś do zrobienia, na boku. Odciążysz pamięć roboczą i zrobisz miejsce na angielski.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Zasada mikro-startu (kontrakt na 5 minut)</h4>
                <p>Umów się ze sobą tylko na 5 minut kontaktu z aplikacją. Pokonanie oporu startowego jest kluczowe – potem zadziała bezwładność.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Mikro-odpoczynek po sesji</h4>
                <p>Po skończonej nauce posiedź 3 minuty w ciszy bez telefonu. W tym czasie mózg utrwala nowo powstałe połączenia nerwowe.</p>
              </div>
            </div>
            <BreathingExercise />
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">2</span> Trening tematyczny i przyswajanie</h3>
            <div className="gtk-cards">
              <div className="gtk-card glass-panel">
                <h4>Zasada wąskiego kontekstu (Narrow Input)</h4>
                <p>Ucz się przez kilka kolejnych dni z materiałów i tekstów o bardzo zbliżonej tematyce. Powtarzające się naturalnie słownictwo, stałe kolokacje i struktury utrwalają się automatycznie bez wkuwania, zdejmując z mózgu wysiłek ciągłego skakania po obcych dziedzinach.</p>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">3</span> Czytanie bez słownika (Wzorce zamiast analizy)</h3>
            <div className="gtk-cards">
              <div className="gtk-card glass-panel">
                <h4>Poluj na szkielet zdania</h4>
                <p>Szukaj wyłącznie schematu: <strong>Kto? + Co robi?</strong>. Reszta to tło – gdy znasz wykonawcę i czynność, rozumiesz 70% sensu.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Czytaj całymi klockami (Chunks)</h4>
                <p>Zapamiętuj gotowe zbitki słów (as far as I know, at the end of the day), a nie pojedyncze wyrazy.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Zasada czarnej skrzynki [X]</h4>
                <p>Kiedy trafiasz na nieznane słowo, wstaw w myślach znak zapytania i czytaj dalej do kropki. Kontekst zdania niemal zawsze sam wyjaśni znaczenie.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Bądź detektywem internacjonalizmów</h4>
                <p>Słowa kończące się na -tion, -able, -ment czy -ity mają zazwyczaj bezpośrednie odpowiedniki w języku polskim.</p>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">4</span> Rozumienie ze słuchu (Wyłapywanie rytmu)</h3>
            <div className="gtk-cards">
              <div className="gtk-card glass-panel">
                <h4>Słuchaj tylko słów z akcentem</h4>
                <p>Native speakerzy „połykają” słówka gramatyczne. Skup się wyłącznie na głośniejszych, wyrazistych uderzeniach rytmu (rzeczowniki, czasowniki, przeczenia).</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Mowa to jeden ciągły dźwięk</h4>
                <p>Angielski nie ma spacji (hold on brzmi jak hol-don). Zamiast szukać pojedynczych słówek, łap całe melodie wypowiedzi.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Wyłącz panikę opóźnienia</h4>
                <p>Zrozumienie często przychodzi 2 sekundy po tym, jak zdanie dobiegnie końca. Daj mózgowi chwilę na złożenie sensu z kontekstu.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Cieniowanie (Shadowing)</h4>
                <p>Powtarzaj na głos krótkie fragmenty audio, kopiując dokładnie ich intonację i melodię.</p>
              </div>
            </div>
          </div>

          <div className="gtk-section">
            <h3 className="section-title"><span className="section-number">5</span> Mówienie bez paraliżu (Komunikacja, nie egzamin)</h3>
            <div className="gtk-cards">
              <div className="gtk-card glass-panel">
                <h4>Reguła 80% prostoty</h4>
                <p>Przestań tłumaczyć skomplikowane polskie myśli 1:1. Zamiast „zaistniały nieprzewidziane okoliczności”, powiedz prosto: <em>a problem happened</em>.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Gotowe szablony na start</h4>
                <p>Używaj automatycznych zwrotów (The point is..., To be honest..., As far as I know...), by zyskać 3 sekundy na ułożenie myśli.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Opisuj zamiast się zacinać (Circumlocution)</h4>
                <p>Nie pamiętasz słowa? Opisz jego funkcję (the tool for..., the thing to open wine). Robią tak nawet rodzimi użytkownicy języka.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Głośny monolog bez świadków</h4>
                <p>Opisuj na głos proste czynności w domu lub samochodzie (I'm making tea, the traffic is terrible). Budujesz w ten sposób pamięć mięśniową aparatu mowy.</p>
              </div>
              <div className="gtk-card glass-panel">
                <h4>Naturalne pauzery</h4>
                <p>Gdy potrzebujesz chwili do namysłu, powiedz <em>Well...</em>, <em>Let me think...</em> zamiast zapadać w paraliżującą ciszę.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GoodToKnow;
