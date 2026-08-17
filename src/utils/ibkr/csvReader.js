// ═══════════════════════════════════════════════════════════════
//  CSV tokenizer + date helpers for IBKR Flex Query files.
//
//  The tokenizer is RFC-4180-ish: quotes toggle mode, `""` escapes a
//  literal quote inside a quoted field, and quoted fields may span
//  multiple physical lines (IBKR occasionally emits embedded newlines
//  in free-text descriptions).
// ═══════════════════════════════════════════════════════════════

/**
 * Tokenize a full CSV blob into rows.
 * @param {string} text
 * @returns {string[][]} rows × fields, trimmed.
 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r') {
        // swallow — \n below handles the row break
      } else if (ch === '\n') {
        row.push(field.trim());
        field = '';
        if (row.some((f) => f !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some((f) => f !== '')) rows.push(row);
  }
  return rows;
}

/** Convert YYYYMMDD (or any string containing 8+ consecutive digits) to YYYY-MM-DD. */
export function isoDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return '';
  const s = String(yyyymmdd).replace(/[^0-9]/g, '');
  if (s.length < 8) return '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Convert IBKR DateTime "YYYYMMDD;HHMMSS" to YYYY-MM-DD. */
export function isoDateFromDateTime(dt) {
  if (!dt) return '';
  return isoDate(dt.split(';')[0]);
}

/**
 * Décalage (ms) d'un fuseau à un instant donné : formate l'instant dans
 * le fuseau, ré-assemble en UTC, diffère. Gère le DST (Intl fait foi).
 */
function tzOffsetMs(instantMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map = {};
  for (const p of dtf.formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // certains ICU rendent 24 pour minuit
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - instantMs;
}

/**
 * Interprète un IBKR Flex DateTime "YYYYMMDD;HHMMSS" (heure de l'ÉCHANGE,
 * défaut US = America/New_York) comme heure-mur locale du fuseau de
 * l'échange, et renvoie l'INSTANT ABSOLU en ISO-8601 UTC. DST correct
 * (le décalage ET↔UTC est lu par Intl à la date exacte, jamais figé). Un
 * consommateur (règle E5) le reformate ensuite en Europe/Zurich.
 * Ex. « 20260817;094200 » (09:42 ET, EDT) → « 2026-08-17T13:42:00.000Z ».
 */
export function instantFromExchangeDateTime(dt, timeZone = 'America/New_York') {
  if (!dt) return '';
  const digits = String(dt).replace(/[^0-9]/g, ''); // YYYYMMDDHHMMSS
  if (digits.length < 8) return '';
  const y = Number(digits.slice(0, 4));
  const mo = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  const h = Number(digits.slice(8, 10) || '0');
  const mi = Number(digits.slice(10, 12) || '0');
  const s = Number(digits.slice(12, 14) || '0');
  // Heure-mur lue comme si UTC, corrigée du décalage du fuseau à cet instant.
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, s);
  const instantMs = asUTC - tzOffsetMs(asUTC, timeZone);
  if (!Number.isFinite(instantMs)) return '';
  return new Date(instantMs).toISOString();
}

/** Safe float parse — returns 0 for NaN. */
export function sf(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}
