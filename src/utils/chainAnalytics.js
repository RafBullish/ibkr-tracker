// Pure utils consumed by the Chain page footer.
//   - Max Pain    : strike minimising total OI-weighted cash payoff
//   - RR25 Skew   : IV(call 25Δ) − IV(put 25Δ); equity-normal < 0
//   - Top OI      : top-N strikes by combined call+put OI
//   - GEX ladder  : per-strike gamma exposure + Net GEX, walls, flip
//   - ATM IV      : median IV across the 5 strikes nearest spot
//
// Row shape : { strike, call: { iv, openInterest, gamma, delta }, put: {...} }.

// Max Pain — strike S minimising Σ OI × max(S−K,0) for calls and
// Σ OI × max(K−S,0) for puts across the chain. Returns null when no
// OI is available.
export function computeMaxPain(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const strikes = rows.map((r) => Number(r.strike)).filter(Number.isFinite);
  if (strikes.length === 0) return null;

  // Pre-extract OI series. A row with neither call nor put OI is dropped.
  const callOi = rows.map((r) => ({
    K: Number(r.strike),
    oi: Number.isFinite(r.call?.openInterest) ? r.call.openInterest : 0,
  }));
  const putOi = rows.map((r) => ({
    K: Number(r.strike),
    oi: Number.isFinite(r.put?.openInterest) ? r.put.openInterest : 0,
  }));

  const totalOi = callOi.reduce((s, c) => s + c.oi, 0) + putOi.reduce((s, p) => s + p.oi, 0);
  if (totalOi === 0) return null;

  let bestStrike = null;
  let bestPayoff = Infinity;
  for (const S of strikes) {
    let pay = 0;
    for (const c of callOi) {
      if (c.oi > 0) pay += c.oi * Math.max(S - c.K, 0);
    }
    for (const p of putOi) {
      if (p.oi > 0) pay += p.oi * Math.max(p.K - S, 0);
    }
    if (pay < bestPayoff) {
      bestPayoff = pay;
      bestStrike = S;
    }
  }
  return bestStrike == null ? null : { strike: bestStrike, payoff: bestPayoff };
}

// 25Δ Risk Reversal — IV(call closest to +0.25Δ) − IV(put closest to
// −0.25Δ). Equity-normal value is negative (puts pricier than calls).
// Returns null when either anchor is missing or too far from ±0.25.
export function computeRR25(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let bestCall = null;
  let bestPut = null;
  for (const r of rows) {
    const c = r.call;
    if (c && Number.isFinite(c.delta) && Number.isFinite(c.iv) && c.iv > 0) {
      const dist = Math.abs(c.delta - 0.25);
      if (!bestCall || dist < bestCall.dist) {
        bestCall = { dist, iv: c.iv, strike: r.strike };
      }
    }
    const p = r.put;
    if (p && Number.isFinite(p.delta) && Number.isFinite(p.iv) && p.iv > 0) {
      const dist = Math.abs(p.delta - -0.25);
      if (!bestPut || dist < bestPut.dist) {
        bestPut = { dist, iv: p.iv, strike: r.strike };
      }
    }
  }

  if (!bestCall || !bestPut) return null;
  // Reject anchors that are far from the 0.25 target — without a
  // proper 25Δ strike we'd otherwise return spurious skew numbers
  // from heavy-ITM or deep-OTM contracts.
  const MAX_DIST = 0.15;
  if (bestCall.dist > MAX_DIST || bestPut.dist > MAX_DIST) return null;
  // Yahoo IV is already a fraction (0.24 = 24%) ; multiply for display
  const callIvPct = bestCall.iv * 100;
  const putIvPct = bestPut.iv * 100;
  return {
    rr25: callIvPct - putIvPct,
    callIv: callIvPct,
    putIv: putIvPct,
    callStrike: bestCall.strike,
    putStrike: bestPut.strike,
  };
}

// Top N strikes by combined call+put OI — quick "pin / wall" reading.
export function topOiStrikes(rows, n = 5) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows
    .map((r) => ({
      strike: r.strike,
      callOi: Number.isFinite(r.call?.openInterest) ? r.call.openInterest : 0,
      putOi: Number.isFinite(r.put?.openInterest) ? r.put.openInterest : 0,
      total:
        (Number.isFinite(r.call?.openInterest) ? r.call.openInterest : 0) +
        (Number.isFinite(r.put?.openInterest) ? r.put.openInterest : 0),
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

// Per-strike gamma exposure. Sign is dealer-positioning oriented :
//   POSITIVE GEX → dealers stabilize → mean-reverting regime
//   NEGATIVE GEX → dealers amplify  → vol expansion / trend regime
// Returns ladder sorted by strike asc : [{ strike, callGex, putGex, netGex, callOi, putOi }].
export function computeGEX(rows, spot) {
  if (!Array.isArray(rows) || rows.length === 0 || !Number.isFinite(spot) || spot <= 0) {
    return [];
  }
  const ladder = [];
  const s2 = spot * spot;
  for (const r of rows) {
    const K = Number(r.strike);
    if (!Number.isFinite(K)) continue;
    const cg = r.call?.gamma;
    const pg = r.put?.gamma;
    const cOi = r.call?.openInterest;
    const pOi = r.put?.openInterest;
    const callGex = Number.isFinite(cg) && Number.isFinite(cOi) ? cg * cOi * 100 * s2 : 0;
    const putGex = Number.isFinite(pg) && Number.isFinite(pOi) ? pg * pOi * 100 * s2 : 0;
    ladder.push({
      strike: K,
      callGex,
      putGex: -putGex, // negative side of net
      netGex: callGex - putGex,
      callOi: Number.isFinite(cOi) ? cOi : 0,
      putOi: Number.isFinite(pOi) ? pOi : 0,
    });
  }
  return ladder.sort((a, b) => a.strike - b.strike);
}

// Threshold tuned to ignore rounding noise — magnitude scales with S².
// ~1B$ notional gamma at SPX-ish levels.
const GEX_REGIME_THRESHOLD = 1e8;

function netGexFromLadder(ladder) {
  if (ladder.length === 0) return null;
  const total = ladder.reduce((s, r) => s + r.netGex, 0);
  let regime = 'NEUTRAL_GEX';
  if (total > GEX_REGIME_THRESHOLD) regime = 'POSITIVE_GEX';
  else if (total < -GEX_REGIME_THRESHOLD) regime = 'NEGATIVE_GEX';
  return { total, regime };
}

function callWallFromLadder(ladder, spot) {
  if (ladder.length === 0 || !Number.isFinite(spot)) return null;
  let best = null;
  for (const r of ladder) {
    if (r.strike <= spot) continue;
    if (r.callGex <= 0) continue;
    if (!best || r.callGex > best.callGex) best = r;
  }
  return best ? { strike: best.strike, callGex: best.callGex } : null;
}

function putWallFromLadder(ladder, spot) {
  if (ladder.length === 0 || !Number.isFinite(spot)) return null;
  let best = null;
  for (const r of ladder) {
    if (r.strike >= spot) continue;
    if (r.putGex >= 0) continue;
    if (!best || r.putGex < best.putGex) best = r;
  }
  return best ? { strike: best.strike, putGex: best.putGex } : null;
}

function gammaFlipFromLadder(ladder) {
  if (ladder.length < 2) return null;
  for (let i = 0; i < ladder.length - 1; i += 1) {
    const a = ladder[i].netGex;
    const b = ladder[i + 1].netGex;
    if (a === 0 && b === 0) continue;
    if (a >= 0 !== b >= 0) {
      return { strike: ladder[i].strike, nextStrike: ladder[i + 1].strike };
    }
  }
  return null;
}

export function computeNetGEX(rows, spot) {
  return netGexFromLadder(computeGEX(rows, spot));
}

export function findCallWall(rows, spot) {
  return callWallFromLadder(computeGEX(rows, spot), spot);
}

export function findPutWall(rows, spot) {
  return putWallFromLadder(computeGEX(rows, spot), spot);
}

export function findGammaFlip(rows, spot) {
  return gammaFlipFromLadder(computeGEX(rows, spot));
}

// Single-pass batch helper for callers that need every GEX-derived
// metric at once — builds the ladder once instead of four times.
export function computeChainGEXAnalytics(rows, spot) {
  const ladder = computeGEX(rows, spot);
  return {
    netGex: netGexFromLadder(ladder),
    callWall: callWallFromLadder(ladder, spot),
    putWall: putWallFromLadder(ladder, spot),
    gammaFlip: gammaFlipFromLadder(ladder),
  };
}

// Median IV across the 5 strikes nearest spot — quick proxy for ATM IV
// when no surface metric is exposed. Returns null on insufficient data.
// Expressed as fraction (0..1), matching Yahoo's iv units.
export function computeAtmIv(rows, spot) {
  if (!Array.isArray(rows) || rows.length === 0 || !spot) return null;
  const sorted = [...rows].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));
  const ivs = [];
  for (const r of sorted.slice(0, 5)) {
    if (Number.isFinite(r.call?.iv) && r.call.iv > 0) ivs.push(r.call.iv);
    if (Number.isFinite(r.put?.iv) && r.put.iv > 0) ivs.push(r.put.iv);
  }
  if (ivs.length === 0) return null;
  ivs.sort((a, b) => a - b);
  return ivs[Math.floor(ivs.length / 2)];
}
