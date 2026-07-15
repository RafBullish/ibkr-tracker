// ═══════════════════════════════════════════════════════════════
//  OBSIDIENNE TOOLTIP — LE tooltip unique des charts (v1.0 · 1.A)
//
//  Verre noir : fond rgba(10,10,12,.85) + blur 12, hairline, radius 8.
//  Label micro-caps 12px ink-mute ; valeurs IBM Plex Sans Condensed
//  700 tabulaires 15px (texte data-viz, exempt du plancher page 17).
//  Styles dans src/styles/obsidienne-charts.css (.obs-tooltip*).
//
//  Loi de couleur : la valeur hérite de la sémantique de la série —
//  tone 'up'/'down' UNIQUEMENT pour du P&L d'argent réel ; tout le
//  reste (greeks, prix, equity) reste neutre (ink-pure).
//
//  API générique (recharts <Tooltip content={<ObsidienneTooltip/>}>) :
//    formatLabel? : (label) => string
//    formatValue? : (value, entry, index) => string | { text, tone }
//    rows?        : (payload, label) => [{ label, value, tone? }]
//                   — escape hatch multi-lignes (ex. CUMUL + DAILY Δ)
//                   quand les lignes dérivent du payload de la row et
//                   non des séries. tone ∈ 'up' | 'down' | undefined.
// ═══════════════════════════════════════════════════════════════

function toneClass(tone) {
  if (tone === 'up') return ' obs-tooltip__value--up';
  if (tone === 'down') return ' obs-tooltip__value--down';
  return '';
}

export default function ObsidienneTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  rows,
}) {
  if (!active || !payload?.length) return null;

  const shownLabel = formatLabel ? formatLabel(label) : label;

  let lines;
  if (typeof rows === 'function') {
    lines = rows(payload, label) || [];
  } else {
    lines = payload.map((entry, i) => {
      const raw = formatValue ? formatValue(entry.value, entry, i) : entry.value;
      const isObj = raw != null && typeof raw === 'object';
      return {
        label: entry.name || entry.dataKey,
        value: isObj ? raw.text : raw,
        tone: isObj ? raw.tone : undefined,
      };
    });
  }

  return (
    <div className="obs-tooltip">
      {shownLabel != null && shownLabel !== '' ? (
        <div className="obs-tooltip__label">{shownLabel}</div>
      ) : null}
      {lines.map((line, i) => (
        <div key={`${line.label}-${i}`} className="obs-tooltip__row">
          <span className="obs-tooltip__name">{line.label}</span>
          <span className={`obs-tooltip__value${toneClass(line.tone)}`}>{line.value}</span>
        </div>
      ))}
    </div>
  );
}
