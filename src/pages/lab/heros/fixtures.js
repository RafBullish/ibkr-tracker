// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — fixtures DÉTERMINISTES (DEV-only, purgé fin 1.D)
//
//  Génère des séries equity synthétiques SANS toucher localStorage
//  (isolation §7 : le lab ne dépend jamais du store réel de Rafael).
//  Un point = une clôture de trade → { date, pnl, equity, peak,
//  drawdown, underwaterPct, capital } — même esprit que
//  computeEquityCurve + computeUnderwaterCurve, mais 100 % local.
//
//  LCG seedé → reproductible pour des captures stables (aucun
//  Math.random non déterministe dans la sortie).
// ═══════════════════════════════════════════════════════════════

// Générateur pseudo-aléatoire seedé (Mulberry32) — déterministe.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayMs = 86_400_000;
// Date d'ancrage FIXE (pas de Date.now → captures stables). Fin de série.
const ANCHOR_MS = Date.parse('2026-07-18');
const iso = (offDays) => new Date(ANCHOR_MS + offDays * dayMs).toISOString().slice(0, 10);

/**
 * Assemble une série à partir d'une liste de pnls (chronologique) +
 * un capital de base et d'éventuels apports datés (funding steps).
 * Le champ `capital` reflète le capital déployé à date (base + apports
 * cumulés). `equity` = base convention passée (cumPnL nu OU realEquity).
 */
function assemble({ pnls, spanDays = 180, base = 0, deposits = [] }) {
  const n = pnls.length;
  if (n === 0) return [];
  const step = spanDays / n;
  let cum = 0;
  let peak = base; // peak sur equity (base incluse)
  const out = [];
  for (let i = 0; i < n; i++) {
    const offset = -spanDays + Math.round(i * step);
    const date = iso(offset);
    cum += pnls[i];
    // capital déployé à date = base + apports dont la date ≤ offset
    let deployed = base;
    for (const d of deposits) if (d.offset <= offset) deployed += d.amount;
    const equity = deployed + cum;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity; // ≥ 0
    const underwaterPct = peak > 0 ? -(drawdown / peak) * 100 : 0;
    out.push({
      date,
      pnl: Math.round(pnls[i]),
      equity: Math.round(equity),
      cumPnL: Math.round(cum),
      peak: Math.round(peak),
      drawdown: Math.round(drawdown),
      // underwater en $ (≤ 0) — TOUJOURS honnête, quelle que soit la base ;
      // le % (underwaterPct) n'est fiable qu'avec une base d'équité réelle.
      underwater: -Math.round(drawdown),
      underwaterPct: Number(underwaterPct.toFixed(2)),
      capital: Math.round(deployed),
    });
  }
  return out;
}

// Génère une liste de pnls avec un biais (edge) + volatilité + une
// zone de drawdown injectée pour la lisibilité visuelle.
function makePnls({ count, seed, edge = 55, vol = 260, ddAt = null, ddDepth = 0 }) {
  const rnd = mulberry32(seed);
  const arr = [];
  for (let i = 0; i < count; i++) {
    // tirage centré : gaussienne approx (somme de 2 uniformes)
    const g = (rnd() + rnd() - 1); // ~[-1,1] triangulaire
    let pnl = edge + g * vol;
    arr.push(pnl);
  }
  // Injecte une séquence perdante contiguë (drawdown) si demandé.
  if (ddAt != null && ddDepth > 0) {
    const len = Math.max(3, Math.round(count * 0.14));
    for (let k = 0; k < len && ddAt + k < count; k++) {
      arr[ddAt + k] = -(ddDepth / len) * (0.7 + rnd() * 0.6);
    }
  }
  return arr;
}

/**
 * Scénarios exposés au lab. Chacun → { key, label, hint, base, data }.
 * `base` documente la convention (0 = cumPnL nu ; >0 = NLV/realEquity).
 */
export const SCENARIOS = {
  populated: () => ({
    key: 'populated',
    label: 'Peuplé (nominal)',
    hint: '38 trades · edge positif · un creux modéré · base cumPnL 0',
    base: 0,
    data: assemble({
      pnls: makePnls({ count: 38, seed: 7, edge: 60, vol: 300, ddAt: 22, ddDepth: 1600 }),
      spanDays: 182,
      base: 0,
    }),
  }),
  nlv: () => ({
    key: 'nlv',
    label: 'NLV réelle (avec apport)',
    hint: 'realEquity = capital déployé + cumPnL · apport +3 000 $ à mi-parcours',
    base: 8000,
    data: assemble({
      pnls: makePnls({ count: 38, seed: 7, edge: 60, vol: 300, ddAt: 22, ddDepth: 1600 }),
      spanDays: 182,
      base: 8000,
      deposits: [{ offset: -70, amount: 3000 }],
    }),
  }),
  extreme: () => ({
    key: 'extreme',
    label: 'Drawdown extrême',
    hint: '44 trades · gros creux -60 % en milieu de série · stress du rendu DD',
    base: 0,
    data: assemble({
      pnls: makePnls({ count: 44, seed: 19, edge: 35, vol: 420, ddAt: 18, ddDepth: 5200 }),
      spanDays: 210,
      base: 0,
    }),
  }),
  long: () => ({
    key: 'long',
    label: 'Longue histoire',
    hint: '132 clôtures sur ~2 ans · densité des marqueurs / ticks d’axe',
    base: 0,
    data: assemble({
      pnls: makePnls({ count: 132, seed: 5, edge: 42, vol: 240, ddAt: 60, ddDepth: 2400 }),
      spanDays: 730,
      base: 0,
    }),
  }),
  sparse: () => ({
    key: 'sparse',
    label: 'Naissant (3 trades)',
    hint: 'Tout début de compte — courbe quasi-plate, marqueurs isolés',
    base: 0,
    data: assemble({
      pnls: [420, -180, 650],
      spanDays: 14,
      base: 0,
    }),
  }),
  empty: () => ({
    key: 'empty',
    label: 'Vide (compte réel)',
    hint: 'Aucun trade clôturé — état réel actuel du portefeuille',
    base: 0,
    data: [],
  }),
};

export const SCENARIO_ORDER = ['populated', 'nlv', 'extreme', 'long', 'sparse', 'empty'];
