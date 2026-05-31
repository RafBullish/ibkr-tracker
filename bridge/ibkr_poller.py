#!/usr/bin/env python3
"""
QuantumCall — Bridge IBKR Poller (Étape 2, archi 2 processus, READ-ONLY, PAPER).

Processus 1/2 du bridge. Tourne dans son propre processus avec sa propre boucle
asyncio (créée implicitement par ib_async en mode sync). Toutes les ~5s :
  1. lit le résumé de compte (NLV/cash) + le portfolio (positions + mark prices)
     depuis IB Gateway (port 4002, paper, read-only) ;
  2. assemble un snapshot au shape store QuantumCall (clés abrégées
     tk/ty/st/ex/ct/mu/pi/pc/fxi/…), documenté en tête de src/store/migrations.js ;
  3. écrit bridge/snapshot.json de façon ATOMIQUE (.tmp puis os.replace), pour que
     le processus 2 (bridge/serve.py) ne lise jamais un fichier à moitié écrit.

Processus 2 (bridge/serve.py) : serveur HTTP stdlib, lit ce fichier à chaque
requête. AUCUN event loop partagé entre les deux processus — c'est ce qui rend
l'archi robuste après l'échec de la version monolithique aiohttp + ib_async.

Sécurité :
  - readonly=True à la connexion → le client API ne PEUT PAS passer d'ordre.
  - Port par défaut 4002 = IB Gateway paper (jamais le compte réel).

Logique de connexion : reprend strictement le pattern sync ib_async qui marchait
à l'étape 1 (ib.connect / ib.sleep / boucle while True). Aucun aiohttp, aucun
nest_asyncio, aucune coroutine awaitée explicitement par nous.

Usage :
  python bridge/ibkr_poller.py
  python bridge/ibkr_poller.py --port 7497      # TWS paper au lieu de Gateway
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

# Force UTF-8 sur stdout/stderr. Sans ça, print('→') ou tout autre caractère
# hors cp1252 crashe en UnicodeEncodeError quand un parent capture stdout via
# un pipe (typique : lancement via bridge/launch.py, qui pipe et fait retomber
# Python sur l'encodage locale = cp1252 sur Windows). Couvre le lancement
# direct ; le launcher pose en plus PYTHONIOENCODING=utf-8 dans l'env des
# enfants (ceinture + bretelles).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

try:
    from ib_async import IB, util
except ImportError:
    sys.exit(
        "ib_async n'est pas installé.\n"
        "Active ton environnement puis lance :  pip install -r bridge/requirements.txt"
    )

# ─── Réglages ─────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, "snapshot.json")
SNAPSHOT_TMP = os.path.join(SCRIPT_DIR, "snapshot.json.tmp")

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4002        # Gateway PAPER (Gateway live=4001, TWS paper=7497, TWS live=7496)
DEFAULT_CLIENT_ID = 11
REFRESH_SECONDS = 5
RECONNECT_SECONDS = 10
STATUS_LOG_SECONDS = 30

SUMMARY_TAGS = ("NetLiquidation", "TotalCashValue", "AvailableFunds", "BuyingPower")


# ─── Helpers ──────────────────────────────────────────────────────────

def ts_console() -> str:
    return datetime.now().strftime("%H:%M:%S")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str) -> None:
    print(f"[{ts_console()}] {msg}", flush=True)


def fmt_num(x, decimals: int = 4) -> str:
    """Formate un float en string courte (sans zéros trainants), comme le store."""
    if x is None:
        return "0"
    try:
        v = float(x)
    except (TypeError, ValueError):
        return "0"
    if v == 0:
        return "0"
    s = f"{v:.{decimals}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


def parse_expiry_iso(raw) -> str:
    """'20260116' → '2026-01-16'. Tolère déjà-ISO et chaînes vides."""
    if not raw:
        return ""
    clean = str(raw).split(";")[0].replace("-", "")
    if len(clean) == 8 and clean.isdigit():
        return f"{clean[:4]}-{clean[4:6]}-{clean[6:8]}"
    return str(raw)


def write_atomic(payload: dict) -> None:
    """Écrit snapshot.json de façon atomique.

    Stratégie : écrire d'abord dans snapshot.json.tmp (flush + fsync), puis
    os.replace(tmp, final). os.replace utilise rename() côté POSIX et
    MoveFileEx(MOVEFILE_REPLACE_EXISTING) côté Windows — atomique au niveau
    du système de fichiers dans les deux cas. Donc le serveur ne peut jamais
    ouvrir un fichier partiellement écrit, même s'il fait la requête pile
    pendant que le poller écrit.
    """
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    with open(SNAPSHOT_TMP, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(SNAPSHOT_TMP, SNAPSHOT_PATH)


# ─── Mapping position IBKR → shape store QuantumCall ──────────────────
# Shape canonique : tête de src/store/migrations.js, "Open Position only"
# (lignes 27-77). Δ/IV/IVR/di/dteAtEntry restent null/"" car IBKR n'expose
# pas le spot d'entrée (idem Flex, cf. bloc "FIELDS AWAITING SPOT").
# fxi="0" → la calc downstream retombe sur settings.liveRate
# (cf. commentaire ligne 132 de src/services/flexApi.js).

def position_to_store(p) -> dict:
    """Map un ib_async Position vers le shape Open Position du store.

    Note : on lit Position (pas PortfolioItem). Position n'expose que qty +
    avgCost + contract — pas de marketPrice ni unrealizedPNL (ces deux-là sont
    sur PortfolioItem, qui exigerait reqAccountUpdates qu'on a retiré parce
    qu'il faisait hang la lib). Conséquence assumée : pc = pi (P&L unrealized
    = 0 sur le snapshot, à brancher plus tard sur un flux de quotes séparé).
    """
    c = p.contract
    is_opt = c.secType == "OPT"

    try:
        multiplier = int(c.multiplier) if c.multiplier else (100 if is_opt else 1)
    except (TypeError, ValueError):
        multiplier = 100 if is_opt else 1

    qty = abs(p.position)
    direction = "Long" if p.position > 0 else "Short"

    # IBKR avgCost : actions = par action ; options = par contrat (déjà × multiplier).
    # Store stocke pi par action sous-jacente → divise pour les options.
    raw_avg = float(p.avgCost or 0)
    pi = (raw_avg / multiplier) if (is_opt and multiplier) else raw_avg
    pc = pi  # pas de marketPrice sans abonnement portfolio → unrealized = 0

    qty_str = str(int(qty)) if qty == int(qty) else fmt_num(qty)
    pi_str = fmt_num(pi)
    pc_str = fmt_num(pc)

    return {
        "as": "Option" if is_opt else "Action",
        "dir": direction,
        "tk": (c.symbol or "").strip(),
        "ty": ("CALL" if c.right == "C" else "PUT") if is_opt else "",
        "st": str(c.strike) if (is_opt and c.strike) else "",
        "ex": parse_expiry_iso(c.lastTradeDateOrContractMonth) if is_opt else "",
        "ct": qty_str,
        "mu": str(multiplier),
        "pi": pi_str,
        "pc": pc_str,
        "fi": "0",
        "fxi": "0",
        "dteAtEntry": None,
        "deltaAtEntry": None,
        "ivAtEntry": None,
        "ivRankAtEntry": None,
        "exitReason": None,
        "di": "",
        "rk": "0",
        "su": "",
        "lots": [{
            "ct": qty_str,
            "pi": pi_str,
            "fi": "0",
            "di": "",
            "fxi": "0",
        }],
        "_ibkrConid": str(c.conId) if c.conId else "",
        "_ibkrSymbol": c.localSymbol or "",
        "_ibkrUnrealized": 0.0,  # exige PortfolioItem, pas disponible ici
        "_level": "SUMMARY",
    }


def build_snapshot(ib: IB, last_error: str | None) -> dict:
    """Assemble le snapshot JSON-sérialisable écrit sur disque."""
    summary_raw = ib.accountSummary()
    summary = {av.tag: av for av in summary_raw if av.tag in SUMMARY_TAGS}

    def num(tag: str):
        av = summary.get(tag)
        if av is None:
            return None
        try:
            return float(av.value)
        except (TypeError, ValueError):
            return None

    # Devise détectée dynamiquement depuis le résumé de compte. Aucun fallback
    # hardcodé : pour un compte CHF on doit voir "CHF", pas un faux "USD".
    currency = next((av.currency for av in summary.values() if av.currency), None)

    # STK + OPT uniquement (le shape store ne couvre rien d'autre).
    raw_positions = [
        p for p in ib.positions()
        if p.position != 0 and p.contract.secType in ("STK", "OPT")
    ]
    positions = [position_to_store(p) for p in raw_positions]

    return {
        "timestamp": now_iso(),
        "connected": True,
        "lastError": last_error,
        "account": {
            "currency": currency,
            "netLiquidation": num("NetLiquidation"),
            "totalCashValue": num("TotalCashValue"),
            "availableFunds": num("AvailableFunds"),
            "buyingPower": num("BuyingPower"),
        },
        "positions": positions,
    }


def write_disconnect_marker(last_error: str | None) -> None:
    """Écrit un snapshot connected=false quand on n'arrive pas à se connecter,
    pour que /health reflète immédiatement l'état au lieu d'attendre la
    péremption (>30s) du dernier snapshot connecté."""
    try:
        write_atomic({
            "timestamp": now_iso(),
            "connected": False,
            "lastError": last_error,
            "account": {
                "currency": None,  # inconnue tant qu'on n'est pas connecté
                "netLiquidation": None,
                "totalCashValue": None,
                "availableFunds": None,
                "buyingPower": None,
            },
            "positions": [],
        })
    except Exception as exc:
        log(f"⚠ Erreur écriture snapshot disconnect : {exc}")


# ─── Boucle principale ────────────────────────────────────────────────
# PATTERN SYNC IB_ASYNC — strictement identique à celui de l'étape 1 :
#   IB()  →  ib.connect()  →  ib.sleep()  en boucle while True.
# AUCUN await, AUCUN asyncio.run, AUCUNE coroutine awaitée par nous, AUCUN
# nest_asyncio. ib_async crée et gère son propre event loop en interne via
# util.run() : on ne touche pas à asyncio. C'est le pattern qui marchait à
# l'étape 1, et qui plantait quand on essayait de cohabiter avec aiohttp.
# Ici, le processus est dédié au polling — aucun conflit possible.

CONNECT_TIMEOUT_SECONDS = 15  # ib.connect lève après ce délai → erreur claire au lieu de hang infini


def run(host: str, port: int, client_id: int, log_level: int) -> None:
    # Active les logs ib_async sur la console AVANT toute connexion. En DEBUG
    # on voit chaque message API (handshake START_API, MANAGED_ACCOUNTS,
    # NEXT_VALID_ID, errors codes 502/504/2104/2106…) → on sait exactement où
    # la connexion se bloque s'il y a un problème (clientId déjà utilisé,
    # Gateway en cours de réauth, etc.).
    util.logToConsole(log_level)
    logging.getLogger("ib_async").setLevel(log_level)

    ib = IB()
    last_error: str | None = None
    last_status_log = 0.0

    log(f"Snapshot cible : {SNAPSHOT_PATH}")
    log(f"Niveau de logs ib_async : {logging.getLevelName(log_level)}")

    try:
        while True:
            if not ib.isConnected():
                t0 = time.monotonic()
                try:
                    log(f"→ ib.connect({host}:{port}, clientId={client_id}, "
                        f"timeout={CONNECT_TIMEOUT_SECONDS}s, readonly=True)…")
                    ib.connect(
                        host, port,
                        clientId=client_id,
                        timeout=CONNECT_TIMEOUT_SECONDS,
                        readonly=True,
                    )
                    log(f"← ib.connect() retourné en {time.monotonic() - t0:.2f}s ; "
                        f"isConnected={ib.isConnected()}")

                    log("→ ib.reqAccountSummary()…")
                    ib.reqAccountSummary()
                    log("← ib.reqAccountSummary() OK")

                    log("→ ib.managedAccounts()…")
                    accounts = ib.managedAccounts()
                    log(f"← ib.managedAccounts() = {accounts}")

                    # PAS de ib.reqAccountUpdates() : ce req hangait en boucle
                    # (conflit avec reqAccountSummary déjà actif). On s'en passe
                    # car accountSummary() suffit pour NLV/cash, et ib.positions()
                    # ne nécessite aucun abonnement supplémentaire — il lit
                    # l'état cache déjà rempli par le handshake initial.
                    if accounts:
                        log(f"Connecté ✓ (compte={accounts[0]})")
                    else:
                        log("Connecté ✓ (aucun compte géré détecté)")

                    log("→ ib.sleep(1.5) (laisse les premières valeurs arriver)…")
                    ib.sleep(1.5)
                    log("← ib.sleep(1.5) OK ; entrée dans la boucle de polling.")
                    last_error = None
                except Exception as exc:
                    dt = time.monotonic() - t0
                    last_error = f"{type(exc).__name__}: {exc}"
                    log(f"⚠ Échec connexion après {dt:.2f}s : {last_error}")
                    log(f"   retry dans {RECONNECT_SECONDS}s "
                        f"(si {type(exc).__name__} == TimeoutError, le clientId={client_id} "
                        f"est peut-être déjà utilisé par une session zombie — relance avec "
                        f"--client-id différent)")
                    try:
                        ib.disconnect()
                    except Exception:
                        pass
                    write_disconnect_marker(last_error)
                    time.sleep(RECONNECT_SECONDS)
                    continue

            try:
                snap = build_snapshot(ib, last_error=None)
                write_atomic(snap)
                now = time.time()
                if now - last_status_log > STATUS_LOG_SECONDS:
                    nlv = snap["account"]["netLiquidation"]
                    nlv_str = f"{nlv:,.2f}" if isinstance(nlv, (int, float)) else "?"
                    log(
                        f"NLV={nlv_str} {snap['account']['currency']} · "
                        f"positions={len(snap['positions'])} · → snapshot.json"
                    )
                    last_status_log = now
            except Exception as exc:
                last_error = str(exc)
                log(f"⚠ Erreur snapshot : {exc}")

            # ib.sleep pompe l'event loop ib_async pendant qu'on attend — le
            # portfolio se met à jour en arrière-plan. C'est exactement le
            # pattern de l'étape 1 qui marchait.
            ib.sleep(REFRESH_SECONDS)
    except KeyboardInterrupt:
        log("Arrêt demandé (Ctrl-C).")
    finally:
        try:
            ib.disconnect()
        except Exception:
            pass
        # Marque le snapshot comme disconnected pour qu'un /health appelé après
        # l'arrêt du poller renvoie immédiatement la réalité.
        write_disconnect_marker(last_error or "poller arrêté manuellement")
        log("Poller arrêté.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="QuantumCall — bridge IBKR poller (read-only, paper). "
                    "Écrit snapshot.json toutes les ~5s."
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="IBKR host (default 127.0.0.1)")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="4002=Gateway paper (défaut), 7497=TWS paper, 4001/7496=LIVE",
    )
    parser.add_argument("--client-id", type=int, default=DEFAULT_CLIENT_ID)
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Niveau de log ib_async (default INFO — handshake + erreurs ; "
             "passe à DEBUG pour voir chaque message API).",
    )
    args = parser.parse_args()
    run(args.host, args.port, args.client_id, getattr(logging, args.log_level))


if __name__ == "__main__":
    main()
