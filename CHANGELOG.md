# Changelog

Toutes les évolutions notables de QuantumCall.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/), versionnage
[SemVer](https://semver.org/).

---

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
