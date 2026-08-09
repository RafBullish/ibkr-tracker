# ÉTAT DU SITE — QuantumCall v1.0.0

> Cartographie de référence de l'outil LIVRÉ. Rafraîchie en Étape 4
> (recette v1.0, 06.08.2026) — remplace l'état rc.7. Chaque fait est
> vérifié dans le code au moment de l'écriture ; les résidus abrogés
> depuis rc.7 ont été retirés.

---

## 1. IDENTITÉ & DÉPLOIEMENT

- **Produit** : QuantumCall — tracker d'options **personnel** (mono-utilisateur),
  une seule stratégie : achat de premium (doctrine « Sniper OTM »).
- **Version** : `1.0.0` (tag `v1.0.0`), fin de la phase finale ouverte le 15.07.2026
  sur la baseline v2.3.1.
- **Prod** : Vercel, alias canonique **ibkr-tracker-lemon.vercel.app** (projet
  `prj_RApArMFpRix2WtwZ5pXIGQL0PEt5`, team `team_9ymYgzp1xzDvDhphaketRViT`),
  déploiement auto sur push `main`.
- **Cible de rendu unique** : viewport CSS **1591×900, DPR 1.35** (4K, Chrome 90 %),
  thème midnight. Mobile <1440 = socle à ne pas casser, jamais la cible.
- **Utilisateur** : Rafael (product owner, non-codeur, francophone, veto visuel).

## 2. STACK & CHUNKS (re-mesurés É4)

- React 19 · Vite 7.3 · JS pur (zéro TS) · Zustand (store maison reducer) ·
  Recharts (charts) · lightweight-charts (graphes terminaux héros, code-split) ·
  Radix (Dialog/Tooltip/Dropdown) · TanStack (table/virtual) · Framer Motion ·
  lucide-react (jeu d'icônes unique app ; Icons.jsx SVG maison réduit à 9 clés
  pour BottomNav mobile).
- **@number-flow/react désinstallée** en É4 (0 import). `react-is` NE SE RETIRE
  JAMAIS (peer de recharts).
- **Chunks prod (gzip), après le code-splitting É4** :
  - `index` 448 kB (139 gzip) — shell + Dashboard (page reine, eager). Était
    655/197 avant É4 (−29 % gzip).
  - `recharts` 542 kB (150 gzip) — chargé UNIQUEMENT à la demande (Greeks,
    Analytics, distribution History). Seul chunk >500 kB restant : hors chemin
    critique, splitter davantage = risque sans gain (décision É4).
  - `lightweight-charts` 179 (58) · `motion-vendor` 131 (43) · `radix-vendor`
    88 (29) · `table-vendor` 69 (19) · `vendor` 41 (15) · CSS 460 (88).
  - **Toutes les routes sauf /dashboard sont lazy** (chunks par page 15-34 kB,
    barrière unique ErrorBoundary+Suspense, fallback `.route-loader`).

## 3. ARBORESCENCE (vivante)

- `src/pages/` — Dashboard, PreMarketBriefing, trading/{Positions, History,
  Greeks, Chain, HistoryDistribution}, insights/{Analytics, Calendar, Journal},
  settings/{General, Import, Api}.
- `src/components/` — layout/ (AppShell, SideNav, TickerTape, StatusBar,
  BottomNav, Toast, SubNav) · dashboard/ (MarketDeck, Hero1+hero1/*,
  Hero2+hero2/*, decision/* (bande), RiskMatrix, LivePositions, TradeHistory,
  Watchlist, CalendarMini, PositionSparkline, SniperMetaEditor) · ui/ (Modal,
  CommandPalette, CheatsheetModal, DataTable, EmptyState, StatusBadge,
  GlassCard, WinRateDonut, Icons, Tooltip/InfoTooltip, ErrorBoundary,
  ThemeSwitcher…) · charts/ (obsidienne.js, ObsidienneTooltip,
  PnLCalendarHeatmap, ThetaDecayProjection, StrategyBreakdown,
  PerPositionGreeksTable, OptionsChainTable) · fx/ (bannières) · trades/
  (AddTradeModal).
- `src/hooks/` — useLivePositions, **useAttentionMap (É3 — classifieur
  partagé)**, useSniperGates, useDailyKillSwitch, useDailyPnL,
  usePortfolioMetrics, useTradingMetrics, useGreeksAggregate, useEquityHistory,
  useCalendarFeeds, useApiStatus, useMarketQuotes, useMarketSparklines, useFx*,
  useIbkrLive, useAvailableCapital, useWatchlist, useRiskMatrix,
  useIntradayNlvDays…
- `src/utils/` — calculations, positions (dteFromExp/isExpired/…), alerts,
  greeks/greeksApi, equity, nlvSeries, nlvIntraday, risk, sniperMeta,
  significance, ivHistory, marketPhase, format/formatKpi, dates, math…
- `src/store/` — reducer.js + useStore.js (persistance localStorage).
- `src/styles/` — tokens.css (legacy) · **canonical.css (SOURCE des tokens,
  chargée après tokens → fait autorité)** · global/animations/components/
  primitives/responsive · v3-components · v4-shell · v4-dashboard ·
  **pages-chain.css (ex-v5-chain, renommée É3)** · obsidienne-charts ·
  pages-{positions, greeks, import, settings, history, premarket, dashboard,
  analytics, calendar, journal} · v1-{dashboard, shell, heros, heros2,
  decision} · **modals.css (É3 — maison des modales + ⌘K)** · c3-hires.css
  (palier ≥1440, TOUJOURS importée en dernier).
- `api/` — fonctions Vercel : quote/[symbol], yahoo/[ticker], finnhub/*
  (earnings, economic), servies en dev par le shim `vercelDevApi` de
  vite.config. `bridge/` — pont IBKR local (poller Python, port 8765,
  proxy dev `/ibkr`).
- Morts retirés en É4 : CommandDeck.jsx, hero1/KpiZones.jsx,
  charts/EquityChart.jsx, useDailySnapshot.js, src/contexts/, proxy vite
  `/api/ibkr`, listener `ibkr:open-command`.

## 4. LES 12 PAGES (état v1.0.0)

Toutes au **langage cockpit v1.0** : bandeau de commandement `.lh-final`
(cellules-MONDE, valeurs 34 px), étages au cadre cockpit, titres `.mk-title`,
rythme 8 px, registre terminal des badges, ObsidienneTooltip sur les charts.

1. **/dashboard** (⌘1, eager) — cockpit MarketDeck (intangible 1.C) ·
   Héros 1 Equity/NLV (PortfolioDeck cellules-MONDE, graphe terminal, 1D/5D
   intraday) · Héros 2 Réalisé (matrice de non-perte, cumulé/quotidien/
   distribution) · bande DÉCISION (ATTENTION · FORME · CAPITAL, classifieur
   `deriveAttention`, gates doctrine DTE 45/50, kill switch) · RiskMatrix (vue
   statistique détaillée) · LivePositions 19 colonnes (badge GATE au
   classifieur unique É3, « EXP » sur expirée) · TradeHistory · veille
   Watchlist | CalendarMini.
2. **/premarket** (⌘0) — countdown reine 48 px · étage régime · revue
   positions au classifieur partagé `useAttentionMap` (É3) · agenda du jour
   (union macro dédupliquée É3) · jour creux designé (prochain catalyseur).
3. **/trading/positions** (⌘2) — bandeau (5 cellules) · table surensemble
   19 colonnes (DataTable, footer agrégé, badges GATE, « EXP ») · détail de
   position en modale cockpit (alertes neutres É3) · état flat designé.
4. **/trading/history** (⌘3) — bandeau · toolbar `.lh-toggle` · table dense ·
   étage ANALYSE Obsidienne (WinRateDonut partagé, attribution E×C scopée au
   filtre — styles rapatriés dans pages-history.css en É3).
5. **/trading/greeks** (⌘4) — bandeau OPTIONS·Δ·Γ·Θ/j·ν TOUS NEUTRES · héros
   Projection Theta (cumul ambre = seule série ambre) · table par position ·
   donut Vega ACIER.
6. **/trading/chain** (⌘5) — outil de tir : barre ticker · bandeau (spot,
   ATM IV, zone Sniper) · barres échéances/strikes · étage SIGNAUX AVANT la
   chaîne (Max Pain · 25Δ RR · OI · NET GEX · murs, tous NEUTRES) · chaîne
   double-entrée thead sticky 2 rangées (ACQUIS) · zone Sniper ambre · IVR
   tiret honnête (aucun pipeline).
7. **/insights/analytics** (⌘6) — 10 KPI ratios NEUTRES + caveat échantillon ·
   heatmap annuelle (rgba OBS désaturés partagés Calendar) · étage rythme &
   répartition.
8. **/insights/calendar** (⌘7) — bandeau signes vitaux · Annonces 2 colonnes
   (union macro dédupliquée É3, impact FORT ambre seul) · bannière Finnhub
   durable NEUTRE · heatmap P&L.
9. **/insights/journal** (⌘8) — bandeau · héros TiltMeter (EXCEPTION couleur
   nommée, aiguille au tick 180 ms É3) · filtre humeur en chips · cartes
   denses · Edge Leak Audit · kill switch même source que la bande.
10. **/settings/general** — bandeau · corps DEUX COLONNES · CTA cash flows
    NEUTRE · ZONE DANGEREUSE durcie (inventaire détruit/survivant lu dans le
    reducer, mot RESET à taper, ROUGE = EXCEPTION NOMMÉE).
11. **/settings/import** (⌘9) — bandeau · SOURCES 2-col (Flex | CSV) ·
    RÉSULTAT (merge additif) · SAUVEGARDE (export/restauration validée) ·
    erreurs d'import NEUTRES.
12. **/settings/api** — bandeau · TABLEAU DENSE des 8 services
    (LIVE vert / DOWN·OFF neutres) · ConfigFlexModal cockpit (token masqué,
    source unique sessionStorage).

**Chrome commun** : TickerTape 92 px LED (flash au tick) · SideNav 220/64
(⌘B, témoins neutres) · StatusBar (IBKR·FNHB·CHART, REAL/PAPER, horloges,
USD/CHF, P&L) · ⌘K palette cockpit `.cmdk` (É3) · ⌘/ aide-mémoire réécrit sur
la vérité du code (É3) · raccourcis ⌘0..9/K//B (mapping historique intact) ·
mobile <768 : SubNav + BottomNav.

## 5. COMPOSANTS & HOOKS — points de vérité

- **`decision/model.js` (`deriveAttention`)** = LE classifieur : bande,
  Positions, LivePositions, PreMarket (via `useAttentionMap`). ATTENTION
  contient : SL35 franchi (CRITICAL), approche SL ≥70 % (ARMED), gates DTE
  doctrine (≤45 CRITICAL, 45<DTE≤50 ARMED), TP1/TP2, TP short, kill switch.
  **RETIRÉS** : DTE legacy 90/100 (1.F-c1) et TIME_STOP (É3 §4.2.2).
- **Moteur DTE unique** : `dteFromExp` (clampé 0) + `isExpired` → libellé
  « EXP » partout. `daysToExpiration` est MORT.
- **Expectancy** : gatée à `MIN_DECISIVE_WINRATE` (10 décisifs) dans la bande
  ET les decks Héros 1/2 (« — · N décisifs / 10 requis »).
- **`totalExposure`** = Σ |valeur mark| des positions ouvertes — les libellés
  disent cette vérité (« EXPOSITION · Σ valeur mark ») ; ≠ capital engagé,
  ≠ notionnel (§8 CLAUDE.md).
- **Macro** = union dédupliquée Finnhub ∪ local (date|libellé) PARTOUT
  (MarketDeck, CalendarMini, PreMarket, Calendar).
- **Modales** : anatomie unique cockpit (modals.css) — Modal Radix,
  AddTradeModal, détail position, ConfigFlexModal, CheatsheetModal ; pied
  secondaire gauche / primaire ambre droite ; `--text-on-accent` = void.
- **Toast** : succès vert (fait factuel d'opération) · info neutre ·
  erreur/avertissement NEUTRE APPUYÉ. Stack 3.
- **EmptyState** partagé (tables/charts) ; états vides ad hoc des pages
  récentes = anatomie validée par brique.

## 6. DONNÉES & ENDPOINTS

- **Persistance localStorage** (jamais touchée hors session Playwright
  isolée) : `ibkr_u_o` (positions) · `ibkr_u_c` (clôturés) · `ibkr_u_f`
  (cash flows) · `ibkr_u_j` (journal) · `ibkr_u_s` (settings : liveRate,
  cashReport, ibkrLiveData, gwAutoConnect, dsid [dataset actif], ibkrSummary
  [écrit par le bridge, AUCUN lecteur UI — documenté], …) · `ibkr_u_w`
  (watchlist). Sidecars : `qc:sniperMeta:*`, `qc:ivHistory` (collecte Chain,
  aucun affichage), `ibkr_spot_cache_v1`,
  `chain_history`, `qc:sidenav:collapsed`, `ibkr_flex_queryid` (non secret).
- **Historique NLV ISOLÉ PAR DATASET (1.1.0)** : datasetId =
  `ClientAccountID:période:hash8` calculé à l'import (utils/ibkr/datasetId).
  `qc:nlvCsv:{id}` (série NAV dérivée du CSV — section NAV exacte sinon
  reconstruction « approx. », utils/ibkr/navSeries) · `qc:nlvDaily:{id}`
  (snapshots quotidiens app, ex-`settings.ds` — utils/nlvHistory) ·
  `qc:nlvIntraday:{id}` (writer RTH ~5 min). Seau `local` avant tout
  import ; anciens magasins globaux pollués archivés `qc:nlvDaily:legacy` /
  `qc:nlvIntraday:legacy` (aucune destruction). La courbe Héros 1 fusionne
  par date : NAV/recon (période du CSV) > snapshots du dataset > live.
- **Token Flex** : **sessionStorage UNIQUEMENT** (`ibkr_flex_token`), masqué à
  la saisie, `clearFlexCredentials` purge le magasin réel + résidu legacy.
  RE-PROUVÉ en É4 (isolé, valeur factice) : après config, AUCUN token en
  localStorage.
- **Endpoints** : `/api/quote/[symbol]` (Yahoo proxy quotes/spark) ·
  `/api/yahoo/[ticker]` (chaîne options) · `/api/finnhub/{earnings,economic}`
  (calendriers ; clé serveur, bannière neutre si absente) · `/ibkr/*` (bridge
  local 8765 — Available Funds réels, NLV live). Fallback macro local
  FOMC/CPI/NFP 2026 (macroEvents2026.js) en UNION avec Finnhub.
- **`RESET_ALL`** détruit positions/clôturés/flux/journal/settings-broker ;
  **préserve** FX (taux/mode/source), tier Sniper actif, watchlist (+ hors
  store : nom de profil, daltonien, seuil kill switch).

## 7. SYSTÈME DE DESIGN — LOIS v1.0

- **Brutalisme financier** : void → base → raised → focus, ambre #FFA028,
  hairlines murmurées, chiffres IBM Plex Sans Condensed 700 tabular
  (`--qc-font-num`, alias mono/hero), zéro glow superflu.
- **LOI DE COULEUR** : rouge/vert = argent RÉEL uniquement (P&L
  réalisé/latent). Greeks TOUJOURS neutres. Montants hypothétiques (Max
  Loss/Risk) neutres. Ratios, compteurs, streaks, états d'API, signaux,
  événements : neutres. **Exceptions NOMMÉES, et elles seules** :
  (a) sparklines/variations de marché · (b) barres/heatmaps de P&L réalisé
  par unité · (c) TiltMeter du Journal · (d) zone dangereuse de Settings
  General. + registre toast : succès d'opération vert (transitoire).
- **Ambre chirurgical** : vivant (LIVE), décision (CTA primaire, sélection,
  chips actifs, badges ARMED/CRITICAL, jauge au cap 70 %, zone Sniper, ligne
  focus, série héros). JAMAIS un état durable.
- **Registres de taille** : bandeaux de page 34 px · decks Dashboard 22-24 ·
  tables denses 20/600 rangées 47 ≥1440 · ticks data-viz cap 14 · KPI 44 ·
  héros 56/64 (repères S2 ×1.30).
- **Registre terminal** : ARMED/CRITICAL/SAFE/LIVE/REAL/PAPER/DOWN/OFF/EXP.
- **Cadre canonique** : `.lh-final` (raised + hairline + radius 7 + overflow
  hidden) · `.mk-title` (13 px 600 caps 0.1em) · `.pf-c` cellule-MONDE ·
  `.v3-table`/DataTable · `.db-badge` · anatomie modale unique.
- **Transitions** : 120 ms hover · 180 ms tick · 150/30 ms montage ·
  `prefers-reduced-motion` = kill global (animations.css, prouvé par
  émulation).

## 8. QUALITÉ & OUTILLAGE

- `npm run build` (Vite) · `npx vitest run` (**290 tests** — jamais cités
  comme preuve visuelle) · `npm run check:color-law` (contrôle statique
  greeks, exit ≠0 si violation) · `npm run audit:visual` (12 pages @1591×900
  dpr 1.35 seedées → docs/captures/audit-AAAAMMJJ/, gitignoré ; les audits
  versionnés vivent dans les dossiers de brique).
- **Doctrine de vérification** : preuve VISUELLE page par page @1591 (+
  contrôle @1920), Playwright MCP **--isolated obligatoire** (clés ibkr_u_*
  réelles = portefeuille de Rafael).
- **Console tolérée** (documentée É4) : `500` finnhub (earnings/economic,
  clé absente en dev) · `429` du proxy quotes (rate-limit Yahoo) · warnings
  Recharts width(-1)/height(-1) au mount · « FINNHUB_KEY non configuré »
  (warning applicatif volontaire). AUCUNE autre erreur sur les 12 routes
  exercées.
- Piège CSS (leçon 2.C2) : jamais de séquence fermante de commentaire ni de
  nom de token dans un commentaire CSS ; vérifier la balance et l'application
  réelle des feuilles.

## 9. RÉSIDUS RÉELS & BACKLOG POST-1.0

1. **RiskMatrix — gisement couleur préexistant** (constat panel É3) : badge
   EDGE+/− vert/rouge, jauges de ratios (Sharpe & co) remplies vert/rouge,
   « Kelly Optimal » ambre, vol annualisée verte ≤20 %, R Avg/σ toné →
   passe dédiée post-1.0 (la vue est statistique, hors mandat É3).
2. **Badge REAL vert** (StatusBar) — convention gelée ; neutralisation
   app-wide = arbitrage architecte.
3. **Pipeline IV Rank** — non construit (IVR tiret honnête sur Chain ;
   `qc:ivHistory` collecte en silence). À rouvrir seulement avec une source
   fiable.
4. **Daylight** non fonctionnel sur les pages canoniques (pré-existant,
   assumé — midnight est LE thème).
5. **Zone TRANSITION de canonical.css** (alias legacy) — vivante tant que le
   code v3/v4 consomme les alias ; purge = chantier CANONICAL-PURGE.
6. **theme/tokens.js** (palette JS legacy) — encore consommé par
   ErrorBoundary/ThemeSwitcher/useLiveTheme.
7. **Hex assumés** : obsidienne.js (config charts centrale), TvChart/
   TvChartRealized (canvas lightweight-charts), WinRateDonut/PIE_STEEL/
   HM_GHOST (constantes SVG), thèmes legacy.
8. **Bannière Calendar « Connecté · N »** : le compte reflète le calendrier
   AFFICHÉ (union Finnhub ∪ local) — nuance assumée.
9. `api/account-summary/sync.js` serveur (fast-follow 1.D jamais construit).
10. Double scrollbar potentielle cheatsheet (max-height 70vh dans un body
    auto) — cosmétique, pré-existant.

## 10. HISTORIQUE DE LA PHASE v1.0

Baseline **v2.3.1** (`ea64652`, 13.07.2026). **Étape 1 — Dashboard** : 1.A
Fondation Obsidienne (rc.1) · 1.B Le Shell (rc.2) · 1.C Market Deck (rc.3) ·
1.S Sidebar v2 (rc.4) · 1.D Héros 1 (rc.5 ; rc.6 liquidité IBKR réelle ;
rc.8 FF-données) · 1.E Héros 2 (rc.7) · 1.F Bande décision (rc.9) — CLOSE.
**Étape 2 — Familles de pages** : 2.A Tables (rc.10) · 2.B Analytiques
(rc.11) · 2.C1 Le poste du matin (rc.12) · 2.C2 Workflow (rc.13) · 2.D
Utilitaires + dette Flex (rc.14) — CLOSE. **Étape 3 — Cohérence & modales**
(rc.15) : 11 divergences éteintes, classifieur unique, modales unifiées,
panel adversarial — CLOSE. **Étape 4 — Recette** (1.0.0) : purge orphelins
(−1 600 l), code-splitting (index −29 % gzip), audit 12 pages @1591+@1920,
sécurité re-prouvée, docs finales, **tag v1.0.0** — LIVRÉ.
