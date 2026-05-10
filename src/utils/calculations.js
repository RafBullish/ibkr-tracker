// ═══════════════════════════════════════════════════════════════
//  CORE FINANCIAL ENGINE
//  Dual Currency (USD/CHF) + FIFO + FX Impact
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive, roundTo2 } from './math';
import { currentMonthKey, extractMonthKey } from './dates';

// ─── Closed Trade P&L ────────────────────────────────────────

export function calculateClosedTradePnl(trade, fallbackFxRate) {
  const mul = ensurePositive(trade.mu);
  const qty = toFloat(trade.ct);
  const pi = toFloat(trade.pi),
    po = toFloat(trade.po);
  const fi = toFloat(trade.fi),
    fo = toFloat(trade.fo);
  const fxi = toFloat(trade.fxi) || fallbackFxRate;
  const fxo = toFloat(trade.fxo) || fallbackFxRate;
  const isShort = trade.dir === 'Short';

  const grossIn = pi * mul * qty;
  const grossOut = po * mul * qty;

  if (isShort) {
    const entryUsd = grossIn - fi;
    const exitUsd = grossOut + fo;
    return {
      usd: entryUsd - exitUsd,
      chf: entryUsd * fxi - exitUsd * fxo,
      fxImpactChf: entryUsd * (fxi - fxo),
      feesUsd: fi + fo,
    };
  } else {
    const entryUsd = grossIn + fi;
    const exitUsd = grossOut - fo;
    return {
      usd: exitUsd - entryUsd,
      chf: exitUsd * fxo - entryUsd * fxi,
      fxImpactChf: entryUsd * (fxo - fxi),
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
  const fxi = toFloat(position.fxi) || liveRate;
  const isShort = position.dir === 'Short';

  const costBasisUsd = isShort ? pi * mul * qty - fi : pi * mul * qty + fi;
  const curValRaw = pc * mul * qty;
  const mktValUsd = isShort ? -curValRaw : curValRaw;
  const mktValChf = mktValUsd * liveRate;

  const uPnlUsd = isShort ? costBasisUsd - curValRaw : curValRaw - costBasisUsd;
  const uPnlChf = isShort
    ? costBasisUsd * fxi - curValRaw * liveRate
    : curValRaw * liveRate - costBasisUsd * fxi;
  const fxImp = isShort ? costBasisUsd * (fxi - liveRate) : costBasisUsd * (liveRate - fxi);

  return {
    marketValueUsd: mktValUsd,
    marketValueChf: mktValChf,
    unrealizedPnlUsd: uPnlUsd,
    unrealizedPnlChf: uPnlChf,
    fxImpactChf: fxImp,
    costBasisUsd: costBasisUsd,
  };
}

// ─── Full Portfolio Metrics ──────────────────────────────────

export function calculatePortfolioMetrics(state) {
  const liveRate = toFloat(state.settings.liveRate) || 1;

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
    } else if (e.ty === 'div_usd' || e.ty === 'adj_usd') totalFundedUsd += a1;
    else if (e.ty === 'fee_usd') totalFundedUsd -= a1;
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
  // Prefer IBKR CashReport per-currency balances (authoritative) over reconstruction
  const cashReport = state.settings?.cashReport;
  const hasCurrencyBalances =
    cashReport?.currencies?.USD != null || cashReport?.currencies?.CHF != null;

  const cashUsd = hasCurrencyBalances
    ? roundTo2(cashReport.currencies.USD?.endingCash || 0)
    : roundTo2(totalFundedUsd + realizedPnlUsd - capitalTiedUp);
  const chfCashBalance = hasCurrencyBalances
    ? roundTo2(cashReport.currencies.CHF?.endingCash || 0)
    : roundTo2(totalDepositedChf);

  const positionsValueUsd = state.openPositions.reduce((s, p) => {
    return s + toFloat(p.pc) * ensurePositive(p.mu) * toFloat(p.ct) * (p.dir === 'Short' ? -1 : 1);
  }, 0);
  const nlvUsdSide = roundTo2(cashUsd + positionsValueUsd);
  const netLiquidationValueChf = roundTo2(nlvUsdSide * liveRate + chfCashBalance);
  const netLiquidationValueUsd = roundTo2(
    nlvUsdSide + (liveRate > 0 ? chfCashBalance / liveRate : 0)
  );

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

  // ── Win Rate / Profit Factor / Expectancy ──
  let winCount = 0,
    lossCount = 0,
    breakEvenCount = 0,
    totalGains = 0,
    totalLosses = 0;
  state.closedTrades.forEach((t) => {
    const pnl = tradePnlUsd(t, liveRate);
    if (pnl > 0) {
      winCount++;
      totalGains += pnl;
    } else if (pnl < 0) {
      lossCount++;
      totalLosses += Math.abs(pnl);
    } else {
      breakEvenCount++;
    }
  });
  const tradeCount = state.closedTrades.length;
  const decisiveTrades = winCount + lossCount;
  const winRate = decisiveTrades > 0 ? roundTo2((winCount / decisiveTrades) * 100) : 0;
  const profitFactor =
    totalLosses === 0 ? (totalGains > 0 ? Infinity : 0) : roundTo2(totalGains / totalLosses);
  const averageWin = winCount > 0 ? totalGains / winCount : 0;
  const averageLoss = lossCount > 0 ? totalLosses / lossCount : 0;
  const expectancy =
    decisiveTrades > 0
      ? roundTo2((winRate / 100) * averageWin - (1 - winRate / 100) * averageLoss)
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

  // ── Streaks & Drawdown ──
  let maxWinStreak = 0,
    maxLossStreak = 0,
    currentWinStreak = 0,
    currentLossStreak = 0;
  const sortedTrades = state.closedTrades
    .slice()
    .sort((a, b) => (a.do || '').localeCompare(b.do || ''));
  let equityCurve = 0,
    equityPeak = 0,
    maxDrawdown = 0;
  const equityPoints = [0];
  sortedTrades.forEach((t) => {
    const pnl = tradePnlUsd(t, liveRate);
    equityCurve += pnl;
    equityPoints.push(equityCurve);
    if (equityCurve > equityPeak) equityPeak = equityCurve;
    const dd = equityPeak - equityCurve;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  });
  const currentStreak = currentWinStreak > 0 ? currentWinStreak : -currentLossStreak;

  // ── Sharpe / Sortino ──
  const monthlyReturns = {};
  state.closedTrades.forEach((t) => {
    const k = extractMonthKey(t.do);
    if (k) monthlyReturns[k] = (monthlyReturns[k] || 0) + tradePnlUsd(t, liveRate);
  });
  const returnValues = Object.values(monthlyReturns);
  let sharpeRatio = 0,
    sortinoRatio = 0;
  if (returnValues.length > 1) {
    const avgReturn = returnValues.reduce((a, b) => a + b, 0) / returnValues.length;
    const downsideDev = Math.sqrt(
      Math.max(
        0,
        returnValues.filter((r) => r < 0).reduce((s, r) => s + r * r, 0) / returnValues.length
      )
    );
    sortinoRatio = downsideDev > 0 ? roundTo2(avgReturn / downsideDev) : 0;
    const totalStdDev = Math.sqrt(
      Math.max(
        0,
        returnValues.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returnValues.length
      )
    );
    sharpeRatio = totalStdDev > 0 ? roundTo2(avgReturn / totalStdDev) : 0;
  }

  // ── CAGR & Calmar Ratio ──
  // Use total deposited capital (USD-equivalent) as invested base, not NLV which moves with P&L.
  // If we lack funding data, fall back to the current cost basis proxy (capital tied up + realized).
  const firstTradeDate = sortedTrades.length > 0 ? new Date(sortedTrades[0].do) : new Date();
  const lastTradeDate =
    sortedTrades.length > 0
      ? new Date(sortedTrades[sortedTrades.length - 1].do || new Date())
      : new Date();
  const daysActive = Math.max(1, (lastTradeDate - firstTradeDate) / (1000 * 60 * 60 * 24));
  const yearsActive = daysActive / 365.25;

  // Invested capital: prefer USD deposits, fallback to CHF converted at current rate
  const depositedUsdEq = totalFundedUsd + (liveRate > 0 ? totalDepositedChf / liveRate : 0);
  const initialCapital = depositedUsdEq > 0 ? depositedUsdEq : 0;
  const endCapital = initialCapital + realizedPnlUsd;

  const cagr =
    initialCapital > 0 && yearsActive > 0 && endCapital > 0
      ? (Math.pow(endCapital / initialCapital, 1 / yearsActive) - 1) * 100
      : 0;

  // Calmar = CAGR / max drawdown as a percentage of initial capital
  const maxDrawdownPct = initialCapital > 0 ? (maxDrawdown / initialCapital) * 100 : 0;
  const calmarRatio = maxDrawdownPct > 0 ? roundTo2(cagr / maxDrawdownPct) : 0;

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
  const recoveryFactor =
    maxDrawdown > 0 ? roundTo2(realizedPnlUsd / maxDrawdown) : realizedPnlUsd > 0 ? Infinity : 0;
  let kellyPercent = 0;
  if (averageLoss > 0 && winRate > 0) {
    const wp = winRate / 100;
    kellyPercent = roundTo2((wp - (1 - wp) / (averageWin / averageLoss)) * 100);
  }

  return {
    totalFundedUsd,
    totalDepositedChf,
    chfCashBalance,
    cashAvailable: cashUsd,
    totalExposure,
    netLiquidationValueUsd,
    netLiquidationValueChf,
    nlvUsdSide,
    totalEverDepositedChf,
    allocationPercent,
    realizedPnlUsd,
    realizedPnlChf,
    unrealizedPnlUsd,
    unrealizedPnlChf,
    totalAllFees,
    monthlyPnlUsd,
    monthlyPnlChf,
    winRate,
    profitFactor,
    expectancy,
    maxDrawdown,
    equityPoints,
    totalFxImpact,
    openFxImpact,
    currentStreak,
    maxWinStreak,
    maxLossStreak,
    pru,
    liveRate,
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

// ─── Equity Curve with Drawdown ────────────────────────────

export function computePortfolioGreeks(openPositions, greeksMap) {
  let totalDelta = 0,
    totalGamma = 0,
    totalTheta = 0,
    totalVega = 0;
  let positionCount = 0;

  openPositions.forEach((pos) => {
    if (pos.as !== 'Option') return;
    const g = greeksMap?.get(pos.id);
    if (!g) return;
    const qty = toFloat(pos.ct);
    const mul = ensurePositive(pos.mu);
    if (g.delta != null) totalDelta += g.delta * qty * mul;
    if (g.gamma != null) totalGamma += g.gamma * qty * mul;
    if (g.theta != null) totalTheta += g.theta * qty * mul;
    if (g.vega != null) totalVega += g.vega * qty * mul;
    positionCount++;
  });

  return {
    totalDelta: roundTo2(totalDelta),
    totalGamma: roundTo2(totalGamma),
    totalTheta: roundTo2(totalTheta),
    totalVega: roundTo2(totalVega),
    positionCount,
  };
}

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
