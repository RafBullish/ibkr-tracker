// ═══════════════════════════════════════════════════════════════
//  JOURS DE BOURSE — Brique Q-C (porte P4 earnings).
//
//  La carte V3 compte la fenêtre earnings (J−7 à J−5) en JOURS DE
//  BOURSE, pas en jours calendaires. Ce module compte les jours ouvrés
//  (lundi→vendredi) entre deux dates.
//
//  ⚠ DÉFAUT DATÉ — À CORRIGER AVANT LE TAG (recette É4, décision architecte
//  17.08.2026). Les JOURS FÉRIÉS US ne sont PAS gérés. Ce n'est PAS une
//  simple approximation : une SEMAINE fériée décale la fenêtre P4 et peut
//  faire TENIR une position à travers une publication de résultats (la porte
//  se croit hors fenêtre alors qu'elle y est). Correctif prévu : une table
//  de dates fériées US dans `parametres.app.json` (clé `jours_feries_us`),
//  lue ici pour sauter aussi les jours ouvrés fériés (cf. ROADMAP recette Q-C).
//  Convention de fuseau : midi (T12:00:00) comme dates.js, pour éviter les
//  bascules de jour au DST.
// ═══════════════════════════════════════════════════════════════

/**
 * Nombre de JOURS DE BOURSE (lun–ven) entre `fromISO` (exclu) et `toISO`
 * (inclus). Signé : négatif si `toISO` précède `fromISO`. null si une des
 * dates est invalide.
 *
 * Ex. d'un lundi au lundi suivant (7 j calendaires) = 5 jours de bourse.
 *
 * @param {string} fromISO 'YYYY-MM-DD'
 * @param {string} toISO   'YYYY-MM-DD'
 * @returns {number|null}
 */
export function tradingDaysUntil(fromISO, toISO) {
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
    if (d >= 1 && d <= 5) n += step;
  }
  return n;
}

/**
 * Vrai si `toISO` est dans la fenêtre [debut, fin] jours de bourse APRÈS
 * `fromISO` (bornes incluses). Sert la porte P4 : armée quand
 * `fin <= tradingDaysUntil(today, earnings) <= debut` (J−7 à J−5).
 */
export function withinTradingDayWindow(fromISO, toISO, debut, fin) {
  const n = tradingDaysUntil(fromISO, toISO);
  if (n == null) return null;
  return n >= fin && n <= debut;
}
