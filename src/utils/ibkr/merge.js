// ═══════════════════════════════════════════════════════════════
//  Merge parsed IBKR data into the current tracker state.
//
//  Strategy: key each entity with a deterministic signature and drop
//  rows whose signature already exists in currentState. Metadata with
//  a leading underscore (internal IBKR identifiers) is stripped before
//  persisting so we don't leak it back to the user on subsequent loads.
//
//  A3a — closedTrades are rebuilt here with `currentState.openPositions`
//  as the historical opens pool, so a close in the current CSV can match
//  an open imported in a prior CSV. parseIbkrCsv produces `parsed
//  .closedTrades` with intra-CSV opens only (back-compat) ; mergeIbkrData
//  overrides it with the inter-CSV-aware version.
// ═══════════════════════════════════════════════════════════════

import { buildClosedTrades } from './closedTrades';
// Q-B — signature de dédup = signature unique partagée (positions.js), la
// même que le sidecar de métadonnées : une annotation saisie survit au
// ré-import parce que la clé est stable (indépendante de l'id régénéré).
import { positionSignature } from '../positions';

function closedTradeKey(t) {
  return `${t.tk}|${t.ty}|${t.st}|${t.ex}|${t.do || ''}|${t.ct}`;
}

function cashFlowKey(cf) {
  return `${cf.da}|${cf.ty}|${cf.a1}`;
}

/**
 * Lignes IGNORÉES par le parser, avec le MOTIF — plus de skip muet.
 * Dérivé des compteurs déjà collectés (parsed.stats) : classes d'actif
 * hors OPT/STK, niveaux de détail repliés, trades non-ordre.
 */
function buildIgnored(parsed) {
  const out = [];
  const ps = parsed?.stats?.positionsSkipped;
  if (ps) {
    if (ps.byAssetClass?.CASH) {
      out.push({ reason: 'Positions cash (hors OPT/STK) ignorées', count: ps.byAssetClass.CASH });
    }
    if (ps.byAssetClass?.OTHER) {
      out.push({ reason: 'Positions d’une classe d’actif non gérée', count: ps.byAssetClass.OTHER });
    }
    if (ps.byLevel?.LOT) {
      out.push({ reason: 'Lignes lot-level repliées dans le résumé', count: ps.byLevel.LOT });
    }
    if (ps.byLevel?.OTHER) {
      out.push({ reason: 'Lignes de position d’un niveau non géré', count: ps.byLevel.OTHER });
    }
  }
  if (parsed?.stats?.tradesSkipped) {
    out.push({ reason: 'Lignes de trade non-ordre / FX / hors OPT-STK', count: parsed.stats.tradesSkipped });
  }
  return out;
}

/**
 * @param {Object} parsed        sortie de parseIbkrCsv
 * @param {Object} currentState  état courant (openPositions, closedTrades, …)
 * @param {Object} [opts]
 * @param {Object} [opts.metaBySignature]  carte { [signature]: { earningsDate,
 *   entryNote } } du sidecar — ré-hydrate les positions NOUVELLEMENT créées
 *   dont la signature portait déjà une métadonnée saisie (survie au ré-import
 *   même après suppression). Passée par l'appelant pour garder merge pur.
 */
export function mergeIbkrData(parsed, currentState, opts = {}) {
  const metaBySig = opts.metaBySignature || null;
  const stats = {
    positionsAdded: 0,
    positionsSkipped: 0,
    closedTradesAdded: 0,
    closedTradesSkipped: 0,
    cashFlowsAdded: 0,
    cashFlowsSkipped: 0,
    fxRateUpdated: false,
  };

  // ── Open positions ──
  const existingPosKeys = new Set(currentState.openPositions.map(positionSignature));
  const newPositions = [];
  for (const pos of parsed.positions) {
    if (existingPosKeys.has(positionSignature(pos))) {
      // Signature déjà présente : la position EXISTANTE du magasin est
      // conservée telle quelle (donc ses earningsDate/entryNote saisis
      // survivent). Reporté comme doublon, jamais écrasé.
      stats.positionsSkipped++;
    } else {
      const clean = { ...pos };
      delete clean._ibkrConid;
      delete clean._ibkrSymbol;
      delete clean._ibkrUnrealized;
      // Ré-hydratation des métadonnées saisies depuis le sidecar (signature).
      // Le Flex ne portant AUCUNE de ces données, on ne compare pas au clean
      // (toujours absent) : on recopie ce que le sidecar porte. C'est le cœur
      // de « capture le soir → import des jours plus tard → réhydratation ».
      if (metaBySig) {
        const meta = metaBySig[positionSignature(clean)];
        if (meta) {
          if (clean.earningsDate == null && meta.earningsDate != null) {
            clean.earningsDate = meta.earningsDate;
          }
          if (clean.entryNote == null && meta.entryNote != null) {
            clean.entryNote = meta.entryNote;
          }
          // Données d'ENTRÉE (micro-brique capture) — E2/E4 les lisent sur pos.
          for (const k of ['midAtEntry', 'bidAtEntry', 'askAtEntry', 'thetaAtEntryPerDay', 'deltaAtEntry']) {
            if (clean[k] == null && meta[k] != null) clean[k] = meta[k];
          }
        }
      }
      newPositions.push(clean);
      stats.positionsAdded++;
    }
  }

  // ── Cash flows ──
  const existingCfKeys = new Set(currentState.cashFlows.map(cashFlowKey));
  const newCashFlows = [];
  for (const cf of parsed.cashFlows) {
    if (existingCfKeys.has(cashFlowKey(cf))) {
      stats.cashFlowsSkipped++;
    } else {
      const clean = { ...cf };
      delete clean._ibkrTransactionId;
      newCashFlows.push(clean);
      stats.cashFlowsAdded++;
    }
  }

  // ── Closed trades ──
  // A3a — rebuild closedTrades with inter-CSV FIFO matching. The current
  // CSV's raw trades (parsed.trades) are paired with the union of
  // intra-CSV opens AND historical opens from currentState.openPositions.
  // This rescues closes that previously fell into the CostBasis fallback
  // because their matching open lived in a prior import.
  const rebuiltClosedTrades = Array.isArray(parsed.trades)
    ? buildClosedTrades(parsed.trades, currentState.openPositions)
    : parsed.closedTrades || [];
  const fifoStats = rebuiltClosedTrades.reduce(
    (acc, ct) => {
      if (ct._fifoFallbackReason) acc.fallback++;
      else acc.matched++;
      return acc;
    },
    { matched: 0, fallback: 0 }
  );
  stats.fifoMatched = fifoStats.matched;
  stats.fifoFallback = fifoStats.fallback;

  const existingTradeKeys = new Set(currentState.closedTrades.map(closedTradeKey));
  const newClosedTrades = [];
  for (const ct of rebuiltClosedTrades) {
    if (existingTradeKeys.has(closedTradeKey(ct))) {
      stats.closedTradesSkipped++;
    } else {
      // Strip the diagnostic field before persisting — it's a transient
      // marker for the import-time decision, not a long-lived attribute.
      const clean = { ...ct };
      delete clean._fifoFallbackReason;
      newClosedTrades.push(clean);
      stats.closedTradesAdded++;
    }
  }

  // ── FX rate: use the latest from parsed data ──
  const fxDates = Object.keys(parsed.fxRates).sort();
  let newLiveRate = null;
  if (fxDates.length > 0) {
    newLiveRate = parsed.fxRates[fxDates[fxDates.length - 1]];
    stats.fxRateUpdated = true;
  }

  // ── Cash report: store endingCash in settings ──
  const cashReportSettings = parsed.cashReport?.endingCash ? { cashReport: parsed.cashReport } : {};

  // ── Rapport d'import (Q-B) — zéro skip muet, zéro fusion muette ──────
  // Compteurs véridiques + motifs des lignes ignorées. `createdPositions`
  // sert au calcul des violations côté Import.jsx (il a le capital de réf).
  // NB : l'import ne MOYENNE pas (il dédupe par signature) — le moyennage
  // de lots est le chemin manuel ADD_POSITION ; lotsMerged reste 0 ici.
  const report = {
    linesRead: parsed?.stats?.totalLines ?? 0,
    sectionsFound: parsed?.stats?.sectionsFound ?? [],
    positions: { created: stats.positionsAdded, duplicatesSkipped: stats.positionsSkipped },
    closedTrades: {
      created: stats.closedTradesAdded,
      duplicatesSkipped: stats.closedTradesSkipped,
      fifoMatched: stats.fifoMatched ?? 0,
      fifoFallback: stats.fifoFallback ?? 0,
    },
    cashFlows: { created: stats.cashFlowsAdded, duplicatesSkipped: stats.cashFlowsSkipped },
    lotsMerged: 0,
    ignored: buildIgnored(parsed),
    errors: parsed?.errors ?? [],
    createdPositions: newPositions,
  };

  return {
    mergedData: {
      openPositions: [...currentState.openPositions, ...newPositions],
      closedTrades: [...currentState.closedTrades, ...newClosedTrades],
      cashFlows: [...currentState.cashFlows, ...newCashFlows],
      journalEntries: currentState.journalEntries,
      settings: {
        ...(newLiveRate ? { liveRate: newLiveRate } : {}),
        ...cashReportSettings,
      },
    },
    stats,
    report,
  };
}
