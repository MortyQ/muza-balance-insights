// Pure helpers of the category screen in main (src/main/category.ts). Fictional data only.
import { describe, expect, it } from 'vitest';
import { last12Months, lineStats, merchantKey, merchantText, monthsWindow } from '../src/main/category.ts';
import type { CategoryLineView } from '../src/shared/api.ts';

const line = (o: Partial<CategoryLineView>): CategoryLineView => ({
  key: 'k', date: '2026-03-02', time: '12:00', weekday: 1, merchant: 'Vigadane Taxi', comment: null, participantId: 1,
  account: { kind: 'card', type: 'black', currency: 980, tag: null }, uah: -1_000, currency: 980, amount: -1_000, operation: null,
  commission: false, hold: false, pending: false, refund: false, refunded: false, cashback: 0, ...o,
});

describe('merchantText', () => {
  it('cuts a card number to its last digits and hides jar titles', () => {
    expect(merchantText('  537541******1234 ', [])).toBe('•• 1234');
    expect(merchantText('Top-up «Imaginary Trip»', ['Imaginary Trip', ''])).toBe('Top-up «•••»');
    expect(merchantText('Vigadane Taxi', ['Imaginary Trip'])).toBe('Vigadane Taxi');
  });
  it('merchants match regardless of case and spaces', () => {
    expect(merchantKey(' VIGADANE   Taxi ')).toBe(merchantKey('vigadane taxi'));
  });
});

describe('lineStats', () => {
  it('a line without a rate counts nowhere; refunds lower net, not purchases; the largest spending line; cashback', () => {
    const s = lineStats(
      [
        line({ key: 'a', uah: -3_000, cashback: 30 }),
        line({ key: 'b', uah: 500, amount: 500, refund: true }),
        line({ key: 'c', uah: null, currency: 985, amount: -100 }),
        line({ key: 'd', uah: -1_000, date: '2026-03-31', weekday: 2, time: '23:30', merchant: 'Imaginary Metro', participantId: 2 }),
      ],
      [1, 2],
    );
    expect(s.merchants).toEqual([{ name: 'Vigadane Taxi', net: 2_500, purchases: 1 }, { name: 'Imaginary Metro', net: 1_000, purchases: 1 }]);
    expect(s.people).toEqual([{ participantId: 1, net: 2_500, purchases: 1 }, { participantId: 2, net: 1_000, purchases: 1 }]);
    expect(s).toMatchObject({ median: 2_000, activeDays: 2, largest: 'a', cashback: 30, cashbackLines: 1 });
  });
  it('no people asked → none; no spending → no median or largest', () => {
    expect(lineStats([], null)).toMatchObject({ people: [], median: null, largest: null, activeDays: 0 });
  });
});

describe('monthsWindow', () => {
  it('up to the current month while the picked one is among its last 12, else up to the picked one', () => {
    expect(monthsWindow('2026-10', '2026-10')).toEqual(last12Months('2026-10'));
    expect(monthsWindow('2025-11', '2026-10')).toEqual(last12Months('2026-10'));
    expect(monthsWindow('2025-10', '2026-10')).toEqual(last12Months('2025-10'));
  });
});

describe('last12Months', () => {
  it('the 12 months ending with the given one, across the year', () => {
    expect(last12Months('2026-03')).toEqual([
      '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
    ]);
  });
});
