#!/usr/bin/env node
/**
 * visual-audit.mjs — capture d'audit visuel des 12 pages (cf. CLAUDE.md §7).
 *
 * Cible : viewport CSS 1591×900, deviceScaleFactor 1.35, thème midnight — la cible
 * de design unique (4K Chrome 90 %). Sortie : docs/captures/audit-AAAAMMJJ/.
 *
 * PRÉREQUIS : le dev server doit tourner (`npm run dev`). Vite écoute 5173, mais
 *   bascule sur 5174 si 5173 est déjà pris — le script sonde les deux et choisit
 *   le premier joignable. Force une URL précise avec AUDIT_BASE_URL si besoin.
 * USAGE     : `npm run audit:visual`
 *
 * Seed reproductible : les pages persistent via localStorage (clés ibkr_u_*). On
 * injecte un dataset de test à DATES RELATIVES (buildSeed) via addInitScript, avant
 * tout script d'app — les captures montrent donc des pages PEUPLÉES quelle que soit
 * la date d'exécution. Aucune donnée réelle touchée : navigateur headless isolé,
 * profil éphémère (rien de partagé avec le Chrome de l'utilisateur).
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, buildSeedNlvPathologie } from './audit-seeds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// FIX-NLV : profil de seed OPTIONNEL. Sans AUDIT_SEED → dataset par
// défaut, comportement et dossier de sortie STRICTEMENT inchangés.
//   AUDIT_SEED=nlv-pathologie → cas Rafael 12.08 (cf. audit-seeds.mjs),
//   captures vers audit-AAAAMMJJ-nlv-pathologie/.
const SEED_PROFILES = { 'nlv-pathologie': buildSeedNlvPathologie };
const SEED_PROFILE = process.env.AUDIT_SEED || null;
if (SEED_PROFILE && !SEED_PROFILES[SEED_PROFILE]) {
  console.error(`✗ AUDIT_SEED inconnu : "${SEED_PROFILE}" (profils : ${Object.keys(SEED_PROFILES).join(', ')})`);
  process.exit(2);
}
// Port-tolérant : AUDIT_BASE_URL force une URL ; sinon on sonde 5173 puis 5174
// (Vite bascule sur 5174 quand 5173 est occupé) et on garde le premier joignable.
const BASE_CANDIDATES = process.env.AUDIT_BASE_URL
  ? [process.env.AUDIT_BASE_URL]
  : ['http://localhost:5173', 'http://localhost:5174'];

const stamp = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
})();
const OUT = path.join(
  ROOT,
  'docs',
  'captures',
  `audit-${stamp}${SEED_PROFILE ? `-${SEED_PROFILE}` : ''}`
);

// Le dataset de test (dates relatives) vit dans audit-seeds.mjs —
// buildSeed() par défaut, profils optionnels via AUDIT_SEED.

// ── Les 12 pages ───────────────────────────────────────────────────────────────
const PAGES = [
  ['01-dashboard', '/dashboard'],
  ['02-premarket', '/premarket'],
  ['03-positions', '/trading/positions'],
  ['04-history', '/trading/history'],
  ['05-greeks', '/trading/greeks'],
  ['06-chain', '/trading/chain'],
  ['07-analytics', '/insights/analytics'],
  ['08-calendar', '/insights/calendar'],
  ['09-journal', '/insights/journal'],
  ['10-settings-general', '/settings/general'],
  ['11-settings-import', '/settings/import'],
  ['12-settings-api', '/settings/api'],
];

async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function resolveBase() {
  for (const url of BASE_CANDIDATES) {
    if (await reachable(url)) return url;
  }
  return null;
}

async function main() {
  const BASE = await resolveBase();
  if (!BASE) {
    console.error(
      `✗ Dev server injoignable (sondé : ${BASE_CANDIDATES.join(', ')}). Lance d'abord \`npm run dev\`.`,
    );
    process.exit(2);
  }
  console.log(`  → dev server détecté sur ${BASE}`);
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1591, height: 900 },
    deviceScaleFactor: 1.35,
    colorScheme: 'dark',
  });
  const seed = SEED_PROFILE ? SEED_PROFILES[SEED_PROFILE]() : buildSeed();
  // Injecté AVANT tout script d'app, à chaque navigation same-origin.
  await context.addInitScript((entries) => {
    try {
      for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
    } catch { /* quota / indispo */ }
  }, seed);

  const page = await context.newPage();
  const results = [];

  for (const [name, route] of PAGES) {
    const url = `${BASE}${route}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    // Cas particulier : la chaîne d'options se peuple via un fetch Yahoo à la demande.
    if (route === '/trading/chain') {
      await page.fill('.chain-v5__input', 'AAPL').catch(() => {});
      await page.press('.chain-v5__input', 'Enter').catch(() => {});
      await page.waitForSelector('.options-chain__table', { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(1200); // laisse les greeks/graphes se stabiliser
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    // Contrôle « peuplé » : un compte de nœuds de données visibles.
    const dataNodes = await page
      .evaluate(() => document.querySelectorAll('tbody tr, [class*="kpi-value"], [class*="__row"], [class*="cell"]').length)
      .catch(() => 0);
    results.push({ name, dataNodes });
    console.log(`  ✓ ${name}  (${dataNodes} nœuds de données)`);
  }

  await browser.close();

  const thin = results.filter((r) => r.dataNodes < 3);
  console.log(`\n✓ audit:visual — ${results.length} captures @1591×900 dpr 1.35 → ${path.relative(ROOT, OUT)}/`);
  if (thin.length) {
    console.warn(`⚠ pages potentiellement peu peuplées : ${thin.map((t) => t.name).join(', ')}`);
  }
}

main().catch((e) => {
  console.error('✗ audit:visual a échoué :', e);
  process.exit(1);
});
