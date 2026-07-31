# Roadmap — Phase finale v1.0

**Phase finale v1.0 OUVERTE** (15.07.2026, verdict architecte + GO Rafael).
Ligne de base : **v2.3.1** (`ea64652` ; baseline effective `1254a34`).
Objectif : **tag v1.0.0 au 01.09.2026**.

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

- **2.A** — Tables (Positions · History).
- **2.B** — Analytiques (Greeks · Analytics · Insights).
- **2.C** — Workflow (Chain · PreMarket · Calendar · Journal).
- **2.D** — Utilitaires (Import · Settings · API).

## Étape 3 — Cohérence & modales

Chrome traité en 1.B ; reste : cohérence transverse + modales.

## Étape 4 — Recette v1.0

Recette complète → **tag v1.0.0 (01.09.2026)**.

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
