// Pure helpers of the balance block. balanceApi is never called here: the participant slice pulls it in, so it is stubbed.
import { describe, expect, it, vi } from 'vitest';
import type { MonthOverview, PersonView } from '@contract/api.ts';
import {
  accountsCount,
  balanceCaption,
  coverageNote,
  flowWidths,
  maxOffset,
  monthIn,
  monthName,
  netText,
  peopleCount,
  signedMoney,
  slideDelay,
  slidePosition,
  slidesOf,
  spentShare,
} from '@/features/balances/utils.ts';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const card = (ownFunds: number, income: number, spending: number, missing = 0, accounts = 1) => ({ ownFunds, others: [], missing, accounts, income, spending });

describe('balances utils', () => {
  it('slidePosition: a stack of at most 4 visible cards; a row with the offset applied', () => {
    expect(slidePosition(0, false, 0)).toEqual({ x: 0, y: 52, z: 20, opacity: 1 });
    expect(slidePosition(2, false, 0)).toEqual({ x: 44, y: 20, z: 18, opacity: 1 });
    expect(slidePosition(3, false, 0)).toEqual({ x: 66, y: 4, z: 17, opacity: 1 });
    expect(slidePosition(5, false, 0)).toEqual({ x: 66, y: 4, z: 15, opacity: 0 });
    expect(slidePosition(3, true, 1)).toEqual({ x: 712, y: 0, z: 17, opacity: 1 });
    expect(slidePosition(0, true, 2)).toEqual({ x: -712, y: 0, z: 20, opacity: 1 });
  });

  it('slideDelay: staggered out of the stack, back from the far end, none while paging', () => {
    expect(slideDelay(0, 4, true, false)).toBe(0);
    expect(slideDelay(3, 4, true, false)).toBe(135);
    expect(slideDelay(0, 4, false, false)).toBe(80);
    expect(slideDelay(3, 4, false, false)).toBe(20);
    expect(slideDelay(3, 4, true, true)).toBe(0);
  });

  it('maxOffset: two cards fit', () => {
    expect(maxOffset(1)).toBe(0);
    expect(maxOffset(2)).toBe(0);
    expect(maxOffset(9)).toBe(7);
  });

  it('captions: today, the month end, another year', () => {
    expect(balanceCaption('now', 2026)).toBe('Свои деньги · на сегодня');
    expect(balanceCaption('2026-07-31', 2026)).toBe('Свои деньги · на 31 июля');
    expect(balanceCaption('2025-12-31', 2026)).toBe('Свои деньги · на 31 декабря 2025');
    expect(monthIn('2026-09', 2026)).toBe('в сентябре');
    expect(monthIn('2025-12', 2026)).toBe('в декабре 2025');
  });

  it('monthName: the year only when it is not the current one', () => {
    expect(monthName('2026-09', 2026)).toBe('Сентябрь');
    expect(monthName('2025-12', 2026)).toBe('Декабрь 2025');
  });

  it('counts: people and accounts, with the Russian plural forms', () => {
    expect(peopleCount(1)).toBe('1 человек');
    expect(peopleCount(3)).toBe('3 человека');
    expect(peopleCount(5)).toBe('5 человек');
    expect(accountsCount(1)).toBe('1 счёт');
    expect(accountsCount(3)).toBe('3 счёта');
    expect(accountsCount(8)).toBe('8 счетов');
    expect(accountsCount(11)).toBe('11 счетов');
    expect(accountsCount(21)).toBe('21 счёт');
  });

  it('netText: plus for a positive month, the minus sign for a negative one', () => {
    expect(netText(34_000, 980)).toBe('+340,00 ₴');
    expect(netText(0, 980)).toBe('+0,00 ₴');
    expect(netText(-678_000, 980)).toBe('−6 780,00 ₴');
  });

  it('signedMoney: whole units with the sign, no sign on zero', () => {
    expect(signedMoney(5_240_000, 980, '+')).toBe('+52 400 ₴');
    expect(signedMoney(4_860_000, 980, '−')).toBe('−48 600 ₴');
    expect(signedMoney(0, 980, '−')).toBe('0 ₴');
  });

  it('spentShare: spending as a share of income; none without income', () => {
    expect(spentShare(100_000, 93_000)).toBe(93);
    expect(spentShare(100_000, 120_400)).toBe(120);
    expect(spentShare(0, 5_000)).toBeNull();
  });

  it('coverageNote: whole month, from, until', () => {
    expect(coverageNote('2026-07', { from: '2026-07-01', to: '2026-07-31' })).toBe('весь месяц');
    expect(coverageNote('2025-06', { from: '2025-06-14', to: '2025-06-30' })).toBe('с 14 июня');
    expect(coverageNote('2026-09', { from: '2026-09-01', to: '2026-09-27' })).toBe('по 27 сен');
    expect(coverageNote('2024-02', { from: '2024-02-01', to: '2024-02-29' })).toBe('весь месяц');
  });

  it('flowWidths: people shares scaled to the larger of income and spending', () => {
    expect(flowWidths([60, 40], 100, 50)).toEqual([60, 40]);
    expect(flowWidths([30, 10], 50, 100)).toEqual([37.5, 12.5]);
    expect(flowWidths([0, 0], 0, 0)).toEqual([0, 0]);
    expect(flowWidths([50, -10], 40, 40)).toEqual([100, 0]);
  });

  it('slidesOf: the family — head then people; a person — head then accounts, no data dimmed', () => {
    const people: PersonView[] = [
      { id: 1, label: 'Сергей', labelFromBank: true, color: 'blue', connections: [] },
      { id: 2, label: 'Аня', labelFromBank: false, color: 'orange', connections: [] },
    ];
    const fam: MonthOverview = {
      month: '2026-09',
      balanceAt: 'now',
      coverage: { from: '2026-09-01', to: '2026-09-27' },
      total: card(10_000, 5_000, 4_000, 0, 14),
      people: [
        { participantId: 1, label: 'Сергей', color: 'blue', total: card(6_000, 3_000, 2_000, 0, 11) },
        { participantId: 2, label: 'Аня', color: 'orange', total: card(4_000, 2_000, 2_000, 0, 3) },
      ],
      accounts: [],
    };
    const s = slidesOf(fam, { people, selectedId: null, currentYear: 2026 });
    expect(s.map((x) => x.title)).toEqual(['Вся семья', 'Сергей', 'Аня']);
    expect(s[0]?.accents).toEqual(['var(--series-blue)', 'var(--series-orange)']);
    expect(s.map((x) => x.bottom)).toEqual(['2 человека · 14 счетов', '11 счетов', '3 счёта']);
    expect(s[0]?.netText).toBe('+10,00 ₴ в сентябре');
    expect(s[0]?.flow.segments).toEqual([
      { color: 'var(--series-blue)', income: 3_000, spending: 2_000 },
      { color: 'var(--series-orange)', income: 2_000, spending: 2_000 },
    ]);
    expect(s[1]?.flow).toEqual({ currency: 980, income: 3_000, spending: 2_000, color: 'var(--series-blue)' });

    const one: MonthOverview = {
      ...fam,
      balanceAt: '2026-09-30',
      people: [],
      total: card(6_000, 3_000, 2_000, 1, 4),
      accounts: [
        { id: 'a', label: 'black/UAH', kind: 'card', currency: 980, creditLimit: 0, ownFunds: 6_000, income: 3_000, spending: 2_000 },
        { id: 'b', label: 'jar/UAH', kind: 'jar', currency: 980, creditLimit: 0, ownFunds: null, income: 0, spending: 0 },
        { id: 'c', label: 'iron/UAH', kind: 'card', currency: 980, creditLimit: 3_000_000, ownFunds: -678_000, income: 0, spending: 10_000 },
        { id: 'd', label: 'black/USD', kind: 'card', currency: 840, creditLimit: 0, ownFunds: 125_000, income: 0, spending: 0 },
      ],
    };
    const p = slidesOf(one, { people, selectedId: 1, currentYear: 2026 });
    expect(p.map((x) => [x.title, x.dim])).toEqual([
      ['Сергей', false],
      ['black/UAH', false],
      ['jar/UAH', true],
      ['iron/UAH', false],
      ['black/USD', false],
    ]);
    expect(p[0]?.bottom).toBe('4 счёта · без 1 счёта');
    expect(p[1]?.caption).toBe('Карта · на 30 сентября');
    expect(p[1]?.bottom).toBe('Monobank · Сергей');
    expect(p[2]?.amount).toBe('—');
    expect(p[2]?.caption).toBe('Нет данных на эту дату');
    expect(p[2]?.net).toBeNull();
    expect(p[3]?.caption).toBe('Кредитка · на 30 сентября');
    expect(p[3]?.bottom).toBe('лимит 30 000 ₴');
    expect(p[4]?.caption).toBe('Валютная карта · на 30 сентября');
    expect(p.every((x) => x.accents.length === 1 && x.accents[0] === 'var(--series-blue)')).toBe(true);
  });
});
