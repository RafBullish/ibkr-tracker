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

## Visual refonte status — DA v1.0 (B0→B5)

Branch `dashboard-4k-refonte`, local commit `4b2fc3f`, **not pushed**. Visual layer complete dashboard-wide. Functional bugs below are deferred to a follow-up session.

### Bricks shipped

- **B0 / B0.1 / B0.2** — DA tokens (`--qc-bg-void/base/surface/elevated/overlay/input`, border subtle/default/strong/light, text tertiary bumped to `#7E7E86` for WCAG AA, accent + hover/dim/glow/line, profit/loss/warning + `-bright` siblings, full type scale `micro→hero→display`, weights regular/medium/semibold/bold). `.qc-card` reference class added. Compat layer Phase 0.6 neutralised via `color-mix(in srgb, var(--qc-*) X%, transparent)` — zero hex of marque hardcoded outside `#fff` primitives in color-mix and shadow `rgba(0,0,0,X)`. Geist Sans Variable + Geist Mono Variable installed (`@fontsource-variable/geist` + `geist-mono`) — exact family names `'Geist Variable'` / `'Geist Mono Variable'`.
- **B1** — TickerTape sparklines (prior session, commit `f92f506`).
- **B2 / B2.1 / B2.2 / B2.3** — KPI cards refonte. REALIZED promoted to hero #2 (Day P&L demoted to secondary). Hero/secondary split via row-scoped selectors (`.row--hero` = OLED-floating gradient + arête lumineuse + double drop-shadow ; `.row--secondary` = creusées on `--qc-bg-void` + inset top shadow + reflet bas). Micro-stats inline below the chiffre (JOUR/SEM/MOIS for NLV ; WIN RATE/PF/STREAK for REALIZED). Realized % aberration shield (`realizedPctDisplay = null` if `|pct| > 999` — small initial capital protection).
- **B3** — Charts (Equity + Cumulative P&L) profondeur héros. `chartRange` state lifted to `Dashboard.jsx`, charts accept `range`/`onRangeChange` props in controlled/uncontrolled hybrid pattern → clicking a timeframe on one chart syncs the other. Header 36→32px + subheader padding 10→8px to give canvas more room.
- **B4 / B4.1** — Cockpit `RiskMatrix` profondeur héros + permanent **Options Greeks strip** between subheader and body : Σ Δ / Σ Γ / Σ Θ / Σ ν + N options count, tone-aware (Δ/Θ/ν profit/loss/mute, Γ always mute — Sniper OTM short-call expects Θ green + ν red). `useGreeksAggregate` hoisted to `Dashboard.jsx` and passed via `riskMetrics.greeks`. Rows padding 6→4 to fit content in the shrunk body (B4.1).
- **B5 / B5.3 / B5.5 / B5.7** — Tables (LivePositions + TradeHistory) profondeur DA with attenuated shadow `0 6px 24px` (7 premium surfaces on the dashboard would saturate at full `0 8px 32px`). LP aligned on TH reference pattern : title 15px / 0.16em, header `color-mix(--qc-bg-base 50%)` voilé, rail tone profit/loss `border-left: 3px solid color-mix(--qc-profit/loss 55%)` per tbody tr, badges `IN PROFIT M` (green) + `IN LOSS N` (red) replacing single accent `OPEN N`. **Critical fix B5.7** : `.dash-grid > [grid-area: positions]` switched from `height: auto + min-height: 204 + max-height: 420` to fixed `height: 420px`. Cause : `.live-pos__body { min-height: 0 }` made body intrinsic = 0 in the cell's auto-height calc, so section intrinsic was only 142px (header 40 + sub 46 + footer 56), cell clamped at min-height 204, body squashed to 62px, hiding 5/6 rows. Fixed height matches TH pattern (480px) and resolves the bug. Composite key + colgroup also added (defensive, B5.3 + B5.5).

### Known bugs deferred (next session)

- **CAGR / Recovery / Calmar absurd on small initial capital** : `RiskMatrix` and `useKPIs` derivations divide by `initialCapital` which can be tiny ($100 baseline before first significant deposit). Yields CAGR=28888 %, Recovery=∞, Calmar absurd. Needs a clamp at display (e.g. `null` if `initialCapital < $500` or absolute pct > 999) or an alternate reference like `nlv` or `totalFundedAfterMonth1`.
- **Local dev API failures** : `/api/cboe/*` returns 403 (CBOE proxy access denied locally) and `/api/chart/UNH?range=7d` returns 429 (Yahoo rate-limit under TickerTape polling all symbols). Only affects local dev — TickerTape sparklines empty, no impact on LP / charts / cockpit rendering. Production with proper `ALLOWED_ORIGINS` + Vercel cold-start cadence is fine.
- **`src/components/dashboard/Sparkline.jsx`** : legacy component, possibly dead code — superseded by `PositionSparkline.jsx` (rail sparks in LP) and the dedicated charts. Audit usages and delete if confirmed unused (`feedback_dead_code` rule = 2 weeks).
- **Recharts console warning `width(-1)`** : negative width passed to a chart during mount/resize (likely `ResponsiveContainer` measuring before parent layout settles). Cosmetic, not crashing, but pollutes the console.
- **Orphan token `--qc-hero-strip-h`** in `src/styles/tokens.css` : declared but never referenced anywhere (grep confirms). Safe to delete.
