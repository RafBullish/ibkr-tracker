// ═══════════════════════════════════════════════════════════════
//  HISTORY DISTRIBUTION — histogramme P&L au système Obsidienne
//  (migré brique 2.A : kit OBS, LE tooltip unique ObsidienneTooltip —
//  le contentStyle inline 11px meurt). Lazy-loaded (recharts).
//
//  Couleurs : bucket ≥ 0 → up, < 0 → down (P&L réalisé par trade =
//  exception chartée DA §5), aplats désaturés fillOpacity .62 (parité
//  Distribution Héros 2, sans en importer le code). Animation au
//  premier montage uniquement (useMountOnlyAnimation).
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { OBS, useMountOnlyAnimation } from '../../components/charts/obsidienne';
import ObsidienneTooltip from '../../components/charts/ObsidienneTooltip';

const BUCKET_COUNT = 15;

function buildHistogram(trades) {
  if (!trades.length) return [];
  const values = trades.map((t) => t.pnlUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / BUCKET_COUNT || 1;

  const buckets = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    range: `${Math.round(min + i * step)}`,
    lo: min + i * step,
    hi: min + (i + 1) * step,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(BUCKET_COUNT - 1, Math.floor((v - min) / step));
    buckets[idx].count++;
  }

  return buckets;
}

const fmtBucket = (v) => {
  const sign = v < 0 ? '−' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString('de-CH')}`;
};

export default function HistoryDistribution({ trades, height = 220 }) {
  const data = useMemo(() => buildHistogram(trades), [trades]);
  const anim = useMountOnlyAnimation();
  if (!data.length) return null;
  return (
    <div className="obsidienne-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={OBS.color.grid} />
          <XAxis
            dataKey="range"
            tick={OBS.tick}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={OBS.tick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={
              <ObsidienneTooltip
                rows={(payload) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return [];
                  return [
                    { label: 'BUCKET', value: `${fmtBucket(d.lo)} → ${fmtBucket(d.hi)}` },
                    { label: 'TRADES', value: String(d.count) },
                  ];
                }}
                formatLabel={() => ''}
              />
            }
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} {...anim}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.lo >= 0 ? OBS.color.up : OBS.color.down}
                fillOpacity={0.62}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
