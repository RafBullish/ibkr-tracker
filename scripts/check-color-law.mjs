#!/usr/bin/env node
/**
 * check-color-law.mjs — contrôle STATIQUE de la loi de couleur (cf. CLAUDE.md §6).
 *
 * Ce n'est PAS un test : c'est un linter maison. Il scanne src/ et signale toute
 * ligne qui applique une couleur/classe/token de P&L (rouge=perte, vert=gain) à un
 * champ de Greek (delta / gamma / theta / vega). Un Greek est signé par nature ;
 * le colorer confond signe et perte → interdit.
 *
 * Sortie : `fichier:ligne` + extrait pour chaque violation. Exit code ≠ 0 si ≥ 1.
 * Usage : `npm run check:color-law`.
 *
 * Heuristique = DOUBLE SIGNAL sur la même ligne :
 *   (A) un signal de couleur P&L (rouge/vert)  ET
 *   (B) une référence de Greek en accès-propriété / agrégat / fieldKey / Σ-symbole.
 * Le Greek n'est JAMAIS matché comme mot nu → exclut les faux positifs où « delta »
 * signifie « écart/variation » (deltaTone, rangeDelta, peakDelta, deltaVsBench, et
 * la variable locale `delta` de sparkTrend).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const EXT = new Set(['.js', '.jsx']);

// (A) Signal de couleur P&L (rouge = perte / vert = gain).
function hasColorSignal(line) {
  return (
    /\btext-(profit|loss)\b/.test(line) || // classes .text-profit / .text-loss
    /--(profit-text|loss-text|pnl-up|pnl-down|qc-profit|qc-loss)\b/.test(line) || // tokens
    /(cell|value|val|ctx-val|footer-value)--(profit|loss)\b/.test(line) || // classes BEM P&L
    /--(profit|loss)\b/.test(line) || // autres classes/tokens --profit / --loss
    /\btoneFromSign\s*\(/.test(line) || // helper sign -> profit/loss
    /\btone\s*=\s*['"](profit|loss)['"]/.test(line) || // prop tone="profit|loss"
    /['"](profit|loss)['"]\s*:\s*['"](loss|profit)['"]/.test(line) // ternaire 'loss':'profit'
  );
}

// (B) Référence de Greek (accès-propriété / agrégat / fieldKey / var connue / Σ-symbole).
// JAMAIS le mot nu -> pas de faux positif sur « delta » = écart.
function hasGreekRef(line) {
  return (
    /\.(delta|gamma|theta|vega)\b/i.test(line) || // .delta / .theta / g.vega …
    /\b(sum|total|net)(Delta|Gamma|Theta|Vega)\b/i.test(line) || // sumDelta / totalTheta …
    /\b(delta|theta|vega|gamma)Dollar\b/i.test(line) || // deltaDollar / thetaDollar
    /\b(thetaDaily|vegaPer1Pct|dailyTheta)\b/.test(line) || // vars greek connues
    /\bfieldKey\s*=\s*['"](delta|gamma|theta|vega)['"]/i.test(line) || // <ChainCell fieldKey="delta">
    /Σ\s*(DELTA|GAMMA|THETA|VEGA)/.test(line) // label « Σ DELTA » …
  );
}

// Lignes purement commentaires : ignorées (les commentaires citent souvent la loi).
function isCommentOnly(trimmed) {
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('{/*') ||
    trimmed === '*/'
  );
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (EXT.has(path.extname(entry.name)) && !/\.test\.jsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || isCommentOnly(trimmed)) return;
    if (hasColorSignal(line) && hasGreekRef(line)) {
      violations.push({ file: rel, line: i + 1, text: trimmed });
    }
  });
}

if (violations.length === 0) {
  console.log('✓ check:color-law — 0 violation : aucun Greek coloré en P&L (rouge/vert).');
  process.exit(0);
}

console.error(
  `\n✗ check:color-law — ${violations.length} violation(s) de la LOI DE COULEUR ` +
    `(un Greek signé ne doit jamais être coloré rouge/vert) :\n`
);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    ${v.text}\n`);
}
console.error(
  'Corrige : passe la valeur de Greek en NEUTRE (encre ink-*, tone="mute"/"neutral").\n' +
    'Le rouge/vert reste réservé aux pertes/gains d\'argent RÉELS (P&L, Max Loss).\n'
);
process.exit(1);
