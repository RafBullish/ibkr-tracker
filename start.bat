@echo off
REM ─────────────────────────────────────────────────────────────────────
REM  QuantumCall — wrapper double-clickable pour le launcher bridge.
REM  Délègue tout à bridge\launch.py (Python orchestrateur) ; ce .bat
REM  ne sert qu'à permettre le double-clic depuis l'explorateur Windows.
REM
REM  Tu peux aussi lancer directement depuis PowerShell :
REM    python bridge\launch.py [--client-id N] [--no-vite] [--log-level DEBUG]
REM ─────────────────────────────────────────────────────────────────────
cd /d "%~dp0"
python bridge\launch.py %*
REM Si tu as double-cliqué, garde la fenêtre ouverte pour qu'on puisse lire
REM les éventuelles erreurs après que le launcher s'est arrêté.
if "%~1"=="" pause
