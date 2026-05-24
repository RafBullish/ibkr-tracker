// ═══════════════════════════════════════════════════════════════
//  COMMAND BAR v4.2 — 4K refonte Phase B.2 (sentence-case tabs, 64 px)
//
//  Top bar 64 px sticky. Three zones :
//    1. Left  (≥ 220 px)  — QC mini-badge + QUANTUMCALL + breadcrumb
//    2. Centre (flex 1)   — 10 navigation tabs (mots entiers, sentence
//                           case, underline teal sur l'onglet actif)
//    3. Right (~280 px)   — search bar (icône seule) + ModePill REAL
//
//  Anciennement les tabs étaient des codes 4-lettres (DASH, POS…).
//  Phase B.2 les remplace par des mots entiers (Dashboard, Positions…),
//  text-transform: none, font-size 13 px. L'underline 2 px ancre la
//  tab active à la border-bottom du shell. Tooltips supprimés —
//  le mot entier est déjà autodescriptif.
//
//  Theme picker reste hosté par StatusBar.
// ═══════════════════════════════════════════════════════════════

import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { FRESHNESS } from '../../constants/timing';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

// `tab`   — label affiché dans la nav (sentence case, mots entiers)
// `label` — libellé long en français pour aria-label + tooltip
// 4K refonte Phase B.2 : on délaisse les codes 4-lettres Bloomberg-
// style au profit de mots entiers, plus lisibles en 4K et moins
// dépendants du tooltip pour l'auto-description.
const NAV = [
  { tab: 'Dashboard', label: 'Tableau de bord', path: '/dashboard', shortcut: '⌘1' },
  { tab: 'Premarket', label: 'Pré-marché', path: '/premarket', shortcut: '' },
  { tab: 'Positions', label: 'Positions', path: '/trading/positions', shortcut: '⌘2' },
  { tab: 'History', label: 'Historique', path: '/trading/history', shortcut: '⌘3' },
  {
    tab: 'Greeks',
    label: 'Greeks Center',
    path: '/trading/greeks',
    shortcut: '⌘4',
    flag: 'GREEK_CENTER',
  },
  { tab: 'Chain', label: 'Chain Options', path: '/trading/chain', shortcut: '⌘5' },
  { tab: 'Analytics', label: 'Analytics', path: '/insights/analytics', shortcut: '⌘6' },
  { tab: 'Calendar', label: 'Calendrier', path: '/insights/calendar', shortcut: '⌘7' },
  { tab: 'Journal', label: 'Journal', path: '/insights/journal', shortcut: '⌘8' },
  { tab: 'Import', label: 'Import', path: '/settings/import', shortcut: '⌘9' },
];

const BREADCRUMB_MAP = {
  '/dashboard': 'Tableau de bord',
  '/premarket': 'Pré-marché',
  '/trading/positions': 'Positions',
  '/trading/history': 'Historique',
  '/trading/orders': 'Historique',
  '/trading/chain': 'Chain Options',
  '/trading/greeks': 'Greeks Center',
  '/insights/analytics': 'Analytics',
  '/insights/journal': 'Journal',
  '/insights/calendar': 'Calendrier',
  '/settings/general': 'Réglages',
  '/settings/import': 'Import',
  '/settings/api': 'API',
};

function isActive(navPath, pathname) {
  if (navPath === '/dashboard') return pathname === navPath;
  return pathname === navPath || pathname.startsWith(navPath);
}

function QCLogo({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cmdbar__logo"
      aria-label="QuantumCall — accueil"
    >
      <span className="cmdbar__logo-mark" aria-hidden="true">
        QC
      </span>
      <span className="cmdbar__logo-name">QUANTUMCALL</span>
    </button>
  );
}

function ModePill({ variant }) {
  // 4K refonte Phase B — REAL/PAPER pill with leading dot.
  // `variant` is one of 'live' | 'real' | 'paper' (cf. CommandBar logic).
  // Visual semantics : 'live' uses profit accent at full intensity,
  // 'real' uses profit (slightly muted), 'paper' uses amber to flag
  // that the data shown is fixture / pre-trade.
  const labels = { live: 'LIVE', real: 'REAL', paper: 'PAPER' };
  const titles = {
    live: 'Données IBKR temps réel actives',
    real: 'Positions réelles · données stockées localement',
    paper: 'Mode paper — aucune position réelle',
  };
  return (
    <span
      className="cmdbar__mode-pill"
      data-mode={variant}
      role="status"
      title={titles[variant] || ''}
    >
      <span
        className={`cmdbar__mode-dot${
          variant === 'live' || variant === 'real' ? ' cmdbar__live-dot' : ''
        }`}
        aria-hidden="true"
      />
      <span>{labels[variant] || variant?.toUpperCase()}</span>
    </span>
  );
}

export default function CommandBar({ onOpenCommand }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isCompact = useMediaQuery('(max-width: 1023px)');

  const breadcrumb = BREADCRUMB_MAP[pathname];
  const navItems = NAV.filter(
    (n) => !n.flag || (n.flag === 'GREEK_CENTER' && FEATURE_GREEK_CENTER)
  );

  // Mode badge logic mirrored from legacy Header.
  const live = settings?.ibkrLiveData;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const useLive =
    live?.timestamp && nowMs - new Date(live.timestamp).getTime() < FRESHNESS.LIVE_DATA_MAX_AGE_MS;
  const hasPositions = (openPositions || []).length > 0;
  const modeVariant = useLive ? 'live' : hasPositions ? 'real' : 'paper';

  return (
    <header className="cmdbar" role="banner">
      {/* LEFT — logo + breadcrumb */}
      <div className="cmdbar__left">
        <QCLogo onClick={() => navigate('/dashboard')} />
        {breadcrumb && !isMobile && pathname !== '/dashboard' && (
          <>
            <span className="cmdbar__divider" aria-hidden="true" />
            <span className="cmdbar__crumb">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* CENTRE — navigation tabs (sentence case, underline indicator) */}
      {!isCompact && (
        <nav className="cmdbar__nav" aria-label="Navigation principale">
          {navItems.map((n) => {
            const active = isActive(n.path, pathname);
            const tipContent = n.shortcut ? `${n.label} (${n.shortcut})` : n.label;
            return (
              <Tooltip key={n.path} content={tipContent}>
                <button
                  type="button"
                  className="nav-pill"
                  data-active={active || undefined}
                  onClick={() => navigate(n.path)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={n.label}
                >
                  {n.tab}
                </button>
              </Tooltip>
            );
          })}
        </nav>
      )}

      {/* RIGHT — search + status */}
      <div className="cmdbar__right">
        <button
          type="button"
          onClick={onOpenCommand}
          className="cmdbar__search"
          aria-label="Ouvrir la palette de commandes"
          title="Palette de commandes (⌘K) · Aide-mémoire (⌘/)"
        >
          <Search size={14} aria-hidden="true" strokeWidth={2} />
          {!isMobile && (
            <kbd className="cmdbar__kbd" aria-hidden="true">
              ⌘K
            </kbd>
          )}
        </button>
        {!isMobile && !isCompact && (
          <Tooltip content="Aide-mémoire raccourcis (⌘/)">
            <kbd
              className="cmdbar__kbd cmdbar__kbd--help"
              aria-label="Ouvrir l'aide-mémoire"
              role="button"
              tabIndex={0}
              onClick={() => window.dispatchEvent(new CustomEvent('qc:open-cheatsheet'))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('qc:open-cheatsheet'));
                }
              }}
            >
              ⌘/
            </kbd>
          </Tooltip>
        )}
        <ModePill variant={modeVariant} />
      </div>
    </header>
  );
}
