// ═══════════════════════════════════════════════════════════════
//  SIDE NAV v2 — « Marge vive » (brique 1.S, direction D3 amendée)
//
//  220 px déployée / 64 px repliée (toggle footer + ⌘B, état persisté
//  `qc:sidenav:collapsed`, géré par AppShell). Verdict architecte
//  STOP 1 : témoins d'état NEUTRES à droite des rangées (jamais une
//  couleur P&L), keycaps ⌘x retirés des rangées (les raccourcis
//  restent câblés — documentés palette ⌘K, cheatsheet ⌘/ et tooltips
//  du replié), badge REAL/LIVE supprimé du header, groupes silencieux
//  (hairlines sans titres), rangées = vrais liens routeur (Ctrl+clic).
//
//  Témoins (sources réelles uniquement, masqués à zéro) :
//    Positions  → nombre de positions ouvertes (store)
//    Historique → trades clôturés AUJOURD'HUI (store, champ do)
//    Pré-marché → dot AMBRE pendant la fenêtre pré-marché NY
//                 (computeMarketPhase, re-évalué 60 s), éteint sinon
//
//  Chrome structurel : fond --depth-base, bord droit hairline —
//  PAS un .obs-panel. Styles : v1-shell.css (+ palier c3-hires.css).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import { useOpenPositions, useClosedTrades } from '../../store/useStore';
import { computeMarketPhase } from '../../utils/marketPhase';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

// Groupes de navigation (regroupement 1.B.2 conservé, titres morts en
// 1.S — groupes silencieux). Labels UNIFIÉS EN FRANÇAIS (dette №10).
// `shortcut` = raccourci RÉEL câblé dans AppShell (NAV_PATHS ⌘1..9),
// affiché UNIQUEMENT dans les tooltips du replié — JAMAIS remappé.
// Vérité ⌘9 (dette №3) : ⌘9 cible /settings/import, l'entrée Réglages
// (clic → /settings/general) n'affiche donc AUCUNE touche.
// `witness` = clé du témoin d'état (D3 « Marge vive »).
const GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Tableau de bord', path: '/dashboard', shortcut: '⌘1', icon: LayoutDashboard },
      { label: 'Pré-marché', path: '/premarket', shortcut: '⌘0', icon: Sunrise, witness: 'premarket' },
      { label: 'Calendrier', path: '/insights/calendar', shortcut: '⌘7', icon: Calendar },
      { label: 'Options Live', path: '/trading/chain', shortcut: '⌘5', icon: Link2 },
    ],
  },
  {
    title: 'TRADING',
    items: [
      { label: 'Positions', path: '/trading/positions', shortcut: '⌘2', icon: Layers, witness: 'positions' },
      { label: 'Historique', path: '/trading/history', shortcut: '⌘3', icon: History, witness: 'closedToday' },
      { label: 'Greeks', path: '/trading/greeks', shortcut: '⌘4', icon: Sigma, flag: 'GREEK_CENTER' },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Analytics', path: '/insights/analytics', shortcut: '⌘6', icon: BarChart3 },
      { label: 'Journal', path: '/insights/journal', shortcut: '⌘8', icon: BookOpen },
    ],
  },
  {
    title: 'SYSTÈME',
    items: [{ label: 'Réglages', path: '/settings/general', shortcut: '', icon: Settings }],
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

// Phase de session NY, ré-évaluée toutes les 60 s (le dot Pré-marché
// s'allume/s'éteint sans re-mount ; le tick re-rend aussi le compteur
// « clôturés aujourd'hui » au passage de minuit).
function useSessionPhase() {
  const [phase, setPhase] = useState(() => computeMarketPhase(new Date()).phase);
  useEffect(() => {
    const id = setInterval(() => setPhase(computeMarketPhase(new Date()).phase), 60_000);
    return () => clearInterval(id);
  }, []);
  return phase;
}

// Témoins d'état — sources RÉELLES uniquement, null = rien d'affiché.
function useWitnesses() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const phase = useSessionPhase();

  const positions = (openPositions || []).length;
  const closedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (closedTrades || []).filter((t) => t?.do === today).length;
  }, [closedTrades, phase]);

  return {
    positions: positions > 0 ? String(positions) : null,
    closedToday: closedToday > 0 ? String(closedToday) : null,
    premarket: phase === 'pre' ? 'dot' : null,
  };
}

function Witness({ value, collapsed }) {
  if (!value) return null;
  if (value === 'dot') {
    return (
      <span
        className={`side-nav__dot${collapsed ? ' side-nav__dot--perched' : ''}`}
        role="status"
        aria-label="Fenêtre pré-marché en cours"
      />
    );
  }
  return (
    <span className={`side-nav__witness${collapsed ? ' side-nav__witness--perched' : ''}`}>
      {value}
    </span>
  );
}

function NavItem({ item, active, collapsed, witnessValue }) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.path}
      className="side-nav__item"
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
    >
      <span className="side-nav__item-ic">
        <Icon
          size={collapsed ? 20 : 18}
          strokeWidth={1.75}
          className="side-nav__item-icon"
          aria-hidden="true"
        />
        {collapsed && <Witness value={witnessValue} collapsed />}
      </span>
      {!collapsed && (
        <>
          <span className="side-nav__item-label">{item.label}</span>
          <Witness value={witnessValue} collapsed={false} />
        </>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip content={item.shortcut ? `${item.label} (${item.shortcut})` : item.label} side="right">
      {link}
    </Tooltip>
  );
}

export default function SideNav({ collapsed, onToggle, onOpenCommand }) {
  const { pathname } = useLocation();
  const witnesses = useWitnesses();

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
          <kbd className="side-nav__key" aria-hidden="true">
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
          <kbd className="side-nav__key" aria-hidden="true">
            ⌘/
          </kbd>
        </>
      )}
    </button>
  );

  const toggleBtn = (
    <button
      type="button"
      className="side-nav__foot-btn"
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
          <kbd className="side-nav__key" aria-hidden="true">
            ⌘B
          </kbd>
        </>
      )}
    </button>
  );

  return (
    <aside className={`side-nav${collapsed ? ' side-nav--collapsed' : ''}`}>
      {/* Header — logomark + wordmark (le badge REAL/LIVE est mort en 1.S). */}
      <div className="side-nav__header">
        <Link to="/dashboard" className="side-nav__logo" aria-label="QuantumCall — accueil">
          <span className="side-nav__logo-mark" aria-hidden="true">
            QC
          </span>
          {!collapsed && <span className="side-nav__logo-name">QUANTUMCALL</span>}
        </Link>
      </div>

      {/* Recherche ⌘K (seul chip conservé en déployée). */}
      <div className="side-nav__search-row">
        {collapsed ? (
          <Tooltip content="Rechercher (⌘K)" side="right">
            {searchBtn}
          </Tooltip>
        ) : (
          searchBtn
        )}
      </div>

      {/* Navigation — groupes SILENCIEUX (hairlines, sans titres). */}
      <nav className="side-nav__nav" aria-label="Navigation principale">
        {GROUPS.map((group, gi) => {
          const items = group.items.filter(
            (i) => !i.flag || (i.flag === 'GREEK_CENTER' && FEATURE_GREEK_CENTER)
          );
          if (items.length === 0) return null;
          return (
            <div className="side-nav__group" key={group.title}>
              {gi > 0 && <div className="side-nav__group-rule" aria-hidden="true" />}
              {items.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  active={isActive(item.path, pathname)}
                  collapsed={collapsed}
                  witnessValue={item.witness ? witnesses[item.witness] : null}
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
