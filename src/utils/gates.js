// ═══════════════════════════════════════════════════════════════
//  LES CINQ PORTES — moteur UNIQUE (Brique Q-C).
//
//  Une seule source de vérité pour P1..P5. Tous les seuils viennent du
//  REGISTRE (src/config/registre.js) — aucun nombre normatif en dur ici.
//  Les portes ALERTENT, elles n'AGISSENT jamais : aucune fermeture, aucun
//  ordre, aucun blocage. Le moteur produit des descripteurs de signal ;
//  la bande décision (deriveAttention) les affiche, Rafael exécute.
//
//    P1 SL      alerte −30 % (ambre) · exécution −35 % (ROUGE, perte réelle).
//               Base = mid d'entrée → unrealPct (% de la prime d'entrée).
//    P2 TRAIL   armée quand le PIC (mid de clôture) atteint +50 %. Sortie =
//               pic_pct × 0,60. AUCUN plancher. Pic PARTIEL dit à l'écran.
//    P3 DTE     45 jours restants, inconditionnel (approche 45<dte≤50).
//    P4 EARN    fenêtre J−7 à J−5 (jours de bourse). Si P&L>0 → sortie ;
//               si P&L≤0 → on TIENT (la porte SE TAIT). earningsDate absent
//               → INDÉTERMINÉE (jamais un faux « pas d'earnings »).
//    P5 STAG    au jour 30 calendaire, P&L COURANT dans −20 %/+30 % → sortie.
//
//  Couleur : porte franchie = AMBRE ('critique'/'arme'). SEULE exception
//  ROUGE : P1 exécution −35 % (perte réelle constatée) → severity 'perte'.
// ═══════════════════════════════════════════════════════════════

import {
  SL_ALERTE_PCT,
  SL_EXECUTION_PCT,
  DTE_GATE_JOURS,
  JAUGES,
  P2_ACTIVATION_FRAC,
  P2_SORTIE_FACTEUR,
  P4_FENETRE_DEBUT_JOURS,
  P4_FENETRE_FIN_JOURS,
  STAGNATION_JOUR,
  STAGNATION_BANDE_BASSE_FRAC,
  STAGNATION_BANDE_HAUTE_FRAC,
} from '../config/registre';
import { tradingDaysUntil } from './tradingDays';

/** Severités du moteur. 'perte' = ROUGE (perte réelle) ; sinon AMBRE. */
export const GATE_SEV = Object.freeze({ PERTE: 'perte', CRITIQUE: 'critique', ARME: 'arme' });

const DTE_APPROACH = JAUGES.approcheDteJours; // 5 — fenêtre d'approche (registre app)

function pct0(x) {
  return `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))} %`;
}

function sig(code, topic, status, severity, metric, source, extra) {
  return { code, topic, status, severity, metric, source, ...(extra || {}) };
}

// ── P1 · STOP-LOSS (deux paliers, base mid d'entrée = unrealPct) ────────
function gateP1(row) {
  const src = 'portes.P1_sl';
  const p = row.unrealPct;
  if (!Number.isFinite(p) || p >= 0) return null;
  if (p <= SL_EXECUTION_PCT) {
    // −35 % franchi = perte RÉELLE constatée → ROUGE.
    return sig('P1', 'pnl', 'crossed', GATE_SEV.PERTE,
      `P&L ${pct0(p)} ≤ SL exéc −${Math.abs(SL_EXECUTION_PCT)} %`, src,
      { fill: 100 + (Math.abs(p) - Math.abs(SL_EXECUTION_PCT)), isRealLoss: true });
  }
  if (p <= SL_ALERTE_PCT) {
    // −30 % : alerte AVANT le stop → AMBRE (pas encore une perte constatée).
    return sig('P1', 'pnl', 'armed', GATE_SEV.CRITIQUE,
      `P&L ${pct0(p)} ≤ alerte −${Math.abs(SL_ALERTE_PCT)} %`, src,
      { fill: ((Math.abs(p) - Math.abs(SL_ALERTE_PCT)) /
          (Math.abs(SL_EXECUTION_PCT) - Math.abs(SL_ALERTE_PCT))) * 100 });
  }
  return null;
}

// ── P2 · TRAILING (pic de clôture, aucun plancher) ──────────────────────
function gateP2(row) {
  const src = 'portes.P2_trail';
  const picPct = row.picPct; // fraction, (pic − mid entrée) / mid entrée
  if (!Number.isFinite(picPct)) return null; // pas de pic enregistré → pas d'armement
  if (picPct < P2_ACTIVATION_FRAC) return null; // pic < +50 % → non armé
  const sortieFrac = picPct * P2_SORTIE_FACTEUR; // pic_pct × 0.60
  const sortiePctPts = sortieFrac * 100;
  const caveat = row.isPartial ? ' · pic partiel' : '';
  const cur = row.unrealPct;
  if (Number.isFinite(cur) && cur <= sortiePctPts) {
    // Le mark courant est retombé au seuil de sortie → sortie.
    return sig('P2', 'trail', 'crossed', GATE_SEV.CRITIQUE,
      `TRAIL sortie ${pct0(sortiePctPts)} (pic ${pct0(picPct * 100)})${caveat}`, src,
      { fill: 100, isPartial: !!row.isPartial });
  }
  // Armé, seuil de sortie affiché (informationnel).
  return sig('P2', 'trail', 'armed', GATE_SEV.ARME,
    `TRAIL armé pic ${pct0(picPct * 100)} → sortie ${pct0(sortiePctPts)}${caveat}`, src,
    { fill: 60, isPartial: !!row.isPartial });
}

// ── P3 · DTE (inconditionnel) ───────────────────────────────────────────
function gateP3(row) {
  const src = 'portes.P3_dte';
  const dte = row.dte;
  if (!Number.isFinite(dte)) return null;
  if (dte <= DTE_GATE_JOURS) {
    return sig('P3', 'dte', 'crossed', GATE_SEV.CRITIQUE,
      `DTE ${dte} j ≤ gate ${DTE_GATE_JOURS}`, src,
      { fill: 100 + (DTE_GATE_JOURS - dte) });
  }
  if (dte <= DTE_GATE_JOURS + DTE_APPROACH) {
    return sig('P3', 'dte', 'armed', GATE_SEV.ARME,
      `DTE ${dte} j → gate ${DTE_GATE_JOURS}`, src,
      { fill: ((DTE_GATE_JOURS + DTE_APPROACH - dte) / DTE_APPROACH) * 100 });
  }
  return null;
}

// ── P4 · EARNINGS (conditionnelle, se tait quand ça va mal) ─────────────
function gateP4(row, ctx) {
  const src = 'portes.P4_earnings';
  const e = row.earningsDate;
  if (e === 'AUCUN') return null; // sous-jacent sans résultats → porte inapplicable
  if (e == null) {
    // Champ absent → INDÉTERMINÉE (jamais un faux « pas d'earnings »).
    return sig('P4', 'earn', 'indeterminate', null,
      'Earnings indéterminés — date de résultats non renseignée', src);
  }
  const today = ctx?.today;
  if (!today) {
    return sig('P4', 'earn', 'indeterminate', null,
      'Earnings indéterminés — date du jour absente', src);
  }
  const n = tradingDaysUntil(today, e); // jours de bourse jusqu'aux résultats
  if (n == null || n < P4_FENETRE_FIN_JOURS || n > P4_FENETRE_DEBUT_JOURS) return null; // hors J−7..J−5
  // Dans la fenêtre : la porte ne se déclenche QUE si le P&L est positif.
  if (Number.isFinite(row.unrealPct) && row.unrealPct > 0) {
    return sig('P4', 'earn', 'crossed', GATE_SEV.CRITIQUE,
      `EARN J−${n} · P&L ${pct0(row.unrealPct)} > 0 → sortie`, src, { fill: 100 });
  }
  // P&L ≤ 0 → on TIENT à travers, la porte SE TAIT.
  return sig('P4', 'earn', 'hold', null,
    `EARN J−${n} · P&L ≤ 0 → on tient à travers`, src);
}

// ── P5 · STAGNATION (jour 30, P&L courant dans la bande) ────────────────
function gateP5(row) {
  const src = 'portes.P5_stagnation';
  const days = row.daysHeld;
  if (!Number.isFinite(days) || days < STAGNATION_JOUR) return null;
  const p = row.unrealPct;
  if (!Number.isFinite(p)) return null;
  const frac = p / 100;
  if (frac >= STAGNATION_BANDE_BASSE_FRAC && frac <= STAGNATION_BANDE_HAUTE_FRAC) {
    return sig('P5', 'stag', 'crossed', GATE_SEV.CRITIQUE,
      `STAG ${days} j · P&L ${pct0(p)} dans bande ${Math.round(STAGNATION_BANDE_BASSE_FRAC * 100)}/+${Math.round(STAGNATION_BANDE_HAUTE_FRAC * 100)} %`,
      src, { fill: 100 });
  }
  return null;
}

/**
 * Évalue les 5 portes pour une row de position enrichie. Renvoie tous les
 * descripteurs non-nuls (y compris 'indeterminate'/'hold' sans severity,
 * conservés pour l'honnêteté et les tests). Ne bloque jamais, ne throw jamais.
 *
 * @param {Object} row  { dte, unrealPct, daysHeld, earningsDate, picPct, isPartial, … }
 * @param {Object} [ctx] { today: 'YYYY-MM-DD' }  — pour la fenêtre P4
 * @returns {Array<Object>}
 */
export function evaluateGates(row, ctx = {}) {
  if (!row) return [];
  return [gateP1(row), gateP2(row), gateP3(row), gateP4(row, ctx), gateP5(row)].filter(Boolean);
}

/** Sous-ensemble affichable dans la bande : signaux porteurs d'une severity. */
export function bandSignals(descriptors) {
  return (descriptors || []).filter((d) => d.severity);
}

// ═══════════════════════════════════════════════════════════════
//  gateDistances — état + DISTANCE de CHAQUE porte, TOUJOURS (1.G-b).
//
//  Complément de evaluateGates (qui ne rend QUE les portes qui SONNENT,
//  pour la bande). Le BLOC PORTES du deck a besoin des 5 portes en
//  permanence, avec leur distance au seuil. AUCUN seuil n'est recalculé
//  hors registre — le deck RENDRA ceci, il ne recompute rien (règle
//  absolue 1.G-b). Renvoie un objet { P1, P2, P3, P4, P5 }.
// ═══════════════════════════════════════════════════════════════
export function gateDistances(row, ctx = {}) {
  const p = row?.unrealPct;
  const today = ctx?.today ?? null;
  const hasP = Number.isFinite(p);

  // P1 SL — P&L % + distance (points de %) jusqu'à −30 (alerte) et −35
  // (exécution). distance > 0 = marge restante ; ≤ 0 = seuil franchi.
  const P1 = {
    pnlPct: hasP ? p : null,
    toAlerte: hasP ? p - SL_ALERTE_PCT : null,
    toExecution: hasP ? p - SL_EXECUTION_PCT : null,
    isRealLoss: hasP && p <= SL_EXECUTION_PCT,
    state: !hasP ? 'na' : p <= SL_EXECUTION_PCT ? 'execution' : p <= SL_ALERTE_PCT ? 'alerte' : 'ok',
  };

  // P2 TRAIL — armée quand pic ≥ +50 % ; seuil de sortie = pic × 0,60.
  const pic = row?.picPct; // fraction
  const P2 = Number.isFinite(pic)
    ? {
        picPct: pic * 100,
        isArmed: pic >= P2_ACTIVATION_FRAC,
        sortiePct: pic * P2_SORTIE_FACTEUR * 100,
        isPartial: !!row?.isPartial,
        state:
          pic < P2_ACTIVATION_FRAC
            ? 'inactive'
            : hasP && p <= pic * P2_SORTIE_FACTEUR * 100
              ? 'crossed'
              : 'armed',
      }
    : { picPct: null, isArmed: false, sortiePct: null, isPartial: !!row?.isPartial, state: 'no-peak' };

  // P3 DTE — jours restants + jours avant la gate 45 (inconditionnel).
  const dte = row?.dte;
  const P3 = Number.isFinite(dte)
    ? {
        dte,
        joursAvant: dte - DTE_GATE_JOURS,
        state: dte <= DTE_GATE_JOURS ? 'crossed' : dte <= DTE_GATE_JOURS + DTE_APPROACH ? 'armed' : 'ok',
      }
    : { dte: null, joursAvant: null, state: 'na' };

  // P4 EARNINGS — jours de bourse avant l'entrée de fenêtre J−7 ; condition
  // pnl>0. earningsDate absent / 'AUCUN' → INDÉTERMINÉE (jamais un faux
  // « pas d'earnings »).
  const e = row?.earningsDate;
  let P4;
  if (e == null || e === 'AUCUN' || !today) {
    P4 = { state: 'indeterminee', joursAvantFenetre: null, joursAvantResultats: null, condition: null };
  } else {
    const n = tradingDaysUntil(today, e);
    if (n == null) {
      P4 = { state: 'indeterminee', joursAvantFenetre: null, joursAvantResultats: null, condition: null };
    } else {
      const inWindow = n >= P4_FENETRE_FIN_JOURS && n <= P4_FENETRE_DEBUT_JOURS;
      P4 = {
        state: inWindow ? 'active' : n > P4_FENETRE_DEBUT_JOURS ? 'approche' : 'passee',
        joursAvantFenetre: n - P4_FENETRE_DEBUT_JOURS,
        joursAvantResultats: n,
        condition: hasP ? (p > 0 ? 'sortie' : 'hold') : null,
      };
    }
  }

  // P5 STAGNATION — jours avant J+30 ; grisée si P&L courant hors bande −20/+30.
  const days = row?.daysHeld;
  const frac = hasP ? p / 100 : null;
  const inBand = frac != null && frac >= STAGNATION_BANDE_BASSE_FRAC && frac <= STAGNATION_BANDE_HAUTE_FRAC;
  const P5 = Number.isFinite(days)
    ? {
        daysHeld: days,
        joursAvant: STAGNATION_JOUR - days,
        inBand,
        state: days < STAGNATION_JOUR ? 'ok' : inBand ? 'crossed' : 'hors-bande',
      }
    : { daysHeld: null, joursAvant: null, inBand: false, state: 'na' };

  return { P1, P2, P3, P4, P5 };
}

/**
 * Proximité normalisée [0,1] de CHAQUE porte à son seuil (1 = atteint/
 * franchi), fenêtres d'approche dérivées du registre — pas de seuil magique.
 * Renvoie { P1, P2, P3, P4, P5 } ; une porte non évaluable / exclue vaut null.
 * Sert les BARRES du bloc PORTES (une par porte) et le classement « proche ».
 */
export function porteProximities(d) {
  if (!d) return { P1: null, P2: null, P3: null, P4: null, P5: null };
  // P1 — sur la course 0 → −30 (fenêtre = |alerte| pts) ; ≥ −30 → 1.
  const P1 =
    d.P1.state !== 'na' && Number.isFinite(d.P1.toAlerte)
      ? d.P1.toAlerte <= 0
        ? 1
        : Math.max(0, 1 - d.P1.toAlerte / Math.abs(SL_ALERTE_PCT))
      : null;
  // P2 — retombée au seuil de sortie = 1 ; armé (informatif) = P2_SORTIE_FACTEUR.
  const P2 = d.P2.state === 'crossed' ? 1 : d.P2.state === 'armed' ? P2_SORTIE_FACTEUR : null;
  // P3 — fenêtre d'approche = DTE_APPROACH j au-dessus de la gate 45.
  const P3 =
    d.P3.state !== 'na' && Number.isFinite(d.P3.joursAvant)
      ? d.P3.joursAvant <= 0
        ? 1
        : Math.max(0, 1 - d.P3.joursAvant / DTE_APPROACH)
      : null;
  // P4 — fenêtre active = 1 ; approche sur P4_FENETRE_DEBUT_JOURS jours de bourse.
  const P4 =
    d.P4.state === 'active'
      ? 1
      : d.P4.state === 'approche' && Number.isFinite(d.P4.joursAvantFenetre)
        ? Math.max(0, 1 - d.P4.joursAvantFenetre / P4_FENETRE_DEBUT_JOURS)
        : null;
  // P5 — course sur STAGNATION_JOUR (grisée hors bande → exclue du classement).
  const P5 =
    d.P5.state === 'crossed'
      ? 1
      : d.P5.state === 'ok' && Number.isFinite(d.P5.joursAvant)
        ? Math.max(0, 1 - d.P5.joursAvant / STAGNATION_JOUR)
        : null;
  return { P1, P2, P3, P4, P5 };
}

/**
 * PORTE LA PLUS PROCHE d'une position (argmax de porteProximities) : la
 * phrase à lire en 2 s. Renvoie { code, prox } ou null (toutes loin/nulles).
 */
export function nearestPorte(d) {
  const prox = porteProximities(d);
  const cand = Object.entries(prox)
    .filter(([, v]) => Number.isFinite(v))
    .map(([code, v]) => ({ code, prox: v }));
  if (cand.length === 0) return null;
  cand.sort((a, b) => b.prox - a.prox);
  return cand[0];
}
