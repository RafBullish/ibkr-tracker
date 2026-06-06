// ═══════════════════════════════════════════════════════════════
//  PerformanceAttribution v5 Sprint 7 — Edge × Capital heatmap
//
//  5×5 grid (E0..E4 × C1..C5) inserted in /trading/history below
//  the existing Win Rate + Distribution panels. Each cell shows
//  the average $ P&L per trade in that bucket, the trade count,
//  and a tooltip-grade win rate breakdown.
//
//  Color intensity follows expectancy magnitude :
//     >= +$100  : strong profit green
//     +$1..+$99 : soft profit green
//     0         : mute
//     -$99..-$1 : soft loss red
//     <= -$100  : strong loss red
//
//  Cells with n < 3 trades render at half-opacity to flag
//  insufficient data — single-trade outliers shouldn't dominate
//  the visual reading.
//
//  The component reads sniper meta from the sidecar so the user's
//  manual taggings (Sprint 2.2 SniperMetaEditor) flow into this
//  attribution view. Untagged trades count is shown as a hint
//  inviting the user to tag.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useClosedTrades } from '../../store/useStore';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { readAllSniperMeta } from '../../utils/sniperMeta';
import {
  computeEdgeCapitalMatrix,
  ATTRIBUTION_EDGE_KEYS,
  ATTRIBUTION_CAP_KEYS,
} from '../../utils/attribution';

const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return '—';
  const sign = v > 0 ? '+' : '−';
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `${sign}$${Math.round(abs).toLocaleString('de-CH')}`;
  }
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtPct = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(0)}%`;
};

function intensity(avgPnl, n) {
  if (n === 0) return 'empty';
  if (n < 3) return 'sparse'; // half-opacity flag
  const v = avgPnl;
  if (v >= 100) return 'profit-strong';
  if (v >= 1) return 'profit-soft';
  if (v <= -100) return 'loss-strong';
  if (v <= -1) return 'loss-soft';
  return 'flat';
}

function HeroChip({ label, value, sub, tone }) {
  return (
    <div className="perf-attr__chip" data-tone={tone}>
      <span className="perf-attr__chip-label">{label}</span>
      <span className="perf-attr__chip-value">{value}</span>
      {sub ? <span className="perf-attr__chip-sub">{sub}</span> : null}
    </div>
  );
}

export default function PerformanceAttribution() {
  const closedTrades = useClosedTrades();
  const metrics = usePortfolioMetrics();
  const liveRate = metrics?.liveRate || 1;

  const matrixResult = useMemo(() => {
    const sniperMetaMap = readAllSniperMeta();
    return computeEdgeCapitalMatrix(closedTrades || [], { sniperMetaMap, liveRate });
  }, [closedTrades, liveRate]);

  const { matrix, untaggedCount, decisive, bestCell, worstCell } = matrixResult;

  return (
    <section className="perf-attr">
      <header className="perf-attr__header">
        <span className="perf-attr__title">Performance Attribution · Edge × Capital</span>
        <span className="perf-attr__hint">
          {decisive} {decisive === 1 ? 'trade taggué' : 'trades taggués'}
          {untaggedCount > 0 ? (
            <>
              {' · '}
              <span className="perf-attr__untagged">
                {untaggedCount} non-tagué{untaggedCount > 1 ? 's' : ''}
              </span>
            </>
          ) : null}
        </span>
      </header>

      {decisive === 0 ? (
        <div className="perf-attr__empty">
          <div className="perf-attr__empty-title">Aucun trade taggué pour le moment.</div>
          <div className="perf-attr__empty-sub">
            Tagge tes positions ouvertes via le bouton <em>Tag</em> dans Live Positions (/dashboard)
            pour qu&apos;une fois closées, elles alimentent cette matrice Edge × Capital.
            L&apos;Edge Tier est auto-dérivé depuis l&apos;IV Rank si tu laisses ce champ vide ; le
            Capital Tier reste manuel.
          </div>
        </div>
      ) : (
        <>
          <div className="perf-attr__chips">
            <HeroChip label="Décisifs" value={String(decisive)} sub="trades dans matrix" />
            {bestCell ? (
              <HeroChip
                label="Meilleur bucket"
                value={`${bestCell.edge} · ${bestCell.cap}`}
                sub={`avg ${fmtUsd(bestCell.avgPnl)} · n=${bestCell.n}`}
                tone="profit"
              />
            ) : (
              <HeroChip label="Meilleur bucket" value="——" sub="n < 3 partout" tone="mute" />
            )}
            {worstCell ? (
              <HeroChip
                label="Pire bucket"
                value={`${worstCell.edge} · ${worstCell.cap}`}
                sub={`avg ${fmtUsd(worstCell.avgPnl)} · n=${worstCell.n}`}
                tone="loss"
              />
            ) : (
              <HeroChip label="Pire bucket" value="——" sub="n < 3 partout" tone="mute" />
            )}
          </div>

          <div className="perf-attr__grid-wrap">
            <table className="perf-attr__grid" aria-label="Edge × Capital matrix">
              <thead>
                <tr>
                  <th aria-label="Edge tier">E↓ · C→</th>
                  {ATTRIBUTION_CAP_KEYS.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ATTRIBUTION_EDGE_KEYS.map((e) => (
                  <tr key={e}>
                    <th scope="row">{e}</th>
                    {ATTRIBUTION_CAP_KEYS.map((c) => {
                      const cell = matrix[e][c];
                      const tone = intensity(cell.avgPnl, cell.n);
                      const title =
                        cell.n === 0
                          ? `${e} · ${c} : aucun trade`
                          : `${e} · ${c}\nn=${cell.n} · avg ${fmtUsd(cell.avgPnl)} · total ${fmtUsd(cell.totalPnl)} · win ${fmtPct(cell.winRate)}`;
                      return (
                        <td
                          key={c}
                          className={`perf-attr__cell perf-attr__cell--${tone}`}
                          title={title}
                        >
                          {cell.n === 0 ? (
                            <span className="perf-attr__cell-empty">·</span>
                          ) : (
                            <>
                              <span className="perf-attr__cell-val">{fmtUsd(cell.avgPnl)}</span>
                              <span className="perf-attr__cell-n">n={cell.n}</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="perf-attr__legend">
            <span className="perf-attr__legend-label">Intensité (avg $ P&L / trade) :</span>
            <span className="perf-attr__legend-swatch perf-attr__legend-swatch--loss-strong" />
            <span className="perf-attr__legend-tick">≤ −$100</span>
            <span className="perf-attr__legend-swatch perf-attr__legend-swatch--loss-soft" />
            <span className="perf-attr__legend-tick">−$1 .. −$99</span>
            <span className="perf-attr__legend-swatch perf-attr__legend-swatch--flat" />
            <span className="perf-attr__legend-tick">~ 0</span>
            <span className="perf-attr__legend-swatch perf-attr__legend-swatch--profit-soft" />
            <span className="perf-attr__legend-tick">+$1 .. +$99</span>
            <span className="perf-attr__legend-swatch perf-attr__legend-swatch--profit-strong" />
            <span className="perf-attr__legend-tick">≥ +$100</span>
            <span className="perf-attr__legend-divider" aria-hidden="true">
              ·
            </span>
            <span className="perf-attr__legend-tick">cellules en demi-opacité = n &lt; 3</span>
          </div>
        </>
      )}
    </section>
  );
}
