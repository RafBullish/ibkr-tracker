// ═══════════════════════════════════════════════════════════════
//  NAV SERIES — série NLV quotidienne dérivée du CSV Flex. PUR.
//
//  LA COURBE SUIT LE NLV DU COMPTE DU CSV IMPORTÉ. Hiérarchie :
//
//  a) Section NAV du Flex présente (ReportDate + Total/EndingValue)
//     → source EXACTE, en devise de base. `source: 'nav'`.
//
//  b) Sinon RECONSTRUCTION depuis les sections disponibles.
//     `source: 'recon'`, marquée « approx. » dans l'UI :
//     - grands livres PAR DEVISE, semés du StartingCash du Cash Report ;
//     - Cash Transactions granulaires (dépôts/retraits + Other Fees,
//       dividendes, intérêts… — canal ledgerRows) à leur date ;
//     - exécutions forex : jambe quote = Proceeds + IBCommission en
//       CurrencyPrimary, jambe base-de-paire = Quantity (NetCash est à
//       0 sur ces rows — les deux jambes portent la conversion) ;
//     - exécutions OPT/STK : NetCash (commission incluse) au cash, et
//       CostBasis SIGNÉ en valeur de position (achat : cash −prime,
//       position +prime → NAV plat à l'ouverture, mouvement au réalisé.
//       L'unrealized quotidien n'est PAS reconstituable sans section
//       NAV — c'est la limite honnête de l'approximation) ;
//     - conversion vers la devise de base aux taux DATÉS portés par le
//       CSV lui-même (FXRateToBase de chaque row) — aucun taux externe.
//
//  Sortie : { source, baseCurrency, days: [{d, base}], flows, reconciliation }
//  `days` en devise de base — la conversion d'affichage $ passe par le
//  pipeline existant (liveRate), pas ici.
// ═══════════════════════════════════════════════════════════════

export const NAV_SOURCE_EXACT = 'nav';
export const NAV_SOURCE_RECON = 'recon';

// Devise de base par défaut si aucune row ne porte FXRateToBase = 1
// (compte QuantumCall = CHF-base ; constante, pas une devinette runtime).
const DEFAULT_BASE_CURRENCY = 'CHF';

const round2 = (v) => Math.round(v * 100) / 100;
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Types de Cash Transactions qui sont du FUNDING (annotations apports/retraits). */
const FUNDING_TYPES = new Set(['Deposits', 'Withdrawals', 'Deposits/Withdrawals']);

/**
 * Devise de base du relevé = la devise dont les rows portent
 * FXRateToBase = 1. Fallback : CHF (constante).
 */
export function detectBaseCurrency(parsed) {
  for (const r of parsed?.ledgerRows || []) {
    if (r.fxToBase === 1 && r.currency) return r.currency;
  }
  for (const fx of parsed?.fxExecutions || []) {
    if (fx.fxToBase === 1 && fx.quoteCurrency) return fx.quoteCurrency;
  }
  for (const t of parsed?.trades || []) {
    if (num(t.fxi) === 1 && t._ibkrCurrency) return t._ibkrCurrency;
  }
  return DEFAULT_BASE_CURRENCY;
}

/** Apports/retraits du dataset (annotations du graphe), triés par date. */
function extractDatasetFlows(ledgerRows) {
  const out = [];
  for (const r of ledgerRows || []) {
    if (!FUNDING_TYPES.has(r.type)) continue;
    out.push({
      d: r.date,
      kind: r.amount >= 0 ? 'dep' : 'wit',
      amount: round2(r.amount),
      currency: r.currency,
    });
  }
  return out.sort((a, b) => a.d.localeCompare(b.d));
}

/**
 * Construit la série NAV quotidienne du dataset depuis le parse Flex.
 * @param {ReturnType<import('../ibkrParser').parseIbkrCsv>} parsed
 */
export function buildCsvNavSeries(parsed) {
  const baseCurrency = detectBaseCurrency(parsed);
  const flows = extractDatasetFlows(parsed?.ledgerRows);

  // ── a) Source exacte : section NAV ────────────────────────────
  if (Array.isArray(parsed?.navRows) && parsed.navRows.length > 0) {
    const byDate = new Map();
    for (const r of parsed.navRows) byDate.set(r.date, num(r.total));
    const days = Array.from(byDate.entries())
      .map(([d, base]) => ({ d, base: round2(base) }))
      .sort((a, b) => a.d.localeCompare(b.d));
    return { source: NAV_SOURCE_EXACT, baseCurrency, days, flows, reconciliation: null };
  }

  // ── b) Reconstruction ─────────────────────────────────────────
  // Taux datés devise→base, extraits des rows du CSV lui-même.
  const fxToBase = new Map(); // currency → [[date, rate]] trié asc
  const addRate = (currency, date, rate) => {
    if (!currency || !date || !(rate > 0) || currency === baseCurrency) return;
    if (!fxToBase.has(currency)) fxToBase.set(currency, []);
    fxToBase.get(currency).push([date, rate]);
  };
  for (const r of parsed?.ledgerRows || []) addRate(r.currency, r.date, r.fxToBase);
  for (const fx of parsed?.fxExecutions || []) addRate(fx.quoteCurrency, fx.date, fx.fxToBase);
  for (const t of parsed?.trades || []) addRate(t._ibkrCurrency, t.di, num(t.fxi));
  // Section FX Rates / conversions USD.CHF : taux USD→CHF datés.
  if (baseCurrency === 'CHF') {
    for (const [date, rate] of Object.entries(parsed?.fxRates || {})) addRate('USD', date, rate);
  }
  for (const list of fxToBase.values()) list.sort((a, b) => a[0].localeCompare(b[0]));

  // Taux à une date : dernier connu ≤ date, sinon premier connu.
  const rateFor = (currency, date) => {
    if (currency === baseCurrency) return 1;
    const list = fxToBase.get(currency);
    if (!list || list.length === 0) return null;
    let rate = null;
    for (const [d, r] of list) {
      if (d <= date) rate = r;
      else break;
    }
    return rate ?? list[0][1];
  };

  // Événements chronologiques → grands livres par devise.
  const cash = new Map(); // currency → solde
  const posCost = new Map(); // currency → valeur des positions ouvertes au coût
  const bump = (map, currency, amount) => {
    if (!currency || !Number.isFinite(amount) || amount === 0) return;
    map.set(currency, (map.get(currency) || 0) + amount);
  };

  const events = [];
  for (const r of parsed?.ledgerRows || []) {
    events.push({ date: r.date, apply: () => bump(cash, r.currency, r.amount) });
  }
  for (const fx of parsed?.fxExecutions || []) {
    events.push({
      date: fx.date,
      apply: () => {
        bump(cash, fx.quoteCurrency, fx.proceeds);
        bump(cash, fx.commissionCurrency, fx.commission);
        bump(cash, fx.pairBase, fx.qty);
      },
    });
  }
  for (const t of parsed?.trades || []) {
    if (!t.di) continue;
    const currency = t._ibkrCurrency || 'USD';
    // NetCash = effet cash exact commission incluse ; fallback pour les
    // exports sans colonne NetCash : Proceeds − commission.
    const netCash = num(t._ibkrNetCash) !== 0 ? num(t._ibkrNetCash) : num(t._ibkrProceeds) - num(t.fi);
    const costBasis = num(t._ibkrCostBasis);
    events.push({
      date: t.di,
      apply: () => {
        bump(cash, currency, netCash);
        bump(posCost, currency, costBasis);
      },
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Graine : StartingCash par devise du Cash Report.
  const currencies = parsed?.cashReport?.currencies || {};
  for (const [currency, c] of Object.entries(currencies)) {
    bump(cash, currency, num(c?.startingCash));
  }

  const valueBase = (date) => {
    let total = 0;
    for (const [currency, amount] of cash) {
      const rate = rateFor(currency, date);
      if (rate != null) total += amount * rate;
    }
    for (const [currency, amount] of posCost) {
      const rate = rateFor(currency, date);
      if (rate != null) total += amount * rate;
    }
    return total;
  };

  const fromDate = parsed?.meta?.fromDate || (events.length ? events[0].date : '');
  const toDate = parsed?.meta?.toDate || (events.length ? events[events.length - 1].date : '');

  const days = [];
  if (fromDate) days.push({ d: fromDate, base: round2(valueBase(fromDate)) });
  let i = 0;
  while (i < events.length) {
    const date = events[i].date;
    while (i < events.length && events[i].date === date) {
      events[i].apply();
      i++;
    }
    const point = { d: date, base: round2(valueBase(date)) };
    if (days.length && days[days.length - 1].d === date) days[days.length - 1] = point;
    else days.push(point);
  }

  // Positions ouvertes AVANT la fenêtre (leur exécution d'ouverture n'est
  // pas dans le relevé) : écart entre le coût des positions de fin de
  // période (section Open Positions) et le cumul CostBasis des exécutions
  // → offset constant sur toute la série (approximation documentée).
  let endPositionsBase = 0;
  for (const p of parsed?.positions || []) {
    endPositionsBase += num(p.pi) * num(p.ct) * num(p.mu) * (num(p.fxi) || 1);
  }
  let trackedPositionsBase = 0;
  const endDate = toDate || (days.length ? days[days.length - 1].d : '');
  for (const [currency, amount] of posCost) {
    const rate = rateFor(currency, endDate);
    if (rate != null) trackedPositionsBase += amount * rate;
  }
  const preWindowOffset = round2(endPositionsBase - trackedPositionsBase);
  if (Math.abs(preWindowOffset) >= 0.01) {
    for (const day of days) day.base = round2(day.base + preWindowOffset);
  }

  if (toDate && days.length && days[days.length - 1].d < toDate) {
    days.push({ d: toDate, base: days[days.length - 1].base });
  }

  // Réconciliation cash (positions exclues) vs EndingCash du Cash Report.
  let cashBase = 0;
  for (const [currency, amount] of cash) {
    const rate = rateFor(currency, endDate);
    if (rate != null) cashBase += amount * rate;
  }
  const expected = parsed?.cashReport?.endingCash;
  const reconciliation = {
    cashBase: round2(cashBase),
    expectedCashBase: Number.isFinite(expected) ? round2(expected) : null,
  };

  return { source: NAV_SOURCE_RECON, baseCurrency, days, flows, reconciliation };
}
