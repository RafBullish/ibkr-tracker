// ═══════════════════════════════════════════════════════════════
//  CORE FINANCIAL ENGINE
//  Dual Currency (USD/CHF) + FIFO + FX Impact
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive, roundTo2 } from './math';
import { currentMonthKey, extractMonthKey } from './dates';
import { FRESHNESS } from '../constants/timing';
// A1 single-source-of-truth primitives — replace the inline formulas
// that previously diverged between calculations.js and useTradingMetrics.js.
// A2a additions : buildEquitySeries (returns%-based, capital-floor) and
// computeVolatility (annualised, replaces the old vol30dAnnualized).
import {
  computeWinRate,
  computeProfitFactor,
  computeSharpe,
  computeSortino,
  computeCAGR,
  computeCalmar,
  computeRecoveryFactor,
  buildEquitySeries,
  computeVolatility,
} from './metrics';
// A3b — equity timeline + TWR.
import { buildEquityTimeline } from './metrics/equityTimeline';
import { computeTWR } from './metrics/computeTWR';
import { safeNum, roundTo2Safe } from './safeNum';
import { isValidFxRate } from './fx/helpers';

// ─── Closed Trade P&L ────────────────────────────────────────

export function calculateClosedTradePnl(trade, fallbackFxRate) {
  const mul = ensurePositive(trade.mu);
  const qty = toFloat(trade.ct);
  const pi = toFloat(trade.pi),
    po = toFloat(trade.po);
  const fi = toFloat(trade.fi),
    fo = toFloat(trade.fo);
  // A3a — fxi/fxo come from trade-time storage when available. The
  // `|| fallback` cascade falls back to the CURRENT liveRate when the
  // per-trade rate is missing — a known limitation (mixes epochs ; a true
  // fix would need a historical FX table, A3+). What we DO refuse is a
  // silent 1 :1 conversion : if both trade.fxi and fallbackFxRate are
  // invalid, the rate is null and CHF figures collapse to null.
  const tradeFxi = toFloat(trade.fxi);
  const tradeFxo = toFloat(trade.fxo);
  const fbValid = isValidFxRate(fallbackFxRate);
  const fxi = tradeFxi > 0 ? tradeFxi : fbValid ? fallbackFxRate : null;
  const fxo = tradeFxo > 0 ? tradeFxo : fbValid ? fallbackFxRate : null;
  const isShort = trade.dir === 'Short';

  const grossIn = pi * mul * qty;
  const grossOut = po * mul * qty;
  const fxOk = fxi != null && fxo != null;

  if (isShort) {
    const entryUsd = grossIn - fi;
    const exitUsd = grossOut + fo;
    return {
      usd: entryUsd - exitUsd,
      chf: fxOk ? entryUsd * fxi - exitUsd * fxo : null,
      fxImpactChf: fxOk ? entryUsd * (fxi - fxo) : null,
      feesUsd: fi + fo,
    };
  } else {
    const entryUsd = grossIn + fi;
    const exitUsd = grossOut - fo;
    return {
      usd: exitUsd - entryUsd,
      chf: fxOk ? exitUsd * fxo - entryUsd * fxi : null,
      fxImpactChf: fxOk ? entryUsd * (fxo - fxi) : null,
      feesUsd: fi + fo,
    };
  }
}

export function tradePnlUsd(trade, liveRate) {
  // Prefer stored IBKR FifoPnlRealized when available
  const stored = toFloat(trade.pnl);
  if (stored !== 0) return stored;
  return calculateClosedTradePnl(trade, liveRate).usd;
}

export function tradeRMultiple(trade, liveRate) {
  const result = calculateClosedTradePnl(trade, liveRate);
  let rk = toFloat(trade.rk);
  if (rk <= 0 && trade.dir !== 'Short') {
    rk = toFloat(trade.pi) * ensurePositive(trade.mu) * toFloat(trade.ct) + toFloat(trade.fi);
  }
  if (rk <= 0) return 0;
  return result.usd / rk;
}

// ─── Open Position P&L ───────────────────────────────────────

export function calculateOpenPositionPnl(position, liveRate) {
  const mul = ensurePositive(position.mu);
  const qty = toFloat(position.ct);
  const pi = toFloat(position.pi),
    pc = toFloat(position.pc);
  const fi = toFloat(position.fi);
  // A3a — same FX guard as calculateClosedTradePnl. CHF emissions null
  // when both per-position fxi and liveRate are invalid.
  const posFxi = toFloat(position.fxi);
  const lrValid = isValidFxRate(liveRate);
  const fxi = posFxi > 0 ? posFxi : lrValid ? liveRate : null;
  const lrForChf = lrValid ? liveRate : null;
  const isShort = position.dir === 'Short';

  const costBasisUsd = isShort ? pi * mul * qty - fi : pi * mul * qty + fi;
  const curValRaw = pc * mul * qty;
  const mktValUsd = isShort ? -curValRaw : curValRaw;
  const mktValChf = lrForChf != null ? mktValUsd * lrForChf : null;

  const uPnlUsd = isShort ? costBasisUsd - curValRaw : curValRaw - costBasisUsd;
  const fxOk = fxi != null && lrForChf != null;
  const uPnlChf = fxOk
    ? isShort
      ? costBasisUsd * fxi - curValRaw * lrForChf
      : curValRaw * lrForChf - costBasisUsd * fxi
    : null;
  const fxImp = fxOk
    ? isShort
      ? costBasisUsd * (fxi - lrForChf)
      : costBasisUsd * (lrForChf - fxi)
    : null;

  return {
    marketValueUsd: mktValUsd,
    marketValueChf: mktValChf,
    unrealizedPnlUsd: uPnlUsd,
    unrealizedPnlChf: uPnlChf,
    fxImpactChf: fxImp,
    costBasisUsd: costBasisUsd,
  };
}

// ─── A2.2 — Initial capital from Cash Report ─────────────────
//
// Derives the USD-equivalent invested capital from a parsed Cash Report
// (`settings.cashReport`). Tries per-currency aggregation first (CHF +
// USD, summed in USD via liveRate) ; falls back to the BaseCurrency
// aggregate using `cashReport.baseCurrency` (or a CHF-base heuristic
// when the code is missing).
//
// Returns null when no usable Cash Report data is present so the
// caller can advance through the resolution hierarchy (cashFlows →
// settings → null) without ambiguity.
//
// Exported for direct testing — internal helper otherwise.
//
// @param {Object|undefined|null} cashReport  parsed CashReport from IBKR Flex
// @param {number} liveRate                   CHF per USD
// @returns {number|null}                     USD-equivalent initial capital
export function deriveInitialFromCashReport(cashReport, liveRate) {
  if (!cashReport || typeof cashReport !== 'object') return null;
  const lr = typeof liveRate === 'number' && liveRate > 0 ? liveRate : null;

  // (1) Per-currency aggregation — only counts if at least one currency
  // exposes non-zero startingCash / deposits / withdrawals.
  const currencies = cashReport.currencies || null;
  if (currencies) {
    let totalUsd = 0;
    let hasSample = false;
    for (const code of Object.keys(currencies)) {
      if (code !== 'CHF' && code !== 'USD') continue;
      const data = currencies[code] || {};
      const sc = toFloat(data.startingCash);
      const dep = toFloat(data.deposits);
      const wd = toFloat(data.withdrawals);
      if (sc !== 0 || dep !== 0 || wd !== 0) hasSample = true;
      const net = sc + dep + wd;
      if (code === 'USD') totalUsd += net;
      else if (code === 'CHF' && lr) totalUsd += net / lr;
    }
    if (hasSample && totalUsd > 0) return totalUsd;
  }

  // (2) BaseCurrency aggregate.
  const sc = toFloat(cashReport.startingCash);
  const dep = toFloat(cashReport.deposits);
  const wd = toFloat(cashReport.withdrawals);
  if (sc === 0 && dep === 0 && wd === 0) return null;
  const netBase = sc + dep + wd;
  if (!(netBase > 0)) return null;

  const base = cashReport.baseCurrency;
  if (base === 'USD') return netBase;
  if (base === 'CHF' && lr) return netBase / lr;
  // Unknown base — best-effort assume CHF (the common quantumcall case)
  // when liveRate is available. If liveRate is missing, fall back to
  // taking the base aggregate at face value.
  if (lr) return netBase / lr;
  return null;
}

// ─── Full Portfolio Metrics ──────────────────────────────────

export function calculatePortfolioMetrics(state) {
  // A3a — FX integrity gate. The rawLiveRate comes from
  // `state.settings.liveRate` (set by the FX refresh hook). When it
  // fails isValidFxRate the legacy code converted everything at 1:1
  // silently — A3a refuses : `fxValid=false` flags the cascade, all
  // CHF emissions are nullified, the UI banner reads this flag.
  //
  // `liveRate` is kept as a safe arithmetic fallback (1) so the USD-side
  // computations stay numerically valid ; the CHF side never reaches the
  // output when fxValid is false.
  const rawLiveRate = toFloat(state.settings.liveRate);
  const fxValid = isValidFxRate(rawLiveRate);
  const liveRate = fxValid ? rawLiveRate : 1;

  // ── Cash Flows ──
  let totalFundedUsd = 0,
    totalDepositedChf = 0;
  state.cashFlows.forEach((e) => {
    const a1 = toFloat(e.a1),
      a2 = toFloat(e.a2);
    if (e.ty === 'dep_chf' || e.ty === 'adj_chf') totalDepositedChf += a1;
    else if (e.ty === 'wit_chf') totalDepositedChf -= a1;
    else if (e.ty === 'fx_buy_usd') {
      totalFundedUsd += a2;
      totalDepositedChf -= a1;
    } else if (e.ty === 'fx_buy_chf') {
      totalFundedUsd -= a1;
      totalDepositedChf += a2;
    } else if (e.ty === 'div_usd' || e.ty === 'adj_usd' || e.ty === 'dep_usd')
      // A2.2 — `dep_usd` is the new explicit tag for USD deposits (parser
      // line `sections.js:mapCashTxnRow`). `adj_usd` is kept for
      // back-compat with persisted state from pre-A2.2 imports.
      totalFundedUsd += a1;
    else if (e.ty === 'fee_usd' || e.ty === 'wit_usd')
      // A2.2 — `wit_usd` is the new explicit tag for USD withdrawals.
      totalFundedUsd -= a1;
    else if (e.ty === 'dep_fx' || !e.ty) totalFundedUsd += toFloat(e.u || e.a1);
  });


  // ── Realized P&L ──
  let realizedPnlUsd = 0,
    realizedPnlChf = 0,
    totalFxImpact = 0,
    totalClosedFees = 0;
  state.closedTrades.forEach((t) => {
    const pnl = tradePnlUsd(t, liveRate);
    const fxo = toFloat(t.fxo) || liveRate;
    realizedPnlUsd += pnl;
    realizedPnlChf += pnl * fxo;
    const r = calculateClosedTradePnl(t, liveRate);
    totalFxImpact += r.fxImpactChf;
    totalClosedFees += toFloat(t.cm) || toFloat(t.fi) + toFloat(t.fo);
  });

  // ── Open Positions ──
  let capitalTiedUp = 0,
    totalExposure = 0;
  let unrealizedPnlUsd = 0,
    unrealizedPnlChf = 0;
  let openFxImpact = 0,
    totalOpenFees = 0;
  state.openPositions.forEach((p) => {
    const r = calculateOpenPositionPnl(p, liveRate);
    totalOpenFees += toFloat(p.fi);
    if (p.dir === 'Short') capitalTiedUp -= r.costBasisUsd;
    else capitalTiedUp += r.costBasisUsd;
    totalExposure += Math.abs(r.marketValueUsd);
    unrealizedPnlUsd += r.unrealizedPnlUsd;
    unrealizedPnlChf += r.unrealizedPnlChf;
    openFxImpact += r.fxImpactChf;
  });

  // ── Cash & NLV ──
  // Priority cascade (highest → lowest) :
  //   (1) settings.ibkrLiveData FRESH (<LIVE_DATA_MAX_AGE_MS) — snapshot
  //       from the local IBKR bridge (bridge/ibkr_poller.py). NLV and
  //       totalCashValue come straight from Gateway's API and override
  //       the reconstruction below. Same freshness threshold as the LIVE
  //       badge so the cards and the badge stay coherent.
  //   (2) settings.cashReport — IBKR Flex CashReport per-currency
  //       balances (authoritative on historical balances).
  //   (3) Reconstruction from cashFlows + closedTrades + openPositions.
  //
  // Tier (1) only takes effect when its inputs are valid; otherwise the
  // existing tier (2)/(3) cascade runs unchanged — users without the
  // bridge see zero behavior change.
  const cashReport = state.settings?.cashReport;
  const hasCurrencyBalances =
    cashReport?.currencies?.USD != null || cashReport?.currencies?.CHF != null;

  let cashUsd = hasCurrencyBalances
    ? roundTo2(cashReport.currencies.USD?.endingCash || 0)
    : roundTo2(totalFundedUsd + realizedPnlUsd - capitalTiedUp);
  let chfCashBalance = hasCurrencyBalances
    ? roundTo2(cashReport.currencies.CHF?.endingCash || 0)
    : roundTo2(totalDepositedChf);

  const positionsValueUsd = state.openPositions.reduce((s, p) => {
    return s + toFloat(p.pc) * ensurePositive(p.mu) * toFloat(p.ct) * (p.dir === 'Short' ? -1 : 1);
  }, 0);
  let nlvUsdSide = roundTo2(cashUsd + positionsValueUsd);
  let netLiquidationValueChf = roundTo2(nlvUsdSide * liveRate + chfCashBalance);
  let netLiquidationValueUsd = roundTo2(
    nlvUsdSide + (liveRate > 0 ? chfCashBalance / liveRate : 0)
  );

  // Tier (1) override — bridge live snapshot. Mappage direct dans la devise
  // de base du compte : CHF-base → netLiquidation alimente chf, dérivation
  // usd via liveRate ; USD-base → symétrique. Devise inattendue (rare) :
  // on laisse tomber l'override et la cascade (2)/(3) garde la main.
  const liveData = state.settings?.ibkrLiveData;
  const liveAgeMs = liveData?.timestamp
    ? Date.now() - new Date(liveData.timestamp).getTime()
    : Infinity;
  const liveBridgeFresh =
    Number.isFinite(liveAgeMs) &&
    liveAgeMs < FRESHNESS.LIVE_DATA_MAX_AGE_MS &&
    typeof liveData?.netLiquidation === 'number' &&
    liveData.netLiquidation > 0;
  if (liveBridgeFresh) {
    const nlv = liveData.netLiquidation;
    const totalCash =
      typeof liveData.totalCashValue === 'number' ? liveData.totalCashValue : null;
    const ccy = liveData.currency;
    if (ccy === 'CHF') {
      netLiquidationValueChf = roundTo2(nlv);
      if (liveRate > 0) netLiquidationValueUsd = roundTo2(nlv / liveRate);
      if (totalCash != null) {
        chfCashBalance = roundTo2(totalCash);
        if (liveRate > 0) cashUsd = roundTo2(totalCash / liveRate);
      }
      nlvUsdSide = roundTo2(cashUsd + positionsValueUsd);
    } else if (ccy === 'USD') {
      netLiquidationValueUsd = roundTo2(nlv);
      if (liveRate > 0) netLiquidationValueChf = roundTo2(nlv * liveRate);
      if (totalCash != null) {
        cashUsd = roundTo2(totalCash);
        if (liveRate > 0) chfCashBalance = roundTo2(totalCash * liveRate);
      }
      nlvUsdSide = roundTo2(cashUsd + positionsValueUsd);
    }
  }

  let totalEverDepositedChf = 0;
  state.cashFlows.forEach((e) => {
    if (e.ty === 'dep_chf') totalEverDepositedChf += toFloat(e.a1);
  });
  const allocationPercent =
    netLiquidationValueChf > 0
      ? roundTo2(((totalExposure * liveRate) / netLiquidationValueChf) * 100)
      : 0;
  const totalAllFees = roundTo2(
    totalClosedFees + totalOpenFees + state.cashFlows.reduce((s, e) => s + toFloat(e.fe || 0), 0)
  );

  // ── Monthly P&L ──
  let monthlyPnlUsd = 0,
    monthlyPnlChf = 0;
  const curMonth = currentMonthKey();
  state.closedTrades
    .filter((t) => extractMonthKey(t.do) === curMonth)
    .forEach((t) => {
      const pnl = tradePnlUsd(t, liveRate);
      const fxo = toFloat(t.fxo) || liveRate;
      monthlyPnlUsd += pnl;
      monthlyPnlChf += pnl * fxo;
    });

  // ── Sorted closed trades + per-trade pnls (single pass) ──
  // Sort once here so every downstream metric (streaks, equity points,
  // Sharpe / Sortino / maxDD) consumes a consistent chronological view.
  const sortedTrades = state.closedTrades
    .slice()
    .sort((a, b) => (a.do || '').localeCompare(b.do || ''));
  const pnls = sortedTrades.map((t) => tradePnlUsd(t, liveRate));

  // ── B4 / A2.2 — initialCapital resolution (nullable, FIVE sources) ──
  // Priority order :
  //   (1) settings.initialCapitalChf — manuel saisi par l'utilisateur en
  //       CHF (sa devise). Converti en USD au taux courant. PRIME sur
  //       l'auto-dérivation : décision actée — Rafael dépose 1500 CHF/mois,
  //       un capital auto-dérivé gonflerait avec les apports et empêcherait
  //       de distinguer l'edge de trading de l'effort d'épargne. Le TWR
  //       (timeline+computeTWR) reste indépendant : ce manuel n'altère que
  //       le numérateur/dénominateur des % de return et le gate de
  //       significativité, jamais la chaîne TWR (cf. B4-AUDIT).
  //   (2) settings.cashReport — IBKR Flex Query "Cash Report" section.
  //       Authoritative because it includes withdrawals netted out from
  //       deposits (the -200 in Tracker_TEST-2.csv that the per-transaction
  //       Cash Transactions list misses if the export omits it). Per-currency
  //       startingCash + deposits + withdrawals when available, else fall
  //       back to the BaseCurrency aggregate using `cashReport.baseCurrency`.
  //   (3) cashFlows — sum of per-transaction funding entries (dep_chf,
  //       wit_chf, dep_usd, wit_usd, plus legacy adj_usd / fee_usd).
  //   (4) settings.initialCapitalUsd — legacy USD-direct manual override
  //       (pre-B4 scaffolding ; kept for back-compat with any value set via
  //       localStorage avant que la saisie CHF arrive).
  //   (5) null — "capital unknown" state. CAGR / Sharpe / Sortino / Vol
  //       all collapse to "—" honestly.
  const manualInitialChf = toFloat(state.settings?.initialCapitalChf);
  const manualInitialUsd =
    manualInitialChf > 0 && liveRate > 0 ? manualInitialChf / liveRate : null;
  const cashReportInitialUsd = deriveInitialFromCashReport(state.settings?.cashReport, liveRate);
  const depositedUsdEq = totalFundedUsd + (liveRate > 0 ? totalDepositedChf / liveRate : 0);
  const settingsInitialUsd = toFloat(state.settings?.initialCapitalUsd);
  let initialCapital;
  let initialCapitalSource;
  if (manualInitialUsd != null && manualInitialUsd > 0) {
    initialCapital = manualInitialUsd;
    initialCapitalSource = 'manual';
  } else if (cashReportInitialUsd != null && cashReportInitialUsd > 0) {
    initialCapital = cashReportInitialUsd;
    initialCapitalSource = 'cashReport';
  } else if (depositedUsdEq > 0) {
    initialCapital = depositedUsdEq;
    initialCapitalSource = 'cashTransactions';
  } else if (settingsInitialUsd > 0) {
    initialCapital = settingsInitialUsd;
    initialCapitalSource = 'settings';
  } else {
    initialCapital = null;
    initialCapitalSource = 'unknown';
  }

  const firstTradeDate = sortedTrades.length > 0 ? new Date(sortedTrades[0].do) : new Date();
  const lastTradeDate =
    sortedTrades.length > 0
      ? new Date(sortedTrades[sortedTrades.length - 1].do || new Date())
      : new Date();
  const daysActive = Math.max(1, (lastTradeDate - firstTradeDate) / (1000 * 60 * 60 * 24));
  const yearsActive = daysActive / 365.25;
  const series = buildEquitySeries({ initialCapital, pnls });

  // ── A3b — equity timeline (dated points on real equity base) ──
  // Single source for : TWR sub-period chaining, Current/YTD/All-Time
  // drawdowns (consistent base), NLV hero badge real-growth %.
  const timeline = buildEquityTimeline({
    closedTrades: state.closedTrades,
    cashFlows: state.cashFlows,
    initialCapital,
    liveRate: rawLiveRate,
  });
  // Adapter shape consumed by risk.js helpers (they look at `.equity`).
  const realEquityPoints = timeline.points.map((p) => ({
    date: p.date,
    equity: p.realEquity,
    cumPnL: p.cumPnL,
    capitalDeployedToDate: p.capitalDeployedToDate,
  }));

  // ── A3b — TWR (time-weighted return, chained over sub-periods) ──
  const twrResult = computeTWR({
    points: timeline.points,
    flows: timeline.flows,
    yearsActive,
    tradesCount: state.closedTrades.length,
    initialCapital,
  });
  const twr = roundTo2Safe(twrResult.value, null);
  const twrMode = twrResult.mode;
  const twrSubPeriods = twrResult.subPeriods;

  // ── Win Rate / Profit Factor / Expectancy (A2b gated) ──
  // computeWinRate.winRate is null below MIN_DECISIVE_WINRATE (10).
  // computeProfitFactor.profitFactor is null below MIN_LOSSES_PF (3) or
  // when grossLoss === 0 (previously Infinity). Both fields flow through
  // as-is — display layer treats null as "—" / fraction fallback.
  // Expectancy stays computed because it's a dollar value, not a ratio :
  // we derive it from RAW count fractions, not the gated percentage,
  // so it remains meaningful even at low decisive counts.
  const winData = computeWinRate(pnls);
  const pfData = computeProfitFactor(pnls);
  const winCount = winData.winCount;
  const lossCount = winData.lossCount;
  const breakEvenCount = winData.breakEvenCount;
  const totalGains = pfData.grossProfit;
  const totalLosses = pfData.grossLoss;
  const tradeCount = state.closedTrades.length;
  const decisiveTrades = winData.decisive;
  const winRate = roundTo2Safe(winData.winRate, null);
  const profitFactor = roundTo2Safe(pfData.profitFactor, null);
  const averageWin = winCount > 0 ? totalGains / winCount : 0;
  const averageLoss = lossCount > 0 ? totalLosses / lossCount : 0;
  const winFracRaw = decisiveTrades > 0 ? winCount / decisiveTrades : 0;
  const expectancy =
    decisiveTrades > 0
      ? roundTo2(winFracRaw * averageWin - (1 - winFracRaw) * averageLoss)
      : 0;

  // ── R-Multiples ──
  // Keep trades whose R is non-zero, OR whose P&L is zero (true break-even).
  // Zipping before filtering avoids coupling the rMultiples array order with
  // the original closedTrades array via shared index.
  const rMultiples = state.closedTrades
    .map((t) => ({ r: tradeRMultiple(t, liveRate), pnl: tradePnlUsd(t, liveRate) }))
    .filter(({ r, pnl }) => r !== 0 || pnl === 0)
    .map(({ r }) => r);
  const rAverage =
    rMultiples.length > 0 ? roundTo2(rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length) : 0;
  let rStdDev = 0;
  if (rMultiples.length > 1) {
    rStdDev = Math.sqrt(
      Math.max(0, rMultiples.reduce((s, v) => s + Math.pow(v - rAverage, 2), 0) / rMultiples.length)
    );
  }
  const sqn =
    rStdDev > 0 ? roundTo2((rAverage / rStdDev) * Math.sqrt(Math.min(rMultiples.length, 100))) : 0;

  // ── Max Drawdown ──
  // Source : buildEquitySeries (single equity-curve pass).
  // maxDrawdown stays in USD; maxDrawdownPct is now computed on the
  // REAL peak equity (init + cumPnL), bounded to [0, 100], replacing
  // the legacy maxDD/initialCapital ratio that could exceed 100 %.
  const maxDrawdown = series.maxDD;

  // ── Streaks & Equity Points ──
  // Streak counters + equityPoints series are NOT a duplicated metric,
  // they're a per-iteration derivation specific to this pipeline. Kept
  // inline (over the already-computed pnls) — no formula duplication.
  let maxWinStreak = 0,
    maxLossStreak = 0,
    currentWinStreak = 0,
    currentLossStreak = 0;
  let equityCurve = 0;
  const equityPoints = [0];
  for (let i = 0; i < pnls.length; i++) {
    const pnl = pnls[i];
    equityCurve += pnl;
    equityPoints.push(equityCurve);
    if (pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  }
  const currentStreak = currentWinStreak > 0 ? currentWinStreak : -currentLossStreak;

  // ── Sharpe / Sortino / Volatility (A2a) ──
  // Returns are now fractional (series.returns) — the gate refuses to
  // emit a value when obs<30 / years<0.25 / capitalRef<500. NULL is
  // the honest signal ; the previous clamp [-5, +10] is retired.
  const sharpeRaw = computeSharpe({
    returns: series.returns,
    yearsActive,
    capitalRef: initialCapital,
  });
  const sortinoRaw = computeSortino({
    returns: series.returns,
    yearsActive,
    capitalRef: initialCapital,
  });
  const volRaw = computeVolatility({
    returns: series.returns,
    yearsActive,
    capitalRef: initialCapital,
  });
  const sharpeRatio = roundTo2Safe(sharpeRaw, null);
  const sortinoRatio = roundTo2Safe(sortinoRaw, null);
  const volAnnPct = roundTo2Safe(volRaw, null);

  // ── CAGR & Calmar Ratio (A2.2 — annualised above 1 y, cumulative below) ──
  // initialCapital may be null (cf. resolution block above). The gate
  // inside computeCAGR rejects null via significanceCheck (capitalRef
  // requirement) — no nullish-arithmetic risk here.
  const endCapital = initialCapital != null ? initialCapital + realizedPnlUsd : null;
  const cagrRaw = computeCAGR({
    initialCapital,
    endCapital,
    yearsActive,
    tradesCount: state.closedTrades.length,
  });
  const cagr = safeNum(cagrRaw, null);
  // A2.2 — `cagrMode` tells the display layer whether the percentage is
  // annualised (years≥1) or cumulative (0<years<1). The card label
  // adapts accordingly: "CAGR" → "Cumulé". Null when years invalid.
  const cagrModeValue =
    cagr == null
      ? null
      : yearsActive >= 1
        ? 'annualised'
        : 'cumulative';

  // Max drawdown % — sourced from buildEquitySeries (per-step worst peak
  // equity ratio, bounded [0, 100]). Null when the equity base is
  // "unknown" (initialCapital null) — display layer renders "—".
  const maxDrawdownPct = series.maxDDPct;

  // Calmar — feeded with un CAGR annualisé même quand yearsActive < 1.
  // computeCAGR retourne le CUMULATIF sous 1 an (artefact si on l'envoie
  // tel quel dans Calmar) ; on annualise localement via (end/init)^(1/y)
  // pour préserver la dimension du ratio (3.0 bench reste comparable).
  // Le flag `preliminaryRatios` (years < 1) signale l'artefact d'échantillon
  // court au display layer — marqueur "préliminaire" sur le bloc de ratios.
  let cagrAnnPct = null;
  if (
    initialCapital != null &&
    endCapital != null &&
    initialCapital > 0 &&
    endCapital > 0 &&
    yearsActive > 0
  ) {
    cagrAnnPct = (Math.pow(endCapital / initialCapital, 1 / yearsActive) - 1) * 100;
    if (!Number.isFinite(cagrAnnPct)) cagrAnnPct = null;
  }
  const calmarRaw = computeCalmar({
    cagrPct: cagrAnnPct,
    maxDrawdownPct,
    yearsActive,
  });
  const calmarRatio = roundTo2Safe(calmarRaw, null);

  // Préliminaire — années trop courtes pour stat signifiante (Sharpe ann.
  // sur < 30 obs trim. tronqué, Calmar extrapolé). Vrai dès qu'on a un
  // ratio mais que years < 1. Faux quand tout est null (rien à marquer).
  const preliminaryRatios =
    yearsActive > 0 && yearsActive < 1 &&
    (sharpeRatio != null || sortinoRatio != null || calmarRatio != null);

  // ── PRU (Prix de Revient Unitaire) ──
  let pruPoolUsd = 0,
    pruPoolChf = 0;
  state.cashFlows.forEach((e) => {
    if (e.ty === 'fx_buy_usd') {
      pruPoolUsd += toFloat(e.a2);
      pruPoolChf += toFloat(e.a1);
    } else if (e.ty === 'fx_buy_chf') {
      const ar = pruPoolUsd > 0 ? pruPoolChf / pruPoolUsd : liveRate;
      pruPoolUsd -= toFloat(e.a1);
      pruPoolChf -= toFloat(e.a1) * ar;
    } else if (e.ty === 'div_usd' || e.ty === 'adj_usd') {
      pruPoolUsd += toFloat(e.a1);
      pruPoolChf += toFloat(e.a1) * liveRate;
    }
    if (pruPoolUsd <= 0.001) {
      pruPoolUsd = 0;
      pruPoolChf = 0;
    }
  });
  const pru = pruPoolUsd > 0 ? pruPoolChf / pruPoolUsd : 0;
  // Single source : computeRecoveryFactor. Resolves the A0-flagged
  // collision (useTradingMetrics's misnamed `calmar` shares this impl).
  const recoveryRaw = computeRecoveryFactor({
    netProfit: realizedPnlUsd,
    maxDD: maxDrawdown,
  });
  const recoveryFactor =
    recoveryRaw === Infinity ? Infinity : recoveryRaw == null ? 0 : roundTo2(recoveryRaw);
  // A2b — Kelly uses the RAW win fraction (winCount/decisive), not the
  // gated percentage, so the formula still computes when decisive < 10.
  // Display layer can independently choose to suppress the value below
  // the gate if desired. Returns null when the inputs are degenerate.
  let kellyPercent = null;
  if (averageLoss > 0 && winFracRaw > 0 && averageWin > 0) {
    const k = (winFracRaw - (1 - winFracRaw) / (averageWin / averageLoss)) * 100;
    kellyPercent = roundTo2Safe(k, null);
  }

  return {
    totalFundedUsd,
    // A3a — distinguishes NATIVE CHF amounts (totalDepositedChf,
    // chfCashBalance, totalEverDepositedChf) which come directly from
    // CHF-denominated cashFlows entries and stay valid regardless of FX
    // status, from FX-DERIVED CHF figures (realizedPnlChf,
    // unrealizedPnlChf, netLiquidationValueChf, monthlyPnlChf,
    // totalFxImpact, openFxImpact) which multiply a USD value by liveRate
    // and are nullified when fxValid is false.
    totalDepositedChf,
    chfCashBalance,
    cashAvailable: cashUsd,
    totalExposure,
    netLiquidationValueUsd,
    netLiquidationValueChf: fxValid ? netLiquidationValueChf : null,
    nlvUsdSide,
    totalEverDepositedChf,
    allocationPercent,
    realizedPnlUsd,
    realizedPnlChf: fxValid ? realizedPnlChf : null,
    unrealizedPnlUsd,
    unrealizedPnlChf: fxValid ? unrealizedPnlChf : null,
    totalAllFees,
    monthlyPnlUsd,
    monthlyPnlChf: fxValid ? monthlyPnlChf : null,
    winRate,
    profitFactor,
    expectancy,
    maxDrawdown,
    equityPoints,
    totalFxImpact: fxValid ? totalFxImpact : null,
    openFxImpact: fxValid ? openFxImpact : null,
    currentStreak,
    maxWinStreak,
    maxLossStreak,
    pru,
    // A3a — `liveRate` exposed as null when invalid, so consumers can
    // gate their CHF derivations on it. `fxValid` is the canonical flag
    // for the UI banner.
    liveRate: fxValid ? rawLiveRate : null,
    fxValid,
    rAverage,
    rStdDev,
    sqn,
    rMultiples,
    averageWin,
    averageLoss,
    sortedTrades,
    sharpeRatio,
    sortinoRatio,
    recoveryFactor,
    kellyPercent,
    calmarRatio,
    // CAGR annualisé alimentant le Calmar (toujours annualisé, même
    // sur < 1 an). Distinct du `cagr` ci-dessous qui respecte cagrMode
    // pour le card label. Affiché dans le tooltip Calmar pour audit.
    cagrAnnPct,
    maxDrawdownPct,
    // Échantillon < 1 an — Sharpe/Sortino/Calmar marqués préliminaires
    // côté UI (RiskMatrix). True quand au moins un ratio est non-null.
    preliminaryRatios,
    yearsActive,
    // A1 — exposed so consumers (e.g. RiskMatrix.jsx) can stop deriving
    // CAGR inline and read the canonical single-source value. Same units
    // as before (percent), same sign convention.
    cagr,
    // A2.2 — `cagrMode` lets the display layer pick "CAGR" (annualised,
    // years ≥ 1) vs "Cumulé" (cumulative return, 0 < years < 1) labels.
    cagrMode: cagrModeValue,
    // A3b — Time-Weighted Return (TWR) chained over funding sub-periods.
    // The performance KPI neutralising the timing of deposits. `twrMode`
    // mirrors `cagrMode` (annualised at years≥1, cumulative below).
    // `twrSubPeriods` exposes the chain length for debug.
    twr,
    twrMode,
    twrSubPeriods,
    // A3b — Real-equity timeline (init+cumPnL per close-date) — single
    // source for drawdowns (risk.js) and the NLV hero badge growth %.
    realEquityPoints,
    // A2.1/A2.2 — initialCapital + its resolution source
    // ('cashReport' | 'cashTransactions' | 'settings' | 'unknown').
    // Consumers (e.g. RiskMatrix.jsx Init Cap cell) read these
    // instead of re-deriving.
    initialCapital,
    initialCapitalSource,
    // A2a — annualised volatility (%) sourced from buildEquitySeries
    // returns. Replaces the legacy `vol30dPct` field (per-trade-treated-
    // as-daily on initialCapital base). Nullable when the significance
    // gate fails (obs<30 / years<0.25 / capitalRef<500).
    volAnnPct,
    winCount,
    lossCount,
    breakEvenCount,
    tradeCount,
    // Drawdown as a percentage of initial capital (USD). Computed
    // above for Calmar; exposed so the StatusBar (and any future
    // consumer) can display a real percent rather than re-deriving
    // a magnitude from `maxDrawdown` (USD). Always ≥ 0; render as
    // a negative number with leading minus to follow the loss
    // convention.
    maxDrawdownPct,
  };
}

// A1 — `computePortfolioGreeks` was retired. The function used to aggregate
// greeks ignoring `pos.dir` (Long/Short), which inverted Theta/Vega signs
// for Sniper-OTM short premium portfolios. All consumers (Positions.jsx,
// Greeks.jsx) now consume `aggregateGreeks` from src/utils/greeks.js
// (sign-aware, theta/day, vega/1%-IV).

// ─── Equity Curve with Drawdown ────────────────────────────

export function computeStreaks(closedTrades, liveRate = 1) {
  if (!closedTrades.length) return { current: null, bestWin: 0, worstLoss: 0 };

  const sorted = closedTrades.slice().sort((a, b) => (a.do || '').localeCompare(b.do || ''));
  let bestWin = 0,
    worstLoss = 0,
    curWin = 0,
    curLoss = 0;

  sorted.forEach((t) => {
    const pnl = tradePnlUsd(t, liveRate);
    if (pnl > 0) {
      curWin++;
      curLoss = 0;
      if (curWin > bestWin) bestWin = curWin;
    } else if (pnl < 0) {
      curLoss++;
      curWin = 0;
      if (curLoss > worstLoss) worstLoss = curLoss;
    }
  });

  const current =
    curWin > 0
      ? { type: 'win', count: curWin }
      : curLoss > 0
        ? { type: 'loss', count: curLoss }
        : null;

  return { current, bestWin, worstLoss };
}

// ─── Equity Curve with Drawdown ────────────────────────────

export function computeEquityCurve(closedTrades, liveRate = 1) {
  if (!closedTrades.length) return [];

  const sorted = closedTrades.slice().sort((a, b) => (a.do || '').localeCompare(b.do || ''));
  let cumPnL = 0,
    peak = 0;

  return sorted.map((t) => {
    const pnl = tradePnlUsd(t, liveRate);
    cumPnL += pnl;
    if (cumPnL > peak) peak = cumPnL;
    return {
      date: t.do || t.di || '',
      pnl: roundTo2(pnl),
      equity: roundTo2(cumPnL),
      drawdown: roundTo2(peak - cumPnL),
    };
  });
}

// ─── Second-Order Greeks Simulation (Vanna, Charm) ────────
// Vanna = dDelta/dVol, Charm = dDelta/dTime
export function computeSecondOrderGreeks(openPositions, greeksMap) {
  let vanna = 0,
    charm = 0,
    vomma = 0,
    gex = 0;
  openPositions.forEach((pos) => {
    if (pos.as !== 'Option') return;
    const g = greeksMap?.get(pos.id);
    if (!g) return;

    // Simulate derived greeks if not provided by broker
    const qty = toFloat(pos.ct) * (pos.dir === 'Short' ? -1 : 1);
    const mul = ensurePositive(pos.mu);

    const posDelta = (g.delta || 0) * qty * mul;
    const posGamma = (g.gamma || 0) * qty * mul;

    // Deterministic approximations
    // Charm: OTM options lose delta over time (negative charm estimate)
    const posCharm = -Math.abs(posDelta) * 0.05;
    // Vanna: Delta change per 1% IV change
    const posVanna = posGamma * 1.5;
    // Vomma: Vega convexity
    const posVomma = (g.vega || 0) * 0.2 * qty * mul;

    gex += posGamma;
    charm += posCharm;
    vanna += posVanna;
    vomma += posVomma;
  });

  return {
    vanna: roundTo2(vanna),
    charm: roundTo2(charm),
    vomma: roundTo2(vomma),
    gex: roundTo2(gex),
    flipPointDistance: gex > 0 ? -1.5 : gex < 0 ? 1.5 : 0, // % distance to zero gamma
  };
}
