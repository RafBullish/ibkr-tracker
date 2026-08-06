# Changelog

Toutes les évolutions notables de QuantumCall.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/), versionnage
[SemVer](https://semver.org/).

---

## [1.0.0] — 2026-08-06

**Étape 4 — Recette v1.0. LE TAG.** La passe finale : on vérifie, on purge,
on mesure, on documente, on tague. QuantumCall v1.0.0 est l'outil livré.

### Audit exercé (§5.1)
- Les 12 routes exercées @1591×900 dpr 1.35 ET @1920 en contexte isolé
  seedé : 0 overflow partout, 0 erreur JS, modales/palette/raccourcis/
  filtres exercés, `prefers-reduced-motion` prouvé par émulation.
- Captures finales versionnées : `docs/captures/final-v1/` (12 pages @1591
  + 12 @1920).

### Performance (§5.2, mesurée avant/après)
- **Lazy de toutes les routes sauf /dashboard** (page reine) — même
  mécanique ErrorBoundary+Suspense que Chain/Greeks/Analytics, barrière
  unique + fallback `.route-loader`.
- `index` : 655 kB (gzip 197) → **448 kB (gzip 139), −29 %** ; chaque page
  a son chunk (15-34 kB). `recharts` (542/150) inchangé : déjà hors chemin
  critique (3 routes lazy seulement) — stabilité prime.

### Purge des orphelins (§5.3, grep 0 prouvé par suppression)
- Fichiers : CommandDeck.jsx, hero1/KpiZones.jsx, charts/EquityChart.jsx,
  hooks/useDailySnapshot.js, src/contexts/ vide.
- Exports : MoneyDual/KpiCell/KpiBelt (hero1/parts), TIMEFRAMES
  (utils/equity), TIMEFRAMES+filterByTimeframe doublons (hero1/kit), case
  `SYNC_FLEX` du reducer, `settings.ibkrOrders` ; `settings.ibkrSummary`
  CONSERVÉ + documenté (écrit par le bridge vivant, 0 lecteur UI).
- Icons.jsx : 11 entrées mortes purgées (9 gardées pour BottomNav mobile).
- CSS : `.command-deck*` (v1-dashboard + c3-hires), `.greeks-agg*` (~175 l),
  `.stat-row*`. Config : proxy vite `/api/ibkr`, listener
  `ibkr:open-command`, `@number-flow/react` désinstallée, .gitignore
  iosevka-source. En-têtes remis à la vérité (hero1 « LAB » → PROD, tape
  92 px, StatusBar CHART, notes CommandDeck/DashboardKPICards). Total
  **−1 629 lignes**.

### Sécurité & données (§5.5)
- Token Flex RE-PROUVÉ en isolé (valeur factice) : sessionStorage
  uniquement, localStorage = QueryID seul. Les clés `ibkr_u_*` réelles
  n'ont jamais été approchées (session `--isolated` de bout en bout).

### Documentation (§5.6)
- `docs/ETAT-DU-SITE-V1.md` **rafraîchi à l'état v1.0.0** (10 sections,
  résidus abrogés retirés, backlog post-1.0 explicite). CLAUDE.md §5/§6 à
  jour (SideNav 220, v1.0 livrée), ROADMAP close.

### Gates
Build vert · check:color-law 0 · 290/290 tests · 12 pages peuplées
@1591+@1920, 0 overflow · console = bruit toléré documenté uniquement ·
prod READY sur ibkr-tracker-lemon.vercel.app · **tag `v1.0.0`**.

---

## [1.0.0-rc.15] — 2026-08-06

**Étape 3 — Cohérence & modales.** Les 12 pages parlent d'une seule voix :
divergences éteintes (les 11 points arbitrés par l'architecte), modales et
chrome global unifiés, dettes de registre soldées. **ÉTAPE 3 CLOSE.**

### Divergences éteintes (§4.2)
- **Classifieur UNIQUE partout** : nouveau hook partagé `useAttentionMap`
  (mêmes entrées que la bande décision) — la colonne GATE de LivePositions
  passe aux badges `ARMED`/`CRITICAL` (anatomie identique Positions/PreMarket).
  `computeNextGate`, `formatGate`, `GatePill` et son vocabulaire propre
  (« SL35 ARMED ») sont MORTS (grep 0) ; la pill `--armed` était ROUGE (fuite
  en moins). Positions et PreMarket migrent au même hook (3 assemblages → 1).
- **TIME_STOP retiré de la zone ATTENTION** (même mécanisme que les seuils DTE
  legacy en 1.F-c1) : seuil hérité non doctrinal (« ≥5 j sans +15 % ») qui
  saturait la bande (4/5 CRITICAL au réel). « Jours tenus » reste affiché
  partout (DAYS-IN, DTE riche, détail) — zéro donnée perdue.
- **Triplication Σ Δ/Σ Θ éteinte** : la GreeksStrip de RiskMatrix est MORTE
  (bande CAPITAL + PortfolioDeck + page Greeks restent les maisons). Doublon
  CAPITAL↔PortfolioDeck CONSERVÉ (deux moments de lecture, décision assumée).
- **Streaks NEUTRES** (RiskMatrix + bande) : un compteur n'est pas de l'argent ;
  le P&L $ de la streak courante reste toné.
- **Expectancy gatée à 10 trades décisifs** (MIN_DECISIVE_WINRATE) dans les
  decks Héros 1 ET Héros 2 — « — » honnête + « N décisifs / 10 requis »
  (une seule vérité avec la bande, vérifié à 9 et à 10 décisifs).
- **Moteur DTE UNIQUE clampé à 0** : `daysToExpiration` (négatif possible) est
  MORT, `alerts.js` migre sur `dteFromExp` (déclenchements identiques prouvés) ;
  nouveau `isExpired()` ; une option expirée s'affiche **« EXP »** partout
  (LivePositions, Positions, détail, DTE PROCHE, CLOSEST DTE).
- **Le libellé d'exposition dit la vérité du calcul** (`totalExposure` =
  Σ |valeur mark|) : bande « EXPOSITION · Σ valeur mark », jauge EXPOSITION,
  méta PortfolioDeck « Σ mark · % NLV ». Calcul intouché. L'ex-« DÉPLOYÉ »
  (coût des primes) mentait.
- **Macro = union dédupliquée partout** (date|libellé) : PreMarket et Calendar
  alignés sur CalendarMini/MarketDeck — la bascule OU est morte, rien ne
  disparaît sur réponse partielle de Finnhub.

### Modales & chrome global (§4.3)
- **`src/styles/modals.css` créée** — la maison des modales : anatomie unique
  cockpit (plan raised + filet murmuré + radius 7, en-tête registre mk-title +
  fermeture, corps 8 px, pied secondaire gauche / primaire ambre droite).
  Modal générique, AddTradeModal, ConfigFlexModal, détail de position,
  CheatsheetModal. Drag-bar décorative MORTE (les deux jumelles).
- **Split de `v5-chain.css`** : `.perf-attr__*` rapatriées dans
  pages-history.css (byte-identique, cascade préservée), `.cheatsheet__*` dans
  modals.css ; fichier renommé **`pages-chain.css`**.
- **CheatsheetModal (⌘/) réécrite sur la vérité du code** : ⌘0..9/K/B/Esc
  vérifiés contre AppShell, interactions réellement câblées seulement ;
  mnemonics 4-lettres MORTS (CommandBar morte en 1.B), hover-underline MORT,
  footer « v5 + GitHub » → « v1.0 ».
- **CommandPalette (⌘K) au langage cockpit** : styles inline (palette JS
  legacy) → classes `.cmdk` (verre sombre, hairlines, ligne focus ambre,
  état vide designé), icônes lucide (jeu unique). « Purge des données » cible
  /settings/general (l'ex-cible Import était fausse). **Bug corrigé** : le
  spread écrasait le discriminant des positions → lignes fantômes sans label.
- **Toast** : erreur/avertissement = NEUTRE APPUYÉ (une opération échouée
  n'est pas une perte), info neutre, succès vert (fait factuel d'opération).
- **Contraste CTA** : `--text-on-accent` → encre void (parité badge CRITICAL ;
  le blanc-sur-ambre hérité de l'ère cyan tenait ~1.9:1, void tient ~10:1).
- Alertes du détail de position NEUTRES (parité RowAlerts 2.A) ; fallback de
  route sobre (GlassCard retirée d'App) ; aiguille TiltMeter au registre tick
  (180 ms) ; caveat ratios RiskMatrix ex-inline → classe.

### Panel adversarial (passe 2 — corrections)
- LivePositions : Σ MAX RISK NEUTRE (amendement 15.07), CLOSEST DTE neutre +
  EXP, barre IVR neutre, pastilles ALERT neutres (cyan mort), badges
  IN PROFIT/IN LOSS neutres ; TradeHistory WINS/LOSSES neutres ; RiskMatrix
  compteurs Wins/Losses neutres ; compteur n sparse de l'attribution → encre
  sourde ; palette : zéro ni gain ni perte ; méta EXPOSITION sans troncature
  (mesuré) ; code mort raté purgé (useDailyKillSwitch de PreMarket, champ
  `gates`, `.modal-drag-bar`, 4 commentaires périmés).

### Gates
Build vert · check:color-law 0 violation · 290/290 tests · 12 pages peuplées
@1591 dpr 1.35 (docs/captures/e3-coherence/) · 0 overflow @1591 ET @1920 sur
les 12 routes · prefers-reduced-motion prouvé par émulation (4 pages) ·
console = bruit toléré uniquement (finnhub 500, quotes 429).

---

## [1.0.0-rc.14] — 2026-08-04

**Brique 2.D — Utilitaires (Import · Settings General · Settings API).** Dernière
brique de l'Étape 2 — **ÉTAPE 2 CLOSE**. Trois OUTILS mis au langage cockpit
(clarté, cohérence, densité, sécurité), et une dette de données réelle soldée.

### Corrigé — dette du token Flex (§4.1)
- **Source UNIQUE = `sessionStorage`.** Avant : un token saisi dans /settings/api
  était écrit en `localStorage`, jamais lu par la synchro (qui lit
  `sessionStorage` via `flexApi`) — deux magasins disjoints. Désormais :
  `configureFlex` écrit le token en sessionStorage (QueryID non secret en
  localStorage), `useApiStatus.probeFlex` lit le token en sessionStorage,
  `clearFlexCredentials` purge le magasin réel + un résidu localStorage.
- **Migration douce** one-shot au chargement : blob legacy ET token localStorage
  résiduel → sessionStorage puis effacés — rien à ressaisir, rien en clair
  persistant. Vérifié en contexte isolé (valeur factice) : après config le
  localStorage ne contient aucun token ; après effacement les deux magasins
  sont vides.

### Ajouté
- **Import** : bandeau (dernière synchro · trades en base · positions · config
  Flex) · étage SOURCES 2 colonnes (Flex IBKR | CSV, portes équivalentes) ·
  étage RÉSULTAT (lignes ajoutées, état vide, merge additif annoncé) · étage
  SAUVEGARDE (export / restauration validée).
- **Settings General** : bandeau (taux · capital · tier · mode · kill switch,
  NEUTRES) · corps en DEUX COLONNES (fini le ruban vertical) · titres de zone
  `.mk-title` · résumé Connexions API compact neutre.
- **Settings API** : bandeau (actifs/total · échec · dernière sonde) · les 8
  cartes aux libellés cassés → TABLEAU DENSE (Service · État · Détail · Dernière
  vérif · Action), états terminal LIVE / DOWN / OFF, repli annoncé.
- **Zone dangereuse durcie (§4.4)** : séparée pleine largeur, inventaire DÉTRUIT
  + SURVIVANT (lu dans le reducer), bouton désarmé tant que « RESET » n'est pas
  tapé (+ confirm en 2e rideau).

### Modifié
- **LOI DE COULEUR** : le ROUGE n'existe QUE dans la zone dangereuse (EXCEPTION
  NOMMÉE — destruction de données réelles). Erreur d'import, service DOWN/OFF,
  « KO » → NEUTRES. CTA « Ajouter » des cash flows → neutre (une écriture
  comptable n'est pas une décision). Kill switch DÉCLENCHÉ ambre / ARMÉ neutre
  (parité Journal 2.C2). Icônes de section/panneau neutres.
- General : rows stackées au palier 2 colonnes (contrôles larges n'écrasent plus
  la description). Le reducer `RESET_ALL` n'est PAS modifié (seule la porte).

### Retiré
- **ApiServiceCard supprimé** (plus aucun consommateur) + `.api-service-*` +
  `.api-v3__grid` + `.settings-v3__input` (Import migré vers `.settings-page__input`)
  purgés de v3-components.css (−292 lignes JSX/CSS mortes). **GlassCard SURVIT**
  (App.jsx ErrorBoundary + DataTable.jsx) — non supprimé.

## [1.0.0-rc.13] — 2026-08-04

**Brique 2.C2 — Workflow (Chain · Journal).** Dernière brique de la famille 3 :
les deux pages du flux de travail passent au langage cockpit v1.0. Chain =
l'outil de tir affûté (sa structure double-entrée + thead sticky = acquis
intacts) ; Journal = le miroir psychologique recomposé.

### Ajouté
- **Chain — bandeau de commandement** (`.lh-final .chain-command`, valeurs 34 px) :
  SPOT (variation du jour tonée = marché) · ATM IV · ÉCHÉANCES · STRIKES · ZONE
  SNIPER (ambre décisionnel) · IVR (tiret honnête, « série en collecte »).
- **Chain — barres échéances + strikes** en deux rangées distinctes (anatomie
  ViewToggle) ; échéance et filtre Sniper actifs en ambre de sélection.
- **Chain — étage SIGNAUX REMONTÉ** avant la chaîne (`.chain-signals`) :
  Max Pain · 25Δ RR · OI · NET GEX · Murs — tous NEUTRES (structure de marché).
- **Chain — états designés** : accueil « écran de tir » + honnête (ticker non servi).
- **Journal — bandeau de commandement** (`.lh-final .journal-command`, 34 px) :
  TILT · ENTRÉES · P&L JOUR · KILL SWITCH · PIRE FUITE D'EDGE.
- **Journal — héros TiltMeter 14 j** au cadre cockpit (barre graduée + échelle légendée).
- **Journal — filtre d'humeur en CHIPS**, entrées en cartes denses à grille fixe,
  Edge Leak Audit au craft v1.0. `pages-journal.css` créée.

### Modifié
- **BANDEAU CHAIN — troncatures MORTES à la racine** : l'ancienne bande à hauteur
  fixe 56 px (label/valeur/sub `nowrap`, débordement au palier ≥1440) remplacée
  par un bandeau `.lh-final` auto-hauteur + cellules `.pf-c` (min-width:0).
- **Chevauchement échéances/strikes MORT** : deux rangées `.chain-bar` distinctes.
- **Footer analytics REMONTÉ** en étage signaux (on lit Max Pain/GEX/murs avant
  de choisir un strike, plus après avoir scrollé toute la chaîne).
- **LOI DE COULEUR — Chain** : Greeks neutres (inchangés), zone Sniper (table +
  bandeau) AMBRE (le vert meurt), bandes ITM NEUTRES (cyan/ambre v3 morts),
  NET GEX / 25Δ RR / Murs CALL·PUT NEUTRES, erreur de fetch neutre (plus de rouge).
- **Filtre d'humeur** : le mur de mots collés → chips (actif ambre, reste neutre) ;
  humeurs / biais / étoiles NEUTRES (un état émotionnel n'est pas de l'argent).
- **Kill switch** : Journal et bande décision lisent la MÊME source
  (`useDailyKillSwitch`) ; vocabulaire du Journal aligné sur la bande
  (« Limite du jour franchie », `fmtUsdSigned` partagé). Bande décision gelée.
- **TiltMeter — EXCEPTION couleur nommée** : garde son échelle vert → ambre →
  rouge (jauge de discipline dont la dérive coûte de l'argent réel), et pour
  lui SEUL ; partout ailleurs sur Journal, compteurs/scores/taux NEUTRES.

### Retiré
- Styles Journal/TiltMeter legacy purgés de `v3-components.css` (−330 lignes,
  tokens `--qc-*`/`--fs-*`) → recomposés au canonique dans `pages-journal.css`.
- Mention interne « Sprint 6 » sur la cellule IVR (aucun pipeline IVR n'existe).

### Corrigé
- Bug de parse `pages-journal.css` (`*/` dans un commentaire fermait le
  commentaire) attrapé par la vérification VISUELLE malgré un build vert.

## [1.0.0-rc.12] — 2026-08-03

**Brique 2.C1 — Le poste du matin (PreMarket · Calendar).** Les deux pages
du moment « préparation de la séance » passent au langage cockpit v1.0.
Famille 3 découpée par l'architecte en 2.C1 (PreMarket + Calendar) et 2.C2
(Chain + Journal). Un vrai bug de layout tué, un bug de chemin de données
réparé à la racine.

### Ajouté
- **PreMarket — bandeau de commandement** (`.lh-final .pm-command`) : le compte
  à rebours d'ouverture est la valeur reine (48 px, tick 1 s, HH:MM:SS), +
  PHASE US · Genève · New York · GATES (N/M, compteur NEUTRE).
- **PreMarket — étage régime** : UNE grille `.pm-regime` de 8 cellules-MONDE
  (VIX·SPX·QQQ·ES·NQ·YM·USD/CHF·DXY), hauteur auto + min-width:0.
- **PreMarket — héros revue des positions** au classifieur UNIQUE
  `deriveAttention` (CRITICAL/ARMED/SAFE, parité Positions / bande décision).
- **PreMarket — étage de clôture 2 colonnes** (Agenda | Routine) qui remplit
  l'écran ; jour creux → prochain catalyseur avec horizon.
- **Calendar — bandeau de commandement** (4 signes vitaux servis) + vue Annonces
  en 2 colonnes (grille mensuelle | liste dense).

### Modifié
- **CHEVAUCHEMENT régime PreMarket MORT à la racine** : les 2 bandes à hauteur
  fixe 56 px (débordement au palier ≥1440 : label/sub 17 px + cellules sans
  min-width:0) fusionnées en une grille auto-hauteur.
- **Classifieur unique** : PreMarket abandonne `useSniperGates.status`
  (armed/imminent/safe + libellé IMMINENT orphelin) pour `deriveAttention`.
- **LOI DE COULEUR sur Calendar** : le ROUGE meurt sur l'impact (FORT → ambre,
  MOYEN/FAIBLE → neutre) ; chip TYPE neutre (EARN vert → ink-pure, EXP garde
  l'ambre) ; PHASE US « OPEN » n'est plus vert (un état de séance n'est pas un
  gain d'argent).
- **Bannière Finnhub** : l'ambre PERMANENT (état durable) → ligne d'info NEUTRE
  honnête (« servi depuis la source locale ; earnings non servis ») ; flux
  partiel rouge → neutre.

### Corrigé
- **CalendarMini — bug de chemin de données à la racine** : le mini était le
  seul des 3 consommateurs (mini / AgendaCell / Calendar) sans fallback macro
  local → affichait « 0 évt » alors que NFP était à J-4. Greffe de l'union
  `macro ∪ macroEventsInRange` dédupliquée. Visuel 1.F INTACT.

### Supprimé
- Badge STK cyan `#42A5F5` (Calendar) → registre neutre ink-soft (grep 0).
- Anciennes classes CSS PreMarket (`premarket-page__regime/clock/section/table/
  status-pill/pill/held-tag`), `.calendar-page__panel--subtle`, api-banner
  `--down`/`--error`.

---

## [1.0.0-rc.11] — 2026-08-02

**Brique 2.B — Analytiques (Greeks · Analytics).** Les deux dernières
grandes pages pré-Obsidienne passent au langage cockpit v1.0 : bandeaux
de commandement, héros/étages au système Obsidienne, loi de couleur
appliquée aux ratios. Deux mensonges tués, une heatmap réparée.

### Ajouté
- **Greeks — bandeau de commandement** (`.greeks-command`, cadre cockpit
  `.lh-final`) : 5 cellules-MONDE (OPTIONS · Δ NET · Γ NET · Θ/JOUR · ν NET),
  valeurs 34 px, TickValue — TOUTES NEUTRES (aucun argent réel sur la page ;
  un Greek signé n'est pas une perte).
- **Greeks — héros Projection Theta** pleine largeur : `ThetaDecayProjection`
  recomposé en Recharts Obsidienne (barres quotidiennes NEUTRES acier + cumul
  AMBRE = seule série ambre de l'écran, ObsidienneTooltip, animation au premier
  montage), pied de stats PAR JOUR · CUMUL 7 J · CUMUL 30 J.
- **Greeks — table par position** au craft v1.0 (moteur maison : rangées à
  grille propre + hover de ligne, cellules 20/mono 600, rowHeight 47).
- **Greeks — citoyen permanent** : flag `VITE_FEATURE_GREEK_CENTER` retiré,
  route + entrée nav + ⌘4 inconditionnels.
- **Analytics — bandeau de commandement** (`.analytics-command`) : 10 KPI en
  2 rangées de cellules-MONDE 34 px, caveat d'honnêteté « préliminaire ·
  échantillon < 1 an ».
- **Analytics — étage RYTHME & RÉPARTITION** : un panneau cockpit, 3 zones
  aux rails (P&L par jour de semaine OBS · Répartition G/P donut compact ·
  Breakdown par stratégie), DayChart migré ObsidienneTooltip.
- **pages-analytics.css** créée (bandeau + étage), importée avant les v1-*.

### Modifié
- **LOI DE COULEUR — ratios NEUTRES** : sur Analytics, Sharpe / Sortino /
  Calmar / Profit Factor / Omega / Kelly % / Win Rate / Expectancy R passent en
  encre neutre (un ratio n'est pas de l'argent). Seul MAX DD $ (perte réelle)
  reste toné. Breakdown : chips TAG neutres, Win % neutre, P&L / Best / Worst
  tonés par signe.
- **Donut Vega** : gradations ACIER neutres (ex-slice ambre retiré).
- **Heatmap P&L annuelle RÉPARÉE** (`PnLCalendarHeatmap`, partagée Analytics +
  Calendar) : les tokens `--hm-pos/neg-*` n'avaient jamais été définis →
  cellules transparentes (illisible). Échelle divergente en aplats OBS
  désaturés (rgba) + ghost neutre, labels 9-10 px → 11-12 px, cellules 14 px,
  toggle Année/Mois à l'anatomie chip validée. Calendar en hérite
  (non-régression prouvée).
- **Greeks — icône de titre Σ ambre** (parité chrome 2.A).

### Supprimé
- **GreekEvolutionChart** (mock aléatoire 30 j — feature fantôme) et
  **IVRankHistogram** (usine IV Rank jamais construite) : un cockpit ne ment
  pas.
- **Colonne RANK** de la table Greeks (IV Rank sans source réelle).
- **RiskMetricsRow** (fondu dans le bandeau Analytics).
- `featureFlags.js`, `GREEKS_PHASE`, et la peau CSS morte `.greek-evo*` /
  `.iv-rank*` / géométrie `.theta-decay__bars/__day` (dont un fusil chargé
  color-law `[data-tone=profit/loss]` sur le theta).

---

## [1.0.0-rc.10] — 2026-08-02

**Brique 2.A — Tables (Positions · History), ouverture de l'Étape 2.**
Les deux pages passent au langage cockpit v1.0 : bandeau de commandement
+ table héroïne + (History) étage ANALYSE au système Obsidienne. Inclut
le correctif architecte 2.A-c1.

### Ajouté
- **Positions — bandeau de commandement** (`.pos-command`, cadre
  cockpit `.lh-final`) : 5 cellules-MONDE aux hairlines verticales
  (POSITIONS · Δ NET · Θ TOTAL · CAPITAL ENGAGÉ · MAX LOSS), double
  devise CHF, TickValue, fraîcheur Greeks en marqueur discret (registre
  pf-real) sur Δ NET, méta POSITIONS = « N CRITICAL · N ARMED » quand
  des gates sont actifs. **MAX LOSS NEUTRE** (amendement 15.07.2026 —
  un montant hypothétique n'est pas une perte), méta « prime totale
  engagée » (≠ RISK $ · STOPS de la bande : 100 % vs 35 % de la prime).
- **Positions — table SURENSEMBLE** des 19 colonnes de LivePositions
  (14 colonnes via cellules riches : Strike+Exp, DTE+DaysIn, Mark+Spark,
  P&L+%), rows enrichies par `useLivePositions` (lecture seule — Θ
  unifié per-day, IVR + microbar neutre, TIER chip E·C affichage seul,
  édition de la méta Sniper via le modal détail + SniperMetaEditor).
  **Badge GATE ARMED/CRITICAL au MÊME classifieur que la bande décision**
  (`deriveAttention` importé — une position CRITICAL dans la bande =
  CRITICAL ici). **Footer agrégé sticky** (nouveau support `col.footer`
  du DataTable, tfoot, deux branches) : Σ·N pos · DTE proche · Σ Max
  loss · **Σ Valeur mark** (§8 : « notionnel » aurait menti) · Σ Unreal
  toné · Σ Δ$ · Σ Θ/j. Deep-link `?focus=` = hairline gauche ambre.
- **History — bandeau** (`.hist-command`) : 6 cellules-MONDE sur le
  SOUS-ENSEMBLE FILTRÉ (une page = une vérité), montants héros en
  ENTIERS (U+2212), ratios NEUTRES, gates nullables honnêtes (« — »
  Win Rate < 10 décisifs ; **Avg R « — » sans perdant dans le scope**).
- **History — barre d'outils** : toggle Standard/Sniper + filtres à
  l'anatomie `.lh-toggle` des héros (clé `ibkr_history_view_mode`
  inchangée), CTA « Ajouter un trade » ambre (zone de décision).
- **History — étage ANALYSE** : UN panneau cockpit, 3 zones aux rails
  (WIN RATE donut · DISTRIBUTION P&L · ATTRIBUTION Edge×Capital), au
  système Obsidienne : **ObsidienneTooltip RESSUSCITÉ** (LE tooltip
  unique — les Recharts contentStyle inline 11 px meurent),
  WinRateDonut migré OBS (zéro glow/gradient, numéral neutre — Analytics
  hérite sans recomposition), Distribution OBS (ticks 14 tabulaires,
  fills up/down désaturés, mount-only), PerformanceAttribution scopée
  via prop `trades` (les filtres pilotent AUSSI l'attribution) avec
  extrêmes tonés par SIGNE et cas dégénéré best=worst honnête.
  Sous-titres de scope sur les 3 zones (« 14 trades · gagnants »).

### Modifié
- Strips de KpiTile, tabs et panneaux flottants des deux pages : MORTS
  (CSS purgé — pages-*, v3-components : kpi-strip, greeks-freshness,
  DteBadge coloré, cartes flat). Flat state recomposé en UN panneau
  cockpit 4 zones ; états vides au cadre cockpit.
- Chips ALERTS et TAG : tags factuels NEUTRES (l'urgence vit dans GATE,
  un tag de classification n'est pas décisionnel) ; poubelles en
  hover-reveal dans les tables cockpit ; toolbar DataTable groupée à
  gauche (anti-vide) ; zéro négatif des greeks clampé ; garde-fou % de
  vraisemblance (>999 % → « — ») ; stagger de montage 1.F
  (RISE_*_VARIANTS) sur les deux pages.
- **2.A-c1** : « N non-taggués » (attribution) au registre neutre
  `--ink-mute` — l'ambre ambiant meurt (l'état 0-taggué est durable).

### Vérifié
- Build vert · color-law 0 · 290 tests verts · audit 12 pages peuplées
  → `docs/captures/2a-tables/` · 0 overflow @1591 ET @1920 (Chain
  peuplée, scrollers de tables inclus) · console : tolérés uniquement ·
  3 passes d'autocritique (dont panel 4 juges) + correctif architecte ·
  non-régression Analytics (donut) prouvée par capture.

---

## [1.0.0-rc.9] — 2026-07-31

**Brique 1.F — La bande décision (clôture du Dashboard, Étape 1 CLOSE).**
Nouvel étage DÉCISION pleine largeur entre Héros 2 et RiskMatrix : UN
panneau continu au cadre cockpit canonique, TROIS zones séparées par des
rails verticaux (langage MarketDeck). Inclut le correctif architecte
1.F-c1 (jauge, règle DTE, badges).

### Ajouté
- **Zone ATTENTION** (« dois-je agir ? », la plus large) —
  `decision/model.js` PUR (23 tests) fusionne le moteur canonique
  `generateAlerts` (STOP_LOSS, TIME_STOP, TP1/TP2, fenêtres d'approche
  SL −24,5 % et TP) + la **règle DTE doctrine de la bande** (CRITICAL dès
  la gate 45 franchie, ARMED dans la fenêtre 45-50, **silence au-delà** —
  les seuils legacy 90/100 j sont retirés de la bande, leur maison reste
  LivePositions/Positions) + le **kill switch quotidien** en ligne
  prioritaire. Une ligne par position (signal le plus urgent, « +N » au
  survol), tri critique→armé puis proximité, badges terminal
  **ARMED / CRITICAL** (filet/plein reverse-video), hairline gauche ambre
  sur les critiques, deep-links `/trading/positions?focus=`, débordement
  « +N autres » cliquable, **état vide designé** (« Tous les gates au
  vert — N positions surveillées »).
- **Zone FORME** (« suis-je en forme ? ») — pastilles des **18 dernières
  clôtures** (chrono, la plus récente accentuée, strip signature en rangée
  basse), **streak courant** (encre neutre — un compteur n'est pas de
  l'argent), **MTD réalisé** et **expectancy** gatée à 10 trades décisifs
  (« — » honnête sous le seuil). Sources = modèle Héros 2
  (`deriveRealized` ALL) + `usePortfolioMetrics` — zéro recalcul divergent.
- **Zone CAPITAL** (« ai-je de la marge ? ») — **jauge de déploiement**
  graduée : remplissage **acier** (registre barres de deck) sous le cap,
  **intégralement ambre au franchissement du cap tier 70 %** (transition
  120 ms, le signal naît au cap), repère ambre à liseré void ; cellules
  miroir Héros 1 : DÉPLOYÉ, DISPONIBLE (marqueur IBKR/est.,
  `resolveLiveAvailableUsd`), RISK $ · STOPS (neutre, §8), Δ NET et
  Θ TOTAL (neutres — loi de couleur), chip TIER sobre.
- **Micro-mouvement** — `TickValue` (fondu + 2 px, 180 ms) sur les valeurs
  de la bande ET les cellules/héros des decks Héros 1 et 2 (MarketDeck
  gelé, non touché) ; **stagger de montage** 150 ms / 30 ms par étage
  (cockpit → héros → bande → suites), une fois au mount ;
  `prefers-reduced-motion` coupé proprement partout (vérifié par émulation).

### Modifié
- **AlertsFeed MEURT** — fusion dans ATTENTION (matrice de non-perte
  intégrale au rapport de brique) : composant + hook + ~135 l CSS + area
  `alert` supprimés, grep 0. `utils/alerts.js` et `useDailyKillSwitch`
  intacts (consommés ailleurs). `useSniperGates` NON modifié.
- **Veille harmonisée** — Watchlist · CalendarMini au langage v1.0
  (`.db-veille`) : cadre cockpit canonique, titres de zone 13 caps,
  colonnes tenues groupées à gauche, CalendarMini date·tag·label, chips
  hairline sobres, × de retrait au survol, « Août » correct.
- **Rythme vertical 8 px uniforme** — retrait du margin-top 6 px legacy
  C.2.6.7 sur history (séparait la rangée SniperGate morte depuis C.2.10).
- **Garde-fous overlap PortfolioDeck** (résidu 1.E, non reproduit malgré
  seed de stress systématique — protections racine) : panneaux
  `overflow:hidden`, héros/meta/titres nowrap + ellipse, rangées
  `minmax(55px,auto)` (la barre EXPOSURE n'est plus rognée d'1 px).
- Typo : « · / clôture » → « / clôture » (bande + decks Héros 1/2),
  signes du kill uniformisés (U+2212).

### Vérifié
- Build vert · color-law 0 · 290 tests verts · audit 12 pages peuplées
  @1591×900 dpr 1.35 → `docs/captures/1f-decision/` · 0 overflow @1591 ET
  @1920 (Chain peuplée incluse) · console : tolérés uniquement · 3 passes
  d'autocritique documentées (dont panel 4 juges) + correctif architecte.

---

## [1.0.0-rc.8] — 2026-07-29

**Micro-brique FF-données (fast-follows données 1.D).** Zéro refonte
visuelle : la donnée NLV du Héros 1 devient **longue** (l'historique ne
s'efface plus) et **dense** (échantillons intraday ~5 min en séance).

### Corrigé
- **Rétention NLV longue** — le cap FIFO **60 jours** de
  `settings.dailySnapshots` (reducer `UPDATE_DAILY_SNAPSHOT`) **effaçait
  l'historique NLV au-delà de 3 mois, chaque jour**. Cap levé à
  **`DAILY_SNAPSHOT_MAX_DAYS = 3650`** (~10 ans, exporté pour les tests) :
  les ranges 1Y/ALL lisent désormais tout l'historique. Aucune migration
  nécessaire (lever un cap préserve l'existant — prouvé par test) ;
  localStorage borné (~0,5 Mo au pire) ; le graphe rééchantillonne déjà à
  190 points (`resampleSeries`, bucketing semaine/mois) — perf inchangée.

### Ajouté
- **Writer snapshots intraday** — `utils/nlvIntraday.js` (pur) : buffer
  roulant compact **`qc:nlvIntraday`** `{v:1, days:[{d, pts:[[epochSec,
  nlv]]}]}`, **~5 jours de séance**, garde de cadence 4,5 min, écriture
  sûre, événement de changement. Hook `hooks/useIntradayNlv.js` :
  `useIntradayNlvWriter` monté dans l'AppShell (composant nul isolé —
  le tick minute ne re-rend pas l'arbre), gaté **RTH NY** par
  `useMarketSession` (hook ressuscité — recadré FF-données) : AUCUNE
  écriture hors séance, **zéro requête réseau** (NLV lue du store,
  `usePortfolioMetrics`, override bridge < 1 h compris), clés `ibkr_u_*`
  jamais touchées.
- **Graphe Héros 1 : 1D/5D denses** — nouveau range **1D** (liste
  `TIMEFRAMES_HERO1`, propre au Héros 1 — le sélecteur de Héros 2 garde la
  liste partagée sans 1D via la prop `options` de `RangeSelector`) ;
  `buildIntradaySeries` (`utils/nlvSeries.js`) déplie le buffer en série
  terminale : **drawdown flow-neutral préservé** (dépôts soustraits, peak
  seedé de tout l'historique quotidien antérieur à la fenêtre), point live
  du store en fin de courbe, axe temps en heure locale (`t` epoch décalée,
  `timeVisible`). 1D/5D basculent en intraday dès que le buffer couvre la
  fenêtre (1D : ≥ 2 points ; 5D : ≥ 2 séances) — **fallback quotidien
  honnête sinon** (rendu identique à rc.7). Bandes perf/stats restent
  calculées sur la série quotidienne fenêtrée (sémantique « par jour »).
- **Tests** (+24, total 267) — `store/__tests__/reducer.dailySnapshots`
  (idempotence, préservation > 60 j, FIFO au cap long),
  `utils/__tests__/nlvIntraday` (cadence, buffer roulant, lecture
  défensive, clés), `utils/__tests__/nlvSeries` (**verrou anti-régression
  du drawdown flow-neutral quotidien**, jusqu'ici non testé + série
  intraday complète).

### Vérifié
- Build vert · color-law 0 · 267 tests verts · @1591×900 : 1D/5D denses
  (2 séances, crosshair heure locale), drawdown intraday, ALL 120 jours
  avec apport annoté, writer live prouvé en séance (échantillon écrit au
  mount), 121 snapshots quotidiens après passage app (zéro troncature),
  Héros 2 / MarketDeck / Sidebar intacts, 0 overflow, console propre
  (seuls 500 finnhub / 429 dev tolérés). Captures :
  `docs/captures/ff-donnees/`.

## [1.0.0-rc.7] — 2026-07-21

**Brique 1.E « Héros 2 — Réalisé » (LA FUSION).** Le second héros du
Dashboard devient le **jumeau de Héros 1** et la **maison PURE du RÉALISÉ** :
il remplace l'ancien `DailyPnLChart` (hybride confus qui mêlait un gros
chiffre UNREALIZED à une courbe réalisée). L'UNREALIZED reste désormais en
Héros 1 ; Héros 2 ne parle que d'argent **encaissé**. Contient **les 3 vues
roadmap** (cumulé / quotidien / distribution) + la **matrice de non-perte**.

### Ajouté
- **Bloc Héros 2** (`components/dashboard/Hero2.jsx` + `hero2/*`,
  `styles/v1-heros2.css`) — même cadre gris (`.lh-final`), frontière,
  cellules-MONDE et double devise USD/CHF que Héros 1. Trois zones :
  - **DECK RÉALISÉ** (`RealizedDeck.jsx`) — 4 panneaux : **RÉALISÉ TOTAL**
    (cumulé + gross gains/pertes) · **MATRICE DE NON-PERTE** proéminente (3×2 :
    win rate · profit factor · payoff · expectancy · max DD cumul · recovery)
    · **EXTRÊMES** (meilleure/pire · gain/perte moy.) · **RYTHME** (clôtures ·
    gagnantes/perdantes · jours actifs).
  - **Graphe HÉROS terminal** (`TvChartRealized.jsx`, lightweight-charts,
    code-split) avec **toggle CUMULÉ ↔ QUOTIDIEN** (exactement comme le toggle
    NLV/Drawdown de Héros 1) : aire de la trajectoire cumulée (ligne neutre,
    axe Y + ligne de prix, crosshair natif, **géant réalisé en overlay**,
    marqueurs de clôture vert/rouge) ↔ **histogramme des barres jour**
    (vert/rouge = argent réel).
  - **Panneau DISTRIBUTION** (`Distribution.jsx`, Recharts) — histogramme des
    issues par-trade par bucket $ (vert/rouge = argent réalisé), **toujours
    visible**, réglable par période.
- **Modèle réalisé** (`hero2/model.js`) — dérivations pures depuis
  `closedTrades` réels (via `useDailyPnL`) : séries cumulée/quotidienne,
  distribution, matrice de non-perte, stats jour. Fenêtrage cohérent 5D→ALL.

### Modifié
- **Dashboard** — `Hero2` remplace `DailyPnLChart` à la 2ᵉ rangée (grille
  `dailypnl` → `hero2`, hauteur auto). Deux étages pleine largeur du même
  cockpit (Héros 1 = latent, Héros 2 = réalisé). État `chartRange` local retiré.
- **Footer référence dédupliqué** — aucune métrique n'apparaît deux fois : le
  deck porte matrice/extrêmes/rythme (niveau trade), le footer porte le détail
  **jour + distribution** (meilleur/pire jour · % jours gagnants · mode · pas
  de bucket · fenêtre).

### Retiré
- **`DailyPnLChart.jsx`** (remplacé, mort) et le **lab d'arbitrage**
  `/lab/heros2` (`src/lab/*`, `lab-heros2.css`, route DEV) — purgés.

### Intangibles préservés
- Héros 1 (1.D), MarketDeck (1.C), Sidebar (1.S) inchangés — vérifié au
  computed style (géant 72px, cadre `.lh-final`, 7 `.mk-cell`, SideNav 219px).
  Loi de couleur **0** (réalisé $ = rouge/vert ; courbe cumulée + ratios/comptes
  neutres). Aucune dépendance nouvelle (lightweight-charts déjà ratifié en 1.D).

## [1.0.0-rc.6] — 2026-07-21

**Fast-follow 1.D (1/5) — LIQUIDITÉ DISPO = Available Funds IBKR réelle.**
La carte **CAPITAL & LIQUIDITÉ** du bloc Héros 1 abandonne l'estimation
`est.` dès que le bridge IBKR local fournit un snapshot **frais** : elle
affiche alors la **vraie Buying Power / Available Funds** avec le marqueur
**« IBKR »**. Aucune fabrication de chiffre — snapshot périmé ou devise
non convertible ⇒ retombée transparente sur l'estimation cash-A + `est.`.

### Ajouté
- **`resolveLiveAvailableUsd(liveData, liveRate, nowMs?)`**
  (`hooks/useAvailableCapital.js`) — lit `settings.ibkrLiveData.availableFunds`
  (tag `AvailableFunds` de `ib.accountSummary()`, cf. `bridge/ibkr_poller.py`).
  Ne renvoie un USD fini **que si** le snapshot est frais
  (`FRESHNESS.LIVE_DATA_MAX_AGE_MS`, même seuil que le badge LIVE et l'override
  NLV) **et** porte une devise convertible (USD direct, CHF via `liveRate`) ;
  sinon `null`. Testé — **10 cas** (`__tests__/resolveLiveAvailableUsd.test.js`).

### Modifié
- **`Hero1.jsx`** câble `resolveLiveAvailableUsd` : `availableUsd` réel
  prioritaire, sinon estimation cash-A ; passe `availableIsReal` au modèle.
- **`hero1/model.js`** expose `powderIsReal` ; **`PortfolioDeck.jsx`** bascule
  le marqueur **IBKR / est.** selon la fraîcheur (loi de couleur intacte,
  neutre). Le Flex EOD n'expose pas la Buying Power ; seul le bridge le fait.

### Signalé (fast-follow restants 2..5/5)
- Rétention NLV > 60 j (FIFO actuel), writer intraday, `api/account-summary/sync.js`
  côté serveur, cleanup résidus 1.D.

## [1.0.0-rc.5] — 2026-07-20

**Brique 1.D « Héros 1 »** — Equity/NLV pleine largeur. Le premier héros
du Dashboard passe d'une tuile demi-largeur à un **bloc portefeuille pleine
largeur** sur donnée **NLV dense**, avec une **zone haute portefeuille
refondue À L'IMAGE DU MARKETDECK** (sous-panneaux denses, choix Rafael).

### Ajouté
- **Bloc Héros 1** (`components/dashboard/Hero1.jsx` + `hero1/*`,
  `styles/v1-heros.css`) — 3 zones : (1) **frontière** Marché/Portefeuille
  (structurelle) ; (2) **zone haute PORTEFEUILLE** (`PortfolioDeck`) — 4
  sous-panneaux denses étiquetés dans le langage visuel du MarketDeck
  (mêmes `.mk-cell`/`.mk-title`, rails, densité, typo) : **CAPITAL &
  LIQUIDITÉ** (LIQUIDITÉ DISPO prominente `est.` · EXPOSURE · POSITIONS ·
  DTE) · **P&L** (DAY · UNREALIZED · REALIZED · **MTD** · **YTD**) ·
  **RISQUE & GREEKS** (CAP. RISQUE · Θ/jour · Δ net · **Γ** · **V**) ·
  **PERFORMANCE** (WIN RATE · PROFIT FACTOR · EXPECTANCY · CLÔTURES),
  double devise USD/CHF ; (3) **zone graphe** : **NLV géant en overlay** sur
  un **graphe terminal** + bande perf par période + bande stats enrichie.
- **Graphe terminal** (`hero1/TvChart.jsx`, dépendance **lightweight-charts**
  v5 Apache-2.0, **code-split** → chunk propre, hors bundle index) :
  auto-échelle Y serrée par période, axe Y à droite + ligne de prix,
  crosshair canvas natif + boîte (date/NLV/Δ), remplissage dégradé neutre,
  apport annoté en événement, toggle NLV/Drawdown, marqueurs de clôture
  vert/rouge.
- **Pipeline NLV dense** (`utils/nlvSeries.js`) : série 1 pt/jour depuis
  `settings.dailySnapshots` + point live ; **drawdown flow-neutral** (un
  apport ne guérit pas un drawdown) ; rééchantillonnage réel par période ;
  stats de fenêtre + de référence (recovery, expectancy, % jours gagnants…).

### Modifié
- **Cockpit ENCADRÉ** — le conteneur du MarketDeck (1.C) reçoit le même
  cadre gris + radius que le bloc Héros 1 (harmonie : un seul cockpit
  continu). **Seul le cadre du conteneur change ; le contenu 1.C est
  intact.** La zone haute portefeuille (`PortfolioDeck`) reprend le
  langage du MarketDeck : cellules-MONDE (libellé + grosse valeur + CHF
  collés, zéro trou central), grille 2 colonnes alignée au cordeau.
- **CommandDeck** retiré du cockpit : la bande KPI portefeuille migre dans
  la zone haute du bloc Héros 1. Le cockpit ne porte plus que le **MarketDeck**
  (étage marché, 1.C, intangible).
- **EquityChart** (tuile demi-largeur, source cumPnL par trade) remplacé par
  le bloc Héros 1 (pleine largeur, source NLV dense). Grille Dashboard :
  hero1 pleine largeur en tête, DailyPnL (Héros 2, 1.E) en pleine largeur en
  dessous (interim jusqu'à 1.E).

### Signalé (TODO fast-follow)
- **LIQUIDITÉ DISPO = estimation** (`availableUsd` cash-A) tant que la vraie
  **Buying Power / Excess Liquidity IBKR** n'est pas câblée — endpoint
  `api/account-summary/sync.js` **à créer** (priorité). Idem cash / marge BP.
- **Rétention NLV** : `dailySnapshots` est capé **FIFO 60 jours** → l'historique
  du graphe est ≤ 60 j (1Y/ALL montrent ≤ 60 j). Augmenter la rétention.
- **Intraday** : seuls des snapshots quotidiens sont persistés ; un **writer
  intraday** (échantillon NLV en séance) densifiera 5D/1D.

---

## [1.0.0-rc.4] — 2026-07-19

**Brique 1.S « Sidebar v2 »** — direction « Marge vive » (choix
architecte parmi 3 directions au lab, amendée). La navigation
verticale devient un instrument : les entrées portent l'état du
système, pas des raccourcis.

### Ajouté
- **SideNav v2 « Marge vive »** (`SideNav.jsx` réécrit, `v1-shell.css`,
  palier `c3-hires.css`) : témoins d'état **neutres** à droite des
  rangées (jamais une couleur P&L) — Positions = positions ouvertes,
  Historique = trades clôturés du jour (masqués à zéro), point ambre
  Pré-marché pendant la fenêtre pré-marché NY (phase re-évaluée 60 s) ;
  badges perchés sur les icônes en replié.
- **Raccourci ⌘0 → Pré-marché** : extension de carte (⌘1..9 intacts),
  câblé handler + tooltip replié + palette ⌘K + cheatsheet.
- **Marqueur de mode REAL/PAPER/LIVE** relogé dans la StatusBar (près
  du bloc IBKR·FNHB) : registre neutre, réactif au tick 1 s (fin du
  `Date.now()` figé au render).

### Modifié
- Rangées de nav en **vrais liens routeur** (`<Link>`, Ctrl+clic
  nouvel onglet) ; largeur resserrée à 220 px (mesurée) ; groupes
  silencieux (filets sans titres) ; header sans badge REAL ; keycaps
  ⌘x retirés des rangées (raccourcis documentés palette/cheatsheet/
  tooltips) ; nav défilable ; labels unifiés en français.
- **Gardes clavier** : les raccourcis globaux n'agissent plus depuis
  un champ de saisie, et Shift/Alt sont filtrés.
- **Pré-marché désenclavée** (palette, SubNav, BottomNav) ; vérité ⌘9
  (cible /settings/import alignée partout) ; `/settings/api` en nav
  (palette + lien Calendar réparé en `<Link>`) ; « Chain » → « Options
  Live » côté mobile ; défaut sidebar ré-évalué au resize.

### Retiré
- **~340 lignes de CSS morte** : bloc SIDEBAR Aura (`components.css`),
  `.sidebar*` + BOTTOM NAV Aura (`aura-boost.css`), 5 tokens
  `--sidebar-*` (`tokens.css`). Le conflit `.bottom-nav` est résolu en
  faveur de la v6/DS (l'indigo hors design system meurt).
- **Lab `/lab/sidebar`** (route, composant, CSS) — dev-only, purgé.

### Vérifié
- Gates : build · color-law 0 (marqueur de mode neutre au computed
  style) · 233 tests · overflow 48/48 · clavier ⌘0..9/⌘K/⌘//⌘B +
  gardes anti-input/Shift-Alt · a11y · reduced-motion · console
  tolérés seuls · anti-régression bandeau LED Doto 92 px + cockpit 1.C
  en Plex (computed styles).

## [1.0.0-rc.3] — 2026-07-18

**Brique 1.C « Market Deck + Command Deck v2 »** — étage marché FINAL
« D2-FINALE » (choix Rafael aux labs I-VI, amendé : agenda au rail du
temps, futures au rail des entrailles), GO architecte avec correctif
tape LED.

### Ajouté
- **Étage marché D2-FINALE** (`MarketDeck.jsx` réécrit, base
  `v1-dashboard.css`, palier ≥1440 `c3-hires.css`) : double étage fluide
  pleine largeur — 3 colonnes traversantes × 2 rangées (162/1/119),
  hairlines de rails **continues R1→R2**, loi de fluidité (fr/minmax,
  zéro px de largeur totale en dur), harmonisation totale (titres 13 caps
  au même y, anatomies uniques pastille/chip, paddings uniformes).
- **Indices US amplifiés D2×D4** : prix 30, Δ$ 15, courbes intraday
  1d/5m 56 px fluides (interpolation monotone, cap pts×6), jauges
  d'amplitude 8 px, H·L.
- **Volatilité enrichie** : courbe intraday VIX 36 px (série 1d/5m
  dédiée, +5 appels/5 min ratifiés), échelle graduée 10/15/20/27/40
  retracée via ResizeObserver, curseur accent ≥ 20, Δ5J.
- **Agenda héros** au rail du temps : nom 17.5 + J-x 16 (accent ≤ J-2),
  sous-ligne détail·date, 3 rangées serrées colonnes fixes, union
  Finnhub ∪ local (badge LOCAL en fallback), état E designé.
- **FUT · O/N permanents** au rail des entrailles (même batch quotes,
  range O/N conservé en RTH) · **MONDE ×10** (2 rangées × 5, colonnes
  réglées, hairline interne) · **FX & TAUX** (USD/CHF appliqué 23.5 +
  chip mode + EUR/USD·US10Y·DXY, repli fluide déclaré).
- **Tape LED NYSE (1.C.10-bis, ordre architecte)** : police **Doto**
  variable dot-matrix auto-hébergée (fontsource, SIL OFL) sur les textes
  du bandeau (symbole/prix/Δ net) — graisse 850, axe ROND au max,
  tracking +0.03em, phosphore text-shadow 30 % ; pastilles Δ%, flèches,
  sparklines et hauteur strictement inchangées ; anti-jitter prouvé
  (chiffres à largeur uniforme) ; glyphes suisses vérifiés.

### Corrigé
- **`useMarketQuotes` liste vide** : `''.split('|')` créait un poller
  fetchant un ticker vide à chaque train (console « Ticker requis »,
  visible en état vierge uniquement).

### Retiré
- **Labs I-VII purgés** : route `/lab/market`, `MarketLab.jsx` (939 l),
  `lab-market.css` (400 l) — zéro trace au build ; `docs/croquis/`
  conservé en archive de spec.

### Vérifié
- Gates 15/15 : build · color-law 0 · 233 tests · captures 12 pages
  peuplées (`docs/captures/1c-market-deck-final/`) · overflow 48/48 ·
  fluidité 1349/1517/1678/1846 · continuité hairlines au pixel · soudure
  cockpit gap 0 · preuve réseau ~9 min (cadence inchangée, FUT au même
  train, 0 429) · fallback macro réel · état vide 0 NaN · clavier ·
  reduced-motion · a11y · console tolérés seuls.

## [1.0.0-rc.2] — 2026-07-15

**Brique 1.B « Le Shell »** (+ correctifs 1.B.2 « niveau pro » et 1.B.3
« Lab Tape », GO Rafael après calibration au lab). Le site change de
silhouette : navigation verticale, bandeau de marchés bord à bord.

### Ajouté
- **SideNav** (`SideNav.jsx` + `v1-shell.css`) : sidebar 232 px repliable
  64 px (**⌘B**, bouton footer, persisté `qc:sidenav:collapsed`, défauts
  déployée ≥1440 / repliée <1440) ; header logomark QC + wordmark +
  pastille REAL/LIVE (logique de fraîcheur reprise à l'identique) ;
  recherche ⌘K intégrée ; navigation groupée **OVERVIEW** (Dashboard,
  Premarket, Calendar, Options Live) / **TRADING** (Positions, History,
  Greeks*) / **INSIGHTS** (Analytics, Journal) / **SYSTÈME** (Settings) ;
  chips keycap des raccourcis réels ⌘1..9 (mapping inchangé) ; actif =
  barre ambre 2×18 + fond raised ; replié = icônes 20 + tooltips.
- **Grille AppShell 3 rangées** (100dvh) : TickerTape pleine largeur ·
  SideNav + main (seul scrollable) · StatusBar. Mobile <768 :
  SubNav/BottomNav intacts, pas de SideNav.
- **Flash au tick** (`usePriceFlash` + `.tape-flash`) : aplat color-mix
  10 % up/down 600 ms + pulse de luminosité du prix, au rythme réel des
  quotes ; coupé sous prefers-reduced-motion.

### Modifié
- **TickerTape « Salle des marchés »** — **barème calibré au lab
  comparatif /lab/tape (variante retenue : D)** : 92 px ≥1440 (48 px
  base), SYMBOLE 19 caps au-dessus du PRIX 36 IBM Plex Sans Condensed
  700 tabulaire, **pastilles Δ% désaturées** (color-mix 16 %, radius 4)
  au-dessus du **Δ net en $** (dérivé du payload quotes, aucun appel
  nouveau), sparklines 84×46 stroke 1 aire ≤8 %, padding 34, fondus aux
  deux bords, pause au survol, hover cellule +2 %. 19 instruments et
  ordre inchangés. **Lab /lab/tape purgé** après le choix.
- Renommage **« Chain » → « Options Live »** (sidebar, CommandPalette,
  CheatsheetModal) — route `/trading/chain` et fichiers inchangés.
- CheatsheetModal : ligne « ⌘B — replier/déployer la navigation ».
- 12 pages adaptées à la nouvelle largeur de contenu (CommandDeck
  retuné : fractions + duo dégradable, tailles S2 fixes).

### Retiré
- **CommandBar** (composant + tous ses blocs CSS + `--shell-cmdbar-h`) —
  logomark, badge REAL/LIVE et ⌘/ migrés dans la SideNav.
- **Halo radial violacé** (capture Rafael /positions) : `body::before`
  d'aura-boost (4 dégradés d'ambiance mix-blend screen, dont violet à
  48 % 88 %) supprimé, variante daylight incluse. Grain conservé.
- Badge « glow » des mouvements forts du tape — remplacé par la pastille
  Δ% systématique.

## [1.0.0-rc.1] — 2026-07-15

**Ouverture de l'ère produit v1.0** (brique 1.A « Fondation Obsidienne + Ligne
de commandement », GO Rafael). Baseline effective **1254a34** (= `ea64652` +
2 commits docs de cartographie, vérifiés docs-only). Lancement visé : 01.09.2026.

### Ajouté
- **Fondation matière Obsidienne** (`canonical.css`) : tokens
  `--hairline-rest` (.06) / `--hairline-hover` (.10) / `--chart-grid` (.04),
  `--line-hairline` re-pointé sur `--hairline-rest` ; plans de profondeur
  re-valués plus sombres (base `#09090A`, raised `#0C0C0E`, focus `#121216`,
  void inchangé) ; recette panneau **`.obs-panel`** (verre noir, hairline,
  lumière de tranche, hover 120 ms, zéro scale sur les surfaces de données).
- **Infra charts Obsidienne** : `src/components/charts/obsidienne.js` (OBS —
  trait 1.5 arrondi, palette midnight, ticks 14 Plex tabulaires, curseur
  pointillé ; `obsAreaGradientStops` 12 %→0 ; `useMountOnlyAnimation`),
  `ObsidienneTooltip.jsx` (LE tooltip unique — verre `rgba(10,10,12,.85)`,
  blur 12, hairline, radius 8 ; API `formatLabel`/`formatValue` + mapper
  `rows`), `src/styles/obsidienne-charts.css` (tooltip, dot/pulse LIVE
  anneau ambre 2 s, reduced-motion).
- **Ligne de commandement** (`CommandDeck.jsx` + `v1-dashboard.css` + palier
  ≥1440 dans `c3-hires.css`) : UN panneau continu `.obs-panel`, 6 zones sur
  hairlines verticales — NET LIQ 56 px + indicateur du vivant
  (LIVE/SESSION/CLOSED) · DAY P&L · UNREALIZED · REALIZED + MTD · EXPOSURE +
  jauge engagé/NLV (repère 70 %, caption ambre au-delà) · WIN RATE · PROFIT
  FACTOR (« — » + « n < 10 » sous l'échantillon). Ligne de base partagée
  (subgrid), micro-mouvement 180 ms sur valeurs live, état vide robuste.

### Modifié
- **EquityChart / DailyPnLChart** (retrofit props uniquement) : tooltip unique
  Obsidienne, curseur `OBS.cursor`, grille hairlines horizontales seules,
  ticks `OBS.tick` — lignes CUMUL + DAILY Δ conservées (P&L réalisé, couleur
  signée autorisée). Recomposition des charts réservée aux briques 1.D/1.E.

### Retiré
- **DashboardKPICards** (7 cartes KPI, ~2 740 lignes) — remplacé par la Ligne
  de commandement ; données re-logées ou différées avec maison nommée (matrice
  de non-perte au rapport de brique). `Sparkline.jsx` (orphelin) supprimé,
  `PositionSparkline` conservé (LivePositions).
- **AmbientBackground** (orbes radiaux) + son CSS (`.app-ambient-bg`,
  keyframes `orb-float`) + tokens `--orb-blue`/`--orb-violet` — le fond de
  l'app est porté par `html/body` (void).

## [2.3.1] — 2026-07-13

**Clôture du projet** (décision propriétaire). Version finale. Chantiers D3
« Obsidienne » / Dashboard 3.0 et D4→D7 annulés. Mode maintenance : correctifs
ponctuels sur demande explicite uniquement.

### Retiré
- **Toutes les branches de chantier** (locales et distantes, mergées ou non,
  `feat/d3a-obsidienne` incluse) — il ne reste que `main`.
- **Labs dev-only** `src/pages/lab/` (TypoLab D1, ScaleLab D2.F + CSS), leurs
  routes `/lab/typo` · `/lab/scale` et lazy imports DEV dans `App.jsx` — mission
  accomplie (typo et échelle calibrées et déployées).
- **3 polices candidates D1 non retenues** (`@fontsource-variable/martian-mono`,
  `space-grotesk`, `inter-tight`) — utilisées uniquement par le lab.
- **Scripts orphelins** `scripts/subset_iosevka*.py` + `verify_subset.py`
  (recette des subsets Iosevka supprimés en D1.2).
- **Captures historiques** `docs/captures/*` — remplacées par un jeu final
  unique `docs/captures/final/` (12 pages @1591×900, DPR 1.35, seedées).

### Modifié
- **Documentation de clôture** : `CLAUDE.md` §6 (état final + mode maintenance),
  `ROADMAP.md` (historique livré, projet clos). Les règles permanentes restent
  en vigueur (loi de couleur, interdits git, viewport 1591, vérification
  visuelle, gates build/color-law).

## [2.3.0] — 2026-07

Phase **D2 — Densité terminal + calibration d'échelle (D2.A→F)**. Le palier ≥1440
passe en chrome « terminal » dense (paddings amincis, headers fins, radius ≤6px),
puis l'échelle de texte est **calibrée avec Rafael** au lab `/lab/scale` : cran
**S2 (×1.30)** retenu et appliqué à tout le système. La densité vient de
l'éradication du chrome mort, jamais de la petitesse du texte. Chapitre densité
**clos**. Mobile <1440 strictement intact.

### Ajouté
- **Route `/lab/scale`** (dev-only, même pattern que `/lab/typo`) — 4 blocs empilés
  @1591 (S0 témoin · S1 ×1.15 · S2 ×1.30 · S3 ×1.45), composite réaliste par bloc
  (strip marchés, carte KPI, module-header + extrait `.v3-table`). Données statiques,
  zéro accès store. Seuls texte et hauteurs de ligne varient, le chrome D2 est fixe.
- **Wrapper grille 2 colonnes Premarket** (D2.D) : Macro | Earnings côte à côte,
  Positions/Gates + Routine pleine largeur, checklist sur 2 colonnes — zéro
  demi-écran mort @1591.
- **États vides inline partagés** (D2.B) + plafond radius 6px sur les primitives.

### Modifié
- **Échelle S2 (×1.30, arrondis px entiers)** sur `c3-hires.css` : plancher caption
  13 → **17** ; tokens intermédiaires scalés (`--fs-md` 17, `--fs-lg` 18, `--fs-xl` 21,
  `--fs-2xl` 23, `--type-body` 18, `--type-title` 21, `--type-cell-value` 21) ;
  `--type-display` 34 → **44** (+ Win Rate 44) ; cellules `.v3-table` 15 → **20**
  (rowHeight DataTable 36 → **47**, ratio 2.35, cohérent Positions ↔ History) ;
  strip marchés 16/21/18 ; statusbar 18/17 ; nav 20 ; stats de pied 21 ;
  module-header 28 → 36 (titre 18, variantes LP/Sniper 20/16).
- **Charts Recharts** : ticks d'axes + légendes **plafonnés à 14** (data-viz ≠ texte
  de lecture). Héros NLV/REALIZED (`--type-hero` 56/64) **intouchés**.
- **Chrome dense D2.A** : padding cartes ~20 → 14, headers de panneau 6/6,
  `page-container` gap 10, labels fonctionnels ink-soft, cellules strip resserrées.
- Accommodations mesurées au runtime : pills Premarket h24, badge sniper Chain lh 1,
  thead sticky Chain recalé top 42.

### Vérification
- 12 pages @1591×900 DPR 1.35 midnight peuplées (`docs/captures/d2f/`) :
  **0 overflow-x @1591 ET @1920** (contrôle programmatique, Chain peuplée incluse),
  tailles S2 confirmées au pixel via `getComputedStyle`, tri/survol exercés,
  `check:color-law` = 0, build vert, console = tolérés uniquement.

---

## [2.2.0] — 2026-07

Phase **D1.2 — Déploiement typo « C »**. IBM Plex Sans Condensed (candidate retenue
par Rafael au lab `/lab/typo`) devient la police de **tous les chiffres** de l'app,
avec l'anatomie du chiffre financier, et le petit texte remonte d'échelle au palier
≥1440. La condensation (~10 % plus étroite) finance la montée en taille sans perte de
densité horizontale.

### Ajouté
- **`--qc-font-num`** (canonical.css) = `'IBM Plex Sans Condensed'` + fallbacks ;
  import runtime global (graisses 600 + 700). `--qc-font-mono` et `--qc-font-hero`
  deviennent des **alias** → tous les chiffres + les 2 héros basculent en une source.
- **`NumAnat`** (`src/components/ui/NumAnat.jsx`) — composant partagé d'anatomie du
  chiffre : `$` et séparateurs de milliers en retrait (tiers display 58 % / mid 70 % /
  dense = brut). Appliqué aux héros + cartes KPI Dashboard + tuiles Greeks. Loi de
  couleur respectée (greeks neutres ; `$`/séparateurs suivent la teinte P&L).
- **`--qc-font-code`** (Geist Mono) + classe `.mono-code` — vraie chasse fixe pour les
  usages non numériques (nom de fichier `.env` / CSV importé).

### Modifié
- **Volet 2 — remontée d'échelle du petit texte** (`c3-hires.css`, palier ≥1440,
  mobile <1440 intact) : cellules `.v3-table` 13 → 14 + chiffres wght 600 ; microlabels
  (`.v3-table__th`, `.uppercase-label`) wght 600 ; lignes secondaires KPI
  (`.dash-kpi-card__chf`, `__pill`) +1px → 14, wght 600 ; `rowHeight` DataTable 34 → 36.

### Retiré
- **@font-face Iosevka QC + Iosevka QC Hero** (orphelins après le repoint) + woff2
  self-hosted (`public/fonts/iosevka*`, **−44 Ko**). Geist Mono conservé (`--qc-font-code`).

### Vérification
- 12 pages @1591×900 DPR 1.35 midnight peuplées : **0 overflow-x** (contrôle
  programmatique) incl. après tri/survol ; greeks neutres ; `check:color-law` = 0 ;
  build vert. Code-split du lab `/lab/typo` (D1) intact.

---

## [2.1.2] — 2026-07

Phase **D1 — Lab typographique héros**. Outil de décision DEV-ONLY : compare, à
conditions strictement égales, la typo actuelle des gros montants (TÉMOIN) contre
4 candidates, sur des clones réalistes des composants Dashboard. **Aucune page
réelle, aucun style global, aucune police existante n'est modifié.**

### Ajouté
- **Route `/lab/typo`** (dev-only) — enregistrée uniquement si `import.meta.env.DEV`,
  hors AppShell, sans entrée de nav. 5 blocs comparables @1591 (TÉMOIN · A · B · C · D),
  chacun à 4 échelles : héros NLV 56px, héros REALIZED, ligne KPI 26px, table dense 13px.
  Données **statiques codées en dur** (aucun accès store/localStorage).
- **Anatomie du chiffre** (candidates A-D uniquement) : `tabular-nums slashed-zero`,
  devise `$` à 58 % (ink-soft, alignée cap-height), séparateurs `'` ink-mute,
  letter-spacing légèrement négatif, line-height 1. Loi de couleur respectée au lab :
  greeks (Δ/Θ) neutres, P&L vert/rouge.
- **4 dépendances de police** (autorisées par l'architecte), importées **uniquement**
  dans le module lazy du lab (code-split) : `@fontsource-variable/martian-mono`,
  `@fontsource-variable/inter-tight`, `@fontsource-variable/space-grotesk`,
  `@fontsource/ibm-plex-sans-condensed`. **Build vérifié : zéro police candidate et
  zéro chunk lab dans le bundle des pages réelles.**

### Corrigé
- **`scripts/visual-audit.mjs`** port-tolérant : sonde 5173 puis 5174 (Vite bascule
  quand 5173 est pris), `AUDIT_BASE_URL` force une URL. `CLAUDE.md §7` mis à jour.

---

## [2.1.1] — 2026-07

Phase **D0 — Fondation** (avant la refonte design D1) : constitution, mise en
conformité de la loi de couleur, outillage de contrôle. Aucune refonte design.

### Ajouté
- **`CLAUDE.md`** réécrit — constitution permanente en 9 sections (identité produit,
  utilisateur, rôles & workflow, autonomie git + interdits, stack & conventions,
  design system + loi de couleur + Phase D, doctrine de vérification visuelle,
  sémantique financière, rituels de fin de brique).
- **`npm run check:color-law`** — contrôle statique (pas un test) : signale tout Greek
  coloré via une classe/token de P&L (rouge/vert). Exit ≠ 0 si violation.
- **`npm run audit:visual`** — capture Playwright des 12 pages à 1591×900, DPR 1.35,
  thème midnight, avec seed reproductible → `docs/captures/audit-AAAAMMJJ/`.

### Corrigé
- **Loi de couleur** : toutes les valeurs de Greeks (delta / gamma / theta / vega)
  sont désormais neutres partout — RiskMatrix (Σ DELTA/VEGA), LivePositions (colonne
  Delta, Σ Delta, Σ Δ$), Chain (delta/theta), ThetaDecayProjection (neutralisé à la
  source). Le rouge/vert reste réservé aux pertes/gains d'argent RÉELS.
- **Carte EXPOSURE** (Dashboard) : badge « NOTIONAL » (faux — le notionnel serait
  strike×100×contrats) → « DÉPLOYÉ » + tooltip « Coût des primes engagées · hors P&L
  latent ». Le chiffre (capital déployé) est inchangé.

### Interne
- Dépendance dev `playwright` (script d'audit visuel). Captures `c3-*` déplacées de la
  racine vers `docs/captures/c3/`. `.gitignore` : runs `audit:visual` régénérables
  ignorés, `.tmp.drivedownload/` ajouté.

---

## [2.1.0] — 2026-07

Phase **C.3.0 — « Zoom 4K @ 90 % » / densification 1591**. Palier haute-résolution
(`src/styles/c3-hires.css`, `@media (min-width: 1440px)`) : lisibilité et densité
d'information sur écran fenêtré ~1591 px CSS (dpr 1.35) sans scale-up ni migration
rem/clamp. Mobile <1440 **strictement intact**. Séquence page-par-page (Positions →
History → Greeks → Calendar → PreMarket → Import → Settings → Analytics/Journal → Chain),
un commit atomique par page, vérification visuelle @1591.

### Modifié
- **Plancher typo 13 homogène** sur les 12 pages : tous les résidus sous-13 (labels
  8-12 px, ticks/légendes Recharts, badges, cellules de tables) remontés à
  `--type-caption` (13 px), scopés par page. Colonnes et gaps tenus ou resserrés,
  jamais relâchés.
- **Ticks/légendes Recharts** floorés par page (la règle palier `.dash-shell` ne les
  atteignait pas) : Greeks, Analytics, HistoryDistribution.
- **Loi de couleur — theta neutre** : sur Greeks (carte KPI, projection 30 j, colonne Θ,
  courbe/chip) puis **cross-page** Dashboard (RiskMatrix Σ THETA, LivePositions colonne/
  sub-header/footer) et Positions (KPI Theta total, colonne Θ). Un Greek signé n'est pas
  une perte : le rouge reste réservé aux pertes/coûts **réels en $**.
- **Vides tués** : form QueryID/Token capé (Import), gouffre label↔contrôle résorbé en
  layout 2 colonnes (Settings, toutes sections), colonne Tag rééquilibrée en `fr`
  (StrategyBreakdown / Analytics), cellule géante Futures alignée sur la grille regime
  (PreMarket).
- **Thead sticky** sur la chaîne d'options (`/trading/chain`) : les 2 rangs d'en-tête
  (CALLS/STRIKE/PUTS + colonnes greeks) restent visibles au scroll, fonds opaques.

### Retiré
- Affordance morte `KpiTile tone="loss"` (Greeks) après passage du theta en neutre
  (param + 8 appelants + règle CSS `.is-loss`).

### Vérification
- Chaque page vérifiée visuellement @1591 (Playwright isolé, données démo éphémères,
  portefeuille réel intact) : **0 overflow horizontal, 0 chevauchement, 0 régression
  console** (500 finnhub + `width(-1)` Recharts pré-existants tolérés).

---

## [2.0.0] — 2026-06

Palier « V1 finale » du produit : l'app est complète, mergée et en production sur
Vercel. Point de référence figé (tag `v2.0.0`).

### Ajouté
- **Dashboard v6** en grille bento (12×5) : KPI cards, sparklines, mini-calendrier 7j,
  watchlist live, feed d'alertes dérivé.
- **PreMarket Briefing** : macro du jour, earnings BMO/AMC, DXY + futures overnight
  (ES/NQ/YM), régime VIX/SPX.
- **Intégration IBKR Live** : pont local 2 processus (read-only, paper), cascade NLV
  3 tiers (bridge live → Flex cashReport → reconstruction), badge LIVE, toggle
  `gwAutoConnect`. Les utilisateurs sans pont voient zéro changement de comportement.
- **Greeks center** (gated `FEATURE_GREEK_CENTER`) : table Greeks par position,
  agrégats Δ/Γ/θ/ν.
- **Positions / History** : deep-link `?focus`, panneau détail, actions Clôturer/Éditer,
  export CSV.
- Collecte d'IV historique locale (sans affichage, en préparation d'un enrichissement
  futur).

### Modifié
- **Loi de couleur appliquée partout** : badges CALL/PUT/STK neutralisés (encre douce),
  rouge/vert réservés à l'argent réel. Migration des chromes legacy vers la palette
  canonique flat.
- **Système de tokens** « Brutalisme Financier » : `canonical.css` comme source unique,
  convergence des valeurs en dur vers les tokens, thèmes réduits à `midnight`/`daylight`
  (WCAG AA).
- Headers de tables sticky avec fond flou ; halo du dot live restreint à l'état réel.

### Retiré
- Dette CSS morte et commentaires caducs.
- Composants/hooks morts : VolatilitySkew, MarketInternals, SniperGateMonitor,
  TradeHistoryPlaceholder, useVolSkew, useMarketInternals, HourChart « P&L par heure ».
- Boutons et placeholders non câblés.

### Tests
- Couverture Vitest stabilisée : **25 fichiers, 233 tests, 532 assertions** (Black-Scholes,
  métriques de performance, parsing IBKR, agrégats Greeks, FX).

---

## Historique antérieur

- **1.x — 2026-03** — Migration du tracker vanilla vers **React 19 + Vite** en une
  semaine, puis passage à l'infrastructure **Vercel serverless** (autonomie complète en
  ~2 mois).
- **0.x — origine** — Tracker initial en **HTML/JS vanilla** (~2 178 lignes) hébergé sur
  Netlify.
