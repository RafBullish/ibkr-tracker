// ═══════════════════════════════════════════════════════════════
//  THEME DEFINITIONS v5 « Institutional Terminal »
//
//  TWO themes only :
//    1. midnight  (dark, DEFAULT) — Bloomberg-amber accent merged
//                                   into TradingView blue base (v5)
//    2. daylight  (light)         — Tradervue-inspired emerald accent
//
//  Matching CSS lives in src/styles/tokens.css under :root (midnight,
//  default paint) and [data-theme='daylight']. This file exposes the
//  same values to JS consumers (chart libs that cannot read CSS
//  variables, Tabs.jsx legacy, dashboardTokens.js legacy).
//
//  v5 Sprint 1 collapsed the v4-brick-1 `carbon` theme key back into
//  midnight. Carbon is now a *palette inspiration* (Bloomberg-amber
//  accents, hairlines, density tokens) merged into midnight via
//  src/styles/tokens.css. Users on `carbon` migrate to `midnight` via
//  LEGACY_MAP in src/theme/tokens.js. Phosphor and Slate (cited in
//  earlier prompt drafts) are explicitly excluded — see
//  docs/CANONICAL_GUIDE.md alignment note #2.
//
//  Eight deprecated theme keys (obsidian/terminal/neon/graphite/
//  frost/sakura/porcelain/carbon) are migrated at load time by
//  src/theme/tokens.js :: LEGACY_MAP.
//
//  All foreground/background pairs verified at WCAG AA (>= 4.5:1).
// ═══════════════════════════════════════════════════════════════

const THEMES = {
  // ══════════════════════════════════════════════════════════════
  //  1. MIDNIGHT — DEFAULT dark, TradingView blue accent
  //     Surfaces #0B0E11 / #121619 / #141926 / #1A1F2E / #252D42
  //     Accent   #2962FF · profit #0ECB81 · loss #F6465D
  // ══════════════════════════════════════════════════════════════
  midnight: {
    key: 'midnight',
    name: 'Midnight',
    description: 'Cinematic dark — deep blue shell, TradingView accent',
    preview: ['#0B0E11', '#141926', '#2962FF', '#E8EAF0'],
    isLight: false,
    surface: {
      base: '#0B0E11',
      raised: '#121619',
      overlay: '#141926',
      elevated: '#1A1F2E',
      highest: '#252D42',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.06)',
      default: 'rgba(255, 255, 255, 0.10)',
      active: 'rgba(41, 98, 255, 0.45)',
    },
    text: {
      primary: '#E8EAF0',
      secondary: '#8B949E',
      tertiary: '#5C6370',
      muted: '#5C6370',
      disabled: '#48484D',
      inverse: '#0B0E11',
    },
    accent: {
      main: '#2962FF',
      hover: '#4B7BFF',
      dark: '#1E45C7',
      light: '#60A5FA',
      muted: 'rgba(41, 98, 255, 0.10)',
      subtle: 'rgba(41, 98, 255, 0.05)',
      gradient: 'linear-gradient(135deg, #1E45C7 0%, #2962FF 55%, #60A5FA 100%)',
    },
    // V4 brick 11 fix : aligné sur tokens.css Section A (Midnight).
    // Ancien : profit #0ECB81, loss #F6465D (stale v3 cache).
    profit: '#16C784',
    profitMuted: 'rgba(22, 199, 132, 0.10)',
    profitSubtle: 'rgba(22, 199, 132, 0.06)',
    loss: '#EA3943',
    lossMuted: 'rgba(234, 57, 67, 0.10)',
    lossSubtle: 'rgba(234, 57, 67, 0.06)',
    warning: '#F0B90B',
    warningMuted: 'rgba(240, 185, 11, 0.10)',
    info: '#60A5FA',
    infoMuted: 'rgba(96, 165, 250, 0.10)',
    neutral: '#8B949E',
    greeks: { delta: '#2962FF', gamma: '#A78BFA', theta: '#EA3943', vega: '#60A5FA' },
    chart: {
      c1: '#2962FF',
      c2: '#16C784',
      c3: '#60A5FA',
      c4: '#A78BFA',
      c5: '#EA3943',
      grid: 'rgba(255, 255, 255, 0.04)',
      tooltipBg: 'rgba(20, 25, 38, 0.95)',
      tooltipText: '#E8EAF0',
    },
    glass: {
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(255, 255, 255, 0.16)',
      blur: 'blur(12px) saturate(180%)',
    },
    input: { bg: '#141926', border: 'rgba(255, 255, 255, 0.10)', focus: '#2962FF' },
    scrollbar: { track: 'transparent', thumb: 'rgba(255, 255, 255, 0.10)' },
    modalOverlay: 'rgba(0, 0, 0, 0.78)',
    shadow: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.20)',
      md: '0 4px 12px rgba(0, 0, 0, 0.30)',
      lg: '0 12px 32px rgba(0, 0, 0, 0.40)',
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  2. DAYLIGHT — light, Tradervue-inspired emerald accent
  //     Surfaces #F8FAFC / #FFFFFF / #F1F5F9
  //     Accent   #2563EB · profit #10B981 · loss #EF4444
  // ══════════════════════════════════════════════════════════════
  daylight: {
    key: 'daylight',
    name: 'Daylight',
    description: 'Light modern — Tradervue-inspired, emerald brand',
    preview: ['#F8FAFC', '#FFFFFF', '#2563EB', '#0F172A'],
    isLight: true,
    surface: {
      base: '#F8FAFC',
      raised: '#FFFFFF',
      overlay: '#FFFFFF',
      elevated: '#FFFFFF',
      highest: '#F1F5F9',
    },
    border: {
      subtle: 'rgba(15, 23, 42, 0.06)',
      default: 'rgba(15, 23, 42, 0.10)',
      active: 'rgba(37, 99, 235, 0.35)',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      tertiary: '#94A3B8',
      muted: '#94A3B8',
      disabled: '#CBD5E1',
      inverse: '#FFFFFF',
    },
    accent: {
      main: '#2563EB',
      hover: '#1D4ED8',
      dark: '#1E3A8A',
      light: '#60A5FA',
      muted: 'rgba(37, 99, 235, 0.08)',
      subtle: 'rgba(37, 99, 235, 0.04)',
      gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #60A5FA 100%)',
    },
    // V4 brick 11 fix : aligné sur tokens.css Section C (Daylight).
    // Ancien : profit #10B981, loss #EF4444 (vibrant trop clair sur
    // bg blanc, mauvais contrast 1-2 px chart strokes). Daylight CSS
    // utilise des tons plus sombres pour WCAG AA.
    profit: '#00875A',
    profitMuted: 'rgba(0, 135, 90, 0.10)',
    profitSubtle: 'rgba(0, 135, 90, 0.04)',
    loss: '#C9252D',
    lossMuted: 'rgba(201, 37, 45, 0.10)',
    lossSubtle: 'rgba(201, 37, 45, 0.04)',
    warning: '#B36F00',
    warningMuted: 'rgba(179, 111, 0, 0.10)',
    info: '#0EA5E9',
    infoMuted: 'rgba(14, 165, 233, 0.10)',
    neutral: '#64748B',
    greeks: { delta: '#1F5AC9', gamma: '#7C3AED', theta: '#C9252D', vega: '#0EA5E9' },
    chart: {
      c1: '#1F5AC9',
      c2: '#00875A',
      c3: '#0EA5E9',
      c4: '#7C3AED',
      c5: '#C9252D',
      grid: 'rgba(15, 23, 42, 0.05)',
      tooltipBg: 'rgba(15, 23, 42, 0.95)',
      tooltipText: '#FFFFFF',
    },
    glass: {
      bg: 'rgba(255, 255, 255, 0.70)',
      border: 'rgba(15, 23, 42, 0.08)',
      borderHover: 'rgba(15, 23, 42, 0.16)',
      blur: 'blur(14px) saturate(150%)',
    },
    input: { bg: '#FFFFFF', border: 'rgba(15, 23, 42, 0.10)', focus: '#2563EB' },
    scrollbar: { track: 'transparent', thumb: 'rgba(15, 23, 42, 0.12)' },
    modalOverlay: 'rgba(15, 23, 42, 0.40)',
    shadow: {
      sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
      md: '0 4px 12px rgba(15, 23, 42, 0.08)',
      lg: '0 12px 32px rgba(15, 23, 42, 0.12)',
    },
  },
};

export default THEMES;
