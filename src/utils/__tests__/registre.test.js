import { describe, it, expect } from 'vitest';
import * as R from '../../config/registre';
import { effectiveSlDollar } from '../risk';
import { detectExitReason } from '../trades/detectExitReason';
import {
  MIN_DECISIVE_WINRATE,
  MIN_LOSSES_PF,
  MIN_TRADES_ANNUALIZED,
  MIN_YEARS_ANNUALIZED,
  MIN_OBS_RATIO,
  MIN_CAPITAL_REF_USD,
} from '../significance';

// ═══════════════════════════════════════════════════════════════
//  Q-A — LE REGISTRE : preuve de la source unique.
//
//  Deux garanties :
//   (1) PARITÉ à valeur identique là où la valeur SURVIT en V3 (SL -35,
//       DTE 45, jour de stagnation 30, + valeurs d'app) — mêmes valeurs,
//       mêmes sorties, avant et après la migration.
//   (2) CHANGEMENT documenté là où la valeur change (bande de stagnation)
//       ou est exposée sans consommateur (P2 trail, P4 earnings, θ, sizing).
//  Le témoin `npm run check:doctrine` prouve, lui, l'ABSENCE de littéral
//  normatif en dur hors du registre.
// ═══════════════════════════════════════════════════════════════

describe('registre Q-A — chargement & rôle', () => {
  it('parametres.json v3.0.0 chargé, remplace 2.0.1', () => {
    expect(R.REGISTRE.version).toBe('3.0.0');
    expect(R.REGISTRE.remplace).toContain('2.0.1');
  });
  it('app = enregistreur de vol, blocage dur OFF, Check-10 non bloquant', () => {
    expect(R.APP_DOCTRINE.role).toBe('enregistreur_de_vol');
    expect(R.APP_DOCTRINE.blocage_dur).toBe(false);
    expect(R.APP_DOCTRINE.check_10_bloquant).toBe(false);
  });
});

describe('registre Q-A — PARITÉ doctrine (valeurs identiques)', () => {
  it('SL exécution : -0.35 / -35 / 0.35 / 35 (P1_sl.execution_pct)', () => {
    expect(R.SL_EXECUTION_FRAC).toBe(-0.35);
    expect(R.SL_EXECUTION_PCT).toBe(-35);
    expect(R.SL_EXECUTION_MAGNITUDE).toBe(0.35);
    expect(R.SL_EXECUTION_MAGNITUDE_PCT).toBe(35);
  });
  it('gate DTE : 45 (P3_dte.jours)', () => expect(R.DTE_GATE_JOURS).toBe(45));
  it('jour de stagnation : 30 (P5_stagnation.jour)', () => expect(R.STAGNATION_JOUR).toBe(30));

  it('effectiveSlDollar inchangé : coût d’entrée × 0.35', () => {
    // Long, pi 4 × ct 2 × mul 100 = 800 de coût ; risque = 800 × 0.35 = 280.
    const pos = { dir: 'Long', pi: '4.00', ct: '2', mu: '100', as: 'Option' };
    expect(effectiveSlDollar(pos)).toBeCloseTo(280, 6);
  });

  it('detectExitReason inchangé : frontière SL à -35 % exactement', () => {
    const at = (pnl) => detectExitReason({ pi: '4', ct: '1', mu: '100', pnl }).reason;
    expect(at(-140)).toBe('sl_35'); // -35.0 % → déclenche
    expect(at(-139)).not.toBe('sl_35'); // -34.75 % → juste au-dessus, pas SL
    expect(at(200)).toBe('tp_50'); // +50 % → tp_50 (LEGACY conservé pour l’historique)
  });
});

describe('registre Q-A — PARITÉ ergonomie (parametres.app.json)', () => {
  it('affichage portefeuille : 30 / 70 (parametres.app.json)', () => {
    // É4-b — l'assertion via tierParams est retirée (module tier mort) ;
    // le fait 30/70 vit dans PORTFOLIO_AFFICHAGE (source unique).
    expect(R.PORTFOLIO_AFFICHAGE.cashFloorPct).toBe(30);
    expect(R.PORTFOLIO_AFFICHAGE.notionalMaxPct).toBe(70);
  });
  it('significativité inchangée : 10 / 3 / 20 / 0.25 / 30 / 500', () => {
    expect(MIN_DECISIVE_WINRATE).toBe(10);
    expect(MIN_LOSSES_PF).toBe(3);
    expect(MIN_TRADES_ANNUALIZED).toBe(20);
    expect(MIN_YEARS_ANNUALIZED).toBe(0.25);
    expect(MIN_OBS_RATIO).toBe(30);
    expect(MIN_CAPITAL_REF_USD).toBe(500);
  });
  it('jauges inchangées : escalade 95/70/30, baseline 60, approches 0.7 / 5', () => {
    expect(R.JAUGES.escalade).toEqual({ armed: 95, imminent: 70, normal: 30 });
    expect(R.JAUGES.safeBufferDte).toBe(60);
    expect(R.JAUGES.approcheSlFrac).toBe(0.7);
    expect(R.JAUGES.approcheDteJours).toBe(5);
  });
});

describe('registre Q-A — EXPOSÉ pour Q-C (lecture seule, aucun site code)', () => {
  it('P2 trailing : activation 0.50, part rendue 0.40', () => {
    expect(R.P2_TRAIL.activation_pic_pct).toBe(0.5);
    expect(R.P2_TRAIL.part_du_gain_rendue).toBe(0.4);
  });
  it('P4 earnings : fenêtre J-7 à J-5, jours de bourse', () => {
    expect(R.P4_EARNINGS.fenetre_debut_jours).toBe(7);
    expect(R.P4_EARNINGS.fenetre_fin_jours).toBe(5);
    expect(R.P4_EARNINGS.unite).toBe('jours_de_bourse');
  });
  it('θ d’entrée 0.008, sizing S1 0.60, G5 (5 / 72 h), alerte SL -30', () => {
    expect(R.THETA_MAX_PCT_PRIME_JOUR).toBe(0.008);
    expect(R.SIZING.S1_pct_max_par_position).toBe(0.6);
    expect(R.GARDE_FOUS.G5_serie_pertes.seuil).toBe(5);
    expect(R.GARDE_FOUS.G5_serie_pertes.pause_heures).toBe(72);
    expect(R.SL_ALERTE_PCT).toBe(-30);
  });
});

describe('registre Q-A — CHANGEMENT documenté (réconcilié en Q-C)', () => {
  it('bande de stagnation : registre P5 = -20 / +30 (le code porte encore ±10)', () => {
    // La valeur du registre EST -20 / +30 ; detectExitReason applique encore
    // ±10 (ancienne V1). C’est un ÉCART DE VALEUR assumé — Q-C branchera
    // detectExitReason sur ces bandes. Q-A ne recâble pas la logique.
    expect(R.STAGNATION_BANDE_BASSE_PCT).toBe(-20);
    expect(R.STAGNATION_BANDE_HAUTE_PCT).toBe(30);
  });
});
