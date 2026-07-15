// ═══════════════════════════════════════════════════════════════
//  TAPE LAB — /lab/tape (1.B.3) · DEV-ONLY, ÉPHÉMÈRE
//
//  Instrument de calibration perceptive du TickerTape (leçon D1/D2.F :
//  on ne devine plus un barème, on le fait CHOISIR sur un comparatif).
//  Quatre variantes empilées : A témoin (composant réel) · B Présence
//  72 · C Bloomberg 80 · D Salle des marchés 92.
//
//  - Route gardée par import.meta.env.DEV (App.jsx) → absent du build.
//  - UNE seule source de données : useMarketQuotes/useMarketSparklines
//    appelés ICI une fois, passés en props (zéro polling en plus).
//  - « Simuler des ticks » : bouge le prix AFFICHÉ (état local, jamais
//    le cache ni le store) pour déclencher le flash (usePriceFlash).
//  - PURGÉ intégralement en L2 (avec ce fichier et lab-tape.css).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import useMarketQuotes from '../../hooks/useMarketQuotes';
import { useMarketSparklines } from '../../hooks/useMarketSparklines';
import usePriceFlash from '../../hooks/usePriceFlash';
import {
  STATIC_TICKERS,
  STATIC_FETCH_SYMBOLS,
  TickerTapeView,
  TickerSparkline,
  deriveState,
  formatPrice,
  netChange,
  formatNetChange,
} from '../../components/layout/TickerTape';
import '../../styles/lab-tape.css';

// ── Les 4 variantes (tailles = planchers du brief 1.B.3) ────────
const VARIANTS = [
  {
    key: 'B',
    name: 'Présence',
    height: 72,
    price: 28,
    symbol: 17,
    pct: 18,
    net: 16,
    pillMix: '14%',
    sparkW: 64,
    sparkH: 34,
    pad: 26,
    sep: 'var(--hairline-rest)',
    pricePulse: false,
  },
  {
    key: 'C',
    name: 'Bloomberg',
    height: 80,
    price: 32,
    symbol: 18,
    pct: 20,
    net: 17,
    pillMix: '14%',
    sparkW: 72,
    sparkH: 40,
    pad: 30,
    sep: 'var(--line-emphasis)',
    pricePulse: false,
  },
  {
    key: 'D',
    name: 'Salle des marchés',
    height: 92,
    price: 36,
    symbol: 19,
    pct: 20,
    net: 18,
    pillMix: '16%',
    sparkW: 84,
    sparkH: 46,
    pad: 34,
    sep: 'var(--hairline-rest)',
    pricePulse: true,
  },
];

// ── Cellule de variante ──────────────────────────────────────────
function LabCell({ ticker, quote, spark, state, variant }) {
  const price = quote?.price;
  const pct = quote?.changePercent;
  const net = netChange(quote);
  const netText = formatNetChange(net, ticker.display);
  const dirClass = pct > 0 ? 'lab-tape__dir--up' : pct < 0 ? 'lab-tape__dir--down' : '';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
  const flash = usePriceFlash(price);

  const sparkColor = useMemo(() => {
    if (!spark?.prices || spark.prices.length < 2) return 'var(--ink-soft)';
    const first = spark.prices[0];
    const last = spark.prices[spark.prices.length - 1];
    if (last > first) return 'var(--pnl-up)';
    if (last < first) return 'var(--pnl-down)';
    return 'var(--ink-soft)';
  }, [spark]);

  return (
    <div className="lab-tape__cell">
      {flash && (
        <span
          key={flash.id}
          className={`tape-flash tape-flash--${flash.dir}`}
          aria-hidden="true"
        />
      )}
      <div className="lab-tape__main">
        <span className="lab-tape__symbol">{ticker.display}</span>
        {state === 'OFFLINE' ? (
          <span className="lab-tape__price">—</span>
        ) : variant.pricePulse && flash ? (
          <span key={`p${flash.id}`} className="lab-tape__price lab-tape__price--pulse">
            {formatPrice(price, ticker.display)}
          </span>
        ) : (
          <span className="lab-tape__price">{formatPrice(price, ticker.display)}</span>
        )}
      </div>
      {pct != null && Number.isFinite(pct) && (
        <div className="lab-tape__delta">
          <span className={`lab-tape__pct ${dirClass}`}>
            {arrow && <span className="lab-tape__arrow">{arrow}</span>}
            {Math.abs(pct).toFixed(2)}%
          </span>
          {netText && <span className={`lab-tape__net ${dirClass}`}>{netText}</span>}
        </div>
      )}
      {state !== 'OFFLINE' && spark?.prices && spark.prices.length > 1 && (
        <span className="lab-tape__spark">
          <TickerSparkline
            prices={spark.prices}
            color={sparkColor}
            width={variant.sparkW}
            height={variant.sparkH}
          />
        </span>
      )}
    </div>
  );
}

// ── Bandeau de variante (marquee identique au réel) ─────────────
function LabTape({ variant, quotes, sparklines, reduced }) {
  const now = new Date();
  const style = {
    '--lt-h': `${variant.height}px`,
    '--lt-price': `${variant.price}px`,
    '--lt-symbol': `${variant.symbol}px`,
    '--lt-pct': `${variant.pct}px`,
    '--lt-net': `${variant.net}px`,
    '--lt-pill-mix': variant.pillMix,
    '--lt-pad': `${variant.pad}px`,
    '--lt-sep': variant.sep,
  };
  const renderCell = (t, key) => (
    <LabCell
      key={key}
      ticker={t}
      quote={quotes[t.fetch]}
      spark={sparklines[t.fetch]}
      state={deriveState(quotes[t.fetch], t.classKey, now)}
      variant={variant}
    />
  );
  return (
    <div className={`lab-tape ${reduced ? 'lab-tape--reduced' : ''}`} style={style}>
      <div className="lab-tape__viewport">
        <div className="lab-tape__track">
          {STATIC_TICKERS.map((t) => renderCell(t, t.fetch))}
          {!reduced && STATIC_TICKERS.map((t) => renderCell(t, `dup-${t.fetch}`))}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function TapeLab() {
  const { quotes } = useMarketQuotes(STATIC_FETCH_SYMBOLS);
  const { sparklines } = useMarketSparklines(STATIC_FETCH_SYMBOLS);
  const [simOn, setSimOn] = useState(false);
  // Multiplicateurs de prix AFFICHÉ par symbole (état local pur).
  const [bumps, setBumps] = useState({});

  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (!simOn) return undefined;
    const id = setInterval(() => {
      setBumps((prev) => {
        const next = { ...prev };
        const count = 3 + Math.floor(Math.random() * 3); // 3-5 instruments
        for (let i = 0; i < count; i += 1) {
          const t = STATIC_TICKERS[Math.floor(Math.random() * STATIC_TICKERS.length)];
          const magnitude = (0.0002 + Math.random() * 0.0013) * (Math.random() < 0.5 ? -1 : 1);
          next[t.fetch] = (next[t.fetch] || 1) * (1 + magnitude);
        }
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, [simOn]);

  // Quotes affichées par B/C/D : prix nudgé par le simulateur.
  const simQuotes = useMemo(() => {
    if (!simOn) return quotes;
    const out = {};
    for (const [sym, q] of Object.entries(quotes)) {
      const bump = bumps[sym];
      out[sym] =
        bump && q?.price != null && Number.isFinite(q.price)
          ? { ...q, price: q.price * bump }
          : q;
    }
    return out;
  }, [quotes, bumps, simOn]);

  return (
    <div className="lab-tape-page">
      <header className="lab-tape-page__head">
        <h1 className="lab-tape-page__title">LAB · TICKER TAPE — calibration 1.B.3</h1>
        <p className="lab-tape-page__sub">
          Quatre bandeaux, mêmes données live. Survole pour mettre en pause. Choisis à l'œil :
          A (témoin actuel), B, C ou D.
        </p>
        <button
          type="button"
          className={`lab-tape-page__sim${simOn ? ' is-on' : ''}`}
          onClick={() => setSimOn((v) => !v)}
          aria-pressed={simOn}
        >
          {simOn ? '■ Arrêter la simulation' : '► Simuler des ticks'}
        </button>
      </header>

      <section className="lab-tape-page__variant">
        <div className="lab-tape-page__label">A · Actuel · 64 px (témoin — sans flash)</div>
        <TickerTapeView quotes={quotes} sparklines={sparklines} prefersReducedMotion={reduced} />
      </section>

      {VARIANTS.map((v) => (
        <section className="lab-tape-page__variant" key={v.key}>
          <div className="lab-tape-page__label">
            {v.key} · {v.name} · {v.height} px
          </div>
          <LabTape variant={v} quotes={simQuotes} sparklines={sparklines} reduced={reduced} />
        </section>
      ))}
    </div>
  );
}
