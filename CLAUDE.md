# CLAUDE.md — Constitution de QuantumCall

Document **permanent**, lu à chaque session par tout assistant travaillant dans ce
repo. Il prime sur toute habitude par défaut. En cas de conflit avec un prompt
ponctuel, c'est l'assistant qui **signale** la contradiction plutôt que de deviner.

---

## 1. Identité produit

**QuantumCall** est un tracker d'options **personnel** (mono-utilisateur, pas de SaaS,
pas de multi-compte). Il sert une seule stratégie : **l'achat de premium** (long
options, doctrine « Sniper OTM »). Ce n'est ni un broker, ni un screener grand public.

Portée fonctionnelle : suivi des positions ouvertes, historique des trades clôturés,
Greeks par position et agrégés, chaîne d'options, journal psychologique, calendrier
earnings/macro, briefing pré-marché, analytics post-trade, réglages. Données
persistées **en local** (localStorage), zéro backend applicatif propriétaire — les
seuls appels réseau passent par des proxies (quotes, calendriers) via fonctions Vercel.

---

## 2. Utilisateur

**Rafael** — product owner, **non-codeur**, francophone. Il détient le **veto visuel
final** : aucune brique à fort impact visuel ne merge sur `main` sans son GO.

Contraintes de rendu (uniques, non négociables) :
- Écran **4K**, Chrome à **90 %**, viewport CSS **~1591 px**, **DPR 1.35**.
- Toute vérification et toute capture se font à cette cible : **1591×900, DPR 1.35**.
- Le rendu **mobile <1440** est un socle existant à **ne pas casser**, mais ce n'est
  jamais la cible de design.

Tout écrit destiné à Rafael (rapports, commits, docs) est **en français**.

---

## 3. Rôles & workflow

1. **Architecte** (Fable) — cadre le travail via des prompts de brique : direction
   visuelle, décisions de design, découpage. Source des specs.
2. **Implémenteur** (toi, Claude Code) — **exécution autonome** : tu lis le repo, tu
   codes, tu vérifies visuellement, tu commites, tu pushes, tu merges selon la règle.
   Tu ne demandes pas de permission pour les opérations git autorisées (§4).
3. **Retour** — en fin de brique, **rapport complet et structuré à l'architecte** :
   ce qui a été fait, décisions prises seul, hash + version, chemins des captures.

Si un cas non prévu surgit, applique la règle générale de la brique, **loggue-le**
pour le rapport final, et **continue** — ne t'arrête pas pour une question mineure.
Ne t'arrête (et ne demande) que pour une décision **irréversible et ambiguë** qui
n'appartient qu'à Rafael.

---

## 4. Autonomie git & interdits

Git : **commits, push et merge AUTORISÉS sans demander**. Tu travailles en local,
tu commites par étape (messages **conventionnels, en français**), tu pushes, tu merges.

**Interdits absolus :**
- `push --force` (ou `--force-with-lease`) sur quelque branche que ce soit.
- Réécriture de l'historique de `main` (rebase, reset, amend de commits déjà poussés).
- Suppression d'une branche **non mergée**.
- Skip des hooks (`--no-verify`) ou du signing sans demande explicite de Rafael.

**Règle de merge (selon la nature de la brique) :**
- Brique **technique / docs / outillage** (delta visuel nul ou minime, conforme à la
  loi de couleur) → **self-merge** sur `main` après contrôles verts (build +
  `check:color-law` + captures).
- Brique à **fort impact visuel** → **GO visuel de Rafael AVANT** merge sur `main`.
  Tu prépares tout sur la branche, tu pushes (preview Vercel), et tu attends le GO.

Convention de branche : `feat/<brique>` depuis `main` (ex. `feat/d0-fondation`).
Minimum **1 commit par chantier**. Pas de tag sauf demande.

Si VS Code demande une permission (git push…), demande à Rafael de cliquer
**« Always allow »**.

---

## 5. Stack & conventions

- **React 19 + Vite 7.3**, **JS pur** (pas de TypeScript, pas de `.ts`/`.tsx`).
- Zustand (store), Recharts (graphes), Radix (primitives), TanStack (table/query),
  Framer Motion (animation). Déploiement **Vercel** (preview par branche, prod sur `main`).
- **AUCUNE nouvelle dépendance** sans décision de l'architecte.
- **Tokens CSS canoniques** (`src/styles/canonical.css` = source unique). Pas de
  valeurs de couleur en dur ; on cible les `var(--*)` canoniques.
- **Chrome commun (v1.0, brique 1.B)** : grille AppShell 3 rangées —
  **TickerTape** pleine largeur bord à bord (92 px ≥1440, barème calibré au lab,
  flash au tick via `usePriceFlash`) · **SideNav** verticale 232 px repliable
  64 px (**⌘B**, persistance `qc:sidenav:collapsed`, groupes OVERVIEW/TRADING/
  INSIGHTS/SYSTÈME, « Options Live » = route `/trading/chain`, badge REAL/LIVE,
  ⌘K) · **StatusBar** en bas (inchangée). La CommandBar horizontale est morte
  en 1.B. Raccourcis globaux : ⌘1..9 (mapping historique intouchable), ⌘K, ⌘/,
  ⌘B. Mobile <768 : SubNav + BottomNav, pas de SideNav.
- Patterns établis à réutiliser (ne pas réinventer) :
  - `.v3-table` — table dense partagée (Positions ↔ History).
  - **Palier haute-résolution** `@media (min-width: 1440px)` dans
    `src/styles/c3-hires.css` — densification 1591, scopée **par page**. Toute règle
    de densité passe par ce fichier, scopée à la page, jamais en hack local ;
    mobile <1440 reste intact.
- Persistance locale (à ne jamais écraser hors session Playwright isolée, cf. §7) :

  | Clé | Contenu |
  |-----|---------|
  | `ibkr_u_o` | positions ouvertes |
  | `ibkr_u_c` | trades clôturés |
  | `ibkr_u_f` | cash flows |
  | `ibkr_u_j` | entrées de journal |
  | `ibkr_u_s` | settings (liveRate, cashReport, ibkrLiveData, gwAutoConnect, snapshots…) |
  | `ibkr_u_w` | watchlist (tickers suivis) |

---

## 6. Design system & LOI DE COULEUR

**« Brutalisme Financier »** : fond **void** (le plan le plus profond), accent
**ambre `#FFA028`**, **4 plans de profondeur** (void → base → raised → focus),
chiffres **monospace** (tabular-nums), filets murmurés, zéro glow/blur superflu.
Thèmes **midnight** (défaut) / **daylight**, tous deux WCAG AA.

### LOI DE COULEUR (constitutionnelle — non négociable)

> **Le ROUGE = perte d'argent réel uniquement.** (De même, le vert = gain d'argent
> réel.) Les valeurs de **Greeks (delta, gamma, theta, vega)** sont **TOUJOURS
> neutres**, quel que soit leur signe.

- « Perte d'argent réel » = P&L réalisé négatif, P&L latent (unrealized) négatif.
  C'est le SEUL rouge autorisé sur une valeur chiffrée.
- **Amendement (décision architecte 15.07.2026)** : les montants
  **hypothétiques** (Max Loss / Max Risk potentiels) sont **NEUTRES** —
  l'autorisation historique du rouge sur Max Loss est **abrogée**. L'alignement
  du code (rendu actuel de Positions notamment) est planifié en **brique 2.A**.
- Un Greek est **signé par nature** (theta ~toujours négatif pour du long premium,
  delta directionnel, etc.). Colorer son signe en rouge/vert **confond signe et
  perte** → interdit. Neutralité = encre `ink-*` (mute/soft/pure), pas de
  `--pnl-down/--loss-text/--qc-loss` ni `--pnl-up/--profit-text/--qc-profit`.
- Ceci vaut pour delta **et** ses dérivés directionnels (delta-dollar, Σ Δ).
- Theta neutre = **décision actée en C.3** (juin 2026), désormais cross-page.
- L'**ambre** reste réservé aux signaux **décisionnels** (accent héros, zones
  d'action, aujourd'hui), jamais une sémantique P&L.

Le respect de cette loi est **contrôlé statiquement** par
`npm run check:color-law` (cf. §7) : toute application d'un token/classe de perte à
un champ greek fait échouer le contrôle.

### PHASE FINALE v1.0

**Phase finale v1.0 OUVERTE** — ligne de base v2.3.1 (ea64652 ; baseline
effective 1254a34). Briques 1.A (1.0.0-rc.1), 1.B (1.0.0-rc.2), 1.C
(1.0.0-rc.3, étage D2-FINALE + tape LED Doto) et **1.S mergée
(1.0.0-rc.4)** — SideNav v2 « Marge vive » (témoins d'état neutres,
liens routeur, dettes de nav soldées, marqueur de mode relogé en
StatusBar). Prochaine brique : **1.D — Héros 1 (Equity/NLV).**

Repères S2 toujours en vigueur : KPI 44, cellules `.v3-table` 20 (rowHeight 47),
plancher caption 17, strip 21/16/18, ticks charts plafonnés 14, héros 56/64
intouchés. Les règles permanentes restent en vigueur (loi de couleur, interdits
git, viewport 1591, vérification visuelle, gates build/color-law).

---

## 7. Doctrine de vérification (VISUELLE)

**Ne JAMAIS citer un compte de tests comme preuve de non-régression.** Les tests
vérifient la correctness du *code*, pas celle de la *feature*. La preuve est
**visuelle, page par page, @1591**.

### Séquence obligatoire avant de rapporter « terminé » (tout changement de rendu)

1. Vérifier que le dev server tourne. Vite écoute **http://localhost:5173** par
   défaut, mais **bascule sur 5174** si 5173 est déjà pris — vérifier le port réel
   dans la sortie de `npm run dev` et ouvrir la bonne URL.
2. Via **Playwright MCP** (isolé, cf. ci-dessous), ouvrir la route concernée à
   viewport **1591×900, DPR 1.35**, thème midnight.
3. **Exercer** concrètement la feature (cliquer, survoler, scroller — pas juste
   charger). Vérifier **0 overflow horizontal, 0 chevauchement, colonnes tenues**.
4. **Lire** une capture / un snapshot a11y : confirmer que l'état attendu est rendu
   (encre neutre sur greeks, rouge sur pertes réelles, densité, texte correct).
5. Lire la console : **aucune erreur nouvelle**. Tolérés (pré-existants) : `500`
   finnhub sur symboles non servis, warnings Recharts `width(-1)/height(-1)` au mount.
6. Si le rendu diverge de la spec : corriger et re-vérifier. Ne rapporter « fait »
   que quand la capture le confirme.
7. Efficacité tokens : `browser_snapshot` (a11y) pour la structure ;
   `browser_take_screenshot` réservé à la confirmation finale.

### Isolation Playwright OBLIGATOIRE

Le serveur MCP `playwright` **doit** tourner avec `--isolated` (profil Chromium en
mémoire, rien écrit sur disque, vierge à chaque session) :

```jsonc
// ~/.claude.json — projects."C:/Users/raf77/ibkr-tracker".mcpServers.playwright
{ "type": "stdio", "command": "cmd",
  "args": ["/c", "npx", "-y", "@playwright/mcp@latest", "--isolated"], "env": {} }
```

Interdits : `--channel chrome`, `--cdp-endpoint` sur un Chrome ouvert, `--user-data-dir`
partagé. **Avant toute injection de données de démo, vérifier que `--isolated` est
présent.** Sinon : refuser d'injecter et alerter — une écriture dans une session non
isolée écraserait le **portefeuille réel** de Rafael (clés `ibkr_u_*`, cf. §5).

### Scripts d'outillage

- `npm run check:color-law` — contrôle **statique** (pas un test) : scanne `src/` et
  signale toute application de token/classe de perte à un champ greek. Sortie
  `fichier:ligne` + extrait, **exit ≠ 0** si violation. À faire tourner avant merge.
- `npm run audit:visual` — Playwright : capture les 12 pages à **1591×900, DPR 1.35**,
  thème midnight, vers `docs/captures/audit-AAAAMMJJ/`. **Dev server requis** (sonde
  automatiquement 5173 puis 5174 ; `AUDIT_BASE_URL` force une URL). Seed un dataset de
  test reproductible → les captures doivent montrer des pages **peuplées** (des captures
  vides = travail non terminé).

### Artefacts

Captures et caches Playwright **ne sont pas commités** (`.playwright-mcp/`,
`/c3-*.png`, etc. gitignorés). Les audits versionnés vivent sous `docs/captures/`.
Les images légitimes du projet restent sous `public/`, `src/assets/`.

---

## 8. Sémantique financière (ne jamais confondre)

QuantumCall analyse du **long premium**. Le raisonnement se fait en
**delta / vega / theta / mouvement de prime** — **JAMAIS** en break-even à expiration
ni en « probabilité de profit ». On ne tient pas une option jusqu'à l'échéance ; on
joue le mouvement de la prime.

Distinctions à respecter dans le code, les labels et les tooltips :

- **Risk $** (exposition ajustée au stop) **≠ Max Loss** (prime totale engagée).
- **Capital engagé** (coût d'entrée : entry × qty × mul) **≠ valeur mark** (valeur
  courante). Deux chiffres différents, deux sens différents.
- Carte **EXPOSURE / DÉPLOYÉ** = capital **DÉPLOYÉ** (coût des primes engagées, hors
  P&L latent). Ce n'est **pas** le « notionnel » (qui serait strike × 100 × contrats).
  Le label doit dire ce qu'il montre.

---

## 9. Rituels de fin de brique

- **CHANGELOG.md** — entrée datée décrivant la brique (format Keep a Changelog).
- **ROADMAP.md** — mettre à jour l'état (livré / en cours), retirer les mentions
  périmées.
- **SemVer** (`package.json`) — bump à ton jugement : `patch` (fix/outillage),
  `minor` (feature/brique visible), selon l'ampleur.
- **Rapport à l'architecte** — récap structuré : hash `main` + version, corrections
  fichier par fichier, chemins des captures, décisions prises seul.

Le fichier `.claude/CLAUDE.local.md` (non versionné) peut contenir des notes locales ;
il ne doit jamais **contredire** cette constitution.
