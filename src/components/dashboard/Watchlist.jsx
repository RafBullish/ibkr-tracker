// ═══════════════════════════════════════════════════════════════
//  WATCHLIST v4 brick 7 — module col 1-3 row 3 (200 px)
//
//  Table dense 7 cols × 10 rows max. Header h-22 + thead h-22 +
//  10 × h-15 = 22 + 22 + 150 = 194 → tient dans 200 px.
//
//  Cols : Ticker · Last · Chg% · Vol · IV% · IVR · Spark
//
//  Brick 7 add/remove ticker = console.log preview only. La vraie
//  persistence (slice store qc:watchlist + reducer + debounce)
//  arrive dans une brick séparée.
// ═══════════════════════════════════════════════════════════════

import { compactVolume } from '../../utils/watchlist';
import { ivrTone } from '../../utils/ivrank';
import PositionSparkline from './PositionSparkline';

const fmtPctSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.00 %';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(digits)} %`;
};

const fmtNum = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
};

const toneFromSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

function handleAdd() {
  // Brick 7 preview — vraie UI inline + persistence en brick séparée.
  console.log('[Watchlist] add ticker (preview)');
}

function handleTickerClick(tk) {
  console.log('[Watchlist] click', tk, '→ /trading/chain?ticker=' + tk);
}

function IvrCell({ ivr }) {
  if (ivr == null || !Number.isFinite(ivr)) return <span className="live-pos__mute">—</span>;
  const pct = Math.max(0, Math.min(100, ivr));
  const tone = ivrTone(pct); // profit < 30, mute 30-70, loss > 70
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

export default function Watchlist({ data, area = 'watch' }) {
  const tickers = Array.isArray(data) ? data : [];
  const isEmpty = tickers.length === 0;

  return (
    <section className="module watchlist" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Watchlist · {tickers.length} tickers</span>
        <button
          type="button"
          className="watchlist__add-btn"
          onClick={handleAdd}
          title="Ajouter un ticker"
        >
          + Add
        </button>
      </header>
      <div className="module-body watchlist__body">
        {isEmpty ? (
          <div className="watchlist__empty module-empty">
            <span className="module-empty__title">Watchlist vide</span>
            <span className="module-empty__sub">
              Ajoute un ticker via le bouton + Add. La persistance localStorage est câblée en
              parallèle de Sprint 5 (PreMarketBriefing).
            </span>
          </div>
        ) : (
          <table className="watchlist__table" aria-label="Watchlist">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Last</th>
                <th>Chg %</th>
                <th>Vol</th>
                <th>IV %</th>
                <th>IVR</th>
                <th>Spk</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => (
                <tr key={t.tk} className="watchlist__row" onClick={() => handleTickerClick(t.tk)}>
                  <td className="watchlist__ticker">{t.tk}</td>
                  <td>{fmtNum(t.last, 2)}</td>
                  <td className={`live-pos__cell--${toneFromSign(t.chgPct)}`}>
                    {fmtPctSigned(t.chgPct)}
                  </td>
                  <td className="live-pos__mute">{compactVolume(t.vol)}</td>
                  <td>{fmtNum(t.ivPct, 1)}</td>
                  <td>
                    <IvrCell ivr={t.ivRank} />
                  </td>
                  <td>
                    <PositionSparkline prices={t.spark1d} dir="Long" width={50} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
