// ═══════════════════════════════════════════════════════════════
//  Fast-follow 1/5 — resolveLiveAvailableUsd
//
//  Verrouille la doctrine d'HONNÊTETÉ : la VRAIE liquidité (Available
//  Funds IBKR du bridge) n'est retournée que si le snapshot est FRAIS et
//  la devise convertible en USD. Tout le reste → null (l'appelant retombe
//  sur l'estimation cash-A et garde le marqueur « est. »). Jamais un
//  chiffre fabriqué.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { resolveLiveAvailableUsd } from '../useAvailableCapital';
import { FRESHNESS } from '../../constants/timing';

const NOW = new Date('2026-07-20T12:00:00Z').getTime();
const MAX = FRESHNESS.LIVE_DATA_MAX_AGE_MS;
const iso = (ageMs) => new Date(NOW - ageMs).toISOString();

const live = (over = {}) => ({
  source: 'bridge',
  timestamp: iso(60_000), // 1 min → frais
  currency: 'USD',
  netLiquidation: 9750,
  totalCashValue: 3800,
  availableFunds: 3660,
  buyingPower: 14640,
  ...over,
});

describe('resolveLiveAvailableUsd', () => {
  it('snapshot USD frais → AvailableFunds direct', () => {
    expect(resolveLiveAvailableUsd(live(), 0.88, NOW)).toBe(3660);
  });

  it('snapshot CHF frais → converti en USD via liveRate', () => {
    const v = resolveLiveAvailableUsd(live({ currency: 'CHF', availableFunds: 3220 }), 0.88, NOW);
    expect(v).toBeCloseTo(3220 / 0.88, 6);
  });

  it('snapshot périmé (> seuil) → null', () => {
    expect(resolveLiveAvailableUsd(live({ timestamp: iso(MAX + 1000) }), 0.88, NOW)).toBeNull();
  });

  it('juste sous le seuil → réel ; pile au seuil → null', () => {
    expect(resolveLiveAvailableUsd(live({ timestamp: iso(MAX - 1000) }), 0.88, NOW)).toBe(3660);
    expect(resolveLiveAvailableUsd(live({ timestamp: iso(MAX) }), 0.88, NOW)).toBeNull();
  });

  it('timestamp dans le futur (âge négatif) → null (horloge incohérente)', () => {
    expect(resolveLiveAvailableUsd(live({ timestamp: iso(-60_000) }), 0.88, NOW)).toBeNull();
  });

  it('liveData absent / timestamp manquant → null', () => {
    expect(resolveLiveAvailableUsd(null, 0.88, NOW)).toBeNull();
    expect(resolveLiveAvailableUsd(undefined, 0.88, NOW)).toBeNull();
    expect(resolveLiveAvailableUsd(live({ timestamp: undefined }), 0.88, NOW)).toBeNull();
  });

  it('devise inattendue (EUR) → null (pas de conversion fiable)', () => {
    expect(resolveLiveAvailableUsd(live({ currency: 'EUR' }), 0.88, NOW)).toBeNull();
  });

  it('AvailableFunds non numérique / négatif / absent → null', () => {
    expect(resolveLiveAvailableUsd(live({ availableFunds: null }), 0.88, NOW)).toBeNull();
    expect(resolveLiveAvailableUsd(live({ availableFunds: '3660' }), 0.88, NOW)).toBeNull();
    expect(resolveLiveAvailableUsd(live({ availableFunds: -5 }), 0.88, NOW)).toBeNull();
    expect(resolveLiveAvailableUsd(live({ availableFunds: NaN }), 0.88, NOW)).toBeNull();
  });

  it('AvailableFunds = 0 (compte tout déployé) → 0 réel, PAS null', () => {
    expect(resolveLiveAvailableUsd(live({ availableFunds: 0 }), 0.88, NOW)).toBe(0);
  });

  it('CHF avec liveRate invalide (0 / NaN) → null', () => {
    expect(resolveLiveAvailableUsd(live({ currency: 'CHF' }), 0, NOW)).toBeNull();
    expect(resolveLiveAvailableUsd(live({ currency: 'CHF' }), NaN, NOW)).toBeNull();
  });
});
