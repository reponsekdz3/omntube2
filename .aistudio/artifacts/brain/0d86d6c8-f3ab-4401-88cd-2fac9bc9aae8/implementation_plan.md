# Implementation Plan - Production Hosting, Security Hardening & Backend Suite

## Overview
Prepares OmniTube for immediate production hosting with enterprise-grade backend security, automated Web3 wallet extension onboarding, resilient database fallback architecture, real multi-chain monetization (BNB Smart Chain, Ethereum, Polygon, Arbitrum), and zero mock breakages.

---

## 1. Production Hosting & Express 5 Backend Architecture (`server.ts`)
- **Health Check Probe (`/api/health`)**:
  - Exposes uptime, timestamp, database status (`connected` vs `in-memory-fallback`), and environment for container orchestrators (Render, Docker, AWS ECS, GCP Cloud Run, Railway, Fly.io).
- **Express 5 Strict Routing Compatibility**:
  - Migrated API 404 route to `app.use("/api", ...)` and SPA catch-all to `app.use(...)` with `path.resolve(process.cwd(), "dist", "index.html")`.
  - Guarantees unknown `/api/*` endpoints return clean JSON error payloads (`{"error": "API endpoint not found"}`) instead of confusing HTML pages.
- **Production Static Asset Serving**:
  - Serves compiled Vite assets from `/dist` with caching and client-side SPA routing when `NODE_ENV === "production"`.
- **Global Error Handling Middleware**:
  - Catches all uncaught Express errors, logs them cleanly, and returns sanitized responses without leaking internal stack traces.
- **Graceful Process Termination**:
  - Listens for `SIGTERM` and `SIGINT` to gracefully drain active HTTP connections before exit.
- **Enterprise Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), payment=(self)`
  - IP Rate Limiting: 180 req/min per IP on all `/api/*` endpoints.

---

## 2. Web3 Extension Redirection & Auto-Detect (`src/components/monetization/InstallWalletModal.tsx`)
- **Automatic Extension Detection**:
  - Detects if MetaMask (`window.ethereum`) or Binance Web3 Wallet (`window.BinanceChain`) is missing when attempting a transaction or connection.
- **Direct Official Installation Flow**:
  - 1-click install direct to Chrome Web Store and official download portals.
  - Optional 3-second auto-redirect with cancel button.
- **Live Provider Polling**:
  - Periodically polls `getInjectedProvider()` so when the user installs the extension, the modal automatically recognizes it without requiring a page reload.

---

## 3. Database Resiliency & Persistence Fallback (`src/db/index.ts` & `src/lib/supabase.ts`)
- **Dual-Mode Data Layer**:
  - Real Cloud SQL / PostgreSQL via `drizzle-orm/node-postgres` when `SQL_HOST` is configured.
  - Fully functional in-memory Drizzle fallback when `SQL_HOST` is not yet provisioned, allowing instant evaluation and zero-crash operation in hosted environments.
- **Supabase Fallback Architecture**:
  - `isSupabaseConfigured` protects against missing credentials with safe dummy endpoints.

---

## 4. Full Monetization & Subscription Endpoints
- **PPV Unlock Status**: `/api/monetization/ppv-unlocks/:identifier` supports both video ID verification and wallet address querying.
- **User Unlocks**: `/api/monetization/user-unlocks?userAddress=0x...` returns complete unlock records with transaction hashes, token symbols, and timestamps.
- **Channel Memberships**: `/api/monetization/membership` and `/api/monetization/user-memberships` track active 30-day subscriptions and tier perks.
- **SuperChats**: Live on-chain chat highlight messages pinned directly into live streams.
- **Creator Stats**: `/api/monetization/creator-stats/:address` calculates live totals across tips, memberships, PPV, and SuperChats.

---

## 5. Verification & Testing
- `npm run lint` (`tsc --noEmit`): Passed with 0 errors.
- `compile_applet` (`vite build`): Succeeded cleanly.
- Dev server runtime: Live on port 3000 with healthy `/api/health` and monetization endpoints.
