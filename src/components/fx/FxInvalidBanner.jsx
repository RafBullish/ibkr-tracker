// ═══════════════════════════════════════════════════════════════
//  FxInvalidBanner — sticky top banner when the USD/CHF rate is
//  INVALID (missing, zero, non-finite, out of bounds).
//
//  Sibling of FxStaleBanner :
//    - FxStaleBanner   : rate exists but old (>24 h / >7 d).
//    - FxInvalidBanner : rate exists but unusable (A3a guard).
//
//  Mounted ONCE at App root. Reads `metrics.fxValid` produced by
//  src/utils/calculations.js — when false, CHF emissions in
//  metrics.* are null and the UI should advertise "FX KO → USD natif".
//
//  Reuses .fx-stale-banner CSS for visual consistency ; tone is
//  always "critical" (an invalid rate is more severe than just old).
// ═══════════════════════════════════════════════════════════════

import { AlertOctagon, RefreshCw } from 'lucide-react';
import { useFx } from '../../hooks/useFx';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';

export default function FxInvalidBanner() {
  const metrics = usePortfolioMetrics();
  const { refresh } = useFx();

  // fxValid is the canonical A3a flag. False = the rate failed
  // isValidFxRate() (undefined, NaN, ≤ 0.01, ≥ 100). Display layer
  // already nullifies CHF metrics ; the banner explains why "—" shows up.
  if (metrics?.fxValid !== false) return null;

  return (
    <div role="alert" className="fx-stale-banner fx-stale-banner--critical">
      <AlertOctagon size={16} aria-hidden="true" />
      <span className="fx-stale-banner__text">
        Taux USD/CHF indisponible — montants affichés en USD natif uniquement.
      </span>
      <button
        type="button"
        className="fx-stale-banner__action"
        onClick={() => refresh()}
        aria-label="Récupérer le taux"
      >
        <RefreshCw size={12} aria-hidden="true" />
        Récupérer
      </button>
    </div>
  );
}
