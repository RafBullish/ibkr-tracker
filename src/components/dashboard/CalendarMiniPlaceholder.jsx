// ═══════════════════════════════════════════════════════════════
//  CALENDAR MINI PLACEHOLDER — Phase C.1
//
//  Module placeholder en attendant Phase C.3 (CalendarMini réel).
//  Le titre inclut le mois courant pour rester contextuel pendant
//  le développement.
// ═══════════════════════════════════════════════════════════════

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export default function CalendarMiniPlaceholder({ area = 'calendar' }) {
  const now = new Date();
  const month = MONTHS_FR[now.getMonth()];
  const year = now.getFullYear();
  return (
    <section className="module" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">{`Calendar · ${month} ${year}`}</span>
        <span className="module-header__hint">Phase C.3</span>
      </header>
      <div className="module-placeholder">
        <span className="module-placeholder__label">Module en cours de développement</span>
        <span className="module-placeholder__sub">PnL heatmap + earnings + events</span>
      </div>
    </section>
  );
}
