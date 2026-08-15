// ═══════════════════════════════════════════════════════════════
//  LIVE POSITIONS v4 brick 6 + v5 Sprint 1.3 — data grid 15 colonnes
//
//  Module bento col 1-12 row 2 (160 px). Plein-écran dashboard,
//  table dense Excel-style. Header 22 + h-22 thead + N × h-15
//  rows. Au-delà de ~7 rows : scroll Y interne, jamais sur le
//  module.
//
//  15 colonnes (É3.2 « zéro fantôme » — un slot est servi ou n'existe
//  pas) :
//    TICKER · TYPE · STR · EXP · DTE · QTY · ENTRY · MARK ·
//    UNREAL$ · UNREAL% · Δ · Θ · GATE · DAYS-IN · ALERT
//  MORTES (É3.2) : IVR (le pipeline d'import écrit toujours
//  ivRankAtEntry: null — aucune valeur réelle servie), EDGE et C-TIER
//  (paliers de COMPTE : le chip TIER du cockpit porte l'info ; le
//  tagging sidecar vit dans le tiroir détail de /trading/positions),
//  SPARK 7D (aucun producteur de marks datés par position).
//
//  É3 §4.2.1 — colonne GATE au classifieur UNIQUE deriveAttention
//  (useAttentionMap) : badges ARMED/CRITICAL, anatomie IDENTIQUE à la
//  page Positions et à la bande décision. computeNextGate et son
//  vocabulaire propre (« SL35 ARMED ») sont MORTS — une position
//  CRITICAL dans la bande est CRITICAL ici, même verdict partout.
//    - DAYS-IN : days-in-trade convention (donnée conservée).
//
//  Phase C.2.10-V3 — harmonisation design sur TradeHistory :
//    + Sub-header riche (Σ Δ · Σ Θ · Σ Unreal · Best · Worst + OPEN N).
//    + Footer agrégé 6 cells (Σ UNREAL · Σ NOTIONAL · Σ MAX RISK ·
//      Δ · ÉQ. ACTIONS · Σ Θ $/J · CLOSEST DTE).
//    + Style table aligné sur TradeHistory (thead blur sticky,
//      hover row, gridlines, paddings).
//
//  Props-driven : <LivePositions data={...} />.
//  data = output de useLivePositions / buildLivePositions.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import useAttentionMap from '../../hooks/useAttentionMap';

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

// É3.2 — IvrCell, EdgePill et CTierPill sont MORTES avec leurs
// colonnes (slots fantômes : IVR jamais servi par l'import réel,
// EDGE/C-TIER = paliers de compte, tagging au tiroir détail de
// /trading/positions — SniperMetaEditor y vit toujours).

// É3 §4.2.1 — badge GATE au classifieur unique (deriveAttention) :
// MÊME anatomie que la colonne Gate de la page Positions (db-badge,
// CRITICAL plein / ARMED filet, title = métrique + signaux annexes).
function GateBadge({ line }) {
  if (!line) return <span className="live-pos__mute">—</span>;
  return (
    <span
      className={`db-badge db-badge--${line.severity}`}
      title={`${line.metric}${line.others > 0 ? ` · +${line.others} signal${line.others > 1 ? 'aux' : ''}` : ''}`}
    >
      {line.severity === 'critique' ? 'CRITICAL' : 'ARMED'}
    </span>
  );
}

// É3 panel — pastille ALERT NEUTRE (parité RowAlerts 2.A : un signal
// n'est pas une perte ; l'ambre durable et le cyan --info sont morts,
// l'urgence vit dans la colonne GATE du classifieur unique).
function AlertPill({ alert }) {
  if (!alert) return <span className="live-pos__mute">—</span>;
  return <span className="live-pos__alert-pill">{alert}</span>;
}

function PositionRow({ pos, gateLine }) {
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
        ) : pos.expired ? (
          // É3 §4.2.6 — libellé honnête : option expirée, pas « 0d ».
          <span className="live-pos__mute" title="Option expirée">
            EXP
          </span>
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
        {isStock ? <span className="live-pos__mute">—</span> : <GateBadge line={gateLine} />}
      </td>
      <td>
        {pos.daysHeld}
        <span className="live-pos__sub">d</span>
      </td>
      <td>
        <AlertPill alert={pos.alert} />
      </td>
    </tr>
  );
}

// É3.1 — `greeks` = agrégat canonique useGreeksAggregate (hissé par le
// Dashboard) : le footer consomme sumDelta (éq. actions) et thetaDaily,
// MÊMES chiffres que le deck Héros 1 et la bande CAPITAL. La formule
// locale « Δ × qty × 100 × prime de l'option » est MORTE (elle affichait
// +$2'989 quand le deck disait +1'083).
export default function LivePositions({ data, greeks = null, area = 'positions' }) {
  const count = data?.count ?? 0;
  const totalNotional = data?.totalNotional ?? 0;
  const totalMaxRisk = data?.totalMaxRisk ?? 0;
  const positions = data?.positions ?? [];
  const isEmpty = count === 0;

  // É3.2 — l'état modal SniperMetaEditor est MORT ici avec les pills
  // EDGE/C-TIER (le tagging vit au tiroir détail de /trading/positions).

  // É3 §4.2.1 — verdict de gate par position (classifieur unique).
  const attentionMap = useAttentionMap();

  // Phase C.2.10-V3 — stats agrégés pour sub-header + footer.
  // Une seule passe sur positions calcule toutes les dérivations
  // (Σ Δ qty-pondéré, Σ Θ qty-pondéré, Σ Unreal $, best/worst
  // unreal, closestDte). É3.1 : les ex-agrégats deltaDollar (faux :
  // ×mark = ×prime) et thetaDollar (doublon) sont MORTS — le footer
  // lit l'agrégat canonique `greeks` (prop).
  const stats = useMemo(() => {
    if (!positions.length) {
      return {
        totalDelta: 0,
        totalTheta: 0,
        totalUnreal: 0,
        bestUnreal: null,
        worstUnreal: null,
        openCount: 0,
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
    let closestDte = null;
    let inProfitCount = 0;
    let inLossCount = 0;

    for (const p of positions) {
      const qty = Number.isFinite(p.qty) ? p.qty : 0;
      // A3c — sign-aware aggregation. `p.delta` / `p.theta` are stored as
      // per-share BSM values (positive for calls held long). A short
      // call inverts the exposure : dir='Short' ⇒ Δ negative, Θ positive.
      // Previously this block summed sign-agnostically, so a mixed book
      // (long + short) would have produced wrong signs on the subheader
      // and footer pills. Long-only books are unaffected (sign=+1).
      const dirSign = p.dir === 'Short' ? -1 : 1;

      if (Number.isFinite(p.delta)) {
        totalDelta += dirSign * p.delta * qty;
      }
      if (Number.isFinite(p.theta)) {
        totalTheta += dirSign * p.theta * qty;
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
          closestDte = { ticker: p.ticker, dte: p.dte, expired: !!p.expired };
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
      closestDte,
      inProfitCount,
      inLossCount,
    };
  }, [positions]);

  // É3.1 — agrégats « argent » du footer : la maison canonique (même
  // source que le deck Héros 1 / bande CAPITAL). '—' honnête tant que
  // l'agrégat n'a résolu aucune option (greeksMap pas encore là).
  const hasGreeksAgg =
    greeks != null && (greeks.optionsCount > 0 || Number.isFinite(greeks.sumDelta) && greeks.sumDelta !== 0);
  const deltaShares = hasGreeksAgg ? greeks.sumDelta : null;
  const deltaExposure = hasGreeksAgg && Number.isFinite(greeks.notionalDelta) ? greeks.notionalDelta : null;
  const thetaDay = hasGreeksAgg ? greeks.thetaDaily : null;

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
              <col className="live-pos__col-gate" />
              <col className="live-pos__col-daysin" />
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
                <th>Gate</th>
                <th>Days In</th>
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
                  gateLine={attentionMap.get(pos.id)}
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
            {/* É3 panel — montant HYPOTHÉTIQUE → NEUTRE (amendement
                15.07, déjà soldé côté /trading/positions en 2.A). */}
            <span className="live-pos__footer-label">Σ MAX RISK</span>
            <span className="live-pos__footer-value live-pos__footer-value--mute">
              {fmtUsdSigned(totalMaxRisk, 0)}
            </span>
          </div>
          <div
            className="live-pos__footer-cell"
            title={`Σ Δ×qty×100 — équivalent-actions, même source que le deck (aggregateGreeks)${deltaExposure != null ? ` · exposition ${fmtUsdSigned(deltaExposure, 0)} (Δ × spot)` : ''}. L'ex « Σ Δ $ » (Δ×qty×100×prime) est mort.`}
          >
            {/* É3.1 — l'ex « Σ Δ $ » (×prime de l'option) est MORT :
                même chiffre que le Δ NET du deck, en équivalent-actions. */}
            <span className="live-pos__footer-label">Δ · ÉQ. ACTIONS</span>
            <span className="live-pos__footer-value live-pos__footer-value--mute">
              {deltaShares != null ? fmtNumberSigned(deltaShares, 0) : '—'}
            </span>
          </div>
          <div
            className="live-pos__footer-cell"
            title="Σ (θ/365)×qty×100 — $/jour, même source que le deck (aggregateGreeks)."
          >
            <span className="live-pos__footer-label">Σ Θ $ / J</span>
            <span className="live-pos__footer-value live-pos__footer-value--mute">
              {thetaDay != null ? fmtUsdSigned(thetaDay, 0) : '—'}
            </span>
          </div>
          <div className="live-pos__footer-cell">
            {/* É3 panel — DTE NEUTRE (le temps n'est pas de l'argent,
                décision 2.A) + « EXP » honnête si l'option est expirée. */}
            <span className="live-pos__footer-label">CLOSEST DTE</span>
            <span className="live-pos__footer-value">
              {stats.closestDte
                ? `${stats.closestDte.ticker} ${stats.closestDte.expired ? 'EXP' : `${stats.closestDte.dte} j`}`
                : '—'}
            </span>
          </div>
        </footer>
      )}

    </section>
  );
}
