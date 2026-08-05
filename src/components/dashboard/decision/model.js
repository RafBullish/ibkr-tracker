// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (brique 1.F) — MODÈLE PUR. Dérivations testables,
//  zéro hook, zéro Date.now() : tout arrive en paramètre.
//
//  ATTENTION — fusion des DEUX moteurs existants, sans recalcul :
//    · generateAlerts (utils/alerts, moteur canonique U7) filtré
//      red/orange — signaux P&L (STOP_LOSS, TP2_REACHED,
//      TP1_REACHED). Les seuils DTE legacy 90/100 j (DTE_CRITICAL,
//      DTE_WARNING) sont RETIRÉS de la bande (correctif architecte
//      1.F-c1 C2) : ils armaient toute entrée Sniper dès sa naissance
//      (~45-60 DTE) → bruit permanent. Leur maison reste la colonne
//      DTE de LivePositions + la page Positions ; la position
//      réapparaît ici dès DTE ≤ 50. TIME_STOP (« ≥5 j sans +15 % »)
//      est RETIRÉ au même titre (É3 §4.2.2) : la doctrine Sniper ne
//      documente aucun seuil temporel intermédiaire (trades tenus
//      90-155 j au réel → 4/5 positions CRITICAL en permanence, un
//      signal permanent n'informe de rien). La donnée « jours tenus »
//      reste affichée (DAYS-IN LivePositions, DTE riche Positions,
//      détail de position) — zéro donnée perdue.
//    · useSniperGates.rows — règle DTE DOCTRINE de la bande :
//      CRITICAL quand la gate est franchie (DTE ≤ 45), ARMED dans la
//      fenêtre d'approche (45 < DTE ≤ 50), rien au-delà. Le palier
//      intermédiaire 35 disparaît de la bande (la doctrine dit sortir
//      à 45 — une fois la gate franchie, on agit). + TP short (gate
//      câblé) et proximité SL. Placeholders (EARN-J2, EARN+J30, TR)
//      IGNORÉS (données non servies = rien à l'écran).
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
const GATE_DTE45 = 45; // gate doctrine (useSniperGates DTE45)
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
    // DTE_CRITICAL / DTE_WARNING (seuils legacy 90/100 j du moteur U7) :
    // RETIRÉS de la bande (1.F-c1 C2) — le sujet DTE appartient à la
    // seule règle doctrine (gateSignals). Leur maison : colonne DTE de
    // LivePositions + page Positions.
    // TIME_STOP (« ≥5 j sans +15 % ») : RETIRÉ de la bande (É3
    // §4.2.2, même mécanisme que les DTE legacy) — seuil hérité non
    // doctrinal qui saturait ATTENTION. « Jours tenus » reste visible
    // dans les tables et le détail de position.
    case 'TP2_REACHED':
      return { topic: 'tp', severity: SEV.ARME, fill: 100 + (v - TP2_PCT), metric: `${pct0(v)} ≥ TP ${TP2_PCT} %` };
    case 'TP1_REACHED':
      return { topic: 'tp', severity: SEV.ARME, fill: (v / TP2_PCT) * 100, metric: `${pct0(v)} ≥ TP ${TP1_PCT} %` };
    default:
      return null;
  }
}

// Signaux dérivés d'une row useSniperGates (gates câblés uniquement).
// Règle DTE DOCTRINE de la bande (1.F-c1 C2) : CRITICAL dès la gate 45
// franchie (on agit — pas de second seuil), ARMED dans la fenêtre
// d'approche 45 < DTE ≤ 50, RIEN au-delà de 50 (une échéance lointaine
// n'est pas une décision). `doctrine: true` = vocabulaire Sniper v1.0
// (préféré à sévérité égale sur le même sujet).
function gateSignals(row) {
  const out = [];
  const { dte, unrealPct, dir } = row;
  if (Number.isFinite(dte)) {
    if (dte <= GATE_DTE45) {
      out.push({ topic: 'dte', severity: SEV.CRITIQUE, doctrine: true, fill: 100 + (GATE_DTE45 - dte), metric: `DTE ${dte} j ≤ gate ${GATE_DTE45}` });
    } else if (dte <= GATE_DTE45 + GATE_DTE45_APPROACH) {
      out.push({ topic: 'dte', severity: SEV.ARME, doctrine: true, fill: ((GATE_DTE45 + GATE_DTE45_APPROACH - dte) / GATE_DTE45_APPROACH) * 100, metric: `DTE ${dte} j → gate ${GATE_DTE45}` });
    }
  }
  if (Number.isFinite(unrealPct) && unrealPct < 0) {
    const captured = Math.abs(unrealPct);
    // Proximité SL (avant franchissement — le franchissement vit dans
    // STOP_LOSS du moteur canonique).
    if (captured < SL_PCT && captured >= SL_PCT * SL_APPROACH_FRAC) {
      out.push({ topic: 'pnl', severity: SEV.ARME, doctrine: true, fill: (captured / SL_PCT) * 100, metric: `P&L ${pct0(unrealPct)} / SL −${SL_PCT} %` });
    }
  }
  if (dir === 'Short' && Number.isFinite(unrealPct) && unrealPct >= TP_SHORT_PCT) {
    out.push({ topic: 'tp', severity: SEV.ARME, doctrine: true, fill: 100 + (unrealPct - TP_SHORT_PCT), metric: `${pct0(unrealPct)} ≥ TP ${TP_SHORT_PCT} %` });
  }
  return out;
}

const urgencyOf = (s) => s.severity * 1000 + s.fill;
// Signal AFFICHÉ d'un sujet : sévérité d'abord, puis vocabulaire
// doctrine, puis proximité. (L'urgence de TRI reste le max brut.)
const displayRank = (s) => s.severity * 10000 + (s.doctrine ? 5000 : 0) + s.fill;

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
  const byPos = new Map(); // id → { id, ticker, sub, topics: Map(topic → [signaux]) }
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
    const list = entry.topics.get(sig.topic);
    if (list) list.push(sig);
    else entry.topics.set(sig.topic, [sig]);
  };

  for (const a of alerts) push(a.positionId, a.ticker, alertToSignal(a));
  for (const row of gateRows) for (const sig of gateSignals(row)) push(row.id, row.ticker, sig);

  const lines = [...byPos.values()]
    .map((e) => {
      // Par sujet : signal affiché (sévérité > doctrine > proximité),
      // urgence du sujet = max brut de ses signaux.
      const topics = [...e.topics.values()].map((sigs) => {
        const display = sigs.slice().sort((a, b) => displayRank(b) - displayRank(a))[0];
        const urgency = Math.max(...sigs.map(urgencyOf));
        return { display, urgency };
      });
      topics.sort((a, b) => b.urgency - a.urgency);
      const top = topics[0];
      return {
        id: e.id,
        ticker: e.ticker,
        sub: e.sub,
        severity: top.display.severity === SEV.CRITIQUE ? 'critique' : 'arme',
        metric: top.display.metric,
        others: topics.length - 1,
        otherMetrics: topics.slice(1).map((t) => t.display.metric),
        urgency: top.urgency,
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
 * (miroir strict : EXPOSITION = metrics.totalExposure = Σ |valeur mark|
 * (É3 §4.2.7 — le libellé dit la vérité du calcul), DISPONIBLE =
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
