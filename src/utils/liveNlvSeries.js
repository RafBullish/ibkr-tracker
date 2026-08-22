// ═══════════════════════════════════════════════════════════════
//  liveNlvSeries — courbe 1D du Héros 1 depuis le flux bridge (Phase B,
//  brique HÉROS 1 LIVE). PUR, sans React.
//
//  LOI D'UNE SEULE SOURCE : s'il existe au moins un point bridge pour la
//  séance courante, la courbe EST la série bridge, entière, avec ses
//  trous visibles ; sinon la série client (« est. »). JAMAIS une couture
//  des deux sur une même ligne — selectHeroSeries est la porte UNIQUE.
//
//  DEVISE : le bridge stocke la valeur broker avec son label (CHF).
//  Affichage USD primaire → conversion PAR POINT, jointure as-of sur
//  fx_rates : dernier mid USD.CHF capturé À OU AVANT le captured_at du
//  point, jamais le suivant (pas de lookahead — le FX est capturé ~2 s
//  après le compte, un point prend donc le taux du cycle précédent).
//  JAMAIS un taux unique appliqué à toute la courbe : le passé bougerait
//  à chaque tick FX. fx_rates vide → série brute CHF, étiquetée « CHF ·
//  taux indisponible », jamais convertie par un taux d'une autre source.
//  Un point antérieur au tout premier taux connu est ÉCARTÉ de la série
//  convertie (le convertir exigerait un lookahead) — cas limité au tout
//  premier cycle de la toute première séance.
//
//  TROUS : un intervalle > BRIDGE_HOLE_MS entre deux points injecte un
//  point « whitespace » (nlv null) — lightweight-charts coupe la ligne,
//  aucune interpolation. Seuil 240 s ≈ 2.7× la cadence pré/post (90 s) :
//  aucun faux trou en cadence lente ; toute coupure réelle ≥ 4 min est
//  montrée telle quelle.
//
//  Les maths de la série (flow-neutral, drawdown seedé sur l'historique,
//  décalage d'axe local) sont CELLES de buildIntradaySeries — une seule
//  maison, le bridge n'invente rien. liveNlv est passé null : aucun
//  point du store n'est ajouté à une série bridge (pas de couture).
// ═══════════════════════════════════════════════════════════════

import { buildIntradaySeries } from './nlvSeries';

export const BRIDGE_HOLE_MS = 240_000;

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Jointure as-of : dernier mid dont le t est ≤ tMs. fxRows trié asc.
 * null si aucun taux antérieur (point inconvertible, jamais de lookahead).
 */
export function asOfRate(fxRows, tMs) {
  let rate = null;
  for (const f of fxRows) {
    if (f.t > tMs) break;
    rate = f.mid;
  }
  return rate;
}

/**
 * Convertit les lignes bridge vers la devise d'affichage (USD primaire).
 * @param {{rows:Array<{t:number,nlv:number,currency:string}>, fxRows:Array<{t:number,mid:number}>}} args
 * @returns {{points:Array<{t:number,value:number}>, currency:'USD'|string, droppedNoRate:number}}
 */
export function convertBridgeRows({ rows, fxRows }) {
  const usable = (rows || []).filter(
    (r) => Number.isFinite(r?.t) && Number.isFinite(r?.nlv) && r.nlv > 0
  );
  if (usable.length === 0) return { points: [], currency: 'USD', droppedNoRate: 0 };
  const fx = (fxRows || [])
    .filter((f) => Number.isFinite(f?.t) && Number.isFinite(f?.mid) && f.mid > 0)
    .slice()
    .sort((a, b) => a.t - b.t);

  const points = [];
  let dropped = 0;
  let converted = false;
  for (const r of usable) {
    if (!r.currency || r.currency === 'USD') {
      points.push({ t: r.t, value: r.nlv });
      converted = true;
      continue;
    }
    const mid = asOfRate(fx, r.t);
    if (mid == null) { dropped += 1; continue; }
    points.push({ t: r.t, value: r.nlv / mid }); // mid = CHF par USD (IDEALPRO)
    converted = true;
  }
  if (!converted) {
    // Aucun taux du tout → série brute dans la devise du broker, étiquetée.
    return {
      points: usable.map((r) => ({ t: r.t, value: r.nlv })),
      currency: usable[0].currency || 'CHF',
      droppedNoRate: 0,
    };
  }
  return { points, currency: 'USD', droppedNoRate: dropped };
}

/** Injecte des points whitespace (nlv null) dans les intervalles > holeMs.
 *  `series` : points buildIntradaySeries (t en SECONDES, axe local).
 *  L'axe temps de lightweight-charts est INDEXÉ PAR BARRE (pas
 *  proportionnel) : un seul point whitespace ne ferait qu'un cran
 *  invisible. On peuple donc le trou au pas d'une minute — le trou
 *  occupe à l'écran une largeur proportionnelle à sa durée réelle,
 *  et la ligne se COUPE (jamais interpolée). */
export const HOLE_PITCH_S = 60;

export function injectHoles(series, holeMs = BRIDGE_HOLE_MS) {
  if (!Array.isArray(series) || series.length < 2) return series || [];
  const out = [series[0]];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const cur = series[i];
    if ((cur.t - prev.t) * 1000 > holeMs) {
      for (let t = prev.t + HOLE_PITCH_S; t < cur.t; t += HOLE_PITCH_S) {
        out.push({ t, date: cur.date, nlv: null, underwater: null, gap: true });
      }
    }
    out.push(cur);
  }
  return out;
}

/**
 * Série bridge de la séance courante, prête pour TvChart (intraday).
 * Fenêtre STRICTE [windowStartMs, windowEndMs] : des lignes d'hier ne
 * construisent jamais la courbe d'aujourd'hui.
 */
export function buildBridgeSeries({ rows, fxRows, dailySeries, windowStartMs, windowEndMs }) {
  const inWindow = (rows || []).filter(
    (r) => Number.isFinite(r?.t) && r.t >= windowStartMs && r.t <= windowEndMs
  );
  const { points, currency, droppedNoRate } = convertBridgeRows({ rows: inWindow, fxRows });
  if (points.length === 0) return { series: [], currency, droppedNoRate };

  // Une séance NY peut chevaucher deux dates LOCALES (post-market 20:00 NY
  // = 02:00 Genève le lendemain) → groupage par jour local, tous gardés.
  const byDay = new Map();
  for (const p of points) {
    const d = new Date(p.t);
    const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push([Math.floor(p.t / 1000), p.value]);
  }
  const intradayDays = Array.from(byDay.entries()).map(([d, pts]) => ({ d, pts }));
  const series = buildIntradaySeries({
    dailySeries: dailySeries || [],
    intradayDays,
    liveNlv: null, // JAMAIS un point du store sur une série bridge (couture interdite)
    sessionDays: intradayDays.length,
  });
  return { series: injectHoles(series), currency, droppedNoRate };
}

/**
 * MiniSpark de l'overlay — MÊME source que la série affichée (addendum 2
 * n°4 : un chiffre et sa spark de deux sources, c'est la divergence
 * qu'É3.1 a tuée). Valeurs réelles seules (les whitespace sautent),
 * sous-échantillonnées uniformément à ≤ maxPoints.
 */
export function sparkFromSeries(series, maxPoints = 40) {
  const vals = (Array.isArray(series) ? series : [])
    .filter((p) => p.nlv != null)
    .map((p) => p.nlv);
  if (vals.length <= maxPoints) return vals;
  const out = [];
  const step = (vals.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) out.push(vals[Math.round(i * step)]);
  return out;
}

/**
 * LOI D'UNE SEULE SOURCE — l'unique porte de sélection de la courbe du
 * Héros 1. ≥ 1 point bridge réel (séance courante) → la série bridge,
 * ENTIÈRE ; sinon la série client. Ne construit JAMAIS un mélange : la
 * sortie est l'UNE des deux entrées, par référence.
 */
export function selectHeroSeries({ bridgeSeries, clientSeries }) {
  const bridge = Array.isArray(bridgeSeries) ? bridgeSeries : [];
  if (bridge.some((p) => p.nlv != null)) return { source: 'bridge', series: bridge };
  return { source: 'est', series: Array.isArray(clientSeries) ? clientSeries : [] };
}
