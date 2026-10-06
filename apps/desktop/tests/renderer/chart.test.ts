// @vitest-environment happy-dom
// VChart (shared/ui): one ECharts chart; CSS colours resolved for the canvas, redrawn on a theme change, disposed on
// unmount. ECharts itself is the recorder of setup-charts.ts.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { resolveCssColors } from '@/shared/ui/components/charts/resolveCssColors.ts';
import { VChart } from '@/shared/ui';
import { chartCalls } from './setup-charts.ts';

describe('resolveCssColors', () => {
  it('replaces CSS variables and colour mixes anywhere in the option; keeps the rest and functions', () => {
    const fmt = () => 'x';
    const out = resolveCssColors(
      { color: 'var(--cat)', series: [{ data: [{ value: 1, itemStyle: { color: 'color-mix(in oklch, var(--cat) 45%, var(--surface))' } }], label: { formatter: fmt } }], name: 'var-less' },
      (css) => `resolved(${css.slice(0, 5)})`,
    );
    expect(out).toEqual({ color: 'resolved(var(-)', series: [{ data: [{ value: 1, itemStyle: { color: 'resolved(color)' } }], label: { formatter: fmt } }], name: 'var-less' });
  });
});

describe('VChart', () => {
  it('draws the option on mount and on change, again on a theme change; disposes on unmount', async () => {
    const before = chartCalls.length;
    const w = mount(VChart, { props: { option: { series: [{ type: 'bar', data: [1, 2] }] } } });
    const chart = chartCalls[before]!;
    expect(chart.el.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(chart.options).toHaveLength(1);
    expect(chart.options[0]).toMatchObject({ series: [{ type: 'bar', data: [1, 2] }] });

    await w.setProps({ option: { series: [{ type: 'bar', data: [3] }] } });
    expect(chart.options.at(-1)).toMatchObject({ series: [{ data: [3] }] });

    document.documentElement.setAttribute('data-theme', 'dark');
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    expect(chart.options).toHaveLength(3);

    w.unmount();
    expect(chart.disposed).toBe(true);
  });
});
