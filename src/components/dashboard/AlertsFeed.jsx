// ═══════════════════════════════════════════════════════════════
//  ALERTS FEED — module Dashboard (row 5, col 9-12)
//
//  U7 : vue agrégée des signaux d'attention dérivés de l'état courant
//  (cf. useAlertsFeed). Chaque entrée = { id, severity, message,
//  ticker?, target } ; clic → navigation pure vers la cible (les
//  alertes de position pointent vers /trading/positions?focus={id} →
//  surlignage U4). Pas d'horodatage : ces signaux sont dérivés de
//  l'état présent, pas d'événements datés. Empty state POSITIF.
// ═══════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';

const SEV_LABEL = { critical: 'URGENT', warning: 'ALERTE' };
const SEV_TONE = { critical: 'loss', warning: 'warn' };

export default function AlertsFeed({ data, area = 'alert' }) {
  const navigate = useNavigate();
  const entries = Array.isArray(data) ? data : [];
  const isEmpty = entries.length === 0;

  return (
    <section className="module alerts-feed" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Alerts Feed</span>
        {!isEmpty && (
          <span className="module-header__hint">
            {entries.length} active{entries.length > 1 ? 's' : ''}
          </span>
        )}
      </header>
      <div className="module-body alerts-feed__body">
        {isEmpty ? (
          <div className="alerts-feed__empty module-empty">
            <span className="module-empty__title">Aucune alerte active</span>
            <span className="module-empty__sub">
              Tout est sous contrôle — aucune position ne franchit de seuil (DTE / SL / time-stop)
              et la limite de perte du jour n&apos;est pas atteinte.
            </span>
          </div>
        ) : (
          <ul className="alerts-feed__list" aria-label="Alertes actives">
            {entries.map((e) => (
              <li
                key={e.id}
                className="alerts-feed__row alerts-feed__row--clickable"
                onClick={() => navigate(e.target)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    navigate(e.target);
                  }
                }}
                tabIndex={0}
                role="link"
                title={e.message}
              >
                <span
                  className={`alerts-feed__level alerts-feed__level--${SEV_TONE[e.severity] || 'mute'}`}
                >
                  {SEV_LABEL[e.severity] || e.severity}
                </span>
                <span className="alerts-feed__sep" aria-hidden="true">
                  │
                </span>
                <span className="alerts-feed__msg">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
