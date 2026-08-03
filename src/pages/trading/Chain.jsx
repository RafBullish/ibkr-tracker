// ═══════════════════════════════════════════════════════════════
//  CHAIN OPTIONS v5 Sprint 3 « Institutional Terminal »
//  /trading/chain
//
//  Refonte intégrale du chrome : retire GlassCard / MetricCard /
//  framer-motion / icônes pour s'aligner sur la densité Bloomberg
//  posée par le shell v5 (CommandBar 32 + TickerTape 24 + StatusBar
//  22). Conserve la logique de fetch Yahoo Finance + le composant
//  <OptionsChainTable /> (T-layout avec ATM-anchored highlighting).
//
//  Layout v5 (4 strips empilés au-dessus de la table) :
//    1. Topbar (32 px) : ticker input + Charger + recent history pills
//    2. Stats strip (56 px) : Spot · IV30 · HV30 · Sniper Count · ...
//    3. Tenor tabs (28 px) : 8 expirations max, flat hairline bordures
//    4. Controls (28 px) : strike count selector + Sniper OTM toggle
//    5. Table : OptionsChainTable existant, plein espace restant
//
//  Sprint 0 alignment :
//    - Pas de Tailwind (CSS vars + classes plain)
//    - Empty state « Aucune chaîne » sans illustration / icône
//    - Pas d'animation Bloomberg-grade
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { useDispatch } from '../../store/useStore';
import OptionsChainTable from '../../components/charts/OptionsChainTable';
import AddTradeModal from '../../components/trades/AddTradeModal';
import { TickValue } from '../../components/dashboard/decision/parts';
import { bsGreeks, RISK_FREE_RATE } from '../../utils/options/blackScholes';
import { invalidateGreeksMemo } from '../../utils/greeksApi';
import { appendIvHistory } from '../../utils/ivHistory';
import {
  computeMaxPain,
  computeRR25,
  topOiStrikes,
  computeNetGEX,
  findCallWall,
  findPutWall,
  findGammaFlip,
} from '../../utils/chainAnalytics';

const STRIKE_OPTS = [
  { key: '8', label: '8' },
  { key: '16', label: '16' },
  { key: '32', label: '32' },
  { key: '0', label: 'Tous' },
];

function tsToDate(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function fmtExpLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const dte = Math.round((d - now) / 86400000);
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
  return `${months[d.getMonth()]} ${d.getDate()} (${dte}d)`;
}

function estimateDelta(strike, spot, side) {
  if (!strike || !spot) return null;
  const ratio = spot / strike;
  if (side === 'call') {
    if (ratio >= 1.1) return 0.8;
    if (ratio >= 1.05) return 0.65;
    if (ratio >= 1.0) return 0.55;
    if (ratio >= 0.95) return 0.4;
    if (ratio >= 0.9) return 0.3;
    if (ratio >= 0.85) return 0.2;
    return 0.1;
  }
  if (ratio <= 0.9) return -0.8;
  if (ratio <= 0.95) return -0.6;
  if (ratio <= 1.0) return -0.45;
  if (ratio <= 1.05) return -0.3;
  if (ratio <= 1.1) return -0.2;
  return -0.1;
}

function contractGreeks({ strike, spot, iv, expiryDate, side }) {
  const fallback = {
    delta: estimateDelta(strike, spot, side),
    gamma: null,
    theta: null,
    vega: null,
  };
  if (!Number.isFinite(iv) || iv <= 0 || !strike || !spot || !expiryDate) return fallback;
  const expiryMs = new Date(expiryDate + 'T12:00:00').getTime();
  if (!Number.isFinite(expiryMs)) return fallback;
  const T = (expiryMs - Date.now()) / (365 * 86400000);
  if (T <= 0) return fallback;
  const g = bsGreeks({ S: spot, K: strike, T, r: RISK_FREE_RATE, sigma: iv, type: side });
  if (!g) return fallback;
  return { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega };
}

// Median IV across ATM ±2 strikes — quick proxy for "IV30" since Yahoo
// doesn't expose a direct surface metric. Fallback null when insufficient
// strikes around spot.
function computeAtmIv(rows, spot) {
  if (!rows || rows.length === 0 || !spot) return null;
  const sorted = [...rows].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));
  const ivs = [];
  for (const r of sorted.slice(0, 5)) {
    if (Number.isFinite(r.call?.iv) && r.call.iv > 0) ivs.push(r.call.iv);
    if (Number.isFinite(r.put?.iv) && r.put.iv > 0) ivs.push(r.put.iv);
  }
  if (ivs.length === 0) return null;
  ivs.sort((a, b) => a - b);
  return ivs[Math.floor(ivs.length / 2)];
}

const fmtUsd = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return v >= 1000
    ? `$${v.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
};

const fmtPct = (v) => {
  if (v == null || !Number.isFinite(v)) return '——';
  return `${(v * 100).toFixed(1)}%`;
};

// Cellule-MONDE du bandeau (label · valeur 34 px · méta), collée à
// gauche, min-width:0. TickValue = micro-mouvement 1.F au changement de
// valeur (coupé sous prefers-reduced-motion). `tone` colore la valeur
// (accent = zone Sniper décisionnelle ; mute = donnée indispo). `valTone`
// up/down = variation marché du spot (seul rouge/vert autorisé ici).
function Cell({ label, value, meta, tone, valTone, metaTone }) {
  return (
    <div className="chain-cell pf-c" data-tone={tone || undefined}>
      <span className="pf-c__label chain-cell__label">{label}</span>
      <TickValue
        text={value}
        className={`pf-c__val chain-cell__val${valTone ? ` pf-c__val--${valTone}` : ''}`}
      />
      <span
        className={`pf-c__meta chain-cell__meta${metaTone ? ` chain-cell__meta--${metaTone}` : ''}`}
      >
        {meta || ' '}
      </span>
    </div>
  );
}

// Régime GEX en français, registre NEUTRE (ce n'est pas de l'argent).
const GEX_REGIME_FR = {
  POSITIVE_GEX: { label: 'POSITIF', sub: 'mean-reverting' },
  NEGATIVE_GEX: { label: 'NÉGATIF', sub: 'expansion de vol' },
  NEUTRAL_GEX: { label: 'NEUTRE', sub: 'γ ≈ 0' },
};

export default function Chain() {
  const dispatch = useDispatch();

  const [presetOpen, setPresetOpen] = useState(false);
  const [preset, setPreset] = useState(null);
  const [ticker, setTicker] = useState('');
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chain_history') || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [yahooData, setYahooData] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [strikeCount, setStrikeCount] = useState('16');
  const [sniperFilter, setSniperFilter] = useState(false);
  const [loadingExpiry, setLoadingExpiry] = useState(false);
  const expiryReqRef = useRef(0);

  const handleLoad = useCallback(async () => {
    const tk = ticker.trim().toUpperCase();
    if (!tk) return;
    const newHistory = [tk, ...searchHistory.filter((t) => t !== tk)].slice(0, 5);
    setSearchHistory(newHistory);
    try {
      localStorage.setItem('chain_history', JSON.stringify(newHistory));
    } catch {
      /* quota */
    }
    setLoading(true);
    setError(null);
    setYahooData(null);
    setSelectedExpiry('');
    try {
      const res = await fetch(`/api/yahoo/${tk}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      const json = await res.json();
      const result = json?.optionChain?.result?.[0];
      if (!result) throw new Error(`Aucune donnée options pour ${tk}`);
      const expDates = (result.expirationDates || []).map((ts) => ({ ts, date: tsToDate(ts) }));
      const opts = result.options?.[0] || {};
      setYahooData({
        ticker: tk,
        currentPrice: result.quote?.regularMarketPrice || 0,
        previousClose: result.quote?.regularMarketPreviousClose || 0,
        quoteName: result.quote?.shortName || tk,
        expirationDates: expDates,
        calls: opts.calls || [],
        puts: opts.puts || [],
      });
      setSelectedExpiry(expDates[0]?.date || '');
    } catch (e) {
      setError(`Impossible de charger la chaîne pour ${tk}. ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [ticker, searchHistory]);

  const loadExpiry = useCallback(
    async (dateStr) => {
      if (!yahooData) return;
      setSelectedExpiry(dateStr);
      const expObj = yahooData.expirationDates.find((e) => e.date === dateStr);
      if (!expObj) return;
      const reqId = ++expiryReqRef.current;
      const reqTicker = yahooData.ticker;
      setLoadingExpiry(true);
      try {
        const res = await fetch(`/api/yahoo/${reqTicker}?date=${expObj.ts}`);
        if (reqId !== expiryReqRef.current) return;
        if (!res.ok) return;
        const json = await res.json();
        if (reqId !== expiryReqRef.current) return;
        const result = json?.optionChain?.result?.[0];
        if (!result) return;
        const opts = result.options?.[0] || {};
        setYahooData((prev) => {
          if (!prev || prev.ticker !== reqTicker) return prev;
          return {
            ...prev,
            calls: opts.calls || [],
            puts: opts.puts || [],
            currentPrice: result.quote?.regularMarketPrice || prev.currentPrice,
          };
        });
      } catch {
        /* keep existing */
      } finally {
        if (reqId === expiryReqRef.current) setLoadingExpiry(false);
      }
    },
    [yahooData]
  );

  const rows = useMemo(() => {
    if (!yahooData) return [];
    const strikeMap = {};
    const spot = yahooData.currentPrice || 0;

    for (const c of yahooData.calls) {
      const sk = c.strike;
      if (!strikeMap[sk]) strikeMap[sk] = { strike: sk, call: null, put: null };
      const g = contractGreeks({
        strike: sk,
        spot,
        iv: c.impliedVolatility,
        expiryDate: selectedExpiry,
        side: 'call',
      });
      strikeMap[sk].call = {
        bid: c.bid,
        ask: c.ask,
        delta: g.delta,
        gamma: g.gamma,
        theta: g.theta,
        vega: g.vega,
        iv: c.impliedVolatility,
        volume: c.volume,
        openInterest: c.openInterest,
        _dead: (c.bid ?? 0) <= 0 && (c.ask ?? 0) <= 0.01,
      };
    }
    for (const p of yahooData.puts) {
      const sk = p.strike;
      if (!strikeMap[sk]) strikeMap[sk] = { strike: sk, call: null, put: null };
      const g = contractGreeks({
        strike: sk,
        spot,
        iv: p.impliedVolatility,
        expiryDate: selectedExpiry,
        side: 'put',
      });
      strikeMap[sk].put = {
        bid: p.bid,
        ask: p.ask,
        delta: g.delta,
        gamma: g.gamma,
        theta: g.theta,
        vega: g.vega,
        iv: p.impliedVolatility,
        volume: p.volume,
        openInterest: p.openInterest,
        _dead: (p.bid ?? 0) <= 0 && (p.ask ?? 0) <= 0.01,
      };
    }

    let allRows = Object.values(strikeMap).sort((a, b) => a.strike - b.strike);
    const sc = parseInt(strikeCount, 10);
    if (sc > 0 && allRows.length > sc && spot > 0) {
      const atmIdx = allRows.reduce(
        (best, row, i) =>
          Math.abs(row.strike - spot) < Math.abs(allRows[best].strike - spot) ? i : best,
        0
      );
      const half = Math.floor(sc / 2);
      const start = Math.max(0, Math.min(atmIdx - half, allRows.length - sc));
      allRows = allRows.slice(start, start + sc);
    }
    return allRows;
  }, [yahooData, strikeCount, selectedExpiry]);

  const displayRows = useMemo(() => {
    if (!sniperFilter) return rows;
    return rows.filter((r) => {
      const d = r.call?.delta;
      return d != null && Math.abs(d) >= 0.25 && Math.abs(d) <= 0.35;
    });
  }, [rows, sniperFilter]);

  const sniperCount = useMemo(
    () =>
      rows.filter((r) => {
        const d = r.call?.delta;
        return d != null && Math.abs(d) >= 0.25 && Math.abs(d) <= 0.35;
      }).length,
    [rows]
  );

  const expiryTabs = useMemo(() => {
    if (!yahooData) return [];
    return yahooData.expirationDates.slice(0, 8).map((e) => ({
      key: e.date,
      label: fmtExpLabel(e.date),
    }));
  }, [yahooData]);

  // Derived stats for the strip
  const stats = useMemo(() => {
    if (!yahooData) return null;
    const spot = yahooData.currentPrice;
    const prev = yahooData.previousClose;
    const dayChangePct = prev && spot ? ((spot - prev) / prev) * 100 : null;
    const atmIv = computeAtmIv(rows, spot);
    return { spot, dayChangePct, atmIv };
  }, [yahooData, rows]);

  // v5 Sprint 3.6 + 9 — footer analytics (max pain, RR25 skew, OI top,
  // net GEX + walls + gamma flip)
  const analytics = useMemo(() => {
    if (!yahooData) return null;
    const spot = yahooData.currentPrice || 0;
    return {
      maxPain: computeMaxPain(rows),
      rr25: computeRR25(rows),
      oiTop: topOiStrikes(rows, 3),
      netGex: computeNetGEX(rows, spot),
      callWall: findCallWall(rows, spot),
      putWall: findPutWall(rows, spot),
      gammaFlip: findGammaFlip(rows, spot),
    };
  }, [yahooData, rows]);

  // ── Chain IV cache writer ──────────────────────────────────────
  //
  // À chaque load de chaîne, on persiste la surface IV dans
  // localStorage 'qc:chainIv:{ticker}'. Pattern identique à
  // 'ibkr_spot_cache_v1'. Lu par positionGreeks() en fallback (b)
  // quand l'inversion d'IV depuis le mark échoue (positions ITM
  // stales). Strictement opportuniste — aucun consumer ne dépend
  // de ce cache existant.
  //
  // Format écrit :
  //   { timestamp, atm, byStrike: { '520': iv, '525': iv, ... } }
  //
  // byStrike prend l'IV call (Sniper OTM portfolio = majoritairement
  // calls) en première intention, put en fallback si call manque.
  useEffect(() => {
    if (!yahooData || typeof window === 'undefined') return;
    if (!Number.isFinite(stats?.atmIv) || stats.atmIv <= 0) return;

    const byStrike = {};
    for (const r of rows) {
      const iv =
        Number.isFinite(r.call?.iv) && r.call.iv > 0
          ? r.call.iv
          : Number.isFinite(r.put?.iv) && r.put.iv > 0
            ? r.put.iv
            : null;
      if (iv != null) byStrike[String(r.strike)] = iv;
    }

    try {
      const payload = {
        timestamp: Date.now(),
        atm: stats.atmIv,
        byStrike,
      };
      window.localStorage.setItem(
        `qc:chainIv:${yahooData.ticker}`,
        JSON.stringify(payload)
      );
      // Invalide la memo greeksApi pour que les fallbacks (b) prennent
      // effet sans devoir attendre l'expiration du TTL 30 s.
      invalidateGreeksMemo();
    } catch {
      /* quota / disabled — silent */
    }

    // U13-collecte : accumule l'ATM IV du jour dans la série historique
    // locale (qc:ivHistory:{ticker}) — graine pour l'IV rank futur. Idempotent
    // par jour, rétention FIFO 400 j, écriture sûre (try/catch interne).
    // N'AFFICHE RIEN ; le cache qc:chainIv ci-dessus est inchangé.
    appendIvHistory(yahooData.ticker, stats.atmIv);
  }, [yahooData, rows, stats?.atmIv]);

  const handleRowClick = (side, strike, contract) => {
    if (!yahooData || !contract) return;
    const bid = Number(contract.bid) || 0;
    const ask = Number(contract.ask) || 0;
    const mid = bid && ask ? (bid + ask) / 2 : bid || ask || 0;
    setPreset({
      tk: yahooData.ticker,
      as: 'Option',
      ty: side === 'call' ? 'CALL' : 'PUT',
      dir: 'Long',
      st: strike != null ? String(strike) : '',
      ex: selectedExpiry || '',
      pi: mid > 0 ? mid.toFixed(2) : '',
      ct: '1',
      tag: 'Sniper OTM',
    });
    setPresetOpen(true);
  };

  const handleSavePreset = (trade) => {
    dispatch({ type: 'ADD_CLOSED_TRADE', payload: trade });
  };

  const spotDir =
    stats?.dayChangePct == null ? null : stats.dayChangePct > 0 ? 'up' : stats.dayChangePct < 0 ? 'down' : null;
  const maxPainVsSpot =
    analytics?.maxPain && stats?.spot
      ? `${analytics.maxPain.strike > stats.spot ? '+' : '−'}${(
          (Math.abs(analytics.maxPain.strike - stats.spot) / stats.spot) *
          100
        ).toFixed(1)}% vs spot`
      : null;

  return (
    <div className="chain-v5">
      {/* 1. Barre de commande : ticker input + Charger + récents (inchangée) */}
      <div className="chain-v5__topbar">
        <div className="chain-v5__search">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker (NVDA, SPY, AAPL…)"
            aria-label="Ticker"
            className="chain-v5__input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoad();
            }}
          />
          <button
            type="button"
            className="chain-v5__load-btn"
            onClick={handleLoad}
            disabled={!ticker.trim() || loading}
          >
            {loading ? 'Chargement…' : 'Charger'}
          </button>
        </div>
        {searchHistory.length > 0 && (
          <div className="chain-v5__history">
            <span className="chain-v5__history-label">Récents</span>
            {searchHistory.map((h) => (
              <button
                key={h}
                type="button"
                className="chain-v5__history-pill"
                onClick={() => setTicker(h)}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {yahooData ? (
        <>
          {/* 2. BANDEAU DE COMMANDEMENT — cellules-MONDE 34 px, cadre cockpit. */}
          <div className="lh-final chain-command chain-rise">
            <div className="chain-command__grid">
              <Cell
                label={`${yahooData.ticker} · SPOT`}
                value={fmtUsd(stats?.spot)}
                valTone={spotDir}
                meta={
                  stats?.dayChangePct != null
                    ? `${stats.dayChangePct > 0 ? '+' : ''}${stats.dayChangePct.toFixed(2)}% · vs veille`
                    : 'séance'
                }
                metaTone={spotDir}
              />
              <Cell
                label="ATM IV"
                value={stats?.atmIv != null ? fmtPct(stats.atmIv) : '——'}
                meta="médiane 5 strikes"
              />
              <Cell
                label="Échéances"
                value={String(yahooData.expirationDates.length)}
                meta="servies"
              />
              <Cell
                label="Strikes visibles"
                value={String(displayRows.length)}
                meta={`sur ${rows.length} chargés`}
              />
              <Cell
                label="Zone Sniper"
                value={String(sniperCount)}
                meta="|Δ| 0.25 – 0.35"
                tone={sniperCount > 0 ? 'accent' : undefined}
              />
              <Cell label="IVR" value="——" meta="rang indispo · série en collecte" tone="mute" />
            </div>
          </div>

          {/* 3. Barres échéances + strikes — deux rangées distinctes, respirées. */}
          <div className="lh-final chain-bars chain-rise">
            {expiryTabs.length > 0 && (
              <div className="chain-bar" role="tablist" aria-label="Échéances">
                <span className="chain-bar__label">Échéances</span>
                {expiryTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    className="chain-tab"
                    data-active={selectedExpiry === t.key || undefined}
                    aria-selected={selectedExpiry === t.key}
                    onClick={() => loadExpiry(t.key)}
                    disabled={loadingExpiry}
                  >
                    {t.label}
                  </button>
                ))}
                <span className="chain-bar__spacer" />
                {loadingExpiry ? (
                  <span className="chain-bar__loading">Chargement {selectedExpiry}…</span>
                ) : null}
              </div>
            )}
            <div className="chain-bar" aria-label="Strikes">
              <span className="chain-bar__label">Strikes</span>
              {STRIKE_OPTS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className="chain-tab"
                  data-active={strikeCount === o.key || undefined}
                  onClick={() => setStrikeCount(o.key)}
                >
                  {o.label}
                </button>
              ))}
              <button
                type="button"
                className="chain-sniper-toggle"
                data-active={sniperFilter || undefined}
                onClick={() => setSniperFilter((v) => !v)}
                aria-pressed={sniperFilter}
              >
                <span className="chain-sniper-dot" aria-hidden="true" />
                Sniper OTM
                {sniperCount > 0 ? <span className="chain-sniper-count">{sniperCount}</span> : null}
              </button>
              <span className="chain-bar__spacer" />
              <span className="chain-bar__hint">
                {displayRows.length} strike{displayRows.length > 1 ? 's' : ''} affiché
                {displayRows.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* 4. ÉTAGE SIGNAUX DU MARCHÉ — remonté AVANT la chaîne. Registre
              NEUTRE (structure de marché, pas de l'argent réel). */}
          <div className="lh-final chain-signals chain-rise">
            <div className="chain-signals__grid">
              <div className="chain-signals__cell">
                <span className="chain-signals__label">Max Pain</span>
                {analytics?.maxPain ? (
                  <>
                    <TickValue
                      text={`$${analytics.maxPain.strike}`}
                      className="chain-signals__val"
                    />
                    <span className="chain-signals__sub">{maxPainVsSpot || 'strike de douleur'}</span>
                  </>
                ) : (
                  <>
                    <span className="chain-signals__val">——</span>
                    <span className="chain-signals__sub">pas d&apos;OI</span>
                  </>
                )}
              </div>

              <div className="chain-signals__cell">
                <span className="chain-signals__label">25Δ Risk Reversal</span>
                {analytics?.rr25 ? (
                  <>
                    <TickValue
                      text={`${analytics.rr25.rr25 > 0 ? '+' : ''}${analytics.rr25.rr25.toFixed(1)}`}
                      className="chain-signals__val"
                    />
                    <span className="chain-signals__sub">
                      call {analytics.rr25.callIv.toFixed(0)}% − put {analytics.rr25.putIv.toFixed(0)}%
                      {analytics.rr25.rr25 < -1 ? ' · put-skew' : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="chain-signals__val">——</span>
                    <span className="chain-signals__sub">pas d&apos;ancre 25Δ</span>
                  </>
                )}
              </div>

              <div className="chain-signals__cell">
                <span className="chain-signals__label">OI · strikes clés</span>
                {analytics?.oiTop && analytics.oiTop.length > 0 ? (
                  <div className="chain-signals__stack">
                    {analytics.oiTop.map((s) => (
                      <span key={s.strike} className="chain-signals__row">
                        <span className="chain-signals__row-k">${s.strike}</span>
                        <span className="chain-signals__row-v">
                          {s.total >= 1000 ? `${(s.total / 1000).toFixed(1)}k` : String(s.total)} OI
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <>
                    <span className="chain-signals__val">——</span>
                    <span className="chain-signals__sub">pas d&apos;OI</span>
                  </>
                )}
              </div>

              <div className="chain-signals__cell">
                <span className="chain-signals__label">Net GEX</span>
                {analytics?.netGex ? (
                  <>
                    <TickValue
                      text={(GEX_REGIME_FR[analytics.netGex.regime] || GEX_REGIME_FR.NEUTRAL_GEX).label}
                      className="chain-signals__val"
                    />
                    <span className="chain-signals__sub">
                      {(GEX_REGIME_FR[analytics.netGex.regime] || GEX_REGIME_FR.NEUTRAL_GEX).sub}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="chain-signals__val">——</span>
                    <span className="chain-signals__sub">γ ou OI manquant</span>
                  </>
                )}
              </div>

              <div className="chain-signals__cell">
                <span className="chain-signals__label">Murs · flip</span>
                {analytics?.callWall || analytics?.putWall || analytics?.gammaFlip ? (
                  <div className="chain-signals__stack">
                    {analytics.callWall ? (
                      <span className="chain-signals__row">
                        <span className="chain-signals__tag">CALL</span>
                        <span className="chain-signals__row-k">${analytics.callWall.strike}</span>
                      </span>
                    ) : null}
                    {analytics.putWall ? (
                      <span className="chain-signals__row">
                        <span className="chain-signals__tag chain-signals__tag--put">PUT</span>
                        <span className="chain-signals__row-k">${analytics.putWall.strike}</span>
                      </span>
                    ) : null}
                    {analytics.gammaFlip ? (
                      <span className="chain-signals__row">
                        <span className="chain-signals__tag chain-signals__tag--flip">FLIP</span>
                        <span className="chain-signals__row-k">${analytics.gammaFlip.strike}</span>
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <span className="chain-signals__val">——</span>
                    <span className="chain-signals__sub">γ-OI manquant</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 5. LA CHAÎNE — héroïne pleine largeur (structure OptionsChainTable
              conservée : double entrée, thead sticky 2 rangées = acquis). */}
          <div className="chain-v5__table-wrap chain-rise">
            <OptionsChainTable
              rows={displayRows}
              spot={yahooData.currentPrice}
              symbol={yahooData.ticker}
              onRowClick={handleRowClick}
            />
          </div>
        </>
      ) : error ? (
        /* État honnête — ticker chargé mais chaîne non servie. */
        <div className="chain-v5__empty">
          <Crosshair size={26} aria-hidden="true" style={{ color: 'var(--ink-mute)' }} />
          <div className="chain-v5__empty-title">Chaîne indisponible</div>
          <div className="chain-v5__empty-sub">{error}</div>
          <div className="chain-v5__empty-sub">
            Vérifie le symbole, ou réessaie — la source options (Yahoo) peut être
            momentanément muette sur ce ticker.
          </div>
        </div>
      ) : loading ? (
        <div className="chain-v5__empty">
          <div className="chain-v5__empty-title">Chargement de la chaîne…</div>
        </div>
      ) : (
        /* État d'accueil — l'écran de tir attend son ticker. */
        <div className="chain-v5__empty">
          <Crosshair size={26} aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <div className="chain-v5__empty-title">Écran de tir · aucune chaîne chargée</div>
          <div className="chain-v5__empty-sub">
            Tape un ticker en haut puis Entrée. Le bandeau te donne le spot, l&apos;IV ATM
            et le compte de contrats dans ta zone Sniper ; les signaux de marché
            (Max Pain, GEX, murs) se lisent juste au-dessus de la chaîne.
          </div>
          <div className="chain-v5__empty-hint">
            {['SPY', 'AAPL', 'NVDA', 'TSLA', 'MSFT'].map((tk) => (
              <button
                key={tk}
                type="button"
                className="chain-v5__empty-tk"
                onClick={() => setTicker(tk)}
              >
                {tk}
              </button>
            ))}
          </div>
        </div>
      )}

      <AddTradeModal
        key={preset ? `${preset.tk}-${preset.ty}-${preset.st}-${preset.ex}` : 'empty'}
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        onSave={handleSavePreset}
        preset={preset || {}}
        title="Preset trade depuis la chaîne"
      />
    </div>
  );
}
