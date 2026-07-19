// ═══════════════════════════════════════════════════════════════
//  APP SHELL v1.0 « Le Shell » (brique 1.B)
//
//  Grille 100dvh, 3 rangées :
//    1. TickerTape  — PLEINE LARGEUR bord à bord (le marché d'abord)
//    2. Corps       — SideNav (232/64 px, ⌘B) + <main> (seul scrollable)
//    3. StatusBar   — pleine largeur (géométrie seule, zéro redesign)
//  + SubNav / BottomNav (mobile <768 uniquement, socle intact)
//  + CommandPalette (⌘K) / CheatsheetModal (⌘/)
//
//  La CommandBar horizontale est morte en 1.B : logomark, badge
//  REAL/LIVE et déclencheur ⌘/ ont migré dans la SideNav.
//
//  Keyboard shortcuts (global) :
//    ⌘K / Ctrl+K  → toggle command palette
//    ⌘/ / Ctrl+/  → cheatsheet
//    ⌘B / Ctrl+B  → replier/déployer la SideNav (persisté
//                   localStorage `qc:sidenav:collapsed`)
//    ⌘1..9        → jump to nav workspace (1=DASH, 9=IMP)
//                   ⌘4 = GRKS, no-op when FEATURE_GREEK_CENTER is off
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import GlobalStyles from '../../theme/GlobalStyles';
import SideNav from './SideNav';
import TickerTape from './TickerTape';
import StatusBar from './StatusBar';
import BottomNav from './BottomNav';
import CommandPalette from '../ui/CommandPalette';
import CheatsheetModal from '../ui/CheatsheetModal';
import useMediaQuery from '../../hooks/useMediaQuery';
import useIbkrLive from '../../hooks/useIbkrLive';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

// Persistance du repli SideNav — pattern qc:* (PAS une slice du store).
const SIDENAV_COLLAPSED_KEY = 'qc:sidenav:collapsed';

function readInitialCollapsed() {
  try {
    const saved = window.localStorage.getItem(SIDENAV_COLLAPSED_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    /* storage indisponible → défauts */
  }
  // Défauts sans préférence : déployée ≥1440, repliée <1440.
  return !window.matchMedia('(min-width: 1440px)').matches;
}

// ⌘1..9 navigation map. Order matches CommandBar pills (NAV) so the
// shortcut shown in tooltip aligns with what the keyboard does. When
// FEATURE_GREEK_CENTER is off, ⌘4 is a no-op (the slot is reserved
// to keep the rest of the mapping stable: ⌘5 still = CHN, etc.).
const NAV_PATHS = [
  '/dashboard',
  '/trading/positions',
  '/trading/history',
  FEATURE_GREEK_CENTER ? '/trading/greeks' : null,
  '/trading/chain',
  '/insights/analytics',
  '/insights/calendar',
  '/insights/journal',
  '/settings/import',
];

function SubNav({ pathname, navigate }) {
  let tabs = [];
  if (pathname.startsWith('/trading')) {
    tabs = [
      { path: '/trading/positions', label: 'Positions' },
      { path: '/trading/history', label: 'Historique' },
      ...(FEATURE_GREEK_CENTER ? [{ path: '/trading/greeks', label: 'Greeks' }] : []),
      { path: '/trading/chain', label: 'Options Live' },
    ];
  } else if (pathname === '/premarket') {
    // 1.S dette №2 — Pré-marché désenclavée : contexte OVERVIEW mobile.
    tabs = [
      { path: '/dashboard', label: 'Tableau' },
      { path: '/premarket', label: 'Pré-marché' },
      { path: '/insights/calendar', label: 'Calendrier' },
    ];
  } else if (pathname.startsWith('/insights')) {
    tabs = [
      { path: '/insights/analytics', label: 'Analytics' },
      { path: '/insights/journal', label: 'Journal' },
      { path: '/insights/calendar', label: 'Calendrier' },
    ];
  } else if (pathname.startsWith('/settings')) {
    tabs = [
      { path: '/settings/general', label: 'General' },
      { path: '/settings/import', label: 'Import' },
      { path: '/settings/api', label: 'API' },
    ];
  }
  if (tabs.length === 0) return null;

  return (
    <nav className="sub-nav" aria-label="Sous-navigation">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          type="button"
          className="sub-nav__tab"
          data-active={pathname === tab.path || undefined}
          aria-current={pathname === tab.path ? 'page' : undefined}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  // 1.B — repli SideNav (⌘B + bouton footer), persisté qc:sidenav:collapsed.
  const [navCollapsed, setNavCollapsed] = useState(readInitialCollapsed);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const toggleSideNav = () =>
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDENAV_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* storage indisponible → état session seulement */
      }
      return next;
    });

  // Bridge IBKR (étape 3) — polling /ibkr/account toutes les 5s quand
  // settings.gwAutoConnect est ON. Gating + erreurs silencieuses internes
  // au hook : si OFF ou si le bridge local n'est pas lancé, aucune action.
  useIbkrLive();

  useEffect(() => {
    const handler = (e) => {
      // 1.S dette №5 — garde anti-input : les raccourcis globaux ne
      // tirent JAMAIS depuis un champ de saisie, et les modificateurs
      // Shift/Alt sont filtrés (Ctrl+Shift+B, Ctrl+Alt+1… = no-op).
      const t = e.target;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      ) {
        return;
      }
      if (e.shiftKey || e.altKey) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }
      // v5 Sprint 10 : Cmd+/ opens the keyboard cheatsheet modal.
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setCheatOpen((prev) => !prev);
        return;
      }
      // 1.B : ⌘B / Ctrl+B replie/déploie la SideNav.
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSideNav();
        return;
      }
      // 1.S dette №2 : ⌘0 → Pré-marché (EXTENSION de carte, jamais un
      // remap — ⌘1..9 restent strictement intacts).
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        navigate('/premarket');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const target = NAV_PATHS[parseInt(e.key, 10) - 1];
        if (target) navigate(target);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);

  // 1.S dette №10 — sans préférence stockée, le défaut suit le palier
  // au resize (déployée ≥1440 / repliée <1440) au lieu de rester figé
  // sur l'état du mount. Une préférence explicite (⌘B) fige l'état.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1440px)');
    const onChange = () => {
      try {
        const saved = window.localStorage.getItem(SIDENAV_COLLAPSED_KEY);
        if (saved === '1' || saved === '0') return;
      } catch {
        /* storage indisponible → on suit le palier */
      }
      setNavCollapsed(!mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Open the command palette from anywhere (e.g. legacy CockpitHeader
  // search button still dispatches this event).
  useEffect(() => {
    const open = () => setCmdOpen(true);
    window.addEventListener('ibkr:open-command', open);
    return () => window.removeEventListener('ibkr:open-command', open);
  }, []);

  // v5 Sprint 10 : CommandBar ⌘/ pill click dispatches this event.
  useEffect(() => {
    const open = () => setCheatOpen(true);
    window.addEventListener('qc:open-cheatsheet', open);
    return () => window.removeEventListener('qc:open-cheatsheet', open);
  }, []);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-to-content">
        Aller au contenu principal
      </a>
      <GlobalStyles />
      {/* Rangée 1 — le marché d'abord : tape pleine largeur, bord à bord. */}
      <TickerTape />
      {isMobile && <SubNav pathname={pathname} navigate={navigate} />}
      {/* Rangée 2 — SideNav (non-mobile) + main, seul élément scrollable. */}
      <div className="app-shell__body">
        {!isMobile && (
          <SideNav
            collapsed={navCollapsed}
            onToggle={toggleSideNav}
            onOpenCommand={() => setCmdOpen(true)}
          />
        )}
        <main id="main-content" key={pathname} tabIndex={-1} className="app-main">
          <Outlet />
        </main>
      </div>
      {/* Rangée 3 — StatusBar pleine largeur (inchangée). */}
      <StatusBar />
      {isMobile && <BottomNav />}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <CheatsheetModal open={cheatOpen} onClose={() => setCheatOpen(false)} />
    </div>
  );
}
