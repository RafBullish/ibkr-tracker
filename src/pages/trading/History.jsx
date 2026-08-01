// ═══════════════════════════════════════════════════════════════
//  HISTORY — le grand livre au langage cockpit v1.0 (brique 2.A)
//  /trading/history
//
//  Architecture (§4.3 brique 2.A) :
//    1. BANDEAU DE COMMANDEMENT — un panneau cockpit (.lh-final),
//       6 cellules-MONDE aux hairlines verticales (Total · Net P&L ·
//       Win Rate · Avg R · Best · Worst). Sources INCHANGÉES
//       (calculateTradingMetrics sur le SOUS-ENSEMBLE FILTRÉ — une
//       page = une vérité ; gates nullables ≥10 décisifs conservées).
//       Ratios (WR, Avg R) NEUTRES ; montants tonés + double devise.
//    2. BARRE D'OUTILS du grand livre — toggle Standard/Sniper à
//       l'anatomie ViewToggle des héros (.lh-toggle), filtres au même
//       registre, CTA « Ajouter un trade » (ambre, zone de décision).
//       Export CSV : bouton sobre du DataTable (inchangé).
//    3. LA TABLE, héroïne pleine largeur (vues Standard/Sniper).
//    4. ÉTAGE ANALYSE — un panneau cockpit, 3 zones aux rails :
//       WIN RATE (donut) · DISTRIBUTION · ATTRIBUTION, au système
//       Obsidienne (tooltip unique), scope = le tableau filtré,
//       sous-titres de scope honnêtes.
//
//  Known limitation B-01: IBKR Flex exposes only IBCommission as
//  a single fees field. The "Fees" column shows the aggregate.
// ═══════════════════════════════════════════════════════════════

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, History as HistoryIcon, Crosshair, Trash2 } from 'lucide-react';
import { useClosedTrades, useSettings, useDispatch } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
import { calculateTradingMetrics } from '../../hooks/useTradingMetrics';
import { formatUsd } from '../../utils/format';
import { toFloat, ensurePositive } from '../../utils/math';
import { holdingDays } from '../../utils/dates';
import { TickValue } from '../../components/dashboard/decision/parts';
import { fmtChf } from '../../components/dashboard/hero1/kit';

import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import AddTradeModal from '../../components/trades/AddTradeModal';
import WinRateDonut from '../../components/ui/WinRateDonut';
import PerformanceAttribution from '../../components/history/PerformanceAttribution';
import { detectExitReason, EXIT_REASONS } from '../../utils/trades/detectExitReason';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../../theme/animationVariants';

const LazyDistribution = lazy(() =>
  import('./HistoryDistribution').catch(() => ({
    default: () => null,
  }))
);

// ── CSV export ───────────────────────────────────────────────
function exportCsv(trades, lr) {
  const header =
    'Ticker,Type,Quantité,Prix Open,Prix Close,Date Open,Date Close,P&L USD,P&L CHF,Durée (jours),Commission';
  const rows = trades.map((t) => {
    const pnl = tradePnlUsd(t, lr);
    const fxo = toFloat(t.fxo) || lr;
    return [
      t.tk,
      t.as === 'Option' ? `${t.ty} ${toFloat(t.st).toFixed(0)} ${(t.ex || '').slice(5)}` : 'STK',
      toFloat(t.ct),
      toFloat(t.pi).toFixed(2),
      toFloat(t.po).toFixed(2),
      t.di || '',
      t.do || '',
      pnl.toFixed(2),
      (pnl * fxo).toFixed(2),
      holdingDays(t.di, t.do),
      toFloat(t.cm || 0).toFixed(2),
    ].join(',');
  });
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ibkr-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function computeTradePnl(t, lr) {
  const pnl = tradePnlUsd(t, lr);
  const fxo = toFloat(t.fxo) || lr;
  const cost = Math.abs(toFloat(t.pi) * ensurePositive(t.mu) * toFloat(t.ct));
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  return { usd: pnl, chf: pnl * fxo, pct };
}

function TypeBadge({ as, ty }) {
  if (as === 'Action' || (!ty && as !== 'Option'))
    return <StatusBadge variant="neutral" label="STK" size="xs" />;
  if (ty === 'CALL') return <StatusBadge variant="neutral" label="CALL" size="xs" />;
  return <StatusBadge variant="neutral" label={ty || 'PUT'} size="xs" />;
}

const EXIT_REASON_LABELS = {
  tp_50: 'TP +50%',
  sl_35: 'SL -35%',
  dte_45: '45 DTE',
  pre_earnings: 'Pre-earnings',
  stagnation: 'Stagnation',
  manual: 'Manuel',
  unknown: '—',
};

const VIEW_MODE_KEY = 'ibkr_history_view_mode';
function loadViewMode() {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === 'sniper' ? 'sniper' : 'standard';
  } catch {
    return 'standard';
  }
}

// ── Formatters locaux (Intl de-CH, préfixe $ manuel anti-NBSP) ──
function fmtCount(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}
function fmtNumber(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}
const HIST_USD_FMT_2D = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function fmtCurrency(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return (v < 0 ? '-' : '') + '$' + HIST_USD_FMT_2D.format(Math.abs(v));
}
function fmtPercent(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return (
    new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v) + '%'
  );
}

// Tonalité par SIGNE — argent réel uniquement (les ratios WR/Avg R
// sont NEUTRES depuis 2.A : un ratio n'est pas de l'argent).
function toneSign(v) {
  if (v == null || Number.isNaN(v) || v === 0) return undefined;
  return v > 0 ? 'profit' : 'loss';
}

function ExitReasonEditor({ trade, onConfirm, onOverride, onClose }) {
  const [selectedReason, setSelectedReason] = useState(trade.exitReason || 'unknown');
  const currentLabel = EXIT_REASON_LABELS[trade.exitReason] || '—';
  const autoDetected = trade._exitReasonAutoDetected === true;
  // Recompute confidence live for transparency when showing an auto value.
  const detected = autoDetected ? detectExitReason(trade) : null;

  return (
    <div className="exit-reason-editor">
      <div className="exit-reason-editor__current">
        <span className="uppercase-label">Motif détecté</span>
        <StatusBadge variant="accent" label={currentLabel} size="md" />
        {autoDetected && detected && (
          <span className="exit-reason-editor__confidence">
            Confidence : <strong>{detected.confidence}</strong>
          </span>
        )}
      </div>

      <div className="exit-reason-editor__override">
        <label className="uppercase-label" htmlFor="exit-reason-override">
          Corriger le motif
        </label>
        <select
          id="exit-reason-override"
          className="exit-reason-editor__select"
          value={selectedReason}
          onChange={(e) => setSelectedReason(e.target.value)}
        >
          {EXIT_REASONS.map((r) => (
            <option key={r} value={r}>
              {EXIT_REASON_LABELS[r] || r}
            </option>
          ))}
        </select>
      </div>

      <div className="exit-reason-editor__actions">
        <button type="button" className="pg-mock-btn" onClick={onClose}>
          Annuler
        </button>
        {autoDetected && (
          <button type="button" className="pg-mock-btn pg-mock-btn--primary" onClick={onConfirm}>
            Confirmer le motif actuel
          </button>
        )}
        <button
          type="button"
          className="pg-mock-btn"
          onClick={() => onOverride(selectedReason)}
          disabled={selectedReason === trade.exitReason && !autoDetected}
        >
          Appliquer la correction
        </button>
      </div>
    </div>
  );
}

// ── Cellule-MONDE du bandeau (miroir .pos-command de Positions) ──
function CommandCell({ label, tooltip, value, chf, sub, tone }) {
  const meta = [chf, sub].filter(Boolean).join(sub && sub.startsWith('/') ? ' ' : ' · ');
  return (
    <div className="pf-c hist-command__cell">
      <span className="pf-c__label hist-command__label">
        <span>{label}</span>
        {tooltip && <InfoTooltip content={tooltip} size={12} />}
      </span>
      <TickValue
        text={value}
        className={`pf-c__val hist-command__val${tone ? ` pf-c__val--${tone}` : ''}`}
      />
      <span className="pf-c__meta hist-command__meta">{meta || ' '}</span>
    </div>
  );
}

// ── Groupe de chips (anatomie .lh-toggle des héros) ──────────
function ChipGroup({ ariaLabel, options, value, onChange }) {
  return (
    <div className="lh-toggle" role="tablist" aria-label={ariaLabel}>
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          className="lh-toggle__btn"
          data-active={value === k || undefined}
          onClick={() => onChange(k)}
          aria-pressed={value === k}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
export default function History() {
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const dispatch = useDispatch();
  const reducedMotion = useReducedMotion();
  const lr = toFloat(settings?.liveRate) || 1;
  const [resultTab, setResultTab] = useState('all');
  const [typeTab, setTypeTab] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState(loadViewMode);
  const [editingExit, setEditingExit] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* quota */
    }
  }, [viewMode]);

  const enriched = useMemo(() => {
    return closedTrades.map((t) => {
      const p = computeTradePnl(t, lr);
      return {
        ...t,
        pnlUsd: p.usd,
        pnlChf: p.chf,
        pnlPct: p.pct,
        hold: holdingDays(t.di, t.do),
      };
    });
  }, [closedTrades, lr]);

  // LE tableau filtré — la vérité unique de la page (bandeau, table,
  // et les 3 zones de l'étage ANALYSE lisent ce même sous-ensemble).
  const filtered = useMemo(() => {
    return enriched.filter((t) => {
      if (resultTab === 'win' && t.pnlUsd <= 0) return false;
      if (resultTab === 'loss' && t.pnlUsd >= 0) return false;
      if (typeTab === 'options' && t.as !== 'Option') return false;
      if (typeTab === 'stocks' && t.as !== 'Action') return false;
      return true;
    });
  }, [enriched, resultTab, typeTab]);

  // Libellé de scope honnête (sous-titres ANALYSE + méta bandeau).
  const scopeLabel = useMemo(() => {
    const parts = [
      resultTab === 'win' ? 'gagnants' : resultTab === 'loss' ? 'perdants' : null,
      typeTab === 'options' ? 'options' : typeTab === 'stocks' ? 'actions' : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : "tout l'historique";
  }, [resultTab, typeTab]);

  const stats = useMemo(() => {
    const m = calculateTradingMetrics(filtered, lr);
    // A2b — winRate is nullable upstream when decisive<10. Preserve null
    // here so the bandeau / WinRateDonut render "—" instead of "0 %".
    if (!m)
      return {
        total: 0,
        net: 0,
        winRate: null,
        avgR: 0,
        best: 0,
        worst: 0,
        winCount: 0,
        lossCount: 0,
        decisive: 0,
      };
    return {
      total: m.totalPnlCount,
      net: m.totalPnl,
      winRate: m.winRate,
      avgR: m.avgLoss > 0 ? m.avgWin / m.avgLoss : 0,
      best: m.bestTrade,
      worst: m.worstTrade,
      winCount: m.winCount,
      lossCount: m.lossCount,
      decisive: m.decisive,
    };
  }, [filtered, lr]);

  const chf = (usd, signed) =>
    Number.isFinite(usd) && Number.isFinite(lr) && lr > 0 ? fmtChf(usd, lr, signed) : null;

  const dateColumn = {
    key: 'do',
    label: 'Date',
    align: 'left',
    sort: true,
    mono: true,
    render: (v) => v || '—',
  };
  const tickerColumn = {
    key: 'tk',
    label: 'Ticker',
    align: 'left',
    sort: true,
    mono: true,
    render: (v, row) => (
      <div className="pos-ticker-cell">
        <span className="mono pos-ticker-cell__tk">{v || '—'}</span>
        <TypeBadge as={row.as} ty={row.ty} />
      </div>
    ),
  };
  const holdColumn = {
    key: 'hold',
    label: 'Hold',
    align: 'right',
    sort: true,
    mono: true,
    render: (v) => (typeof v === 'number' ? `${v}j` : '—'),
  };
  const pnlUsdColumn = {
    key: 'pnlUsd',
    label: 'Net P&L',
    align: 'right',
    sort: true,
    mono: true,
    footer: () => {
      const t = stats.net > 0 ? 'profit' : stats.net < 0 ? 'loss' : undefined;
      return (
        <span>
          <span className="v3-table__tf-label">Σ Net P&L</span>
          <span className={`v3-table__tf-value${t ? ` v3-table__tf-value--${t}` : ''}`}>
            {fmtCurrency(stats.net)}
          </span>
        </span>
      );
    },
    render: (v) => {
      const tone = v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral';
      return (
        <span className={`text-${tone}`}>
          {v >= 0 ? '+' : ''}
          {formatUsd(v)}
        </span>
      );
    },
  };
  const pnlPctColumn = {
    key: 'pnlPct',
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
  };
  const feesColumn = {
    key: 'cm',
    label: 'Fees',
    align: 'right',
    sort: true,
    mono: true,
    render: (v, row) => {
      const fee = toFloat(v) || toFloat(row.fi) + toFloat(row.fo);
      return fee > 0 ? `$${fee.toFixed(2)}` : '—';
    },
  };
  const tagColumn = {
    key: 'tag',
    label: 'Tag',
    align: 'left',
    render: (v) => (v ? <StatusBadge variant="accent" label={v} size="xs" /> : null),
  };
  const deleteColumn = {
    key: '_delete',
    label: '',
    align: 'right',
    render: (_v, row) => (
      <button
        type="button"
        className="history-v3__delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (!row.id) return;
          const ok = window.confirm(`Supprimer ce trade ${row.tk || ''} du ${row.do || ''} ?`);
          if (!ok) return;
          dispatch({ type: 'DELETE_CLOSED_TRADE', payload: row.id });
        }}
        aria-label="Supprimer ce trade"
        title="Supprimer"
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    ),
  };
  // Footer sous Date : compteur de la vue filtrée (héroïne = la table).
  const dateFooter = () => (
    <span>
      <span className="v3-table__tf-label">Σ · {stats.total} trades</span>
      <span className="v3-table__tf-value">{scopeLabel}</span>
    </span>
  );

  const standardColumns = [
    { ...dateColumn, footer: dateFooter },
    tickerColumn,
    {
      key: 'qty',
      label: 'Qty',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) => toFloat(row.ct).toString(),
    },
    {
      key: 'pi',
      label: 'Entry',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) => `$${toFloat(v).toFixed(2)}`,
    },
    {
      key: 'po',
      label: 'Exit',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) => `$${toFloat(v).toFixed(2)}`,
    },
    holdColumn,
    pnlUsdColumn,
    pnlPctColumn,
    feesColumn,
    tagColumn,
    deleteColumn,
  ];

  const sniperColumns = [
    { ...dateColumn, footer: dateFooter },
    tickerColumn,
    {
      key: 'deltaAtEntry',
      label: 'Δ entry',
      align: 'right',
      sort: true,
      mono: true,
      render: (v, row) => {
        if (v == null) {
          const tip = row._deltaApproximated
            ? 'Backfill tenté mais spot du sous-jacent indisponible pour ce trade historique — sera enrichi rétroactivement quand une source de spot historique sera branchée.'
            : 'Donnée non disponible (spot du sous-jacent requis, pas fourni par IBKR Flex).';
          return (
            <span className="history-page__cell-empty" title={tip}>
              —
            </span>
          );
        }
        return (
          <span className="mono">
            {v.toFixed(2)}
            {row._deltaApproximated && (
              <span
                className="history-page__cell-asterisk"
                title="Delta approximé (IV forfaitaire 30%)"
              >
                *
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'dteAtEntry',
      label: 'DTE entry',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) =>
        typeof v === 'number' ? `${v}j` : <span className="history-page__cell-empty">—</span>,
    },
    {
      key: 'ivRankAtEntry',
      label: 'IV rank',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) =>
        v == null ? (
          <span className="history-page__cell-empty" title="Donnée non disponible pour ce trade">
            —
          </span>
        ) : (
          `${Math.round(v)}%`
        ),
    },
    {
      key: 'exitReason',
      label: 'Motif sortie',
      align: 'left',
      sort: true,
      render: (v, row) => {
        const label = v && EXIT_REASON_LABELS[v] ? EXIT_REASON_LABELS[v] : '—';
        const cls = !v
          ? 'history-page__exit-cell history-page__cell-empty'
          : 'history-page__exit-cell';
        return (
          <button
            type="button"
            className={cls}
            onClick={(e) => {
              e.stopPropagation();
              setEditingExit(row);
            }}
            title="Cliquer pour confirmer ou corriger"
          >
            <span>{label}</span>
            {row._exitReasonAutoDetected && (
              <span className="history-page__cell-meta history-page__cell-meta--inline">
                auto
              </span>
            )}
          </button>
        );
      },
    },
    holdColumn,
    pnlUsdColumn,
    pnlPctColumn,
    feesColumn,
    tagColumn,
    deleteColumn,
  ];

  const columns = viewMode === 'sniper' ? sniperColumns : standardColumns;

  const mobileCardRender = (row) => {
    const tone = row.pnlUsd > 0 ? 'profit' : row.pnlUsd < 0 ? 'loss' : 'neutral';
    return (
      <div className="positions-card">
        <div className="positions-card__head">
          <div className="positions-card__ticker-wrap">
            <span className="mono positions-card__ticker">{row.tk}</span>
            <TypeBadge as={row.as} ty={row.ty} />
          </div>
          <span className="mono history-page__cell-mobile-date">{row.do}</span>
        </div>
        <div className="positions-card__body">
          <div className="positions-card__pnl">
            <span className={`mono text-${tone} positions-card__pnl-usd`}>
              {row.pnlUsd >= 0 ? '+' : ''}
              {formatUsd(row.pnlUsd)}
            </span>
            <span className={`mono text-${tone} positions-card__pnl-pct`}>
              {row.pnlPct >= 0 ? '+' : ''}
              {row.pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="positions-card__meta">
            <span>
              Entry <strong className="mono">${toFloat(row.pi).toFixed(2)}</strong>
            </span>
            <span>
              Exit <strong className="mono">${toFloat(row.po).toFixed(2)}</strong>
            </span>
            <span>
              Qty <strong className="mono">{toFloat(row.ct)}</strong>
            </span>
            <span>
              Hold <strong className="mono">{row.hold}j</strong>
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (closedTrades.length === 0) {
    return (
      <div className="page-container history-page">
        <aside className="history-page__empty-panel lh-final">
          <EmptyState
            icon={HistoryIcon}
            title="Aucun trade clôturé"
            description="Importe un Flex Query pour charger l'historique, ou ajoute un trade manuel."
            action={
              <button
                type="button"
                className="pg-mock-btn pg-mock-btn--primary"
                onClick={() => setAddOpen(true)}
              >
                <Plus size={14} aria-hidden="true" style={{ marginRight: 4 }} />
                Ajouter un trade
              </button>
            }
          />
        </aside>
        <AddTradeModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSave={(trade) => dispatch({ type: 'ADD_CLOSED_TRADE', payload: trade })}
        />
      </div>
    );
  }

  const scopeLine = `${stats.total} trade${stats.total > 1 ? 's' : ''} · ${scopeLabel}`;

  return (
    <motion.div
      className="page-container history-page"
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <HistoryIcon size={18} aria-hidden="true" />
            Historique des trades
          </h1>
          <p className="page-subtitle">
            Le grand livre · P&L réalisé, vues Standard/Sniper, analyse du sous-ensemble filtré.
          </p>
        </div>
      </motion.div>

      {/* 2.A — BANDEAU DE COMMANDEMENT : 6 cellules-MONDE sur le
          sous-ensemble filtré. Ratios neutres, montants tonés + CHF. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final hist-command"
        aria-label="Commandement — le grand livre"
      >
        <div className="hist-command__grid">
          <CommandCell
            label="TOTAL"
            value={fmtCount(stats.total)}
            sub={scopeLabel}
          />
          <CommandCell
            label="NET P&L"
            tooltip={{
              title: 'Net P&L',
              body: 'Somme des P&L réalisés sur le sous-ensemble filtré, nets des frais IBKR.',
            }}
            value={fmtCurrency(stats.net)}
            chf={chf(stats.net, true)}
            tone={toneSign(stats.net)}
          />
          <CommandCell
            label="WIN RATE"
            tooltip={{
              title: 'Win Rate',
              body: "% de trades gagnants (décisifs ≥ 10 requis). Utile à lire en combinaison avec l'Avg R.",
            }}
            value={fmtPercent(stats.winRate)}
            sub={stats.winRate == null ? `${stats.decisive} décisifs / 10 requis` : `${stats.winCount}↑ / ${stats.lossCount}↓`}
          />
          <CommandCell
            label="AVG R"
            tooltip={{
              title: 'Avg R',
              body: 'Gain moyen rapporté à la perte moyenne. > 1.5 = bon risque/récompense.',
            }}
            value={fmtNumber(stats.avgR)}
            sub="gain / perte moy."
          />
          <CommandCell
            label="BEST"
            value={fmtCurrency(stats.best)}
            chf={chf(stats.best, true)}
            tone={toneSign(stats.best)}
          />
          <CommandCell
            label="WORST"
            value={fmtCurrency(stats.worst)}
            chf={chf(stats.worst, true)}
            tone={toneSign(stats.worst)}
          />
        </div>
      </motion.section>

      {/* 2.A — BARRE D'OUTILS du grand livre : toggle de vue (anatomie
          ViewToggle des héros), filtres au même registre, CTA ambre. */}
      <motion.div variants={RISE_TILE_VARIANTS} className="hist-toolbar">
        <ChipGroup
          ariaLabel="Mode d'affichage"
          options={[
            ['standard', 'STANDARD'],
            ['sniper', 'SNIPER'],
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
        <span className="hist-toolbar__sep" aria-hidden="true" />
        <ChipGroup
          ariaLabel="Filtre résultat"
          options={[
            ['all', 'TOUS'],
            ['win', 'GAGNANTS'],
            ['loss', 'PERDANTS'],
          ]}
          value={resultTab}
          onChange={setResultTab}
        />
        <ChipGroup
          ariaLabel="Filtre actif"
          options={[
            ['all', 'TOUS'],
            ['options', 'OPTIONS'],
            ['stocks', 'ACTIONS'],
          ]}
          value={typeTab}
          onChange={setTypeTab}
        />
        <button type="button" className="hist-cta" onClick={() => setAddOpen(true)}>
          <Plus size={14} aria-hidden="true" /> Ajouter un trade
        </button>
      </motion.div>

      {/* DataTable — l'héroïne pleine largeur. */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <DataTable
          data={filtered}
          columns={columns}
          defaultSort={{ key: 'do', dir: 'desc' }}
          enableSearch
          enableExport={(rows) => exportCsv(rows, lr)}
          mobileCardRender={mobileCardRender}
          maxHeight={640}
          emptyTitle="Aucun trade dans ce filtre"
          emptyMessage="Élargis les filtres ou ajoute un trade manuel."
        />
      </motion.div>

      {/* 2.A — ÉTAGE ANALYSE : un panneau cockpit, 3 zones aux rails.
          MÊME sous-ensemble filtré que la table (une page = une vérité),
          sous-titres de scope honnêtes, système Obsidienne. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final hist-analyse"
        aria-label="Analyse du sous-ensemble filtré"
      >
        <div className="hist-analyse__grid">
          <div className="hist-analyse__zone hist-analyse__zone--donut">
            <div className="mk-title">WIN RATE</div>
            <div className="hist-analyse__scope">{scopeLine}</div>
            <div className="hist-analyse__donut-wrap">
              <WinRateDonut winRate={stats.winRate} size={124} strokeWidth={11} />
              <div className="hist-analyse__donut-sub">
                {stats.winRate == null
                  ? `${stats.decisive} décisifs / 10 requis`
                  : `${stats.winCount}↑ / ${stats.lossCount}↓`}
              </div>
            </div>
          </div>
          <div className="hist-analyse__zone">
            <div className="mk-title">DISTRIBUTION P&L</div>
            <div className="hist-analyse__scope">{scopeLine}</div>
            {stats.total > 2 ? (
              <Suspense fallback={<div className="hist-analyse__chart-slot" />}>
                <LazyDistribution trades={filtered} height={224} />
              </Suspense>
            ) : (
              <div className="hist-analyse__empty">
                Pas assez de clôtures (≥ 3) sur ce filtre pour une distribution.
              </div>
            )}
          </div>
          <div className="hist-analyse__zone hist-analyse__zone--attr">
            <div className="mk-title">ATTRIBUTION · EDGE × CAPITAL</div>
            <div className="hist-analyse__scope">{scopeLine}</div>
            <PerformanceAttribution trades={filtered} />
          </div>
        </div>
      </motion.section>

      <AddTradeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(trade) => dispatch({ type: 'ADD_CLOSED_TRADE', payload: trade })}
      />

      {editingExit && (
        <Modal open={!!editingExit} onClose={() => setEditingExit(null)} title="Motif de sortie">
          <ExitReasonEditor
            trade={editingExit}
            onConfirm={() => {
              dispatch({ type: 'CONFIRM_EXIT_REASON', payload: editingExit.id });
              setEditingExit(null);
            }}
            onOverride={(reason) => {
              dispatch({ type: 'SET_EXIT_REASON', payload: { id: editingExit.id, reason } });
              setEditingExit(null);
            }}
            onClose={() => setEditingExit(null)}
          />
        </Modal>
      )}
    </motion.div>
  );
}
