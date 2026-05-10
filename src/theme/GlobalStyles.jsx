// ═══════════════════════════════════════════════════════════════
//  GLOBAL STYLES v3.0 « Midnight Terminal »
//
//  Responsibilities:
//    1. Set <html data-theme="..."> on mount + keep in sync when the
//       theme changes via custom `ibkr:theme-change` event.
//    2. Update <meta name="theme-color"> for mobile browser chrome.
//    3. Restore the colorblind preference from localStorage on mount
//       (P6-25 fix — previously the dataset attribute was only set
//       once the user toggled it in Settings, leaking across sessions).
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { getCurrentThemeKey, getThemeTokens } from './tokens';

export default function GlobalStyles() {
  useEffect(() => {
    const apply = (key) => {
      const theme = getThemeTokens(key);
      const root = document.documentElement;
      root.dataset.theme = key;
      root.classList.toggle('is-light', !!theme.isLight);
      document.body.className = `theme-${key}${theme.isLight ? ' is-light' : ''}`;

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme.surface.base);
    };

    apply(getCurrentThemeKey());

    // Colorblind mode persistence (P6-25)
    try {
      const cb = window.localStorage.getItem('ibkr_colorblind');
      if (cb === 'true') {
        document.documentElement.dataset.colorblind = 'true';
      }
    } catch {
      /* quota / disabled */
    }

    const handler = (evt) => {
      if (evt?.detail?.key) apply(evt.detail.key);
    };
    window.addEventListener('ibkr:theme-change', handler);
    return () => window.removeEventListener('ibkr:theme-change', handler);
  }, []);

  return null;
}
