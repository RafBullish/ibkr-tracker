// ═══════════════════════════════════════════════════════════════
//  SIDEBAR LAB — /lab/sidebar (1.S.2) · DEV-ONLY, ÉPHÉMÈRE
//
//  TROIS directions pour la Sidebar v2, chacune dans les DEUX états
//  (déployée / repliée), avec les VRAIS libellés, routes et
//  raccourcis de l'app. Fidélité stricte au design system : Plex
//  (le LED Doto reste exclusif au bandeau), color-law, hairlines,
//  aucun accent de couleur nouveau (ambre décisionnel seulement).
//
//    D1 · RAIL D'INSTRUMENT — l'héritier durci : densité salle des
//         marchés, marqueur actif ambre 2px, keycaps en colonne
//         tabulaire, groupes silencieux (hairlines, sans titres).
//    D2 · TOUR DE COMMANDEMENT — la rupture clavier-first : zéro
//         icône, l'ordre ⌘1..9 EST l'ordre visuel, keycaps en héros,
//         recherche ⌘K en champ de tête.
//    D3 · MARGE VIVE — la nav-instrument : chaque entrée porte un
//         témoin d'état NEUTRE (compteurs, J-x, dot de session) —
//         la marge devient un tableau de bord périphérique.
//
//  A = témoin réel (SideNav de prod, non interactive).
//  Purgé en fin de brique 1.S comme les labs 1.C.
// ═══════════════════════════════════════════════════════════════

import {
  LayoutDashboard, Sunrise, Calendar, Link2, Layers, History as HistoryIcon,
  Sigma, BarChart3, BookOpen, Settings, Search, CircleHelp, ChevronsLeft,
} from 'lucide-react';
import SideNav from '../../components/layout/SideNav';
import '../../styles/lab-sidebar.css';

// ─── Données RÉELLES de nav (miroir SideNav.jsx — labels, routes,
//     raccourcis, groupes ; « — » = Premarket sans touche) ─────────
const GROUPS = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', path: '/dashboard', key: '1', Icon: LayoutDashboard },
      { label: 'Premarket', path: '/premarket', key: '', Icon: Sunrise },
      { label: 'Calendar', path: '/insights/calendar', key: '7', Icon: Calendar },
      { label: 'Options Live', path: '/trading/chain', key: '5', Icon: Link2 },
    ],
  },
  {
    title: 'TRADING',
    items: [
      { label: 'Positions', path: '/trading/positions', key: '2', Icon: Layers },
      { label: 'History', path: '/trading/history', key: '3', Icon: HistoryIcon },
      { label: 'Greeks', path: '/trading/greeks', key: '4', Icon: Sigma },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Analytics', path: '/insights/analytics', key: '6', Icon: BarChart3 },
      { label: 'Journal', path: '/insights/journal', key: '8', Icon: BookOpen },
    ],
  },
  {
    title: 'SYSTÈME',
    items: [{ label: 'Settings', path: '/settings/general', key: '9', Icon: Settings }],
  },
];

// D2 : l'ordre CLAVIER est l'ordre visuel (⌘1..9 puis sans-touche).
const KEY_ORDER = [
  { label: 'Dashboard', path: '/dashboard', key: '1' },
  { label: 'Positions', path: '/trading/positions', key: '2' },
  { label: 'History', path: '/trading/history', key: '3' },
  { label: 'Greeks', path: '/trading/greeks', key: '4' },
  { label: 'Options Live', path: '/trading/chain', key: '5' },
  { label: 'Analytics', path: '/insights/analytics', key: '6' },
  { label: 'Calendar', path: '/insights/calendar', key: '7' },
  { label: 'Journal', path: '/insights/journal', key: '8' },
  { label: 'Settings', path: '/settings/general', key: '9' },
  { label: 'Premarket', path: '/premarket', key: '' },
];
// Familles (hairlines de respiration D2) : après ⌘1, ⌘5, ⌘8, ⌘9.
const D2_BREAKS = new Set(['1', '5', '8', '9']);

// D3 : témoins d'état NEUTRES (ink-mute, jamais une sémantique P&L).
const D3_WITNESS = {
  '/trading/positions': '5',
  '/trading/history': '10',
  '/insights/calendar': 'J-11',
  '/insights/journal': 'J-1',
  '/premarket': '●',
};

const ACTIVE_PATH = '/dashboard';

// ─── Pièces partagées ───────────────────────────────────────────
function Logomark() {
  return <span className="ls-logomark" aria-hidden="true">QC</span>;
}

function ModeDot({ withLabel = false }) {
  return (
    <span className="ls-mode" title="REAL — positions réelles, quotes différées">
      <span className="ls-mode__dot" aria-hidden="true" />
      {withLabel && <span className="ls-mode__label">REAL</span>}
    </span>
  );
}

function Keycap({ k, size = 'md', filled = false, noMod = false }) {
  if (!k) return <span className={`ls-keycap ls-keycap--${size} ls-keycap--void`}>·</span>;
  return (
    <kbd className={`ls-keycap ls-keycap--${size}${filled ? ' is-filled' : ''}`}>
      {noMod ? k : `⌘${k}`}
    </kbd>
  );
}

// ═══ D1 · RAIL D'INSTRUMENT ═════════════════════════════════════
function D1({ collapsed }) {
  return (
    <aside className={`ls-rail d1${collapsed ? ' is-collapsed' : ''}`}>
      <div className="d1-head">
        <Logomark />
        {!collapsed && <span className="ls-wordmark">QUANTUMCALL</span>}
        <ModeDot withLabel={!collapsed} />
      </div>
      <button type="button" className="d1-search">
        <Search size={16} strokeWidth={2} aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="d1-search__lbl">Rechercher</span>
            <kbd className="d1-search__kbd">⌘K</kbd>
          </>
        )}
      </button>
      <nav className="d1-nav" aria-label="Navigation principale (maquette D1)">
        {GROUPS.map((g, gi) => (
          <div className="d1-group" key={g.title}>
            {gi > 0 && <div className="d1-rule" aria-hidden="true" />}
            {g.items.map(({ label, path, key, Icon }) => {
              const active = path === ACTIVE_PATH;
              return (
                <button type="button" className={`d1-item${active ? ' is-active' : ''}`} key={path} title={collapsed ? label : undefined}>
                  <span className="d1-item__marker" aria-hidden="true" />
                  <Icon size={collapsed ? 20 : 18} strokeWidth={1.75} aria-hidden="true" />
                  {!collapsed && <span className="d1-item__lbl">{label}</span>}
                  {!collapsed && <span className="d1-item__key">{key ? `⌘${key}` : ''}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="d1-foot">
        <button type="button" className="d1-foot__btn">
          <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Aide</span>}
          {!collapsed && <kbd className="d1-search__kbd">⌘/</kbd>}
        </button>
        <button type="button" className="d1-foot__btn">
          <ChevronsLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Réduire</span>}
          {!collapsed && <kbd className="d1-search__kbd">⌘B</kbd>}
        </button>
      </div>
    </aside>
  );
}

// ═══ D2 · TOUR DE COMMANDEMENT ══════════════════════════════════
function D2({ collapsed }) {
  return (
    <aside className={`ls-rail d2${collapsed ? ' is-collapsed' : ''}`}>
      <div className="d2-head">
        <Logomark />
        {!collapsed && <span className="ls-wordmark">QUANTUMCALL</span>}
        <ModeDot />
      </div>
      {collapsed ? (
        <button type="button" className="d2-search d2-search--icon" title="Rechercher (⌘K)">
          <Search size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : (
        <div className="d2-search">
          <Search size={15} strokeWidth={2} aria-hidden="true" />
          <span className="d2-search__ph">Rechercher…</span>
          <kbd className="d2-search__kbd">⌘K</kbd>
        </div>
      )}
      <nav className="d2-nav" aria-label="Navigation principale (maquette D2)">
        {KEY_ORDER.map(({ label, path, key }) => {
          const active = path === ACTIVE_PATH;
          return (
            <div key={path}>
              <button type="button" className={`d2-item${active ? ' is-active' : ''}`} title={collapsed ? label : undefined}>
                <Keycap k={key} size={collapsed ? 'lg' : 'md'} filled={active} noMod={collapsed} />
                {!collapsed && <span className="d2-item__lbl">{label}</span>}
              </button>
              {D2_BREAKS.has(key) && <div className="d2-rule" aria-hidden="true" />}
            </div>
          );
        })}
      </nav>
      <div className="d2-foot">
        <button type="button" className="d2-foot__btn" title="Aide-mémoire (⌘/)">
          <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Aide</span>}
        </button>
        <button type="button" className="d2-foot__btn" title="Replier (⌘B)">
          <ChevronsLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  );
}

// ═══ D3 · MARGE VIVE ════════════════════════════════════════════
function D3({ collapsed }) {
  return (
    <aside className={`ls-rail d3${collapsed ? ' is-collapsed' : ''}`}>
      <div className="d3-head">
        <Logomark />
        {!collapsed && <span className="ls-wordmark">QUANTUMCALL</span>}
        <ModeDot withLabel={!collapsed} />
      </div>
      <button type="button" className="d1-search">
        <Search size={16} strokeWidth={2} aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="d1-search__lbl">Rechercher</span>
            <kbd className="d1-search__kbd">⌘K</kbd>
          </>
        )}
      </button>
      <nav className="d3-nav" aria-label="Navigation principale (maquette D3)">
        {GROUPS.map((g) => (
          <div className="d3-group" key={g.title}>
            {!collapsed && <div className="d3-group__title">{g.title}</div>}
            {collapsed && <div className="d1-rule" aria-hidden="true" />}
            {g.items.map(({ label, path, key, Icon }) => {
              const active = path === ACTIVE_PATH;
              const witness = D3_WITNESS[path];
              return (
                <button type="button" className={`d3-item${active ? ' is-active' : ''}`} key={path} title={collapsed ? label : undefined}>
                  <span className="d3-item__ic">
                    <Icon size={collapsed ? 20 : 18} strokeWidth={1.75} aria-hidden="true" />
                    {collapsed && witness && witness !== '●' && (
                      <span className="d3-item__badge">{witness}</span>
                    )}
                    {collapsed && witness === '●' && <span className="d3-item__pdot" aria-hidden="true" />}
                  </span>
                  {!collapsed && <span className="d3-item__lbl">{label}</span>}
                  {!collapsed && witness && (
                    witness === '●'
                      ? <span className="d3-item__pdot" aria-hidden="true" />
                      : <span className="d3-item__wit">{witness}</span>
                  )}
                  {!collapsed && !witness && <span className="d3-item__key">{key ? `⌘${key}` : ''}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="d1-foot">
        <button type="button" className="d1-foot__btn">
          <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Aide</span>}
        </button>
        <button type="button" className="d1-foot__btn">
          <ChevronsLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          {!collapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  );
}

// ═══ Page ═══════════════════════════════════════════════════════
const DIRECTIONS = [
  {
    key: 'D1',
    title: 'D1 · RAIL D\'INSTRUMENT — l\'héritier durci',
    sub: 'Densité salle des marchés : marqueur actif ambre 2px, keycaps en colonne tabulaire, groupes silencieux (hairlines sans titres), items 34px.',
    C: D1,
  },
  {
    key: 'D2',
    title: 'D2 · TOUR DE COMMANDEMENT — la rupture clavier-first',
    sub: 'Zéro icône : l\'ordre ⌘1..9 EST l\'ordre visuel, keycaps en héros (actif = keycap rempli), recherche en champ de tête. Replié = colonne de touches.',
    C: D2,
  },
  {
    key: 'D3',
    title: 'D3 · MARGE VIVE — la nav-instrument',
    sub: 'Chaque entrée porte un témoin d\'état NEUTRE (Positions 5, History 10, Calendar J-11, Journal J-1, dot de session Premarket). Replié = badges.',
    C: D3,
  },
];

export default function SidebarLab() {
  return (
    <div className="ls-page">
      <header className="ls-head">
        <h1 className="ls-title">LAB · SIDEBAR — trois directions v2, deux états (1.S.2)</h1>
        <p className="ls-sub">
          A = témoin réel (SideNav de prod, non interactive). Puis D1/D2/D3 en maquettes
          fidèles au design system — vrais libellés, vraies routes, vrais raccourcis.
          Actif simulé : Dashboard. Plex partout (le LED Doto reste exclusif au bandeau).
        </p>
      </header>

      <section className="ls-variant">
        <div className="ls-variant__label">A · Témoin réel — SideNav 1.B (232 / 64)</div>
        <div className="ls-row">
          <div className="ls-frame ls-frame--witness">
            <SideNav collapsed={false} onToggle={() => {}} onOpenCommand={() => {}} />
          </div>
          <div className="ls-frame ls-frame--witness">
            <SideNav collapsed onToggle={() => {}} onOpenCommand={() => {}} />
          </div>
        </div>
      </section>

      {DIRECTIONS.map(({ key, title, sub, C }) => (
        <section className="ls-variant" key={key}>
          <div className="ls-variant__label">{title}</div>
          <p className="ls-variant__sub">{sub}</p>
          <div className="ls-row">
            <div className="ls-frame"><C collapsed={false} /></div>
            <div className="ls-frame"><C collapsed /></div>
          </div>
        </section>
      ))}
    </div>
  );
}
