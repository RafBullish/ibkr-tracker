// ═══════════════════════════════════════════════════════════════
//  liveFeed — store ÉPHÉMÈRE du flux Supabase (hors accounting store).
//
//  Doctrine qc:* : les données de flux (télémétrie live) ne touchent
//  JAMAIS les clés comptables ibkr_u_*. Ce petit store Zustand porte le
//  flux tick-à-tick (série NLV, série FX, marks bridge, fraîcheur) ; il
//  n'est ni persisté ni migré — il se reconstitue au prochain sondage.
//  Vidé au RESET_ALL (honnêteté : démo → reset → rien, comme É4-b).
//
//  RÈGLE DE DEVISE : les points NLV portent la valeur broker AVEC son
//  label (currency) — jamais une valeur convertie stockée. La conversion
//  CHF→USD se fait à l'affichage, par point, as-of sur fxSeries
//  (utils/liveNlvSeries).
//
//  Le compte (NLV/cash/marge/dispo) va, lui, dans settings.ibkrLiveData
//  (action SET_IBKR_LIVE), car ses consommateurs (LIQUIDITÉ DISPO, badge
//  NLV) l'y lisent déjà — un seul canal, pas de doublon de vérité.
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';

const EMPTY = {
  nlvSeries: [], // [{ t: epochMs, nlv, currency }] asc — séance courante ENTIÈRE
  fxSeries: [], // [{ t: epochMs, mid }] asc — ancre pré-séance + séance (as-of)
  marks: {}, // { [signature]: { pic, source:'bridge', markAt } } — pic bridge
  fx: null, // { pair, mid, capturedAt } — dernière ligne (swap producteur FX)
  sessionKey: null, // dayKey NY de la séance chargée (amorce vs incrémental)
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

// Sélecteurs granulaires (jamais s'abonner au store entier). CONTRAT :
// chaque sélecteur retourne une RÉFÉRENCE STABLE du state (primitive ou
// objet/array détenu par le store) — un sélecteur qui fabriquerait un
// objet neuf à chaque getSnapshot ferait boucler useSyncExternalStore
// (Zustand v5) : c'est le bug 5caf2ab, verrouillé par liveFeed.test.js.
export const useLiveNlvSeries = () => useLiveFeed((s) => s.nlvSeries);
export const useLiveFxSeries = () => useLiveFeed((s) => s.fxSeries);
export const useLiveMarks = () => useLiveFeed((s) => s.marks);
export const useLiveFx = () => useLiveFeed((s) => s.fx);

// Sélecteurs primitifs de la fraîcheur — exportés nommément pour que le
// test de non-régression prouve leur stabilité référentielle.
export const freshnessSelectors = {
  lastCapturedAt: (s) => s.lastCapturedAt,
  ok: (s) => s.ok,
};

// Deux sélecteurs primitifs composés : un sélecteur qui fabriquerait un objet
// neuf à chaque getSnapshot ferait boucler useSyncExternalStore (Zustand v5).
export const useLiveFreshness = () => {
  const lastCapturedAt = useLiveFeed(freshnessSelectors.lastCapturedAt);
  const ok = useLiveFeed(freshnessSelectors.ok);
  return { lastCapturedAt, ok };
};
