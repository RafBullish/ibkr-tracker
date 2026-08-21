// ═══════════════════════════════════════════════════════════════
//  liveFeed — store ÉPHÉMÈRE du flux Supabase (hors accounting store).
//
//  Doctrine qc:* : les données de flux (télémétrie live) ne touchent
//  JAMAIS les clés comptables ibkr_u_*. Ce petit store Zustand porte le
//  flux tick-à-tick (série NLV, marks bridge, FX, fraîcheur) ; il n'est ni
//  persisté ni migré — il se reconstitue au prochain sondage. Vidé au
//  RESET_ALL (honnêteté : démo → reset → rien, comme É4-b).
//
//  Le compte (NLV/cash/marge/dispo) va, lui, dans settings.ibkrLiveData
//  (action SET_IBKR_LIVE), car ses consommateurs (LIQUIDITÉ DISPO, badge
//  NLV) l'y lisent déjà — un seul canal, pas de doublon de vérité.
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';

const EMPTY = {
  nlvSeries: [], // [{ t: epochMs, nlv }] ordre croissant — courbe 1D + P&L jour
  marks: {}, // { [signature]: { pic, source:'bridge', markAt } } — pic bridge
  fx: null, // { pair, mid, capturedAt }
  lastCapturedAt: null, // ms — le captured_at le plus récent, toutes tables (âge)
  ok: false, // dernier sondage réussi ? (un échec fait basculer la pastille)
};

export const useLiveFeed = create((set) => ({
  ...EMPTY,
  /** Fusion partielle du flux (le sondeur pousse ce qu'il a lu). */
  setFeed: (patch) => set((s) => ({ ...s, ...patch })),
  /** Un sondage a échoué : on garde la donnée, mais ok=false → pastille non verte. */
  markStale: () => set({ ok: false }),
  /** RESET_ALL : le flux s'efface aussi (pas de fantôme démo). */
  clear: () => set({ ...EMPTY }),
}));

// Sélecteurs granulaires (jamais s'abonner au store entier).
export const useLiveNlvSeries = () => useLiveFeed((s) => s.nlvSeries);
export const useLiveMarks = () => useLiveFeed((s) => s.marks);
export const useLiveFx = () => useLiveFeed((s) => s.fx);
// Deux sélecteurs primitifs composés : un sélecteur qui fabriquerait un objet
// neuf à chaque getSnapshot ferait boucler useSyncExternalStore (Zustand v5).
export const useLiveFreshness = () => {
  const lastCapturedAt = useLiveFeed((s) => s.lastCapturedAt);
  const ok = useLiveFeed((s) => s.ok);
  return { lastCapturedAt, ok };
};
