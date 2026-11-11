import React from 'react';
import { HINTS_SYSTEM_ENABLED } from './hintsConfig';
import { useHints } from './HintsContext';

/**
 * Kompaktowy przycisk (?) do TopBar otwierający modal skrótów i ułatwień.
 */
const ShortcutsTriggerButton = () => {
  const hintsCtx = useHints();
  if (!HINTS_SYSTEM_ENABLED || !hintsCtx) return null;

  return (
    <button
      type="button"
      className="topbar-icon-btn hints-trigger-btn"
      onClick={hintsCtx.openModal}
      title="Skróty i ułatwienia (?)"
      aria-label="Skróty i ułatwienia"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  );
};

export default ShortcutsTriggerButton;

