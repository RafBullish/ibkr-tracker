// ═══════════════════════════════════════════════════════════════
//  COMMAND BAR v4.0 « Institutional Terminal »
//
//  Top bar 32 px sticky. Three zones :
//    1. Left  (≥ 220 px)  — QC▎TERMINAL logo + breadcrumb
//    2. Centre (flex 1)   — 9 navigation pills (4-letter codes)
//    3. Right (~280 px)   — palette de commandes (⌘K) + StatusBadge
//
//  Pills 4-letter inspired by Bloomberg Terminal function codes
//  (DASH, POS, HIST, GRKS, CHN, ANLY, CAL, JRNL, IMP). Tooltip au
//  survol affiche le libellé français complet et le raccourci ⌘N.
//  Hidden on mobile (BottomNav prend le relais).
//
//  Breadcrumb français — l'identifiant 4-lettres reste neutre dans
//  les pills mais le label long est toujours en FR conformément à
//  la convention CLAUDE.md « All UI strings are French ».
//
//  Theme picker is hosted by StatusBar, not here, to keep the top
//  zone focused on navigation + actions.
// ═══════════════════════════════════════════════════════════════

import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import Tooltip from '../ui/Tooltip';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { FRESHNESS } from '../../constants/timing';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

const NAV = [
  { code: 'DASH', label: 'Tableau de bord', path: '/dashboard', shortcut: '⌘1' },
  { code: 'PREM', label: 'Pré-marché', path: '/premarket', shortcut: '' },
  { code: 'POS', label: 'Positions', path: '/trading/positions', shortcut: '⌘2' },
  { code: 'HIST', label: 'Historique', path: '/trading/history', shortcut: '⌘3' },
  {
    code: 'GRKS',
    label: 'Greeks Center',
    path: '/trading/greeks',
    shortcut: '⌘4',
    flag: 'GREEK_CENTER',
  },
  { code: 'CHN', label: 'Chain Options', path: '/trading/chain', shortcut: '⌘5' },
  { code: 'ANLY', label: 'Analytics', path: '/insights/analytics', shortcut: '⌘6' },
  { code: 'CAL', label: 'Calendrier', path: '/insights/calendar', shortcut: '⌘7' },
  { code: 'JRNL', label: 'Journal', path: '/insights/journal', shortcut: '⌘8' },
  { code: 'IMP', label: 'Import', path: '/settings/import', shortcut: '⌘9' },
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
      aria-label="QuantumCall Terminal — accueil"
    >
      <span className="cmdbar__logo-mark">QC</span>
      <span className="cmdbar__logo-bar" aria-hidden="true">
        ▎
      </span>
      <span className="cmdbar__logo-name">TERMINAL</span>
    </button>
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
        {breadcrumb && !isMobile && (
          <>
            <span className="cmdbar__sep" aria-hidden="true">
              ·
            </span>
            <span className="cmdbar__crumb">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* CENTRE — navigation pills */}
      {!isCompact && (
        <nav className="cmdbar__nav" aria-label="Navigation principale">
          {navItems.map((n) => {
            const active = isActive(n.path, pathname);
            return (
              <Tooltip key={n.code} content={`${n.label} (${n.shortcut})`}>
                <button
                  type="button"
                  className="nav-pill"
                  data-active={active || undefined}
                  onClick={() => navigate(n.path)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={n.label}
                >
                  {n.code}
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
          <Search size={12} aria-hidden="true" strokeWidth={2} />
          {!isMobile && <span className="cmdbar__search-label">Rechercher…</span>}
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
        <StatusBadge variant={modeVariant} size="sm" />
      </div>
    </header>
  );
}
