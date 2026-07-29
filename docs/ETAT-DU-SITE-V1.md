# ÉTAT DU SITE — QuantumCall v1.0.0-rc.7 (phase finale v1.0, après brique 1.E)

Cartographie factuelle du repo à l'état `main 6ba8ed0` (29.07.2026, après merge
de la brique 1.E « Héros 2 · Réalisé »). Destinataire : l'architecte de la phase
finale, sans accès direct au code. Chaque affirmation a été vérifiée dans le code
au moment de la rédaction (build + suite de tests relancés ce jour) ; les
incertitudes sont marquées `[À VÉRIFIER]`. Remplace `ETAT-DU-SITE.md` (baseline
v2.3.1, conservé comme référence historique).

---

## 1. IDENTITÉ & DÉPLOIEMENT

- **Produit** : QuantumCall — tracker d'options personnel mono-utilisateur (achat de premium, doctrine « Sniper OTM »). Nom npm : `quantumcall`.
- **Repo** : github.com/RafBullish/ibkr-tracker (public). Branche unique : `main`.
- **Version** : **1.0.0-rc.7** (package.json) · hash courant **6ba8ed0** (merge 1.E). Tags posés : v2.0.0, v2.0.1, v2.3.1 (aucun tag v1.0.0-rc.*).
- **Phase** : **phase finale v1.0 OUVERTE** (depuis le 15.07.2026), ligne de base v2.3.1 (`ea64652`). Briques livrées : 1.A (rc.1) · 1.B (rc.2) · 1.C (rc.3) · 1.S (rc.4) · 1.D (rc.5) · fast-follow liquidité IBKR (rc.6) · 1.E (rc.7). Prochaine : **1.F — Bande décision** (dernière brique du Dashboard).
- **Vercel** : projet `ibkr-tracker` (id `prj_RApArMFpRix2WtwZ5pXIGQL0PEt5`, team `rafbullishs-projects` / `team_9ymYgzp1xzDvDhphaketRViT`). Prod = déploiement `dpl_GTugUUe2JeHt5MNT6FpXwoQcRRWP`, état **READY**, construit sur 6ba8ed0. Alias prod : **ibkr-tracker-lemon.vercel.app** (canonique), ibkr-tracker-rafbullishs-projects.vercel.app, ibkr-tracker-git-main-rafbullishs-projects.vercel.app. Preview automatique par branche.
- **Dev local** : `npm run dev` → Vite sur **http://localhost:5173**, bascule automatique sur **5174** si 5173 occupé (toujours lire le port réel dans la sortie).
- **Cible de rendu unique** : viewport CSS **1591×900, DPR 1.35** (écran 4K, Chrome 90 %), thème midnight. Mobile <1440 = socle à ne pas casser, jamais cible de design.

## 2. STACK EXACTE

**Dépendances (package.json, 24 paquets, plages `^`)** :
| Paquet | Version | Rôle |
|---|---|---|
| react / react-dom | ^19.2.0 | UI (JS pur, pas de TypeScript) |
| react-router-dom | ^7.13.1 | Routing SPA |
| zustand | ^5.0.12 | Store global |
| recharts | ^3.8.0 | Graphes Recharts restants (lazy) — Greeks, Analytics, heatmaps, Distribution |
| **lightweight-charts** | **^5.2.0** | **Graphes terminaux Héros 1 & 2** (TradingView, Apache-2.0, ajoutée en 1.D, code-split sur son propre chunk) |
| react-is | ^19.2.4 | **Peer requis par recharts — ne pas retirer** (reconfirmé 2 fois) |
| @tanstack/react-table | ^8.21.3 | Moteur DataTable |
| @tanstack/react-virtual | ^3.13.23 | Virtualisation lignes (>50) |
| @radix-ui/react-dialog / -dropdown-menu / -tooltip | ^1.1.15 / ^2.1.16 / ^1.2.8 | Primitives Modal / ThemeSwitcher / Tooltip |
| framer-motion | ^12.38.0 | Animations (GlassCard, LazyMotion racine) |
| lucide-react | ^0.577.0 | Icônes |
| date-fns | ^4.1.0 | Dates |
| @fontsource/ibm-plex-sans-condensed | ^5.2.8 | Police de TOUS les chiffres (600/700) |
| **@fontsource-variable/doto** | **^5.2.10** | **Tape LED** (1.C.10) — importée uniquement par TickerTape.jsx + micro-font locale « Doto Zero Plein » (1 Ko, src/assets/fonts/) |
| @fontsource-variable/geist / geist-mono | ^5.2.9 / ^5.2.8 | Sans générale / mono code |
| @fontsource/inter-tight, @fontsource/jetbrains-mono | ^5.2.7 / ^5.2.8 | Fallbacks (importés via fonts.css) |
| @number-flow/react | ^0.6.0 | **MORT — 0 import dans src/, candidat retrait** (encore listé dans manualChunks `motion-vendor`, vite.config.js) |
| @vercel/analytics / speed-insights | ^2.0.1 / ^2.0.0 | Télémétrie Vercel |

**DevDependencies (6)** : vite ^7.3.1, @vitejs/plugin-react ^5.1.1, vitest ^4.1.7, playwright ^1.61.1, @types/react(-dom) (confort IDE, pas de TS).

**Scripts npm (7)** :
- `dev` — serveur Vite (5173/5174).
- `build` — build prod Vite → dist/. **Mesuré ce jour (rc.7) : vert en ~7 s** ; chunks : index 635.29 kB (gzip 189.75) · recharts 542.33 kB (gzip 150.24) · **lightweight-charts 179.47 kB (gzip 58.00) sur son propre chunk** · motion-vendor 131.26 · radix-vendor 88.46 · table-vendor 68.81 · CSS 454.35 (gzip 86.13). Warning Rollup >500 kB persistant (cosmétique).
- `preview` — sert le build localement.
- `test` / `test:watch` — Vitest. **Mesuré ce jour : 26 fichiers, 243 tests, 100 % verts en ~1 s.**
- `check:color-law` — linter maison statique de la loi de couleur (§8).
- `audit:visual` — captures Playwright des 12 pages @1591×900 dpr 1.35 (§8).

## 3. ARCHITECTURE DES DOSSIERS

```
api/                    10 routes serverless Vercel + 3 helpers (_cors, _rateLimit, _yahooAuth)
  cboe/ chart/ finnhub/ flex/ fx/ health/ quote/ yahoo/
bridge/                 Pont IBKR local (Python, NON déployé) : ibkr_poller.py (ib_async,
                        readonly, Gateway paper 4002, poll 5 s) + serve.py (HTTP 127.0.0.1:8765,
                        /health + /account) + snapshot.json atomique (gitignoré) + launch.py
docs/                   ETAT-DU-SITE.md (baseline 2.3.1) · ETAT-DU-SITE-V1.md (ce doc) ·
  captures/             12 jeux versionnés : 1a-fondation → 1e-heros2 (le plus récent) + final/
  croquis/              croquis 1.C
public/                 Assets statiques
scripts/                check-color-law.mjs + visual-audit.mjs (rien d'autre)
src/
  assets/fonts/         doto-zero-plein.woff2 (micro-font tape LED, 1 Ko)
  components/charts/    Kit Obsidienne (obsidienne.js) + 9 charts Recharts vivants
                        + 2 MORTS (EquityChart, ObsidienneTooltip) — §5
  components/dashboard/ Dashboard v1.0 : MarketDeck, Hero1 + hero1/, Hero2 + hero2/,
                        RiskMatrix, LivePositions, TradeHistory, Watchlist, CalendarMini,
                        AlertsFeed, SniperMetaEditor, PositionSparkline + 2 MORTS — §5
  components/fx/        2 bannières d'alerte FX (stale / invalid)
  components/history/   PerformanceAttribution (heatmap Edge×Capital)
  components/layout/    AppShell, SideNav, TickerTape, StatusBar, BottomNav, Toast
  components/trades/    AddTradeModal
  components/ui/        15 primitives partagées (Modal, DataTable, NumAnat, CommandPalette…)
  constants/            featureFlags.js (VITE_FEATURE_GREEK_CENTER) + timing.js (cadences)
  contexts/             VIDE (coquille résiduelle, 0 fichier tracké)
  data/                 macroEvents2026.js — fallback macro hors-ligne
  hooks/                25 hooks (23 vivants, 2 morts) + __tests__/ (2 fichiers) — §5
  pages/                12 pages : Dashboard.jsx, PreMarketBriefing.jsx, trading/ (4 +
                        HistoryDistribution lazy), insights/ (3), settings/ (3)
  services/             flexApi.js (client du proxy Flex IBKR)
  store/                useStore.js (Zustand + persistance) + reducer.js + migrations.js (v7)
  styles/               28 fichiers CSS — cascade en §7
  theme/                themes.js + tokens.js (palette JS legacy T.*) + GlobalStyles.jsx
  utils/                Calculs purs : nlvSeries.js (série NLV Héros 1), metrics/, ibkr/,
                        options/ (Black-Scholes), fx/, trades/, ivHistory.js, sniperMeta.js…
```
Non versionnés (locaux) : dist/, node_modules/, .venv/, .playwright-mcp/, .claude/, docs/captures/audit-*/.

## 4. LES 12 PAGES

Routing dans `src/App.jsx` : `LazyMotion` → `BrowserRouter` → `ErrorBoundary` → bannières FX → routes toutes enfants du layout `<AppShell>`. Lazy : Chain, Greeks, Analytics. Redirect `/trading/orders` → `/trading/history` ; fallback `*` → `/dashboard`. **Aucune route /lab/* ni dev-only** (grep vérifié). Cascade FX montée à la racine : `useFxAutoRefresh` (boot + 5 min) puis `useFxLiveSync` (Yahoo USDCHF=X, 60 s, seuil 1 pip).

1. **Dashboard v1.0** — `/dashboard` · `src/pages/Dashboard.jsx`. **Ordre vertical actuel** :
   1. **`.cockpit`** (cadre gris harmonisé) → **MarketDeck** seul — étage marché D2-FINALE (1.C, intangible) : macro-grille 3 colonnes × 2 rangées à hairlines continues — R1 : SessionCell (état + countdown) · IndexTile ×4 SPX/NDX/DJI/RUT (courbes intraday 1d/5m + jauge d'amplitude) · VolCell (VIX + courbe + échelle graduée 10/15/20/27/40 + Δ5J) ; R2 : AgendaCell (héros + ARMED ≤ J-2, Finnhub ∪ fallback local) · FxCell (USD/CHF appliqué, EUR/USD, US10Y, DXY) · MondeCell 2×5 (DAX FTSE NIKKEI BTC ETH / GOLD SILVER COPPER CRUDE NATGAS) · FutCell (ES/NQ/YM permanents).
   2. `.dash-grid` : **Héros 1** (1.D, pleine largeur — §5 détail) → **Héros 2** (1.E, pleine largeur, jumeau) → RiskMatrix (pleine largeur) → LivePositions (19 col) → TradeHistory (12 col) → Watchlist | CalendarMini → AlertsFeed.
   - Le CommandDeck (1.A) a **migré dans Héros 1** (PortfolioDeck) ; EquityChart et DailyPnLChart sont **remplacés** par les héros. Writer local `useDailySnapshotWriter()` (Dashboard.jsx:48-98) : dispatch `UPDATE_DAILY_SNAPSHOT` au mount + à chaque changement de deps — **aucun snapshot n'est écrit un jour où le Dashboard n'est pas visité**.
2. **Pre-Market Briefing** — `/premarket` (⌘0). Horloges CET/NY + countdown (tick 1 s), rangée régime (VIX seuils 15/20/30, SPX, QQQ, gates armés, USD/CHF, DXY) + futures ES/NQ/YM, revue positions par gates (`useSniperGates`, clic → `?focus=`), macro + earnings du jour (fallback local), checklist 6 cases persistée `qc:premarket:checks:{date}`.
3. **Positions** — `/trading/positions`. 3 branches (vide → flat → live) : strip 5 KpiTile (Θ total **neutre** ; ⚠ Max Loss encore en rouge — amendement du 15.07 planifié brique 2.A), fraîcheur Greeks, DataTable 12 colonnes, modal détail view/edit/close, deep-link `?focus={id}`.
4. **History** — `/trading/history`. Toggle vue Standard/Sniper (`ibkr_history_view_mode`), strip 6 KPI, filtres, DataTable (vue sniper : Δ entry/DTE entry/IVR/Motif de sortie éditable), WinRateDonut + HistoryDistribution (lazy), PerformanceAttribution, export CSV, AddTradeModal.
5. **Greeks Center** — `/trading/greeks` — **gaté `VITE_FEATURE_GREEK_CENTER === 'true'`** (route + nav + ⌘4 conditionnels ; `.env` local = true ; valeur prod Vercel [À VÉRIFIER]). 4 KPI Δ/Γ/Θ/ν **tous neutres** (NumAnat), GreekEvolutionChart (**mock** random-walk 30 j, dernier point réel — pas d'historique persisté), ThetaDecayProjection, PerPositionGreeksTable, donut vega, 2ᵉ ordre replié.
6. **Chain** — `/trading/chain` (« Options Live », lazy). Input + 5 récents (`chain_history`), strip stats (spot, ATM IV, Sniper Zone |Δ| 0.25-0.35, IVR « — »), 8 échéances max, OptionsChainTable (thead sticky), filtre Sniper OTM, Greeks Black-Scholes client (fallback σ=30 % marqué ~), entrée de trade directe, footer analytics (Max Pain, GEX, Walls) ; écrit `qc:chainIv:{tk}` + série `qc:ivHistory:{tk}`.
7. **Analytics** — `/insights/analytics` (lazy). RiskMetricsRow, 4 KPI (Omega, Kelly, Avg Hold, Max DD), P&L par jour de semaine, WinRateDonut + StrategyBreakdown, PnLCalendarHeatmap année.
8. **Calendar** — `/insights/calendar`. 3 vues (Annonces / P&L Jour / Année), Finnhub + fallback macroEvents2026, bannière contextuelle 4 états, expirations dérivées des positions.
9. **Journal** — `/insights/journal`. Kill switch quotidien (`ibkr_daily_max_loss`, défaut −500), TiltMeter 14 j, entrées mood/mistake/tags, Edge Leak Audit (crosstab tag × P&L, matching ±1 j).
10. **Settings · General** — `/settings/general`. 10 sections : profil (`ibkr_profile_name`), localisation + FX + capital de référence CHF, apparence (+ mode daltonien `ibkr_colorblind`), mode trading, risque (kill switch), stratégie Sniper (tier E×C), connexions API, données, cash flows, zone dangereuse (RESET_ALL + purge clés annexes).
11. **Settings · Import** — `/settings/import` (⌘9). Flex IBKR (QueryID + Token → sync → parse → merge dédupliqué → IMPORT_DATA ×2), upload CSV, **export backup JSON + restauration validée**.
12. **Settings · API** — `/settings/api`. 8 services via useApiStatus (probe 2 min), ApiServiceCard, modal config Flex, **toggle bridge live IBKR** (`gwAutoConnect`). Seule page encore sur GlassCard.

**Chrome commun v1.0 (AppShell, grille 3 rangées)** :
- **TickerTape** pleine largeur bord à bord — 48 px base, **92 px ≥1440** ; **LED Doto** (graisse 900, 'ROND' 100, double halo phosphore, micro-font « Doto Zero Plein » pour zéro plein + point net) ; 19 instruments (SPX NDX DJI RUT VIX USD/CHF EUR/USD GOLD US10Y DXY CRUDE DAX FTSE NIKKEI BTC ETH SILVER COPPER NATGAS) ; barème ≥1440 : symbole 22 / prix 40 / Δ% 23 / Δ net 21 ; **flash au tick** (`usePriceFlash`, 700 ms, coupé en reduced-motion) ; marquee 75 s pause au hover.
- **SideNav v2 « Marge vive »** — **220 px** déployée (⚠ CLAUDE.md §5 dit encore 232 — le code fait foi) / 64 px repliée ; ⌘B + persistance `qc:sidenav:collapsed` ; groupes silencieux OVERVIEW/TRADING/INSIGHTS/SYSTÈME (hairlines, sans titres) ; témoins d'état neutres (positions ouvertes, clôturés du jour, dot ambre pré-marché) ; raccourcis visibles seulement dans les tooltips du mode replié ; « Options Live » = `/trading/chain` ; chip Rechercher ⌘K ; footer Aide ⌘/ + Réduire.
- **StatusBar** — feeds IBKR/FNHB/CHART + **marqueur de mode LIVE/REAL/PAPER** (live si snapshot bridge < 1 h, neutre, réactif) + compteur POS · 4 horloges NY/GVA/LDN/TKY avec badge session · USD/CHF live · P&L réalisé total (coloré, argent réel) · ThemeSwitcher.
- Mobile <768 : SubNav (inline AppShell) + BottomNav (sheet « Plus » 8 entrées), pas de SideNav.
- **Raccourcis** : ⌘1..9 (1 dashboard · 2 positions · 3 history · 4 greeks-si-flag · 5 chain · 6 analytics · 7 calendar · 8 journal · 9 import) ; ⌘0 premarket ; ⌘K palette ; ⌘/ cheatsheet ; ⌘B sidenav. Garde anti-input + filtre Shift/Alt.

## 5. COMPOSANTS PARTAGÉS & HOOKS

### Le Bi-héros (cœur du Dashboard v1.0)

- **Héros 1** (`Hero1.jsx` + `hero1/`) : Frontier (frontière Marché/Portefeuille) → **PortfolioDeck** — 4 sous-panneaux denses à l'image du MarketDeck : CAPITAL & LIQUIDITÉ (héros **LIQUIDITÉ DISPO** = vraie Available Funds IBKR marquée « IBKR » si bridge frais, sinon estimation cash-A marquée « est. » — `resolveLiveAvailableUsd`, rc.6) · P&L (DAY/WTD/MTD/YTD/UNREAL/REAL, tonés) · RISQUE & GREEKS (greeks **neutres**) · PERFORMANCE — en **cellules-MONDE** (§7) → ZoneSep → barre (ViewToggle **NLV ↔ DRAWDOWN** + RangeSelector **5D/1M/3M/YTD/1Y/ALL**) → PerfBand (recalculée par période, masquée en drawdown) → **NLV géant en overlay sur TvChart** (lightweight-charts : auto-échelle serrée, ligne de prix, crosshair natif + boîte HTML, apports = marqueurs annotés, clôtures vert/rouge) → ChartFooter 12 cellules. Donnée : **série NLV dense** `utils/nlvSeries.js` (`buildNlvSeries` : snapshots quotidiens + point live du jour ; **drawdown flow-neutral** = nlv − dépôts cumulés, un apport ne guérit jamais un drawdown ; `resampleSeries` cap 190 pts par bucketing semaine/mois).
- **Héros 2** (`Hero2.jsx` + `hero2/`, 1.E « LA FUSION ») : jumeau visuel (même cadre, mêmes classes .lh-*/.pf-*) — **maison PURE du réalisé** (l'unrealized reste en Héros 1). RealizedFrontier → **RealizedDeck** 4 panneaux : RÉALISÉ TOTAL (héros cumulé + gross gains/pertes) · **MATRICE DE NON-PERTE** proéminente 3×2 (win rate · profit factor · payoff · expectancy · max DD cumul · recovery) · EXTRÊMES · RYTHME → graphe **TvChartRealized** (dédié, ≠ hero1/TvChart : AreaSeries cumul ligne neutre + marqueurs, ou HistogramSeries quotidien vert/rouge) avec toggle **CUMULÉ ↔ QUOTIDIEN** + RealizedGiant en overlay → panneau **DISTRIBUTION** toujours visible (histogramme par-trade par bucket $, Recharts lazy) → RealizedFooter dédupliqué. Source : `useDailyPnL` + `useClosedTrades` → `deriveRealized` (hero2/model.js).

### Inventaire (vivant sauf mention)

- **dashboard/** : MarketDeck · Hero1 + hero1/{PortfolioDeck, TvChart, parts, model, kit, PerfBand} · Hero2 + hero2/{RealizedDeck, TvChartRealized, parts, model, Distribution} · RiskMatrix (v7, 3 colonnes) · LivePositions (19 col + méta Sniper + footer agrégé) · TradeHistory (12 col) · Watchlist · CalendarMini · AlertsFeed · SniperMetaEditor (sidecar `qc:sniperMeta:{id}`) · PositionSparkline. **MORTS (0 import)** : `CommandDeck.jsx` (migré → PortfolioDeck), `hero1/KpiZones.jsx` (résidu lab 1.D).
- **charts/** : `obsidienne.js` (kit data-viz 1.A : OBS couleurs/ticks 14/gradients, consommé par les 2 TvChart + Distribution) · GreekEvolutionChart · IVRankHistogram · PerPositionGreeksTable · ThetaDecayProjection · OptionsChainTable · PnLCalendarHeatmap · RiskMetricsRow · StrategyBreakdown · TiltMeter. **MORTS** : `EquityChart.jsx` (remplacé par Héros 1), `ObsidienneTooltip.jsx` (transitif — seul importeur = EquityChart ; son CSS `.obs-tooltip` reste déclaré).
- **ui/ (15)** : DataTable (TanStack + virtualisation >50, rowHeight 47 ≥1440 — consommé par Positions + History uniquement) · NumAnat (anatomie du chiffre D1.2 — seul consommateur vivant : KPI de Greeks) · Modal · Tooltip · InfoTooltip · GlassCard · StatusBadge (12 variantes) · EmptyState · ErrorBoundary · Icons · CommandPalette (⌘K : actions + nav + positions) · CheatsheetModal (⌘/ ; ⚠ texte cite encore la CommandBar morte) · ThemeSwitcher · WinRateDonut · ApiServiceCard.
- **layout/** : AppShell · SideNav · TickerTape · StatusBar · BottomNav · Toast (provider global, stack 3). **SUPPRIMÉS du repo** (n'existent plus) : CommandBar (1.B), AmbientBackground (1.A), DashboardKPICards (1.A), DailyPnLChart (1.E), IVRankMovers/SectorHeatmap + leurs hooks (1.C), SniperGateMonitor.
- **Autres** : FxStaleBanner / FxInvalidBanner · PerformanceAttribution · AddTradeModal.

### Hooks (25 fichiers : 23 vivants, 2 morts)

- *Sélecteurs & métriques* : **usePortfolioMetrics** (hook central — NLV avec **override bridge si snapshot < 1 h**, realized/unrealized, DD, Sharpe/Sortino/Calmar/Kelly/SQN, TWR, CAGR, fxValid ; consommé par Dashboard, Hero1, StatusBar, Positions, Analytics…) · useTradingMetrics (WR/PF nullables gate ≥10 trades décisifs) · useRiskMatrix · useEquityHistory (courbe par clôture — n'alimente plus que RiskMatrix) · **useDailyPnL** (P&L par date — triple consommateur : Hero2, Hero1 WTD/YTD, ex-CommandDeck) · useLivePositions (19 col + sidecar sniper + gates) · useGreeksAggregate (sign-aware + greeksMap).
- *Feeds réseau* : useMarketQuotes (60 s, **poller partagé module-scope** avec refCount, cache 24 h, pause onglet caché ; + export useQuoteBatchExtras pour les futures du MarketDeck) · useMarketSparklines (5 min, backoff 429) · **useIbkrLive** (poll bridge `/ibkr/account` **5 s**, gaté `gwAutoConnect`, dispatch SYNC_IBKR seulement si connected ; positions [] jamais dispatchées) · useFx / useFxAutoRefresh / useFxLiveSync (cascade §6) · useCalendarFeeds · useApiStatus (8 services, 2 min).
- *Signaux dérivés* : useAlertsFeed · useDailyKillSwitch (sync cross-tab) · **useSniperGates — PARTIEL : seuls SL35/DTE45/TP sont câblés ; EARN-J2/EARN+J30/TRAIL = placeholders `pending` en dur** · **useAvailableCapital** (estimation cash-A `max(0, NLV − Σ notional)`) + export **`resolveLiveAvailableUsd`** (§6).
- *Utilitaires* : useMediaQuery · useLiveTheme (re-render charts sur `ibkr:theme-change`) · usePriceFlash (tape) · useWatchlist.
- **MORTS (0 import)** : `useDailySnapshot.js` (lecteur orphelin — le writer réel est local à Dashboard.jsx ; le SYSTÈME de snapshots est vivant) · `useMarketSession.js` (sa mécanique a été recopiée dans `utils/marketPhase.js`).

## 6. DONNÉES & ENDPOINTS

**Store Zustand** (`src/store/useStore.js` + `reducer.js` + `migrations.js`) — 6 slices persistées localStorage :
| Clé | Slice | Contenu |
|---|---|---|
| `ibkr_u_o` | openPositions | positions ouvertes (tk/ty/st/ex/ct/mu/pi/pc/fi/fxi/di + lots[] + dteAtEntry + slDollar v7) |
| `ibkr_u_c` | closedTrades | trades clôturés (+ po/fo/fxo/do/pnl/cm + exitReason + flags _auto) |
| `ibkr_u_f` | cashFlows | mouvements de cash (da/ty/a1) |
| `ibkr_u_j` | journalEntries | entrées de journal |
| `ibkr_u_w` | watchlist | tickers suivis |
| `ibkr_u_s` | settings | clés courtes : r=liveRate, rm=fxMode, rt/rs=FX meta, **ds=dailySnapshots (FIFO 60)**, ic=initialCapitalChf, tier=activeSniperTier, cashReport, lastSync, **ibkrLiveData** (snapshot bridge), ibkrSummary (dormant), ibkrLedger, gwAutoConnect |

Schéma **v7** (`ibkr_schema_v`), 7 migrations chaînées idempotentes. Persistance debouncée (settings 150 ms, data 500 ms), gating par référence. RESET_ALL préserve FX/tier/watchlist, efface le reste (dont ds/ic). ~30 actions reducer ; particularités : `SYNC_IBKR` atomique (bridge), `IMPORT_DATA` additif (flux Flex ET CSV — le `case 'SYNC_FLEX'` du reducer est **mort**, jamais dispatché), `settings.ibkrOrders` écrit mais jamais lu ni persisté (dette).

**dailySnapshots (donnée du Héros 1)** — `settings.dailySnapshots`, persisté sous `ds` : un point/jour `{date, nlv, availCapital, unrealized, exposure, openPositionsCount, realized, winRate, profitFactor}` (arrondis 2 déc.). Écrit par `useDailySnapshotWriter` (Dashboard.jsx) via `UPDATE_DAILY_SNAPSHOT` — idempotent par date (même valeurs → même référence d'état, zéro write). **Cap FIFO 60 jours** (reducer.js:92-98 : tri par date + slice des 60 plus récents) — ⚠ l'historique NLV au-delà de 60 j est perdu chaque jour ; la levée du cap + un writer intraday sont les fast-follows 1.D restants (avec `api/account-summary/sync.js`, qui **n'existe pas encore**).

**Endpoints serverless (10 routes + 3 helpers, `api/`)** — CORS allowlistés + rate-limités in-memory par bucket::ip :
| Route | Upstream · cache | Consommateurs |
|---|---|---|
| GET /api/quote/[ticker] | Cascade Finnhub → Yahoo → CBOE · 30/300 s | useMarketQuotes (tape, MarketDeck, Watchlist, PreMarket, useFxLiveSync) + spot Greeks |
| GET /api/chart/[ticker] | Yahoo v8 (cookie+crumb) · 300 s · bucket 90/min | useMarketSparklines (tape, MarketDeck) + probe |
| GET /api/yahoo/[ticker] | Yahoo v7 options (crumb, retry 401) · 300 s | Chain + probe |
| GET /api/cboe/[ticker] | CDN CBOE · 300 s | **plus aucun fetch direct côté src** (sert uniquement de 3ᵉ étage à la cascade quote) |
| GET /api/finnhub/[ticker] | Finnhub /quote (clé serveur) · 30 s | **plus aucun fetch direct côté src** (1ᵉʳ étage cascade quote) |
| GET /api/finnhub/earnings · /economic | Finnhub calendriers · 1 h | useCalendarFeeds (Calendar, CalendarMini, MarketDeck, PreMarket) |
| GET /api/health/finnhub | sonde SPY, toujours 200 | useApiStatus |
| GET /api/fx/usdchf | Twelve Data → Frankfurter BCE · 60 s/1 h | useFx.refresh |
| POST /api/flex/sync | IBKR Flex WS (retries 1019) · headers X-IBKR-Flex-* · 10/min | syncFlex → Import.jsx |

`vercel.json` : rewrite SPA (tout sauf /api → index.html) + headers sécurité (HSTS, X-Frame DENY, CSP stricte `connect-src 'self'` — raison pour laquelle le bridge passe par le proxy same-origin `/ibkr` en dev).
**Il n'existe PAS d'endpoint /api/greeks** : Greeks 100 % client (`utils/greeksApi.js` → `positionGreeks.js` → `options/blackScholes.js`, r=0.04, cascade σ : mark → cache chaîne `qc:chainIv` → défaut 0.30 marqué ~).

**Bridge live local** (`bridge/`, optionnel, non déployé) :
- `ibkr_poller.py` — ib_async, **readonly=True**, Gateway paper `127.0.0.1:4002` (clientId 11), poll **5 s**, tags accountSummary `NetLiquidation / TotalCashValue / AvailableFunds / BuyingPower`, écrit `snapshot.json` **atomique** (tmp + os.replace) : `{timestamp, connected, account:{currency, netLiquidation, totalCashValue, availableFunds, buyingPower}, positions[]}` (STK+OPT, pc=pi).
- `serve.py` — HTTP stdlib `127.0.0.1:8765`, `GET /health` + `GET /account`, no-store, 503 si snapshot > 30 s.
- Côté app : `useIbkrLive` (AppShell) → `SYNC_IBKR` → `settings.ibkrLiveData` (+ doublon `ibkrSummary`, dormant). Consommateurs d'`ibkrLiveData` : override NLV de calculations.js (< 1 h), badge LIVE (StatusBar, useApiStatus), et :
- **`resolveLiveAvailableUsd(liveData, liveRate)`** (`hooks/useAvailableCapital.js`, rc.6, **10 tests**) — la vraie liquidité déployable : retourne `availableFunds` en USD **uniquement si** snapshot < 1 h ET devise USD (ou CHF ÷ liveRate) ; tout autre cas → `null` → Héros 1 retombe sur l'estimation cash-A avec marqueur « est. ». Ne fabrique jamais un chiffre.

**Flux** :
- **Flex IBKR** (source comptable) : queryId localStorage + token **sessionStorage** (`services/flexApi.js`) → POST proxy → CSV → parse → merge dédupliqué → IMPORT_DATA. Additif, jamais destructif. ⚠ Dette : `/settings/api` (ConfigFlexModal) écrit le token en **localStorage** sous le même nom — deux magasins disjoints, le bouton « effacer » d'Import ne purge pas le sessionStorage effectivement utilisé (§9).
- **FX USD→CHF** : Yahoo live (auto, 1 pip) → Twelve Data/Frankfurter → manuel ; validation [0.01, 100] ; stale >24 h, critical >7 j. **Byte-identique à v2.3.1** (diff vérifié).
- **REAL vs seed** : aucune donnée de démo dans l'app ; seed uniquement dans `scripts/visual-audit.mjs` (contexte Playwright éphémère). **Protection du portefeuille réel = isolation Playwright `--isolated` obligatoire** (CLAUDE.md §7).

## 7. SYSTÈME DE DESIGN — LOIS v1.0

**DA « Brutalisme Financier », ère Obsidienne** — source unique `src/styles/canonical.css` :
- Plans : `--depth-void #070708` · `--depth-base #0A0A0B` · `--depth-raised #0F0F11` · `--depth-focus #1D1D23` + `--depth-focus-line`. Hairlines re-valuées 1.A : `--hairline-rest .07` / `--hairline-hover .10` / `--chart-grid .04` (alias `--line-hairline`), `--line-emphasis .12` (rails des decks).
- Encres : `--ink-pure #FAFAFA` · `--ink-soft #9A9AA2` · `--ink-mute #8A8A92`. P&L : `--pnl-up #10B981` · `--pnl-down #EF4444`. Accent : `--accent #FFA028` + `--accent-soft` (18 %).
- Typo : `--qc-font-num` = IBM Plex Sans Condensed (TOUS les chiffres ; `--qc-font-mono`/`--qc-font-hero` = alias) ; `--qc-font-code` = Geist Mono. Échelle base : caption 12 / body 14 / title 16 / display 28 / **hero 64** ; tabular-nums partout ; NumAnat pour l'anatomie $.
- `.obs-panel` = recette panneau canonique (raised + hairline + inset highlight, zéro scale au hover). TRANSITION ZONE (alias legacy → canonique, cyan tué) encore en place, « à purger par CANONICAL-PURGE ».

**Les lois visuelles v1.0** (héritées des briques, à respecter dans toute brique suivante) :
- **Cellules-MONDE** (1.D/1.E) : le motif de cellule des decks (hérité de la zone MONDE du MarketDeck) — grille **2 colonnes** à `grid-auto-rows` uniforme (55 px, alignement « au cordeau »), cellule = label 10 px caps ink-mute → **valeur Plex 22 px/700** ink-pure (--profit/--loss réservés au P&L) → meta 10 px (CHF + contexte **joints par « · », collés à gauche — zéro trou central**) → slot barre 7 px (barre neutre + repère ambre 70 %). `value null` → cellule ignorée (jamais de « — » nu). Implémentation : `Cell()` dans hero1/PortfolioDeck.jsx et hero2/RealizedDeck.jsx, CSS `.pf-grid/.pf-c` (v1-heros.css).
- **Cadre cockpit** (1.D) : recette unique `background var(--depth-raised)` + `border 1px var(--hairline-rest)` + `radius 7px` + `overflow hidden` + inset 4 px — portée par `.cockpit` (MarketDeck) ET `.lh-final` (Héros 1 & 2) → les trois blocs forment un cockpit continu harmonisé.
- **Tape LED** (1.C.10) : Doto variable 900 + micro-font « Doto Zero Plein » (unicode-range U+0030/U+002E : zéro plein, point décimal net), text-stroke 0.015em, double halo (2 px·67 % + 9 px·25 %), flash au tick. La tape est le SEUL usage de Doto.
- **Graphes terminaux** (1.D/1.E) : lightweight-charts v5, **stylée par options JS uniquement** (aucun CSS de lib) : fond transparent, textColor #8A8A92, grille .045, crosshair dashed + labels #1a1a1e, scroll/scale désactivés, auto-échelle serrée, prix formaté fmtUsd. Habillage HTML `.lh-tv/.lh-tv__tip` (v1-heros.css). Toujours code-split (lazy).
- **Kit Obsidienne** (1.A) : constantes `OBS` (obsidienne.js) pour tout chart — ticks 14 px cap data-viz, gradients d'aire 12 %→0, animation au premier montage seulement, valeurs midnight (daylight hors périmètre v1.0).

### LOI DE COULEUR (constitutionnelle, inchangée)

> **Le ROUGE = perte d'argent réel uniquement.** (De même, le vert = gain d'argent
> réel.) Les valeurs de **Greeks (delta, gamma, theta, vega)** sont **TOUJOURS
> neutres**, quel que soit leur signe.

Vaut pour delta et ses dérivés directionnels. **Amendement 15.07.2026 : les montants hypothétiques (Max Loss / Max Risk) sont NEUTRES** — l'alignement du code (Positions) est planifié en brique 2.A. L'ambre reste décisionnel, jamais P&L. Contrôle : `npm run check:color-law` (0 violation à ce jour).

**Échelle S2 (D2.F ×1.30) — INTACTE en v1.0** : palier unique `@media (min-width:1440px)` dans `c3-hires.css` (importé en dernier, sentinelle `--c3-tier: active`) : plancher caption **17** · body 18 / title 21 / cell-value 21 · **KPI display 44** · cellules `.v3-table` **20** (rowHeight 47) · ticks charts **cap 14** · **héros 56/64 intouchés** (NLV géant overlay Héros 1 = 72 px, posé en dur dans v1-heros.css). Sections v1.0 du palier : cockpit/MarketDeck (rangées 162/1/119), MONDE 5×2, SideNav/tape (92 px).

**Thèmes** : midnight (défaut) / daylight — `theme/themes.js` + `GlobalStyles.jsx` (attribut `data-theme`, clé `ibkr_theme`, événement `ibkr:theme-change`). **Limite connue : ni canonical.css ni tokens.css ne définissent de variante daylight** → pages canoniques sombres en daylight (pré-existant, acté hors scope ; obsidienne.js l.5 : « daylight hors périmètre v1.0 »).

**Cascade CSS (ordre d'import main.jsx, 28 fichiers, dernier gagne)** :
`tokens.css` → fonts (geist, geist-mono, plex 600/700, fonts.css) → `global` → `animations` → `responsive` → `components` → `dashboard` → `aura-boost` → `primitives` → `v3-components` → `v4-shell` (tape + statusbar) → `v4-dashboard` (bento) → `v5-chain` → **`canonical.css`** → `obsidienne-charts.css` → `pages-positions` → `pages-greeks` → `pages-import` → `pages-settings` → `pages-history` → `pages-premarket` → `pages-dashboard` → **`v1-dashboard.css`** (cockpit/MarketDeck/CommandDeck†) → `pages-calendar` → **`v1-shell.css`** (grille + SideNav) → **`v1-heros.css`** (.lh-*/.pf-*) → **`v1-heros2.css`** (.h2-*) → **`c3-hires.css` en dernier**. († bloc .command-deck orphelin depuis 1.D.) Règle : toute densité ≥1440 passe par c3-hires.css scopé page.

## 8. QUALITÉ & OUTILLAGE

**Gates avant tout merge** : `npm run build` vert + `npm run check:color-law` = 0 violation + preuve visuelle par captures @1591.
- **check:color-law** (`scripts/check-color-law.mjs`) — linter statique (PAS un test) : violation = **double signal sur une même ligne** — (A) signal couleur P&L (classes text-profit/loss, tokens --pnl-*/--qc-profit/loss, BEM --profit/--loss, toneFromSign…) ET (B) référence Greek (accès `.delta/.gamma/.theta/.vega`, agrégats sum/net*, deltaDollar, fieldKey, Σ DELTA) ; jamais le mot nu « delta » ; commentaires et `__tests__` exclus. Exit ≠ 0 si ≥1.
- **audit:visual** (`scripts/visual-audit.mjs`) — Playwright headless : sonde 5173/5174 (`AUDIT_BASE_URL` force), contexte éphémère 1591×900 dpr 1.35 dark, **seed reproductible à dates relatives** injecté avant tout script d'app (5 positions, 10 trades, journal, schema v7), capture les 12 pages vers `docs/captures/audit-AAAAMMJJ/` (gitignoré), contrôle « peuplé ».
- **Tests** : Vitest env node, `src/**/__tests__/` — **26 fichiers / 243 tests verts** (metrics 11 fichiers, ibkr 2, options 1, utils 10, hooks 2 dont resolveLiveAvailableUsd 10 cas). ⚠ `utils/nlvSeries.js` n'a **pas** de tests. **Jamais citer un compte de tests comme preuve de non-régression** : la preuve est visuelle, page par page, @1591.

**Méthode de validation visuelle (doctrine CLAUDE.md §7)** : dev server → Playwright MCP **isolé** (`--isolated` obligatoire) → route @1591×900 dpr 1.35 midnight → **exercer** la feature → 0 overflow, 0 chevauchement → lire capture/snapshot → console propre. Consoles tolérées (pré-existantes) : 500/502 finnhub sur symboles non servis (^NDX), warnings Recharts width(-1)/height(-1) au mount.

## 9. RÉSIDUS CONNUS & DETTES (actualisés rc.7)

Rapport seulement — aucune action prise.
- **Rétention NLV 60 j** : le cap FIFO du reducer efface l'historique au-delà de 60 jours — fast-follow 1.D prioritaire (avec writer intraday ; `api/account-summary/sync.js` toujours à créer).
- **Fichiers MORTS à purger (4 + 2 hooks)** : `dashboard/CommandDeck.jsx`, `dashboard/hero1/KpiZones.jsx`, `charts/EquityChart.jsx`, `charts/ObsidienneTooltip.jsx` (+ son CSS `.obs-tooltip`), `hooks/useDailySnapshot.js`, `hooks/useMarketSession.js`. Exports morts : `KpiCell`/`KpiBelt` (hero1/parts), `TIMEFRAMES` de utils/equity.js, `case 'SYNC_FLEX'` (reducer), `settings.ibkrOrders` (écrit jamais lu), `settings.ibkrSummary` (persisté, 0 consommateur UI). CSS orpheline : blocs `.command-deck*` (v1-dashboard + c3-hires), règles DailyPnLChart (v4-dashboard.css).
- **Double convention token Flex (bug latent)** : `flexApi.js` = sessionStorage (flux d'import réel) ; `/settings/api` + probe useApiStatus = localStorage sous le même nom `ibkr_flex_token`. Le bouton « effacer les identifiants » d'Import purge le localStorage mais PAS le sessionStorage effectivement utilisé ; un token saisi dans /settings/api n'est jamais lu par syncFlex.
- **useSniperGates partiel** : 3 gates câblés (SL35/DTE45/TP), 3 placeholders `pending` en dur (EARN-J2/EARN+J30/TRAIL) — jamais câblés depuis Sprint 2.1.
- **Overlap PortfolioDeck/Héros 1** : résidu signalé à l'œil en fin de 1.E **sur données live uniquement** — aucune trace dans le code (2 z-index bénins) [À VÉRIFIER @1591 sur données réelles].
- **En-têtes/commentaires périmés** : hero1/{TvChart,kit,PerfBand}.jsx disent encore « LAB /lab/heros — DEV-only » (fichiers prod) ; SideNav « 232 px » (header v1-shell.css + CLAUDE.md §5) vs 220 réels ; tape « 64 px » (tokens.css/v4-shell.css) vs 92 réels ; StatusBar commentaire « CBOE » vs label CHART ; Dashboard.jsx cite DashboardKPICards supprimé ; CheatsheetModal (texte UI) référence la CommandBar morte.
- **Config morte** : proxy vite `/api/ibkr` → localhost:5000 (Client Portal legacy, 0 occurrence src) ; listener `ibkr:open-command` sans dispatcheur ; `@number-flow/react` (0 import) encore dans deps + manualChunks ; `.gitignore` cite `scripts/iosevka-source/` disparu.
- **FONT_MONO TvChart** : les 2 TvChart déclarent `'JetBrains Mono Variable'` alors que le paquet installé est la famille statique « JetBrains Mono » → retombe sur SF Mono/Menlo/Consolas [effet visuel à vérifier].
- **Divers** : `src/contexts/` vide ; daylight non couvert par canonical (§7) ; GreekEvolutionChart sur mock ; série `qc:ivHistory` collectée sans affichage (U13) ; IVR de Chain = « — » (Sprint 6 jamais fait) ; TODO(s2a-phase2) formatters fx ; hardcodes hex résiduels (WinRateDonut fallbacks, badge STK #42A5F5 Calendar, canvas TvChart #8A8A92/#1a1a1e — assumés) ; chunks >500 kB (warning cosmétique) ; TRANSITION ZONE canonical.css à purger (CANONICAL-PURGE) ; Max Loss encore rouge sur Positions (amendement dû en 2.A).

## 10. HISTORIQUE & DÉCISION (phase v1.0)

- **1.A — Fondation Obsidienne** (rc.1) : tokens matière (hairlines re-valuées, .obs-panel), mort d'AmbientBackground, kit charts Obsidienne, CommandDeck 6 zones (remplace DashboardKPICards).
- **1.B — Le Shell** (rc.2) : SideNav 232→(220 en 1.S)/64 ⌘B, mort de la CommandBar, TickerTape 92 px variante D, 12 pages adaptées.
- **1.C — Zone haute** (rc.3) : étage marché D2-FINALE (3×2 fluide, rails continus, courbes intraday, VIX gradué, agenda héros, FUT, MONDE ×10, FX & TAUX) + Command Deck v2 + **tape LED Doto** ; labs purgés.
- **1.S — Sidebar v2 « Marge vive »** (rc.4) : témoins neutres, ⌘0, marqueur de mode → StatusBar, dettes de nav soldées, −340 l CSS morte.
- **1.D — Héros 1** (rc.5) : bloc Equity/NLV pleine largeur sur donnée NLV dense (snapshots + live, drawdown flow-neutral), PortfolioDeck cellules-MONDE, graphe terminal lightweight-charts (nouvelle dép code-split), cadre cockpit harmonisé, CommandDeck migré, EquityChart remplacé.
  - **rc.6 (fast-follow 1/5)** : LIQUIDITÉ DISPO = vraie Available Funds IBKR (`resolveLiveAvailableUsd`, 10 tests).
- **1.E — Héros 2 « Réalisé »** (rc.7, 21.07.2026) : LA FUSION — jumeau de Héros 1, maison pure du réalisé (corrige le doublon du DailyPnLChart), matrice de non-perte, toggle CUMULÉ↔QUOTIDIEN, TvChartRealized dédié, panneau Distribution, footer dédupliqué ; DailyPnLChart supprimé ; lab purgé.
- **À venir** : **1.F Bande décision** (ATTENTION/FORME/CAPITAL, clôt le Dashboard) → Étape 2 familles de pages (2.A tables · 2.B analytiques · 2.C workflow · 2.D utilitaires) → Étape 3 cohérence & modales → Étape 4 recette → **tag v1.0.0 (objectif 01.09.2026)**.

**Ce document est la ligne de base courante de la phase finale ; la baseline historique v2.3.1 reste dans ETAT-DU-SITE.md.**
