# Roadmap

Direction du code après le palier `2.0.0`. Vivant : se met à jour au fil des paliers.

---

## En cours — V2 (branche `dashboard-4k-refonte`)

- **Refonte densité / 4K** : phases B → C.2 livrées ; **phase C.3.0 (zoom 4K)** à venir.
  Objectif : lisibilité et densité d'information sur écrans haute résolution sans casser
  le rendu à zoom ~90 %.

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
