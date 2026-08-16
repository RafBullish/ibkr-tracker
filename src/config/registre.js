// ═══════════════════════════════════════════════════════════════
//  LE REGISTRE — source UNIQUE des valeurs de la stratégie.
//
//  Brique Q-A (16.08.2026). Deux fichiers, deux natures :
//    · parametres.json      — la LOI de trading (Carte V3, fait foi).
//                             Ne bouge que par décision de Rafael.
//    · parametres.app.json  — l'ERGONOMIE / l'affichage. Peut bouger
//                             sans toucher la loi. Aucune valeur commune.
//
//  CE FICHIER est le SEUL endroit de `src/` où un nombre normatif a le
//  droit d'apparaître en dur (il le lit du JSON et le ré-exprime aux
//  conventions du code, à VALEURS IDENTIQUES). Partout ailleurs, on
//  IMPORTE ces constantes — `npm run check:doctrine` échoue sinon.
//
//  Q-A n'écrit AUCUNE porte : le recâblage des portes (P2 trail, P4
//  earnings, réconciliation de la bande de stagnation, seuil θ, sizing…)
//  est Q-C. Ici on EXPOSE et on ré-exprime, on ne décide pas.
// ═══════════════════════════════════════════════════════════════

import doctrine from './parametres.json';
import app from './parametres.app.json';

/** La loi brute (portes, sizing, entree, garde_fous, app, capital…). Lecture seule. */
export const REGISTRE = doctrine;
/** L'ergonomie brute (portfolio_affichage, significance, jauges). Lecture seule. */
export const REGISTRE_APP = app;

const P1 = doctrine.portes.P1_sl;
const P3 = doctrine.portes.P3_dte;
const P5 = doctrine.portes.P5_stagnation;

// ── PORTE P1 · STOP-LOSS ────────────────────────────────────────────
// Le registre stocke une FRACTION SIGNÉE (execution_pct = -0.35). Le code
// utilise selon les sites : la fraction signée, le pourcentage signé (-35),
// ou la magnitude (0.35 / 35). On ré-exprime les quatre à l'identique — la
// conversion n'est PAS un recâblage, c'est la même valeur dans l'unité du site.
/** Fraction signée du stop d'exécution : -0.35. */
export const SL_EXECUTION_FRAC = P1.execution_pct;
/** Pourcentage signé du stop d'exécution : -35. */
export const SL_EXECUTION_PCT = Math.round(P1.execution_pct * 100);
/** Magnitude fractionnaire (coût) : 0.35. */
export const SL_EXECUTION_MAGNITUDE = Math.abs(P1.execution_pct);
/** Magnitude en points de pourcentage : 35. */
export const SL_EXECUTION_MAGNITUDE_PCT = Math.abs(Math.round(P1.execution_pct * 100));
/** Palier d'ALERTE (avant exécution) : -30. Exposé pour Q-C — aucun site code aujourd'hui. */
export const SL_ALERTE_PCT = Math.round(P1.alerte_pct * 100);

// ── PORTE P3 · DTE ──────────────────────────────────────────────────
/** Jour-porte DTE de la doctrine : 45. */
export const DTE_GATE_JOURS = P3.jours;

// ── PORTE P5 · STAGNATION ───────────────────────────────────────────
/** Jour de stagnation : 30. */
export const STAGNATION_JOUR = P5.jour;
// Bandes en pourcentage (registre -0.20 / +0.30). ⚠ Le code (detectExitReason)
// porte encore l'ancienne bande ±10 : c'est un ÉCART de valeur, réconcilié en
// Q-C — Q-A ne recâble pas la logique. Exposé ici pour la réconciliation.
/** Bande basse de stagnation (registre) : -20. */
export const STAGNATION_BANDE_BASSE_PCT = Math.round(P5.bande_basse_pct * 100);
/** Bande haute de stagnation (registre) : +30. */
export const STAGNATION_BANDE_HAUTE_PCT = Math.round(P5.bande_haute_pct * 100);

// ── EXPOSÉ POUR Q-C — aucun consommateur code aujourd'hui ───────────
// Ces valeurs de doctrine n'ont pas encore de site dans `src/` (portes non
// câblées, entrée non gatée : l'app est un enregistreur de vol). On les
// expose depuis la source unique pour que Q-C les câble sans re-hardcoder.
/** P2 trailing : { activation_pic_pct 0.50, part_du_gain_rendue 0.40, … }. */
export const P2_TRAIL = doctrine.portes.P2_trail;
/** P4 earnings : { fenetre_debut_jours 7, fenetre_fin_jours 5, unite jours_de_bourse, … }. */
export const P4_EARNINGS = doctrine.portes.P4_earnings;
/** Critère θ d'entrée : θ absolu / prime mid, seuil 0.008 (0,8 %/jour), par position. */
export const THETA_MAX_PCT_PRIME_JOUR = doctrine.entree.E2_theta_max_pct_prime_jour;
/** E4 · spread max en fraction du mid : 0.30. Consommé par le marquage de violation Q-B. */
export const SPREAD_MAX_PCT_MID = doctrine.entree.E4_spread_max_pct_mid;
/** E5 · fenêtre d'exécution : { debut '15:45', fin '21:45', fuseau 'Europe/Zurich' }. Consommée par Q-B. */
export const FENETRE_EXECUTION = doctrine.entree.E5_fenetre_execution;
/** Sizing doctrine : { S1_pct_max_par_position 0.60, S3_ticket_min_usd 150, S4_n_max, … }. */
export const SIZING = doctrine.sizing;
/** Garde-fous : { G5_serie_pertes { seuil 5, pause_heures 72 }, G1..G6 null }. */
export const GARDE_FOUS = doctrine.garde_fous;
/** Rôle de l'app : { role 'enregistreur_de_vol', blocage_dur false, check_10_bloquant false }. */
export const APP_DOCTRINE = doctrine.app;

// ── ERGONOMIE (parametres.app.json) — PAS de doctrine ───────────────
/** Plancher cash / plafond notionnel d'affichage : { cashFloorPct 30, notionalMaxPct 70 }. */
export const PORTFOLIO_AFFICHAGE = app.portfolio_affichage;
/** Seuils de significativité statistique (honnêteté d'affichage). */
export const SIGNIFICANCE = app.significance;
/** Normalisation des jauges + escalade des badges + fenêtres d'approche. */
export const JAUGES = app.jauges;
