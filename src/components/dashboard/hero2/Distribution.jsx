// ═══════════════════════════════════════════════════════════════
//  HÉROS 2 (1.E) — PANNEAU DISTRIBUTION (3ᵉ vue roadmap). Histogramme
//  des issues par-trade par bucket $ — forme DISTINCTE du cumulé/quotidien
//  → sa propre place, toujours visible. Barres Recharts (ratifié),
//  code-split. Vert/rouge = argent réalisé (loi de couleur). Réglable
//  par période (partage le range du bloc). Langage terminal (OBS ticks).
// ═══════════════════════════════════════════════════════════════

import { Suspense, lazy } from 'react';
import useLiveTheme from '../../../hooks/useLiveTheme';
import { OBS } from '../../../components/charts/obsidienne';
import { fmtUsd } from '../hero1/kit';

const LazyRecharts = lazy(() =>
  import('recharts').then((mod) => ({ default: ({ children }) => children(mod) }))
);

// Libellé de bucket par borne BASSE → labels UNIQUES (pas de double « 0 »).
const labelEdge = (v) => {
  const a = Math.abs(v);
  const k = a >= 1000 ? `${(a / 1000).toFixed(1)}k` : `${a}`;
  return `${v < 0 ? '−' : ''}${k}`;
};

export default function Distribution({ dist }) {
  const T = useLiveTheme();
  const bins = dist?.bins || [];
  return (
    <div className="h2-dist">
      <div className="h2-dist__head">
        <span className="h2-dist__title">DISTRIBUTION</span>
        <span className="h2-dist__ctx">
          {dist?.n ? `${dist.n} trades · pas ${fmtUsd(dist.step)}` : '—'}
        </span>
      </div>
      <div className="h2-dist__body">
        {!bins.length ? (
          <div className="lh-canvas lh-canvas--empty">Aucune clôture sur la fenêtre</div>
        ) : (
          <Suspense fallback={<div className="lh-canvas lh-canvas--empty">Chargement…</div>}>
            <LazyRecharts>
              {(R) => {
                const data = bins.map((b, i) => ({ ...b, i, key: labelEdge(b.from) }));
                return (
                  <R.ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <R.BarChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: 4 }} barCategoryGap={2}>
                      <R.CartesianGrid stroke={OBS.color.grid} strokeDasharray="0" vertical={false} />
                      <R.XAxis dataKey="key" stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false} interval={0} height={20} />
                      <R.YAxis stroke={OBS.color.tick} tick={OBS.tick} axisLine={false} tickLine={false} width={28} allowDecimals={false} tickCount={5} />
                      <R.Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive={false} contentStyle={{ display: 'none' }} />
                      <R.Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                        {data.map((d) => (
                          <R.Cell key={d.i} fill={d.side === 'loss' ? T.loss : T.profit} fillOpacity={d.count ? 0.62 : 0.14} />
                        ))}
                      </R.Bar>
                    </R.BarChart>
                  </R.ResponsiveContainer>
                );
              }}
            </LazyRecharts>
          </Suspense>
        )}
      </div>
    </div>
  );
}
