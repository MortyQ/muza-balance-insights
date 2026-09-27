// The app theme, as main applies it (nativeTheme.themeSource): the window frame, native dialogs and menus and the
// page's prefers-color-scheme follow it. No dependencies: shared by main, preload and renderer.

export const THEME_PREFS = ['system', 'light', 'dark'] as const;

export type ThemePref = (typeof THEME_PREFS)[number];

export const DEFAULT_THEME: ThemePref = 'system';
