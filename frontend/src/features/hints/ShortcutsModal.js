import React, { useMemo } from 'react';
import { HINTS_SYSTEM_ENABLED } from './hintsConfig';
import { HINTS_REGISTRY, HINT_CONTEXT_LABELS } from './shortcutsRegistry';
import { useHints } from './HintsContext';
import './Hints.css';

const ShortcutRow = ({ item, isDiscovered }) => (
  <div className="shortcuts-row">
    <div className="shortcuts-row-main">
      <div className="shortcuts-row-title">
        <span>{item.title}</span>
        {item.badge && <span className="shortcuts-type-badge">{item.badge}</span>}
        {isDiscovered && <span className="shortcuts-used-badge">Użyto ✓</span>}
      </div>
      <p className="shortcuts-row-desc">{item.description}</p>
    </div>
    <div className="shortcuts-row-keys">
      {item.keys.map((k) => (
        <kbd key={k} className="kbd-cap kbd-cap-lg">{k}</kbd>
      ))}
    </div>
  </div>
);

const ShortcutsModal = () => {
  const hintsCtx = useHints();
  const isModalOpen = Boolean(hintsCtx?.isModalOpen);
  const activeContext = hintsCtx?.activeContext || 'workspace';
  const discoveredHints = hintsCtx?.discoveredHints || {};
  const enabled = Boolean(hintsCtx?.enabled);

  const { contextItems, otherGroups } = useMemo(() => {
    const current = HINTS_REGISTRY.filter((h) => h.context === activeContext);
    const grouped = [];
    const order = ['mastery', 'workspace', 'flashcards', 'dashboard', 'good-to-know', 'global'];

    order.forEach((ctxKey) => {
      if (ctxKey === activeContext) return;
      const items = HINTS_REGISTRY.filter((h) => h.context === ctxKey);
      if (items.length > 0) {
        grouped.push({
          context: ctxKey,
          label: HINT_CONTEXT_LABELS[ctxKey] || ctxKey,
          items,
        });
      }
    });

    return { contextItems: current, otherGroups: grouped };
  }, [activeContext]);

  if (!HINTS_SYSTEM_ENABLED || !hintsCtx || !isModalOpen) return null;

  const { closeModal, setHintsEnabled, resetHints } = hintsCtx;

  return (
    <div
      className="shortcuts-modal-overlay"
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div className="shortcuts-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="shortcuts-modal-header">
          <div>
            <span className="shortcuts-modal-kicker">Centrum ułatwień Speakling</span>
            <h3 id="shortcuts-modal-title">Skróty klawiaturowe i sprytne funkcje</h3>
          </div>
          <button
            type="button"
            className="shortcuts-modal-close"
            onClick={closeModal}
            aria-label="Zamknij"
            title="Zamknij (Esc)"
          >
            ×
          </button>
        </header>

        <div className="shortcuts-modal-body">
          {contextItems.length > 0 && (
            <section className="shortcuts-group shortcuts-group-active">
              <div className="shortcuts-group-header">
                <span className="shortcuts-active-dot" />
                <h4>Na tym ekranie: {HINT_CONTEXT_LABELS[activeContext] || activeContext}</h4>
              </div>
              <div className="shortcuts-list">
                {contextItems.map((item) => (
                  <ShortcutRow
                    key={item.id}
                    item={item}
                    isDiscovered={Boolean(discoveredHints[item.id])}
                  />
                ))}
              </div>
            </section>
          )}

          {otherGroups.map((group) => (
            <section key={group.context} className="shortcuts-group">
              <div className="shortcuts-group-header">
                <h4>{group.label}</h4>
              </div>
              <div className="shortcuts-list">
                {group.items.map((item) => (
                  <ShortcutRow
                    key={item.id}
                    item={item}
                    isDiscovered={Boolean(discoveredHints[item.id])}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="shortcuts-modal-footer">
          <label className="shortcuts-toggle-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setHintsEnabled(e.target.checked)}
            />
            <span>Pokazuj kontekstowe pigułki podpowiedzi podczas nauki</span>
          </label>

          <div className="shortcuts-footer-actions">
            <button
              type="button"
              className="shortcuts-reset-btn"
              onClick={resetHints}
              title="Ponownie pokaż podpowiedzi ukryte automatycznie lub ręcznie"
            >
              Resetuj odkryte
            </button>
            <span className="shortcuts-key-tip">
              Skrót: <kbd className="kbd-cap">?</kbd>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ShortcutsModal;

