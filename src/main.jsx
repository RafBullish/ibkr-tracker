import './styles/tokens.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/fonts.css';
import './styles/global.css';
import './styles/animations.css';
import './styles/responsive.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/aura-boost.css';
import './styles/primitives.css';
// v3-components.css is loaded last so its rules win over component-level
// styles when class names overlap.
import './styles/v3-components.css';
// v4-shell.css adds CommandBar + StatusBar chrome on top of v3.
import './styles/v4-shell.css';
// v4-dashboard.css adds the 12-col bento grid for /dashboard.
import './styles/v4-dashboard.css';
// v5-chain.css : Sprint 3 institutional refonte of /trading/chain.
import './styles/v5-chain.css';
// canonical.css — palette canonique (DA Brutalisme Financier). Chargé en dernier
// pour faire autorité quand les pages migreront. Étape additive : aucune page
// ne le consomme encore, aucun changement visuel attendu.
import './styles/canonical.css';
// pages-positions.css — page-vitrine /trading/positions, première consommatrice
// de la palette canonique. Scopée à .positions-v3 / .positions-flat /
// .positions-empty — n'affecte aucune autre page.
import './styles/pages-positions.css';
// pages-greeks.css — page-vitrine /trading/greeks, deuxième consommatrice de la
// palette canonique. Scopée à .greeks-page / .greeks-v3__* / .greeks-empty —
// n'affecte aucune autre page.
import './styles/pages-greeks.css';
// pages-import.css — page-vitrine /settings/import, troisième consommatrice de
// la palette canonique. Scopée à .import-page / .import-page__* — n'affecte
// aucune autre page. Les anciennes règles .import-v3__* ont été retirées de
// v3-components.css au même commit (zéro doublon).
import './styles/pages-import.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/layout/Toast';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
