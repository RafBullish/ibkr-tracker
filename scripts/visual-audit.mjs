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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
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
const OUT = path.join(ROOT, 'docs', 'captures', `audit-${stamp}`);

// ── Dataset de test à dates relatives (populated seed) ─────────────────────────
function buildSeed() {
  const dayMs = 86400000;
  const now = Date.now();
  const iso = (off) => new Date(now + off * dayMs).toISOString().slice(0, 10);

  const positions = [
    { id: 'g1', as: 'Option', dir: 'Long', tk: 'AAPL', ty: 'CALL', st: '240', ex: iso(45), ct: '2', mu: '100', pi: '4.20', pc: '4.50', ivRank: 35 },
    { id: 'g2', as: 'Option', dir: 'Long', tk: 'MSFT', ty: 'CALL', st: '450', ex: iso(30), ct: '3', mu: '100', pi: '5.80', pc: '6.00', ivRank: 52 },
    { id: 'g3', as: 'Option', dir: 'Long', tk: 'NVDA', ty: 'CALL', st: '150', ex: iso(60), ct: '4', mu: '100', pi: '5.20', pc: '5.50', ivRank: 75 },
    { id: 'g4', as: 'Option', dir: 'Long', tk: 'CVX', ty: 'CALL', st: '165', ex: iso(45), ct: '1', mu: '100', pi: '3.30', pc: '3.50', ivRank: 22 },
    { id: 'g5', as: 'Option', dir: 'Long', tk: 'XOM', ty: 'CALL', st: '120', ex: iso(90), ct: '3', mu: '100', pi: '2.60', pc: '2.80', ivRank: 44 },
  ];
  const spots = { AAPL: 232, MSFT: 438, NVDA: 143, CVX: 160, XOM: 118 };
  const spotCache = {};
  for (const [tk, spot] of Object.entries(spots)) spotCache[tk] = { spot, timestamp: now };

  // Trades clôturés étalés (this-month pour Calendar/Analytics + historique).
  const closed = [
    { id: 'c1', tk: 'AAPL', as: 'Option', ty: 'CALL', dir: 'Long', pnl: 420, do: iso(-1), di: iso(-11), tag: 'Sniper OTM' },
    { id: 'c2', tk: 'MSFT', as: 'Option', ty: 'PUT', dir: 'Long', pnl: -180, do: iso(-1), di: iso(-9), tag: 'FOMO' },
    { id: 'c3', tk: 'NVDA', as: 'Option', ty: 'CALL', dir: 'Long', pnl: 650, do: iso(-2), di: iso(-13), tag: 'Sniper OTM' },
    { id: 'c4', tk: 'XOM', as: 'Option', ty: 'CALL', dir: 'Long', pnl: -310, do: iso(-3), di: iso(-8), tag: 'Event' },
    { id: 'c5', tk: 'CVX', as: 'Option', ty: 'PUT', dir: 'Short', pnl: 210, do: iso(-6), di: iso(-20), tag: 'Sniper OTM' },
    { id: 'c6', tk: 'TSLA', as: 'Stock', ty: null, dir: 'Long', pnl: -95, do: iso(-16), di: iso(-30), tag: 'Swing' },
    { id: 'c7', tk: 'AMD', as: 'Option', ty: 'CALL', dir: 'Long', pnl: 310, do: iso(-42), di: iso(-57), tag: 'Sniper OTM' },
    { id: 'c8', tk: 'GOOG', as: 'Option', ty: 'PUT', dir: 'Short', pnl: 540, do: iso(-82), di: iso(-96), tag: 'Swing' },
    { id: 'c9', tk: 'META', as: 'Option', ty: 'CALL', dir: 'Long', pnl: -220, do: iso(-115), di: iso(-130), tag: 'Event' },
    { id: 'c10', tk: 'SPY', as: 'Option', ty: 'PUT', dir: 'Long', pnl: 130, do: iso(-150), di: iso(-160), tag: 'Sniper OTM' },
  ];
  const journal = [
    { id: 'j1', date: iso(-1), ticker: 'AAPL', mood: 'confident', mistake: 'none', tag: 'Sniper OTM', note: 'Setup propre, patience sur l\'entree et respect du plan.', rating: 5 },
    { id: 'j2', date: iso(-1), ticker: 'MSFT', mood: 'frustrated', mistake: 'timing', tag: 'FOMO', note: 'Entre trop tot sur le pullback, mauvais timing.', rating: 2 },
    { id: 'j3', date: iso(-2), ticker: 'NVDA', mood: 'calm', mistake: 'none', tag: 'Suivi plan', note: 'Respect du plan, TP atteint sans stress.', rating: 4 },
    { id: 'j4', date: iso(-3), ticker: 'XOM', mood: 'revenge', mistake: 'revenge', tag: 'Revenge', note: 'Revenge trade apres la perte NVDA. Erreur de discipline.', rating: 1 },
    { id: 'j5', date: iso(-6), ticker: 'CVX', mood: 'focus', mistake: 'none', tag: 'Sniper OTM', note: 'Bon short premium, IV rank favorable.', rating: 4 },
  ];
  const cashFlows = [
    { id: 'f1', da: iso(-60), ty: 'dep_chf', a1: '5000', a2: '0' },
    { id: 'f2', da: iso(-20), ty: 'dep_chf', a1: '2000', a2: '0' },
  ];

  return {
    ibkr_u_o: JSON.stringify(positions),
    ibkr_u_c: JSON.stringify(closed),
    ibkr_u_j: JSON.stringify(journal),
    ibkr_u_f: JSON.stringify(cashFlows),
    ibkr_u_s: JSON.stringify({ r: 0.88, ic: 8000 }),
    ibkr_spot_cache_v1: JSON.stringify(spotCache),
    ibkr_schema_v: '7',
    ibkr_theme: 'midnight',
    chain_history: JSON.stringify(['AAPL']),
  };
}

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
  const seed = buildSeed();
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
