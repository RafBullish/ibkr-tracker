// ═══════════════════════════════════════════════════════════════
//  Flex Web Service API
//  Calls Vercel serverless proxy /api/flex/sync to fetch IBKR data
//
//  Storage split:
//    - queryId  → localStorage (not sensitive, auto-populated each session)
//    - token    → sessionStorage (cleared when tab closes, reduces XSS window)
//
//  Any XSS can still read sessionStorage from the same tab, but at least a
//  stolen token doesn't persist across restarts for the attacker's bot to pick
//  up later.
// ═══════════════════════════════════════════════════════════════

const QUERY_KEY = 'ibkr_flex_queryid';
const TOKEN_KEY = 'ibkr_flex_token';
// Legacy key retained for one-shot migration — older versions wrote both fields.
const LEGACY_KEY = 'ibkr_flex_config';

function migrateLegacyIfPresent() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg?.queryId && !localStorage.getItem(QUERY_KEY)) {
      localStorage.setItem(QUERY_KEY, cfg.queryId);
    }
    if (cfg?.token && !sessionStorage.getItem(TOKEN_KEY)) {
      sessionStorage.setItem(TOKEN_KEY, cfg.token);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* corrupted legacy blob — ignore */
  }
}
migrateLegacyIfPresent();

/** Save Flex token (session-scoped) + query ID (persistent). */
export function configureFlex(token, queryId) {
  if (queryId) localStorage.setItem(QUERY_KEY, queryId);
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  return Promise.resolve({ configured: true });
}

/** Check Flex configuration status. */
export function getFlexStatus() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const queryId = localStorage.getItem(QUERY_KEY);
  return Promise.resolve({ configured: !!(token && queryId) });
}

/** Get stored config — token only present if the tab was used this session. */
export function getFlexConfig() {
  return {
    token: sessionStorage.getItem(TOKEN_KEY) || '',
    queryId: localStorage.getItem(QUERY_KEY) || '',
  };
}

/**
 * Call Vercel proxy to fetch Flex CSV from IBKR.
 * Credentials travel in custom headers (not the body) so they don't end up
 * in any cached request payloads or proxy access logs that record bodies.
 * Returns the raw CSV string.
 */
export async function syncFlex(token, queryId) {
  const res = await fetch('/api/flex/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-IBKR-Flex-Token': token,
      'X-IBKR-Flex-Query-Id': queryId,
    },
    body: '{}',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.csv;
}

// ═════════════════════════════════════════════════════════════
//  DATA MAPPERS — Convert Flex XML data to store formats
// ═════════════════════════════════════════════════════════════

/**
 * Parse a Flex date (YYYYMMDD or YYYY-MM-DD or "YYYYMMDD;HHmmss") to YYYY-MM-DD
 */
function parseFlexDate(raw) {
  if (!raw) return '';
  const clean = raw.split(';')[0].replace(/-/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return raw;
}

/**
 * Group Flex trades into matched closed trades.
 * Flex reports individual executions — we need to pair opens with closes.
 *
 * Returns array of closedTrades in store format:
 * { tk, as, dir, ty, st, ex, ct, pi, po, fi, fo, di, do: dateOut, fxi, fxo, mu, _flexId }
 */
export function parseFlexTrades(rawTrades) {
  const closed = [];

  // Only process closed trades (openCloseIndicator = 'C' or 'C;O')
  // and also gather opening trades to compute entry price
  const opensByKey = {}; // key -> [{ price, qty, fee, date, fx }]
  const closesByKey = {}; // key -> [{ price, qty, fee, date, fx, tradeId }]

  for (const t of rawTrades) {
    const rawSymbol = t.symbol || '';
    const isOpt = t.assetCategory === 'OPT';
    // Use underlyingSymbol from Flex XML if available;
    // otherwise parse OCC symbol (e.g. "BAC 260618C00055000" → "BAC")
    const symbol = isOpt
      ? t.underlyingSymbol || rawSymbol.replace(/\s*\d{6}[CP]\d{8}$/, '').trim() || rawSymbol
      : rawSymbol;
    const key = isOpt ? `${symbol}_${t.putCall}_${t.strike}_${t.expiry}` : symbol;

    const entry = {
      price: Math.abs(parseFloat(t.tradePrice) || 0),
      qty: Math.abs(parseFloat(t.quantity) || 0),
      fee: Math.abs(parseFloat(t.ibCommission) || 0),
      date: parseFlexDate(t.dateTime),
      // Leave FX at 0 if Flex doesn't report one — the downstream calcs treat
      // 0 as "fall back to the current liveRate" rather than a stale 0.88.
      fx: parseFloat(t.fxRateToBase) || 0,
      tradeId: t.tradeId || '',
    };

    const oc = (t.openCloseIndicator || '').toUpperCase();
    if (oc.includes('C')) {
      if (!closesByKey[key]) closesByKey[key] = [];
      closesByKey[key].push(entry);
    }
    if (oc.includes('O') || oc === '') {
      if (!opensByKey[key]) opensByKey[key] = [];
      opensByKey[key].push(entry);
    }
  }

  // Match closes with opens (FIFO)
  for (const [key, closes] of Object.entries(closesByKey)) {
    const opens = opensByKey[key] || [];
    let openIdx = 0;

    for (const close of closes) {
      // Find the matching raw trade to get metadata
      const rawClose = rawTrades.find((t) => t.tradeId === close.tradeId) || {};
      const symbol = rawClose.symbol || key.split('_')[0];
      const isOpt = rawClose.assetCategory === 'OPT';
      const multiplier = parseInt(rawClose.multiplier) || (isOpt ? 100 : 1);

      // Best-effort entry price from opens
      let entryPrice = close.price;
      let entryFee = 0;
      let entryDate = close.date;
      let entryFx = close.fx;

      if (openIdx < opens.length) {
        const open = opens[openIdx];
        entryPrice = open.price;
        entryFee = open.fee;
        entryDate = open.date;
        entryFx = open.fx;
        openIdx++;
      }

      // Determine direction from buySell on the close
      const buySell = (rawClose.buySell || '').toUpperCase();
      // If closing is a SELL, original was a Long; if closing is BUY, original was Short
      const dir = buySell === 'SELL' ? 'Long' : 'Short';

      closed.push({
        tk: symbol,
        as: isOpt ? 'Option' : 'Action',
        dir,
        ty: isOpt ? (rawClose.putCall === 'C' ? 'CALL' : 'PUT') : '',
        st: rawClose.strike || '',
        ex: parseFlexDate(rawClose.expiry),
        ct: String(close.qty),
        pi: String(entryPrice),
        po: String(close.price),
        fi: String(entryFee),
        fo: String(close.fee),
        di: entryDate,
        do: close.date,
        fxi: String(entryFx),
        fxo: String(close.fx),
        mu: String(multiplier),
        _flexId: close.tradeId,
      });
    }
  }

  return closed;
}

/**
 * Parse Flex cash transactions to store cashFlow format:
 * { ty, a1, a2, da, _flexTxId }
 */
export function parseFlexCashTransactions(rawCash) {
  const flows = [];

  for (const tx of rawCash) {
    const amount = parseFloat(tx.amount) || 0;
    const currency = (tx.currency || '').toUpperCase();
    const type = (tx.type || '').toLowerCase();
    const date = parseFlexDate(tx.dateTime);
    const absAmount = Math.abs(amount);

    let flowType = '';

    if (type.includes('dividend') || type.includes('payment in lieu')) {
      flowType = 'div_usd';
    } else if (type.includes('commission') || type.includes('fee') || type.includes('other fees')) {
      flowType = 'fee_usd';
    } else if (type.includes('deposit') && !type.includes('interest')) {
      flowType = currency === 'CHF' ? 'dep_chf' : 'adj_usd';
    } else if (type.includes('withdrawal')) {
      flowType = currency === 'CHF' ? 'wit_chf' : 'adj_usd';
    } else if (type.includes('forex') || type.includes('fx')) {
      flowType = 'fx_buy_usd';
    } else if (type.includes('interest') || type.includes('credit') || type.includes('debit')) {
      // Interest, credits, debits → adjustments, not deposits/withdrawals
      flowType = currency === 'CHF' ? 'adj_chf' : 'adj_usd';
    } else {
      // Default: adjustments (never classify unknown items as deposits)
      flowType = currency === 'CHF' ? 'adj_chf' : 'adj_usd';
    }

    flows.push({
      ty: flowType,
      a1: String(absAmount),
      a2: '0',
      da: date,
      _flexTxId: tx.transactionId || `${date}_${type}_${amount}`,
    });
  }

  return flows;
}

/**
 * Deduplicate closedTrades — skip if _flexId already exists in store.
 * Also deduplicates within newTrades themselves.
 */
export function deduplicateClosedTrades(newTrades, existingTrades) {
  const seenIds = new Set();
  const seenSigs = new Set();
  for (const t of existingTrades) {
    if (t._flexId) seenIds.add(t._flexId);
    // Also match by key signature for trades added manually or via CSV
    seenSigs.add(`${t.tk}_${t.di}_${t.do}_${t.ct}_${t.pi}_${t.po}`);
  }

  return newTrades.filter((t) => {
    if (t._flexId && seenIds.has(t._flexId)) return false;
    const sig = `${t.tk}_${t.di}_${t.do}_${t.ct}_${t.pi}_${t.po}`;
    if (seenSigs.has(sig)) return false;
    if (t._flexId) seenIds.add(t._flexId);
    seenSigs.add(sig);
    return true;
  });
}

/**
 * Deduplicate cashFlows — skip if same date + type + amount.
 * Also deduplicates within newFlows themselves (Flex XML can return
 * the same transaction multiple times with different transactionIds).
 */
export function deduplicateCashFlows(newFlows, existingFlows) {
  const seenTxIds = new Set();
  const seenSigs = new Set();
  for (const f of existingFlows) {
    if (f._flexTxId) seenTxIds.add(f._flexTxId);
    seenSigs.add(`${f.da}_${f.ty}_${f.a1}`);
  }

  return newFlows.filter((f) => {
    if (f._flexTxId && seenTxIds.has(f._flexTxId)) return false;
    const sig = `${f.da}_${f.ty}_${f.a1}`;
    if (seenSigs.has(sig)) return false;
    // Mark as seen so subsequent duplicates within newFlows are caught
    if (f._flexTxId) seenTxIds.add(f._flexTxId);
    seenSigs.add(sig);
    return true;
  });
}
