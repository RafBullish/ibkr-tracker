// ═══════════════════════════════════════════════════════════════
//  NLV INTRADAY — buffer roulant d'échantillons NLV en séance
//  (FF-données). PUR, sans React.
//
//  Échantillonne la NLV du store (~toutes les 5 min, fenêtre RTH NY —
//  le gating de séance vit dans le hook writer, pas ici) vers une clé
//  compacte DÉDIÉE, hors du store : ce n'est pas de la donnée comptable,
//  ça ne doit ni alourdir `ibkr_u_s` ni toucher les clés réelles
//  `ibkr_u_*` (même doctrine que qc:ivHistory / qc:chainIv).
//
//  Forme stockée (compacte) :
//    { v: 1, days: [ { d: 'YYYY-MM-DD', pts: [[epochSec, nlv], …] }, … ] }
//  triée par jour asc, pts triés par ts asc. Buffer roulant :
//  MAX_SESSION_DAYS jours de séance (~5) ; ~78 pts/séance à 5 min →
//  ≤ ~400 points ≈ quelques Ko. Idempotence temporelle : un échantillon
//  est ignoré s'il arrive < MIN_SAMPLE_GAP_MS après le dernier du jour
//  (le writer tique à la minute, la garde impose la cadence ~5 min).
//
//  Consommation : Héros 1 (ranges 1D/5D denses) via useIntradayNlv.
//  Écriture sûre (try/catch quota) ; événement NLV_INTRADAY_EVENT
//  dispatché après chaque écriture réussie pour re-render les lecteurs.
// ═══════════════════════════════════════════════════════════════

export const NLV_INTRADAY_KEY = 'qc:nlvIntraday';
export const NLV_INTRADAY_EVENT = 'qc:nlvIntraday:change';

// ~5 jours de séance de rétention ; garde 4.5 min entre échantillons
// (tolère la gigue du tick minute → cadence effective ~5 min).
export const NLV_INTRADAY_MAX_DAYS = 5;
export const NLV_INTRADAY_MIN_GAP_MS = 270_000;

// Même convention de date-jour que le writer quotidien du Dashboard et
// que `today` de Héros 1 (toISOString → date UTC) : le jour intraday
// rejoint le snapshot quotidien du même jour sans couture.
function dayIso(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Lit le buffer intraday. Toujours sûr : [] si absent, illisible,
 * corrompu ou hors navigateur.
 *
 * @returns {Array<{d: string, pts: Array<[number, number]>}>} jours asc
 */
export function readIntradayDays() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NLV_INTRADAY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.days)) return [];
    return parsed.days
      .filter((day) => day && typeof day.d === 'string' && Array.isArray(day.pts))
      .map((day) => ({
        d: day.d,
        pts: day.pts
          .filter(
            (p) =>
              Array.isArray(p) &&
              Number.isFinite(p[0]) &&
              Number.isFinite(p[1]) &&
              p[1] > 0
          )
          .slice()
          .sort((a, b) => a[0] - b[0]),
      }))
      .filter((day) => day.pts.length > 0)
      .sort((a, b) => a.d.localeCompare(b.d));
  } catch {
    return [];
  }
}

/**
 * Ajoute un échantillon NLV au jour courant. No-op si `nlv` invalide,
 * hors navigateur, ou si le dernier échantillon du jour date de moins
 * de MIN_SAMPLE_GAP_MS (cadence ~5 min garantie côté données, quel que
 * soit le rythme d'appel). Rétention : MAX_SESSION_DAYS jours les plus
 * récents. Écriture localStorage sûre ; événement dispatché si écrit.
 *
 * @param {number} nlv    NLV USD (> 0)
 * @param {number} [now]  horloge injectable (tests déterministes)
 * @returns {Array<{d: string, pts: Array<[number, number]>}>} buffer après appel
 */
export function appendIntradaySample(nlv, now = Date.now()) {
  if (typeof window === 'undefined') return [];
  const days = readIntradayDays();
  if (!Number.isFinite(nlv) || nlv <= 0) return days;

  const d = dayIso(now);
  const ts = Math.floor(now / 1000);
  let day = days.find((x) => x.d === d);
  if (day) {
    const last = day.pts[day.pts.length - 1];
    if (last && (ts - last[0]) * 1000 < NLV_INTRADAY_MIN_GAP_MS) return days;
    day.pts.push([ts, Math.round(nlv * 100) / 100]);
  } else {
    day = { d, pts: [[ts, Math.round(nlv * 100) / 100]] };
    days.push(day);
    days.sort((a, b) => a.d.localeCompare(b.d));
  }

  const trimmed =
    days.length > NLV_INTRADAY_MAX_DAYS
      ? days.slice(days.length - NLV_INTRADAY_MAX_DAYS)
      : days;

  try {
    window.localStorage.setItem(
      NLV_INTRADAY_KEY,
      JSON.stringify({ v: 1, days: trimmed })
    );
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(NLV_INTRADAY_EVENT));
    }
  } catch {
    /* quota / storage désactivé — échec silencieux, zéro dégradation */
  }
  return trimmed;
}
