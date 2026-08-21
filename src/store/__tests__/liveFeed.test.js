// ═══════════════════════════════════════════════════════════════
//  NON-RÉGRESSION 5caf2ab (addendum architecte 21.08) — la boucle
//  infinie de la StatusBar venait d'un sélecteur qui fabriquait un objet
//  NEUF à chaque getSnapshot (useLiveFreshness) : useSyncExternalStore
//  (Zustand v5) exige que deux getSnapshot consécutifs sans mutation
//  soient égaux par Object.is — sinon re-render forcé → « Maximum update
//  depth exceeded ». Le chemin ne s'exécutait JAMAIS tant que les
//  VITE_SUPABASE_* étaient absentes : la suite ne pouvait pas l'attraper.
//
//  Ce test EXERCE le chemin live (fetch mocké rendant des lignes
//  nlv_snapshots réalistes → fetchLatest RÉEL → transforms réels →
//  setFeed) puis prouve l'invariant de stabilité référentielle sur
//  chaque sélecteur du store — précisément ce que React vérifie.
//  (Suite node sans DOM — loi zéro dépendance : pas de render React ;
//  l'invariant testé est la cause NÉCESSAIRE ET SUFFISANTE de la boucle.)
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

let fetchLatest;
let liveFeedMod;
let transforms;

const NLV_ROWS = [
  { captured_at: '2026-08-18T19:18:32.646986+00:00', nlv: 10.01, total_cash: 10.01, settled_cash: 10.01, currency: 'CHF' },
  { captured_at: '2026-08-18T19:18:53.100000+00:00', nlv: 10.02, total_cash: 10.02, settled_cash: 10.02, currency: 'CHF' },
];
const FX_ROWS = [{ mid: 0.81238, captured_at: '2026-08-18T19:18:32.962770+00:00' }];
const MARK_ROWS = [{ signature: 'NVDA|Option|Long|CALL|500|2026-01-16', mid: 6.4, mark_at: '2026-08-18T19:18:33+00:00', source: 'pnlSingle' }];

beforeAll(async () => {
  // Le chemin live n'existe que configuré : on stubbe l'env AVANT l'import
  // (les modules lisent import.meta.env au chargement).
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-probe.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test');
  vi.resetModules();

  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    const rows = u.includes('nlv_snapshots') ? NLV_ROWS
      : u.includes('fx_rates') ? FX_ROWS
        : u.includes('position_marks') ? MARK_ROWS
          : [];
    return { ok: true, status: 200, json: async () => rows };
  });

  ({ fetchLatest } = await import('../../services/supabaseRest'));
  liveFeedMod = await import('../liveFeed');
  transforms = await import('../../hooks/useSupabaseLive');
});

afterAll(() => {
  vi.unstubAllEnvs();
  delete global.fetch;
});

// Tous les sélecteurs publics du store — le contrat vaut pour CHACUN.
const selectors = () => ({
  nlvSeries: (s) => s.nlvSeries,
  fxSeries: (s) => s.fxSeries,
  marks: (s) => s.marks,
  fx: (s) => s.fx,
  lastCapturedAt: liveFeedMod.freshnessSelectors.lastCapturedAt,
  ok: liveFeedMod.freshnessSelectors.ok,
});

async function pollOnceLikeTheHook() {
  // Le MÊME assemblage que useSupabaseLive.poll (fetch réel mocké →
  // transforms réels → setFeed) — le chemin qui bouclait avant 5caf2ab.
  const [nlvRows, fxRows, markRows] = await Promise.all([
    fetchLatest('nlv_snapshots', { order: 'captured_at.desc', limit: 180 }),
    fetchLatest('fx_rates', { filters: { pair: 'eq.USD.CHF' }, order: 'captured_at.desc', limit: 1 }),
    fetchLatest('position_marks', { order: 'mark_at.desc', limit: 500 }),
  ]);
  const nlvSeries = transforms.toSeries(nlvRows);
  const fxSeries = transforms.toFxSeries(fxRows);
  const lastFx = fxSeries[fxSeries.length - 1] || null;
  liveFeedMod.useLiveFeed.getState().setFeed({
    nlvSeries,
    fxSeries,
    marks: transforms.toMarks(markRows),
    fx: lastFx ? { pair: 'USD.CHF', mid: lastFx.mid, capturedAt: new Date(lastFx.t).toISOString() } : null,
    lastCapturedAt: nlvSeries.length ? nlvSeries[nlvSeries.length - 1].t : null,
    ok: true,
  });
}

describe('non-régression 5caf2ab — stabilité référentielle des sélecteurs', () => {
  it('le chemin live (fetch mocké) alimente le store', async () => {
    await pollOnceLikeTheHook();
    const s = liveFeedMod.useLiveFeed.getState();
    expect(s.nlvSeries).toHaveLength(2);
    expect(s.ok).toBe(true);
    expect(s.lastCapturedAt).toBe(new Date(NLV_ROWS[1].captured_at).getTime());
    expect(global.fetch).toHaveBeenCalled();
  });

  it('CHAQUE sélecteur est stable par Object.is entre deux getSnapshot sans mutation', async () => {
    await pollOnceLikeTheHook();
    const api = liveFeedMod.useLiveFeed;
    for (const [name, sel] of Object.entries(selectors())) {
      const a = sel(api.getState());
      const b = sel(api.getState());
      expect(Object.is(a, b), `sélecteur instable : ${name}`).toBe(true);
    }
  });

  it('deux sondages identiques ne déclenchent pas de cascade (1 notification par setFeed)', async () => {
    const api = liveFeedMod.useLiveFeed;
    let notifications = 0;
    const unsub = api.subscribe(() => { notifications += 1; });
    await pollOnceLikeTheHook();
    await pollOnceLikeTheHook();
    unsub();
    expect(notifications).toBe(2); // une par setFeed — jamais une boucle
    // Et après chaque notification, l'invariant tient toujours :
    for (const sel of Object.values(selectors())) {
      expect(Object.is(sel(api.getState()), sel(api.getState()))).toBe(true);
    }
  });

  it("preuve que le test discrimine : le sélecteur d'AVANT 5caf2ab viole l'invariant", () => {
    const api = liveFeedMod.useLiveFeed;
    // L'ancien useLiveFreshness : un objet neuf par appel → Object.is faux
    // → c'est EXACTEMENT ce qui faisait boucler useSyncExternalStore.
    const oldSelector = (s) => ({ lastCapturedAt: s.lastCapturedAt, ok: s.ok });
    expect(Object.is(oldSelector(api.getState()), oldSelector(api.getState()))).toBe(false);
  });
});
