// The application menu and the About panel, as data. Without an explicit menu Electron installs its default one:
// View → Reload / Toggle Developer Tools, and Help → links that go through shell.openExternal (Checklist #15).
import type { AboutPanelOptionsOptions, MenuItemConstructorOptions } from 'electron';
import { COPYRIGHT, DISCLAIMER, REPO } from '../shared/about.ts';

export function aboutPanelOptions(opts: { name: string; version: string }): AboutPanelOptionsOptions {
  return {
    applicationName: opts.name,
    applicationVersion: opts.version,
    version: '',
    copyright: COPYRIGHT,
    credits: `${DISCLAIMER}\n${REPO}`,
  };
}

/** Text of the About dialog on Windows and Linux, where the native panel is not used. */
export function aboutText(opts: { name: string; version: string }): { message: string; detail: string } {
  return { message: `${opts.name} ${opts.version}`, detail: `${DISCLAIMER}\n\n${COPYRIGHT}\n${REPO}` };
}

/**
 * macOS: the app menu with the native About panel and «Настройки…» (Cmd+,). Windows / Linux: File → Settings (Ctrl+,) and
 * Quit, Help → About (a message box). Settings only tells the renderer to open its screen.
 * Reload and DevTools only in an unpackaged app (webPreferences.devTools is off in a packaged one anyway).
 */
export function menuTemplate(opts: {
  name: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  showAbout: () => void;
  openSettings: () => void;
}): MenuItemConstructorOptions[] {
  const settings: MenuItemConstructorOptions = { label: 'Настройки…', accelerator: 'CmdOrCtrl+,', click: () => opts.openSettings() };
  const dev: MenuItemConstructorOptions[] = opts.isPackaged
    ? []
    : [{ label: 'Разработка', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }] }];
  if (opts.platform === 'darwin') {
    return [
      {
        label: opts.name,
        submenu: [
          { role: 'about', label: 'О программе' },
          { type: 'separator' },
          settings,
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      { role: 'windowMenu' },
      ...dev,
    ];
  }
  return [
    { label: 'Файл', submenu: [settings, { type: 'separator' }, { role: 'quit', label: 'Выход' }] },
    { role: 'editMenu' },
    ...dev,
    { label: 'Справка', submenu: [{ label: 'О программе', click: () => opts.showAbout() }] },
  ];
}
