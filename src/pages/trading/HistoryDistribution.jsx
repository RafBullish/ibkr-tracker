// ═══════════════════════════════════════════════════════════════
//  HISTORY DISTRIBUTION — lazy-loaded recharts histogram
//  Split from History.jsx so the heavy recharts bundle only loads
//  when the user actually reaches the distribution row.
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

export default function HistoryDistribution({ trades }) {
  const data = useMemo(() => buildHistogram(trades), [trades]);
  if (!data.length) return null;
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 3" />
          <XAxis
            dataKey="range"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
            formatter={(v) => [`${v} trade${v > 1 ? 's' : ''}`, 'Count']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.lo >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
