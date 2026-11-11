/**
 * Single Source of Truth dla wszystkich skrótów klawiaturowych, gestów
 * i sprytnych ułatwień w aplikacji Speakling.
 */

export const HINT_CONTEXT_LABELS = {
  mastery: 'Mastery Path',
  workspace: 'Practice Room (Czytanie)',
  flashcards: 'Fiszki (Powtórki)',
  dashboard: 'Chat Live',
  'good-to-know': 'Gry & Relaks',
  global: 'Globalne',
};

export const HINTS_REGISTRY = [
  // ── Mastery Path ───────────────────────────────────────────────────────────
  {
    id: 'mastery_space',
    context: 'mastery',
    keys: ['Spacja'],
    title: 'Pauza / Dalej podczas czytania',
    description: 'W trakcie czytania zdania wstrzymuje lub wznawia lektora; po przeczytaniu pełnego zdania przechodzi do kolejnego.',
    shortHint: 'W trakcie zdania: Pauza / Wznów · Po zdaniu: Dalej',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'mastery_p',
    context: 'mastery',
    keys: ['P'],
    title: 'Odtwórz / Pauza zdania',
    description: 'Szybkie uruchomienie lub wstrzymanie lektora dla aktualnie wybranego zdania.',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'mastery_translate',
    context: 'mastery',
    keys: ['Dwuklik', 'PPM'],
    title: 'Błyskawiczne tłumaczenie zdania',
    description: 'Kliknij dwukrotnie lub prawym przyciskiem myszy na dowolne zdanie, aby zobaczyć jego polskie tłumaczenie.',
    touchDescription: 'Dotknij ikony tłumaczenia lub kliknij zdanie dwukrotnie, aby zobaczyć tłumaczenie.',
    desktopOnly: false,
    badge: 'Gest',
  },

  // ── Practice Room (Workspace) ──────────────────────────────────────────────
  {
    id: 'workspace_space',
    context: 'workspace',
    keys: ['Spacja'],
    title: 'Pauza / Wznów lektora',
    description: 'Gdy lektor czyta opowiadanie (lub jest spauzowany), Spacja natychmiast zatrzymuje lub wznawia czytanie.',
    shortHint: 'Podczas czytania zatrzymuje i wznawia lektora',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'workspace_p',
    context: 'workspace',
    keys: ['P'],
    title: 'Start / Pauza odtwarzania',
    description: 'Uruchamia czytanie historii na głos lub wstrzymuje aktywne odtwarzanie.',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'workspace_word_lookup',
    context: 'workspace',
    keys: ['Klik / Zaznacz'],
    title: 'Tłumacz słowa i dodawaj do Word Banku',
    description: 'Kliknij dowolne słowo albo zaznacz fragment tekstu, aby przetłumaczyć w kontekście i zapisać do powtórek.',
    touchDescription: 'Dotknij dowolnego słowa lub zaznacz fragment, aby zobaczyć tłumaczenie i dodać je do Word Banku.',
    desktopOnly: false,
    badge: 'Gest',
  },

  // ── Flashcards ─────────────────────────────────────────────────────────────
  {
    id: 'flashcards_space',
    context: 'flashcards',
    keys: ['Spacja'],
    title: 'Odwróć fiszkę',
    description: 'Odsłania tłumaczenie oraz przykład na odwrocie karty.',
    shortHint: 'Odwraca fiszkę · Strzałki ← / → oceniają słówko',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'flashcards_arrows',
    context: 'flashcards',
    keys: ['←', '→'],
    title: 'Ocena znajomości słowa',
    description: 'Strzałka w lewo oznacza „Powtórz ponownie”, a strzałka w prawo „Umiem to”.',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'flashcards_esc',
    context: 'flashcards',
    keys: ['Esc'],
    title: 'Zamknij sesję fiszek',
    description: 'Natychmiast zamyka aktywną sesję powtórek.',
    desktopOnly: true,
    badge: 'Skrót',
  },

  // ── Chat Live (Dashboard) ──────────────────────────────────────────────────
  {
    id: 'live_polish_fallback',
    context: 'dashboard',
    keys: ['Mowa PL'],
    title: 'Polskie wtrącenia w rozmowie',
    description: 'Gdy zabraknie Ci angielskiego słowa w trakcie mówienia, powiedz je po polsku — lektor płynnie podpowie odpowiednik.',
    desktopOnly: false,
    badge: 'Funkcja AI',
  },
  {
    id: 'live_screen_camera',
    context: 'dashboard',
    keys: ['Ekran / Kamera'],
    title: 'Wspólna analiza obrazu',
    description: 'Udostępnij ekran lub kamerę podczas Chat Live, aby omawiać z lektorem artykuły, kod czy slajdy na żywo.',
    desktopOnly: false,
    badge: 'Funkcja AI',
  },

  // ── Good to Know (Gry & Relaks) ────────────────────────────────────────────
  {
    id: 'nback_keys',
    context: 'good-to-know',
    keys: ['A / ←', 'L / →'],
    title: 'Sterowanie w Dual N-Back',
    description: 'Klawisz A (lub ←) zgłasza dopasowanie pozycji, a L (lub →) dopasowanie usłyszanej litery.',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'good_to_know_esc',
    context: 'good-to-know',
    keys: ['Esc'],
    title: 'Wyjście z gry lub ćwiczenia',
    description: 'Zatrzymuje dźwięk i bezpiecznie zamyka otwarte okno ćwiczenia.',
    desktopOnly: true,
    badge: 'Skrót',
  },

  // ── Globalne ───────────────────────────────────────────────────────────────
  {
    id: 'global_help_modal',
    context: 'global',
    keys: ['?'],
    title: 'Ściągawka skrótów i ułatwień',
    description: 'Otwiera to okno w dowolnym momencie, dopasowane do ekranu na którym aktualnie jesteś.',
    desktopOnly: true,
    badge: 'Skrót',
  },
  {
    id: 'global_escape',
    context: 'global',
    keys: ['Esc'],
    title: 'Zamknij okno lub szufladę',
    description: 'Zamyka otwarty tłumacz, modal podpowiedzi albo okno dialogowe.',
    desktopOnly: true,
    badge: 'Skrót',
  },
];

