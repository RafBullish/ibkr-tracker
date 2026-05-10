// ═══════════════════════════════════════════════════════════════
//  TOOLTIP v3.0 « Midnight Terminal »
//
//  Thin wrapper around @radix-ui/react-tooltip that injects our
//  glass tokens for the content panel and supplies sensible
//  defaults (200ms delay, 8px side offset, portal rendering,
//  collision-aware placement).
//
//  Accepts both the new `content` prop and the legacy `text` prop
//  (alias) so existing call sites keep working until their page
//  refactor.
//
//  Usage:
//    <Tooltip content="Explanation">
//      <button>Hover me</button>
//    </Tooltip>
//
//    <Tooltip content={<div>Rich content</div>} side="right">
//      <IconButton />
//    </Tooltip>
//
//  The component forwards the trigger element via Radix's asChild
//  pattern, so it does not add a wrapper in the DOM.
// ═══════════════════════════════════════════════════════════════

import * as RadixTooltip from '@radix-ui/react-tooltip';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children       the trigger element
 * @param {React.ReactNode} [props.content]      the tooltip body
 * @param {React.ReactNode} [props.text]         legacy alias for content
 * @param {'top'|'right'|'bottom'|'left'} [props.side='top']
 * @param {'start'|'center'|'end'} [props.align='center']
 * @param {number} [props.delayDuration=200]
 * @param {number} [props.sideOffset=8]
 * @param {string} [props.className]
 * @param {boolean} [props.defaultOpen]
 * @param {number|string} [props.maxWidth]       legacy prop, applied via style
 */
export default function Tooltip({
  children,
  content,
  text,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  sideOffset = 8,
  className,
  defaultOpen,
  maxWidth,
}) {
  const body = content ?? text;
  if (body == null || body === '') return children;

  return (
    <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={100}>
      <RadixTooltip.Root defaultOpen={defaultOpen}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            collisionPadding={8}
            className={['tooltip-content', className].filter(Boolean).join(' ')}
            style={
              maxWidth
                ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }
                : undefined
            }
          >
            {body}
            <RadixTooltip.Arrow className="tooltip-arrow" width={10} height={5} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
