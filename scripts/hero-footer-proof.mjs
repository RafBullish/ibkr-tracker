#!/usr/bin/env node
/**
 * hero-footer-proof — harnais de preuve de la brique HERO-FOOTER (v1.0.1/3).
 *
 * Usage : node scripts/hero-footer-proof.mjs avant|apres
 *
 * Contexte Playwright ISOLÉ (profil éphémère — clés réelles JAMAIS
 * approchées), /dashboard dpr 1.35 midnight. Produit vers
 * docs/captures/hero-footer/ :
 *   <p>-h1-footer.png / -1920         pied Héros 1, seed par défaut
 *   <p>-h1-footer-patho.png / -1920   pied Héros 1, seed nlv-pathologie
 *                                     (100 trades / 213 j : prouve la
 *                                     mort des buckets — compteurs en
 *                                     JOURS/TRADES vrais)
 *   <p>-h2-footer.png                 pied Héros 2 @1591, seed défaut
 *   <p>-periodline-patho.png          ligne de période + note
 *                                     « historique reconstitué »
 *   <p>-h1-full.png                   Héros 1 entier (deck→graphe→pied)
 *
 * PRÉREQUIS : dev server — sonde 5173/5174, AUDIT_BASE_URL force.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, buildSeedNlvPathologie } from './audit-seeds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'captures', 'hero-footer');

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
  console.error('Usage : node scripts/hero-footer-proof.mjs avant|apres');
  process.exit(2);
}

async function openDashboard(browser, seed, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1.35,
    colorScheme: 'dark',
  });
  await context.addInitScript((entries) => {
    try {
      for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
    } catch { /* quota */ }
  }, seed);
  const page = await context.newPage();
  await page.goto(`${global.BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1600);
  return { context, page };
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
  global.BASE = await resolveBase();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // Seed PAR DÉFAUT — pied H1 @1591 + @1920, pied H2 @1591, H1 entier.
  for (const width of [1591, 1920]) {
    const { context, page } = await openDashboard(browser, buildSeed(), width);
    const tag = width === 1591 ? '' : '-1920';
    const hero1 = page.locator('section.lh-final').first();
    const hero2 = page.locator('section.lh-final').nth(1);
    await shotEl(hero1.locator('.lh-cfoot'), `${prefix}-h1-footer${tag}.png`);
    if (width === 1591) {
      await shotEl(hero2.locator('.lh-cfoot'), `${prefix}-h2-footer.png`);
      // Vue d'ensemble : pleine page (l'élément seul se fait recouvrir
      // par la tape/StatusBar sticky au stitching).
      await page.screenshot({ path: path.join(OUT, `${prefix}-h1-full.png`), fullPage: true });
      console.log(`  ✓ ${prefix}-h1-full.png`);
    }
    await context.close();
  }

  // Seed PATHOLOGIQUE — pied H1 @1591 + @1920 (mort des buckets) +
  // ligne de période avec note « historique reconstitué ».
  for (const width of [1591, 1920]) {
    const { context, page } = await openDashboard(browser, buildSeedNlvPathologie(), width);
    const tag = width === 1591 ? '' : '-1920';
    const hero1 = page.locator('section.lh-final').first();
    await shotEl(hero1.locator('.lh-cfoot'), `${prefix}-h1-footer-patho${tag}.png`);
    if (width === 1591) {
      await shotEl(hero1.locator('.lh-perf'), `${prefix}-periodline-patho.png`);
    }
    await context.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error('✗ hero-footer-proof :', e);
  process.exit(1);
});
