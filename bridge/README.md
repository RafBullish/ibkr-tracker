# bridge/ — Producteur IBKR (Étape 2 : archi 2 processus)

Après l'échec d'une première tentative single-process (conflits asyncio entre
aiohttp et ib_async dans le même event loop), le bridge est maintenant **deux
processus indépendants** qui ne partagent **aucun event loop**. Ils ne se
parlent qu'à travers un fichier `snapshot.json` écrit de façon atomique.

```
┌───────────────────────┐                          ┌────────────────────────┐
│  bridge/ibkr_poller   │  écrit snapshot.json     │  bridge/serve.py       │
│  (ib_async sync,      │ ───────►  (atomique :    │  (stdlib http.server,  │
│   paper, read-only)   │   .tmp + os.replace)     │   AUCUNE dépendance,   │
│                       │       toutes les ~5s     │   AUCUN asyncio)       │
└──────────┬────────────┘                          └────────────┬───────────┘
           │                                                    │
   IB Gateway 4002                                       HTTP 127.0.0.1:8765
   (READ-ONLY)                                           GET /health · /account
```

Indépendant de l'app (`src/`, `api/` non touchés). Read-only des deux côtés
(`readonly=True` à la connexion IBKR + "Read-Only API" coché côté Gateway).

## Prérequis

- **IB Gateway** lancé, mode **Paper Trading**.
- Dans Gateway : API activée + **"Read-Only API" coché** + port **4002**.
- **Python 3.10+** sur Windows.

## Installation (PowerShell, depuis la racine du repo)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r bridge\requirements.txt
```

> `aiohttp` n'est plus dans `requirements.txt` — le serveur HTTP utilise
> uniquement `http.server` de la stdlib. Si tu avais déjà fait étape 1 ou la
> v1 cassée d'étape 2, ré-exécuter `pip install` ne fait aucun mal.

## Lancer — DEUX terminaux PowerShell

**Ordre important :** démarre le poller en premier (sinon le serveur ne
trouve pas `snapshot.json` et répond `warming-up` jusqu'au premier cycle).

### Terminal 1 — Poller (connexion IBKR + écriture du snapshot)

```powershell
.\.venv\Scripts\Activate.ps1
python bridge\ibkr_poller.py
```

Attendu :

```
[HH:MM:SS] Snapshot cible : C:\Users\…\bridge\snapshot.json
[HH:MM:SS] Connexion à 127.0.0.1:4002 (clientId=11, READ-ONLY)…
[HH:MM:SS] Connecté ✓ (compte=DU…)
[HH:MM:SS] NLV=… USD · positions=N · → snapshot.json   (toutes les ~30s)
```

Options :

```powershell
python bridge\ibkr_poller.py --port 7497      # TWS paper au lieu de Gateway
python bridge\ibkr_poller.py --client-id 12   # éviter conflit si autre client API actif
```

### Terminal 2 — Serveur HTTP (sert le snapshot)

```powershell
.\.venv\Scripts\Activate.ps1
python bridge\serve.py
```

Attendu :

```
[HH:MM:SS] Serveur HTTP en écoute sur http://127.0.0.1:8765  (routes : /health, /account)
[HH:MM:SS] Snapshot lu depuis : C:\Users\…\bridge\snapshot.json
[HH:MM:SS] Seuil de fraîcheur : 30s (>= → status stale / connected=false)
```

Options :

```powershell
python bridge\serve.py --port 9000
```

**Arrêter** : `Ctrl-C` dans chaque terminal. Quand le poller s'arrête, il
écrit un dernier snapshot avec `connected=false` pour que `/health` reflète
immédiatement la situation.

## Routes

### `GET http://127.0.0.1:8765/health`

```json
{
  "status": "ok",
  "connected": true,
  "snapshotAgeSeconds": 2.4,
  "timestamp": "2026-05-31T…",
  "lastError": null
}
```

`connected: false` dans trois cas :
- `snapshot.json` n'existe pas (poller pas encore lancé) ;
- `snapshot.json` date de plus de **30s** (poller mort ou perdu Gateway) ;
- le poller lui-même a écrit `connected: false` (échec de connexion IBKR).

### `GET http://127.0.0.1:8765/account`

```json
{
  "status": "ok",
  "connected": true,
  "snapshotAgeSeconds": 1.2,
  "timestamp": "2026-05-31T…",
  "lastError": null,
  "account": {
    "currency": "USD",
    "netLiquidation": 105234.56,
    "totalCashValue": 42100.00,
    "availableFunds": 38450.00,
    "buyingPower": 153800.00
  },
  "positions": [
    {
      "as": "Option", "dir": "Long",
      "tk": "NVDA", "ty": "CALL", "st": "500", "ex": "2026-01-16",
      "ct": "1", "mu": "100",
      "pi": "5.25", "pc": "6.40",
      "fi": "0", "fxi": "0",
      "dteAtEntry": null, "deltaAtEntry": null,
      "ivAtEntry": null, "ivRankAtEntry": null,
      "exitReason": null,
      "di": "", "rk": "0", "su": "",
      "lots": [{ "ct": "1", "pi": "5.25", "fi": "0", "di": "", "fxi": "0" }],
      "_ibkrConid": "265598", "_ibkrSymbol": "NVDA  260116C00500000",
      "_ibkrUnrealized": 115.0, "_level": "SUMMARY"
    }
  ]
}
```

Réponses d'erreur possibles :
- `503 warming-up` — `snapshot.json` absent.
- `503 stale` — snapshot plus vieux que 30s.
- `503 read-error` — fichier illisible / JSON corrompu.

**Le shape des positions** correspond exactement à celui documenté en tête de
`src/store/migrations.js` (clés abrégées `tk`/`as`/`dir`/`ty`/`st`/`ex`/`ct`/`mu`/`pi`/`pc`/`fxi`/…),
donc l'étape 3 pourra passer le tableau `positions` tel quel à l'action
`SYNC_IBKR` sans re-mapper.

Champs volontairement nuls/zéro sur un snapshot live (pas un bug) :

- `fi` = `"0"` → IBKR n'expose pas la commission d'entrée d'une position vivante.
- `fxi` = `"0"` → idem pour le taux FX d'entrée ; la calc downstream retombe
  sur `settings.liveRate` (cf. commentaire ligne 132 de `src/services/flexApi.js`).
- `di` / `dteAtEntry` = `""` / `null` → date d'entrée inconnue depuis un snapshot.
- `deltaAtEntry` / `ivAtEntry` / `ivRankAtEntry` = `null` → IBKR ne donne pas
  le spot/IV d'entrée (cf. bloc "FIELDS AWAITING SPOT" de `migrations.js`).
- `pc` = `pi` si pas de souscription market data (cas fréquent sur paper), pour
  que le P&L unrealized ressorte à 0 au lieu d'être faussé.

## Fichier d'échange — `snapshot.json`

- Écrit par `ibkr_poller.py` toutes les ~5s.
- **Écriture atomique** : `snapshot.json.tmp` (avec `flush` + `fsync`) puis
  `os.replace` (= `MoveFileEx(MOVEFILE_REPLACE_EXISTING)` sur Windows, atomique
  au niveau du système de fichiers). Le serveur ne lit donc jamais un fichier
  partiellement écrit, même si la requête tombe pile pendant l'écriture.
- Généré au runtime, **jamais commité** (cf. `.gitignore`).

## Ports IBKR (rappel)

| Application | Paper | Live |
|-------------|-------|------|
| IB Gateway  | 4002  | 4001 |
| TWS         | 7497  | 7496 |

## CORS — à prévoir pour l'étape 3

Quand l'app React (`http://localhost:5173` en dev, l'origine Vercel en prod)
consommera `/account` depuis le navigateur, `serve.py` devra renvoyer
`Access-Control-Allow-Origin: http://localhost:5173` (whitelist explicite,
**jamais** `*`) sur les deux routes. Pas activé pour l'instant : le bridge
reste strictement local tant que l'étape 3 n'est pas branchée.
