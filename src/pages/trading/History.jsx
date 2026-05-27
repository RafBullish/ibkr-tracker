// ═══════════════════════════════════════════════════════════════
//  HISTORY v3.0 « Midnight Terminal »
//  /trading/history
//
//  KPI strip (6 MetricCards), toolbar (Add trade + tabs), DataTable
//  v3 virtualized, and a distribution panel (P&L histogram +
//  WinRate donut) at the bottom.
//
//  Known limitation B-01: IBKR Flex exposes only IBCommission as
//  a single fees field. The "Fees" column shows the aggregate and
//  carries an InfoTooltip explaining the upstream limitation.
// ═══════════════════════════════════════════════════════════════

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Download,
  Plus,
  History as HistoryIcon,
  Target,
  DollarSign,
  Trophy,
  TrendingDown,
  Zap,
  Crosshair,
  Trash2,
} from 'lucide-react';
import { useClosedTrades, useSettings, useDispatch } from '../../store/useStore';
import { tradePnlUsd } from '../../utils/calculations';
import { calculateTradingMetrics } from '../../hooks/useTradingMetrics';
import { formatUsd } from '../../utils/format';
import { toFloat, ensurePositive } from '../../utils/math';
import { holdingDays } from '../../utils/dates';

import GlassCard from '../../components/ui/GlassCard';
import MetricCard from '../../components/ui/MetricCard';
import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import AddTradeModal from '../../components/trades/AddTradeModal';
import WinRateDonut from '../../components/ui/WinRateDonut';
import PerformanceAttribution from '../../components/history/PerformanceAttribution';
import { detectExitReason, EXIT_REASONS } from '../../utils/trades/detectExitReason';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

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
  if (ty === 'CALL') return <StatusBadge variant="accent" label="CALL" size="xs" />;
  return <StatusBadge variant="loss" label={ty || 'PUT'} size="xs" />;
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

  const filtered = useMemo(() => {
    return enriched.filter((t) => {
      if (resultTab === 'win' && t.pnlUsd <= 0) return false;
      if (resultTab === 'loss' && t.pnlUsd >= 0) return false;
      if (typeTab === 'options' && t.as !== 'Option') return false;
      if (typeTab === 'stocks' && t.as !== 'Action') return false;
      return true;
    });
  }, [enriched, resultTab, typeTab]);

  const stats = useMemo(() => {
    const m = calculateTradingMetrics(filtered, lr);
    // A2b — winRate is nullable upstream when decisive<10. Preserve null
    // here so MetricCard / WinRateDonut render "—" instead of "0 %".
    if (!m) return { total: 0, net: 0, winRate: null, avgR: 0, best: 0, worst: 0 };
    return {
      total: m.totalPnlCount,
      net: m.totalPnl,
      winRate: m.winRate,
      avgR: m.avgLoss > 0 ? m.avgWin / m.avgLoss : 0,
      best: m.bestTrade,
      worst: m.worstTrade,
    };
  }, [filtered, lr]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{ fontWeight: 'var(--fw-semibold)' }}>
          {v || '—'}
        </span>
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

  const standardColumns = [
    dateColumn,
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
    dateColumn,
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
            <span style={{ color: 'var(--text-tertiary)' }} title={tip}>
              —
            </span>
          );
        }
        return (
          <span className="mono">
            {v.toFixed(2)}
            {row._deltaApproximated && (
              <span
                style={{ color: 'var(--text-tertiary)', marginLeft: 2 }}
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
        typeof v === 'number' ? `${v}j` : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'ivRankAtEntry',
      label: 'IV rank',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) =>
        v == null ? (
          <span
            style={{ color: 'var(--text-tertiary)' }}
            title="Donnée non disponible pour ce trade"
          >
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
        const tone = !v ? { color: 'var(--text-tertiary)' } : undefined;
        return (
          <button
            type="button"
            className="history-v3__exit-cell"
            onClick={(e) => {
              e.stopPropagation();
              setEditingExit(row);
            }}
            style={tone}
            title="Cliquer pour confirmer ou corriger"
          >
            <span>{label}</span>
            {row._exitReasonAutoDetected && (
              <span
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 10,
                  fontStyle: 'italic',
                  marginLeft: 4,
                }}
              >
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
          <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            {row.do}
          </span>
        </div>
        <div className="positions-card__body">
          <div className="positions-card__pnl">
            <span
              className={`mono text-${tone}`}
              style={{ fontSize: 18, fontWeight: 'var(--fw-bold)' }}
            >
              {row.pnlUsd >= 0 ? '+' : ''}
              {formatUsd(row.pnlUsd)}
            </span>
            <span className={`mono text-${tone}`} style={{ fontSize: 12 }}>
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
      <div className="page-container">
        <GlassCard variant="subtle" style={{ maxWidth: 640, margin: '60px auto' }}>
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
        </GlassCard>
        <AddTradeModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSave={(trade) => dispatch({ type: 'ADD_CLOSED_TRADE', payload: trade })}
        />
      </div>
    );
  }

  return (
    <motion.div
      className="page-container history-v3"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <HistoryIcon size={18} aria-hidden="true" />
            Historique des trades
            <StatusBadge variant="accent" label={`${stats.total} trades`} size="xs" />
          </h1>
          <p className="page-subtitle">
            P&L réalisé cumulé · filtres gagnants/perdants · export CSV.
          </p>
        </div>
        <div className="history-v3__header-actions">
          <div className="history-v3__view-toggle" role="group" aria-label="Mode d'affichage">
            <button
              type="button"
              className="history-v3__view-btn"
              data-active={viewMode === 'standard' || undefined}
              onClick={() => setViewMode('standard')}
              aria-pressed={viewMode === 'standard'}
            >
              Standard
            </button>
            <button
              type="button"
              className="history-v3__view-btn"
              data-active={viewMode === 'sniper' || undefined}
              data-sniper-active={viewMode === 'sniper' || undefined}
              onClick={() => setViewMode('sniper')}
              aria-pressed={viewMode === 'sniper'}
            >
              <Crosshair size={12} aria-hidden="true" style={{ marginRight: 4 }} />
              Sniper
            </button>
          </div>
          <button type="button" className="pg-mock-btn" onClick={() => setAddOpen(true)}>
            <Plus size={14} aria-hidden="true" /> Ajouter
          </button>
        </div>
      </motion.div>

      {/* KPI strip — 6 MetricCards */}
      <motion.div variants={TILE_VARIANTS} className="history-v3__kpi-strip">
        <MetricCard
          label="Total"
          value={stats.total}
          format="number"
          size="compact"
          icon={HistoryIcon}
        />
        <MetricCard
          label="Net P&L"
          value={stats.net}
          format="currency"
          currency="USD"
          size="compact"
          icon={DollarSign}
          semantic={stats.net > 0 ? 'profit' : stats.net < 0 ? 'loss' : 'neutral'}
          tooltip={{
            title: 'Net P&L',
            body: 'Somme des P&L réalisés sur la plage filtrée, nets des frais IBKR.',
          }}
        />
        <MetricCard
          label="Win Rate"
          value={stats.winRate}
          format="percent"
          size="compact"
          icon={Target}
          semantic={stats.winRate >= 50 ? 'profit' : stats.winRate < 40 ? 'loss' : 'neutral'}
          tooltip={{
            title: 'Win Rate',
            body: "% de trades gagnants. Utile à lire en combinaison avec l'Avg R.",
          }}
        />
        <MetricCard
          label="Avg R"
          value={stats.avgR}
          format="number"
          size="compact"
          icon={Zap}
          semantic={stats.avgR >= 1.5 ? 'profit' : stats.avgR < 1 ? 'loss' : 'neutral'}
          tooltip={{
            title: 'Avg R',
            body: 'Gain moyen rapporté à la perte moyenne. > 1.5 = bon risque/récompense.',
          }}
        />
        <MetricCard
          label="Best"
          value={stats.best}
          format="currency"
          currency="USD"
          size="compact"
          icon={Trophy}
          semantic="profit"
        />
        <MetricCard
          label="Worst"
          value={stats.worst}
          format="currency"
          currency="USD"
          size="compact"
          icon={TrendingDown}
          semantic="loss"
        />
      </motion.div>

      {/* Tabs filtres */}
      <motion.div variants={TILE_VARIANTS} className="history-v3__tabs">
        <div className="history-v3__tab-group" role="tablist" aria-label="Filtre résultat">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'win', label: 'Gagnants' },
            { key: 'loss', label: 'Perdants' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className="history-v3__tab"
              data-active={resultTab === t.key || undefined}
              onClick={() => setResultTab(t.key)}
              aria-pressed={resultTab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="history-v3__tab-group" role="tablist" aria-label="Filtre actif">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'options', label: 'Options' },
            { key: 'stocks', label: 'Actions' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className="history-v3__tab"
              data-active={typeTab === t.key || undefined}
              onClick={() => setTypeTab(t.key)}
              aria-pressed={typeTab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* DataTable */}
      <motion.div variants={TILE_VARIANTS}>
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

      {/* Distribution row */}
      {stats.total > 2 && (
        <motion.div variants={TILE_VARIANTS} className="history-v3__dist-row">
          <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
            <div className="dashboard-v3__panel-head">
              <span className="uppercase-label">Win rate</span>
              <InfoTooltip
                content={{ title: 'Win Rate', body: '% trades gagnants sur le filtre actif.' }}
                size={12}
              />
            </div>
            <WinRateDonut winRate={stats.winRate} />
          </GlassCard>
          <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
            <div className="dashboard-v3__panel-head">
              <span className="uppercase-label">Distribution P&L</span>
              <InfoTooltip
                content={{
                  title: 'Distribution P&L',
                  body: 'Histogramme des P&L $ par trade. Queue à droite = tail winners.',
                }}
                size={12}
              />
            </div>
            <Suspense fallback={<div style={{ height: 200 }} />}>
              <LazyDistribution trades={filtered} />
            </Suspense>
          </GlassCard>
        </motion.div>
      )}

      {/* v5 Sprint 7 — Edge × Capital attribution heatmap below the
          existing distribution row. Uses sniper meta sidecar tagging. */}
      <motion.div variants={TILE_VARIANTS}>
        <PerformanceAttribution />
      </motion.div>

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
