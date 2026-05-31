#!/usr/bin/env python3
"""
bridge/launch.py — Lanceur unique pour l'environnement dev QuantumCall.

Orchestre TROIS processus indépendants qui ne partagent AUCUN event loop —
contrainte d'archi critique héritée de l'échec single-process aiohttp +
ib_async (3 corrections successives) :

  1. bridge/ibkr_poller.py  — connecté à IB Gateway (paper, 4002, READ-ONLY).
                              Écrit bridge/snapshot.json toutes les 5 s.
  2. bridge/serve.py        — serveur HTTP stdlib sur 127.0.0.1:8765.
                              Lit snapshot.json à chaque requête /health et /account.
  3. (optionnel) npm run dev — serveur Vite, monte l'app QuantumCall sur :5173.

Chaque enfant tourne dans son propre interpréteur (Python pour 1 et 2, Node
pour 3). Le launcher ne fait QUE :
  - sélectionner .venv/Scripts/python.exe pour les enfants Python (= "venv
    activé" pour eux, sans toucher à l'env du shell appelant) ;
  - multiplexer stdout/stderr avec un préfixe ;
  - propager Ctrl-C aux enfants (graceful) puis taskkill /T si nécessaire.

Lancement (depuis la racine du repo) :
  python bridge\\launch.py
  python bridge\\launch.py --client-id 33
  python bridge\\launch.py --no-vite           # bridge seul, tu lances npm toi-même
  python bridge\\launch.py --log-level DEBUG   # logs ib_async verbeux

NE refusionne JAMAIS poller + serve en un seul processus : ils DOIVENT
rester séparés (= deux event loops Python distincts dans deux interpréteurs
distincts). C'est le sens de tout ce module.
"""

from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

VENV_PYTHON = os.path.join(REPO_ROOT, ".venv", "Scripts", "python.exe")
POLLER_PATH = os.path.join(SCRIPT_DIR, "ibkr_poller.py")
SERVE_PATH = os.path.join(SCRIPT_DIR, "serve.py")
NODE_MODULES = os.path.join(REPO_ROOT, "node_modules")

DEFAULT_CLIENT_ID = 30
DEFAULT_IBKR_PORT = 4002
DEFAULT_HTTP_PORT = 8765
GRACEFUL_SHUTDOWN_SECONDS = 5

_print_lock = threading.Lock()
_shutdown_in_progress = threading.Event()


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(msg: str) -> None:
    with _print_lock:
        print(f"[{ts()}] [launch] {msg}", flush=True)


def find_venv_python() -> str:
    if os.path.exists(VENV_PYTHON):
        return VENV_PYTHON
    log(f"⚠ Python du venv introuvable ({VENV_PYTHON})")
    log("  Crée-le d'abord :")
    log("    python -m venv .venv")
    log("    .\\.venv\\Scripts\\Activate.ps1")
    log("    pip install -r bridge\\requirements.txt")
    sys.exit(1)


def stream_output(name: str, pipe) -> None:
    """Lit le pipe ligne par ligne et imprime avec préfixe [name]."""
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            with _print_lock:
                # Pas de timestamp ici : les enfants impriment déjà le leur,
                # on évite la double horodatation.
                print(f"[{name}] {line}", end="", flush=True)
    except (ValueError, OSError):
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass


def spawn(name: str, cmd, cwd=None, shell: bool = False) -> subprocess.Popen:
    """Démarre un process enfant + thread de streaming stdout.
    CREATE_NEW_PROCESS_GROUP : permet d'envoyer CTRL_BREAK_EVENT uniquement
    à cet enfant (sinon le Ctrl-C du parent rejoindrait aussi les enfants
    immédiatement et on perdrait le contrôle de l'ordre d'arrêt)."""
    display = " ".join(cmd) if isinstance(cmd, list) else cmd
    log(f"démarrage {name!r}: {display}")
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        shell=shell,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        # UTF-8 explicite des deux côtés : sans ça le parent décode en cp1252
        # (locale Windows) et les enfants Python retombent aussi en cp1252 sur
        # leur stdout → crash UnicodeEncodeError dès qu'un print contient →, ✓,
        # ⚠ ou un accent. PYTHONIOENCODING force les enfants Python à émettre
        # en UTF-8 ; encoding+errors ici force le parent à le décoder pareil.
        # errors='replace' = filet de sécurité (npm/node n'utilise pas toujours
        # UTF-8 sur Windows — on remplace plutôt que crasher).
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        creationflags=creationflags,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    threading.Thread(
        target=stream_output,
        args=(name, proc.stdout),
        daemon=True,
    ).start()
    return proc


def terminate_tree_windows(pid: int) -> None:
    """Fallback dur sur Windows : taskkill /F /T tue le PID + tous ses
    descendants. Utilisé quand l'enfant ne réagit pas à CTRL_BREAK_EVENT
    dans le délai imparti (typique de npm.cmd → node.exe, où la chaîne
    cmd.exe ne propage pas toujours proprement)."""
    try:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            capture_output=True,
            check=False,
            timeout=5,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass


def shutdown(procs) -> None:
    """Arrêt propre : CTRL_BREAK_EVENT à chacun (laisse les finally tourner,
    notamment le poller qui écrit son dernier snapshot connected=false),
    puis attente bornée, puis kill brutal si encore vivants."""
    if _shutdown_in_progress.is_set():
        return
    _shutdown_in_progress.set()

    log("Ctrl-C — arrêt propre des enfants…")
    for name, proc in procs:
        if proc.poll() is not None:
            continue
        try:
            if sys.platform == "win32":
                # CTRL_BREAK_EVENT : reçu par les enfants Python comme
                # KeyboardInterrupt → leurs blocs finally s'exécutent.
                proc.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                proc.send_signal(signal.SIGINT)
        except (OSError, ValueError) as exc:
            log(f"  ⚠ impossible de signaler {name}: {exc}")

    deadline = time.monotonic() + GRACEFUL_SHUTDOWN_SECONDS
    for name, proc in procs:
        remaining = max(0.0, deadline - time.monotonic())
        try:
            rc = proc.wait(timeout=remaining)
            log(f"  {name} arrêté (rc={rc})")
        except subprocess.TimeoutExpired:
            log(f"  {name} ne répond pas — kill forcé (taskkill /F /T)")
            if sys.platform == "win32":
                terminate_tree_windows(proc.pid)
            else:
                proc.kill()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass
    log("tous les enfants arrêtés.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="QuantumCall — lanceur du bridge IBKR (1 commande, "
                    "2 ou 3 processus séparés)."
    )
    parser.add_argument("--client-id", type=int, default=DEFAULT_CLIENT_ID,
                        help=f"clientId IBKR API (default {DEFAULT_CLIENT_ID})")
    parser.add_argument("--ibkr-port", type=int, default=DEFAULT_IBKR_PORT,
                        help=f"port IB Gateway (default {DEFAULT_IBKR_PORT} = paper)")
    parser.add_argument("--http-port", type=int, default=DEFAULT_HTTP_PORT,
                        help=f"port HTTP du serveur bridge (default {DEFAULT_HTTP_PORT})")
    parser.add_argument("--log-level", default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                        help="niveau de log ib_async dans le poller (default INFO)")
    parser.add_argument("--no-vite", action="store_true",
                        help="ne lance PAS `npm run dev` — tu le gères toi-même")
    args = parser.parse_args()

    python = find_venv_python()

    # Pré-checks
    for path, label in [(POLLER_PATH, "ibkr_poller.py"), (SERVE_PATH, "serve.py")]:
        if not os.path.exists(path):
            log(f"⚠ fichier introuvable : {label} ({path})")
            return 1

    if not args.no_vite:
        if not os.path.isdir(NODE_MODULES):
            log("⚠ node_modules absent — lance `npm install` d'abord, "
                "ou utilise --no-vite pour ne pas démarrer Vite.")
            return 1
        # npm est trouvable via PATH ?
        if shutil.which("npm") is None:
            log("⚠ `npm` introuvable dans PATH. Installe Node.js ou utilise --no-vite.")
            return 1

    log(f"repo root     : {REPO_ROOT}")
    log(f"venv python   : {python}")
    log(f"clientId IBKR : {args.client_id}  (changeable via --client-id)")

    procs = []

    # 1) poller
    procs.append((
        "poller",
        spawn(
            "poller",
            [
                python, POLLER_PATH,
                "--port", str(args.ibkr_port),
                "--client-id", str(args.client_id),
                "--log-level", args.log_level,
            ],
            cwd=REPO_ROOT,
        ),
    ))

    # 2) serve
    procs.append((
        "serve",
        spawn(
            "serve",
            [python, SERVE_PATH, "--port", str(args.http_port)],
            cwd=REPO_ROOT,
        ),
    ))

    # 3) vite (optionnel)
    if not args.no_vite:
        # shell=True : requis sur Windows pour que `npm` se résolve via PATH
        # (en réalité npm.cmd). Le shell devient le process group leader,
        # CTRL_BREAK_EVENT le coupe — fallback taskkill /T si node ne plie pas.
        procs.append((
            "vite",
            spawn("vite", "npm run dev", cwd=REPO_ROOT, shell=True),
        ))

    # Bannière de bienvenue
    with _print_lock:
        print("", flush=True)
        print("==============================================================", flush=True)
        print("  QuantumCall — bridge IBKR lancé", flush=True)
        print("", flush=True)
        print(f"  bridge /health   →  http://127.0.0.1:{args.http_port}/health", flush=True)
        print(f"  bridge /account  →  http://127.0.0.1:{args.http_port}/account", flush=True)
        if not args.no_vite:
            print("  app QuantumCall  →  http://127.0.0.1:5173  (Vite — patiente ~3s)", flush=True)
        print("", flush=True)
        print("  IB Gateway pas encore lancé ?  Le poller retentera sa connexion", flush=True)
        print("  toutes les 10s — le serveur HTTP répond entre temps (connected=false).", flush=True)
        print("", flush=True)
        print("  Arrêt :  Ctrl-C ICI  →  coupe les 2 (ou 3) processus proprement", flush=True)
        print("==============================================================", flush=True)
        print("", flush=True)

    # Handler Ctrl-C / Ctrl-Break du parent
    def _sig_handler(_signum, _frame):
        shutdown(procs)
        sys.exit(0)

    signal.signal(signal.SIGINT, _sig_handler)
    if sys.platform == "win32":
        signal.signal(signal.SIGBREAK, _sig_handler)

    # Boucle de supervision : si un enfant meurt sans intervention de
    # l'utilisateur, on arrête les autres pour ne pas laisser tourner un
    # snapshot orphelin (poller mort + serve qui sert du stale, ou inverse).
    try:
        while True:
            for name, proc in procs:
                rc = proc.poll()
                if rc is not None:
                    log(f"⚠ {name} a quitté sans Ctrl-C (rc={rc}) — on coupe le reste.")
                    shutdown(procs)
                    return rc or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        # Filet de sécurité — normalement intercepté par _sig_handler avant.
        shutdown(procs)
        return 0


if __name__ == "__main__":
    sys.exit(main())
