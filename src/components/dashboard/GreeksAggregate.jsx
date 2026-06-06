// ═══════════════════════════════════════════════════════════════
//  GREEKS AGGREGATE v4 brick 5 — KPI strip + per-position table
//
//  Module bento col 10-12 row 1 (240 px). Split horizontal 50/50 :
//    Top 109 px : 4-col KPI strip (Σ Δ · Σ Γ · Σ Θ · Σ ν)
//    Hairline 1 px
//    Bottom 108 px : per-position dense table (h-15 par row)
//
//  Props-driven : <GreeksAggregate data={...} area='greeks' />.
//  data = output de aggregateGreeks() (real store via
//  useGreeksAggregate, ou fixture inline sur /__playground).
//
//  Sémantique des seuils :
//    Σ Delta  : profit > 0, loss < 0, mute = 0
//    Σ Gamma  : mute toujours (pas de signe métier intrinsèque)
//    Σ Theta  : profit > 0 (rare, short premium net), loss < 0
//    Σ Vega   : profit > 0 (long vol), loss < 0 (short vol)
// ═══════════════════════════════════════════════════════════════

const USD_FMT_0D = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v < 0 ? '-' : '') + '$' + USD_FMT_0D.format(Math.abs(v));
};

const fmtUsdSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}$${Math.abs(v).toFixed(digits)}`;
};

const fmtNumberSigned = (v, digits = 0) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(digits)}`;
};

const fmtNumber = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
};

const toneFromSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

function KpiCol({ label, value, sub, tone }) {
  return (
    <div className="greeks-agg__kpi">
      <span className="greeks-agg__kpi-label">{label}</span>
      <span className={`greeks-agg__kpi-value greeks-agg__kpi-value--${tone || 'mute'}`}>
        {value}
      </span>
      <span className="greeks-agg__kpi-sub">{sub}</span>
    </div>
  );
}

export default function GreeksAggregate({ data, area = 'greeks' }) {
  const isEmpty = !data || data.optionsCount === 0;
  const count = data?.optionsCount ?? 0;
  const headerLabel = `Greeks · ${count} ${count === 1 ? 'option' : 'options'}`;

  return (
    <section className="module greeks-agg" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">{headerLabel}</span>
        <span className="module-header__hint">Portfolio</span>
      </header>

      <div className="greeks-agg__top">
        {isEmpty ? (
          <>
            <KpiCol label="Σ Delta" value="—" sub="no options" tone="mute" />
            <KpiCol label="Σ Gamma" value="—" sub="no options" tone="mute" />
            <KpiCol label="Σ Theta" value="—" sub="no options" tone="mute" />
            <KpiCol label="Σ Vega" value="—" sub="no options" tone="mute" />
          </>
        ) : (
          <>
            <KpiCol
              label="Σ Delta"
              value={fmtNumberSigned(data.sumDelta, 0)}
              sub={`exp ${fmtUsd(data.notionalDelta)}`}
              tone={toneFromSign(data.sumDelta)}
            />
            <KpiCol label="Σ Gamma" value={fmtNumber(data.sumGamma, 2)} sub="per $1↑" tone="mute" />
            <KpiCol
              label="Σ Theta"
              value={fmtUsdSigned(data.thetaDaily, 2)}
              sub={`${fmtUsdSigned(data.thetaDaily, 2)}/d`}
              tone={toneFromSign(data.thetaDaily)}
            />
            <KpiCol
              label="Σ Vega"
              value={fmtUsdSigned(data.vegaPer1Pct, 2)}
              sub={`${fmtUsdSigned(data.vegaPer1Pct, 2)}/1%IV`}
              tone={toneFromSign(data.vegaPer1Pct)}
            />
          </>
        )}
      </div>

      <div className="greeks-agg__bottom">
        {isEmpty ? (
          <div className="greeks-agg__empty module-empty">
            <span className="module-empty__title">Aucune option ouverte</span>
            <span className="module-empty__sub">
              Σ-Δ / Σ-Θ / Σ-V s&apos;agrègent ici dès qu&apos;une position option est ouverte.
            </span>
          </div>
        ) : (
          <table className="greeks-agg__table" aria-label="Greeks per position">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Type</th>
                <th>Δ</th>
                <th>Γ</th>
                <th>Θ</th>
                <th>ν</th>
                <th>Ctr</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => {
                const isStock = p.type === 'STK';
                return (
                  <tr key={p.id}>
                    <td className="greeks-agg__ticker">{p.ticker}</td>
                    <td>
                      <span className={`greeks-agg__type-pill greeks-agg__type-pill--${p.type}`}>
                        {p.type}
                      </span>
                    </td>
                    <td className={`greeks-agg__cell--${isStock ? 'mute' : toneFromSign(p.delta)}`}>
                      {isStock ? '—' : fmtNumber(p.delta, 2)}
                    </td>
                    <td className="greeks-agg__cell--mute">
                      {p.gamma != null ? fmtNumber(p.gamma, 3) : '—'}
                    </td>
                    <td className={`greeks-agg__cell--${toneFromSign(p.theta)}`}>
                      {p.theta != null ? fmtNumber(p.theta, 2) : '—'}
                    </td>
                    <td className={`greeks-agg__cell--${toneFromSign(p.vega)}`}>
                      {p.vega != null ? fmtNumber(p.vega, 2) : '—'}
                    </td>
                    <td className="greeks-agg__cell--mute">{p.contracts}</td>
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
