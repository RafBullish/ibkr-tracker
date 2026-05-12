// ═══════════════════════════════════════════════════════════════
//  TRADE HISTORY PLACEHOLDER — Phase C.1
//
//  Module placeholder en attendant Phase C.2 (TradeHistory réel).
//  Occupe sa cellule grid avec un message minimaliste — pas de
//  layout shift quand le vrai module sera livré.
// ═══════════════════════════════════════════════════════════════

export default function TradeHistoryPlaceholder({ area = 'history' }) {
  return (
    <section className="module" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Trade History</span>
        <span className="module-header__hint">Phase C.2</span>
      </header>
      <div className="module-placeholder">
        <span className="module-placeholder__label">Module en cours de développement</span>
        <span className="module-placeholder__sub">15 derniers trades fermés · 14 colonnes</span>
      </div>
    </section>
  );
}
