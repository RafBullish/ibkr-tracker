// ═══════════════════════════════════════════════════════════════
//  BLACK-SCHOLES SOLVER
//
//  European option pricing, Greeks, implied-volatility inversion, and
//  an IV rank helper. Pure math — zero React, zero store, zero I/O.
//
//  Conventions
//  ───────────
//  - S : underlying spot
//  - K : strike
//  - T : time to expiry in YEARS (e.g. 120 DTE → 120/365)
//  - r : risk-free rate (fraction, e.g. 0.04 for 4%)
//  - q : continuous dividend yield (fraction, default 0). Equity
//        options without dividend = 0 ; index/ETF call sites may
//        pass q>0. Pass-through param ; q=0 is byte-identical to
//        the dividend-free formulas (e^(-qT) = 1).
//  - sigma : annualized IV (fraction, e.g. 0.30 for 30%)
//  - type : 'call' | 'put'
//  - Greeks are per-share. Consumers multiply by the contract
//    multiplier (100 for US equity options) when aggregating.
//  - Vega is per 1.00 change in sigma; theta is per YEAR. Divide
//    by 100 / 365 at the call site if per-% or per-day is desired.
//
//  All public functions return null (never throw) when inputs are
//  invalid, non-finite, or out of bracket.
// ═══════════════════════════════════════════════════════════════

export const RISK_FREE_RATE = 0.04;

// ── Standard normal helpers ───────────────────────────────────

function normalPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// CDF via Abramowitz-Stegun 7.1.26 (erf approximation, max error ≈ 1.5e-7).
function erf(y) {
  const sign = y < 0 ? -1 : 1;
  const ay = Math.abs(y);
  const t = 1 / (1 + 0.3275911 * ay);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - poly * Math.exp(-ay * ay));
}

export function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// ── Input validation ──────────────────────────────────────────

function validSpotStrikeTime(S, K, T) {
  return Number.isFinite(S) && Number.isFinite(K) && Number.isFinite(T) && S > 0 && K > 0 && T > 0;
}

function validSigma(sigma) {
  return Number.isFinite(sigma) && sigma > 0;
}

function validType(type) {
  return type === 'call' || type === 'put';
}

// ── Core pricing ──────────────────────────────────────────────

export function bsPrice({ S, K, T, r = RISK_FREE_RATE, q = 0, sigma, type }) {
  if (!validSpotStrikeTime(S, K, T) || !validSigma(sigma) || !validType(type)) return null;
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null;

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const Sd = S * Math.exp(-q * T);
  const Kd = K * Math.exp(-r * T);

  if (type === 'call') {
    return Sd * normalCdf(d1) - Kd * normalCdf(d2);
  }
  return Kd * normalCdf(-d2) - Sd * normalCdf(-d1);
}

// ── Greeks (per share) ────────────────────────────────────────

export function bsGreeks({ S, K, T, r = RISK_FREE_RATE, q = 0, sigma, type }) {
  if (!validSpotStrikeTime(S, K, T) || !validSigma(sigma) || !validType(type)) return null;
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null;

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const pdfD1 = normalPdf(d1);
  const Sd = S * Math.exp(-q * T);
  const Kd = K * Math.exp(-r * T);

  const gamma = (Math.exp(-q * T) * pdfD1) / (S * sigma * sqrtT);
  const vega = Sd * pdfD1 * sqrtT;

  if (type === 'call') {
    const delta = Math.exp(-q * T) * normalCdf(d1);
    const theta =
      -(Sd * pdfD1 * sigma) / (2 * sqrtT) - r * Kd * normalCdf(d2) + q * Sd * normalCdf(d1);
    const rho = K * T * Math.exp(-r * T) * normalCdf(d2);
    return { delta, gamma, theta, vega, rho };
  }
  const delta = Math.exp(-q * T) * (normalCdf(d1) - 1);
  const theta =
    -(Sd * pdfD1 * sigma) / (2 * sqrtT) + r * Kd * normalCdf(-d2) - q * Sd * normalCdf(-d1);
  const rho = -K * T * Math.exp(-r * T) * normalCdf(-d2);
  return { delta, gamma, theta, vega, rho };
}

// ── Implied volatility ────────────────────────────────────────

const IV_MIN_SIGMA = 0.01;
const IV_MAX_SIGMA = 5.0;
const IV_TOL = 1e-6;
const IV_PRICE_TOL = 1e-4;
const IV_NEWTON_ITER = 50;
const IV_BISECT_ITER = 100;
const IV_MIN_VEGA = 1e-10;

export function bsImpliedVol({ S, K, T, r = RISK_FREE_RATE, q = 0, marketPrice, type }) {
  if (!validSpotStrikeTime(S, K, T) || !validType(type)) return null;
  if (!Number.isFinite(r) || !Number.isFinite(q)) return null;
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return null;

  // No-arbitrage bounds: price must sit between intrinsic and the
  // contract's upper bound. Outside that bracket, no σ exists.
  const Sd = S * Math.exp(-q * T);
  const Kd = K * Math.exp(-r * T);
  const intrinsic = type === 'call' ? Math.max(Sd - Kd, 0) : Math.max(Kd - Sd, 0);
  const upperBound = type === 'call' ? Sd : Kd;
  if (marketPrice < intrinsic - IV_PRICE_TOL) return null;
  if (marketPrice > upperBound + IV_PRICE_TOL) return null;

  // Newton-Raphson — fast when vega is well-behaved.
  let sigma = 0.3;
  for (let i = 0; i < IV_NEWTON_ITER; i++) {
    const price = bsPrice({ S, K, T, r, q, sigma, type });
    if (price == null) break;
    const diff = price - marketPrice;
    if (Math.abs(diff) < IV_PRICE_TOL) return sigma;

    const greeks = bsGreeks({ S, K, T, r, q, sigma, type });
    if (!greeks || Math.abs(greeks.vega) < IV_MIN_VEGA) break;

    let next = sigma - diff / greeks.vega;
    if (next < IV_MIN_SIGMA) next = IV_MIN_SIGMA;
    if (next > IV_MAX_SIGMA) next = IV_MAX_SIGMA;
    if (Math.abs(next - sigma) < IV_TOL) return next;
    sigma = next;
  }

  // Bisection fallback — slower but guaranteed to converge if the
  // root exists within the [MIN, MAX] bracket.
  let lo = IV_MIN_SIGMA;
  let hi = IV_MAX_SIGMA;
  const priceAtLo = bsPrice({ S, K, T, r, q, sigma: lo, type });
  const priceAtHi = bsPrice({ S, K, T, r, q, sigma: hi, type });
  if (priceAtLo == null || priceAtHi == null) return null;
  if ((priceAtLo - marketPrice) * (priceAtHi - marketPrice) > 0) return null;

  for (let i = 0; i < IV_BISECT_ITER; i++) {
    const mid = (lo + hi) / 2;
    const priceMid = bsPrice({ S, K, T, r, q, sigma: mid, type });
    if (priceMid == null) return null;
    const diff = priceMid - marketPrice;
    if (Math.abs(diff) < IV_PRICE_TOL) return mid;
    if ((priceAtLo - marketPrice) * diff < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
    if (Math.abs(hi - lo) < IV_TOL) return mid;
  }
  return (lo + hi) / 2;
}

// ── IV rank ───────────────────────────────────────────────────

const IV_RANK_MIN_SAMPLES = 30;

export function ivRank(ivHistory, currentIv) {
  if (!Array.isArray(ivHistory) || !Number.isFinite(currentIv)) return null;
  const clean = ivHistory.filter((v) => Number.isFinite(v));
  if (clean.length < IV_RANK_MIN_SAMPLES) return null;

  let lo = clean[0];
  let hi = clean[0];
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] < lo) lo = clean[i];
    if (clean[i] > hi) hi = clean[i];
  }
  if (hi - lo < 1e-9) return null;
  return ((currentIv - lo) / (hi - lo)) * 100;
}
