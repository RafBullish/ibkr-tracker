// ═══════════════════════════════════════════════════════════════
//  HÉROS 1 — TvChart PROD (citoyen depuis 1.D, ex-lab) : le graphe
//  « terminal » (canvas) sur lightweight-charts v5 (TradingView,
//  Apache-2.0) — dépendance RATIFIÉE 1.D, chargée code-split.
//
//  Rendu « TradingView en plus simple » : ligne nette, remplissage
//  dégradé qui s'estompe, grille fine régulière, axe Y à droite avec
//  label de dernière valeur (ligne de prix), crosshair canvas natif
//  (deux labels d'axe) + boîte HTML (date/NLV/Δ). AUTO-ÉCHELLE Y
//  SERRÉE par fenêtre (min/max de la période remplit la hauteur).
//  Apport = ÉVÉNEMENT (marqueur + « apport +$X »), pas une falaise.
//  Toggle NLV/Drawdown (flow-neutral) · marqueurs clôture vert/rouge.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, BaselineSeries, ColorType, CrosshairMode, LineStyle, LineType, createSeriesMarkers } from 'lightweight-charts';
import useLiveTheme from '../../../hooks/useLiveTheme';
import { OBS } from '../../../components/charts/obsidienne';
import { fmtUsd } from './kit';

const FONT_MONO = "'JetBrains Mono Variable', 'SF Mono', Menlo, Consolas, monospace";

// Plancher d'échelle Y : une NLV quasi plate ne doit pas être hyper-zoomée
// en dents de scie de bruit — amplitude minimale = max(6 % de la valeur
// max de la fenêtre, 10 $).
const Y_SCALE_MIN_SPAN_RATIO = 0.06;
const Y_SCALE_MIN_SPAN_USD = 10;

// Dots sur points réels (série quotidienne) : lisibles jusqu'à ce seuil
// de points dans la fenêtre — au-delà, ils fusionneraient en trait.
const POINT_DOTS_MAX = 120;
const POINT_DOTS_RADIUS = 2;

// Libellé de provenance du point (tooltip) — vérité de la source.
const SRC_LABELS = { nav: 'NAV IBKR', recon: 'approx', snap: 'relevé app', live: 'live' };

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function TvChart({ data, view = 'equity', line = 'neutral', intraday = false }) {
  const T = useLiveTheme();
  const boxRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !Array.isArray(data) || data.length === 0) return undefined;

    const isDD = view === 'drawdown';
    const col = line === 'amber' ? OBS.color.hero : OBS.color.context;
    // Intraday (FF-données) : les points portent `t` = epoch décalée à
    // l'heure locale (buildIntradaySeries) — l'axe temps affiche l'heure
    // murale. Fallback parse pour toute série intraday sans `t`.
    const toTime = (p) =>
      intraday ? (p.t ?? Math.floor(Date.parse(p.date) / 1000)) : p.date.slice(0, 10);

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8A8A92', fontFamily: FONT_MONO, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.045)' }, horzLines: { color: 'rgba(255,255,255,0.045)' } },
      rightPriceScale: { borderVisible: false, autoScale: true, scaleMargins: { top: 0.12, bottom: isDD ? 0.02 : 0.08 } },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.28)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a1e' },
        horzLine: { color: 'rgba(255,255,255,0.28)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a1e' },
      },
      handleScroll: false, handleScale: false,
    });

    const priceFormat = { type: 'custom', minMove: 1, formatter: (v) => fmtUsd(v) };

    // Plancher d'échelle Y (vue equity) : amplitude minimale imposée à
    // l'autoscale — une série plate reste lisible au lieu de zoomer le bruit.
    const autoscaleInfoProvider = (original) => {
      const info = original();
      if (!info || !info.priceRange) return info;
      const { minValue, maxValue } = info.priceRange;
      const span = maxValue - minValue;
      const minSpan = Math.max(Y_SCALE_MIN_SPAN_USD, Math.abs(maxValue) * Y_SCALE_MIN_SPAN_RATIO);
      if (span >= minSpan) return info;
      const mid = (maxValue + minValue) / 2;
      return { ...info, priceRange: { minValue: mid - minSpan / 2, maxValue: mid + minSpan / 2 } };
    };

    // Marches sur le quotidien : une NLV est un relevé, pas une pente —
    // la valeur tient jusqu'au relevé suivant. L'intraday reste lissé.
    const lineType = intraday ? LineType.Simple : LineType.WithSteps;
    // Dots sur les points réels de la fenêtre (quotidien seulement).
    const showDots = !intraday && data.length <= POINT_DOTS_MAX;

    let series;
    if (isDD) {
      // Underwater « hanging » : BaselineSeries base 0 → remplit 0 → courbe.
      series = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: 0 },
        topLineColor: col, topFillColor1: hexToRgba(col, 0.05), topFillColor2: hexToRgba(col, 0.0),
        bottomLineColor: col, bottomFillColor1: hexToRgba(col, 0.04), bottomFillColor2: hexToRgba(col, 0.24),
        lineWidth: 2, lineType, priceFormat, priceLineVisible: true, lastValueVisible: true,
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: col, lineWidth: 2, lineType,
        topColor: hexToRgba(col, 0.26), bottomColor: hexToRgba(col, 0.0),
        priceFormat, priceLineVisible: true, lastValueVisible: true,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        pointMarkersVisible: showDots, pointMarkersRadius: POINT_DOTS_RADIUS,
        autoscaleInfoProvider,
      });
    }

    const seriesData = data.map((p) => ({ time: toTime(p), value: isDD ? p.underwater : p.nlv }));
    series.setData(seriesData);
    chart.timeScale().fitContent();

    // Marqueurs (jours de clôture + apports/retraits) — vue NLV, jour.
    // Apports/retraits = flux de financement NEUTRES (gris) ; seuls les
    // dots de clôture portent la couleur (argent réel, loi de couleur).
    if (!intraday && !isDD) {
      const markers = [];
      for (const p of data) {
        if (p.dayPnl != null) markers.push({ time: toTime(p), position: 'inBar', color: p.dayPnl >= 0 ? T.profit : T.loss, shape: 'circle', size: 0.9 });
        if (p.deposit) markers.push({ time: toTime(p), position: 'belowBar', color: '#8A8A92', shape: 'arrowUp', text: `apport +$${Math.round(p.depositAmount).toLocaleString('de-CH')}` });
        if (p.withdrawal) markers.push({ time: toTime(p), position: 'aboveBar', color: '#8A8A92', shape: 'arrowDown', text: `retrait −$${Math.round(p.withdrawalAmount).toLocaleString('de-CH')}` });
      }
      if (markers.length) createSeriesMarkers(series, markers);
    }

    // Boîte HTML (date / NLV / Δ) au crosshair.
    const byTime = new Map();
    for (const p of data) byTime.set(String(toTime(p)), p);
    const tip = tipRef.current;
    const onMove = (param) => {
      if (!tip) return;
      if (!param.point || param.time == null || !param.seriesData || !param.seriesData.get(series)) {
        tip.style.opacity = '0';
        return;
      }
      const p = byTime.get(String(param.time));
      const sd = param.seriesData.get(series);
      const val = sd && sd.value != null ? sd.value : (p ? (isDD ? p.underwater : p.nlv) : null);
      const label = (p?.date || '').replace('T', ' · ');
      const srcLabel = p?.src && SRC_LABELS[p.src] ? ` · ${SRC_LABELS[p.src]}` : p?.live ? ' · live' : '';
      const chg = p?.chg;
      const chgTxt = chg == null ? '' : `<span class="lh-tv__d ${chg > 0 ? 'up' : chg < 0 ? 'down' : ''}">${chg > 0 ? '+' : chg < 0 ? '−' : ''}${fmtUsd(Math.abs(chg))}</span>`;
      tip.innerHTML = `<div class="lh-tv__tdate">${label}${srcLabel}</div>`
        + `<div class="lh-tv__trow"><span>${isDD ? 'DRAWDOWN' : 'NLV'}</span><span>${fmtUsd(val)}</span></div>`
        + (!isDD && chg != null ? `<div class="lh-tv__trow"><span>Δ</span>${chgTxt}</div>` : '')
        + (p?.deposit ? `<div class="lh-tv__trow"><span>APPORT</span><span>+${fmtUsd(p.depositAmount)}</span></div>` : '')
        + (p?.withdrawal ? `<div class="lh-tv__trow"><span>RETRAIT</span><span>−${fmtUsd(p.withdrawalAmount)}</span></div>` : '');
      const x = Math.min(param.point.x + 16, el.clientWidth - 168);
      const y = Math.max(8, param.point.y - 10);
      tip.style.transform = `translate(${x}px, ${y}px)`;
      tip.style.opacity = '1';
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
    };
  }, [data, view, line, intraday, T]);

  return (
    <div className="lh-tv">
      <div ref={boxRef} className="lh-tv__canvas" />
      <div ref={tipRef} className="lh-tv__tip" />
    </div>
  );
}
