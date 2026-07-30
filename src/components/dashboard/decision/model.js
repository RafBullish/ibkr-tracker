// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (brique 1.F) — MODÈLE PUR. Dérivations testables,
//  zéro hook, zéro Date.now() : tout arrive en paramètre.
//
//  ATTENTION — fusion des DEUX moteurs existants, sans recalcul :
//    · generateAlerts (utils/alerts, moteur canonique U7) filtré
//      red/orange — les 6 types actionnables (DTE_CRITICAL, STOP_LOSS,
//      TIME_STOP, DTE_WARNING, TP2_REACHED, TP1_REACHED) ;
//    · useSniperGates.rows — les 3 gates RÉELLEMENT câblés (SL35,
//      DTE45, TP) ; les placeholders (EARN-J2, EARN+J30, TR) sont
//      IGNORÉS (données non servies = rien à l'écran) ;
//    · kill switch quotidien (useDailyKillSwitch.triggered).
//
//  Une LIGNE par position : le signal le plus urgent gagne (dédup par
//  sujet DTE / P&L / TP / TIME, puis max inter-sujets). Urgence =
//  sévérité (critique > armé) puis proximité/dépassement du seuil
//  (fill) — « à égalité, proximité du seuil ».
//
//  Proximité « armé » avant franchissement : convention statusFromFill
//  du hook useSniperGates (70 % du chemin vers le seuil) pour le SL
//  P&L (−24.5 %), et fenêtre J+5 pour le gate DTE45 (« DTE 46 → gate
//  45 »). Aucune donnée inventée : tout dérive de pctChg / dte réels.
//
//  Loi de couleur : la sévérité est portée par l'AMBRE (badge/hairline,
//  signal décisionnel sanctionné DA §3), jamais par un rouge/vert P&L.
// ═══════════════════════════════════════════════════════════════

import { MIN_DECISIVE_WINRATE } from '../../../utils/significance';

// ── Seuils réels des moteurs (miroirs, pas des re-calculs) ──────────
const SL_PCT = 35; // stop-loss P&L (generateAlerts STOP_LOSS)
const SL_APPROACH_FRAC = 0.7; // convention statusFromFill (≥70 % du chemin)
const DTE_CRITICAL_D = 90; // generateAlerts DTE_CRITICAL
const DTE_WARNING_MAX = 100; // generateAlerts DTE_WARNING (90..100)
const GATE_SL35 = 35; // useSniperGates SL35 (DTE)
const GATE_DTE45 = 45; // useSniperGates DTE45
const GATE_DTE45_APPROACH = 5; // fenêtre « DTE 46 → gate 45 » (J+5)
const TP_SHORT_PCT = 50; // useSniperGates TP (short premium)
const TP1_PCT = 40;
const TP2_PCT = 80;

export const SEV = { CRITIQUE: 2, ARME: 1 };

const nf = (v) => (Number.isFinite(v) ? v : null);
const pct0 = (v) => `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v))} %`;

// Un signal candidat : { topic, severity, fill, metric }
function alertToSignal(a) {
  const v = a.value;
  switch (a.type) {
    case 'STOP_LOSS':
      return { topic: 'pnl', severity: SEV.CRITIQUE, fill: 100 + (Math.abs(v) - SL_PCT), metric: `P&L ${pct0(v)} ≤ SL −${SL_PCT} %` };
    case 'TIME_STOP':
      return { topic: 'time', severity: SEV.CRITIQUE, fill: 100 + (v - 5), metric: `${v} j sans +15 %` };
    case 'DTE_CRITICAL':
      return { topic: 'dte', severity: SEV.CRITIQUE, fill: 100 + (DTE_CRITICAL_D - v), metric: `DTE ${v} j ≤ ${DTE_CRITICAL_D} j` };
    case 'DTE_WARNING':
      return { topic: 'dte', severity: SEV.ARME, fill: ((DTE_WARNING_MAX - v) / (DTE_WARNING_MAX - DTE_CRITICAL_D)) * 100, metric: `DTE ${v} j → seuil ${DTE_CRITICAL_D} j` };
    case 'TP2_REACHED':
      return { topic: 'tp', severity: SEV.ARME, fill: 100 + (v - TP2_PCT), metric: `${pct0(v)} ≥ TP ${TP2_PCT} %` };
    case 'TP1_REACHED':
      return { topic: 'tp', severity: SEV.ARME, fill: (v / TP2_PCT) * 100, metric: `${pct0(v)} ≥ TP ${TP1_PCT} %` };
    default:
      return null;
  }
}

// Signaux dérivés d'une row useSniperGates (3 gates câblés uniquement).
function gateSignals(row) {
  const out = [];
  const { dte, unrealPct, dir } = row;
  if (Number.isFinite(dte)) {
    if (dte <= GATE_SL35) {
      out.push({ topic: 'dte', severity: SEV.CRITIQUE, fill: 100 + (GATE_SL35 - dte), metric: `DTE ${dte} j ≤ gate ${GATE_SL35}` });
    } else if (dte <= GATE_DTE45) {
      out.push({ topic: 'dte', severity: SEV.ARME, fill: 100 + (GATE_DTE45 - dte), metric: `DTE ${dte} j ≤ gate ${GATE_DTE45}` });
    } else if (dte <= GATE_DTE45 + GATE_DTE45_APPROACH) {
      out.push({ topic: 'dte', severity: SEV.ARME, fill: ((GATE_DTE45 + GATE_DTE45_APPROACH - dte) / GATE_DTE45_APPROACH) * 100 - 1, metric: `DTE ${dte} j → gate ${GATE_DTE45}` });
    }
  }
  if (Number.isFinite(unrealPct) && unrealPct < 0) {
    const captured = Math.abs(unrealPct);
    // Proximité SL (avant franchissement — le franchissement vit dans
    // STOP_LOSS du moteur canonique).
    if (captured < SL_PCT && captured >= SL_PCT * SL_APPROACH_FRAC) {
      out.push({ topic: 'pnl', severity: SEV.ARME, fill: (captured / SL_PCT) * 100, metric: `P&L ${pct0(unrealPct)} / SL −${SL_PCT} %` });
    }
  }
  if (dir === 'Short' && Number.isFinite(unrealPct) && unrealPct >= TP_SHORT_PCT) {
    out.push({ topic: 'tp', severity: SEV.ARME, fill: 100 + (unrealPct - TP_SHORT_PCT), metric: `${pct0(unrealPct)} ≥ TP ${TP_SHORT_PCT} %` });
  }
  return out;
}

const urgencyOf = (s) => s.severity * 1000 + s.fill;

/**
 * Dérive les lignes de la zone ATTENTION.
 *
 * @param {Object} ctx
 * @param {Array}  ctx.alerts    generateAlerts filtré red/orange
 *                               ({positionId, ticker, type, severity, value})
 * @param {Array}  ctx.gateRows  useSniperGates().rows
 * @param {number} ctx.watchedCount  positions option surveillées
 * @param {Object} ctx.kill      { triggered, dailyPnlUsd, maxLoss }
 * @param {number} ctx.maxLines  lignes affichées avant « +N »
 */
export function deriveAttention({ alerts = [], gateRows = [], watchedCount = 0, kill = null, maxLines = 5 }) {
  const byPos = new Map(); // id → { id, ticker, sub, topics: Map(topic → signal) }
  const rowById = new Map(gateRows.map((r) => [r.id, r]));

  const push = (id, ticker, sig) => {
    if (!sig || id == null) return;
    let entry = byPos.get(id);
    if (!entry) {
      const row = rowById.get(id);
      const sub = row && row.type !== '—'
        ? `${row.type}${Number.isFinite(row.strike) && row.strike > 0 ? ` $${Math.round(row.strike)}` : ''}`
        : null;
      entry = { id, ticker: ticker || row?.ticker || '—', sub, topics: new Map() };
      byPos.set(id, entry);
    }
    const cur = entry.topics.get(sig.topic);
    if (!cur || urgencyOf(sig) > urgencyOf(cur)) entry.topics.set(sig.topic, sig);
  };

  for (const a of alerts) push(a.positionId, a.ticker, alertToSignal(a));
  for (const row of gateRows) for (const sig of gateSignals(row)) push(row.id, row.ticker, sig);

  const lines = [...byPos.values()]
    .map((e) => {
      const sigs = [...e.topics.values()].sort((a, b) => urgencyOf(b) - urgencyOf(a));
      const top = sigs[0];
      return {
        id: e.id,
        ticker: e.ticker,
        sub: e.sub,
        severity: top.severity === SEV.CRITIQUE ? 'critique' : 'arme',
        metric: top.metric,
        others: sigs.length - 1,
        urgency: urgencyOf(top),
      };
    })
    .sort((a, b) => b.urgency - a.urgency);

  const shown = lines.slice(0, maxLines);

  return {
    kill: kill?.triggered
      ? { dailyPnlUsd: nf(kill.dailyPnlUsd), maxLoss: nf(kill.maxLoss) }
      : null,
    lines,
    shown,
    moreCount: lines.length - shown.length,
    watchedCount,
    empty: lines.length === 0 && !kill?.triggered,
  };
}

/**
 * Dérive la zone FORME depuis le modèle Héros 2 (deriveRealized ALL) —
 * MÊMES chiffres que le deck Réalisé, zéro recalcul divergent.
 *
 * @param {Object} ctx
 * @param {Array}  ctx.perTrade       m.perTrade (hero2/model, tri chrono ↑)
 * @param {Object} ctx.matrix         m.matrix (hero2/model)
 * @param {number} ctx.currentStreak  usePortfolioMetrics().currentStreak (+W / −L)
 * @param {number} ctx.mtd            usePortfolioMetrics().monthlyPnlUsd
 * @param {number} ctx.maxDots        pastilles affichées (18)
 */
export function deriveForme({ perTrade = [], matrix = null, currentStreak = null, mtd = null, maxDots = 18 }) {
  const dots = perTrade.slice(-maxDots).map((t) => ({
    pnl: t.pnl,
    date: t.date,
    tk: t.tk,
    tone: t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'flat',
  }));
  const decisive = matrix ? matrix.wins + matrix.losses : 0;
  return {
    dots,
    total: perTrade.length,
    streak:
      !Number.isFinite(currentStreak) || currentStreak === 0
        ? null
        : { count: Math.abs(currentStreak), kind: currentStreak > 0 ? 'V' : 'D' },
    mtd: nf(mtd),
    // Expectancy = CELLE de Héros 2 (matrix.expectancy), affichée
    // honnêtement : « — » sous 10 trades décisifs (MIN_DECISIVE_WINRATE).
    expectancy: matrix && matrix.n && decisive >= MIN_DECISIVE_WINRATE ? matrix.expectancy : null,
    decisive,
    n: matrix ? matrix.n : 0,
  };
}

/**
 * Dérive la zone CAPITAL — mêmes formules que hero1/model.deriveKpisReal
 * (miroir strict : DÉPLOYÉ = metrics.totalExposure, DISPONIBLE =
 * resolveLiveAvailableUsd sinon estimation, RISK $ = totalSlDollar).
 */
export function deriveCapital({ metrics, greeks, availableUsd, availableIsReal, riskDollar, tier }) {
  const nlv = metrics?.netLiquidationValueUsd ?? null;
  const deployed = metrics?.totalExposure ?? null;
  return {
    deployed: nf(deployed),
    deployedPct: deployed != null && nlv > 0 ? (deployed / nlv) * 100 : null,
    capPct: tier?.notionalMaxPct ?? 70,
    available: availableUsd ?? null,
    availableIsReal: availableIsReal === true && availableUsd != null,
    availablePct: availableUsd != null && nlv > 0 ? (availableUsd / nlv) * 100 : null,
    riskDollar: nf(riskDollar),
    riskPct: riskDollar != null && nlv > 0 ? (riskDollar / nlv) * 100 : null,
    deltaShares: nf(greeks?.sumDelta),
    deltaDollar: nf(greeks?.notionalDelta),
    thetaDay: nf(greeks?.thetaDaily),
    tierLabel: tier?.label ?? null,
  };
}
