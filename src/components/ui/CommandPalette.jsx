// ═══════════════════════════════════════════════════════════════
//  COMMAND PALETTE — ⌘K quick search, Calm Trading style
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { calculateOpenPositionPnl } from '../../utils/calculations';
import { toFloat } from '../../utils/math';
import T from '../../theme/tokens';
import Icons from './Icons';

const navItems = [
  { label: 'Tableau de bord', shortcut: '⌘1', path: '/dashboard', icon: 'grid' },
  { label: 'Positions', shortcut: '⌘2', path: '/trading/positions', icon: 'trending' },
  { label: 'Historique', shortcut: '', path: '/trading/history', icon: 'list' },
  { label: 'Options Live', shortcut: '⌘4', path: '/trading/chain', icon: 'layers' },
  { label: 'Analytics', shortcut: '⌘5', path: '/insights/analytics', icon: 'bar' },
  { label: 'Journal', shortcut: '', path: '/insights/journal', icon: 'book' },
  { label: 'Calendrier', shortcut: '', path: '/insights/calendar', icon: 'cal' },
  { label: 'Réglages', shortcut: '', path: '/settings/general', icon: 'settings' },
];

const quickActions = [
  { label: 'Synchroniser (Flex)', icon: 'refresh', path: '/settings/import' },
  { label: 'Options Live', icon: 'layers', path: '/trading/chain' },
  { label: 'Purge des données', icon: 'settings', path: '/settings/import' },
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const lr = toFloat(settings?.liveRate) || 1;

  // Build positions from store
  const livePositions = useMemo(() => {
    return openPositions.map((pos) => {
      const r = calculateOpenPositionPnl(pos, lr);
      const costBasis = Math.abs(r.costBasisUsd);
      const pctChg = costBasis > 0 ? (r.unrealizedPnlUsd / costBasis) * 100 : 0;
      const isOpt = pos.as === 'Option';
      const desc = isOpt
        ? `${pos.ty} ${toFloat(pos.st).toFixed(0)} ${(pos.ex || '').slice(5)}`
        : 'Stock';
      return {
        id: pos.id,
        ticker: pos.tk,
        desc,
        pnl: `${pctChg >= 0 ? '+' : ''}${pctChg.toFixed(1)}%`,
        positive: pctChg >= 0,
        type: isOpt ? pos.ty : 'STK',
      };
    });
  }, [openPositions, lr]);

  // Build flat list for keyboard nav
  const allItems = useMemo(() => {
    const q = query.toLowerCase();
    const filteredActions = quickActions.filter((i) => i.label.toLowerCase().includes(q));
    const filteredNav = navItems.filter((i) => i.label.toLowerCase().includes(q));
    const filteredPos = livePositions.filter(
      (i) => i.ticker.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
    );

    const items = [];
    if (filteredActions.length) {
      items.push({ type: 'heading', label: 'Actions rapides' });
      filteredActions.forEach((i) => items.push({ type: 'action', ...i }));
    }
    if (filteredNav.length) {
      items.push({ type: 'heading', label: 'Navigation' });
      filteredNav.forEach((i) => items.push({ type: 'nav', ...i }));
    }
    if (filteredPos.length) {
      items.push({ type: 'heading', label: 'Positions ouvertes' });
      filteredPos.forEach((i) => items.push({ type: 'position', ...i }));
    }
    return items;
  }, [query, livePositions]);

  const selectableItems = useMemo(() => allItems.filter((i) => i.type !== 'heading'), [allItems]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const executeItem = useCallback(
    (item) => {
      if (item.path) navigate(item.path);
      else if (item.type === 'position') navigate('/trading/positions');
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, selectableItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && selectableItems[selectedIdx]) {
        e.preventDefault();
        executeItem(selectableItems[selectedIdx]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, selectableItems, selectedIdx, onClose, executeItem]);

  if (!open) return null;

  let selectableIdx = -1;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.15s ease-out',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 301,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 'min(20vh, 140px)',
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 520,
            margin: '0 16px',
            background: 'rgba(17,20,28,0.92)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: `1px solid ${T.glass.borderHover}`,
            borderRadius: 20,
            boxShadow:
              '0 24px 80px rgba(0,0,0,0.60), 0 0 60px rgba(99,102,241,0.06), 0 0 0 1px rgba(255,255,255,0.05)',
            overflow: 'hidden',
            animation: 'slideDown 0.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 18px',
              borderBottom: `1px solid rgba(148,163,184,0.08)`,
            }}
          >
            {Icons.search(T.text.muted, 16)}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher page, action, ticker…"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: T.text.primary,
                fontFamily: T.fonts.sans,
                fontSize: 15,
                caretColor: T.accent.main,
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
            {allItems.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: T.text.muted, fontSize: 13 }}>
                Aucun résultat
              </div>
            )}
            {allItems.map((item) => {
              if (item.type === 'heading') {
                return (
                  <div
                    key={`h-${item.label}`}
                    style={{
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      color: T.text.muted,
                      fontWeight: 600,
                      padding: '8px 10px 6px',
                      fontFamily: T.fonts.sans,
                    }}
                  >
                    {item.label}
                  </div>
                );
              }

              selectableIdx++;
              const isSelected = selectableIdx === selectedIdx;

              if (item.type === 'position') {
                const pnlColor = item.positive ? T.profit : T.loss;
                return (
                  <div
                    key={`p-${item.id}`}
                    onClick={() => executeItem(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? T.surface.overlay : 'transparent',
                      color: isSelected ? T.text.primary : T.text.secondary,
                      fontSize: 13,
                      fontFamily: T.fonts.sans,
                      transition: 'background 0.12s',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        // Colour law: CALL/PUT/STK are neutral instrument
                        // categories, never money tones — ink-soft only.
                        background: `${T.text.secondary}1F`,
                        color: T.text.secondary,
                      }}
                    >
                      {item.type}
                    </span>
                    <span style={{ fontFamily: T.fonts.mono, fontWeight: 700 }}>{item.ticker}</span>
                    <span style={{ color: T.text.muted, fontSize: 12 }}>{item.desc}</span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: T.fonts.mono,
                        fontSize: 12,
                        fontWeight: 600,
                        color: pnlColor,
                      }}
                    >
                      {item.pnl}
                    </span>
                  </div>
                );
              }

              // nav or action
              return (
                <div
                  key={`${item.type}-${item.label}`}
                  onClick={() => executeItem(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected ? T.surface.overlay : 'transparent',
                    color: isSelected ? T.text.primary : T.text.secondary,
                    fontSize: 13,
                    fontFamily: T.fonts.sans,
                    transition: 'background 0.12s',
                  }}
                >
                  {Icons[item.icon]?.(isSelected ? T.accent.main : T.text.muted, 15)}
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <kbd
                      style={{
                        marginLeft: 'auto',
                        fontFamily: T.fonts.mono,
                        fontSize: 9,
                        color: T.text.muted,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(148,163,184,0.05)',
                        border: `1px solid rgba(148,163,184,0.08)`,
                      }}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
