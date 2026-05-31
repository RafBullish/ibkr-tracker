#!/usr/bin/env python3
"""
QuantumCall — Bridge IBKR (Étape 1 : preuve de connexion, READ-ONLY, PAPER).

Ce script NE touche PAS à l'app web. Il se connecte à IB Gateway (compte paper),
lit le résumé de compte (NLV, cash) + les positions ouvertes, et les affiche dans
le terminal en boucle. Il n'y a PAS encore de serveur HTTP : on prouve juste que
la connexion à IBKR fonctionne en isolation.

Sécurité :
  - readonly=True à la connexion → le client API ne PEUT PAS passer d'ordre,
    même par erreur (double ceinture avec "Read-Only API" coché côté Gateway).
  - Port par défaut 4002 = IB Gateway en mode PAPER (pas le compte réel).

Robustesse :
  - Boucle de reconnexion automatique. IB Gateway se redémarre tout seul une fois
    par jour (auto-restart) : à ce moment la connexion tombe, le script attend puis
    se reconnecte sans intervention.

Usage :
  python bridge/ibkr_bridge.py
  python bridge/ibkr_bridge.py --port 7497      # si tu utilises TWS paper
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime

try:
    from ib_async import IB
except ImportError:
    sys.exit(
        "ib_async n'est pas installé.\n"
        "Active ton environnement puis lance :  pip install -r bridge/requirements.txt"
    )

# ─── Réglages par défaut ──────────────────────────────────────────────
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4002        # IB Gateway PAPER. (Gateway live=4001, TWS paper=7497, TWS live=7496)
DEFAULT_CLIENT_ID = 11     # identifiant API arbitraire ; doit être unique par connexion simultanée
REFRESH_SECONDS = 5        # cadence de rafraîchissement (≈ "quelques secondes")
RECONNECT_SECONDS = 10     # attente avant nouvelle tentative après une coupure

# Tags du résumé de compte qu'on affiche (il en existe beaucoup d'autres).
SUMMARY_TAGS = ("NetLiquidation", "TotalCashValue", "AvailableFunds", "BuyingPower")


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(msg: str) -> None:
    print(f"[{ts()}] {msg}", flush=True)


def connect(ib: IB, host: str, port: int, client_id: int) -> None:
    """Ouvre la connexion en lecture seule et s'abonne au résumé de compte."""
    log(f"Connexion à {host}:{port} (clientId={client_id}, READ-ONLY)…")
    ib.connect(host, port, clientId=client_id, timeout=15, readonly=True)
    ib.reqAccountSummary()   # (re)souscrit le résumé de compte sur cette session
    ib.sleep(1.0)            # laisse les premières valeurs arriver
    log("Connecté ✓")


def render(ib: IB) -> None:
    """Affiche le résumé de compte + les positions ouvertes."""
    summary = {av.tag: av for av in ib.accountSummary() if av.tag in SUMMARY_TAGS}
    positions = ib.positions()

    print("\n" + "=" * 62, flush=True)
    print(f"  COMPTE IBKR (paper) — {ts()}", flush=True)
    print("=" * 62, flush=True)

    if summary:
        for tag in SUMMARY_TAGS:
            av = summary.get(tag)
            if av is not None:
                try:
                    value = f"{float(av.value):>16,.2f}"
                except (TypeError, ValueError):
                    value = f"{str(av.value):>16}"
                print(f"  {tag:<16}{value}  {av.currency}", flush=True)
    else:
        print("  (résumé de compte pas encore reçu — patiente un cycle)", flush=True)

    print(f"\n  POSITIONS OUVERTES : {len(positions)}", flush=True)
    if positions:
        print(f"  {'Symbole':<10}{'Type':<6}{'Détail':<22}{'Qté':>8}{'PRU':>14}", flush=True)
        print("  " + "-" * 58, flush=True)
        for p in positions:
            c = p.contract
            detail = ""
            if c.secType == "OPT":
                detail = f"{c.lastTradeDateOrContractMonth} {c.right}{c.strike}"
            print(
                f"  {c.symbol:<10}{c.secType:<6}{detail:<22}"
                f"{p.position:>8.0f}{p.avgCost:>14,.2f}",
                flush=True,
            )
    print("=" * 62 + "\n", flush=True)


def run(host: str, port: int, client_id: int) -> None:
    ib = IB()
    try:
        while True:
            try:
                if not ib.isConnected():
                    connect(ib, host, port, client_id)
                render(ib)
                ib.sleep(REFRESH_SECONDS)
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # coupure réseau, Gateway redémarré, timeout, etc.
                log(f"⚠ Déconnecté / erreur : {exc}")
                log(
                    f"Nouvelle tentative dans {RECONNECT_SECONDS}s "
                    f"(survit au redémarrage quotidien du Gateway)…"
                )
                try:
                    ib.disconnect()
                except Exception:
                    pass
                ib.sleep(RECONNECT_SECONDS)
    except KeyboardInterrupt:
        log("Arrêt demandé (Ctrl-C).")
    finally:
        try:
            ib.disconnect()
        except Exception:
            pass
        log("Bridge arrêté.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="QuantumCall — bridge IBKR (read-only, paper). Affiche NLV/cash/positions."
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="par défaut 127.0.0.1")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="4002=Gateway paper (défaut), 7497=TWS paper, 4001/7496=comptes LIVE",
    )
    parser.add_argument("--client-id", type=int, default=DEFAULT_CLIENT_ID)
    args = parser.parse_args()
    run(args.host, args.port, args.client_id)


if __name__ == "__main__":
    main()
