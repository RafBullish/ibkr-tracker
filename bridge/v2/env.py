#!/usr/bin/env python3
"""
QuantumCall bridge v2 — chargeur .env minimal (stdlib seule).

Pas de python-dotenv : une dépendance de plus pour parser des `KEY=VALUE`.
Lit bridge/v2/.env (gitignoré) et pose les variables dans os.environ SANS
écraser celles déjà présentes (l'environnement réel prime sur le fichier).
"""

from __future__ import annotations

import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ENV_PATH = os.path.join(SCRIPT_DIR, ".env")


def load_env(path: str = DEFAULT_ENV_PATH, override: bool = False) -> dict:
    """Parse un fichier .env → dict, et injecte dans os.environ.

    - lignes vides et `# commentaires` ignorées ;
    - `export KEY=val` toléré ;
    - guillemets simples/doubles autour de la valeur retirés ;
    - fichier absent → dict vide (aucune erreur : le .env est optionnel).
    """
    values: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        return values

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        if not key:
            continue
        values[key] = val
        if override or key not in os.environ:
            os.environ[key] = val
    return values


def require(*names: str) -> dict:
    """Retourne {name: value} pour les variables demandées, ou lève SystemExit
    avec un message clair listant celles qui manquent (jamais un push muet
    vers nulle part)."""
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        raise SystemExit(
            "Variables d'environnement manquantes : " + ", ".join(missing) + "\n"
            "Copie bridge/v2/.env.example en bridge/v2/.env et remplis-les "
            "(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)."
        )
    return {n: os.environ[n] for n in names}
