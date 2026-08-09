// ═══════════════════════════════════════════════════════════════
//  DATASET ID — identité stable d'un relevé Flex importé. PUR.
//
//  Un « dataset » = un compte + une période de relevé + le contenu
//  exact du CSV. L'id sert de suffixe d'isolation pour TOUTES les clés
//  d'historique NLV (qc:nlvCsv:, qc:nlvDaily:, qc:nlvIntraday:) :
//  changer de CSV = basculer sur l'historique de CE dataset, dans les
//  deux sens, sans mélange possible (le compte de test et le compte
//  réel partagent le même ClientAccountID — la période + le hash
//  discriminent).
//
//  Format : `{ClientAccountID}:{FromDate}-{ToDate}:{hash8hex}`
//  ex.      U23437309:20250808-20260807:a1b2c3d4
// ═══════════════════════════════════════════════════════════════

export const DATASET_UNKNOWN_ACCOUNT = 'compte-inconnu';
export const DATASET_UNKNOWN_PERIOD = 'periode-inconnue';

/**
 * Hash FNV-1a 32 bits du texte CSV brut → 8 hex. Stable : le même
 * fichier redonne toujours le même hash (ré-import = même dataset).
 */
export function hashCsvContent(text) {
  let h = 0x811c9dc5;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Assemble l'identifiant de dataset. Les dates acceptent 'YYYY-MM-DD'
 * ou 'YYYYMMDD' (normalisées sans tirets dans l'id).
 */
export function buildDatasetId({ accountId, fromDate, toDate, hash }) {
  const acct = (accountId || '').trim() || DATASET_UNKNOWN_ACCOUNT;
  const norm = (d) => String(d || '').replace(/-/g, '');
  const from = norm(fromDate);
  const to = norm(toDate);
  const period = from && to ? `${from}-${to}` : DATASET_UNKNOWN_PERIOD;
  return `${acct}:${period}:${hash}`;
}
