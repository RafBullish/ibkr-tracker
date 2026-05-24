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
