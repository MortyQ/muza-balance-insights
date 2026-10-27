// @vitest-environment happy-dom
// The spending ring (spec desktop-spending-ring): the centre shows the total, or the category under the pointer.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import CategoryRing from '@/features/spending-summary/components/summary/CategoryRing.vue';
import { CANVAS_MARGIN, HOVER_GROW } from '@/features/spending-summary/utils/ring.ts';
import { chartCalls } from './setup-charts.ts';

const part = (name: string, value: number, share: string) => ({ key: name, name, value, color: 'var(--category-1)', amount: `${value} ₴`, share });

describe('CategoryRing', () => {
  it('pointing at a segment puts its name, amount and share in the centre; leaving brings the total back', async () => {
    const before = chartCalls.length;
    const w = mount(CategoryRing, {
      props: { parts: [part('Продукты', 300, '60%'), part('Кафе', 200, '40%')], label: 'Вся семья', amount: '500 ₴', perDay: '20 ₴ в день', chip: null, conv: [] },
    });
    const chart = chartCalls[before]!;
    expect(w.text()).toContain('500 ₴');

    chart.fire('mouseover', { seriesIndex: 1, dataIndex: 1 });
    await nextTick();
    const centre = w.get('[data-test="ring-hovered"]');
    expect(centre.text()).toContain('Кафе');
    expect(centre.text()).toContain('200 ₴');
    expect(centre.text()).toContain('40%');
    expect(w.text()).not.toContain('Вся семья');

    chart.fire('mouseout');
    await nextTick();
    expect(w.find('[data-test="ring-hovered"]').exists()).toBe(false);
    expect(w.text()).toContain('Вся семья');
    w.unmount();
  });

  it('the track sends nothing that changes the centre', async () => {
    const before = chartCalls.length;
    const w = mount(CategoryRing, { props: { parts: [part('Продукты', 300, '100%')], label: 'Вся семья', amount: '300 ₴', perDay: null, chip: null, conv: [] } });
    chartCalls[before]!.fire('mouseover', { seriesIndex: 0, dataIndex: 0 });
    await nextTick();
    expect(w.find('[data-test="ring-hovered"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('CategoryRing canvas', () => {
  it('the chart sits in a box larger than the ring, with room for the widened segment', () => {
    const before = chartCalls.length;
    const w = mount(CategoryRing, { props: { parts: [part('Продукты', 300, '100%')], label: 'Вся семья', amount: '300 ₴', perDay: null, chip: null, conv: [] } });
    const box = chartCalls[before]!.el.closest('.v-chart')!.parentElement!;
    // VChart's own styles fill its parent: the margin must be on the parent, never on VChart itself.
    expect(box.className).toContain('-inset-2');
    expect(CANVAS_MARGIN).toBeGreaterThanOrEqual(2 * HOVER_GROW);
    w.unmount();
  });
});
