# BRIQUE M0 — Audit responsive mobile

**Date :** 2026-06-11 · **Aucune modification du code applicatif.**

## Méthodologie

- **Environnement :** conteneur cloud isolé et éphémère (Claude Code on the web). Aucun profil
  navigateur utilisateur n'existe dans cet environnement — chaque contexte Chromium Playwright
  part d'un `localStorage` vierge en mémoire et disparaît à la fermeture (équivalent strict du
  profil `--isolated` exigé par CLAUDE.md). Les clés réelles `ibkr_u_*` n'ont jamais été lues
  ni écrites en dehors de ces contextes jetables.
- **Seed :** injection de `fixtures/audit-data.json` (jeu de démo : 7 positions ouvertes,
  28 trades fermés sur 7 mois, 6 cash flows CHF/USD, 8 entrées journal, 91 snapshots d'équité)
  via la fonction **Restaurer un backup JSON** de `/settings/import`, dans chaque contexte isolé.
  Vérifié avant audit : toast « Backup JSON restauré », clés `ibkr_u_o`/`ibkr_u_c` peuplées,
  Dashboard rendant des tickers réels (pas d'empty state).
- **Viewports :** 390×844 (iPhone 14/15) et 414×896 (iPhone 11/XR), `isMobile`, `hasTouch`,
  `pointer: coarse`, UA iOS Safari, `prefers-reduced-motion: reduce` (stabilité des captures —
  ne change pas le layout final).
- **Flag :** dev server lancé avec `VITE_FEATURE_GREEK_CENTER=true` pour auditer `/trading/greeks`.
- **Captures :** le scroll se fait dans `#main-content` (pas le body) → `fullPage` est inopérant ;
  chaque page est capturée en **segments** (`--p1`, `--p2`, …) en défilant le conteneur interne.
  89 captures dans `docs/audit-mobile/`.
- **Relevés automatiques par page :** overflow horizontal (body + `#main-content` + fautifs),
  conteneurs h-scrollables, textes < 11px, cibles tactiles < 44px (et < 32px), présence
  CommandBar / SubNav / BottomNav, erreurs console.

### Limites de l'audit

- **Réseau externe coupé** (déterminisme + isolation) : Yahoo/Frankfurter/Finnhub indisponibles.
  Les erreurs console `ERR_FAILED` / 429 / 500 / 502 relevées sur toutes les pages viennent de là
  et des routes `/api/*` (fonctions Vercel non servies par Vite en dev) — **artefacts
  d'environnement, pas des bugs UI**. Aucune autre erreur JS n'est apparue, à une exception près
  (voir CommandPalette).
- **Chain** n'a pu être auditée qu'en empty state (la chaîne d'options se charge via API externe).
- Interactions profondes (drag, modals d'édition, toasts longs) non exercées — audit statique
  page par page + CommandPalette + sheet « Plus ».

---

## Tableau récapitulatif

Les deux viewports donnent des métriques quasi identiques ; les sévérités valent pour les deux.

| Page | Sévérité | Constat principal |
|---|---|---|
| Dashboard | **BLOQUANT** | Grille de modules écrasée : Live Positions rendu à **2px de large**, ~3 000px de vide ; cartes KPI compressées/illisibles |
| PreMarket | **MAJEUR** | Horloges du cockpit superposées (texte illisible) ; page entière à 434px → scroll horizontal |
| Positions | **OK** | Vraie mise en page mobile (cartes) — référence à suivre |
| History | **MINEUR** | Cartes mobiles propres ; 276 textes < 11px (labels Entry/Exit/Qty à 10px) |
| Chain | **OK*** | Empty state propre ; input ticker 22px de haut ; *chaîne chargée non testable hors ligne |
| Greeks | **MINEUR** | KPIs empilés + graphe + table OK ; labels theta-decay 9px |
| Analytics | **MAJEUR** | Heatmap P&L annuelle inutilisable : 365 cellules de **12px** de large, mois superposés |
| Calendar | **MINEUR** | Grille mensuelle et liste propres ; lien « Réglages → API » 80×14px ; jours 9px |
| Journal | **MINEUR** | Entrées propres ; filtres mood mal wrappés (« EuphoriqueRevenge » collés) |
| Settings General | **MINEUR** | Formulaires propres ; overflow 18px (ligne mono tier + StatusBar) ; selects 34px |
| Settings Import | **OK** | Rien à signaler |
| Settings API | **MINEUR** | Propre mais dense, ~60 textes 9–10px |
| CommandPalette (⌘K) | **OK** | Modal 358×416 bien insérée à 390px ; warning React clés dupliquées |
| Navigation (BottomNav/SubNav/sheet) | **OK** | Infra mobile déjà en place et fonctionnelle ; labels onglets 9px |

**Synthèse :** l'app a déjà une vraie infra mobile (BottomNav + sheet « Plus », SubNav par section,
`responsive.css` avec règle `pointer: coarse` qui force min 44px sur les boutons, breakpoint
767px dans l'AppShell). Les pages refondues récemment (Positions, History, Greeks, Journal,
Calendar, Settings) passent bien. **Deux chantiers concentrent l'essentiel du travail M1 :
le Dashboard (bloquant) et PreMarket (majeur), plus la heatmap d'Analytics.**

---

## Détail par page

Captures : `docs/audit-mobile/<slug>--<viewport>--p<n>.png` pour chaque page aux deux viewports.

### 1. Dashboard — BLOQUANT

Captures `dashboard--390x844--p1..p6.png`, `dashboard--414x896--p1..p6.png`.

- **p1–p2 (hero) : OK.** NLV $34'077, P&L cumulé, win rate, série de 18 trades, sparklines —
  tout est lisible et bien empilé.
- **p3 : cassé.** La rangée de cartes KPI (`dash-kpi-card`) est forcée en ~5 colonnes à 390px :
  textes tronqués (« DEPLOYA », « NOTIONA », « $2… », « +$… »), chiffres superposés au bord des
  cartes (« 71.4 » chevauche la carte voisine).
- **p4–p6 : écrans entièrement vides.** La grille `dash-grid` (2 997px de haut) garde son template
  desktop : mesure DOM à l'appui, le module `live-pos` est rendu à **w=2px** (body w=0), son
  header à 28px. L'utilisateur scrolle ~2 500px de noir total entre les KPI et le module Calendar
  (visible en p6). C'est la cause de l'overflow 25px relevé (`live-pos__ctx` à right=457,
  `trade-history__ctx` à right=487 — contenus poussés hors écran).
- Textes 8px nombreux dans les modules concernés (`CALL` pills, boutons `Tag`, gate pills
  `DTE45 25d`) — à retraiter avec la refonte de la grille.
- Vérifié identique à 414×896 (`dashboard--414x896--p3.png` : même compression + même vide).

### 2. PreMarket — MAJEUR

Captures `premarket--390x844--p1.png`, `premarket--414x896--p1.png`.

- Le bandeau d'horloges (`CET · Genève / NY / Phase US / Prochaine bascule / Routine`, labels 9px)
  superpose ses valeurs : « 01:51:1 » chevauche « 9:51:1 », « AFTER » et « CLOSED Dans 60 »
  se télescopent. Illisible aux deux viewports.
- La page entière mesure 434px de large dans une box de 390px (`div.premarket-page`,
  overflow-x auto) → tout le cockpit se parcourt en scroll horizontal, y compris la table
  POSITIONS REVIEW (colonnes TICKER/STAT/STRIKE/STE/UNREAL/GATE/STATUS compressées, badge
  « ARMÉ » coupé au bord droit).
- La checklist « Routine pré-marché » en dessous est propre.

### 3. Positions — OK

Captures `positions--390x844--p1..p3.png`.

- La meilleure page mobile de l'app : KPIs en 2 colonnes (Positions, Delta net, Theta, Capital
  engagé, Max loss), positions en **cartes** (ticker + pill CALL, P&L, Entry/Mark/Qty/Strike,
  badges DTE/TIME/OK), SubNav de section en haut. Aucun overflow.
- Seuls points : input de recherche 19px de haut (cible tactile), labels de cartes 10px.

### 4. History — MINEUR

Captures `history--390x844--p1..p6.png`.

- Même pattern cartes que Positions : KPI grid (Total, Net P&L, Win rate, Avg R, Best, Worst),
  filtres Tous/Gagnants/Perdants + Tous/Options/Actions, switch de vue, Export CSV. Propre sur
  les 28 trades, page de 5 358px bien scrollable.
- 276 textes < 11px : labels `Entry $6.50` / `Exit $9.20` / `Qty` / `Hold 7j` à 10px sur chaque
  carte, badges 10px. Dense mais lisible — à passer à 11–12px lors d'un polish.
- Input recherche 19px de haut (même cible que Positions).

### 5. Chain — OK (sous réserve)

Captures `chain--390x844--p1.png`, `chain--414x896--p1.png`.

- Empty state propre et centré (« Aucune chaîne chargée »), input + bouton CHARGER alignés.
  Input 22px de haut (cible tactile faible). La bande orange en bas de capture est le glow de
  l'`AmbientBackground` visible par transparence (page courte) — cosmétique, pas un défaut.
- **Réserve :** la chaîne chargée (matrice strikes × expiries, très dense par nature) n'a pas pu
  être rendue hors ligne. À auditer en M1 avec données — risque élevé de tableau cassé à 390px.

### 6. Greeks — MINEUR

Captures `greeks--390x844--p1..p4.png` (flag `FEATURE_GREEK_CENTER` actif).

- KPIs Δ/Γ/Θ/ν empilés pleine largeur, graphe Évolution 30j rendu correctement avec légende en
  pills, projection theta 30j + bar chart, table « Greeks par position » (Ticker/Type/Δ/Γ/Θ) qui
  tient dans 390px, gauge Vega. Aucun overflow.
- Labels axe theta-decay (`J+1`…`J+30`) à 9px.

### 7. Analytics — MAJEUR

Captures `analytics--390x844--p1..p4.png`.

- Cartes de ratios (Expectancy, Calmar, Profit factor, Win rate, Omega, Kelly…) en 2 colonnes :
  propres. Charts P&L par heure / par jour de semaine : OK. Donut gagnants/perdants : OK.
- **Heatmap P&L annuelle inutilisable** (`analytics--390x844--p4.png`) : la vue « année » rend
  365 cellules-boutons `pnl-calendar__year-cell` de **12×44px** (365 cibles < 32px relevées,
  intappables), labels de mois fusionnés (« Janv.Févr.Mars… »), wrapper en h-scroll
  (759px de contenu dans 364px). Aucune couleur P&L discernable à cette densité.
- Table « Breakdown par stratégie » : colonne NET tronquée au bord (« +$6… »).

### 8. Calendar — MINEUR

Captures `calendar--390x844--p1..p3.png`.

- Grille mensuelle Juin 2026 propre (jour courant surligné, dots P&L), onglets
  Annonces / P&L Jour / Année, liste « Prochains événements » dense mais lisible
  (badges MACRO/EXP + tickers + échéances).
- Lien « Réglages → API » dans le bandeau Finnhub : **80×14px**, cible tactile la plus faible
  relevée hors Analytics. En-têtes de jours (L M M J V S D) à 9px.

### 9. Journal — MINEUR

Captures `journal--390x844--p1..p4.png`.

- Tilt Meter 14j + entrées en cartes (ticker, date, mood badge, étoiles 44×44 grâce à
  `pointer: coarse`, note) : propre.
- La rangée de filtres mood wrappe mal : « Euphorique » et « Revenge » se collent sans
  espacement sur la 2ᵉ ligne (`journal--390x844--p1.png`).

### 10. Settings General — MINEUR

Captures `settings-general--390x844--p1..p6.png`.

- Longue page (4 460px) entièrement propre : Profil, Localisation, mode daltonien, Mode de
  trading, Gestion du risque, Stratégie Sniper, Connexions API (réutilise la vue de /settings/api),
  Données.
- Overflow horizontal de 18px : la ligne mono « → TIER A · E0×C1 · cash floor 30% · notional
  max 70% » dépasse, et les cellules de la StatusBar (`statusbar__pnl` right=435,
  `statusbar__theme` right=499) débordent — masquées derrière la BottomNav sur mobile mais
  présentes dans le DOM.
- Selects (tier E×C, type de mouvement) à 34px de haut, sous les 44px cibles.

### 11. Settings Import — OK

Captures `settings-import--390x844--p1..p2.png`.

- Page la plus simple : panneau Flex Query (QueryID/Token + Synchroniser), dropzone CSV,
  Export/Restore JSON. Tout passe à 390px sans défaut notable. (C'est la page utilisée pour le
  seed de cet audit.)

### 12. Settings API — MINEUR

Captures `settings-api--390x844--p1..p4.png`.

- Les 8 cartes service (IBKR Live, Flex Query, Yahoo, Finnhub, Frankfurter, Vercel,
  localStorage…) s'empilent correctement avec badges d'état. Les statuts INDISPONIBLE/KO
  affichés viennent du réseau coupé de l'environnement d'audit.
- Densité : ~60 textes à 9–10px (labels DERNIÈRE VÉRIFICATION / LATENCE, messages d'erreur).

### CommandBar, CommandPalette, navigation — OK

Captures `commandpalette--390x844.png`, `commandpalette--414x896.png`,
`bottomnav-more--390x844.png`, `bottomnav-more--414x896.png`.

- **CommandBar (header)** : présente sur toutes les pages, logo + loupe + badge REAL ; les pills
  de nav desktop sont masquées sur mobile au profit de la SubNav — correct.
- **CommandPalette (⌘K / loupe)** : s'ouvre bien, modal 358×416 à x=16/y=140 (390px) — dans le
  viewport, actions rapides + navigation avec raccourcis. Rows ~36px (acceptable).
  **Warning React relevé à l'ouverture : « Encountered two children with the same key »**
  (clés dupliquées dans la liste) — seul vrai warning applicatif de tout l'audit.
- **BottomNav** : 5 onglets (Tableau, Positions, Greeks, Calendrier, Plus), labels 9px ;
  la sheet « Plus » (7 raccourcis en grille, backdrop blur) est impeccable aux deux viewports.
- **SubNav** : onglets de section (ex. Positions/Historique/Greeks/Chain) rendus sur toutes les
  pages de trading/insights — fonctionnel.
- **TickerTape** : marquee 4 560px dans un viewport scrollable — défilement par design, pas un
  overflow fautif.
- **StatusBar** : sur mobile elle est recouverte par la BottomNav et ses cellules débordent du
  DOM (contribue aux 18–25px d'overflow relevés çà et là) — à masquer proprement en M1.

---

## Priorités proposées pour M1 (aucune action dans cette brique)

1. **Dashboard** : passer `dash-grid` en colonne unique ≤ 767px (modules empilés pleine largeur)
   et stacker les cartes KPI — c'est le seul BLOQUANT, tout le reste de l'app est déjà praticable.
2. **PreMarket** : refondre le bandeau horloges en grille wrap + laisser la table POSITIONS
   REVIEW en h-scroll assumé (pattern déjà utilisé ailleurs).
3. **Analytics** : sur mobile, remplacer la vue « année » de la heatmap par la vue « mois »
   (déjà existante via le toggle Mois) ou agréger par mois.
4. Polish groupé : tailles de texte 8–10px → ≥ 11px (cartes History, pills Dashboard, labels
   BottomNav), cibles < 44px (inputs de recherche, lien Calendar → API, selects Settings),
   wrap des filtres mood du Journal, masquage StatusBar mobile, clés dupliquées CommandPalette.
5. **Chain avec données réelles** : à auditer dès qu'un environnement avec accès Yahoo est
   disponible.
