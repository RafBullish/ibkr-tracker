// ═══════════════════════════════════════════════════════════════
//  GREEK EVOLUTION CHART v3.0
//
//  Recharts LineChart tracking Net Δ/Γ/Θ/ν over the last 30 days.
//  Series are toggled via chips at the top. French locale x-axis.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import EmptyState from '../ui/EmptyState';
import { Activity } from 'lucide-react';

const SERIES = [
  { key: 'delta', label: 'Δ Delta', color: 'var(--accent)' },
  { key: 'gamma', label: 'Γ Gamma', color: '#A78BFA' },
  { key: 'theta', label: 'Θ Theta', color: 'var(--loss)' },
  { key: 'vega', label: 'ν Vega', color: '#60A5FA' },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="equity-tooltip" style={{ minWidth: 160 }}>
      <div className="equity-tooltip__date">
        {(() => {
          try {
            return format(parseISO(label), 'EEEE dd MMMM', { locale: fr });
          } catch {
            return label;
          }
        })()}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} className="equity-tooltip__row">
          <span className="equity-tooltip__label" style={{ color: p.color }}>
            {p.name}
          </span>
          <span className="equity-tooltip__value mono">
            {p.value == null ? '—' : p.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function GreekEvolutionChart({ data, height = 280, className }) {
  const [activeKeys, setActiveKeys] = useState(() => SERIES.map((s) => s.key));

  const toggle = (k) =>
    setActiveKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const hasData = Array.isArray(data) && data.length > 1;

  return (
    <div className={['greek-evo', className].filter(Boolean).join(' ')}>
      <div className="greek-evo__chips" role="group" aria-label="Séries affichées">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            className="greek-evo__chip"
            data-active={activeKeys.includes(s.key) || undefined}
            style={{ '--chip-color': s.color }}
            onClick={() => toggle(s.key)}
            aria-pressed={activeKeys.includes(s.key)}
          >
            <span className="greek-evo__chip-dot" aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="greek-evo__canvas" style={{ height }}>
        {!hasData ? (
          <EmptyState
            size="compact"
            icon={Activity}
            title="Pas encore d'historique des Greeks"
            description="Les valeurs apparaîtront dès que plusieurs snapshots auront été capturés."
          />
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  try {
                    return format(parseISO(v), 'dd MMM', { locale: fr });
                  } catch {
                    return '';
                  }
                }}
                tick={{
                  fill: 'var(--text-tertiary)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{
                  fill: 'var(--text-tertiary)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <RTooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {SERIES.filter((s) => activeKeys.includes(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color }}
                  isAnimationActive={true}
                  animationDuration={500}
                />
              ))}
              <Legend wrapperStyle={{ display: 'none' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
