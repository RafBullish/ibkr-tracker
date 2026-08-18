#!/usr/bin/env python3
"""
QuantumCall bridge v2 — journal local + reprise après coupure.

Deux fichiers NDJSON (une ligne JSON par enregistrement), écrits à côté du
script, gitignorés (données de session) :

  journal.ndjson   — trace append-only de chaque cycle (ce qui a été poussé,
                     ou l'erreur). Mémoire de vol, jamais rejouée.
  outbox.ndjson    — lignes dont le push a ÉCHOUÉ (Supabase injoignable,
                     Gateway en réauth hebdo, machine coupée). À la reprise et
                     à chaque cycle, on tente de VIDER l'outbox d'abord.

Philosophie des trous : IBKR impose un redémarrage hebdo du Gateway (2FA), la
machine peut être éteinte. Les trous sont RÉELS. On rejoue les lignes en
attente quand la liaison revient, mais on ne FABRIQUE jamais de point pour
combler un trou de temps — l'app doit montrer le trou, pas le lisser.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JOURNAL_PATH = os.path.join(SCRIPT_DIR, "journal.ndjson")
OUTBOX_PATH = os.path.join(SCRIPT_DIR, "outbox.ndjson")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append(path: str, record: dict) -> None:
    line = json.dumps(record, separators=(",", ":"), ensure_ascii=False)
    with open(path, "a", encoding="utf-8") as f:
        f.write(line + "\n")
        f.flush()
        os.fsync(f.fileno())


def journal_event(kind: str, **fields) -> None:
    """Trace un évènement de cycle (append-only)."""
    _append(JOURNAL_PATH, {"at": _now_iso(), "kind": kind, **fields})


def outbox_enqueue(table: str, rows: list[dict]) -> None:
    """Met en attente des lignes dont le push a échoué."""
    if not rows:
        return
    _append(OUTBOX_PATH, {"at": _now_iso(), "table": table, "rows": rows})


def outbox_pending() -> list[dict]:
    """Lit toutes les entrées en attente (chacune = {table, rows})."""
    if not os.path.exists(OUTBOX_PATH):
        return []
    out = []
    with open(OUTBOX_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                continue  # ligne corrompue → ignorée, jamais un crash
    return out


def outbox_clear() -> None:
    """Vide l'outbox (après flush réussi)."""
    try:
        if os.path.exists(OUTBOX_PATH):
            os.remove(OUTBOX_PATH)
    except OSError:
        pass
