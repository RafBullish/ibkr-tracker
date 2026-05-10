// ═══════════════════════════════════════════════════════════════
//  CALM TRADING — Icon Set (inline SVG)
// ═══════════════════════════════════════════════════════════════

const p = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

const Icons = {
  grid: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  trending: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  bar: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  settings: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  search: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  plus: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  upload: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  ),
  refresh: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  edit: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  list: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill={color} />
      <circle cx="4" cy="12" r="1" fill={color} />
      <circle cx="4" cy="18" r="1" fill={color} />
    </svg>
  ),
  layers: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  book: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  cal: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  call: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  put: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <line x1="17" y1="7" x2="7" y2="17" />
      <polyline points="17 17 7 17 7 7" />
    </svg>
  ),
  download: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  chevron: (color, size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  command: (color, size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  ),
  shield: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  gauge: (color, size = 20) => (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...p}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
};

export default Icons;
