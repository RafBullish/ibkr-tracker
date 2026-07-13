# ÉTAT DU SITE — QuantumCall v2.3.1 (ligne de base)

Cartographie factuelle du repo à l'état `ea64652` (clôture du 13.07.2026).
Destinataire : l'architecte de la phase finale, sans accès direct au code.
Chaque affirmation a été vérifiée dans le code au moment de la rédaction ;
les incertitudes sont marquées `[À VÉRIFIER]`.

---

## 1. IDENTITÉ & DÉPLOIEMENT

- **Produit** : QuantumCall — tracker d'options personnel mono-utilisateur (achat de premium, doctrine « Sniper OTM »). Nom npm : `quantumcall`.
- **Repo** : github.com/RafBullish/ibkr-tracker (public). Branche unique : `main`.
- **Version** : **2.3.1** (package.json) · hash de clôture **ea64652** · tag **v2.3.1** (posé le 13.07.2026 ; tags antérieurs : v2.0.0, v2.0.1).
- **Vercel** : projet `ibkr-tracker` (id `prj_RApArMFpRix2WtwZ5pXIGQL0PEt5`, team `rafbullishs-projects` / `team_9ymYgzp1xzDvDhphaketRViT`). Prod = déploiement `dpl_5c8YR6suohq12KFvNBrNGo6AMHhW`, état **READY**, construit sur ea64652. Alias de branche : `ibkr-tracker-git-main-rafbullishs-projects.vercel.app`. URL canonique courte [À VÉRIFIER — probablement ibkr-tracker.vercel.app, non confirmée par l'API].
- **Dev local** : `npm run dev` → Vite sur **http://localhost:5173**, bascule automatique sur **5174** si 5173 occupé (toujours lire le port réel dans la sortie).
- **Cible de rendu unique** : viewport CSS **1591×900, DPR 1.35** (écran 4K, Chrome 90 %), thème midnight. Mobile <1440 = socle à ne pas casser, jamais cible de design.

## 2. STACK EXACTE

**Dépendances (package.json, plages `^`)** :
| Paquet | Version | Rôle |
|---|---|---|
| react / react-dom | ^19.2.0 | UI (JS pur, pas de TypeScript) |
| react-router-dom | ^7.13.1 | Routing SPA |
| zustand | ^5.0.12 | Store global |
| recharts | ^3.8.0 | Tous les graphes (lazy-loadé) |
| react-is | ^19.2.4 | **Peer requis par recharts — ne pas retirer** (reconfirmé 2 fois) |
| @tanstack/react-table | ^8.21.3 | Moteur DataTable |
| @tanstack/react-virtual | ^3.13.23 | Virtualisation lignes (>50) |
| @radix-ui/react-dialog / -dropdown-menu / -tooltip | ^1.1.15 / ^2.1.16 / ^1.2.8 | Primitives Modal / ThemeSwitcher / Tooltip |
| framer-motion | ^12.38.0 | Animations (GlassCard, transitions) |
| lucide-react | ^0.577.0 | Icônes |
| date-fns | ^4.1.0 | Dates |
| @fontsource/ibm-plex-sans-condensed | ^5.2.8 | Police de TOUS les chiffres (600/700) |
| @fontsource-variable/geist / geist-mono | ^5.2.9 / ^5.2.8 | Sans générale / mono code |
| @fontsource/inter-tight, @fontsource/jetbrains-mono | ^5.2.7 / ^5.2.8 | Fallbacks (importés via fonts.css) |
| @number-flow/react | ^0.6.0 | **Aucun import trouvé dans src/ — candidat retrait** (§9) |
| @vercel/analytics / speed-insights | ^2.0.1 / ^2.0.0 | Télémétrie Vercel |

**DevDependencies** : vite ^7.3.1, @vitejs/plugin-react ^5.1.1, vitest ^4.1.7, playwright ^1.61.1, @types/react(-dom) (confort IDE, pas de TS).

**Scripts npm** :
- `dev` — serveur Vite (5173/5174).
- `build` — build prod Vite → dist/.
- `preview` — sert le build localement.
- `test` / `test:watch` — Vitest (suites utils/metrics/store, ~233 tests).
- `check:color-law` — linter maison statique de la loi de couleur (§8).
- `audit:visual` — captures Playwright des 12 pages @1591×900 dpr 1.35 (§8).

## 3. ARCHITECTURE DES DOSSIERS

```
api/                    10 fonctions serverless Vercel + 3 helpers (_cors, _rateLimit, _yahooAuth)
  cboe/ chart/ finnhub/ flex/ fx/ health/ quote/ yahoo/
bridge/                 Pont IBKR local (Python, NON déployé) : ibkr_poller.py (ib_async,
                        readonly, port Gateway 4002 paper) + serve.py (HTTP 127.0.0.1:8765)
                        + snapshot.json atomique + launch.py + requirements.txt
docs/                   Documentation versionnée
  captures/final/       12 captures de clôture @1591×900 dpr 1.35 (01-dashboard … 12-settings-api)
public/                 Assets statiques servis tels quels
scripts/                check-color-law.mjs (linter loi de couleur) + visual-audit.mjs (Playwright)
src/
  components/charts/    11 composants graphes (Recharts lazy) — §5
  components/dashboard/ 12 modules du bento Dashboard — §5
  components/fx/        2 bannières d'alerte FX (stale / invalid)
  components/history/   PerformanceAttribution (attribution P&L par raison de sortie)
  components/layout/    7 composants de chrome (AppShell, CommandBar, StatusBar, TickerTape…)
  components/trades/    AddTradeModal (saisie manuelle de trade)
  components/ui/        15 primitives partagées (Modal, DataTable, NumAnat, Tooltip…)
  constants/            featureFlags.js (VITE_FEATURE_GREEK_CENTER) + timing.js (pollings/debounces)
  contexts/             VIDE (dossier résiduel sans fichier)
  data/                 macroEvents2026.js — fallback macro hors-ligne (FOMC/CPI/NFP 2026)
  hooks/                28 hooks custom + 1 test — §5
  pages/                12 pages : Dashboard.jsx, PreMarketBriefing.jsx + trading/ insights/ settings/
  services/             flexApi.js (client du proxy Flex IBKR)
  store/                useStore.js (Zustand + persistance) + reducer.js + migrations.js (schéma v7)
  styles/               23 fichiers CSS — ordre de cascade en §7
  theme/                themes.js + tokens.js (palette JS legacy T.*) + GlobalStyles.jsx + animationVariants.js
  utils/                Calculs purs : metrics/ (Sharpe, Sortino, TWR…), ibkr/ (parse CSV Flex),
                        options/ (Black-Scholes), fx/, trades/ + racine (greeksApi, calculations, risk…)
```
Non versionnés (locaux) : dist/, node_modules/, .venv/, .playwright-mcp/, .claude/.

## 4. LES 12 PAGES

Routing dans `src/App.jsx` (ErrorBoundary racine + cascade FX). Lazy : Greeks, Chain, Analytics. Redirect `/trading/orders` → `/trading/history` ; fallback `*` → `/dashboard`. Aucune route dev-only restante (labs /lab/* purgés à la clôture).

1. **Dashboard** — `/dashboard` · `src/pages/Dashboard.jsx`. Vue synoptique bento 12 colonnes, 5 rangées : EquityChart + DailyPnLChart (timeframe partagé) + RiskMatrix / LivePositions / TradeHistory / Watchlist + CalendarMini / IVRankMovers + SectorHeatmap + AlertsFeed ; strip DashboardKPICards en tête ; bannières FX conditionnelles. Données : store uniquement (positions, trades, settings) + hooks dérivés ; écrit un snapshot quotidien (UPDATE_DAILY_SNAPSHOT, FIFO 60 jours).
2. **Pre-Market Briefing** — `/premarket` · `src/pages/PreMarketBriefing.jsx`. Cockpit J-1 : horloges CET/NY + countdown, rangée régime (VIX/SPX/QQQ/gates armés/USD-CHF/DXY + futures ES/NQ/YM), revue des positions triées par proximité de gate (ARMED/IMMINENT), macro + earnings du jour (Finnhub, fallback local), **routine checklist 6 cases** persistée par jour (`qc:premarket:checks:{date}`, readonly après confirmation).
3. **Positions** — `/trading/positions` · `src/pages/trading/Positions.jsx`. Portefeuille ouvert, 3 branches (vide → flat → live) : strip 5 KPI (positions, Δ net, Θ total, capital engagé, max loss), DataTable 12 colonnes, panneau détail modal view/edit/close (clôture partielle possible), alertes DTE/SL/TP par ligne, deep-link `?focus={id}`. Greeks batch via greeksApi (client, source Yahoo).
4. **History** — `/trading/history` · `src/pages/trading/History.jsx`. Trades clôturés : strip 6 KPI, WinRateDonut, PerformanceAttribution (raisons de sortie tp_50/sl_35/dte_45/pre_earnings/stagnation/manual), histogramme de distribution lazy (`HistoryDistribution.jsx` = sous-composant lazy, pas une page), export CSV, toggle vue sniper/standard (localStorage `ibkr_history_view_mode`).
5. **Greeks Center** — `/trading/greeks` · `src/pages/trading/Greeks.jsx` — **gaté par `VITE_FEATURE_GREEK_CENTER === 'true'`** (route, onglet nav et raccourci ⌘4 conditionnels). 4 KPI héros Δ/Γ/Θ/ν **tous neutres (ink-pure)**, GreekEvolutionChart (évolution mock 30 j — pas d'historique persisté), ThetaDecayProjection, PerPositionGreeksTable, donut vega, Greeks du 2e ordre repliés.
6. **Chain** — `/trading/chain` · `src/pages/trading/Chain.jsx` (lazy). Chaîne d'options : input ticker + pills récents, strip stats (spot, IV30, HV30, max pain…), onglets d'échéance (8 max), OptionsChainTable ancrée ATM avec **thead sticky 2 rangées** (top:0 / top:42px au palier), filtre Sniper OTM (Δ 0.25-0.35, IV Rank <40, DTE 120-150), Greeks Black-Scholes client avec fallback σ=30 % marqué `~`, entrée de trade directe (AddTradeModal), alimente la série IV locale (`qc:ivHistory`).
7. **Analytics** — `/insights/analytics` · `src/pages/insights/Analytics.jsx` (lazy). Post-trade : strip KPI (net P&L, WR, avg R, Calmar, Sharpe…), RiskMetricsRow, WinRateDonut, P&L par jour de semaine (BarChart), PnLCalendarHeatmap modes jour + année, StrategyBreakdown (répartition par type).
8. **Calendar** — `/insights/calendar` · `src/pages/insights/Calendar.jsx`. 3 vues (Annonces / P&L Jour / Année) : macro + earnings Finnhub (badges pays, BMO/SÉANCE/AMC, fallback macroEvents2026 si Finnhub HS), heatmaps P&L. Première page « désintoxiquée » de la palette JS T.* (100 % var(--*) canoniques).
9. **Journal** — `/insights/journal` · `src/pages/insights/Journal.jsx`. Journal psychologique : TiltMeter (score 14 jours pondéré humeur+erreur), kill switch quotidien, entrées (mood/mistake/tags/note), rapprochement flou trade↔entrée (date ±1 j), audit « edge leak » (crosstab tag × P&L).
10. **Settings · General** — `/settings/general` · `src/pages/settings/General.jsx`. ~9 sections plates : profil, localisation, apparence (ThemeSwitcher), risque (max loss journalier), stratégie Sniper (tiers E0-E4 × C1-C5), connexions API (résumé), données, cash flows (ajout/suppression), zone dangereuse (RESET_ALL).
11. **Settings · Import** — `/settings/import` · `src/pages/settings/Import.jsx`. Flux primaire **Flex IBKR** (QueryID + Token → sync avec progression), fallback upload CSV (drag & drop + parse + merge dédupliqué), export sauvegarde JSON + template CSV.
12. **Settings · API** — `/settings/api` · `src/pages/settings/Api.jsx`. Tableau de bord santé des services (Flex/Yahoo/Finnhub/CBOE/FX/stockage/bridge IBKR) via useApiStatus, cartes ApiServiceCard, modal de configuration Flex.

**Chrome commun (AppShell)** : CommandBar sticky haut (logo + 10 onglets + recherche ⌘K) → TickerTape défilant (19 instruments : SPX NDX DJI RUT VIX USD/CHF EUR/USD GOLD US10Y DXY CRUDE DAX FTSE NIKKEI BTC ETH SILVER COPPER NATGAS) → main scrollable → StatusBar sticky bas (feeds + 4 horloges NY/GVA/LDN/TKY + USD/CHF + P&L réalisé + ThemeSwitcher). Mobile : SubNav + BottomNav. Raccourcis globaux ⌘1..9 / ⌘K (CommandPalette) / ⌘/ (CheatsheetModal).

## 5. COMPOSANTS PARTAGÉS & HOOKS

**ui/ (15)** :
- **DataTable** — table générique TanStack (tri, densités, recherche, export CSV, virtualisation >50 lignes, cartes GlassCard <768px, deep-link `?focus=`) ; rowHeight inline 40px → 47px ≥1440.
- **NumAnat** — anatomie du chiffre (D1.2) : enveloppe `$` et séparateurs de milliers dans des spans en retrait pour que les chiffres dominent ; 3 tiers (display ≥40px : $ à 58 % ; mid 18-39px : 70 % ; dense <18px : brut) ; `color: inherit` préserve la couleur P&L.
- **Modal** (Radix Dialog, portal + focus-trap) · **Tooltip** (Radix) · **InfoTooltip** (ⓘ + titre/corps/formule) · **GlassCard** (carte Framer Motion, variants + hover lift) · **StatusBadge** (12 variants live/paper/stale/pass/fail…) · **EmptyState** (placeholder composable + actions) · **ErrorBoundary** (fallback + reload) · **Icons** (16 SVG inline) · **CommandPalette** (fuzzy ⌘K positions+nav) · **CheatsheetModal** (aide raccourcis ⌘/) · **ThemeSwitcher** (dropdown midnight/daylight) · **WinRateDonut** (donut SVG, « — » sous 10 trades) · **ApiServiceCard** (statut service, variantes résumé/détail).
- **layout/ (7)** : AppShell (chrome + raccourcis), CommandBar, StatusBar, TickerTape, BottomNav (mobile), AmbientBackground (2 orbes radiaux fixes), Toast (provider global, stack 3, auto-dismiss 4 s).
- **charts/ (11)** : EquityChart (courbe equity + ranges 5D→ALL), DailyPnLChart (cumul P&L réalisé + badges ATH/DD), GreekEvolutionChart, ThetaDecayProjection (30 j), PerPositionGreeksTable, IVRankHistogram (distribution R-multiples 12 buckets), PnLCalendarHeatmap (modes jour + année, remplace @uiw), RiskMetricsRow (6 KPI risque + jauges), StrategyBreakdown (pie par type), OptionsChainTable (chaîne dense thead sticky), TiltMeter (jauge comportementale).
- **dashboard/ (12)** : DashboardKPICards (strip KPI + sparklines snapshots), LivePositions (grille 19 colonnes + méta Sniper + footer agrégé — partagée Dashboard/Positions), TradeHistory (14 colonnes — partagée Dashboard/History), RiskMatrix (3 colonnes / 7 zones), Watchlist (tickers persistés + quotes), CalendarMini (mois naviguable — vivant, rangée 4 du Dashboard), AlertsFeed (agrégateur DTE/SL/TP/perte journalière), IVRankMovers et SectorHeatmap (**stubs à données vides**, fixtures d'UI), SniperMetaEditor (édition Edge/C-Tier, sidecar `qc:sniperMeta:{id}`), Sparkline, PositionSparkline.
- **Autres** : FxStaleBanner / FxInvalidBanner (fx/), PerformanceAttribution (history/), AddTradeModal (trades/).

**Hooks custom (28, src/hooks/)** :
- *Sélecteurs & métriques* : usePortfolioMetrics (métriques mémoïsées uniques : NLV, realized/unrealized, Calmar, DD — consommé partout), useTradingMetrics (WR/PF/Sharpe/Sortino sur trades clôturés), useRiskMatrix, useEquityHistory (courbe equity par clôture), useDailyPnL (agrégat P&L par date), useLivePositions (transforme le store en lignes 19 colonnes + méta Sniper + prochain gate), useGreeksAggregate (fetch Greeks + agrégat sign-aware), useDailySnapshot (tranches des 60 snapshots quotidiens).
- *Feeds réseau* : useMarketQuotes (poll /api/quote 60 s, cache localStorage, pause onglet caché), useMarketSparklines (poll /api/chart 5 min, backoff 429), useIbkrLive (poll bridge local, gaté par `gwAutoConnect`, dispatch SYNC_IBKR seulement si connected), useFx (slice FX + refresh manuel), useFxAutoRefresh (orchestrateur boot + 5 min), useFxLiveSync (hisse Yahoo USDCHF=X live dans liveRate en mode auto, seuil 1 pip), useCalendarFeeds (earnings + macro Finnhub, cache session 1 h, fallback local), useApiStatus (santé 8 services — source unique Settings/Calendar).
- *Signaux dérivés* : useAlertsFeed (alertes positions + perte journalière), useDailyKillSwitch (limite de perte quotidienne, sync cross-tab), useSniperGates (6 gates par position : SL35/DTE45/EARN-J2/EARN+J30/TP/TRAIL avec fillPct), useIVMovers et useSectorHeatmap (**stubs retournant []**), useAvailableCapital (capital déployable estimé — consommation active [À VÉRIFIER]).
- *Utilitaires* : useMediaQuery (matchMedia), useLiveTheme (re-render charts sur `ibkr:theme-change`), useMarketSession (phase RTH NY, tick 30 s), useWatchlist.

## 6. DONNÉES & ENDPOINTS

**Store Zustand** (`src/store/useStore.js` + `reducer.js` + `migrations.js`) — 6 slices persistées localStorage :
| Clé | Slice | Contenu |
|---|---|---|
| `ibkr_u_o` | openPositions | positions ouvertes (shape : tk/ty/st/ex/ct/mu/pi/pc/fi/fxi/di + lots[] + dteAtEntry + slDollar v7) |
| `ibkr_u_c` | closedTrades | trades clôturés (+ po/fo/fxo/do/pnl/cm + exitReason + flags _auto) |
| `ibkr_u_f` | cashFlows | mouvements de cash (da/ty/a1) |
| `ibkr_u_j` | journalEntries | entrées de journal (mood/mistake/tag/note) |
| `ibkr_u_w` | watchlist | tickers suivis (**clé absente du tableau CLAUDE.md §5 — à y ajouter si réouvert**) |
| `ibkr_u_s` | settings | clés abrégées : r=liveRate, rm=fxMode, rt=fxLastUpdated, rs=fxSource, ds=dailySnapshots (FIFO 60), ic=initialCapitalChf, tier=activeSniperTier {e,c}, cashReport, lastSync, ibkrLiveData, ibkrSummary, ibkrLedger, gwAutoConnect |

Schéma **v7** (`ibkr_schema_v`), 7 migrations chaînées (backfills → exitReason auto → ids → réparation tk vide → état FX → tiers Sniper + slDollar). Persistance debouncée ; RESET_ALL préserve FX/tier/watchlist. ~30 types d'actions reducer (ADD/UPDATE/CLOSE/DELETE position, SYNC_IBKR atomique, SYNC_FLEX dédupliqué par signature, IMPORT_DATA additif, etc.).

**Endpoints serverless (10 routes + 3 helpers, `api/`)** — tous CORS allowlistés + rate-limités par bucket/IP (in-memory) :
| Route | Source upstream | Consommateurs |
|---|---|---|
| GET /api/quote/[ticker] | Cascade Finnhub (4 s) → Yahoo (6 s) → CBOE (5 s), cache 30/300 s | useMarketQuotes (TickerTape, Watchlist, PreMarket, useFxLiveSync) |
| GET /api/chart/[ticker] | Yahoo v8 chart (cookie+crumb), cache 300 s, bucket 90/min | useMarketSparklines |
| GET /api/yahoo/[ticker] | Yahoo v7 options (cookie+crumb, retry 401), cache 300 s | Chain (chaîne + Greeks client), probe useApiStatus |
| GET /api/finnhub/[ticker] | Finnhub /quote (FINNHUB_KEY server-only), cache 30 s | 1re étape de la cascade quote |
| GET /api/finnhub/earnings | Finnhub /calendar/earnings, cache 1 h | useCalendarFeeds (Calendar, PreMarket) |
| GET /api/finnhub/economic | Finnhub /calendar/economic, cache 1 h | useCalendarFeeds |
| GET /api/cboe/[ticker] | CDN CBOE delayed quotes, cache 5 min | Dernière étape cascade quote |
| GET /api/fx/usdchf | Twelve Data (TWELVE_DATA_KEY, 60 s) → Frankfurter ECB (1 h) | useFx.refresh (manuel + auto 5 min) |
| GET /api/health/finnhub | Ping Finnhub SPY, toujours 200 {ok,…} | useApiStatus, fallback Calendar |
| POST /api/flex/sync | IBKR Flex WebService (SendRequest → GetStatement, retries 1019) ; credentials en **headers** X-IBKR-Flex-* | syncFlex → Import.jsx |

`vercel.json` : rewrite SPA (tout sauf /api → index.html) + headers sécurité (HSTS, X-Frame DENY, CSP stricte).
**Il n'existe PAS d'endpoint /api/greeks** : les Greeks sont calculés **côté client** (`src/utils/greeksApi.js` + `blackScholes.js`) à partir de la chaîne /api/yahoo, avec fallback IV σ=30 %.

**Flux** :
- **Flex IBKR** (source comptable) : token en sessionStorage (effacé à la fermeture d'onglet), queryId en localStorage ; POST proxy → CSV → `utils/ibkrParser.js` → merge dédupliqué → IMPORT_DATA/SYNC_FLEX. Additif, jamais destructif.
- **Bridge live local** (`bridge/`, optionnel, non déployé) : poller Python ib_async readonly (Gateway paper 4002) → snapshot.json atomique → serve.py 127.0.0.1:8765 → useIbkrLive (gaté gwAutoConnect ; positions vides jamais dispatchées → protège la saisie manuelle).
- **FX USD→CHF** : Yahoo live (auto) → Twelve Data/Frankfurter (endpoint) → saisie manuelle ; validation `isValidFxRate` [0.01, 100] ; stale >24 h, critical >7 j (bannières).
- **REAL vs seed** : aucune donnée de démo dans l'app. Le seed n'existe que dans `scripts/visual-audit.mjs` (dataset à dates relatives injecté via addInitScript dans un contexte Playwright éphémère). **Protection du portefeuille réel = isolation Playwright `--isolated` obligatoire** (CLAUDE.md §7) — toute écriture localStorage en session non isolée écraserait les clés `ibkr_u_*` réelles.

## 7. SYSTÈME DE DESIGN

**DA « Brutalisme Financier »** — source unique `src/styles/canonical.css` (~237 lignes) :
- Plans de profondeur : `--depth-void #070708` (fond ultime) · `--depth-base #0A0A0B` · `--depth-raised #0F0F11` (panneaux) · `--depth-focus #1D1D23` + `--depth-focus-line rgba(255,160,40,.50)`.
- Filets : `--line-hairline rgba(255,255,255,.06)` · `--line-emphasis rgba(255,255,255,.12)`.
- Encres : `--ink-pure #FAFAFA` (données) · `--ink-soft #9A9AA2` (labels) · `--ink-mute #8A8A92` (captions, ≥4.5:1 sur raised).
- P&L : `--pnl-up #10B981` · `--pnl-down #EF4444`. Accent : `--accent #FFA028` (ambre décisionnel) + `--accent-soft` (color-mix 18 %).
- Typo : `--qc-font-num 'IBM Plex Sans Condensed'…` — police de TOUS les chiffres ; `--qc-font-mono` et `--qc-font-hero` en sont des **alias** (D1.2) ; `--qc-font-code` = Geist Mono/JetBrains (seule vraie monospace). Échelle de base : caption 12 / body 14 / title 16 / cell-value 16 / display 28 / **hero 64** (+ héros Dashboard 56px dans v4-dashboard.css, brique 14 « V1 Dense »). Chiffres en tabular-nums, anatomie via NumAnat (§5).

**Thèmes** : 2 actifs — **midnight** (défaut) et **daylight** — définis dans `src/theme/themes.js` (couche JS T.* legacy : surfaces, profit #16C784 / loss #EA3943 midnight ; #00875A / #C9252D daylight WCAG AA) et `tokens.css` (`:root` + `[data-theme='daylight']`). Appliqués par `GlobalStyles.jsx` (attribut `data-theme` + classe `is-light` sur `<html>`, clé `ibkr_theme`, événement `ibkr:theme-change` re-rend les charts via useLiveTheme). 8 anciens thèmes migrent automatiquement (LEGACY_MAP). **Limite connue : canonical.css ne définit AUCUNE variante daylight** → les pages canoniques restent sombres en daylight (pré-existant, acté hors scope en D1.2).

### LOI DE COULEUR (constitutionnelle, mot pour mot)

> **Le ROUGE = perte d'argent réel uniquement.** (De même, le vert = gain d'argent
> réel.) Les valeurs de **Greeks (delta, gamma, theta, vega)** sont **TOUJOURS
> neutres**, quel que soit leur signe.

Perte réelle = P&L réalisé négatif, P&L latent négatif, Max Loss — seul rouge autorisé sur une valeur chiffrée. Vaut pour delta **et** ses dérivés directionnels (delta-dollar, Σ Δ). Theta neutre = décision C.3, cross-page. L'ambre reste réservé aux signaux décisionnels, jamais une sémantique P&L. Contrôle statique : `npm run check:color-law`.

**Échelle S2 (D2.F, ×1.30 calibrée)** — palier `@media (min-width:1440px)` dans `src/styles/c3-hires.css` (~749 lignes, sentinelle `--c3-tier: active`), scopé page par page, mobile <1440 intact. Barème effectif ≥1440 :
- **Plancher caption 17px** (`--type-caption`, `--qc-fs-micro`, `--fs-xs/sm/base`, labels KPI, chips — tous remontés à 17).
- Intermédiaires : `--fs-md 17` / `--fs-lg 18` / `--fs-xl 21` / `--fs-2xl 23` / `--type-body 18` / `--type-title 21` / `--type-cell-value 21`.
- **KPI `--type-display` 44px**. Strip marchés 21/16/18. Cellules `.v3-table` **20px** (weight 600), **rowHeight DataTable 47px** (40px sous 1440).
- **Ticks charts Recharts plafonnés 14px** (data-viz, pas texte de lecture). **Héros 56/64 intouchés**.

**Architecture CSS** — ordre d'import dans `src/main.jsx` = ordre de cascade (dernier gagne) :
`tokens.css` (variables legacy) → fonts (geist, geist-mono, ibm-plex 600/700, fonts.css) → `global` → `animations` → `responsive` → `components` → `dashboard` → `aura-boost` → `primitives` → `v3-components` (table dense partagée .v3-table Positions/History/Greeks) → `v4-shell` (CommandBar/StatusBar) → `v4-dashboard` (bento 12 col) → `v5-chain` (Chain) → **`canonical.css`** (palette canonique + alias Transition Zone --qc-* pour Dashboard) → `pages-positions` → `pages-greeks` → `pages-import` → `pages-settings` (partagé General/Api/Journal) → `pages-history` → `pages-premarket` → `pages-dashboard` → `pages-calendar` → **`c3-hires.css` en dernier (le palier gagne)**. Règle : toute densité ≥1440 passe par c3-hires.css scopé page, jamais en hack local.

## 8. QUALITÉ & OUTILLAGE

**Gates avant tout merge** : `npm run build` vert + `npm run check:color-law` = 0 violation + preuve visuelle par captures.
- **check:color-law** (`scripts/check-color-law.mjs`) — linter statique maison, PAS un test : scanne src/*.js(x), signale toute ligne combinant un signal de couleur P&L (classes text-profit/loss, tokens --pnl-*/--qc-profit/loss, toneFromSign…) ET une référence de Greek (accès propriété, agrégats sumDelta…, fieldKey, Σ) ; jamais de mot nu « delta » (exclut les faux positifs écart/variation) ; commentaires ignorés. Sortie `fichier:ligne` + extrait, exit ≠ 0 si ≥1.
- **audit:visual** (`scripts/visual-audit.mjs`) — Playwright : sonde 5173 puis 5174 (`AUDIT_BASE_URL` force), contexte éphémère, **seed reproductible à dates relatives injecté avant tout script d'app**, capture les 12 pages à 1591×900 dpr 1.35 midnight vers `docs/captures/audit-AAAAMMJJ/`. Des captures vides = travail non terminé. Le jeu final de clôture vit dans `docs/captures/final/` (12 fichiers).
- **Tests** : Vitest sur utils/metrics/store (~233 tests) — **jamais citer un compte de tests comme preuve de non-régression** : la preuve est visuelle, page par page, @1591.

**Méthode de validation visuelle (doctrine §7 CLAUDE.md)** : dev server → Playwright MCP **isolé** (`--isolated` obligatoire ; interdits : --channel chrome, --cdp-endpoint, --user-data-dir partagé) → route @1591×900 dpr 1.35 midnight → **exercer** la feature (clic, survol, scroll) → 0 overflow horizontal, 0 chevauchement → lire capture/snapshot a11y → console propre. `browser_snapshot` pour la structure, screenshot réservé à la confirmation finale.

**Consoles tolérées (liste exacte, pré-existantes)** : erreurs `500` finnhub sur symboles non servis ; warnings Recharts `width(-1)/height(-1)` au mount. Variante observée : `502` sur `^NDX` (symbole du header non servi par la cascade).

## 9. RÉSIDUS CONNUS & CANDIDATS

Rapport seulement — aucune action prise, aucune désinstallation.
- **Tooltips Recharts inline 11/12px** : `tick={{fontSize:12}}` (EquityChart, DailyPnLChart), fontSize 10/11 (HistoryDistribution, GreekEvolution, day chart), legend 11 (WinRateDonut) — au palier ≥1440 les ticks/legend sont rattrapés par le cap CSS 14px ; les tooltips inline restent en-dessous (résidu B-final connu).
- **Heatmap année 9/10px** : `.pnl-calendar__year-month-label` 10px + jours 9px (PnLCalendarHeatmap mode année) — différé sciemment (cellules 12px, 13px déborderait la grille).
- **Warning build chunks >500 kB** : `recharts` 542.33 kB (gzip 150.24) et `index` 651.53 kB (gzip 191.06) minifiés — build vert en 6.87 s, warning cosmétique Rollup.
- **depcheck** (rapport brut) : « unused » = `@fontsource/inter-tight`, `@fontsource/jetbrains-mono` (**faux positifs** — importés via `@import` dans fonts.css, que depcheck ne parse pas) et `@number-flow/react` (**vrai candidat** : 0 occurrence dans src/). `react-is` non signalé et de toute façon load-bearing (peer recharts).
- **Hardcodes hex résiduels** : fallbacks legacy dans WinRateDonut (#0ecb81/#f6465d/#27272a/#71717a — fallbacks des tokens T.*), badge STK cyan #42A5F5 (Calendar, vague cyan-kill différée).
- **Commentaires CSS historiques** : v3/v4/v5 et mentions de briques passées dans v3-components/v4-dashboard/v5-chain (inoffensifs, volumineux : v4-dashboard ~160 Ko, v3-components ~130 Ko).
- **Stubs vivants à données vides** : useIVMovers, useSectorHeatmap (les modules Dashboard correspondants rendent leur état vide) ; useAvailableCapital consommation [À VÉRIFIER].
- **Divers** : `src/contexts/` vide ; daylight non couvert par canonical.css (§7) ; GreekEvolutionChart sur mock (pas d'historique Greeks persisté) ; série IV locale `qc:ivHistory` collectée mais jamais affichée (U13-collecte).

## 10. HISTORIQUE & DÉCISION

Couches livrées (chacune mergée sur main avec GO le cas échéant) :
- **C.3** — densification 4K : palier ≥1440 (c3-hires.css), 12 pages @1591, theta neutre cross-page, thead sticky Chain (v2.1.0).
- **D0** — fondation : constitution CLAUDE.md, sweep loi de couleur, fix carte EXPOSURE/DÉPLOYÉ, scripts check:color-law + audit:visual (v2.1.1).
- **D1 / D1.2** — typographie : lab /lab/typo → choix « C » IBM Plex Sans Condensed 700 pour tous les chiffres, alias --qc-font-num, NumAnat partagé, purge Iosevka −44 Ko (v2.1.2 / v2.2.0).
- **D2 + D2.F** — densité terminale + échelle calibrée **S2 ×1.30** au lab /lab/scale : KPI 44, cellules 20/row 47, plancher 17, ticks cap 14, héros intouchés (v2.3.0).
- **Clôture 13.07.2026** — décision propriétaire : chantiers D3→D7 **annulés**, labs dev-only purgés, branches supprimées, captures finales, **v2.3.1** = version finale (ea64652, tag v2.3.1). Mode maintenance : correctif ponctuel sur demande explicite uniquement ; règles permanentes en vigueur (loi de couleur, interdits git, viewport 1591, vérification visuelle, gates build/color-law).

**Phase finale à venir : transformation visuelle pilotée depuis un Projet Claude — ce document est sa ligne de base.**
