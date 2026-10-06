// @vitest-environment happy-dom
// The income screen (features/income-detail): its pure helpers, the link from the balances' month panel, the screen
// mounted. Fictional fixtures only. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { IncomeLineView, IncomeOverview, IncomeOverviewQuery, PeopleView } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { lineRows, listTotal, monthsView, noneText, peopleView, sendersView, sourcesView, summaryView, whenView } from '@/features/income-detail/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false };
const RATES = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });

const line = (o: Partial<IncomeLineView>): IncomeLineView => ({
  key: 'k', date: '2026-09-05', time: '10:00', weekday: 6, sender: 'Vigadana Osoba', comment: null, source: 'named_sender', participantId: 1,
  account: { kind: 'card', type: 'black', currency: 980, tag: null }, uah: 20_000, currency: 980, amount: 20_000, operation: null,
  hold: false, pending: false, ...o,
});

const LINES: IncomeLineView[] = [
  line({ key: 'a', date: '2026-09-25', time: '09:10', weekday: 5, sender: 'Vigadana Firma', source: 'other_bank', uah: 300_000, amount: 300_000, comment: 'Вигадана зарплата' }),
  line({ key: 'b', date: '2026-09-17', time: '20:05', weekday: 4, uah: 15_000, amount: 15_000, participantId: 2 }),
  line({ key: 'c', date: '2026-09-10', time: '13:45', weekday: 4, sender: 'Imaginary Client', source: 'transfer', uah: 40_000, amount: 1_000, currency: 840, operation: { currency: 978, amount: 890 } }),
  line({ key: 'd', date: '2026-09-02', time: '08:15', weekday: 3, sender: 'VIGADANA  osoba', uah: 5_000, amount: 5_000, pending: true, hold: true }),
];

const VIEW: IncomeOverview = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-05', coveredDays: 30, pendingHolds: 1 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  summary: { total: 360_000, lines: 4, prev: { total: 300_000, lines: 2 }, median: 27_500, perDay: 12_000, activeDays: 4, largest: 'a', spending: 270_000 },
  months: [
    ...Array.from({ length: 9 }, (_, i) => ({ month: `2025-${String(10 + i > 12 ? i - 2 : 10 + i).padStart(2, '0')}`, total: null })),
    { month: '2026-07', total: 280_000 },
    { month: '2026-08', total: 300_000 },
    { month: '2026-09', total: 360_000 },
  ],
  thisMonth: '2026-10',
  people: [{ participantId: 1, total: 345_000, lines: 3 }, { participantId: 2, total: 15_000, lines: 1 }],
  sources: [{ source: 'other_bank', total: 300_000, lines: 1 }, { source: 'transfer', total: 40_000, lines: 1 }, { source: 'named_sender', total: 20_000, lines: 2 }],
  senders: [{ name: 'Vigadana Firma', total: 300_000, lines: 1 }, { name: 'Imaginary Client', total: 40_000, lines: 1 }, { name: 'Vigadana Osoba', total: 20_000, lines: 2 }],
  lines: LINES,
  rates: RATES,
  leftOut: [],
};

const PEOPLE = [{ id: 1, name: 'Сергей', color: 'var(--series-blue)' }, { id: 2, name: 'Аня', color: 'var(--series-orange)' }];

describe('income screen helpers', () => {
  it('summary: the month\'s income, the change against last month, the figures, how much of it went', () => {
    const s = summaryView(VIEW, 'Вся семья', FMT);
    expect(s).toMatchObject({ name: 'Поступления', icon: 'lucide:wallet', color: 'var(--success)', subtitle: 'Сентябрь 2026 · Вся семья', amount: uah(360_000), note: '' });
    expect(s.chip).toMatchObject({ tone: 'up', arrow: 'up', text: 'на 20% больше, чем в августе' });
    expect(s.prev).toBe(`в августе было ${uah(300_000)}`);
    expect(s.stats.map((x) => [x.label, x.value, x.note])).toEqual([
      ['Поступлений', '4', 'в августе — 2'],
      ['Среднее поступление', uah(90_000), `медиана ${uah(27_500)}`],
      ['В день', uah(12_000), 'дней с поступлениями: 4 из 30'],
      ['Потрачено', uah(270_000), '75% поступлений'],
      ['Самое крупное', uah(300_000), 'Vigadana Firma, 25 сен в 09:10'],
    ]);
  });

  it('12 months: the picked finished month is strong; the running one is out of the average', () => {
    const m = monthsView(VIEW, FMT);
    expect(m.bars.slice(-3).map((b) => [b.height, b.strong])).toEqual([[77.8, false], [83.3, false], [100, true]]);
    expect(m.caption).toBe(`в среднем ${uah(313_333)} в месяц · Сентябрь: на ${uah(46_667)} больше среднего`);
  });

  it('who, where from, from whom, when', () => {
    expect(peopleView(VIEW, PEOPLE, FMT).map((p) => [p.name, p.width])).toEqual([['Сергей', 100], ['Аня', 4.3]]);
    expect(sourcesView(VIEW, FMT).map((s) => [s.label, s.width, s.caption])).toEqual([
      ['Из других банков', 100, '1 оп. · 83%'],
      ['Переводы', 13.3, '1 оп. · 11%'],
      ['От людей и клиентов', 6.7, '2 оп. · 6%'],
    ]);
    expect(sendersView(VIEW, 'vigadana osoba', FMT).map((s) => [s.key, s.pressed])).toEqual([
      ['vigadana firma', false], ['imaginary client', false], ['vigadana osoba', true],
    ]);
    const when = whenView(LINES, VIEW, '', FMT);
    expect(when.peak).toBe('Больше всего: пт · утро 6–12');
    expect(when.days.filter((d) => d.strong).map((d) => d.label)).toEqual(['2', '10', '17', '25']);
    expect(whenView(LINES.filter((l) => l.key === 'b' || l.key === 'd'), VIEW, 'Vigadana Osoba', FMT).title).toBe('Когда: Vigadana Osoba');
  });

  it('the list: a plus and green, marks, the original currency; a sender filter case-insensitively, a search, by amount', () => {
    const all = lineRows(LINES, { sender: null, query: '', sort: 'date' }, PEOPLE, FMT).rows;
    expect(all.map((r) => [r.key, r.amount, r.incoming, r.marks.map((m) => m.text)])).toEqual([
      ['a', `+${uah(300_000)}`, true, []],
      ['b', `+${uah(15_000)}`, true, []],
      ['c', `+${uah(40_000)}`, true, ['в валюте']],
      ['d', `+${uah(5_000)}`, true, ['в обработке']],
    ]);
    expect(all[0]).toMatchObject({ merchant: 'Vigadana Firma', comment: 'Вигадана зарплата', date: '25 сен', time: 'пт, 09:10', person: 'Сергей' });
    expect(all[2]).toMatchObject({ original: formatMoney(890, 978) });

    const osoba = lineRows(LINES, { sender: 'vigadana osoba', query: '', sort: 'amount' }, PEOPLE, FMT);
    expect(osoba.rows.map((r) => r.key)).toEqual(['b', 'd']);
    expect(listTotal(VIEW, osoba.shown, true, FMT)).toBe(uah(20_000));
    expect(listTotal(VIEW, LINES, false, FMT)).toBe(uah(360_000));
    expect(lineRows(LINES, { sender: null, query: 'зарплат', sort: 'date' }, PEOPLE, FMT).rows.map((r) => r.key)).toEqual(['a']);
  });

  it('a month without income says so', () => {
    expect(noneText({ ...VIEW, lines: [] })).toBe('В сентябре поступлений нет.');
    expect(noneText(VIEW)).toBe('');
  });
});

let current: IncomeOverview = VIEW;
const getIncomeOverview = vi.fn(async (_q: IncomeOverviewQuery) => current);
vi.mock('@/shared/api', () => ({ balanceApi: { getIncomeOverview: (...a: unknown[]) => getIncomeOverview(...(a as [IncomeOverviewQuery])) } }));

const PEOPLE_VIEW: PeopleView = {
  people: [
    { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
    { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
  ],
  secureStorage: true,
};

const blank = defineComponent(() => () => h('div'));
const testRouter = () =>
  createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: blank }, { path: '/income', name: 'income', component: blank }] });

describe('income screen mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getIncomeOverview.mockClear();
    current = VIEW;
    localStorage.clear();
  });

  async function mountScreen() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().view = PEOPLE_VIEW;
    const { useMonthStore } = await import('@/entities/period');
    useMonthStore().set('2026-09', null);
    const { IncomeDetailFeature } = await import('@/features/income-detail');
    const router = testRouter();
    await router.push('/');
    const w = mount(IncomeDetailFeature, { global: { plugins: [i18n, router] } });
    await flushPromises();
    return w;
  }

  it('asks for the month; shows every block; a sender filters the list and a chip clears it', async () => {
    const w = await mountScreen();
    expect(getIncomeOverview.mock.calls[0]?.[0]).toEqual({ month: '2026-09' });
    for (const s of ['Баланс', 'Поступления', 'Динамика за 12 месяцев', 'Откуда', 'От кого', 'Кто получал', 'Когда', 'Операции', 'Вигадана зарплата']) expect(w.text()).toContain(s);
    expect(w.findAll('[role="row"]')).toHaveLength(LINES.length + 1);

    const osoba = w.findAll('button[aria-pressed]').find((b) => b.text().includes('Vigadana Osoba'))!;
    await osoba.trigger('click');
    expect(w.text()).toContain('Когда: Vigadana Osoba');
    expect(w.findAll('[role="row"]')).toHaveLength(3);
    expect(w.text()).toContain(`Итого по списку: ${uah(20_000)}`);

    await w.find('button[aria-label^="Снять фильтр"]').trigger('click');
    expect(w.findAll('[role="row"]')).toHaveLength(LINES.length + 1);
  });

  it('the first load shows a skeleton; follows the global person filter; one person — no «Who received»', async () => {
    let answer!: (v: IncomeOverview) => void;
    getIncomeOverview.mockImplementationOnce(() => new Promise<IncomeOverview>((r) => (answer = r)));
    const w = await mountScreen();
    expect(w.find('[role="status"]').exists()).toBe(true);
    answer(VIEW);
    await flushPromises();
    expect(w.find('[role="status"]').exists()).toBe(false);
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().select(2);
    await flushPromises();
    expect(getIncomeOverview.mock.calls.at(-1)?.[0]).toEqual({ month: '2026-09', participantId: 2 });
    expect(w.text()).not.toContain('Кто получал');
  });

  it('the month panel\'s «Income» row opens the income screen; «Spent» stays a plain row', async () => {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { default: FlowBars } = await import('@/features/balances/components/FlowBars.vue');
    const router = testRouter();
    await router.push('/');
    const flow = { currency: 980, income: 360_000, spending: 270_000, color: 'var(--series-blue)' };
    const w = mount(FlowBars, { props: { flow, size: 'md', incomeTo: { name: 'income' } }, global: { plugins: [i18n, router] } });
    const links = w.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.attributes('href')).toBe('/income');
    expect(links[0]!.attributes('aria-label')).toContain('Открыть поступления');
    await links[0]!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('income');
    expect(mount(FlowBars, { props: { flow }, global: { plugins: [i18n, router] } }).findAll('a')).toHaveLength(0);
  });
});
