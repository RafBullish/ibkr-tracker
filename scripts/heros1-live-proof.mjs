#!/usr/bin/env node
/**
 * heros1-live-proof — harnais de preuve de la brique HÉROS 1 LIVE (V1.1
 * Phase B, brique 1). Produit les captures du GO visuel vers
 * docs/captures/heros1-live/ :
 *
 *   est-h1[-1591].png       état EST. (base seedée, AUCUN point bridge)
 *   live-h1[-1591].png      état LIVE — FIXTURE de lignes RÉELLES rejouées
 *                           (lues via la clé anonyme, décalées à maintenant ;
 *                           le bridge ne tournait pas pendant la brique)
 *   live-badge.png          gros plan badge LIVE + NLV tête de série
 *   trou-h1[-1591].png      un TROU visible (fixture réelle moins une
 *                           fenêtre de 20 min — le rendu whitespace)
 *   ferme-h1[-1591].png     état MARCHÉ FERMÉ (Date décalée au samedi,
 *                           fixture réelle rejouée sur la séance de vendredi)
 *   ferme-statusbar.png     pastille StatusBar « MARCHÉ FERMÉ · dernier tick »
 *   est-h2-title[-1591].png graphe du bas renommé « ÉQUITY EXÉCUTÉ »
 *   live-statusbar.png      pastille StatusBar en flux frais
 *
 * Contexte Playwright ISOLÉ (profil éphémère — clés réelles ibkr_u_* JAMAIS
 * approchées), routes Supabase INTERCEPTÉES (aucun POST, lecture fixture).
 * Bi-profil : cible 2560 (2844×1600) + plancher 1591×900 dpr 1.35.
 *
 * PRÉREQUIS : dev server (5173/5174) + .env.local (VITE_SUPABASE_*).
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './audit-seeds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'captures', 'heros1-live');

const BASE_CANDIDATES = process.env.AUDIT_BASE_URL
  ? [process.env.AUDIT_BASE_URL]
  : ['http://localhost:5173', 'http://localhost:5174'];

async function reachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok || res.status < 500;
  } catch { return false; }
}
async function resolveBase() {
  for (const url of BASE_CANDIDATES) if (await reachable(url)) return url;
  console.error('✗ Dev server injoignable. Lance `npm run dev`.');
  process.exit(2);
}

// ── .env.local : URL + clé anon (lecture seule, RLS) ────────────────
function readEnvLocal() {
  const txt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  const get = (k) => (txt.match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1]?.trim();
  const url = get('VITE_SUPABASE_URL');
  const key = get('VITE_SUPABASE_ANON_KEY');
  if (!url || !key) {
    console.error('✗ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absents de .env.local');
    process.exit(2);
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function fetchReal({ url, key }) {
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (q) => {
    const res = await fetch(`${url}/rest/v1/${q}`, { headers: h });
    if (!res.ok) throw new Error(`fixture: HTTP ${res.status} sur ${q}`);
    return res.json();
  };
  const nlv = await get('nlv_snapshots?select=captured_at,nlv,total_cash,settled_cash,currency&order=captured_at.asc&limit=1000');
  const fx = await get('fx_rates?select=captured_at,mid,pair&order=captured_at.asc&limit=1000');
  const acct = await get('account_state?select=*&order=captured_at.desc&limit=1');
  if (!nlv.length) { console.error('✗ nlv_snapshots vide — aucune ligne réelle à rejouer.'); process.exit(2); }
  return { nlv, fx, acct };
}

const shiftRows = (rows, deltaMs, col = 'captured_at') =>
  rows.map((r) => ({ ...r, [col]: new Date(Date.parse(r[col]) + deltaMs).toISOString() }));

// ── Mini-PostgREST : rejoue la fixture selon les query params ───────
function applyQuery(rows, params) {
  let out = rows.slice();
  for (const col of ['captured_at', 'mark_at']) {
    const f = params.get(col);
    if (!f) continue;
    const dot = f.indexOf('.');
    const op = f.slice(0, dot);
    const val = f.slice(dot + 1);
    out = out.filter((r) => {
      const v = r[col];
      if (op === 'gte') return v >= val;
      if (op === 'gt') return v > val;
      if (op === 'lt') return v < val;
      if (op === 'lte') return v <= val;
      return true;
    });
  }
  const order = params.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0));
    if (dir === 'desc') out.reverse();
  }
  const limit = Number(params.get('limit'));
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);
  return out;
}

async function openState(browser, { width, dpr, fixture, supaHost, dateOffsetMs = 0 }) {
  const context = await browser.newContext({
    viewport: { width, height: width >= 2000 ? 1600 : 900 },
    deviceScaleFactor: dpr,
    colorScheme: 'dark',
  });
  await context.addInitScript((entries) => {
    try { for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v); } catch { /* quota */ }
  }, buildSeed());
  if (dateOffsetMs) {
    // Décale l'horloge de la PAGE (état MARCHÉ FERMÉ un vendredi de séance) :
    // Date shimmée avant tout script app, timers réels intacts.
    await context.addInitScript((offset) => {
      const RealDate = Date;
      class ShiftedDate extends RealDate {
        constructor(...args) { if (args.length === 0) super(RealDate.now() + offset); else super(...args); }
        static now() { return RealDate.now() + offset; }
      }
      ShiftedDate.parse = RealDate.parse.bind(RealDate);
      ShiftedDate.UTC = RealDate.UTC.bind(RealDate);
      window.Date = ShiftedDate;
    }, dateOffsetMs);
  }
  await context.route(`**://${supaHost}/rest/v1/**`, async (route) => {
    const u = new URL(route.request().url());
    const table = u.pathname.split('/').pop();
    const rows = applyQuery(fixture[table] || [], u.searchParams);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().split('\n')[0]); });
  await page.goto(`${global.BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // Range 1D du Héros 1 (le premier .lh-final).
  const hero1 = page.locator('section.lh-final').first();
  await hero1.locator('.lh-range__btn', { hasText: /^1D$/ }).click().catch(() => {});
  // Écarter le pointeur : sinon le crosshair du chart laisse sa boîte
  // tooltip dans la capture (posé là par le clic sur « 1D »).
  await page.mouse.move(2, 2);
  await page.waitForTimeout(900);
  return { context, page, hero1, errors };
}

async function shotEl(locator, file) {
  try {
    await locator.scrollIntoViewIfNeeded();
    await new Promise((r) => setTimeout(r, 400));
    await locator.screenshot({ path: path.join(OUT, file) });
    console.log(`  ✓ ${file}`);
  } catch (e) {
    console.log(`  ⚠ ${file} — ${e.message.split('\n')[0]}`);
  }
}

const reportErrors = (state, errors) => {
  const kept = errors.filter((e) => !/finnhub|ERR_ABORTED|Failed to load resource/i.test(e));
  if (kept.length) console.log(`  ⚠ console ${state}: ${kept.join(' | ')}`);
  else console.log(`  ✓ console ${state}: propre (hors 500 finnhub tolérés)`);
};

async function main() {
  global.BASE = await resolveBase();
  fs.mkdirSync(OUT, { recursive: true });
  const env = readEnvLocal();
  const supaHost = new URL(env.url).host;
  console.log('· fixture : lignes réelles lues via la clé anonyme…');
  const real = await fetchReal(env);
  console.log(`  ${real.nlv.length} lignes nlv · ${real.fx.length} fx · dernier captured_at ${real.nlv[real.nlv.length - 1].captured_at}`);

  const lastRealMs = Date.parse(real.nlv[real.nlv.length - 1].captured_at);
  const browser = await chromium.launch({ headless: true });
  const profiles = [
    { width: 2844, dpr: 1, tag: '' },
    { width: 1591, dpr: 1.35, tag: '-1591' },
  ];

  for (const { width, dpr, tag } of profiles) {
    console.log(`— profil ${width}${tag ? ' (plancher)' : ' (cible 2560)'} —`);

    // 1 · EST. — aucun point bridge (fixture vide), base seedée.
    {
      const { context, page, hero1, errors } = await openState(browser, {
        width, dpr, supaHost, fixture: { nlv_snapshots: [], fx_rates: [], account_state: [], position_marks: [] },
      });
      await shotEl(hero1, `est-h1${tag}.png`);
      // 5 · graphe du bas renommé « ÉQUITY EXÉCUTÉ ».
      const hero2 = page.locator('section.lh-final').nth(1);
      await shotEl(hero2.locator('.lh-graphzone__bar'), `est-h2-title${tag}.png`);
      reportErrors(`est${tag}`, errors);
      await context.close();
    }

    // 2 · LIVE — lignes réelles rejouées, dernière à ~8 s (badge < 60 s).
    {
      const delta = Date.now() - 8_000 - lastRealMs;
      const fixture = {
        nlv_snapshots: shiftRows(real.nlv, delta),
        fx_rates: shiftRows(real.fx, delta),
        account_state: shiftRows(real.acct, delta),
        position_marks: [],
      };
      const { context, page, hero1, errors } = await openState(browser, { width, dpr, supaHost, fixture });
      await shotEl(hero1.locator('.lh-fuse__overlay'), `live-badge${tag}.png`);
      await shotEl(hero1, `live-h1${tag}.png`);
      await shotEl(page.locator('footer.statusbar'), `live-statusbar${tag}.png`);
      reportErrors(`live${tag}`, errors);
      await context.close();
    }

    // 3 · TROU — même fixture réelle, fenêtre de 20 min RETIRÉE au milieu
    //     (les lignes réelles du 18.08 n'ont pas de coupure ≥ 4 min : on en
    //     fabrique une, et on le dit) → rendu whitespace, jamais interpolé.
    {
      const delta = Date.now() - 8_000 - lastRealMs;
      const holeEnd = lastRealMs - 60 * 60_000;
      const holeStart = holeEnd - 20 * 60_000;
      const nlvHole = real.nlv.filter((r) => {
        const t = Date.parse(r.captured_at);
        return t < holeStart || t > holeEnd;
      });
      const fixture = {
        nlv_snapshots: shiftRows(nlvHole, delta),
        fx_rates: shiftRows(real.fx, delta),
        account_state: shiftRows(real.acct, delta),
        position_marks: [],
      };
      const { context, hero1, errors } = await openState(browser, { width, dpr, supaHost, fixture });
      await shotEl(hero1, `trou-h1${tag}.png`);
      await shotEl(hero1.locator('.lh-fuse__chart'), `trou-chart${tag}.png`);
      reportErrors(`trou${tag}`, errors);
      await context.close();
    }

    // 4 · MARCHÉ FERMÉ — Date de la page décalée au SAMEDI midi suivant la
    //     dernière séance de la fixture ; fixture réelle rejouée telle
    //     quelle sur son propre jour de séance (+N jours ronds → vendredi).
    {
      // Rejouer les lignes du mardi 18.08 sur le vendredi 21.08 (+3 jours
      // ronds : mêmes heures murales), puis « être » le samedi 22.08 12:00Z.
      const DAY = 86_400_000;
      const fixtureDelta = 3 * DAY;
      const shiftedLast = lastRealMs + fixtureDelta;
      const saturdayNoon = (() => {
        const d = new Date(shiftedLast);
        // le lendemain du jour de séance rejoué, 12:00Z
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 12, 0, 0);
      })();
      const dateOffsetMs = saturdayNoon - Date.now();
      const fixture = {
        nlv_snapshots: shiftRows(real.nlv, fixtureDelta),
        fx_rates: shiftRows(real.fx, fixtureDelta),
        account_state: shiftRows(real.acct, fixtureDelta),
        position_marks: [],
      };
      const { context, page, hero1, errors } = await openState(browser, { width, dpr, supaHost, fixture, dateOffsetMs });
      await shotEl(hero1, `ferme-h1${tag}.png`);
      await shotEl(hero1.locator('.lh-fuse__overlay'), `ferme-badge${tag}.png`);
      await shotEl(page.locator('footer.statusbar'), `ferme-statusbar${tag}.png`);
      reportErrors(`ferme${tag}`, errors);
      await context.close();
    }
  }

  await browser.close();
  console.log(`\n✓ captures → ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error('✗ heros1-live-proof :', e); process.exit(1); });
