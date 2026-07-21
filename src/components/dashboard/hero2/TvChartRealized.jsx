// ═══════════════════════════════════════════════════════════════
//  HÉROS 2 (1.E) — GRAPHE TERMINAL RÉALISÉ (canvas, lightweight-charts).
//  Jumeau du TvChart de Héros 1 (même dépendance ratifiée, code-split,
//  même DA : ligne nette, remplissage dégradé, grille fine, axe Y droite
//  + ligne de prix, crosshair natif + boîte HTML, auto-échelle Y serrée).
//  Ne TOUCHE PAS hero1/TvChart (1.D intangible) — composant dédié.
//
//  TOGGLE de vue (comme NLV/Drawdown de Héros 1) :
//    · 'cumul' → AIRE de la trajectoire cumulée réalisée + marqueurs de
//                clôture (dot vert/rouge par signe du jour). Ligne NEUTRE.
//    · 'daily' → HISTOGRAMME des barres jour (vert/rouge = argent réel).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, HistogramSeries, ColorType, CrosshairMode, LineStyle, createSeriesMarkers } from 'lightweight-charts';
import useLiveTheme from '../../../hooks/useLiveTheme';
import { OBS } from '../../../components/charts/obsidienne';
import { fmtUsd } from '../hero1/kit';

const FONT_MONO = "'JetBrains Mono Variable', 'SF Mono', Menlo, Consolas, monospace";

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const sfmt = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtUsd(Math.abs(v))}`;

export default function TvChartRealized({ cumul, daily, view = 'cumul' }) {
  const T = useLiveTheme();
  const boxRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    const source = view === 'daily' ? daily : cumul;
    if (!el || !Array.isArray(source) || source.length === 0) return undefined;

    const isDaily = view === 'daily';
    const toTime = (p) => p.date.slice(0, 10);
    const col = OBS.color.context; // ligne cumulée NEUTRE (comme le NLV Héros 1)

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8A8A92', fontFamily: FONT_MONO, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.045)' }, horzLines: { color: 'rgba(255,255,255,0.045)' } },
      rightPriceScale: { borderVisible: false, autoScale: true, scaleMargins: { top: 0.12, bottom: 0.1 } },
      timeScale: { borderVisible: false, timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.28)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a1e' },
        horzLine: { color: 'rgba(255,255,255,0.28)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1a1a1e' },
      },
      handleScroll: false, handleScale: false,
    });

    const priceFormat = { type: 'custom', minMove: 1, formatter: (v) => sfmt(v) };

    let series;
    if (isDaily) {
      // Histogramme jour — couleur par barre (vert/rouge = argent réel).
      series = chart.addSeries(HistogramSeries, {
        base: 0, priceFormat, priceLineVisible: false, lastValueVisible: false,
      });
      series.setData(daily.map((p) => ({
        time: toTime(p),
        value: p.value,
        color: p.value >= 0 ? hexToRgba(T.profit, 0.85) : hexToRgba(T.loss, 0.85),
      })));
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: col, lineWidth: 2,
        topColor: hexToRgba(col, 0.26), bottomColor: hexToRgba(col, 0.0),
        priceFormat, priceLineVisible: true, lastValueVisible: true,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      });
      series.setData(cumul.map((p) => ({ time: toTime(p), value: p.nlv })));
      // Marqueurs de clôture (dot vert/rouge par signe du jour).
      const markers = [];
      for (const p of cumul) {
        if (p.dayPnl != null && p.dayPnl !== 0) {
          markers.push({ time: toTime(p), position: 'inBar', color: p.dayPnl >= 0 ? T.profit : T.loss, shape: 'circle', size: 0.9 });
        }
      }
      if (markers.length) createSeriesMarkers(series, markers);
    }
    chart.timeScale().fitContent();

    // Boîte HTML au crosshair (date / valeur).
    const byTime = new Map();
    for (const p of source) byTime.set(String(toTime(p)), p);
    const tip = tipRef.current;
    const onMove = (param) => {
      if (!tip) return;
      if (!param.point || param.time == null || !param.seriesData || !param.seriesData.get(series)) {
        tip.style.opacity = '0';
        return;
      }
      const p = byTime.get(String(param.time));
      const sd = param.seriesData.get(series);
      const val = sd && sd.value != null ? sd.value : null;
      const label = p?.date || '';
      if (isDaily) {
        const tone = val > 0 ? 'up' : val < 0 ? 'down' : '';
        tip.innerHTML = `<div class="lh-tv__tdate">${label}</div>`
          + `<div class="lh-tv__trow"><span>JOUR</span><span class="lh-tv__d ${tone}">${sfmt(val || 0)}</span></div>`;
      } else {
        const chg = p?.chg;
        const ctone = chg > 0 ? 'up' : chg < 0 ? 'down' : '';
        tip.innerHTML = `<div class="lh-tv__tdate">${label}</div>`
          + `<div class="lh-tv__trow"><span>CUMULÉ</span><span>${sfmt(val || 0)}</span></div>`
          + (chg != null ? `<div class="lh-tv__trow"><span>JOUR</span><span class="lh-tv__d ${ctone}">${sfmt(chg)}</span></div>` : '');
      }
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
  }, [cumul, daily, view, T]);

  return (
    <div className="lh-tv">
      <div ref={boxRef} className="lh-tv__canvas" />
      <div ref={tipRef} className="lh-tv__tip" />
    </div>
  );
}
