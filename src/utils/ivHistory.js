// ═══════════════════════════════════════════════════════════════
//  IV HISTORY — collecte locale d'IV historique (U13-collecte)
//
//  Série temporelle datée d'ATM IV par ticker, accumulée en local au fil
//  des chargements de la page Chain (l'ATM IV y est déjà calculé : médiane
//  de 5 strikes autour du spot). But : constituer un historique exploitable
//  PLUS TARD pour l'IV rank (Chain IVR, History backfill, useIVMovers,
//  histogramme Greeks). CETTE unité ne fait QUE collecter — aucun affichage.
//
//  Stockée HORS du store (clé `qc:ivHistory:{ticker}`, exactement comme le
//  cache `qc:chainIv:{ticker}`) : ce n'est pas de la donnée comptable, ça ne
//  doit ni alourdir le store ni toucher les clés réelles `ibkr_u_*`. Distinct
//  de `qc:chainIv` qui, lui, ÉCRASE (un seul snapshot latest par ticker) —
//  ici on ACCUMULE une série datée.
//
//  Forme : [{ date: 'YYYY-MM-DD', iv: number }, ...] trié par date asc.
//  Idempotent par (ticker, date) — recharger la même chaîne le même jour met
//  à jour l'entrée du jour (calque `UPDATE_DAILY_SNAPSHOT` du store). Rétention
//  FIFO 400 jours (≈ 52 semaines + marge), pour borner le localStorage.
//
//  Consommation future (NON branchée ici) :
//    import { readIvHistory } from './ivHistory';
//    import { ivRank } from './options/blackScholes';
//    const ivr = ivRank(readIvHistory(tk).map((e) => e.iv), currentIv);
// ═══════════════════════════════════════════════════════════════

const IV_HISTORY_KEY_PREFIX = 'qc:ivHistory:';
const IV_HISTORY_MAX_ENTRIES = 400; // ~52 semaines + marge (rétention FIFO)

function todayIso(now = Date.now()) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Lit la série IV historique d'un ticker.
 * Toujours sûr : [] si absent, illisible, ou hors navigateur.
 *
 * @param {string} ticker
 * @returns {Array<{date: string, iv: number}>}
 */
export function readIvHistory(ticker) {
  if (!ticker || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(IV_HISTORY_KEY_PREFIX + ticker);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.date === 'string' && Number.isFinite(e.iv));
  } catch {
    return [];
  }
}

/**
 * Ajoute (ou met à jour) l'entrée IV du jour pour un ticker.
 * Idempotent par (ticker, date) ; rétention FIFO 400 jours ; écriture
 * localStorage sûre (try/catch, échec silencieux sur quota/disabled).
 * No-op si `iv` invalide (≤ 0 / NaN) ou hors navigateur.
 *
 * @param {string} ticker
 * @param {number} iv     ATM IV (> 0)
 * @param {number} [now]  horloge injectable (tests déterministes)
 * @returns {Array<{date: string, iv: number}>} la série après écriture
 */
export function appendIvHistory(ticker, iv, now = Date.now()) {
  if (!ticker || typeof window === 'undefined') return [];
  if (!Number.isFinite(iv) || iv <= 0) return readIvHistory(ticker);

  const date = todayIso(now);
  const series = readIvHistory(ticker);

  // Idempotence par (ticker, date) : met à jour l'entrée du jour si elle
  // existe (pas de doublon quand on recharge la chaîne plusieurs fois).
  const idx = series.findIndex((e) => e.date === date);
  if (idx !== -1) {
    series[idx] = { date, iv };
  } else {
    series.push({ date, iv });
  }

  // Tri par date asc + rétention FIFO (garde les 400 entrées les plus récentes).
  series.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed =
    series.length > IV_HISTORY_MAX_ENTRIES
      ? series.slice(series.length - IV_HISTORY_MAX_ENTRIES)
      : series;

  try {
    window.localStorage.setItem(IV_HISTORY_KEY_PREFIX + ticker, JSON.stringify(trimmed));
  } catch {
    /* quota / disabled — échec silencieux, aucune dégradation de la page Chain */
  }
  return trimmed;
}
