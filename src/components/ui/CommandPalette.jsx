// ═══════════════════════════════════════════════════════════════
//  COMMAND PALETTE (⌘K) — recherche globale pages · actions ·
//  positions. É3 §4.3 : refonte au langage cockpit — les styles
//  inline (palette JS legacy « T ») sont MORTS, remplacés par les
//  classes .cmdk__* (modals.css : verre sombre, hairlines, registre
//  terminal, ligne focus ambre). Icônes lucide (jeu unique É3).
//
//  Entrées vérifiées contre les routes réelles : hints ⌘0..9 alignés
//  sur AppShell NAV_PATHS (affichage seulement, rien n'est remappé
//  ici) ; « Purge des données » cible /settings/general (la zone
//  dangereuse vit là depuis 2.D — l'ex-cible Import était fausse).
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  Gauge,
  TrendingUp,
  List,
  BarChart3,
  Layers,
  Calendar,
  BookOpen,
  Upload,
  Settings,
  Shield,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { calculateOpenPositionPnl } from '../../utils/calculations';
import { toFloat } from '../../utils/math';

const ICONS = {
  grid: LayoutGrid,
  gauge: Gauge,
  trending: TrendingUp,
  list: List,
  bar: BarChart3,
  layers: Layers,
  cal: Calendar,
  book: BookOpen,
  upload: Upload,
  settings: Settings,
  shield: Shield,
  refresh: RefreshCw,
  trash: Trash2,
};

const navItems = [
  { label: 'Tableau de bord', shortcut: '⌘1', path: '/dashboard', icon: 'grid' },
  { label: 'Pré-marché', shortcut: '⌘0', path: '/premarket', icon: 'gauge' },
  { label: 'Positions', shortcut: '⌘2', path: '/trading/positions', icon: 'trending' },
  { label: 'Historique', shortcut: '⌘3', path: '/trading/history', icon: 'list' },
  { label: 'Greeks', shortcut: '⌘4', path: '/trading/greeks', icon: 'bar' },
  { label: 'Options Live', shortcut: '⌘5', path: '/trading/chain', icon: 'layers' },
  { label: 'Analytics', shortcut: '⌘6', path: '/insights/analytics', icon: 'bar' },
  { label: 'Calendrier', shortcut: '⌘7', path: '/insights/calendar', icon: 'cal' },
  { label: 'Journal', shortcut: '⌘8', path: '/insights/journal', icon: 'book' },
  { label: 'Import', shortcut: '⌘9', path: '/settings/import', icon: 'upload' },
  { label: 'Réglages', shortcut: '', path: '/settings/general', icon: 'settings' },
  { label: 'Réglages — API', shortcut: '', path: '/settings/api', icon: 'shield' },
];

const quickActions = [
  { label: 'Synchroniser (Flex)', icon: 'refresh', path: '/settings/import' },
  { label: 'Purge des données', icon: 'trash', path: '/settings/general' },
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
        // É3 panel — convention toneFromSign : zéro n'est ni gain ni
        // perte → encre neutre (l'ex `>= 0` peignait 0.0 % en vert).
        tone: pctChg > 0 ? 'profit' : pctChg < 0 ? 'loss' : 'mute',
        type: isOpt ? pos.ty : 'STK',
      };
    });
  }, [openPositions, lr]);

  // Build flat list for keyboard nav. Discriminant `kind` distinct du
  // champ `type` des positions (CALL/PUT/STK) — l'ancien code posait
  // `{ type: 'position', ...i }` et le spread ÉCRASAIT le discriminant :
  // les positions se rendaient en lignes fantômes sans label (bug
  // attrapé en É3, corrigé à la racine).
  const allItems = useMemo(() => {
    const q = query.toLowerCase();
    const filteredActions = quickActions.filter((i) => i.label.toLowerCase().includes(q));
    const filteredNav = navItems.filter((i) => i.label.toLowerCase().includes(q));
    const filteredPos = livePositions.filter(
      (i) => i.ticker.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
    );

    const items = [];
    if (filteredActions.length) {
      items.push({ kind: 'heading', label: 'Actions rapides' });
      filteredActions.forEach((i) => items.push({ ...i, kind: 'action' }));
    }
    if (filteredNav.length) {
      items.push({ kind: 'heading', label: 'Navigation' });
      filteredNav.forEach((i) => items.push({ ...i, kind: 'nav' }));
    }
    if (filteredPos.length) {
      items.push({ kind: 'heading', label: 'Positions ouvertes' });
      filteredPos.forEach((i) => items.push({ ...i, kind: 'position' }));
    }
    return items;
  }, [query, livePositions]);

  const selectableItems = useMemo(() => allItems.filter((i) => i.kind !== 'heading'), [allItems]);

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
      else if (item.kind === 'position') navigate('/trading/positions');
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
      <div className="cmdk__overlay" onClick={onClose} />

      <div className="cmdk__wrap">
        <div className="cmdk__panel" onClick={(e) => e.stopPropagation()}>
          <div className="cmdk__inputrow">
            <Search size={15} aria-hidden="true" />
            <input
              ref={inputRef}
              className="cmdk__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher page, action, ticker…"
              aria-label="Recherche globale"
            />
          </div>

          <div className="cmdk__list" role="listbox" aria-label="Résultats">
            {allItems.length === 0 && (
              <div className="cmdk__empty">
                <span className="cmdk__empty-title">Aucun résultat</span>
                <span className="cmdk__empty-sub">
                  Cherche une page, une action ou un ticker de position ouverte.
                </span>
              </div>
            )}
            {allItems.map((item) => {
              if (item.kind === 'heading') {
                return (
                  <div key={`h-${item.label}`} className="cmdk__heading">
                    {item.label}
                  </div>
                );
              }

              selectableIdx++;
              const isSelected = selectableIdx === selectedIdx;

              if (item.kind === 'position') {
                return (
                  <div
                    key={`p-${item.id}`}
                    className="cmdk__item"
                    data-selected={isSelected || undefined}
                    onClick={() => executeItem(item)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="cmdk__type">{item.type}</span>
                    <span className="cmdk__ticker">{item.ticker}</span>
                    <span className="cmdk__desc">{item.desc}</span>
                    {/* P&L latent = argent réel → toné (loi de couleur ;
                        zéro = neutre). */}
                    <span className={`cmdk__pnl cmdk__pnl--${item.tone}`}>{item.pnl}</span>
                  </div>
                );
              }

              const Icon = ICONS[item.icon];
              return (
                <div
                  key={`${item.kind}-${item.label}`}
                  className="cmdk__item"
                  data-selected={isSelected || undefined}
                  onClick={() => executeItem(item)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {Icon ? (
                    <span className="cmdk__icon">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                  {item.shortcut && <kbd className="cmdk__kbd">{item.shortcut}</kbd>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
