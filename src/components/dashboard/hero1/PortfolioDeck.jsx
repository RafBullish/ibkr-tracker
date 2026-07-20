// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (1.D) — PORTFOLIO DECK : zone haute portefeuille refondue
//  À L'IMAGE DU MARKETDECK (1.C) juste au-dessus. Sous-panneaux denses
//  étiquetés (réutilise `.mk-cell` / `.mk-title` du MarketDeck pour une
//  transition invisible), rangées serrées label→valeur, rails, zéro void.
//
//  4 panneaux : CAPITAL & LIQUIDITÉ · P&L · RISQUE & GREEKS · PERFORMANCE.
//  Double devise USD/CHF sur les monétaires. LIQUIDITÉ DISPO = héros
//  prominent (chiffre clé), marqué `est.` tant que la vraie Buying Power
//  IBKR n'est pas câblée. Loi de couleur : rouge/vert = argent réel
//  (P&L) uniquement ; liquidité/Θ/Δ/Γ/V/ratios = neutres.
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtUsdCompact, fmtChf, toneSign } from './kit';

const fmtSharesSigned = (v) =>
  v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('de-CH')}`;
const fmtNum2 = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2));

function Row({ label, value, usd, rate, tone, sub, signed }) {
  const chf = Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null;
  return (
    <div className="pf-row">
      <span className="pf-row__label">{label}</span>
      <span className="pf-row__nums">
        <span className={`pf-row__val${tone ? ` pf-row__val--${tone}` : ''}`}>{value}</span>
        {chf ? <span className="pf-row__chf">{chf}</span> : null}
        {sub ? <span className="pf-row__sub">{sub}</span> : null}
      </span>
    </div>
  );
}

export default function PortfolioDeck({ kpi, rate }) {
  const k = kpi || {};
  return (
    <div className="pf-deck" aria-label="Portefeuille en un coup d'œil">
      {/* ── CAPITAL & LIQUIDITÉ ── */}
      <div className="mk-cell pf-cell pf-cell--capital">
        <div className="mk-title">CAPITAL &amp; LIQUIDITÉ</div>
        <div className="pf-hero">
          <div className="pf-hero__lbl">
            LIQUIDITÉ DISPO<span className="pf-est" title="Estimation (availableUsd cash-A) — vraie Buying Power/Excess Liquidity IBKR à câbler (api/account-summary/sync.js)">est.</span>
          </div>
          <div className="pf-hero__val">{k.powder == null ? '—' : fmtUsd(k.powder)}</div>
          <div className="pf-hero__chf">{fmtChf(k.powder, rate) || ''}</div>
          <div className="pf-hero__sub">{k.powderPct != null ? `${Math.round(k.powderPct)} % du NLV déployable` : 'déployable'}</div>
        </div>
        <Row label="EXPOSURE" value={k.exposure == null ? '—' : fmtUsdCompact(k.exposure)} usd={k.exposure} rate={rate} sub={k.expoPct != null ? `${Math.round(k.expoPct)} % NLV` : null} />
        <Row label="POSITIONS" value={k.positionsCount == null ? '—' : `${k.positionsCount}`} sub="ouvertes" />
        <Row label="DTE PROCHE" value={k.dte == null ? '—' : `${k.dte} j`} sub={k.dteTicker || null} />
      </div>

      {/* ── P&L ── */}
      <div className="mk-cell pf-cell">
        <div className="mk-title">P&amp;L</div>
        <Row label="DAY" value={fmtUsdSigned(k.dayPnl)} usd={k.dayPnl} rate={rate} signed tone={toneSign(k.dayPnl)} sub={k.dayPct != null ? `${k.dayPct >= 0 ? '+' : '−'}${Math.abs(k.dayPct).toFixed(2)} %` : null} />
        <Row label="UNREALIZED" value={fmtUsdSigned(k.unrealized)} usd={k.unrealized} rate={rate} signed tone={toneSign(k.unrealized)} />
        <Row label="REALIZED" value={fmtUsdSigned(k.realized)} usd={k.realized} rate={rate} signed tone={toneSign(k.realized)} />
        <Row label="MTD · MOIS" value={fmtUsdSigned(k.mtd)} usd={k.mtd} rate={rate} signed tone={toneSign(k.mtd)} />
        <Row label="YTD · ANNÉE" value={fmtUsdSigned(k.ytd)} usd={k.ytd} rate={rate} signed tone={toneSign(k.ytd)} />
      </div>

      {/* ── RISQUE & GREEKS ── */}
      <div className="mk-cell pf-cell">
        <div className="mk-title">RISQUE &amp; GREEKS</div>
        <Row label="CAP. RISQUE" value={k.riskDollar == null ? '—' : fmtUsd(k.riskDollar)} usd={k.riskDollar} rate={rate} sub="SL35" />
        <Row label="Θ / JOUR" value={fmtUsdSigned(k.thetaDay)} usd={k.thetaDay} rate={rate} signed sub="carry" />
        <Row label="Δ NET" value={fmtSharesSigned(k.netDeltaShares)} sub={k.netDeltaDollar != null ? `exp. ${fmtUsdSigned(k.netDeltaDollar)}` : 'actions'} />
        <Row label="Γ NET" value={k.gamma == null ? '—' : fmtNum2(k.gamma)} sub="gamma" />
        <Row label="V NET" value={fmtUsdSigned(k.vega)} usd={k.vega} rate={rate} signed sub="vega · /1 % IV" />
      </div>

      {/* ── PERFORMANCE ── */}
      <div className="mk-cell pf-cell">
        <div className="mk-title">PERFORMANCE</div>
        <Row label="WIN RATE" value={k.winRate == null ? '—' : `${k.winRate.toFixed(0)} %`} sub={k.tradesCount != null ? `${k.tradesCount} clôt.` : null} />
        <Row label="PROFIT FACTOR" value={k.profitFactor == null ? '—' : (Number.isFinite(k.profitFactor) ? k.profitFactor.toFixed(2) : '∞')} sub={k.profitFactor == null ? null : k.profitFactor >= 1 ? '≥ 1 rentable' : 'sous 1'} />
        <Row label="EXPECTANCY" value={fmtUsdSigned(k.expectancy)} usd={k.expectancy} rate={rate} signed sub="/ clôture" />
        <Row label="CLÔTURES" value={k.tradesCount == null ? '—' : `${k.tradesCount}`} sub="total" />
      </div>
    </div>
  );
}
