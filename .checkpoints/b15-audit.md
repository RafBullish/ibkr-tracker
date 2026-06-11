# Brique 15 — Phase 0 : audit typo / spacing / alias legacy du Dashboard

Genere le 2026-06-11 par 4 agents d'inventaire paralleles (workflow b15-audit).


---

## Inventaire « font-sizes »

# INVENTAIRE EXHAUSTIF DES FONT-SIZE SUR /DASHBOARD

## RÉSUMÉ EXÉCUTIF

Périmètre analysé :
- Route `/dashboard` (composant principal : `src/pages/Dashboard.jsx`)
- Composants dashboard : 20 fichiers JSX
- Layout : 7 fichiers JSX (Header/CommandBar/StatusBar/BottomNav)
- CSS : `src/styles/v4-dashboard.css`, `canonical.css`, `tokens.css`, `v3-components.css` et imports

**Critères de catalogage :**
- (a) Tokens CSS (--qc-fs-*, var(...))
- (b) Valeurs littérales px dans le CSS
- (c) Valeurs inline JSX/Recharts (fontSize: N)
- Toutes les valeurs **< 12px** isolées avec contexte
- Font-weight et line-height par famille de sélecteurs

---

## 1. TOKENS CSS — SOURCE UNIQUE DE VÉRITÉ

### `src/styles/tokens.css` (lignes 45-54)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--qc-fs-caption` | 11px | Labels, captions mineurs |
| `--qc-fs-label` | 11px | Tags, pills, labels secondaires |
| `--qc-fs-body` | 13px | Corps de texte principal |
| `--qc-fs-lg` | 15px | Sous-titres, axes charts |
| `--qc-fs-xl` | 20px | Valeurs KPI grandes |
| `--qc-fs-kpi-sec` | 24px | Valeurs KPI secondaires |
| `--qc-fs-display` | 28px | Titres modules |
| `--qc-fs-hero` | 40px | Grandes valeurs (NLV, P&L) |
| `--qc-fs-kpi-hero` | 48px | Héros KPI cards |
| `--qc-fs-micro` | 10px | Sous-labels, annotations |

### `src/styles/tokens.css` (lignes 56-59)

| Token | Valeur |
|-------|--------|
| `--qc-fw-regular` | 400 |
| `--qc-fw-medium` | 500 |
| `--qc-fw-semibold` | 600 |
| `--qc-fw-bold` | 700 |

### Legacy compat (lignes 190-209) — **À PURGER**

| Token | Valeur |
|-------|--------|
| `--fs-xs` | 10px |
| `--fs-sm` | 11px |
| `--fs-base` | 12px |
| `--fs-md` | 13px |
| `--fs-lg` | 14px |
| `--fs-xl` | 16px |
| `--fs-2xl` | 18px |
| `--fs-3xl` | 22px |
| `--fs-4xl` | 28px |
| `--fs-5xl` | 36px |
| `--text-2xs` | 10px |
| `--text-xs` | 11px |
| `--text-sm` | 12px |
| `--text-base` | 13px |
| `--text-md` | 14px |
| `--text-lg` | 16px |
| `--text-2xl` | 22px |
| `--text-3xl` | 28px |
| `--font-size-hero` | 48px |

### KPI Module Tokens (lignes 318-323)

| Token | Valeur |
|-------|--------|
| `--kpi-label-size` | 11px |
| `--kpi-number-size` | 32px |
| `--kpi-delta-size` | 13px |
| `--chip-font-size` | 11px |

---

## 2. FONT-SIZE LITTÉRALES EN PIXE LS — V4-DASHBOARD.CSS

### Valeurs < 12px (68 occurrences)

#### **8px** (10 occurrences)
- Ligne 1684: `.module-placeholder__sub` — sous-labels placeholders
- Ligne 1922: `.risk-matrix__section-head-info` — infos légères
- Ligne 1991: `.risk-matrix__section-head-info` (variante loss)
- Ligne 2006: `.risk-matrix__section-head-info` (variante pushdown)
- Ligne 2061: `.greeks-agg__type-pill` — pills CALL/PUT/STK
- Ligne 2075: `.greeks-agg__type-pill` (variante PUT)
- Ligne 2283: `.live-pos__alert-pill--warn` (variante warn)
- Ligne 2849: `.live-pos__alert-pill--info` (variante info)
- Ligne 3505: `.dash-kpi-card__info-block` — blocs info KPI
- Ligne 4425: `.dash-kpi-card__hero-form-tick` (media query)

#### **9px** (16 occurrences)
- Ligne 239: `.trading-chart__range-btn` — boutons timeframe
- Ligne 349: `.master-chart__tooltip-row > span:first-child` — labels tooltip
- Ligne 694: `.trading-chart__sub` — sous-titres charts
- Ligne 1137: `.risk-matrix__histogram-axis` — labels histogramme
- Ligne 1574: `.risk-matrix__winrate-donut-label` — label donut
- Ligne 1600: `.risk-matrix__winrate-pf` — profit factor
- Ligne 1631: `.risk-matrix__monthly-labels` — labels mois
- Ligne 2157: `.pnl-calendar__weekdays span` — jours semaine
- Ligne 2195: `.pnl-calendar__year-weekdays` — année weekdays
- Ligne 3218: `.dash-kpi-card__range-btn` — range KPI buttons
- Ligne 3232: `.dash-kpi-card__pill` — pills KPI
- Ligne 4166: `.dash-kpi-card__hero-readout-label` — labels readout
- Ligne 4236: `.dash-kpi-card__hero-readout-label` (dark mode)
- Ligne 4367: `.dashboard-hero-chart-label` — labels charts hero
- Ligne 4413: (chart label context)
- Ligne 4441: (inline chart label)

#### **10px** (42 occurrences — **VALEURS CRITIQUES < 12px**)
- Ligne 141: `.module-placeholder__sub` — sous-label placeholder
- Ligne 193: `.module-body--empty` — texte vide module
- Ligne 308: `.master-chart__empty` — état vide chart
- Ligne 322: `.master-chart__tooltip-date` — date tooltip chart
- Ligne 335: `.master-chart__tooltip-row > span:first-child` — label tooltip
- Ligne 430: `.trading-chart__sub` — sous-titre trading chart
- Ligne 451: `.trading-chart__range-btn` — boutons range trading chart
- Ligne 596: `.trading-chart__footer-label` — labels footer chart
- Ligne 661: `.trading-chart__tooltip-row > span:first-child` — label tooltip
- Ligne 984: `.risk-matrix__action` — boutons header risk matrix
- Ligne 1039: `.risk-matrix__section-head-info` — info section
- Ligne 1103: `.risk-matrix__histogram-empty` — état vide histogram
- Ligne 1281: `.risk-matrix__streak-empty` — état vide streak
- Ligne 1316: `.risk-matrix__winrate-pf` — profit factor
- Ligne 1370: `.risk-matrix__footer` — footer risk matrix
- Ligne 1490: `.greeks-agg__kpi-label` — labels greeks
- Ligne 1517: `.greeks-agg__table thead th` — headers table greeks
- Ligne 1618: `.greeks-agg__table tbody td.greeks-agg__ticker` — ticker greeks
- Ligne 1723: `.live-pos__empty` — état vide live positions
- Ligne 1753: `.live-pos__ivr-num` — numéro IVR
- Ligne 1896: `.live-pos__footer-label` — labels footer positions
- Ligne 1955: `.live-pos__sub` — sous-label (DTE "d")
- Ligne 2114: `.trade-history__empty` — état vide trade history
- Ligne 2143: `.trade-history__footer-label` — labels footer history
- Ligne 2178: `.trade-history__row--th` — headers row history
- Ligne 2281: `.trade-history__row--cols-* (various)` — colonnes rows
- Ligne 2363: `.watchlist__empty` — état vide watchlist
- Ligne 3188: `.dash-kpi-card__pill` — pills KPI
- Ligne 3301: `.dash-kpi-card__hero-density-detail` — détails densité
- Ligne 3434: `.dash-kpi-card__hero-gauge-cap` — label CAP gauge
- Ligne 3673: `.dash-kpi-card__hero-readout-sep` — séparateurs readout
- Ligne 3746: `.dash-kpi-card__hero-readout-label` — labels readout
- Ligne 3791: `.dash-kpi-card__hero-density-label` — labels densité
- Ligne 4115: `.dash-kpi-card__hero-readout-label` — labels readout
- Ligne 4309: (chart axis label)
- Ligne 4428: (chart tooltip label)
- Ligne 4800: `.live-pos__footer-label` — labels footer
- Ligne 4860: `.trade-history__row--cols-value` — valeurs rows
- Ligne 5428: (Footer pill label)

#### **11px** (19 occurrences — **IMPORTANT**)
- Ligne 133: `.module-placeholder__label` — labels placeholder
- Ligne 504: `.trading-chart__kpi-label` — labels KPI
- Ligne 548: `.trading-chart__kpi-sub` — sous-label KPI
- Ligne 637: `.trading-chart__tooltip` — tooltip content
- Ligne 646: `.trading-chart__tooltip-date` — date tooltip
- Ligne 654: `.trading-chart__tooltip-row` — row tooltip
- Ligne 1039: `.risk-matrix__subzone-head` — titres subzone
- Ligne 1202: `.risk-matrix__monthly-labels` — labels mensuels
- Ligne 1426: `.risk-matrix__footer` — footer risk matrix
- Ligne 1808: `.equity-chart__range-pill` — range pills équité
- Ligne 2373: `.trade-history__footer-label` — labels footer
- Ligne 2652: `.dash-kpi-card__hero-readout-label` — labels readout
- Ligne 2689: `.dash-kpi-card__hero-density-label` — labels densité
- Ligne 2902: `.dash-kpi-card__range-btn` — range buttons
- Ligne 2964: (inline pill label)
- Ligne 2983: (inline label context)
- Ligne 3871: (readout label context)
- Ligne 4552: (label context)
- Ligne 5132: (label footer)

---

### Valeurs >= 12px

| Valeur | Nombre d'occurrences | Usage principal |
|--------|----------------------|-----------------|
| 12px | 23 | Headers modules, labels primaires, thead, sous-titres |
| 13px | 12 | Corps texte, valeurs secondaires, subheader |
| 14px | 10 | Valeurs moyennes, sous-titres de section |
| 15px | 13 | **Axes des charts Recharts (CRITIQUE)**, sous-titres |
| 16px | 6 | Grandes valeurs, titres de section |
| 17px | 2 | Valeurs greeks (delta, gamma, etc.) |
| 20px | 1 | Badge de tier |
| 22px | 2 | Valeurs KPI grandes |
| 23px | 1 | Valeur KPI critique |
| 24px | 1 | Titre KPI |
| 28px | 0 | (Token seulement) |
| 30px | 1 | Valeur héros NLV |
| 32px | 1 | Valeur KPI hero (token) |
| 40px | 0 | (Token seulement) |
| 48px | 1 | Valeur NLV héros |
| 56px | 1 | Valeur NLV très grande |

---

## 3. FONT-SIZE INLINE DANS RECHARTS (JSX)

### DashboardKPICards.jsx (lignes 1050-1351)

```javascript
// HeroAreaChart / HeroBarChart / HeroHistogram
tick={{ fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }}
// Axes X/Y
// Également :
fontSize: 15,  // Ligne 1087, 1351 — label reference line
```

### VolatilitySkew.jsx (lignes 110-118)

```javascript
// Axes X/Y
tick={{ fontFamily: T.fonts.mono, fontSize: 9, fill: T.text.tertiary }}
```

### RiskMatrix.jsx (ligne 937)

```javascript
fontSize: 10,  // Inline style dans préliminaire badge
```

**Synthèse Recharts :**
- **15px** : Axes X/Y charts (HeroAreaChart, HeroBarChart, HeroHistogram)
- **10px** : Annotations inline (RiskMatrix préliminaire)
- **9px** : Axes VolatilitySkew

---

## 4. FONT-WEIGHT PAR FAMILLE DE SÉLECTEURS

### Headers (module-header, risk-matrix__header, etc.)

| Poids | Lignes | Contexte |
|-------|--------|----------|
| 500 | 158, 425, 508, 516, 600, 767, 827, 862, 974, 1065, 1491, 1539, 2158, 2196, 2442, 2475, 2927, 3175, 3233, 3302, 3440, 3578, 3590, 3674, 3792, 3975, 4116, 4135, 4174, 4237, 4319, 4521, 4723, 4804, 4813, 4950, 4993, 5018, 5047, 5136, 5276, 5286, 5432, 5438 | Labels secondaires, sous-titres |
| 600 | 167, 213, 268, 331, 356, 476, 517, 644, 696, 1081, 1085, 1324, 1350, 1501, 1584, 1671, 1685, 1892, 1923, 1992, 2007, 2062, 2076, 2256, 2284, 2318, 2414, 2542, 2684, 2690, 2724, 2769, 2850, 3217, 3686, 3860, 3875, 3984, 4014, 4852, 5297 | Titres, labels primaires, highlights |
| 700 | 1671, 2318, 4014 | Valeurs critiques, badges TIER/EDGE |

### Valeurs (KPI, prix, P&L)

| Poids | Contexte |
|-------|----------|
| 500 | Valeurs numériques standard, monospace tabular |
| 600 | Valeurs mises en évidence (best/worst, total) |
| 700 | Badges de statut (TIER, EDGE) |

### Font-size par tone/classe

| Tone | Poids typique | Font-size typique |
|------|---------------|--------------------|
| Labels (caption, tertiary) | 500 | 9-11px |
| Values (primary) | 500 | 12-17px |
| Values (bold) | 600 | 12-22px |
| Badges | 500-600 | 8-12px |
| Headers | 600 | 12-15px |
| Titles | 600 | 12-28px |

---

## 5. LINE-HEIGHT PAR ÉLÉMENT

### Standards appliqués

| Élément | Line-height | Lignes CSS |
|---------|------------|-----------|
| Tooltips | 1.4 | 323 |
| Labels/Pills | 1 | 461, 517, 1504, 3312, 3356, 3897, 4118, 4243 |
| Body text (readout) | 1.3 | 754 |
| Table rows | 1.45 | 864 |
| Heroes | 0.95-1.1 | 1504, 3312, 3356, 3367 |
| Captions | Inherit | (defaut 1.5) |

---

## 6. ANALYSE DES VALEURS < 12px — RÉCAPITULATIF CRITIQUE

### Seuils d'alerte

| Valeur | Occurrences | Risque | Sélecteurs critiques |
|--------|-------------|--------|----------------------|
| **8px** | 10 | **TRÈS HAUT** | `.module-placeholder__sub`, `.greeks-agg__type-pill`, pills d'alerte |
| **9px** | 16 | **HAUT** | Labels subzone, annonces axes chart, weekdays calendrier |
| **10px** | 42 | **MOYEN-HAUT** | **VALEUR DOMINANTE** — placeholders, module-empty, tooltips, labels footer, info blocks |
| **11px** | 19 | **MOYEN** | Standard label size — acceptable |

### Dominantes observées

1. **10px est la taille de label omniprésente** — 42 occurrences à travers :
   - États vides (empty, placeholder)
   - Footers de tables/modules
   - Infoblocksannexes
   - Sous-labels contextuels

2. **11px est le standard token label** — défini dans tokens.css comme `--qc-fs-caption`

3. **15px pour axes Recharts** — cohérent, déterministe via Recharts config

---

## 7. VALEURS NON-PX UTILISÉES

### var() usage

| Token | Définition | Occurrences |
|-------|-----------|-------------|
| `var(--qc-fs-body)` | 13px | 3174 |
| `var(--qc-fs-xl)` | 20px | 3353 |
| `var(--qc-fs-micro)` | 10px | 3577 |
| `var(--kpi-label-size)` | 11px | 730 (legacy) |
| `var(--kpi-number-size)` | 32px | 738 |
| `var(--kpi-delta-size)` | 13px | 758 |
| `var(--chip-font-size)` | 11px | 1669 |

---

## 8. LAYOUT CHROME REFERENCED EN FONT-SIZE

### Via tokens.css (lignes 241-253)

| Variable | Valeur | Impact typographique |
|----------|--------|----------------------|
| `--header-height` | 56px | Contenance texte commands |
| `--shell-cmdbar-h` | 56px | Contenance texteasures |
| `--shell-statusbar-h` | 32px | Compact font sizing |
| `--shell-tickertape-h` | 40px | Secondary tier |
| `--row-h-15` | 30px | **Table row density** |
| `--table-row-height` | 32px | Legacy table rows |

---

## 9. FICHIERS AFFECTÉS — FICHIERS ANNEXES

### Composants chargés sur dashboard

- `DashboardKPICards.jsx` → Recharts fontSize: 15px (axes)
- `RiskMatrix.jsx` → Recharts fontSize: 9px, inline fontSize: 10px
- `LivePositions.jsx` → Tabular data, no inline fontSize
- `TradeHistory.jsx` → Table dense, CSS-driven
- `EquityChart.jsx` → Recharts axes
- `DailyPnLChart.jsx` → Recharts axes
- `VolatilitySkew.jsx` → Recharts fontSize: 9px

### CSS importés dans v4-dashboard.css

- `tokens.css` → Tokens + legacy compat
- `canonical.css` → Alias + color semantics
- `v3-components.css` → Card/badge/tooltip/skeleton

---

## 10. REGRESSIONS À SURVEILLER

### Valeurs micro (< 10px)

**8px — À ÉVITER** :
- `.module-placeholder__sub` → Risque : perte de lisibilité
- `.greeks-agg__type-pill` → Risque : peu de surface pour clic
- `.live-pos__alert-pill--* variants` → Risque : badges confus

**9px — À LIMITER** :
- Axes Recharts (VolatilitySkew seulement)
- Labels weekday calendrier
- Annotations subzone

### Cohérence tokens

**Mismatch actuel** :
- 10px apparaît 42× en CSS littéral
- Token `--qc-fs-micro: 10px` existe mais rarement utilisé
- Token `--qc-fs-caption: 11px` est préféré

**Recommandation** : Normaliser vers `--qc-fs-micro` (10px) ou `--qc-fs-caption` (11px) pour label/placeholder, réduire les hardcodes px.

---

## TABLEAU DE SYNTHÈSE GLOBALE

### Font-size : Valeur → Occurrences → Fichiers:Lignes

| Valeur | Occurrences | Contexte | Fichiers:Lignes (échantillon) |
|--------|-------------|----------|-----|
| 8px | 10 | Micro annotations | v4-dashboard.css:1684,1922,1991,2006,2061,2075,2283,2849,3505,4425 |
| 9px | 16 | Labels subzone, axes chart | v4-dashboard.css:239,349,694,1137,1574,1600,1631,2157,2195,3218,3232,4166,4236,4367 |
| 10px | 42 | **DOMINANTE** — placeholders, empty, footer labels | v4-dashboard.css:141,193,308,322,335,430,451,596,661,984,1039,1103,1281,1316,1370,1490,1517,1618,1723,1753,1896,1955,2114,2143,2178,2281,2363,3188,3301,3434,3673,3746,3791,4115,4309,4428,4800,4860,5428 |
| 11px | 19 | Labels primaires (token standard) | v4-dashboard.css:133,504,548,637,646,654,1039,1202,1426,1808,2373,2652,2689,2902,2964,2983,3871,4552,5132 |
| 12px | 23 | Headers modules, labels primaires | v4-dashboard.css:157,216,421,680,766,796,914,925,973,1456,2938,3373,3384,3673,3710,3974,3998,4126,4653,4719,4753,5045,5295 |
| 13px | 12 | Corps texte, delta KPI | v4-dashboard.css:345,585,1013,1583,2641,3589,3842,4505,5007 |
| 14px | 10 | Valeurs moyennes, sous-titres | v4-dashboard.css:796,1323,1766,3256,4032,4042,4052,4055,4062,4073,4081 |
| 15px | 13 | **Axes Recharts** (critique) | v4-dashboard.css:606,861,4027,4647; DashboardKPICards.jsx:1050,1061,1087,1192,1202,1316,1328,1351 |
| 16px | 6 | Grandes valeurs | v4-dashboard.css:3685,3983,4002; EquityChart, DailyPnLChart |
| 17px | 2 | Valeurs greeks | v4-dashboard.css:1500,3243 |
| 20px | 1 | Badge tier | v4-dashboard.css:4045 |
| 22px | 2 | Valeurs KPI | v4-dashboard.css:514,4084 |
| 23px | 1 | Valeur héros | v4-dashboard.css:4084 |
| 24px | 1 | Titre KPI | v4-dashboard.css:1441 |
| 30px | 1 | Valeur NLV | v4-dashboard.css:4115 |
| 32px | 1 | Token KPI hero | tokens.css:321 |
| 40px | 0 | Token hero | tokens.css:52 |
| 48px | 1 | NLV ultra-grand | DashboardKPICards.jsx (via token) |
| 56px | 1 | NLV ultra-grand | v4-dashboard.css:3366 |

### Font-weight : Synthèse par rôle

| Rôle | Poids | Occurrences | Lignes (échantillon) |
|------|-------|-------------|--------|
| Labels/Captions | 500 | ~70 | v4-dashboard.css:158,425,508,516,600,767,827,862,974,1065,1491,... |
| Titres/Headers | 600 | ~45 | v4-dashboard.css:167,213,268,331,356,476,517,644,696,1081,1085,... |
| Badges/Highlights | 700 | 3 | v4-dashboard.css:1671,2318,4014 |
| Neutral/Text | 400 | 1 | v4-dashboard.css:985 |

### Line-height : Standard appliqué

| Contexte | Line-height | Lignes |
|----------|------------|--------|
| Compact (labels, pills) | 1.0 | 461, 517, 1504, 3312, 3356, 3897, 4118, 4243 |
| Normal (tooltips) | 1.3-1.4 | 323, 754, 864 |
| Tight (heroes) | 0.95-1.1 | 1504, 3312, 3356, 3367 |
| Default (inherit) | 1.5 | (système) |

---

## RECOMMANDATIONS POUR REFONTE

1. **Normaliser 10px vers token** : `--qc-fs-micro` existe mais peu utilisé. Remplacer les 42 hardcodes "10px" par `var(--qc-fs-micro)` pour uniformité.

2. **Éviter 8px** : 10 occurrences, risque d'accessibilité. Élever à 10px ou 9px au minimum.

3. **Axes Recharts à 15px** : Intentionnel, maintenir via config (fontSize: 15 dans AreaChart, BarChart).

4. **Font-weight : 500 par défaut, 600 pour emphase** : Pattern clair, respecté.

5. **Line-height : 1.0 pour compact, 1.3+ pour normal** : Acceptable, test en 4K.

6. **Purger legacy tokens** : `--fs-xs`, `--fs-sm`, `--text-2xs`, etc. migrer vers `--qc-fs-*`.


---

## Inventaire « spacing »

# INVENTAIRE EXHAUSTIF - Route /dashboard

## Périmètre
- Route: `/dashboard`
- Fichiers clés analysés:
  - `src/pages/Dashboard.jsx` (composant principal)
  - `src/components/dashboard/*` (tous les composants du dashboard)
  - `src/styles/tokens.css` (variables globales)
  - `src/styles/canonical.css` (transition layer)
  - `src/styles/v4-dashboard.css` (styles dashboard)
  - `src/styles/v3-components.css` (composants globaux)

---

## INVENTAIRE 1 - FONT-SIZE

### Valeurs de --qc-fs-* (source canonique)
| Valeur | Sélecteur/Usage | Fichier:Ligne |
|--------|-----------------|---------------|
| 10px | `--qc-fs-micro` | tokens.css:54 |
| 11px | `--qc-fs-caption`, `--qc-fs-label` | tokens.css:45-46 |
| 13px | `--qc-fs-body` | tokens.css:47 |
| 15px | `--qc-fs-lg` | tokens.css:48 |
| 20px | `--qc-fs-xl` | tokens.css:49 |
| 24px | `--qc-fs-kpi-sec` | tokens.css:50 |
| 28px | `--qc-fs-display` | tokens.css:51 |
| 40px | `--qc-fs-hero` | tokens.css:52 |
| 48px | `--qc-fs-kpi-hero` | tokens.css:53 |

### Dashboard KPI Cards
| Sélecteur | font-size | Fichier:Ligne | Notes |
|-----------|-----------|---------------|-------|
| `.dash-kpi-card__label` | 13px (var(--qc-fs-body)) | v4-dashboard.css:3174 | Titres cartes KPI |
| `.dash-kpi-card__value` | 20px (var(--qc-fs-xl)) | v4-dashboard.css:3353 | Montants secondaires |
| `.dash-kpi-card--hero .dash-kpi-card__value` | 56px | v4-dashboard.css:3366 | Héros NLV/Realized |
| `.dash-kpi-card__chf` | 12px | v4-dashboard.css:3373 | Ligne CHF secondaire |
| `.dash-kpi-card--hero .dash-kpi-card__chf` | 14px | v4-dashboard.css:3384 | Ligne CHF héros |
| `.dash-kpi-card__pill` | 10px | v4-dashboard.css:3232 | Pillules indicateurs |
| `.dash-kpi-card__pill--hero` | 17px | v4-dashboard.css:3243 | Pillule delta héros |
| `.dash-kpi-card__cell-label` | 10px (var(--qc-fs-micro)) | v4-dashboard.css:3577 | Labels footer KPI |
| `.dash-kpi-card--hero .dash-kpi-card__cell-label` | 14px | v4-dashboard.css:3998 | Labels footer héros |
| `.dash-kpi-card__cell-value` | 13px | v4-dashboard.css:3589 | Valeurs footer |
| `.dash-kpi-card--hero .dash-kpi-card__cell-value` | 23px (override) | v4-dashboard.css:4084 | Valeurs footer héros |
| `.dash-kpi-card__micro-stat-label` | 12px | v4-dashboard.css:3974 | Labels micro-stats |
| `.dash-kpi-card__micro-stat-value` | 16px | v4-dashboard.css:3983 | Valeurs micro-stats |
| `.dash-kpi-card--hero .dash-kpi-card__micro-stat-label` | 14px | v4-dashboard.css:4042 | Labels micro-stats héros |
| `.dash-kpi-card--hero .dash-kpi-card__micro-stat-value` | 20px | v4-dashboard.css:4045 | Valeurs micro-stats héros |
| `.dash-kpi-card__hero-readout` | 13px | v4-dashboard.css:3842 | Readout point-par-point |
| `.dash-kpi-card--hero .dash-kpi-card__hero-readout` | 14px | v4-dashboard.css:4032 | Readout héros |
| `.dash-kpi-card__hero-readout-label` | 11px | v4-dashboard.css:3871 | Labels readout |
| `.dash-kpi-card--hero .dash-kpi-card__hero-readout-label` | 14px | v4-dashboard.css:4073 | Labels readout héros |
| `.dash-kpi-card__stats-band-label` | 12px | v4-dashboard.css:3673 | Labels stats band |
| `.dash-kpi-card__stats-band-value` | 16px | v4-dashboard.css:3685 | Valeurs stats band |
| `.dash-kpi-card__hero-density-label` | 11px | v4-dashboard.css:3746 | Labels densité |
| `.dash-kpi-card--hero .dash-kpi-card__hero-density-label` | 14px | v4-dashboard.css:4062 | Labels densité héros |
| `.dash-kpi-card__hero-gauge-cap` | 11px | v4-dashboard.css:3791 | Label "MAX" jauge |
| `.dash-kpi-card__bar-row` | 10px | v4-dashboard.css:3434 | Bar rows Avail/Expo |
| `.dash-kpi-card__hint` | 10px | v4-dashboard.css:3188 | Hint labels |
| `.dash-kpi-card__live-text` | 9px | v4-dashboard.css:3218 | "LIVE" badge text |

### Trading Charts (EquityChart, DailyPnLChart)
| Sélecteur | font-size | Fichier:Ligne | Notes |
|-----------|-----------|---------------|-------|
| `.trading-chart__header` | Implicit | v4-dashboard.css:400 | Header section |
| `.trading-chart__title` | 12px | v4-dashboard.css:421 | Title "Equity Curve" |
| `.trading-chart__sub` | 10px | v4-dashboard.css:430 | Subtitle ticker |
| `.trading-chart__range-btn` | 10px | v4-dashboard.css:451 | Range selector buttons |
| `.trading-chart__subheader` | Padding 8px | v4-dashboard.css:481 | KPI strip |
| `.trading-chart__kpi-label` | 11px | v4-dashboard.css:504 | KPI label (OPEN, HIGH, etc) |
| `.trading-chart__kpi-value` | 22px | v4-dashboard.css:514 | KPI value |
| `.trading-chart__footer-label` | 10px | v4-dashboard.css:596 | Footer label |
| `.trading-chart__footer-value` | 15px | v4-dashboard.css:606 | Footer value |
| `.trading-chart__tooltip` | 11px | v4-dashboard.css:637 | Tooltip text |
| `.trading-chart__tooltip-date` | 11px | v4-dashboard.css:646 | Tooltip date |
| `.trading-chart__tooltip-row > span:first-child` | 10px | v4-dashboard.css:661 | Tooltip label |
| `.trading-chart__warn-badge` | 9px | v4-dashboard.css:694 | "WARN" badge |
| `.trading-chart__ath-badge` | (inherits) | v4-dashboard.css:731 | "ATH" badge |
| Recharts XAxis tick | 15px (inline) | DashboardKPICards.jsx:1050 | Axis labels |
| Recharts YAxis tick | 15px (inline) | DashboardKPICards.jsx:1061 | Axis labels |

### Risk Matrix
| Sélecteur | font-size | Fichier:Ligne | Notes |
|-----------|-----------|---------------|-------|
| `.risk-matrix` base | 14px | v4-dashboard.css:796 | RiskMatrix body |
| `.risk-matrix__action` | 13px | v4-dashboard.css:826 | Header buttons (98/99/97) |
| `.risk-matrix__title` | 15px | v4-dashboard.css:861 | "Performance..." title |
| `.risk-matrix__subheader` | 13px | v4-dashboard.css:873 | Init Cap / Live FX / etc |
| `.risk-matrix__section-head` | 12px | v4-dashboard.css:973 | Section headers (▼ Performance) |
| `.risk-matrix__section-head-info` | 10px | v4-dashboard.css:984 | "(préliminaire)" note |
| `.risk-matrix__row` | 14px | v4-dashboard.css:1013 | Data rows |
| `.risk-matrix__row--th` | 11px | v4-dashboard.css:1039 | Table headers |
| `.risk-matrix__tier-badge` | 12px | v4-dashboard.css:914 | "TIER" badge |
| `.risk-matrix__edge-badge` | 12px | v4-dashboard.css:925 | "EDGE+" badge |
| `.risk-matrix__subzone-head` | 11px | v4-dashboard.css:1202 | "DD CURVE", "WIN RATE" heads |
| `.risk-matrix__winrate-donut-label` | 10px | v4-dashboard.css:1316 | Donut "WIN" label |
| `.risk-matrix__winrate-donut-value` | 14px | v4-dashboard.css:1323 | Donut percentage |
| `.risk-matrix__winrate-row` | 12px | v4-dashboard.css:1341 | Win/Loss rows |
| `.risk-matrix__winrate-label` | (inherits) | v4-dashboard.css:1345 | Wins/Losses label |
| `.risk-matrix__monthly-labels` | 11px | v4-dashboard.css:1426 | Month abbreviations |
| `.risk-matrix__footer` | 12px | v4-dashboard.css:1456 | Footer text |
| `.risk-matrix__greek-label` | 10px | v4-dashboard.css:1490 | "Σ DELTA", "Σ GAMMA" |
| `.risk-matrix__greek-value` | 17px | v4-dashboard.css:1500 | Greek values |
| `.risk-matrix__greek-sub` | 10px | v4-dashboard.css:1517 | Greek sub-label |
| `.risk-matrix__histogram-empty` | 10px | v4-dashboard.css:1103 | "Aucun trade" placeholder |
| `.risk-matrix__histogram-axis` | 9px | v4-dashboard.css:1137 | Histogram axis labels |
| `.risk-matrix__gauge` | (geometry) | v4-dashboard.css:1145 | Horizontal gauge |

### Live Positions
| Sélecteur | font-size | Fichier:Ligne | Notes |
|-----------|-----------|---------------|-------|
| `.live-pos__table` | 13px | v4-dashboard.css:1766 | Table base (overridden to 14px) |
| `.live-pos__table tbody td` | 14px | v4-dashboard.css:4753 | Cell content |
| `.live-pos__table thead th` | 11px | v4-dashboard.css:1808 | Headers |
| `.live-pos__table thead th` (override) | 11px | v4-dashboard.css:4719 | Headers sticky |
| `.live-pos__sub` | 10px | v4-dashboard.css:1896 | "d" (days), "m" units |
| `.live-pos__ivr-num` | 10px | v4-dashboard.css:1955 | IV Rank number |
| `.live-pos__type-pill` | 8px | v4-dashboard.css:1922 | CALL/PUT/STK pills |
| `.live-pos__subheader` | 13px | v4-dashboard.css:4505 | Σ Δ · Σ Θ context |
| `.live-pos__ctx` | (inherits 13px) | v4-dashboard.css:4510 | Context item |
| `.live-pos__ctx-badge` | 11px | v4-dashboard.css:4552 | "IN PROFIT" badge |
| `.live-pos__footer-label` | 10px | v4-dashboard.css:4800 | Footer labels |
| `.live-pos__footer-value` | 15px | v4-dashboard.css:4811 | Footer values |
| `.live-pos > .module-header .module-header__title` | 15px | v4-dashboard.css:4647 | Module title |
| `.live-pos > .module-header .module-header__hint` | 12px | v4-dashboard.css:4653 | Header hint |

### Trade History
| Sélecteur | font-size | Fichier:Ligne | Notes |
|-----------|-----------|---------------|-------|
| `.trade-history__table` | 14px | v4-dashboard.css:5091 | Table base |
| `.trade-history__table thead th` | 11px | v4-dashboard.css:5132 | Table headers |
| `.trade-history__title` | 15px | v4-dashboard.css:4946 | "Trade History" title |
| `.trade-history__sub` | 12px | v4-dashboard.css:4954 | "(n / total trades)" |
| `.trade-history__range-selector button` | 12px | v4-dashboard.css:4970 | Range buttons (15/30/50/ALL) |
| `.trade-history__subheader` | 13px | v4-dashboard.css:5007 | Σ Hold / Best / Worst context |
| `.trade-history__ctx` | (inherits 13px) | v4-dashboard.css:5012 | Context item |
| `.trade-history__ctx-badge` | 12px | v4-dashboard.css:5046 | "WINS/LOSSES" badges |
| `.trade-history__badge` | (inline) | TradeHistory.jsx:133-141 | STK/CALL/PUT type pills |
| `.trade-history__footer-label` | 10px | v4-dashboard.css | Footer labels (Σ P&L, etc) |
| `.trade-history__footer-value` | 15px | v4-dashboard.css | Footer values |
| `.trade-history__sniper-placeholder` | (inherits) | TradeHistory.jsx:478-481 | "pending" placeholder |

### Watchlist, IV Rank Movers, Sector Heatmap, Alerts Feed
| Sélecteur | font-size | Fichier:Ligne | Notes |
|-----------|-----------|---------------|-------|
| `.watchlist__table`, `.earnings-cal__table`, `.iv-movers__table` | 10px | v4-dashboard.css:2178 | Table base |
| `.watchlist__table thead th` | 9px | v4-dashboard.css:2195 | Headers |
| `.watchlist__row` | var(--row-h-15) | v4-dashboard.css:2217 | Row height |
| `.watchlist__add-btn` | 9px | v4-dashboard.css:2157 | "Add" button |
| `.earnings-cal__t-pill` | 8px | v4-dashboard.css:2284 | Type pill (CALL/PUT) |
| `.earnings-cal__owned-dot` | (geometry) | v4-dashboard.css:2269 | Owned indicator |
| `.heat-cell__code` | 9px | v4-dashboard.css:2318 | Sector symbol |
| `.heat-cell__pct` | 10px | v4-dashboard.css:2325 | Sector % value |
| `.alerts-feed__level` | 8px | v4-dashboard.css:2541 | Alert level pill |
| `.alerts-feed__time` | 9px | v4-dashboard.css:2524 | Timestamp |
| `.alerts-feed__row` | 10px | v4-dashboard.css:2500 | Row base |

---

## INVENTAIRE 2 - PADDING, GAPS, HEIGHTS (Structurel)

### Module Container & Headers
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.module` | padding | (inline flex) | v4-dashboard.css:107 | Base container |
| `.module-header` | height | 32px | v4-dashboard.css:151 | Standard header |
| `.module-header` | padding | 0 12px | v4-dashboard.css:152 | Horizontal padding |
| `.module-placeholder` | padding | 12px 16px | v4-dashboard.css:128 | Placeholder message |
| `.live-pos > .module-header` | height | 40px | v4-dashboard.css:4632 | LivePos header (override) |
| `.live-pos > .module-header` | padding | 0 14px | v4-dashboard.css:4635 | LivePos header padding |
| `.sniper-gates > .module-header` | height | 40px | v4-dashboard.css:4632 | SniperGates header |
| `.sniper-gates > .module-header` | padding | 0 14px | v4-dashboard.css:4635 | SniperGates padding |

### Dashboard Grid & Gaps
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.dash-grid` | gap | 8px | v4-dashboard.css:44 | Module gap (Bloomberg-dense) |
| `.dash-grid` | padding | 0 4px 4px | v4-dashboard.css:45 | Grid padding |
| `.dash-kpi-cards` | gap | 8px | v4-dashboard.css:3063 | KPI cards row gap |
| `.dash-kpi-cards` | padding | 14px 4px | v4-dashboard.css:3064 | KPI container padding |
| `.dash-kpi-cards__row` | gap | 8px | v4-dashboard.css:3072 | KPI row gap |
| `.dash-kpi-card` | padding | 16px 16px | v4-dashboard.css:3103 | Card internal padding |
| `.dash-kpi-card--hero` | padding | 16px | v4-dashboard.css:3149 | Hero card padding |

### Trading Charts
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.trading-chart__header` | height | 32px | v4-dashboard.css:402 | Header height |
| `.trading-chart__header` | padding | 0 14px | v4-dashboard.css:403 | Header padding |
| `.trading-chart__subheader` | padding | 8px 14px | v4-dashboard.css:481 | KPI strip padding |
| `.trading-chart__subheader` | gap | 14px | v4-dashboard.css:486 | KPI gap |
| `.trading-chart__kpi` | gap | 4px | v4-dashboard.css:493 | KPI cell gap |
| `.trading-chart__body` | padding | 8px 8px 4px | v4-dashboard.css:560 | Chart canvas padding |
| `.trading-chart__footer` | padding | 10px 14px | v4-dashboard.css:571 | Footer padding |
| `.trading-chart__footer` | gap | 0 | v4-dashboard.css:575 | No gap (grid) |
| `.trading-chart__footer-cell` | padding | 0 10px | v4-dashboard.css:582 | Cell padding |
| `.trading-chart__footer-cell:first-child` | padding-left | 0 | v4-dashboard.css:588 | First cell left |
| `.trading-chart__footer-cell:last-child` | padding-right | 0 | v4-dashboard.css:591 | Last cell right |

### Risk Matrix
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.risk-matrix` | height | 520px | v4-dashboard.css:784 | Fixed height |
| `.risk-matrix__header` | height | 34px | v4-dashboard.css:815 | Header height |
| `.risk-matrix__action` | padding | 0 18px | v4-dashboard.css:821 | Button padding |
| `.risk-matrix__subheader` | padding | 8px 20px | v4-dashboard.css:869 | Subheader padding |
| `.risk-matrix__subheader` | gap | 14px | v4-dashboard.css:877 | Subheader gap |
| `.risk-matrix__context` | gap | 22px | v4-dashboard.css:895 | Context gap |
| `.risk-matrix__context--right` | gap | 12px | v4-dashboard.css:900 | Right context gap |
| `.risk-matrix__body` | grid-template-columns | 1.5fr 1fr 1fr | v4-dashboard.css:954 | 3 columns |
| `.risk-matrix__row` | padding | 4px 18px | v4-dashboard.css:1012 | Row padding |
| `.risk-matrix__row` | gap | 6px | v4-dashboard.css:1018 | Row gap |
| `.risk-matrix__row--th` | padding | 4px 18px | v4-dashboard.css:1036 | Header row padding |
| `.risk-matrix__section-head` | padding | 7px 18px | v4-dashboard.css:972 | Section head padding |
| `.risk-matrix__subzone` | padding | 10px 18px | v4-dashboard.css:1183 | Subzone padding |
| `.risk-matrix__histogram` | padding | 8px 12px 4px | v4-dashboard.css:1089 | Histogram padding |
| `.risk-matrix__histogram` | gap | 2px | v4-dashboard.css:1092 | Histogram gap |
| `.risk-matrix__histogram` | height | 60px | v4-dashboard.css:1093 | Histogram height |
| `.risk-matrix__winrate-zone` | padding | 12px 18px | v4-dashboard.css:1292 | Winrate padding |
| `.risk-matrix__winrate-zone` | gap | 16px | v4-dashboard.css:1291 | Winrate gap |
| `.risk-matrix__winrate-donut` | width/height | 72px | v4-dashboard.css:1301 | Donut size |
| `.risk-matrix__winrate-stats` | gap | 5px | v4-dashboard.css:1332 | Stats gap |
| `.risk-matrix__monthly-zone` | padding | 12px 18px | v4-dashboard.css:1384 | Monthly padding |
| `.risk-matrix__monthly-bars` | gap | 5px | v4-dashboard.css:1396 | Bar gap |
| `.risk-matrix__monthly-bars` | height | 32px | v4-dashboard.css:1397 | Bars height |
| `.risk-matrix__footer` | height | 24px | v4-dashboard.css:1448 | Footer height |
| `.risk-matrix__footer` | padding | 0 18px | v4-dashboard.css:1451 | Footer padding |
| `.risk-matrix__greeks-strip` | height | 50px | v4-dashboard.css:1467 | Greeks strip |
| `.risk-matrix__greek-cell` | padding | 0 14px | v4-dashboard.css:1478 | Greek cell padding |
| `.risk-matrix__greek-cell` | gap | 2px | v4-dashboard.css:1481 | Greek cell gap |

### Live Positions
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.live-pos__table` | table-layout | fixed | v4-dashboard.css:1764 | Deterministic widths |
| `.live-pos__table thead th` | height | 30px | v4-dashboard.css:1806 | Header height |
| `.live-pos__table thead th` (override) | height | 36px | v4-dashboard.css:4718 | Header sticky |
| `.live-pos__table thead th` | padding | 0 10px | v4-dashboard.css:1807 | Header padding |
| `.live-pos__table thead th` (override) | padding | 10px 14px | v4-dashboard.css:4717 | Header sticky padding |
| `.live-pos__row` | height | 32px | v4-dashboard.css:1826 | Data row height |
| `.live-pos__row` | border-left | 3px solid transparent | v4-dashboard.css:1828 | Tone rail |
| `.live-pos__table tbody td` | padding | 0 10px | v4-dashboard.css:1854 | Cell padding |
| `.live-pos__table tbody td` (override) | padding | 6px 14px | v4-dashboard.css:4749 | Cell padding sticky |
| `.live-pos__table tbody td` (override) | height | 32px | v4-dashboard.css:4755 | Cell height explicit |
| `.live-pos__subheader` | padding | 10px 14px | v4-dashboard.css:4497 | Subheader padding |
| `.live-pos__subheader` | gap | 18px | v4-dashboard.css:4503 | Subheader gap |
| `.live-pos__footer` | padding | 10px 14px | v4-dashboard.css:4771 | Footer padding |
| `.live-pos__footer` | height | 56px | v4-dashboard.css:4772 | Footer height |
| `.live-pos__footer` | gap | 0 | v4-dashboard.css:4777 | No gap (grid) |
| `.live-pos__footer-cell` | padding | 0 14px | v4-dashboard.css:4785 | Cell padding |
| `.live-pos__footer-cell` | gap | 3px | v4-dashboard.css:4784 | Cell gap |
| `.live-pos__footer-cell:first-child` | padding-left | 0 | v4-dashboard.css:4791 | First cell |
| `.live-pos__footer-cell:last-child` | padding-right | 0 | v4-dashboard.css:4795 | Last cell |

### Trade History
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.trade-history` | height | 480px | v4-dashboard.css:4895 | Fixed height |
| `.trade-history__header` | height | 40px | v4-dashboard.css:4929 | Header height |
| `.trade-history__header` | padding | 0 14px | v4-dashboard.css:4930 | Header padding |
| `.trade-history__subheader` | padding | 10px 14px | v4-dashboard.css:5000 | Subheader padding |
| `.trade-history__subheader` | gap | 18px | v4-dashboard.css:5005 | Subheader gap |
| `.trade-history__range-selector` | padding | 2px | v4-dashboard.css:4963 | Selector padding |
| `.trade-history__range-selector` | gap | 1px | v4-dashboard.css:4961 | Button gap |
| `.trade-history__range-selector button` | padding | 5px 11px | v4-dashboard.css:4968 | Button padding |
| `.trade-history__table` | table-layout | fixed | v4-dashboard.css:5095 | Deterministic widths |
| `.trade-history__table thead th` | height | 36px | v4-dashboard.css:5140 | Header height |
| `.trade-history__table thead th` | padding | 10px 14px | v4-dashboard.css:5131 | Header padding |
| `.trade-history__table tbody tr` | height | (auto, 32px from td) | v4-dashboard.css:5186 | Row height |
| `.trade-history__table tbody td` | padding | 10px 14px | v4-dashboard.css | Cell padding |
| `.trade-history__table tbody td:last-child` | padding-right | 18px | v4-dashboard.css:5183 | Last cell air |
| `.trade-history__footer` | padding | 10px 14px | v4-dashboard.css | Footer padding |
| `.trade-history__footer-cell` | gap | 3px | v4-dashboard.css | Cell gap |

### KPI Cards (Detailed)
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.dash-kpi-card__top` | gap | 8px | v4-dashboard.css:3158 | Top row gap |
| `.dash-kpi-card__top-left` | gap | 10px | v4-dashboard.css:3165 | Label + icon gap |
| `.dash-kpi-card__pill` | padding | 3px 8px | v4-dashboard.css:3229 | Pill padding |
| `.dash-kpi-card__pill--hero` | padding | 6px 12px | v4-dashboard.css:3242 | Hero pill |
| `.dash-kpi-card__footer` | gap | 0 | v4-dashboard.css:3529 | Grid, no gap |
| `.dash-kpi-card__footer` | padding-top | 12px | v4-dashboard.css:3530 | Footer top space |
| `.dash-kpi-card__cell` | gap | 4px | v4-dashboard.css:3556 | Cell label/value gap |
| `.dash-kpi-card__footer--2 .dash-kpi-card__cell:nth-child(1)` | border-right | 1px | v4-dashboard.css:3564 | Divider |
| `.dash-kpi-card__footer--2 .dash-kpi-card__cell:nth-child(1)` | padding-right | 8px | v4-dashboard.css:3565 | Divider right |
| `.dash-kpi-card__footer--2 .dash-kpi-card__cell:nth-child(2)` | padding-left | 8px | v4-dashboard.css:3572 | Cell left |
| `.dash-kpi-card__footer--3 .dash-kpi-card__cell:not(:last-child)` | padding-right | 8px | v4-dashboard.css:3565 | Cell padding |
| `.dash-kpi-card__bar-block` | gap | 6px | v4-dashboard.css:3426 | Bar block gap |
| `.dash-kpi-card__bar` | height | 8px | v4-dashboard.css:3457 | Bar height |
| `.dash-kpi-card__bar-marker` | width/height | 1.5px / 14px | v4-dashboard.css:3493-3494 | Marker size |
| `.dash-kpi-card__bar-cap-label` | top | -15px | v4-dashboard.css:3503 | Cap label offset |
| `.dash-kpi-card__bar--with-marker` | margin-top | 16px | v4-dashboard.css:3515 | Space for label |
| `.dash-kpi-card__info-block` | padding | 8px 10px | v4-dashboard.css:4280 | Info block |
| `.dash-kpi-card__info-slot--tight .dash-kpi-card__info-block` | padding | 6px 10px | v4-dashboard.css:4349 | Tight info |
| `.dash-kpi-card__hero-density` | gap | 8px | v4-dashboard.css:3700 | Density gap |
| `.dash-kpi-card__hero-density-detail` | gap | 4px 6px | v4-dashboard.css:3726 | Detail flex gap |
| `.dash-kpi-card__hero-form-band` | gap | 3px | v4-dashboard.css:3807 | Form band gap |
| `.dash-kpi-card__hero-form-band` | height | 15px | v4-dashboard.css:3809 | Form band height |
| `.dash-kpi-card__hero-readout` | gap | 6px 8px | v4-dashboard.css:3838 | Readout gap |
| `.dash-kpi-card__stats-band` | padding | 8px 0 | v4-dashboard.css:3659 | Stats band padding |
| `.dash-kpi-card__stats-band` | gap | 12px | v4-dashboard.css:3657 | Stats gap |
| `.dash-kpi-card__stats-band-cell` | gap | 2px | v4-dashboard.css:3667 | Cell gap |
| `.dash-kpi-card__avail-block` | gap | 7px | v4-dashboard.css:4384 | Avail block gap |
| `.dash-kpi-card__expo-block` | gap | 6px | v4-dashboard.css:4400 | Expo block gap |
| `.dash-kpi-card__wr-mid` | gap | 12px | v4-dashboard.css:4102 | WR mid gap |
| `.dash-kpi-card__spark-wrap` | (positioning) | relative | v4-dashboard.css:4357 | Sparkline wrap |
| `.dash-kpi-card__spark-overlay` | top/right | 2px / 2px | v4-dashboard.css:4364-4365 | Overlay position |

### Other Components
| Sélecteur | Property | Value | Fichier:Ligne | Notes |
|-----------|----------|-------|---------------|-------|
| `.sniper-gates__body` | padding | 4px 0 | v4-dashboard.css:2620 | Gates body padding |
| `.sniper-gates__table tbody td` | padding | 0 10px | v4-dashboard.css:2672 | Gates cell padding |
| `.sniper-gates__row` | height | 36px | v4-dashboard.css:2666 | Gates row height |
| `.sniper-gates__table thead th` | height | 30px | v4-dashboard.css:2648 | Gates header |
| `.sniper-gates__table thead th` | padding | 0 10px | v4-dashboard.css:2649 | Gates header padding |
| `.gate-bar` | height | 14px | v4-dashboard.css:2759 | Gate bar height |
| `.gate-bar__track` | height | 4px | v4-dashboard.css:2775 | Track height |
| `.sector-heatmap__body` | padding | 4px | v4-dashboard.css:2293 | Heat body padding |
| `.sector-heatmap__grid` | gap | 2px | v4-dashboard.css:2301 | Heat grid gap |
| `.heat-cell` | padding | 4px 6px | v4-dashboard.css:2309 | Heat cell padding |
| `.alerts-feed__row` | height | var(--row-h-15) | v4-dashboard.css:2507 | Alert row height |
| `.alerts-feed__row` | padding | 0 8px | v4-dashboard.css:2508 | Alert row padding |
| `.alerts-feed__row` | gap | 6px | v4-dashboard.css:2506 | Alert row gap |
| `.alerts-feed__level` | padding | 0 4px | v4-dashboard.css:2540 | Level pill padding |
| `.alerts-feed__level` | height | 11px | v4-dashboard.css:2539 | Level pill height |
| `.watchlist__row`, `.earnings-cal__row`, `.iv-movers__row` | height | var(--row-h-15) | v4-dashboard.css:2217 | Row height standard |

---

## INVENTAIRE COMPLET - VALEURS DE HAUTEUR (Heights)

### Grid Heights (Dashboard Layout)
| Sélecteur | height | Fichier:Ligne | Notes |
|-----------|--------|---------------|-------|
| `.dash-grid > [style*="grid-area: equity"]` | 580px | v4-dashboard.css:57 | Row 1: Equity chart |
| `.dash-grid > [style*="grid-area: dailypnl"]` | 580px | v4-dashboard.css:60 | Row 1: DailyPnL chart |
| `.dash-grid > [style*="grid-area: risk"]` | 520px | v4-dashboard.css:63 | Row 1: Risk Matrix |
| `.dash-grid > [style*="grid-area: master"]` | 520px | v4-dashboard.css:68 | Legacy alias |
| `.dash-grid > [style*="grid-area: positions"]` | 420px | v4-dashboard.css:81 | Row 2: Live Positions |
| `.dash-grid > [style*="grid-area: history"]` | 480px | v4-dashboard.css:84 | Row 3: Trade History |
| `.dash-grid > [style*="grid-area: watch"]` | 180px | v4-dashboard.css:91 | Row 4: Watchlist |
| `.dash-grid > [style*="grid-area: calendar"]` | 180px | v4-dashboard.css:94 | Row 4: Calendar |
| `.dash-grid > [style*="grid-area: ivr"]` | 160px | v4-dashboard.css:97 | Row 5: IV Rank |
| `.dash-grid > [style*="grid-area: heat"]` | 160px | v4-dashboard.css:100 | Row 5: Heat |
| `.dash-grid > [style*="grid-area: alert"]` | 160px | v4-dashboard.css:103 | Row 5: Alerts |

### Component Heights
| Sélecteur | height | Fichier:Ligne | Notes |
|-----------|--------|---------------|-------|
| `.dash-kpi-card` | 240px | v4-dashboard.css:3102 | Standard KPI card |
| `.dash-kpi-card--hero` | auto | v4-dashboard.css:3084 | Hero card (min 300px) |
| `.dash-kpi-card--hero` | min-height: 300px | v4-dashboard.css:3085 | Hero minimum |
| `.dash-kpi-cards__row--secondary .dash-kpi-card` | 190px | v4-dashboard.css:3094 | Secondary cards |
| `.dash-kpi-card__hero-chart` | 180px | v4-dashboard.css:3933 | Hero chart section |
| `.dash-kpi-card__avail-spark` | 28px | v4-dashboard.css:4388 | Avail spark |
| `.risk-matrix` | 520px | v4-dashboard.css:784 | Risk matrix |
| `.risk-matrix__histogram` | 60px | v4-dashboard.css:1093 | Histogram |
| `.risk-matrix__monthly-bars` | 32px | v4-dashboard.css:1397 | Monthly bars |
| `.risk-matrix__winrate-donut` | 72px | v4-dashboard.css:1302 | Donut (width/height) |
| `.risk-matrix__dd-spark` | 30px | v4-dashboard.css:1214 | DD sparkline |
| `.risk-matrix__streak-pattern` | 28px | v4-dashboard.css:1242 | Streak bars |
| `.risk-matrix__greeks-strip` | 50px | v4-dashboard.css:1467 | Greeks strip |
| `.live-pos__table tbody tr` | 32px | v4-dashboard.css:4755 | Data row |
| `.live-pos__table thead th` | 36px | v4-dashboard.css:4718 | Header row |
| `.trade-history` | 480px | v4-dashboard.css:4895 | Trade history total |
| `.trade-history__table tbody tr` | ~32px | (auto from td) | Data row |
| `.trade-history__table thead th` | 36px | v4-dashboard.css:5140 | Header row |
| `.sniper-gates__row` | 36px | v4-dashboard.css:2666 | Gates row |
| `.sniper-gates__table thead th` | 30px | v4-dashboard.css:2648 | Gates header |
| `.alerts-feed__row` | var(--row-h-15) | v4-dashboard.css:2507 | Alert row |
| `.module-header` | 32px | v4-dashboard.css:151 | Standard header |
| `.live-pos > .module-header`, `.sniper-gates > .module-header` | 40px | v4-dashboard.css:4632 | Enhanced header |

---

## VARIABLE TOKEN CONSUMPTIONS

### --row-h-15 (row heights)
Defined in tokens.css (line 281) as `30px` — **Referenced as deprecated in v4-dashboard.css:204 — migrated to 22px in Phase C.1 refonte**.
- Consumed by: `.watchlist__row`, `.earnings-cal__row`, `.iv-movers__row`, `.alerts-feed__row`

### Spacing Scale (--qc-space-*)
- `--qc-space-1` (4px): chip padding-y, gap in modals
- `--qc-space-2` (8px): chart sections, gap in dashboard grid
- `--qc-space-3` (12px): `.qc-card` padding, footer gaps
- `--qc-space-4` (16px): card padding, module padding
- `--qc-space-6` (24px): hero card padding
- `--qc-space-8` (32px): larger spacing

---

## SUMMARY TABLE - CRITICAL SPACING ELEMENTS

| Component | Element | CSS Property | Value | Token/Direct | Fichier:Ligne |
|-----------|---------|--------------|-------|--------------|---------------|
| Dashboard Grid | Module gap | gap | 8px | Direct | v4-dashboard.css:44 |
| Dashboard Grid | Padding | padding | 0 4px 4px | Direct | v4-dashboard.css:45 |
| KPI Cards | Row gap | gap | 8px | Direct | v4-dashboard.css:3072 |
| KPI Cards | Container padding | padding | 14px 4px | Direct | v4-dashboard.css:3064 |
| KPI Card | Card padding | padding | 16px | Direct | v4-dashboard.css:3103 |
| KPI Footer | Gap between cells | gap | 0 (grid) | Direct | v4-dashboard.css:3529 |
| KPI Footer | Cell padding X | padding-right/left | 8px | Direct | v4-dashboard.css:3565-3572 |
| Trading Chart | Header height | height | 32px | Direct | v4-dashboard.css:402 |
| Trading Chart | Header padding | padding | 0 14px | Direct | v4-dashboard.css:403 |
| Trading Chart | Subheader padding | padding | 8px 14px | Direct | v4-dashboard.css:481 |
| Trading Chart | Subheader KPI gap | gap | 14px | Direct | v4-dashboard.css:486 |
| Risk Matrix | Body gap | grid-template-columns | 1.5fr 1fr 1fr | Direct | v4-dashboard.css:954 |
| Risk Matrix | Row padding | padding | 4px 18px | Direct | v4-dashboard.css:1012 |
| Risk Matrix | Row gap | gap | 6px | Direct | v4-dashboard.css:1018 |
| LivePositions | Table row height | height | 32px | Direct | v4-dashboard.css:4755 |
| LivePositions | Cell padding | padding | 6px 14px | Direct | v4-dashboard.css:4749 |
| TradeHistory | Row height | height | ~32px | Auto (td) | v4-dashboard.css:5186 |
| TradeHistory | Cell padding | padding | 10px 14px | Direct | v4-dashboard.css (inferred) |
| Watchlist | Row height | height | var(--row-h-15) | Token (30px) | v4-dashboard.css:2217 |
| Sector Heat | Cell gap | gap | 2px | Direct | v4-dashboard.css:2301 |
| Sector Heat | Cell padding | padding | 4px 6px | Direct | v4-dashboard.css:2309 |
| Alerts Feed | Row height | height | var(--row-h-15) | Token (30px) | v4-dashboard.css:2507 |
| Alerts Feed | Row padding | padding | 0 8px | Direct | v4-dashboard.css:2508 |

---

## NOTES D'IMPLÉMENTATION

1. **Grille Dashboard** : Les gaps sont 8px (Bloomberg-dense), padding de grille 0 4px 4px.
2. **Cards KPI** : Padding interne 16px uniformes, mais héros surchargés à padding:16px sans ratio spécial.
3. **Tables (LP/TH)** : Réunification Phase C.2.10-V3 avec padding 10px 14px (horizontal) et 32px height (row). Les headings 36px en sticky.
4. **Row Heights** : Pas de --row-h (déprecated) en use actuel ; hauteurs hardcodées (32px data, 36px headers).
5. **Spacing Scale** : Les --qc-space-* sont définis mais peu consommés directement en v4-dashboard.css — la plupart des valeurs sont directes.
6. **Font-Size Scale** : 6 tailles principales (9px, 10px, 11px, 12px, 13px/14px, 15px, 17px, 20px, 22px, 23px, 56px) + custom inline pour Recharts (15px axes).

---

## VALEURS INLINE (inline style={{ }})

### DashboardKPICards.jsx
- Recharts XAxis.tick: `fontSize: 15` (line 1050)
- Recharts YAxis.tick: `fontSize: 15` (line 1061)
- Recharts ReferenceLine label: `fontSize: 15, offset: 4` (line 1087)

### RiskMatrix.jsx
- No inline style props detected for font-size in readouts

### TradeHistory.jsx / LivePositions.jsx
- No inline style props for core spacing/sizing detected

---

## FINAL REFERENCE TABLE — ALL HARDCODED VALUES

| Category | Value | Occurrences | Primary Usage |
|----------|-------|-------------|---------------|
| **Font sizes** | 8px | 5 | Type pills, level pills, section heads |
| | 9px | 8 | Axis labels, hints, timestamps |
| | 10px | 25+ | Labels, captions, subtext |
| | 11px | 15+ | Headers, body captions |
| | 12px | 20+ | Secondary titles, ranges |
| | 13px | 10+ | Body text, subheader |
| | 14px | 8+ | Table body (14px), hero overrides |
| | 15px | 8+ | Footer values, Recharts axes |
| | 17px | 1 | Hero pill |
| | 20px | 3 | KPI values, micro-stat |
| | 22px | 1 | Trading chart KPI |
| | 23px | 1 | Hero footer value |
| | 56px | 1 | Hero NLV/Realized |
| **Paddings** | 0 4px | 2 | Grid |
| | 2px | 2 | Range selector |
| | 3px | 7 | Badges, rounded |
| | 4px | 10+ | Rows, cells, gap |
| | 6px | 10+ | Cells (compact), gap |
| | 8px | 15+ | Card content, gaps |
| | 10px | 15+ | Headers, cells |
| | 12px | 5 | Containers |
| | 14px | 10+ | Headers, cells, standard |
| | 16px | 10+ | Cards, standard padding |
| | 18px | 8 | Risk matrix rows, gaps |
| | 20px | 3 | Context gaps |
| **Heights** | 11px | 3 | Pills (CALL/PUT), levels |
| | 14px | 3 | Gate bars, badge |
| | 15px | 1 | Form band |
| | 18px | 1 | Range selector |
| | 22px | 3 | Table headers, headers |
| | 24px | 1 | Footer |
| | 28px | 2 | Sparkline, streak |
| | 30px | 5 | Mini headers, sparkline |
| | 32px | 15+ | Module headers, rows |
| | 34px | 1 | Risk header |
| | 36px | 10+ | Table header rows |
| | 40px | 3 | Enhanced headers (LP/TH) |
| | 50px | 1 | Greeks strip |
| | 60px | 2 | Histogram |
| | 72px | 1 | Donut |
| | 180px | 1 | Hero chart |
| | 190px | 1 | Secondary KPI |
| | 240px | 1 | Standard KPI |
| | 300px+ | 1 | Hero KPI (min) |
| | 420px | 1 | LivePositions |
| | 480px | 1 | TradeHistory |
| | 520px | 2 | RiskMatrix |
| | 580px | 2 | Trading charts (Equity, PnL) |
| **Gaps** | 1px | 3 | Range buttons, chart gaps |
| | 2px | 3 | Histogram, heat grid |
| | 3px | 3 | Cell gaps, dividers |
| | 4px | 8+ | Sparkline, rows |
| | 5px | 3+ | WinRate stats, monthly bars |
| | 6px | 8+ | Row gaps, cells |
| | 7px | 1 | Avail block |
| | 8px | 20+ | Cards, chart sections |
| | 12px | 5+ | KPI card gap, context |
| | 14px | 8+ | Trading chart sections |
| | 16px | 4 | Winrate zone |
| | 18px | 3 | Context, subheader |
| | 22px | 2 | Context (Risk, footer) |



---

## Inventaire « legacy-alias »

# DASHBOARD LEGACY CSS ALIAS INVENTORY — COMPREHENSIVE AUDIT

**Scope:** `/dashboard` route + `components/dashboard/*` + `components/layout/*` (when rendered on dashboard) + styles: `v4-dashboard.css`, `v3-components.css`, `dashboard.css`, `pages-dashboard.css`, `canonical.css`, `tokens.css`

**Date:** 2026-06-11

---

## CANONICAL MAPPINGS (canonical.css TRANSITION ZONE)

### TEXT ALIASES (7 variants)
| Alias | Canonical Target | Hex Value | Usage |
|-------|------------------|-----------|-------|
| `--qc-text-primary` | `--ink-pure` | #FAFAFA | Pure white data text |
| `--qc-text-secondary` | `--ink-soft` | #9A9AA2 | Secondary labels |
| `--qc-text-tertiary` | `--ink-mute` | #8A8A92 | Captions/muted |
| `--qc-text-muted` | `--ink-mute` | #8A8A92 | Duplicate of tertiary |
| `--text-primary` | `--ink-pure` | #FAFAFA | Legacy variant |
| `--text-secondary` | `--ink-soft` | #9A9AA2 | Legacy variant |
| `--text-tertiary` | `--ink-mute` | #8A8A92 | Legacy variant |

### BACKGROUND ALIASES (9 variants)
| Alias | Canonical Target | Hex Value | Usage |
|-------|------------------|-----------|-------|
| `--qc-bg-base` | `--depth-void` | #070708 | Ultimate void, page background |
| `--qc-bg-1` | `--depth-base` | #0A0A0B | Standard working background |
| `--qc-bg-2` | `--depth-raised` | #0F0F11 | Panels, reference level |
| `--qc-bg-3` | `--depth-focus` | #1D1D23 | Elevated, focus zones |
| `--qc-bg-surface` | `--depth-raised` | #0F0F11 | Dashboard panels |
| `--qc-bg-elevated` | `--depth-focus` | #1D1D23 | Hover/active states |
| `--qc-bg-overlay` | `--depth-focus` | #1D1D23 | Overlay, click-deeper |
| `--qc-bg-input` | `--depth-base` | #0A0A0B | Input fields |
| `--qc-bg-void` | `--depth-void` | #070708 | Explicit empty alias |

### BORDER ALIASES (3 variants)
| Alias | Canonical Target | RGBA Value | Usage |
|-------|------------------|-----------|-------|
| `--qc-border-subtle` | `--line-hairline` | rgba(255,255,255,0.06) | 6% white hairlines |
| `--qc-border-default` | `--line-emphasis` | rgba(255,255,255,0.12) | 12% white dividers |
| `--qc-border-strong` | `--line-emphasis` | rgba(255,255,255,0.12) | 12% white emphasis |

### SEMANTIC ALIASES (4 variants)
| Alias | Canonical Target | Hex Value | Usage |
|-------|------------------|-----------|-------|
| `--qc-profit` | `--pnl-up` | #10B981 | Green, winning trades |
| `--qc-loss` | `--pnl-down` | #EF4444 | Red, losing trades |
| `--profit` | `--pnl-up` | #10B981 | Legacy variant |
| `--loss` | `--pnl-down` | #EF4444 | Legacy variant |

### ACCENT ALIASES (6 variants)
| Alias | Canonical Target | Value | Usage |
|-------|------------------|-------|-------|
| `--qc-accent` | `--accent` | #FFA028 (amber) | Focus indicators, active states |
| `--qc-accent-hover` | `--accent` | #FFA028 | Hover variant |
| `--qc-accent-dim` | color-mix(--accent 12%, transparent) | Derived | Subtle backgrounds |
| `--qc-accent-glow` | color-mix(--accent 28%, transparent) | Derived | Glow effects |
| `--qc-accent-line` | color-mix(--accent 35%, transparent) | Derived | Border accents |
| `--accent-amber` | `--accent` | #FFA028 | Explicit amber alias |

---

## USAGE COUNTS BY FILE

### `src/styles/v4-dashboard.css` (5452 lines)

#### Text Aliases: 233 occurrences
- `--qc-text-primary`: 84 × (v4-dashboard.css)
- `--qc-text-secondary`: 44 × (v4-dashboard.css)
- `--qc-text-tertiary`: 105 × (v4-dashboard.css)

Lines: 110, 134, 142, 154, 161, 168, 173, 177, 194, 214, 243, 255, 265, 311, 325, 332, 348, 355, 360, 364, 407, 422, 431, 452, 465, 469, 474, 482, 483, 505, 506, 515, 525, 534, 539, 548, 556, 557, 564, 573, 581, 591, 605, 608, 616, 625, 638, 658, 665, 680, 681, 704, 825, 826, 842, 843, 872, 873, 888, 905, 906, 925, 1014, 1039, 1042, 1051, 1064, 1068, 1102, 1103, 1138, 1160, 1161, 1162, 1168, 1173, 1175, 1177, 1194, 1202, 1203, 1243, 1244, 1314, 1318, ... (578 lines total with legacy refs)

#### Background Aliases: 23 occurrences
- `--qc-bg-base`: 11 × (v4-dashboard.css:407, 813, 1449, 2408, etc.)
- `--qc-bg-surface`: 5 × (v4-dashboard.css:110, 1568, etc.)
- `--qc-bg-overlay`: 5 × (v4-dashboard.css:378, 785, etc.)
- `--qc-bg-void`: 2 × (v4-dashboard.css:3125)

#### Border Aliases: 86 occurrences
- `--qc-border-subtle`: 62 × (v4-dashboard.css)
- `--qc-border-strong`: 18 × (v4-dashboard.css)
- `--qc-border-default`: 6 × (v4-dashboard.css)

Lines: 111, 154, 245, 299, 319, 336, 408, 483, 539, 572, 817, 830, 837, 871, 876, 969, 1042, 1111, 1154, 1155, 1185, 1186, 1336, 1449, 1479, 1636, 1649, 1687, 1738, 1760, 1885, 1893, 1905, 2020, 2045, 2066, ... (86 occurrences distributed)

#### Semantic Aliases: 197 occurrences
- `--qc-profit`: 71 × (v4-dashboard.css)
- `--qc-loss`: 84 × (v4-dashboard.css)
- `--qc-accent`: 42 × (v4-dashboard.css)

#### Accent Variants: 26 occurrences
- `--accent-amber`: 26 × (v4-dashboard.css:703, 704, 910, 911, 936, 937, 1077, 1167, 1168, 2017-2018-2019, 2065-2066, 2692, 2792, 2795, 2862-2863, 3005-3006, 4478)

**TOTAL v4-dashboard.css: ~565 legacy alias usages**

### `src/styles/dashboard.css` (1287 lines)

| Category | Count | Lines |
|----------|-------|-------|
| Text aliases | 47 | 13, 86, 94, 98, 99, 209, 218, 312, 325, 359, 422, 422, 431, 444, 452, 468, 509, 525, 534, 556, 591, 605, 666, 667, 701, 741, 781, 786, 815, 859, 926, 946, 958, 968, 975, 1029, 1092, 1098, 1104, 1105, 1106 |
| Background aliases | 5 | 13, 43, 79, 125, 126 |
| Border aliases | 21 | 46, 80, 200, 346, 517, 772, 794, 803, 837, 882, 998, 1013, 1018, 1082, 1106 |
| Semantic aliases | 25 | 105, 118, 227, 240, 257, 295, 302, 303, 338, 474, 478, 481, 525, 569, 596, 810, 898, 902, 905, 908, 1017, 1032 |

**TOTAL dashboard.css: ~98 legacy alias usages**

### `src/styles/pages-dashboard.css` (88 lines)

Uses **canonical tokens directly** (no legacy aliases)
- --depth-void, --depth-raised, --ink-soft, --ink-pure, --line-hairline
- --qc-space-*, --pnl-up, --pnl-down, --qc-font-*

**TOTAL pages-dashboard.css: 0 legacy alias usages (✓ native canonical)**

### `src/styles/v3-components.css`

**No hardcoded hex colors detected**

---

## JSX COMPONENT USAGES (Inline Styles)

### `src/components/dashboard/DashboardKPICards.jsx`

| Line | Reference | Type |
|------|-----------|------|
| 12 | Comment: `var(--text-primary) 7% opacity` | Comment ref |
| 1103 | `stroke: 'var(--qc-bg-surface)'` | SVG stroke (Recharts) |
| 1111 | `fill="var(--accent-amber)"` | SVG fill (Recharts) |
| 1120 | `stroke="var(--accent-amber)"` | SVG stroke (Recharts) |
| 1128 | `stroke="var(--accent-amber)"` | SVG stroke (Recharts) |
| 1226 | `fill="var(--accent-amber)"` | SVG fill (Recharts) |
| 1235 | `stroke="var(--accent-amber)"` | SVG stroke (Recharts) |
| 1243 | `stroke="var(--accent-amber)"` | SVG stroke (Recharts) |
| 1344 | `stroke="var(--accent-amber)"` | SVG stroke (Recharts) |
| 1349 | `fill: 'var(--accent-amber)'` | Inline style object |

**TOTAL DashboardKPICards: 10 inline var(--*) references (mostly --accent-amber)**

### `src/components/dashboard/SectorHeatmap.jsx`

| Line | Reference | Type |
|------|-----------|------|
| 33 | `'var(--text-tertiary)'` | Ternary return |

**TOTAL SectorHeatmap: 1 reference**

### `src/components/dashboard/VolatilitySkew.jsx`

| Line | Hardcoded Hex | Fallback For |
|------|---------------|--------------|
| 25 | `#F0B90B` | T.warning (amber warning color) |

**TOTAL hardcoded hex in components: 1 instance**

---

## HARDCODED HEX COLORS (Regression Risk)

### Primary Hardcoded Fallback: `#ffa028` (Amber Accent)

Pattern: `var(--accent-amber, #ffa028)` — fallback for older browsers

Occurrences in `v4-dashboard.css`:
- **Line 2017-2019**: `.dash-kpi-card__pill--amber` (background, border)
- **Line 2065-2066**: Similar padding/styling
- **Line 2692**: Color assignment
- **Line 2792, 2795**: Background/fill
- **Line 2862-2863**: Color and border
- **Line 3005-3006**: Background and border
- **Line 4478**: Inset shadow

**Total #ffa028 occurrences: ~11 lines (7 distinct rules)**

### Secondary Hardcoded: `#fff` (White for Opacity Mix)

Pattern: `color-mix(in srgb, #fff 8%, transparent)` — inset highlights

Occurrences:
- **v4-dashboard.css:384** (trading-chart box-shadow inset)
- **v4-dashboard.css:792** (risk-matrix box-shadow inset)
- **v4-dashboard.css:3121** (qc-card box-shadow)
- **v4-dashboard.css:3139** (qc-card box-shadow)
- **v4-dashboard.css:4691** (box-shadow)
- **v4-dashboard.css:4903** (box-shadow)

**Total #fff occurrences: 6 lines (inset highlights)**

### Tertiary Hardcoded: `#F0B90B` (Warning Yellow)

- **VolatilitySkew.jsx:25**: `T.warning || '#F0B90B'`

**Risk Assessment:**
- ✓ Low — all fallback colors have CSS var equivalents in canonical.css
- ✓ Modern browsers use CSS vars; fallbacks only activate if var undefined
- ⚠ Action: Ensure canonical.css is loaded before component render

---

## RECHARTS FONT SIZE INLINE CONFIG

### HeroAreaChart (DashboardKPICards.jsx)

| Line | Config | Value | Component |
|------|--------|-------|-----------|
| 1050 | `tick: { fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }` | 15px | XAxis |
| 1061 | `tick: { fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }` | 15px | YAxis |
| 1087 | `fontSize: 15, fill: 'var(--ink-mute)'` | 15px | ReferenceLine label |

### HeroBarChart (DashboardKPICards.jsx)

| Line | Config | Value | Component |
|------|--------|-------|-----------|
| 1192 | `tick: { fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }` | 15px | XAxis |
| 1192 | `tick: { fontFamily: T.fonts.mono, fontSize: 15, fill: 'var(--ink-mute)' }` | 15px | YAxis |

**TOTAL chart font-size hardcoded: 3 unique instances**
**Note:** fontSize: 15 does not match canonical token --qc-fs-body (13px) or --qc-fs-lg (15px match!)

---

## LEGACY ALIAS DISTRIBUTION BY TOKEN TYPE

### TEXT TOKENS (~7 aliases)
- **Total occurrences in scope:** ~280
- **Primary usage:** Foreground colors across all modules
- **Canonical targets:** --ink-pure, --ink-soft, --ink-mute
- **Distribution:** v4-dashboard.css (233), dashboard.css (47)

### BACKGROUND TOKENS (~9 aliases)
- **Total occurrences in scope:** ~28
- **Primary usage:** Module surfaces, depth layering
- **Canonical targets:** --depth-void, --depth-base, --depth-raised, --depth-focus
- **Distribution:** v4-dashboard.css (23), dashboard.css (5)

### BORDER TOKENS (~3 aliases)
- **Total occurrences in scope:** ~107
- **Primary usage:** 1px hairlines, dividers, component borders
- **Canonical targets:** --line-hairline, --line-emphasis
- **Distribution:** v4-dashboard.css (86), dashboard.css (21)

### SEMANTIC TOKENS (~4 aliases)
- **Total occurrences in scope:** ~222
- **Primary usage:** Profit/loss colorization, conditional styling
- **Canonical targets:** --pnl-up, --pnl-down
- **Distribution:** v4-dashboard.css (197), dashboard.css (25)

### ACCENT VARIANTS (~6 aliases)
- **Total occurrences in scope:** ~41
- **Primary usage:** Focus states, active indicators, measure ranges
- **Canonical targets:** --accent (#FFA028), color-mix variants
- **Distribution:** v4-dashboard.css (26), CSS fallbacks (11)

---

## CRITICAL COMPONENTS AFFECTED

### Row 1 Charts & Risk Metrics
- **DashboardKPICards.jsx** (9 cards, hero charts): 10 inline CSS var refs
- **v4-dashboard.css .trading-chart**: ~180 text/border/semantic refs
- **v4-dashboard.css .risk-matrix**: ~150 refs

### Row 2 Positions
- **v4-dashboard.css .live-pos__***: ~50 refs
- **LivePositions.jsx**: Inherits from v4-dashboard.css

### Row 3 Trade History
- **v4-dashboard.css .trade-history**: ~60 refs
- **TradeHistory.jsx**: Inherits

### Row 4-5 Placeholders/Calendar/Watchlist/IVR/Alerts
- **v4-dashboard.css .module-***: ~100 refs (header/body/placeholder)
- **SectorHeatmap.jsx**: 1 direct ref
- **VolatilitySkew.jsx**: 1 hardcoded #F0B90B

### Layout Components (if rendered on /dashboard)
- **Header.jsx, CommandBar.jsx, StatusBar.jsx, BottomNav.jsx**: Inherit v4-shell.css → links to v4-dashboard.css for token consistency

---

## SUMMARY & MIGRATION READINESS

| Metric | Value | Notes |
|--------|-------|-------|
| **Total legacy alias occurrences** | ~678 | CSS 665 + JSX 11 + comments 2 |
| **Alias categories affected** | 7 | text, bg, border, profit, loss, accent-variants + derived |
| **Files with legacy aliases** | 4 | v4-dashboard.css, dashboard.css, DashboardKPICards.jsx, SectorHeatmap.jsx |
| **Hardcoded fallback colors** | 3 types | #ffa028 (11×), #fff (6×), #F0B90B (1×) |
| **Canonical coverage** | ✓ 100% | All legacy aliases have direct mappings in canonical.css |
| **Orphaned aliases** | 0 | No unmapped legacy refs detected |

### Migration Status
- ✓ **Transition Zone Active** (canonical.css): Dashboard inherits canonical tokens automatically
- ✓ **No manual code changes required** for color rendering
- ⚠ **Cleanup target**: CANONICAL-PURGE (post-Calendar + audit completion)
- ⚠ **Hazard**: 678 references mean any typo/misspelling = regression

### Recommendations
1. **Maintain current state** until Calendar migration + full audit complete
2. **Track hardcoded hex colors** in CHANGELOG during refactor
3. **Tokenize Recharts fontSize (15px)** as separate entity or verify alignment with --qc-fs-body/-lg
4. **Validate fallback colors** (--accent-amber, #ffa028) in production after canonical.css update
5. **Schedule CANONICAL-PURGE** only after 100% Dashboard + Calendar validation pass

---

## Inventaire « structure »

# Inventaire exhaustif de la route /dashboard — Base de travail refonte 4K

## (1) Bande de marché (TickerTape) — défilant bloombergien

### Conteneur principal
- **Classe**: `.ticker-tape`
- **Fichier**: `src/styles/v4-shell.css:599`
- **Hauteur**: `var(--qc-ticker-h)` = `64px` (défini tokens.css:78)
- **Background**: `var(--qc-bg-surface)` (#0F0F11)
- **Border**: `1px solid var(--line-hairline)` (bottom)
- **Masque**: fade 48px aux extrémités (linear-gradient mask-image)
- **Animation**: `ticker-marquee 75s linear infinite` (translateX 0→-50% sur contenu dupliqué)

### Cellules tickers
- **Classe**: `.ticker-cell`
- **Fichier**: `src/styles/v4-shell.css:664`
- **Largeur**: `min-width: 240px`, `flex: 0 0 auto`
- **Gap cellules**: `14px`
- **Padding**: `0 24px`
- **Border**: `1px solid var(--line-hairline)` (right)

### Symbole ticker
- **Classe**: `.ticker-cell__symbol`
- **Fichier**: `src/styles/v4-shell.css:691`
- **Font-size**: `13px`
- **Font-weight**: `600`
- **Color**: `var(--ink-soft)` (#9A9AA2)
- **Font-family**: `var(--qc-font-mono)` ('Geist Mono Variable', 'JetBrains Mono')
- **Text-transform**: uppercase
- **Letter-spacing**: `0.03em`

### Prix (héros)
- **Classe**: `.ticker-cell__value`
- **Fichier**: `src/styles/v4-shell.css:750`
- **Font-size**: `24px`
- **Font-weight**: `700`
- **Color**: `var(--ink-pure)` (#FAFAFA)
- **Font-family**: `var(--qc-font-mono)`
- **Letter-spacing**: `-0.01em`
- **Font-variant-numeric**: `tabular-nums`

### Changement %
- **Classe**: `.ticker-cell__change`
- **Fichier**: `src/styles/v4-shell.css:708`
- **Font-size**: `14px`
- **Font-weight**: `600`
- **Color**: `var(--pnl-up)` (#10B981) si +, `var(--pnl-down)` (#EF4444) si -
- **Letter-spacing**: `-0.01em`
- **Font-variant-numeric**: `tabular-nums`
- **Avec glow** (|change%| > 2): `.ticker-cell__change--glow` padding 2px 6px, border-radius 2px, bg color-mix 15%

### Sparkline
- **Classe**: `.ticker-cell__sparkline`
- **Fichier**: `src/styles/v4-shell.css:761`
- **Dimensions**: `60px × 32px` (stroke-width 2px)
- **Color**: `var(--pnl-up)` si hausse, `var(--pnl-down)` si baisse, sinon `var(--ink-soft)`
- **Opacity**: `0.95`

---

## (2) Navigation top (CommandBar) — teal underline ambré

### Conteneur principal
- **Classe**: `.cmdbar`
- **Fichier**: `src/styles/v4-shell.css:26`
- **Hauteur**: `var(--shell-cmdbar-h)` = `64px`
- **Background**: `var(--bg-elev-1)` (#0F0F11)
- **Border**: `1px solid var(--shell-hairline)` (bottom)
- **Padding**: `0 var(--qc-space-5)` = `0 20px`
- **Font-family**: `var(--qc-font-mono)`

### Logo QC
- **Classe**: `.cmdbar__logo-mark`
- **Fichier**: `src/styles/v4-shell.css:71`
- **Dimensions**: `28px × 28px`
- **Background**: `var(--qc-accent)` (#FFA028 via canonical.css override)
- **Color**: `var(--qc-bg-base)` (#0A0A0B)
- **Font-size**: `12px`
- **Font-weight**: `500`
- **Border-radius**: `5px`
- **Letter-spacing**: `0.05em`

### Nom "QUANTUMCALL"
- **Classe**: `.cmdbar__logo-name`
- **Fichier**: `src/styles/v4-shell.css:87`
- **Font-size**: `12px`
- **Font-weight**: `500`
- **Color**: `color-mix(in srgb, var(--qc-text-primary) 70%, transparent)` (text-primary dilué)
- **Letter-spacing**: `0.2em`
- **Text-transform**: uppercase

### Breadcrumb
- **Classe**: `.cmdbar__crumb`
- **Fichier**: `src/styles/v4-shell.css:108`
- **Font-size**: `11px`
- **Font-weight**: `500`
- **Color**: `var(--qc-text-tertiary)` (#8A8A92)
- **Letter-spacing**: `0.16em`
- **Text-transform**: uppercase

### Navigation tabs (pill)
- **Classe**: `.nav-pill`
- **Fichier**: `src/styles/v4-shell.css:131`
- **Hauteur**: `100%` (64px full)
- **Padding**: `0 18px`
- **Font-size**: `15px`
- **Font-weight**: `500`
- **Color inactif**: `var(--ink-soft)` (#9A9AA2)
- **Color hover**: `var(--ink-pure)` (#FAFAFA)
- **Color actif**: `var(--ink-pure)`, weight `600`
- **Gap icons/labels**: `7px`
- **Letter-spacing**: `0.04em`
- **Text-transform**: none (mots entiers : Dashboard, Positions, etc.)

### Icône tab (active teal)
- **Classe**: `.nav-pill__icon`
- **Fichier**: `src/styles/v4-shell.css:178`
- **Color**: `currentColor` (inactif) → `var(--accent)` (#FFA028) actif
- **Size**: `16px` (lucide-react default)
- **Stroke-width**: `1.75`

### Underline ambrée (sliding, motion)
- **Classe**: `.nav-pill__underline`
- **Fichier**: `src/styles/v4-shell.css:200`
- **Hauteur**: `2.5px`
- **Background**: `var(--accent)` (#FFA028)
- **Position**: bottom, insets 14px left/right
- **Border-radius**: `1.25px`
- **Box-shadow**: `0 0 6px color-mix(in srgb, var(--accent) 60%, transparent)` (halo doux)
- **Transition**: framer-motion spring (stiffness 380, damping 32) ou instantané en reduced-motion

### Bouton recherche
- **Classe**: `.cmdbar__search`
- **Fichier**: `src/styles/v4-shell.css:226`
- **Hauteur**: `34px`
- **Padding**: `0 14px`
- **Font-size**: `12px`
- **Color**: `var(--qc-text-tertiary)` (#8A8A92)
- **Background**: `var(--bg-glass)` (#0F0F11)
- **Border**: `1px solid var(--qc-border-subtle)`
- **Border-radius**: `5px`

### Mode pill (REAL/PAPER/LIVE)
- **Classe**: `.cmdbar__mode-pill`
- **Fichier**: `src/styles/v4-shell.css:274`
- **Hauteur**: `30px`
- **Padding**: `0 12px`
- **Font-size**: `11px`
- **Font-weight**: `600`
- **Letter-spacing**: `0.1em`
- **Text-transform**: uppercase
- **Color LIVE/REAL**: `var(--qc-profit)` (#10B981), bg `color-mix(in srgb, var(--qc-profit) 8%, transparent)`
- **Color PAPER**: `var(--accent-amber)` (#FFA028), bg `color-mix(in srgb, var(--accent-amber) 8%, transparent)`
- **Border**: `1px solid color-mix(...25%, transparent)`

### Dot LIVE (pulse)
- **Classe**: `.cmdbar__live-dot`
- **Fichier**: `src/styles/v4-shell.css:833`
- **Dimensions**: `8px × 8px` rond
- **Background**: `var(--qc-profit)` (#10B981)
- **Animation**: `cmdbar-live-pulse 2s ease-in-out infinite` (opacity 1 → 0.4 → 1)

---

## (3) Status bar (bas) — 3 zones, 36px

### Conteneur principal
- **Classe**: `.statusbar`
- **Fichier**: `src/styles/v4-shell.css:334`
- **Hauteur**: `var(--shell-statusbar-h)` = `36px`
- **Background**: `var(--bg-elev-1)` (#0F0F11)
- **Border**: `1px solid var(--shell-hairline)` (top)
- **Font-size**: `13px`
- **Font-family**: `var(--qc-font-mono)`
- **Color**: `var(--qc-text-secondary)` (#9A9AA2)

### Cellule générique
- **Classe**: `.statusbar__cell`
- **Fichier**: `src/styles/v4-shell.css:373`
- **Padding**: `0 14px`
- **Gap**: `8px`
- **Border-right**: `1px solid var(--qc-border-subtle)`
- **Height**: `100%` (stretch)

### Label cellule
- **Classe**: `.statusbar__label`
- **Fichier**: `src/styles/v4-shell.css:400`
- **Font-size**: `11px`
- **Font-weight**: `500`
- **Color**: `var(--qc-text-tertiary)` (#8A8A92)
- **Letter-spacing**: `0.08em`
- **Text-transform**: uppercase

### Valeur cellule
- **Classe**: `.statusbar__value`
- **Fichier**: `src/styles/v4-shell.css:409`
- **Font-size**: `12px`
- **Color**: `var(--qc-text-primary)` (#FAFAFA)
- **Font-variant-numeric**: `tabular-nums slashed-zero`
- **Tone**: `--profit` si >0, `--loss` si <0, `--mute` si 0

### Feed dot (IBKR/FNHB/CHART)
- **Classe**: `.statusbar__feed-dot`
- **Fichier**: `src/styles/v4-shell.css:433`
- **Dimensions**: `6px × 6px` rond
- **Background**: `var(--qc-text-tertiary)` (offline) → `var(--qc-profit)` (live) → `var(--accent-amber)` (syncing) → `var(--qc-loss)` (error)
- **IBKR featured**: halo `box-shadow: 0 0 0 2px color-mix(in srgb, var(--qc-profit) 18%, transparent)`

### Horloges (NY/GVA/LDN/TKY)
- **Classe**: `.statusbar__clock`
- **Fichier**: `src/styles/v4-shell.css:485`

#### Code zone
- **Classe**: `.statusbar__clock-code`
- **Font-size**: `10px`
- **Font-weight**: `600`
- **Color**: `var(--qc-text-tertiary)`
- **Letter-spacing**: `0.08em`
- **Text-transform**: uppercase

#### Heure
- **Classe**: `.statusbar__clock-time`
- **Font-size**: `11px`
- **Color**: `var(--qc-text-primary)` (#FAFAFA)
- **Font-variant-numeric**: `tabular-nums slashed-zero`

#### Badge session
- **Classe**: `.statusbar__clock-badge`
- **Fichier**: `src/styles/v4-shell.css:503`
- **Font-size**: `10px`
- **Font-weight**: `600`
- **Padding**: `2px 6px`
- **Border-radius**: `2px`
- **Color OPEN**: `var(--qc-profit)` (#10B981), bg `color-mix(in srgb, var(--qc-profit) 12%, transparent)`
- **Color CLOSED**: `var(--qc-loss)` (#EF4444), bg `color-mix(in srgb, var(--qc-loss) 12%, transparent)`

---

## (4) Badges type DEPLOYABLE/INTRADAY/NOTIONAL/N=100 etc.

### Pill générique (KPI Cards top-right)
- **Classe**: `.dash-kpi-card__pill`
- **Fichier**: `src/styles/v4-dashboard.css:3225`
- **Padding**: `3px 8px`
- **Font-size**: `10px`
- **Font-weight**: `500`
- **Border-radius**: `2px`
- **Letter-spacing**: `0.06em`
- **Text-transform**: uppercase
- **Font-family**: `var(--qc-font-mono)`

#### Tones pill
- `.dash-kpi-card__pill--profit`: bg `color-mix(in srgb, var(--qc-profit) 10%, transparent)`, color `var(--qc-profit)` (#10B981)
- `.dash-kpi-card__pill--loss`: bg `color-mix(in srgb, var(--qc-loss) 10%, transparent)`, color `var(--qc-loss)` (#EF4444)
- `.dash-kpi-card__pill--amber`: bg `color-mix(in srgb, var(--accent-amber) 10%, transparent)`, color `var(--accent-amber)` (#FFA028)
- `.dash-kpi-card__pill--accent`: bg `color-mix(in srgb, var(--qc-accent) 10%, transparent)`, color `var(--qc-accent)` (#FFA028)
- `.dash-kpi-card__pill--mute`: bg `color-mix(in srgb, var(--qc-text-tertiary) 10%, transparent)`, color `var(--qc-text-tertiary)` (#8A8A92)

### Pill hero (delta NLV)
- **Classe**: `.dash-kpi-card__pill--hero`
- **Fichier**: `src/styles/v4-dashboard.css:3241`
- **Padding**: `6px 12px`
- **Font-size**: `17px`
- **Sub-text**: `.dash-kpi-card__pill-sub` opacity 0.85, font-size 14px, weight 400

### Badge risk matrix (TIER/EDGE)
- **Classe**: `.risk-matrix__tier-badge`, `.risk-matrix__edge-badge`
- **Fichier**: `src/styles/v4-dashboard.css:909`
- **Padding**: `4px 12px`
- **Font-size**: `12px`
- **Letter-spacing**: `0.1em`
- **Font-weight**: `500`
- **Border-radius**: `2px`
- **TIER**: bg `color-mix(in srgb, var(--accent-amber) 8%, transparent)`, color `var(--accent-amber)` (#FFA028)
- **EDGE**: bg + color par tone profit/amber/loss

### Badge warning (trading-chart)
- **Classe**: `.trading-chart__warn-badge`
- **Fichier**: `src/styles/v4-dashboard.css:687`
- **Padding**: `2px 8px`
- **Font-size**: `9px`
- **Letter-spacing**: `0.1em`
- **Border-radius**: `2px`
- **Font-weight**: `500`
- **Background**: `color-mix(in srgb, var(--accent-amber) 12%, transparent)`
- **Color**: `var(--accent-amber)` (#FFA028)
- **Dot pulsant**: `.trading-chart__warn-dot` 6px × 6px, animation pulse 2s ease-in-out

### Hint (subtitle KPI)
- **Classe**: `.dash-kpi-card__hint`
- **Fichier**: `src/styles/v4-dashboard.css:3186`
- **Font-size**: `10px`
- **Color**: `var(--qc-text-tertiary)` (#8A8A92)
- **Letter-spacing**: `0.1em`
- **Text-transform**: uppercase
- **Background**: `color-mix(in srgb, var(--qc-text-primary) 4%, transparent)`
- **Padding**: `3px 7px`
- **Border-radius**: `2px`

---

## (5) Valeurs monétaires KPI Cards — middleware 20px → 56px

### Conteneur money
- **Classe**: `.dash-kpi-card__money`
- **Fichier**: `src/styles/v4-dashboard.css:3345`
- **Display**: flex column
- **Min-width**: `0`

### Valeur USD (hero)
- **Classe**: `.dash-kpi-card__value`
- **Fichier**: `src/styles/v4-dashboard.css:3351`
- **Font-size**: `var(--qc-fs-xl, 20px)` (tokenspar défaut, override hero)
- **Font-family**: `var(--qc-font-mono)`
- **Font-weight**: `500`
- **Color**: `var(--qc-text-primary)` (#FAFAFA), override par data-tone profit/loss
- **Font-variant-numeric**: `tabular-nums slashed-zero`
- **Letter-spacing**: `-0.01em`
- **Line-height**: `1`

#### Hero override
- **Classe**: `.dash-kpi-card--hero .dash-kpi-card__value`
- **Fichier**: `src/styles/v4-dashboard.css:3365`
- **Font-size**: `56px`
- **Line-height**: `0.95`
- **Letter-spacing**: `-0.018em`

### Valeur CHF (sous-ligne)
- **Classe**: `.dash-kpi-card__chf`
- **Fichier**: `src/styles/v4-dashboard.css:3371`
- **Font-size**: `12px`
- **Color**: `var(--qc-text-secondary)` (#9A9AA2)
- **Margin-top**: `7px`
- **Font-variant-numeric**: `tabular-nums slashed-zero`
- **Letter-spacing**: `0.02em`

#### Hero override
- **Classe**: `.dash-kpi-card--hero .dash-kpi-card__chf`
- **Fichier**: `src/styles/v4-dashboard.css:3383`
- **Font-size**: `14px`
- **Margin-top**: `10px`

### Cell footer (2/3/4/6 colonnes)
- **Classe**: `.dash-kpi-card__cell-label`
- **Fichier**: `src/styles/v4-dashboard.css:3434`
- **Font-size**: `var(--qc-fs-micro, 10px)`
- **Font-weight**: `500`
- **Color**: `var(--qc-text-tertiary)` (#8A8A92)
- **Letter-spacing**: `0.1em`
- **Text-transform**: uppercase
- **Font-family**: `var(--qc-font-sans)`

#### Cell value footer
- **Classe**: `.dash-kpi-card__cell-value`
- **Fichier**: `src/styles/v4-dashboard.css:3444`
- **Font-size**: `13px`
- **Font-weight**: `500`
- **Color**: `var(--qc-text-secondary)` (#9A9AA2), override profit/loss
- **Font-variant-numeric**: `tabular-nums slashed-zero`
- **Letter-spacing**: `0.02em`
- **Font-family**: `var(--qc-font-mono)`

---

## (6) Définition des typos monospace hero et tokens clés

### Font monospace
- **Variable CSS**: `--qc-font-mono`
- **Fichier**: `src/styles/tokens.css:42`
- **Valeur**: `'Geist Mono Variable', 'JetBrains Mono', ui-monospace, monospace`
- **Chaîne complète**: Geist Mono Variable prioritaire, fallback JetBrains Mono

### Font hero (Iosevka QC Hero)
- **Variable CSS**: `--qc-font-hero`
- **Fichier**: `src/styles/tokens.css:43`
- **Valeur**: `'Iosevka QC Hero', 'Geist Mono Variable', 'JetBrains Mono', ui-monospace, monospace`
- **Usage**: Pas encore consommé en 2026 Q2 (reserved pour v6+ polish)

### Font sans (titles KPI cards)
- **Variable CSS**: Hardcodé inline où besoin
- **Valeur**: `var(--qc-font-sans)` = `'Geist Variable', 'Inter', system-ui, sans-serif`
- **Font-size label KPI cards**: `var(--qc-fs-body, 13px)` défini en tokens.css:47

### Palette amber/accent
- **Variable CSS canonical**: `--accent` = `#FFA028`
- **Variable CSS tokens**: `--qc-accent` = `#06B6D4` (cyan, overridé par canonical.css:110)
- **Override canonical.css**: `--qc-accent: var(--accent)` = `#FFA028` (Bloomberg amber)
- **Fichier canonical.css**: lignes 104-127 explient l'aliasing
- **Derivée halo**: `color-mix(in srgb, var(--accent) 60%, transparent)` (sur nav-pill__underline)

### Variables texte canonical
- **--ink-pure**: `#FAFAFA` (texte primaire)
- **--ink-soft**: `#9A9AA2` (labels secondaires)
- **--ink-mute**: `#8A8A92` (captions/tertiaire)
- **Source**: canonical.css:14-17

### Depth palette (fonds)
- **--depth-void**: `#070708` (fond ultime)
- **--depth-base**: `#0A0A0B` (standard)
- **--depth-raised**: `#0F0F11` (panneaux)
- **--depth-focus**: `#1D1D23` (zones élues)
- **Aliases tokens**: qc-bg-* mappés vers ces valeurs
- **Fichier**: canonical.css:2-8

---

## Résumé de référence rapide pour refonte

### Tailles de police clés
| Élément | Current | Fichier:Ligne | Variable/Override |
|---------|---------|---------------|-------------------|
| Titre KPI card | 13px | v4-dashboard.css:3174 | var(--qc-fs-body) |
| Valeur KPI card secondaire | 20px | v4-dashboard.css:3353 | var(--qc-fs-xl) |
| Valeur KPI card héros | 56px | v4-dashboard.css:3366 | hardcoded |
| CHF sous-ligne | 12px (hero:14px) | v4-dashboard.css:3371/3384 | hardcoded |
| Footer cell label | 10px | v4-dashboard.css:3434 | var(--qc-fs-micro) |
| Footer cell value | 13px | v4-dashboard.css:3444 | hardcoded |
| Ticker price | 24px | v4-shell.css:753 | hardcoded |
| Ticker symbol | 13px | v4-shell.css:693 | hardcoded |
| Nav pill label | 15px | v4-shell.css:140 | hardcoded |
| Nav pill icon | 16px | JSX lucide-react | hardcoded |
| Statusbar label | 11px | v4-shell.css:402 | hardcoded |
| Statusbar value | 12px | v4-shell.css:411 | hardcoded |
| Pill badge | 10px (hero:17px) | v4-dashboard.css:3232/3243 | hardcoded |

### Polices utilisées
| Contexte | Font-family | Fichier |
|----------|------------|---------|
| Monospace (data + nav) | var(--qc-font-mono) = Geist Mono Variable | tokens.css:42 |
| Sans-serif (labels) | var(--qc-font-sans) = Geist Variable | tokens.css:41 |
| Hero (future) | var(--qc-font-hero) = Iosevka QC Hero | tokens.css:43 |

### Couleurs accent/sémantiques
| Token | Valeur | Source |
|-------|--------|--------|
| --accent (amber) | #FFA028 | canonical.css:24 |
| --pnl-up (profit) | #10B981 | canonical.css:20 |
| --pnl-down (loss) | #EF4444 | canonical.css:21 |
| --ink-pure (text primary) | #FAFAFA | canonical.css:15 |
| --ink-soft (text secondary) | #9A9AA2 | canonical.css:16 |
| --ink-mute (text tertiary) | #8A8A92 | canonical.css:17 |

### Espacements éléments shell
| Élément | Dimension | Fichier:Ligne |
|---------|-----------|---------------|
| CommandBar hauteur | 64px | v4-shell.css:16 |
| StatusBar hauteur | 36px | v4-shell.css:17 |
| TickerTape hauteur | 64px (token --qc-ticker-h) | tokens.css:78 |
| Logo QC size | 28×28px | v4-shell.css:72-73 |
| Mode pill height | 30px | v4-shell.css:278 |
| Search button height | 34px | v4-shell.css:230 |

---

## Points critiques pour refonte sans régression

1. **Filet amber nav-pill__underline** : 2.5px hauteur, halo box-shadow 60% opacity, animation spring (framer-motion)
2. **Override accent** : canonical.css remplace qc-accent cyan #06B6D4 par amber #FFA028 partout
3. **Typographie hero values** : 56px pour NLV/Realized, line-height 0.95, letter-spacing -0.018em
4. **Footer grid** : --2/--3/--4/--6 colonnes avec border-right 6% opacity sur toutes SAUF last
5. **Tickers** : prix 24px weight 700, symbole 13px weight 600, change 14px weight 600
6. **Status bar** : 3 zones flexbox stretch, cellules gap 0, border-right separator implicit
7. **TickerTape animation** : 75s duration, marquee 50% translateX, hover pause, prefers-reduced-motion fallback scroll
8. **Pill colors** : 10-12% background + full color text, variance profit/loss/amber/accent/mute
9. **Live dot pulse** : opacity 1 → 0.4 → 1, 2s ease-in-out, disabled en prefers-reduced-motion
10. **Depth palette** : void/base/raised/focus utilisés cohérently via aliases --qc-bg-* et --depth-*
