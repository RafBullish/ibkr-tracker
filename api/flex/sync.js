// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — IBKR Flex Web Service Proxy
//  POST { token, queryId } → SendRequest → GetStatement → CSV
// ═══════════════════════════════════════════════════════════════

const IBKR_BASE = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService';
const UA = 'NodeJS/18';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse IBKR XML response to extract a tag value.
 * IBKR returns simple XML like: <FlexStatementResponse><Status>Success</Status><ReferenceCode>123</ReferenceCode></FlexStatementResponse>
 */
function xmlTag(xml, tag) {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

import { applyCors } from '../_cors.js';
import { enforceRateLimit } from '../_rateLimit.js';

const TOKEN_HEADER = 'x-ibkr-flex-token';
const QUERY_HEADER = 'x-ibkr-flex-query-id';
const isProd = process.env.NODE_ENV === 'production';

export default async function handler(req, res) {
  if (
    !applyCors(req, res, {
      methods: 'POST, OPTIONS',
      headers: `Content-Type, X-IBKR-Flex-Token, X-IBKR-Flex-Query-Id`,
    })
  ) {
    return;
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Tight ceiling — IBKR rate-limits Flex queries on their side and a hot
  // loop here would also burn our quota.
  if (!enforceRateLimit(req, res, { max: 10, windowMs: 60_000, bucket: 'flex' })) return;

  // Credentials are passed via custom headers so they never end up in
  // request bodies cached by intermediaries or in browser history. Body
  // is no longer trusted for these fields.
  const token = req.headers[TOKEN_HEADER];
  const queryId = req.headers[QUERY_HEADER];
  if (!token || !queryId) {
    return res.status(401).json({ error: 'Missing Flex credentials' });
  }

  try {
    // ── Step 1: SendRequest ──
    const sendUrl = `${IBKR_BASE}/SendRequest?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`;
    const sendRes = await fetch(sendUrl, {
      headers: { 'User-Agent': UA },
    });
    const sendXml = await sendRes.text();

    const status = xmlTag(sendXml, 'Status');
    if (status !== 'Success') {
      const errMsg =
        xmlTag(sendXml, 'ErrorMessage') || xmlTag(sendXml, 'ErrorCode') || 'SendRequest failed';
      return res.status(400).json({ error: `IBKR SendRequest: ${errMsg}` });
    }

    const refCode = xmlTag(sendXml, 'ReferenceCode');
    if (!refCode) {
      return res.status(500).json({ error: 'No ReferenceCode in IBKR response' });
    }

    // ── Step 2: Wait for statement generation ──
    await sleep(5000);

    // ── Step 3: GetStatement (with retries) ──
    const getUrl = `${IBKR_BASE}/GetStatement?t=${encodeURIComponent(token)}&q=${encodeURIComponent(refCode)}&v=3`;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const getRes = await fetch(getUrl, {
        headers: { 'User-Agent': UA },
      });
      const body = await getRes.text();

      // IBKR wraps errors in <FlexStatementResponse><ErrorCode>…</ErrorCode>…</FlexStatementResponse>.
      // Parse the tag explicitly rather than substring-matching "1019" — the literal
      // string could legitimately appear anywhere in a real CSV (quantities, prices, IDs).
      const errorCode = xmlTag(body, 'ErrorCode');
      if (errorCode === '1019') {
        // Still generating — retry with backoff
        if (attempt < MAX_RETRIES) {
          await sleep(5000);
          continue;
        }
        return res
          .status(504)
          .json({ error: 'IBKR statement generation timed out. Try again in a minute.' });
      }
      if (errorCode) {
        const errMsg = xmlTag(body, 'ErrorMessage') || errorCode || 'GetStatement failed';
        return res.status(400).json({ error: `IBKR GetStatement: ${errMsg}` });
      }

      // Success — return the CSV/XML content
      return res.status(200).json({ csv: body });
    }
  } catch (err) {
    // Server-side log keeps the diagnostic detail; the client gets an
    // opaque message so token/queryId fragments can never leak via err.message.
    if (!isProd) console.error('[flex/sync] proxy error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
