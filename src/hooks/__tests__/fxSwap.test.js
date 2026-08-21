// ═══════════════════════════════════════════════════════════════
//  Swap du producteur FX (Héros 1 LIVE, 3.2) — bornes du seuil 10 min :
//  une ligne fx_rates bridge < 10 min devient LE taux (useFxLiveSync) ;
//  ≥ 10 min → repli sur la quote actuelle. L'âge affiché est celui de
//  la LIGNE (captured_at), jamais l'heure du fetch — vérifié ici via le
//  contrat isBridgeFxFresh (le hook dispatch lastUpdated = capturedAt).
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { isBridgeFxFresh } from '../useFxLiveSync';
import { FX_AGE } from '../../constants/timing';

const NOW = Date.parse('2026-08-21T18:00:00Z');
const fxAt = (ageMs, mid = 0.8124) => ({
  pair: 'USD.CHF',
  mid,
  capturedAt: new Date(NOW - ageMs).toISOString(),
});

describe('isBridgeFxFresh — bornes 10 min', () => {
  it('ligne < 10 min → le bridge est LE producteur', () => {
    expect(isBridgeFxFresh(fxAt(0), NOW)).toBe(true);
    expect(isBridgeFxFresh(fxAt(FX_AGE.STALE_MS - 1), NOW)).toBe(true);
  });
  it('ligne ≥ 10 min → repli sur la quote actuelle', () => {
    expect(isBridgeFxFresh(fxAt(FX_AGE.STALE_MS), NOW)).toBe(false);
    expect(isBridgeFxFresh(fxAt(FX_AGE.STALE_MS + 60_000), NOW)).toBe(false);
  });
  it('mid invalide / absent / capturedAt illisible → jamais producteur', () => {
    expect(isBridgeFxFresh(null, NOW)).toBe(false);
    expect(isBridgeFxFresh({ mid: NaN, capturedAt: new Date(NOW).toISOString() }, NOW)).toBe(false);
    expect(isBridgeFxFresh({ mid: 0.81, capturedAt: 'pas-une-date' }, NOW)).toBe(false);
    expect(isBridgeFxFresh({ mid: 500, capturedAt: new Date(NOW).toISOString() }, NOW)).toBe(false); // hors garde A3a
  });
  it('capturedAt dans le futur (horloge dérivée) → refusé', () => {
    expect(isBridgeFxFresh(fxAt(-60_000), NOW)).toBe(false);
  });
});
