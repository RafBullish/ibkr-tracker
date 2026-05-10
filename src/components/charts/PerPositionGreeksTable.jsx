// ═══════════════════════════════════════════════════════════════
//  PER POSITION GREEKS TABLE v3.0
//
//  Dense non-virtualized table listing each open option position
//  with its individual Greeks + IV + IV Rank + USD exposure.
//  No virtualization (typically < 20 open positions).
// ═══════════════════════════════════════════════════════════════

import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';
import { Layers } from 'lucide-react';

function fmtUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(v);
}
function fmtNum(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Math.round(v)}%`;
}

export default function PerPositionGreeksTable({ rows = [], className }) {
  if (!rows.length) {
    return (
      <EmptyState
        size="compact"
        icon={Layers}
        title="Aucune position optionnelle ouverte"
        description="Les Greeks individuels apparaîtront ici dès qu'une option sera en portefeuille."
      />
    );
  }

  return (
    <div className={['pos-greeks-table', className].filter(Boolean).join(' ')}>
      <div className="pos-greeks-table__head">
        <span className="uppercase-label" style={{ textAlign: 'left' }}>
          Ticker
        </span>
        <span className="uppercase-label">Type</span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          Δ
        </span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          Γ
        </span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          Θ
        </span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          ν
        </span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          IV
        </span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          Rank
        </span>
        <span className="uppercase-label" style={{ textAlign: 'right' }}>
          Exposition
        </span>
      </div>
      {rows.map((r, i) => (
        <div key={r.id || i} className="pos-greeks-table__row">
          <span className="mono" style={{ fontWeight: 'var(--fw-semibold)' }}>
            {r.ticker}
          </span>
          <StatusBadge variant={r.type === 'PUT' ? 'loss' : 'accent'} label={r.type} size="xs" />
          <span className="mono" style={{ textAlign: 'right' }}>
            {fmtNum(r.delta)}
          </span>
          <span className="mono" style={{ textAlign: 'right' }}>
            {fmtNum(r.gamma, 3)}
          </span>
          <span
            className="mono"
            style={{ textAlign: 'right', color: r.theta < 0 ? 'var(--loss-text)' : undefined }}
          >
            {fmtNum(r.theta)}
          </span>
          <span className="mono" style={{ textAlign: 'right' }}>
            {fmtNum(r.vega)}
          </span>
          <span className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>
            {fmtPct(r.iv ? r.iv * 100 : r.iv)}
          </span>
          <span className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>
            {fmtPct(r.ivRank)}
          </span>
          <span className="mono" style={{ textAlign: 'right' }}>
            {fmtUsd(r.exposure)}
          </span>
        </div>
      ))}
    </div>
  );
}
