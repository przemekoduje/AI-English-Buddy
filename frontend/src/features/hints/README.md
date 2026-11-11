# Moduł podpowiedzi i skrótów (Speakling Hints System)

Moduł w pełni odizolowany w `frontend/src/features/hints/`.

## 1. Wyłączenie w 5 sekund (bez usuwania plików)
W pliku `frontend/src/features/hints/hintsConfig.js` ustaw:
```js
export const HINTS_SYSTEM_ENABLED = false;
```
Wyłącza to renderowanie wszystkich pigułek `<SmartHintPill />`, przycisku `(?)`, skrótu `?`, modala oraz sekcji skrótów w `HelpFeedback`.

Użytkownik może też sam wyłączyć podpowiedzi kontekstowe przełącznikiem w modalu (`?`) lub w zakładce **Help & Feedback**.

## 2. Całkowite odinstalowanie z projektu
1. Usuń katalog `frontend/src/features/hints/`.
2. Wyszukaj importy z `features/hints` (`grep -rn "features/hints" frontend/src`) i usuń:
   - `App.js`: `<HintsProvider>` i `<ShortcutsModal />`
   - `TopBar.js`: `<ShortcutsTriggerButton />`
   - `HelpFeedback.js`: `<HelpShortcutsSection />`
   - `PracticeMode.js`, `Workspace.js`, `Flashcards.js`: `<SmartHintPill />`, `useRegisterHintContext(...)`, `emitHintUsed(...)`.

