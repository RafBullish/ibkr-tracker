// ═══════════════════════════════════════════════════════════════
//  SIDE NAV — navigation verticale du Shell v1.0 (brique 1.B)
//
//  Remplace la CommandBar horizontale. 232 px déployée / 64 px
//  repliée (toggle bouton footer + ⌘B, état persisté
//  localStorage `qc:sidenav:collapsed`, géré par AppShell).
//
//  Structure : header (logomark QC + wordmark + badge REAL/LIVE
//  migré à l'identique de la CommandBar) · recherche ⌘K (ouvre la
//  CommandPalette existante) · navigation groupée OVERVIEW/TRADING/
//  INSIGHTS/SYSTÈME (icônes lucide IDENTIQUES aux onglets, hints des
//  raccourcis RÉELS ⌘1..9 — mapping AppShell inchangé) · footer
//  (aide ⌘/ + repli ⌘B).
//
//  Chrome structurel : fond --depth-base, bord droit hairline —
//  PAS un .obs-panel. Styles : v1-shell.css (+ palier c3-hires.css).
// ═══════════════════════════════════════════════════════════════

import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Sunrise,
  Layers,
  History,
  Sigma,
  Link2,
  BarChart3,
  Calendar,
  BookOpen,
  Settings,
  CircleHelp,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import { useOpenPositions, useSettings } from '../../store/useStore';
import { FRESHNESS } from '../../constants/timing';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

// Groupes de navigation. `shortcut` = hint du raccourci RÉEL câblé dans
// AppShell (NAV_PATHS ⌘1..9) — affiché, jamais remappé. Icônes = celles
// des anciens onglets CommandBar, à l'identique.
const GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', aria: 'Tableau de bord', path: '/dashboard', shortcut: '⌘1', icon: LayoutDashboard },
      { label: 'Premarket', aria: 'Pré-marché', path: '/premarket', shortcut: '', icon: Sunrise },
    ],
  },
  {
    title: 'TRADING',
    items: [
      { label: 'Positions', aria: 'Positions', path: '/trading/positions', shortcut: '⌘2', icon: Layers },
      { label: 'History', aria: 'Historique', path: '/trading/history', shortcut: '⌘3', icon: History },
      { label: 'Greeks', aria: 'Greeks Center', path: '/trading/greeks', shortcut: '⌘4', icon: Sigma, flag: 'GREEK_CENTER' },
      { label: 'Chain', aria: 'Chain Options', path: '/trading/chain', shortcut: '⌘5', icon: Link2 },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Analytics', aria: 'Analytics', path: '/insights/analytics', shortcut: '⌘6', icon: BarChart3 },
      { label: 'Calendar', aria: 'Calendrier', path: '/insights/calendar', shortcut: '⌘7', icon: Calendar },
      { label: 'Journal', aria: 'Journal', path: '/insights/journal', shortcut: '⌘8', icon: BookOpen },
    ],
  },
  {
    title: 'SYSTÈME',
    items: [
      // ⌘9 réel (AppShell) cible /settings/import — le clic sur l'item va
      // sur /settings/general comme l'ancien onglet. Hint conservé tel quel
      // (cf. cheatsheet « ⌘9 — Import / Settings »).
      { label: 'Settings', aria: 'Réglages', path: '/settings/general', shortcut: '⌘9', icon: Settings },
    ],
  },
];

// Logique d'activation reprise de la CommandBar (inchangée).
function isActive(navPath, pathname) {
  if (navPath === '/dashboard') return pathname === navPath;
  if (navPath.startsWith('/settings')) {
    return pathname === '/settings' || pathname.startsWith('/settings/');
  }
  return pathname === navPath || pathname.startsWith(navPath);
}

// Badge REAL/LIVE/PAPER — logique de la CommandBar reprise à l'IDENTIQUE
// (fraîcheur settings.ibkrLiveData vs FRESHNESS, sinon positions → real).
function useModeVariant() {
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const live = settings?.ibkrLiveData;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const useLive =
    live?.timestamp && nowMs - new Date(live.timestamp).getTime() < FRESHNESS.LIVE_DATA_MAX_AGE_MS;
  const hasPositions = (openPositions || []).length > 0;
  return useLive ? 'live' : hasPositions ? 'real' : 'paper';
}

const MODE_LABELS = { live: 'LIVE', real: 'REAL', paper: 'PAPER' };
const MODE_TITLES = {
  live: 'Données IBKR temps réel actives',
  real: 'Positions réelles · données stockées localement',
  paper: 'Mode paper — aucune position réelle',
};

function ModePill({ variant, collapsed }) {
  const pill = (
    <span
      className={`side-nav__mode-pill${collapsed ? ' side-nav__mode-pill--dot' : ''}`}
      data-mode={variant}
      role="status"
      title={collapsed ? undefined : MODE_TITLES[variant] || ''}
    >
      <span
        className={`side-nav__mode-dot${variant === 'live' ? ' side-nav__mode-dot--pulse' : ''}`}
        aria-hidden="true"
      />
      {!collapsed && <span>{MODE_LABELS[variant] || variant?.toUpperCase()}</span>}
    </span>
  );
  if (!collapsed) return pill;
  return (
    <Tooltip content={`${MODE_LABELS[variant]} — ${MODE_TITLES[variant]}`} side="right">
      {pill}
    </Tooltip>
  );
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;
  const btn = (
    <button
      type="button"
      className="side-nav__item"
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={item.aria}
      onClick={() => onNavigate(item.path)}
    >
      <Icon size={18} strokeWidth={1.75} className="side-nav__item-icon" aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="side-nav__item-label">{item.label}</span>
          {item.shortcut ? (
            <kbd className="side-nav__hint" aria-hidden="true">
              {item.shortcut}
            </kbd>
          ) : null}
        </>
      )}
    </button>
  );
  if (!collapsed) return btn;
  return (
    <Tooltip content={item.shortcut ? `${item.aria} (${item.shortcut})` : item.aria} side="right">
      {btn}
    </Tooltip>
  );
}

export default function SideNav({ collapsed, onToggle, onOpenCommand }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const modeVariant = useModeVariant();

  const openCheatsheet = () => window.dispatchEvent(new CustomEvent('qc:open-cheatsheet'));

  const searchBtn = (
    <button
      type="button"
      className="side-nav__search"
      onClick={onOpenCommand}
      aria-label="Ouvrir la palette de commandes"
    >
      <Search size={16} strokeWidth={2} aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="side-nav__search-label">Rechercher</span>
          <kbd className="side-nav__hint" aria-hidden="true">
            ⌘K
          </kbd>
        </>
      )}
    </button>
  );

  const helpBtn = (
    <button
      type="button"
      className="side-nav__foot-btn"
      onClick={openCheatsheet}
      aria-label="Ouvrir l'aide-mémoire des raccourcis"
    >
      <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="side-nav__foot-label">Aide</span>
          <kbd className="side-nav__hint" aria-hidden="true">
            ⌘/
          </kbd>
        </>
      )}
    </button>
  );

  const toggleBtn = (
    <button
      type="button"
      className="side-nav__foot-btn side-nav__toggle"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Déployer la navigation' : 'Replier la navigation'}
    >
      {collapsed ? (
        <ChevronsRight size={16} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <ChevronsLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
      {!collapsed && (
        <>
          <span className="side-nav__foot-label">Réduire</span>
          <kbd className="side-nav__hint" aria-hidden="true">
            ⌘B
          </kbd>
        </>
      )}
    </button>
  );

  return (
    <aside className={`side-nav${collapsed ? ' side-nav--collapsed' : ''}`}>
      {/* Header — logomark + wordmark + badge REAL/LIVE */}
      <div className="side-nav__header">
        <button
          type="button"
          className="side-nav__logo"
          onClick={() => navigate('/dashboard')}
          aria-label="QuantumCall — accueil"
        >
          <span className="side-nav__logo-mark" aria-hidden="true">
            QC
          </span>
          {!collapsed && <span className="side-nav__logo-name">QUANTUMCALL</span>}
        </button>
        <ModePill variant={modeVariant} collapsed={collapsed} />
      </div>

      {/* Recherche ⌘K */}
      <div className="side-nav__search-row">
        {collapsed ? (
          <Tooltip content="Rechercher (⌘K)" side="right">
            {searchBtn}
          </Tooltip>
        ) : (
          searchBtn
        )}
      </div>

      {/* Navigation groupée */}
      <nav className="side-nav__nav" aria-label="Navigation principale">
        {GROUPS.map((group) => {
          const items = group.items.filter(
            (i) => !i.flag || (i.flag === 'GREEK_CENTER' && FEATURE_GREEK_CENTER)
          );
          if (items.length === 0) return null;
          return (
            <div className="side-nav__group" key={group.title}>
              {collapsed ? (
                <div className="side-nav__group-rule" aria-hidden="true" />
              ) : (
                <div className="side-nav__group-title">{group.title}</div>
              )}
              {items.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  active={isActive(item.path, pathname)}
                  collapsed={collapsed}
                  onNavigate={navigate}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer — aide + repli */}
      <div className="side-nav__footer">
        {collapsed ? (
          <Tooltip content="Aide-mémoire (⌘/)" side="right">
            {helpBtn}
          </Tooltip>
        ) : (
          helpBtn
        )}
        {collapsed ? (
          <Tooltip content="Déployer la navigation (⌘B)" side="right">
            {toggleBtn}
          </Tooltip>
        ) : (
          toggleBtn
        )}
      </div>
    </aside>
  );
}
