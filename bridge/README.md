# bridge/ — Producteur IBKR (Étape 1 : preuve de connexion)

Ce dossier est **indépendant de l'app web** (React/Vite/Vercel). C'est un petit
script Python qui se connecte à **IB Gateway** en **lecture seule** sur le **compte
paper** et affiche dans le terminal :

- le résumé de compte (NLV, cash, fonds disponibles, buying power),
- les positions ouvertes.

Aucun serveur HTTP pour l'instant, aucune écriture dans l'app. On prouve juste que
la connexion à IBKR fonctionne.

## Prérequis

- **IB Gateway** lancé, connecté en **mode Paper Trading**.
- Dans Gateway : API activée + **"Read-Only API" coché** + port **4002** (paper).
- **Python 3.10+** installé sur Windows.

## Installation (Windows, PowerShell, depuis la racine du repo)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r bridge\requirements.txt
```

## Lancer

```powershell
python bridge\ibkr_bridge.py
```

Options :

```powershell
python bridge\ibkr_bridge.py --port 7497   # si tu utilises TWS paper au lieu de Gateway
```

Arrêter : `Ctrl-C`.

## Ports IBKR (rappel)

| Application | Paper | Live |
|-------------|-------|------|
| IB Gateway  | 4002  | 4001 |
| TWS         | 7497  | 7496 |

Le script utilise **4002** par défaut (Gateway paper).
