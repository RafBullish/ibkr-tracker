// ═══════════════════════════════════════════════════════════════
//  SECTORS UTILS v4 brick 7 — purs
//
//  Helpers pour le module Sector Heatmap :
//    - sectorShortCode  : long code fixture → 3-4 letter spec code
//    - sectorTone       : perf % → 'profit-strong' | 'profit' |
//                         'mute' | 'loss' | 'loss-strong'
//    - sectorAlpha      : opacité de fond proportionnelle à |perf|
// ═══════════════════════════════════════════════════════════════

/**
 * Mappe le code GICS long de la fixture vers le code court demandé
 * par la spec brick 7 (3-4 lettres).
 *
 *   IT → TECH         CONS_DISC → DISC      HC → HLTH
 *   IND → INDU        CONS_STAP → STAP      autres → as-is
 */
const SECTOR_CODE_MAP = {
  IT: 'TECH',
  COMM: 'COMM',
  CONS_DISC: 'DISC',
  CONS_STAP: 'STAP',
  FIN: 'FIN',
  HC: 'HLTH',
  IND: 'INDU',
  ENRG: 'ENRG',
  UTIL: 'UTIL',
  MAT: 'MAT',
  RE: 'RE',
};

export function sectorShortCode(code) {
  if (!code) return '—';
  return SECTOR_CODE_MAP[code] || code.slice(0, 4);
}

/**
 * 5 buckets de tone selon la perf jour :
 *   pct ≥  +1.5    → 'profit-strong'
 *   +0.5 ≤ pct     → 'profit'
 *   |pct| < 0.5    → 'mute'
 *   pct ≤ −0.5     → 'loss'
 *   pct ≤ −1.5     → 'loss-strong'
 */
export function sectorTone(pct) {
  if (pct == null || !Number.isFinite(pct)) return 'mute';
  if (pct >= 1.5) return 'profit-strong';
  if (pct >= 0.5) return 'profit';
  if (pct <= -1.5) return 'loss-strong';
  if (pct <= -0.5) return 'loss';
  return 'mute';
}

/**
 * Opacité (0..1) proportionnelle à |perf|. Utilisée pour piloter
 * un background-color via color-mix sans nécessiter de stops
 * supplémentaires.
 *
 *   |pct| ≥ 3       → 0.6  (cap pour lisibilité texte)
 *   |pct| ≥ 0.5     → 0.2 → 0.6 progressif
 *   |pct| < 0.5     → 0.05 (mute floor)
 *
 * V4 brick 11 fix : cap à 0.6 (vs 1.0 avant). À alpha=1 le bg
 * pure --profit/loss rendait le texte var(--profit/loss) invisible
 * (même couleur). Cap 0.6 garde l'effet « saturated » bien marqué
 * tout en laissant un contraste suffisant pour lire le %.
 */
export function sectorAlpha(pct) {
  if (pct == null || !Number.isFinite(pct)) return 0.05;
  const abs = Math.abs(pct);
  if (abs >= 3) return 0.6;
  if (abs >= 0.5) {
    return Number((0.2 + ((abs - 0.5) / 2.5) * 0.4).toFixed(2));
  }
  return 0.05;
}
