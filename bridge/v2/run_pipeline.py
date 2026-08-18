#!/usr/bin/env python3
"""
QuantumCall bridge v2 — JALON 2 : le pipeline vivant.

Boucle à cadence de séance qui, à chaque cycle en marché ouvert :
  1. lit le compte (reqAccountSummary — NLV/cash/settled/marge/excess/cushion) ;
  2. lit les marks par position (reqPnLSingle par conId) ;
  3. lit le mid FX IDEALPRO (USD.CHF) ;
  4. pousse nlv_snapshots / account_state / position_marks / fx_rates dans
     Supabase par PostgREST (stdlib) ;
  5. journalise ; en cas d'échec de push, met en outbox et rejoue plus tard.

Cadence : 15–30 s en séance, 60–120 s en pré/post, ARRÊT complet marché fermé
(calendrier NYSE, pas horloge). Read-only absolu (aucun placeOrder). JAMAIS
reqAccountUpdates.

Sécurité de première prise en main :
  python bridge/v2/run_pipeline.py --dry-run --once   # 1 cycle, RIEN poussé, tout imprimé
  python bridge/v2/run_pipeline.py --once             # 1 cycle réel puis sortie
  python bridge/v2/run_pipeline.py                    # boucle continue
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from connection import add_connection_args, connect_readonly  # noqa: E402
from collect import ACCOUNT_TAGS, build_account_rows  # noqa: E402
from marks import read_position_marks  # noqa: E402
from fx import read_fx_rates  # noqa: E402
from session import market_phase, cadence_seconds, is_collecting, load_us_holidays  # noqa: E402
from supabase_push import post_rows, PushError  # noqa: E402
from journal import (  # noqa: E402
    journal_event, outbox_enqueue, outbox_pending, outbox_clear,
)
import env as envmod  # noqa: E402


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_account_summary(ib) -> dict:
    """Lit le résumé de compte (cache alimenté par la souscription au connect)."""
    rows = ib.accountSummary()
    return {av.tag: av for av in rows if av.tag in ACCOUNT_TAGS}


def flush_outbox(base_url, key, dry_run) -> bool:
    """Tente de vider l'outbox (lignes en échec). True si tout est parti."""
    pending = outbox_pending()
    if not pending:
        return True
    try:
        for entry in pending:
            post_rows(base_url, key, entry["table"], entry["rows"], dry_run=dry_run)
        outbox_clear()
        journal_event("outbox_flushed", count=len(pending))
        return True
    except PushError as exc:
        journal_event("outbox_flush_failed", error=str(exc))
        return False


def push_or_enqueue(base_url, key, table, rows, dry_run) -> bool:
    """Pousse une table ; en cas d'échec, met en outbox (jamais perdu)."""
    if not rows:
        return True
    try:
        post_rows(base_url, key, table, rows, dry_run=dry_run)
        return True
    except PushError as exc:
        outbox_enqueue(table, rows)
        journal_event("push_failed", table=table, error=str(exc), enqueued=len(rows))
        return False


def run_cycle(ib, account, base_url, key, dry_run) -> None:
    ts = now_iso()
    summary = read_account_summary(ib)
    nlv_row, state_row = build_account_rows(summary, ts)
    marks = read_position_marks(ib, account)
    fx = read_fx_rates(ib)

    flush_outbox(base_url, key, dry_run)
    push_or_enqueue(base_url, key, "nlv_snapshots", [nlv_row], dry_run)
    push_or_enqueue(base_url, key, "account_state", [state_row], dry_run)
    push_or_enqueue(base_url, key, "position_marks", marks, dry_run)
    push_or_enqueue(base_url, key, "fx_rates", fx, dry_run)

    journal_event(
        "cycle", nlv=nlv_row["nlv"], currency=nlv_row["currency"],
        marks=len(marks), fx=len(fx),
    )
    print(f"[{ts}] cycle · NLV={nlv_row['nlv']} {nlv_row['currency'] or ''} · "
          f"settled={nlv_row['settled_cash']} · marks={len(marks)} · fx={len(fx)}"
          + ("  [dry-run]" if dry_run else ""))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="QuantumCall bridge v2 — jalon 2 : pipeline vivant (read-only)."
    )
    add_connection_args(parser)
    parser.add_argument("--dry-run", action="store_true",
                        help="n'écrit RIEN dans Supabase ; imprime les POST qui seraient faits")
    parser.add_argument("--once", action="store_true",
                        help="un seul cycle (en séance) puis sortie")
    args = parser.parse_args()
    level = getattr(logging, args.log_level)

    # Credentials Supabase — via .env local (jamais commité). En dry-run,
    # facultatifs (aucun POST réel).
    envmod.load_env()
    base_url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not args.dry_run:
        creds = envmod.require("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
        base_url, key = creds["SUPABASE_URL"], creds["SUPABASE_SERVICE_ROLE_KEY"]

    holidays = load_us_holidays()
    print(f"[{now_iso()}] Jalon 2 — pipeline vivant "
          f"({'DRY-RUN' if args.dry_run else 'LIVE'}{' · once' if args.once else ''})")
    print(f"  cible IBKR : {args.host}:{args.port} clientId={args.client_id} · "
          f"fériés chargés : {len(holidays)}")

    try:
        ib = connect_readonly(args.host, args.port, args.client_id,
                              timeout=args.timeout, log_level=level)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ connexion : {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    try:
        ib.reqAccountSummary()
        ib.sleep(1.5)
        accounts = ib.managedAccounts()
        account = accounts[0] if accounts else ""
        print(f"  ✓ connecté · compte={account or '—'}")

        while True:
            phase = market_phase(datetime.now(timezone.utc), holidays)
            if not is_collecting(phase):
                journal_event("idle", phase=phase)
                print(f"[{now_iso()}] marché {phase} — pas de collecte")
                if args.once:
                    break
                ib.sleep(cadence_seconds(phase))
                continue

            try:
                run_cycle(ib, account, base_url, key, args.dry_run)
            except Exception as exc:  # noqa: BLE001
                journal_event("cycle_error", error=f"{type(exc).__name__}: {exc}")
                print(f"[{now_iso()}] ⚠ cycle : {exc}", file=sys.stderr)

            if args.once:
                break
            ib.sleep(cadence_seconds(phase))
    except KeyboardInterrupt:
        print(f"\n[{now_iso()}] arrêt demandé (Ctrl-C).")
    finally:
        try:
            ib.disconnect()
        except Exception:  # noqa: BLE001
            pass
        print(f"[{now_iso()}] déconnecté.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
