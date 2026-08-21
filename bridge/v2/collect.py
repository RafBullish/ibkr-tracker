#!/usr/bin/env python3
"""
QuantumCall bridge v2 — assemblage des lignes de compte (pur, testable).

Transforme un résumé reqAccountSummary (dict tag→AccountValue) en deux lignes
prêtes pour Supabase : nlv_snapshots et account_state. AUCUN appel réseau ni
IBKR ici — pur, donc couvert par unittest.

Règle de devise appliquée : on recopie la valeur du broker et son label de
devise, on ne convertit RIEN.
"""

from __future__ import annotations

# Tags reqAccountSummary. SettledCash ajouté (jalon 2) : seul champ réellement
# neuf pour un compte cash — non-réglé = TotalCashValue - SettledCash (T+1/C10).
ACCOUNT_TAGS = (
    "NetLiquidation",
    "TotalCashValue",
    "SettledCash",
    "AvailableFunds",
    "BuyingPower",
    "MaintMarginReq",
    "ExcessLiquidity",
    "Cushion",
)


def _to_float(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _get(summary: dict, tag: str):
    """Valeur (float|None) d'un tag dans un dict tag→AccountValue-like.

    Accepte un objet à attribut `.value` (ib_async AccountValue) ou une string
    brute (facilite les tests)."""
    av = summary.get(tag)
    if av is None:
        return None
    raw = getattr(av, "value", av)
    return _to_float(raw)


def _currency(summary: dict):
    for av in summary.values():
        cur = getattr(av, "currency", None)
        if cur:
            return cur
    return None


def build_account_rows(summary: dict, captured_at: str) -> tuple[dict, dict]:
    """(nlv_row, account_state_row) depuis le résumé de compte.

    `captured_at` : ISO UTC de la lecture. `summary` : {tag: AccountValue|str}.
    """
    currency = _currency(summary)

    nlv_row = {
        "captured_at": captured_at,
        "nlv": _get(summary, "NetLiquidation"),
        "total_cash": _get(summary, "TotalCashValue"),
        "settled_cash": _get(summary, "SettledCash"),
        "currency": currency,
    }
    state_row = {
        "captured_at": captured_at,
        "maint_margin": _get(summary, "MaintMarginReq"),
        "excess_liquidity": _get(summary, "ExcessLiquidity"),
        "buying_power": _get(summary, "BuyingPower"),
        # AvailableFunds (fonds après marge initiale) = frère d'ExcessLiquidity
        # (après marge de maintenance) — même règle que SettledCash : tag
        # absent → None, jamais un faux 0. Migration sql/001_*.
        "available_funds": _get(summary, "AvailableFunds"),
        "cushion": _get(summary, "Cushion"),  # ratio, sans devise
        "currency": currency,
    }
    return nlv_row, state_row
