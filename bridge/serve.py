#!/usr/bin/env python3
"""
QuantumCall — Bridge HTTP server (Étape 2, archi 2 processus).

Processus 2/2 du bridge. Sert deux routes HTTP sur 127.0.0.1:8765 en lisant
bridge/snapshot.json (écrit par le processus 1, bridge/ibkr_poller.py).

  GET /health   → état de connexion + fraîcheur du snapshot
  GET /account  → contenu complet du snapshot (account + positions au shape store)

Aucune dépendance externe : juste la stdlib (http.server, json, os). Aucun
asyncio. AUCUN event loop partagé avec le poller — ils tournent dans des
processus séparés et ne se parlent qu'à travers le fichier snapshot.json
(lecture/écriture atomique côté poller via os.replace).

Si le snapshot n'existe pas encore ou est plus vieux que STALE_AFTER_SECONDS,
on répond connected=false / status=warming-up ou stale — le client peut ainsi
détecter que le poller ne tourne pas ou est déconnecté d'IBKR.

Usage :
  python bridge/serve.py
  python bridge/serve.py --port 9000
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ─── Réglages ─────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, "snapshot.json")

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
# Le poller écrit toutes les ~5s. 30s = 6 cycles ratés → snapshot stale.
STALE_AFTER_SECONDS = 30


# ─── Helpers ──────────────────────────────────────────────────────────

def ts_console() -> str:
    return datetime.now().strftime("%H:%M:%S")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str) -> None:
    print(f"[{ts_console()}] {msg}", flush=True)


def read_snapshot():
    """Retourne (data, age_seconds). (None, None) si fichier absent.
    ({'_readError': ...}, None) si fichier illisible / JSON invalide."""
    try:
        st = os.stat(SNAPSHOT_PATH)
    except FileNotFoundError:
        return None, None
    except OSError as exc:
        return {"_readError": f"stat: {exc}"}, None

    age = max(0.0, datetime.now().timestamp() - st.st_mtime)

    try:
        with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data, age
    except (OSError, json.JSONDecodeError) as exc:
        return {"_readError": str(exc)}, age


# ─── Handler ──────────────────────────────────────────────────────────

class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "QuantumCallBridge/1.0"

    def _json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Pas de cache : on veut la lecture la plus fraîche à chaque appel.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError):
            # Le client a fermé la connexion pendant qu'on écrivait — pas grave.
            pass

    def log_message(self, fmt: str, *args) -> None:
        # Format custom, monoligne, prefixé timestamp.
        print(f"[{ts_console()}] {self.address_string()} — {fmt % args}", flush=True)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._handle_health()
        elif self.path == "/account":
            self._handle_account()
        else:
            self._json(404, {"error": "not found", "path": self.path,
                             "routes": ["/health", "/account"]})

    def _handle_health(self) -> None:
        data, age = read_snapshot()
        if data is None:
            connected = False
            last_error = "snapshot.json absent — le poller tourne-t-il ?"
        elif "_readError" in data:
            connected = False
            last_error = data["_readError"]
        else:
            fresh = age is not None and age < STALE_AFTER_SECONDS
            connected = bool(data.get("connected")) and fresh
            last_error = data.get("lastError") if isinstance(data.get("lastError"), str) else None
            if not fresh and last_error is None:
                last_error = f"snapshot trop ancien ({age:.0f}s) — vérifie le poller"

        self._json(200, {
            "status": "ok",
            "connected": connected,
            "snapshotAgeSeconds": round(age, 2) if age is not None else None,
            "timestamp": now_iso(),
            "lastError": last_error,
        })

    def _handle_account(self) -> None:
        data, age = read_snapshot()
        if data is None:
            self._json(503, {
                "status": "warming-up",
                "connected": False,
                "timestamp": now_iso(),
                "message": "snapshot.json absent — lance d'abord bridge/ibkr_poller.py",
            })
            return
        if "_readError" in data:
            self._json(503, {
                "status": "read-error",
                "connected": False,
                "timestamp": now_iso(),
                "lastError": data["_readError"],
            })
            return
        if age is None or age > STALE_AFTER_SECONDS:
            self._json(503, {
                "status": "stale",
                "connected": False,
                "snapshotAgeSeconds": round(age, 2) if age is not None else None,
                "timestamp": now_iso(),
                "lastError": data.get("lastError"),
                "message": f"snapshot trop ancien (>{STALE_AFTER_SECONDS}s) — poller déconnecté ?",
            })
            return

        # Snapshot frais : on répond avec son contenu + un wrapper status.
        self._json(200, {
            "status": "ok",
            "connected": bool(data.get("connected")),
            "snapshotAgeSeconds": round(age, 2),
            **data,
        })


# ─── Entrée principale ────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="QuantumCall — bridge HTTP server. Sert snapshot.json sur /health et /account."
    )
    parser.add_argument("--host", default=DEFAULT_HOST,
                        help="bind host (default 127.0.0.1 — strictement local)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"port HTTP (default {DEFAULT_PORT})")
    args = parser.parse_args()

    # ThreadingHTTPServer : chaque requête sert dans son propre thread. Les
    # requêtes sont juste des lectures de fichier (atomique côté poller), donc
    # pas de risque de course.
    try:
        server = ThreadingHTTPServer((args.host, args.port), BridgeHandler)
    except OSError as exc:
        sys.exit(f"⚠ Impossible de binder {args.host}:{args.port} — {exc}")

    log(f"Serveur HTTP en écoute sur http://{args.host}:{args.port}  (routes : /health, /account)")
    log(f"Snapshot lu depuis : {SNAPSHOT_PATH}")
    log(f"Seuil de fraîcheur : {STALE_AFTER_SECONDS}s (>= → status stale / connected=false)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Arrêt demandé (Ctrl-C).")
    finally:
        server.server_close()
        log("Serveur arrêté.")


if __name__ == "__main__":
    main()
