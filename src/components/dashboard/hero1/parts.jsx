// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 (brique 1.D) — parts : Héros NLV · frontières · contrôles ·
//  bande perf/stats. DS strict : Plex chiffres, mono labels, hairlines,
//  ambre = actif, encre neutre, valeurs monétaires blanches + CHF live.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { TIMEFRAMES } from '../../../utils/nlvSeries';
import { fmtUsd, fmtPct, fmtChf } from './kit';
// É3.3 — dates calendaires au format central dd.mm.yy.
import { fmtDate } from '../../../utils/format';
// Héros 1 LIVE (Phase B) — badge d'état du flux, seul porteur de l'état.
import { useLiveFreshness } from '../../../store/liveFeed';
import useMarketSession from '../../../hooks/useMarketSession';
import { nlvFluxBadge } from '../../../utils/formatAge';

// É4 §5.3 — MoneyDual, KpiCell et KpiBelt (exports 0-consommateur,
// vestiges de l'itération 1.D pré-PortfolioDeck) sont MORTS.

const isSigned = (s) => typeof s === 'string' && (s[0] === '+' || s[0] === '−' || s[0] === '-');

// ── Frontière marché / portefeuille (sommet du bloc, structurelle) ─
export function Frontier() {
  return (
    <div className="lh-frontier">
      <span className="lh-frontier__zone">PORTEFEUILLE</span>
      <span className="lh-frontier__rule" aria-hidden="true" />
    </div>
  );
}

// ── Séparation FORTE données / graphe (Zone 2) ──────────────────
export function ZoneSep({ label = 'GRAPHIQUE' }) {
  return (
    <div className="lh-zonesep">
      <span className="lh-zonesep__label">{label}</span>
      <span className="lh-zonesep__hint">réglable par période ↓</span>
    </div>
  );
}

// ── Sparkline neutre (SVG pur) ──────────────────────────────────
export function MiniSpark({ points, w = 110, h = 34 }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="lh-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--ink-mute)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Tick d'âge ISOLÉ dans le badge (le héros ne re-rend pas à la
//    seconde). Sous prefers-reduced-motion, le tick est gelé à la minute
//    (l'âge reste vrai à 60 s près, plus aucun texte au battement 1 s). ──
function useBadgeNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const id = setInterval(() => setNow(Date.now()), reduced ? 60_000 : 1_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Badge d'état du Héros 1 — SEUL porteur de l'état du flux (3.3). ──
//    LIVE (< 60 s) · « il y a N s/min » (ambre) · « FLUX PÉRIMÉ · … »
//    (ambre, jamais rouge) · « MARCHÉ FERMÉ · dernier tick HH:MM »
//    (neutre) · EST. (aucun point bridge pour la séance → courbe client).
//    Un titre qui dirait LIVE un samedi matin mentirait : le titre reste
//    statique, l'état vit ici. La source est nommée (title=).
export function FluxBadge({ hasBridge = false }) {
  const now = useBadgeNow();
  const { lastCapturedAt, ok } = useLiveFreshness();
  const { phase } = useMarketSession();
  if (!hasBridge) {
    return (
      <span
        className="lh-hero__live lh-hero__live--est"
        title="Source : estimateur client — aucun point bridge pour la séance courante (NLV reconstituée, pas un feed broker)"
      >
        EST.
      </span>
    );
  }
  const ageMs = lastCapturedAt != null ? now - lastCapturedAt : null;
  const flux = nlvFluxBadge(ageMs, { phase, lastCapturedAt });
  if (!flux) return null;
  const kind = flux.kind === 'live' && !ok ? 'age' : flux.kind; // fetch en échec → jamais LIVE
  if (kind === 'live') {
    return (
      <span className="lh-hero__live" title="Source : flux bridge Supabase — dernier point < 60 s">
        <span className="lh-hero__live-dot" aria-hidden="true" />LIVE
      </span>
    );
  }
  return (
    <span
      className={`lh-hero__live ${kind === 'closed' ? 'lh-hero__live--idle' : 'lh-hero__live--age'}`}
      title="Source : flux bridge Supabase — âge du dernier point de la séance"
    >
      {flux.label}
    </span>
  );
}

// ── HÉROS NLV — le plus gros et le plus soigné du bloc ──────────
// Héros 1 LIVE : `hasBridge` pilote le badge (seul porteur d'état) ;
// `currency` ≠ USD = série brute non convertie (fx_rates vide) — le
// montant s'affiche dans la devise du broker, étiqueté honnêtement.
export function NlvHero({ nlv, rate, dayPnl, dayPct, spark, size = 'md', hasBridge = false, currency = 'USD' }) {
  const tone = dayPnl == null || dayPnl === 0 ? 'mute' : dayPnl > 0 ? 'profit' : 'loss';
  const raw = currency !== 'USD';
  const chf = raw ? null : fmtChf(nlv, rate);
  const pill =
    dayPnl == null
      ? null
      : `${dayPnl >= 0 ? '+' : '−'}$${Math.abs(Math.round(dayPnl)).toLocaleString('de-CH')}${dayPct != null ? ` · ${dayPct >= 0 ? '+' : '−'}${Math.abs(dayPct).toFixed(2)}%` : ''}`;
  return (
    <div className={`lh-hero lh-hero--${size}`}>
      <div className="lh-hero__head">
        <span className="lh-hero__label">NET LIQUIDATION</span>
        <FluxBadge hasBridge={hasBridge} />
      </div>
      {/* Montant + sparkline COLLÉE + pill à proximité (une ligne). */}
      <div className="lh-hero__row">
        <span className="lh-hero__usd">
          {nlv == null ? '—' : raw ? `${currency} ${Math.round(nlv).toLocaleString('de-CH')}` : fmtUsd(nlv)}
        </span>
        <MiniSpark points={spark} w={132} h={38} />
        {pill ? <span className={`lh-hero__pill lh-hero__pill--${tone}`}>{pill}<span className="lh-hero__pill-cap"> jour</span></span> : null}
      </div>
      {raw ? (
        <span className="lh-hero__chf">{currency} · taux indisponible — série brute, jamais convertie par un taux d'une autre source</span>
      ) : chf ? (
        <span className="lh-hero__chf">{chf}</span>
      ) : null}
    </div>
  );
}

// ── Contrôles graphe ────────────────────────────────────────────
// `options` : liste de ranges à afficher (défaut = TIMEFRAMES partagés).
// Héros 1 passe TIMEFRAMES_HERO1 (avec 1D intraday) ; Héros 2 garde le
// défaut — « 1D » n'a pas de sens sur le réalisé quotidien.
export function RangeSelector({ range, setRange, options = TIMEFRAMES }) {
  return (
    <div className="lh-range" role="tablist" aria-label="Période">
      {options.map((tf) => (
        <button key={tf} type="button" role="tab" className="lh-range__btn" data-active={range === tf || undefined} aria-pressed={range === tf} onClick={() => setRange(tf)}>
          {tf}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({ view, setView }) {
  return (
    <div className="lh-toggle" role="tablist" aria-label="Vue NLV ou drawdown">
      {[['equity', 'NLV'], ['drawdown', 'DRAWDOWN']].map(([k, lbl]) => (
        <button key={k} type="button" role="tab" className="lh-toggle__btn" data-active={view === k || undefined} aria-pressed={view === k} onClick={() => setView(k)}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

// ── PIED DE HÉROS (HERO-FOOTER, v1.0.1/3) — LA maison des stats du
//    Héros 1. 10 cellules, grille 5×2 au cordeau, anatomie MONDE à
//    l'échelle héros (valeur 27 px Plex 700). Stats VRAIES : heroStats,
//    calculées pré-resample (D2) — fini les buckets déguisés.
//    GAIN/PERTE MOY. et EXPECTANCY vivent au deck PERFORMANCE
//    (trade-exactes) ; la sous-ligne « N pts · N j » (détail de rendu)
//    est morte. Tons : MEILLEUR/PIRE J. tonés (argent réel — même
//    langage que le pied du Héros 2) ; tout le reste neutre. ──
const tone3 = (v) => (v == null || v === 0 ? undefined : v > 0 ? 'profit' : 'loss');

export function HeroFootCell({ label, value, sub, usd, tone, rate, title }) {
  const chf =
    Number.isFinite(usd) && Number.isFinite(rate) && rate > 0
      ? fmtChf(usd, rate, isSigned(value))
      : null;
  return (
    <div className="lh-cfoot__cell" title={title || undefined}>
      <span className="lh-cfoot__label">{label}</span>
      <span className={`lh-cfoot__value${tone ? ` lh-cfoot__value--${tone}` : ''}`}>{value}</span>
      <span className="lh-cfoot__meta">
        {chf ? <span className="lh-cfoot__chf">{chf}</span> : null}
        {sub != null ? <span className="lh-cfoot__sub">{sub}</span> : null}
      </span>
    </div>
  );
}

// É3.1 « vérité des chiffres » — chaque métrique DD/pic/recovery porte
// sa BASE ([NLV] + fenêtre) en label, et sa formule en title=. Le % de
// jours gagnants consomme LA définition unique (stats.joursGagnants,
// curveStats) — mêmes compteurs que J. CLÔTURE et que le pied Héros 2.
export function ChartFooter({ stats, rate, range = 'ALL' }) {
  if (stats.empty) return <div className="lh-cfoot--empty">Série NLV vide</div>;
  const sf = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString('de-CH')}`);
  const pct = (v) => (v == null ? '—' : fmtPct(v));
  const jg = stats.joursGagnants || { verts: 0, rouges: 0, total: 0, pct: null };
  // [label, value, sub, usdForChf, tone, title]
  // COULEUR (C3) — PEAK ≡ HAUT (doublon constaté brique 3) : PEAK meurt,
  // DEPUIS PIC dit depuis combien de jours aucun nouveau sommet
  // flow-neutral (le MÊME pic qui fonde MAX DD / DD COURANT). Neutre.
  // É3.3 — date du pic au format central dd.mm.yy (l'ex dd/mm est mort).
  const cells = [
    ['DEPUIS PIC', stats.daysSincePeak == null ? '—' : `${stats.daysSincePeak} j`, `pic ${fmtDate(stats.peakDate)}`, null, null,
      `NLV · ${range} — jours calendaires depuis le pic flow-neutral (le même pic que MAX DD / DD COURANT)`],
    ['HAUT / BAS', fmtUsd(stats.high), `bas ${fmtUsd(stats.low)}`, stats.high, null,
      `NLV · ${range} — extrêmes quotidiens de la fenêtre`],
    [`MAX DD · NLV`, fmtUsd(-stats.maxDDUsd), pct(stats.maxDDPct), -stats.maxDDUsd, null,
      `NLV · ${range} — pic→creux flow-neutral (pic ancré sur tout l'historique) ; % sur la NLV au pic`],
    [`DD COURANT · NLV`, fmtUsd(-stats.currentDDUsd), pct(stats.currentDDPct), -stats.currentDDUsd, null,
      `NLV · ${range} — pic flow-neutral − point courant ; % sur la NLV au pic`],
    ['RECOVERY', stats.recoveryFactor == null ? '—' : `${stats.recoveryFactor.toFixed(2)}×`, 'P&L / DD · NLV', null, null,
      `NLV · ${range} — P&L flow-neutral de la fenêtre ÷ max DD NLV de la fenêtre (≠ RECOVERY · RÉAL du bloc Réalisé)`],
    ['MEILLEUR J.', sf(stats.bestDay), null, stats.bestDay, tone3(stats.bestDay),
      `NLV · ${range} — meilleur delta flow-neutral quotidien (latent inclus)`],
    ['PIRE J.', sf(stats.worstDay), null, stats.worstDay, tone3(stats.worstDay),
      `NLV · ${range} — pire delta flow-neutral quotidien (latent inclus)`],
    ['% J. GAGN.', jg.pct == null ? '—' : `${jg.pct.toFixed(0)}%`, `${jg.verts}↑ / ${jg.rouges}↓`, null, null,
      `RÉAL · ${range} — jours avec clôture, signe du P&L net du jour (définition unique, = pied Réalisé) ; ${jg.verts}+${jg.rouges}=${jg.total}`],
    ['J. CLÔTURE', `${stats.closeDays}`, 'jours avec clôture', null, null,
      `RÉAL · ${range} — jours distincts avec ≥ 1 clôture (= total du % J. GAGN.)`],
    ['TRADES', `${stats.tradeCount}`, 'clôtures · fenêtre', null, null,
      `RÉAL · ${range} — clôtures de la fenêtre`],
  ];
  return (
    <div className="lh-cfoot">
      {cells.map(([label, value, sub, usd, tone, title]) => (
        <HeroFootCell key={label} label={label} value={value} sub={sub} usd={usd} tone={tone} rate={rate} title={title} />
      ))}
    </div>
  );
}
