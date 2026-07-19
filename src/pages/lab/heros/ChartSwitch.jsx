// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros — ChartSwitch : sélectionne le MOTEUR de graphe.
//  DEV-only, purgé 1.D.
//    'tv'       → TvChart (lightweight-charts, canvas « terminal »)
//    'recharts' → NlvChart (repli si la dépendance est refusée)
//  Permet à Rafael de comparer les deux et de décider de la dépendance.
// ═══════════════════════════════════════════════════════════════

import TvChart from './TvChart';
import NlvChart from './NlvChart';

export default function ChartSwitch({ engine = 'tv', data, view, line, intraday }) {
  if (engine === 'recharts') return <NlvChart data={data} view={view} line={line} />;
  return <TvChart data={data} view={view} line={line} intraday={intraday} />;
}
