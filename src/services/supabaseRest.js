// ═══════════════════════════════════════════════════════════════
//  Lecteur Supabase PostgREST — fetch stdlib, ZÉRO dépendance (D1).
//
//  Le Realtime exigeait une lib ; l'amorce et le sondage n'en ont jamais
//  eu besoin. On lit les 4 tables du pipeline vivant par un simple GET
//  PostgREST avec la clé ANONYME (publique par conception, protégée par la
//  RLS lecture-seule posée en Phase A). La service_role ne vit QUE dans le
//  bridge ; elle n'apparaît nulle part côté client.
//
//  Dégradation gracieuse : sans VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,
//  fetchLatest renvoie null → l'app tourne sur l'estimateur « est. » avec
//  son âge, exactement le repli voulu (D3, pas de chemin dormant).
// ═══════════════════════════════════════════════════════════════

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(URL && ANON);

/**
 * GET PostgREST des dernières lignes d'une table.
 * @param {string} table
 * @param {Object} q  { select, order, limit, filters:{col:'eq.val'} }
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array|null>} lignes, ou null si non configuré.
 */
export async function fetchLatest(table, q = {}, signal) {
  if (!supabaseConfigured) return null;
  const { select = '*', order, limit = 1, filters } = q;
  const params = new URLSearchParams();
  params.set('select', select);
  if (order) params.set('order', order);
  if (limit != null) params.set('limit', String(limit));
  if (filters) for (const [k, v] of Object.entries(filters)) params.set(k, v);

  const res = await fetch(`${URL.replace(/\/$/, '')}/rest/v1/${table}?${params}`, {
    method: 'GET',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Lecture paginée ASC par curseur — une séance entière dépasse le plafond
 * PostgREST (~1 000 lignes) : on avance par pages sur tsCol jusqu'à la
 * page incomplète. Sert l'amorce de séance ET l'incrémental (sinceIso =
 * dernier point connu, inclusive=false).
 * @returns {Promise<Array|null>} lignes asc, ou null si non configuré.
 */
export async function fetchAllSince(
  table,
  { select = '*', tsCol = 'captured_at', sinceIso, inclusive = false, filters, pageSize = 1000, maxPages = 6 } = {},
  signal
) {
  if (!supabaseConfigured) return null;
  const out = [];
  let cursor = sinceIso;
  let op = inclusive ? 'gte' : 'gt';
  for (let page = 0; page < maxPages; page += 1) {
    const rows = await fetchLatest(
      table,
      {
        select,
        order: `${tsCol}.asc`,
        limit: pageSize,
        filters: { ...(filters || {}), [tsCol]: `${op}.${cursor}` },
      },
      signal
    );
    if (!rows || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
    cursor = rows[rows.length - 1][tsCol];
    op = 'gt';
  }
  return out;
}
