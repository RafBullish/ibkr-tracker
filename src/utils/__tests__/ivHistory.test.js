// ═══════════════════════════════════════════════════════════════
//  ivHistory — collecte locale d'IV historique (U13-collecte)
//
//  Couvre le cœur de l'unité : accumulation datée, idempotence par
//  (ticker, date), rétention FIFO 400 j, écriture sûre. Env vitest = node,
//  donc on stub window.localStorage (in-memory).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appendIvHistory, readIvHistory } from '../ivHistory';

function makeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

// Horloge déterministe : ms UTC d'une date 'YYYY-MM-DD' à midi (évite tout
// décalage de fuseau quand todayIso relit les composants locaux).
function at(dateIso) {
  return new Date(dateIso + 'T12:00:00Z').getTime();
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: makeStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appendIvHistory', () => {
  it('écrit une entrée datée { date, iv } avec une vraie valeur', () => {
    appendIvHistory('AAPL', 0.273, at('2026-06-17'));
    const series = readIvHistory('AAPL');
    expect(series).toEqual([{ date: '2026-06-17', iv: 0.273 }]);
  });

  it('est idempotent par (ticker, date) : recharger le même jour met à jour, ne duplique pas', () => {
    appendIvHistory('AAPL', 0.273, at('2026-06-17'));
    appendIvHistory('AAPL', 0.301, at('2026-06-17'));
    appendIvHistory('AAPL', 0.288, at('2026-06-17'));
    const series = readIvHistory('AAPL');
    expect(series).toHaveLength(1);
    expect(series[0]).toEqual({ date: '2026-06-17', iv: 0.288 }); // dernière valeur du jour
  });

  it('accumule une entrée par jour distinct, triée par date asc', () => {
    appendIvHistory('SPY', 0.18, at('2026-06-15'));
    appendIvHistory('SPY', 0.21, at('2026-06-17'));
    appendIvHistory('SPY', 0.19, at('2026-06-16'));
    const series = readIvHistory('SPY');
    expect(series.map((e) => e.date)).toEqual(['2026-06-15', '2026-06-16', '2026-06-17']);
  });

  it('sépare les séries par ticker', () => {
    appendIvHistory('AAPL', 0.27, at('2026-06-17'));
    appendIvHistory('SPY', 0.18, at('2026-06-17'));
    expect(readIvHistory('AAPL')).toEqual([{ date: '2026-06-17', iv: 0.27 }]);
    expect(readIvHistory('SPY')).toEqual([{ date: '2026-06-17', iv: 0.18 }]);
  });

  it('applique la rétention FIFO à 400 jours (drop le plus ancien)', () => {
    // Pré-seed 400 entrées datées (2020-01-01 + i), déjà triées.
    const base = at('2020-01-01');
    const seed = Array.from({ length: 400 }, (_, i) => {
      const d = new Date(base + i * 86_400_000);
      const p = (n) => String(n).padStart(2, '0');
      return {
        date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
        iv: 0.2,
      };
    });
    window.localStorage.setItem('qc:ivHistory:NVDA', JSON.stringify(seed));
    const oldest = seed[0].date;

    // Une 401ᵉ journée (bien postérieure) → trim à 400, oldest dropped.
    const result = appendIvHistory('NVDA', 0.99, at('2026-06-17'));
    expect(result).toHaveLength(400);
    expect(result.find((e) => e.date === oldest)).toBeUndefined();
    expect(result[result.length - 1]).toEqual({ date: '2026-06-17', iv: 0.99 });
  });

  it('ignore une iv invalide (≤ 0 / NaN) sans rien écrire', () => {
    appendIvHistory('AAPL', 0, at('2026-06-17'));
    appendIvHistory('AAPL', -1, at('2026-06-17'));
    appendIvHistory('AAPL', NaN, at('2026-06-17'));
    expect(readIvHistory('AAPL')).toEqual([]);
  });

  it("n'écrase pas l'historique existant quand l'iv du jour est invalide", () => {
    appendIvHistory('AAPL', 0.25, at('2026-06-16'));
    appendIvHistory('AAPL', 0, at('2026-06-17')); // no-op
    expect(readIvHistory('AAPL')).toEqual([{ date: '2026-06-16', iv: 0.25 }]);
  });

  it('survit à une écriture localStorage en échec (quota) sans throw', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    });
    expect(() => appendIvHistory('AAPL', 0.27, at('2026-06-17'))).not.toThrow();
  });
});
