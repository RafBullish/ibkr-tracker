#!/usr/bin/env python3
"""
QuantumCall bridge v2 — push PostgREST (stdlib SEULE, httpx refusé).

Écrire dans Supabase = un POST sur {SUPABASE_URL}/rest/v1/{table} avec deux
en-têtes d'auth (apikey + Authorization Bearer). Zéro dépendance ajoutée =
zéro maintenance sur vingt ans. urllib.request suffit.

La clé passée ici est la service_role (écriture) — elle vit dans le .env local
ou l'environnement du bridge, JAMAIS dans un bundle client. Le front lira par
la clé anonyme + RLS lecture seule.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request


class PushError(Exception):
    """Échec de push (réseau ou HTTP >= 400). Le rang part à l'outbox."""


def post_rows(base_url: str, service_key: str, table: str, rows: list[dict],
              *, dry_run: bool = False, timeout: int = 10) -> int:
    """POST une liste de lignes dans `table`. Retourne le nombre de lignes.

    dry_run=True : n'envoie RIEN, imprime la requête qui serait faite et
    retourne le compte. Sinon lève PushError si le réseau/HTTP échoue
    (le rang est alors journalisé en outbox par l'appelant).
    """
    if not rows:
        return 0

    url = f"{base_url.rstrip('/')}/rest/v1/{table}"
    body = json.dumps(rows, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    if dry_run:
        redacted = {**headers, "apikey": "***", "Authorization": "Bearer ***"}
        print(f"  [dry-run] POST {url}")
        print(f"           headers={redacted}")
        print(f"           {len(rows)} ligne(s) : {json.dumps(rows, ensure_ascii=False)[:400]}")
        return len(rows)

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status >= 400:
                raise PushError(f"{table}: HTTP {resp.status}")
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", "replace")[:300]
        except Exception:  # noqa: BLE001
            pass
        raise PushError(f"{table}: HTTP {exc.code} {detail}") from exc
    except urllib.error.URLError as exc:
        raise PushError(f"{table}: réseau — {exc.reason}") from exc
    return len(rows)
