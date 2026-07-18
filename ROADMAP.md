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
- **1.S — Sidebar v2** (insertion actée — prompt architecte à venir).
- **1.D — Héros 1** : Equity/NLV pleine largeur, chart de trading détaillé
  (crosshair, périodes, toggle équité/drawdown, marqueurs de trades sur la
  courbe, pied de stats dense).
- **1.E — Héros 2** : Realized pleine largeur (cumulé/quotidien/distribution)
  + consolidation des doublons avec matrice de non-perte.
- **1.F — Bande décision** (ATTENTION/FORME/CAPITAL) + micro-mouvement +
  polissage — clôt le Dashboard.

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
