import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from 'react';

import { COLOR_THEME_STORAGE_KEY, defaultColorTheme, isColorThemeId, type ColorThemeId } from '@/config/themes';

interface ColorThemeContextValue {
  colorTheme: ColorThemeId;
  setColorTheme: (theme: ColorThemeId) => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

function readStoredColorTheme(): ColorThemeId {
  if (typeof window === 'undefined') {
    return defaultColorTheme;
  }

  const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
  return stored && isColorThemeId(stored) ? stored : defaultColorTheme;
}

function applyColorTheme(theme: ColorThemeId): void {
  document.documentElement.dataset.theme = theme;
}

export function ColorThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>(readStoredColorTheme);

  useEffect(() => {
    applyColorTheme(colorTheme);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
  }, [colorTheme]);

  const setColorTheme = (theme: ColorThemeId): void => {
    setColorThemeState(theme);
  };

  return <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>{children}</ColorThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useColorTheme(): ColorThemeContextValue {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used within a ColorThemeProvider');
  }
  return context;
}
