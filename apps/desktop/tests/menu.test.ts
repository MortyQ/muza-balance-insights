// Our own application menu instead of Electron's default one (which has Reload / Toggle Developer Tools and Help links
// through shell.openExternal), and an About with the disclaimer on every platform.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it } from 'vitest';
import { COPYRIGHT, DISCLAIMER, REPO } from '../src/shared/about.ts';
import { aboutPanelOptions, aboutText, menuTemplate } from '../src/main/menu.ts';

const ABOUT = { name: 'Balance Insights', version: '0.1.0' };
const DEV_ROLES = ['reload', 'forceReload', 'toggleDevTools', 'viewMenu'];

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? flatten(i.submenu) : [])]);
}
const roles = (items: MenuItemConstructorOptions[]) => flatten(items).map((i) => i.role).filter(Boolean);

describe.each(['darwin', 'win32', 'linux'] as const)('menu on %s', (platform) => {
  const build = (isPackaged: boolean) => {
    let aboutCalls = 0;
    let settingsCalls = 0;
    const t = menuTemplate({
      name: ABOUT.name,
      platform,
      isPackaged,
      showAbout: () => void (aboutCalls += 1),
      openSettings: () => void (settingsCalls += 1),
    });
    return { t, aboutCalls: () => aboutCalls, settingsCalls: () => settingsCalls };
  };

  it('packaged: no reload, no DevTools, no help role (it would bring back default links)', () => {
    const { t } = build(true);
    expect(roles(t).filter((r) => DEV_ROLES.includes(r!) || r === 'help')).toEqual([]);
  });

  it('dev: reload and DevTools are there, and that is the only difference', () => {
    const prod = roles(build(true).t);
    const dev = roles(build(false).t);
    expect(dev).toEqual(expect.arrayContaining(['reload', 'forceReload', 'toggleDevTools']));
    expect(dev.filter((r) => !prod.includes(r))).toEqual(['reload', 'forceReload', 'toggleDevTools']);
  });

  it('About is reachable; the only click handlers in the menu are Settings and About', () => {
    const { t, aboutCalls } = build(true);
    const items = flatten(t);
    const clickable = items.filter((i) => typeof i.click === 'function');
    if (platform === 'darwin') {
      expect(items.some((i) => i.role === 'about')).toBe(true);
      expect(clickable.map((i) => i.label)).toEqual(['Настройки…']);
    } else {
      expect(clickable.map((i) => i.label)).toEqual(['Настройки…', 'О программе']);
      (clickable[1]!.click as () => void)();
      expect(aboutCalls()).toBe(1);
    }
  });

  it('Settings: Cmd/Ctrl+, and it only asks the renderer to open its screen', () => {
    const { t, settingsCalls, aboutCalls } = build(true);
    const item = flatten(t).find((i) => i.label === 'Настройки…');
    expect(item?.accelerator).toBe('CmdOrCtrl+,');
    (item!.click as () => void)();
    expect([settingsCalls(), aboutCalls()]).toEqual([1, 0]);
  });
});

describe('About', () => {
  it('native panel (macOS): name, version, copyright, disclaimer and the repo as text', () => {
    expect(aboutPanelOptions(ABOUT)).toEqual({
      applicationName: 'Balance Insights',
      applicationVersion: '0.1.0',
      version: '',
      copyright: COPYRIGHT,
      credits: `${DISCLAIMER}\n${REPO}`,
    });
  });

  it('message box (Windows / Linux): the same content', () => {
    const t = aboutText(ABOUT);
    expect(t.message).toBe('Balance Insights 0.1.0');
    for (const s of [DISCLAIMER, COPYRIGHT, REPO]) expect(t.detail).toContain(s);
  });

  it('the disclaimer is the agreed text, and the renderer shows the same constant (connect screen and settings)', () => {
    expect(DISCLAIMER).toBe('Неофициальное приложение, не связано с Monobank.');
    for (const file of ['features/people/ConnectFirstFeature.vue', 'widgets/about-app/AboutApp.vue']) {
      const src = fs.readFileSync(fileURLToPath(new URL(`../src/renderer/src/${file}`, import.meta.url)), 'utf8');
      expect(src, file).toMatch(/import \{[^}]*\bDISCLAIMER\b[^}]*\} from '@contract\/about\.ts'/);
      expect(src, file).toMatch(/\{\{ DISCLAIMER \}\}/);
      expect(src, file).not.toContain('не связано с Monobank');
    }
  });

  it('main installs the menu and the About panel before the window is created', () => {
    const main = fs.readFileSync(fileURLToPath(new URL('../src/main/index.ts', import.meta.url)), 'utf8');
    const at = (s: string) => {
      const i = main.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      return i;
    };
    const win = at('new BrowserWindow(');
    expect(at('app.setAboutPanelOptions(aboutPanelOptions(')).toBeLessThan(win);
    expect(at('Menu.setApplicationMenu(')).toBeLessThan(win);
    expect(main).not.toMatch(/setApplicationMenu\(\s*null/);
  });
});
