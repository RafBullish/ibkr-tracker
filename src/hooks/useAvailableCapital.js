// ═══════════════════════════════════════════════════════════════
//  useAvailableCapital v5 Sprint B — deployable USD estimator (v1)
//
//  Returns the deployable USD an operator could engage in a new
//  position right now, given their current open-positions footprint.
//
//  ⚠ v1 conservative approximation. Replaced with real Buying Power /
//  Excess Liquidity from IBKR Account Summary in Sprint C
//  (api/account-summary/sync.js).
//
//  Formula (Option A — cash-based, margin-aware) :
//    Available_USD = max(0, NLV_USD − Σ notional_USD)
//
//  notional_USD per position type :
//    - Short option : strike × mu × |ct|     (cash-secured / margin-relevant)
//    - Stock        : mark   × mu × |ct|     (market value)
//    - Long option  : mark   × mu × |ct|     (current recoverable value,
//                                             NOT original cost paid;
//                                             v1 approximation, Sprint C
//                                             will use real Reg-T)
//
//  ⚠ Short stocks NOT handled (out of Sniper OTM scope). If a short
//  stock appears in the portfolio, this hook falls back to mark-based
//  notional and may understate the actual margin requirement.
//
//  Edge cases :
//    - NLV null / non-finite              → availableUsd: null + warning
//    - position with ct == 0              → skipped (closed-but-not-purged)
//    - short option with strike missing   → fallback to mark + warning
//                                           (corrupted data signal)
//    - position with neither pc nor pi    → skipped silently
//    - position with pc absent but pi     → fallback to pi + warning
//
//  Returns :
//    {
//      availableUsd: number | null,
//      formula: 'cash-A',
//      warnings: string[]
//    }
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions } from '../store/useStore';
import { usePortfolioMetrics } from './usePortfolioMetrics';
import { toFloat, ensurePositive } from '../utils/math';
import { FRESHNESS } from '../constants/timing';

const FORMULA = 'cash-A';

/**
 * Résout la VRAIE liquidité déployable en USD depuis le snapshot live du
 * bridge IBKR (settings.ibkrLiveData → tag AvailableFunds de
 * ib.accountSummary(), cf. bridge/ibkr_poller.py). C'est la seule source
 * réelle de Buying Power / Available Funds du projet : le Flex (EOD) ne
 * l'expose pas, seul le bridge local le fait.
 *
 * Retourne un nombre USD fini UNIQUEMENT si le snapshot est FRAIS
 * (< FRESHNESS.LIVE_DATA_MAX_AGE_MS, même seuil que le badge LIVE et que
 * l'override NLV de calculations.js) ET porte un AvailableFunds exploitable
 * dans une devise convertible en USD (USD direct, CHF via liveRate — même
 * cascade que l'override NLV bridge). Sinon `null` → l'appelant retombe sur
 * l'estimation cash-A et GARDE le marqueur « est. ». Ne fabrique jamais un
 * chiffre : une devise inattendue ou un snapshot périmé rend `null`.
 *
 * @param {Object|null|undefined} liveData  settings.ibkrLiveData
 * @param {number}                liveRate  taux CHF/USD (settings.liveRate)
 * @param {number}                [nowMs]   horloge injectable (tests)
 * @returns {number|null} liquidité réelle en USD, ou null si non fiable
 */
export function resolveLiveAvailableUsd(liveData, liveRate, nowMs = Date.now()) {
  if (!liveData || !liveData.timestamp) return null;
  const ageMs = nowMs - new Date(liveData.timestamp).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= FRESHNESS.LIVE_DATA_MAX_AGE_MS) {
    return null;
  }
  const af = liveData.availableFunds;
  if (typeof af !== 'number' || !Number.isFinite(af) || af < 0) return null;
  const ccy = liveData.currency;
  if (ccy === 'USD') return af;
  if (ccy === 'CHF' && Number.isFinite(liveRate) && liveRate > 0) return af / liveRate;
  return null; // devise inattendue → pas de conversion fiable → estimation
}

/**
 * Compute the USD notional for a single position. Dispatches by type :
 *   - Short option : strike × mu × |ct|  (cash-secured equivalent)
 *   - Anything else: mark   × mu × |ct|  (market value)
 *
 * Pushes a warning into the provided array (when given) on corrupted-
 * data fallbacks : short option missing strike, or position missing pc.
 *
 * @param {Object}   pos                 position object
 * @param {string[]} [warnings]          mutated when fallbacks fire (optional)
 * @returns {number}                     notional in USD (0 when no usable price)
 */
export function notionalUsd(pos, warnings) {
  const qty = Math.abs(toFloat(pos.ct));
  if (qty === 0) return 0;
  const mul = ensurePositive(pos.mu);
  const isShortOption = pos.as === 'Option' && pos.dir === 'Short';
  const tag = pos.tk || pos.id || 'position';

  if (isShortOption) {
    const strike = toFloat(pos.st);
    if (strike > 0) return qty * mul * strike;
    // Strike absent on a short option = corrupted data. Don't crash —
    // fall through to mark-based notional but flag that the figure
    // understates the real margin requirement.
    if (warnings) {
      warnings.push(
        `${tag}: short option strike missing, falling back to mark (under-estimates margin)`
      );
    }
  }

  const mark = toFloat(pos.pc);
  if (mark > 0) return qty * mul * mark;

  const entry = toFloat(pos.pi);
  if (entry > 0) {
    if (warnings) warnings.push(`${tag}: pc absent, fallback pi`);
    return qty * mul * entry;
  }

  return 0; // no usable price — skip rather than pretend
}

/**
 * Pure builder — exposed for unit tests and future debug views.
 *
 * @param {Array}  positions  open positions array (or null/undefined)
 * @param {number} nlvUsd     net liquidation value in USD
 * @returns {{ availableUsd: number|null, formula: string, warnings: string[] }}
 */
export function computeAvailableCapital(positions, nlvUsd) {
  if (nlvUsd == null || !Number.isFinite(nlvUsd)) {
    return {
      availableUsd: null,
      formula: FORMULA,
      warnings: ['NLV indisponible'],
    };
  }

  const warnings = [];
  let consumedUsd = 0;
  for (const pos of positions || []) {
    consumedUsd += notionalUsd(pos, warnings);
  }

  // TODO Sprint C : remplacer par Excess Liquidity réel issu de
  // api/account-summary/sync.js. Cash-based v1 approxime la marge :
  // strike-based pour shorts ≈ cash-secured, accurate pour stocks
  // et longs. Côté conservateur — pas de risque de promettre du
  // capital qu'on n'a pas.
  const availableUsd = Math.max(0, nlvUsd - consumedUsd);

  return { availableUsd, formula: FORMULA, warnings };
}

/**
 * React hook variant — subscribes to open positions and portfolio
 * metrics, recomputes only when those slices change.
 */
export default function useAvailableCapital() {
  const positions = useOpenPositions();
  const metrics = usePortfolioMetrics();
  const nlvUsd = metrics?.netLiquidationValueUsd;

  return useMemo(() => computeAvailableCapital(positions, nlvUsd), [positions, nlvUsd]);
}
