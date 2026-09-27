// The settings screen: which section a query opens and how the arrows walk the menu.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { describe, expect, it } from 'vitest';

const { settingsSection } = await import('@/shared/config');
const { nextSection } = await import('@/widgets/settings-nav/utils.ts');
const { osStoreName } = await import('@/shared/lib');
const { tokensStorage } = await import('@/features/security-info/utils.ts');
const { NAV_LABEL_CLASS } = await import('@/widgets/settings-nav/constants.ts');

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
    expect(NAV_LABEL_CLASS).toContain('max-[45rem]:sr-only');
    expect(NAV_LABEL_CLASS).not.toContain('not-sr-only');
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
  ])('settingsSection(%j) → %s', (q, s) => expect(settingsSection(q)).toBe(s));

  it('arrows wrap and walk the menu order', () => {
    expect(nextSection('people', -1)).toBe('about');
    expect(nextSection('about', 1)).toBe('people');
    expect(nextSection('data', 1)).toBe('updates');
  });

  it('appearance sits between updates and about', () => {
    expect(nextSection('updates', 1)).toBe('appearance');
    expect(nextSection('appearance', 1)).toBe('about');
    expect(nextSection('about', -1)).toBe('appearance');
  });
});

describe('language options (for the select)', () => {
  it('exactly the locales main accepts, each with its own name and a flag country', async () => {
    const { LANGUAGE_OPTIONS } = await import('@/features/language-select/constants.ts');
    const { LOCALES } = await import('@contract/locale.ts');
    expect(LANGUAGE_OPTIONS.map((o) => o.value)).toEqual([...LOCALES]);
    expect(LANGUAGE_OPTIONS.map((o) => [o.label, o.country])).toEqual([
      ['Українська', 'UA'],
      ['English', 'GB'],
      ['Русский', 'RU'],
    ]);
  });
});
