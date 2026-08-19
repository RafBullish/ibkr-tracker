// ═══════════════════════════════════════════════════════════════
//  useSniperGates — fournisseur de ROWS de positions ouvertes enrichies
//  (Brique Q-C : ne construit PLUS aucune porte).
//
//  Le moteur UNIQUE des 5 portes vit dans src/utils/gates.js, consommé par
//  la bande décision (decision/model.deriveAttention). Ce hook ne fait que
//  FOURNIR les données brutes dont ce moteur a besoin, une row par option
//  ouverte (actions exclues — les portes portent sur le premium long) :
//
//     { id, ticker, type, dir, strike,
//       dte,          // jours restants (moteur DTE unique dteFromExp)
//       daysHeld,     // jours calendaires depuis l'entrée (P5)
//       unrealPct,    // P&L % du mid d'entrée (P1, P5)
//       earningsDate, // tri-état date|'AUCUN'|null (P4, source Q-B)
//       picPct,       // pic (mid de clôture) en % de l'entrée (P2)
//       isPartial }   // pic incomplet → la porte TRAIL le dit à l'écran
//
//  AUCUNE logique de porte ici (l'ex-buildGates / SL35 / TP fixe, morts
//  depuis É3, sont retirés) : une porte ne vit qu'à UN seul endroit.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions } from '../store/useStore';
import {
  unrealizedPnlPct,
  dteFromExp,
  daysHeld,
  positionSignature,
} from '../utils/positions';
import { picPctOf } from '../utils/positionMarks';
import { usePositionMarksMap } from './usePositionMarks';

export default function useSniperGates(options = {}) {
  const positions = useOpenPositions();
  const marks = usePositionMarksMap();
  const ref = options.now;
  const positionsKey = (positions || []).map((p) => p.id).join('|');

  return useMemo(() => {
    if (!positions || positions.length === 0) return { rows: [], count: 0 };

    const rows = positions
      .filter((p) => p.as !== 'Action')
      .map((p) => {
        const rec = marks[positionSignature(p)] || null;
        const picPct = rec ? picPctOf(rec) : null;
        return {
          id: p.id,
          ticker: p.tk,
          type: p.ty || '—',
          dir: p.dir,
          strike: p.st || null,
          dte: dteFromExp(p.ex, ref),
          daysHeld: daysHeld(p.di, ref),
          unrealPct: unrealizedPnlPct(p),
          earningsDate: p.earningsDate ?? null,
          picPct: Number.isFinite(picPct) ? picPct : null,
          isPartial: rec ? !!rec.isPartial : false,
          // Source du pic ('session_close' client · 'bridge' V1.1). La porte P2
          // ne s'arme que sur le pic client tant que la devise n'est pas
          // confirmée (barrière dure, gates.gateP2). null = pas de pic.
          picSource: rec ? rec.source ?? 'session_close' : null,
        };
      });

    return { rows, count: rows.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey, ref, marks]);
}
