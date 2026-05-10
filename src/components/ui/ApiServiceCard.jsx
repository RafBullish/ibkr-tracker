// ═══════════════════════════════════════════════════════════════
//  API SERVICE CARD v3.0 « Midnight Terminal »
//
//  Compact card rendering one external-service status row. Used
//  by /settings/general (summary variant, row) and /settings/api
//  (detail variant, card) so the seven services stay in sync
//  regardless of which page the user opens (§13.4 fix).
// ═══════════════════════════════════════════════════════════════

import StatusBadge from './StatusBadge';

const STATUS_TO_VARIANT = {
  active: 'live',
  inactive: 'fail',
  checking: 'warn',
  unconfigured: 'na',
};

function statusLabel(status) {
  switch (status) {
    case 'active':
      return 'Connecté';
    case 'inactive':
      return 'Indisponible';
    case 'checking':
      return 'Check…';
    case 'unconfigured':
      return 'Non configuré';
    default:
      return status;
  }
}

function formatLastCheck(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    return d.toLocaleDateString('fr-CH');
  } catch {
    return '—';
  }
}

/**
 * @param {object} props
 * @param {'summary'|'detail'} [props.variant='detail']
 * @param {object} props.service  from useApiStatus keys (flex/cboe/…)
 * @param {() => void} [props.onTest]   only shown in 'detail'
 * @param {() => void} [props.onConfig] only shown in 'detail'
 */
export default function ApiServiceCard({ variant = 'detail', service, onTest, onConfig }) {
  if (!service) return null;
  const badge = STATUS_TO_VARIANT[service.status] || 'na';

  if (variant === 'summary') {
    return (
      <div className="api-service-row">
        <StatusBadge
          variant={badge}
          label={statusLabel(service.status)}
          pulse={service.status === 'active'}
          size="xs"
        />
        <div className="api-service-row__meta">
          <span className="api-service-row__name">{service.label}</span>
          <span className="api-service-row__time mono">{formatLastCheck(service.lastCheck)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="api-service-card" data-status={service.status}>
      <div className="api-service-card__head">
        <div className="api-service-card__head-left">
          <h3 className="api-service-card__name">{service.label}</h3>
          <StatusBadge
            variant={badge}
            label={statusLabel(service.status)}
            pulse={service.status === 'active'}
            size="xs"
          />
        </div>
      </div>
      <p className="api-service-card__desc">{service.description}</p>
      <dl className="api-service-card__meta">
        <div>
          <dt>Dernière vérification</dt>
          <dd className="mono">{formatLastCheck(service.lastCheck)}</dd>
        </div>
        <div>
          <dt>Latence</dt>
          <dd className="mono">{service.latency != null ? `${service.latency} ms` : '—'}</dd>
        </div>
      </dl>
      {service.error && <div className="api-service-card__error mono">{service.error}</div>}
      {(onTest || onConfig) && (
        <div className="api-service-card__actions">
          {onTest && (
            <button type="button" className="pg-mock-btn" onClick={onTest}>
              Tester maintenant
            </button>
          )}
          {onConfig && (
            <button type="button" className="pg-mock-btn pg-mock-btn--primary" onClick={onConfig}>
              Configurer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
