#!/usr/bin/env python3
"""
QuantumCall bridge v2 — JALON 1 : sonde de compte (one-shot, read-only, paper).

Le plus petit incrément vérifiable de la Phase A. Il :
  1. se connecte au Gateway paper (couche connection.py, paramétrable) ;
  2. lit le résumé de compte UNE fois (reqAccountSummary — valeurs calculées
     par IBKR, aucun abonnement marché requis) ;
  3. imprime NLV / cash / disponible / buying power / marge de maintenance /
     excess liquidity / cushion ;
  4. se déconnecte et sort.

RIEN D'AUTRE. Pas de boucle, pas de marks, pas de FX, pas de push Supabase —
ceux-là sont le jalon 2. Ce jalon prouve la connexion paramétrable + les tags
de compte complétés (margin / excess / cushion), sans hang.

Usage :
  python bridge/v2/probe_account.py                 # Gateway paper 4002, clientId 21
  python bridge/v2/probe_account.py --port 7497     # TWS paper
  python bridge/v2/probe_account.py --log-level DEBUG
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

# Le dossier du script est ajouté à sys.path par Python au lancement direct,
# mais on l'insère explicitement pour être robuste quel que soit le cwd.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from connection import add_connection_args, connect_readonly  # noqa: E402

# Tags reqAccountSummary. Les quatre premiers viennent de rc.6 ; les trois
# derniers sont l'apport Phase A (marge / excess / cushion). TOUS calculés par
# IBKR → aucun abonnement marché : c'est ce qui fait tourner le cœur V1.1 avant
# même qu'OPRA soit actif.
ACCOUNT_TAGS = (
    "NetLiquidation",
    "TotalCashValue",
    "AvailableFunds",
    "BuyingPower",
    "MaintMarginReq",
    "ExcessLiquidity",
    "Cushion",
)

# (tag, libellé affiché, ratio?) — Cushion est un ratio [0–1], pas une devise.
ROWS = (
    ("NetLiquidation", "NLV (valeur nette de liq.)", False),
    ("TotalCashValue", "Cash total", False),
    ("AvailableFunds", "Fonds disponibles", False),
    ("BuyingPower", "Buying power", False),
    ("MaintMarginReq", "Marge de maintenance", False),
    ("ExcessLiquidity", "Excess liquidity", False),
    ("Cushion", "Cushion (ratio)", True),
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fmt(value, currency=None, ratio=False) -> str:
    if value is None:
        return "—"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)
    if ratio:
        return f"{v:.4f}"
    s = f"{v:,.2f}"
    return f"{s} {currency}" if currency else s


def read_account_once(ib, settle_seconds: float = 1.5) -> dict:
    """reqAccountSummary + court settle, puis lit UNE fois.

    Miroir du pattern rc.6 éprouvé (reqAccountSummary → sleep → accountSummary).
    ib.sleep pompe l'event loop ib_async pendant l'attente. AUCUN
    reqAccountUpdates (hang).
    """
    ib.reqAccountSummary()
    ib.sleep(settle_seconds)
    rows = ib.accountSummary()
    return {av.tag: av for av in rows if av.tag in ACCOUNT_TAGS}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="QuantumCall bridge v2 — jalon 1 : sonde de compte one-shot "
        "(read-only, paper). Connecte, lit une fois, imprime, sort."
    )
    add_connection_args(parser)
    args = parser.parse_args()
    level = getattr(logging, args.log_level)

    print(f"[{now_iso()}] Jalon 1 — sonde de compte (read-only)")
    print(f"  cible : {args.host}:{args.port}  clientId={args.client_id}  timeout={args.timeout}s")

    try:
        ib = connect_readonly(
            args.host, args.port, args.client_id, timeout=args.timeout, log_level=level
        )
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ échec de connexion : {type(exc).__name__}: {exc}", file=sys.stderr)
        print(
            "    (TimeoutError → clientId peut-être déjà pris : relance avec un "
            "--client-id différent. Sinon : Gateway lancé ? API + « Read-Only » "
            "cochés ? bon --port ?)",
            file=sys.stderr,
        )
        return 1

    try:
        accounts = ib.managedAccounts()
        summary = read_account_once(ib)
    finally:
        try:
            ib.disconnect()
        except Exception:  # noqa: BLE001
            pass

    currency = next((av.currency for av in summary.values() if av.currency), None)
    account = accounts[0] if accounts else "—"

    print(f"  ✓ connecté · compte={account} · devise={currency or '—'}")
    print("  ── Résumé de compte (reqAccountSummary — valeurs calculées IBKR) ──")
    for tag, label, ratio in ROWS:
        av = summary.get(tag)
        raw = av.value if av else None
        shown = fmt(raw, None if ratio else (av.currency if av else currency), ratio=ratio)
        flag = "" if av else "   ⚠ absent du résumé"
        print(f"    {label:<28} {shown}{flag}")

    missing = [t for t in ACCOUNT_TAGS if t not in summary]
    if missing:
        print(
            f"  ⚠ tags absents : {', '.join(missing)} — certains n'apparaissent "
            "que s'ils sont non nuls ; à confirmer au run réel."
        )
    print(f"[{now_iso()}] Jalon 1 terminé — déconnecté, sortie.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
