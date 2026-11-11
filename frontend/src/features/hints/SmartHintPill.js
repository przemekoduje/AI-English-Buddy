import React from 'react';
import { HINTS_SYSTEM_ENABLED } from './hintsConfig';
import { HINTS_REGISTRY } from './shortcutsRegistry';
import { useHints } from './HintsContext';
import './Hints.css';

/**
 * Kontekstowa mikro-podpowiedź z mechanizmem Auto-Graduate:
 * znika automatycznie po użyciu skrótu (lub po kliknięciu ×) i chowa się na dotyku,
 * jeśli skrót dotyczy wyłącznie klawiatury.
 */
const SmartHintPill = ({ hintId, active = true, floating = false, className = '' }) => {
  const hintsCtx = useHints();
  if (!HINTS_SYSTEM_ENABLED || !hintsCtx || !active) return null;

  const { enabled, discoveredHints, dismissedHints, justDiscoveredId, dismissHint, openModal } = hintsCtx;
  if (!enabled) return null;

  const isJustConfirmed = justDiscoveredId === hintId;
  const alreadyDiscovered = Boolean(discoveredHints[hintId]);
  const alreadyDismissed = Boolean(dismissedHints[hintId]);

  if (alreadyDismissed) return null;
  if (alreadyDiscovered && !isJustConfirmed) return null;

  const entry = HINTS_REGISTRY.find((item) => item.id === hintId);
  if (!entry) return null;

  return (
    <div
      className={`smart-hint-pill ${entry.desktopOnly ? 'hint-desktop-only' : ''} ${floating ? 'hint-floating' : ''} ${isJustConfirmed ? 'hint-confirmed' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="smart-hint-badge-dot" aria-hidden="true">
        {isJustConfirmed ? '✓' : '💡'}
      </span>

      <span className="smart-hint-keys">
        {entry.keys.map((k) => (
          <kbd key={k} className="kbd-cap">{k}</kbd>
        ))}
      </span>

      <span className="smart-hint-text">
        {isJustConfirmed ? 'Świetnie! Skrót zapamiętany' : (entry.shortHint || entry.title)}
      </span>

      {!isJustConfirmed && (
        <div className="smart-hint-actions">
          <button
            type="button"
            className="smart-hint-more-btn"
            onClick={openModal}
            title="Pokaż wszystkie skróty (?)"
          >
            Więcej (?)
          </button>
          <button
            type="button"
            className="smart-hint-close-btn"
            onClick={() => dismissHint(hintId)}
            title="Rozumiem, ukryj podpowiedź"
            aria-label="Ukryj podpowiedź"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartHintPill;

