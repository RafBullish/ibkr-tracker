# PLAN DE FINITION — QuantumCall / ibkr-tracker

> **Statut de ce document** : audit de code en cours d'écriture (session du 2026-06-15).
> Écrit au fil de l'eau, sauvegardé après chaque page. Si interrompu, ce
> fichier reflète l'audit jusqu'à la dernière page cochée dans le suivi ci-dessous.
>
> **Base** : code actuel de la branche `finition-site`. PAS les docs.
> `CHANTIER.md` (daté 2026-05-31, avant briques 13/14/15) est traité comme
> périmé et re-vérifié item par item (§ B).
>
> **Règle de scope de cette session** : aucun code applicatif touché. Audit +
> plan + commit uniquement.

---

## Légende

- ✅ **Marche réellement** : code présent, branché sur une vraie source (store / API câblée), rend du contenu vivant.
- 🟡 **Factice / en dur** : valeur hardcodée, mock, placeholder, ou champ non câblé.
- ❌ **Manque** : fonctionnalité attendue absente.
- `[HORS-SCOPE?]` : dépend d'une donnée externe (live IBKR / Flex / Gateway / feed tiers). **Candidat** hors-scope — à trancher par l'utilisateur, pas par l'assistant.

---

## Suivi d'avancement de l'audit (cases cochées au fil de l'eau)

- [x] 0. Data layer / store (socle transversal)
- [x] 1. Dashboard (`/dashboard`)
- [x] 2. PreMarketBriefing (`/premarket`)
- [x] 3. Positions (`/trading/positions`)
- [x] 4. History (`/trading/history`)
- [x] 5. Chain (`/trading/chain`)
- [x] 6. Greeks (`/trading/greeks`) — gated
- [x] 7. Analytics (`/insights/analytics`)
- [x] 8. Calendar (`/insights/calendar`)
- [x] 9. Journal (`/insights/journal`)
- [x] 10. Settings · General (`/settings/general`)
- [x] 11. Settings · Import (`/settings/import`)
- [x] 12. Settings · API (`/settings/api`)
- [x] A. Hooks "stub" transversaux
- [x] B. Re-vérification CHANTIER.md item par item
- [x] C. Candidats HORS-SCOPE (synthèse)
- [x] D. Ordre d'exécution proposé (unités committables)

---

## § 0 — Data layer / store (socle transversal)

**Architecture** : store Zustand (`src/store/useStore.js`) avec pattern `dispatch(action)` → `applyAction` (`reducer.js`, pur). Persistance localStorage hors-React via `subscribe`, debounced + reference-gated (clés courtes pour économiser des octets).

**Clés localStorage** : `ibkr_u_o` (open), `ibkr_u_c` (closed), `ibkr_u_f` (cashflows), `ibkr_u_j` (journal), `ibkr_u_s` (settings) — **= les clés protégées de CLAUDE.md** (données réelles utilisateur). Schema version sous `ibkr_schema_v`.

**Schema = v7** (`CURRENT_SCHEMA_VERSION = 7`). Chaîne de migrations v0→v7 complète et idempotente. La **v6→v7 = brique 13** (`migrateV6toV7`).

### ✅ Ce qui marche réellement (socle solide, vérifié dans le code)

- **Brique 13 livrée et branchée au store** (contredit la « Phase 1 » du CHANTIER, cf. § B) :
  - `settings.activeSniperTier` = coordonnée matrice `{e, c}` (E0-E4 × C1-C5). Persistée sous clé courte `tier`, omise quand défaut E0×C1. Action `SET_ACTIVE_SNIPER_TIER` (merge partiel `{e}` / `{c}` contre l'état courant, anti-stale-closure).
  - `utils/sniperMeta.js` = **source unique de vérité** des dérivés de tier : `tierParams(raw)` → `{e, c, label, cashFloorPct, notionalMaxPct}`. `PORTFOLIO_RULES` = 30/70 (point unique à éclater le jour où la stratégie définit une variation par tier — ne PAS re-hardcoder ailleurs).
  - `pos.slDollar` (string|null) = surcharge manuelle du risque max ; `utils/risk.js#effectiveSlDollar(pos)` dérive sinon `pi×ct×mu×0.35` (gate SL35). **Short → null** (long-premium only ; jamais un faux chiffre). `totalSlDollar()` agrège.
  - `RESET_ALL` préserve désormais FX + `activeSniperTier`.
- `dailySnapshots` (clé `ds`) : FIFO 60 jours, `UPDATE_DAILY_SNAPSHOT` idempotent par date (pas de re-render storm). Sert sparklines + DailySnapshot.
- FX : cascade `useFxAutoRefresh` (Frankfurter boot+5min) + `useFxLiveSync` (Yahoo poll 60s, source canonique) écrivant `settings.liveRate`. Action atomique `SET_FX_STATE`.
- `initialCapitalChf` (clé `ic`) : capital de référence manuel CHF, conversion live au calcul.
- Exposure metrics dans `risk.js` : `positionNotional`, `totalNotional`, `notionalPctNLV`, `herfindahlConcentration`, `netDeltaExp` (sign-aware), `maxConcurrentTrades`. Toutes pures, inputs vides → 0/null sans throw.
- `computeRiskMatrix(state)` agrège l'objet consommé par `<RiskMatrix />` (DD courant/YTD/all-time sur la même base equity réelle).
- Reducer complet : ADD/UPDATE/DELETE pour positions, closed trades, cashflows, journal ; `CLOSE_POSITION` (split + remaining) ; `IMPORT_DATA` (validation shape, ensureIds) ; `SYNC_IBKR` (accepte `[]` pour vrai compte flat) ; `SYNC_FLEX` (dédup par signature).

### 🟡 / ❌ Observations socle

- `deltaAtEntry` / `ivAtEntry` / `ivRankAtEntry` : **toujours `null`** sur TOUS les trades (backfillés ET nouveaux imports). IBKR Flex n'expose pas le spot au moment du trade. Flag `_deltaApproximated: true` sur les trades migrés v1→v2. **C'est la racine commune** des « Donnée non disponible » sur History (Δ entry / IVR) et du stub IVR sur Chain. `[HORS-SCOPE?]` — nécessite une source de quote historique externe (Finnhub spot history ou stockage cumulé local).
- Pas de snapshot **Greeks** quotidien dans le store (il existe `dailySnapshots` pour le NLV, mais rien pour Δ/Γ/Θ/ν). C'est la racine du mock de la page Greeks (cf. § 1.6). **Pas de dépendance externe** — chantier purement applicatif (slice + hook d'écriture, analogue à `dailySnapshots`).

**Conclusion socle** : le store est mûr. Le seul vrai « trou data » interne (non externe) est le snapshot Greeks quotidien. Tout le reste des manques data dépend d'une source externe (spot/IV historique) → candidats HORS-SCOPE.

---

## § 1 — Audit page par page

### 1. Dashboard (`/dashboard`)

Layout v6 bento, 5 rangées. Source : `Dashboard.jsx` + `DashboardKPICards.jsx` (2700 lignes) + `RiskMatrix.jsx` (~960 lignes).

#### ✅ Marche réellement
- 9 KPI cards : NLV, Realized, Avail Capital, Unrealized, Day P&L, Exposure, Win Rate, streaks — live via `usePortfolioMetrics` / `useKPIs` / `useEquityHistory` / `useDailySnapshotWriter`.
- EquityChart + DailyPnLChart, range 5D/1M/3M/1Y/ALL synchronisé (lift state `chartRange`). Mode Mesure (clic A→B) sur le chart.
- LivePositions (table dense) avec greeks injectés via `useLivePositions({greeksMap})` (cascade σ).
- TradeHistory (table closed trades) + footer.
- RiskMatrix cockpit (Performance / Risk / Behavior), DD courant/YTD/all-time, GreeksStrip, gauges.
- **Snapshot quotidien NLV** écrit au mount (`useDailySnapshotWriter` → `UPDATE_DAILY_SNAPSHOT`).

#### ✅ RÉSOLU par brique 13 (le CHANTIER les listait comme factices — ILS NE LE SONT PLUS)
- **Card 2 (CASH FLR) + Card « MAX % NLV » + bloc TIER ACTIF** : `DashboardKPICards.jsx:1864` `tierParams(settings?.activeSniperTier)` → `cashFloorPct` / `notionalMaxPct` / `label` dérivés du store. **Plus de `SNIPER_DEFAULTS` hardcodé** (le commentaire l.1862 le confirme : « TODO Phase C résolu »).
- **Card 6 RISK $** : `DashboardKPICards.jsx:2246` `totalSlDollar(openPositions)` = Σ `effectiveSlDollar` (SL35, surcharge `slDollar` prioritaire). **Plus le faux proxy via l'unrealized de la 1ʳᵉ position.**
- **RiskMatrix tier badge** : `RiskMatrix.jsx:749` `tierParams(settings?.activeSniperTier).label`, rendu l.918 `TIER {tierLabel}`. **Plus le `TIER A · E0×C1` en dur.**

#### 🟡 Factice / placeholder / non câblé (encore vrai aujourd'hui)
- **`CalendarMiniPlaceholder.jsx` (row 4, col 7-12)** : littéralement `<span>Module en cours de développement</span>`. **Toujours un stub.**
- **Row 4 col 1-6 `Watchlist`** : alimenté par `useWatchlist()` qui retourne `[]` en dur → **empty state permanent**.
- **Row 5 entière** : `IVRankMovers` (`useIVMovers()` → `[]`), `SectorHeatmap` (`useSectorHeatmap()` → `[]`), `AlertsFeed` (`useAlertsFeed()` → `[]`) → **3 empty states permanents**. Cf. § A.
  - ⇒ **Constat fort : les rangées 4 et 5 du Dashboard sont quasi entièrement vides** (1 stub texte + 4 empty states sur 5 modules). C'est le plus gros « trou visuel » de la page.
- **3 boutons header RiskMatrix** `98) Detail` / `99) Export` / `97) History` (`RiskMatrix.jsx:881-889`) : **aucun `onClick`** — purement cosmétiques.
- **QueryID `1443387`** (`RiskMatrix.jsx:756`) : amélioré — lit `localStorage 'ibkr_flex_queryid'` avec fallback sur la constante `1443387`. Plus un pur hardcode, mais le fallback reste une valeur en dur (celle du compte réel de l'utilisateur — cf. memory). À neutraliser/généraliser.

#### ❌ Manque
- Vrai mini-calendrier (remplacer `CalendarMiniPlaceholder` — vue 7 j condensée liée à `/insights/calendar`).
- Handlers (ou suppression) des 3 boutons RiskMatrix.
- Contenu réel pour Watchlist / IVRankMovers / SectorHeatmap / AlertsFeed (dépend des hooks stub § A).

#### Dépendances externes
- Watchlist : besoin d'une slice store `watchlist` (purement applicatif, **pas externe**).
- SectorHeatmap / IVRankMovers / AlertsFeed : `[HORS-SCOPE?]` candidats — IVR a besoin d'IV historique externe ; SectorHeatmap d'un feed sectoriel (Finnhub/Yahoo) ou agrégation GICS locale ; AlertsFeed d'un moteur d'événements interne (applicatif).
- Fichier mort possible : `TradeHistoryPlaceholder.jsx` (placeholder non importé par `Dashboard.jsx`, qui utilise le vrai `TradeHistory`). À confirmer / supprimer.

### 2. PreMarketBriefing (`/premarket`)

Cockpit J-1, 4 strips. Source : `PreMarketBriefing.jsx`.

#### ✅ Marche réellement
- Header : horloges live CET·Genève + NY (tick 1s), Phase US calculée (PRE/OPEN/AFTER/CLOSED/WEEKEND via fuseaux NY), countdown vers la prochaine bascule.
- Market regime : VIX/SPX/QQQ via `useMarketQuotes` (fetch réel `/api/quote` cascade Finnhub→Yahoo→CBOE), classification `vixRegime()`. `[HORS-SCOPE?]` (dépend de l'endpoint quote externe — déjà câblé et déployé).
- Compteur « Gates armés N / M positions » via `useSniperGates`.
- Table Positions Review : une ligne par option ouverte, triée par proximité de gate, clic → `/trading/positions?focus={id}`. Gates **SL35 / DTE45 / TP** réellement calculés.
- Checklist 6 items persistée `qc:premarket:checks:{date}` avec reset quotidien + `confirmReady()` qui pose `_readyAt`.

#### ✅ RÉSOLU depuis le CHANTIER
- **USD/CHF** : maintenant câblé via `useFx()` → `{fxRate > 0 ? formatFxRate(fxRate) : '——'}` (l.279-283). Le CHANTIER le listait comme `——` permanent. **C'est l'item « trivial 5 lignes » : fait.** (Reste un sous-titre cosmétique « via FX hook ».)

#### 🟡 Factice / placeholder / non câblé
- **DXY** (l.286-288) : `——` en dur + sous-titre « overnight feed ». **Toujours factice.**
- **Sous-titres dev-leak** : « via FX hook » (USD/CHF) et « overnight feed » (DXY) sont des labels de dev visibles en prod — à remplacer par un vrai libellé ou retirer.
- **3 gates sur 6 sont des placeholders** : `EARN-J2`, `EARN+J30` (status `pending`, label « earn calendar ») et `TR` (label « tp chain ») dans `useSniperGates` (l.114-123). La colonne « Gate critique » de la table ne montrera jamais ces 3-là tant que le matching earnings + la chaîne TP/TR ne sont pas câblés.
- **4 items de checklist orphelins** : `macro`, `futures`, `news`, `earnings` sont de simples cases à cocher — **aucune donnée affichée à côté**. `positions` et `watchlist` renvoient au moins vers le réel ailleurs, mais les 4 premiers sont décoratifs.

#### ❌ Manque
- DXY : source (Yahoo `DX-Y.NYB` via `/api/quote`).
- Futures overnight (ES=F / NQ=F / YM=F) — aucun affichage.
- Snippet macro du jour (réutiliser `useCalendarFeeds`, déjà câblé sur Calendar).
- Earnings BMO/AMC du jour (filtrer `useEarningsCalendar` sur la date).
- News flow (aucune source aujourd'hui).
- Matching earnings pour activer les gates EARN-J2 / EARN+J30.

#### Dépendances externes
- DXY / futures : `[HORS-SCOPE?]` — symboles via endpoint quote externe (probable OK Yahoo, à vérifier).
- Macro / earnings : `[HORS-SCOPE?]` — Finnhub (`useCalendarFeeds` / `useEarningsCalendar`) déjà câblés ailleurs ; réutilisation, pas de nouvelle source.
- News flow : `[HORS-SCOPE?]` — **aucune source actuellement** ; gros chantier (Finnhub news / RSS).

### 3. Positions (`/trading/positions`)

3 branches (empty / flat / open). Source : `Positions.jsx`.

#### ✅ Marche réellement
- **Branche A (empty)** : EmptyState + CTA « Importer un CSV Flex » → `/settings/import`.
- **Branche B (flat)** : 4 cards (dernière clôturée + R-multiple, stats 10 derniers + WR, CTA Chain, mini-donut mix Action/Call/Put) — toutes dérivées des closed trades.
- **Branche C (open)** : KPI strip 5 tuiles (Positions, Δ net, Θ total, Capital engagé, Max loss) sign-aware via `aggregateGreeks` ; DataTable ~12 cols ; mobile cards ; suppression locale par ligne avec `window.confirm` (≠ clôture IBKR, message clair).
- Greeks en cascade `getGreeksForAllPositions` (mark → chain cache → σ=30% fallback marqué `~` + italique + title). Indicateur de fraîcheur passif (« Greeks · il y a Xs » / « en attente du premier fetch » / « indisponibles »).
- Alerts inline par ligne (`getPositionAlerts`).

#### 🟡 Factice / placeholder
- `onRowClick={undefined /* future: open detail panel */}` (l.931) : **pas de panneau de détail au clic**. Intention explicite dans le commentaire.
- Δ / Θ affichent `—` quand les greeks ne sont pas encore fetchés — comportement légitime (pas un faux 0).

#### ❌ Manque / bug cross-page
- **Panneau détail** au clic (intention déjà présente).
- **`?focus={id}` ignoré** ⚠️ : `PreMarketBriefing` (et potentiellement d'autres) navigue vers `/trading/positions?focus={id}` pour mettre en avant une position, mais **`Positions.jsx` ne lit jamais ce paramètre** (aucun `useSearchParams` / `location.search`). Le deep-link arrive sur la page mais ne surligne / ne scrolle vers rien. **Régression d'intention non signalée par le CHANTIER.**

#### Dépendances externes
- Aucune nouvelle. Greeks via API déjà câblée (`greeksApi`). Le `focus` highlight + le detail panel sont purement applicatifs.

### 4. History (`/trading/history`)

Source : `History.jsx`. **Production-ready** — conforme à l'évaluation 95% du CHANTIER, rien n'a régressé.

#### ✅ Marche réellement
- 2 view modes (Standard / Sniper) avec colonnes conditionnelles (`viewMode` persisté `ibkr_history_view_mode`).
- KPI strip 6 tuiles (Total, Net P&L, Win Rate, Avg R, Best, Worst) avec tonalités sémantiques métier ; `winRate` null-safe (→ `—` si décisifs < 10).
- Filtres Result (Tous/Gagnants/Perdants) + Type (Tous/Options/Actions), recherche, tri, export CSV (Blob horodaté).
- WinRateDonut + LazyDistribution (lazy, fallback null) ; `PerformanceAttribution` (Edge × Capital, via sniper meta sidecar).
- `ExitReasonEditor` : motif auto-détecté + confidence live, Confirmer / Corriger → `CONFIRM_EXIT_REASON` / `SET_EXIT_REASON`.
- Empty state + AddTradeModal → `ADD_CLOSED_TRADE`. Suppression par ligne → `DELETE_CLOSED_TRADE`.

#### 🟡 Factice / placeholder
- Colonnes **Δ entry** et **IV rank** (vue Sniper) : `—` « Donnée non disponible » pour les trades sans spot historique. `deltaAtEntry` / `ivRankAtEntry` sont **toujours null** (cf. § 0 — racine commune). `DTE entry` est lui rendu (reconstructible). Tooltip distingue `_deltaApproximated` (backfill tenté) vs jamais tenté.

#### ❌ Manque
- Backfill Δ / IV rank au moment de l'entrée pour les trades passés.

#### Dépendances externes
- `[HORS-SCOPE?]` — backfill Δ/IVR nécessite **spot + IV historiques** (source externe, non fournie par IBKR Flex). Non bloquant pour la page : c'est de l'enrichissement. La page est complète sans.

### 5. Chain (`/trading/chain`)

Source : `Chain.jsx` (lazy). Yahoo Finance + BSM client-side. Globalement fonctionnelle.

#### ✅ Marche réellement
- Topbar : ticker input + bouton Charger + pills historique (`chain_history` localStorage, 5 derniers).
- Fetch réel `/api/yahoo/{ticker}` (+ `?date={ts}` par expiration), gestion erreur + empty state.
- Stats strip : Spot + day change, **ATM IV** (médiane 5 strikes autour du spot — vrai calcul), nb expirations, strikes visibles / total, **Sniper Zone** (count |Δ| ∈ [0.25, 0.35]).
- Tenor tabs (8 expirations max), sélecteur de nombre de strikes (8/16/32/Tous, ATM-anchored), toggle Sniper OTM (filtre Δ).
- Greeks par contrat via `contractGreeks`/`bsGreeks` (BSM réel ; fallback `estimateDelta` par ratio quand IV absente).
- `OptionsChainTable` (T-layout ATM-anchored) + clic ligne → `AddTradeModal` pré-rempli.
- Footer analytics réels via `chainAnalytics` : Max Pain, 25Δ Risk Reversal, OI Top, Net GEX (régime), Walls (call/put) + Gamma Flip — tous avec fallback `——` propre.
- **Chain IV cache writer** (`qc:chainIv:{ticker}`) opportuniste : alimente le fallback (b) de `positionGreeks` + invalide la memo greeksApi. Pas de consumer dépendant — bonus.

#### 🟡 Factice / placeholder
- **Stat cell IVR** (l.527) : `value="——"` + sub « Sprint 6 — IV history ». **Toujours un stub assumé** (sous-titre = label de roadmap visible en prod).

#### ✅ VERDICT INTÉGRITÉ — PAS UN BUG (tracé le 2026-06-15, Étape 0 session d'exécution)
- Flag initial : `handleSavePreset` (Chain.jsx l.431-433) dispatche `ADD_CLOSED_TRADE` ; le preset n'a que des champs d'entrée → risque supposé d'enregistrer une position ouverte comme trade clôturé sans données de sortie.
- **Chemin réel tracé** :
  - `handleRowClick` (clic ligne chaîne) → `setPreset({tk,as,ty,dir,st,ex,pi,ct,tag})` + `setPresetOpen(true)`. Le preset **pré-remplit uniquement l'entrée** (convenance).
  - `<AddTradeModal onSave={handleSavePreset} preset={preset}>` est rendu. **C'est le même composant partagé que History** utilise pour logguer un trade clôturé manuel.
  - `AddTradeModal.handleSave` (AddTradeModal.jsx l.79-80) a un **garde dur** : `if (!tk.trim() || !pi || !po) return;` → **refuse d'enregistrer sans prix de SORTIE (`po`)**. Le formulaire a des champs explicites « Prix Exit » + « Date Exit » (défaut today) et construit une forme closed-trade complète (`po, do, fo, fxo`).
  - `ADD_CLOSED_TRADE` (reducer l.192-196) ajoute bien le trade aux `closedTrades` (compté dans le P&L réalisé) — **mais avec des données de sortie réelles saisies par l'utilisateur.**
- **Conclusion** : aucune corruption possible. On ne peut PAS enregistrer un trade ouvert/incomplet via ce chemin — le garde `!po` bloque. Le dispatch `ADD_CLOSED_TRADE` est correct : le preset sème l'entrée, l'utilisateur complète la sortie, le résultat est un trade clôturé légitime.
- **Nuance UX mineure (non bloquante, non corrigée)** : le titre « Preset trade depuis la chaîne » pourrait laisser croire qu'on logge une position ouverte ; en pratique le formulaire impose la sortie. Simple libellé, pas un risque d'intégrité.

#### ❌ Manque
- IV Rank (nécessite historique IV 52 semaines).

#### Dépendances externes
- `[HORS-SCOPE?]` — endpoint `/api/yahoo/{ticker}` (Yahoo, à vérifier non rate-limité en prod). IVR nécessite IV historique (source externe ou stockage cumulé local de `qc:chainIv`).

### 6. Greeks (`/trading/greeks`) — gated `FEATURE_GREEK_CENTER`

Source : `Greeks.jsx` (lazy). **Page non routée par défaut** : `FEATURE_GREEK_CENTER = import.meta.env.VITE_FEATURE_GREEK_CENTER === 'true'` → OFF sauf si la var d'env est posée (cf. `App.jsx` l.68). En prod standard, **cette page n'existe pas pour l'utilisateur**.

#### ✅ Marche réellement (quand activée)
- Hero 4 KPI Δ/Γ/Θ/ν live via `aggregateGreeks` (sign-aware, theta/jour, vega/1%-IV), règle sémantique CANONICAL-3 (Θ rouge si négatif).
- `PerPositionGreeksTable` : valeurs par position, sign-aware, unités alignées sur le cockpit.
- Donut Exposition Vega (réel, trié |vega|, slice décisionnel en accent).
- Panel Greeks second ordre (Vanna/Charm/Vomma/GEX) via `computeSecondOrderGreeks` (réel).
- Empty state propre si aucune option.

#### 🟡 Factice / mock — **le cœur visuel est faux**
- **`buildMockEvolution()` (l.79-105)** : génère 30 jours fictifs par random walk `Math.random()` ±15% autour des Greeks actuels. Alimente le graphe principal `GreekEvolutionChart` (l.264, 357). **Le graphe « Évolution 30j » est intégralement inventé.** (Note : viole l'esprit « pas de mock » mais protégé par le feature flag OFF.)
- **`ThetaDecayProjection`** (l.362) : projection linéaire à partir du θ courant, pas d'historique.
- **`IVRankHistogram`** : alimenté par `ivRankRows` filtré sur `r.ivRank != null`, mais `ivRank = p.ivRank ?? null` et les positions ouvertes **ne portent pas de `ivRank`** → histogramme vraisemblablement **vide en permanence** (à confirmer visuellement le jour où la page est activée).

#### ❌ Manque
- **Snapshot Greeks quotidien** dans le store (slice + hook d'écriture, analogue à `dailySnapshots`). Sans ça, le graphe d'évolution n'a aucune valeur décisionnelle → d'où le mock.
- IV rank par position (même racine que History/Chain — donnée IV historique).

#### Dépendances externes
- Snapshot Greeks quotidien : **PAS de dépendance externe** — chantier purement applicatif (le plus rentable pour cette page).
- IV rank : `[HORS-SCOPE?]` (IV historique externe).
- **Décision produit préalable** : veut-on activer cette page (`FEATURE_GREEK_CENTER`) dans la finition, ou la laisser gated ? Tout le travail Greeks dépend de cette décision. `[HORS-SCOPE?]` au sens « à trancher ».

### 7. Analytics (`/insights/analytics`)

Source : `Analytics.jsx` (lazy). Globalement prod-ready, tout dérivé de `closedTrades` + `usePortfolioMetrics`.

#### ✅ Marche réellement
- `RiskMetricsRow` : Sharpe / Sortino / Calmar (source canonique `portfolioMetrics`) + Profit Factor / Win Rate / expectancy.
- KPIs secondaires : Omega, Kelly %, Avg Hold, Max Drawdown.
- DayChart (P&L par jour de semaine) — fonctionnel.
- WinRateDonut, `LazyStrategyBreakdown` (par tag), `PnLCalendarHeatmap` mode year.
- EmptyState avec 2 CTA (import / trade manuel).

#### 🟡 Factice / dégénéré (non signalé par le CHANTIER)
- **HourChart « P&L par heure » dégénéré** ⚠️ : `aggregateHourOfDay` fait `new Date(t.do + 'T12:00:00').getHours()`, or `t.do` est une **date sans horodatage** (IBKR Flex ne fournit pas l'heure de clôture). `getHours()` renvoie donc **toujours 12** → tout le P&L s'empile dans le seul bucket 12h. Le graphe est structurellement non-fonctionnel tel quel. Ce n'est pas un mock mais c'est trompeur (axe 24h avec une seule barre).
- **Chrome legacy** : Analytics utilise encore `GlassCard` / `MetricCard` / `.dashboard-v3__panel-head`, **pas la palette canonique flat** adoptée par Positions / Greeks / History (briques 15 Terminal Pass). Incohérence visuelle avec le reste du site refondu (cf. aussi Journal). Item de finition « cohérence visuelle ».

#### ❌ Manque
- Rien de fonctionnellement absent. Soit retirer/repenser le HourChart (faute d'horodatage intraday), soit l'alimenter si une source intraday existe un jour.

#### Dépendances externes
- Aucune. La valeur statistique croît avec le volume de trades (>30 pour PF crédible) — c'est de l'usage, pas du code.
- HourChart : `[HORS-SCOPE?]` au sens « nécessiterait un horodatage intraday » que Flex ne fournit pas.

### 8. Calendar (`/insights/calendar`)

Source : `Calendar.jsx`. 3 onglets, fonctionnels.

#### ✅ Marche réellement
- Onglet **Annonces** : `useCalendarFeeds` (Finnhub earnings + macro, fallback `macroEventsInRange`/`MACRO_EVENTS_2026`), dots par jour, popup hover, liste « Prochains événements » (20), expirations des positions ouvertes toujours injectées, filtre d'impact (Tout/Moyen+/Fort), bouton Rafraîchir.
- **Bannière API contextuelle** à 4 états (non configurée / API down + fallback / connecté + events / connecté + vide) — soignée.
- Onglet **P&L Jour** : heatmap mensuelle dérivée des closed trades, totaux hebdo, panneau détail au clic d'un jour → liste des trades + lien « Voir dans Historique ».
- Onglet **Année** : `PnLCalendarHeatmap` 52×7.

#### 🟡 Factice / incomplet
- **Popup earnings n'affiche pas les estimations** : les events earnings portent `epsEst: e.epsEstimate` et `revEst: e.revenueEstimate` (l.163-164) mais le rendu de la popup (l.250-262) **et** la liste upcoming n'affichent que `{ev.label}`. **Données déjà en mémoire, jamais rendues.** Confirme le CHANTIER — c'est un vrai quick win (≈3 lignes JSX).
- `MACRO_EVENTS_2026` = fixture volontaire (résilience offline), pas un défaut.

#### ❌ Manque
- Rendu EPS estimate / Revenue estimate dans la popup (+ éventuellement la liste upcoming).
- Forecast / previous / actual macro (à vérifier si Finnhub les fournit).

#### Dépendances externes
- Finnhub déjà câblé (`useCalendarFeeds`). Pas de nouvelle source. Le rendu eps/rev est **purement applicatif** (donnée déjà fetchée). Forecast/actual macro : `[HORS-SCOPE?]` (dépend de ce que Finnhub renvoie).

### 9. Journal (`/insights/journal`)

Source : `Journal.jsx`. **Prod-ready, rien de factice.**

#### ✅ Marche réellement
- CRUD entries via store (`ADD_JOURNAL` / `DELETE_JOURNAL`), tri date desc.
- `TiltMeter` (`computeTiltScore` 14 j, pondération mistake × mood).
- `useDailyKillSwitch` : carte d'alerte quand limite perte du jour atteinte + désactivation manuelle.
- **Edge Leak Audit** : crosstab tag × P&L, matching journal × closed trade par ticker + date ±1 j (préférence exacte, dédup `matchedTradeIds`).
- Modal nouvelle entrée complète (date, ticker, mood, mistake, tag, rating étoiles, note), filtre mood, 3 EmptyState contextuels.

#### 🟡 Notes mineures (pas factice)
- **Chrome legacy GlassCard** (comme Analytics) — pas la palette canonique flat. Item « cohérence visuelle ».
- `UPDATE_JOURNAL` existe dans le reducer mais **aucune UI d'édition** d'une entrée (création + suppression seulement). Gap mineur, non bloquant.

#### ❌ Manque
- Rien de fonctionnel. La valeur croît avec le volume de trades fermés (Edge Leak a besoin de matches).

#### Dépendances externes
- Aucune.

### 10. Settings · General (`/settings/general`)

Source : `General.jsx`. ~9 sections.

#### ✅ Marche réellement
- **Stratégie Sniper (brique 13 — NOUVEAU, absent du CHANTIER)** : section avec 2 `<select>` E0-E4 × C1-C5 → `commitTier` → `SET_ACTIVE_SNIPER_TIER`, preview live `TIER {label} · cash floor X% · notional max Y%` via `tierParams`. **C'est l'UI qui ferme la boucle brique 13** : sélecteur ici → store → cards Dashboard + badge RiskMatrix.
- Localisation : timezone read-only, taux USD/CHF + bouton Actualiser (`useFx().refresh()` + toast d'erreur dédupé), capital de référence CHF + preview USD au taux courant → `SET_INITIAL_CAPITAL`.
- Apparence : ThemeSwitcher, toggle daltonien (persisté `ibkr_colorblind` + dataset), reduced-motion (OS).
- Mode trading : badge PAPER/REAL auto selon positions.
- Gestion du risque : seuil perte quotidienne (`setMaxLoss`), P&L réalisé du jour, statut Armé/Déclenché/Inactif.
- Connexions API : résumé via `useApiStatus` + `ApiServiceCard`, lien vers détails.
- Données : taille localStorage, nb trades clôturés, lien Import.
- Cash flows : `CashFlowsSection` complète (add/delete, tri desc, 20 visibles).
- Zone dangereuse : modal + checkbox confirm + `RESET_ALL` + purge `ibkr_flex_queryid`/`ibkr_flex_token`/`ibkr_history_view_mode`/`chain_history` + toast + navigate dashboard.

#### 🟡 Factice / non câblé
- **Input Email** (l.401-409) : `defaultValue=""`, **aucun `onChange`/`onBlur`** → jamais persisté. **Orphelin, confirme le CHANTIER.**
- **Input Nom** (l.385-399) ⚠️ (non signalé) : `defaultValue="Rafael"` **codé en dur**. Écrit dans `localStorage 'ibkr_profile_name'` au blur, mais **ne relit jamais** la valeur sauvegardée au mount → au reload, affiche toujours « Rafael », pas le nom saisi. Persistance write-only / incohérente.

#### ❌ Manque
- Câbler Email (`onChange` + persist) **ou le retirer** — décision produit.
- Faire lire le Nom depuis `localStorage` au mount (sinon la persistance ne sert à rien).

#### Dépendances externes
- Aucune.

### 11. Settings · Import (`/settings/import`)

Source : `Import.jsx`. **Production-ready (100%)** — confirme le CHANTIER.

#### ✅ Marche réellement
- **FlexSection** : QueryID + Token → `configureFlex` → `syncFlex` (`/api/flex/sync`) → `parseIbkrCsv` → `mergeIbkrData` (dédup idempotent) → `IMPORT_DATA` + toast stats + écriture `lastSync`. Bouton « Effacer identifiants » (purge localStorage) + badge « Sync {heure} ». Status/error inline pendant la sync.
- **CsvUploadSection** : drag & drop + file picker (même chemin parser), `lastImport` (nom + taille + stats), **Export JSON** (Blob horodaté), **Restaurer JSON** (validation shape minimale + toast).
- Footer pédagogique sur l'idempotence du merge.

#### 🟡 / ❌
- Rien de factice, rien de manquant fonctionnellement.
- Options cosmétiques (non implémentées, faible ROI) : bouton « Test connexion » Flex sans vraie sync, preview CSV avant merge, dry-run restore JSON.

#### Dépendances externes
- `[HORS-SCOPE?]` — la sync Flex dépend de `/api/flex/sync` + identifiants IBKR de l'utilisateur. Mais le chemin est entièrement câblé ; rien à finir côté code.

### 12. Settings · API (`/settings/api`)

Source : `Api.jsx` + `useApiStatus.js`.

#### ✅ Marche réellement
- Grille de services via `useApiStatus` + `<ApiServiceCard>`. **Probes live réels** toutes les 2 min : `chart` (`/api/chart/SPY`), `yahoo` (`/api/yahoo/SPY`), `finnhub` (`/api/health/finnhub`), `fx` (`/api/fx/usdchf`) ; dérivés : `flex` (creds + recency lastSync), `ibkrLive` (recency `ibkrLiveData.timestamp` vs FRESHNESS), `storage` (probe écriture), `vercel` (actif si une fonction répond).
- **Statut bridge IBKR surfacé** via la carte `ibkrLive` → partiellement obsolète la critique CHANTIER « toggle en aveugle » : le statut de connexion du bridge EST désormais affiché.
- Toggle `gwAutoConnect` → `SET_GW_AUTO_CONNECT` (persisté).
- `ConfigFlexModal` (QueryID + Token → localStorage), infopanels lecture seule (clés serveur Vercel, logs).

#### 🟡 Factice / incohérences (non signalées par le CHANTIER)
- **Bug de copie « Sept services »** ⚠️ : le header dit « Sept services intégrés » / « Sept services » mais `SERVICE_ORDER` rend **8 cartes** (ibkrLive, flex, chart, yahoo, finnhub, fx, vercel, storage — le commentaire du hook dit lui-même « eight services »). Le compteur texte est périmé.
- `ConfigFlexModal` écrit directement `localStorage` (`ibkr_flex_queryid`/`ibkr_flex_token`) en **contournant `configureFlex`** (utilisé par Import). Incohérence mineure (même clés au final).

#### ❌ Manque (UX, optionnel)
- Bouton « Test » par service (probe one-shot manuel) — mais l'auto-probe 2 min couvre déjà le statut, donc faible valeur.
- Historique des erreurs récentes.

#### Dépendances externes
- `[HORS-SCOPE?]` — la page *est* un moniteur de santé d'API externes ; par nature elle dépend des endpoints. Rien à « finir » sauf le bug de copte « Sept→Huit » et le polish UX.

---

## § A — Hooks "stub" transversaux

6 hooks renvoient en dur `[]` ou `null`. Ils déterminent l'essentiel des « zones vides » résiduelles du site.

| Hook | Retour | Consommateur | Impact réel | Nature du déblocage |
|------|--------|--------------|-------------|---------------------|
| `useWatchlist` | `[]` | `Watchlist` (Dashboard row 4) | empty state permanent | **Applicatif** : slice store `watchlist` + actions ADD/REMOVE_TICKER + persistence. Aucune data externe. |
| `useAlertsFeed` | `[]` | `AlertsFeed` (Dashboard row 5) | empty state permanent | **Applicatif** : moteur d'événements interne (gate fires, fills, sync, errors). Non trivial mais sans source externe. |
| `useIVMovers` | `[]` | `IVRankMovers` (Dashboard row 5) | empty state permanent | `[HORS-SCOPE?]` : IV historique 52 sem (même racine que Chain IVR / History). |
| `useSectorHeatmap` | `[]` | `SectorHeatmap` (Dashboard row 5) | empty state permanent | `[HORS-SCOPE?]` : feed sectoriel (Finnhub/Yahoo) ou agrégation GICS locale. |
| `useVolSkew` | `null` | `VolatilitySkew.jsx` — **NON rendu** | aucun (composant mort) | `[HORS-SCOPE?]` : chaîne options SPX par expiration. + composant dead-code. |
| `useMarketInternals` | `null` | `MarketInternals.jsx` — **NON rendu** | aucun (composant mort) | `[HORS-SCOPE?]` : breadth TICK/TRIN/ADD/VOLD/PCR. + composant dead-code. |

**Constat** :
- **4 stubs « actifs »** (`useWatchlist`, `useAlertsFeed`, `useIVMovers`, `useSectorHeatmap`) → ce sont eux qui rendent **les rangées 4-5 du Dashboard quasi vides**.
- **2 stubs « morts »** (`useVolSkew`, `useMarketInternals`) alimentent `VolatilitySkew.jsx` / `MarketInternals.jsx` qui **ne sont rendus nulle part** (retirés du Dashboard en Phase C.1, conservés « pour reconstruction »). Candidats suppression (cf. seuil dead-code 2 semaines, déjà bien dépassé).
- Parmi les 4 actifs, **2 sont purement applicatifs** (Watchlist, AlertsFeed — débloquables sans data externe) et **2 dépendent de data externe** (IVMovers, SectorHeatmap).

**Fichiers dead-code candidats associés** : `VolatilitySkew.jsx`, `MarketInternals.jsx`, `TradeHistoryPlaceholder.jsx` (non importé), `SniperGateMonitor.jsx` (retiré du Dashboard Phase C.2.10, « conservé pour reconstruction »). À confirmer avant suppression.

---

## § B — Re-vérification CHANTIER.md (item par item)

`CHANTIER.md` daté **2026-05-31**, avant briques 13/14/15. Verdict de chaque réclamation contre le code du **2026-06-15**.

### B.1 — Réclamations par page

| # | Réclamation CHANTIER | Verdict aujourd'hui |
|---|----------------------|---------------------|
| 1a | Dashboard : `SNIPER_DEFAULTS` hardcodé (tierLabel/cashFloor/notional) | ✅ **RÉSOLU** (brique 13 — `tierParams(settings.activeSniperTier)`) |
| 1b | Dashboard : RiskMatrix badge `TIER A·E0×C1` en dur | ✅ **RÉSOLU** (brique 13 — `tierParams(...).label`) |
| 1c | Dashboard : RISK $ = faux proxy via unrealized 1ʳᵉ position | ✅ **RÉSOLU** (brique 13 — `totalSlDollar`, SL35) |
| 1d | Dashboard : QueryID `1443387` en dur | 🟡 **PARTIEL** — lit `localStorage` avec fallback sur la constante (améliorant mais fallback en dur subsiste) |
| 1e | Dashboard : `CalendarMiniPlaceholder` stub | ❌ **ENCORE À FAIRE** |
| 1f | Dashboard : 3 boutons header RiskMatrix sans onClick | ❌ **ENCORE À FAIRE** |
| 1g | Manque `settings.activeSniperTier` exposé | ✅ **RÉSOLU** (= la « Phase 1 » connue) |
| 1h | Manque `pos.slDollar` | ✅ **RÉSOLU** (schema v7 + `effectiveSlDollar`) |
| 2a | Premarket : USD/CHF `——` | ✅ **RÉSOLU** (`useFx()` câblé) |
| 2b | Premarket : DXY `——` | ❌ **ENCORE À FAIRE** |
| 2c | Premarket : 4 items checklist orphelins (macro/futures/earnings/news) | ❌ **ENCORE À FAIRE** |
| 3 | Positions : pas de detail panel (`onRowClick` undefined) | ❌ **ENCORE À FAIRE** (+ bug `?focus=` ignoré, non vu par le CHANTIER) |
| 4 | History : backfill Δ/IVR manquant | ❌ **ENCORE À FAIRE** — `[HORS-SCOPE?]` (data externe) |
| 5 | Chain : IVR stub | ❌ **ENCORE À FAIRE** — `[HORS-SCOPE?]` (IV historique) |
| 6a | Greeks : `buildMockEvolution` (graphe principal mock) | ❌ **ENCORE À FAIRE** (mais page gated OFF) |
| 6b | Greeks : snapshot quotidien manquant | ❌ **ENCORE À FAIRE** (applicatif) |
| 7 | Analytics : « rien à finir » | 🟡 **À NUANCER** — HourChart dégénéré (date sans heure) + chrome legacy, non vus par le CHANTIER |
| 8 | Calendar : `epsEst`/`revEst` non rendus dans popup | ❌ **ENCORE À FAIRE** (quick win, data déjà en mémoire) |
| 9 | Journal : « rien » | ✅ **CONFIRMÉ** (rien de factice ; note mineure edit-UI) |
| 10a | General : input Email orphelin | ❌ **ENCORE À FAIRE** (+ input Nom write-only, non vu par le CHANTIER) |
| 11 | Import : « 100% » | ✅ **CONFIRMÉ** |
| 12a | API : pas de bouton « Test » par service | ❌ **ENCORE À FAIRE** (optionnel — auto-probe couvre déjà le statut) |
| 12b | API : statut bridge « en aveugle » | 🟡 **PARTIELLEMENT OBSOLÈTE** — carte `ibkrLive` affiche désormais le statut |
| 12c | API : (non listé) header « Sept services » mais 8 cartes | ❌ **ENCORE À FAIRE** (bug de copie) |

### B.2 — « Ordre recommandé » du CHANTIER

| Item CHANTIER | Verdict |
|---------------|---------|
| Phase 1.1 — exposer `activeSniperTier` + `pos.slDollar` | ✅ **RÉSOLU** (brique 13) — **toute la Phase 1.1 est faite** |
| Phase 1.2 — snapshot Greeks quotidien | ❌ encore à faire (applicatif) |
| Phase 1.3 — IV Rank historique 52w | ❌ encore à faire — `[HORS-SCOPE?]` |
| Phase 2.4 — Premarket FX/DXY/futures/macro/earnings | 🟡 FX fait ; DXY/futures/macro/earnings à faire |
| Phase 2.5 — Greeks branche snapshot | ❌ dépend de 1.2 |
| Phase 2.6 — Chain IVR | ❌ dépend de 1.3 — `[HORS-SCOPE?]` |
| Phase 3.7 — Dashboard mini-cal + 3 boutons | ❌ encore à faire |
| Phase 3.8 — Calendar eps/rev | ❌ encore à faire (quick win) |
| Phase 3.9 — Positions detail panel | ❌ encore à faire |
| Phase 3.10 — General Email | ❌ encore à faire |
| Phase 3.11 — API bouton Test | ❌ encore à faire (optionnel) |
| Phase 4.12 — backfill Δ/IVR | ❌ `[HORS-SCOPE?]` |
| Phase 4.13 — news flow | ❌ `[HORS-SCOPE?]` |
| Phase 4.14 — hooks stubs restants | mixte : Watchlist/Alerts applicatifs, Sector/IVMovers `[HORS-SCOPE?]` |

**Bilan** : la **Phase 1.1 du CHANTIER (la plus structurante) est entièrement livrée** par la brique 13, plus l'UI de sélection du tier (Settings) et le câblage USD/CHF du Premarket. Le reste du CHANTIER reste globalement valide. Le CHANTIER **sous-estimait** 4 points découverts ici : bug `?focus=` (Positions), HourChart dégénéré (Analytics), input Nom write-only (General), compteur « Sept services » (API).

---

## § C — Candidats HORS-SCOPE (synthèse)

> **Règle** : je ne tranche pas. Je liste les candidats qui dépendent d'une donnée externe (live IBKR / Flex / Gateway / feed tiers) ou d'une décision produit. **Tu valides la ligne fini/hors-scope toi-même.**

### C.1 — Dépendent d'une SOURCE EXTERNE absente (candidats hors-scope « durs »)

1. **History — backfill Δ entry / IV rank** des trades passés → spot + IV **historiques** (IBKR Flex ne les fournit pas).
2. **Chain — stat IVR** → IV historique 52 semaines.
3. **Greeks — IV rank par position** (histogramme) → même racine.
4. **Dashboard `useIVMovers`** → IV historique.
5. **Premarket — DXY** → quote externe (`DX-Y.NYB` via `/api/quote`, à vérifier supporté).
6. **Premarket — futures overnight** (ES/NQ/YM) → quotes externes.
7. **Premarket — news flow** → **aucune source aujourd'hui** (gros chantier : Finnhub news / RSS).
8. **Dashboard `useSectorHeatmap`** → feed sectoriel externe **OU** agrégation GICS locale (cette dernière serait applicative — alternative possible).
9. **`useVolSkew` / `useMarketInternals`** → chaîne SPX par expiration / breadth TICK-TRIN (externes). **+ composants non rendus** → plutôt candidats suppression.
10. **Analytics — HourChart** → nécessiterait un **horodatage intraday** que Flex ne donne pas (close = date seule). À repenser ou retirer.

### C.2 — Réutilisent une source DÉJÀ câblée (candidats hors-scope « mous » — faisables sans nouvelle dépendance)

11. **Premarket — snippet macro du jour** → réutiliser `useCalendarFeeds` (Finnhub déjà câblé sur Calendar).
12. **Premarket — earnings BMO/AMC** → filtrer `useEarningsCalendar` (Finnhub déjà câblé).
13. **Calendar — forecast/previous/actual macro** → dépend de ce que Finnhub renvoie (à vérifier).
14. **Premarket — gates EARN-J2 / EARN+J30** → matching earnings (Finnhub déjà câblé).

### C.3 — Décision PRODUIT préalable (pas de la data, du choix)

15. **Greeks Center entier** : page gated `FEATURE_GREEK_CENTER` OFF. **Veut-on l'activer dans la finition ?** Tout le travail Greeks (snapshot quotidien, virer le mock) en dépend. Le snapshot lui-même est **applicatif** (pas externe), mais l'effort n'a de sens que si la page est destinée à être livrée.
16. **Input Email (General)** : le câbler **ou le supprimer** — choix produit.
17. **Dead-code** : `VolatilitySkew.jsx`, `MarketInternals.jsx`, `TradeHistoryPlaceholder.jsx`, `SniperGateMonitor.jsx` — supprimer ou garder « pour reconstruction » ?

### C.4 — NON hors-scope (externe mais DÉJÀ fonctionnel — aucune action de finition)

- `useMarketQuotes` (VIX/SPX/QQQ Premarket), chaîne Yahoo (Chain), `useCalendarFeeds` (Calendar), cascade FX (`useFx`), probes `useApiStatus`, sync Flex (Import). **Tous câblés et opérationnels** — dépendent d'endpoints externes par nature, mais ne sont pas des trous à finir.

---

## § D — Ordre d'exécution proposé (unités committables)

Chaque **U** = un commit autonome. Ordre = priorité décroissante. Principe : d'abord rendre le site **honnête** (corriger ce qui ment/trompe), puis les **quick wins fonctionnels sans data externe**, puis l'**applicatif lourd sans data externe**, puis les **candidats hors-scope** (sous réserve de ta validation § C).

### ⚠️ Décisions à prendre AVANT de coder (cf. § C.3)
- **D-a** : active-t-on la page **Greeks** (`FEATURE_GREEK_CENTER`) ? → conditionne U9.
- **D-b** : input **Email** General → câbler ou supprimer ? → conditionne U2.
- **D-c** : **dead-code** (`VolatilitySkew`/`MarketInternals`/`TradeHistoryPlaceholder`/`SniperGateMonitor`) → supprimer ? → conditionne U5.
- **D-d** : la **ligne hors-scope** sur tout ce qui dépend de data externe (§ C.1) — où la traces-tu ?

---

### Vague 1 — Honnêteté du site (trivial, zéro data externe, zéro risque)

- **U1 · Calendar : afficher EPS/Revenue estimates** — ✅ **FAIT (1713bf8)**. Popup earnings + liste « Prochains événements » affichent maintenant `est. EPS $X.XX · CA $X.XXB` quand dispo. Null-guard strict (rien rendu si absent). Unité vérifiée : Finnhub `revenueEstimate` = USD absolu (pass-through `api/finnhub/earnings.js`), formaté en T/B/M/k ; `epsEstimate` = USD/action. Build OK.
- **U2 · Corrections d'honnêteté UI** — ✅ **FAIT** (commit groupé, ce commit) :
  - API : « Sept services » → « Huit services » (sous-titre `Api.jsx` + JSDoc). ✅
  - Premarket : sous-titres dev-leak « via FX hook » et « overnight feed » **supprimés** (cellules USD/CHF et DXY ; valeur DXY intacte, hors-scope U12). ✅
  - General : input **Email supprimé** (décision actée : suppression, pas câblage) + **Nom relu depuis `localStorage`** au mount via `initialProfileName` (lazy `useState`, fallback `''`, plus de « Rafael » en dur). ✅
  - Dashboard : fallback QueryID `1443387` (n° de compte réel) **neutralisé** → placeholder `——` quand non configuré (`RiskMatrix.jsx`), chemin de lecture localStorage intact. ✅
  - Build OK. Vérif visuelle Playwright optionnelle non effectuée (changements bas-risque, sans logique).

### Vague 2 — Quick wins fonctionnels (applicatif, pas de data externe)

- **U3 · Dashboard : header RiskMatrix** — ✅ **FAIT (b6d4799)**. Boutons morts **`Detail` et `History` supprimés** (markup ; aucun handler/état JS n'y était attaché). Bouton **`Export CSV` câblé** → `handleExport` sérialise les métriques affichées du cockpit (Contexte / Performance / Drawdown / Streak / Win-Loss) via `downloadRiskMatrixCsv` (Blob `text/csv` horodaté `ibkr-risk-matrix-<date>.csv`, **même convention que `History.exportCsv`**). Valeurs = mêmes champs `m.*` + mêmes formatters que le rendu (aucune donnée inventée), null-guardées (`—`). Bouton **désactivé si `tradeCount === 0`** (tout serait `—`). Style `:disabled` ajouté. Build OK. (CSS `.risk-matrix__action--active` désormais inutilisée → laissée pour l'audit purgecss dédié.)
- **U4 · Positions : deep-link `?focus={id}` + detail panel** — ✅ **FAIT (43d731d)**. Read-only uniquement (les actions de mutation sont U4-bis, hors-scope ici). (1) **Deep-link** : `useSearchParams` lit `?focus`. `DataTable` étendu de façon **additive et rétro-compatible** (`getRowId`→`data-row-id` sur chaque ligne/carte ; `focusedRowId`→classe `.v3-table__row--focus` fond `--accent-soft` + filet `--accent` inset + `scrollIntoView` interne). La ligne ciblée est surlignée (non destructif : 1 seule ligne, hover/tri/alerts intacts) **et** scrollée dans la vue ; un id inconnu = no-op silencieux (param laissé tel quel, aucun crash). Corrige le no-op du lien Premarket→Positions. (2) **Panneau détail read-only** au clic (`onRowClick`→`Modal` v3 Radix **réutilisé** : Escape + backdrop + bouton close + focus-trap fournis). Contenu = strictement les données déjà calculées de la ligne — contrat (strike/exp/DTE/qty/mult), prix & P&L, capital engagé + max loss théorique + `effectiveSlDollar` (SL 35 %, `—` pour les shorts), Greeks Δ/Γ/Θ/ν via le **même greeksMap + marquage `~`** que le tableau, alertes via `getPositionAlerts`. **Aucune action de mutation** (seul lien : navigation pure vers `/trading/chain`). Vérif visuelle Playwright **isolée** OK (a focus+scroll, b focus inexistant sans crash, c panneau au clic, d fermeture Escape) ; console 0 erreur ; build OK.
- **U4-bis · Positions : actions Clôturer + Éditer (panneau détail)** — ✅ **FAIT (760e6fa)**. ⚠️ **Seule unité du projet qui mute des positions réelles.** **Diagnostic Étape 0** : `CLOSE_POSITION` (reducer) existe, propre et atomique (`{positionId, remainingPosition, closedTrade}` → retire l'open, ajoute le closed trade, push optionnel du restant) mais **n'était dispatché par aucune UI** → réutilisé tel quel + formulaire de sortie minimal + construction du closed trade à la **forme canonique d'`AddTradeModal`** (`{tk,as,ty,dir,st,ex,ct,mu,pi,po,di,do,fi,fo,fxi,fxo,tag,note,src}`, **avec `id` généré** car `CLOSE_POSITION` n'en pose pas). **Aucune action d'édition n'existait** (pas d'`UPDATE_POSITION` ; `AddTradeModal` est create-only et produit des trades clôturés) → après **validation explicite de l'utilisateur sur données réelles**, **nouvelle action `UPDATE_POSITION` ajoutée** : merge-by-id propre (calqué sur `UPDATE_CLOSED_TRADE`), liste blanche de champs sûrs (`tk, ty, dir, st, ex, pi, ct, di`), `lots` retiré si `pi`/`ct` change (anti-désync). **Implémentation** : le panneau détail bascule en mode `view`/`edit`/`close` dans la même Modal. **Clôture** — garde dur (prix sortie > 0 + date sortie ≥ entrée → bouton désactivé + message d'erreur), résumé de confirmation (ticker, qté, prix sortie, **P&L résultant**) avant exécution, dispatch `CLOSE_POSITION` **uniquement**. **Édition** — formulaire pré-rempli, champs sûrs seulement, validation pi/ct > 0, dispatch `UPDATE_POSITION` **uniquement**, panneau reflète les nouvelles valeurs. **Jamais d'écriture directe dans le store.** Non-régression U4 préservée (focus, ouverture/fermeture Escape, affichage read-only — les boutons s'ajoutent, ne remplacent rien). Vérif Playwright **isolée** : (a) clôture NVDA à $5 → quitte l'open, apparaît dans History avec **P&L −$600** (vérifié à la main : (5−8)×2×100) ; (b) garde : sans prix de sortie → refusé (bouton désactivé + message), aucune mutation ; (c) édition pi 12.50→14.00 → table + KPI Capital engagé ($4'200) + P&L recalculé + persistance `ibkr_u_o` cohérents ; (d) ?focus + Escape OK ; (e) 0 erreur console issue de l'unité. Build OK.
- **U5 · Nettoyage dead-code** — ✅ **FAIT** (ce commit). **Garde grep (repo entier) appliquée** : pour chaque fichier/hook, seules références = sa propre définition + des **commentaires/docs** (`Dashboard.jsx:14/16`, `v4-dashboard.css:35`, `CHANTIER.md`). **Zéro import vivant** (`import`/`<X />`/`useX()`). **6 fichiers supprimés** : `VolatilitySkew.jsx`, `MarketInternals.jsx`, `TradeHistoryPlaceholder.jsx`, `SniperGateMonitor.jsx`, `useVolSkew.js`, `useMarketInternals.js`. **0 conservé**. `useSniperGates` (importé jadis par SniperGateMonitor) **reste** — utilisé par PreMarketBriefing (vivant). Build OK après suppression (aucun import pendant).

### Vague 3 — Applicatif sans data externe (remplit les vides du Dashboard)

- **U6 · Watchlist persistée avec quotes live** — ✅ **FAIT (1350688)**. Slice store `watchlist` (clé courte `ibkr_u_w`, lecture défensive `[]` → **pas de bump de schéma**, slice additive isolée attachée hors-migration) + actions reducer `ADD_TICKER`/`REMOVE_TICKER` (normalise majuscules, trim, dédup, vide ignoré), persistée via le même `subscribe` debounced que les autres slices (reference-gate dédié `w`). Préservée par `RESET_ALL` (préférence, comme FX/tier). Hook `useWatchlist` : lit la slice + récupère prix/variation par ticker via **`useMarketQuotes` (endpoint `/api/quote`, exactement le hook de PreMarketBriefing)** — aucune nouvelle source externe. UI : input d'ajout inline (header) + bouton suppression par ligne (palette canonique flat) ; prix/variation `—` tant que la quote n'est pas revenue (jamais un faux 0), tone vert/rouge sur la variation seulement. Colonnes réduites aux données réelles `Ticker · Last · Chg %` (Vol/IV/IVR/Spark retirées faute de source — pas de colonne fantôme). Vérif Playwright isolée : ajout `msft`→`MSFT` + suppression OK, persistés dans `ibkr_u_w`. Build OK.
- **U7 · AlertsFeed dérivé** — ✅ **FAIT (de64b3b)**. `useAlertsFeed` n'est plus un stub `[]` : **agrégation pure, en temps réel, de signaux déjà calculés** (aucune nouvelle slice, aucun journal d'événements daté, aucun effet de bord). Deux sources : (1) **`generateAlerts`** (utils/alerts, moteur canonique) filtré aux signaux **actionnables red/orange** (DTE critique, stop-loss, time-stop, TP, DTE-warning) — chaque entrée porte le `positionId` → cible **`/trading/positions?focus={id}`** (réutilise le deep-link U4) ; (2) **`useDailyKillSwitch`** (`triggered`) → `/insights/journal`. Les gates `useSniperGates` recoupent DTE/SL/TP de generateAlerts → écartées pour éviter les doublons (choix documenté). Sévérité `critical`/`warning`, dédup par id, tri sévérité décroissante (stable). Composant réécrit : **plus de fausse heure** (signaux dérivés de l'état présent, pas d'événements datés) ni de bouton pause stub ; pastille sévérité colorée (URGENT rouge / ALERTE ambre), message, ligne cliquable → navigation pure. **Empty state POSITIF** « Aucune alerte active · Tout est sous contrôle ». `utils/alertsFeed.js` (helper timestamp/level de l'ancien log-stream) supprimé (grep : plus aucun consommateur vivant). Vérif Playwright isolée : (a) 3 URGENT + 1 ALERTE triés ; (b) clic alerte NVDA → `?focus=d-nvda` + surlignage U4 (chaîne U7→U4 OK) ; (c) empty state positif sur portefeuille sain ; (d) 0 erreur issue d'U7 (seules les 500/429 d'API externes en dev) ; (e) row 5 vivante. Build OK.
- **U8 · Dashboard mini-calendrier** — ✅ **FAIT (72b3d0e)**. `CalendarMiniPlaceholder` (stub texte « Module en cours de développement ») remplacé par `CalendarMini` : vue 7 jours condensée dérivée des **mêmes feeds que la page Calendar** (`useCalendarFeeds` earnings + macro, déjà câblé) + expirations des positions ouvertes (source locale). **Aucun fetch nouveau.** Fenêtre `[today, today+7]`, tri par date, max 8 entrées, tag type (Résultats/Macro/Expiration). Chaque ligne → `/insights/calendar` (navigation pure, aucune mutation). Empty state propre « Aucun événement à venir » ; Finnhub absent/HS → dégradé propre (earnings/macro vides mais expirations locales toujours affichées, pas de crash — vérifié : les 2 endpoints `/api/finnhub/*` renvoient 500 en dev sans clé, la tuile reste fonctionnelle). `CalendarMiniPlaceholder.jsx` supprimé (grep : plus aucune référence vivante hors la nouvelle tuile). Vérif Playwright isolée : 2 expirations affichées dans la fenêtre 7 j, placeholder disparu. Build OK.

### Vague 4 — Cohérence visuelle (continuation brique 15)

- **U9 · Migration chrome legacy** — ✅ **FAIT (fbcf6d0)**. Conversion **visuelle mécanique stricte** (zéro redesign, zéro changement de layout/logique/données) : Analytics + Journal + le sous-composant `RiskMetricsRow` (Analytics-only) passent du chrome legacy à la palette canonique flat, recette **copie locale namespacée par page** (comme `.history-page__panel`/`.history-page__kpi-tile` — aucun couplage CSS inter-pages).
  - **Correspondance appliquée** : `<GlassCard>` → `<div className="{ns}__panel">` (surface `--depth-raised`, filet `--line-hairline`, radius 2px, ni ombre ni backdrop) ; `variant="subtle"` → `…__panel--subtle` (`--depth-base` + `--qc-space-6`) ; `.dashboard-v3__panel-head` → `.{ns}__panel-head` ; `<MetricCard size="compact">` → tuile plate `KpiTile` (`…__kpi-tile-value--up/down/neutral`). `{ns}` ∈ `analytics-v3` / `journal-v3` / `risk-metrics-row`. `fmtMetric` local reproduit **à l'identique** le formatage Intl de `MetricCard` (valeurs inchangées). Contenu, données, ordre des sections, tooltips : strictement préservés (seules les icônes décoratives par-tuile de MetricCard disparaissent — la tuile canonique n'en a pas).
  - **Sémantique couleur** : corrigé un vert parasite préexistant sur **Avg Hold** (MetricCard `semantic='auto'` colorait en profit toute valeur positive) → désormais **neutre**. Max Drawdown reste rouge (perte d'argent réelle, légitime) ; les ratios (Sharpe/Sortino/Calmar/Expectancy/PF/WinRate) conservent leurs tons de seuil (convention canonique déjà en vigueur sur la KPI strip de History — pas une violation).
  - **Orphelins** : `MetricCard.jsx` **supprimé** (grep repo entier : zéro consommateur vivant après conversion). `GlassCard.jsx` **conservé** (encore consommé par `App.jsx`, `settings/Api.jsx`, `ui/DataTable.jsx`). Les **styles** désormais orphelins (`.metric-card*`, `.dashboard-v3__panel-head`) sont **laissés à l'audit CSS/purgecss dédié** (cf. feedback dead-code) ; le commentaire de `History.jsx`/`pages-history.css` « .dashboard-v3__panel-head toujours consommé par Analytics + Journal » devient caduc (à nettoyer dans cette session CSS).
  - **Vérif** : `vite build` OK ; revue adversariale 4 agents (non-régression Analytics/Journal, sûreté suppression+CSS, sémantique couleur) = 4× pass ; Playwright **isolé** + démo injectée → Analytics 6 panneaux flat (`legacyGlass:0`/`legacyPanelHead:0`, valeurs identiques, Avg Hold neutralisé), Journal Tilt+entrées+Edge Leak flat (idem, rouge = pertes réelles uniquement), captures lues, console 0 erreur issue d'U9. **Dernière unité du plan — périmètre de finition terminé.**

### Vague 5 — Greeks (conditionné à D-a)

- **U10 · Snapshot Greeks quotidien** : slice store + hook d'écriture (analogue `dailySnapshots`), brancher `GreekEvolutionChart` dessus, **supprimer `buildMockEvolution`**, alimenter `ThetaDecayProjection` avec l'historique réel. **Applicatif** (pas de data externe). Ne le faire que si la page Greeks est destinée à être livrée.

### Vague 6 — Candidats HORS-SCOPE (sous réserve de validation § C — data externe)

- **U11 · Premarket : réutiliser sources câblées** — ✅ **FAIT (bc296dc)**. Macro du jour + earnings BMO/AMC branchés sur **`useCalendarFeeds`** (le même hook que Calendar — `useEarningsCalendar` était un **stub `[]`**, donc écarté ; aucun nouvel endpoint, aucune nouvelle source).
  - **2 nouvelles sections** `premarket-page__section` insérées entre Positions Review et la checklist (mêmes `premarket-page__table` / `module-empty` que l'existant — pas de redesign) :
    - **Calendrier macro · {séance}** : événements macro médium+/fort du jour, dérivés de `useCalendarFeeds` (`minImpact:'medium'`, comme Calendar) + **fallback offline `macroEventsInRange`** (FOMC/CPI/NFP 2026) quand Finnhub HS/vide — exactement la cascade de la bannière Calendar. Pill impact (FORT = amber décisionnel).
    - **Earnings · {séance}** : earnings du jour, **BMO/AMC disponibles** (champ Finnhub `hour` `'bmo'/'amc'/'dmh'` → pills) ; `myTickers` = union **MAJOR_US_TICKERS ∪ positions tenues** ; les tickers de positions ouvertes sont **surlignés** (tint amber + tag « position », triés en tête). EPS/CA estimés formatés avec le même null-guard strict que Calendar.
  - **Date séance** : `sessionDateStr` = aujourd'hui (date NY) en séance pre/open, sinon prochain jour ouvré. Empty states distincts (« Aucune annonce macro… » / « Aucun résultat publié… »), dégradé propre si Finnhub HS (vérifié : 500 en dev → macro via fallback, earnings → empty state, zéro crash).
  - **Checklist** : conservée telle quelle (workflow de confirmation) ; ses items « Calendrier macro » / « Earnings BMO/AMC » ont désormais les vraies sections de données à réviser au-dessus.
  - **Vérif** : `vite build` OK ; Playwright **isolé** + démo (2 positions NVDA/AAPL + cache earnings seedé) → macro = FOMC 17/06 (FORT), earnings = 4 lignes triées (AAPL/NVDA en évidence « position », BMO/AMC, COST sans estimés → « — »), Positions Review/horloges/regime/checklist intacts, capture lue, 0 erreur console issue d'U11 (seules 500/502 d'API externes en dev).
  - **Gates EARN-J2 / EARN+J30 (NON implémenté, hors-scope)** : **trivialement faisable** — le feed earnings expose `{symbol, date}` et le matching sur les tickers tenus est déjà fait (surlignage) ; un day-delta position↔prochain earning activerait ces 2 gates dans `useSniperGates`. À valider séparément.
- **U12 · Premarket : DXY + futures overnight** — ✅ **FAIT (a3283cb)**. DXY + futures ES/NQ/YM affichés dans le PreMarketBriefing via le **même `/api/quote`** (cascade Finnhub→Yahoo→CBOE) et le **même hook `useMarketQuotes`** que VIX/SPX/QQQ. Aucun nouvel endpoint, aucune nouvelle source.
  - **Étape 0 — verdict de faisabilité des symboles** (test réel contre l'endpoint en dev, dev exécute les handlers sans clé Finnhub → exerce la voie Yahoo/CBOE, valide pour la prod) :

    | Symbole | /api/quote | Verdict |
    |---|---|---|
    | `DX-Y.NYB` | ✅ 200 (~100.1, source yahoo) | **retenu pour DXY** |
    | `^DXY` / `DXY` / `DX=F` | ❌ 502 (finnhub+yahoo+cboe échouent) | écartés |
    | `ES=F` | ✅ 200 (~7'538, yahoo) | **retenu** |
    | `NQ=F` | ✅ 200 (~30'262, yahoo) | **retenu** |
    | `YM=F` | ✅ 200 (~52'333, yahoo) | **retenu** |

    Au moins DXY **et** les 3 futures servent de vraies valeurs (2 runs stables, prix + variation réels) → affichage implémenté **uniquement pour ces 4 symboles validés**. Aucun bloc « —— » permanent.
  - **Implémentation** : symboles ajoutés à `useMarketQuotes` (un seul fetch, pas de duplication). **DXY** garnit la cellule existante du regime row (plus de « —— » en dur ; sous-titre dev-leak « overnight feed » déjà retiré en U2). **Futures** = nouveau strip 3 cellules (ES/NQ/YM) sous le regime row, réutilisant `.premarket-page__regime` (pas de redesign). Variation colorée vert/rouge **sur le sub uniquement** (`--regime-sub--up/--down`), signe nul → neutre (aucun rouge parasite ; la valeur reste en ink neutre). `——` temporaire pendant le fetch, jamais permanent (symboles validés).
  - **Vérif** : `vite build` OK ; Playwright **isolé** → DXY `100.12 +0.59 %` (vert), ES `7'539 −0.63 %` / NQ `30'274 −0.13 %` / YM `52'334 −0.26 %` (rouge), regime/positions/macro/earnings/checklist intacts, capture lue, **0 erreur console issue d'U12** (les 4 symboles renvoient 200 ; seules les 502 préexistantes de `VIX`/`SPX` et 500/502 d'autres feeds en dev).
  - **Observation hors-scope (→ corrigée en U12-bis)** : le regime row appelait encore `'VIX'`/`'SPX'` qui **ne sont pas servis** (502 → « —— ») ; `'^VIX'`/`'^GSPC'` fonctionnent (cf. `^GSPC` 200 en Étape 0).

- **U12-bis · Premarket : corriger les symboles VIX/SPX du regime row** — ✅ **FAIT (ce commit)**. Les 2 cellules `VIX` et `SPX` affichaient « —— » en permanence car `'VIX'`/`'SPX'` nus ne sont pas servis par `/api/quote`. Remplacés par les symboles Yahoo corrects.
  - **Étape 0 — verdict** (test réel de l'endpoint) :

    | Symbole | `/api/quote` | Verdict |
    |---|---|---|
    | `^VIX` | ✅ 200 (~18.7, yahoo) | **retenu (VIX)** |
    | `^GSPC` | ✅ 200 (~7'418, yahoo) | **retenu (SPX)** |
    | `VIX` (nu) | ❌ 502 | confirmé cassé |
    | `SPX` (nu) | ❌ 502 | confirmé cassé |

  - **Implémentation** : `PREMARKET_INDICES` = `['^VIX', '^GSPC', 'QQQ']` ; **fetch ET lecture synchronisés** — les cellules lisent `quotes['^VIX']` / `quotes['^GSPC']` (clé = symbole exact, notation crochets), et `vixRegime(quotes['^VIX'])` pilote le badge de volatilité. Labels d'affichage « VIX » / « SPX » inchangés. QQQ/DXY/futures (U12) intacts. Aucun « —— » permanent (symboles validés).
  - **Vérif** : `vite build` OK ; Playwright **isolé** → VIX `18.73` + badge **NORMAL** (cohérent : 18.73 ∈ [15,20[ → NORMAL ; le regime de volatilité reflète bien le vrai VIX), SPX `7'418 −1.24 %`, QQQ/DXY/futures/Positions/macro/earnings/checklist intacts, capture lue, **0 erreur console pour `^VIX`/`^GSPC`** (les 502 `VIX`/`SPX` du premarket ont disparu ; reste un `^NDX` 502 du **header global**, hors-scope).
  - **Reste lié** : le **header global** consomme aussi des symboles potentiellement non servis (`^NDX`, etc.) — même racine, composant distinct, hors U12-bis.
- **U13 · IV historique 52w** (gros) — débloque simultanément Chain IVR, History backfill Δ/IVR, `useIVMovers`, Greeks IV rank. Source externe ou stockage cumulé local de `qc:chainIv`.
- **U14 · SectorHeatmap** — feed externe ou agrégation GICS locale.
- **U15 · Analytics HourChart** — retirer (pas d'horodatage intraday) ou repenser.
- **U16 · News flow Premarket** — nécessite une source (Finnhub news / RSS). Le plus lourd, le moins prioritaire.

---

**Reco de démarrage** : **U1 → U2 → U4** donnent le meilleur ratio honnêteté-perçue / effort. **U6 + U8** suppriment le plus gros « trou visuel » (rows 4-5 Dashboard) sans toucher à de la data externe. Tout le hors-scope (U11-U16) attend ta validation de la ligne.
