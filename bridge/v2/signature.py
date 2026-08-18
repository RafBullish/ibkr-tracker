#!/usr/bin/env python3
"""
QuantumCall bridge v2 — signature de position, RÉPLIQUE EXACTE du client.

La table position_marks est keyée par signature. Pour que le bridge alimente
le MÊME pic que Q-C a créé côté client, SANS réconciliation, la signature doit
être bit-pour-bit celle de `positionSignature` (src/utils/positions.js) :

    `${tk}|${as}|${dir}|${ty ?? ''}|${st ?? ''}|${ex ?? ''}`

Piège attrapé (sections.js:78) : le store écrit `st = String(sf(Strike))`,
c.-à-d. la stringification JS d'un Number → un strike entier perd son « .0 »
(500.0 → "500"). Le bridge lit `contract.strike` (float Python) → `str()`
donnerait "500.0" et casserait la parité. `js_number_str` reproduit la
sémantique JS String(Number).
"""

from __future__ import annotations


def js_number_str(x) -> str:
    """Reproduit String(Number) de JS pour le domaine des strikes.

    JS : String(500.0) == "500" · String(12.5) == "12.5".
    Python : str(500.0) == "500.0" (divergence sur les entiers).
    On force l'entier quand la valeur est intégrale, sinon repr (round-trip
    minimal, identique à JS pour les décimales usuelles des strikes).
    """
    if x is None or x == "":
        return ""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return str(x)
    if v == int(v):
        return str(int(v))
    return repr(v)


def position_signature(tk, as_, dir_, ty="", st="", ex="") -> str:
    """Signature stable `tk|as|dir|ty|st|ex` (ty/st/ex → '' si None).

    Miroir de positionSignature(p) du client. `st` DOIT déjà être normalisé
    (js_number_str) et `ex` en ISO 'YYYY-MM-DD' — cf. fields_from_contract.
    """
    def s(v):
        return "" if v is None else str(v)

    return f"{s(tk)}|{s(as_)}|{s(dir_)}|{s(ty)}|{s(st)}|{s(ex)}"


def _iso_expiry(raw) -> str:
    """'20260116' (ou déjà-ISO) → '2026-01-16'. Miroir d'isoDate côté store."""
    if not raw:
        return ""
    clean = str(raw).split(";")[0].replace("-", "").strip()
    if len(clean) == 8 and clean.isdigit():
        return f"{clean[:4]}-{clean[4:6]}-{clean[6:8]}"
    return str(raw)


def fields_from_contract(contract, position_qty) -> dict:
    """Dérive {tk, as, dir, ty, st, ex} d'un contrat IBKR, normalisé comme le
    store (sections.mapPositionRow). Seuls STK/OPT sont couverts.

    - tk  : contract.symbol (= UnderlyingSymbol pour une option IBKR)
    - as  : 'Option' | 'Action'
    - dir : 'Long' si qty > 0 sinon 'Short'
    - ty  : 'CALL' | 'PUT' | ''
    - st  : js_number_str(strike) | ''      ← parité (500.0 → "500")
    - ex  : ISO 'YYYY-MM-DD' | ''
    """
    is_opt = getattr(contract, "secType", "") == "OPT"
    right = getattr(contract, "right", "")
    return {
        "tk": (getattr(contract, "symbol", "") or "").strip(),
        "as": "Option" if is_opt else "Action",
        "dir": "Long" if position_qty > 0 else "Short",
        "ty": ("CALL" if right in ("C", "CALL") else "PUT") if is_opt else "",
        "st": js_number_str(getattr(contract, "strike", "")) if is_opt else "",
        "ex": _iso_expiry(getattr(contract, "lastTradeDateOrContractMonth", "")) if is_opt else "",
    }


def signature_from_contract(contract, position_qty) -> str:
    f = fields_from_contract(contract, position_qty)
    return position_signature(f["tk"], f["as"], f["dir"], f["ty"], f["st"], f["ex"])
