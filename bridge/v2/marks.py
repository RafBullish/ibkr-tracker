#!/usr/bin/env python3
"""
QuantumCall bridge v2 — marks par position via reqPnLSingle (jalon 2, temps 1).

Chemin décidé (architecte 18.08) : reqPnLSingle par conId D'ABORD. Une boucle,
aucun conflit avec reqAccountSummary, valeurs CALCULÉES par IBKR (sans
abonnement). Mark dérivé de `value / (qty × mult)`. Le temps 2 (reqTickers pour
le vrai mid bid/ask, dès OPRA) vivra dans reqTickers, PAS ici. JAMAIS
reqAccountUpdates (hang rc.6).

`derive_mid` est pur → couvert par unittest. La lecture IBKR est fine et
défensive ; ce qu'elle produit se confirme au run réel (notamment la devise
réelle de `value`, cf. règle de devise : on ne stocke jamais une valeur
convertie sous un mauvais label).
"""

from __future__ import annotations

from datetime import datetime, timezone

from signature import signature_from_contract


def derive_mid(value, qty, mult):
    """mid = value / (qty × mult). None si indéterminable (jamais un faux 0)."""
    v = _f(value)
    q = _f(qty)
    m = _f(mult)
    if v is None or not q or not m:
        return None
    denom = abs(q) * m
    if denom == 0:
        return None
    return abs(v) / denom


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _mult(contract) -> float:
    raw = getattr(contract, "multiplier", "") or ""
    try:
        return float(raw)
    except (TypeError, ValueError):
        return 100.0 if getattr(contract, "secType", "") == "OPT" else 1.0


def read_position_marks(ib, account: str, settle_seconds: float = 2.0) -> list[dict]:
    """Boucle reqPnLSingle sur chaque position ouverte (STK/OPT) → lignes
    position_marks. Chaque ligne porte l'horodatage DU MARK.

    On souscrit, on laisse la valeur arriver (ib.sleep pompe l'event loop),
    on lit, on ANNULE la souscription (pas de fuite d'abonnement).
    """
    rows: list[dict] = []
    positions = [
        p for p in ib.positions()
        if p.position != 0 and p.contract.secType in ("STK", "OPT")
    ]
    for p in positions:
        c = p.contract
        con_id = getattr(c, "conId", None)
        if not con_id:
            continue
        pnl = None
        try:
            pnl = ib.reqPnLSingle(account, "", con_id)
            ib.sleep(settle_seconds)
            value = getattr(pnl, "value", None)
            unrealized = getattr(pnl, "unrealizedPnL", None)
        finally:
            try:
                ib.cancelPnLSingle(account, "", con_id)
            except Exception:  # noqa: BLE001
                pass

        mid = derive_mid(value, p.position, _mult(c))
        rows.append({
            "signature": signature_from_contract(c, p.position),
            "mid": mid,
            "mark_at": datetime.now(timezone.utc).isoformat(),
            "source": "pnlSingle",
            "conid": str(con_id),
            # Devise du contrat. À CONFIRMER au run : si reqPnLSingle.value est
            # exprimé en devise de base (CHF) et non en devise du contrat (USD),
            # ce label doit suivre la devise réelle de `value` — on ne stocke
            # jamais une valeur sous un mauvais label.
            "currency": getattr(c, "currency", None),
            "unrealized": _f(unrealized),
        })
    return rows
