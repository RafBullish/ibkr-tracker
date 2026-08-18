// ═══════════════════════════════════════════════════════════════
//  MARQUAGE DES ÉCARTS DE DOCTRINE — Brique Q-B « la saisie »
//
//  L'app est un ENREGISTREUR DE VOL, jamais un frein : ce module
//  MARQUE les écarts à la carte Sniper V3, il n'en BLOQUE aucun. Une
//  violation est un CHIP AMBRE (loi de couleur §6 : un écart de
//  doctrine n'est PAS de l'argent réel perdu → jamais rouge, jamais
//  bloquant), rendu à la saisie ET à l'import.
//
//  7 règles, TOUS les seuils lus du REGISTRE (source unique, Q-A) —
//  aucun nombre normatif en dur ici, `npm run check:doctrine` reste vert.
//
//    S1  taille > 60 % du capital            sizing.S1_pct_max_par_position
//    S3  ticket < 150 $                      sizing.S3_ticket_min_usd
//    S5  2ᵉ entrée du jour                    sizing.S5_entrees_max_jour
//    S6  2ᵉ position même sous-jacent         sizing.S6_max_par_sous_jacent
//    E2  θ d'entrée > 0,8 %/jour              entree.E2_theta_max_pct_prime_jour
//    E4  spread > 30 % du mid                 entree.E4_spread_max_pct_mid
//    E5  entrée hors 15:45–21:45 Genève       entree.E5_fenetre_execution
//
//  Le DELTA (E3) est INDICATIF (carte : caractere « indicatif ») —
//  il ne produit JAMAIS de violation. On affiche, on ne juge pas.
//
//  θ d'entrée (E2) se mesure sur la PRIME D'ENTRÉE (pi), pas sur le
//  mark courant (pc) — distinct de la cellule « Θ % PRIME/JOUR » du
//  deck qui mesure la combustion sur le mark. Deux bases, deux sens.
//
//  Certaines entrées n'existent pas encore dans le magasin (θ d'entrée,
//  bid/ask, horodatage d'entrée) : la règle est alors « indéterminée »
//  — NI faute, NI conforme — jamais un faux zéro. Elle se rallumera
//  d'elle-même le jour où l'entrée est capturée (Chain, Q-C, saisie
//  horodatée).
// ═══════════════════════════════════════════════════════════════

import {
  SIZING,
  THETA_MAX_PCT_PRIME_JOUR,
  SPREAD_MAX_PCT_MID,
  FENETRE_EXECUTION,
} from '../config/registre';
import { toFloat, ensurePositive } from './math';

/** Statuts d'une règle. 'violation' = chip ambre ; 'indetermine' = neutre honnête. */
export const V_STATUS = Object.freeze({
  VIOLATION: 'violation',
  INDETERMINE: 'indetermine',
});

// ── helpers purs ────────────────────────────────────────────────

/** Coût du ticket en USD : |prime d'entrée × multiplicateur × quantité|. */
export function ticketUsd(pos) {
  if (!pos) return 0;
  const pi = toFloat(pos.pi);
  const mu = ensurePositive(pos.mu);
  const ct = Math.abs(toFloat(pos.ct));
  return Math.abs(pi * mu * ct);
}

/** Jour calendaire d'une date d'entrée (di 'YYYY-MM-DD' ou entryTs ISO). */
function entryDay(pos) {
  if (pos?.di) return String(pos.di).slice(0, 10);
  if (pos?.entryTs) return String(pos.entryTs).slice(0, 10);
  return null;
}

/**
 * Heure locale Europe/Zurich (HH:MM) d'un horodatage ISO, ou null si
 * l'horodatage est absent / invalide. Compare-friendly ('15:45').
 */
export function zurichHHMM(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('fr-CH', {
      timeZone: FENETRE_EXECUTION.fuseau || 'Europe/Zurich',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return null;
  }
}

function descriptor(code, label, source, status, message, extra) {
  return {
    code,
    label,
    source,
    status,
    measurable: status !== V_STATUS.INDETERMINE,
    message,
    ...(extra || {}),
  };
}

// ── règles individuelles ────────────────────────────────────────
// Chaque règle renvoie un descriptor de VIOLATION, un descriptor
// INDÉTERMINÉ (entrée absente), ou null (conforme → rien à afficher).

/**
 * S1 — taille > 60 % de la NLV. Dénominateur = ctx.capitalUsd, qui DOIT
 * être la valeur nette de liquidation (NLV), jamais les dépôts : sur un
 * compte réduit de moitié, la base dépôts autoriserait une position
 * supérieure à la valeur réelle. NLV absente → indéterminée, SANS repli.
 */
function ruleS1(pos, ctx) {
  const src = 'sizing.S1_pct_max_par_position';
  const max = SIZING.S1_pct_max_par_position;
  const ticket = ticketUsd(pos);
  const nlv = toFloat(ctx.capitalUsd);
  if (!(ticket > 0) || !(nlv > 0)) {
    return descriptor('S1', 'Taille du ticket', src, V_STATUS.INDETERMINE,
      'Taille indéterminée — NLV (valeur nette) non résolue.');
  }
  const frac = ticket / nlv;
  if (frac > max) {
    return descriptor('S1', 'Taille > cap doctrine', src, V_STATUS.VIOLATION,
      `Ticket = ${Math.round(frac * 100)} % de la NLV (max ${Math.round(max * 100)} %).`,
      { fraction: frac, max });
  }
  return null;
}

/** S3 — ticket < 150 $. */
function ruleS3(pos) {
  const src = 'sizing.S3_ticket_min_usd';
  const min = SIZING.S3_ticket_min_usd;
  const ticket = ticketUsd(pos);
  if (!(ticket > 0)) {
    return descriptor('S3', 'Ticket minimum', src, V_STATUS.INDETERMINE,
      'Ticket indéterminé — prime ou quantité manquante.');
  }
  if (ticket < min) {
    return descriptor('S3', 'Ticket < minimum', src, V_STATUS.VIOLATION,
      `Ticket $${Math.round(ticket)} sous le plancher $${min}.`,
      { ticketUsd: ticket, min });
  }
  return null;
}

/** S5 — 2ᵉ entrée du jour. Compte le book (+ same-day clôturés) par jour d'entrée. */
function ruleS5(pos, ctx) {
  const src = 'sizing.S5_entrees_max_jour';
  const max = SIZING.S5_entrees_max_jour;
  const day = entryDay(pos);
  const book = ctx.book;
  if (!day || !Array.isArray(book)) {
    return descriptor('S5', 'Entrées du jour', src, V_STATUS.INDETERMINE,
      'Entrées du jour indéterminées — date d’entrée absente (import sans horodatage).');
  }
  const sameDay = [...book, ...(ctx.sameDayClosed || [])].filter(
    (p) => entryDay(p) === day
  );
  if (sameDay.length > max) {
    return descriptor('S5', `> ${max} entrée/jour`, src, V_STATUS.VIOLATION,
      `${sameDay.length} entrées le ${day} (max ${max}/jour).`,
      { count: sameDay.length, max });
  }
  return null;
}

/**
 * S6 — 2ᵉ position sur le même sous-jacent (couvre le moyennage). Deux
 * formes : (a) un MOYENNAGE (ADD_POSITION a fusionné ≥2 lots sur le même
 * contrat → lots.length>1) est un écart par construction, même en une
 * seule ligne ; (b) deux positions distinctes sur le même sous-jacent
 * dans le book de référence.
 */
function ruleS6(pos, ctx) {
  const src = 'sizing.S6_max_par_sous_jacent';
  const max = SIZING.S6_max_par_sous_jacent;
  const lotCount = Array.isArray(pos.lots) ? pos.lots.length : 1;
  if (lotCount > max) {
    return descriptor('S6', 'Position moyennée', src, V_STATUS.VIOLATION,
      `${lotCount} entrées moyennées sur ${pos.tk} (max ${max}/sous-jacent).`,
      { count: lotCount, max, averaged: true });
  }
  const book = ctx.book;
  if (!pos?.tk || !Array.isArray(book)) {
    return descriptor('S6', 'Positions / sous-jacent', src, V_STATUS.INDETERMINE,
      'Concentration indéterminée — book de référence absent.');
  }
  const sameUnderlying = book.filter((p) => p.tk === pos.tk);
  if (sameUnderlying.length > max) {
    return descriptor('S6', `> ${max} position/sous-jacent`, src, V_STATUS.VIOLATION,
      `${sameUnderlying.length} positions sur ${pos.tk} (max ${max}).`,
      { count: sameUnderlying.length, max });
  }
  return null;
}

/**
 * E2 — θ d'entrée > 0,8 %/jour de la prime mid d'ENTRÉE. Micro-brique
 * capture : θ vient de `ctx.thetaAtEntryPerDay` (θ absolu/jour par action,
 * saisi à la main). Dénominateur = prime mid d'entrée : le mid CAPTURÉ
 * (`pos.midAtEntry`, apparié au θ du même moment) ; à défaut le prix
 * d'entrée `pi` (le fill Flex, proxy honnête). Sans θ capturé → indéterminé.
 * NB : ≠ « Θ % PRIME/JOUR » du deck (combustion sur le MARK courant, neutre).
 */
function ruleE2(pos, ctx) {
  const src = 'entree.E2_theta_max_pct_prime_jour';
  const max = THETA_MAX_PCT_PRIME_JOUR;
  const theta = ctx.thetaAtEntryPerDay;
  const mid = toFloat(pos.midAtEntry) || toFloat(pos.pi);
  if (!Number.isFinite(theta) || !(mid > 0)) {
    return descriptor('E2', 'θ d’entrée', src, V_STATUS.INDETERMINE,
      'θ d’entrée non capturé (θ/jour + prime mid d’entrée requis).');
  }
  const frac = Math.abs(theta) / mid;
  if (frac > max) {
    return descriptor('E2', 'θ d’entrée > seuil', src, V_STATUS.VIOLATION,
      `θ = ${(frac * 100).toFixed(2)} %/jour de la prime (max ${(max * 100).toFixed(1)} %).`,
      { fraction: frac, max });
  }
  return null;
}

/**
 * E4 — spread > 30 % du mid. Entrée : bid/ask d'entrée (pos.bidAtEntry /
 * pos.askAtEntry) ou pos.spreadPctAtEntry précalculé. Non persistés
 * aujourd'hui (ni à l'import, ni en saisie manuelle) → indéterminé.
 */
function ruleE4(pos) {
  const src = 'entree.E4_spread_max_pct_mid';
  const max = SPREAD_MAX_PCT_MID;
  let frac = null;
  if (Number.isFinite(pos.spreadPctAtEntry)) {
    frac = pos.spreadPctAtEntry;
  } else {
    const bid = toFloat(pos.bidAtEntry);
    const ask = toFloat(pos.askAtEntry);
    const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
    if (mid > 0) frac = (ask - bid) / mid;
  }
  if (!Number.isFinite(frac)) {
    return descriptor('E4', 'Spread d’entrée', src, V_STATUS.INDETERMINE,
      'Spread d’entrée non capturé (bid/ask absents du magasin).');
  }
  if (frac > max) {
    return descriptor('E4', 'Spread > seuil', src, V_STATUS.VIOLATION,
      `Spread ${(frac * 100).toFixed(0)} % du mid (max ${Math.round(max * 100)} %).`,
      { fraction: frac, max });
  }
  return null;
}

/**
 * E5 — entrée hors fenêtre 15:45–21:45 (Europe/Zurich). Entrée : un
 * horodatage d'entrée (pos.entryTs, ISO avec heure). di est date-seule
 * → l'import perd l'heure → indéterminé. Stampé à la saisie manuelle.
 */
function ruleE5(pos) {
  const src = 'entree.E5_fenetre_execution';
  const hhmm = zurichHHMM(pos.entryTs);
  if (!hhmm) {
    return descriptor('E5', 'Fenêtre d’exécution', src, V_STATUS.INDETERMINE,
      'Heure d’entrée non capturée (date seule).');
  }
  const debut = FENETRE_EXECUTION.debut;
  const fin = FENETRE_EXECUTION.fin;
  if (hhmm < debut || hhmm > fin) {
    return descriptor('E5', 'Hors fenêtre', src, V_STATUS.VIOLATION,
      `Entrée à ${hhmm} (fenêtre ${debut}–${fin} ${FENETRE_EXECUTION.fuseau}).`,
      { hhmm, debut, fin });
  }
  return null;
}

/**
 * Évalue les 7 règles pour une position. Renvoie la liste des
 * descripteurs NON conformes (violations + indéterminés) — les règles
 * conformes ne produisent rien. Ne bloque JAMAIS, ne throw JAMAIS.
 *
 * @param {Object} pos   position (schéma v8)
 * @param {Object} [ctx]
 * @param {number} [ctx.capitalUsd]         capital de référence (S1)
 * @param {Array}  [ctx.book]               positions ouvertes de référence (S5/S6)
 * @param {Array}  [ctx.sameDayClosed]      trades clôturés le même jour (S5)
 * @param {number} [ctx.thetaAtEntryPerDay] θ absolu/jour à l'entrée (E2)
 * @returns {Array<Object>} descripteurs
 */
export function evaluatePositionViolations(pos, ctx = {}) {
  if (!pos) return [];
  const out = [
    ruleS1(pos, ctx),
    ruleS3(pos),
    ruleS5(pos, ctx),
    ruleS6(pos, ctx),
    ruleE2(pos, ctx),
    ruleE4(pos),
    ruleE5(pos),
  ];
  return out.filter(Boolean);
}

/** Sous-ensemble « violations » (chips ambre) d'une évaluation. */
export function violationsOnly(descriptors) {
  return (descriptors || []).filter((d) => d.status === V_STATUS.VIOLATION);
}
