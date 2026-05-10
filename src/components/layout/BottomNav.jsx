import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import Icons from '../ui/Icons';
import { FEATURE_GREEK_CENTER } from '../../constants/featureFlags';

const GREEKS_PHASE = 3;

// Greeks glyph — mono "Σ" (lucide-react has no sigma)
const SigmaIcon = ({ size = 20 }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      fontFamily: 'var(--font-mono)',
      fontSize: size - 2,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: 0,
    }}
  >
    Σ
  </span>
);

const mainTabs = [
  { key: 'dashboard', path: '/dashboard', label: 'Tableau', icon: 'grid', ready: true },
  {
    key: 'positions',
    path: '/trading/positions',
    label: 'Positions',
    icon: 'trending',
    ready: true,
  },
  ...(FEATURE_GREEK_CENTER
    ? [{ key: 'greeks', path: '/trading/greeks', label: 'Greeks', icon: 'sigma', ready: true }]
    : []),
  { key: 'calendar', path: '/insights/calendar', label: 'Calendrier', icon: 'cal', ready: true },
];

const moreTabs = [
  { path: '/insights/analytics', label: 'Analytics', icon: 'bar' },
  { path: '/insights/journal', label: 'Journal', icon: 'book' },
  { path: '/trading/chain', label: 'Chain', icon: 'layers' },
  { path: '/trading/history', label: 'Historique', icon: 'list' },
  { path: '/settings/import', label: 'Import', icon: 'upload' },
  { path: '/settings/api', label: 'API', icon: 'settings' },
  { path: '/settings/general', label: 'Réglages', icon: 'settings' },
];

function isTabActive(key, pathname) {
  if (key === 'dashboard') return pathname.startsWith('/dashboard');
  if (key === 'positions') return pathname === '/trading/positions';
  if (key === 'greeks') return pathname.startsWith('/trading/greeks');
  if (key === 'calendar') return pathname.startsWith('/insights/calendar');
  if (key === 'more') {
    return (
      pathname.startsWith('/settings') ||
      pathname === '/insights/analytics' ||
      pathname === '/insights/journal' ||
      pathname === '/trading/history' ||
      pathname === '/trading/orders' ||
      pathname === '/trading/chain'
    );
  }
  return false;
}

function renderIcon(iconKey, size = 20) {
  if (iconKey === 'sigma') return <SigmaIcon size={size} />;
  return Icons[iconKey]?.('currentColor', size);
}

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const moreActive = isTabActive('more', pathname);

  // Close the sheet on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigation-driven close
    if (moreOpen) setMoreOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the sheet
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  // Auto-dismiss the toast
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const handleNav = (tab) => {
    if (tab.ready === false) {
      setToast(`${tab.label} arrive en Phase ${GREEKS_PHASE}`);
      return;
    }
    navigate(tab.path);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMoreNav = (path) => {
    navigate(path);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {toast && (
        <div className="bottom-nav__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {moreOpen && (
        <button
          type="button"
          className="bottom-nav__overlay"
          onClick={() => setMoreOpen(false)}
          aria-label="Fermer le menu"
        />
      )}

      {moreOpen && (
        <div
          className="bottom-nav__sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Menu supplémentaire"
        >
          <div className="bottom-nav__handle" aria-hidden="true" />
          <div className="bottom-nav__sheet-header">
            <h3 className="bottom-nav__sheet-title">Plus d&apos;options</h3>
            <button
              type="button"
              className="bottom-nav__sheet-close"
              onClick={() => setMoreOpen(false)}
              aria-label="Fermer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="bottom-nav__sheet-grid">
            {moreTabs.map((tab) => {
              const active = pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  type="button"
                  className="bottom-nav__sheet-item"
                  data-active={active || undefined}
                  onClick={() => handleMoreNav(tab.path)}
                >
                  <span className="bottom-nav__sheet-icon">{renderIcon(tab.icon, 20)}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Navigation principale">
        {mainTabs.map((tab) => {
          const active = isTabActive(tab.key, pathname);
          return (
            <button
              key={tab.key}
              type="button"
              className="bottom-nav__tab"
              data-active={active || undefined}
              data-ready={tab.ready ? undefined : 'false'}
              onClick={() => handleNav(tab)}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.ready === false ? `${tab.label} (bientôt disponible)` : tab.label}
            >
              {active && <span className="bottom-nav__indicator" aria-hidden="true" />}
              <span className="bottom-nav__icon">{renderIcon(tab.icon, 20)}</span>
              <span className="bottom-nav__label">{tab.label}</span>
              {tab.ready === false && (
                <span className="bottom-nav__badge" aria-hidden="true">
                  •
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          className="bottom-nav__tab"
          data-active={moreOpen || moreActive || undefined}
          onClick={() => setMoreOpen(!moreOpen)}
          aria-label="Plus d'options"
          aria-expanded={moreOpen}
        >
          {(moreOpen || moreActive) && (
            <span className="bottom-nav__indicator" aria-hidden="true" />
          )}
          <span className="bottom-nav__icon">
            <MoreHorizontal size={20} aria-hidden="true" />
          </span>
          <span className="bottom-nav__label">Plus</span>
        </button>
      </nav>
    </>
  );
}
