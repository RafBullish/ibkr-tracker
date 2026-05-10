// ═══════════════════════════════════════════════════════════════
//  IV RANK MOVERS v4 brick 7 — module col 10-12 row 3 (200 px)
//
//  Table dense 6 cols × top 10 movers. Tri par |ivRankD1| DESC.
//  Cols : Ticker · IV · IVR · Δ1D · IV30 · Earn
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { sortByMoveAbs, ivrTone, deltaTone } from '../../utils/ivrank';

const fmtNum = (v, digits = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
};

const fmtDeltaSigned = (v, digits = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.0';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(digits)}`;
};

function IvrCell({ ivr }) {
  if (ivr == null || !Number.isFinite(ivr)) return <span className="live-pos__mute">—</span>;
  const pct = Math.max(0, Math.min(100, ivr));
  const tone = ivrTone(pct);
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

function handleClick(tk) {
  console.log('[IVRankMovers] click', tk, '→ /trading/chain?ticker=' + tk);
}

export default function IVRankMovers({ data, area = 'ivr' }) {
  const rows = useMemo(() => sortByMoveAbs(Array.isArray(data) ? data : []).slice(0, 10), [data]);
  const isEmpty = rows.length === 0;

  return (
    <section className="module iv-movers" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">IV Rank · Top Movers</span>
        <span className="module-header__hint">All</span>
      </header>
      <div className="module-body iv-movers__body">
        {isEmpty ? (
          <div className="iv-movers__empty module-empty">
            <span className="module-empty__title">Aucun mouvement IVR</span>
            <span className="module-empty__sub">
              Les variations IV Rank &gt; 10 pts sur les tickers watchlist apparaissent ici. Source
              : Sprint 6 (IV history).
            </span>
          </div>
        ) : (
          <table className="iv-movers__table" aria-label="IV Rank top movers">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>IV</th>
                <th>IVR</th>
                <th>Δ1D</th>
                <th>IV30</th>
                <th>Earn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tk} className="iv-movers__row" onClick={() => handleClick(r.tk)}>
                  <td className="iv-movers__ticker">{r.tk}</td>
                  <td>{fmtNum(r.ivNow, 1)}</td>
                  <td>
                    <IvrCell ivr={r.ivRank} />
                  </td>
                  <td className={`live-pos__cell--${deltaTone(r.ivRankD1)}`}>
                    {fmtDeltaSigned(r.ivRankD1, 0)}
                  </td>
                  <td className="live-pos__mute">{fmtNum(r.iv30, 1)}</td>
                  <td className="live-pos__mute">{r.hasEarn ? '<14d' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
