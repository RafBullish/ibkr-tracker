# bridge/v2/ — LE PIPELINE VIVANT (Phase A V1.1)

Évolution du bridge rc.6 (`bridge/ibkr_poller.py` + `serve.py`, laissés
**intacts comme référence**). Objectif de la Phase A : **faire arriver la
donnée** — IB Gateway → bridge → Supabase (PostgREST) → Vercel (Phase B). Rien
de visible ne se construit ici ; le front vient en Phase B.

```
IB Gateway (paper, read-only, port 4002)
        │  TWS API
        ▼
bridge v2  ── reqAccountSummary (compte) + reqPnLSingle → reqTickers (marks) + FX
        │  POST PostgREST (stdlib, 1 requête + 2 en-têtes)
        ▼
Supabase (projet QuantumCall, eu-west-3)
```

## Invariants (non négociables)

- **Read-only absolu.** `readonly=True` à la connexion ; **aucun `placeOrder`**,
  aucune fonction d'ordre, dans aucun fichier. Le site ne pourra jamais
  exécuter, même par bug. IBKR reste le seul endroit où de l'argent bouge.
- **Jamais `reqAccountUpdates`**, même isolé — il ressuscite le hang de rc.6
  (conflit avec `reqAccountSummary`). Compte → `reqAccountSummary` ; marks →
  `reqPnLSingle` puis `reqTickers`.
- **Push par stdlib seul.** PostgREST = un `POST` + deux en-têtes ; zéro
  dépendance Python ajoutée (cohérent avec le zéro-dép de `serve.py`). La seule
  dép reste `ib_async`.
- **Clé `service_role` locale.** Elle vit dans `bridge/v2/.env` (gitignoré),
  jamais dans un bundle client. Le front lira par la clé anonyme + RLS lecture
  seule. Voir `.env.example`.
- **L'âge, toujours.** Chaque valeur poussée porte son horodatage. `pos.pc` nu
  ne permettait de juger la fraîcheur qu'au niveau du feed ; le bridge, lui,
  connaît l'horodatage de chaque mark, et il le met dans le contrat.

## Le chemin des marks (décision architecte 18.08)

Le bug rc.6 (`pc = pi` en dur, `ibkr_poller.py:165`) vient de la lecture de
`Position` (qty + avgCost seuls) au lieu de `PortfolioItem`. La parade **n'est
pas** de réintroduire `PortfolioItem`/`reqAccountUpdates` (le hang). Le chemin
retenu, en deux temps, **les deux — pas l'un ou l'autre** :

1. **`reqPnLSingle` par conId** (jalon 2, dès maintenant) — une boucle, aucun
   conflit avec `reqAccountSummary`, valeurs **calculées par IBKR donc sans
   abonnement**. Mark dérivé de `value / (qty × mult)`.
2. **`reqTickers`** (dès qu'OPRA est actif, début septembre) — le **vrai mid
   bid/ask**. La carte fonde le pic du trailing (porte P2) sur un mid de
   clôture : un mark IBKR n'en est pas un, d'où le besoin du bid/ask réel.

## Les quatre tables Supabase (jalon 2)

| Table | Contenu |
|---|---|
| `nlv_snapshots` | horodatage, NLV, cash, devise |
| `position_marks` | **signature `tk\|as\|dir\|ty\|st\|ex`**, mid, **horodatage du mark**, source |
| `account_state` | marge de maintenance, excess liquidity, buying power, cushion |
| `fx_rates` | paire, mid, horodatage, source |

La signature de `position_marks` est **exactement** celle du writer client
(`positionSignature`, `src/utils/positions.js`) → le bridge alimente le **même
pic** que Q-C a créé, sans réconciliation.

## Les deux jalons

- **Jalon 1 — sonde de compte (LIVRÉ).** `probe_account.py` : connexion Gateway
  paper + lecture du compte **une fois** + impression NLV / cash / disponible /
  buying power / **marge / excess / cushion** + sortie. Rien d'autre. Prouve la
  couche de connexion paramétrable et les tags de compte complétés, sans hang.
- **Jalon 2 — le pipeline (à venir).** Boucle à cadence de séance (15–30 s en
  RTH, 60–120 s en pré/post, **arrêt marché fermé** — calendrier, pas horloge) ;
  marks `reqPnLSingle` (+ `reqTickers` post-OPRA) ; FX USD/CHF IDEALPRO ; les
  quatre tables + RLS ; push PostgREST stdlib ; journal local + reprise après
  coupure. La double connexion **ne se pose pas** en Phase A : le paper a son
  propre identifiant ; la couche de connexion est déjà paramétrable host / port
  / clientId pour le jour où elle se posera.

## Lancer le jalon 1

Prérequis : IB Gateway lancé en **Paper Trading**, API activée, **« Read-Only
API » coché**, port **4002**. Environnement Python : celui de `bridge/` (`ib_async`).

```powershell
.\.venv\Scripts\Activate.ps1
python bridge\v2\probe_account.py                 # Gateway paper 4002, clientId 21
python bridge\v2\probe_account.py --port 7497     # TWS paper
python bridge\v2\probe_account.py --log-level DEBUG
```

Sortie attendue (valeurs d'exemple) :

```
[2026-…] Jalon 1 — sonde de compte (read-only)
  cible : 127.0.0.1:4002  clientId=21  timeout=15s
  ✓ connecté · compte=DUP080989 · devise=USD
  ── Résumé de compte (reqAccountSummary — valeurs calculées IBKR) ──
    NLV (valeur nette de liq.)   105 234.56 USD
    Cash total                    42 100.00 USD
    Fonds disponibles             38 450.00 USD
    Buying power                 153 800.00 USD
    Marge de maintenance          12 900.00 USD
    Excess liquidity              38 450.00 USD
    Cushion (ratio)               0.7412
  [2026-…] Jalon 1 terminé — déconnecté, sortie.
```

`clientId=21` est distinct du poller rc.6 (`11`) pour éviter les collisions si
les deux tournent. « TimeoutError » au lancement = clientId déjà pris (relancer
avec `--client-id`) ou Gateway/port mal configuré.
