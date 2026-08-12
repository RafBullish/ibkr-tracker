#!/usr/bin/env node
/**
 * fix-nlv-proof — harnais de preuve de la brique FIX-NLV (v1.0.1/1).
 *
 * Deux modes, contexte Playwright ISOLÉ (profil éphémère en mémoire,
 * même doctrine que visual-audit.mjs — clés réelles JAMAIS approchées) :
 *
 *   node scripts/fix-nlv-proof.mjs captures avant   (ou apres)
 *     → seed `nlv-pathologie`, /dashboard @1591×900 dpr 1.35 midnight,
 *       captures du bloc Héros 1 : ALL · 3M · 5D · 1D · DRAWDOWN(ALL) ·
 *       crosshair (+ page entière), vers docs/captures/fix-nlv/<prefix>-*.png.
 *       La console du navigateur est rejouée sur stdout.
 *
 *   node scripts/fix-nlv-proof.mjs checks
 *     → seed par défaut, les 12 pages @1591 ET @1920 : overflow horizontal
 *       (scrollWidth − clientWidth) + erreurs console (bruit toléré filtré :
 *       finnhub 500/502, 429 du proxy quotes, warnings Recharts width/height).
 *
 * PRÉREQUIS : dev server (`npm run dev`) — sonde 5173 puis 5174,
 * AUDIT_BASE_URL force une URL.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, buildSeedNlvPathologie } from './audit-seeds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'captures', 'fix-nlv');

const BASE_CANDIDATES = process.env.AUDIT_BASE_URL
  ? [process.env.AUDIT_BASE_URL]
  : ['http://localhost:5173', 'http://localhost:5174'];

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

// Bruit console toléré (CLAUDE.md §7) — tout le reste est rapporté.
const TOLERATED = [
  /finnhub.*(500|502)/i,
  /(500|502).*finnhub/i,
  /Failed to load resource.*(500|502|429)/i,
  /429/,
  /width\(-?\d+\).*height\(-?\d+\)|width.*-1.*height.*-1/i,
  /AbortError/i,
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
  for (const url of BASE_CANDIDATES) if (await reachable(url)) return url;
  console.error(`✗ Dev server injoignable (${BASE_CANDIDATES.join(', ')}). Lance \`npm run dev\`.`);
  process.exit(2);
}

async function newSeededContext(browser, seed) {
  const context = await browser.newContext({
    viewport: { width: 1591, height: 900 },
    deviceScaleFactor: 1.35,
    colorScheme: 'dark',
  });
  await context.addInitScript((entries) => {
    try {
      for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
    } catch { /* quota / indispo */ }
  }, seed);
  return context;
}

function attachConsole(page, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      sink.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => sink.push(`[pageerror] ${err.message}`));
}

async function runCaptures(prefix) {
  const BASE = await resolveBase();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await newSeededContext(browser, buildSeedNlvPathologie());
  const page = await context.newPage();
  const logs = [];
  attachConsole(page, logs);

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1600);

  const hero = page.locator('section.lh-final');
  const shot = async (name) => {
    await page.waitForTimeout(750); // laisse le canvas se redessiner
    await hero.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) });
    console.log(`  ✓ ${prefix}-${name}.png`);
  };
  const clickRange = (tf) => page.click(`.lh-range__btn:text-is("${tf}")`).catch(() => {});
  const clickView = (lbl) => page.click(`.lh-toggle__btn:text-is("${lbl}")`).catch(() => {});

  await shot('all'); // range par défaut = ALL, vue NLV
  await clickRange('3M');
  await shot('3m');
  await clickRange('5D');
  await shot('5d');
  await clickRange('1D');
  await shot('1d');
  await clickRange('ALL');
  await clickView('DRAWDOWN');
  await shot('drawdown-all');
  await clickView('NLV');
  // Crosshair : survol au centre du canvas.
  const box = await page.locator('.lh-tv__canvas').boundingBox();
  if (box) await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await shot('crosshair');
  await page.screenshot({ path: path.join(OUT, `${prefix}-dashboard-full.png`), fullPage: true });
  console.log(`  ✓ ${prefix}-dashboard-full.png`);

  await browser.close();
  const noise = logs.filter((l) => !TOLERATED.some((re) => re.test(l)));
  console.log(`\nConsole /dashboard (${logs.length} entrées, ${noise.length} HORS bruit toléré) :`);
  for (const l of noise) console.log(`  ⚠ ${l}`);
  if (!noise.length) console.log('  (rien hors bruit toléré)');
}

async function runChecks() {
  const BASE = await resolveBase();
  const browser = await chromium.launch({ headless: true });
  let overflowCount = 0;
  const noise = [];
  for (const width of [1591, 1920]) {
    const context = await newSeededContext(browser, buildSeed());
    await context.pages(); // no-op
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    const logs = [];
    attachConsole(page, logs);
    for (const [name, route] of PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(900);
      const overflow = await page
        .evaluate(() => {
          const d = document.documentElement;
          return d.scrollWidth - d.clientWidth;
        })
        .catch(() => null);
      const flag = overflow > 0 ? `✗ OVERFLOW +${overflow}px` : '✓ 0 overflow';
      if (overflow > 0) overflowCount++;
      console.log(`  @${width} ${name.padEnd(20)} ${flag}`);
    }
    noise.push(...logs.filter((l) => !TOLERATED.some((re) => re.test(l))).map((l) => `@${width} ${l}`));
    await context.close();
  }
  await browser.close();
  console.log(`\nRésumé : ${overflowCount} page(s) en overflow · ${noise.length} entrée(s) console HORS bruit toléré`);
  for (const l of noise) console.log(`  ⚠ ${l}`);
  process.exitCode = overflowCount > 0 ? 1 : 0;
}

const [mode, prefix] = process.argv.slice(2);
if (mode === 'captures' && (prefix === 'avant' || prefix === 'apres')) {
  runCaptures(prefix).catch((e) => {
    console.error('✗ captures :', e);
    process.exit(1);
  });
} else if (mode === 'checks') {
  runChecks().catch((e) => {
    console.error('✗ checks :', e);
    process.exit(1);
  });
} else {
  console.error('Usage : node scripts/fix-nlv-proof.mjs captures avant|apres · node scripts/fix-nlv-proof.mjs checks');
  process.exit(2);
}
