// ═══════════════════════════════════════════════════════════════
//  STRATEGY BREAKDOWN v3.0 « Midnight Terminal » (P6-27)
//
//  Refonte du composant legacy dashboard/StrategyBreakdown. Table
//  dense listant la performance par tag de stratégie (Sniper OTM,
//  Suivi plan, FOMO, Revenge, etc.) renseigné via AddTradeModal.
//
//  Colonnes : Stratégie · Trades · Win% · Avg R · Net P&L · Best · Worst
//
//  Tones colorés par signal (profit/loss) sur Net P&L et Win%.
//  Trades sans tag → bucket "Sans tag" en bas de table.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { tradePnlUsd } from '../../utils/calculations';
import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';
import InfoTooltip from '../ui/InfoTooltip';
import { Layers } from 'lucide-react';

const TOOLTIP = {
  title: 'Strategy Breakdown',
  body: "Performance agrégée par tag de stratégie (renseigné lors de l'ajout manuel d'un trade). Les trades sans tag tombent dans le bucket « Sans tag ».",
  example: 'Sniper OTM · 12 trades · 75% WR · +$4 200 Net → stratégie rentable à conserver.',
};

function fmtCurrency(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
    signDisplay: Math.abs(v) > 0 ? 'always' : 'auto',
  }).format(v);
}
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(0)}%`;
}

function buildBreakdown(closedTrades, lr) {
  const buckets = new Map();
  for (const t of closedTrades) {
    const tag = (t.tag && t.tag.trim()) || 'Sans tag';
    if (!buckets.has(tag)) {
      buckets.set(tag, {
        tag,
        count: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
        best: -Infinity,
        worst: Infinity,
        rMultiples: [],
      });
    }
    const bucket = buckets.get(tag);
    const pnl = tradePnlUsd(t, lr);
    bucket.count++;
    bucket.pnl += pnl;
    if (pnl > 0) bucket.wins++;
    else if (pnl < 0) bucket.losses++;
    if (pnl > bucket.best) bucket.best = pnl;
    if (pnl < bucket.worst) bucket.worst = pnl;
  }

  const rows = Array.from(buckets.values()).map((b) => ({
    ...b,
    winRate: b.count ? (b.wins / b.count) * 100 : 0,
    avgPnl: b.count ? b.pnl / b.count : 0,
    best: Number.isFinite(b.best) ? b.best : 0,
    worst: Number.isFinite(b.worst) ? b.worst : 0,
  }));

  // Sort by absolute P&L impact descending, "Sans tag" forced last
  rows.sort((a, b) => {
    if (a.tag === 'Sans tag') return 1;
    if (b.tag === 'Sans tag') return -1;
    return Math.abs(b.pnl) - Math.abs(a.pnl);
  });

  return rows;
}

export default function StrategyBreakdown({ closedTrades = [], liveRate = 1 }) {
  const rows = useMemo(() => buildBreakdown(closedTrades, liveRate), [closedTrades, liveRate]);

  if (!rows.length) {
    return (
      <EmptyState
        size="compact"
        icon={Layers}
        title="Pas encore de breakdown"
        description="Tague tes trades (Sniper OTM, Suivi plan, etc.) via la modal « Ajouter » sur Historique pour voir leur performance par stratégie."
      />
    );
  }

  return (
    <div className="strategy-breakdown">
      <div className="strategy-breakdown__head">
        <span className="uppercase-label">Stratégie</span>
        <InfoTooltip content={TOOLTIP} size={12} />
      </div>
      <div
        className="strategy-breakdown__table"
        role="table"
        aria-label="Performance par stratégie"
      >
        <div className="strategy-breakdown__row strategy-breakdown__row--head">
          <span className="uppercase-label">Tag</span>
          <span className="uppercase-label" style={{ textAlign: 'right' }}>
            Trades
          </span>
          <span className="uppercase-label" style={{ textAlign: 'right' }}>
            Win %
          </span>
          <span className="uppercase-label" style={{ textAlign: 'right' }}>
            Net P&amp;L
          </span>
          <span className="uppercase-label" style={{ textAlign: 'right' }}>
            Best
          </span>
          <span className="uppercase-label" style={{ textAlign: 'right' }}>
            Worst
          </span>
        </div>
        {rows.map((r) => {
          const pnlTone = r.pnl > 0 ? 'profit' : r.pnl < 0 ? 'loss' : 'neutral';
          const wrTone = r.winRate >= 60 ? 'profit' : r.winRate < 40 ? 'loss' : 'neutral';
          const isUntagged = r.tag === 'Sans tag';
          return (
            <div
              key={r.tag}
              className="strategy-breakdown__row"
              data-untagged={isUntagged || undefined}
            >
              <span>
                <StatusBadge
                  variant={
                    isUntagged
                      ? 'na'
                      : pnlTone === 'profit'
                        ? 'pass'
                        : pnlTone === 'loss'
                          ? 'fail'
                          : 'accent'
                  }
                  label={r.tag}
                  size="xs"
                />
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {r.count}
              </span>
              <span
                className={`mono text-${wrTone}`}
                style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)' }}
              >
                {fmtPct(r.winRate)}
              </span>
              <span
                className={`mono text-${pnlTone}`}
                style={{ textAlign: 'right', fontWeight: 'var(--fw-bold)' }}
              >
                {fmtCurrency(r.pnl)}
              </span>
              <span className="mono text-profit" style={{ textAlign: 'right' }}>
                {fmtCurrency(r.best)}
              </span>
              <span className="mono text-loss" style={{ textAlign: 'right' }}>
                {fmtCurrency(r.worst)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
