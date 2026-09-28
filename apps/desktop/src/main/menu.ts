// The application menu and the About panel, as data. Without an explicit menu Electron installs its default one:
// View → Reload / Toggle Developer Tools, and Help → links that go through shell.openExternal (Checklist #15).
import type { AboutPanelOptionsOptions, MenuItemConstructorOptions } from 'electron';
import { COPYRIGHT, REPO } from '../shared/about.ts';
import type { Translate } from './i18n.ts';

export function aboutPanelOptions(opts: { name: string; version: string; t: Translate }): AboutPanelOptionsOptions {
  return {
    applicationName: opts.name,
    applicationVersion: opts.version,
    version: '',
    copyright: COPYRIGHT,
    credits: `${opts.t('common.disclaimer')}\n${REPO}`,
  };
}

/** Text of the About dialog on Windows and Linux, where the native panel is not used. */
export function aboutText(opts: { name: string; version: string; t: Translate }): { message: string; detail: string } {
  return { message: `${opts.name} ${opts.version}`, detail: `${opts.t('common.disclaimer')}\n\n${COPYRIGHT}\n${REPO}` };
}

/**
 * macOS: the app menu with the native About panel and «Settings…» (Cmd+,). Windows / Linux: File → Settings (Ctrl+,) and
 * Quit, Help → About (a message box). Settings only tells the renderer to open its screen.
 * Lock (Cmd/Ctrl+L) asks main to lock (a no-op while the lock is off).
 * Reload and DevTools only in an unpackaged app (webPreferences.devTools is off in a packaged one anyway).
 * Labels come from `t`: main rebuilds the menu when the language changes.
 */
export function menuTemplate(opts: {
  name: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  showAbout: () => void;
  openSettings: () => void;
  lockNow: () => void;
  t: Translate;
}): MenuItemConstructorOptions[] {
  const { t } = opts;
  const settings: MenuItemConstructorOptions = { label: t('main.menu.settings'), accelerator: 'CmdOrCtrl+,', click: () => opts.openSettings() };
  const lock: MenuItemConstructorOptions = { label: t('main.menu.lock'), accelerator: 'CmdOrCtrl+L', click: () => opts.lockNow() };
  const dev: MenuItemConstructorOptions[] = opts.isPackaged
    ? []
    : [{ label: t('main.menu.develop'), submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }] }];
  if (opts.platform === 'darwin') {
    return [
      {
        label: opts.name,
        submenu: [
          { role: 'about', label: t('main.menu.about') },
          { type: 'separator' },
          settings,
          lock,
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
    { label: t('main.menu.file'), submenu: [settings, lock, { type: 'separator' }, { role: 'quit', label: t('main.menu.quit') }] },
    { role: 'editMenu' },
    ...dev,
    { label: t('main.menu.help'), submenu: [{ label: t('main.menu.about'), click: () => opts.showAbout() }] },
  ];
}
