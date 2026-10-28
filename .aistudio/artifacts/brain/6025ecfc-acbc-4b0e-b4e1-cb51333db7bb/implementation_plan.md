# OmniTube & OmnPlay: Modern URL Routing, Search Layout Fix & Complete UI Styling Architecture

An architectural plan to fix search expansion geometry so it never clips or covers the left navigation and breadcrumbs, fully style all search dropdowns and modal panels using the application's cohesive dark/light CSS design tokens, and introduce comprehensive client-side URL routing (`/watch/:id`, `/shorts/:id`, `/live/:id`, `/studio`, `/library`, `/trending`, `/community`).

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural plan integrates your confirmed choices:

- **Confirmed Decision 1 (Clean Pathname URL Routing)**: Full HTML5 History API integration supporting direct linkable paths (`/watch/:id`, `/shorts`, `/shorts/:id`, `/live`, `/live/:id`, `/studio`, `/library`, `/trending`, `/community`, `/notifications`). Direct page reloads, browser back/forward buttons, and link sharing will resolve immediately without state loss.
- **Confirmed Decision 2 (Search Bounded Center Expansion)**: The top navigation header is locked into a rigid 3-zone flexbox grid (`topbar-left`, `topbar-center`, `topbar-actions`). When search is focused, it expands strictly within the center zone (`flex: 1; max-width: 580px; min-width: 0`), ensuring `topbar-left` (hamburger menu + brand mark + breadcrumb) is permanently anchored and never covered.
- **Confirmed Decision 3 (Unified CSS Design System & Zero Unstyled Elements)**: Eliminate disjointed raw utility classes and harmonize all popovers, dropdowns, and modals (`MultiChainWalletModal`, search suggestions, trending tags, recent history, and live room) using the core theme tokens (`var(--panel)`, `var(--panel-2)`, `var(--border)`, `var(--mint)`, `var(--text)`, `var(--muted)`). This guarantees flawless presentation across both Dark Slate and Porcelain White themes.

---

## 1. Overview & Core Concept

- **What It Delivers**:
  1. **Pixel-Perfect Search Header**: Clean bounded search input that auto-hides notification/settings/camera buttons while preserving the left menu button and brand breadcrumb.
  2. **High-Fidelity Search Dropdown**: A styled glassmorphic dropdown with recent searches, clear-all action, trending tag pills, and autocomplete suggestions.
  3. **Universal URL Routing**: Real deep-linking and browser navigation for all video assets, shorts, live streams, and studio views.
  4. **Cohesive Design Language**: Elimination of unstyled/awkward utility collisions, giving every modal, dropdown, and card a polished, production-grade appearance.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Direct Video Deep-Linking & History Navigation**:
   - Clicking any video card updates the URL to `/watch/[videoId]` and loads the player with comments and recommendations.
   - Sharing the link or refreshing the page immediately rehydrates the player with the correct video.
   - Clicking back in the browser smoothly navigates back to `/` or the previous section without page reloads.

2. **Shorts URL Deep-Linking**:
   - Navigating to `/shorts` or `/shorts/[shortId]` mounts the vertical reel directly at the specified short, synchronizing URL state as the user swipes through videos.

3. **Center-Bounded Search Interaction**:
   - User clicks the search input or presses `/`.
   - The topbar right actions (Notification, Settings, Camera & FX) gracefully transition out.
   - The search input smoothly expands within its allocated center flex zone up to 580px, while `topbar-left` (Menu + Brand + Breadcrumbs) stays 100% visible and accessible.
   - The dropdown presents styled categories: Recent Searches with clear button, Trending Hashtags with cyan-glow chips, and live query autocomplete.
   - Pressing Enter or clicking a suggestion commits the search, updates the URL to `/?q=[query]`, closes the dropdown, and restores the action buttons.

### Visual Styling & Theme Tokens

- **Strict Token Adherence**:
  - Surface Backgrounds: `var(--panel)` and `var(--panel-2)`.
  - Borders: `var(--border)` and `var(--border-strong)`.
  - Accents: `var(--mint)` for interactive focus and active states, `var(--coral)` for live broadcast tags.
  - Text Hierarchy: Primary `var(--text)`, secondary `var(--muted)`, subtle `var(--quiet)`.
- **Search Dropdown Aesthetic**:
  - Container: `border: 1px solid var(--border); background: var(--panel); backdrop-filter: blur(20px); border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.35);`.
  - Chip Buttons: Soft rounded-xl pills using `var(--panel-2)` with subtle hover borders and active mint accents.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native HTML5 History Router vs External Library**:
  - *Chosen Approach*: Lightweight, robust native router hook (`useAppRouter` / `pushState` / `popstate`) without introducing bulky third-party dependencies.
  - *Why*: Guarantees instant synchronization with Vite's SPA dev server and Express's production wildcard handler with zero extra bundle weight.
  - *Alternatives Considered*: `react-router-dom` would require package installation and extensive wrapping of existing modal dialogs. A tailored routing manager provides seamless integration with the existing state architecture.

- **Decision 2: 3-Zone Flexbox Topbar Contract**:
  - *Chosen Approach*: Enforce `shrink-0` on `topbar-left` and `topbar-actions`, allocating all flexible width exclusively to `topbar-center`.
  - *Why*: Mathematically prevents the search bar from expanding into the left menu button on any viewport size.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 OmniTube Platform Shell                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Browser URL / Router Sync (window.history.pushState & popstate)                       │
│  ├── /                      -> Home / Discover Feed                                    │
│  ├── /watch/:id             -> AdvancedVideoPlayer modal/view                          │
│  ├── /shorts, /shorts/:id   -> ShortsReel (Vertical Swipe)                             │
│  ├── /live, /live/:id       -> Live Streams / WebRTC Stage                             │
│  ├── /studio                -> Creator Studio Workstation                              │
│  ├── /library               -> Saved History, Liked, Playlists                         │
│  └── /?q=query              -> Filtered Discover Search                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Top Bar (Strict 3-Zone Layout)                                                        │
│  ├── Zone 1: topbar-left (Menu Button + Brand Lockup + Section Breadcrumb) [shrink-0]   │
│  ├── Zone 2: topbar-center (Center-Bounded Search + Styled Dropdown) [flex-1, max-580] │
│  └── Zone 3: topbar-actions (Notifications + Settings + Wallet + Camera + Create)     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interactive State & Route Mapping

| Route Pattern | State Activated | Behavior & Visual Components |
| :--- | :--- | :--- |
| `/` | `section = "home"`, `selectedVideo = null` | Discover feed with category pills and video grid |
| `/watch/:id` | `selectedVideo = video` | Fullscreen advanced player with comments & related videos |
| `/shorts/:id?` | `section = "shorts"` | Vertical short reel, deep-linking directly to short ID |
| `/live/:id?` | `section = "live"`, `room = liveStream` | Direct WebRTC broadcast stage or live stream viewer |
| `/studio` | `section = "studio"` | Creator Studio, WASM timeline editor & monetization hub |
| `/library` | `section = "library"` | User watch history, liked videos, and playlist manager |

---

## 5. Execution Plan & Deliverables

1. **Header Layout & Search Dropdown Styling**:
   - Re-architect `.topbar` into three strict zones: `.topbar-left { flex-shrink: 0 }`, `.topbar-center { flex: 1; max-width: 580px }`, and `.topbar-actions { flex-shrink: 0 }`.
   - Redesign search dropdown in `src/styles.css` using theme variables (`--panel`, `--border`, `--text`, `--mint`), eliminating rogue unstyled utility classes.
2. **Universal Client-Side URL Router**:
   - Implement deep-linking routes for `/watch/:id`, `/shorts/:id`, `/live/:id`, `/studio`, `/library`, `/trending`, `/community`, and search queries `?q=...`.
   - Support browser back/forward buttons (`popstate` listener) and direct URL reloads.
3. **Full Modal & Popover Design Polish**:
   - Clean up `MultiChainWalletModal` and other dialogs to use the unified theme variables, ensuring seamless dark and porcelain white compatibility.
4. **Build & Lint Verification**:
   - Compile and verify with `compile_applet` and `lint_applet` to ensure zero regressions.
