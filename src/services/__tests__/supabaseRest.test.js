// ═══════════════════════════════════════════════════════════════
//  fetchAllSince — lecture paginée ASC par curseur (Héros 1 LIVE).
//  Une séance RTH (~1 100+ lignes à 20 s) dépasse le plafond PostgREST
//  (~1 000) : l'amorce doit avancer par pages sans rien perdre.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

let fetchAllSince;

const iso = (i) => new Date(Date.parse('2026-08-21T13:30:00Z') + i * 20_000).toISOString();

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-probe.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test');
  vi.resetModules();
  ({ fetchAllSince } = await import('../supabaseRest'));
});

afterAll(() => {
  vi.unstubAllEnvs();
  delete global.fetch;
});

describe('fetchAllSince', () => {
  it('pagine par curseur : 2 pages pleines + 1 incomplète, ordre conservé', async () => {
    const N = 7;
    const all = Array.from({ length: N }, (_, i) => ({ captured_at: iso(i), nlv: 10 + i }));
    global.fetch = vi.fn(async (url) => {
      const u = new URL(String(url));
      const filter = u.searchParams.get('captured_at') || '';
      const [op, ...rest] = filter.split('.');
      const cursor = rest.join('.');
      const limit = Number(u.searchParams.get('limit'));
      const page = all
        .filter((r) => (op === 'gte' ? r.captured_at >= cursor : r.captured_at > cursor))
        .slice(0, limit);
      return { ok: true, status: 200, json: async () => page };
    });
    const rows = await fetchAllSince('nlv_snapshots', {
      select: 'captured_at,nlv', sinceIso: iso(0), inclusive: true, pageSize: 3,
    });
    expect(rows).toHaveLength(N);
    expect(rows.map((r) => r.nlv)).toEqual([10, 11, 12, 13, 14, 15, 16]);
    expect(global.fetch).toHaveBeenCalledTimes(3); // 3 + 3 + 1
  });

  it('incrémental (inclusive=false) : ne rend que le strictement plus récent', async () => {
    const all = [
      { captured_at: iso(0), nlv: 10 },
      { captured_at: iso(1), nlv: 11 },
    ];
    global.fetch = vi.fn(async (url) => {
      const u = new URL(String(url));
      const [op, ...rest] = (u.searchParams.get('captured_at') || '').split('.');
      const cursor = rest.join('.');
      const page = all.filter((r) => (op === 'gte' ? r.captured_at >= cursor : r.captured_at > cursor));
      return { ok: true, status: 200, json: async () => page };
    });
    const rows = await fetchAllSince('nlv_snapshots', { sinceIso: iso(0) });
    expect(rows).toHaveLength(1);
    expect(rows[0].nlv).toBe(11);
  });
});
