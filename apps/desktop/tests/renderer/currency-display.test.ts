// @vitest-environment happy-dom
// The home-wide currency choice: parsing, carrying the old spending.view choice over, the money format, the switch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { RatesView } from '@contract/api.ts';
import { moneyFormat, parseCurrencyChoice, rateDate, shownText } from '@/entities/currency-display';
import { formatMoney } from '@/shared/lib';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

// reka-ui's popover positioning and the segmented control's pill reach for ResizeObserver, which happy-dom does not provide.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

// 2026-10-05 10:00 Kyiv (UTC+3).
const FETCHED = Date.UTC(2026, 9, 5, 7, 0) / 1000;
const RATES: RatesView = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 50 }], fetchedAt: FETCHED, saved: false };
const NONE = { uah: false, usd: false, eur: false };

describe('parseCurrencyChoice', () => {
  it('hryvnia and nothing else by default, for garbage too', () => {
    for (const raw of [null, '{oops', '[1]', '{"main":123}']) expect(parseCurrencyChoice(raw)).toEqual({ main: 980, also: NONE });
  });
  it('the new shape; each «also» field on its own', () => {
    expect(parseCurrencyChoice('{"main":978,"also":{"uah":true,"usd":"x"}}')).toEqual({ main: 978, also: { uah: true, usd: false, eur: false } });
  });
  it('the old { usd, eur } (and spending.view) value: hryvnia main, the same «≈» currencies', () => {
    expect(parseCurrencyChoice('{"usd":true,"eur":false}')).toEqual({ main: 980, also: { uah: false, usd: true, eur: false } });
    expect(parseCurrencyChoice('{"split":false,"mark":true,"usd":false,"eur":true}')).toEqual({ main: 980, also: { uah: false, usd: false, eur: true } });
  });
});

describe('moneyFormat', () => {
  it('hryvnia main: as is, «≈» lines in the other picked currencies', () => {
    const f = moneyFormat(RATES, { main: 980, also: { uah: true, usd: true, eur: true } });
    expect(f.currency).toBe(980);
    expect(f.money(4_000_00)).toBe(formatMoney(4_000_00, 980));
    expect(f.approx(4_000_00)).toEqual([`≈ ${formatMoney(100_00, 840)}`, `≈ ${formatMoney(80_00, 978)}`]);
    expect(f.approxInline(4_000_00)).toBe(`≈ ${formatMoney(100_00, 840)} · ${formatMoney(80_00, 978)}`);
  });
  it('euro main: amounts in euros, hryvnia as a «≈» line; convert gives euro cents', () => {
    const f = moneyFormat(RATES, { main: 978, also: { uah: true, usd: false, eur: true } });
    expect(f.currency).toBe(978);
    expect(f.convert(5_000_00)).toBe(100_00);
    expect(f.money(5_000_00)).toBe(formatMoney(100_00, 978));
    expect(f.approx(5_000_00)).toEqual([`≈ ${formatMoney(5_000_00, 980)}`]);
  });
  it('no rates: back to hryvnia, no «≈» lines', () => {
    const f = moneyFormat(null, { main: 840, also: { uah: true, usd: true, eur: true } });
    expect(f.currency).toBe(980);
    expect(f.money(100)).toBe(formatMoney(100, 980));
    expect(f.approx(100)).toEqual([]);
    expect(f.approxInline(100)).toBe('');
  });
});

describe('shownText and rateDate', () => {
  it('main first, then the «≈» currencies that have a rate', () => {
    expect(shownText(RATES, { main: 840, also: { uah: true, usd: true, eur: true } })).toBe('$ · ₴ €');
    expect(shownText(RATES, { main: 980, also: NONE })).toBe('₴');
    expect(shownText(null, { main: 978, also: { uah: false, usd: true, eur: false } })).toBe('₴');
  });
  it('the fetch time in Kyiv: «05.10, 10:00»', () => {
    expect(rateDate(FETCHED)).toBe('05.10, 10:00');
    expect(rateDate(Date.UTC(2026, 0, 31, 22, 5) / 1000)).toBe('01.02, 00:05');
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
    const expected = { main: 980, also: { uah: false, usd: true, eur: false } };
    expect(useCurrencyDisplayStore().choice).toEqual(expected);
    expect(JSON.parse(mem.get('home.currencies')!)).toEqual(expected);
  });

  it('an old spending.view with corrupt JSON: the new key is written with defaults, nothing throws', async () => {
    mem.set('spending.view', '{oops');
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    expect(() => useCurrencyDisplayStore()).not.toThrow();
    expect(useCurrencyDisplayStore().choice).toEqual({ main: 980, also: NONE });
    expect(JSON.parse(mem.get('home.currencies')!)).toEqual({ main: 980, also: NONE });
  });

  it('its own key wins over the old one; setMain / setAlso write it', async () => {
    mem.set('spending.view', '{"usd":true,"eur":true}');
    mem.set('home.currencies', '{"main":840,"also":{"eur":true}}');
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const s = useCurrencyDisplayStore();
    expect(s.choice).toEqual({ main: 840, also: { uah: false, usd: false, eur: true } });
    s.setMain(978);
    s.setAlso('uah', true);
    expect(JSON.parse(mem.get('home.currencies')!)).toEqual({ main: 978, also: { uah: true, usd: false, eur: true } });
  });

  it('setRates: undefined until the first answer, the newest snapshot wins, null never replaces a real one', async () => {
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const s = useCurrencyDisplayStore();
    expect(s.rates).toBeUndefined();
    s.setRates(null);
    expect(s.rates).toBeNull();
    s.setRates(RATES);
    expect(s.rates).toEqual(RATES);
    s.setRates(null);
    expect(s.rates).toEqual(RATES);
    s.setRates({ ...RATES, fetchedAt: FETCHED - 60 });
    expect(s.rates).toEqual(RATES);
    const newer = { ...RATES, fetchedAt: FETCHED + 60 };
    s.setRates(newer);
    expect(s.rates).toEqual(newer);
  });

  it('a storage that throws: defaults, and the setters still work', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const s = useCurrencyDisplayStore();
    expect(s.choice).toEqual({ main: 980, also: NONE });
    expect(() => s.setAlso('eur', true)).not.toThrow();
    expect(() => s.setMain(840)).not.toThrow();
    expect(s.choice).toEqual({ main: 840, also: { uah: false, usd: false, eur: true } });
  });
});

describe('useMoneyFormat', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('formats by the answer\'s own rates and the choice, and publishes the rates to the switch', async () => {
    const { ref } = await import('vue');
    const { useCurrencyDisplayStore, useMoneyFormat } = await import('@/entities/currency-display');
    const store = useCurrencyDisplayStore();
    const rates = ref<RatesView | null | undefined>(undefined);
    const f = useMoneyFormat(() => rates.value);
    expect(store.rates).toBeUndefined();
    expect(f.value.currency).toBe(980);
    store.setMain(840);
    expect(f.value.currency).toBe(980);
    rates.value = RATES;
    await flushPromises();
    expect(store.rates).toEqual(RATES);
    expect(f.value.money(4_000_00)).toBe(formatMoney(100_00, 840));
  });
});

describe('CurrencyToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  async function openToggle(rates?: RatesView | null) {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { CurrencyToggle, useCurrencyDisplayStore } = await import('@/entities/currency-display');
    const store = useCurrencyDisplayStore();
    if (rates !== undefined) store.setRates(rates);
    const w = mount(CurrencyToggle, { global: { plugins: [i18n] }, attachTo: document.body });
    await flushPromises();
    document.body.querySelector<HTMLElement>('[aria-label^="Валюты:"]')!.click();
    await flushPromises();
    return { w, store };
  }

  const segments = () =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('[aria-label="Основная валюта"] button')).map((b) => b.textContent?.trim());

  it('no answer yet: no footer, only hryvnia to pick', async () => {
    const { w } = await openToggle();
    expect(document.body.querySelector('[aria-label="Валюты: ₴"]')).not.toBeNull();
    expect(segments()).toEqual(['Гривна ₴']);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Все суммы на главном экране');
    expect(text).not.toContain('Курс');
    expect(text).not.toContain('Показывать также');
    w.unmount();
  });

  it('no rates: says hryvnia only for now', async () => {
    const { w } = await openToggle(null);
    expect(segments()).toEqual(['Гривна ₴']);
    expect(document.body.textContent).toContain('Курсы ещё не загружены: пока только гривна');
    w.unmount();
  });

  it('with rates: ₴ $ €; picking $ saves it, «also» lists hryvnia and euro, the footer names the rate', async () => {
    const { w, store } = await openToggle(RATES);
    expect(segments()).toEqual(['Гривна ₴', 'Доллары $', 'Евро €']);
    expect(document.body.textContent).toContain('Курс продажи Monobank, 05.10, 10:00');

    const dollars = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[aria-label="Основная валюта"] button'))[1]!;
    dollars.click();
    await flushPromises();
    expect(store.choice.main).toBe(840);
    expect(JSON.parse(localStorage.getItem('home.currencies') ?? '{}')).toEqual({ main: 840, also: NONE });
    expect(document.body.querySelector('[aria-label="Валюты: $"]')).not.toBeNull();

    const labels = Array.from(document.body.querySelectorAll('label:not(.v-switch)')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Гривна ₴', 'Евро €']);
    const boxes = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    boxes[1]!.click();
    await flushPromises();
    expect(store.choice.also.eur).toBe(true);
    expect(document.body.querySelector('[aria-label="Валюты: $ · €"]')).not.toBeNull();
    w.unmount();
  });

  it('a saved rate says so', async () => {
    const { w } = await openToggle({ ...RATES, saved: true });
    expect(document.body.textContent).toContain('Сохранённый курс от 05.10, 10:00: нет соединения');
    w.unmount();
  });
});
