// @vitest-environment happy-dom
// The settings screen: which section a query opens and how the arrows walk the menu.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { SettingsSection } from '@/shared/config';
import type { SideNavItem } from '@/shared/layout';

const { settingsSection } = await import('@/shared/config');
const { nextItem, SIDE_NAV_LABEL_CLASS } = await import('@/shared/layout');
const { NAV_GROUPS } = await import('@/widgets/settings/constants.ts');
const nextSection = (s: SettingsSection, delta: 1 | -1) => nextItem(NAV_GROUPS, s, delta);
const { osStoreName } = await import('@/shared/lib');
const { tokensStorage } = await import('@/features/settings/security-info/utils.ts');
const { updateLine } = await import('@/features/settings/app-update/utils.ts');

describe('storage section', () => {
  it('says nothing about encryption until main has answered', () => {
    expect(tokensStorage(null, 'X')).toBeNull();
  });
  it('secure / not secure', () => {
    expect(tokensStorage(true, 'связкой ключей macOS')).toMatchObject({ ok: true, badge: 'Шифрование доступно' });
    expect(tokensStorage(true, 'связкой ключей macOS')?.hint).toContain('Зашифрованы связкой ключей macOS.');
    expect(tokensStorage(false, 'X')).toMatchObject({ ok: false, badge: 'Шифрование недоступно' });
  });
});

// Named properties, no ease-in; up to 400 ms — softer than the skill's 300 ms at the user's request.
describe('reveal transitions', () => {
  it('EXPAND_TRANSITION', async () => {
    const t = (await import('@/shared/lib')).EXPAND_TRANSITION;
    for (const cls of [t.enterActiveClass, t.leaveActiveClass]) {
      expect(cls).toMatch(/transition-\[/);
      expect(cls).not.toMatch(/transition-all|ease-in(?!-out)/);
      const ms = Number(/duration-(\d+)/.exec(cls)?.[1]);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(400);
    }
  });
});

describe('menu group titles', () => {
  it('keep their padding on wide windows: hidden only below 45rem, never via not-sr-only (it zeroes padding)', () => {
    expect(SIDE_NAV_LABEL_CLASS).toContain('max-[45rem]:sr-only');
    expect(SIDE_NAV_LABEL_CLASS).not.toContain('not-sr-only');
  });
});

describe('token store name by OS', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 'связкой ключей macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'защищённым хранилищем Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'хранилищем паролей системы'],
    ['', 'системным хранилищем'],
  ])('osStoreName(%s)', (ua, name) => expect(osStoreName(ua)).toBe(name));
});

describe('settings sections', () => {
  it.each([
    [undefined, 'people'],
    ['', 'people'],
    ['x', 'people'],
    [['connections', 'data'], 'people'],
    ['network', 'network'],
    ['appearance', 'appearance'],
    ['lock', 'lock'],
    // «Auto-sync» is a block of «Connections» now, not a section of its own.
    ['auto-sync', 'people'],
  ])('settingsSection(%j) → %s', (q, s) => expect(settingsSection(q)).toBe(s));

  it('arrows wrap and walk the menu order', () => {
    expect(nextSection('people', -1)).toBe('about');
    expect(nextSection('about', 1)).toBe('people');
    expect(nextSection('data', 1)).toBe('updates');
    expect(nextSection('connections', 1)).toBe('lock');
  });

  it('every section is in the menu, once and in the order of SETTINGS_SECTIONS', async () => {
    const { SETTINGS_SECTIONS } = await import('@/shared/config');
    const inMenu = NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => (i.id === null ? [] : [i.id])));
    expect(inMenu).toEqual([...SETTINGS_SECTIONS]);
  });

  it('appearance and language sit between updates and about', () => {
    expect(nextSection('updates', 1)).toBe('appearance');
    expect(nextSection('appearance', 1)).toBe('language');
    expect(nextSection('language', 1)).toBe('about');
    expect(nextSection('about', -1)).toBe('language');
  });

  it('language is a section now, not «Soon»; the menu has no disabled items left', async () => {
    const items: ReadonlyArray<SideNavItem<SettingsSection>> = NAV_GROUPS.flatMap((g): ReadonlyArray<SideNavItem<SettingsSection>> => g.items);
    expect(items.find((i) => i.label === 'settings.nav.language')?.id).toBe('language');
    expect(items.filter((i) => i.id === null)).toEqual([]);
    expect(settingsSection('language')).toBe('language');
  });
});

describe('side menu arrows', () => {
  it('skip «Soon» items and wrap across groups', () => {
    const groups = [
      { label: 'settings.nav.groupUsers', items: [{ label: 'settings.nav.people', icon: 'lucide:users', id: 'a' }, { label: 'settings.nav.data', icon: 'lucide:database', id: null }] },
      { items: [{ label: 'settings.nav.lock', icon: 'lucide:lock', id: 'b' }] },
    ] as const;
    expect(nextItem(groups, 'a', 1)).toBe('b');
    expect(nextItem(groups, 'b', 1)).toBe('a');
    expect(nextItem(groups, 'a', -1)).toBe('b');
  });
});

describe('language options (for the select)', () => {
  it('exactly the locales main accepts, each with its own name and a flag country', async () => {
    const { LANGUAGE_OPTIONS } = await import('@/features/settings/language-select/constants.ts');
    const { LOCALES } = await import('@contract/locale.ts');
    expect(LANGUAGE_OPTIONS.map((o) => o.value)).toEqual([...LOCALES]);
    expect(LANGUAGE_OPTIONS.map((o) => [o.label, o.country])).toEqual([
      ['Українська', 'UA'],
      ['English', 'GB'],
      ['Русский', 'RU'],
    ]);
  });
});

// Main sends why an update failed; the text is the renderer's, in the app's language.
describe('update errors', () => {
  it.each([
    ['offline', 'нет связи с GitHub'],
    ['rejected', 'не прошло проверку подписи'],
    ['download', 'Не удалось скачать обновление'],
    ['mismatch', 'не совпал с подписанным описанием'],
  ] as const)('%s', (reason, text) => {
    expect(updateLine({ phase: 'error', reason })).toContain(text);
  });
});

// «Restart and update» cannot restart during an import (main refuses): the button is off and the line says why.
describe('a ready update during an import', () => {
  const ready = { phase: 'ready', version: '0.1.9' } as const;

  it('the line says the restart waits for the import', () => {
    expect(updateLine(ready)).toContain('установится при перезапуске');
    expect(updateLine(ready, true)).toContain('Идёт импорт');
    expect(updateLine(ready, true)).toContain('0.1.9');
  });

  it('the import changes no other line', () => {
    expect(updateLine({ phase: 'available', version: '0.1.9', mode: 'auto' }, true)).toBe(updateLine({ phase: 'available', version: '0.1.9', mode: 'auto' }));
  });

  it('the button is disabled while the import runs', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { default: UpdateActions } = await import('@/features/settings/app-update/components/UpdateActions.vue');
    const button = (importRunning: boolean) =>
      mount(UpdateActions, { props: { state: ready, importRunning }, global: { plugins: [i18n] } }).get('button');
    expect(button(false).attributes('disabled')).toBeUndefined();
    expect(button(true).attributes('disabled')).toBeDefined();
  });
});

// «Connections» holds everything about the banks' data: the banks, auto-sync, the history download.
describe('the connections section', () => {
  it('auto-sync has no menu item of its own', () => {
    const labels = NAV_GROUPS.flatMap((g) => g.items.map((i): string => i.label));
    expect(labels).not.toContain('settings.nav.autoSync');
  });

  it('a nested settings row is indented under the row above it', async () => {
    const { SettingsRow } = await import('@/shared/layout');
    const row = (nested: boolean) => mount(SettingsRow, { props: { title: 'x', nested } }).classes();
    expect(row(true)).toContain('pl-8');
    expect(row(false)).not.toContain('pl-8');
  });

  it('a section shows an action next to its title', async () => {
    const { SettingsSection } = await import('@/shared/layout');
    const w = mount(SettingsSection, { props: { title: 'Banks' }, slots: { action: '<button>Add</button>' } });
    expect(w.get('h2').element.parentElement?.parentElement?.querySelector('button')?.textContent).toBe('Add');
  });
});
