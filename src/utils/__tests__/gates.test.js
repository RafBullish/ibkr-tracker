// ═══════════════════════════════════════════════════════════════
//  LES 5 PORTES — moteur unique (Brique Q-C). Tests aux BORNES EXACTES.
//  Tous les seuils viennent du registre ; ce test verrouille le
//  comportement de frontière de chaque porte.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { evaluateGates, bandSignals, GATE_SEV, gateDistances, nearestPorte } from '../gates';

function byCode(row, ctx, code) {
  return evaluateGates(row, ctx).find((d) => d.code === code) || null;
}

// Ajoute k jours de bourse (lun–ven) à une date ISO — pour placer les
// bornes exactes de la fenêtre P4 sans dépendre du jour de la semaine.
function addTradingDays(fromISO, k) {
  const cur = new Date(`${fromISO}T12:00:00`);
  let n = 0;
  while (n < k) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d >= 1 && d <= 5) n += 1;
  }
  return cur.toISOString().slice(0, 10);
}

describe('P1 — SL deux paliers (−30 ambre / −35 rouge)', () => {
  it('−29,9 % → aucun signal', () => {
    expect(byCode({ unrealPct: -29.9 }, {}, 'P1')).toBeNull();
  });
  it('−30 % → alerte AMBRE (severity critique, pas perte)', () => {
    const p1 = byCode({ unrealPct: -30 }, {}, 'P1');
    expect(p1.severity).toBe(GATE_SEV.CRITIQUE);
    expect(p1.isRealLoss).toBeUndefined();
  });
  it('−34,9 % → toujours alerte AMBRE', () => {
    expect(byCode({ unrealPct: -34.9 }, {}, 'P1').severity).toBe(GATE_SEV.CRITIQUE);
  });
  it('−35 % → exécution ROUGE (severity perte, perte réelle)', () => {
    const p1 = byCode({ unrealPct: -35 }, {}, 'P1');
    expect(p1.severity).toBe(GATE_SEV.PERTE);
    expect(p1.isRealLoss).toBe(true);
  });
  it('la source est le registre P1', () => {
    expect(byCode({ unrealPct: -35 }, {}, 'P1').source).toBe('portes.P1_sl');
  });
});

describe('P2 — TRAIL (pic +50 %, sortie pic×0,60, aucun plancher)', () => {
  it('pic +49,9 % → non armé', () => {
    expect(byCode({ picPct: 0.499, unrealPct: 40 }, {}, 'P2')).toBeNull();
  });
  it('pic +50 % → armé (AMBRE)', () => {
    const p2 = byCode({ picPct: 0.5, unrealPct: 100 }, {}, 'P2');
    expect(p2.status).toBe('armed');
    expect(p2.severity).toBe(GATE_SEV.ARME);
  });
  it('sortie exacte au pic×0,60 → franchie (pic +100 % → sortie +60 %)', () => {
    expect(byCode({ picPct: 1.0, unrealPct: 60 }, {}, 'P2').status).toBe('crossed');
    expect(byCode({ picPct: 1.0, unrealPct: 60.01 }, {}, 'P2').status).toBe('armed');
    expect(byCode({ picPct: 1.0, unrealPct: 59.99 }, {}, 'P2').status).toBe('crossed');
  });
  it('pic partiel → le dit dans la métrique', () => {
    const p2 = byCode({ picPct: 1.0, unrealPct: 100, isPartial: true }, {}, 'P2');
    expect(p2.metric).toMatch(/pic partiel/);
    expect(p2.isPartial).toBe(true);
  });
  it('aucun pic enregistré → pas de P2 (jamais armé sans pic)', () => {
    expect(byCode({ unrealPct: 100 }, {}, 'P2')).toBeNull();
  });
});

describe('P3 — DTE 45 inconditionnel', () => {
  it('46 j → approche (armé)', () => {
    expect(byCode({ dte: 46 }, {}, 'P3').status).toBe('armed');
  });
  it('45 j → franchie', () => {
    expect(byCode({ dte: 45 }, {}, 'P3').status).toBe('crossed');
  });
  it('51 j → rien', () => {
    expect(byCode({ dte: 51 }, {}, 'P3')).toBeNull();
  });
});

describe('P4 — EARNINGS conditionnelle (se tait quand ça va mal)', () => {
  const today = '2026-01-05';
  it('J−7 en gain → sortie ; J−8 → hors fenêtre', () => {
    expect(byCode({ earningsDate: addTradingDays(today, 7), unrealPct: 10 }, { today }, 'P4').status).toBe('crossed');
    expect(byCode({ earningsDate: addTradingDays(today, 8), unrealPct: 10 }, { today }, 'P4')).toBeNull();
  });
  it('J−5 en gain → sortie ; J−4 → hors fenêtre', () => {
    expect(byCode({ earningsDate: addTradingDays(today, 5), unrealPct: 10 }, { today }, 'P4').status).toBe('crossed');
    expect(byCode({ earningsDate: addTradingDays(today, 4), unrealPct: 10 }, { today }, 'P4')).toBeNull();
  });
  it('dans la fenêtre mais P&L ≤ 0 → on TIENT (severity null, pas de signal de bande)', () => {
    const p4 = byCode({ earningsDate: addTradingDays(today, 6), unrealPct: -10 }, { today }, 'P4');
    expect(p4.status).toBe('hold');
    expect(p4.severity).toBeNull();
  });
  it('earningsDate AUCUN → porte inapplicable (rien)', () => {
    expect(byCode({ earningsDate: 'AUCUN', unrealPct: 10 }, { today }, 'P4')).toBeNull();
  });
  it('earningsDate null → INDÉTERMINÉE (jamais un faux « pas d’earnings »)', () => {
    const p4 = byCode({ earningsDate: null, unrealPct: 10 }, { today }, 'P4');
    expect(p4.status).toBe('indeterminate');
    expect(p4.severity).toBeNull();
  });
});

describe('P5 — STAGNATION jour 30, bande −20/+30 sur le P&L courant', () => {
  it('J+29 → rien ; J+30 dans la bande → sortie', () => {
    expect(byCode({ daysHeld: 29, unrealPct: 0 }, {}, 'P5')).toBeNull();
    expect(byCode({ daysHeld: 30, unrealPct: 0 }, {}, 'P5').status).toBe('crossed');
  });
  it('bornes de bande : −20 et +30 inclus, hors bande exclus', () => {
    expect(byCode({ daysHeld: 30, unrealPct: -20 }, {}, 'P5').status).toBe('crossed');
    expect(byCode({ daysHeld: 30, unrealPct: 30 }, {}, 'P5').status).toBe('crossed');
    expect(byCode({ daysHeld: 30, unrealPct: -20.1 }, {}, 'P5')).toBeNull();
    expect(byCode({ daysHeld: 30, unrealPct: 30.1 }, {}, 'P5')).toBeNull();
  });
});

describe('bandSignals — ne garde que les signaux affichables (severity)', () => {
  it('exclut les indéterminés / hold', () => {
    const all = evaluateGates({ earningsDate: null, unrealPct: 5 }, { today: '2026-01-05' });
    expect(all.length).toBeGreaterThan(0);
    expect(bandSignals(all).length).toBe(0);
  });
  it('P1 −35 est affichable et rouge', () => {
    const band = bandSignals(evaluateGates({ unrealPct: -35 }, {}));
    expect(band.some((s) => s.code === 'P1' && s.severity === GATE_SEV.PERTE)).toBe(true);
  });
});

describe('gateDistances — état + distance de CHAQUE porte, toujours (1.G-b)', () => {
  const today = '2026-01-05';

  it('P1 : distances à −30 / −35 + état par palier', () => {
    const a = gateDistances({ unrealPct: -25 }).P1;
    expect(a.toAlerte).toBe(5); // -25 − (−30)
    expect(a.toExecution).toBe(10);
    expect(a.state).toBe('ok');
    expect(gateDistances({ unrealPct: -30 }).P1.state).toBe('alerte');
    const ex = gateDistances({ unrealPct: -35 }).P1;
    expect(ex.state).toBe('execution');
    expect(ex.isRealLoss).toBe(true);
    expect(ex.toExecution).toBe(0);
  });

  it('P2 : pic + seuil de sortie = pic × 0,60, armé au pic +50 %, isPartial remonté', () => {
    const noPeak = gateDistances({ unrealPct: 10 }).P2;
    expect(noPeak.state).toBe('no-peak');
    const armed = gateDistances({ unrealPct: 100, picPct: 1.0, isPartial: true }).P2;
    expect(armed.isArmed).toBe(true);
    expect(armed.sortiePct).toBeCloseTo(60); // 100 % × 0,60
    expect(armed.isPartial).toBe(true);
    expect(gateDistances({ unrealPct: 10, picPct: 0.49 }).P2.state).toBe('inactive');
  });

  it('P3 : jours avant la gate 45', () => {
    expect(gateDistances({ dte: 60 }).P3.joursAvant).toBe(15);
    expect(gateDistances({ dte: 60 }).P3.state).toBe('ok');
    expect(gateDistances({ dte: 45 }).P3.state).toBe('crossed');
    expect(gateDistances({ dte: 48 }).P3.state).toBe('armed');
  });

  it('P4 : fenêtre + condition + indéterminée si earningsDate absent', () => {
    expect(gateDistances({ unrealPct: 5, earningsDate: null }, { today }).P4.state).toBe('indeterminee');
    expect(gateDistances({ unrealPct: 5, earningsDate: 'AUCUN' }, { today }).P4.state).toBe('indeterminee');
    const active = gateDistances({ unrealPct: 5, earningsDate: addTradingDays(today, 6) }, { today }).P4;
    expect(active.state).toBe('active');
    expect(active.condition).toBe('sortie'); // pnl > 0 → sortie
    const hold = gateDistances({ unrealPct: -5, earningsDate: addTradingDays(today, 6) }, { today }).P4;
    expect(hold.condition).toBe('hold'); // pnl ≤ 0 → on tient
  });

  it('P5 : jours avant J+30 + grisée hors bande', () => {
    expect(gateDistances({ daysHeld: 20, unrealPct: 0 }).P5.joursAvant).toBe(10);
    expect(gateDistances({ daysHeld: 30, unrealPct: 0 }).P5.state).toBe('crossed');
    expect(gateDistances({ daysHeld: 30, unrealPct: 40 }).P5.state).toBe('hors-bande');
    expect(gateDistances({ daysHeld: 30, unrealPct: 40 }).P5.inBand).toBe(false);
  });
});

describe('nearestPorte — la porte la plus proche de son seuil', () => {
  it('P1 à −30 domine une DTE lointaine', () => {
    const d = gateDistances({ unrealPct: -30, dte: 120, daysHeld: 2 });
    expect(nearestPorte(d).code).toBe('P1');
    expect(nearestPorte(d).prox).toBe(1);
  });
  it('DTE franchie (≤45) domine un P&L sain', () => {
    const d = gateDistances({ unrealPct: 5, dte: 40, daysHeld: 2 });
    expect(nearestPorte(d).code).toBe('P3');
  });
  it('position saine et loin → renvoie tout de même la moins loin, jamais null si une porte est évaluable', () => {
    const d = gateDistances({ unrealPct: 5, dte: 120, daysHeld: 2 });
    expect(nearestPorte(d)).not.toBeNull();
  });
  it('aucune donnée → null', () => {
    expect(nearestPorte(gateDistances({}))).toBeNull();
  });
});
