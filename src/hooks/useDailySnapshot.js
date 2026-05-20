// ═══════════════════════════════════════════════════════════════
//  useDailySnapshot — sparkline-ready slice of settings.dailySnapshots
//
//  Lit settings.dailySnapshots, trie par date ascendante, slice les
//  `days` derniers points, retourne un array {date, value} prêt à
//  être passé à <Sparkline data={…} />.
//
//  Architecture du système de snapshots (Phase B, 4K refonte) :
//
//    1. Le store maintient `settings.dailySnapshots` : un array de
//       60 lignes max, chaque ligne = { date, nlv, availCapital,
//       unrealized, exposure, openPositionsCount, realized,
//       winRate, profitFactor }.
//    2. Le reducer expose `UPDATE_DAILY_SNAPSHOT` (idempotent par
//       date — overwrite si la date existe, FIFO 60 sinon).
//    3. Le Dashboard dispatche un snapshot du jour au mount et à
//       chaque changement de métriques clés ; le reducer no-op si
//       les valeurs sont identiques à celles déjà persistées.
//    4. Les hooks-consommateurs (KPI cards) appellent
//       `useDailySnapshot('availCapital', 30)` pour récupérer la
//       série temporelle d'une métrique donnée.
//
//  Démarrage : array vide au début. Les sparklines basés sur le
//  snapshot rendront une ligne pointillée (cf. Sparkline.jsx flat
//  fallback) tant que < 2 points existent. Pas de back-fill, pas
//  de mock — c'est l'usage qui crée l'historique.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useSettings } from '../store/useStore';

/**
 * @param {string} metric - clé du snapshot (e.g. 'nlv', 'availCapital', 'exposure')
 * @param {number} days   - nombre de derniers jours à retourner (défaut 30)
 * @returns {Array<{date: string, value: number}>}
 */
export default function useDailySnapshot(metric, days = 30) {
  const settings = useSettings();
  return useMemo(() => {
    const list = Array.isArray(settings?.dailySnapshots) ? settings.dailySnapshots : [];
    if (list.length === 0) return [];
    const sorted = list.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const sliced = sorted.slice(-Math.max(1, days));
    return sliced
      .map((s) => ({ date: s.date, value: s?.[metric] }))
      .filter((p) => Number.isFinite(p.value));
  }, [settings, metric, days]);
}
