// ═══════════════════════════════════════════════════════════════
//  POSITIONS v3.0 « Midnight Terminal »
//  /trading/positions
//
//  Three visual branches:
//    A) No trades at all  → hero EmptyState + import CTA
//    B) Flat (has history, no open positions) → 4-card flat panel
//       (Dernière position, Stats récentes, Prochain setup Sniper
//       OTM, Mini-donut répartition) — kept per Rafael's Phase 3.5
//       instruction to preserve the existing flat UI
//    C) Open positions → KPI strip (5 MetricCards) + DataTable v3
//       with mobile cards mode
//
//  Business logic untouched: calculateOpenPositionPnl, computePortfolio
//  Greeks, generateAlerts, usePortfolioMetrics consumed as-is.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Briefcase,
  Crosshair,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  DollarSign,
  Activity,
  Sigma,
  Layers,
  Trash2,
} from 'lucide-react';
import { useOpenPositions, useSettings, useClosedTrades, useDispatch } from '../../store/useStore';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { calculateOpenPositionPnl, tradePnlUsd } from '../../utils/calculations';
// A1 — migrated from legacy computePortfolioGreeks (sign-agnostic) to
// aggregateGreeks (sign-aware via pos.dir + correct units : theta/day,
// vega/1%-IV). For Sniper-OTM short premium portfolios this means
// Theta is now positive (decay encaissé) and Vega negative (short vol).
import { aggregateGreeks } from '../../utils/greeks';
import { formatUsd, formatPnlUsd } from '../../utils/format';
import { daysToExpiration, holdingDays, todayDateString } from '../../utils/dates';
import { toFloat, ensurePositive, generateId } from '../../utils/math';
import { getGreeksForAllPositions } from '../../utils/greeksApi';
import { generateAlerts, getPositionAlerts } from '../../utils/alerts';
import { effectiveSlDollar } from '../../utils/risk';
// useMediaQuery no longer needed at page level — DataTable handles mobile cards internally

import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { POLLING } from '../../constants/timing';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

const REFRESH_INTERVAL = POLLING.MARKET_QUOTES_MS;

// ── Asset mix (for donut in flat state) ──────────────────────
function assetMix(trades) {
  let action = 0,
    call = 0,
    put = 0;
  for (const t of trades) {
    if (t.as === 'Action') action++;
    else if (t.ty === 'CALL') call++;
    else if (t.ty === 'PUT') put++;
  }
  const total = action + call + put;
  return {
    total,
    action: { count: action, pct: total ? (action / total) * 100 : 0 },
    call: { count: call, pct: total ? (call / total) * 100 : 0 },
    put: { count: put, pct: total ? (put / total) * 100 : 0 },
  };
}

// ── Mini donut for flat state ─────────────────────────────────
function MiniDonut({ slices, size = 100, thickness = 14 }) {
  const radius = (size - thickness) / 2;
  const cx = size / 2,
    cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  // Pre-compute each slice's cumulative offset so we stay purely functional
  // inside the .map (React Compiler-friendly).
  const withOffsets = slices.reduce(
    (acc, s) => {
      const len = (s.pct / 100) * circumference;
      acc.items.push({ ...s, len, offset: acc.cursor });
      acc.cursor += len;
      return acc;
    },
    { items: [], cursor: 0 }
  ).items;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--line-hairline)"
        strokeWidth={thickness}
      />
      {withOffsets.map((s, i) => {
        const dash = `${s.len} ${circumference - s.len}`;
        const rot = -90 + (s.offset / circumference) * 360;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={dash}
            strokeLinecap="butt"
            transform={`rotate(${rot} ${cx} ${cy})`}
          />
        );
      })}
    </svg>
  );
}

function LegendRow({ color, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--ink-soft)', minWidth: 44 }}>{label}</span>
      <span className="mono" style={{ color: 'var(--ink-mute)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Local KPI tile for the open-positions strip ──────────────
// Remplace MetricCard sur cette page : surface plate canonique, valeur
// neutre par défaut, focus amber sur les zones décisives (Positions,
// Delta net, Capital engagé). Le rouge n'apparaît QUE pour les pertes $
// RÉELLES (Max Loss). Θ signé est neutre (révision loi de couleur).
const POS_NUM_FMT_2D = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function fmtKpiValue(value, format, currency = 'USD') {
  if (value == null || Number.isNaN(value)) return '—';
  if (format === 'currency') {
    if (currency === 'USD') {
      return (value < 0 ? '-' : '') + '$' + POS_NUM_FMT_2D.format(Math.abs(value));
    }
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function KpiTile({
  icon: Icon,
  label,
  tooltip,
  value,
  format = 'number',
  currency = 'USD',
  tone = 'neutral',
  focus = false,
}) {
  const toneClass = tone === 'loss' ? ' is-loss' : tone === 'profit' ? ' is-profit' : '';
  return (
    <div className="positions-v3__kpi" data-focus={focus ? 'true' : undefined}>
      <div className="positions-v3__kpi-label">
        {Icon && <Icon size={12} aria-hidden="true" />}
        <span>{label}</span>
        {tooltip && <InfoTooltip content={tooltip} size={12} />}
      </div>
      <div className={`positions-v3__kpi-value${toneClass}`}>
        {fmtKpiValue(value, format, currency)}
      </div>
    </div>
  );
}

// ── Relative age formatter (Greeks freshness indicator) ─────
// Cheap, locale-stable formatter — no Intl.RelativeTimeFormat overhead
// for the ~once-per-10s render path. Buckets: s < 60, min < 60, h.
function formatRelativeAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h`;
}

// ── DTE badge ────────────────────────────────────────────────
function DteBadge({ dte }) {
  if (dte === '∞' || dte == null) {
    return <span className="positions-dte positions-dte--infinity mono">∞</span>;
  }
  if (typeof dte !== 'number')
    return <span className="positions-dte positions-dte--muted mono">—</span>;
  let tone;
  if (dte <= 0) tone = 'loss';
  else if (dte < 30) tone = 'loss';
  else if (dte < 60) tone = 'warning';
  else if (dte <= 90) tone = 'accent';
  else tone = 'profit';
  return (
    <span className={`positions-dte positions-dte--${tone} mono`}>
      {dte <= 0 ? 'EXP' : `${dte}j`}
    </span>
  );
}

// ── Type badge (CALL / PUT / STK) ───────────────────────────
function TypeBadge({ as, ty }) {
  if (as === 'Option' && ty === 'CALL')
    return <StatusBadge variant="neutral" label="CALL" size="xs" />;
  if (as === 'Option' && ty === 'PUT') return <StatusBadge variant="neutral" label="PUT" size="xs" />;
  return <StatusBadge variant="neutral" label="STK" size="xs" />;
}

// ── Alert inline badges (P6-20) ─────────────────────────────
const ALERT_SHORT = {
  DTE_CRITICAL: 'DTE',
  DTE_WARNING: 'DTE',
  STOP_LOSS: 'STOP',
  TIME_STOP: 'TIME',
  TP1_REACHED: 'TP1',
  TP2_REACHED: 'TP2',
  IN_PROFIT: 'OK',
};
const ALERT_TONE = { red: 'fail', orange: 'warn', green: 'pass' };

function RowAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) return <span className="mono text-tertiary">—</span>;
  return (
    <div className="positions-v3__row-alerts">
      {alerts.map((a, i) => (
        <StatusBadge
          key={`${a.type}-${i}`}
          variant={ALERT_TONE[a.severity] || 'neutral'}
          label={ALERT_SHORT[a.type] || a.type}
          size="xs"
          title={a.message}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FLAT STATE — 4 cards when we have history but no open position
// ═══════════════════════════════════════════════════════════════
function FlatState({ closedTrades, lr, navigate }) {
  const lastClosed = useMemo(() => {
    const sorted = [...closedTrades]
      .filter((t) => t.do)
      .sort((a, b) => (b.do || '').localeCompare(a.do || ''));
    return sorted[0] || null;
  }, [closedTrades]);

  const recent = useMemo(() => {
    const sorted = [...closedTrades]
      .filter((t) => t.do)
      .sort((a, b) => (b.do || '').localeCompare(a.do || ''));
    const last10 = sorted.slice(0, 10);
    const wins = last10.filter((t) => tradePnlUsd(t, lr) > 0).length;
    const winRate = last10.length ? (wins / last10.length) * 100 : 0;
    const last3 = sorted.slice(0, 3).map((t) => ({ ...t, pnl: tradePnlUsd(t, lr) }));
    return { last3, winRate, sampleSize: last10.length };
  }, [closedTrades, lr]);

  const mix = useMemo(() => assetMix(closedTrades), [closedTrades]);
  // Slice « Action » = stocks/equity (mix descriptif passé). Pas un signal
  // décisionnel → ink-mute, l'amber reste réservé aux zones d'action.
  const slices = [
    { key: 'action', color: 'var(--ink-mute)', pct: mix.action.pct },
    { key: 'call', color: 'var(--pnl-up)', pct: mix.call.pct },
    { key: 'put', color: 'var(--pnl-down)', pct: mix.put.pct },
  ];

  const lastPnl = lastClosed ? tradePnlUsd(lastClosed, lr) : 0;
  const lastDuration = lastClosed ? holdingDays(lastClosed.di, lastClosed.do) : 0;
  const rMultiple =
    lastClosed && lastClosed.pi && lastClosed.ct
      ? lastPnl /
        (Math.abs(toFloat(lastClosed.pi)) *
          Math.abs(toFloat(lastClosed.ct)) *
          ensurePositive(lastClosed.mu))
      : null;

  return (
    <motion.div
      className="page-container positions-flat"
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <Crosshair
              size={18}
              aria-hidden="true"
              style={{ marginRight: 8, verticalAlign: '-3px' }}
            />
            Positions ouvertes
          </h1>
          <p className="page-subtitle">
            Aucune position ouverte actuellement · Tu es <strong>flat</strong>, en attente du
            prochain setup.
          </p>
        </div>
      </motion.div>

      <div className="positions-flat__grid">
        <motion.div variants={TILE_VARIANTS} className="positions-flat__card">
          <div className="positions-flat__card-head">
            <Clock size={12} aria-hidden="true" />
            <span className="uppercase-label">Dernière position clôturée</span>
          </div>
          {lastClosed ? (
            <>
              <div className="positions-flat__ticker-row">
                <span className="mono positions-flat__ticker">{lastClosed.tk}</span>
                <TypeBadge as={lastClosed.as} ty={lastClosed.ty} />
              </div>
              <div
                className="mono positions-flat__pnl"
                data-tone={lastPnl > 0 ? 'profit' : lastPnl < 0 ? 'loss' : 'neutral'}
              >
                {formatPnlUsd(lastPnl)}
              </div>
              <div className="positions-flat__meta">
                <div>
                  Clôturé le <strong>{lastClosed.do}</strong>
                </div>
                <div>
                  Durée <strong>{lastDuration}j</strong>
                </div>
                {rMultiple != null && isFinite(rMultiple) && (
                  <div>
                    R-multiple{' '}
                    <strong data-tone={rMultiple >= 0 ? 'profit' : 'loss'}>
                      {rMultiple >= 0 ? '+' : ''}
                      {rMultiple.toFixed(2)}R
                    </strong>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="positions-flat__placeholder">—</div>
          )}
        </motion.div>

        <motion.div variants={TILE_VARIANTS} className="positions-flat__card">
          <div className="positions-flat__card-head">
            <TrendingUp size={12} aria-hidden="true" />
            <span className="uppercase-label">Stats récentes</span>
          </div>
          <div className="mono positions-flat__stat-big">
            {recent.winRate.toFixed(0)}%
            <span className="positions-flat__stat-sub">WR / {recent.sampleSize} trades</span>
          </div>
          <div className="positions-flat__recent-list">
            {recent.last3.map((t, i) => (
              <div key={t.id || i} className="positions-flat__recent">
                <span className="mono positions-flat__recent-tk">{t.tk}</span>
                <span className="positions-flat__recent-date">{t.do}</span>
                <span
                  className="mono positions-flat__recent-pnl"
                  data-tone={t.pnl > 0 ? 'profit' : t.pnl < 0 ? 'loss' : 'neutral'}
                >
                  {formatPnlUsd(t.pnl)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={TILE_VARIANTS} className="positions-flat__card">
          <div className="positions-flat__card-head">
            <Crosshair size={12} aria-hidden="true" />
            <span className="uppercase-label">Prochain setup potentiel</span>
          </div>
          <p className="positions-flat__setup">
            Scanne la Chain Options pour trouver ton prochain <strong>Sniper OTM</strong> : Delta
            0.25-0.35, IV Rank &lt; 40, DTE 120-150.
          </p>
          <button
            type="button"
            className="positions-flat__cta"
            onClick={() => navigate('/trading/chain')}
          >
            Ouvrir Chain Options <ArrowUpRight size={12} aria-hidden="true" />
          </button>
        </motion.div>

        <motion.div variants={TILE_VARIANTS} className="positions-flat__card">
          <div className="positions-flat__card-head">
            <TrendingDown size={12} aria-hidden="true" />
            <span className="uppercase-label">Répartition historique</span>
          </div>
          <div className="positions-flat__donut-wrap">
            <MiniDonut slices={slices} />
            <div className="positions-flat__legend">
              <LegendRow
                color="var(--ink-mute)"
                label="Action"
                value={`${mix.action.count} · ${mix.action.pct.toFixed(0)}%`}
              />
              <LegendRow
                color="var(--pnl-up)"
                label="Call"
                value={`${mix.call.count} · ${mix.call.pct.toFixed(0)}%`}
              />
              <LegendRow
                color="var(--pnl-down)"
                label="Put"
                value={`${mix.put.count} · ${mix.put.pct.toFixed(0)}%`}
              />
            </div>
          </div>
          <div className="positions-flat__donut-footer">
            Sur {mix.total} trade{mix.total > 1 ? 's' : ''} clos
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DETAIL PANEL (read-only) — ouvert au clic d'une ligne, rendu dans
//  Modal v3. U4 : AUCUNE action de mutation. Réutilise strictement les
//  données déjà calculées pour la ligne (greeksMap, alerts,
//  effectiveSlDollar) — n'invente ni ne recalcule rien.
// ═══════════════════════════════════════════════════════════════
function DetailItem({ label, children }) {
  return (
    <div className="position-detail__item">
      <span className="position-detail__label">{label}</span>
      <span className="position-detail__value mono">{children}</span>
    </div>
  );
}

// Greek read-only avec le même marquage ~ (IV estimée) que le tableau.
function PanelGreek({ label, value, ivEstimated, digits = 2 }) {
  let node;
  if (value == null || !Number.isFinite(value)) {
    node = <span className="text-tertiary">—</span>;
  } else if (ivEstimated) {
    node = (
      <span
        style={{ opacity: 0.65, fontStyle: 'italic' }}
        title="IV estimée (mark hors plage no-arbitrage, défaut σ=30%)"
      >
        ~{value.toFixed(digits)}
      </span>
    );
  } else {
    node = value.toFixed(digits);
  }
  return (
    <div className="position-detail__item">
      <span className="position-detail__label">{label}</span>
      <span className="position-detail__value mono">{node}</span>
    </div>
  );
}

function PositionDetailBody({ row, greeks, posAlerts, navigate, onEdit, onCloseMode }) {
  const { pos, r, pctChg, isOpt, dte, costBasis, maxLoss } = row;
  const pnl = r.unrealizedPnlUsd;
  const pnlTone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'neutral';
  const sl = effectiveSlDollar(pos);
  const dir = pos.dir || (isOpt ? 'Long' : '—');
  const alertTone = (sev) => (sev === 'red' ? 'loss' : sev === 'orange' ? 'warn' : 'profit');
  return (
    <div className="position-detail">
      <div className="position-detail__head">
        <span className="mono" style={{ fontSize: 16, fontWeight: 'var(--fw-semibold)' }}>
          {pos.tk}
        </span>
        <TypeBadge as={pos.as} ty={pos.ty} />
        <StatusBadge variant="neutral" label={dir} size="xs" />
        {isOpt && <DteBadge dte={dte} />}
      </div>

      <div className="position-detail__section">
        <span className="position-detail__section-title">Contrat</span>
        <div className="position-detail__grid">
          {isOpt && <DetailItem label="Strike">${toFloat(pos.st).toFixed(0)}</DetailItem>}
          {isOpt && <DetailItem label="Expiration">{pos.ex || '—'}</DetailItem>}
          <DetailItem label="Quantité">{toFloat(pos.ct)}</DetailItem>
          <DetailItem label="Multiplicateur">{isOpt ? toFloat(pos.mu) || 100 : 1}</DetailItem>
        </div>
      </div>

      <div className="position-detail__section">
        <span className="position-detail__section-title">Prix &amp; P&amp;L</span>
        <div className="position-detail__grid">
          <DetailItem label="Prix d'entrée">${toFloat(pos.pi).toFixed(2)}</DetailItem>
          <DetailItem label="Mark">${toFloat(pos.pc).toFixed(2)}</DetailItem>
          <DetailItem label="P&L unrealized">
            <span className={`text-${pnlTone}`}>
              {pnl >= 0 ? '+' : ''}
              {formatUsd(pnl)}
            </span>
          </DetailItem>
          <DetailItem label="Variation">
            <span className={`text-${pnlTone}`}>
              {pctChg >= 0 ? '+' : ''}
              {pctChg.toFixed(2)}%
            </span>
          </DetailItem>
        </div>
      </div>

      <div className="position-detail__section">
        <span className="position-detail__section-title">Risque &amp; capital</span>
        <div className="position-detail__grid">
          <DetailItem label="Capital engagé">{formatUsd(costBasis)}</DetailItem>
          <DetailItem label="Max loss théorique">{formatUsd(maxLoss)}</DetailItem>
          <DetailItem label="Risque max (SL 35%)">{sl == null ? '—' : formatUsd(sl)}</DetailItem>
        </div>
      </div>

      {isOpt && (
        <div className="position-detail__section">
          <span className="position-detail__section-title">Greeks · par contrat</span>
          <div className="position-detail__grid">
            <PanelGreek
              label="Δ Delta"
              value={greeks?.delta}
              ivEstimated={greeks?.ivEstimated}
              digits={2}
            />
            <PanelGreek
              label="Γ Gamma"
              value={greeks?.gamma}
              ivEstimated={greeks?.ivEstimated}
              digits={4}
            />
            <PanelGreek
              label="Θ Theta · /j"
              value={greeks?.theta}
              ivEstimated={greeks?.ivEstimated}
              digits={2}
            />
            <PanelGreek
              label="ν Vega · /1%"
              value={greeks?.vega}
              ivEstimated={greeks?.ivEstimated}
              digits={2}
            />
          </div>
        </div>
      )}

      <div className="position-detail__section">
        <span className="position-detail__section-title">Alertes</span>
        {posAlerts.length === 0 ? (
          <span className="text-tertiary mono" style={{ fontSize: 12 }}>
            Aucune alerte active
          </span>
        ) : (
          <div className="position-detail__alerts">
            {posAlerts.map((a, i) => (
              <div
                key={`${a.type}-${i}`}
                className="position-detail__alert"
                data-tone={alertTone(a.severity)}
              >
                {a.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* U4-bis — actions de mutation (via les formulaires Éditer /
          Clôturer ; le dispatch passe par les actions reducer canoniques). */}
      <div className="position-detail__actions">
        <button type="button" className="pg-mock-btn" onClick={onEdit}>
          Éditer
        </button>
        <button type="button" className="pg-mock-btn pg-mock-btn--primary" onClick={onCloseMode}>
          Clôturer
        </button>
      </div>

      {/* Lien de navigation pure (aucune mutation d'état). */}
      <button
        type="button"
        className="position-detail__nav"
        onClick={() => navigate('/trading/chain')}
      >
        Ouvrir la chaîne options <ArrowUpRight size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ÉDITION (U4-bis) — corrige une position OUVERTE via UPDATE_POSITION.
//  Champs sûrs uniquement ; validation pi/ct > 0, ticker requis. Aucune
//  écriture directe dans le store — uniquement l'action reducer canonique.
// ═══════════════════════════════════════════════════════════════
function PositionEditForm({ row, onSave, onCancel }) {
  const { pos } = row;
  const isOpt = pos.as === 'Option';
  const [tk, setTk] = useState(pos.tk || '');
  const [ty, setTy] = useState(pos.ty || 'CALL');
  const [dir, setDir] = useState(pos.dir || 'Long');
  const [st, setSt] = useState(pos.st != null ? String(pos.st) : '');
  const [ex, setEx] = useState(pos.ex || '');
  const [pi, setPi] = useState(pos.pi != null ? String(pos.pi) : '');
  const [ct, setCt] = useState(pos.ct != null ? String(pos.ct) : '');
  const [di, setDi] = useState(pos.di || '');

  const valid =
    !!tk.trim() && toFloat(pi) > 0 && toFloat(ct) > 0 && (!isOpt || (toFloat(st) > 0 && !!ex));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const patch = { id: pos.id, tk: tk.trim().toUpperCase(), dir, pi, ct, di };
    if (isOpt) {
      patch.ty = ty;
      patch.st = st;
      patch.ex = ex;
    }
    onSave(patch);
  };

  return (
    <form className="add-trade-form" onSubmit={handleSubmit}>
      <p className="position-detail__form-hint">
        Correction manuelle de la position ouverte (Greeks et mark se recalculent).
      </p>
      <div className="add-trade-form__row">
        <label>
          <span className="uppercase-label">Ticker</span>
          <input value={tk} onChange={(e) => setTk(e.target.value)} />
        </label>
        <label>
          <span className="uppercase-label">Direction</span>
          <div className="add-trade-form__toggle">
            <button
              type="button"
              data-active={dir === 'Long' || undefined}
              onClick={() => setDir('Long')}
            >
              Long
            </button>
            <button
              type="button"
              data-active={dir === 'Short' || undefined}
              onClick={() => setDir('Short')}
            >
              Short
            </button>
          </div>
        </label>
        {isOpt && (
          <label>
            <span className="uppercase-label">Type</span>
            <div className="add-trade-form__toggle">
              <button
                type="button"
                data-active={ty === 'CALL' || undefined}
                onClick={() => setTy('CALL')}
              >
                CALL
              </button>
              <button
                type="button"
                data-active={ty === 'PUT' || undefined}
                onClick={() => setTy('PUT')}
              >
                PUT
              </button>
            </div>
          </label>
        )}
      </div>
      <div className="add-trade-form__row">
        <label>
          <span className="uppercase-label">Prix d'entrée</span>
          <input value={pi} onChange={(e) => setPi(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          <span className="uppercase-label">Qty</span>
          <input value={ct} onChange={(e) => setCt(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          <span className="uppercase-label">Date d'entrée</span>
          <input type="date" value={di} onChange={(e) => setDi(e.target.value)} />
        </label>
      </div>
      {isOpt && (
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Strike</span>
            <input value={st} onChange={(e) => setSt(e.target.value)} inputMode="decimal" />
          </label>
          <label>
            <span className="uppercase-label">Expiration</span>
            <input type="date" value={ex} onChange={(e) => setEx(e.target.value)} />
          </label>
        </div>
      )}
      <div className="add-trade-form__footer">
        <button type="button" className="pg-mock-btn" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="pg-mock-btn pg-mock-btn--primary" disabled={!valid}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CLÔTURE (U4-bis) — construit un closed trade canonique (forme
//  AddTradeModal) et dispatch CLOSE_POSITION. GARDE DUR : prix de sortie
//  > 0 et date de sortie ≥ date d'entrée. Résumé + P&L avant confirmation.
// ═══════════════════════════════════════════════════════════════
function PositionCloseForm({ row, lr, onConfirm, onCancel }) {
  const { pos } = row;
  const isOpt = pos.as === 'Option';
  const [po, setPo] = useState('');
  const [doDate, setDoDate] = useState(todayDateString());
  const [fo, setFo] = useState('0');

  const poValid = toFloat(po) > 0;
  const dateValid = !!doDate && (!pos.di || doDate >= pos.di);
  const valid = poValid && dateValid;

  const closedTradeBase = useMemo(
    () => ({
      tk: pos.tk,
      as: pos.as,
      ty: pos.ty ?? null,
      dir: pos.dir,
      st: pos.st ?? null,
      ex: pos.ex ?? null,
      ct: String(pos.ct),
      mu: String(pos.mu ?? (isOpt ? 100 : 1)),
      pi: String(pos.pi),
      po: String(toFloat(po)),
      di: pos.di,
      do: doDate,
      fi: String(pos.fi ?? '0'),
      fo: String(toFloat(fo) || 0),
      fxi: String(pos.fxi ?? '0.88'),
      fxo: String(pos.fxi ?? '0.88'),
      tag: pos.tag ?? null,
      note: null,
      src: 'manual',
    }),
    [pos, po, doDate, fo, isOpt]
  );

  const pnlPreview = valid ? tradePnlUsd(closedTradeBase, lr) : null;
  const pnlTone =
    pnlPreview == null ? 'neutral' : pnlPreview > 0 ? 'profit' : pnlPreview < 0 ? 'loss' : 'neutral';

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!valid) return;
    onConfirm({ ...closedTradeBase, id: generateId() });
  };

  return (
    <form className="add-trade-form" onSubmit={handleConfirm}>
      <div className="add-trade-form__row">
        <label>
          <span className="uppercase-label">Prix de sortie</span>
          <input
            value={po}
            onChange={(e) => setPo(e.target.value)}
            inputMode="decimal"
            placeholder="ex 11.20"
            autoFocus
          />
        </label>
        <label>
          <span className="uppercase-label">Date de sortie</span>
          <input type="date" value={doDate} onChange={(e) => setDoDate(e.target.value)} />
        </label>
        <label>
          <span className="uppercase-label">Frais sortie</span>
          <input value={fo} onChange={(e) => setFo(e.target.value)} inputMode="decimal" />
        </label>
      </div>

      {!poValid && (
        <p className="position-detail__form-error">Prix de sortie requis (&gt; 0) pour clôturer.</p>
      )}
      {poValid && !dateValid && (
        <p className="position-detail__form-error">
          La date de sortie ne peut pas précéder la date d'entrée ({pos.di}).
        </p>
      )}

      <div className="position-detail__close-summary">
        <span className="position-detail__section-title">Confirmation</span>
        <div className="position-detail__grid">
          <DetailItem label="Position">
            {pos.tk}
            {isOpt ? ` ${pos.ty} $${toFloat(pos.st).toFixed(0)}` : ''}
          </DetailItem>
          <DetailItem label="Quantité">{toFloat(pos.ct)}</DetailItem>
          <DetailItem label="Prix sortie">{poValid ? `$${toFloat(po).toFixed(2)}` : '—'}</DetailItem>
          <DetailItem label="P&L résultant">
            <span className={`text-${pnlTone}`}>
              {pnlPreview == null
                ? '—'
                : `${pnlPreview >= 0 ? '+' : ''}${formatUsd(pnlPreview)}`}
            </span>
          </DetailItem>
        </div>
      </div>

      <div className="add-trade-form__footer">
        <button type="button" className="pg-mock-btn" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="pg-mock-btn pg-mock-btn--primary" disabled={!valid}>
          Confirmer la clôture
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
export default function Positions() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const dispatch = useDispatch();
  const lr = toFloat(settings.liveRate) || 1;
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  // Panneau détail (read-only) : on stocke l'id, la ligne live est
  // re-dérivée depuis `positions` (auto-close si la position disparaît).
  const [detailId, setDetailId] = useState(null);
  // U4-bis — mode du panneau détail : 'view' (read-only) | 'edit' | 'close'.
  const [detailMode, setDetailMode] = useState('view');
  const [greeksMap, setGreeksMap] = useState(new Map());
  const [lastGreeksUpdate, setLastGreeksUpdate] = useState(null);
  // `now` lives in state so the relative age label can be computed during
  // render without calling Date.now() (impure during render — react-hooks/purity).
  const [now, setNow] = useState(() => Date.now());

  // Stable option identity (prevents refetch on every price tick)
  const optionsKey = useMemo(
    () =>
      openPositions
        .filter((p) => p.as === 'Option')
        .map((p) => `${p.id}:${p.tk}:${p.ty}:${p.st}:${p.ex}`)
        .sort()
        .join('|'),
    [openPositions]
  );
  const positionsRef = useRef(openPositions);
  useEffect(() => {
    positionsRef.current = openPositions;
  });

  useEffect(() => {
    if (!optionsKey) return;
    const fetchGreeks = () => {
      getGreeksForAllPositions(positionsRef.current)
        .then((map) => {
          setGreeksMap(map);
          // Stamp the freshness indicator only when at least one position
          // came back with usable greeks — a fully-unavailable batch shouldn't
          // claim "Greeks · il y a 2 s" since no usable data was retrieved.
          for (const g of map.values()) {
            if (g && g.source !== 'unavailable') {
              const t = Date.now();
              setLastGreeksUpdate(t);
              setNow(t); // refresh the relative-age label immediately
              return;
            }
          }
        })
        .catch(() => {});
    };
    fetchGreeks();
    const id = setInterval(fetchGreeks, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [optionsKey]);

  // Tick every 10s so the relative "il y a Xs" label keeps refreshing
  // without paying for a tighter interval. Cheap state bump, no re-fetch.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const m = usePortfolioMetrics();
  const nlvUsd = m.netLiquidationValueUsd;

  const positions = useMemo(
    () =>
      openPositions.map((pos) => {
        const r = calculateOpenPositionPnl(pos, lr);
        const costBasis = Math.abs(r.costBasisUsd);
        const pctChg = costBasis > 0 ? (r.unrealizedPnlUsd / costBasis) * 100 : 0;
        const isOpt = pos.as === 'Option';
        const dte = isOpt ? daysToExpiration(pos.ex) : '∞';
        const mul = ensurePositive(pos.mu);
        const maxLoss = toFloat(pos.pi) * toFloat(pos.ct) * mul;
        const portPct = nlvUsd > 0 ? (Math.abs(r.marketValueUsd) / nlvUsd) * 100 : 0;
        return { pos, r, tk: pos.tk, pctChg, isOpt, dte, costBasis, maxLoss, portPct };
      }),
    [openPositions, lr, nlvUsd]
  );

  // A3c — Greek aggregation removed from this block. The KPI cards
  // (Delta Net, Theta Total) now read the sign-aware values exposed
  // by `aggregateGreeks` below (greeks.sumDelta, greeks.thetaDaily).
  // The legacy summing here was simultaneously sign-agnostic AND in
  // per-year units (Theta) while the tooltip claimed "quotidienne".
  // Both bugs fixed at the consumer site.
  // Passe finale — `uPnlUsd` retiré du retour (calculé jamais lu).
  const summary = useMemo(() => {
    let totalCost = 0;
    let totalMaxLoss = 0;
    positions.forEach(({ costBasis, maxLoss }) => {
      totalCost += costBasis;
      totalMaxLoss += maxLoss;
    });
    return {
      count: positions.length,
      totalMaxLoss,
      totalCost,
    };
  }, [positions]);

  const greeks = useMemo(
    () => aggregateGreeks(openPositions, greeksMap),
    [openPositions, greeksMap]
  );
  const alerts = useMemo(
    () => generateAlerts(openPositions, greeksMap, lr),
    [openPositions, greeksMap, lr]
  );
  const actionableAlerts = useMemo(
    () => alerts.filter((a) => a.severity === 'red' || a.severity === 'orange'),
    [alerts]
  );

  // ─── Branch A : truly empty ────────────────────────────────
  if (positions.length === 0 && closedTrades.length === 0) {
    return (
      <div className="page-container positions-empty">
        <div className="positions-empty__panel">
          <EmptyState
            icon={Briefcase}
            title="Aucune position ouverte"
            description="Importe tes données IBKR Flex Query pour visualiser tes positions, ou enregistre un premier trade manuel."
            action={
              <button
                type="button"
                className="pg-mock-btn pg-mock-btn--primary"
                onClick={() => navigate('/settings/import')}
              >
                Importer un CSV Flex
              </button>
            }
          />
        </div>
      </div>
    );
  }

  // ─── Branch B : flat (history exists) ──────────────────────
  if (positions.length === 0) {
    return <FlatState closedTrades={closedTrades} lr={lr} navigate={navigate} />;
  }

  // ─── Branch C : open positions → KPI + DataTable ──────────
  const detailRow =
    detailId != null ? positions.find((p) => p.pos.id === detailId) || null : null;

  const columns = [
    {
      key: 'tk',
      label: 'Ticker',
      align: 'left',
      sort: true,
      mono: true,
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontWeight: 'var(--fw-semibold)' }}>
            {v || '—'}
          </span>
          <TypeBadge as={row.pos.as} ty={row.pos.ty} />
        </div>
      ),
    },
    {
      key: 'strike',
      label: 'Strike',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => (row.isOpt ? `$${toFloat(row.pos.st).toFixed(0)}` : '—'),
    },
    {
      key: 'dte',
      label: 'DTE',
      align: 'center',
      render: (v) => <DteBadge dte={v} />,
    },
    {
      key: 'qty',
      label: 'Qty',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => toFloat(row.pos.ct).toString(),
    },
    {
      key: 'pi',
      label: 'Entry',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => `$${toFloat(row.pos.pi).toFixed(2)}`,
    },
    {
      key: 'mark',
      label: 'Mark',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => `$${toFloat(row.pos.pc).toFixed(2)}`,
    },
    {
      key: 'pnlUsd',
      label: 'P&L $',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => {
        const p = row.r.unrealizedPnlUsd;
        const tone = p > 0 ? 'profit' : p < 0 ? 'loss' : 'neutral';
        return (
          <span className={`text-${tone}`}>
            {p >= 0 ? '+' : ''}
            {formatUsd(p)}
          </span>
        );
      },
    },
    {
      key: 'pctChg',
      label: '%',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) => {
        const tone = v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral';
        return (
          <span className={`text-${tone}`}>
            {v >= 0 ? '+' : ''}
            {v.toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: 'delta',
      label: 'Δ',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => {
        if (!row.isOpt) return '—';
        const g = greeksMap.get(row.pos.id);
        const d = g?.delta;
        if (d == null) return '—';
        // Cascade fallback (c) σ=0.30 → marquage discret : ~ prefix + opacity + title
        if (g.ivEstimated) {
          return (
            <span
              style={{ opacity: 0.65, fontStyle: 'italic' }}
              title="IV estimée (mark hors plage no-arbitrage, défaut σ=30%)"
            >
              ~{d.toFixed(2)}
            </span>
          );
        }
        return d.toFixed(2);
      },
    },
    {
      key: 'theta',
      label: 'Θ',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => {
        if (!row.isOpt) return '—';
        const g = greeksMap.get(row.pos.id);
        const t = g?.theta;
        if (t == null) return '—';
        // Θ NEUTRE (loi de couleur) : un Greek signé ≠ perte $ → neutre comme Δ,
        // plus de text-loss. Le marquage IV-estimée (~ + opacité) reste.
        if (g.ivEstimated) {
          return (
            <span
              style={{ opacity: 0.65, fontStyle: 'italic' }}
              title="IV estimée (mark hors plage no-arbitrage, défaut σ=30%)"
            >
              ~{t.toFixed(2)}
            </span>
          );
        }
        return t.toFixed(2);
      },
    },
    {
      // P6-20: inline alerts per row instead of global count only
      key: 'alerts',
      label: 'Alerts',
      align: 'left',
      render: (_v, row) => <RowAlerts alerts={getPositionAlerts(row.pos.id, alerts)} />,
    },
    {
      key: '_delete',
      label: '',
      align: 'right',
      render: (_v, row) => (
        <button
          type="button"
          className="history-v3__delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (!row.pos.id) return;
            const ok = window.confirm(
              `Supprimer cette position locale ${row.pos.tk || ''} ?\n\n` +
                `Attention : ceci efface la ligne de ton historique local uniquement. Cela ne clôture PAS la position côté IBKR.\n` +
                `Utilise cette action pour corriger un import raté ou retirer une position fantôme.`
            );
            if (!ok) return;
            dispatch({ type: 'DELETE_OPEN_POSITION', payload: row.pos.id });
          }}
          aria-label="Supprimer cette position de l'historique local"
          title="Supprimer de l'historique local (ne clôture pas la position IBKR)"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      ),
    },
  ];

  const mobileCardRender = (row) => {
    const p = row.r.unrealizedPnlUsd;
    const tone = p > 0 ? 'profit' : p < 0 ? 'loss' : 'neutral';
    const rowAlerts = getPositionAlerts(row.pos.id, alerts);
    return (
      <div className="positions-card">
        <div className="positions-card__head">
          <div className="positions-card__ticker-wrap">
            <span className="mono positions-card__ticker">{row.pos.tk}</span>
            <TypeBadge as={row.pos.as} ty={row.pos.ty} />
          </div>
          <DteBadge dte={row.dte} />
        </div>
        <div className="positions-card__body">
          <div className="positions-card__pnl">
            <span
              className={`mono text-${tone}`}
              style={{ fontSize: 18, fontWeight: 'var(--fw-bold)' }}
            >
              {p >= 0 ? '+' : ''}
              {formatUsd(p)}
            </span>
            <span className={`mono text-${tone}`} style={{ fontSize: 12 }}>
              {row.pctChg >= 0 ? '+' : ''}
              {row.pctChg.toFixed(2)}%
            </span>
          </div>
          <div className="positions-card__meta">
            <span>
              Entry <strong className="mono">${toFloat(row.pos.pi).toFixed(2)}</strong>
            </span>
            <span>
              Mark <strong className="mono">${toFloat(row.pos.pc).toFixed(2)}</strong>
            </span>
            <span>
              Qty <strong className="mono">{toFloat(row.pos.ct)}</strong>
            </span>
            {row.isOpt && row.pos.st && (
              <span>
                Strike <strong className="mono">${toFloat(row.pos.st).toFixed(0)}</strong>
              </span>
            )}
          </div>
          {rowAlerts.length > 0 && (
            <div className="positions-card__alerts">
              <RowAlerts alerts={rowAlerts} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className="page-container positions-v3"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crosshair size={18} aria-hidden="true" />
            Positions ouvertes
            <StatusBadge variant="accent" label={`${summary.count} pos`} size="xs" />
            {actionableAlerts.length > 0 && (
              <StatusBadge
                variant="warn"
                label={`${actionableAlerts.length} alerte${actionableAlerts.length > 1 ? 's' : ''}`}
                size="xs"
              />
            )}
          </h1>
          <p className="page-subtitle">
            Portefeuille actif · P&L unrealized, Greeks nets par contrat, DTE badges.
          </p>
        </div>
      </motion.div>

      {/* KPI strip — 5 tuiles plates canoniques.
          Focus (depth-focus + filet amber) = zones décisives de la page :
          Positions (le sujet), Delta net (Σ Greeks), Capital engagé (capital).
          Rouge sémantique = pertes $ RÉELLES uniquement (Max Loss). Θ signé
          est neutre (révision loi de couleur cross-page). */}
      <motion.div variants={TILE_VARIANTS} className="positions-v3__kpi-strip">
        <KpiTile
          icon={Layers}
          label="Positions"
          tooltip="Nombre de positions ouvertes (actions + options)."
          value={summary.count}
          format="number"
          focus
        />
        <KpiTile
          icon={Sigma}
          label="Delta net"
          tooltip={{
            title: 'Delta net',
            body: 'Exposition directionnelle agrégée (options + actions, sign-aware par dir). +1 = $1 de P&L pour +$1 du sous-jacent.',
          }}
          value={greeks.sumDelta}
          format="number"
          focus
        />
        {/* Theta reads greeks.thetaDaily (sign-aware via aggregateGreeks,
            BSM-theta / 365 → per-day units). Θ NEUTRE (loi de couleur cross-page,
            révision) : un Greek signé n'est PAS une perte $ → toujours neutre,
            plus de rouge sur le signe. Le rouge reste réservé aux pertes réalisées
            (Max Loss). */}
        <KpiTile
          icon={Clock}
          label="Theta total"
          tooltip={{
            title: 'Theta agrégé',
            body: "Erosion temporelle quotidienne cumulée sur le portefeuille d'options (sign-aware par dir : positif = decay encaissé pour les short premium).",
          }}
          value={greeks.thetaDaily}
          format="currency"
          currency="USD"
          tone="neutral"
        />
        <KpiTile
          icon={DollarSign}
          label="Capital engagé"
          tooltip={{
            title: 'Capital investi',
            body: 'Coût total absolu des positions ouvertes (entry price × qty × multiplier).',
          }}
          value={summary.totalCost}
          format="currency"
          currency="USD"
          focus
        />
        <KpiTile
          icon={Activity}
          label="Max loss"
          tooltip={{
            title: 'Max Loss',
            body: 'Perte maximum théorique si toutes les options expirent sans valeur (long options only).',
          }}
          value={summary.totalMaxLoss}
          format="currency"
          currency="USD"
          tone="loss"
        />
      </motion.div>

      {/* Greeks freshness indicator — passive, no toast, no spinner */}
      <div className="positions-v3__greeks-freshness mono" role="status" aria-live="polite">
        {(() => {
          const hasUsable = Array.from(greeksMap.values()).some(
            (g) => g && g.source !== 'unavailable'
          );
          if (hasUsable && lastGreeksUpdate) {
            return `Greeks · il y a ${formatRelativeAge(now - lastGreeksUpdate)}`;
          }
          if (greeksMap.size === 0) return 'Greeks · en attente du premier fetch…';
          return 'Greeks · indisponibles';
        })()}
      </div>

      {/* DataTable */}
      <motion.div variants={TILE_VARIANTS}>
        <DataTable
          data={positions}
          columns={columns}
          defaultSort={{ key: 'pnlUsd', dir: 'desc' }}
          enableSearch
          mobileCardRender={mobileCardRender}
          onRowClick={(row) => {
            setDetailId(row.pos.id);
            setDetailMode('view');
          }}
          getRowId={(row) => row.pos.id}
          focusedRowId={focusId}
          emptyTitle="Aucune position"
          emptyMessage="Importe des données Flex ou ajoute un trade manuel."
        />
      </motion.div>

      <Modal
        open={!!detailRow}
        onClose={() => {
          setDetailId(null);
          setDetailMode('view');
        }}
        title={
          detailRow
            ? `${detailMode === 'edit' ? 'Éditer' : detailMode === 'close' ? 'Clôturer' : 'Détail'} — ${detailRow.pos.tk}`
            : ''
        }
      >
        {detailRow && detailMode === 'view' && (
          <PositionDetailBody
            row={detailRow}
            greeks={greeksMap.get(detailRow.pos.id)}
            posAlerts={getPositionAlerts(detailRow.pos.id, alerts)}
            navigate={navigate}
            onEdit={() => setDetailMode('edit')}
            onCloseMode={() => setDetailMode('close')}
          />
        )}
        {detailRow && detailMode === 'edit' && (
          <PositionEditForm
            row={detailRow}
            onCancel={() => setDetailMode('view')}
            onSave={(patch) => {
              dispatch({ type: 'UPDATE_POSITION', payload: patch });
              setDetailMode('view');
            }}
          />
        )}
        {detailRow && detailMode === 'close' && (
          <PositionCloseForm
            row={detailRow}
            lr={lr}
            onCancel={() => setDetailMode('view')}
            onConfirm={(closedTrade) => {
              // Dispatch via l'action canonique CLOSE_POSITION uniquement.
              dispatch({
                type: 'CLOSE_POSITION',
                payload: { positionId: detailRow.pos.id, remainingPosition: null, closedTrade },
              });
              // La position quitte openPositions → detailRow devient null →
              // la Modal se ferme. On nettoie l'état explicitement.
              setDetailId(null);
              setDetailMode('view');
            }}
          />
        )}
      </Modal>
    </motion.div>
  );
}
