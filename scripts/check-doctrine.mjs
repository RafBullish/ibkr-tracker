#!/usr/bin/env node
/**
 * check-doctrine.mjs — TÉMOIN de la source unique de doctrine (brique Q-A).
 *
 * Ce n'est PAS un test : c'est un linter maison, même esprit que
 * check-color-law.mjs et langueTemoin.test.js (É3.3). Il ÉCHOUE si l'une des
 * valeurs de doctrine ACTIVES que Q-A a déportées au registre est RÉ-INTRODUITE
 * en dur dans `src/`, hors du loader (`src/config/`). C'est un garde-fou de
 * NON-RÉGRESSION sur les formes migrées, PAS un détecteur universel de « tout
 * 45/35/30 » : ces nombres vivent légitimement ailleurs (bande de delta
 * 0.25–0.35, opacité rgba, comptes divers) et ne sont pas des faux positifs.
 *
 * Portée exacte (formes migrées Q-A + portes câblées Q-C, à VALEUR identique) :
 *   · SL exécution : -35 en comparaison, 0.35 en affectation/multiplication,
 *     SL_PCT=35              → P1_sl.execution_pct (SL_EXECUTION_*).
 *   · gate DTE : « dte* <= 45 », GATE_DTE45=45, DTE45_THRESHOLD=45
 *                              → P3_dte.jours (DTE_GATE_JOURS).
 *   · jour de stagnation : « hold|daysHeld|holdDays >= 30 »
 *                              → P5_stagnation.jour (STAGNATION_JOUR).
 *   · P2 trail (Q-C) : « picPct < 0.5 » (activation) et « picPct * 0.6 »
 *                      (facteur de sortie) → P2_ACTIVATION_FRAC / P2_SORTIE_FACTEUR.
 *   · P5 bande (Q-C) : ex-±10 réconciliée en -20/+30 → revert-guard sur
 *                      « pnlPct >= -10 » / « pnlPct <= 10 » (STAGNATION_BANDE_*).
 * Q-C a RETIRÉ le legacy du code (TP fixe 50/40/80, gate DTE-35 SL35, DTE
 * 90/100, bande de stagnation ±10, alertes 15/40/80) : la V3 ne les contient
 * plus. `tp_50` survit comme LABEL d'historique (détecté par aucun détecteur :
 * ce n'est pas une porte live). Le kill -500 est un réglage utilisateur, pas
 * une doctrine (absent du registre). Ces valeurs ne sont donc PAS traquées.
 *
 * Sortie : `fichier:ligne` + extrait par violation. Exit ≠ 0 si ≥ 1.
 * Usage : `npm run check:doctrine`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const EXT = new Set(['.js', '.jsx']);

// Le SEUL endroit de src/ où un nombre normatif a le droit d'apparaître.
const REGISTRE_DIR = path.join(SRC, 'config');

// Détecteurs des littéraux de doctrine ACTIFS (les formes exactes que Q-A a
// migrées vers le registre). Après migration, aucun ne doit plus matcher.
const DETECTORS = [
  {
    // -35 en COMPARAISON (le stop) ; 0.35 en AFFECTATION ou MULTIPLICATION (la
    // fraction du stop, cf. « pi × ct × mu × 0.35 » de risk.js) ; SL_PCT=35.
    // On EXCLUT `<= 0.35` (bande de delta E3) et l'opacité rgba(…, 0.35) : le
    // lookbehind ne garde que l'affectation `= 0.35` et la multiplication.
    name: 'SL exécution (-35 / 0.35) → src/config/registre SL_EXECUTION_*',
    re: /(?:[<>]=?\s*-\s*35(?!\d)|(?<![<>!=])=\s*0\.35(?!\d)|\*\s*0\.35(?!\d)|\bSL_PCT\s*=\s*35\b)/,
  },
  {
    // Toute variable `dte*` comparée en dur à 45 (le gate doctrine), quel que
    // soit son nom — pas seulement `dteAtExit`. Les formes migrées (`<= 45 …`
    // suivi d'une CONSTANTE : GATE_DTE45 / DTE45_THRESHOLD / DTE_GATE_JOURS) ne
    // matchent pas (`<=\s*45` exige le littéral 45 juste après l'opérateur).
    name: 'gate DTE (45) → src/config/registre DTE_GATE_JOURS',
    re: /(?:\bGATE_DTE45\s*=\s*45\b|\bDTE45_THRESHOLD\s*=\s*45\b|\bdte\w*\s*<=\s*45(?!\d))/i,
  },
  {
    // hold / daysHeld / holdDays comparés en dur à 30 (le jour de stagnation).
    name: 'jour de stagnation (30) → src/config/registre STAGNATION_JOUR',
    re: /\b(?:hold|holdDays|daysHeld)\s*>=\s*30(?!\d)/i,
  },
  {
    // Q-C — P2 trail : activation (picPct < 0.5) et facteur de sortie
    // (picPct * 0.6) ancrés sur le nom `picPct` (aucun faux positif).
    name: 'P2 trail (0.5 / 0.6) → src/config/registre P2_ACTIVATION_FRAC / P2_SORTIE_FACTEUR',
    re: /\bpicPct\s*(?:<\s*0\.5(?!\d)|\*\s*0\.6(?!\d))/,
  },
  {
    // Q-C — revert-guard de la bande de stagnation ex-±10 (réconciliée
    // -20/+30). Ancré sur `pnlPct` (la forme historique divergente retirée).
    name: 'P5 bande ±10 (réconciliée -20/+30) → src/config/registre STAGNATION_BANDE_*',
    re: /\bpnlPct\s*(?:>=\s*-\s*10(?!\d)|<=\s*10(?!\d))/,
  },
];

// Lignes purement commentaires : ignorées (elles citent souvent les valeurs).
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
      if (full === REGISTRE_DIR) continue; // le loader : seul foyer légal
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
    // On ignore la partie commentaire de fin de ligne (`… // …`) : seul le
    // code compte (un commentaire peut légitimement citer la valeur).
    const code = line.replace(/\/\/.*$/, '');
    for (const d of DETECTORS) {
      if (d.re.test(code)) {
        violations.push({ file: rel, line: i + 1, text: trimmed, why: d.name });
      }
    }
  });
}

if (violations.length === 0) {
  console.log('✓ check:doctrine — 0 violation : aucun nombre normatif V3 en dur hors du registre.');
  process.exit(0);
}

console.error(
  `\n✗ check:doctrine — ${violations.length} violation(s) : un nombre de doctrine V3 ` +
    `vit EN DUR hors de src/config/ (il doit être LU du registre) :\n`,
);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}   [${v.why}]`);
  console.error(`    ${v.text}\n`);
}
console.error(
  'Corrige : importe la valeur depuis src/config/registre.js (source unique).\n' +
    'La loi de trading vit dans parametres.json (Carte V3) — jamais en dur dans src/.\n',
);
process.exit(1);
