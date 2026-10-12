// «Available per day» in main (allowance.ts): which income the money has to last until, which mandatory payments
// count, the sum per day. Fictional figures only.
import { describe, expect, it } from 'vitest';
import { allowance, daysBetween, nextMonthStart, type AllowanceSeries } from '../src/main/allowance.ts';

const s = (o: Partial<AllowanceSeries>): AllowanceSeries => ({ key: 'k', name: 'Client', participantId: 1, uah: 100_000, next: '2026-10-20', ...o });

describe('allowance', () => {
  it('helpers: whole days between two dates, the next month\'s first day', () => {
    expect(daysBetween('2026-10-07', '2026-10-20')).toBe(13);
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(5);
    expect(nextMonthStart('2026-12-15')).toBe('2027-01-01');
  });

  it('money − reserve − the mandatory payments due before the income, over the days until it', () => {
    const a = allowance({
      today: '2026-10-07',
      money: 2_000_000,
      reserve: 300_000,
      income: [s({ key: 'pay', next: '2026-10-17', uah: 8_000_000 })],
      mandatory: [
        s({ key: 'rent', name: 'Rent', uah: 1_000_000, next: '2026-10-10' }),
        s({ key: 'late', name: 'Power Co', uah: 50_000, next: '2026-10-05' }), // overdue: still to pay
        s({ key: 'later', name: 'Gym', uah: 70_000, next: '2026-10-25' }), // after the income: not now
        s({ key: 'norate', name: 'Codehub', uah: null, next: '2026-10-12' }),
      ],
    });
    expect(a.until).toBe('2026-10-17');
    expect(a.days).toBe(10);
    expect(a.income).toEqual({ key: 'pay', name: 'Client', uah: 8_000_000, date: '2026-10-17', overdue: false });
    expect(a.mandatory.map((p) => [p.key, p.due])).toEqual([['late', '2026-10-05'], ['rent', '2026-10-10'], ['norate', '2026-10-12']]);
    expect(a.free).toBe(2_000_000 - 300_000 - 1_050_000);
    expect(a.perDay).toBe(65_000);
  });

  it('each person\'s largest income; the earliest still to come of those; a smaller earlier one does not count', () => {
    const a = allowance({
      today: '2026-10-07',
      money: 100_000,
      reserve: 0,
      income: [
        s({ key: 'small', participantId: 1, uah: 40_000, next: '2026-10-09' }),
        s({ key: 'mine', participantId: 1, uah: 5_000_000, next: '2026-10-25' }),
        s({ key: 'hers', participantId: 2, uah: 3_000_000, next: '2026-10-15' }),
      ],
      mandatory: [],
    });
    expect(a.income?.key).toBe('hers');
    expect(a.days).toBe(8);
  });

  it('the income is late (due today or earlier): to the month\'s end, marked overdue', () => {
    const a = allowance({ today: '2026-10-07', money: 250_000, reserve: 0, income: [s({ next: '2026-10-07' })], mandatory: [] });
    expect(a).toMatchObject({ until: '2026-11-01', days: 25, perDay: 10_000, income: { date: '2026-10-07', overdue: true } });
  });

  it('no regular income: to the month\'s end; short of money: free < 0 and nothing per day', () => {
    const a = allowance({ today: '2026-10-31', money: 10_000, reserve: 20_000, income: [], mandatory: [] });
    expect(a).toMatchObject({ until: '2026-11-01', days: 1, income: null, free: -10_000, perDay: 0 });
  });
});
