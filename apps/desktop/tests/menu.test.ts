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
    let lockCalls = 0;
    const t = menuTemplate({
      name: ABOUT.name,
      platform,
      isPackaged,
      showAbout: () => void (aboutCalls += 1),
      openSettings: () => void (settingsCalls += 1),
      lockNow: () => void (lockCalls += 1),
    });
    return { t, aboutCalls: () => aboutCalls, settingsCalls: () => settingsCalls, lockCalls: () => lockCalls };
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

  it('About is reachable; the only click handlers are Settings, Lock and About', () => {
    const { t, aboutCalls } = build(true);
    const items = flatten(t);
    const clickable = items.filter((i) => typeof i.click === 'function');
    if (platform === 'darwin') {
      expect(items.some((i) => i.role === 'about')).toBe(true);
      expect(clickable.map((i) => i.label)).toEqual(['Настройки…', 'Заблокировать']);
    } else {
      expect(clickable.map((i) => i.label)).toEqual(['Настройки…', 'Заблокировать', 'О программе']);
      (clickable[2]!.click as () => void)();
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

  it('Lock: Cmd/Ctrl+L, it only asks main to lock', () => {
    const { t, lockCalls, settingsCalls } = build(true);
    const item = flatten(t).find((i) => i.label === 'Заблокировать');
    expect(item?.accelerator).toBe('CmdOrCtrl+L');
    (item!.click as () => void)();
    expect([lockCalls(), settingsCalls()]).toEqual([1, 0]);
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

  it('settings «О программе» shows license, source and author from about.ts', async () => {
    const about = await import('../src/shared/about.ts');
    expect(about.LICENSE).toBe('MIT');
    expect(about.AUTHOR).toBe('MortyQ');
    const src = fs.readFileSync(fileURLToPath(new URL('../src/renderer/src/widgets/settings/components/AboutApp.vue', import.meta.url)), 'utf8');
    for (const name of ['LICENSE', 'REPO', 'AUTHOR']) expect(src, name).toContain(`{{ ${name} }}`);
  });

  it('the disclaimer is the agreed text; the renderer shows the dictionary one, the same text in Russian (connect screen and settings)', async () => {
    expect(DISCLAIMER).toBe('Неофициальное приложение, не связано с Monobank.');
    const { MESSAGES } = await import('../src/shared/i18n/index.ts');
    expect(MESSAGES.ru.common.disclaimer).toBe(DISCLAIMER);
    for (const m of Object.values(MESSAGES)) expect(m.common.disclaimer).toMatch(/Monobank/);
    for (const file of ['features/integrations/ConnectFirstFeature.vue', 'widgets/settings/components/AboutApp.vue']) {
      const src = fs.readFileSync(fileURLToPath(new URL(`../src/renderer/src/${file}`, import.meta.url)), 'utf8');
      expect(src, file).toContain("{{ $t('common.disclaimer') }}");
      expect(src, file).not.toContain('Monobank.');
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
