// ═══════════════════════════════════════════════════════════════
//  Âge d'un flux, en clair + ton de fraîcheur — briquette PARTAGÉE.
//
//  Extraite de MarketDeck (1.G-c, FxCell) pour que la pastille d'âge du
//  flux NLV (cockpit + StatusBar, Phase B) parle EXACTEMENT le même
//  langage — « il y a N s ». Une seule maison, jamais deux copies qui
//  divergeraient.
//
//  Loi de couleur : la fraîcheur n'est NI une perte NI un gain. Le rouge
//  est réservé au flux réellement en retard PENDANT une séance ouverte ;
//  marché fermé, l'absence de tick est normale → jamais rouge (neutre).
// ═══════════════════════════════════════════════════════════════

import { NLV_AGE } from '../constants/timing';

/** « il y a N s | min | h | j ». null si l'âge est absent / invalide. */
export function formatAge(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return null;
  const s = Math.floor(ageMs / 1000);
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

/**
 * Ton de fraîcheur d'un flux NLV, pour la pastille d'âge.
 *   'live'  (vert)   — < 60 s
 *   'est'   (ambre)  — < 5 min
 *   'stale' (rouge)  — au-delà ET marché OUVERT (un vrai retard en séance)
 *   'idle'  (neutre) — au-delà ET marché FERMÉ (absence de tick normale)
 *   null             — aucun point (pastille masquée)
 */
export function nlvAgeTone(ageMs, { marketOpen = true } = {}) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return null;
  if (ageMs < NLV_AGE.LIVE_MS) return 'live';
  if (ageMs < NLV_AGE.EST_MS) return 'est';
  return marketOpen ? 'stale' : 'idle';
}
