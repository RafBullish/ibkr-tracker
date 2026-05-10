// ═══════════════════════════════════════════════════════════════
//  TOAST v3.0 — Global notification system
//
//  Stacked right-side toasts with ARIA live region, auto-dismiss,
//  per-type icon/colour, and themed glassmorphic styling.
//
//  Public API
//  ─────────
//  const showToast = useToast();
//
//  // Legacy callable (positional) — kept for existing consumers.
//  showToast('msg', 'success', 4000);
//
//  // Method API (preferred) — options bag support detail + action + duration.
//  showToast.success('5 trades importés');
//  showToast.error('Sync Flex échoué', { detail: 'Token expiré' });
//  showToast.info('Rafraîchissement…', { action: { label: 'Annuler', onClick } });
//  showToast.warning('Fallback Yahoo actif', { duration: 6000 });
//
//  Stack is FIFO with a max of 3 items — the 4th call evicts the oldest.
//  Dismiss via: X button, click anywhere on the toast, Enter/Space when
//  focused. Honors `prefers-reduced-motion`.
// ═══════════════════════════════════════════════════════════════
/* eslint-disable react-refresh/only-export-components -- Provider + hook intentionally colocated. */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

const ToastContext = createContext(null);

const MAX_STACK = 3;
const DEFAULT_DURATION = 4000;
const CLOSE_ANIM_MS = 220;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[toast.type] || Info;
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Schedule the fade-in on the next frame. When prefers-reduced-motion
    // is set, the CSS media query disables the transition so the "fade"
    // becomes an instant paint — no JS branching needed here.
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = useCallback(() => {
    if (prefersReducedMotion) {
      onDismiss(toast.id);
      return;
    }
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), CLOSE_ANIM_MS);
  }, [onDismiss, toast.id, prefersReducedMotion]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleClose]
  );

  const handleActionClick = useCallback(
    (e) => {
      e.stopPropagation();
      toast.action?.onClick?.();
      handleClose();
    },
    [toast.action, handleClose]
  );

  const handleCloseBtnClick = useCallback(
    (e) => {
      e.stopPropagation();
      handleClose();
    },
    [handleClose]
  );

  const isAlert = toast.type === 'error' || toast.type === 'warning';

  return (
    <div
      className="toast"
      data-visible={visible}
      data-type={toast.type || 'info'}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      tabIndex={0}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <span className="toast__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <div className="toast__body">
        <span className="toast__message">{toast.message}</span>
        {toast.detail && <span className="toast__detail">{toast.detail}</span>}
      </div>
      {toast.action && (
        <button type="button" className="toast__action" onClick={handleActionClick}>
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="toast__close"
        onClick={handleCloseBtnClick}
        aria-label="Fermer la notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = DEFAULT_DURATION, extras = {}) => {
      const id = ++seq.current;
      const toast = {
        id,
        message,
        type,
        detail: extras?.detail,
        action: extras?.action,
      };

      setToasts((prev) => {
        const next = [...prev, toast];
        if (next.length <= MAX_STACK) return next;
        // FIFO: evict the oldest toast.
        return next.slice(next.length - MAX_STACK);
      });

      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  // Enriched API: callable (legacy) + method shorthands. Object.assign
  // attaches the methods to a fresh wrapper fn in one expression.
  // `showToast` here is a stable useCallback reference; the refs-rule
  // false positive is silenced with a targeted disable.
  /* eslint-disable react-hooks/refs -- showToast is a memoized callback, not a mutable ref. */
  const api = useMemo(
    () =>
      Object.assign(
        (message, type = 'info', duration = DEFAULT_DURATION, extras = {}) =>
          showToast(message, type, duration, extras),
        {
          success: (msg, opts = {}) =>
            showToast(msg, 'success', opts.duration ?? DEFAULT_DURATION, opts),
          error: (msg, opts = {}) =>
            showToast(msg, 'error', opts.duration ?? DEFAULT_DURATION, opts),
          info: (msg, opts = {}) => showToast(msg, 'info', opts.duration ?? DEFAULT_DURATION, opts),
          warning: (msg, opts = {}) =>
            showToast(msg, 'warning', opts.duration ?? DEFAULT_DURATION, opts),
        }
      ),
    [showToast]
  );
  /* eslint-enable react-hooks/refs */

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    []
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
