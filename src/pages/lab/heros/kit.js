// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — kit : formatters (de-CH, cohérents app) + stats
//  denses dérivées d'une série equity. DEV-only, purgé fin 1.D.
// ═══════════════════════════════════════════════════════════════

export const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

export const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('de-CH')}`;
};

// NLV / gros montants : de-CH plein (l'argent se lit exactement) —
// cohérent avec le NET LIQ du CommandDeck actuel.
export const fmtUsdCompact = (v) => fmtUsd(v);

// tone loi de couleur : profit/loss UNIQUEMENT sur de l'argent réel.
export const toneSign = (v) =>
  !Number.isFinite(v) || v === 0 ? undefined : v > 0 ? 'profit' : 'loss';

export const fmtPct = (v, digits = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
};

export const fmtAxisDate = (isoStr) => {
  if (!isoStr || typeof isoStr !== 'string') return '';
  // Intraday : 'YYYY-MM-DDTHH:mm' → HH:mm (périodes courtes).
  if (isoStr.includes('T')) {
    const [d, t] = isoStr.split('T');
    return t ? t.slice(0, 5) : d;
  }
  const p = isoStr.split('-');
  if (p.length !== 3) return isoStr;
  return `${p[2]}/${p[1]}`;
};

// ── Double devise : USD (principal) + CHF (converti au FX live) ──
// liveRate = CHF par USD (settings.liveRate). Pas de CHF sur les ratios.
export const fmtChf = (usd, rate, signed = false) => {
  if (usd == null || !Number.isFinite(usd) || !Number.isFinite(rate) || rate <= 0) return null;
  const chf = usd * rate;
  const abs = Math.abs(chf);
  const body = abs >= 100 ? Math.round(abs).toLocaleString('de-CH') : abs.toFixed(2);
  if (chf === 0) return 'CHF 0';
  if (signed) return `CHF ${chf < 0 ? '−' : '+'}${body}`;
  return `CHF ${chf < 0 ? '−' : ''}${body}`;
};

export const fmtAxisUsd = (v) => {
  if (!Number.isFinite(v)) return '';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  // 1 décimale toujours en k → plages étroites (intraday ~$11.9k) lisibles,
  // sans écraser tous les ticks à « $12k ».
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
};

/**
 * Dérive un paquet de stats denses à partir de la série (points {date,
 * equity, pnl, cumPnL, peak, drawdown, capital}). Tout est neutre côté
 * couleur SAUF ce qui touche de l'argent réel (Δ, best/worst trade),
 * que le consommateur colore via le signe (loi de couleur).
 */
export function deriveStats(data, base = 0) {
  if (!Array.isArray(data) || data.length === 0) {
    return { empty: true, count: 0 };
  }
  // Base d'équité RÉELLE connue ? (NLV/realEquity → oui ; cumPnL nu → non).
  // Sans base ancrée, les % (DD%, rendement) sont mathématiquement
  // malhonnêtes — même doctrine que equitySeries.js (maxDDPct null). On
  // renvoie les montants $ toujours, les % seulement si hasBase.
  const hasBase = base > 0;
  const first = data[0];
  const last = data[data.length - 1];
  const equities = data.map((p) => p.equity);
  const current = last.equity;
  const startEquity = hasBase ? base : first.equity - (first.cumPnL || 0);
  const high = Math.max(...equities);
  const low = Math.min(...equities);
  const peak = high;
  const currentDD = peak - current; // ≥ 0
  const currentDDPct = hasBase && peak > 0 ? -(currentDD / peak) * 100 : null;

  // Max drawdown (peak-to-trough).
  let runPeak = data[0].equity;
  let maxDD = 0;
  let maxDDPct = 0;
  for (const p of data) {
    if (p.equity > runPeak) runPeak = p.equity;
    const dd = runPeak - p.equity;
    if (dd > maxDD) maxDD = dd;
    if (runPeak > 0) {
      const ddp = (dd / runPeak) * 100;
      if (ddp > maxDDPct) maxDDPct = ddp;
    }
  }

  const totalPnL = last.cumPnL != null ? last.cumPnL : current - startEquity;
  const totalReturnPct = hasBase && startEquity > 0 ? (totalPnL / startEquity) * 100 : null;

  const pnls = data.map((p) => p.pnl).filter((v) => Number.isFinite(v));
  const wins = pnls.filter((v) => v > 0);
  const losses = pnls.filter((v) => v < 0);
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0;
  const best = pnls.length ? Math.max(...pnls) : 0;
  const worst = pnls.length ? Math.min(...pnls) : 0;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : wins.length ? Infinity : 0;

  // Volatilité : écart-type des pnls (proxy simple, data-viz lab).
  const mean = pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length
    ? pnls.reduce((a, b) => a + (b - mean) ** 2, 0) / pnls.length
    : 0;
  const vol = Math.sqrt(variance);
  // Sharpe-like : mean / stdev (par trade, non annualisé — proxy lab).
  const sharpe = vol > 0 ? mean / vol : 0;

  const spanDays =
    (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000 || 0;

  return {
    empty: false,
    count: pnls.length,
    current,
    startEquity,
    high,
    low,
    peak,
    currentDD,
    currentDDPct,
    maxDD,
    maxDDPct: hasBase ? -maxDDPct : null,
    hasBase,
    totalPnL,
    totalReturnPct,
    winRate,
    best,
    worst,
    avgWin,
    avgLoss,
    profitFactor,
    vol,
    sharpe,
    spanDays,
    firstDate: first.date,
    lastDate: last.date,
  };
}

// Filtre par timeframe (mêmes clés que l'app : 5D/1M/3M/YTD/1Y/ALL).
const TF_DAYS = { '5D': 5, '1M': 30, '3M': 90, '1Y': 365 };
export const TIMEFRAMES = ['5D', '1M', '3M', 'YTD', '1Y', 'ALL'];

export function filterByTimeframe(points, range) {
  if (!points || !points.length || range === 'ALL') return points || [];
  const ref = points[points.length - 1].date;
  const refMs = Date.parse(ref);
  if (!Number.isFinite(refMs)) return points;
  let cutoff;
  if (range === 'YTD') {
    const d = new Date(refMs);
    cutoff = Date.UTC(d.getUTCFullYear(), 0, 1);
  } else {
    const days = TF_DAYS[range];
    if (!Number.isFinite(days)) return points;
    cutoff = refMs - days * 86_400_000;
  }
  return points.filter((p) => Date.parse(p.date) >= cutoff);
}
