// ═══════════════════════════════════════════════════════════════
//  SNIPER GATE MONITOR v5 Sprint 2.1 — 6-gate dashboard module
//
//  Bento module panel showing every open option position with the
//  six Sniper OTM v1.0 Finale gates as compact horizontal mini-bars.
//
//  Layout per row (h-row 26 px) :
//
//    TKR  TYPE  STR    DTE   UNREAL%  ┃  SL35  DTE45  E-J2  E+J30  TP   TR
//    AAPL SP    220    14    -2.1%    ┃   ▓▓▓▓░  ▓▓▓░░  ····  ····  ▓▓░  ····
//
//  Color/intensity per gate :
//    safe     : amber tint, low fill
//    normal   : amber, mid fill
//    imminent : warning yellow
//    armed    : loss red + 2 s pulse animation
//    pending  : muted grey dotted (data not wired this sprint)
//
//  Click a row → navigates to /trading/positions?focus={id} (Sprint 2
//  detail-view). For now the click is a no-op when the route doesn't
//  consume the param ; the navigation is harmless.
//
//  Empty state : "Aucune position option ouverte — rien à monitorer."
//  Stocks (Action) are skipped : Sniper gates only apply to options.
// ═══════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';

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

function fmtUnrealPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0%';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

function unrealTone(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
}

function fmtType(ty, dir) {
  if (!ty || ty === '—') return '—';
  // SP / SC short put/call · LP / LC long put/call · Strategy abbreviations later.
  const isShort = dir === 'Short';
  if (ty === 'PUT') return isShort ? 'SP' : 'LP';
  if (ty === 'CALL') return isShort ? 'SC' : 'LC';
  return ty;
}

function GateBar({ gate }) {
  const { gate: name, fillPct, status, label } = gate;
  return (
    <span className={`gate-bar gate-bar--${status}`} title={`${name} · ${label}`}>
      <span className="gate-bar__name">{name}</span>
      <span className="gate-bar__track">
        <span className="gate-bar__fill" style={{ width: `${fillPct}%` }} />
      </span>
    </span>
  );
}

function GateRow({ row, onClick }) {
  const click = () => onClick?.(row);
  return (
    <tr className="sniper-gates__row" onClick={click}>
      <td className="sniper-gates__ticker">{row.ticker}</td>
      <td className="sniper-gates__type">{fmtType(row.type, row.dir)}</td>
      <td>{row.strike ? `$${row.strike}` : '—'}</td>
      <td>
        {row.dte != null ? (
          <>
            {row.dte}
            <span className="sniper-gates__sub">d</span>
          </>
        ) : (
          '—'
        )}
      </td>
      <td className={`sniper-gates__unreal sniper-gates__unreal--${unrealTone(row.unrealPct)}`}>
        {fmtUnrealPct(row.unrealPct)}
      </td>
      <td className="sniper-gates__sep" aria-hidden="true" />
      {row.gates.map((g) => (
        <td key={g.gate} className="sniper-gates__gate-cell">
          <GateBar gate={g} />
        </td>
      ))}
    </tr>
  );
}

export default function SniperGateMonitor({ data, area = 'gates' }) {
  const navigate = useNavigate();
  const rows = data?.rows || [];
  const count = data?.count || 0;
  const isEmpty = count === 0;

  // Count armed gates across all positions for the header chip.
  const armedCount = rows.reduce(
    (acc, r) => acc + r.gates.filter((g) => g.status === 'armed').length,
    0
  );

  const handleClick = (row) => {
    navigate(`/trading/positions?focus=${encodeURIComponent(row.id)}`);
  };

  return (
    <section className="module sniper-gates" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">
          Sniper Gate Monitor · {count} {count === 1 ? 'option' : 'options'}
        </span>
        <span className="module-header__hint">
          {armedCount > 0 ? (
            <span className="sniper-gates__armed-chip">{armedCount} ARMED</span>
          ) : (
            'tous les gates dans la zone safe'
          )}
        </span>
      </header>
      <div className="module-body sniper-gates__body">
        {isEmpty ? (
          <div className="sniper-gates__empty">
            Aucune position option ouverte — rien à monitorer.
          </div>
        ) : (
          <table className="sniper-gates__table" aria-label="Sniper gates monitor">
            <thead>
              <tr>
                <th>Tkr</th>
                <th>Strat</th>
                <th>Strike</th>
                <th>DTE</th>
                <th>Unreal</th>
                <th aria-hidden="true" />
                <th>SL35</th>
                <th>DTE45</th>
                <th>E-J2</th>
                <th>E+J30</th>
                <th>TP</th>
                <th>TR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <GateRow key={row.id} row={row} onClick={handleClick} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
