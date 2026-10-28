# OmniTube & OmnPlay: Decentralized Media Workstation & Live Streaming Platform

**A production-grade, decentralized video, vertical shorts, and real-time WebRTC broadcast ecosystem.** Built with React 19, TypeScript strict mode, Tailwind & CSS variables, Expo SDK 58 Mobile, and backed by Supabase PostgreSQL, WebRTC STUN signaling, WebAssembly (WASM) DSP audio processing, and multi-chain Web3 smart contracts (Polygon, Arbitrum, BSC, and Ethereum).

---

## 🚀 Key Highlights & New Capabilities

### 1. Direct WebRTC Live Broadcasting & Playback
- **Sub-500ms Ultra-Low Latency**: Pure browser-to-browser peer connections using Google STUN clusters (`stun.l.google.com:19302`) with signaling over Supabase Realtime broadcast channels (`webrtc-stream-{id}`).
- **Broadcaster Studio Suite**:
  - **Front / Rear Camera Toggle**: Switch seamlessly between user-facing and environment cameras on mobile and desktop.
  - **WebRTC Screen Sharing**: One-click screen capture broadcast via `navigator.mediaDevices.getDisplayMedia`.
  - **Real-Time Audio VU Meter**: Web Audio `AnalyserNode` frequency analyzer displaying live volume percentages (0–100%) with animated level visualizers.
  - **Live Telemetry**: Real-time viewer counter and WebRTC connection state monitoring.
  - **Interactive Live Chat**: Zero-latency chat messages and Web3 SuperChat alerts signaled over PostgreSQL changes.

### 2. Search Focus Dynamic Auto-Hide State Machine
- **Smart Topbar Auto-Hide**: Clicking or focusing the global search bar automatically hides the Notification bell, Settings gear, and Camera & FX triggers with smooth GPU-accelerated CSS transitions.
- **Recent Searches & Trending Tags**:
  - Persisted recent queries with one-click search and clear-all controls.
  - Interactive hashtag chips: `#Web3`, `#Gaming`, `#LiveNow`, `#OmniSound`, `#AI`, `#Esports`, `#Music`.
  - Autocomplete suggestion matching.
- **Restoration Trigger**: Pressing `Enter`, selecting a tag/suggestion, or pressing `Escape` submits the query and smoothly restores all header actions.

### 3. Desktop Large-Screen Collapsed Icon Rail
- **72px Icon Rail**: On large viewports (`>= 769px`), collapsing the sidebar transforms navigation into an organized, modern 72px icon rail with centered navigation icons and hover tooltips.
- **Adaptive Layout**: Smooth margin transitions on the main content shell with no layout thrashing.
- **Mobile Thumb Navigation**: Viewports `< 768px` feature a fixed bottom 5-tab bar adhering to touch-zone ergonomics and the 15% sticky surface limit.

### 4. Multi-Chain Web3 Monetization & Mobile Deep-Linking
- **Non-Custodial Multi-Chain Wallet**:
  - Browser extension detection: MetaMask, Phantom, Coinbase Wallet, Binance Web3, and Rainbow.
  - Mobile dApp deep-links: Launch directly into MetaMask (`https://metamask.app.link/dapp/...`) or Phantom mobile browsers.
  - Active support for 4 EVM networks: **Binance Smart Chain (BSC)**, **Ethereum Mainnet**, **Polygon PoS**, and **Arbitrum One**.
- **On-Chain Sound Registry (`OmniSoundRegistry.sol`)**:
  - ERC-721/1155 compatible sound registry with cryptographic fingerprinting and automated royalty basis points distribution.
  - Web3 SuperChats with live blockchain confirmations and tiered color chips.
  - Pay-Per-View (PPV) media access control.

### 5. Expo SDK 58 Native Mobile Application (`apps/mobile/`)
- Complete feature parity with the web platform:
  - **Discover Feed**: Infinite scrolling, topic filters, and personalized recommendation ranking.
  - **Shorts Reel**: Vertical swipeable video reels with `expo-video`, haptic feedback, like animations, and sound licensing.
  - **Live Stage**: Native WebRTC and LiveKit real-time audio/video streaming with full live chat.
  - **Creator Studio**: Video picker, metadata editor, and Tus resumable video uploads to Supabase Storage.
  - **Channel & Profile**: Subscriptions, watch history, saved playlists, and Web3 wallet deep-links.

---

## 🏛️ Ecosystem Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OmniTube & OmnPlay Platform                              │
├─────────────────────────────────────────┬──────────────────────────────────────────────┤
│           Web SPA (React 19)            │            Mobile App (Expo SDK 58)          │
│  src/                                   │  apps/mobile/                                │
│  ├── App.tsx (Main Shell & Topbar)      │  ├── app/(tabs)/index.tsx (Discover)         │
│  ├── lib/webrtc.ts (Direct WebRTC)      │  ├── app/(tabs)/shorts.tsx (Vertical Shorts) │
│  ├── components/player/AdvancedVideo    │  ├── app/(tabs)/live.tsx (Realtime Rooms)    │
│  ├── components/studio/OmnPlayStudio    │  ├── app/(tabs)/community.tsx (Posts)        │
│  ├── components/monetization/MultiChain │  └── app/(tabs)/profile.tsx (Channel/Wallet) │
└────────────────────┬────────────────────┴──────────────────────┬───────────────────────┘
                     │                                           │
                     ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Backend Services & Database Persistence                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Express API Server (server.ts)                                                        │
│  ├── /api/livekit-token (WebRTC Room Token Dispatch)                                   │
│  ├── /api/monetization/* (SuperChats, Channel Memberships, PPV Unlocks)                │
│  └── /api/search/autocomplete (Open Autocomplete Service)                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Supabase Cloud Database (PostgreSQL 15+)                                              │
│  ├── Tables: videos, profiles, live_streams, stream_messages, sound_remixes, posts     │
│  ├── Row-Level Security (RLS): Fine-grained creator authorization policies             │
│  ├── Realtime Subscriptions: Chat, WebRTC signaling messages, Notifications            │
│  └── Storage Buckets: omnitube-assets (Videos, Thumbnails, Avatars, Audio Stems)       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  EVM Smart Contracts (Multi-Chain)                                                     │
│  └── OmniSoundRegistry: On-chain sound copyright & royalty distribution                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Directory Structure

```text
├── apps/mobile/                # Expo React Native mobile application
│   ├── app/                    # Expo Router file-based navigation routes
│   │   ├── (tabs)/             # Tab navigation (Discover, Shorts, Live, Community, Profile)
│   │   ├── watch/[id].tsx      # Native video player screen
│   │   └── live/[id].tsx       # Native live room player screen
│   └── src/                    # Shared mobile components, AuthContext, Supabase client
├── src/                        # Web application source
│   ├── components/             # UI components
│   │   ├── camera/             # OmnPlay AR & multi-track camera suite
│   │   ├── monetization/       # MultiChainWalletModal, SuperChat, Web3WalletBar
│   │   ├── player/             # AdvancedVideoPlayer with HLS & speed controls
│   │   ├── search/             # Search filter drawer & chips
│   │   └── studio/             # CreatorStudio & Timeline Editor (WASM)
│   ├── lib/                    # Core libraries
│   │   ├── webrtc.ts           # Direct WebRTC Broadcaster, Viewer & Audio VU meter
│   │   ├── web3.ts             # EVM multi-chain connector & EIP-1193 provider
│   │   └── supabase.ts         # Supabase client & utilities
│   ├── wasm/                   # C++ WebAssembly DSP engine
│   └── App.tsx                 # Main application shell & topbar state machine
├── supabase/                   # Supabase configuration
│   ├── migrations/             # SQL database schema migrations
│   └── functions/              # Deno Edge Functions (livekit-token, resolve-playback)
├── server.ts                   # Full-stack Express backend with Vite middleware
└── package.json                # Root dependencies & build scripts
```

---

## 🛠️ Local Setup & Quick Start

### Prerequisites
- Node.js `>= 20.19.0` (or Node.js 22 LTS)
- npm `>= 10.0.0`

### 1. Web Application

```bash
# Clone repository
git clone https://github.com/uwiduhayekevine008-star/omnitube.git
cd omnitube

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# Launch development server (Port 3000)
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

### 2. Expo Mobile Application

```bash
cd apps/mobile
npm install

# Configure mobile environment variables
cp .env.example .env.local
# Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# Start Expo development client
npm run start
```

For Android and iOS builds:
```bash
npm run export:android
npm run export:ios
```

---

## 🔒 Security & Row-Level Security (RLS)

- **Zero Client Secrets**: All sensitive keys reside securely on server proxy routes or Supabase Edge Functions.
- **PostgreSQL Row-Level Security**: Every mutation (uploading, editing, deleting, tipping) is strictly verified against `auth.uid() = creator_id`.
- **EVM Signatures**: Cryptographic message signatures verify wallet ownership before registering Sound NFT records or unlocking pay-per-view media.

---

## 📄 License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.