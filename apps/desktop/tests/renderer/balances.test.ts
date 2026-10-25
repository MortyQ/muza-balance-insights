// @vitest-environment happy-dom
// Pure helpers of the balance block. balanceApi is never called here: the participant slice pulls it in, so it is stubbed.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { MonthOverview, PersonView, RatesView } from '@contract/api.ts';
import { AccountCard, SummaryCard, type AccountCardProps, type SummaryCardProps } from '@/entities/account';
import { moneyFormat } from '@/entities/currency-display';
import {
  accountsCount,
  balanceCaption,
  coverageNote,
  firstName,
  freeShare,
  flowWidths,
  fxNote,
  monthIn,
  monthName,
  netText,
  peopleCount,
  signedMoney,
  slideDelay,
  slidePosition,
  reservedLine,
  rowView,
  savedLine,
  slidesOf,
  spentShare,
} from '@/features/balances/utils.ts';
import MonthPanel from '@/features/balances/components/MonthPanel.vue';
import type { Slide } from '@/features/balances/types.ts';
import { formatAmount, formatMoney } from '@/shared/lib';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const RATES: RatesView = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 50 }], fetchedAt: 0, saved: false };
const NONE = { uah: false, usd: false, eur: false };
const UAH_FMT = moneyFormat(RATES, { main: 980, also: NONE });
const EUR_FMT = moneyFormat(RATES, { main: 978, also: NONE });

const summaryOf = (s: Slide | undefined): SummaryCardProps => {
  if (s?.kind !== 'summary') throw new Error('not a summary slide');
  return s.card;
};
const accountOf = (s: Slide | undefined): AccountCardProps => {
  if (s?.kind !== 'account') throw new Error('not an account slide');
  return s.card;
};

const card = (ownFunds: number, income: number, spending: number, missing = 0, accounts = 1) => ({ ownFunds, others: [], saved: null, missing, accounts, income, spending, fx: [] });

describe('balances utils', () => {
  it('slidePosition: a stack of at most 4 visible cards; the row lays every card out, the scroll moves it', () => {
    expect(slidePosition(0, false)).toEqual({ x: 0, y: 60, z: 20, opacity: 1 });
    expect(slidePosition(2, false)).toEqual({ x: 44, y: 28, z: 18, opacity: 1 });
    expect(slidePosition(3, false)).toEqual({ x: 66, y: 12, z: 17, opacity: 1 });
    expect(slidePosition(5, false)).toEqual({ x: 66, y: 12, z: 15, opacity: 0 });
    // Open, every card sits ROW_INSET below the row's top: room for a hovered card to rise without being clipped.
    expect(slidePosition(0, true)).toEqual({ x: 0, y: 8, z: 20, opacity: 1 });
    expect(slidePosition(3, true)).toEqual({ x: 1248, y: 8, z: 17, opacity: 1 });
  });

  it('slideDelay: staggered out of the stack, back from the far end, none while paging', () => {
    expect(slideDelay(0, 4, true, false)).toBe(0);
    expect(slideDelay(3, 4, true, false)).toBe(135);
    expect(slideDelay(0, 4, false, false)).toBe(80);
    expect(slideDelay(3, 4, false, false)).toBe(20);
    expect(slideDelay(3, 4, true, true)).toBe(0);
  });

  it('rowView: the cards wholly in view, the ends, everything fits (card 400, step 416)', () => {
    // 5 cards: a track of 2064 px; 832 px of row show two cards.
    expect(rowView(0, 832, 5)).toEqual({ first: 0, last: 1, atStart: true, atEnd: false, fits: false });
    expect(rowView(416, 832, 5)).toEqual({ first: 1, last: 2, atStart: false, atEnd: false, fits: false });
    expect(rowView(1232, 832, 5)).toEqual({ first: 3, last: 4, atStart: false, atEnd: true, fits: false });
    // Half a card scrolled: the half-hidden one is not in view.
    expect(rowView(208, 832, 5)).toMatchObject({ first: 1, last: 1, atStart: false });
    // A fractional scroll still counts as the start / the end.
    expect(rowView(0.6, 832, 5)).toMatchObject({ first: 0, atStart: true });
    expect(rowView(1231.5, 832, 5)).toMatchObject({ last: 4, atEnd: true });
    // Narrower than a card: the nearest one.
    expect(rowView(416, 300, 5)).toMatchObject({ first: 1, last: 1 });
    // Everything fits: both ends, no scrolling.
    expect(rowView(0, 1300, 3)).toEqual({ first: 0, last: 2, atStart: true, atEnd: true, fits: true });
    expect(rowView(0, 700, 1)).toMatchObject({ fits: true, first: 0, last: 0 });
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

  it('savedLine: into jars with a plus, out of jars with a minus, «≈» when a foreign jar was folded in; none without jars', () => {
    const flow = { currency: 980, income: 0, spending: 0, color: 'red' };
    expect(savedLine(flow)).toBeNull();
    expect(savedLine({ ...flow, saved: { amount: 3_000, approx: false } })).toEqual({ label: 'В банки', amount: `+${formatMoney(3_000, 980)}` });
    expect(savedLine({ ...flow, saved: { amount: -500, approx: true } })).toEqual({ label: 'Из банок', amount: `≈ −${formatMoney(500, 980)}` });
    expect(savedLine({ ...flow, saved: { amount: 0, approx: false } })).toEqual({ label: 'В банки', amount: formatMoney(0, 980) });
  });

  it('slidesOf: total cards carry saved in the shown currency; account cards and a total without jars none', () => {
    const v: MonthOverview = {
      month: '2026-03', reserved: null, balanceAt: 'now', coverage: { from: '2026-03-01', to: '2026-03-10' }, rates: RATES, accounts: [],
      total: { ...card(1_000_000, 0, 0), saved: { amount: 500_000, approx: true } },
      people: [{ participantId: 1, label: 'Вигадана', reserved: null, labelPending: false, color: 'blue', total: card(1_000_000, 0, 0) }],
    };
    const [family, person] = slidesOf(v, { people: [], selectedId: null, currentYear: 2026, fmt: EUR_FMT });
    expect(family?.flow.saved).toEqual({ amount: EUR_FMT.convert(500_000), approx: true });
    expect(person?.flow.saved).toBeUndefined();
  });

  it('slidesOf: reserves against today\'s total — the free amount big, the real balance and the reserve under it; other cards untouched', () => {
    const v: MonthOverview = {
      month: '2026-03', reserved: 400_000, balanceAt: 'now', coverage: { from: '2026-03-01', to: '2026-03-10' }, rates: RATES, accounts: [],
      total: card(1_000_000, 0, 0),
      people: [{ participantId: 1, label: 'Вигадана', reserved: null, labelPending: false, color: 'blue', total: card(1_000_000, 0, 0) }],
    };
    const [family, person] = slidesOf(v, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect(family?.card).toMatchObject({
      caption: balanceCaption('now', 2026, 'Свободно'),
      amount: formatMoney(600_000, 980, { minorUnits: true }),
      own: { amount: formatMoney(1_000_000, 980), negative: false },
      reserved: formatMoney(400_000, 980),
    });
    expect(family?.flow.reserved).toBe(400_000);
    // A person's card in the family view: only their own reserves; none — the real balance.
    expect(person?.card).toMatchObject({ caption: balanceCaption('now', 2026), amount: formatMoney(1_000_000, 980, { minorUnits: true }), own: null, reserved: null });
    expect(person?.flow.reserved).toBeUndefined();
    const own = slidesOf({ ...v, people: [{ ...v.people[0]!, reserved: 100_000 }] }, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT })[1];
    expect(own?.card).toMatchObject({ amount: formatMoney(900_000, 980, { minorUnits: true }), own: { amount: formatMoney(1_000_000, 980) }, reserved: formatMoney(100_000, 980) });

    // One person picked: their total takes the reserves, their accounts keep their own balances.
    const mine: MonthOverview = { ...v, people: [], accounts: [
      { id: 'a', name: { provider: 'monobank', kind: 'card', type: 'black', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: 1_000_000, income: 0, spending: 0 },
    ] };
    const [total, account] = slidesOf(mine, { people: [], selectedId: 1, currentYear: 2026, fmt: EUR_FMT });
    expect(total?.card.amount).toBe(formatMoney(EUR_FMT.convert(600_000), 978, { minorUnits: true }));
    expect(total?.flow.reserved).toBe(EUR_FMT.convert(400_000));
    expect(account?.card).toMatchObject({ amount: formatMoney(1_000_000, 980, { minorUnits: true }), actual: '' });

    expect(summaryOf(slidesOf({ ...v, reserved: null }, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT })[0])).toMatchObject({ own: null, reserved: null });
  });

  it('reservedLine and the month panel: a link to the planning screen; none without a reserve', async () => {
    const flow = { currency: 980, income: 0, spending: 0, color: 'red' };
    expect(reservedLine(flow)).toBeNull();
    expect(reservedLine({ ...flow, reserved: 400_000 })).toEqual({ label: 'В резерве', amount: formatMoney(400_000, 980, { minorUnits: true }) });

    const { i18n } = await import('@/shared/lib/i18n.ts');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { render: () => null } },
        { path: '/planning', name: 'planning', component: { render: () => null } },
        { path: '/income', name: 'income', component: { render: () => null } },
      ],
    });
    await router.push('/');
    const panel = (f: typeof flow & { reserved?: number }) =>
      mount(MonthPanel, { props: { title: 'Март', note: '', flow: f, legend: [], stubShown: false }, global: { plugins: [i18n, router] } });
    expect(panel(flow).find('a[href="/planning"]').exists()).toBe(false);
    const w = panel({ ...flow, reserved: 400_000 });
    const link = w.find('a[href="/planning"]');
    expect(link.text()).toContain('В резерве');
    await link.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('planning');
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

  it('slidesOf: a total with a converted currency is approximate and carries the rate line; account cards never are', () => {
    const usd = { currency: 840, income: 316_200, spending: 0, rate: 44.355 };
    const fam: MonthOverview = {
      month: '2026-09',
      reserved: null,
      balanceAt: 'now',
      coverage: { from: '2026-09-01', to: '2026-09-27' },
      total: { ...card(10_000, 14_025_451, 4_000), fx: [usd] },
      people: [{ participantId: 1, label: 'Сергей', reserved: null, labelPending: false, color: 'blue', total: { ...card(10_000, 14_025_451, 4_000), fx: [usd] } }],
      accounts: [],
      rates: RATES,
    };
    const s = slidesOf(fam, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect(s.map((x) => [x.flow.approxIncome, x.flow.approxSpending])).toEqual([
      [true, false],
      [true, false],
    ]);
    expect(summaryOf(s[0]).net?.amount.startsWith('+')).toBe(true);
    expect(s[0]?.flow.note).toBe('вкл. 3 162 $ по курсу 44,36');

    const unrated: MonthOverview = { ...fam, people: [], total: { ...card(10_000, 5_000, 4_000), fx: [{ ...usd, rate: null }] } };
    const u = slidesOf(unrated, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect([u[0]?.flow.approxIncome, u[0]?.flow.approxSpending]).toEqual([false, false]);
    const spent: MonthOverview = { ...unrated, total: { ...card(10_000, 5_000, 4_000), fx: [{ currency: 978, income: 0, spending: 100_900, rate: 52 }] } };
    const e = slidesOf(spent, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect([e[0]?.flow.approxIncome, e[0]?.flow.approxSpending]).toEqual([false, true]);
    // The month tile carries no «≈»: the month panel beside it says what was converted.
    expect(summaryOf(e[0]).net?.amount.startsWith('≈')).toBe(false);
    expect(summaryOf(u[0]).net).toEqual({ label: 'В сентябре', amount: '+10,00 ₴', value: 1_000 });
    expect(u[0]?.flow.note).toBe('без 3 162 $ — нет курса');

    const person: MonthOverview = {
      ...fam,
      people: [],
      accounts: [{ id: 'd', name: { provider: 'monobank', kind: 'card', type: 'fop', currency: 840, tag: null }, kind: 'card', currency: 840, creditLimit: 0, ownFunds: 0, income: 316_200, spending: 0 }],
    };
    const p = slidesOf(person, { people: [], selectedId: 1, currentYear: 2026, fmt: UAH_FMT });
    expect(p[0]?.flow.approxIncome).toBe(true);
    expect(p[1]?.flow.approxIncome).toBeFalsy();
    expect(p[1]?.flow.approxSpending).toBeFalsy();
    expect(p[1]?.flow.note).toBeUndefined();
    expect(accountOf(p[1]).netText.startsWith('≈')).toBe(false);
  });

  it('fxNote: the amount and the rate per currency, unrated left out, refunds without a minus', () => {
    const usd = { currency: 840, income: 316_200, spending: 0, rate: 44.355 };
    expect(fxNote([usd])).toBe('вкл. 3 162 $ по курсу 44,36');
    expect(fxNote([{ ...usd, rate: null }])).toBe('без 3 162 $ — нет курса');
    expect(fxNote([usd, { currency: 978, income: 0, spending: 100_900, rate: 52 }])).toBe(
      'вкл. 3 162 $ по курсу 44,36 · вкл. 1 009 € по курсу 52,00',
    );
    expect(fxNote([{ currency: 978, income: 0, spending: -2_500, rate: 50.5 }])).toBe('вкл. 25 € по курсу 50,50');
    expect(fxNote([{ currency: 978, income: 0, spending: 0, rate: 50 }])).toBe('');
    expect(fxNote([])).toBe('');
    // Rates are per whole unit: 28 kopecks per yen (no minor units) → 0,28 ₴.
    expect(fxNote([{ currency: 392, income: 10_000, spending: 0, rate: 28 }])).toBe('вкл. 10 000 JPY по курсу 0,28');
  });

  it('slidesOf: the family — head then people; a person — head then accounts, no data dimmed', () => {
    const people: PersonView[] = [
      { id: 1, label: 'Сергей', labelFromBank: true, labelPending: false, color: 'blue', connections: [] },
      { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
    ];
    const fam: MonthOverview = {
      month: '2026-09',
      reserved: null,
      balanceAt: 'now',
      coverage: { from: '2026-09-01', to: '2026-09-27' },
      total: card(10_000, 5_000, 4_000, 0, 14),
      people: [
        { participantId: 1, label: 'Сергей', reserved: null, labelPending: false, color: 'blue', total: card(6_000, 3_000, 2_000, 0, 11) },
        { participantId: 2, label: 'Аня', reserved: null, labelPending: false, color: 'orange', total: card(4_000, 2_000, 2_000, 0, 3) },
      ],
      accounts: [],
      rates: null,
    };
    const s = slidesOf(fam, { people, selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect(s.map((x) => x.card.title)).toEqual(['Вся семья', 'Сергей', 'Аня']);
    expect(s.every((x) => x.kind === 'summary')).toBe(true);
    expect(s[0]?.card.accents).toEqual(['var(--series-blue)', 'var(--series-orange)']);
    expect(s.map((x) => summaryOf(x).count)).toEqual(['2 человека · 14 счетов', '11 счетов', '3 счёта']);
    expect(summaryOf(s[0]).net).toEqual({ label: 'В сентябре', amount: '+10,00 ₴', value: 1_000 });
    expect(s[0]?.flow.segments).toEqual([
      { color: 'var(--series-blue)', income: 3_000, spending: 2_000 },
      { color: 'var(--series-orange)', income: 2_000, spending: 2_000 },
    ]);
    expect(s[1]?.flow).toEqual({ currency: 980, income: 3_000, spending: 2_000, color: 'var(--series-blue)', approxIncome: false, approxSpending: false, note: '' });

    const one: MonthOverview = {
      ...fam,
      balanceAt: '2026-09-30',
      people: [],
      total: card(6_000, 3_000, 2_000, 1, 4),
      accounts: [
        { id: 'a', name: { provider: 'monobank', kind: 'card', type: 'black', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: 6_000, income: 3_000, spending: 2_000 },
        { id: 'b', name: { provider: 'monobank', kind: 'jar', type: null, currency: 980, tag: 'b123' }, kind: 'jar', currency: 980, creditLimit: 0, ownFunds: null, income: 0, spending: 0 },
        { id: 'c', name: { provider: 'monobank', kind: 'card', type: 'iron', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 3_000_000, ownFunds: -678_000, income: 0, spending: 10_000 },
        { id: 'd', name: { provider: 'monobank', kind: 'card', type: 'black', currency: 840, tag: null }, kind: 'card', currency: 840, creditLimit: 0, ownFunds: 125_000, income: 0, spending: 0 },
      ],
    };
    const p = slidesOf(one, { people, selectedId: 1, currentYear: 2026, fmt: UAH_FMT });
    expect(p.map((x) => (x.kind === 'account' ? x.card.bank : x.kind))).toEqual(['summary', 'monobank', 'monobank', 'monobank', 'monobank']);
    expect(p.map((x) => [x.card.title, x.card.dim])).toEqual([
      ['Сергей', false],
      ['Чёрная карта · UAH', false],
      ['Банка · UAH #b123', true],
      ['Iron · UAH', false],
      ['Чёрная карта · USD', false],
    ]);
    expect(summaryOf(p[0]).count).toBe('4 счёта · без 1 счёта');
    expect(p[1]?.card.caption).toBe('Карта · на 30 сентября');
    expect(accountOf(p[1]).bottom).toBe('Monobank · Сергей');
    expect(p[2]?.card.amount).toBe('—');
    expect(p[2]?.card.caption).toBe('Нет данных на эту дату');
    expect(p[2]?.card.net).toBeNull();
    expect(p[3]?.card.caption).toBe('Кредитка · на 30 сентября');
    expect(accountOf(p[3]).bottom).toBe('лимит 30 000 ₴');
    expect(p[4]?.card.caption).toBe('Валютная карта · на 30 сентября');
    expect(p.every((x) => x.card.accents.length === 1 && x.card.accents[0] === 'var(--series-blue)')).toBe(true);

    // The bank's name and card come from the account's provider; a bank the registry does not know shows its id and
    // no other bank's card names.
    const unknown = slidesOf(
      {
        ...one,
        accounts: [{ id: 'x', name: { provider: 'privatbank', kind: 'card', type: 'black', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: 100, income: 0, spending: 0 }],
      },
      { people, selectedId: 1, currentYear: 2026, fmt: UAH_FMT },
    );
    expect(accountOf(unknown[1])).toMatchObject({ bank: 'privatbank', title: 'Карта · UAH', bottom: 'privatbank · Сергей' });
    expect(accountOf(p[1]).bank).toBe('monobank');
  });
  it('slidesOf: euro main — total cards converted, account cards keep their own currency', () => {
    const total = { ...card(1_000_000, 500_000, 200_000, 0, 2), others: [{ currency: 840, ownFunds: 10_000, rate: 40 }] };
    const person: MonthOverview = {
      month: '2026-09',
      reserved: null,
      balanceAt: 'now',
      coverage: { from: '2026-09-01', to: '2026-09-27' },
      total,
      people: [],
      accounts: [
        { id: 'a', name: { provider: 'monobank', kind: 'card', type: 'black', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: 600_000, income: 500_000, spending: 200_000 },
        { id: 'd', name: { provider: 'monobank', kind: 'card', type: 'black', currency: 840, tag: null }, kind: 'card', currency: 840, creditLimit: 0, ownFunds: 10_000, income: 0, spending: 0 },
      ],
      rates: RATES,
    };
    const p = slidesOf(person, { people: [], selectedId: 1, currentYear: 2026, fmt: EUR_FMT });
    expect(p[0]?.card.amount).toBe(formatMoney(20_000, 978, { minorUnits: true }));
    expect(summaryOf(p[0]).net?.amount).toBe(netText(6_000, 978));
    expect(p[0]?.flow).toMatchObject({ currency: 978, income: 10_000, spending: 4_000 });
    expect(p[1]?.card.amount).toBe(formatMoney(600_000, 980, { minorUnits: true }));
    expect(p[1]?.flow).toMatchObject({ currency: 980, income: 500_000, spending: 200_000 });
    expect(p[2]?.card.amount).toBe(formatMoney(10_000, 840, { minorUnits: true }));

    const fam: MonthOverview = {
      ...person,
      accounts: [],
      people: [
        { participantId: 1, label: 'Сергей', reserved: null, labelPending: false, color: 'blue', total: card(600_000, 300_000, 100_000) },
        { participantId: 2, label: 'Аня', reserved: null, labelPending: false, color: 'orange', total: card(400_000, 200_000, 100_000) },
      ],
    };
    const f = slidesOf(fam, { people: [], selectedId: null, currentYear: 2026, fmt: EUR_FMT });
    expect(f[0]?.flow.segments).toEqual([
      { color: 'var(--series-blue)', income: 6_000, spending: 2_000 },
      { color: 'var(--series-orange)', income: 4_000, spending: 2_000 },
    ]);
    expect(f[1]?.card.amount).toBe(formatMoney(12_000, 978, { minorUnits: true }));
  });

  it('slidesOf: a foreign part is counted in the total card\'s amount, with no rate line on the card', () => {
    const total = {
      ...card(1_000_000, 0, 0),
      others: [
        { currency: 840, ownFunds: 10_000, rate: 40 },
        { currency: 826, ownFunds: 10_000, rate: null },
      ],
    };
    const v: MonthOverview = { month: '2026-09', reserved: null, balanceAt: 'now', coverage: { from: '2026-09-01', to: '2026-09-27' }, total, people: [], accounts: [], rates: RATES };
    const s = slidesOf(v, { people: [], selectedId: 1, currentYear: 2026, fmt: UAH_FMT });
    expect(JSON.stringify(s[0]?.card)).not.toContain('по курсу');
    expect(s[0]?.card).not.toHaveProperty('others');
    expect(s[0]?.card.amount).toBe(formatMoney(1_000_000, 980, { minorUnits: true }));
  });

  it('slidesOf: total cards carry the other picked currencies as rows of the column; none picked — no column', () => {
    const fmt = moneyFormat(RATES, { main: 980, also: { uah: false, usd: true, eur: true } });
    const v: MonthOverview = {
      month: '2026-09',
      reserved: null,
      balanceAt: 'now',
      coverage: { from: '2026-09-01', to: '2026-09-27' },
      total: card(1_000_000, 0, 0),
      people: [],
      accounts: [{ id: 'a', name: { provider: 'monobank', kind: 'card', type: 'black', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: 1_000_000, income: 0, spending: 0 }],
      rates: RATES,
    };
    const s = slidesOf(v, { people: [], selectedId: 1, currentYear: 2026, fmt });
    expect(summaryOf(s[0]).fx).toEqual([
      { symbol: '$', code: 'USD', amount: formatAmount(250_00, 840) },
      { symbol: '€', code: 'EUR', amount: formatAmount(200_00, 978) },
    ]);
    expect(accountOf(s[1]).approx).toBe('');
    expect(summaryOf(slidesOf(v, { people: [], selectedId: 1, currentYear: 2026, fmt: UAH_FMT })[0]).fx).toEqual([]);
  });

  it('AccountCard: the bank\'s skin (Monobank: the «m» mark), the «≈» line under the amount, none when empty', () => {
    const props = { bank: 'monobank' as const, title: 'T', caption: 'C', amount: '100 ₴', actual: '', bottom: 'B', net: null, netText: '', accents: [], dim: false };
    const w = mount(AccountCard, { props: { ...props, approx: '≈ 2,50 $ · 2,00 €' } });
    expect(w.get('button').find('[aria-hidden="true"]').exists()).toBe(true);
    expect(w.text()).toContain('m');
    const spans = w.findAll('span').map((x) => x.text());
    expect(spans.indexOf('≈ 2,50 $ · 2,00 €')).toBe(spans.indexOf('100 ₴') + 1);
    expect(mount(AccountCard, { props: { ...props, approx: '' } }).text()).not.toContain('≈');
    // A bank without a skin of its own: the same card, no bank mark.
    const neutral = mount(AccountCard, { props: { ...props, bank: 'privatbank', approx: '' } });
    expect(neutral.get('button').find('[aria-hidden="true"]').exists()).toBe(false);
    expect(neutral.text()).toContain('100 ₴');
  });

  it('SummaryCard: the band in the people\'s colours, the figures, «Total», a dot per person, no bank mark; a click is the card\'s', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const props: SummaryCardProps = {
      title: 'Вся семья', caption: 'Свободно · сегодня', count: '2 человека', amount: '100 ₴', negative: false,
      fx: [{ symbol: '$', code: 'USD', amount: '2' }], people: null, freeShare: null,
      own: { amount: '140 ₴', negative: false }, reserved: '40 ₴', net: { label: 'В сентябре', amount: '−5 ₴', value: -5 },
      accents: ['var(--series-blue)', 'var(--series-orange)'], dim: false,
    };
    const w = mount(SummaryCard, { props, global: { plugins: [i18n] } });
    expect(w.text()).toContain('Итого');
    for (const t of ['Вся семья', 'Свободно · сегодня', '2 человека', '100 ₴', 'На самом деле', '140 ₴', 'В резерве', '40 ₴', 'В сентябре', '−5 ₴']) expect(w.text()).toContain(t);
    expect(w.findAll('[data-test="dot"]')).toHaveLength(2);
    expect(w.findAll('span').some((x) => x.text() === 'm')).toBe(false);
    const band = w.get('[data-test="band"]').attributes('style');
    expect(band).toContain('color-mix(in oklch, var(--series-blue) var(--card-band-tint), var(--surface))');
    expect(band).toContain('color-mix(in oklch, var(--series-orange) var(--card-band-tint), var(--surface))');
    // The month below zero: the soft red tile, not green; the amount itself is not negative here.
    expect(w.get('[data-test="tile-net"]').classes()).toContain('bg-negative-soft-bg');
    expect(w.get('[data-test="amount"]').classes()).not.toContain('text-negative-soft');
    await w.get('button').trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
  });

  it('SummaryCard: no reserve — the month tile alone; a minus in the soft red; one person\'s band fades out', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const props: SummaryCardProps = {
      title: 'Аня', caption: 'Свои деньги · сегодня', count: '2 счёта', amount: '−3 450 ₴', negative: true, fx: [], people: null, freeShare: null,
      own: null, reserved: null, net: { label: 'В сентябре', amount: '+5 ₴', value: 5 }, accents: ['var(--series-green)'], dim: false,
    };
    const w = mount(SummaryCard, { props, global: { plugins: [i18n] } });
    expect(w.findAll('[data-test^="tile-"]').map((x) => x.attributes('data-test'))).toEqual(['tile-net']);
    expect(w.get('[data-test="tile-net"]').classes()).toContain('bg-success-subtle');
    expect(w.get('[data-test="amount"]').classes()).toContain('text-negative-soft');
    expect(w.get('[data-test="band"]').attributes('style')).toContain('var(--series-green) var(--card-band-fade)');
    expect(w.text()).not.toContain('В резерве');
    const minus = mount(SummaryCard, { props: { ...props, own: { amount: '−1 ₴', negative: true }, reserved: '2 ₴' }, global: { plugins: [i18n] } });
    expect(minus.get('[data-test="tile-own"]').find('.text-negative-soft').exists()).toBe(true);
  });

  it('slidesOf: the family card\'s shares — first names, whole units, the three largest and «+N», the bar by size', () => {
    const person = (id: number, label: string, own: number, reserved: number | null = null, color: 'blue' | 'orange' | 'aqua' | 'yellow' = 'blue') =>
      ({ participantId: id, label, labelPending: false, color, reserved, total: card(own, 0, 0) });
    const v: MonthOverview = {
      month: '2026-09', reserved: null, balanceAt: 'now', coverage: { from: '2026-09-01', to: '2026-09-27' }, rates: RATES, accounts: [],
      total: card(0, 0, 0),
      people: [person(1, 'Вигадана Перша', 100_050, 50, 'blue'), person(2, 'Друга', 300_000, null, 'orange'), person(3, 'Третя', -50_000, null, 'aqua'), person(4, 'Четверта', 200_000, null, 'yellow')],
    };
    const s = slidesOf(v, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    const shares = summaryOf(s[0]).people;
    expect(shares?.items).toEqual([
      { name: 'Друга', color: 'var(--series-orange)', amount: formatMoney(300_000, 980), negative: false },
      { name: 'Четверта', color: 'var(--series-yellow)', amount: formatMoney(200_000, 980), negative: false },
      { name: 'Вигадана', color: 'var(--series-blue)', amount: formatMoney(100_000, 980), negative: false },
    ]);
    expect(shares?.more).toBe('+1');
    expect(shares?.all).toBe(`Друга ${formatMoney(300_000, 980)} · Четверта ${formatMoney(200_000, 980)} · Вигадана ${formatMoney(100_000, 980)} · Третя ${formatMoney(-50_000, 980)}`);
    // The bar keeps the family's order and everyone not at zero, a minus too.
    expect(shares?.parts).toEqual([
      { color: 'var(--series-blue)', value: 100_000 }, { color: 'var(--series-orange)', value: 300_000 },
      { color: 'var(--series-aqua)', value: -50_000 }, { color: 'var(--series-yellow)', value: 200_000 },
    ]);
    // Each person's own card in the row: no shares; the family card: no meter.
    expect(s.slice(1).map((x) => summaryOf(x).people)).toEqual([null, null, null, null]);
    expect(summaryOf(s[0]).freeShare).toBeNull();

    const three = slidesOf({ ...v, people: v.people.slice(0, 3) }, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect(summaryOf(three[0]).people?.more).toBe('');
    expect(summaryOf(three[0]).people?.items.at(-1)).toMatchObject({ name: 'Третя', negative: true });
    // Nobody above zero: no bar, the line only; one person: no shares at all.
    const minus = slidesOf({ ...v, people: [person(1, 'А', -1), person(2, 'Б', -2)] }, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect(summaryOf(minus[0]).people?.parts).toEqual([]);
    const zero = slidesOf({ ...v, people: [person(1, 'А', 0), person(2, 'Б', 0)] }, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT });
    expect(summaryOf(zero[0]).people).toMatchObject({ parts: [], items: [{ amount: formatMoney(0, 980) }, { amount: formatMoney(0, 980) }] });
    expect(summaryOf(slidesOf({ ...v, people: [v.people[0]!] }, { people: [], selectedId: null, currentYear: 2026, fmt: UAH_FMT })[0]).people).toBeNull();
  });

  it('freeShare, firstName and the month at zero', () => {
    expect(freeShare(1_000, 260)).toBe(74);
    expect(freeShare(1_000, null)).toBeNull();
    expect(freeShare(0, 10)).toBeNull();
    expect(freeShare(-5, 10)).toBeNull();
    expect(freeShare(1_000, 2_000)).toBe(0);
    expect(freeShare(1_000, -10)).toBe(100);
    expect(firstName('  Вигадана   Перша ')).toBe('Вигадана');
    const v: MonthOverview = {
      month: '2026-09', reserved: 260, balanceAt: 'now', coverage: { from: '2026-09-01', to: '2026-09-27' }, rates: RATES, accounts: [],
      total: card(1_000, 0, 0), people: [],
    };
    const p = summaryOf(slidesOf(v, { people: [], selectedId: 1, currentYear: 2026, fmt: UAH_FMT })[0]);
    expect(p.freeShare).toBe(74);
    expect(p.people).toBeNull();
    expect(p.net).toEqual({ label: 'В сентябре', amount: formatMoney(0, 980, { minorUnits: true }), value: 0 });
    expect(summaryOf(slidesOf({ ...v, reserved: null }, { people: [], selectedId: 1, currentYear: 2026, fmt: UAH_FMT })[0]).freeShare).toBeNull();
  });

  it('SummaryCard: the conversions column, the shares bar with a hatched minus, «+N», five dots at most', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const accents = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((c) => `var(--series-${c})`);
    const props: SummaryCardProps = {
      title: 'Семья', caption: 'Свободно · сегодня', count: '7 человек', amount: '100 ₴', negative: false,
      fx: [{ symbol: '$', code: 'USD', amount: '2' }, { symbol: '€', code: 'EUR', amount: '1' }],
      people: {
        items: [{ name: 'Аня', color: accents[0]!, amount: '90 ₴', negative: false }, { name: 'Ия', color: accents[1]!, amount: '−10 ₴', negative: true }],
        more: '+5', all: 'Аня 90 ₴ · Ия −10 ₴',
        parts: [{ color: accents[0]!, value: 90 }, { color: accents[1]!, value: -10 }],
      },
      freeShare: null, own: null, reserved: null, net: null, accents, dim: false,
    };
    const w = mount(SummaryCard, { props, global: { plugins: [i18n] } });
    expect(w.get('[data-test="fx"]').text()).toContain('≈ по курсу');
    expect(w.findAll('[data-test="fx-row"]').map((x) => x.text())).toEqual(['$2USD', '€1EUR']);
    const parts = w.findAll('[data-test="share-part"]').map((x) => x.attributes('style'));
    expect(parts[0]).toContain('flex-grow: 90');
    expect(parts[0]).toContain(`--part: ${accents[0]}`);
    expect(parts[1]).toContain('flex-grow: 10');
    expect(parts[1]).toContain('--part: repeating-linear-gradient(135deg, color-mix(in oklch, var(--series-b) 55%, var(--surface))');
    expect(w.findAll('[data-test="share"]').map((x) => x.text())).toEqual(['Аня90 ₴', 'Ия−10 ₴']);
    expect(w.findAll('[data-test="share"]')[1]?.find('.text-negative-soft').exists()).toBe(true);
    expect(w.get('[data-test="share-more"]').text()).toBe('+5');
    expect(w.findAll('[data-test="dot"]')).toHaveLength(5);
    expect(w.get('[data-test="more-dots"]').text()).toBe('+2');
    expect(w.find('[data-test="meter"]').exists()).toBe(false);

    // No other currency: no column; nobody above zero: the line without a bar; a minus turns the column soft red.
    const bare = mount(SummaryCard, { props: { ...props, fx: [], people: { ...props.people!, parts: [] }, accents: accents.slice(0, 2) }, global: { plugins: [i18n] } });
    expect(bare.find('[data-test="fx"]').exists()).toBe(false);
    expect(bare.findAll('[data-test="share-part"]')).toHaveLength(0);
    expect(bare.findAll('[data-test="share"]')).toHaveLength(2);
    expect(bare.find('[data-test="more-dots"]').exists()).toBe(false);
    const red = mount(SummaryCard, { props: { ...props, negative: true }, global: { plugins: [i18n] } });
    expect(red.get('[data-test="fx-row"]').find('.text-negative-soft').exists()).toBe(true);
  });

  it('SummaryCard: the reserve meter for one person; the month at zero is neutral, without an arrow', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const props: SummaryCardProps = {
      title: 'Аня', caption: 'Свободно · сегодня', count: '2 счёта', amount: '74 ₴', negative: false, fx: [], people: null, freeShare: 74,
      own: { amount: '100 ₴', negative: false }, reserved: '26 ₴', net: { label: 'В сентябре', amount: '0 ₴', value: 0 }, accents: ['var(--series-blue)'], dim: false,
    };
    const w = mount(SummaryCard, { props, global: { plugins: [i18n] } });
    expect(w.get('[data-test="meter-free"]').attributes('style')).toContain('width: 74%');
    expect(w.get('[data-test="meter"]').text()).toContain('74% свободно');
    expect(w.get('[data-test="meter"]').text()).toContain('26% в резерве');
    const net = w.get('[data-test="tile-net"]');
    expect(net.classes()).toContain('bg-surface-sunken');
    expect(net.find('svg').exists()).toBe(false);
    expect(net.text()).toContain('0 ₴');
    expect(mount(SummaryCard, { props: { ...props, freeShare: null }, global: { plugins: [i18n] } }).find('[data-test="meter"]').exists()).toBe(false);
  });
});
