# CARTE DE CHANTIER — QuantumCall (état au 2026-05-31)

Synthèse des 5 audits parallèles (data layer + 12 pages). Honnête, sans flatter.

---

## 1. Dashboard (`/dashboard`)

**ÉTAT** : complète (à 85%). Layout v6 livré, toutes les sections rendent du contenu, mais 2 endroits affichent du tier/risque hardcodé et 1 module est un stub.

**Ce qui marche** :
- 9 KPI cards (NLV, Realized, Avail Capital, Unrealized, Day P&L, Exposure, Win Rate, streaks) — sources live via `usePortfolioMetrics`, `useKPIs`, `useEquityHistory`, `useDailySnapshot`.
- EquityChart + DailyPnLChart avec range 5D/1M/3M/1Y/ALL synchronisé.
- LivePositions 19 cols + sub-header + footer agrégé (Σ Δ, Σ Θ).
- TradeHistory 13 cols + footer 6-cell.
- RiskMatrix cockpit Bloomberg-dense (10 rows perf + DD + streaks + WR gauge).

**Ce qui est vide / factice** :
- `CalendarMiniPlaceholder.jsx` — littéralement `<div>Module en cours de développement</div>`.
- `SNIPER_DEFAULTS` hardcodés dans `DashboardKPICards.jsx:481` : `tierLabel: 'A · E0×C1'`, `cashFloorPct: 30`, `notionalMaxPct: 70` — ne reflètent pas le tier réel.
- `RiskMatrix.jsx:912` : badge `TIER A · E0×C1` en dur ; QueryID `1443387` en dur.
- 3 boutons header RiskMatrix (`98) Detail`, `99) Export`, `97) History`) sans onClick.
- "RISK $" Card = proxy via unrealized de la 1ʳᵉ position (faux SL en dollars).
- 5 TODO Phase C (`DashboardKPICards.jsx:24-26, 480, 896, 1047` ; `RiskMatrix.jsx:30, 753`).

**Ce qui manque** :
- `settings.activeSniperTier` exposé par le store (pour virer SNIPER_DEFAULTS).
- `pos.slDollar` côté position (vrai risque maxLoss).
- Calendrier mini : à remplacer par un vrai mini-cal (lien sur `/insights/calendar`).
- Handlers des 3 boutons d'export RiskMatrix.

**Dépendances** : aucune externe — tout est dérivé du store + bridge IBKR. Le blocage est purement applicatif.

---

## 2. PreMarketBriefing (`/premarket`)

**ÉTAT** : partielle (60-65%). Squelette cockpit livré, mais 2 cellules sont des `——` permanents et 4 items de checklist n'ont rien derrière.

**Ce qui marche** :
- Header strip : 3 clocks live (Zürich/Londres/NY), phase US calculée (PRE/OPEN/AFTER/CLOSED), countdown 1s.
- Market regime row : VIX/SPX/QQQ via `useMarketQuotes` + classification `vixRegime()`.
- Gates table : positions ARMED/IMMINENT triées via `useSniperGates`, click row → `/trading/positions?focus={id}`.
- Routine checklist 6 items persistée en localStorage (`qc:premarket:checks:{date}`) avec reset quotidien et `_readyAt` confirmation.

**Ce qui est vide / factice** :
- Ligne 277-280 : `USD/CHF · ——` (commentaire via FX hook).
- Ligne 281-285 : `DXY · ——` (commentaire overnight feed).
- Checklist item "Macro" : case à cocher, aucune donnée macro affichée à côté.
- Checklist item "Futures + DXY overnight" : case à cocher, aucun futures (ES/NQ) ni DXY.
- Checklist item "Earnings BMO / AMC" : case à cocher, aucun earnings affiché.
- Checklist item "News flow" : aucun feed.
- `confirmReady()` ne fait rien d'autre que poser un timestamp local.

**Ce qui manque** :
- Câbler USD/CHF sur `settings.liveRate` (le hook FX existe déjà — c'est 5 lignes).
- DXY : nouvelle source (Yahoo `DX-Y.NYB` via `/api/quote`).
- Futures overnight : ES=F, NQ=F, YM=F via `/api/quote` (extension du cascade).
- Macro snippet : lire `useCalendarFeeds` côté macro (déjà câblé sur la page Calendar).
- Earnings BMO/AMC : filtrer `useEarningsCalendar` sur la date du jour.

**Dépendances** : DXY + futures = besoin de symbols supportés par les endpoints existants (à vérifier, probable OK Yahoo). News flow = pas de source actuellement, gros chantier si on veut le faire.

---

## 3. Positions (`/trading/positions`)

**ÉTAT** : complète (95%). Les 3 branches (empty / flat / open) fonctionnent.

**Ce qui marche** :
- Empty state + CTA import.
- Flat state : dernière clôture, win rate 10 derniers, mini-donut mix, lien Sniper OTM.
- Open state : KPI strip 5 tuiles (Positions, Δ net, Θ total, Capital engagé, Max Loss), DataTable 12 cols, mobile cards.
- Greeks en cascade : mark → chain cache → σ=30% fallback. État "en attente du premier fetch" propre.
- Alerts inline (DTE_CRITICAL, STOP_LOSS, TP_REACHED).

**Ce qui est vide / factice** :
- `Positions.jsx:925` : `onRowClick={undefined /* future: open detail panel */}` — pas de modal détail.
- Colonnes Δ/Θ affichent `—` si pas de fetch Greeks.

**Ce qui manque** :
- Panneau détail au click (intention claire dans le commentaire).

**Dépendances** : aucune nouvelle — tout est déjà branché (bridge + Greeks API + store).

---

## 4. History (`/trading/history`)

**ÉTAT** : complète (95%). Production-ready.

**Ce qui marche** :
- 2 view modes (Standard / Sniper) avec colonnes conditionnelles.
- KPI strip 6 tuiles, filtres Result/Type, recherche, tri, export CSV.
- WinRateDonut + LazyDistribution (recharts).
- PerformanceAttribution Edge × Capital 5×5 grid.
- ExitReasonEditor avec auto-détection confidence.

**Ce qui est vide / factice** :
- Colonnes Δ entry / IV rank affichent "Donnée non disponible" pour les trades anciens (`_deltaApproximated`).

**Ce qui manque** :
- Backfill historique des Δ/IV rank au moment de l'entrée — nécessite spot/IV historique (source externe à trouver).

**Dépendances** : spot historique + IV rank historique pour enrichir le passé. Non bloquant pour la page elle-même, c'est de l'enrichissement.

---

## 5. Chain (`/trading/chain`)

**ÉTAT** : complète (90%). Page fonctionnelle (Yahoo Finance + BSM client-side).

**Ce qui marche** :
- Topbar ticker + recent history.
- Stats 6 cells (Spot, ATM IV, expirations, strikes, Sniper Zone).
- Tenor tabs (jusqu'à 8 expirations), strike count switch.
- OptionsChainTable ATM-anchored, footer analytics (Max Pain, 25Δ RR, OI top, GEX, walls).
- Row click → AddTradeModal pré-rempli.

**Ce qui est vide / factice** :
- `Chain.jsx:527` : cellule IVR = `——` + label "Sprint 6 — IV history" (stub assumé).

**Ce qui manque** :
- IV Rank (nécessite IV historique 52w).

**Dépendances** : Yahoo `/api/yahoo/[ticker]` (à vérifier que l'endpoint existe et n'est pas rate-limited en prod).

---

## 6. Greeks (`/trading/greeks`) — gated `FEATURE_GREEK_CENTER`

**ÉTAT** : partielle (graph principal = mock). La page est livrée, mais son cœur visuel est du faux.

**Ce qui marche** :
- Hero 4 KPI (Δ/Γ/Θ/ν) live.
- Per-position table sign-aware.
- Vega pie par ticker, IV Rank histogram, panel second-order (Vanna/Charm/Vomma/GEX) calculé.

**Ce qui est vide / factice** :
- `Greeks.jsx:78` `buildMockEvolution()` : génère 30 jours fictifs avec wobble ±15% autour des Greeks actuels. Commentaire explicite "MOCK EVOLUTION — no historical storage yet".
- ThetaDecayProjection : projection linéaire à partir du θ actuel (pas d'historique).
- Feature flag `FEATURE_GREEK_CENTER` OFF par défaut.

**Ce qui manque** :
- Snapshot quotidien des Greeks dans le store (cron au boot du jour ou hook qui écrit en fin de session).
- Sans ça, le graph principal n'a aucune valeur décisionnelle.

**Dépendances** : chantier "snapshot quotidien" à créer (similaire à `dailySnapshots` du NLV). Pas d'API externe nécessaire.

---

## 7. Analytics (`/insights/analytics`)

**ÉTAT** : complète (95%). Prod-ready.

**Ce qui marche** :
- KPIs via `useTradingMetrics` + `usePortfolioMetrics` (WR, PF, expectancy, Sharpe, Sortino, Calmar, Omega, Kelly, maxDD).
- HourChart / DayChart agrégés par heure / jour de semaine.
- PnLCalendarHeatmap mode year.
- WinRateDonut, StrategyBreakdown (lazy).
- RiskMetricsRow 6 KPIs avec tooltips.

**Ce qui est vide / factice** :
- EmptyState propre si 0 trades.

**Ce qui manque** : rien de visible.

**Dépendances** : besoin d'historique de trades long pour que les KPIs soient statistiquement parlants (>30 trades pour PF crédible). Pas un blocage code, c'est de l'usage.

---

## 8. Calendar (`/insights/calendar`)

**ÉTAT** : complète (85%). 3 onglets fonctionnels, un détail oublié dans le popup earnings.

**Ce qui marche** :
- Onglet Announcements : `useCalendarFeeds` (Finnhub earnings + macro, fallback `MACRO_EVENTS_2026`), filtrage par tickers du portefeuille, dots dans la grid, upcoming list 20 events.
- Onglet P&L Heatmap : dayPnl map, detail panel cliquable.
- Onglet Year : PnLCalendarHeatmap 52×7.
- API status banner avec 4 états distincts.

**Ce qui est vide / factice** :
- Popup earnings : `epsEst` / `revEst` sont fetchés (l. 162-165) mais jamais rendus dans la popup (l. 258-262).
- `MACRO_EVENTS_2026` fixture (volontaire pour offline resilience).

**Ce qui manque** :
- Afficher EPS estimate / Revenue estimate dans la popup (déjà en mémoire, c'est 3 lignes JSX).
- Forecast/previous/actual macro : à vérifier si Finnhub les fournit.

**Dépendances** : Finnhub already câblé. Pas de nouvelle source.

---

## 9. Journal (`/insights/journal`)

**ÉTAT** : complète (95%). Prod-ready.

**Ce qui marche** :
- CRUD entries via store (`ADD_JOURNAL` / `DELETE_JOURNAL`).
- TiltMeter (`computeTiltScore` 14j, 4 zones).
- `useDailyKillSwitch` avec warning card.
- EdgeLeakAudit crosstab tag × P&L avec fuzzy matching (±1 jour).
- Modal nouvelle entrée complet (mood, mistake, tag, rating, note).
- Filtres mood, 3 EmptyState contextuels.

**Ce qui est vide / factice** : rien.

**Ce qui manque** : rien.

**Dépendances** : valeur croît avec le volume de trades fermés (Edge Leak Audit a besoin de matches).

---

## 10. Settings · General (`/settings/general`)

**ÉTAT** : complète (95%). 1 champ cosmétique non câblé.

**Ce qui marche** :
- Profil nom (persisté localStorage), timezone read-only.
- Taux USD/CHF + bouton Actualiser (`useFx().refresh()` avec loading state).
- Capital de référence CHF → `SET_INITIAL_CAPITAL` + conversion live.
- Badge PAPER/REAL auto.
- Kill Switch : input + dispatch + statut Armé/Déclenché/Inactif.
- ThemeSwitcher + toggle daltonien.
- CashFlowsSection complète (add/delete, tri desc, 20 visibles).
- Connexions API mini-status.
- Zone dangereuse avec modal + checkbox confirm + `RESET_ALL` + purge localStorage Flex + navigate dashboard + toast.

**Ce qui est vide / factice** :
- `General.jsx:383-390` : input Email avec `defaultValue=""` sans `onChange`, jamais persisté.

**Ce qui manque** :
- Câbler Email (ou le retirer si inutile) — décision produit.

**Dépendances** : aucune.

---

## 11. Settings · Import (`/settings/import`)

**ÉTAT** : complète (100%). Production-ready.

**Ce qui marche** :
- FlexSection : QueryID + Token → `configureFlex` → `syncFlex` (`/api/flex/sync`) → `parseIbkrCsv` → `mergeIbkrData` (dédup par `_flexTxId` + signature) → `IMPORT_DATA` + toast stats.
- Bouton "Effacer identifiants" + badge "Sync [heure]".
- CsvUploadSection : drag & drop, file input, parse identique.
- Export JSON (Blob horodaté), Restore JSON (validation shape minimale).
- Affichage `lastImport` (nom + stats).

**Ce qui est vide / factice** : rien.

**Ce qui manque (cosmétique)** :
- Bouton "Test connexion" Flex (sans devoir lancer une vraie sync).
- Preview CSV avant merge.
- Dry-run JSON restore.

**Dépendances** : aucune.

---

## 12. Settings · API (`/settings/api`)

**ÉTAT** : complète (90%). Tout marche, mais zéro test interactif.

**Ce qui marche** :
- Grille 7 services via `useApiStatus` + `<ApiServiceCard>`.
- Modal Config Flex (réutilise logique Import).
- Toggle `gwAutoConnect` → `SET_GW_AUTO_CONNECT` (persisté).
- Infopanels lecture seule (clés Vercel côté serveur, logs).

**Ce qui est vide / factice** : rien.

**Ce qui manque (UX)** :
- Bouton "Test" par service (probe manuel).
- Statut connecté/déconnecté du bridge IBKR (le toggle est en aveugle).
- Historique des erreurs récentes.

**Dépendances** : aucune.

---

## Tableau récapitulatif

| #  | Page              | État                                             | Effort pour finir                          |
|----|-------------------|--------------------------------------------------|--------------------------------------------|
| 1  | Dashboard         | Complète (85%) — TODO Phase C + 1 stub mini-cal  | Moyen (tier dans store + mini-cal réel)    |
| 2  | PreMarketBriefing | Partielle (60-65%) — 2 ——, 4 items orphelins     | Moyen-Lourd (FX trivial, news = lourd)     |
| 3  | Positions         | Complète (95%) — pas de detail panel             | Léger                                      |
| 4  | History           | Complète (95%) — backfill Δ/IVR manquant         | Léger (sauf si backfill historique)        |
| 5  | Chain             | Complète (90%) — IVR stub                        | Moyen (IV history)                         |
| 6  | Greeks            | Partielle (60%) — graph principal = mock         | Moyen (snapshot quotidien à créer)         |
| 7  | Analytics         | Complète (95%)                                   | Aucun                                      |
| 8  | Calendar          | Complète (85%) — popup earnings incomplète       | Léger                                      |
| 9  | Journal           | Complète (95%)                                   | Aucun                                      |
| 10 | Settings/General  | Complète (95%) — Email orphelin                  | Léger (5 min)                              |
| 11 | Settings/Import   | Complète (100%)                                  | Aucun (option : preview/dry-run en léger)  |
| 12 | Settings/API      | Complète (90%) — pas de test bouton              | Léger                                      |

**Hooks "stub" globaux** (rendent `[]` / `null`) — impactent plusieurs pages : `useAlertsFeed`, `useSectorHeatmap`, `useVolSkew`, `useMarketInternals`, `useWatchlist`, `useIVMovers`. Dashboard et Premarket sont les consommateurs principaux.

---

## Ordre recommandé pour finir (qualité, pas vitesse)

Logique : d'abord les fondations data partagées, puis les pages qui en bénéficient, puis le polish.

### Phase 1 — Fondations data (débloque plusieurs pages)

1. Exposer `settings.activeSniperTier` dans le store + `pos.slDollar` sur positions → débloque Dashboard cards 2/6/RISK + RiskMatrix tier badge + PreMarket gates.
2. Snapshot Greeks quotidien (hook + slice store similaire à `dailySnapshots`) → débloque Greeks page (vraie evolution) + projection theta réelle.
3. IV Rank historique (rolling 52w via Yahoo ou stockage local cumulé) → débloque `useIVMovers`, Chain stat IVR, History Δ entry / IV rank.

### Phase 2 — Pages partielles

4. **PreMarketBriefing** : câbler USD/CHF (trivial), DXY + futures overnight (Yahoo cascade), macro + earnings du jour (réutilise `useCalendarFeeds`). Laisser news flow pour plus tard.
5. **Greeks** : connecter le nouveau snapshot à GreekEvolutionChart et virer `buildMockEvolution`.
6. **Chain** : brancher IVR sur la nouvelle source IV history.

### Phase 3 — Polish ciblé

7. **Dashboard** : remplacer `CalendarMiniPlaceholder` par un mini-cal réel (vue 7 jours condensée de Calendar) ; brancher les 3 boutons RiskMatrix (Detail/Export/History) ou les enlever.
8. **Calendar** : afficher `epsEst`/`revEst` dans la popup earnings.
9. **Positions** : implémenter le detail panel au click (intention déjà présente).
10. **Settings/General** : décider du sort de l'input Email (câbler ou supprimer).
11. **Settings/API** : ajouter un bouton "Test" par service (probe manuel one-shot).

### Phase 4 — Optionnel / faible ROI immédiat

12. Backfill Δ/IV rank des trades anciens (gros chantier données externes).
13. News flow Premarket (besoin d'une source — Finnhub news ? RSS ? gros).
14. Hooks stubs restants (`useSectorHeatmap`, `useMarketInternals`, `useAlertsFeed`) → seulement si on identifie un consommateur qui en a vraiment besoin.

---

**Tradeoff principal** : Phase 1 est l'investissement le plus rentable — chaque brique débloque 2-3 pages simultanément. Si tu veux livrer "vite", commence par Phase 2.4 (PreMarket FX/DXY = 1 journée), c'est la page la plus visiblement incomplète aujourd'hui.
