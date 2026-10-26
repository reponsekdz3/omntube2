# Implementation Plan - Default Modern Porcelain White Theme, Advanced Settings Suite & Interactive Player

Transform OmniTube into a modern, high-contrast, clean porcelain white theme by default with subtle slate frosted glass, obsidian typography, and responsive ergonomics across all device sizes. Introduces an Advanced Settings modal with real persistent configurations, an enhanced interactive video player with ambient lighting, PiP, and speed presets, plus full mobile responsiveness.

## 1. Architectural Changes & Structure

### A. Default Modern Porcelain White Theme (`src/styles.css` & `index.html`)
- **Root CSS Variables**:
  - Set `:root` / `[data-theme="light"]` as the primary default palette:
    - Base: `#f8fafc` (crisp porcelain slate white)
    - Panels & Cards: `#ffffff` with frosted glass overlays `rgba(255, 255, 255, 0.9)`
    - Borders: Subtle high-precision slate dividers `rgba(148, 163, 184, 0.24)`
    - Typography: `#0f172a` (obsidian/slate 900) with secondary `#64748b` (slate 500)
    - Accents: Deep high-contrast teal (`#0d9488`), royal blue (`#2563eb`), and royal violet (`#7c3aed`)
    - Shadows: Multi-layered diffusion shadows for elevated cards and dropdown menus.
  - Maintained `[data-theme="dark"]` for instant theme toggling.
- **Global Theme Support**:
  - Topbar, sidebar, video cards, studio dashboard, modals, inputs, and player controls seamlessly inherit theme CSS variables without color clashes.

### B. Advanced Settings Suite (`src/components/settings/AdvancedSettingsModal.tsx`)
- Modal with 4 production-ready configuration tabs:
  1. **Appearance & Display**:
     - Theme switcher: Porcelain White (Default) / Midnight Dark / System.
     - Compact sidebar toggle.
     - Smooth motion & transition toggle.
  2. **Playback & Experience**:
     - Default Quality preset (Auto, 4K UHD, 1080p, 720p).
     - Autoplay next video in feed/playlist.
     - Ambient lighting glow toggle behind the player.
     - Audio volume normalization & volume memory.
     - Default playback speed (0.75x, 1x, 1.25x, 1.5x, 2x).
  3. **Web3 & Multi-Chain Monetization**:
     - Preferred Default Network (Polygon, Arbitrum, BSC, Ethereum).
     - Gas priority preset (Economy, Fast, Instant Priority).
     - Auto-prompt on PPV locked media.
     - Quick tip presets ($1, $5, $10, $25, $50).
  4. **Privacy, Cloud SQL & Data**:
     - Real-time Cloud SQL session status badge.
     - Watch history recording toggle.
     - Personalized recommendations toggle.
     - 1-click Clear Local Cache & Playback Buffer.
- Settings persist to `localStorage` and synchronize dynamically with application state.

### C. Advanced Interactive Video Player (`src/components/player/AdvancedVideoPlayer.tsx`)
- **Ambient Glow Backlight**: Dynamic blur halo reflecting behind the video container for theater immersion.
- **Picture-in-Picture (PiP)**: Real HTML5 `requestPictureInPicture()` integration with indicator.
- **Theater Mode**: Expand video to full-width canvas while keeping comments and details accessible.
- **Playback Speed Selector**: Quick popup menu (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
- **Interactive Keyboard Controls**:
  - `Space` / `K`: Play/Pause
  - `F`: Fullscreen
  - `M`: Mute/Unmute
  - `T`: Theater Mode
  - `P`: Picture-in-Picture
  - `←` / `→`: Skip -5s / +5s
  - `↑` / `↓`: Volume Up / Down

### D. Multi-Device Responsiveness (`src/styles.css` & `src/App.tsx`)
- **Mobile Bottom Navigation Bar**: Fixed bottom bar on screens `< 768px` for instant access to Discover, Shorts, Create, Live, and Library.
- **Slide-out Sidebar Drawer**: Touch-friendly with backdrop scrim and swipe-friendly ergonomics.
- **Flexible Grid Breakpoints**: Responsive layouts for 1-column mobile, 2-column tablet, 3-column desktop, and 4-column widescreen displays.
- **Touch-Friendly Hit Targets**: Minimum 44px hit areas on all buttons and sliders for mobile.

## 2. Step-by-Step Execution Plan

- [x] **Step 1: Build `AdvancedSettingsModal.tsx` & State Store**
  - Created `src/components/settings/AdvancedSettingsModal.tsx` with all 4 tab panels and persistence.
  - Wired settings trigger into Topbar and Sidebar in `src/App.tsx`.

- [x] **Step 2: Theme System & Global White Palette (`src/styles.css` & `index.html`)**
  - Defined porcelain white CSS variables on `:root` and clean slate glass styling.
  - Applied `data-theme="light"` to `<html>` and synced with `localStorage`.
  - Updated topbar, sidebar, video cards, studio, community, and modals for white theme fidelity.

- [x] **Step 3: Enhance Video Player (`src/components/player/AdvancedVideoPlayer.tsx`)**
  - Implemented ambient backlight glow, theater mode, speed controls, PiP, and arrow key shortcuts.

- [x] **Step 4: Mobile Responsiveness & Bottom Bar (`src/App.tsx` & `src/styles.css`)**
  - Added mobile bottom navigation bar and responsive layout media queries.

- [x] **Step 5: Verification & Compilation**
  - Ran `compile_applet` — build succeeded.
  - Ran `lint_applet` — zero syntax or typing errors.
  - Restarted dev server.
