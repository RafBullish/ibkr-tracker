// ═══════════════════════════════════════════════════════════════
//  STRATEGY BREAKDOWN — craft cockpit (brique 2.B)
//
//  Table dense de la performance par tag de stratégie (Sniper OTM,
//  Suivi plan, FOMO, Revenge, …), renseigné via AddTradeModal. Rendue
//  dans l'étage RYTHME & RÉPARTITION d'Analytics (le titre de zone est
//  porté par l'étage — le composant ne rend que la table).
//
//  Colonnes : Tag · Trades · Win % · Net P&L · Best · Worst
//
//  LOI DE COULEUR (2.B) : chips TAG NEUTRES · Win % NEUTRE (un taux
//  n'est pas de l'argent) · Net P&L / Best / Worst TONÉS PAR SIGNE
//  (argent réel). Ligne « Sans tag » honnête, registre neutre.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { tradePnlUsd } from '../../utils/calculations';
import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';
import { Layers } from 'lucide-react';

const SB_USD_FMT_0D = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
function fmtCurrency(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return sign + '$' + SB_USD_FMT_0D.format(Math.abs(v));
}
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(0)}%`;
}
// Tonalité loi de couleur : suit le SIGNE de l'argent réel.
function moneyTone(v) {
  return v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral';
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
    best: Number.isFinite(b.best) ? b.best : 0,
    worst: Number.isFinite(b.worst) ? b.worst : 0,
  }));

  // Impact P&L absolu décroissant, « Sans tag » forcé en dernier.
  rows.sort((a, b) => {
    if (a.tag === 'Sans tag') return 1;
    if (b.tag === 'Sans tag') return -1;
    return Math.abs(b.pnl) - Math.abs(a.pnl);
  });

  return rows;
}

export default function StrategyBreakdown({ closedTrades = [], liveRate = 1 }) {
  const rows = useMemo(() => buildBreakdown(closedTrades, liveRate), [closedTrades, liveRate]);
  const untagged = rows.find((r) => r.tag === 'Sans tag');

  if (!rows.length) {
    return (
      <EmptyState
        size="compact"
        icon={Layers}
        title="Pas encore de breakdown"
        description="Tague tes trades (Sniper OTM, Suivi plan, etc.) via la modal « Ajouter » sur Historique."
      />
    );
  }

  return (
    <div className="strategy-breakdown">
      <div
        className="strategy-breakdown__table"
        role="table"
        aria-label="Performance par stratégie"
      >
        <div className="strategy-breakdown__row strategy-breakdown__row--head" role="row">
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
          const isUntagged = r.tag === 'Sans tag';
          return (
            <div
              key={r.tag}
              className="strategy-breakdown__row"
              data-untagged={isUntagged || undefined}
              role="row"
            >
              <span>
                {/* Chip TAG NEUTRE (le tag n'est pas un signal P&L). */}
                <StatusBadge variant={isUntagged ? 'na' : 'neutral'} label={r.tag} size="xs" />
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {r.count}
              </span>
              {/* Win % NEUTRE — un taux n'est pas de l'argent (§4.6). */}
              <span
                className="mono"
                style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)' }}
              >
                {fmtPct(r.winRate)}
              </span>
              {/* Argent réel — toné par signe. */}
              <span
                className={`mono text-${moneyTone(r.pnl)}`}
                style={{ textAlign: 'right', fontWeight: 'var(--fw-bold)' }}
              >
                {fmtCurrency(r.pnl)}
              </span>
              <span className={`mono text-${moneyTone(r.best)}`} style={{ textAlign: 'right' }}>
                {fmtCurrency(r.best)}
              </span>
              <span className={`mono text-${moneyTone(r.worst)}`} style={{ textAlign: 'right' }}>
                {fmtCurrency(r.worst)}
              </span>
            </div>
          );
        })}
      </div>
      {/* « N non-taggués » au registre neutre (parité 2.A-c1). */}
      {untagged && (
        <p className="strategy-breakdown__untagged-note">
          {untagged.count} trade{untagged.count > 1 ? 's' : ''} non-tagué
          {untagged.count > 1 ? 's' : ''} — tag-les pour affiner l'attribution.
        </p>
      )}
    </div>
  );
}
