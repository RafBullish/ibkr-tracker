// ═══════════════════════════════════════════════════════════════
//  THEME SWITCHER v3.0 « Midnight Terminal »
//
//  Radix DropdownMenu with two options (midnight + daylight), each
//  prefixed with a swatch preview built from the theme's declared
//  colors. Persists choice via applyTheme() which also dispatches
//  the `ibkr:theme-change` event so the rest of the app stays in
//  sync without a page reload.
//
//  Respect prefers-reduced-motion by skipping the animation-delay
//  on open (handled by Radix' dropdown state).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Sun, Moon } from 'lucide-react';
import { THEMES, applyTheme, getCurrentThemeKey } from '../../theme/tokens';

function ThemeSwatch({ theme }) {
  const colors = theme.preview || [];
  return (
    <span className="theme-switcher__swatch" aria-hidden="true">
      {colors.slice(0, 4).map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

export default function ThemeSwitcher({ align = 'end', className }) {
  const [current, setCurrent] = useState(() => getCurrentThemeKey());

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.key) setCurrent(e.detail.key);
    };
    window.addEventListener('ibkr:theme-change', handler);
    return () => window.removeEventListener('ibkr:theme-change', handler);
  }, []);

  const handleSelect = (key) => {
    applyTheme(key);
    setCurrent(key);
  };

  const activeTheme = THEMES[current] || THEMES.midnight;
  const ActiveIcon = activeTheme.isLight ? Sun : Moon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={['theme-switcher__trigger', className].filter(Boolean).join(' ')}
          aria-label={`Changer de thème. Thème actuel : ${activeTheme.name}.`}
        >
          <ActiveIcon size={16} strokeWidth={2} aria-hidden="true" />
          <span className="theme-switcher__trigger-label">{activeTheme.name}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          collisionPadding={8}
          className="theme-switcher__content"
        >
          <div className="theme-switcher__heading">Apparence</div>
          {Object.values(THEMES).map((theme) => {
            const active = theme.key === current;
            return (
              <DropdownMenu.Item
                key={theme.key}
                className="theme-switcher__item"
                data-active={active || undefined}
                onSelect={() => handleSelect(theme.key)}
              >
                <ThemeSwatch theme={theme} />
                <span className="theme-switcher__item-text">
                  <span className="theme-switcher__item-name">{theme.name}</span>
                  <span className="theme-switcher__item-desc">{theme.description}</span>
                </span>
                {active && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
