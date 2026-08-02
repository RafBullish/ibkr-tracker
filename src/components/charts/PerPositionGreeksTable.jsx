// ═══════════════════════════════════════════════════════════════
//  PER POSITION GREEKS TABLE — moteur maison, craft v1.0 (brique 2.B)
//
//  Table dense non virtualisée listant chaque position optionnelle
//  ouverte avec ses Greeks individuels + IV + exposition $. Moteur
//  MAISON conservé (pas de migration ui/DataTable) mais monté au
//  langage cockpit : rangées à grille propre (hover de ligne),
//  en-têtes micro-caps, cellules mono tabulaires, décimales par
//  grandeur, alignements au cordeau.
//
//  Loi de couleur : Δ/Γ/Θ/ν TOUS neutres (un Greek signé n'est pas
//  une perte). EXPOSITION $ = notionnel hypothétique → NEUTRE aussi.
//  Colonne RANK retirée (IV Rank n'a jamais eu de vraie source — 2.B).
// ═══════════════════════════════════════════════════════════════

import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';
import { Layers } from 'lucide-react';

const PPG_USD_FMT_0D = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
function fmtUsd(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v < 0 ? '-' : '') + '$' + PPG_USD_FMT_0D.format(Math.abs(v));
}
function fmtNum(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('de-CH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Math.round(v)}%`;
}

// Colonnes (ordre) — RANK retirée en 2.B (usine IV Rank jamais construite).
const HEADERS = [
  { key: 'ticker', label: 'Ticker', align: 'left' },
  { key: 'type', label: 'Type', align: 'left' },
  { key: 'delta', label: 'Δ', align: 'right' },
  { key: 'gamma', label: 'Γ', align: 'right' },
  { key: 'theta', label: 'Θ', align: 'right' },
  { key: 'vega', label: 'ν', align: 'right' },
  { key: 'iv', label: 'IV', align: 'right' },
  { key: 'exposure', label: 'Exposition', align: 'right' },
];

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
      <div className="pos-greeks-table__head" role="row">
        {HEADERS.map((h) => (
          <span key={h.key} className="pos-greeks-table__h" data-align={h.align}>
            {h.label}
          </span>
        ))}
      </div>

      {rows.map((r, i) => (
        <div key={r.id || i} className="pos-greeks-table__row" role="row">
          <span className="pos-greeks-table__c mono pos-greeks-table__ticker" data-align="left">
            {r.ticker}
          </span>
          <span className="pos-greeks-table__c" data-align="left">
            <StatusBadge variant="neutral" label={r.type} size="xs" />
          </span>
          {/* Δ/Γ/Θ/ν NEUTRES — un Greek signé n'est pas une perte. */}
          <span className="pos-greeks-table__c mono" data-align="right">
            {fmtNum(r.delta)}
          </span>
          <span className="pos-greeks-table__c mono" data-align="right">
            {fmtNum(r.gamma, 3)}
          </span>
          <span className="pos-greeks-table__c mono" data-align="right">
            {fmtNum(r.theta)}
          </span>
          <span className="pos-greeks-table__c mono" data-align="right">
            {fmtNum(r.vega)}
          </span>
          <span
            className={`pos-greeks-table__c mono pos-greeks-table__iv${r.ivEstimated ? ' pos-iv-est' : ''}`}
            data-align="right"
            title={r.ivEstimated ? 'IV estimée (mark hors plage no-arbitrage, défaut σ=30%)' : undefined}
          >
            {r.ivEstimated ? '~' : ''}
            {fmtPct(r.iv ? r.iv * 100 : r.iv)}
          </span>
          <span className="pos-greeks-table__c mono" data-align="right">
            {fmtUsd(r.exposure)}
          </span>
        </div>
      ))}
    </div>
  );
}
