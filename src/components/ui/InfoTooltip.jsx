// ═══════════════════════════════════════════════════════════════
//  INFO TOOLTIP v3.0 « Midnight Terminal »
//
//  Small ⓘ icon that surfaces a definition + formula + example
//  next to a metric label. Used on every non-trivial metric per
//  brief §13.6 (Sharpe, Sortino, Calmar, Omega, Kelly %, MFE,
//  MAE, IV Rank, Greeks, drawdown, etc.).
//
//  The content prop accepts either a string (used as the body)
//  or an object { title, body, formula, example, learnMoreUrl }
//  for structured tooltips that render consistently across pages.
// ═══════════════════════════════════════════════════════════════

import { Info, ExternalLink } from 'lucide-react';
import Tooltip from './Tooltip';

function InfoTooltipBody({ title, body, formula, example, learnMoreUrl }) {
  return (
    <div className="info-tooltip-body">
      {title && <div className="info-tooltip-title">{title}</div>}
      {body && <p className="info-tooltip-text">{body}</p>}
      {formula && (
        <div className="info-tooltip-formula">
          <span className="info-tooltip-formula-label">Formule</span>
          <code>{formula}</code>
        </div>
      )}
      {example && (
        <div className="info-tooltip-example">
          <span className="info-tooltip-formula-label">Exemple</span>
          <span>{example}</span>
        </div>
      )}
      {learnMoreUrl && (
        <a
          className="info-tooltip-learn"
          href={learnMoreUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          En savoir plus <ExternalLink size={11} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export default function InfoTooltip({
  content,
  children,
  label,
  size = 14,
  side = 'top',
  className,
}) {
  const body =
    typeof content === 'object' && content !== null && !content.type ? (
      <InfoTooltipBody {...content} />
    ) : (
      content
    );

  const trigger = children ?? (
    <button
      type="button"
      className={['info-tooltip-trigger', className].filter(Boolean).join(' ')}
      aria-label={label || "Afficher plus d'informations"}
    >
      <Info size={size} strokeWidth={2} aria-hidden="true" />
    </button>
  );

  return (
    <Tooltip content={body} side={side}>
      {trigger}
    </Tooltip>
  );
}
