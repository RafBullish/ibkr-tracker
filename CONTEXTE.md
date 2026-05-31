# QuantumCall — Fiche de contexte projet

## 1. Ce qu'est QuantumCall

QuantumCall (repo `ibkr-tracker`, package `quantumcall` v2.0.0) est un **tracker
d'options personnel mono-utilisateur** pour Interactive Brokers, construit autour
d'une stratégie maison **Sniper OTM v1.0 Finale** (matrice E0–E4 × C1–C5, gates
SL35 / DTE45 / EARN-J2 / EARN+J30 / TP+TRAIL, stratégie définie ; démarrage réel
en réévaluation avec encadrement médical, sept. 2026).
Pas de back-end : c'est une **SPA React 19 + Vite 7** où **tout l'état vit en
localStorage** via un store **zustand** + reducer + chaîne de migrations
versionnées. Déployée sur **Vercel** (`vercel.json`), avec quelques routes
Vercel serverless dans `api/` (proxies CBOE / FX / earnings). Lecture broker via
import **IBKR Flex** historiquement, et depuis peu via un **pont local IBKR
Gateway** (read-only, paper port 4002) qui injecte NLV + positions live.

## 2. Stack & archi

- **Front** : React 19 + Vite 7 + React Router 7, Recharts 3, Radix UI
  (dialog/tooltip/dropdown), `@tanstack/react-table` + `react-virtual`,
  framer-motion, `@number-flow/react`, `lucide-react`, `date-fns`.
- **Polices** : Geist / Geist-Mono / JetBrains Mono / Inter-Tight (fontsource).
- **État** : `src/store/useStore.js` (zustand, sélecteurs granulaires) +
  `src/store/reducer.js` (actions style Redux : `ADD_POSITION`, `SYNC_IBKR`,
  `SET_GW_AUTO_CONNECT`, …) + `src/store/migrations.js` (schema versionné,
  clé `ibkr_schema_v`, migrations pures jamais supprimées).
- **Persistance localStorage** : `ibkr_u_o` (open), `ibkr_u_c` (closed),
  `ibkr_u_f` (cash flows), `ibkr_u_j` (journal), `ibkr_u_s` (settings).
- **Utils** : `src/utils/` (calculations, positions, equity, greeks, risk,
  sniperMeta, ibkr/, options/, metrics/, fx/, trades/…).
- **Hooks** : ~30 hooks dans `src/hooks/` (useLivePositions, usePortfolioMetrics,
  useIbkrLive, useFx, useSniperGates, useDailyKillSwitch, etc.).
- **Pages** : Dashboard, PreMarketBriefing, `trading/` (Positions, Chain, Greeks,
  History, HistoryDistribution), `insights/` (Analytics, Calendar, Journal),
  `settings/` (General, Api, Import).
- **Bridge IBKR** : dossier `bridge/` (Python, indépendant de `src/` et `api/`,
  read-only, ne se branche qu'en local en dev).
- **API serverless** : `api/` (Vercel functions, joué en dev par middleware
  `vercelDevApi` dans `vite.config.js`).
- **Tests** : `vitest` configuré, mais voir §6 — on en écrit plus.

## 3. Modèle de données essentiel

La **source de vérité du shape** est le bloc de commentaires en tête de
`src/store/migrations.js` (lignes 15–115). Ne jamais ajouter une clé sans
l'inscrire ici. Deux entités partagent un noyau :

**Noyau commun (Position + ClosedTrade)** — toutes les valeurs numériques sont
stockées en **string** (héritage parser Flex) :

- `id`, `as` (`Option`|`Action`), `dir` (`Long`|`Short`)
- `tk` ticker · `ty` (`CALL`|`PUT`|`''`) · `st` strike · `ex` expiry ISO
- `ct` contracts · `mu` multiplier (100 pour options)
- `pi` prime d'entrée (USD/share) · `fi` commission d'entrée USD
- `fxi` taux USD→CHF à l'entrée
- `dteAtEntry` (number|null) — DTE de l'entrée
- `deltaAtEntry`, `ivAtEntry`, `ivRankAtEntry` — **toujours null** tant qu'aucune
  source de spot historique n'est branchée (bloc "FIELDS AWAITING SPOT")
- `exitReason` : null | `tp_50` | `sl_35` | `dte_45` | `pre_earnings` |
  `stagnation` | `manual` | `unknown`

**Open Position seule** : `di` (entry date), `pc` (mark price), `rk`, `su`,
`lots[]` (sub-lots FIFO `{ct,pi,fi,di,fxi}`), champs `_ibkr*` privés
(stripés au merge / dedup).

**Closed Trade seul** : `di`, `do` (close date), `po` (exit premium),
`fo` (exit commission), `fxo`, `pnl` (USD signé), `cm` (commissions totales).

**Flags de migration** : `_deltaApproximated: true` posé par la migration v1→v2
sur les trades pré-existants pour permettre une ré-enrichissement quand un
historique de spot sera disponible.

Settings persistés sous clés courtes : `r` (liveRate), `rm` (fxMode),
`rt` (fxLastUpdated), `rs` (fxSource), `ic` (initialCapitalChf), `ds`
(dailySnapshots), `cashReport`, `ibkrLiveData`, `ibkrSummary`, `ibkrLedger`,
`gwAutoConnect`, `lastSync`.

## 4. Intégration IBKR Live (terminée)

**Archi deux processus** (la fusion single-process avait causé un conflit
d'event-loop aiohttp / ib_async — ne JAMAIS refusionner) :

```
bridge/ibkr_poller.py  ──► snapshot.json (atomique : .tmp + os.replace, ~5s)
        │
        ▼
IB Gateway 127.0.0.1:4002 (PAPER, Read-Only API cochée)

bridge/serve.py        ──► HTTP 127.0.0.1:8765  routes /health · /account
                            (stdlib http.server, ZÉRO asyncio, ZÉRO dep)
```

- **Lanceur unique** : `start.bat` à la racine → `python bridge/launch.py`
  démarre **trois sous-processus préfixés** : `[poller]`, `[serve]`, `[vite]`.
  Un seul `Ctrl-C` les arrête proprement (`CTRL_BREAK_EVENT` → fallback
  `taskkill /F /T` après 5s).
- **Côté front** : proxy Vite `/ibkr → http://127.0.0.1:8765` (chemin
  same-origin pour ne pas violer le CSP `connect-src 'self'`).
- **Hook** : `src/hooks/useIbkrLive.js` poll `/ibkr/account` toutes les
  `POLLING.IBKR_LIVE_MS`, gating sur `settings.gwAutoConnect`, pause sur
  `document.hidden`. Dispatch **uniquement si** `status==='ok' && connected===true`.
- **Action** : `SYNC_IBKR` dans `reducer.js`. Champs absents (positions vides,
  cashFlows, ledger, fxRate) **ne sont jamais écrasés** — anti-régression sur
  imports Flex / saisies manuelles. Renseigne `settings.ibkrLiveData`,
  `settings.ibkrSummary`, `settings.lastSync`.
- **Cascade NLV** dans `src/utils/calculations.js` : **tier (1)** = bridge live
  frais (< `FRESHNESS.LIVE_DATA_MAX_AGE_MS`) → surclasse tout ; **tier (2)** =
  Flex `cashReport` ; **tier (3)** = reconstruction depuis cashFlows +
  closedTrades + openPositions. Les utilisateurs sans bridge ont zéro
  changement de comportement.
- **Badge LIVE** dans `CommandBar.jsx`, piloté par `ibkrLiveData`. **Toggle
  `gwAutoConnect`** dans **Réglages → API** : coupe le live sans toucher au
  bridge.
- **Carte IBKR Live** : 8e service dans `useApiStatus`, statut dérivé du même
  `ibkrLiveData` que le badge (cohérent par construction).
- **Champs volontairement nuls sur snapshot live** (à NE PAS confondre avec
  des bugs) : `fi="0"`, `fxi="0"`, `di=""`, `dteAtEntry=null`,
  `deltaAtEntry/ivAtEntry/ivRankAtEntry=null`, `pc=pi` si pas de market data
  paper.
- **Sécurité** : tout est read-only (paper + `readonly=True` dans la connexion
  ib_async + "Read-Only API" coché côté Gateway). En prod Vercel, le chemin
  `/ibkr` n'existe simplement pas — l'app retombe silencieusement sur
  Flex/manuel.

## 5. Design System — « Brutalisme Financier »

**Source unique de vérité** : `src/styles/canonical.css`. Toute valeur visuelle
non triviale doit en sortir. `src/theme/tokens.js` reste pour
ErrorBoundary / CommandPalette / WinRateDonut / ThemeSwitcher mais sera purgé.

**Palette canonique** (tokens primaires) :

| Token              | Valeur     | Usage                                         |
|--------------------|------------|-----------------------------------------------|
| `--depth-void`     | `#070708`  | Fond ultime (wrapper de page)                 |
| `--depth-base`     | `#0A0A0B`  | Fond de travail standard                      |
| `--depth-raised`   | `#0F0F11`  | Panneaux (référence)                          |
| `--depth-focus`    | `#1D1D23`  | Zones élues, hover, sélection                 |
| `--depth-focus-line` | `rgba(255,160,40,0.50)` | Filet amber des zones focus    |
| `--line-hairline`  | `rgba(255,255,255,0.06)` | Séparateur murmuré              |
| `--line-emphasis`  | `rgba(255,255,255,0.12)` | Séparateur affirmé              |
| `--ink-pure`       | `#FAFAFA`  | Données pures                                 |
| `--ink-soft`       | `#9A9AA2`  | Labels secondaires                            |
| `--ink-mute`       | `#74747C`  | Captions / tertiaire                          |
| `--pnl-up`         | `#10B981`  | Gain monétaire réel                           |
| `--pnl-down`       | `#EF4444`  | **Perte monétaire RÉELLE uniquement**         |
| `--accent`         | `#FFA028`  | Bloomberg amber, **signal décisionnel**       |

**Typo** : mono partout (`var(--qc-font-mono)`). Tailles : caption 11px,
body 13px, display 24px, hero 44px.

**Règles sémantiques de couleur** (cohérentes sur toutes les pages) :

- **Rouge `--pnl-down`** = **uniquement une perte d'argent réelle** (jour PnL <0,
  monthTotal négatif, worst trade, P&L unrealized négatif). Jamais une catégorie
  neutre, jamais un "PUT", jamais un theta — un theta négatif est rouge parce
  qu'il représente une décroissance monétaire, pas par convention de couleur.
- **Vert `--pnl-up`** = gain d'argent réel. Mêmes règles inversées.
- **Amber `--accent`** = signal décisionnel (today marker, action, macro
  events, focus utilisateur). Jamais un PnL.
- **Ink-soft** = catégories neutres (badges CALL/PUT, Δ/Γ/ν par défaut,
  symboles).
- **Bleu STK** `#42A5F5` résiduel toléré, vague cyan séparée.

**Glassmorphism** dérivé des tokens (pas de valeurs ad-hoc). Une zone de
transition `--qc-*` / `--text-*` / `--qc-bg-*` cascade vers les tokens
canoniques pour ne pas casser les ~570 occurrences legacy du Dashboard —
**ne pas consommer ces alias dans du code neuf**, ils seront purgés
(CANONICAL-PURGE).

**Thèmes JS** (`src/theme/themes.js`) : deux clés seulement, `midnight` (default
dark) et `daylight`. Carbon/Phosphor/Slate et 8 anciennes clés legacy sont
migrées vers `midnight` via `LEGACY_MAP`. Toutes les paires fg/bg sont
**vérifiées WCAG AA ≥ 4.5:1**.

## 6. Règles de travail

- **Pas de tests** — choix délibéré. Pas de nouvelle suite vitest. La couverture
  existante reste, on ne la grossit pas.
- **Livraison page par page**, brique par brique. Une page à la fois, validée
  visuellement avant de passer à la suivante.
- **Qualité avant vitesse**. Si une spec est techniquement fausse, **flag avant
  de coder** — ne pas implémenter en silence un truc cassé.
- **Additif uniquement** : ne pas casser l'existant. Une nouvelle feature ne
  doit pas régresser une page déjà livrée. Cascade NLV tier (1) → (3) est
  l'exemple canonique : les utilisateurs sans bridge voient zéro changement.
- **Zoom navigateur ~90%**. Tous les réglages et textes (en particulier
  Settings → API/General/Import et les badges/strips) doivent rester lisibles
  et cliquables à ce zoom. Pas de texte 10px qui devient 9px effectif.
- **Locale** : `de-CH` pour les nombres / dates côté UI.
- **Mono partout** : la typo de l'app est monospace par décision DA, ne pas
  ré-introduire de sans-serif sauf dans les chips/labels secondaires explicites.

## 7. Ce qui reste à faire

Voir `CHANTIER.md` à la racine du projet — carte détaillée page par page,
tableau récapitulatif et ordre recommandé de finition.
