# QuantumCall

> Tracker d'options personnel mono-utilisateur pour Interactive Brokers.
> SPA React, état 100 % local, déployée sur Vercel.

**Version** `2.0.0` · **Repo** `ibkr-tracker` · **Package** `quantumcall` · **Live** https://ibkr-tracker-delta.vercel.app

---

## Ce que c'est

QuantumCall est un tableau de bord et journal de trading personnel, construit autour
d'une stratégie maison **Sniper OTM** (calls OTM joués **en prime uniquement** — jamais
à l'exercice ; focus delta / vega / theta / mouvement de prime, jamais la probabilité de
profit à l'échéance). Le démarrage réel du système est en réévaluation avec encadrement
médical (sept. 2026) — l'app, elle, est complète et en production.

Pas de back-end : c'est une **SPA React 19 + Vite 7** où **tout l'état vit en
`localStorage`**, via un store **Zustand** + reducer + une chaîne de migrations
versionnées. Les seules fonctions serveur sont quelques **routes Vercel serverless**
(`api/`) qui jouent les proxys de données de marché (Finnhub, CBOE, FX, earnings).
Les données broker arrivent par **import IBKR Flex** et, en dev, par un **pont local
IBKR Gateway** (read-only, paper) qui injecte NLV + positions live.

## Stack

| Domaine | Choix |
|---|---|
| Front | React 19 · Vite 7 · React Router 7 |
| État | Zustand (sélecteurs granulaires) + reducer style Redux + migrations versionnées |
| Données / tables | Recharts 3 · `@tanstack/react-table` + `react-virtual` |
| UI | Radix (dialog/tooltip/dropdown) · framer-motion · `@number-flow/react` · lucide-react · date-fns |
| Polices | Geist · Geist-Mono · JetBrains Mono · Inter-Tight (fontsource) |
| Serverless | Vercel functions (`api/`), jouées en dev par le middleware `vercelDevApi` de `vite.config.js` |
| Bridge IBKR | `bridge/` — Python, 2 processus, read-only, **local dev uniquement** |
| Tests | Vitest |
| Langage | JavaScript pur (pas de TypeScript) |

Ordre de grandeur : ~185 fichiers `src/`, ~36 200 lignes · 58 composants · 29 hooks ·
13 pages · 10 endpoints serverless (+3 helpers) · 3 slices de store.

## Démarrage

**Prérequis** : Node 18+ et npm.

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env      # puis renseigner les clés (voir ci-dessous)

# 3. Dev (front seul)
npm run dev               # http://localhost:5173

# 4. Build de production
npm run build             # sortie dans dist/

# 5. Prévisualiser le build
npm run preview

# 6. Tests
npm test                  # vitest run (233 tests)
```

**Dev avec données IBKR live** (Windows) : `start.bat` à la racine lance le pont
+ Vite ensemble (`python bridge/launch.py` → 3 sous-processus `[poller]` `[serve]`
`[vite]`, arrêtés proprement par un seul `Ctrl-C`). Le pont est read-only et n'existe
qu'en local — en prod Vercel le chemin `/ibkr` n'existe pas, l'app retombe
silencieusement sur Flex / saisie manuelle.

### Variables d'environnement

Toutes **côté serveur uniquement** — ne jamais préfixer en `VITE_` (fuite dans le
bundle), sauf les feature flags ON/OFF.

| Variable | Requise | Rôle |
|---|---|---|
| `FINNHUB_KEY` | ✅ | Quotes, earnings, données éco. Clé gratuite sur finnhub.io |
| `TWELVE_DATA_KEY` | — | Fallback FX USD/CHF (sinon Frankfurter/ECB, gratuit, sans clé) |
| `ALLOWED_ORIGINS` | ✅ (prod) | Origines front autorisées (CORS strict, pas de fallback permissif) |
| `VITE_FEATURE_GREEK_CENTER` | — | Feature flag UI (exposé au bundle, jamais de secret ici) |

## Structure

```
src/
  pages/          13 pages : Dashboard, PreMarketBriefing,
                  trading/ (Positions, Chain, Greeks, History, HistoryDistribution),
                  insights/ (Analytics, Calendar, Journal),
                  settings/ (General, Api, Import)
  components/     58 composants (dashboard/, charts/, layout/, ui/…)
  hooks/          29 hooks (useLivePositions, usePortfolioMetrics, useIbkrLive, useFx,
                  useSniperGates, useDailyKillSwitch…)
  store/          useStore.js (Zustand) + reducer.js + migrations.js (schéma versionné)
  utils/          calculations, equity, greeks, risk, sniperMeta +
                  ibkr/ · options/ · metrics/ · fx/ · trades/
  styles/         canonical.css (source de vérité visuelle) + thèmes tokenisés
  theme/          themes.js (midnight / daylight, WCAG AA ≥ 4.5:1)
api/              10 endpoints serverless + 3 helpers (_cors, _rateLimit, _yahooAuth)
bridge/           pont IBKR Gateway local (Python, read-only) — voir bridge/README.md
```

**Source de vérité du modèle de données** : le bloc de commentaires en tête de
`src/store/migrations.js`. Aucune clé `localStorage` ne s'ajoute sans y être inscrite.
Clés persistées : `ibkr_u_o` (open), `ibkr_u_c` (closed), `ibkr_u_f` (cash flows),
`ibkr_u_j` (journal), `ibkr_u_s` (settings).

## Endpoints serverless (`api/`)

Proxys de marché, chacun avec CORS strict + rate-limiting :
`finnhub/[ticker]` · `finnhub/earnings` · `finnhub/economic` · `quote/[ticker]` ·
`chart/[ticker]` · `cboe/[ticker]` · `yahoo/[ticker]` · `fx/usdchf` · `flex/sync` ·
`health/finnhub`.

## Design system — « Brutalisme Financier »

Substance Bloomberg, finition moderne. **Source unique de vérité :
`src/styles/canonical.css`** — toute valeur visuelle non triviale en sort. Typo
monospace partout, locale `de-CH`, deux thèmes (`midnight` défaut, `daylight`).

**La loi de couleur — la règle qui prime sur tout le reste :**

- 🔴 **Rouge (`--pnl-down` `#EF4444`) = perte d'argent réelle, et rien d'autre.**
  Jour PnL négatif, mois négatif, pire trade, P&L unrealized négatif. Un theta négatif
  est rouge **parce qu'il représente une décroissance monétaire**, pas par convention.
  Jamais un « PUT », jamais une catégorie neutre.
- 🟢 **Vert (`--pnl-up` `#10B981`) = gain d'argent réel.** Mêmes règles inversées.
- 🟠 **Amber (`--accent` `#FFA028`) = signal décisionnel.** Today marker, action, macro,
  focus utilisateur. Jamais un PnL.
- **Ink-soft = catégories neutres** : badges CALL/PUT/STK, Δ/Γ/ν par défaut, symboles.

## Tests

Suite **Vitest : 25 fichiers, 233 tests, 532 assertions** (`npm test`). Couverture
ciblée sur le cœur logique pur : Black-Scholes (round-trip IV, signe theta),
métriques (Sharpe, Sortino, Calmar, CAGR, max drawdown, profit factor, TWR, win rate,
volatilité), parsing IBKR (closed trades, sections), agrégats Greeks, FX.

**Politique** : la couverture existante reste, on ne la grossit pas. Le travail neuf est
validé par **vérification visuelle** page par page (zoom navigateur ~90 %). Principe
**additif** : une feature ne régresse jamais une page déjà livrée.

## Déploiement

Vercel. `vercel.json` gère le rewrite SPA (`/((?!api/).*) → /index.html`) et un jeu
d'en-têtes de sécurité strictes : HSTS preload, `X-Frame-Options: DENY`, nosniff,
Referrer-Policy, Permissions-Policy, et une **CSP `connect-src 'self'`** (le pont IBKR
passe par un proxy same-origin Vite pour ne pas la violer).

## Licence

Projet privé, mono-utilisateur. Tous droits réservés.
