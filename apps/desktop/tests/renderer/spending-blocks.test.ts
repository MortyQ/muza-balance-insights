// @vitest-environment happy-dom
// The spending block's display parts on their own: each shows only what it is given. Fictional values only.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CompareNote from '@/features/spending-summary/components/summary/CompareNote.vue';
import MemberCard from '@/features/spending-summary/components/summary/MemberCard.vue';
import SpendingStats from '@/features/spending-summary/components/summary/SpendingStats.vue';
import OpsDiff from '@/features/spending-summary/components/OpsDiff.vue';
import PrefSwitch from '@/features/spending-summary/components/PrefSwitch.vue';
import SpendingNotices from '@/features/spending-summary/components/SpendingNotices.vue';
import { OPS_TONE } from '@/features/spending-summary/constants.ts';
import { i18n } from '@/shared/lib/i18n.ts';

const global = { plugins: [i18n] };

describe('spending blocks', () => {
  it('OpsDiff: the tone class and the screen-reader direction', () => {
    const w = mount(OpsDiff, { props: { diff: { text: '+2', tone: 'up', sr: 'больше' } } });
    expect(w.classes()).toContain(OPS_TONE.up.split(' ')[0]);
    expect(w.text()).toMatch(/^\+2/);
    expect(w.find('.sr-only').text()).toBe('больше');
    expect(mount(OpsDiff, { props: { diff: { text: '', tone: 'neutral', sr: '' } } }).find('.sr-only').exists()).toBe(false);
  });

  it('SpendingStats: operations with the difference; last month only when there is one, its period as the title', () => {
    const stats = { ops: 12, opsVs: { text: '+4 к авг.', tone: 'up' as const, sr: '' }, prev: { label: 'В августе', title: '1–7 августа', amount: '100 ₴' } };
    const w = mount(SpendingStats, { props: { stats }, global });
    expect(w.text()).toContain('12');
    expect(w.text()).toContain('+4 к авг.');
    expect(w.find('[title="1–7 августа"]').text()).toContain('100 ₴');
    expect(mount(SpendingStats, { props: { stats: { ...stats, prev: null } }, global }).text()).not.toContain('В августе');
  });

  it('CompareNote: «no comparison» wins over the compared period; left-out lines below', () => {
    const w = mount(CompareNote, { props: { compare: { none: 'Нет данных', compared: 'С августом', leftOut: ['Без курса: 5 zł'] } } });
    expect(w.text()).toContain('Нет данных');
    expect(w.text()).not.toContain('С августом');
    expect(w.text()).toContain('Без курса: 5 zł');
    expect(mount(CompareNote, { props: { compare: { none: '', compared: 'С августом', leftOut: [] } } }).text()).toBe('С августом');
  });

  it('MemberCard: the avatar in the person\'s colour, the share and the family total', () => {
    const w = mount(MemberCard, { props: { card: { name: 'Аня', color: 'var(--series-orange)', share: '40%', family: 'семья — 100 ₴' } } });
    expect(w.find('.v-avatar').attributes('style')).toContain('--v-avatar-color: var(--series-orange)');
    expect(w.text()).toContain('40%');
    expect(w.text()).toContain('семья — 100 ₴');
  });

  it('PrefSwitch: the title labels the switch; a change goes out as the model', async () => {
    const w = mount(PrefSwitch, { props: { modelValue: true, title: 'Метка', hint: 'Прошлый месяц' } });
    const input = w.find('input');
    expect(w.find('label').attributes('for')).toBe(input.attributes('id'));
    await input.setValue(false);
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  it('SpendingNotices: an error hides the period note; pending holds; «no spending» with the left-out lines', () => {
    const base = { failed: false, note: 'Данные по 3 сент.', importing: false, pendingHolds: 0, empty: false, leftOut: ['Без курса'] };
    expect(mount(SpendingNotices, { props: base, global }).text()).toContain('Данные по 3 сент.');
    expect(mount(SpendingNotices, { props: { ...base, failed: true }, global }).text()).not.toContain('Данные по 3 сент.');
    const w = mount(SpendingNotices, { props: { ...base, note: null, pendingHolds: 2, empty: true }, global });
    expect(w.text()).toContain('2');
    expect(w.text()).toContain('Без курса');
    expect(mount(SpendingNotices, { props: { ...base, note: null }, global }).text()).toBe('');
  });
});
