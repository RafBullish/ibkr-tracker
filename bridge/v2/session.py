#!/usr/bin/env python3
"""
QuantumCall bridge v2 — calendrier de séance (jamais une simple horloge).

Le pipeline ne tourne QUE quand le marché a un sens : cadence serrée en séance
régulière, plus lâche en pré/post, ARRÊT COMPLET marché fermé (pas de cycles à
vide la nuit). Le NYSE, pas l'horloge locale : jours de bourse, fériés, fuseau
America/New_York (le DST est géré par zoneinfo, stdlib).

Source UNIQUE des fériés : `src/config/parametres.app.json` → `jours_feries_us`
(la même table que utils/tradingDays.js côté app). On ne duplique pas la vérité.

Phases (heures ET) :
  pre    04:00–09:30
  rth    09:30–16:00   (demi-journées 13:00 traitées comme rth — négligeable,
                        quelques cycles pré-clôture en trop, jamais un trou)
  post   16:00–20:00
  closed le reste + week-ends + fériés
"""

from __future__ import annotations

import json
import os
from datetime import datetime, time, timezone

try:
    from zoneinfo import ZoneInfo
    _ET = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover — zoneinfo est stdlib 3.9+
    _ET = timezone.utc

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HOLIDAYS_PATH = os.path.join(SCRIPT_DIR, "..", "..", "src", "config", "parametres.app.json")

# Bornes de séance (ET).
PRE_OPEN = time(4, 0)
RTH_OPEN = time(9, 30)
RTH_CLOSE = time(16, 0)
POST_CLOSE = time(20, 0)

# Cadences (secondes) — dans les fourchettes de la spec.
CADENCE_RTH = 20        # 15–30 s en séance régulière
CADENCE_PREPOST = 90    # 60–120 s en pré/post
IDLE_CLOSED = 300       # marché fermé : on re-sonde l'horloge toutes les 5 min,
                        # AUCUN cycle de collecte/push (pas de trou lissé)


def load_us_holidays(path: str = HOLIDAYS_PATH) -> set[str]:
    """Charge l'ensemble des fériés NYSE (ISO 'YYYY-MM-DD') depuis la config app.

    Source unique partagée avec l'app. En cas d'absence/lecture impossible,
    renvoie un set vide (dégradation honnête : on ne fabrique pas de fériés).
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        dates = data.get("jours_feries_us", {}).get("dates", [])
        return {str(d).strip() for d in dates if d}
    except (OSError, ValueError):
        return set()


def market_phase(now_utc: datetime, holidays: set[str] | None = None) -> str:
    """Retourne 'pre' | 'rth' | 'post' | 'closed' pour un instant UTC donné."""
    if holidays is None:
        holidays = load_us_holidays()
    et = now_utc.astimezone(_ET)
    # Week-end (lundi=0 … dimanche=6).
    if et.weekday() >= 5:
        return "closed"
    if et.strftime("%Y-%m-%d") in holidays:
        return "closed"
    t = et.time()
    if RTH_OPEN <= t < RTH_CLOSE:
        return "rth"
    if PRE_OPEN <= t < RTH_OPEN:
        return "pre"
    if RTH_CLOSE <= t < POST_CLOSE:
        return "post"
    return "closed"


def cadence_seconds(phase: str) -> int:
    """Secondes à attendre avant le prochain point. En 'closed' : IDLE_CLOSED
    (on re-sonde l'horloge, on ne collecte pas)."""
    if phase == "rth":
        return CADENCE_RTH
    if phase in ("pre", "post"):
        return CADENCE_PREPOST
    return IDLE_CLOSED


def is_collecting(phase: str) -> bool:
    """True si l'on doit collecter/pousser (toute phase sauf 'closed')."""
    return phase != "closed"
