// ═══════════════════════════════════════════════════════════════
//  GREEKS API — Yahoo chain (IV, spot) + Black-Scholes (Δ/Γ/Θ/Vega)
//
//  Source primaire : Yahoo Finance (chain par ticker × expiry).
//  Yahoo n'expose pas les Greeks bruts, mais expose `impliedVolatility`
//  par contrat et `regularMarketPrice` (spot) sur la même réponse.
//  Les Greeks sont donc calculés analytiquement via blackScholes.js.
//
//  Mode "unavailable" — lorsque Yahoo manque (réseau, contrat absent,
//  IV nulle, expiry passée), la position est marquée
//  `source: 'unavailable'` avec tous les Greeks à null. Le consumer
//  (computePortfolioGreeks, table Δ/Θ) skip les positions non-disponibles
//  plutôt que d'agréger des zéros — les valeurs ne sont JAMAIS inventées.
// ═══════════════════════════════════════════════════════════════

import { bsGreeks, RISK_FREE_RATE } from './options/blackScholes';

const UNAVAILABLE = Object.freeze({
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  iv: null,
  spot: null,
  bid: null,
  ask: null,
  source: 'unavailable',
});

/**
 * Fetch the Yahoo chain for a ticker + specific expiration date.
 * Returns { spot, calls[], puts[] } or null on error.
 */
async function fetchYahooChain(ticker, expiryDate) {
  try {
    const ts = Math.floor(new Date(expiryDate + 'T12:00:00').getTime() / 1000);
    const res = await fetch(`/api/yahoo/${ticker.toUpperCase()}?date=${ts}`);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.optionChain?.result?.[0];
    if (!result?.options?.[0]) return null;
    return {
      spot: result.quote?.regularMarketPrice || 0,
      calls: result.options[0].calls || [],
      puts: result.options[0].puts || [],
    };
  } catch {
    return null;
  }
}

/**
 * Find a contract in Yahoo's calls/puts array matching strike + side.
 */
function findContract(chain, strike, type) {
  const target = parseFloat(strike);
  if (!Number.isFinite(target)) return null;
  const list = type === 'PUT' ? chain.puts : chain.calls;
  for (const contract of list) {
    if (Math.abs(contract.strike - target) < 0.01) return contract;
  }
  return null;
}

/**
 * Compute the greeks payload for a single position given its already-fetched
 * chain. Returns the shape persisted in the Map.
 */
function computeGreeksFromChain(pos, chain) {
  const spot = chain.spot > 0 ? chain.spot : null;
  const contract = findContract(chain, pos.st, pos.ty);
  if (!contract) return { ...UNAVAILABLE, spot };

  const bid = Number.isFinite(contract.bid) ? contract.bid : null;
  const ask = Number.isFinite(contract.ask) ? contract.ask : null;
  const sigma = contract.impliedVolatility;

  if (!Number.isFinite(sigma) || sigma <= 0) {
    return { ...UNAVAILABLE, spot, bid, ask };
  }

  const expiryMs = new Date(pos.ex + 'T12:00:00').getTime();
  if (!Number.isFinite(expiryMs)) {
    return { ...UNAVAILABLE, spot, iv: sigma, bid, ask };
  }
  const T = (expiryMs - Date.now()) / (365 * 86400000);
  if (T <= 0 || !(spot > 0)) {
    return { ...UNAVAILABLE, spot, iv: sigma, bid, ask };
  }

  const K = parseFloat(pos.st);
  const type = pos.ty === 'PUT' ? 'put' : 'call';
  const g = bsGreeks({ S: spot, K, T, r: RISK_FREE_RATE, sigma, type });
  if (!g) {
    return { ...UNAVAILABLE, spot, iv: sigma, bid, ask };
  }

  return {
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta,
    vega: g.vega,
    iv: sigma,
    spot,
    bid,
    ask,
    source: 'bs',
  };
}

/**
 * Fetch Greeks for all open option positions, batching by (ticker × expiry).
 * Returns a Map<positionId, greeks>. Stock positions and positions missing
 * a key field (tk/ty/st/ex) are not included in the Map.
 */
export async function getGreeksForAllPositions(positions) {
  const result = new Map();

  // Group option positions by (ticker, expiry).
  const groups = {};
  for (const pos of positions) {
    if (pos.as !== 'Option') continue;
    if (!pos.tk || !pos.ty || !pos.st || !pos.ex) continue;
    const key = `${pos.tk}|${pos.ex}`;
    if (!groups[key]) groups[key] = { ticker: pos.tk, expiry: pos.ex, positions: [] };
    groups[key].positions.push(pos);
  }

  // One Yahoo fetch per (ticker × expiry), in parallel.
  const keys = Object.keys(groups);
  const chains = await Promise.all(
    keys.map((k) => fetchYahooChain(groups[k].ticker, groups[k].expiry))
  );

  for (let i = 0; i < keys.length; i++) {
    const chain = chains[i];
    const positionsInGroup = groups[keys[i]].positions;
    if (!chain) {
      // Whole-group fetch failure → every position falls back to unavailable.
      for (const pos of positionsInGroup) {
        result.set(pos.id, { ...UNAVAILABLE });
      }
      continue;
    }
    for (const pos of positionsInGroup) {
      result.set(pos.id, computeGreeksFromChain(pos, chain));
    }
  }

  return result;
}
