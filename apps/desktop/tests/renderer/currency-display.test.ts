// @vitest-environment happy-dom
// The home-wide «≈ $ / €» choice: parsing, carrying the old spending.view choice over, conversions, the button.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { SpendingFx } from '@contract/api.ts';
import { convertInline, convertLines, parseCurrencyPrefs, ratedCurrencies, shownText } from '@/entities/currency-display';
import { formatMoney } from '@/shared/lib';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

// reka-ui's popover positioning reaches for ResizeObserver, which happy-dom does not provide.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;

const FX: SpendingFx[] = [{ currency: 840, rate: 41, prevRate: null, nearest: false }, { currency: 978, rate: null, prevRate: null, nearest: false }];
const ON = { usd: true, eur: true };
const OFF = { usd: false, eur: false };

describe('parseCurrencyPrefs', () => {
  it('off for nothing or garbage; each field on its own; the old spending.view value works as is', () => {
    expect(parseCurrencyPrefs(null)).toEqual(OFF);
    expect(parseCurrencyPrefs('{oops')).toEqual(OFF);
    expect(parseCurrencyPrefs('[true]')).toEqual(OFF);
    expect(parseCurrencyPrefs('{"usd":true,"eur":"yes"}')).toEqual({ usd: true, eur: false });
    expect(parseCurrencyPrefs('{"split":false,"mark":true,"usd":false,"eur":true}')).toEqual({ usd: false, eur: true });
  });
});

describe('conversions and the button text', () => {
  it('only switched-on currencies with a rate, in menu order', () => {
    expect(ratedCurrencies(FX, ON).map((f) => f.currency)).toEqual([840]);
    expect(convertLines(41_000, FX, ON)).toEqual([`≈ ${formatMoney(1_000, 840)}`]);
    expect(convertLines(41_000, FX, OFF)).toEqual([]);
    const both: SpendingFx[] = [FX[0]!, { currency: 978, rate: 45, prevRate: null, nearest: true }];
    expect(convertInline(90_000, both, ON)).toBe(`≈ ${formatMoney(Math.round(90_000 / 41), 840)} · ${formatMoney(2_000, 978)}`);
    expect(convertInline(90_000, both, OFF)).toBe('');
    expect(shownText(both, ON)).toBe('₴ · $ €');
    expect(shownText(FX, ON)).toBe('₴ · $');
    expect(shownText(FX, OFF)).toBe('₴');
  });
});

describe('useCurrencyDisplayStore', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    setActivePinia(createPinia());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carries the old spending.view choice over once, writing the new key at once', async () => {
    mem.set('spending.view', '{"split":true,"mark":false,"usd":true,"eur":false}');
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    expect(useCurrencyDisplayStore().prefs).toEqual({ usd: true, eur: false });
    expect(JSON.parse(mem.get('home.currencies')!)).toEqual({ usd: true, eur: false });
  });

  it('its own key wins over the old one; set writes it; fx is published by setFx', async () => {
    mem.set('spending.view', '{"usd":true,"eur":true}');
    mem.set('home.currencies', '{"usd":false,"eur":true}');
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const s = useCurrencyDisplayStore();
    expect(s.prefs).toEqual({ usd: false, eur: true });
    s.set('usd', true);
    expect(JSON.parse(mem.get('home.currencies')!)).toEqual({ usd: true, eur: true });
    expect(s.fx).toEqual([]);
    s.setFx(FX);
    expect(s.fx).toEqual(FX);
  });

  it('a storage that throws: defaults, and set still works', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const s = useCurrencyDisplayStore();
    expect(s.prefs).toEqual(OFF);
    expect(() => s.set('eur', true)).not.toThrow();
    expect(s.prefs.eur).toBe(true);
  });
});

describe('CurrencyToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  async function mountToggle(fx: SpendingFx[]) {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { CurrencyToggle, useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const store = useCurrencyDisplayStore();
    store.setFx(fx);
    const w = mount(CurrencyToggle, { global: { plugins: [i18n] }, attachTo: document.body });
    await flushPromises();
    return { w, store };
  }

  it('the button names the currencies on screen; the switches, the note and a disabled one without a rate', async () => {
    const { w, store } = await mountToggle(FX);
    const trigger = document.body.querySelector<HTMLElement>('[aria-label="Показывать рядом в валюте: ₴"]');
    expect(trigger?.textContent).toContain('₴');
    trigger!.click();
    await flushPromises();
    expect(document.body.textContent).toContain('Итоги остаются в гривне');
    expect(document.body.textContent).toContain('По курсу твоих обменов за месяц');
    expect(document.body.textContent).toContain('Обменов в € ещё не было');
    const boxes = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(boxes.map((b) => b.disabled)).toEqual([false, true]);

    boxes[0]!.click();
    await flushPromises();
    expect(store.prefs.usd).toBe(true);
    expect(JSON.parse(localStorage.getItem('home.currencies') ?? '{}')).toEqual({ usd: true, eur: false });
    expect(document.body.querySelector('[aria-label="Показывать рядом в валюте: ₴ · $"]')).not.toBeNull();
    w.unmount();
  });

  it('a currency rated only by the nearest exchange says so', async () => {
    const { w } = await mountToggle([{ currency: 840, rate: 41, prevRate: null, nearest: true }, FX[1]!]);
    document.body.querySelector<HTMLElement>('[aria-label^="Показывать рядом в валюте"]')!.click();
    await flushPromises();
    expect(document.body.textContent).toContain('По курсу твоего ближайшего обмена — в этом месяце обменов не было');
    w.unmount();
  });
});
