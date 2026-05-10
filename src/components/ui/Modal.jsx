// ═══════════════════════════════════════════════════════════════
//  MODAL v3.1 — Radix Dialog primitive (P6-19)
//
//  Migrates the hand-rolled overlay + focus trap to
//  @radix-ui/react-dialog. Preserves the exact same public API
//  ({ open, onClose, title, titleStyle, children }) so every call
//  site (History AddTradeModal, Journal AddEntryModal, Dashboard
//  DayDetail) works without changes.
//
//  Why migrate : Radix handles focus trap, Escape, scroll lock,
//  aria-hidden on siblings, portal rendering, and the modal/dialog
//  semantics correctly — all things the hand-rolled version
//  half-implemented. Bonus : styles moved to tokens.css instead of
//  inline so the dark/light theme swap is automatic.
// ═══════════════════════════════════════════════════════════════

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, titleStyle, children }) {
  return (
    <Dialog.Root
      open={!!open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-v3__overlay" />
        <Dialog.Content className="modal-v3__content" aria-describedby={undefined}>
          <div className="modal-v3__drag-bar" aria-hidden="true" />
          <header className="modal-v3__head">
            <Dialog.Title className="modal-v3__title" style={titleStyle}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="modal-v3__close" aria-label="Fermer">
                <X size={16} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          <div className="modal-v3__body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
