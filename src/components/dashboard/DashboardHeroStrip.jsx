// ═══════════════════════════════════════════════════════════════
//  DASHBOARD HERO STRIP v5 Sprint B — two-tier KPI band (88 px)
//
//  3 PRIMARY cells (36 px values) for at-a-glance survival metrics :
//     NLV · Day P&L · Available Capital
//  Hairline-strong separator
//  6 SECONDARY cells (14 px values) for context :
//     MTD · YTD · Realized · Unrealized · Exposure · USD-CHF
//
//  Day P&L renders '——' until Sprint C wires the IBKR Account Summary
//  endpoint. The big '——' in 36 px is intentional — it serves as a
//  constant visual reminder to prioritise the wiring next.
//
//  YTD same situation (will render in Sprint C).
//
//  VIX / SPX removed from Hero (already in TickerTape + StatusBar =
//  was triple-display redundancy in Sprint 2.4).
//
//  Available Capital uses Option A (cash-based simple) :
//    max(0, NLV − Σ notional). v1 conservative — replaced with real
//    Excess Liquidity in Sprint C. See useAvailableCapital.js JSDoc.
// ═══════════════════════════════════════════════════════════════

import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import useAvailableCapital from '../../hooks/useAvailableCapital';

const fmtUsdCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    return `$${(v / 1_000_000).toLocaleString('de-CH', { maximumFractionDigits: 2 })}M`;
  }
  if (abs >= 10_000) {
    return `$${Math.round(v).toLocaleString('de-CH')}`;
  }
  return `$${v.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`;
};

const fmtUsdSigned = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  if (v === 0) return '$0';
  const sign = v > 0 ? '+' : '−';
  const abs = Math.abs(v);
  if (abs >= 10_000) {
    return `${sign}$${Math.round(abs).toLocaleString('de-CH')}`;
  }
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtChfCompact = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return `${Math.round(v).toLocaleString('de-CH')} CHF`;
};

const fmtRate = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return v.toFixed(4);
};

const tone = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

function HeroCell({ tier = 'secondary', label, value, sub, tone: cellTone = 'neutral' }) {
  return (
    <div className={`hero-strip__cell hero-strip__cell--${tier}`} data-tone={cellTone}>
      <span className="hero-strip__label">{label}</span>
      <span className="hero-strip__value">{value}</span>
      {sub ? <span className="hero-strip__sub">{sub}</span> : null}
    </div>
  );
}

export default function DashboardHeroStrip() {
  const metrics = usePortfolioMetrics();
  const { availableUsd } = useAvailableCapital();

  const nlvUsd = metrics?.netLiquidationValueUsd;
  const nlvChf = metrics?.netLiquidationValueChf;
  const realizedUsd = metrics?.realizedPnlUsd;
  const unrealUsd = metrics?.unrealizedPnlUsd;
  const mtdUsd = metrics?.monthlyPnlUsd;
  const exposureUsd = metrics?.totalExposure;
  const liveRate = metrics?.liveRate;

  return (
    <div className="hero-strip" role="region" aria-label="Indicateurs du portefeuille">
      {/* PRIMARY ZONE — 3 BIG cells (36 px values) */}
      <HeroCell
        tier="primary"
        label="NLV"
        value={fmtUsdCompact(nlvUsd)}
        sub={nlvChf != null ? fmtChfCompact(nlvChf) : null}
        tone="strong"
      />
      <HeroCell
        tier="primary"
        label="Day P&L"
        value="——"
        sub="account summary à câbler"
        tone="mute"
      />
      <HeroCell
        tier="primary"
        label="Avail. Capital"
        value={fmtUsdCompact(availableUsd)}
        sub="capital deployable (v1)"
        tone={availableUsd != null && availableUsd > 0 ? 'strong' : 'mute'}
      />

      <div className="hero-strip__separator" aria-hidden="true" />

      {/* SECONDARY ZONE — 6 SMALL cells (14 px values) */}
      <HeroCell label="MTD" value={fmtUsdSigned(mtdUsd)} sub="mois en cours" tone={tone(mtdUsd)} />
      <HeroCell label="YTD" value="——" sub="période fiscale" tone="mute" />
      <HeroCell
        label="Realized"
        value={fmtUsdSigned(realizedUsd)}
        sub={metrics?.tradeCount != null ? `${metrics.tradeCount} trades` : null}
        tone={tone(realizedUsd)}
      />
      <HeroCell
        label="Unrealized"
        value={fmtUsdSigned(unrealUsd)}
        sub="positions ouvertes"
        tone={tone(unrealUsd)}
      />
      <HeroCell
        label="Exposure"
        value={fmtUsdCompact(exposureUsd)}
        sub="market value"
        tone="neutral"
      />
      <HeroCell label="USD/CHF" value={fmtRate(liveRate)} sub="taux IBKR fix" tone="amber" />
    </div>
  );
}
