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

    // Trous du flux bridge (Héros 1 LIVE) : les points whitespace ({time}
    // seul) ne réservent que des CRANS d'axe — lightweight-charts trace la
    // ligne Area À TRAVERS eux (constaté au harnais). Pour qu'un trou COUPE
    // réellement la ligne (jamais interpolé), on segmente : UNE série par
    // segment contigu ; la première porte en plus tous les whitespace
    // (l'axe garde la largeur proportionnelle du trou).
    const segments = [];
    let seg = [];
    const gaps = [];
    for (const p of data) {
      const v = isDD ? p.underwater : p.nlv;
      if (v == null) {
        gaps.push({ time: toTime(p) });
        if (seg.length) { segments.push(seg); seg = []; }
      } else {
        seg.push({ time: toTime(p), value: v });
      }
    }
    if (seg.length) segments.push(seg);
    if (segments.length === 0) return undefined;

    const mkSeries = (isLast) => {
      // Ligne de prix / dernière valeur : uniquement sur le DERNIER segment.
      const tail = { priceLineVisible: isLast, lastValueVisible: isLast };
      if (isDD) {
        // Underwater « hanging » : BaselineSeries base 0 → remplit 0 → courbe.
        return chart.addSeries(BaselineSeries, {
          baseValue: { type: 'price', price: 0 },
          topLineColor: col, topFillColor1: hexToRgba(col, 0.05), topFillColor2: hexToRgba(col, 0.0),
          bottomLineColor: col, bottomFillColor1: hexToRgba(col, 0.04), bottomFillColor2: hexToRgba(col, 0.24),
          lineWidth: 2, priceFormat, ...tail,
        });
      }
      return chart.addSeries(AreaSeries, {
        lineColor: col, lineWidth: 2,
        topColor: hexToRgba(col, 0.26), bottomColor: hexToRgba(col, 0.0),
        priceFormat, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, ...tail,
      });
    };

    const allSeries = segments.map((points, i) => {
      const s = mkSeries(i === segments.length - 1);
      // Les whitespace vont avec le premier segment (crans d'axe) — les
      // items sont triés par temps, exigence lightweight-charts.
      const items = i === 0 && gaps.length
        ? [...points, ...gaps].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
        : points;
      s.setData(items);
      return s;
    });
    const series = allSeries[0];
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
      if (!param.point || param.time == null || !param.seriesData) {
        tip.style.opacity = '0';
        return;
      }
      const p = byTime.get(String(param.time));
      // Le point vit dans l'UN des segments (une série par segment).
      let sd = null;
      for (const s of allSeries) {
        const cand = param.seriesData.get(s);
        if (cand && cand.value != null) { sd = cand; break; }
      }
      const val = sd && sd.value != null ? sd.value : (p ? (isDD ? p.underwater : p.nlv) : null);
      if (val == null) { tip.style.opacity = '0'; return; } // whitespace (trou) : pas de boîte
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
