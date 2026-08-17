// ═══════════════════════════════════════════════════════════════
//  POSITIONS — page-vitrine au langage cockpit v1.0 (brique 2.A)
//  /trading/positions
//
//  Architecture (§4.1 brique 2.A) :
//    1. BANDEAU DE COMMANDEMENT — un panneau au cadre cockpit
//       canonique (.lh-final), cellules-MONDE séparées par des
//       hairlines verticales continues. Les 5 KPI historiques
//       (Positions · Δ net · Θ total · Capital engagé · Max loss)
//       + fraîcheur Greeks en marqueur discret (registre pf-real).
//       MAX LOSS = NEUTRE (amendement 15.07.2026 : un montant
//       hypothétique n'est pas une perte).
//    2. LA TABLE, héroïne pleine largeur — SURENSEMBLE des 19
//       colonnes de LivePositions (méta Sniper affichée, édition via
//       le modal détail), badges de gates ARMED/CRITICAL au MÊME
//       classifieur que la bande décision (decision/model), footer
//       agrégé, deep-link ?focus={id}.
//    3. Branches vide / flat / live conservées, états designés.
//
//  Business logic untouched: calculateOpenPositionPnl, aggregateGreeks,
//  generateAlerts, useLivePositions (lecture seule), usePortfolioMetrics.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Briefcase, Crosshair, ArrowUpRight, Trash2 } from 'lucide-react';
import { useOpenPositions, useSettings, useClosedTrades, useDispatch } from '../../store/useStore';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import useLivePositions from '../../hooks/useLivePositions';
// É3 §4.2.1 — classifieur de gates PARTAGÉ (bande / Positions /
// LivePositions) : une position CRITICAL dans la bande = CRITICAL ici.
import useAttentionMap from '../../hooks/useAttentionMap';
import { calculateOpenPositionPnl, tradePnlUsd } from '../../utils/calculations';
// A1 — migrated from legacy computePortfolioGreeks (sign-agnostic) to
// aggregateGreeks (sign-aware via pos.dir + correct units : theta/day,
// vega/1%-IV).
import { aggregateGreeks } from '../../utils/greeks';
import { formatUsd, formatPnlUsd, fmtExpiry, fmtStrike, fmtUsd2 } from '../../utils/format';
import { holdingDays, todayDateString } from '../../utils/dates';
import { toFloat, ensurePositive, generateId } from '../../utils/math';
import { getGreeksForAllPositions } from '../../utils/greeksApi';
import { generateAlerts, getPositionAlerts } from '../../utils/alerts';
import { effectiveSlDollar } from '../../utils/risk';
// Q-B — marquage des écarts de doctrine (chips ambre, jamais bloquants) +
// sidecar de métadonnées saisies (survie au ré-import via la signature).
import { evaluatePositionViolations, violationsOnly, V_STATUS } from '../../utils/violations';
import { positionSignature } from '../../utils/positions';
import { writePositionMeta } from '../../utils/positionMeta';
import { TickValue } from '../../components/dashboard/decision/parts';
import { fmtUsd, fmtUsdSigned, fmtChf } from '../../components/dashboard/hero1/kit';

import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import SniperMetaEditor from '../../components/dashboard/SniperMetaEditor';
import { POLLING } from '../../constants/timing';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../../theme/animationVariants';

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
    <div className="positions-flat__legend-row">
      <span className="positions-flat__legend-dot" style={{ background: color }} />
      <span className="positions-flat__legend-label">{label}</span>
      <span className="mono positions-flat__legend-value">{value}</span>
    </div>
  );
}

// ── Relative age formatter (Greeks freshness marker) ─────────
function formatRelativeAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h`;
}

// É3.3 — l'ex-format « Mar'26 » est MORT : échéances en notation IBKR
// DDMMMYY (fmtExpiry central, même voix que LivePositions).

// ── Type badge (CALL / PUT / STK) ───────────────────────────
function TypeBadge({ as, ty }) {
  if (as === 'Option' && ty === 'CALL')
    return <StatusBadge variant="neutral" label="CALL" size="xs" />;
  if (as === 'Option' && ty === 'PUT') return <StatusBadge variant="neutral" label="PUT" size="xs" />;
  return <StatusBadge variant="neutral" label="STK" size="xs" />;
}

// ── Alert inline badges (P6-20, neutralisés 2.A) ────────────
// Tags FACTUELS neutres (quel signal) — l'URGENCE est portée par la
// colonne GATE (classifieur de la bande, ambre plein/filet). Un badge
// rouge sur un signal n'est pas une perte d'argent réel (loi de
// couleur) ; un seul canal d'urgence = lecture en une seconde.
const ALERT_SHORT = {
  DTE_CRITICAL: 'DTE',
  DTE_WARNING: 'DTE',
  STOP_LOSS: 'STOP',
  TIME_STOP: 'TIME',
  TP1_REACHED: 'TP1',
  TP2_REACHED: 'TP2',
  IN_PROFIT: 'OK',
};

function RowAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) return <span className="mono text-tertiary">—</span>;
  return (
    <div className="positions-v3__row-alerts">
      {alerts.map((a, i) => (
        <StatusBadge
          key={`${a.type}-${i}`}
          variant="neutral"
          label={ALERT_SHORT[a.type] || a.type}
          size="xs"
          title={a.message}
        />
      ))}
    </div>
  );
}

// ── Cellule de table riche : valeur + méta empilées (rowHeight 47) ──
function Cell2({ value, meta, metaTone }) {
  return (
    <span className="pos-cell2">
      <span className="pos-cell2__val">{value}</span>
      <span className={`pos-cell2__meta${metaTone ? ` text-${metaTone}` : ''}`}>{meta ?? ' '}</span>
    </span>
  );
}

// Greek de cellule : clamp du zéro négatif (« -0.00 » interdit dans un
// terminal) + marquage IV estimée (~, convention établie) conservé.
function fmtGreek(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const clamped = Math.abs(v) < 0.005 ? 0 : v;
  return clamped.toFixed(2);
}

// ── Cellule-MONDE du bandeau de commandement ─────────────────
// 2.A passe 3 : plus de ⓘ (affordance absente du langage deck — la
// sémantique vit dans la méta : « prime totale engagée », etc.) ;
// le tooltip complet reste accessible via title sur le libellé.
function CommandCell({ label, marker, title, value, chf, sub, tone }) {
  const meta = [chf, sub].filter(Boolean).join(sub && sub.startsWith('/') ? ' ' : ' · ');
  return (
    <div className="pf-c pos-command__cell">
      <span className="pf-c__label pos-command__label" title={title || undefined}>
        <span>{label}</span>
        {marker || null}
      </span>
      <TickValue
        text={value}
        className={`pf-c__val pos-command__val${tone ? ` pf-c__val--${tone}` : ''}`}
      />
      <span className="pf-c__meta pos-command__meta">{meta || ' '}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FLAT STATE — un panneau cockpit continu, 4 zones aux rails
//  verticaux (recomposition 2.A du 4-cartes ; contenu conservé).
// ═══════════════════════════════════════════════════════════════
function FlatState({ closedTrades, lr, navigate, reducedMotion }) {
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
  // Slice « Action » = mix descriptif, ink-mute ; call/put = résultats
  // d'argent réel historiques → up/down conservés.
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
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
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

      {/* Un seul panneau cockpit, 4 zones — plus de cartes flottantes. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final positions-flat__deck"
        aria-label="État flat — repères"
      >
        <div className="positions-flat__grid">
          <div className="positions-flat__zone">
            <div className="mk-title">DERNIÈRE CLÔTURE</div>
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
          </div>

          <div className="positions-flat__zone">
            <div className="mk-title">STATS RÉCENTES</div>
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
          </div>

          <div className="positions-flat__zone">
            <div className="mk-title">PROCHAIN SETUP</div>
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
          </div>

          <div className="positions-flat__zone">
            <div className="mk-title">RÉPARTITION</div>
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
          </div>
        </div>
      </motion.section>
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
        className="pos-iv-est"
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

function earningsLabel(earningsDate) {
  if (earningsDate === 'AUCUN') return 'AUCUN (sous-jacent sans résultats)';
  if (typeof earningsDate === 'string' && earningsDate) return earningsDate;
  return '— non renseignée';
}

function PositionDetailBody({ row, greeks, posAlerts, violations, navigate, onEdit, onCloseMode, onTagMeta }) {
  const { pos, r, pctChg, isOpt, dte, costBasis, maxLoss } = row;
  const doctrine = violations || [];
  const pnl = r.unrealizedPnlUsd;
  const pnlTone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'neutral';
  const sl = effectiveSlDollar(pos);
  const dir = pos.dir || (isOpt ? 'Long' : '—');
  return (
    <div className="position-detail">
      <div className="position-detail__head">
        <span className="mono position-detail__head-tk">{pos.tk}</span>
        <TypeBadge as={pos.as} ty={pos.ty} />
        <StatusBadge variant="neutral" label={dir} size="xs" />
        {isOpt && Number.isFinite(dte) && (
          // É3 §4.2.6 — expirée = « EXP » honnête.
          <StatusBadge variant="neutral" label={row.expired ? 'EXP' : `DTE ${dte}j`} size="xs" />
        )}
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

      {/* 2.A — méta Sniper : AFFICHAGE dans la table, ÉDITION ici. */}
      <div className="position-detail__section">
        <span className="position-detail__section-title">Méta Sniper</span>
        {/* É3.2 — l'item « IV Rank » est MORT (champ jamais servi par
            l'import réel) ; Edge/Capital restent : sidecar vivant par
            l'UI de tagging ci-dessous. */}
        <div className="position-detail__grid">
          <DetailItem label="Edge tier">{row.edgeTier || '—'}</DetailItem>
          <DetailItem label="Capital tier">{row.capitalTier || '—'}</DetailItem>
        </div>
        <button type="button" className="pg-mock-btn position-detail__tag-btn" onClick={onTagMeta}>
          Tagger la méta (E0-E4 · C1-C5 · β)
        </button>
      </div>

      {/* Q-B — saisie carte V3 : date de résultats (source P4, câblage Q-C)
          + note d'entrée. Édition via « Éditer ». */}
      <div className="position-detail__section">
        <span className="position-detail__section-title">Saisie · carte V3</span>
        <div className="position-detail__grid">
          <DetailItem label="Date de résultats">{earningsLabel(pos.earningsDate)}</DetailItem>
        </div>
        <p className="position-detail__note-line">
          {pos.entryNote ? pos.entryNote : <span className="text-tertiary">Aucune note d’entrée</span>}
        </p>
      </div>

      {/* Q-B — conformité doctrine : écarts MARQUÉS (ambre), jamais bloqués ;
          règles non mesurables affichées honnêtement (ni faute, ni conforme). */}
      <div className="position-detail__section">
        <span className="position-detail__section-title">Conformité doctrine</span>
        {doctrine.length === 0 ? (
          <span className="text-tertiary mono position-detail__no-alert">
            Aucun écart mesurable
          </span>
        ) : (
          <div className="position-detail__doctrine">
            {doctrine.map((d) => (
              <div key={d.code} className="position-detail__doctrine-row">
                <span
                  className={
                    d.status === V_STATUS.VIOLATION
                      ? 'db-badge db-badge--arme'
                      : 'position-detail__doctrine-mute'
                  }
                >
                  {d.code}
                </span>
                <span className="position-detail__doctrine-msg">{d.message}</span>
              </div>
            ))}
          </div>
        )}
        <p className="position-detail__note-line text-tertiary">
          Marquage informatif — jamais bloquant (enregistreur de vol).
        </p>
      </div>

      <div className="position-detail__section">
        <span className="position-detail__section-title">Alertes</span>
        {posAlerts.length === 0 ? (
          <span className="text-tertiary mono position-detail__no-alert">
            Aucune alerte active
          </span>
        ) : (
          // É3 §4.3 — alertes FACTUELLES NEUTRES (parité RowAlerts 2.A :
          // un signal n'est pas une perte d'argent réel ; l'urgence est
          // portée par le badge GATE du classifieur unique).
          <div className="position-detail__alerts">
            {posAlerts.map((a, i) => (
              <div key={`${a.type}-${i}`} className="position-detail__alert">
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
  // Q-B — earningsDate tri-état (une date | 'AUCUN' | null) + note d'entrée.
  const [earningsNone, setEarningsNone] = useState(pos.earningsDate === 'AUCUN');
  const [earningsDate, setEarningsDate] = useState(
    pos.earningsDate && pos.earningsDate !== 'AUCUN' ? pos.earningsDate : ''
  );
  const [entryNote, setEntryNote] = useState(pos.entryNote || '');

  // earningsDate/entryNote sont OPTIONNELS — jamais dans la condition de
  // validité (enregistreur de vol : on ne bloque pas une saisie incomplète).
  const valid =
    !!tk.trim() && toFloat(pi) > 0 && toFloat(ct) > 0 && (!isOpt || (toFloat(st) > 0 && !!ex));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const finalEarnings = earningsNone ? 'AUCUN' : earningsDate || null;
    const finalNote = entryNote.trim() ? entryNote.trim() : null;
    const patch = {
      id: pos.id,
      tk: tk.trim().toUpperCase(),
      dir,
      pi,
      ct,
      di,
      earningsDate: finalEarnings,
      entryNote: finalNote,
    };
    if (isOpt) {
      patch.ty = ty;
      patch.st = st;
      patch.ex = ex;
    }
    // Sidecar durable, keyé sur la signature de la position APRÈS édition :
    // la métadonnée survit au ré-import du même CSV (id régénéré, signature
    // stable). Le stamp est fourni ici (le module reste déterministe).
    writePositionMeta(
      positionSignature({ ...pos, ...patch }),
      { earningsDate: finalEarnings, entryNote: finalNote },
      new Date().toISOString()
    );
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
      {/* Q-B — saisie carte V3 : date de résultats (source unique de P4) +
          note d'entrée. Tri-état earnings : une date, AUCUN, ou vide. */}
      <div className="add-trade-form__row">
        <label>
          <span className="uppercase-label">Date de résultats (P4)</span>
          <input
            type="date"
            value={earningsDate}
            disabled={earningsNone}
            onChange={(e) => setEarningsDate(e.target.value)}
          />
        </label>
        <label>
          <span className="uppercase-label">Résultats</span>
          <div className="add-trade-form__toggle">
            <button
              type="button"
              data-active={!earningsNone || undefined}
              onClick={() => setEarningsNone(false)}
            >
              Date
            </button>
            <button
              type="button"
              data-active={earningsNone || undefined}
              onClick={() => setEarningsNone(true)}
            >
              AUCUN
            </button>
          </div>
        </label>
      </div>
      <div className="add-trade-form__row">
        <label className="add-trade-form__full">
          <span className="uppercase-label">Note d&apos;entrée (optionnelle)</span>
          <textarea
            className="add-trade-form__textarea"
            value={entryNote}
            onChange={(e) => setEntryNote(e.target.value)}
            rows={2}
            placeholder="thèse, contexte… — jamais bloquant"
          />
        </label>
      </div>
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
// Q-B — portes de sortie de la carte V3 (libellés d'UI, pas des nombres
// normatifs → hors périmètre check:doctrine). « porte_declenchee » +
// « porte_respectee » sont deux des 5 champs de clôture du registre app.
const PORTES_OPTIONS = [
  { v: '', l: '— non renseignée' },
  { v: 'P1_SL', l: 'P1 · Stop-loss' },
  { v: 'P2_TRAIL', l: 'P2 · Trailing' },
  { v: 'P3_DTE', l: 'P3 · DTE' },
  { v: 'P4_EARNINGS', l: 'P4 · Earnings' },
  { v: 'P5_STAGNATION', l: 'P5 · Stagnation' },
  { v: 'AUCUNE', l: 'Aucune (sortie discrétionnaire)' },
  { v: 'MANUELLE', l: 'Manuelle / autre' },
];

function PositionCloseForm({ row, lr, onConfirm, onCancel }) {
  const { pos } = row;
  const isOpt = pos.as === 'Option';
  const [po, setPo] = useState('');
  const [doDate, setDoDate] = useState(todayDateString());
  const [fo, setFo] = useState('0');
  // Q-B — champs de clôture carte V3 (registre app). picAtteint reste vide
  // (sa valeur vient du writer qc:positionMarks, hors périmètre — Q-C).
  const [porteDeclenchee, setPorteDeclenchee] = useState('');
  const [porteRespectee, setPorteRespectee] = useState('');

  const poValid = toFloat(po) > 0;
  const dateValid = !!doDate && (!pos.di || doDate >= pos.di);
  // Les portes sont OPTIONNELLES — jamais bloquantes (enregistreur de vol).
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
      // Q-B — 5 champs de clôture (registre app). prix_entree=pi, prix_sortie=po
      // déjà présents. picAtteint vide (Q-C), portes saisies (ou null).
      picAtteint: null,
      porteDeclenchee: porteDeclenchee || null,
      porteRespectee: porteRespectee || null,
      // report d'entrée conservé au dossier du trade clôturé.
      earningsDate: pos.earningsDate ?? null,
      entryNote: pos.entryNote ?? null,
    }),
    [pos, po, doDate, fo, isOpt, porteDeclenchee, porteRespectee]
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

      {/* Q-B — journal de clôture carte V3 : porte déclenchée + respectée
          (optionnelles, jamais bloquantes). */}
      <div className="add-trade-form__row">
        <label>
          <span className="uppercase-label">Porte déclenchée</span>
          <select
            className="add-trade-form__select"
            value={porteDeclenchee}
            onChange={(e) => setPorteDeclenchee(e.target.value)}
          >
            {PORTES_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="uppercase-label">Porte respectée</span>
          <select
            className="add-trade-form__select"
            value={porteRespectee}
            onChange={(e) => setPorteRespectee(e.target.value)}
          >
            <option value="">— non renseignée</option>
            <option value="OUI">Oui</option>
            <option value="NON">Non</option>
            <option value="NA">N/A</option>
          </select>
        </label>
      </div>

      <div className="position-detail__close-summary">
        <span className="position-detail__section-title">Confirmation</span>
        <div className="position-detail__grid">
          <DetailItem label="Position">
            {pos.tk}
            {isOpt ? ` ${pos.ty} $${toFloat(pos.st).toFixed(0)}` : ''}
          </DetailItem>
          <DetailItem label="Prix entrée">${toFloat(pos.pi).toFixed(2)}</DetailItem>
          <DetailItem label="Prix sortie">{poValid ? `$${toFloat(po).toFixed(2)}` : '—'}</DetailItem>
          <DetailItem label="Pic atteint">
            <span className="text-tertiary" title="Pic non mesuré — writer qc:positionMarks (Q-C) non branché.">
              — en attente Q-C
            </span>
          </DetailItem>
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
  // 2.A — éditeur de méta Sniper (modal autonome, sidecar qc:sniperMeta).
  const [tagPos, setTagPos] = useState(null);
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
  // Q-B — base de la règle de taille S1 = NLV (valeur nette), JAMAIS les
  // dépôts : un compte réduit de moitié ne doit pas se voir autoriser une
  // position supérieure à sa valeur réelle. NLV absente → indéterminée, sans repli.
  const capitalUsd = m.netLiquidationValueUsd ?? null;

  // 2.A — rows 19-colonnes de LivePositions (lecture seule, MÊMES
  // dérivations que le Dashboard : sidecar Sniper, IVR, days-in, spark,
  // Δ per-share / Θ per-day). La vérité P&L de la page reste
  // calculateOpenPositionPnl (inchangée).
  const live = useLivePositions({ greeksMap });
  const liveById = useMemo(
    () => new Map((live.positions || []).map((r) => [r.id, r])),
    [live.positions]
  );

  const positions = useMemo(
    () =>
      openPositions.map((pos) => {
        const r = calculateOpenPositionPnl(pos, lr);
        const costBasis = Math.abs(r.costBasisUsd);
        const pctChg = costBasis > 0 ? (r.unrealizedPnlUsd / costBasis) * 100 : 0;
        const isOpt = pos.as === 'Option';
        const lrow = liveById.get(pos.id) || {};
        const mul = ensurePositive(pos.mu);
        const maxLoss = toFloat(pos.pi) * toFloat(pos.ct) * mul;
        const portPct = nlvUsd > 0 ? (Math.abs(r.marketValueUsd) / nlvUsd) * 100 : 0;
        return {
          pos,
          r,
          isOpt,
          costBasis,
          maxLoss,
          portPct,
          pctChg,
          // Champs plats triables (accessorFn DataTable = row[key]).
          tk: pos.tk,
          strike: isOpt ? toFloat(pos.st) : null,
          exp: isOpt ? pos.ex : null,
          dte: isOpt ? (Number.isFinite(lrow.dte) ? lrow.dte : null) : Infinity,
          expired: isOpt ? !!lrow.expired : false,
          qty: toFloat(pos.ct),
          entry: toFloat(pos.pi),
          mark: toFloat(pos.pc),
          pnlUsd: r.unrealizedPnlUsd,
          delta: lrow.delta ?? null,
          theta: lrow.theta ?? null,
          ivEstimated: !!lrow.ivEstimated,
          // É3.2 — ivr et spark7d MORTS (slots fantômes, aucun producteur
          // réel). edgeTier/capitalTier restent : le tiroir détail les
          // affiche et les édite (sidecar SniperMetaEditor).
          edgeTier: lrow.edgeTier ?? null,
          capitalTier: lrow.capitalTier ?? null,
          daysIn: Number.isFinite(lrow.daysHeld) ? lrow.daysHeld : null,
        };
      }),
    [openPositions, lr, nlvUsd, liveById]
  );

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

  // Q-B — écarts de doctrine par position (7 règles, seuils du registre).
  // Le book de référence = les positions ouvertes (S5/S6). Non bloquant.
  const violByPos = useMemo(() => {
    const map = new Map();
    for (const pos of openPositions) {
      map.set(pos.id, evaluatePositionViolations(pos, { capitalUsd, book: openPositions }));
    }
    return map;
  }, [openPositions, capitalUsd]);

  // É3 §4.2.1 — classifieur de gates de la bande décision, servi par le
  // hook PARTAGÉ useAttentionMap (mêmes entrées, même Map) : une
  // position CRITICAL dans la bande = CRITICAL ici = CRITICAL dans
  // LivePositions. Zéro assemblage local divergent.
  const gateByPos = useAttentionMap();

  // Bandeau + footer : agrégats (une passe).
  const summary = useMemo(() => {
    let totalCost = 0;
    let totalMaxLoss = 0;
    let totalUnreal = 0;
    let totalMarkValue = 0;
    let thetaDollar = 0;
    let closest = null;
    let nOpt = 0;
    let nStk = 0;
    for (const row of positions) {
      totalCost += row.costBasis;
      totalMaxLoss += row.maxLoss;
      totalUnreal += row.pnlUsd;
      // Σ |valeur mark| — PAS un notionnel (§8 : le label doit dire ce
      // qu'il montre ; le notionnel serait strike × 100 × contrats).
      totalMarkValue += Math.abs(row.r.marketValueUsd);
      if (row.isOpt) nOpt++;
      else nStk++;
      const mul = row.isOpt ? ensurePositive(row.pos.mu) : 1;
      const dirSign = row.pos.dir === 'Short' ? -1 : 1;
      // É3.1 — l'ex `deltaDollar` (Δ×qty×mul×MARK = ×prime de l'option)
      // est MORT : le footer Δ lit l'agrégat canonique `greeks.sumDelta`
      // (équivalent-actions), même chiffre que le bandeau et le Dashboard.
      if (Number.isFinite(row.theta)) {
        thetaDollar += dirSign * row.theta * row.qty * mul;
      }
      if (row.isOpt && Number.isFinite(row.dte)) {
        if (!closest || row.dte < closest.dte)
          closest = { ticker: row.tk, dte: row.dte, expired: row.expired };
      }
    }
    return {
      count: positions.length,
      nOpt,
      nStk,
      totalCost,
      totalMaxLoss,
      totalUnreal,
      totalMarkValue,
      thetaDollar,
      closest,
    };
  }, [positions]);

  // Compte des gates par sévérité (bandeau POSITIONS : « qui réclame
  // une action » vit aussi dans le bandeau, pas que dans la table).
  const gateCounts = useMemo(() => {
    let critical = 0;
    let armed = 0;
    for (const l of gateByPos.values()) {
      if (l.severity === 'critique') critical++;
      else armed++;
    }
    return { critical, armed };
  }, [gateByPos]);

  // Fraîcheur Greeks — marqueur discret (registre pf-real, §4.1).
  const greeksFreshness = useMemo(() => {
    const hasUsable = Array.from(greeksMap.values()).some(
      (g) => g && g.source !== 'unavailable'
    );
    if (hasUsable && lastGreeksUpdate) {
      return { text: formatRelativeAge(now - lastGreeksUpdate), title: 'Greeks recalculés — âge du dernier fetch réussi' };
    }
    if (greeksMap.size === 0) return { text: '…', title: 'Greeks · en attente du premier fetch' };
    return { text: '—', title: 'Greeks indisponibles' };
  }, [greeksMap, lastGreeksUpdate, now]);

  // ─── Branch A : truly empty ────────────────────────────────
  if (positions.length === 0 && closedTrades.length === 0) {
    return (
      <div className="page-container positions-empty">
        <div className="positions-empty__panel lh-final">
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
    return (
      <FlatState
        closedTrades={closedTrades}
        lr={lr}
        navigate={navigate}
        reducedMotion={reducedMotion}
      />
    );
  }

  // ─── Branch C : open positions → bandeau + DataTable ───────
  const detailRow =
    detailId != null ? positions.find((p) => p.pos.id === detailId) || null : null;

  const chf = (usd, signed) =>
    Number.isFinite(usd) && Number.isFinite(lr) && lr > 0 ? fmtChf(usd, lr, signed) : null;

  const columns = [
    {
      key: 'tk',
      label: 'Ticker',
      align: 'left',
      sort: true,
      mono: true,
      footer: () => (
        <span>
          <span className="v3-table__tf-label">Σ · {summary.count} pos</span>
          <span className="v3-table__tf-value">
            {summary.nOpt} opt{summary.nStk > 0 ? ` · ${summary.nStk} stk` : ''}
          </span>
        </span>
      ),
      render: (v, row) => {
        const viols = violationsOnly(violByPos.get(row.pos.id) || []);
        return (
          <div className="pos-ticker-cell">
            <span className="mono pos-ticker-cell__tk">{v || '—'}</span>
            <TypeBadge as={row.pos.as} ty={row.pos.ty} />
            {viols.length > 0 && (
              <span
                className="db-badge db-badge--arme pos-ticker-cell__viol"
                title={viols.map((x) => `${x.code} · ${x.message}`).join('\n')}
              >
                {viols.map((x) => x.code).join(' ')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'strike',
      label: 'Strike',
      align: 'right',
      sort: true,
      mono: true,
      render: (_v, row) =>
        row.isOpt ? (
          <Cell2 value={fmtStrike(toFloat(row.pos.st))} meta={fmtExpiry(row.exp)} />
        ) : (
          '—'
        ),
    },
    {
      key: 'dte',
      label: 'DTE',
      align: 'right',
      sort: true,
      mono: true,
      footer: () => (
        <span>
          <span className="v3-table__tf-label">DTE proche</span>
          <span className="v3-table__tf-value">
            {summary.closest
              ? `${summary.closest.ticker} ${summary.closest.expired ? 'EXP' : `${summary.closest.dte} j`}`
              : '—'}
          </span>
        </span>
      ),
      // DTE NEUTRE (2.A) : le temps n'est pas de l'argent — l'urgence est
      // portée par la colonne GATE (classifieur de la bande décision).
      // É3 §4.2.6 : option expirée = « EXP » honnête, jamais « 0 j ».
      render: (v, row) => {
        if (!row.isOpt) return <Cell2 value="∞" meta={row.daysIn != null ? `${row.daysIn} j in` : null} />;
        if (row.expired)
          return <Cell2 value="EXP" meta={row.daysIn != null ? `${row.daysIn} j in` : null} />;
        return (
          <Cell2
            value={Number.isFinite(v) ? `${v} j` : '—'}
            meta={row.daysIn != null ? `${row.daysIn} j in` : null}
          />
        );
      },
    },
    {
      key: 'qty',
      label: 'Qté',
      align: 'right',
      sort: true,
      mono: true,
      render: (v) => String(v),
    },
    {
      key: 'entry',
      label: 'Entrée',
      align: 'right',
      sort: true,
      mono: true,
      footer: () => (
        <span>
          <span className="v3-table__tf-label">Σ Max loss</span>
          <span className="v3-table__tf-value">{fmtUsd(summary.totalMaxLoss)}</span>
        </span>
      ),
      render: (v) => fmtUsd2(v),
    },
    {
      key: 'mark',
      label: 'Mark',
      align: 'right',
      sort: true,
      mono: true,
      footer: () => (
        <span>
          <span className="v3-table__tf-label">Σ Valeur mark</span>
          <span className="v3-table__tf-value">{fmtUsd(summary.totalMarkValue)}</span>
        </span>
      ),
      // É3.2 — l'ex-sparkline inline (spark7d) est MORTE : aucun
      // producteur de marks datés par position.
      render: (v) => <span className="pos-mark-cell">{fmtUsd2(v)}</span>,
    },
    {
      key: 'pnlUsd',
      label: 'P&L $',
      align: 'right',
      sort: true,
      mono: true,
      footer: () => {
        const t =
          summary.totalUnreal > 0 ? 'profit' : summary.totalUnreal < 0 ? 'loss' : undefined;
        return (
          <span>
            <span className="v3-table__tf-label">Σ Latent</span>
            <span className={`v3-table__tf-value${t ? ` v3-table__tf-value--${t}` : ''}`}>
              {fmtUsdSigned(summary.totalUnreal)}
            </span>
          </span>
        );
      },
      render: (v, row) => {
        const tone = v > 0 ? 'profit' : v < 0 ? 'loss' : 'neutral';
        return (
          <Cell2
            value={
              <span className={`text-${tone}`}>
                {v >= 0 ? '+' : ''}
                {formatUsd(v)}
              </span>
            }
            meta={`${row.pctChg >= 0 ? '+' : ''}${row.pctChg.toFixed(2)}%`}
            metaTone={tone}
          />
        );
      },
    },
    {
      key: 'delta',
      label: 'Δ',
      align: 'right',
      sort: true,
      mono: true,
      footer: () => (
        <span title="Σ Δ×qty×100 — équivalent-actions, agrégat canonique (aggregateGreeks), même chiffre que le bandeau Δ NET. L'ex « Σ Δ $ » (Δ×qty×100×prime) est mort.">
          <span className="v3-table__tf-label">Δ · ÉQ. ACTIONS</span>
          <span className="v3-table__tf-value">
            {Number.isFinite(greeks?.sumDelta) && greeks.optionsCount + summary.nStk > 0
              ? `${greeks.sumDelta >= 0 ? '+' : '−'}${Math.abs(Math.round(greeks.sumDelta)).toLocaleString('de-CH')}`
              : '—'}
          </span>
        </span>
      ),
      render: (v, row) => {
        const s = row.isOpt ? fmtGreek(v) : null;
        if (s == null) return '—';
        if (row.ivEstimated) {
          return (
            <span className="pos-iv-est" title="IV estimée (mark hors plage no-arbitrage, défaut σ=30%)">
              ~{s}
            </span>
          );
        }
        return s;
      },
    },
    {
      key: 'theta',
      label: 'Θ / j',
      align: 'right',
      sort: true,
      mono: true,
      footer: () => (
        <span>
          <span className="v3-table__tf-label">Σ Θ $ / j</span>
          <span className="v3-table__tf-value">{fmtUsdSigned(summary.thetaDollar)}</span>
        </span>
      ),
      // Θ NEUTRE (loi de couleur) — per-day (convention LivePositions /
      // Héros 1, unifiée 2.A ; la page affichait la valeur annuelle brute).
      render: (v, row) => {
        const s = row.isOpt ? fmtGreek(v) : null;
        if (s == null) return '—';
        if (row.ivEstimated) {
          return (
            <span className="pos-iv-est" title="IV estimée (mark hors plage no-arbitrage, défaut σ=30%)">
              ~{s}
            </span>
          );
        }
        return s;
      },
    },
    // É3.2 — colonnes IVR et Tier MORTES (slots fantômes : IVR jamais
    // servi par l'import réel ; Edge/Capital = paliers de compte, le
    // tagging sidecar vit dans le tiroir détail ci-dessous).
    {
      key: 'gate',
      label: 'Gate',
      align: 'left',
      // Badge ARMED/CRITICAL — même classifieur que la bande décision.
      render: (_v, row) => {
        const g = gateByPos.get(row.pos.id);
        if (!g) return <span className="mono text-tertiary">—</span>;
        return (
          <span
            className={`db-badge db-badge--${g.severity}`}
            title={`${g.metric}${g.others > 0 ? ` · +${g.others} signal${g.others > 1 ? 'aux' : ''}` : ''}`}
          >
            {g.severity === 'critique' ? 'CRITICAL' : 'ARMED'}
          </span>
        );
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
          {row.isOpt && Number.isFinite(row.dte) && (
            <span className="mono positions-card__dte">{row.dte} j</span>
          )}
        </div>
        <div className="positions-card__body">
          <div className="positions-card__pnl">
            <span className={`mono text-${tone} positions-card__pnl-usd`}>
              {p >= 0 ? '+' : ''}
              {formatUsd(p)}
            </span>
            <span className={`mono text-${tone} positions-card__pnl-pct`}>
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
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title positions-v3__title">
            <Crosshair size={18} aria-hidden="true" />
            Positions ouvertes
            {actionableAlerts.length > 0 && (
              <StatusBadge
                variant="warn"
                label={`${actionableAlerts.length} alerte${actionableAlerts.length > 1 ? 's' : ''}`}
                size="xs"
              />
            )}
          </h1>
          <p className="page-subtitle">
            L'état du livre ouvert · P&L unrealized, Greeks par contrat, gates Sniper.
          </p>
        </div>
      </motion.div>

      {/* 2.A — BANDEAU DE COMMANDEMENT : un panneau cockpit, cellules-MONDE
          aux hairlines verticales continues. Max Loss NEUTRE (montant
          hypothétique — amendement 15.07.2026). Fraîcheur Greeks en
          marqueur discret sur la cellule Δ NET. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final pos-command"
        aria-label="Commandement — état du livre ouvert"
      >
        <div className="pos-command__grid">
          <CommandCell
            label="POSITIONS"
            title="Nombre de positions ouvertes (actions + options) et gates actifs."
            value={String(summary.count)}
            sub={
              gateCounts.critical + gateCounts.armed > 0
                ? [
                    gateCounts.critical ? `${gateCounts.critical} CRITICAL` : null,
                    gateCounts.armed ? `${gateCounts.armed} ARMED` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : `${summary.nOpt} option${summary.nOpt > 1 ? 's' : ''}${summary.nStk > 0 ? ` · ${summary.nStk} action${summary.nStk > 1 ? 's' : ''}` : ''}`
            }
          />
          <CommandCell
            label="Δ NET"
            marker={
              <span className="pf-real pos-command__fresh" title={greeksFreshness.title}>
                {greeksFreshness.text}
              </span>
            }
            title="Exposition directionnelle agrégée (options + actions, sign-aware par dir). +1 = $1 de P&L pour +$1 du sous-jacent."
            value={
              Number.isFinite(greeks.sumDelta)
                ? `${greeks.sumDelta >= 0 ? '+' : '−'}${Math.abs(greeks.sumDelta).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`
                : '—'
            }
            sub={
              Number.isFinite(greeks.notionalDelta)
                ? `exp. ${fmtUsdSigned(greeks.notionalDelta)}`
                : 'actions-éq.'
            }
          />
          <CommandCell
            label="Θ TOTAL"
            title="Érosion temporelle quotidienne cumulée sur le portefeuille d'options (sign-aware par dir)."
            value={Number.isFinite(greeks.thetaDaily) ? fmtUsdSigned(greeks.thetaDaily) : '—'}
            chf={chf(greeks.thetaDaily, true)}
            sub="/ jour"
          />
          <CommandCell
            label="CAPITAL ENGAGÉ"
            title="Coût total absolu des positions ouvertes (entry × qty × multiplier, frais inclus)."
            value={fmtUsd(summary.totalCost)}
            chf={chf(summary.totalCost)}
            sub="coût d'entrée"
          />
          <CommandCell
            label="MAX LOSS"
            title="Perte maximum théorique si toutes les options expirent sans valeur (long options only). Montant hypothétique — neutre."
            value={fmtUsd(summary.totalMaxLoss)}
            chf={chf(summary.totalMaxLoss)}
            sub="prime totale engagée"
          />
        </div>
      </motion.section>

      {/* DataTable — l'héroïne pleine largeur (surensemble LivePositions). */}
      <motion.div variants={RISE_TILE_VARIANTS}>
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
            violations={violByPos.get(detailRow.pos.id) || []}
            navigate={navigate}
            onEdit={() => setDetailMode('edit')}
            onCloseMode={() => setDetailMode('close')}
            onTagMeta={() => setTagPos({ id: detailRow.pos.id, ticker: detailRow.pos.tk })}
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

      {/* 2.A — éditeur de méta Sniper (modal autonome, sidecar). */}
      <SniperMetaEditor position={tagPos} open={!!tagPos} onClose={() => setTagPos(null)} />
    </motion.div>
  );
}
