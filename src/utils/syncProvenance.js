// ═══════════════════════════════════════════════════════════════
//  syncProvenance — É3.2 « zéro fantôme » : la ligne de synchro dit
//  EXACTEMENT la vérité de settings.lastSync (rc.4), cohérente avec le
//  badge de mode de la StatusBar. PUR, sans React.
//
//  Formes de lastSync :
//    · objet { date, source: 'flex'|'csv', file?, … } — écrit par
//      /settings/import (rc.4) ;
//    · string ISO — écrit par le bridge (reducer SYNC_IBKR) ;
//    · absent — aucune synchro connue → la ligne N'EXISTE PAS
//      (jamais de « —— », jamais de mention Flex par défaut).
//
//  Le QueryID Flex n'apparaît que masqué (****xxxx, 4 derniers) et
//  UNIQUEMENT quand la source est réellement Flex.
// ═══════════════════════════════════════════════════════════════

const fmtDate = (iso) => {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' });
};

/** Masque un QueryID : ****&lt;4 derniers&gt;. Null si vide/non-string. */
export function maskQueryId(queryId) {
  if (typeof queryId !== 'string') return null;
  const clean = queryId.trim();
  if (!clean) return null;
  return `****${clean.slice(-4)}`;
}

/**
 * Libellé de la ligne de synchro du cockpit — null = ligne MORTE.
 * @param {object|string|null|undefined} lastSync settings.lastSync
 * @param {string|null} [queryId] QueryID Flex (localStorage), non masqué
 * @returns {string|null}
 */
export function deriveSyncLabel(lastSync, queryId = null) {
  if (!lastSync) return null;

  // Bridge : le reducer SYNC_IBKR écrit un timestamp string.
  if (typeof lastSync === 'string') {
    const when = fmtDate(lastSync);
    return when ? `IBKR BRIDGE · ${when}` : null;
  }

  if (typeof lastSync !== 'object') return null;
  const when = fmtDate(lastSync.date);

  if (lastSync.source === 'csv') {
    const parts = ['IMPORT CSV'];
    if (lastSync.file) parts.push(lastSync.file);
    if (when) parts.push(when);
    return parts.join(' · ');
  }

  if (lastSync.source === 'flex') {
    const parts = ['IBKR FLEX'];
    const masked = maskQueryId(queryId);
    if (masked) parts.push(`Query ${masked}`);
    if (when) parts.push(when);
    return parts.join(' · ');
  }

  // Objet pré-rc.4 sans source : synchro Flex historique — on dit la
  // date sans inventer de provenance précise.
  return when ? `SYNCHRO · ${when}` : null;
}
