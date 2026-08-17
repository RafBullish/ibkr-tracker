// ═══════════════════════════════════════════════════════════════
//  VERCEL SERVERLESS — Batch quotes. UNE requête client renvoie
//  toutes les quotes demandées ; le fan-out vers les sources amont
//  (Finnhub/Yahoo/CBOE) est INTERNE et BORNÉ.
//
//  Deux mécanismes garantissent « une seule requête amont par cycle
//  pour TOUS les clients » :
//    (a) BATCH — N symboles en une seule route (côté client : plus de
//        fan-out séquentiel /api/quote/X qui déclenchait le 429).
//    (b) CACHE CDN PARTAGÉ — `Cache-Control: public, s-maxage` cache
//        la réponse au bord de Vercel, PAR URL, partagée entre toutes
//        les instances et tous les clients. L'URL est déterministe
//        (symboles normalisés + dédupliqués + TRIÉS) → un seul objet
//        de cache. Vérifiable via l'en-tête `x-vercel-cache: HIT`.
//    (Le Map en mémoire de _rateLimit.js est par-instance = illusoire
//     comme cache partagé ; c'est le CDN qui partage réellement.)
//
//  Réponse : { quotes: { SYM: {price,…} }, errors: { SYM: raison },
//              ts: epoch_ms }. Toujours 200 si ≥1 symbole valide.
// ═══════════════════════════════════════════════════════════════

import { applyCors } from './_cors.js';
import { enforceRateLimit } from './_rateLimit.js';
import { resolveQuote, sanitizeSymbol } from './_quoteSources.js';

const MAX_SYMBOLS = 40; // plafond dur (le bandeau en demande ~22)
const CONCURRENCY = 8; // fan-out interne borné vers l'amont

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!enforceRateLimit(req, res, { max: 30, windowMs: 60_000, bucket: 'quotes' })) return;

  const raw = String(req.query.symbols || '');
  // Normalise → déduplique → TRIE → borne : l'URL de cache est
  // déterministe quel que soit l'ordre/la casse envoyés par le client.
  const symbols = [...new Set(raw.split(',').map(sanitizeSymbol).filter(Boolean))]
    .sort()
    .slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return res.status(400).json({ error: 'Paramètre symbols requis' });
  }

  const quotes = {};
  const errors = {};

  // Fan-out interne parallèle mais borné (pool de workers). Une seule
  // exécution serveur peut résoudre les N symboles ; grâce au cache CDN
  // ci-dessous, elle ne se reproduit qu'une fois par fenêtre s-maxage,
  // partagée entre tous les clients.
  let cursor = 0;
  async function worker() {
    while (cursor < symbols.length) {
      const sym = symbols[cursor++];
      try {
        const q = await resolveQuote(sym);
        if (q) quotes[sym] = q;
        else errors[sym] = 'unavailable';
      } catch {
        errors[sym] = 'error';
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker)
  );

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({ quotes, errors, ts: Date.now() });
}
