// ═══════════════════════════════════════════════════════════════
//  navSeries — série NLV quotidienne dérivée du CSV Flex (chantier NLV).
//  Verrous :
//    1. Source NAV exacte prioritaire quand la section est présente.
//    2. Reconstruction : grands livres par devise (dépôts/retraits +
//       Other Fees + forex DEUX jambes + NetCash des exécutions),
//       positions au COÛT (NAV plat à l'ouverture, mouvement au réalisé),
//       conversion aux taux DATÉS du CSV, graine StartingCash,
//       points fromDate/toDate, réconciliation EndingCash.
//    3. Annotations : apports/retraits extraits, fees exclus.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { buildCsvNavSeries, detectBaseCurrency, NAV_SOURCE_EXACT, NAV_SOURCE_RECON } from '../navSeries';

// Gabarit de `parsed` (sortie parseIbkrCsv) minimal pour la reconstruction.
function parsedFixture(overrides = {}) {
  return {
    meta: { accountId: 'U1', fromDate: '2025-08-08', toDate: '2025-12-31' },
    cashReport: {
      fromDate: '2025-08-08',
      toDate: '2025-12-31',
      endingCash: 840,
      currencies: { CHF: { startingCash: 0 }, USD: { startingCash: 0 } },
    },
    navRows: [],
    ledgerRows: [
      { date: '2025-08-15', currency: 'CHF', amount: 1000, type: 'Deposits/Withdrawals', fxToBase: 1 },
      { date: '2025-09-01', currency: 'CHF', amount: -10, type: 'Other Fees', fxToBase: 1 },
      { date: '2025-12-20', currency: 'CHF', amount: -200, type: 'Deposits/Withdrawals', fxToBase: 1 },
    ],
    fxExecutions: [
      // Achat de 500 USD contre CHF (USD.CHF BUY) : jambe quote = Proceeds
      // + commission en CHF, jambe base de paire = Quantity en USD.
      {
        date: '2025-09-10', pairBase: 'USD', quoteCurrency: 'CHF',
        qty: 500, proceeds: -400, commission: -1, commissionCurrency: 'CHF',
        fxToBase: 1, rate: 0.8,
      },
    ],
    trades: [
      // Ouverture option : cash −300 USD, position au coût +300 USD → NAV plat.
      { di: '2025-10-01', _ibkrCurrency: 'USD', _ibkrNetCash: -300, _ibkrCostBasis: 300, _ibkrProceeds: -295, fi: '5', fxi: '0.8' },
      // Clôture : cash +350 USD, coût −300 → +50 USD réalisés.
      { di: '2025-11-15', _ibkrCurrency: 'USD', _ibkrNetCash: 350, _ibkrCostBasis: -300, _ibkrProceeds: 355, fi: '5', fxi: '0.82' },
    ],
    positions: [],
    fxRates: { '2025-09-10': 0.8 },
    ...overrides,
  };
}

const dayAt = (series, d) => series.days.find((x) => x.d === d);

describe('detectBaseCurrency', () => {
  it('la devise dont les rows portent FXRateToBase = 1', () => {
    expect(detectBaseCurrency(parsedFixture())).toBe('CHF');
  });
  it('fallback CHF sans indice', () => {
    expect(detectBaseCurrency({ ledgerRows: [], fxExecutions: [], trades: [] })).toBe('CHF');
  });
});

describe('buildCsvNavSeries — source NAV exacte', () => {
  it('section NAV présente → source exacte, points ReportDate/Total triés dédupliqués', () => {
    const s = buildCsvNavSeries(parsedFixture({
      navRows: [
        { date: '2025-08-09', total: 100.4, currency: 'CHF' },
        { date: '2025-08-08', total: 0, currency: 'CHF' },
        { date: '2025-08-09', total: 101.6, currency: 'CHF' }, // dernier gagne
      ],
    }));
    expect(s.source).toBe(NAV_SOURCE_EXACT);
    expect(s.days).toEqual([
      { d: '2025-08-08', base: 0 },
      { d: '2025-08-09', base: 101.6 },
    ]);
    expect(s.reconciliation).toBeNull();
  });
});

describe('buildCsvNavSeries — reconstruction (pas de section NAV)', () => {
  const s = buildCsvNavSeries(parsedFixture());

  it('source recon, devise de base CHF', () => {
    expect(s.source).toBe(NAV_SOURCE_RECON);
    expect(s.baseCurrency).toBe('CHF');
  });

  it('point de départ au FromDate (graine StartingCash)', () => {
    expect(s.days[0]).toEqual({ d: '2025-08-08', base: 0 });
  });

  it('dépôt puis fee : cash exact aux dates des Cash Transactions', () => {
    expect(dayAt(s, '2025-08-15').base).toBe(1000);
    expect(dayAt(s, '2025-09-01').base).toBe(990);
  });

  it('forex : les deux jambes portent la conversion (NAV quasi inchangé, − commission)', () => {
    // CHF 990 − 400 − 1 = 589 ; USD +500 × 0.8 = 400 → 989.
    expect(dayAt(s, '2025-09-10').base).toBe(989);
  });

  it('ouverture au coût : NAV PLAT à l’achat (cash −prime, position +prime)', () => {
    expect(dayAt(s, '2025-10-01').base).toBe(989);
  });

  it('clôture : le réalisé bouge le NAV, au taux daté du CSV', () => {
    // CHF 589 + (USD 550 + coût 0) × 0.82 = 1040.
    expect(dayAt(s, '2025-11-15').base).toBe(1040);
  });

  it('retrait puis point final au ToDate (valeur portée)', () => {
    expect(dayAt(s, '2025-12-20').base).toBe(840);
    expect(s.days[s.days.length - 1]).toEqual({ d: '2025-12-31', base: 840 });
  });

  it('réconciliation cash vs EndingCash du Cash Report', () => {
    expect(s.reconciliation.cashBase).toBe(840);
    expect(s.reconciliation.expectedCashBase).toBe(840);
  });

  it('annotations : les apports/retraits sortent, les fees N’EN SONT PAS', () => {
    expect(s.flows).toEqual([
      { d: '2025-08-15', kind: 'dep', amount: 1000, currency: 'CHF' },
      { d: '2025-12-20', kind: 'wit', amount: -200, currency: 'CHF' },
    ]);
  });
});

describe('buildCsvNavSeries — positions ouvertes avant la fenêtre', () => {
  it('offset constant = coût des positions de fin non couvertes par les exécutions', () => {
    const s = buildCsvNavSeries(parsedFixture({
      trades: [],
      // Position tenue depuis avant FromDate : pi×ct×mu×fxi = 1×2×100×0.8 = 160.
      positions: [{ pi: '1', ct: '2', mu: '100', fxi: '0.8' }],
    }));
    expect(s.days[0].base).toBe(160);
    // cash final : CHF 389 + USD 500×0.8 = 789, + offset 160.
    expect(s.days[s.days.length - 1].base).toBe(949);
  });
});
