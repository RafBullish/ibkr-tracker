#!/usr/bin/env node
/**
 * polish-1-proof — harnais de preuve de la brique POLISH-1 (v1.0.1/2).
 *
 * Usage : node scripts/polish-1-proof.mjs avant|apres
 *
 * Contexte Playwright ISOLÉ (profil éphémère, seed par défaut de
 * l'audit — clés réelles JAMAIS approchées), /dashboard @1591×900
 * dpr 1.35 midnight. Produit vers docs/captures/polish-1/ :
 *   <prefix>-fx-banner.png   gros plan bannière FX (E1 — le seed sans
 *                            timestamp FX déclenche la variante critique)
 *   <prefix>-cheatsheet.png  modale ⌘/ ouverte (E7)
 *   <prefix>-hero-footer.png pied de stats du Héros 1 (E8)
 * et MESURE les scrollers du cheatsheet (E7) : scrollHeight vs
 * clientHeight de .modal-v3__body et .cheatsheet, @1591 ET @1920
 * (h=900) — la double scrollbar est prouvée par les chiffres.
 *
 * PRÉREQUIS : dev server (`npm run dev`) — sonde 5173 puis 5174,
 * AUDIT_BASE_URL force une URL.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './audit-seeds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'captures', 'polish-1');

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
  console.error('Usage : node scripts/polish-1-proof.mjs avant|apres');
  process.exit(2);
}

async function measureScrollers(page) {
  return page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrolls: el.scrollHeight > el.clientHeight,
        overflowY: cs.overflowY,
        maxHeight: cs.maxHeight,
      };
    };
    return { body: probe('.modal-v3__body'), cheatsheet: probe('.cheatsheet') };
  });
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
    // E1 déterministe : on coupe le proxy FX — sans taux frais ni
    // fxLastUpdated, la bannière « gravement obsolète » s'affiche à
    // coup sûr (sinon sa visibilité dépend de la latence réseau).
    await context.route('**/api/fx/**', (r) => r.abort());
    const page = await context.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const tag = width === 1591 ? '' : '-1920';

    // E1 — bannière FX (le seed n'a pas de timestamp FX → critique).
    const banner = page.locator('.fx-stale-banner').first();
    if (await banner.count()) {
      await banner.screenshot({ path: path.join(OUT, `${prefix}-fx-banner${tag}.png`) });
      console.log(`  ✓ ${prefix}-fx-banner${tag}.png`);
    } else {
      console.log(`  ⚠ @${width} bannière FX absente (inattendu avec le seed sans timestamp)`);
    }

    // E7 — cheatsheet ⌘/ : ouvrir, mesurer, capturer.
    await page.keyboard.press('Control+Slash');
    await page.waitForSelector('.cheatsheet', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const m = await measureScrollers(page);
    const fmt = (x) =>
      x
        ? `scrollH=${x.scrollHeight} clientH=${x.clientHeight} scroll=${x.scrolls ? 'OUI' : 'non'} (overflow-y:${x.overflowY}, max-h:${x.maxHeight})`
        : 'ABSENT';
    console.log(`  @${width} E7 body       : ${fmt(m.body)}`);
    console.log(`  @${width} E7 cheatsheet : ${fmt(m.cheatsheet)}`);
    const double = m.body?.scrolls && m.cheatsheet?.scrolls;
    console.log(`  @${width} E7 double scrollbar : ${double ? '✗ REPRODUITE' : 'non reproduite'}`);
    const modal = page.locator('.modal-v3__content');
    if (await modal.count()) {
      await modal.screenshot({ path: path.join(OUT, `${prefix}-cheatsheet${tag}.png`) });
      console.log(`  ✓ ${prefix}-cheatsheet${tag}.png`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // E8 — pied de stats du Héros 1 (libellés).
    const foot = page.locator('section.lh-final').first().locator('.lh-cfoot');
    if (await foot.count()) {
      await foot.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      await foot.screenshot({ path: path.join(OUT, `${prefix}-hero-footer${tag}.png`) });
      console.log(`  ✓ ${prefix}-hero-footer${tag}.png`);
    }

    await context.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error('✗ polish-1-proof :', e);
  process.exit(1);
});
