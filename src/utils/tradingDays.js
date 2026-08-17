// ═══════════════════════════════════════════════════════════════
//  JOURS DE BOURSE — Brique Q-C (porte P4 earnings).
//
//  La carte V3 compte la fenêtre earnings (J−7 à J−5) en JOURS DE
//  BOURSE, pas en jours calendaires. Ce module compte les jours ouvrés
//  (lundi→vendredi) entre deux dates.
//
//  FÉRIÉS US (recette É4-a, 17.08.2026) : les jours de bourse SAUTENT aussi
//  les fériés de fermeture pleine du NYSE, pas seulement les week-ends. Une
//  SEMAINE fériée décalait la fenêtre P4 et pouvait faire TENIR une position
//  à travers une publication (la porte se croyait hors fenêtre). La table de
//  dates vit dans `parametres.app.json` (clé `jours_feries_us`, révision
//  annuelle) et transite par le registre — AUCUNE date en dur ici. Le set est
//  injectable (param `holidays`) pour les tests aux bornes.
//  Convention de fuseau : midi (T12:00:00) comme dates.js, pour éviter les
//  bascules de jour au DST.
// ═══════════════════════════════════════════════════════════════

import { JOURS_FERIES_US_SET } from '../config/registre';

// Date locale (construite à midi) → 'YYYY-MM-DD' à partir des composants
// LOCAUX (pas toISOString, qui basculerait en UTC). Sûr quel que soit le
// fuseau : |offset| < 12 h, donc midi reste le même jour calendaire.
function isoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Nombre de JOURS DE BOURSE (lun–ven) entre `fromISO` (exclu) et `toISO`
 * (inclus). Signé : négatif si `toISO` précède `fromISO`. null si une des
 * dates est invalide.
 *
 * Ex. d'un lundi au lundi suivant (7 j calendaires) = 5 jours de bourse.
 *
 * @param {string} fromISO 'YYYY-MM-DD'
 * @param {string} toISO   'YYYY-MM-DD'
 * @param {Set<string>} [holidays] set de fériés 'YYYY-MM-DD' (défaut : NYSE
 *        du registre). Injectable pour les tests.
 * @returns {number|null}
 */
export function tradingDaysUntil(fromISO, toISO, holidays = JOURS_FERIES_US_SET) {
  if (!fromISO || !toISO) return null;
  const cur = new Date(`${String(fromISO).slice(0, 10)}T12:00:00`);
  const target = new Date(`${String(toISO).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(target.getTime())) return null;
  if (cur.getTime() === target.getTime()) return 0;
  const step = cur.getTime() < target.getTime() ? 1 : -1;
  let n = 0;
  // Garde-fou : borne large pour éviter toute boucle infinie sur entrée absurde.
  for (let guard = 0; guard < 100000 && cur.getTime() !== target.getTime(); guard += 1) {
    cur.setDate(cur.getDate() + step);
    const d = cur.getDay();
    // Jour de bourse = lun–ven ET non férié NYSE.
    if (d >= 1 && d <= 5 && !holidays.has(isoLocal(cur))) n += step;
  }
  return n;
}

/**
 * Vrai si `toISO` est dans la fenêtre [debut, fin] jours de bourse APRÈS
 * `fromISO` (bornes incluses). Sert la porte P4 : armée quand
 * `fin <= tradingDaysUntil(today, earnings) <= debut` (J−7 à J−5).
 */
export function withinTradingDayWindow(fromISO, toISO, debut, fin, holidays = JOURS_FERIES_US_SET) {
  const n = tradingDaysUntil(fromISO, toISO, holidays);
  if (n == null) return null;
  return n >= fin && n <= debut;
}
