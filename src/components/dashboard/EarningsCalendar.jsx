// ═══════════════════════════════════════════════════════════════
//  EARNINGS CALENDAR v4 brick 7 — module col 4-6 row 3 (200 px)
//
//  Table dense 7 cols × N events. Header h-22 + thead h-22 +
//  ~10 rows h-15 = 22 + 22 + 150 = 194 px → tient.
//
//  Cols : Ticker · Date · T · EPS · Rev · IVΔ · DTE
//
//  Highlight : si le ticker est dans ownedTickers, la ligne reçoit
//  un subtle bg ambre (signale qu'on a position ouverte sur ce
//  ticker → earnings = risque IV crush sur la position).
//
//  Filter : J+7 par défaut (props maxDte). Sort : ASC par date.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { filterByDte, sortByDate, compactRevenue, earningsTimeLabel } from '../../utils/earnings';

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

const fmtShortDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const month = FR_MONTHS[parseInt(parts[1], 10) - 1] || parts[1];
  return `${month} ${parseInt(parts[2], 10)}`;
};

const fmtEps = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return `$${v.toFixed(2)}`;
};

const fmtIvDelta = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return `−${v.toFixed(1)} %`;
};

const currentMonthLabel = () => {
  const d = new Date();
  return `${FR_MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
};

export default function EarningsCalendar({ data, ownedTickers, maxDte = 7, area = 'earn' }) {
  const events = useMemo(() => {
    const filtered = filterByDte(Array.isArray(data) ? data : [], maxDte);
    return sortByDate(filtered);
  }, [data, maxDte]);
  const owned = ownedTickers instanceof Set ? ownedTickers : new Set(ownedTickers || []);
  const isEmpty = events.length === 0;

  return (
    <section className="module earnings-cal" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Earnings · J+{maxDte}</span>
        <span className="module-header__hint">{currentMonthLabel()}</span>
      </header>
      <div className="module-body earnings-cal__body">
        {isEmpty ? (
          <div className="earnings-cal__empty">
            Aucun earnings dans les {maxDte} prochains jours
          </div>
        ) : (
          <table className="earnings-cal__table" aria-label="Earnings J+7">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Date</th>
                <th>T</th>
                <th>EPS</th>
                <th>Rev</th>
                <th>IVΔ</th>
                <th>DTE</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const isOwned = owned.has(e.tk);
                return (
                  <tr
                    key={`${e.tk}-${e.date}`}
                    className={`earnings-cal__row${isOwned ? ' earnings-cal__row--owned' : ''}`}
                  >
                    <td className="earnings-cal__ticker">
                      {e.tk}
                      {isOwned && (
                        <span className="earnings-cal__owned-dot" aria-label="position ouverte" />
                      )}
                    </td>
                    <td className="live-pos__mute">{fmtShortDate(e.date)}</td>
                    <td>
                      <span className="earnings-cal__t-pill">{earningsTimeLabel(e.time)}</span>
                    </td>
                    <td>{fmtEps(e.estEps)}</td>
                    <td className="live-pos__mute">{compactRevenue(e.estRev)}</td>
                    <td className="live-pos__cell--loss">{fmtIvDelta(e.ivCrushPct)}</td>
                    <td>
                      {e.dte}
                      <span className="live-pos__sub">d</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
