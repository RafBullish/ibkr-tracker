// ═══════════════════════════════════════════════════════════════
//  POSITION GREEKS — IV cascade (a)→(b)→(c)
//
//  Wrapper léger autour de blackScholes.js qui résout σ pour une
//  position donnée avec trois sources possibles, dans l'ordre :
//
//   (a) bsImpliedVol depuis le mark figé du CSV (pos.pc).
//       Échoue quand mark < intrinsic (positions ITM stales),
//       mark = 0, vega ≈ 0, expiry passée.
//   (b) chainIv de l'underlying : strike-matched sinon ATM.
//       Source = cache localStorage `qc:chainIv:{tk}` écrit par
//       Chain.jsx au load (opportuniste — vide jusqu'à ce qu'on
//       ouvre la chaîne au moins une fois pour ce ticker).
//   (c) Défaut σ = 0.30 + flag ivEstimated:true. Toujours produit
//       des Greeks lisibles ; le delta deep-ITM est robuste à σ
//       (proche de 1.0 ou 0 quasi indépendamment de la vol).
//
//  Sortie : per-share Greeks (convention existante du greeksMap).
//  Le multiplier ×100 et le ×qty×dirSign sont appliqués au call-site
//  (aggregateGreeks dans greeks.js, ou projection display dans
//  useLivePositions). Single source of truth, pas de double calcul.
//
//  Taux : r = RISK_FREE_RATE (0.04) par défaut — un seul taux dans
//  le repo, partagé avec Chain.jsx. Surchargeable par param.
// ═══════════════════════════════════════════════════════════════

import { bsGreeks, bsImpliedVol, RISK_FREE_RATE } from './options/blackScholes';

const DEFAULT_SIGMA = 0.30;
const CHAIN_IV_CACHE_KEY_PREFIX = 'qc:chainIv:';
const CHAIN_IV_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Lit le cache chainIv localStorage pour un ticker.
 *
 * Forme attendue (écrite par Chain.jsx au load) :
 *   {
 *     timestamp: 1733000000000,
 *     atm: 0.273,
 *     byStrike: { '520': 0.281, '525': 0.275, ... }
 *   }
 *
 * Retourne null si absent, expiré (>24h), ou structure cassée.
 *
 * @param {string} ticker
 * @returns {{atm: number|null, byStrike: Record<string, number>}|null}
 */
export function readChainIvCache(ticker) {
  if (!ticker || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHAIN_IV_CACHE_KEY_PREFIX + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      !Number.isFinite(parsed.timestamp) ||
      Date.now() - parsed.timestamp > CHAIN_IV_MAX_AGE_MS
    ) {
      return null;
    }
    return {
      atm: Number.isFinite(parsed.atm) && parsed.atm > 0 ? parsed.atm : null,
      byStrike:
        parsed.byStrike && typeof parsed.byStrike === 'object' ? parsed.byStrike : {},
    };
  } catch {
    return null;
  }
}

/**
 * Sélecteur σ via cascade (a)→(b)→(c). Pure, testable.
 *
 * @returns {{sigma: number, source: 'mark'|'chain'|'default', ivEstimated: boolean}}
 */
function pickSigma({ spot, K, T, r, type, mark, chainIv }) {
  // (a) IV inversée depuis le mark.
  if (Number.isFinite(mark) && mark > 0) {
    const iv = bsImpliedVol({ S: spot, K, T, r, marketPrice: mark, type });
    if (Number.isFinite(iv) && iv > 0) {
      return { sigma: iv, source: 'mark', ivEstimated: false };
    }
  }

  // (b) Chain IV — strike-matched puis ATM.
  if (chainIv) {
    const byStrike = chainIv.byStrike || {};
    const exact = byStrike[String(K)];
    if (Number.isFinite(exact) && exact > 0) {
      return { sigma: exact, source: 'chain', ivEstimated: false };
    }
    if (Number.isFinite(chainIv.atm) && chainIv.atm > 0) {
      return { sigma: chainIv.atm, source: 'chain', ivEstimated: false };
    }
  }

  // (c) Défaut robuste.
  return { sigma: DEFAULT_SIGMA, source: 'default', ivEstimated: true };
}

/**
 * Greeks per-share d'une position option avec cascade IV.
 *
 * @param {Object} pos - Position du store (.tk, .ty, .st, .ex, .pc, .as)
 * @param {Object} ctx
 * @param {number} ctx.spot - Underlying spot price (requis)
 * @param {{atm: number, byStrike: Record<string, number>}|null} [ctx.chainIv]
 *   Surface IV du ticker — si absent, fallback (c) σ=0.30.
 * @param {number} [ctx.r=RISK_FREE_RATE] - Risk-free rate (défaut: 0.04)
 * @param {number} [ctx.now] - Timestamp ms pour calcul T (défaut: Date.now())
 * @returns {{
 *   delta: number, gamma: number, theta: number, vega: number,
 *   sigma: number, ivEstimated: boolean, source: 'mark'|'chain'|'default',
 *   iv: number, spot: number
 * } | null}
 *
 * Returns null si inputs invalides (spot manquant, expiry passée, strike absent).
 * Theta is per-share per-YEAR, vega per-share per-1.00σ — consumers divide
 * by 365 / 100 at display time (existing convention, cf. greeks.js).
 */
export function positionGreeks(pos, ctx = {}) {
  if (!pos || pos.as !== 'Option') return null;
  const { spot, chainIv = null, r = RISK_FREE_RATE, now = Date.now() } = ctx;

  if (!Number.isFinite(spot) || spot <= 0) return null;

  const K = parseFloat(pos.st);
  if (!Number.isFinite(K) || K <= 0) return null;

  const mark = parseFloat(pos.pc);

  const expiryMs = Date.parse(pos.ex + 'T12:00:00');
  if (!Number.isFinite(expiryMs)) return null;
  const T = (expiryMs - now) / (365 * 86_400_000);
  if (!(T > 0)) return null;

  const type = pos.ty === 'PUT' ? 'put' : 'call';

  const { sigma, source, ivEstimated } = pickSigma({
    spot,
    K,
    T,
    r,
    type,
    mark,
    chainIv,
  });

  const g = bsGreeks({ S: spot, K, T, r, sigma, type });
  if (!g) return null;

  return {
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta, // per-share per-YEAR
    vega: g.vega, // per-share per-1.00σ
    sigma,
    iv: sigma, // alias pour rétrocompat consumers existants
    ivEstimated,
    source,
    spot,
  };
}

export default positionGreeks;
