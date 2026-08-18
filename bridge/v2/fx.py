#!/usr/bin/env python3
"""
QuantumCall bridge v2 — mid FX IDEALPRO (jalon 2).

La base du compte est le CHF, l'app affiche l'USD en primaire : la conversion
se fait à l'AFFICHAGE via cette source FX unique. Le bridge stocke le mid du
broker avec son label de paire, jamais une valeur convertie ailleurs.

Paire par défaut : USD.CHF (USD exprimé en CHF). reqTickers sur un contrat
Forex IDEALPRO. Le midpoint peut être NaN sans abonnement FX — on le retombe à
None (jamais un faux 0), à confirmer au run.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

# Paires collectées. 'USDCHF' = symbole IBKR ; 'USD.CHF' = label stocké.
DEFAULT_PAIRS = (("USDCHF", "USD.CHF"),)


def _clean_mid(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(v) or v <= 0:
        return None
    return v


def read_fx_rates(ib, pairs=DEFAULT_PAIRS, settle_seconds: float = 2.0) -> list[dict]:
    """Lit le mid de chaque paire Forex IDEALPRO → lignes fx_rates."""
    from ib_async import Forex  # import différé (compile/tests sans la dép)

    rows: list[dict] = []
    for ib_symbol, label in pairs:
        mid = None
        try:
            contract = Forex(ib_symbol)  # IDEALPRO par défaut
            ib.qualifyContracts(contract)
            tickers = ib.reqTickers(contract)
            if tickers:
                t = tickers[0]
                mid = _clean_mid(t.midpoint())
                if mid is None:  # repli bid/ask si midpoint indispo
                    bid = _clean_mid(getattr(t, "bid", None))
                    ask = _clean_mid(getattr(t, "ask", None))
                    if bid and ask:
                        mid = (bid + ask) / 2
        except Exception:  # noqa: BLE001
            mid = None
        rows.append({
            "pair": label,
            "mid": mid,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "source": "idealpro",
        })
    return rows
