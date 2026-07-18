// ═══════════════════════════════════════════════════════════════
//  formatKpi — formateurs KPI partagés (v1.0 · 1.C)
//
//  Convention monétaire des decks (héritée des KPI cards, extraite du
//  CommandDeck 1.A — décision loggée n°5) : arrondi entier, séparateur
//  de milliers de-CH (apostrophe), signes + / − typographiques,
//  « M » au-delà du million. UNE seule convention pour CommandDeck,
//  MarketDeck et les briques 1.D-1.F.
// ═══════════════════════════════════════════════════════════════

export const fmtUsdCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) {
    return `$${(v / 1_000_000).toLocaleString('de-CH', { maximumFractionDigits: 2 })}M`;
  }
  return `$${Math.round(v).toLocaleString('de-CH')}`;
};

export const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

// Tone loi de couleur : profit/loss UNIQUEMENT pour de l'argent réel.
export const toneSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return undefined;
  return v > 0 ? 'profit' : 'loss';
};
