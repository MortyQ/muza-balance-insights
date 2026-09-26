// Pure helpers of the screen: money formatting and Kyiv months.
import { effectScope, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMoney, currencySymbol } from '../src/renderer/src/shared/lib/money.ts';
import { kyivToday, monthRange, monthTitle, shiftMonth, shortDate } from '../src/renderer/src/shared/lib/months.ts';
import { throttle } from '../src/renderer/src/shared/lib/throttle.ts';
import { useAsyncData } from '../src/renderer/src/shared/lib/useAsyncData.ts';

// Intl puts a no-break space between thousands; compare with plain spaces.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
  it.each([
    [1_234_000, 980, false, '12 340 ₴'],
    [1_234_056, 980, true, '12 340,56 ₴'],
    [-5, 980, true, '-0,05 ₴'],
    [0, 840, false, '0 $'],
    [123_456, 978, false, '1 235 €'], // rounded to whole units in summaries
    [1500, 392, true, '1 500 JPY'], // exponent 0
    [12_345, 414, true, '12,345 KWD'], // exponent 3
  ] as const)('%i of %i (minor units: %s) → %s', (minor, cur, minorUnits, out) => {
    expect(plain(formatMoney(minor, cur, { minorUnits }))).toBe(out);
  });

  it('symbols for common currencies, the ISO code otherwise', () => {
    expect([980, 840, 978, 826, 985, 8].map(currencySymbol)).toEqual(['₴', '$', '€', '£', 'zł', 'ALL']);
  });
});

describe('months (Kyiv)', () => {
  it('today is the Kyiv date, not UTC', () => {
    expect(kyivToday(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01'); // 01:30 in Kyiv
    expect(kyivToday(new Date('2026-09-30T20:00:00Z'))).toBe('2026-09-30');
  });

  it('shift across years, ranges with the right last day, titles', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-03', -26)).toBe('2024-01');
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthTitle('2026-09')).toBe('сентябрь 2026');
  });

  it('short dates', () => {
    expect(shortDate('2026-03-10')).toBe('10.03');
    expect(shortDate('2026-03-10 23:00')).toBe('10.03, 23:00');
  });
});

describe('throttle', () => {
  afterEach(() => vi.useRealTimers());

  it('runs at once, keeps one call made inside the pause for its end, never more often than `ms`', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 3000);
    t.call();
    expect(fn).toHaveBeenCalledTimes(1);
    t.call();
    t.call();
    vi.advanceTimersByTime(2999);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2); // the last call of the pause is not lost
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(2); // nothing pending: no extra run
    t.call();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('cancel drops the pending call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 3000);
    t.call();
    t.call();
    t.cancel();
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('useAsyncData', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  function setup(sources: 'loud' | 'none') {
    const loud = ref(0);
    const quietSrc = ref(0);
    let resolve: (v: number) => void = () => undefined;
    const load = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const scope = effectScope();
    const { state } = scope.run(() => useAsyncData(load, sources === 'loud' ? [loud] : [], { quiet: [quietSrc] }))!;
    return { loud, quietSrc, load, state, answer: (v: number) => resolve(v), stop: () => scope.stop() };
  }

  it('loads at once, even with no loud sources', async () => {
    const s = setup('none');
    expect(s.load).toHaveBeenCalledTimes(1);
    s.answer(1);
    await flush();
    expect(s.state.value).toEqual({ status: 'success', data: 1 });
    s.stop();
  });

  it('a quiet source reloads without «loading»: the old value stays as success until the new one comes', async () => {
    const s = setup('loud');
    s.answer(1);
    await flush();
    s.quietSrc.value++;
    await nextTick();
    expect(s.load).toHaveBeenCalledTimes(2);
    expect(s.state.value).toEqual({ status: 'success', data: 1 });
    s.answer(2);
    await flush();
    expect(s.state.value).toEqual({ status: 'success', data: 2 });
    s.stop();
  });

  it('a loud source shows «loading» with the old value', async () => {
    const s = setup('loud');
    s.answer(1);
    await flush();
    s.loud.value++;
    await nextTick();
    expect(s.state.value).toEqual({ status: 'loading', data: 1 });
    s.stop();
  });
});
