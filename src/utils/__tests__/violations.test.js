// ═══════════════════════════════════════════════════════════════
//  MARQUAGE DES ÉCARTS DE DOCTRINE — Brique Q-B.
//
//  Verrouille : les 7 règles tirent leurs seuils du REGISTRE (source
//  unique), le DELTA ne produit JAMAIS de violation (indicatif), une
//  entrée absente donne « indéterminé » (ni faute, ni conforme, jamais
//  un faux zéro), et le moteur ne bloque / ne throw jamais.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  evaluatePositionViolations,
  violationsOnly,
  ticketUsd,
  V_STATUS,
} from '../violations';
import {
  SIZING,
  THETA_MAX_PCT_PRIME_JOUR,
  SPREAD_MAX_PCT_MID,
} from '../../config/registre';

function codes(list) {
  return list.map((d) => d.code);
}
function byCode(list, code) {
  return list.find((d) => d.code === code) || null;
}

const OPT = { as: 'Option', dir: 'Long', tk: 'AAPL', ty: 'CALL', st: '200', ex: '2026-12-18', mu: '100' };

describe('violations — S3 ticket minimum (seuil du registre)', () => {
  it('ticket exactement au plancher = CONFORME (pas de S3)', () => {
    // ticket = pi × mu × ct, base sur SIZING.S3_ticket_min_usd
    const pos = { as: 'Action', tk: 'AAPL', mu: '1', ct: '1', pi: String(SIZING.S3_ticket_min_usd) };
    const out = evaluatePositionViolations(pos, {});
    expect(byCode(out, 'S3')).toBeNull();
  });
  it('ticket sous le plancher = VIOLATION ambre', () => {
    const pos = { as: 'Action', tk: 'AAPL', mu: '1', ct: '1', pi: String(SIZING.S3_ticket_min_usd - 1) };
    const s3 = byCode(evaluatePositionViolations(pos, {}), 'S3');
    expect(s3).not.toBeNull();
    expect(s3.status).toBe(V_STATUS.VIOLATION);
    expect(s3.source).toBe('sizing.S3_ticket_min_usd');
  });
  it('ticketUsd = |pi × mu × ct|', () => {
    expect(ticketUsd({ pi: '5', mu: '100', ct: '2' })).toBe(1000);
  });
});

describe('violations — S1 taille vs capital', () => {
  it('> 60 % du capital = VIOLATION', () => {
    const ticket = 700; // pi 7 × mu 100 × ct 1
    const pos = { ...OPT, ct: '1', pi: '7' };
    const s1 = byCode(evaluatePositionViolations(pos, { capitalUsd: 1000 }), 'S1');
    expect(s1.status).toBe(V_STATUS.VIOLATION);
    expect(ticket / 1000).toBeGreaterThan(SIZING.S1_pct_max_par_position);
  });
  it('sous le cap = conforme (pas de S1)', () => {
    const pos = { ...OPT, ct: '1', pi: '5' }; // 500 / 1000 = 0.5 < 0.6
    expect(byCode(evaluatePositionViolations(pos, { capitalUsd: 1000 }), 'S1')).toBeNull();
  });
  it('capital non résolu = INDÉTERMINÉ (jamais un faux 0)', () => {
    const pos = { ...OPT, ct: '1', pi: '7' };
    const s1 = byCode(evaluatePositionViolations(pos, { capitalUsd: null }), 'S1');
    expect(s1.status).toBe(V_STATUS.INDETERMINE);
    expect(s1.measurable).toBe(false);
  });
});

describe('violations — S5 entrées du jour / S6 sous-jacent', () => {
  it('2 entrées le même jour = VIOLATION S5', () => {
    const a = { ...OPT, id: 'a', ct: '1', pi: '3', di: '2026-08-16' };
    const b = { ...OPT, id: 'b', st: '210', ct: '1', pi: '3', di: '2026-08-16' };
    const s5 = byCode(evaluatePositionViolations(a, { book: [a, b] }), 'S5');
    expect(s5.status).toBe(V_STATUS.VIOLATION);
  });
  it('date d’entrée absente = S5 INDÉTERMINÉ', () => {
    const a = { ...OPT, id: 'a', ct: '1', pi: '3' };
    const s5 = byCode(evaluatePositionViolations(a, { book: [a] }), 'S5');
    expect(s5.measurable).toBe(false);
  });
  it('2 positions même sous-jacent = VIOLATION S6', () => {
    const a = { ...OPT, id: 'a', ct: '1', pi: '3' };
    const b = { ...OPT, id: 'b', st: '210', ct: '1', pi: '3' };
    const s6 = byCode(evaluatePositionViolations(a, { book: [a, b] }), 'S6');
    expect(s6.status).toBe(V_STATUS.VIOLATION);
    expect(s6.source).toBe('sizing.S6_max_par_sous_jacent');
  });
  it('position MOYENNÉE (lots > 1) = VIOLATION S6 même seule', () => {
    const a = { ...OPT, id: 'a', ct: '2', pi: '3', lots: [{ ct: '1' }, { ct: '1' }] };
    const s6 = byCode(evaluatePositionViolations(a, {}), 'S6');
    expect(s6.status).toBe(V_STATUS.VIOLATION);
    expect(s6.averaged).toBe(true);
  });
});

describe('violations — DELTA jamais jugé (indicatif)', () => {
  it('aucune règle E3 / delta n’est émise', () => {
    const pos = { ...OPT, ct: '1', pi: '5', deltaAtEntry: 0.9 };
    const out = evaluatePositionViolations(pos, { capitalUsd: 100000, book: [pos] });
    expect(codes(out)).not.toContain('E3');
    expect(out.every((d) => d.code !== 'E3')).toBe(true);
  });
});

describe('violations — E2/E4/E5 honnêtes quand l’entrée manque', () => {
  const pos = { ...OPT, id: 'x', ct: '1', pi: '5' };
  it('E2 θ d’entrée non capturé = INDÉTERMINÉ', () => {
    const e2 = byCode(evaluatePositionViolations(pos, {}), 'E2');
    expect(e2.measurable).toBe(false);
    expect(e2.source).toBe('entree.E2_theta_max_pct_prime_jour');
  });
  it('E2 mesuré : θ/mid au-dessus du seuil du registre = VIOLATION', () => {
    // θ absolu/jour = 0.06 ; mid d'entrée capturé = 5 → 0.012 > seuil (0.008)
    const e2 = byCode(
      evaluatePositionViolations({ ...pos, midAtEntry: 5 }, { thetaAtEntryPerDay: 0.06 }),
      'E2'
    );
    expect(e2.status).toBe(V_STATUS.VIOLATION);
    expect(0.06 / 5).toBeGreaterThan(THETA_MAX_PCT_PRIME_JOUR);
  });
  it('E2 θ capturé mais mid absent = INDÉTERMINÉ (aucun repli sur pi)', () => {
    // pi=5 existe, mais le mid d'entrée n'est pas capturé → base non exacte → indéterminé.
    const e2 = byCode(evaluatePositionViolations(pos, { thetaAtEntryPerDay: 0.06 }), 'E2');
    expect(e2.measurable).toBe(false);
  });
  it('E4 spread non capturé = INDÉTERMINÉ ; spread large = VIOLATION', () => {
    expect(byCode(evaluatePositionViolations(pos, {}), 'E4').measurable).toBe(false);
    const wide = { ...pos, bidAtEntry: '4', askAtEntry: '6' }; // spread 2 / mid 5 = 0.40
    const e4 = byCode(evaluatePositionViolations(wide, {}), 'E4');
    expect(e4.status).toBe(V_STATUS.VIOLATION);
    expect(2 / 5).toBeGreaterThan(SPREAD_MAX_PCT_MID);
  });
  it('E5 sans horodatage = INDÉTERMINÉ ; hors fenêtre Zurich = VIOLATION', () => {
    expect(byCode(evaluatePositionViolations(pos, {}), 'E5').measurable).toBe(false);
    // 08:00 UTC = 10:00 Europe/Zurich (CEST) → avant 15:45 → violation
    const early = { ...pos, entryTs: '2026-08-16T08:00:00Z' };
    const e5 = byCode(evaluatePositionViolations(early, {}), 'E5');
    expect(e5.status).toBe(V_STATUS.VIOLATION);
    // 14:00 UTC = 16:00 Zurich → dans la fenêtre → conforme (pas d’E5)
    const inWindow = { ...pos, entryTs: '2026-08-16T14:00:00Z' };
    expect(byCode(evaluatePositionViolations(inWindow, {}), 'E5')).toBeNull();
  });
});

describe('violations — CAPTURE À L’ENTRÉE (E2/E4 sur valeurs d’entrée)', () => {
  const base = { ...OPT, id: 'c', ct: '1', pi: '10' };

  it('E2 utilise le MID CAPTURÉ comme dénominateur, JAMAIS pi', () => {
    // midAtEntry=5 → 0.06/5 = 0.012 > seuil. pi=10 n'entre PAS dans le calcul.
    const pos = { ...base, midAtEntry: 5 };
    const e2 = byCode(evaluatePositionViolations(pos, { thetaAtEntryPerDay: 0.06 }), 'E2');
    expect(e2.status).toBe(V_STATUS.VIOLATION);
  });

  it('E2 conforme sous le seuil → absent (pas de violation)', () => {
    const pos = { ...base, midAtEntry: 5 };
    expect(byCode(evaluatePositionViolations(pos, { thetaAtEntryPerDay: 0.02 }), 'E2')).toBeNull();
  });

  // ── Matrice de capture partielle : E2 exige θ ET mid (base exacte à la frontière) ──
  it('E2 exige θ ET mid : θ+mid présents → E2 déterminable, E4 sans bid/ask → INDÉTERMINÉ', () => {
    const out = evaluatePositionViolations({ ...base, midAtEntry: 5 }, { thetaAtEntryPerDay: 0.02 });
    expect(byCode(out, 'E2')).toBeNull(); // déterminé (conforme)
    expect(byCode(out, 'E4').measurable).toBe(false); // indéterminé (bid/ask absents)
  });

  it('E2 exige θ ET mid : θ sans mid → INDÉTERMINÉ (aucun repli sur pi)', () => {
    const e2 = byCode(evaluatePositionViolations(base, { thetaAtEntryPerDay: 0.02 }), 'E2');
    expect(e2.measurable).toBe(false);
  });

  it('E2 exige θ ET mid : mid sans θ → INDÉTERMINÉ', () => {
    const e2 = byCode(evaluatePositionViolations({ ...base, midAtEntry: 5 }, {}), 'E2');
    expect(e2.measurable).toBe(false);
  });

  it('capture PARTIELLE bid/ask seuls : E4 déterminable, E2 reste INDÉTERMINÉ', () => {
    const pos = { ...base, bidAtEntry: '4.9', askAtEntry: '5.1' }; // spread 0.2 / mid 5 = 0.04
    const out = evaluatePositionViolations(pos, {}); // ni θ ni mid
    expect(byCode(out, 'E4')).toBeNull(); // déterminé (conforme)
    expect(byCode(out, 'E2').measurable).toBe(false); // indéterminé (θ + mid absents)
  });

  it('δ capturé n’affecte JAMAIS le verdict (indicatif)', () => {
    const out = evaluatePositionViolations({ ...base, deltaAtEntry: 0.9 }, {});
    expect(byCode(out, 'E2').measurable).toBe(false);
    expect(byCode(out, 'E4').measurable).toBe(false);
  });

  it('aucune capture → E2 ET E4 indéterminées (jamais présumées conformes)', () => {
    const out = evaluatePositionViolations(base, {});
    expect(byCode(out, 'E2').measurable).toBe(false);
    expect(byCode(out, 'E4').measurable).toBe(false);
  });
});

describe('violations — robustesse', () => {
  it('pos null → [] (ne throw jamais)', () => {
    expect(evaluatePositionViolations(null)).toEqual([]);
  });
  it('violationsOnly ne garde que les violations ambre', () => {
    const pos = { ...OPT, id: 'x', ct: '1', pi: '5' }; // E2/E4/E5 indéterminés
    const all = evaluatePositionViolations(pos, {});
    const only = violationsOnly(all);
    expect(only.every((d) => d.status === V_STATUS.VIOLATION)).toBe(true);
  });
});
