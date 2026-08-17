// ═══════════════════════════════════════════════════════════════
//  BANDEAU (TickerTape) — composition des 3 groupes (1.G-c · D2).
//
//  Le bandeau ne double plus le cockpit (indices/FX/matières vivaient
//  aux deux endroits). Trois groupes, dans cet ordre :
//    1. MAG 7      — fixe, les 7 méga-caps (non éditable).
//    2. POSITIONS  — sous-jacents des positions ouvertes (dynamique,
//                    dédupliqué du groupe 1 ; point ambre + P&L latent).
//    3. SECTEURS   — 8 leaders hors Mag 7, ÉDITABLE en Réglages.
//
//  MAG7 et DEFAULT_SECTORS sont des données de config (pas de tokens
//  couleur, pas de dépendance) — partagées par le bandeau, le store
//  (défaut/persistance) et Réglages (placeholder + reset).
// ═══════════════════════════════════════════════════════════════

import { unrealizedPnlUsd } from '../utils/positions';

// Groupe 1 — fixe. Ordre imposé par l'architecte.
export const MAG7 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];

// Groupe 3 — défaut éditable (8 leaders hors Mag 7).
export const DEFAULT_SECTORS = ['LLY', 'JPM', 'XOM', 'WMT', 'HD', 'CAT', 'AVGO', 'NFLX'];

// Garde-fou de saisie Réglages (le bandeau reste lisible).
export const MAX_SECTORS = 12;

/**
 * Normalise une liste de tickers SECTEURS : majuscules, charset
 * equity, trim, déduplication, vides retirés, plafonnée. Source unique
 * de vérité (reducer + Réglages l'appellent tous les deux).
 */
export function sanitizeSectors(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const sym = String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9.]/g, '');
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
    if (out.length >= MAX_SECTORS) break;
  }
  return out;
}

/**
 * Compose les 3 groupes du bandeau + la liste de symboles à requêter.
 * PURE (testable sans React). Règles :
 *   - MAG 7 : fixe, toujours présent.
 *   - POSITIONS : sous-jacents détenus, P&L latent sommé, dédupliqué du
 *     Mag 7. Vide → le groupe DISPARAÎT (pas de placeholder).
 *   - SECTEURS : configurés, hors Mag 7 ET hors positions (un titre ne
 *     paraît jamais deux fois). Vide → groupe absent.
 * @param {{openPositions?: Array, tapeSectors?: string[]}} input
 * @returns {{groups: Array, fetchSymbols: string[]}}
 */
export function buildTapeGroups({ openPositions = [], tapeSectors = DEFAULT_SECTORS } = {}) {
  const mag7Set = new Set(MAG7);

  // Groupe 2 — P&L latent sommé par sous-jacent détenu.
  const pnlByUnderlying = new Map();
  for (const p of openPositions || []) {
    const tk = String(p?.tk || '')
      .toUpperCase()
      .replace(/[^A-Z0-9.]/g, '');
    if (!tk) continue;
    pnlByUnderlying.set(tk, (pnlByUnderlying.get(tk) || 0) + unrealizedPnlUsd(p));
  }
  const posSymbols = [...pnlByUnderlying.keys()].filter((s) => !mag7Set.has(s));
  const posSet = new Set(posSymbols);

  // Groupe 3 — SECTEURS configurés, hors Mag 7 ET hors positions.
  const sectors = sanitizeSectors(tapeSectors).filter(
    (s) => !mag7Set.has(s) && !posSet.has(s)
  );

  const mk = (sym, extra) => ({ display: sym, fetch: sym, classKey: 'EQUITIES', ...extra });

  const groups = [{ key: 'mag7', label: 'MAG 7', items: MAG7.map((s) => mk(s)) }];
  if (posSymbols.length) {
    groups.push({
      key: 'pos',
      label: 'POSITIONS',
      items: posSymbols.map((s) => mk(s, { held: true, pnl: pnlByUnderlying.get(s) })),
    });
  }
  if (sectors.length) {
    groups.push({ key: 'sec', label: 'SECTEURS', items: sectors.map((s) => mk(s)) });
  }

  const fetchSymbols = [...new Set(groups.flatMap((g) => g.items.map((it) => it.fetch)))];
  return { groups, fetchSymbols };
}
