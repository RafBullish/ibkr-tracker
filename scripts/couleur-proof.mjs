#!/usr/bin/env node
/**
 * couleur-proof — harnais de preuve de la brique COULEUR (v1.0.1/4).
 *
 * Usage : node scripts/couleur-proof.mjs avant|apres
 *
 * Contexte Playwright ISOLÉ (seed par défaut — clés réelles JAMAIS
 * approchées), /dashboard @1591×900 dpr 1.35 midnight (+@1920 pour la
 * RiskMatrix). Produit vers docs/captures/couleur/ :
 *   <p>-riskmatrix.png / -1920   la RiskMatrix entière
 *   <p>-statusbar-real.png       zoom marqueur de mode REAL (StatusBar)
 *   <p>-h1-footer.png            zoom pied Héros 1 (DEPUIS PIC en après)
 *   <p>-h2-footer.png            pied Héros 2 (état constaté D4)
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './audit-seeds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'captures', 'couleur');

const BASE_CANDIDATES = process.env.AUDIT_BASE_URL
  ? [process.env.AUDIT_BASE_URL]
  : ['http://localhost:5173', 'http://localhost:5174'];

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

const prefix = process.argv[2];
if (prefix !== 'avant' && prefix !== 'apres') {
  console.error('Usage : node scripts/couleur-proof.mjs avant|apres');
  process.exit(2);
}

async function shotEl(locator, file) {
  try {
    await locator.scrollIntoViewIfNeeded();
    await new Promise((r) => setTimeout(r, 450));
    await locator.screenshot({ path: path.join(OUT, file) });
    console.log(`  ✓ ${file}`);
  } catch (e) {
    console.log(`  ⚠ ${file} — ${e.message.split('\n')[0]}`);
  }
}

async function main() {
  const BASE = await resolveBase();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const width of [1591, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1.35,
      colorScheme: 'dark',
    });
    await context.addInitScript((entries) => {
      try {
        for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
      } catch { /* quota */ }
    }, buildSeed());
    const page = await context.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1600);

    const tag = width === 1591 ? '' : '-1920';
    await shotEl(page.locator('section.risk-matrix'), `${prefix}-riskmatrix${tag}.png`);
    if (width === 1591) {
      await shotEl(page.locator('.statusbar__zone--left'), `${prefix}-statusbar-real.png`);
      const hero1 = page.locator('section.lh-final').first();
      const hero2 = page.locator('section.lh-final').nth(1);
      await shotEl(hero1.locator('.lh-cfoot'), `${prefix}-h1-footer.png`);
      await shotEl(hero2.locator('.lh-cfoot'), `${prefix}-h2-footer.png`);
    }
    await context.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error('✗ couleur-proof :', e);
  process.exit(1);
});
