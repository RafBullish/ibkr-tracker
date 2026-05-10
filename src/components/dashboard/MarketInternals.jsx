// ═══════════════════════════════════════════════════════════════
//  MARKET INTERNALS v4 brick 8 — module col 1-3 row 4 (200 px)
//
//  Table dense breadth & sentiment indicators.
//  6 lignes × 3 colonnes (INDICATOR | NYSE | NASDAQ).
//  Header h-22 + thead h-22 + 6 × h-22 = 22 + 22 + 132 = 176 → tient.
//
//  Rows h-22 (lecture latérale 2 colonnes : un peu plus aérées
//  que les h-15 ailleurs).
// ═══════════════════════════════════════════════════════════════

import {
  formatIntSigned,
  formatVolumeSigned,
  classifyTick,
  classifyTrin,
  classifyPcr,
  classifySigned,
} from '../../utils/internals';

const fmtTrin = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
};

const fmtPcr = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
};

const fmtRatio = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
};

function Cell({ value, tone }) {
  const display = value == null || value === '—' ? '—' : value;
  const t = tone || 'mute';
  const cls = display === '—' ? 'live-pos__mute' : `live-pos__cell--${t}`;
  return <td className={cls}>{display}</td>;
}

export default function MarketInternals({ data, area = 'intrn' }) {
  if (!data || (!data.nyse && !data.nasdaq)) {
    return (
      <section className="module market-internals" style={{ gridArea: area }}>
        <header className="module-header">
          <span className="module-header__title">Market Internals</span>
          <span className="module-header__hint">Realtime</span>
        </header>
        <div className="module-body market-internals__body">
          <div className="market-internals__empty module-empty">
            <span className="module-empty__title">Internals indisponibles</span>
            <span className="module-empty__sub">
              TICK / TRIN / VOLD / ADD via flux Yahoo. Câblage prévu en sprint data-source
              ultérieur.
            </span>
          </div>
        </div>
      </section>
    );
  }

  const ny = data.nyse || {};
  const nq = data.nasdaq || {};

  // Lignes ordre exact spec.
  const rows = [
    {
      label: 'TICK',
      ny: { value: formatIntSigned(ny.tick), tone: classifyTick(ny.tick) },
      nq: { value: formatIntSigned(nq.tick), tone: classifyTick(nq.tick) },
    },
    {
      label: 'TRIN',
      ny: { value: fmtTrin(ny.trin), tone: classifyTrin(ny.trin) },
      nq: { value: fmtTrin(nq.trin), tone: classifyTrin(nq.trin) },
    },
    {
      label: 'A/D Ratio',
      ny: { value: fmtRatio(ny.advDecRatio), tone: classifySigned(ny.advDecRatio - 1) },
      nq: { value: fmtRatio(nq.advDecRatio), tone: classifySigned(nq.advDecRatio - 1) },
    },
    {
      label: 'VOLD',
      ny: {
        value: formatVolumeSigned(
          Number.isFinite(ny.volDiffMln) ? ny.volDiffMln * 1_000_000 : null
        ),
        tone: classifySigned(ny.volDiffMln),
      },
      nq: {
        value: formatVolumeSigned(
          Number.isFinite(nq.volDiffMln) ? nq.volDiffMln * 1_000_000 : null
        ),
        tone: classifySigned(nq.volDiffMln),
      },
    },
    {
      label: 'PCR EQ',
      ny: { value: fmtPcr(ny.putCallRatio), tone: classifyPcr(ny.putCallRatio) },
      nq: { value: fmtPcr(nq.putCallRatio), tone: classifyPcr(nq.putCallRatio) },
    },
    {
      label: 'PCR IDX',
      ny: { value: fmtPcr(ny.putCallRatioIdx), tone: classifyPcr(ny.putCallRatioIdx) },
      nq: { value: '—', tone: 'mute' },
    },
  ];

  return (
    <section className="module market-internals" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Market Internals</span>
        <span className="module-header__hint">{data.session || 'Realtime'}</span>
      </header>
      <div className="module-body market-internals__body">
        <table className="market-internals__table" aria-label="Market Internals">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>NYSE</th>
              <th>NASDAQ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="market-internals__row">
                <td className="market-internals__label">{r.label}</td>
                <Cell value={r.ny.value} tone={r.ny.tone} />
                <Cell value={r.nq.value} tone={r.nq.tone} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
