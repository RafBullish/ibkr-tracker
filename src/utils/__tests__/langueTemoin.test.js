// ═══════════════════════════════════════════════════════════════
//  É3.3 — TÉMOIN DE LANGUE : les libellés condamnés par le prompt ne
//  doivent plus exister comme TEXTE RENDU dans les sources du
//  périmètre (Dashboard + chrome + jumeaux), et les traductions
//  imposées doivent y être. Scan statique des sources (même esprit
//  que check:color-law) — les occurrences en commentaire sont évitées
//  en ciblant des motifs JSX/props précis.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '../..');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

const FILES = [
  'components/dashboard/LivePositions.jsx',
  'components/dashboard/TradeHistory.jsx',
  'components/dashboard/RiskMatrix.jsx',
  'components/dashboard/hero1/PortfolioDeck.jsx',
  'components/dashboard/hero2/RealizedDeck.jsx',
  'components/dashboard/Watchlist.jsx',
  'components/ui/DataTable.jsx',
  'pages/trading/Positions.jsx',
  'pages/trading/History.jsx',
];

// Motifs de texte RENDU condamnés (JSX text ou valeur de prop label).
const FORBIDDEN = [
  />Trade History</,
  />\s*Live Positions/,
  /WINS \{aggStats/,
  /LOSSES \{aggStats/,
  /IN PROFIT \{/,
  /IN LOSS \{/,
  />Best Day</,
  />Avg Win</,
  />Avg Loss</,
  /label: 'Entry'/,
  /label: 'Exit'/,
  /label: 'Hold'/,
  /label: 'Qty'/,
  /label: 'DTE entry'/,
  /label="Days Since Peak/,
  /label="Recovery to Peak"/,
  />Export CSV</,
  />Σ UNREAL \$</,
  />Σ NOTIONAL</,
  />Σ MAX RISK</,
  />CLOSEST DTE</,
  />Unreal \$</,
  />Unreal %</,
  />\s*\+ Add\b/,
  /'EXPOSURE'/,
  /'UNREALIZED'/,
  /'REALIZED'/,
  /'DAY'/,
  /label="STREAK"/,
  /GROSS GAINS/,
];

// Traductions imposées qui DOIVENT être rendues quelque part.
const REQUIRED = [
  'Positions ouvertes ·',
  '>Historique<',
  'Cockpit · Performance · Risque · Comportement',
  'Métriques de performance',
  'Drawdown · Séries',
  'Stats gains / pertes',
  'EN GAIN {',
  'EN PERTE {',
  'GAGNANTS {',
  'PERDANTS {',
  ">Meilleur jour<",
  ">Gain moy.<",
  ">Perte moy.<",
  "label: 'Entrée'",
  "label: 'Durée'",
  'Exporter CSV',
  'Σ LATENT $',
  '>Σ NOTIONNEL<',
  '>Σ RISQUE MAX<',
  '>DTE PROCHE<',
  '+ Ajouter',
  "label=\"Depuis pic · RÉAL\"",
  "label=\"Récupération\"",
  // 1.G-b — la bande FORME (label="SÉRIE") est morte ; la SÉRIE (français)
  // vit désormais dans le PortfolioDeck (« SÉRIE EN COURS »).
  "'SÉRIE EN COURS'",
];

describe('É3.3 — témoin de langue (sources du périmètre)', () => {
  const all = FILES.map((f) => `/* ${f} */\n${read(f)}`).join('\n');

  it.each(FORBIDDEN.map((rx) => [String(rx), rx]))(
    'libellé condamné absent : %s',
    (_name, rx) => {
      expect(all).not.toMatch(rx);
    }
  );

  it.each(REQUIRED.map((s) => [s]))('traduction imposée présente : %s', (s) => {
    expect(all).toContain(s);
  });
});
