/**
 * Centralny wyłącznik systemu podpowiedzi i skrótów (Feature Flag).
 *
 * SZYBKIE WYŁĄCZENIE (5 sekund):
 *   Zmień HINTS_SYSTEM_ENABLED na `false` — wszystkie pigułki, przycisk (?),
 *   skrót `?`, modal skrótów oraz sekcja w Help przestaną się renderować.
 *
 * PEŁNE ODINSTALOWANIE:
 *   Zobacz instrukcję w `frontend/src/features/hints/README.md`.
 */
export const HINTS_SYSTEM_ENABLED = true;

export const HINTS_STORAGE_KEYS = {
  USER_ENABLED: 'speakling_hints_user_enabled',
  DISCOVERED: 'speakling_hints_discovered',
  DISMISSED: 'speakling_hints_dismissed',
};

