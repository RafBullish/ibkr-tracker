# Démarrage quotidien

## Le matin

1. **Ouvrir IB Gateway** → Trading simulé → login. Attendre les lignes vertes "connecté".
2. **Double-cliquer `start.bat`** à la racine du projet. Les 3 processus démarrent.
3. **Ouvrir <http://localhost:5173>** → badge **LIVE** + NLV affichés après ~5 secondes.

## Le soir

- `Ctrl-C` dans la fenêtre noire pour arrêter les processus.
- Fermer IB Gateway.

## Si ça marche pas

- **Badge pas LIVE** → vérifier que Gateway est bien connecté (lignes vertes).
- **La fenêtre se ferme toute seule** → relancer via PowerShell avec `python bridge\launch.py` pour voir le message d'erreur.
