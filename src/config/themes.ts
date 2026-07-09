export const COLOR_THEME_STORAGE_KEY = 'emi-color-theme';

export const colorThemes = [
  { id: 'violet', label: 'Violet' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'rose', label: 'Rose' },
  { id: 'blue', label: 'Blue' },
] as const;

export type ColorThemeId = (typeof colorThemes)[number]['id'];

export const defaultColorTheme: ColorThemeId = 'violet';

export function isColorThemeId(value: string): value is ColorThemeId {
  return colorThemes.some((theme) => theme.id === value);
}

export const appearanceModes = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;

export type AppearanceMode = (typeof appearanceModes)[number]['id'];
