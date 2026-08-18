#!/usr/bin/env python3
"""
QuantumCall bridge v2 — couche de connexion IBKR (read-only, paramétrable).

Fondation commune des jalons de la Phase A. Un seul rôle : ouvrir une
connexion IBKR read-only, paramétrable host / port / clientId, et la rendre.
La bascule paper → live, ou l'usage d'un second identifiant, n'est qu'un
argument — rien n'est hardcodé.

INVARIANTS (non négociables) :
  - readonly=True → le client API ne PEUT PAS passer d'ordre. IBKR reste le
    seul endroit où de l'argent bouge. Jamais de placeOrder ici, ni ailleurs
    dans le bridge.
  - AUCUN reqAccountUpdates, même isolé → il ressuscite le hang de rc.6
    (conflit avec reqAccountSummary, cf. bridge/ibkr_poller.py:320-324). Les
    valeurs de compte se lisent par reqAccountSummary (calculées par IBKR,
    sans abonnement) ; les marks par reqPnLSingle puis reqTickers (jalon 2).
"""

from __future__ import annotations

import argparse
import logging
import os

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4002          # IB Gateway PAPER (live=4001 · TWS paper=7497 · TWS live=7496)
DEFAULT_CLIENT_ID = 21       # v2 : distinct du poller rc.6 (clientId 11) → cohabitation possible
CONNECT_TIMEOUT_SECONDS = 15


def add_connection_args(parser: argparse.ArgumentParser) -> None:
    """Ajoute --host / --port / --client-id / --timeout / --log-level.

    Chaque valeur retombe sur une variable d'environnement (IBKR_HOST, …) si
    l'argument n'est pas passé, elle-même repliant sur le défaut. Ordre de
    priorité : argument CLI > variable d'env > défaut.
    """
    parser.add_argument(
        "--host",
        default=os.environ.get("IBKR_HOST") or DEFAULT_HOST,
        help="hôte du Gateway/TWS (défaut 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("IBKR_PORT") or DEFAULT_PORT),
        help="4002=Gateway paper (défaut) · 4001=Gateway live · 7497/7496=TWS paper/live",
    )
    parser.add_argument(
        "--client-id",
        type=int,
        default=int(os.environ.get("IBKR_CLIENT_ID") or DEFAULT_CLIENT_ID),
        help="clientId API (défaut 21 ; en changer si « déjà utilisé »)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=CONNECT_TIMEOUT_SECONDS,
        help="timeout de connexion en secondes (défaut 15 ; erreur claire vs hang infini)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="verbosité ib_async (DEBUG = chaque message API pour diagnostiquer un blocage)",
    )


def connect_readonly(
    host: str,
    port: int,
    client_id: int,
    timeout: int = CONNECT_TIMEOUT_SECONDS,
    log_level: int = logging.INFO,
):
    """Ouvre une connexion IBKR read-only et la retourne (déjà connectée).

    L'import de ib_async est DIFFÉRÉ dans le corps : `--help` et le parsing
    d'arguments fonctionnent même sans la dépendance installée. Lève
    SystemExit avec un message clair si ib_async manque.
    """
    try:
        from ib_async import IB, util
    except ImportError as exc:
        raise SystemExit(
            "ib_async n'est pas installé.\n"
            "Active ton venv puis :  pip install -r bridge/requirements.txt"
        ) from exc

    util.logToConsole(log_level)
    logging.getLogger("ib_async").setLevel(log_level)

    ib = IB()
    ib.connect(host, port, clientId=client_id, timeout=timeout, readonly=True)
    return ib
