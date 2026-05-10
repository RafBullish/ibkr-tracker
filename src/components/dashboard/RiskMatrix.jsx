// ═══════════════════════════════════════════════════════════════
//  RISK MATRIX v4 brick 4 + v5 Sprint 2.3 — table dense 17 lignes
//
//  Module bento col 7-9 row 1 (240 px). Aucune chart, aucun icône,
//  aucune sparkline. Une <table> grid-table avec 17 lignes h-15
//  (token --row-h-15 introduit dans v4-dashboard.css). Header 22 px
//  → 22 + 17 × 15 = 277 px → dépasse les 240 px du module : scroll
//  vertical interne autorisé sur module-body (overflow:auto déjà
//  présent dans v4-dashboard.css §.module-body).
//
//  v5 Sprint 2.3 ajoute 3 lignes exposure :
//    - Concentration (Herfindahl × 10000)
//    - Notional %NLV (Σ|notional| / NLV × 100)
//    - Net Δ Exp (Σ delta × qty × multiplier × dirSign, β=1)
//
//  v5 différé : VaR 95/99 (besoin équity returns window stable),
//  Beta-SPY (besoin sidecar tagging via Sprint 2.2 modal),
//  Sector max% (besoin sector map ticker → secteur). Suivront en
//  Sprint 2.4 / Sprint 4.
//
//  Chaque ligne = label uppercase à gauche + (valeur sémantique
//  colorée + sub-label muted) à droite. La sémantique vient de
//  ROWS[].tone(metrics) appliquée au cell value, suivant les seuils
//  fixés par le user dans la spec brick 4.
//
//  Props-driven : <RiskMatrix metrics={...} area="risk" />.
//  metrics est l'objet retourné par computeRiskMatrix() — produit
//  côté playground inline et côté dashboard via useRiskMatrix().
// ═══════════════════════════════════════════════════════════════

const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    signDisplay: 'auto',
  }).format(v);
};

const fmtPctSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.00 %';
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)} %`;
};

const fmtRatio = (v, digits = 2) => {
  if (v === Infinity) return '∞';
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
};

const fmtShortDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const months = [
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
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] || m} ${parseInt(d, 10)}`;
};

// ─── Threshold tone helpers (presentation only) ─────────────────
const toneCurrentDD = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  if (v < -3) return 'loss';
  if (v < -1) return 'warn';
  return 'mute';
};
const toneRecovery = (v) => {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v >= 80) return 'profit';
  if (v >= 50) return 'warn';
  return 'loss';
};
const toneWinRate = (m) => {
  if (m.winRateCount === 0) return 'mute';
  if (m.winRatePct > 55) return 'profit';
  if (m.winRatePct >= 45) return 'warn';
  return 'loss';
};
const toneProfitFactor = (v) => {
  if (v === Infinity) return 'profit';
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  if (v > 1.5) return 'profit';
  if (v >= 1) return 'warn';
  return 'loss';
};
const toneExpectancy = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};
const toneSharpe = (v) => {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v > 1) return 'profit';
  if (v >= 0.5) return 'warn';
  return 'loss';
};
const toneSortino = (v) => {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v > 1.5) return 'profit';
  if (v >= 0.8) return 'warn';
  return 'loss';
};
const toneCalmar = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  if (v > 1) return 'profit';
  if (v >= 0.5) return 'warn';
  return 'loss';
};
const toneKelly = (v) => {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v > 25) return 'warn';
  return 'mute'; // 0..25 = neutre, < 5 = mute (même rendu)
};

// v5 Sprint 2.3 — exposure thresholds
const toneConcentration = (v) => {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v >= 5000) return 'loss'; // single-name dominance, >50% weight squared
  if (v >= 2500) return 'warn'; // textbook concentrated
  return 'mute';
};
const toneNotionalPct = (v) => {
  if (v == null || !Number.isFinite(v)) return 'mute';
  if (v >= 400) return 'loss';
  if (v >= 200) return 'warn';
  return 'mute';
};
const toneNetDelta = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return Math.abs(v) > 100 ? 'warn' : 'mute';
};

// ─── 14-ligne config (ordre exact spec) ─────────────────────────
const ROWS = [
  {
    id: 'currentDD',
    label: 'Current DD',
    fmt: (m) => fmtPctSigned(m.currentDDPct),
    sub: (m) => (m.currentDDAgeDays > 0 ? `${m.currentDDAgeDays}d ago` : '—'),
    tone: (m) => toneCurrentDD(m.currentDDPct),
  },
  {
    id: 'maxDDYtd',
    label: 'Max DD (YTD)',
    fmt: (m) => (m.maxDDYtdPct > 0 ? `−${m.maxDDYtdPct.toFixed(2)} %` : '0.00 %'),
    sub: (m) => fmtShortDate(m.maxDDYtdDate),
    tone: () => 'mute',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    fmt: (m) =>
      m.recoveryPctValue == null || !Number.isFinite(m.recoveryPctValue)
        ? '—'
        : `${m.recoveryPctValue.toFixed(0)} %`,
    sub: (m) => (m.currentDDAgeDays ? `${m.currentDDAgeDays}d` : '—'),
    tone: (m) => toneRecovery(m.recoveryPctValue),
  },
  {
    id: 'vol30d',
    label: 'Vol 30D',
    fmt: (m) => (m.vol30dPct == null ? '—' : `${m.vol30dPct.toFixed(1)} %`),
    sub: () => 'ann.',
    tone: () => 'mute',
  },
  {
    id: 'winRate',
    label: 'Win Rate',
    fmt: (m) => (m.winRateCount === 0 ? '—' : `${m.winRatePct.toFixed(1)} %`),
    sub: (m) => (m.sufficient ? `n=${m.winRateCount}` : `n=${m.closedCount} · insuffisant`),
    tone: (m) => toneWinRate(m),
  },
  {
    id: 'profitFactor',
    label: 'Profit Factor',
    fmt: (m) => fmtRatio(m.profitFactorValue),
    sub: () => '—',
    tone: (m) => toneProfitFactor(m.profitFactorValue),
  },
  {
    id: 'avgWin',
    label: 'Avg Win',
    fmt: (m) => fmtUsd(m.avgWinUsd),
    sub: (m) => `${m.winCount} trades`,
    tone: () => 'profit',
  },
  {
    id: 'avgLoss',
    label: 'Avg Loss',
    fmt: (m) => fmtUsd(m.avgLossUsd),
    sub: (m) => `${m.lossCount} trades`,
    tone: () => 'loss',
  },
  {
    id: 'expectancy',
    label: 'Expectancy',
    fmt: (m) => fmtUsd(m.expectancyUsd),
    sub: () => 'per trade',
    tone: (m) => toneExpectancy(m.expectancyUsd),
  },
  {
    id: 'sharpe',
    label: 'Sharpe (YTD)',
    fmt: (m) => fmtRatio(m.sharpeRatio),
    sub: () => 'rf=4.3 %',
    tone: (m) => toneSharpe(m.sharpeRatio),
  },
  {
    id: 'sortino',
    label: 'Sortino',
    fmt: (m) => fmtRatio(m.sortinoRatio),
    sub: () => '—',
    tone: (m) => toneSortino(m.sortinoRatio),
  },
  {
    id: 'calmar',
    label: 'Calmar',
    fmt: (m) => fmtRatio(m.calmarRatio),
    sub: () => 'DD-adj',
    tone: (m) => toneCalmar(m.calmarRatio),
  },
  {
    id: 'kelly',
    label: 'Kelly %',
    fmt: (m) => (Number.isFinite(m.kellyPct) ? `${m.kellyPct.toFixed(1)} %` : '—'),
    sub: () => 'suggested',
    tone: (m) => toneKelly(m.kellyPct),
  },
  {
    id: 'maxConcur',
    label: 'Max Concur.',
    fmt: (m) => `${m.maxConcurrent ?? 0}`,
    sub: () => 'trades',
    tone: () => 'mute',
  },
  // v5 Sprint 2.3 — exposure rows
  {
    id: 'concentration',
    label: 'Concentration',
    fmt: (m) =>
      m.concentrationH == null ? '—' : `${Math.round(m.concentrationH).toLocaleString('en-US')}`,
    sub: (m) => (m.openPositionsCount ? `H · n=${m.openPositionsCount}` : 'H'),
    tone: (m) => toneConcentration(m.concentrationH),
  },
  {
    id: 'notionalPct',
    label: 'Notional %NLV',
    fmt: (m) => (m.notionalPct == null ? '—' : `${m.notionalPct.toFixed(0)} %`),
    sub: () => 'gross',
    tone: (m) => toneNotionalPct(m.notionalPct),
  },
  {
    id: 'netDelta',
    label: 'Net Δ Exp',
    fmt: (m) => {
      if (m.netDelta == null || !Number.isFinite(m.netDelta)) return '—';
      const sign = m.netDelta > 0 ? '+' : m.netDelta < 0 ? '−' : '';
      return `${sign}${Math.abs(m.netDelta).toFixed(0)}`;
    },
    sub: () => 'shares-eq',
    tone: (m) => toneNetDelta(m.netDelta),
  },
];

export default function RiskMatrix({ metrics, area = 'risk' }) {
  if (!metrics) {
    return (
      <section className="module risk-matrix" style={{ gridArea: area }}>
        <header className="module-header">
          <span className="module-header__title">Risk · Performance</span>
          <span className="module-header__hint">YTD</span>
        </header>
        <div className="module-body module-body--empty">aucune donnée</div>
      </section>
    );
  }

  const insufficient = !metrics.sufficient;

  return (
    <section className="module risk-matrix" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Risk · Performance</span>
        <span className="module-header__hint">YTD</span>
      </header>
      <div className="module-body risk-matrix__body">
        <table className="risk-matrix__table" aria-label="Risk Matrix">
          <tbody>
            {ROWS.map((row) => {
              const tone = insufficient ? 'mute' : row.tone(metrics);
              const value = insufficient ? '—' : row.fmt(metrics);
              const sub = row.sub(metrics);
              return (
                <tr key={row.id}>
                  <td className="risk-matrix__label">{row.label}</td>
                  <td className={`risk-matrix__cell risk-matrix__cell--${tone}`}>
                    <span className="risk-matrix__num">{value}</span>
                    <span className="risk-matrix__sub">{sub}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
