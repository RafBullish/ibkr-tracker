// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — Brique 1.D « Héros 1 » (Equity/NLV pleine largeur)
//
//  DEV-only (garde import.meta.env.DEV côté route), HORS AppShell,
//  aucune entrée de nav, PURGÉ en fin de brique. N'écrit JAMAIS dans
//  localStorage : données 100 % synthétiques (fixtures.js) → zéro
//  risque pour le portefeuille réel de Rafael (§7).
//
//  3 directions pleine largeur, comparables sur les mêmes contrôles
//  globaux (scénario / traitement couleur / vue / période). Chaque
//  direction livre les invariants roadmap : crosshair, périodes,
//  toggle équité/drawdown, marqueurs de trades, pied de stats dense.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import HeroA from './heros/HeroA';
import HeroB from './heros/HeroB';
import HeroC from './heros/HeroC';
import { SCENARIOS, SCENARIO_ORDER } from './heros/fixtures';
import '../../styles/lab-heros.css';

const COLOR_MODES = [
  ['amber', 'Ambre-héros'],
  ['neutral', 'Neutre (encre)'],
  ['green', 'Legacy vert'],
];

export default function HerosLab() {
  const [scenarioKey, setScenarioKey] = useState('populated');
  const [colorMode, setColorMode] = useState('amber');
  const [view, setView] = useState('equity');
  const [range, setRange] = useState('ALL');

  const scenario = useMemo(() => SCENARIOS[scenarioKey](), [scenarioKey]);

  const shared = { scenario, range, setRange, view, setView, colorMode };

  return (
    <div className="lh-lab">
      <div className="lh-lab__bar">
        <div className="lh-lab__brand">
          <span className="lh-lab__brand-tag">LAB</span>
          <span className="lh-lab__brand-name">1.D · Héros 1 — Equity / NLV</span>
        </div>

        <div className="lh-lab__group">
          <span className="lh-lab__group-label">Scénario</span>
          <div className="lh-lab__seg">
            {SCENARIO_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                className="lh-lab__seg-btn"
                data-active={scenarioKey === k || undefined}
                onClick={() => setScenarioKey(k)}
              >
                {SCENARIOS[k]().label}
              </button>
            ))}
          </div>
        </div>

        <div className="lh-lab__group">
          <span className="lh-lab__group-label">Traitement couleur</span>
          <div className="lh-lab__seg">
            {COLOR_MODES.map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                className="lh-lab__seg-btn"
                data-active={colorMode === k || undefined}
                onClick={() => setColorMode(k)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="lh-lab__hint">{scenario.hint}</div>
      </div>

      <div className="lh-lab__stage">
        <div className="lh-lab__slot">
          <div className="lh-lab__slot-head">
            <span className="lh-lab__slot-key">A</span>
            <span className="lh-lab__slot-name">Le Bandeau Latéral — rail de stats persistant</span>
          </div>
          <HeroA {...shared} />
        </div>

        <div className="lh-lab__slot">
          <div className="lh-lab__slot-head">
            <span className="lh-lab__slot-key">B</span>
            <span className="lh-lab__slot-name">Le Ruban — pied de stats dense pleine largeur</span>
          </div>
          <HeroB {...shared} />
        </div>

        <div className="lh-lab__slot">
          <div className="lh-lab__slot-head">
            <span className="lh-lab__slot-key">C</span>
            <span className="lh-lab__slot-name">Le Diptyque — équité + underwater simultanés</span>
          </div>
          <HeroC {...shared} />
        </div>

        <div className="lh-lab__legend">
          <span><b>Crosshair</b> : survolez la courbe (ligne V au curseur + ligne H suiveuse).</span>
          <span><b>Marqueurs</b> : chaque point = une clôture ; vert = gain réel, rouge = perte réelle (loi de couleur).</span>
          <span><b>Courbe</b> : la série (valeur de portefeuille) est neutre/ambre — jamais colorée par P&L.</span>
        </div>
      </div>
    </div>
  );
}
