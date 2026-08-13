# Roadmap — Phase finale v1.0

**PHASE FINALE CLOSE — v1.0.0 LIVRÉE le 06.08.2026** (tag `v1.0.0`,
prod ibkr-tracker-lemon.vercel.app), avec 26 jours d'avance sur
l'objectif du 01.09. Ligne de base : **v2.3.1** (`ea64652`).
Le backlog post-1.0 vit en fin de fichier + ETAT-DU-SITE-V1 §9.

---

## v1.0.1 — Maintenance (ouvert le 12.08.2026)

- **FIX-NLV ✅ (1.0.1-rc.1)** — « L'histoire reconstituée » : le Héros 1
  reconstitue À LA LECTURE l'historique NLV antérieur au premier snapshot
  réel (`utils/nlvBackfill.js` : C0 implicite + cumFlux + cumRéalisé,
  zéro écriture, un point réel PRIME toujours, points `synth`) ; note
  d'honnêteté ink-mute « historique reconstitué · réalisé + apports » ;
  D6 intraday constaté déjà satisfait à v1.0.0 (verrous de tests
  ajoutés) ; profil d'audit `AUDIT_SEED=nlv-pathologie` + harnais
  `fix-nlv-proof.mjs` ; preuves `docs/captures/fix-nlv/`.
- **POLISH-1 ✅ (1.0.1-rc.2)** — « La chasse aux échardes » : bannières
  FX rouge → AMBRE (fraîcheur de données = attention, pas une perte) ;
  warning esbuild `v4-shell.css` mort ; référence BACKLOG.md supprimée ;
  `.vscode/` ignoré entier ; garde `isWritableNlv` du writer quotidien ;
  buildNlvSeries ne mute plus le store ; cheatsheet ⌘/ mono-scroller.
  E8 (libellés CLÔTURES/TRADES) NON appliquée : la sonde prouve des
  points affichés (buckets au-delà de 190 pts), pas des jours → tranché
  par HERO-FOOTER.
- **Prochaine brique : au prompt architecte.**

---

## Étape 1 — Dashboard (page reine)

- **1.A ✅ (1.0.0-rc.1)** — Fondation Obsidienne + Ligne de commandement v1 :
  tokens matière (hairlines, plans re-valués, `.obs-panel`), mort
  d'AmbientBackground, infra charts (`obsidienne.js` / `ObsidienneTooltip` /
  `obsidienne-charts.css`), CommandDeck 6 zones (remplace DashboardKPICards),
  retrofit tooltips EquityChart/DailyPnL.
- **1.B ✅ (1.0.0-rc.2)** — Le Shell : SideNav 232/64 (⌘B, persistance, nav
  groupée OVERVIEW/TRADING/INSIGHTS/SYSTÈME, badge REAL/LIVE + ⌘K, chips
  keycap, « Options Live »), mort de la CommandBar, TickerTape salle des
  marchés (92 px, barème calibré au lab /lab/tape — variante D choisie par
  Rafael —, pastilles Δ% + Δ$, flash au tick, fondus), halo résiduel
  /positions éliminé, 12 pages adaptées ; raccourcis ⌘1..9 conservés.
- **1.C ✅ (1.0.0-rc.3)** — Zone haute du Dashboard : étage marché
  **D2-FINALE** (double étage fluide 3 colonnes × 2 rangées, hairlines de
  rails continues, indices D2×D4 à courbes intraday 1d/5m, volatilité +
  courbe VIX + échelle graduée, agenda héros, FUT permanents, MONDE ×10,
  FX & TAUX) + Command Deck v2 densifié (1.C.2) ; tape LED Doto
  (1.C.10-bis) ; labs I-VII purgés ; choix Rafael au lab, amendé
  architecte (agenda au rail du temps, futures au rail des entrailles).
- **1.S ✅ (1.0.0-rc.4)** — Sidebar v2 « Marge vive » : témoins d'état
  neutres par entrée (positions ouvertes, clôturés du jour, dot
  pré-marché ambre), rangées en liens routeur, largeur 220, groupes
  silencieux, header sans badge REAL ; raccourci ⌘0 → Pré-marché
  (⌘1..9 intacts) ; marqueur de mode REAL/PAPER relogé en StatusBar
  (neutre, réactif) ; dettes de nav soldées (Pré-marché désenclavée,
  vérité ⌘9, /settings/api en nav, gardes clavier, ~340 l CSS morte
  purgées) ; choix Rafael au lab, amendé architecte.
- **1.D ✅ (1.0.0-rc.5)** — Héros 1 : bloc Equity/NLV
  pleine largeur sur **donnée NLV dense** (snapshots quotidiens + live,
  drawdown flow-neutral). **Zone haute PORTEFEUILLE refondue à l'image du
  MarketDeck** (4 sous-panneaux denses : CAPITAL & LIQUIDITÉ · P&L +MTD/YTD ·
  RISQUE & GREEKS +Γ/V · PERFORMANCE), LIQUIDITÉ DISPO prominente.
  **Graphe terminal** (lightweight-charts, code-split) : auto-échelle serrée,
  axe Y + ligne de prix, crosshair natif, apport annoté, toggle NLV/drawdown,
  marqueurs de clôture, bande perf par période, bande stats enrichie.
  CommandDeck migré dans la zone haute ; EquityChart remplacé.
  - **Fast-follow 1/5 ✅ (1.0.0-rc.6)** — LIQUIDITÉ DISPO = **vraie Available
    Funds IBKR** (bridge live, marqueur « IBKR ») quand le snapshot est frais,
    sinon estimation cash-A + `est.` (`resolveLiveAvailableUsd`, 10 tests).
  - **FF-données ✅ (1.0.0-rc.8, 29.07.2026)** — rétention NLV **longue**
    (cap FIFO 60 j → 3650, l'historique ne s'efface plus ; migration = no-op
    prouvé par test) + **writer intraday** (échantillons NLV ~5 min en séance
    RTH NY, buffer roulant `qc:nlvIntraday` ~5 séances, zéro réseau) +
    graphe Héros 1 **1D/5D denses** (nouveau range 1D propre au Héros 1,
    drawdown flow-neutral préservé, fallback quotidien honnête).
  - Fast-follow restants : `api/account-summary/sync.js` serveur,
    cleanup résidus 1.D.
- **1.E ✅ (1.0.0-rc.7)** — Héros 2 « Réalisé » (LA FUSION) : bloc RÉALISÉ
  pleine largeur, **jumeau de Héros 1** (cadre gris, cellules-MONDE, graphe
  terminal, double devise). **Maison PURE du réalisé** — l'UNREALIZED reste
  en Héros 1 (corrige le doublon de l'ancien DailyPnLChart). Contient **les 3
  vues roadmap** : DECK RÉALISÉ (cumulé + gross) + **MATRICE DE NON-PERTE**
  proéminente 3×2 (win rate · profit factor · payoff · expectancy · max DD
  cumul · recovery) · EXTRÊMES · RYTHME ; **graphe terminal** avec toggle
  **CUMULÉ ↔ QUOTIDIEN** (comme NLV/Drawdown) + géant réalisé en overlay +
  marqueurs de clôture ; panneau **DISTRIBUTION** (histogramme par bucket $,
  toujours visible) ; footer référence dédupliqué (détail jour + distribution).
  Remplace DailyPnLChart ; lab d'arbitrage purgé.
- **1.F ✅ (1.0.0-rc.9, 31.07.2026)** — La bande décision, **clôt le
  Dashboard (Étape 1 CLOSE)**. Étage DÉCISION pleine largeur entre Héros 2
  et RiskMatrix : UN panneau au cadre cockpit, 3 zones aux rails verticaux.
  **ATTENTION** (la plus large) : fusion generateAlerts (SL/TP/time-stop) +
  règle DTE doctrine de la bande (CRITICAL ≤ gate 45, ARMED 45-50, silence
  au-delà — seuils legacy 90/100 j retirés, correctif architecte c1) + kill
  switch en tête ; badges terminal ARMED/CRITICAL (plein/filet), tri par
  urgence, deep-links positions, état vide designé. **FORME** : pastilles
  des 18 dernières clôtures (strip signature rangée basse) + streak (neutre)
  + MTD + expectancy gatée 10 décisifs — modèle Héros 2, zéro recalcul.
  **CAPITAL** : jauge de déploiement graduée acier→ambre intégral au cap
  tier 70 % + DÉPLOYÉ / DISPONIBLE (IBKR·est.) / RISK $·STOPS / Δ NET /
  Θ TOTAL neutres / chip TIER — miroir strict Héros 1. **AlertsFeed MORT**
  (fusion, matrice de non-perte documentée). Micro-mouvement : ticks 180 ms
  (bande + decks Héros 1/2), stagger de montage 30 ms/étage,
  prefers-reduced-motion vérifié. Veille Watchlist/CalendarMini harmonisée
  (cadre cockpit, colonnes tenues, chips sobres) ; rythme vertical 8 px
  uniforme ; garde-fous racine overlap PortfolioDeck. Résidus tranchés
  É3/2.A : doublon CAPITAL↔PortfolioDeck, triplication Σ Δ/Σ Θ, moteurs
  DTE divergents, sémantique totalExposure, gate expectancy du deck Héros 2.

## Étape 2 — Familles de pages

- **2.A ✅ (1.0.0-rc.10, 02.08.2026)** — Tables (Positions · History) au
  langage cockpit v1.0 (+ correctif architecte 2.A-c1). **Positions** :
  bandeau de commandement 5 cellules-MONDE (MAX LOSS NEUTRE — amendement
  15.07 soldé — méta « prime totale engagée » ; fraîcheur Greeks en
  marqueur pf-real), table SURENSEMBLE des 19 colonnes LivePositions
  (cellules riches, Θ per-day unifié, TIER affichage seul + édition
  SniperMetaEditor au modal, badge GATE ARMED/CRITICAL au classifieur
  de la bande `deriveAttention`), footer agrégé sticky (`col.footer`
  DataTable, « Σ Valeur mark » §8), focus ambre `?focus=`, flat/vide
  recomposés cockpit. **History** : bandeau 6 cellules sur le
  sous-ensemble filtré (gates nullables honnêtes, Avg R « — » sans
  perdant), barre d'outils .lh-toggle + CTA ambre, étage ANALYSE
  Obsidienne 3 zones (ObsidienneTooltip unique ressuscité, WinRateDonut
  OBS — Analytics hérite —, attribution scopée par prop `trades`,
  extrêmes par signe), sous-titres de scope. LOI ratifiée : bandeaux de
  page 34 px / decks Dashboard 22-24 px (2.B/2.C/2.D). Chips
  ALERTS/TAG neutres, poubelles hover-reveal, « N non-taggués » neutre.
  - **Résidus consignés (décisions architecte 02.08)** :
    1. GATE NXT de LivePositions (`computeNextGate`) diverge du
       classifieur bande/page (`deriveAttention`) — vocabulaire et
       états (ex. « SL35 ARMED » vs CRITICAL time-stop). Alignement É3.
    2. CalendarMini « 0 évt » alors que le fallback macro local
       contient NFP à J-6 (AgendaCell/Calendar l'affichent — constaté
       live 01.08). Sonde du chemin de données + correctif en **2.C**.
    3. Seuil TIME_STOP hérité (≥5 j sans +15 %) sature ATTENTION en
       usage réel (4/5 CRITICAL). Doctrine à trancher (Rafael +
       architecte) en É3 — aucun changement d'ici là.
- **2.B ✅ (1.0.0-rc.11, 02.08.2026)** — Analytiques (Greeks · Analytics)
  au langage cockpit v1.0. **Greeks** : bandeau de commandement 5
  cellules-MONDE (OPTIONS · Δ · Γ · Θ/jour · ν) TOUTES NEUTRES + héros
  Projection Theta pleine largeur (barres neutres acier + cumul AMBRE =
  seule série ambre, ObsidienneTooltip) + table par position au craft
  (moteur maison, hover de ligne, colonne RANK morte) + donut Vega ACIER
  + **citoyen permanent** (flag GREEK_CENTER retiré, route/nav/⌘4
  inconditionnels, `featureFlags.js` mort). **Analytics** : bandeau 10
  KPI en 2 rangées, **ratios NEUTRES** (loi §4.6 — seul Max DD $ toné),
  caveat « échantillon < 1 an », heatmap annuelle héroïne + étage rythme
  & répartition (DayChart OBS · donut compact · breakdown chips neutres).
  **Morts (features fantômes)** : GreekEvolutionChart (mock aléatoire),
  IVRankHistogram (usine IV Rank jamais construite), RiskMetricsRow.
  **Heatmap réparée** (`PnLCalendarHeatmap`, partagée Calendar) : tokens
  `--hm-*` jamais définis → aplats rgba OBS désaturés, non-régression
  Calendar prouvée.
  - **Résidus consignés (post-1.0)** :
    1. **Pipeline IV Rank + affichage `qc:ivHistory`** — colonne RANK et
       IVRankHistogram tués (features fantômes) ; la vraie usine de
       données IV Rank reste **non construite**. À rouvrir seulement si
       source fiable. La série `qc:ivHistory` continue d'être COLLECTÉE
       par la Chain (intouchée), aucun affichage.
    2. **Badge STK cyan** — non implémenté ; la table Greeks reste
       option-only (filtre `as==='Option'`). À tracer → 2.C/É3.
    3. `.greeks-agg*` (~175 l, `v4-dashboard.css`) — dead-code
       **pré-existant** (0 consommateur), hors scope 2.B → session
       dead-code dédiée.
- **Famille 3 découpée par l'architecte** en **2.C1** (PreMarket · Calendar)
  et **2.C2** (Chain · Journal) — quatre pages en une session = risque de fin
  bâclée ; 2.C1 partage la famille de données `useCalendarFeeds`.
- **2.C1 ✅ (1.0.0-rc.12, 03.08.2026)** — Le poste du matin (PreMarket ·
  Calendar) au langage cockpit v1.0. **PreMarket** : bandeau de commandement
  (countdown reine 48 px, tick 1 s) · étage régime UNE grille 8 cellules-MONDE
  (**chevauchement des ex-bandes 56 px MORT à la racine** — hauteur fixe +
  cellules sans min-width:0 face au plancher 17 px du palier) · héros revue
  positions au **classifieur UNIQUE `deriveAttention`** (CRITICAL/ARMED/SAFE,
  fini `useSniperGates.status` + le libellé IMMINENT orphelin) · étage clôture
  2-col Agenda|Routine (flex:1 → **vide bas d'écran mort**, jour creux →
  prochain catalyseur). **Calendar** : bandeau signes vitaux servis · vue
  Annonces 2 colonnes · **loi de couleur sur les chips** (le ROUGE meurt :
  impact FORT → ambre, MOYEN/FAIBLE → neutre ; EARN neutralisé ; EXP garde
  l'ambre) · **badge STK cyan #42A5F5 MORT** · bannière Finnhub durable NEUTRE
  (fini l'ambre permanent). **CalendarMini** réparé à la racine (fallback macro
  local greffé, union dédupliquée — parité AgendaCell/page Calendar).
  - **Résidus consignés** :
    1. **PreMarket macro = logique OU** (bascule fallback) vs **union
       dédupliquée** de CalendarMini/AgendaCell — aligner en passe de
       cohérence future (non bloquant : dev/offline convergent).
    2. `greeksMap` inerte dans `generateAlerts` (facteurs = dte/pctChg/daysHeld)
       — commenté ; passer un greeksMap partagé si un jour greek-sensible.
    3. `docs/ETAT-DU-SITE.md` + `ETAT-DU-SITE-V1.md` listent encore « STK cyan »
       comme résidu vivant — **abrogé par 2.C1**, à réconcilier à la clôture d'étape.
- **2.C2 ✅ (1.0.0-rc.13, 04.08.2026)** — Workflow (Chain · Journal) au langage
  cockpit v1.0. **Famille 3 CLOSE.** **Chain** (outil de tir ; structure
  double-entrée + thead sticky 2 rangées = ACQUIS intacts) : bandeau `.lh-final`
  34 px (**troncatures mortes à la racine** — ex-bande fixe 56 px + labels/valeurs
  nowrap face au plancher 17 px du palier → auto-hauteur + `.pf-c` min-width:0) ·
  IVR tiret honnête (« série en collecte » ; aucun pipeline, mention « Sprint 6 »
  morte) · barres échéances/strikes **distinctes** (chevauchement mort) · **étage
  SIGNAUX REMONTÉ** avant la chaîne (Max Pain · 25Δ RR · OI · NET GEX · Murs,
  **tous NEUTRES** — structure de marché ≠ argent) · craft table (colonne STRIKE
  affirmée, repère ATM ambre, **zone Sniper AMBRE** — vert mort, **bandes ITM
  NEUTRES** — cyan/ambre v3 morts, Greeks neutres) · états accueil + honnête.
  **Journal** (miroir psy recomposé) : bandeau 34 px · héros **TiltMeter =
  EXCEPTION couleur NOMMÉE** (vert→ambre→rouge, jauge de discipline, lui SEUL) ·
  **filtre d'humeur en chips** (mur de mots collés mort) · cartes denses à grille
  fixe (carte étirée dans un vide morte) · Edge Leak Audit craft v1.0 (P&L matché
  toné, comptes NEUTRES) · humeurs/biais/étoiles NEUTRES · kill switch **même
  source que la bande décision** (`useDailyKillSwitch`, vocabulaire aligné, bande
  gelée). `pages-journal.css` créée (legacy purgé de v3-components, −330 l).
  - **Résidus consignés** :
    1. **`v5-chain.css` héberge 3 univers** — `.chain-*` (réécrit en place) +
       `.perf-attr` (attribution History, gelée) + `.cheatsheet` (modale globale).
       Split dédié + rename du fichier **différés** (hors périmètre 2.C2).
    2. **Pipeline IVR jamais construit** : `appendIvHistory` écrit `qc:ivHistory`
       mais aucun consommateur ne calcule un rang → cellule tiret honnête en attendant.
    3. **thead sticky 1 px @palier** : Row1 mesure 43 px vs `top:42px` (D2.F) —
       décalage invisible (en-têtes opaques), pré-existant, **acquis intouchable**.
- **2.D ✅ (1.0.0-rc.14, 04.08.2026)** — Utilitaires (Import · Settings General ·
  Settings API) au langage cockpit v1.0. **ÉTAPE 2 CLOSE.** Trois OUTILS (clarté,
  cohérence, densité, sécurité) + dette de données soldée.
  **DETTE FLEX (§4.1)** : token = source UNIQUE `sessionStorage` (avant :
  /settings/api écrivait en localStorage, jamais lu par la synchro qui lit
  sessionStorage — deux magasins disjoints) ; `configureFlex`/`getFlexConfig`
  sessionStorage + QueryID localStorage, `useApiStatus.probeFlex` corrigé,
  `clearFlexCredentials` (Import + RESET_ALL), migration douce one-shot (blob
  legacy + token localStorage résiduel → sessionStorage puis effacés). Prouvé
  en contexte isolé (valeur factice) : aucun token en clair persistant.
  **Import** : bandeau + étage SOURCES 2-col (Flex | CSV) + RÉSULTAT (merge
  additif) + SAUVEGARDE. **General** : bandeau + corps DEUX COLONNES (rows
  stackées) + `.mk-title` + CTA cash flows NEUTRE + résumé API neutre + **ZONE
  DANGEREUSE durcie** (inventaire détruit/survivant lu dans le reducer, mot RESET
  à taper, ROUGE = EXCEPTION NOMMÉE ; reducer RESET_ALL intouché). **API** :
  grille de 8 cartes cassées → TABLEAU DENSE (LIVE vert / DOWN · OFF neutres).
  **Morts** : ApiServiceCard + `.api-service-*` + `.api-v3__grid` +
  `.settings-v3__input` (−292 l). **GlassCard SURVIT** (App.jsx + DataTable.jsx).
  - **Résidus consignés** :
    1. Badge « REAL » du mode reste vert (convention StatusBar gelée) — arbitrage
       architecte si neutralisation app-wide souhaitée.
    2. RESET_ALL préserve watchlist / FX / tier Sniper (+ hors store : nom de
       profil, daltonien, seuil kill switch) — comportement du reducer inchangé.

## Étape 3 — Cohérence & modales

- **É3 ✅ (1.0.0-rc.15, 06.08.2026)** — Les 12 pages parlent d'une seule
  voix. **Les 11 points arbitrés (§4.2), leur sort :**
  1. GATE de LivePositions → classifieur UNIQUE `deriveAttention` via le
     hook partagé **`useAttentionMap`** (bande = Positions = LivePositions
     = PreMarket) ; `computeNextGate`/`formatGate`/« SL35 ARMED » MORTS.
  2. TIME_STOP RETIRÉ de la zone ATTENTION (seuil hérité non doctrinal,
     même mécanisme que DTE legacy 1.F-c1) ; « jours tenus » conservé
     partout (matrice de non-perte).
  3. GreeksStrip de RiskMatrix MORTE (triplication Σ Δ/Σ Θ éteinte) ;
     doublon CAPITAL↔PortfolioDeck CONSERVÉ (décision assumée).
  4. Streaks RiskMatrix NEUTRES + extension même-motif : compteurs
     IN PROFIT/LOSS (LivePositions), WINS/LOSSES (TradeHistory),
     Wins/Losses (RiskMatrix) neutralisés ($ tonés conservés).
  5. Expectancy gatée MIN_DECISIVE (10) dans les decks Héros 1 ET 2 —
     « — » + « N décisifs / 10 requis » (vérifié à 9 et 10).
  6. Moteur DTE UNIQUE `dteFromExp` clampé 0 (`daysToExpiration` MORT) +
     `isExpired()` → « EXP » honnête (tables, détail, DTE PROCHE,
     CLOSEST DTE).
  7. Libellé d'exposition = vérité du calcul : « EXPOSITION · Σ valeur
     mark » (bande + jauge + PortfolioDeck) ; calcul intouché ;
     CLAUDE.md §8 corrigé.
  8. Macro = UNION dédupliquée partout (PreMarket + Calendar alignés sur
     CalendarMini/MarketDeck) ; bascule OU morte.
  9. Cheatsheet ⌘/ réécrite sur la vérité du code (mnemonics/CommandBar/
     GitHub morts, chaque ligne vérifiée).
  10. Split v5-chain.css : perf-attr → pages-history (byte-identique),
      cheatsheet → modals.css ; renommée **pages-chain.css**.
  11. Docs internes périmées : LISTÉES seulement → corrigées en É4 (§5.6).
  **Modales & chrome (§4.3)** : `modals.css` maison unique (anatomie
  cockpit, drag-bars mortes), palette ⌘K `.cmdk` + lucide (bug lignes
  fantômes corrigé), Toast erreur/warning neutre appuyé,
  `--text-on-accent` → void, alertes détail neutres, fallback route
  sobre, TiltMeter au tick 180 ms.
  - **Résidus consignés** :
    1. Gisement couleur PRÉEXISTANT de RiskMatrix (EDGE+/− vert/rouge,
       jauges de ratios Sharpe & co, Kelly ambre, vol verte, R toné) —
       passe dédiée post-É3 (constat panel, hors mandat §4.2).
    2. Icons.jsx : 11/18 entrées mortes (BottomNav mobile n'en consomme
       que 9) — purge É4 §5.3.
    3. Bannière Calendar « Connecté · N » : le compte reflète le
       calendrier AFFICHÉ (union Finnhub ∪ local) — nuance assumée.

## Étape 4 — Recette v1.0

- **É4 ✅ (1.0.0, tag v1.0.0, 06.08.2026)** — la passe finale :
  1. **Audit exercé** des 12 routes @1591 dpr 1.35 ET @1920 (isolé,
     seedé) : 0 overflow, 0 erreur JS, modales/palette/raccourcis
     exercés, reduced-motion émulé. Captures `docs/captures/final-v1/`
     (12 @1591 + 12 @1920).
  2. **Performance mesurée** : lazy de toutes les routes sauf
     /dashboard → index 655→448 kB (gzip 197→139, −29 %) ; recharts
     inchangé (hors chemin critique, décision stabilité).
  3. **Purge orphelins −1 629 l** (grep 0 chacun) : CommandDeck,
     KpiZones, EquityChart, useDailySnapshot, exports morts
     (MoneyDual/KpiCell/KpiBelt/TIMEFRAMES×2/SYNC_FLEX/ibkrOrders),
     11 icônes, CSS .command-deck*/.greeks-agg*/.stat-row*, proxy
     /api/ibkr, listener ibkr:open-command, @number-flow/react ;
     en-têtes remis à la vérité. ibkrSummary conservé + documenté.
  4. **Sécurité re-prouvée** : token Flex = sessionStorage seul
     (isolé, valeur factice) ; clés réelles jamais approchées.
  5. **Docs finales** : ETAT-DU-SITE-V1 rafraîchi v1.0.0 (référence),
     CLAUDE.md/CHANGELOG/ROADMAP à jour.

## Backlog post-1.0 (explicite)

1. RiskMatrix — passe couleur dédiée (EDGE+/−, jauges ratios, Kelly
   ambre, vol verte, R toné — constat panel É3, préexistant).
2. Badge REAL vert StatusBar (arbitrage architecte si neutralisation).
3. Pipeline IV Rank (source fiable requise ; qc:ivHistory collecte).
4. Thème daylight sur pages canoniques.
5. CANONICAL-PURGE (zone TRANSITION + theme/tokens.js legacy).
6. api/account-summary/sync.js serveur (fast-follow 1.D).
7. Cosmétique : double scrollbar cheatsheet.

---

## Historique livré (avant l'ère produit)

- **V2 — Refonte densité / 4K** (B → C.2 → C.3.0) : densification 1591,
  plancher typo homogène 12 pages, thead sticky chain, theta neutre cross-page.
- **D0 — Fondation** *(2.1.1)* : constitution `CLAUDE.md`, sweep loi de
  couleur, scripts `check:color-law` + `audit:visual`.
- **D1 / D1.2 — Typographie** *(2.1.2 + 2.2.0)* : IBM Plex Sans Condensed 700
  sur tous les chiffres (`--qc-font-num`, `NumAnat`).
- **D2 — Densité terminal + échelle S2 ×1.30** *(2.3.0)* : chrome terminal
  dense ≥1440, échelle calibrée (KPI 44, cellules 20/47, plancher 17, ticks 14).
- **2.3.1 — Clôture V2** *(13.07.2026)* : purge labs/branches, docs de clôture,
  cartographie `docs/ETAT-DU-SITE.md`.
