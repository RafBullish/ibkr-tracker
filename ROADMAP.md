# Roadmap

Direction du code après le palier `2.0.0`. Vivant : se met à jour au fil des paliers.

---

## En cours — Phase D « Design »

- **D0 — Fondation** *(livrée, 2.1.1)* : réécriture de `CLAUDE.md` (constitution),
  sweep loi de couleur (Greeks toujours neutres), fix du label de la carte EXPOSURE
  (NOTIONAL → DÉPLOYÉ), scripts `check:color-law` + `audit:visual`. **Aucune** refonte
  design.
- **D1 — Direction visuelle** *(à venir, cadré par l'architecte)* : refonte
  typographique, direction **« Bloomberg-dense × moderne (TradingView / SaaS pro) »**.

## Historique — V2

- **Refonte densité / 4K** : phases B → C.2 **et C.3.0 (« zoom 4K @ 90 % » /
  densification 1591) livrées**. Plancher typo 13 homogène sur les 12 pages, résidus
  « vide » tués (Import, Settings, StrategyBreakdown, PreMarket), thead sticky sur la
  chaîne d'options, loi de couleur theta neutralisée cross-page. Lisibilité et densité
  sur écran haute résolution fenêtré (~1591 px CSS) sans scale-up ni migration rem/clamp,
  mobile <1440 strictement intact.

## Court terme

- **Performance bundle** : code-splitting du chunk `recharts` (~542 KB / 150 KB gz) via
  `build.rollupOptions.output.manualChunks` et/ou imports dynamiques. (Warning de build
  connu, non bloquant aujourd'hui.)
- **Purge CANONICAL** : retirer les alias legacy `--qc-*` / `--text-*` / `--qc-bg-*` du
  Dashboard une fois les ~570 occurrences migrées vers les tokens canoniques, puis purger
  `src/theme/tokens.js`.

## Hors-scope assumé (faible ROI immédiat)

- **Enrichissement `deltaAtEntry` / `ivAtEntry` / `ivRankAtEntry`** : ces champs restent
  `null` par design tant qu'une source de spot historique n'est pas branchée (bloc
  « FIELDS AWAITING SPOT » des migrations). Le flag `_deltaApproximated` est déjà posé sur
  les trades pré-existants pour permettre une ré-enrichissement le jour venu.

## Vision long terme

- Support complet du workflow **Sniper OTM** (P0–P8) directement dans l'app.
- Le **démarrage réel du système de trading** reste conditionné à une réévaluation avec
  encadrement médical (sept. 2026). C'est un point de contrôle personnel, **pas une
  échéance produit** — aucune fonctionnalité du code n'en dépend.
