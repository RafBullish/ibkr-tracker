// Sniper sidecar — per-position trader metadata (Edge Tier / Capital
// Tier / β-SPY) persisted at `qc:sniperMeta:{positionId}` rather than
// on the trade shape, so no schema migration is needed. Readers return
// null silently on absence or malformed JSON, never throw.

const KEY_PREFIX = 'qc:sniperMeta:';

export const EDGE_KEYS = ['E0', 'E1', 'E2', 'E3', 'E4'];
export const CAPITAL_KEYS = ['C1', 'C2', 'C3', 'C4', 'C5'];

const VALID_EDGE = new Set(EDGE_KEYS);
const VALID_CAP = new Set(CAPITAL_KEYS);

function isBrowser() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const edgeTier = VALID_EDGE.has(raw.edgeTier) ? raw.edgeTier : null;
  const capitalTier = VALID_CAP.has(raw.capitalTier) ? raw.capitalTier : null;
  const betaSPY =
    typeof raw.betaSPY === 'number' && Number.isFinite(raw.betaSPY) ? raw.betaSPY : null;
  const taggedAt = typeof raw.taggedAt === 'string' ? raw.taggedAt : null;
  // Don't return an object full of nulls — that's no signal.
  if (edgeTier == null && capitalTier == null && betaSPY == null) return null;
  return { edgeTier, capitalTier, betaSPY, taggedAt };
}

/**
 * Read the sniper meta sidecar for a position. Returns null when the
 * key is absent, the JSON is malformed, or every field is null.
 */
export function readSniperMeta(positionId) {
  if (!positionId) return null;
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + positionId);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Write a sniper meta sidecar entry. Merges with the existing record
 * (so partial tags don't clobber unrelated fields). Returns the final
 * record or null when localStorage is unavailable.
 */
export function writeSniperMeta(positionId, patch) {
  if (!positionId) return null;
  if (!isBrowser()) return null;
  if (!patch || typeof patch !== 'object') return null;

  const current = readSniperMeta(positionId) || {};
  const next = sanitize({
    edgeTier: 'edgeTier' in patch ? patch.edgeTier : current.edgeTier,
    capitalTier: 'capitalTier' in patch ? patch.capitalTier : current.capitalTier,
    betaSPY: 'betaSPY' in patch ? patch.betaSPY : current.betaSPY,
    taggedAt: new Date().toISOString(),
  });

  try {
    if (next == null) {
      window.localStorage.removeItem(KEY_PREFIX + positionId);
    } else {
      window.localStorage.setItem(KEY_PREFIX + positionId, JSON.stringify(next));
    }
    return next;
  } catch {
    return null;
  }
}

/**
 * Remove the sidecar entry for a position. No-op when absent.
 */
export function removeSniperMeta(positionId) {
  if (!positionId) return;
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + positionId);
  } catch {
    /* quota / disabled — silent */
  }
}

/**
 * Read every sniper meta entry as a map { [positionId]: meta }. Used
 * by future bulk views (Sprint 7 attribution heatmap, Sprint 2 tagger).
 */
export function readAllSniperMeta() {
  if (!isBrowser()) return {};
  const out = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const positionId = key.slice(KEY_PREFIX.length);
      const meta = readSniperMeta(positionId);
      if (meta) out[positionId] = meta;
    }
  } catch {
    /* ignore */
  }
  return out;
}

export const SNIPER_META_KEY_PREFIX = KEY_PREFIX;
