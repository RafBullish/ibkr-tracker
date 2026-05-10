// ═══════════════════════════════════════════════════════════════
//  APP SHELL v10.0 « Institutional Terminal v4 »
//
//  Top-down chrome (no vertical sidebar) :
//    1. CommandBar  (32 px sticky top)   — logo + nav pills + ⌘K
//    2. SubNav      (mobile only)        — sub-tabs within sections
//    3. <main>      (flex 1, scrollable) — page content
//    4. StatusBar   (22 px sticky bottom) — connections + clocks + risk
//    5. BottomNav   (mobile only)        — primary nav (legacy parity)
//    6. CommandPalette (modal, ⌘K)       — fuzzy search
//
//  Keyboard shortcuts (global) :
//    ⌘K / Ctrl+K  → toggle command palette
//    ⌘1..9        → jump to nav workspace (1=DASH, 9=IMP)
//                   ⌘4 = GRKS, no-op when FEATURE_GREEK_CENTER is off
//
//  La sidebar verticale Aura v9 a été retirée en brique 1 v4 — le
//  composant inline `Sidebar` et l'import du Header ont été supprimés
//  ici. Header.jsx reste sur disque (deletion différée selon la règle
//  "dead code 2 semaines" du feedback_dead_code memo).
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import GlobalStyles from '../../theme/GlobalStyles';
import AmbientBackground from './AmbientBackground';
import CommandBar from './CommandBar';
import TickerTape from './TickerTape';
import StatusBar from './StatusBar';
import BottomNav from './BottomNav';
import CommandPalette from '../ui/CommandPalette';
import CheatsheetModal from '../ui/CheatsheetModal';
import useMediaQuery from '../../hooks/useMediaQuery';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

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
      { path: '/trading/chain', label: 'Chain' },
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    const handler = (e) => {
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
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const target = NAV_PATHS[parseInt(e.key, 10) - 1];
        if (target) navigate(target);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);

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
    <div
      className="app-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <AmbientBackground />
      <a href="#main-content" className="skip-to-content">
        Aller au contenu principal
      </a>
      <GlobalStyles />
      <CommandBar onOpenCommand={() => setCmdOpen(true)} />
      <TickerTape />
      {isMobile && <SubNav pathname={pathname} navigate={navigate} />}
      <main
        id="main-content"
        key={pathname}
        tabIndex={-1}
        className="app-main"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '0 0 80px' : '0',
          background: 'transparent',
          scrollBehavior: 'smooth',
          overscrollBehavior: 'contain',
          position: 'relative',
          zIndex: 2,
          minHeight: 0,
        }}
      >
        <Outlet />
      </main>
      <StatusBar />
      {isMobile && <BottomNav />}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <CheatsheetModal open={cheatOpen} onClose={() => setCheatOpen(false)} />
    </div>
  );
}
