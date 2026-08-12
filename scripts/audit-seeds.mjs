// ═══════════════════════════════════════════════════════════════
//  audit-seeds — datasets de test des harnais visuels (Node pur).
//
//  · buildSeed() : le dataset PAR DÉFAUT de `npm run audit:visual`
//    (12 pages peuplées). Déplacé ici depuis visual-audit.mjs à
//    l'identique (FIX-NLV, commit outillage) pour être importable —
//    visual-audit.mjs exécute main() à l'import, on ne peut rien
//    importer depuis lui. CONTENU INCHANGÉ.
//  · buildSeedNlvPathologie() : profil OPTIONNEL `AUDIT_SEED=
//    nlv-pathologie` — reproduit le cas réel du 12.08 (Héros 1 cassé) :
//    1 seul snapshot quotidien daté d'aujourd'hui, ~100 clôtures
//    étalées sur ~7 mois, flux de cash datés, buffer intraday pollué
//    de points nlv=0. Déterministe (aucun aléa : captures stables).
//
//  Les deux seeds vont dans le localStorage d'un contexte Playwright
//  ISOLÉ (profil éphémère) — les clés réelles ne sont JAMAIS touchées.
// ═══════════════════════════════════════════════════════════════

// ── Dataset de test à dates relatives (populated seed) ─────────────────────────
export function buildSeed() {
  const dayMs = 86400000;
  const now = Date.now();
  const iso = (off) => new Date(now + off * dayMs).toISOString().slice(0, 10);

  const positions = [
    { id: 'g1', as: 'Option', dir: 'Long', tk: 'AAPL', ty: 'CALL', st: '240', ex: iso(45), ct: '2', mu: '100', pi: '4.20', pc: '4.50', ivRank: 35 },
    { id: 'g2', as: 'Option', dir: 'Long', tk: 'MSFT', ty: 'CALL', st: '450', ex: iso(30), ct: '3', mu: '100', pi: '5.80', pc: '6.00', ivRank: 52 },
    { id: 'g3', as: 'Option', dir: 'Long', tk: 'NVDA', ty: 'CALL', st: '150', ex: iso(60), ct: '4', mu: '100', pi: '5.20', pc: '5.50', ivRank: 75 },
    { id: 'g4', as: 'Option', dir: 'Long', tk: 'CVX', ty: 'CALL', st: '165', ex: iso(45), ct: '1', mu: '100', pi: '3.30', pc: '3.50', ivRank: 22 },
    { id: 'g5', as: 'Option', dir: 'Long', tk: 'XOM', ty: 'CALL', st: '120', ex: iso(90), ct: '3', mu: '100', pi: '2.60', pc: '2.80', ivRank: 44 },
  ];
  const spots = { AAPL: 232, MSFT: 438, NVDA: 143, CVX: 160, XOM: 118 };
  const spotCache = {};
  for (const [tk, spot] of Object.entries(spots)) spotCache[tk] = { spot, timestamp: now };

  // Trades clôturés étalés (this-month pour Calendar/Analytics + historique).
  const closed = [
    { id: 'c1', tk: 'AAPL', as: 'Option', ty: 'CALL', dir: 'Long', pnl: 420, do: iso(-1), di: iso(-11), tag: 'Sniper OTM' },
    { id: 'c2', tk: 'MSFT', as: 'Option', ty: 'PUT', dir: 'Long', pnl: -180, do: iso(-1), di: iso(-9), tag: 'FOMO' },
    { id: 'c3', tk: 'NVDA', as: 'Option', ty: 'CALL', dir: 'Long', pnl: 650, do: iso(-2), di: iso(-13), tag: 'Sniper OTM' },
    { id: 'c4', tk: 'XOM', as: 'Option', ty: 'CALL', dir: 'Long', pnl: -310, do: iso(-3), di: iso(-8), tag: 'Event' },
    { id: 'c5', tk: 'CVX', as: 'Option', ty: 'PUT', dir: 'Short', pnl: 210, do: iso(-6), di: iso(-20), tag: 'Sniper OTM' },
    { id: 'c6', tk: 'TSLA', as: 'Stock', ty: null, dir: 'Long', pnl: -95, do: iso(-16), di: iso(-30), tag: 'Swing' },
    { id: 'c7', tk: 'AMD', as: 'Option', ty: 'CALL', dir: 'Long', pnl: 310, do: iso(-42), di: iso(-57), tag: 'Sniper OTM' },
    { id: 'c8', tk: 'GOOG', as: 'Option', ty: 'PUT', dir: 'Short', pnl: 540, do: iso(-82), di: iso(-96), tag: 'Swing' },
    { id: 'c9', tk: 'META', as: 'Option', ty: 'CALL', dir: 'Long', pnl: -220, do: iso(-115), di: iso(-130), tag: 'Event' },
    { id: 'c10', tk: 'SPY', as: 'Option', ty: 'PUT', dir: 'Long', pnl: 130, do: iso(-150), di: iso(-160), tag: 'Sniper OTM' },
  ];
  const journal = [
    { id: 'j1', date: iso(-1), ticker: 'AAPL', mood: 'confident', mistake: 'none', tag: 'Sniper OTM', note: 'Setup propre, patience sur l\'entree et respect du plan.', rating: 5 },
    { id: 'j2', date: iso(-1), ticker: 'MSFT', mood: 'frustrated', mistake: 'timing', tag: 'FOMO', note: 'Entre trop tot sur le pullback, mauvais timing.', rating: 2 },
    { id: 'j3', date: iso(-2), ticker: 'NVDA', mood: 'calm', mistake: 'none', tag: 'Suivi plan', note: 'Respect du plan, TP atteint sans stress.', rating: 4 },
    { id: 'j4', date: iso(-3), ticker: 'XOM', mood: 'revenge', mistake: 'revenge', tag: 'Revenge', note: 'Revenge trade apres la perte NVDA. Erreur de discipline.', rating: 1 },
    { id: 'j5', date: iso(-6), ticker: 'CVX', mood: 'focus', mistake: 'none', tag: 'Sniper OTM', note: 'Bon short premium, IV rank favorable.', rating: 4 },
  ];
  const cashFlows = [
    { id: 'f1', da: iso(-60), ty: 'dep_chf', a1: '5000', a2: '0' },
    { id: 'f2', da: iso(-20), ty: 'dep_chf', a1: '2000', a2: '0' },
  ];

  return {
    ibkr_u_o: JSON.stringify(positions),
    ibkr_u_c: JSON.stringify(closed),
    ibkr_u_j: JSON.stringify(journal),
    ibkr_u_f: JSON.stringify(cashFlows),
    ibkr_u_s: JSON.stringify({ r: 0.88, ic: 8000 }),
    ibkr_spot_cache_v1: JSON.stringify(spotCache),
    ibkr_schema_v: '7',
    ibkr_theme: 'midnight',
    chain_history: JSON.stringify(['AAPL']),
  };
}

// ── Profil « nlv-pathologie » — le cas Rafael du 12.08 ─────────────────────────
//  · settings.dailySnapshots = UN SEUL point, daté d'aujourd'hui (le journal
//    n'accumule qu'un point par jour de visite — jamais reconstruit).
//  · ~100 clôtures sur ~7 mois (J−210 → J−2), alternance gains/pertes
//    déterministe, Σ ≈ +13'750 (ordre de grandeur du réel +13'240).
//  · flux : 2 dépôts CHF + 1 retrait CHF datés.
//  · buffer qc:nlvIntraday pollué : points nlv=0 sur 3 séances.
export function buildSeedNlvPathologie() {
  const dayMs = 86400000;
  const now = Date.now();
  const iso = (off) => new Date(now + off * dayMs).toISOString().slice(0, 10);
  const rthTs = (off, minute = 0) =>
    Math.floor((Date.parse(iso(off) + 'T15:30:00Z') + minute * 60000) / 1000);

  const positions = [
    { id: 'g1', as: 'Option', dir: 'Long', tk: 'AAPL', ty: 'CALL', st: '240', ex: iso(45), ct: '2', mu: '100', pi: '4.20', pc: '4.50', ivRank: 35 },
    { id: 'g2', as: 'Option', dir: 'Long', tk: 'MSFT', ty: 'CALL', st: '450', ex: iso(30), ct: '3', mu: '100', pi: '5.80', pc: '6.00', ivRank: 52 },
    { id: 'g3', as: 'Option', dir: 'Long', tk: 'XOM', ty: 'CALL', st: '120', ex: iso(90), ct: '3', mu: '100', pi: '2.60', pc: '2.80', ivRank: 44 },
  ];
  const spots = { AAPL: 232, MSFT: 438, XOM: 118 };
  const spotCache = {};
  for (const [tk, spot] of Object.entries(spots)) spotCache[tk] = { spot, timestamp: now };

  // ~100 clôtures : J−2 → J−208, 2 gains pour 1 perte, montants cyclés
  // (déterministe). Σ pnl = +13'750.
  const tks = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'META', 'GOOG', 'SPY', 'QQQ', 'XOM', 'CVX'];
  const closed = [];
  for (let i = 0; i < 100; i++) {
    const dOut = -2 - Math.round(i * 2.08); // étalées sur ~7 mois
    const base = 80 + (i % 7) * 55;
    const win = i % 3 !== 2;
    closed.push({
      id: `pnl${i + 1}`,
      tk: tks[i % 10],
      as: 'Option',
      ty: i % 2 ? 'PUT' : 'CALL',
      dir: 'Long',
      pnl: win ? base + 140 : -(base + 120),
      do: iso(dOut),
      di: iso(dOut - 9),
      tag: i % 4 ? 'Sniper OTM' : 'Event',
    });
  }

  const cashFlows = [
    { id: 'f1', da: iso(-215), ty: 'dep_chf', a1: '5000', a2: '0' },
    { id: 'f2', da: iso(-140), ty: 'dep_chf', a1: '2000', a2: '0' },
    { id: 'f3', da: iso(-60), ty: 'wit_chf', a1: '800', a2: '0' },
  ];

  // Buffer intraday POLLUÉ : que des zéros (écrits store vide, avant import).
  const intraday = {
    v: 1,
    days: [
      { d: iso(-3), pts: [[rthTs(-3, 0), 0], [rthTs(-3, 5), 0], [rthTs(-3, 10), 0]] },
      { d: iso(-1), pts: [[rthTs(-1, 0), 0], [rthTs(-1, 5), 0]] },
      { d: iso(0), pts: [[rthTs(0, 0), 0]] },
    ],
  };

  return {
    ibkr_u_o: JSON.stringify(positions),
    ibkr_u_c: JSON.stringify(closed),
    ibkr_u_j: JSON.stringify([]),
    ibkr_u_f: JSON.stringify(cashFlows),
    // UN snapshot quotidien, daté d'aujourd'hui (sa nlv sera de toute
    // façon écrasée par le point live du jour dans buildNlvSeries).
    ibkr_u_s: JSON.stringify({ r: 0.88, ic: 8000, ds: [{ date: iso(0), nlv: 21000 }] }),
    ibkr_spot_cache_v1: JSON.stringify(spotCache),
    ibkr_schema_v: '7',
    ibkr_theme: 'midnight',
    'qc:nlvIntraday': JSON.stringify(intraday),
  };
}
