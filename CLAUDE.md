# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**QuantumCall** — single-user IBKR portfolio tracker (options-heavy). Vite 7 + React 19 SPA, Zustand store, deployed on Vercel with a thin serverless API layer for upstream proxies (IBKR Flex, Finnhub, Yahoo, CBOE, FX). UI is in French (`<html lang="fr">`).

## Commands

```
npm run dev      # Vite dev server on :5173, with custom vercel-dev-api plugin
npm run build    # Vite production build → dist/
npm run preview  # serve the built bundle
```

No lint/format/test scripts are wired. There is no test runner in this repo — past `*.test.*` files have been removed.

## High-level architecture

### State (`src/store/`)

- **Zustand store** with a `dispatch(action)` shim over a pure `applyAction(state, action)` reducer — keeps the call sites looking like `useReducer` while letting components subscribe via granular selectors (`useOpenPositions`, `useClosedTrades`, `useCashFlows`, `useJournalEntries`, `useSettings`, `useDispatch`).
- **Always use the granular selectors** instead of building a composite `{ state }` bag — composites get a new reference each render and silently invalidate every downstream `useMemo`. `usePortfolioMetrics` (`src/hooks/usePortfolioMetrics.js`) is the model to follow.
- **localStorage persistence** is set up outside React via `useZustandStore.subscribe`. Writes are reference-gated AND debounced (`DEBOUNCE.SETTINGS_PERSIST_MS=150`, `DEBOUNCE.DATA_PERSIST_MS=500`). Storage keys: `ibkr_u_o` (open positions), `ibkr_u_c` (closed trades), `ibkr_u_f` (cash flows), `ibkr_u_j` (journal), `ibkr_u_s` (settings). Settings persist only non-default fields under short keys (`r`, `rm`, `rt`, `rs`, `ds`, …) — keep the shape symmetric with `loadInitialState` / `persistSettings`.

### Persistence schema & migrations (`src/store/migrations.js`)

- `CURRENT_SCHEMA_VERSION = 6`, stored under `ibkr_schema_v`. On load, `runMigrations` walks `MIGRATIONS[fromVersion..CURRENT-1]` in order.
- **Migration rules**: each step is a pure `(state) => state`; never mutate; never delete a previous migration (users with old data depend on it); when adding one, bump `CURRENT_SCHEMA_VERSION` and append at the matching index of `MIGRATIONS`.
- **Trade/position shape is documented in detail at the top of `migrations.js`** — read it before touching the data model. Fields use short abbreviations (`tk`, `as`, `dir`, `ty`, `st`, `ex`, `ct`, `pi`, `po`, `fi`, `fo`, `fxi`, `fxo`, `mu`, `pc`, `di`, `do`, `pnl`, `cm`, `lots`, `_ibkr*`). These are persisted in users' localStorage — renaming them is a breaking change that requires a migration.
- `deltaAtEntry` / `ivAtEntry` / `ivRankAtEntry` are intentionally null on every trade — IBKR Flex doesn't expose underlying spot at trade time. A future migration will backfill once a historical-spot source lands; v2 records carry `_deltaApproximated: true` as the re-migration marker.

### Routing & shell (`src/App.jsx`, `src/components/layout/AppShell.jsx`)

- `BrowserRouter` with `vercel.json` SPA rewrite (`/((?!api/).*) → /index.html`). All routes nest under `<AppShell>`. Heavy pages (`Chain`, `Greeks`, `Analytics`) are `lazy()` + wrapped in `ErrorBoundary` + `Suspense`. `Greeks` route is gated by `FEATURE_GREEK_CENTER`.
- `AppShell` is top-down chrome (no vertical sidebar): `CommandBar` (sticky top) → `TickerTape` → `<main>` → `StatusBar` (sticky bottom) → mobile `BottomNav`. Global keyboard shortcuts: ⌘K (palette), ⌘/ (cheatsheet), ⌘1..9 (jump via `NAV_PATHS`). ⌘4 = Greeks slot stays reserved when the flag is off so the rest of the mapping is stable.
- The old vertical `Sidebar` / `Header.jsx` is dead code that hasn't been deleted yet (see `feedback_dead_code` rule: kill after 2 weeks unused).

### Serverless API (`api/`)

- Vercel serverless functions. Two shared helpers every endpoint must call:
  - `applyCors(req, res, opts)` from `api/_cors.js` — explicit allowlist (`ALLOWED_ORIGINS` env + `VERCEL_URL`); no permissive fallback in production. Dev allows only `http://localhost:5173` and `http://localhost:3000`.
  - `enforceRateLimit(req, res, { max, windowMs, bucket })` from `api/_rateLimit.js` — in-memory Map, per-instance, scoped by `x-forwarded-for`. Pragmatic ("defang accidental loops"), not DoS-grade. Swap for `@upstash/ratelimit` if cross-instance state is ever needed.
- `vite.config.js` ships a **`vercelDevApi` plugin** that runs the `api/**/*.js` handlers inside the Vite dev server. Resolution: exact static (`api/a/b.js`) → single-segment dynamic (`api/a/[param].js`). Hot-reloads on every request via a cache-busting `?t=` import URL — edits to handlers don't need a restart, but edits to shared deps like `_cors.js` do.
- Two routes are **deliberately excluded** from the dev plugin and go through Vite's HTTP `server.proxy` instead: `/api/cboe` (needs CORS bypass to CDN) and `/api/ibkr` (needs `secure: false` for the IBKR Gateway's self-signed cert on `https://localhost:5000`).
- `api/flex/sync.js` posts to IBKR Flex Web Service. **Credentials travel in `X-IBKR-Flex-Token` / `X-IBKR-Flex-Query-Id` headers, never in the body** — same pattern client-side in `src/services/flexApi.js`. The token is stored in `sessionStorage` (cleared on tab close), the query ID in `localStorage`.
- `api/quote/[ticker].js` is the canonical multi-source cascade pattern: try Finnhub → Yahoo (`fetchYahoo` from `_yahooAuth.js` handles cookie+crumb) → CBOE delayed. Returns 200 with `source` + `stale` flags; only 502 on total failure.

### Environment & secrets

- `.env.example` is the contract. **`VITE_`-prefixed vars land in the browser bundle** — only for UI feature flags (`VITE_FEATURE_GREEK_CENTER` is the live example, compared with `=== 'true'` in `src/constants/featureFlags.js`). Server-only secrets (`FINNHUB_KEY`, `TWELVE_DATA_KEY`) must not be prefixed.
- `ALLOWED_ORIGINS` must be set in production or every cross-origin API call gets a 403.

### Theming & styling

- **Two themes only**: `midnight` (default dark) and `daylight` (light), with `[data-colorblind='true']` and `prefers-reduced-motion` overrides. Source of truth = `src/styles/tokens.css`. JS mirror = `src/theme/themes.js` (consumed by Recharts / lightweight-charts wrappers that can't read CSS vars).
- `src/theme/tokens.js` exposes `applyTheme(key)` for runtime switching. CSS consumers update instantly; the JS `T` cache is read once at import time — acceptable since both palettes are equivalent.
- `LEGACY_MAP` in `tokens.js` migrates 8 retired theme keys (obsidian, terminal, neon, graphite, carbon, frost, sakura, porcelain) on first load. Don't remove entries.
- **14 stylesheets are imported in deterministic order in `src/main.jsx`** — `v3-components.css`, `v4-shell.css`, `v4-dashboard.css`, `v5-chain.css` are loaded **last so their rules win** when class names overlap. Respect the order when adding new sheets.
- Density tokens (`--row-data`, `--row-compact`, `--header-row`, etc.) were enlarged in the 4K refonte (Phase B/C). Original Bloomberg-grade values are commented in `tokens.css` Section A for a quick revert.

### CSP

`vercel.json` ships a tight Content-Security-Policy: `default-src 'self'`, script-src whitelist limited to Vercel Analytics/SpeedInsights. Any new external script/connect needs to be added there or it will silently break in production.

### Tooling notes

- `vite.config.js` ships a manual `rollupOptions.output.manualChunks` split (`recharts`, `radix-vendor`, `motion-vendor`, `table-vendor`, `vendor`) — keep new heavy deps off the main chunk by adding them here.
- `MEMORY.md` and the `.claude/` directory carry session-history notes from prior refonte phases. They are gitignored and not authoritative for current code state — when something there contradicts the code, trust the code.
