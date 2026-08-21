// ═══════════════════════════════════════════════════════════════
//  Âge d'un flux, en clair + ton de fraîcheur — briquette PARTAGÉE.
//
//  Extraite de MarketDeck (1.G-c, FxCell) pour que la pastille d'âge du
//  flux NLV (cockpit + StatusBar, Phase B) parle EXACTEMENT le même
//  langage — « il y a N s ». Une seule maison, jamais deux copies qui
//  divergeraient.
//
//  Loi de couleur (pré-vol Héros 1 LIVE, 21.08 — harmonisation) : le
//  ROUGE signale une perte d'argent, JAMAIS une péremption. Seuils :
//  vert < 60 s, ambre ≥ 60 s ; au-delà de 5 min c'est le LIBELLÉ qui
//  change (« FLUX PÉRIMÉ · il y a N min »), la couleur reste ambre.
//  Hors séance (pré→post terminée), l'absence de tick est normale :
//  « MARCHÉ FERMÉ · dernier tick HH:MM », neutre — ni ambre ni rouge.
//  L'ex-ton « stale » (rouge en séance) est MORT.
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
 *   'live' (vert)   — < 60 s, en séance
 *   'est'  (ambre)  — ≥ 60 s, en séance (y compris ≥ 5 min : le LIBELLÉ
 *                     change, la couleur reste ambre — jamais rouge)
 *   'idle' (neutre) — hors séance (absence de tick normale)
 *   null            — aucun point (pastille masquée)
 * `marketOpen` = « en séance » au sens du flux : pré-market → post-market
 * (le bridge collecte sur les trois phases), pas seulement la RTH.
 */
export function nlvAgeTone(ageMs, { marketOpen = true } = {}) {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return null;
  if (!marketOpen) return 'idle';
  if (ageMs < NLV_AGE.LIVE_MS) return 'live';
  return 'est';
}

const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * État complet du flux NLV — la maison UNIQUE du libellé + ton, partagée
 * par la pastille StatusBar et le badge du Héros 1 (seul porteur d'état).
 *   kind 'live'   → tone 'live',  label « il y a N s »        (badge : LIVE)
 *   kind 'age'    → tone 'est',   label « il y a N s/min »
 *   kind 'stale'  → tone 'est',   label « FLUX PÉRIMÉ · il y a N min »
 *   kind 'closed' → tone 'idle',  label « MARCHÉ FERMÉ · dernier tick HH:MM »
 *   null          → aucun point (rien à afficher)
 */
export function nlvFluxBadge(ageMs, { marketOpen = true, lastCapturedAt = null } = {}) {
  const tone = nlvAgeTone(ageMs, { marketOpen });
  if (!tone) return null;
  if (tone === 'idle') {
    const tick = Number.isFinite(lastCapturedAt) ? ` · dernier tick ${hhmm(lastCapturedAt)}` : '';
    return { tone, kind: 'closed', label: `MARCHÉ FERMÉ${tick}` };
  }
  if (tone === 'live') return { tone, kind: 'live', label: formatAge(ageMs) };
  if (ageMs >= NLV_AGE.EST_MS) return { tone, kind: 'stale', label: `FLUX PÉRIMÉ · ${formatAge(ageMs)}` };
  return { tone, kind: 'age', label: formatAge(ageMs) };
}
