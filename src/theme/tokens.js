// ═══════════════════════════════════════════════════════════════
//  DESIGN TOKENS v5 « Institutional Terminal »
//
//  Reads from themes.js, exposes the active theme as `T` for JS
//  consumers. Matching CSS tokens live in src/styles/tokens.css
//  under :root (midnight, default paint) and [data-theme='daylight'].
//
//  Active themes    : midnight (DEFAULT dark) · daylight (light)
//  Storage key      : `ibkr_theme` (unchanged from Aura v4/v5)
//
//  LEGACY_MAP migrates eight deprecated theme keys transparently on
//  first load. v5 Sprint 1 re-added `carbon` to the map after
//  collapsing the v4-brick-1 `carbon` theme back into midnight
//  (Carbon palette inspiration — Bloomberg-amber accent, hairlines,
//  density tokens — is now baked into midnight via tokens.css).
// ═══════════════════════════════════════════════════════════════

import THEMES from './themes';

const STORAGE_KEY = 'ibkr_theme';
const DEFAULT_KEY = 'midnight';

// Legacy theme key migration. One-shot rewrite on load.
const LEGACY_MAP = {
  // Dark-family themes → new midnight
  obsidian: 'midnight',
  terminal: 'midnight',
  neon: 'midnight',
  graphite: 'midnight',
  carbon: 'midnight', // v5 Sprint 1 collapse — see themes.js header
  // Light-family themes → new daylight
  frost: 'daylight',
  sakura: 'daylight',
  porcelain: 'daylight',
};

function resolveThemeKey(raw) {
  if (!raw) return DEFAULT_KEY;
  if (THEMES[raw]) return raw;
  const mapped = LEGACY_MAP[raw];
  if (mapped && THEMES[mapped]) return mapped;
  return DEFAULT_KEY;
}

function getCurrentThemeKey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const resolved = resolveThemeKey(raw);
    if (resolved !== raw) {
      // Migrate the stored value so the next load is clean.
      localStorage.setItem(STORAGE_KEY, resolved);
    }
    return resolved;
  } catch {
    return DEFAULT_KEY;
  }
}

function getThemeTokens(key) {
  const theme = THEMES[key] || THEMES[DEFAULT_KEY];
  return {
    ...theme,
    // Shared constants across both themes
    radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, full: 9999 },
    fonts: {
      sans: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      mono: "'JetBrains Mono Variable', 'SF Mono', Menlo, Consolas, monospace",
      ...(theme.fonts || {}),
    },
    // Backward-compat aliases
    profitDim: theme.profitSubtle || theme.profitMuted,
    lossDim: theme.lossSubtle || theme.lossMuted,
  };
}

export const T = getThemeTokens(getCurrentThemeKey());

/**
 * Apply a theme at runtime. Mirrors GlobalStyles.jsx so any caller
 * (ThemeSwitcher dropdown, Settings picker) can switch themes without
 * a reload. CSS-driven components update instantly. Components that
 * read the JS `T` cache (legacy Tabs/KPICard) stay stale until reload
 * — acceptable since both caches point at equivalent palettes.
 */
function applyTheme(rawKey) {
  const key = resolveThemeKey(rawKey);
  const theme = THEMES[key];
  const isLight = !!theme.isLight;
  const root = document.documentElement;

  root.dataset.theme = key;
  root.classList.toggle('is-light', isLight);
  document.body.className = `theme-${key}${isLight ? ' is-light' : ''}`;

  // Sync the mobile browser chrome colour
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.surface.base);

  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* quota */
  }

  // Fire a window event so non-React consumers (Recharts widgets,
  // lightweight-charts wrappers) can re-read palette without a reload.
  window.dispatchEvent(new CustomEvent('ibkr:theme-change', { detail: { key, theme } }));

  return key;
}

export { THEMES, getCurrentThemeKey, getThemeTokens, applyTheme, STORAGE_KEY };
export default T;
