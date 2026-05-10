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

/** Safe float parse — returns 0 for NaN. */
export function sf(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}
