// ═══════════════════════════════════════════════════════════════
//  B4 — initialCapital cascade : manual CHF prime sur l'auto-dérivation.
//
//  Vérifie que :
//   (a) settings.initialCapitalChf manuel PRIME sur cashReport (source 'manual').
//   (b) Sans manuel, la cascade auto (cashReport > cashTransactions) reste
//       inchangée (preservation phase A).
//   (c) Le TWR est INDÉPENDANT du capital manuel quand des cashFlows
//       sont présents — la chaîne TWR utilise les flows réels, pas le
//       seed synthétique d'initialCapital.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { calculatePortfolioMetrics } from '../calculations';

const LIVE_RATE = 0.8; // 1 USD = 0.8 CHF — round numbers for assertions.

// Minimal closed trade : `pnl` (USD) court-circuite tradePnlUsd directement,
// pas besoin de fournir tous les champs option.
function trade(date, pnlUsd) {
  return {
    id: `t-${date}`,
    tk: 'TEST',
    as: 'Option',
    dir: 'Short',
    do: date,
    di: date,
    pnl: pnlUsd,
    pi: '1',
    po: '0',
    ct: '1',
    mu: '100',
    fi: '0',
    fo: '0',
  };
}

// 25 trades de +20 USD chacun (passe le gate MIN_TRADES_ANNUALIZED=20).
function build25Trades() {
  const out = [];
  for (let i = 0; i < 25; i++) {
    const m = String((i % 12) + 1).padStart(2, '0');
    const d = String((i % 28) + 1).padStart(2, '0');
    const year = 2025 + Math.floor(i / 12);
    out.push(trade(`${year}-${m}-${d}`, 20));
  }
  return out;
}

function makeState({ settings = {}, closedTrades = [], cashFlows = [] } = {}) {
  return {
    openPositions: [],
    closedTrades,
    cashFlows,
    journalEntries: [],
    settings: { liveRate: LIVE_RATE, ...settings },
  };
}

describe('B4 — initialCapital cascade with manual CHF prime', () => {
  it('(a) manualChf > 0 prime sur cashReport — source = "manual"', () => {
    const state = makeState({
      closedTrades: build25Trades(),
      settings: {
        initialCapitalChf: 1500,
        cashReport: {
          baseCurrency: 'CHF',
          startingCash: 0,
          deposits: 9000,
          withdrawals: 0,
        },
      },
    });
    const m = calculatePortfolioMetrics(state);
    expect(m.initialCapitalSource).toBe('manual');
    // 1500 CHF / 0.8 = 1875 USD
    expect(m.initialCapital).toBeCloseTo(1875, 0);
  });

  it('(b) sans manuel → cascade auto inchangée (cashReport gagne)', () => {
    const state = makeState({
      closedTrades: build25Trades(),
      settings: {
        // no initialCapitalChf
        cashReport: {
          baseCurrency: 'CHF',
          startingCash: 0,
          deposits: 9000,
          withdrawals: 0,
        },
      },
    });
    const m = calculatePortfolioMetrics(state);
    expect(m.initialCapitalSource).toBe('cashReport');
    // 9000 CHF / 0.8 = 11250 USD
    expect(m.initialCapital).toBeCloseTo(11250, 0);
  });

  it('(b2) manuel = 0 → ignoré, fallback auto', () => {
    const state = makeState({
      closedTrades: build25Trades(),
      settings: {
        initialCapitalChf: 0,
        cashReport: {
          baseCurrency: 'CHF',
          startingCash: 0,
          deposits: 9000,
          withdrawals: 0,
        },
      },
    });
    const m = calculatePortfolioMetrics(state);
    expect(m.initialCapitalSource).toBe('cashReport');
  });

  it('(b3) manuel = null → ignoré, fallback auto', () => {
    const state = makeState({
      closedTrades: build25Trades(),
      settings: {
        initialCapitalChf: null,
        cashReport: {
          baseCurrency: 'CHF',
          startingCash: 0,
          deposits: 9000,
          withdrawals: 0,
        },
      },
    });
    const m = calculatePortfolioMetrics(state);
    expect(m.initialCapitalSource).toBe('cashReport');
  });

  it('(c) TWR identique avec et sans capital manuel quand cashFlows présents', () => {
    // CashFlows : dépôt unique 8000 USD au 2025-01-01.
    const cashFlows = [
      { id: 'cf-1', da: '2025-01-01', ty: 'dep_usd', a1: '8000', a2: '0' },
    ];
    const closedTrades = build25Trades();

    const withoutManual = calculatePortfolioMetrics(
      makeState({ closedTrades, cashFlows })
    );
    const withManual = calculatePortfolioMetrics(
      makeState({
        closedTrades,
        cashFlows,
        settings: { initialCapitalChf: 1500 },
      })
    );

    // TWR ne doit PAS bouger : la chaîne consomme `flows` (présents) et
    // ignore le seed `initialCapital` (utilisé seulement en fallback si
    // flows vides).
    expect(withManual.twr).toBeCloseTo(withoutManual.twr, 4);
    expect(withManual.twrSubPeriods).toBe(withoutManual.twrSubPeriods);
    // Sanity : le TWR est défini (pas null) — les flows fournissent l'anchor.
    expect(withoutManual.twr).not.toBeNull();
  });

  it('(d) tout absent (pas manuel, pas cashReport, pas flows) → unknown', () => {
    const state = makeState({ closedTrades: build25Trades() });
    const m = calculatePortfolioMetrics(state);
    expect(m.initialCapitalSource).toBe('unknown');
    expect(m.initialCapital).toBeNull();
  });
});
