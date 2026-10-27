# OmniTube & OmnPlay: Direct WebRTC Streaming, Unified Mobile Application & Modern Platform Architecture

A comprehensive upgrade integrating production Direct WebRTC (`RTCPeerConnection` with STUN/TURN ICE signaling via Supabase Realtime), ultra-low latency broadcasting with multi-camera/screen-share controls and real-time audio meters, full Expo mobile application synchronization, adaptive search auto-hide, large-screen collapsed icon rail, and multi-chain Web3 wallet connectivity.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction incorporates your confirmed answers from Phase 1 alongside the full platform requirements:

- **Confirmed Decision 1 (WebRTC Streaming Core)**: Direct WebRTC `RTCPeerConnection` with STUN/TURN ICE candidate exchange signaled over Supabase Realtime channels (`webrtc-signaling-{streamId}`). Broadcasters publish local camera/mic or screen share directly; viewers negotiate peer connections for sub-500ms ultra-low latency streaming.
- **Confirmed Decision 2 (Broadcaster Controls & Telemetry)**: WebRTC studio broadcaster suite equipped with front/back camera switching, screen-sharing toggle, live audio visualizer meters (via Web Audio `AnalyserNode`), and real-time ICE connection status indicators.
- **Confirmed Decision 3 (Mobile Experience & Web Parity)**: Synchronized Expo mobile codebase (`apps/mobile/`) sharing Supabase data models and WebRTC streaming, paired with responsive touch ergonomics and bottom thumb navigation.
- **Confirmed Decision 4 (Search Focus Interaction)**: Clicking search instantly auto-hides the notification bell, settings gear, and Camera & FX triggers, expanding the search input with recent searches and trending tags until Enter or Escape is pressed.
- **Confirmed Decision 5 (Collapsed Desktop Sidebar)**: On large screens, collapsing the left sidebar preserves a structured 72px icon rail with centered navigation icons and hover tooltips.
- **Confirmed Decision 6 (Web3 Multi-Chain Connection)**: Multi-chain WalletConnect modal with direct extension injection (MetaMask, Phantom, Coinbase) and mobile app deep-linking.

---

## 1. Overview & Core Concept

- **What It Does**: OmniTube is an open, high-performance decentralized video and live-streaming ecosystem. It empowers creators to broadcast live over peer-to-peer WebRTC, publish horizontal and vertical shorts with DSP audio effects, receive instant cryptocurrency Super Chats and tips, and distribute on-chain Sound NFT royalties.
- **Target Audience / Persona**: Streamers, mobile creators, gamers, crypto communities, and viewers seeking instant peer-to-peer real-time video interaction without proprietary middleman transcoding lag.
- **Key Value**: True sub-second WebRTC streaming, real Supabase Postgres persistence (zero mock data), responsive mobile web + native Expo parity, and intuitive keyboard/touch controls.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Direct WebRTC Live Broadcasting Flow**:
   - Creator opens the Live Broadcast Studio in `App.tsx` or mobile `live.tsx`.
   - The browser/device requests media permissions and initializes a local `MediaStream` (audio/video).
   - Creator can toggle between front and rear cameras, switch between camera and screen-sharing, and observe an animated real-time audio VU meter.
   - Creator clicks "Go Live": Supabase inserts a `live_streams` record (`status: "live", provider: "webrtc"`).
   - Signaling channel `webrtc-signaling-{streamId}` connects. When viewers join, the broadcaster creates an `RTCPeerConnection`, adds local tracks, creates an SDP offer, and exchanges ICE candidates via Supabase Realtime broadcast events.
   - Viewers immediately receive audio and video in `<video autoPlay playsInline>` with sub-second latency and live interactive chat.

2. **Search Focus Header Transition**:
   - User clicks or focuses the header search input.
   - Action triggers (Notifications, Settings, Camera & FX, Wallet Pill) smoothly collapse (`opacity-0 scale-95 pointer-events-none w-0 overflow-hidden`).
   - The search container expands fluidly across the header, revealing recent search terms and trending hashtag chips (`#Web3`, `#OmniSound`, `#LiveNow`, `#Gaming`).
   - Pressing `Enter` executes the search, saves the query to local recent searches, tucks the dropdown away, and restores the action triggers.

3. **Desktop Collapsed Icon Rail & Mobile Navigation**:
   - **Expanded Desktop (lg: >= 1024px)**: 240px wide sidebar with grouped navigation, library history, and creator tools.
   - **Collapsed Desktop (lg:)**: Smoothly contracts to 72px icon-only rail with centered Lucide icons, active state pill indicators, and clean tooltips.
   - **Mobile Viewports (< 768px)**: Fixed bottom 5-tab bar (Discover, Shorts, Live, Community, Library) adhering to the 15% sticky surface limit and $44\times 44\text{px}$ touch targets.

4. **Multi-Chain Wallet & Web3 Deep-Linking**:
   - Clicking "Connect Wallet" opens the Web3 connector modal.
   - Desktop: Automatically detects and connects injected EIP-1193 providers (MetaMask, Phantom, Coinbase Wallet).
   - Mobile: Provides one-tap deep-links (`metamask://`, `phantom://`, `rainbow.me/`) and standard WalletConnect pairing.

### Visual Identity & Theme

- **Aesthetic Direction**: Ultra-modern dark studio interface with slate-950 canvas (`#090a0f`), glassmorphic panels (`#12151f`), and electric cyan/violet highlights.
- **Anti-Slop Restraint**: Zero static metadata pill badges, no mechanical `//` header prefixes, no ungrounded system scoreboards, and no dead unwired controls.
- **Typography**: `Plus Jakarta Sans` for display and titles, clear system sans for body, and `font-mono tabular-nums` for timers, viewer counts, and audio decibel levels.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct WebRTC with Supabase Realtime Signaling**:
  - *Chosen Approach*: Use public Google STUN servers (`stun:stun.l.google.com:19302`) with standard `RTCPeerConnection`. Broadcaster and viewer exchange SDP offers, answers, and ICE candidates through a dedicated Supabase Realtime channel (`supabase.channel('webrtc-stream-{id}')`).
  - *Why*: Eliminates expensive external media server bottlenecks, delivers genuine sub-500ms broadcast latency, and requires zero extra cloud infrastructure.
  - *Alternatives Considered*: Server-side HLS/DASH streaming was rejected due to 6–15 second latency; external proprietary SFUs were rejected in favor of self-contained WebRTC.

- **Decision 2: Seamless Search Auto-Hide Architecture**:
  - *Chosen Approach*: Single source of truth state (`isSearchFocused: boolean`) in `App.tsx` driving CSS flex transitions on the header action group, accompanied by keyboard shortcuts (`/` to focus, `Escape` or `Enter` to dismiss).
  - *Why*: Smooth 150ms GPU-accelerated transition without component re-mounting or losing user inputs.

- **Decision 3: Synchronized Expo Mobile Parity**:
  - *Chosen Approach*: Equip `apps/mobile/app/` with full tabs (Discover, Shorts, Live, Community, Profile, Library) and direct Supabase database + WebRTC client integration.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 OmniTube & OmnPlay Ecosystem                           │
├─────────────────────────────────────────┬──────────────────────────────────────────────┤
│               Web SPA (React)           │              Native Mobile (Expo)            │
│  src/App.tsx                            │  apps/mobile/app/                            │
│  ├── Header (Search Auto-Hide & Rail)   │  ├── (tabs)/_layout.tsx (Safe Area Tabs)     │
│  ├── WebRTC Broadcaster & Viewer        │  ├── (tabs)/index.tsx (Discover Feed)        │
│  ├── OmnPlayCameraSuite (DSP & Upload)  │  ├── (tabs)/live.tsx (WebRTC Stream Room)    │
│  ├── ShortsReel (Vertical Video)        │  ├── (tabs)/shorts.tsx (Vertical Reels)      │
│  └── MultiChainWalletModal (Deep-links) │  └── (tabs)/community.tsx (Post Feed)       │
└────────────────────┬────────────────────┴──────────────────────┬───────────────────────┘
                     │                                           │
                     ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Realtime Signaling & WebRTC Media Layer                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Supabase Realtime Channel: "webrtc-stream-{streamId}"                                 │
│  ├── Event 'webrtc-offer': Broadcaster SDP -> Viewer                                  │
│  ├── Event 'webrtc-answer': Viewer SDP -> Broadcaster                                  │
│  ├── Event 'webrtc-ice': Bidirectional ICE Candidates                                 │
│  └── Event 'chat-message': Instant live stream chat and tip notifications              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Media Engine:                                                                         │
│  ├── navigator.mediaDevices.getUserMedia / getDisplayMedia (Screen share)              │
│  ├── Web Audio AnalyserNode: Real-time Audio VU Metering                               │
│  └── RTCPeerConnection with STUN: stun.l.google.com:19302                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

| Component | State Variables | User Action & Real System Effect |
| :--- | :--- | :--- |
| **Top Bar Search** | `searchQuery`, `isSearchFocused`, `recentSearches` | Clicking search expands the input bar, hides notifications/settings/camera buttons, renders recent queries and trending chips. Pressing Enter executes query and restores header. |
| **Desktop Nav** | `sidebarCollapsed` | Toggling hamburger switches desktop sidebar between 240px wide menu and 72px icon rail with active indicators and tooltips. |
| **WebRTC Streamer** | `isBroadcasting`, `facingMode`, `isScreenSharing`, `audioLevel` | Initiates `RTCPeerConnection`, streams video/audio, switches camera or screen, calculates real-time audio volume VU bars, signals over Supabase Realtime. |
| **WebRTC Viewer** | `peerConnection`, `streamStatus`, `connectionState` | Subscribes to stream channel, negotiates SDP answer, renders real-time WebRTC `<video>` with sub-second latency. |
| **Multi-Chain Wallet** | `walletState`, `isWalletModalOpen` | Connects injected Web3 provider or presents deep-links (`metamask://`, `phantom://`, `rainbow.me/`) with account address formatting. |
| **Expo Mobile** | Mobile tab routes & components | Replicates all feeds, live stream viewer, shorts reel, and library using Supabase backend. |

---

## 5. Execution Plan & Deliverables

1. **Top Bar Search Focus & Large Screen Icon-Rail**:
   - Update `src/App.tsx` header to auto-hide notifications, settings, and camera triggers while search is active.
   - Implement recent search history and trending tag dropdown with keyboard navigation.
   - Implement the desktop collapsed 72px icon rail navigation with centered icons and tooltips.

2. **Direct WebRTC Broadcaster & Viewer Engine**:
   - Implement `src/lib/webrtc.ts` providing standard `RTCPeerConnection` configuration with Google STUN servers and Supabase Realtime signaling.
   - Upgrade the live stream broadcast modal and viewer modal in `src/App.tsx` with direct WebRTC media streaming, front/rear camera switching, screen sharing, audio VU meters, and instant live chat.

3. **Multi-Chain WalletConnect & Web3 Deep-Linking**:
   - Upgrade `src/components/monetization/Web3WalletBar.tsx` and create `src/components/monetization/MultiChainWalletModal.tsx` supporting injected extensions and mobile deep-links.

4. **Synchronize Expo Mobile App (`apps/mobile/`)**:
   - Update `apps/mobile/app/(tabs)/live.tsx`, `index.tsx`, `shorts.tsx`, `community.tsx`, and `profile.tsx` with real Supabase queries and WebRTC streaming.

5. **Exhaustive Production README**:
   - Create a clean, thorough `README.md` detailing the complete architecture, WebRTC signaling protocol, Supabase schema, mobile deployment instructions, and feature guide.

6. **Build Verification**:
   - Run `compile_applet` and typecheck to verify flawless build and zero regressions.
