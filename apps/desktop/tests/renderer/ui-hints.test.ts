// @vitest-environment happy-dom
// Hints on figures and marks (spec desktop-ui-wording «Blocks say what they count», «Non-obvious figures explain
// themselves»): a pending mark, the count change and «Free» carry a hint that the keyboard
// reaches and a screen reader reads. Fictional data only; the texts read in Russian (setup-locale).
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { LineRowView } from '@/entities/operations';
import OperationList from '@/entities/operations/components/OperationList.vue';
import OperationRow from '@/entities/operations/components/OperationRow.vue';
import AnalyticsKpis from '@/features/analytics-overview/components/AnalyticsKpis.vue';
import FreeLine from '@/features/balances/components/FreeLine.vue';
import OpsDiff from '@/features/spending-summary/components/OpsDiff.vue';
import { i18n } from '@/shared/lib';

const PENDING = 'Банк ещё не провёл эту транзакцию; её сумма ещё может измениться.';
const row = (marks: LineRowView['marks']): LineRowView => ({
  key: 'l1', date: '12.09', time: '14:20', merchant: 'Fictional Cafe', comment: '', person: '', personColor: '', account: 'Black · UAH',
  marks, amount: '120 ₴', incoming: false, original: '',
});

describe('hints on marks and figures', () => {
  it('a pending mark: focusable, its meaning in the tooltip and for screen readers; a plain mark stays plain', () => {
    const w = mount(OperationRow, { props: { row: row([{ text: 'в обработке', tone: 'warning', hint: PENDING }, { text: 'кешбэк', tone: 'good' }]) }, global: { plugins: [i18n] } });
    const hinted = w.findAll('[data-test="mark-hint"]');
    expect(hinted).toHaveLength(1);
    expect(hinted[0]!.attributes('tabindex')).toBe('0');
    expect(hinted[0]!.text()).toBe(`в обработке: ${PENDING}`);
    expect(w.text()).toContain('кешбэк');
  });

  it('the count change says it in words', () => {
    const w = mount(OpsDiff, { props: { diff: { text: '−4 к авг', tone: 'down', sr: '', hint: 'На 4 транзакции меньше, чем в августе' } } });
    expect(w.attributes('tabindex')).toBe('0');
    expect(w.text()).toBe('−4 к авг: На 4 транзакции меньше, чем в августе');
  });

  it('«Free» explains itself', () => {
    const w = mount(FreeLine, { props: { line: { free: '1 000 ₴', negative: false, reserved: null, share: null, short: false } }, global: { plugins: [i18n] } });
    expect(w.get('[tabindex="0"]').text()).toBe('Свободно: Деньги на картах минус твои резервы.');
  });

  it('the analytics totals have one «?»', () => {
    const items = (['income', 'spending'] as const).map((key) => ({ key, label: key, value: '1 ₴', also: [], note: '', tone: 'neutral' as const }));
    const w = mount(AnalyticsKpis, { props: { items }, global: { plugins: [i18n] } });
    expect(w.findAll('button[aria-haspopup]').map((b) => b.attributes('aria-label'))).toEqual(['Как считается «Итоги»']);
  });

});

describe('the transactions table (spec desktop-ui-wording «No empty columns»)', () => {
  const list = (rows: LineRowView[], query = '') =>
    mount(OperationList, {
      props: { rows, total: '120 ₴', filterName: '', whereLabel: 'Где', searchLabel: 'Поиск', query, sort: 'date' },
      global: { plugins: [i18n] },
    });

  it('no row with a mark: no «Marks» header or cell, the grid without its column', () => {
    const w = list([row([]), { ...row([]), key: 'l2' }]);
    expect(w.find('[data-test="col-marks"]').exists()).toBe(false);
    const grids = w.findAll('[role="row"]').map((r) => r.classes().join(' '));
    expect(grids.every((g) => g.includes('grid-cols-[7.5rem_minmax(0,1fr)_10rem_8rem]'))).toBe(true);
    expect(w.findAll('[role="cell"]')).toHaveLength(2 * 4);
  });

  it('one row with a mark brings the column back for every row', () => {
    const w = list([row([]), { ...row([{ text: 'возврат', tone: 'good' }]), key: 'l2' }]);
    expect(w.get('[data-test="col-marks"]').text()).toBe('Отметки');
    expect(w.findAll('[role="cell"]')).toHaveLength(2 * 5);
  });

  it('an empty search says what was searched', () => {
    expect(list([], 'кофе').text()).toContain('Нет транзакций, подходящих под «кофе», за этот период.');
    expect(list([]).text()).toContain('Ничего не нашлось.');
  });
});
