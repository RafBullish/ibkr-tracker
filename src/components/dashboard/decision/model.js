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
// Q-C — la bande consomme le MOTEUR UNIQUE de portes (utils/gates), seule
// source des 5 portes P1..P5. TOUS les seuils y sont lus du registre. Les
// seuils SL/DTE et les TP fixes (40/50/80, morts en V3) ne vivent plus ici.
import { evaluateGates, bandSignals, GATE_SEV } from '../../../utils/gates';

// Sévérités de la bande. 'perte' (3) = ROUGE, réservé au SEUL P1 exécution
// −35 % (perte réelle constatée) ; tout le reste (portes franchies/armées)
// = AMBRE ('critique' 2 / 'arme' 1).
export const SEV = { PERTE: 3, CRITIQUE: 2, ARME: 1 };

const SEV_OF = {
  [GATE_SEV.PERTE]: SEV.PERTE,
  [GATE_SEV.CRITIQUE]: SEV.CRITIQUE,
  [GATE_SEV.ARME]: SEV.ARME,
};
const sevName = (s) => (s >= SEV.PERTE ? 'perte' : s === SEV.CRITIQUE ? 'critique' : 'arme');

const nf = (v) => (Number.isFinite(v) ? v : null);

// Signaux de la bande dérivés d'une row de position enrichie, via le moteur
// UNIQUE. Chaque descripteur affichable (severity non nulle) devient un
// signal { topic, severity, fill, metric, doctrine, isRealLoss }. `today`
// (jour de séance NY) alimente la fenêtre P4.
function gateSignals(row, today) {
  return bandSignals(evaluateGates(row, { today })).map((d) => ({
    topic: d.topic,
    severity: SEV_OF[d.severity] ?? SEV.ARME,
    fill: Number.isFinite(d.fill) ? d.fill : 0,
    metric: d.metric,
    doctrine: true,
    isRealLoss: !!d.isRealLoss,
  }));
}

const urgencyOf = (s) => s.severity * 1000 + s.fill;
// Signal AFFICHÉ d'un sujet : sévérité d'abord, puis vocabulaire
// doctrine, puis proximité. (L'urgence de TRI reste le max brut.)
const displayRank = (s) => s.severity * 10000 + (s.doctrine ? 5000 : 0) + s.fill;

/**
 * Dérive les lignes de la zone ATTENTION.
 *
 * @param {Object} ctx
 * @param {Array}  ctx.gateRows  rows de positions enrichies (dte, unrealPct,
 *                               daysHeld, earningsDate, picPct, isPartial, …)
 * @param {string} ctx.today     jour de séance NY 'YYYY-MM-DD' (fenêtre P4)
 * @param {number} ctx.watchedCount  positions option surveillées
 * @param {Object} ctx.kill      { triggered, dailyPnlUsd, maxLoss }
 * @param {number} ctx.maxLines  lignes affichées avant « +N »
 */
export function deriveAttention({ gateRows = [], today = null, watchedCount = 0, kill = null, maxLines = 5 }) {
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

  // Moteur UNIQUE : plus de fusion avec generateAlerts (legacy retiré).
  for (const row of gateRows) for (const sig of gateSignals(row, today)) push(row.id, row.ticker, sig);

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
        severity: sevName(top.display.severity),
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
  // Q-C — CAP 70 % RETIRÉ : le « plafond notionnel » 70 % est le plafond
  // d'investi total du régime A de la V1 (doctrine MORTE), et il CONTREDIT
  // le plafond de 60 % PAR POSITION (S1). La V3 n'a AUCUN plafond d'exposition
  // TOTALE (seul S1 par position, marqué au niveau violation Q-B) — afficher
  // un cap sur une jauge d'exposition totale inventerait une doctrine. La
  // jauge montre donc le déploiement sans marqueur de plafond.
  return {
    deployed: nf(deployed),
    deployedPct: deployed != null && nlv > 0 ? (deployed / nlv) * 100 : null,
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
