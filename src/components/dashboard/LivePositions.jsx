// ═══════════════════════════════════════════════════════════════
//  LIVE POSITIONS v4 brick 6 + v5 Sprint 1.3 — data grid 19 colonnes
//
//  Module bento col 1-12 row 2 (160 px). Plein-écran dashboard,
//  table dense Excel-style. Header 22 + h-22 thead + N × h-15
//  rows. Au-delà de ~7 rows : scroll Y interne, jamais sur le
//  module.
//
//  19 colonnes ordre exact spec v5 :
//    TICKER · TYPE · STR · EXP · DTE · QTY · ENTRY · MARK ·
//    UNREAL$ · UNREAL% · Δ · Θ · IVR · EDGE · C-TIER · GATE-NXT ·
//    DAYS-IN · SPARK 7D · ALERT
//
//  v5 Sprint 1.3 deltas vs v4 :
//    - EDGE (was combined "E3C2") split into two cols : EDGE + C-TIER.
//    - GATE renamed GATE-NXT and reads pos.nextGate object (computed
//      via computeNextGate util) instead of pos.gates[0]. Renders
//      "TKR DTE45 in Xd" or "SL35 ARMED" semantics.
//    - DAYS renamed DAYS-IN for clarity (days-in-trade convention).
//
//  Phase C.2.10-V3 — harmonisation design sur TradeHistory :
//    + Sub-header riche (Σ Δ · Σ Θ · Σ Unreal · Best · Worst + OPEN N).
//    + Footer agrégé 6 cells (Σ UNREAL · Σ NOTIONAL · Σ MAX RISK ·
//      Σ Δ $ · Σ Θ $/J · CLOSEST DTE).
//    + Style table aligné sur TradeHistory (thead blur sticky,
//      hover row, gridlines, paddings). Les 19 colonnes intactes.
//
//  Props-driven : <LivePositions data={...} />.
//  data = output de useLivePositions / buildLivePositions.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import PositionSparkline from './PositionSparkline';
import SniperMetaEditor from './SniperMetaEditor';

const FR_MONTHS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

const fmtUsd = (v, digits = 0) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const fmt = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  return (v < 0 ? '-' : '') + '$' + fmt.format(Math.abs(v));
};

const fmtUsdSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '$0.00';
  const sign = v > 0 ? '+' : '−';
  return `${sign}$${Math.abs(v).toFixed(digits)}`;
};

const fmtPctSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.00 %';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(digits)} %`;
};

const fmtNumberSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.00';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(digits)}`;
};

const fmtExp = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const month = FR_MONTHS[parseInt(parts[1], 10) - 1] || parts[1];
  const yy = parts[0].slice(-2);
  return `${month}'${yy}`;
};

const toneFromSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

const ALERT_TONE = {
  DTE: 'warn',
  EARN: 'info',
  IV: 'warn',
  PRICE: 'warn',
  TIME: 'warn',
};

function IvrCell({ ivr }) {
  if (ivr == null || !Number.isFinite(ivr)) return <span className="live-pos__mute">—</span>;
  const pct = Math.max(0, Math.min(100, ivr));
  // High-IV bar color = profit (premium-rich for short premium strategies),
  // low-IV bar color = mute, mid = neutral.
  const tone = pct > 70 ? 'profit' : pct < 20 ? 'loss' : 'mute';
  return (
    <span className="live-pos__ivr">
      <span className="live-pos__ivr-num">{Math.round(pct)}</span>
      <span className="live-pos__ivr-bar">
        <span
          className={`live-pos__ivr-fill live-pos__ivr-fill--${tone}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

// v5 Sprint 2.2 : pills clickable when empty → opens SniperMetaEditor.
// When tagged, the pill renders as a span (no click) — re-tagging is
// done via the row-level "Tag" affordance (Sprint 2.3+ adds an
// explicit edit button ; for now click on cell still works to retag).
function EdgePill({ edge, onTag }) {
  if (!edge) {
    return (
      <button type="button" className="live-pos__tag-btn" onClick={onTag} title="Tag Edge Tier">
        Tag
      </button>
    );
  }
  return (
    <button
      type="button"
      className="live-pos__edge-pill live-pos__edge-pill--clickable"
      onClick={onTag}
      title="Modifier Edge Tier"
    >
      {edge}
    </button>
  );
}

function CTierPill({ cap, onTag }) {
  if (!cap) {
    return (
      <button type="button" className="live-pos__tag-btn" onClick={onTag} title="Tag Capital Tier">
        Tag
      </button>
    );
  }
  return (
    <button
      type="button"
      className="live-pos__ctier-pill live-pos__ctier-pill--clickable"
      onClick={onTag}
      title="Modifier Capital Tier"
    >
      {cap}
    </button>
  );
}

// v5 Sprint 1.3 : nextGate is { gateType, daysToTrigger, dte } | null.
// Format : "DTE45 in 12d" / "SL35 ARMED" / "SL35 in 3d".
function GatePill({ nextGate }) {
  if (!nextGate) return <span className="live-pos__mute">—</span>;
  const { gateType, daysToTrigger } = nextGate;
  let suffix;
  if (daysToTrigger > 0) {
    suffix = ` ${daysToTrigger}d`;
  } else if (daysToTrigger === 0) {
    suffix = ' 0d';
  } else {
    suffix = ' ARMED';
  }
  const tone = daysToTrigger <= 0 ? 'armed' : daysToTrigger <= 7 ? 'imminent' : 'normal';
  return (
    <span className={`live-pos__gate-pill live-pos__gate-pill--${tone}`}>
      {gateType}
      <span className="live-pos__gate-pill-sub">{suffix}</span>
    </span>
  );
}

function AlertPill({ alert }) {
  if (!alert) return <span className="live-pos__mute">—</span>;
  const tone = ALERT_TONE[alert] || 'warn';
  return <span className={`live-pos__alert-pill live-pos__alert-pill--${tone}`}>{alert}</span>;
}

function PositionRow({ pos, onTag }) {
  const isStock = pos.type === 'STK';
  // B5 fix 3 — rail tone-coloré gauche selon P&L non-réalisé.
  const rowTone = toneFromSign(pos.unrealDollar);
  const rowClass =
    rowTone === 'profit'
      ? 'live-pos__row live-pos__row--profit'
      : rowTone === 'loss'
        ? 'live-pos__row live-pos__row--loss'
        : 'live-pos__row';
  return (
    <tr className={rowClass}>
      <td className="live-pos__ticker">{pos.ticker || '—'}</td>
      <td>
        <span className={`live-pos__type-pill live-pos__type-pill--${pos.type}`}>{pos.type}</span>
      </td>
      <td>{isStock ? '—' : pos.strike != null ? `$${pos.strike}` : '—'}</td>
      <td className="live-pos__mute">{isStock ? '—' : fmtExp(pos.exp)}</td>
      <td>
        {isStock || pos.dte == null ? (
          '—'
        ) : (
          <>
            {pos.dte}
            <span className="live-pos__sub">d</span>
          </>
        )}
      </td>
      <td>{pos.qty}</td>
      <td>${pos.entry.toFixed(2)}</td>
      <td>${pos.mark.toFixed(2)}</td>
      <td className={`live-pos__cell--${toneFromSign(pos.unrealDollar)}`}>
        {fmtUsdSigned(pos.unrealDollar, 2)}
      </td>
      <td className={`live-pos__cell--${toneFromSign(pos.unrealPct)}`}>
        {fmtPctSigned(pos.unrealPct, 2)}
      </td>
      {/* Δ NEUTRE (loi de couleur) : delta signé ≠ perte $ → toujours mute. */}
      <td className="live-pos__cell--mute">
        {isStock || pos.delta == null ? '—' : fmtNumberSigned(pos.delta, 2)}
      </td>
      {/* Θ NEUTRE (loi de couleur) : theta signé ≠ perte $ → toujours mute. */}
      <td className="live-pos__cell--mute">
        {isStock || pos.theta == null ? '—' : fmtNumberSigned(pos.theta, 2)}
      </td>
      <td>
        <IvrCell ivr={isStock ? null : pos.ivr} />
      </td>
      <td>
        <EdgePill edge={pos.edgeTier} onTag={() => onTag(pos)} />
      </td>
      <td>
        <CTierPill cap={pos.capitalTier} onTag={() => onTag(pos)} />
      </td>
      <td>
        {isStock ? <span className="live-pos__mute">—</span> : <GatePill nextGate={pos.nextGate} />}
      </td>
      <td>
        {pos.daysHeld}
        <span className="live-pos__sub">d</span>
      </td>
      <td>
        <PositionSparkline prices={pos.spark7d} dir={pos.dir} />
      </td>
      <td>
        <AlertPill alert={pos.alert} />
      </td>
    </tr>
  );
}

export default function LivePositions({ data, area = 'positions' }) {
  const count = data?.count ?? 0;
  const totalNotional = data?.totalNotional ?? 0;
  const totalMaxRisk = data?.totalMaxRisk ?? 0;
  const positions = data?.positions ?? [];
  const isEmpty = count === 0;

  // v5 Sprint 2.2 : modal state for per-position Sniper meta tagging.
  // Opens when the user clicks the EDGE / C-TIER pill or its 'Tag'
  // placeholder in a row.
  const [editorPos, setEditorPos] = useState(null);

  // Phase C.2.10-V3 — stats agrégés pour sub-header + footer.
  // Une seule passe sur positions calcule toutes les dérivations
  // (Σ Δ qty-pondéré, Σ Θ qty-pondéré, Σ Unreal $, best/worst
  // unreal, deltaDollar agrégé, thetaDollar agrégé, closestDte).
  // Le brief autorise explicitement la fusion subheader+footer.
  const stats = useMemo(() => {
    if (!positions.length) {
      return {
        totalDelta: 0,
        totalTheta: 0,
        totalUnreal: 0,
        bestUnreal: null,
        worstUnreal: null,
        openCount: 0,
        deltaDollar: 0,
        thetaDollar: 0,
        closestDte: null,
        inProfitCount: 0,
        inLossCount: 0,
      };
    }

    let totalDelta = 0;
    let totalTheta = 0;
    let totalUnreal = 0;
    let bestUnreal = null;
    let worstUnreal = null;
    let deltaDollar = 0;
    let thetaDollar = 0;
    let closestDte = null;
    let inProfitCount = 0;
    let inLossCount = 0;

    for (const p of positions) {
      const qty = Number.isFinite(p.qty) ? p.qty : 0;
      const mark = Number.isFinite(p.mark) ? p.mark : 0;
      const isOption = p.type === 'CALL' || p.type === 'PUT';
      const mu = isOption ? 100 : 1;
      // A3c — sign-aware aggregation. `p.delta` / `p.theta` are stored as
      // per-share BSM values (positive for calls held long). A short
      // call inverts the exposure : dir='Short' ⇒ Δ negative, Θ positive.
      // Previously this block summed sign-agnostically, so a mixed book
      // (long + short) would have produced wrong signs on the subheader
      // and footer pills. Long-only books are unaffected (sign=+1).
      const dirSign = p.dir === 'Short' ? -1 : 1;

      if (Number.isFinite(p.delta)) {
        totalDelta += dirSign * p.delta * qty;
        // delta dollar = delta × qty × mu × prix sous-jacent. Sans
        // spot price API on approxime via mark — ordre de grandeur
        // correct pour exposition directionnelle agrégée.
        deltaDollar += dirSign * p.delta * qty * mu * mark;
      }
      if (Number.isFinite(p.theta)) {
        totalTheta += dirSign * p.theta * qty;
        thetaDollar += dirSign * p.theta * qty * mu;
      }

      if (Number.isFinite(p.unrealDollar)) {
        totalUnreal += p.unrealDollar;
        if (p.unrealDollar > 0) inProfitCount++;
        else if (p.unrealDollar < 0) inLossCount++;
        if (!bestUnreal || p.unrealDollar > bestUnreal.value) {
          bestUnreal = { ticker: p.ticker, value: p.unrealDollar };
        }
        if (!worstUnreal || p.unrealDollar < worstUnreal.value) {
          worstUnreal = { ticker: p.ticker, value: p.unrealDollar };
        }
      }

      if (Number.isFinite(p.dte)) {
        if (!closestDte || p.dte < closestDte.dte) {
          closestDte = { ticker: p.ticker, dte: p.dte };
        }
      }
    }

    // 1 seule position : on n'affiche que Best (pas Worst sur le
    // même trade — éviter la redondance trompeuse).
    if (
      bestUnreal &&
      worstUnreal &&
      bestUnreal.ticker === worstUnreal.ticker &&
      positions.length === 1
    ) {
      worstUnreal = null;
    }

    return {
      totalDelta,
      totalTheta,
      totalUnreal,
      // Best n'a de sens que profit > 0 ; Worst que loss < 0.
      bestUnreal: bestUnreal && bestUnreal.value > 0 ? bestUnreal : null,
      worstUnreal: worstUnreal && worstUnreal.value < 0 ? worstUnreal : null,
      openCount: positions.length,
      deltaDollar,
      thetaDollar,
      closestDte,
      inProfitCount,
      inLossCount,
    };
  }, [positions]);

  // CLOSEST DTE color logic : ≤14j = loss (urgent expiry),
  // ≤45j = profit (sweet spot Sniper OTM v1), >45 = neutre.
  const closestDteClass =
    stats.closestDte && stats.closestDte.dte <= 14
      ? 'live-pos__footer-value--loss'
      : stats.closestDte && stats.closestDte.dte <= 45
        ? 'live-pos__footer-value--profit'
        : '';

  const headerHint = isEmpty
    ? 'Σ Notional $0 · Σ Max Risk $0'
    : `Σ Notional ${fmtUsd(totalNotional, 0)} · Σ Max Risk ${fmtUsdSigned(totalMaxRisk, 0)}`;

  return (
    <section className="module live-pos" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">
          Live Positions · {count} {count === 1 ? 'ouverte' : 'ouvertes'}
        </span>
        <span className="module-header__hint">{headerHint}</span>
      </header>

      {!isEmpty && (
        <div className="live-pos__subheader">
          <div className="live-pos__ctx">
            Σ Δ{' '}
            <span className="live-pos__ctx-val live-pos__ctx-val--mute">
              {fmtNumberSigned(stats.totalDelta, 2)}
            </span>
          </div>
          <div className="live-pos__dot">·</div>
          <div className="live-pos__ctx">
            Σ Θ{' '}
            <span className="live-pos__ctx-val live-pos__ctx-val--mute">
              {fmtNumberSigned(stats.totalTheta, 2)} / j
            </span>
          </div>
          <div className="live-pos__dot">·</div>
          <div className="live-pos__ctx">
            Σ Unreal{' '}
            <span
              className={`live-pos__ctx-val live-pos__ctx-val--${toneFromSign(stats.totalUnreal)}`}
            >
              {fmtUsdSigned(stats.totalUnreal, 2)}
            </span>
          </div>
          <div className="live-pos__dot">·</div>
          <div className="live-pos__ctx">
            Best{' '}
            <span className="live-pos__ctx-val live-pos__ctx-val--profit">
              {stats.bestUnreal
                ? `${stats.bestUnreal.ticker} ${fmtUsdSigned(stats.bestUnreal.value, 0)}`
                : '—'}
            </span>
          </div>
          <div className="live-pos__dot">·</div>
          <div className="live-pos__ctx">
            Worst{' '}
            <span className="live-pos__ctx-val live-pos__ctx-val--loss">
              {stats.worstUnreal
                ? `${stats.worstUnreal.ticker} ${fmtUsdSigned(stats.worstUnreal.value, 0)}`
                : '—'}
            </span>
          </div>
          <div className="live-pos__ctx-spacer" />
          <div className="live-pos__ctx-badge live-pos__ctx-badge--wins">
            IN PROFIT {stats.inProfitCount}
          </div>
          <div className="live-pos__ctx-badge live-pos__ctx-badge--losses">
            IN LOSS {stats.inLossCount}
          </div>
        </div>
      )}

      <div className="module-body live-pos__body">
        {isEmpty ? (
          <div className="live-pos__empty">Aucune position ouverte</div>
        ) : (
          <table className="live-pos__table" aria-label="Live positions">
            {/* B5.5 — colgroup explicite : pattern miroir TradeHistory.
               Stabilise table-layout: fixed (sans ça, Chrome utilisait la
               thead pour widths, ce qui combiné au border-left 3px des
               tbody trs cassait le rendu et masquait 5/6 lignes). */}
            <colgroup>
              <col className="live-pos__col-ticker" />
              <col className="live-pos__col-type" />
              <col className="live-pos__col-str" />
              <col className="live-pos__col-exp" />
              <col className="live-pos__col-dte" />
              <col className="live-pos__col-qty" />
              <col className="live-pos__col-entry" />
              <col className="live-pos__col-mark" />
              <col className="live-pos__col-unrealdol" />
              <col className="live-pos__col-unrealpct" />
              <col className="live-pos__col-delta" />
              <col className="live-pos__col-theta" />
              <col className="live-pos__col-ivr" />
              <col className="live-pos__col-edge" />
              <col className="live-pos__col-ctier" />
              <col className="live-pos__col-gate" />
              <col className="live-pos__col-daysin" />
              <col className="live-pos__col-spark" />
              <col className="live-pos__col-alert" />
            </colgroup>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Type</th>
                <th>Str</th>
                <th>Exp</th>
                <th>DTE</th>
                <th>Qty</th>
                <th>Entry</th>
                <th>Mark</th>
                <th>Unreal $</th>
                <th>Unreal %</th>
                <th>Δ</th>
                <th>Θ</th>
                <th>IVR</th>
                <th>Edge</th>
                <th>C-Tier</th>
                <th>Gate Nxt</th>
                <th>Days In</th>
                <th>Spark 7D</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {/* B5.3 — clé composite avec fallback index : si pos.id manque
                 (positions importées sans passer la migration v3→v4), plusieurs
                 trs partageraient key=undefined et React n'en mounterait qu'1.
                 Pattern miroir de TradeHistory ligne 433. */}
              {positions.map((pos, i) => (
                <PositionRow
                  key={
                    pos.id ||
                    `pos-${pos.ticker || 'x'}-${pos.exp || 'x'}-${pos.strike || 'x'}-${i}`
                  }
                  pos={pos}
                  onTag={setEditorPos}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isEmpty && (
        <footer className="live-pos__footer">
          <div className="live-pos__footer-cell">
            <span className="live-pos__footer-label">Σ UNREAL $</span>
            <span
              className={`live-pos__footer-value live-pos__footer-value--${toneFromSign(stats.totalUnreal)}`}
            >
              {fmtUsdSigned(stats.totalUnreal, 2)}
            </span>
          </div>
          <div className="live-pos__footer-cell">
            <span className="live-pos__footer-label">Σ NOTIONAL</span>
            <span className="live-pos__footer-value">
              {fmtUsd(totalNotional, 0)}
            </span>
          </div>
          <div className="live-pos__footer-cell">
            <span className="live-pos__footer-label">Σ MAX RISK</span>
            <span className="live-pos__footer-value live-pos__footer-value--loss">
              {fmtUsdSigned(totalMaxRisk, 0)}
            </span>
          </div>
          <div className="live-pos__footer-cell">
            <span className="live-pos__footer-label">Σ Δ $</span>
            <span className="live-pos__footer-value live-pos__footer-value--mute">
              {fmtUsdSigned(stats.deltaDollar, 0)}
            </span>
          </div>
          <div className="live-pos__footer-cell">
            <span className="live-pos__footer-label">Σ Θ $ / J</span>
            <span className="live-pos__footer-value live-pos__footer-value--mute">
              {fmtUsdSigned(stats.thetaDollar, 0)}
            </span>
          </div>
          <div className="live-pos__footer-cell">
            <span className="live-pos__footer-label">CLOSEST DTE</span>
            <span className={`live-pos__footer-value ${closestDteClass}`}>
              {stats.closestDte
                ? `${stats.closestDte.ticker} ${stats.closestDte.dte}j`
                : '—'}
            </span>
          </div>
        </footer>
      )}

      <SniperMetaEditor
        position={editorPos}
        open={!!editorPos}
        onClose={() => setEditorPos(null)}
      />
    </section>
  );
}
