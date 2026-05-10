// ═══════════════════════════════════════════════════════════════
//  MODULE PLACEHOLDER v4.0 « Institutional Terminal »
//
//  Squelette d'un module dashboard. Header monospace 22 px (CODE ·
//  LABEL) + corps centré « vide » jusqu'à ce que la brick suivante
//  remplisse le contenu (chart, table, heatmap…).
//
//  Le code 4-lettres correspond à un slot fonctionnel stable
//  (MASTER, RISK, GREEKS, POSI, WATCH, EARN, HEAT, IVR, INTRN,
//  SKEW, ALERT). Le label long est en français — convention
//  CLAUDE.md « All UI strings are French ».
// ═══════════════════════════════════════════════════════════════

export default function ModulePlaceholder({ code, label, area }) {
  return (
    <section className="module" style={area ? { gridArea: area } : undefined}>
      <header className="module-header">
        <span className="module-header__code">{code}</span>
        <span className="module-header__sep" aria-hidden="true">
          ·
        </span>
        <span className="module-header__label">{label}</span>
      </header>
      <div className="module-body module-body--empty">vide</div>
    </section>
  );
}
