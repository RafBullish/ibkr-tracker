// ═══════════════════════════════════════════════════════════════
//  ALERTS FEED UTILS v4 brick 8 — purs
//
//  Helpers d'AFFICHAGE pour le module AlertsFeed (log stream
//  chronologique). Distinct de utils/alerts.js qui contient
//  l'engine Sniper (generateAlerts depuis positions). Ce fichier
//  ne fait QUE de la mise en forme (timestamp, classification
//  niveau pour pill colorée).
// ═══════════════════════════════════════════════════════════════

/**
 * Format ISO timestamp → 'HH:MM:SS' local (24 h).
 * Returns '—:—:—' si invalide.
 */
export function formatTimestamp(iso) {
  if (!iso) return '—:—:—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—:—:—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * 7 spec levels : ALERT / INFO / MARKET / EARN / FILL / ORDER / ERROR.
 * Chaque level → { code, label, tone }.
 */
const LEVEL_INFO = {
  ALERT: { code: 'ALERT', label: 'ALERT', tone: 'warn' },
  INFO: { code: 'INFO', label: 'INFO', tone: 'mute' },
  MARKET: { code: 'MARKET', label: 'MARKET', tone: 'mute' },
  EARN: { code: 'EARN', label: 'EARN', tone: 'info' },
  FILL: { code: 'FILL', label: 'FILL', tone: 'profit' },
  ORDER: { code: 'ORDER', label: 'ORDER', tone: 'mute' },
  ERROR: { code: 'ERROR', label: 'ERROR', tone: 'loss' },
};

/**
 * Mapping fixture brick 2.5 → spec.
 *   info → INFO, warn → ALERT, success → FILL, etc.
 */
const FIXTURE_LEVEL_MAP = {
  info: 'INFO',
  warn: 'ALERT',
  success: 'FILL',
  market: 'MARKET',
  earn: 'EARN',
  order: 'ORDER',
  error: 'ERROR',
  alert: 'ALERT',
  fill: 'FILL',
};

/**
 * Normalise un level (string libre) en LEVEL_INFO entry.
 * Default : INFO (mute) si inconnu.
 */
export function classifyLevel(level) {
  if (!level || typeof level !== 'string') return LEVEL_INFO.INFO;
  const upper = level.toUpperCase();
  if (LEVEL_INFO[upper]) return LEVEL_INFO[upper];
  const mapped = FIXTURE_LEVEL_MAP[level.toLowerCase()];
  if (mapped && LEVEL_INFO[mapped]) return LEVEL_INFO[mapped];
  return LEVEL_INFO.INFO;
}

export const ALERT_FEED_LEVELS = Object.freeze(Object.keys(LEVEL_INFO));
