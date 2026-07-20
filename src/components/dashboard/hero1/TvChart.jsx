// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — TvChart : le graphe « terminal » (canvas).
//  DEV-only, purgé fin 1.D. Prototype avec lightweight-charts v5
//  (TradingView, Apache-2.0, ~canvas) — dépendance ratifiée POUR LE
//  LAB. Importé UNIQUEMENT ici → tree-shaken du bundle prod.
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
import { createChart, AreaSeries, BaselineSeries, ColorType, CrosshairMode, LineStyle, createSeriesMarkers } from 'lightweight-charts';
import useLiveTheme from '../../../hooks/useLiveTheme';
import { OBS } from '../../../components/charts/obsidienne';
import { fmtUsd } from './kit';

const FONT_MONO = "'JetBrains Mono Variable', 'SF Mono', Menlo, Consolas, monospace";

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
    const toTime = (p) => (intraday ? Math.floor(Date.parse(p.date) / 1000) : p.date.slice(0, 10));

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

    let series;
    if (isDD) {
      // Underwater « hanging » : BaselineSeries base 0 → remplit 0 → courbe.
      series = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: 0 },
        topLineColor: col, topFillColor1: hexToRgba(col, 0.05), topFillColor2: hexToRgba(col, 0.0),
        bottomLineColor: col, bottomFillColor1: hexToRgba(col, 0.04), bottomFillColor2: hexToRgba(col, 0.24),
        lineWidth: 2, priceFormat, priceLineVisible: true, lastValueVisible: true,
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: col, lineWidth: 2,
        topColor: hexToRgba(col, 0.26), bottomColor: hexToRgba(col, 0.0),
        priceFormat, priceLineVisible: true, lastValueVisible: true,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      });
    }

    const seriesData = data.map((p) => ({ time: toTime(p), value: isDD ? p.underwater : p.nlv }));
    series.setData(seriesData);
    chart.timeScale().fitContent();

    // Marqueurs (jours de clôture + apports) — vue NLV, granularité jour.
    if (!intraday && !isDD) {
      const markers = [];
      for (const p of data) {
        if (p.dayPnl != null) markers.push({ time: toTime(p), position: 'inBar', color: p.dayPnl >= 0 ? T.profit : T.loss, shape: 'circle', size: 0.9 });
        if (p.deposit) markers.push({ time: toTime(p), position: 'belowBar', color: '#8A8A92', shape: 'arrowUp', text: `apport +$${Math.round(p.depositAmount).toLocaleString('de-CH')}` });
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
      const chg = p?.chg;
      const chgTxt = chg == null ? '' : `<span class="lh-tv__d ${chg > 0 ? 'up' : chg < 0 ? 'down' : ''}">${chg > 0 ? '+' : chg < 0 ? '−' : ''}${fmtUsd(Math.abs(chg))}</span>`;
      tip.innerHTML = `<div class="lh-tv__tdate">${label}${p?.live ? ' · live' : ''}</div>`
        + `<div class="lh-tv__trow"><span>${isDD ? 'DRAWDOWN' : 'NLV'}</span><span>${fmtUsd(val)}</span></div>`
        + (!isDD && chg != null ? `<div class="lh-tv__trow"><span>Δ</span>${chgTxt}</div>` : '')
        + (p?.deposit ? `<div class="lh-tv__trow"><span>APPORT</span><span>+${fmtUsd(p.depositAmount)}</span></div>` : '');
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
