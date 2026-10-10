# 🎨 Speakling (AI-English-Buddy) — Design Specification & Redesign Blueprint (`Design.md`)

> **Document Purpose:** Complete UI/UX design blueprint and design system specification for the redesign of **Speakling (AI-English-Buddy)**. This document serves as the single source of truth for designers, frontend developers, and AI coding assistants executing the application redesign.

---

## 1. 📌 Executive Summary & Product Vision

**Speakling (AI-English-Buddy)** is an AI-powered, neuroscience-backed English language learning web application. It combines real-time voice interaction (powered by Google Gemini Live), interactive reading with instant click-to-translate, AI story generation, spaced-repetition flashcards, video/audio media analysis, and preparation widgets (e.g. 4-7-8 breathing exercises).

### Core Design Principles
1. **Clutter-Free Focus**: The user's primary focus must always remain on learning, speaking, and reading. UI chrome is minimal, elegant, and non-distracting.
2. **Fluid Micro-Interactions**: Smooth transitions (200ms cubic-bezier), responsive hover states, and dynamic visual feedback (audio voice orb, progress rings, phase badges).
3. **Neuroscience-Optimized Ergonomics**: Use calm, high-legibility typography, clear hierarchy, soft elevation, and color cues that reduce cognitive load during study sessions.
4. **Cohesive Design System**: Built upon modern Google/Material Design 3 principles with customizable Light and Dark mode surfaces, clean card layouts, and rounded pill controls.

---

## 2. 🗺️ Application Architecture & Views Map

Speakling consists of 8 primary views and 3 persistent floating overlay drawers:

```
Speakling App Layout
 ├── Sidebar (Persistent Left Navigation)
 ├── TopBar (Dynamic View Title & User Profile)
 ├── View Container
 │    ├── 1. Chat Live (Dashboard) — Gemini Real-time Voice Chat & Visualizer
 │    ├── 2. Workspace (Practice Room) — Interactive Reader, Story Generator, Text Tools
 │    ├── 3. Saved Stories — Library of AI-generated stories (Filterable)
 │    ├── 4. My Vocabulary (Notebook) — Word bank, definition cards, dictionary
 │    ├── 5. Media Buddy — Audio/Video lessons with synced transcripts
 │    ├── 6. Good to Know — Neuroscience tips, physiological sigh & 4-7-8 breathing widget
 │    ├── 7. Admin Dashboard — System telemetry, API usage, session logs & metrics
 │    └── 8. Auth Hub — Login, Register, Firebase Auth & Session Guard
 ├── Persistent Drawers & Overlays
 │    ├── Vocabulary Drawer (Side-panel word lookup)
 │    ├── Translator Drawer (Instant text translation)
 │    ├── Flashcards Modal (Full-page spaced repetition study)
 │    └── Floating Live Chat Bubble (Quick toggle to voice chat)
```

---

## 3. 🎨 Design System & Visual Tokens

### 3.1 Color Palette

#### Primary Accent Colors
- **Google Blue (Primary)**: `#1A73E8` — Primary actions, active navigation, links.
- **Violet Accent (Secondary)**: `#a953ff` / `#8b5cf6` — Premium highlights, badges, AI features.
- **Amber Accent**: `#fbbc04` — Flashcards, bookmarks, rating indicators.

#### Light Mode Surfaces (Default App Theme)
- **Background Main**: `#ffffff` / `#f8fafc`
- **Card Surface**: `#ffffff`
- **Surface Hover**: `#f1f3f4` / `#f1f5f9`
- **Border Default**: `#e2e8f0` / `#e0e0e0`
- **Border Hover**: `#1A73E8` / `#cbd5e1`

#### Text Color Hierarchy
- **Text Primary**: `#202124` / `#0f172a` (Headings, active text, titles)
- **Text Secondary**: `#5f6368` / `#475569` (Body text, sub-labels)
- **Text Muted**: `#94a3b8` / `#dadce0` (Placeholders, disabled states)

#### Semantic Colors
- **Success**: `#10b981` (Completed flashcards, active connection, exhale phase)
- **Warning**: `#f59e0b` (Caution alerts, session timeout)
- **Danger / Stop**: `#ef4444` (Delete word, end call, active error)
- **Info / Cyan**: `#38bdf8` (Inhale phase, information tooltips)

---

### 3.2 Typography Scale

- **Display & Heading Font**: `'Outfit'`, `'Google Sans'`, `'Roboto'`, sans-serif
- **Body & Reading Font**: `'Roboto'`, system-ui, -apple-system, sans-serif
- **Monospace Font**: `'Roboto Mono'`, monospace

| Token | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-display-lg` | `2.5rem` (40px) | `800` | `1.15` | Hero titles, Page headers |
| `text-headline-md`| `1.5rem` (24px) | `700` | `1.25` | Section headers |
| `text-title-lg`   | `1.2rem` (19px) | `600` | `1.3`  | Card headers, modal titles |
| `text-body-md`    | `0.95rem` (15px)| `400` | `1.6`  | Reader body text, general paragraphs |
| `text-label-sm`   | `0.8rem` (13px) | `600` | `1.4`  | Badges, step counters, button labels |

---

### 3.3 Radii, Shadows & Elevation

```css
/* Elevation Tokens */
--shadow-sm: 0 1px 3px rgba(60,64,67,0.12), 0 1px 2px rgba(60,64,67,0.24);
--shadow-md: 0 4px 12px rgba(60,64,67,0.15);
--shadow-lg: 0 8px 24px rgba(60,64,67,0.20);
--shadow-glow: 0 0 25px rgba(26, 115, 232, 0.35);

/* Border Radius Tokens */
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

---

## 4. 🛠️ Detailed Component Specifications

### 4.1 Chat Live / Dashboard (`Dashboard.js` & `Dashboard.css`)
- **Central Element**: Gemini Live Voice Orb Visualizer.
  - Idle state: Glowing gradient orb with subtle breathing pulse (`ambientOrb`).
  - Active listening state: Dynamic audio frequency ripple waves expanding around orb.
  - Speaking state: Multi-ring animated waveform responsive to AI audio streaming.
- **Controls Bar**: Floating rounded bar with Mic toggle, Camera/Screen share, Live Transcript panel toggle, and End Session button.
- **Transcript Box**: Collapsible side-panel showing real-time bilingual conversation history with quick copy and save-to-vocabulary buttons.

### 4.2 Practice Room / Reader (`Workspace.js` & `Reader.js`)
- **Layout**: Two-column layout on desktop (Left: Interactive Reader/Text Canvas, Right: Vocabulary & Contextual Assistant).
- **Click-to-Translate**: Clicking any word in the reader text highlights the word with an accent background and opens an instant inline definition bubble or translates the sentence.
- **Story Generator Bar**: Topic selector chips (Business, Daily Life, Travel, Tech) + CEFR Level selector (A1-C2) + "Generate Story" button.

### 4.3 Saved Stories Library (`SavedStories.js`)
- **Grid Layout**: Responsive card grid (`repeat(auto-fit, minmax(280px, 1fr))`).
- **Card Elements**: Story title, level badge (e.g. `B2`), word count, read status progress bar, "Read Now" and "Practice with Voice AI" action buttons.

### 4.4 My Vocabulary & Flashcards (`VocabularyView.js` & `Flashcards.js`)
- **Vocabulary Table/List**: Filterable by difficulty, topic, or date added. Search bar with instant filtering.
- **Flashcard Deck**: 3D flip-card animation (Front: Target English word + sentence context; Back: Polish translation + phonetic audio play button).
- **Action Controls**: "Know it" (Green) / "Review again" (Orange) buttons with keyboard shortcuts (Space / Arrow keys).

### 4.5 Neuroscience & Good To Know (`GoodToKnow.js` & `GoodToKnow.css`)
- **Theme**: Clean light card layout matching main app surfaces (`#ffffff` cards with subtle `#e0e0e0` borders).
- **Breathing Exercise Widget (4-7-8)**:
  - Container: White card background `#ffffff`, clean typography, no dark translucent box.
  - Breathing Circle: 140px gradient orb (`linear-gradient(135deg, #1A73E8, #a953ff)`) scaling smoothly to `1.55x` during inhale (cyan), hold (indigo/violet), and exhale (emerald green).
  - Control Button: Pill action button (`btn-breathing`) with blue/violet gradient fill, hover shadow, and clear active state.

### 4.6 Admin Dashboard (`AdminDashboard.js` & `AdminDashboard.css`)
- **Metrics Cards**: Active sessions, Gemini API latency, Token usage counters, Error rates.
- **Data Tables**: Paginated user activity log table with status badges and filter controls.

---

## 5. 📱 Responsive & Mobile Strategy

1. **Breakpoints**:
   - `Mobile`: `< 768px` (Automatic redirect to Expo Web mobile views `/speakling/mobile/`)
   - `Tablet`: `768px – 1024px` (Collapsible sidebar into drawer)
   - `Desktop`: `> 1024px` (Full 2-column workspace layout)
2. **Touch Optimization**:
   - Minimum touch target size: `44px x 44px`.
   - Floating Action Button (FAB) for Live Chat positioned at bottom-right (`bottom: 24px`, `right: 24px`).

---

## 6. 🚀 Redesign Implementation Roadmap

### Phase 1: Tokens & Primitives (Sprint 1)
- [ ] Refactor `DesignTokens.css` to consolidate CSS variables across Light/Dark modes.
- [ ] Create reusable UI components: `<Button>`, `<Card>`, `<Badge>`, `<Input>`, `<Modal>`.

### Phase 2: Main Navigation & Layout (Sprint 2)
- [ ] Redesign `Sidebar` with active icon indicators and sleek hover states.
- [ ] Harmonize `TopBar` title hierarchy and profile dropdown.

### Phase 3: Live Chat & Practice Room Polish (Sprint 3)
- [ ] Refactor `Dashboard.js` Gemini Live visualizer orb and transcript drawer.
- [ ] Polish `Workspace.js` Reader text spacing, selection popups, and instant translator.

### Phase 4: Vocabulary, Media & Utilities (Sprint 4)
- [ ] Update `GoodToKnow.js` light-theme cards and 4-7-8 breathing animation.
- [ ] Enhance `Flashcards.js` flip card animations and completion stats.
- [ ] Audit responsive layouts and run production build tests.

---
*Document generated automatically for Speakling (AI-English-Buddy) Redesign Specification.*
