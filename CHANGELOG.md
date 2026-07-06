# Changelog

Toutes les évolutions notables de QuantumCall.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/), versionnage
[SemVer](https://semver.org/).

---

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
