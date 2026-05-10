import { isValidElement } from 'react';
import { Inbox } from 'lucide-react';

/**
 * @param {object} props
 * @param {React.ElementType|React.ReactNode} [props.icon=Inbox]
 *   Either a lucide component (legacy API — rendered with default size +
 *   strokeWidth) or an already-instantiated ReactNode (new API — rendered
 *   as-is so the caller controls size/color).
 * @param {string} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.action]
 *   Legacy single-CTA slot. Kept for backwards compatibility; new code
 *   should use `actions` instead.
 * @param {Array<{label: string, onClick: function, variant?: 'primary'|'secondary'}>} [props.actions]
 *   Up to 2 actions. When both `action` and `actions` are supplied,
 *   `actions` wins and a console.warn fires in dev.
 * @param {React.ReactNode} [props.illustration]
 *   Optional preview/mockup rendered at 0.5 opacity between the
 *   description and the actions row.
 * @param {'default'|'compact'} [props.size='default']
 * @param {string} [props.className]
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actions,
  illustration,
  size = 'default',
  className,
}) {
  if (import.meta.env.DEV && action && actions) {
    console.warn('EmptyState: `action` and `actions` both provided — `actions` will be used');
  }

  const cls = ['empty-state', size === 'compact' && 'empty-state--compact', className]
    .filter(Boolean)
    .join(' ');

  const iconSize = size === 'compact' ? 32 : 48;
  const renderedIcon = isValidElement(Icon) ? Icon : <Icon size={iconSize} strokeWidth={1.5} />;

  const effectiveActions = Array.isArray(actions) ? actions.slice(0, 2) : null;

  return (
    <div className={cls} role="status">
      <div className="empty-state__icon" aria-hidden="true">
        {renderedIcon}
      </div>
      <div className="empty-state__title" role="heading" aria-level="2">
        {title}
      </div>
      {description && <p className="empty-state__desc">{description}</p>}
      {illustration && (
        <div className="empty-state__illustration" aria-hidden="true">
          {illustration}
        </div>
      )}
      {effectiveActions && effectiveActions.length > 0 ? (
        <div className="empty-state__actions">
          {effectiveActions.map((a, i) => (
            <button
              key={i}
              type="button"
              className={`pg-mock-btn${a.variant === 'primary' ? ' pg-mock-btn--primary' : ''}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : action ? (
        <div className="empty-state__action">{action}</div>
      ) : null}
    </div>
  );
}
