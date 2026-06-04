# CLAUDE.md — garde-fou versionné

Règles que **tout assistant** doit suivre quand il travaille dans ce repo.

---

## 1. Vérification visuelle obligatoire avant tout rapport "terminé"

Pour toute modification d'un composant du Dashboard (`src/components/dashboard/**`, `src/pages/Dashboard.jsx`, ou les styles `src/styles/v4-dashboard.css`), **ne pas répondre "terminé"** sans vérification visuelle réelle dans le navigateur.

**Pourquoi :** le type-check et les tests vérifient la correctness du code, pas la correctness de la feature. Sans capture lue, on rapporte "fait" alors que le rendu peut être cassé (bande invisible, axe manquant, état non rendu, classe CSS non appliquée).

**Séquence à exécuter avant de rapporter le travail comme terminé :**

1. Vérifier que le dev server tourne (http://localhost:5173).
2. Via Playwright MCP, ouvrir http://localhost:5173/dashboard (ou la route concernée).
3. **Exercer concrètement** la fonctionnalité modifiée — cliquer le toggle, activer Mesure et cliquer A puis B, survoler la courbe, etc. Pas seulement charger la page.
4. Prendre une capture **et la lire** — confirmer que l'état visuel attendu est rendu (bande visible, axe en %, barres colorées, texte du readout correct).
5. Lire la console du navigateur ; aucune erreur ne doit apparaître. Les warnings Recharts `width(-1)/height(-1)` au mount initial sont connus et tolérés.
6. Si le rendu ne correspond pas à la spec : corriger et re-vérifier. Ne jamais rapporter "terminé" tant que la capture ne confirme pas.
7. Dans le rapport final : énoncer ce qui a été vérifié visuellement + décrire la capture.

**Efficacité tokens :** utiliser `browser_snapshot` (texte d'accessibilité) pour vérifier la structure ; réserver `browser_take_screenshot` à la confirmation visuelle finale (les captures coûtent cher en tokens).

---

## 2. Isolation obligatoire du navigateur Playwright

Le serveur MCP `playwright` **doit** tourner avec l'option `--isolated` :

```jsonc
// ~/.claude.json — projects."C:/Users/raf77/ibkr-tracker".mcpServers.playwright
{
  "type": "stdio",
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@playwright/mcp@latest", "--isolated"],
  "env": {}
}
```

`--isolated` → profil Chromium en mémoire, aucun fichier écrit sur disque, repart vierge à chaque session MCP.

**Interdictions absolues :**
- Ne **jamais** lancer Playwright avec `--channel chrome` (rattache le vrai Chrome de l'utilisateur).
- Ne **jamais** utiliser `--cdp-endpoint` connecté à un Chrome ouvert.
- Ne **jamais** partager un `--user-data-dir` avec un autre navigateur.

**Avant toute injection de démo, vérifier que `--isolated` est présent dans la config MCP courante.** Si absent : refuser d'injecter et alerter l'utilisateur.

---

## 3. Clés localStorage protégées

Sont des **données réelles utilisateur** dans le repo cible :

| Clé | Contenu |
|-----|---------|
| `ibkr_u_o` | open positions |
| `ibkr_u_c` | closed trades |
| `ibkr_u_f` | cash flows |
| `ibkr_u_j` | journal entries |
| `ibkr_u_s` | settings (liveRate, cashReport, ibkrLiveData, gwAutoConnect, snapshots…) |

**Ne jamais écrire ces clés tant que l'isolation Playwright n'est pas confirmée.** Une injection dans une session non isolée écraserait le portefeuille réel.

Les données de démo, quand l'isolation est confirmée, sont injectées dans la session isolée uniquement et disparaissent à sa fermeture — c'est voulu.

---

## 4. Artefacts de vérification

Captures et caches Playwright **ne sont pas commités**. Ils restent dans `.playwright-mcp/` et à la racine sous des noms reconnaissables (`dashboard.png`, `brique*.png`, `nettoyage*.png`) — patterns gitignorés. Les images légitimes du projet vivent sous `public/`, `src/assets/`, etc. et restent traquées.
