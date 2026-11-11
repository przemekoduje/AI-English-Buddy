import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { HINTS_SYSTEM_ENABLED, HINTS_STORAGE_KEYS } from './hintsConfig';

const HintsContext = createContext(null);

const readStoredJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const readStoredBool = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch (e) {
    return fallback;
  }
};

/**
 * Zgłasza użycie skrótu/ułatwienia (mechanizm Auto-Graduate).
 * Bezpieczne do wywołania z dowolnego komponentu — jeśli HintsProvider nie istnieje
 * lub system jest wyłączony, zdarzenie jest po prostu ignorowane.
 */
export const emitHintUsed = (hintId) => {
  if (!HINTS_SYSTEM_ENABLED || !hintId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('speakling:hint-used', { detail: { id: hintId } }));
};

/**
 * Rejestruje tymczasowy kontekst podrzędny (np. 'mastery' lub 'flashcards')
 * na czas życia zamontowanego komponentu nakładkowego.
 */
export const useRegisterHintContext = (contextId, isActive = true) => {
  useEffect(() => {
    if (!HINTS_SYSTEM_ENABLED || !isActive || !contextId || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('speakling:hint-context', { detail: { contextId, active: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('speakling:hint-context', { detail: { contextId, active: false } }));
    };
  }, [contextId, isActive]);
};

export const HintsProvider = ({ currentView = 'workspace', children }) => {
  const [hintsEnabled, setHintsEnabledState] = useState(() =>
    readStoredBool(HINTS_STORAGE_KEYS.USER_ENABLED, true)
  );
  const [discoveredHints, setDiscoveredHints] = useState(() =>
    readStoredJson(HINTS_STORAGE_KEYS.DISCOVERED, {})
  );
  const [dismissedHints, setDismissedHints] = useState(() =>
    readStoredJson(HINTS_STORAGE_KEYS.DISMISSED, {})
  );
  const [subContextStack, setSubContextStack] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [justDiscoveredId, setJustDiscoveredId] = useState(null);
  const confirmTimerRef = useRef(null);

  const activeContext = subContextStack.length > 0
    ? subContextStack[subContextStack.length - 1]
    : (currentView || 'workspace');

  const setHintsEnabled = useCallback((enabled) => {
    const val = Boolean(enabled);
    setHintsEnabledState(val);
    try {
      localStorage.setItem(HINTS_STORAGE_KEYS.USER_ENABLED, String(val));
    } catch (e) {}
  }, []);

  const markDiscovered = useCallback((hintId) => {
    if (!hintId) return;
    setDiscoveredHints((prev) => {
      if (prev[hintId]) return prev;
      const next = { ...prev, [hintId]: true };
      try {
        localStorage.setItem(HINTS_STORAGE_KEYS.DISCOVERED, JSON.stringify(next));
      } catch (e) {}
      setJustDiscoveredId(hintId);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        setJustDiscoveredId((curr) => (curr === hintId ? null : curr));
      }, 1400);
      return next;
    });
  }, []);

  const dismissHint = useCallback((hintId) => {
    if (!hintId) return;
    setDismissedHints((prev) => {
      if (prev[hintId]) return prev;
      const next = { ...prev, [hintId]: true };
      try {
        localStorage.setItem(HINTS_STORAGE_KEYS.DISMISSED, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const resetHints = useCallback(() => {
    setDiscoveredHints({});
    setDismissedHints({});
    setJustDiscoveredId(null);
    try {
      localStorage.removeItem(HINTS_STORAGE_KEYS.DISCOVERED);
      localStorage.removeItem(HINTS_STORAGE_KEYS.DISMISSED);
    } catch (e) {}
  }, []);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  useEffect(() => {
    if (!HINTS_SYSTEM_ENABLED) return;
    const onHintUsed = (e) => {
      const id = e?.detail?.id;
      if (id) markDiscovered(id);
    };
    const onContextChange = (e) => {
      const { contextId, active } = e?.detail || {};
      if (!contextId) return;
      setSubContextStack((prev) => {
        if (active) {
          return prev[prev.length - 1] === contextId ? prev : [...prev, contextId];
        }
        return prev.filter((item) => item !== contextId);
      });
    };

    window.addEventListener('speakling:hint-used', onHintUsed);
    window.addEventListener('speakling:hint-context', onContextChange);
    return () => {
      window.removeEventListener('speakling:hint-used', onHintUsed);
      window.removeEventListener('speakling:hint-context', onContextChange);
    };
  }, [markDiscovered]);

  // Globalny skrót `?` (otwórz/zamknij modal) i `Escape` (zamknij modal)
  useEffect(() => {
    if (!HINTS_SYSTEM_ENABLED) return;
    const handleGlobalKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) {
        return;
      }
      if (isModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setIsModalOpen(false);
          return;
        }
        if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          e.preventDefault();
          e.stopPropagation();
          setIsModalOpen(false);
          return;
        }
        if (['ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key) || e.code === 'Space' || e.key?.toLowerCase() === 'p') {
          e.stopPropagation();
        }
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKey, { capture: true });
  }, [isModalOpen]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  if (!HINTS_SYSTEM_ENABLED) {
    return <>{children}</>;
  }

  return (
    <HintsContext.Provider
      value={{
        enabled: hintsEnabled,
        setHintsEnabled,
        discoveredHints,
        dismissedHints,
        justDiscoveredId,
        activeContext,
        isModalOpen,
        openModal,
        closeModal,
        markDiscovered,
        dismissHint,
        resetHints,
      }}
    >
      {children}
    </HintsContext.Provider>
  );
};

export const useHints = () => useContext(HintsContext);
