import React, { useMemo } from 'react';
import { HINTS_SYSTEM_ENABLED } from './hintsConfig';
import { HINTS_REGISTRY, HINT_CONTEXT_LABELS } from './shortcutsRegistry';
import { useHints } from './HintsContext';
import './Hints.css';

/**
 * Sekcja "Skróty klawiaturowe i ukryte ułatwienia" osadzana w HelpFeedback.js,
 * korzystająca z tego samego rejestru co modal (?) i pigułki podpowiedzi.
 */
const HelpShortcutsSection = () => {
  const hintsCtx = useHints();

  const grouped = useMemo(() => {
    const order = ['mastery', 'workspace', 'flashcards', 'dashboard', 'good-to-know', 'global'];
    return order
      .map((ctxKey) => ({
        context: ctxKey,
        label: HINT_CONTEXT_LABELS[ctxKey] || ctxKey,
        items: HINTS_REGISTRY.filter((item) => item.context === ctxKey),
      }))
      .filter((g) => g.items.length > 0);
  }, []);

  if (!HINTS_SYSTEM_ENABLED) return null;

  return (
    <article className="help-card help-shortcuts-card">
      <div className="help-card-header help-shortcuts-header">
        <div>
          <span className="help-module-tag">Komfort Pracy</span>
          <h2>Skróty klawiaturowe i sprytne ułatwienia</h2>
        </div>

        {hintsCtx && (
          <div className="help-shortcuts-toolbar">
            <button
              type="button"
              className="help-shortcuts-pill-btn"
              onClick={hintsCtx.openModal}
            >
              Otwórz ściągawkę (<kbd className="kbd-cap">?</kbd>)
            </button>
            <button
              type="button"
              className="help-shortcuts-pill-btn secondary"
              onClick={() => hintsCtx.setHintsEnabled(!hintsCtx.enabled)}
            >
              Podpowiedzi w nauce: {hintsCtx.enabled ? 'Włączone' : 'Wyłączone'}
            </button>
          </div>
        )}
      </div>

      <p className="help-card-lead">
        W trakcie nauki możesz sterować lektorem i ćwiczeniami z klawiatury albo używać szybkich gestów. Kontekstowe podpowiedzi znikają automatycznie, gdy tylko wypróbujesz dany skrót.
      </p>

      <div className="help-shortcuts-grid">
        {grouped.map((group) => (
          <div key={group.context} className="help-shortcuts-module">
            <h3>{group.label}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.id} className="help-shortcut-item">
                  <div className="help-shortcut-keys">
                    {item.keys.map((k) => (
                      <kbd key={k} className="kbd-cap">{k}</kbd>
                    ))}
                  </div>
                  <div className="help-shortcut-info">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
};

export default HelpShortcutsSection;

