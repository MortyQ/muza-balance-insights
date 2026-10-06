// @vitest-environment happy-dom
// VMonthRangePicker: a draft until «Show», one month or a range, quick picks. Texts in Russian (setup-locale).
import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { i18n } from '@/shared/lib';
import { VMonthRangePicker } from '@/shared/ui';

const PRESETS = {
  month: [{ id: 'last', label: 'Прошлый месяц', from: '2026-09', to: '2026-09' }],
  range: [{ id: '3', label: '3 месяца', from: '2026-07', to: '2026-09' }],
};
const props = (from: string, to: string) => ({ modelValue: { from, to }, min: '2023-10', max: '2026-10', presets: PRESETS });

const global = { plugins: [i18n] };
let w: VueWrapper | null = null;
afterEach(() => {
  w?.unmount();
  w = null;
  document.body.innerHTML = '';
});

const panel = () => document.body.querySelector('.v-month-range-picker__content')!;
const button = (text: string) => Array.from(panel().querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

async function open(from = '2025-10', to = '2026-09') {
  w = mount(VMonthRangePicker, { props: props(from, to), global, attachTo: document.body });
  await w.get('.v-month-range-picker__trigger').trigger('click');
  await flushPromises();
  return w;
}

describe('VMonthRangePicker', () => {
  it('the trigger names the range with its length, or the month', () => {
    w = mount(VMonthRangePicker, { props: props('2025-10', '2026-09'), global });
    expect(w.text()).toContain('окт 2025 – сен 2026 · 12 месяцев');
    w.unmount();
    w = mount(VMonthRangePicker, { props: props('2026-09', '2026-09'), global });
    expect(w.text()).toContain('Сентябрь 2026');
  });

  it('opens in the mode of the value; a quick pick changes only the draft; «Show» emits it', async () => {
    const v = await open();
    expect(panel().querySelector('.v-sc__item[aria-pressed="true"]')!.textContent).toContain('Период');
    button('3 месяца').click();
    await flushPromises();
    expect(v.emitted('update:modelValue')).toBeUndefined();
    expect(panel().querySelector('.v-month-range-picker__picked')!.textContent).toContain('июл 2026 – сен 2026');
    button('Показать').click();
    await flushPromises();
    expect(v.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-07', to: '2026-09' }]);
  });

  it('«One month» has its own quick picks and emits from === to', async () => {
    const v = await open();
    (Array.from(panel().querySelectorAll('.v-sc__item')).find((b) => b.textContent?.includes('Один месяц')) as HTMLButtonElement).click();
    await flushPromises();
    expect(button('3 месяца')).toBeUndefined();
    button('Прошлый месяц').click();
    button('Показать').click();
    await flushPromises();
    expect(v.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-09', to: '2026-09' }]);
  });

  it('a value of one month opens in «One month»; the note slot gets the draft', async () => {
    w = mount(VMonthRangePicker, {
      props: props('2026-09', '2026-09'),
      slots: { note: `<template #note="{ from, to }"><span class="note">{{ from }}…{{ to }}</span></template>` },
      global,
      attachTo: document.body,
    });
    await w.get('.v-month-range-picker__trigger').trigger('click');
    await flushPromises();
    expect(panel().querySelector('.v-sc__item[aria-pressed="true"]')!.textContent).toContain('Один месяц');
    expect(panel().querySelector('.note')!.textContent).toBe('2026-09…2026-09');
  });

  it('the grid: the first click is already one month, the second makes the range', async () => {
    const v = await open();
    const cell = (text: string) => Array.from(panel().querySelectorAll('.v-month-range-picker__cell')).find((c) => c.textContent?.trim() === text) as HTMLElement;
    cell('мар').click();
    await flushPromises();
    expect(panel().querySelector('.v-month-range-picker__picked')!.textContent).toBe('Март 2025');
    // reka ends a range on a click after the pointer came over the cell (its hover preview), as a person does.
    cell('май').dispatchEvent(new MouseEvent('mouseenter'));
    await flushPromises();
    cell('май').click();
    await flushPromises();
    expect(panel().querySelector('.v-month-range-picker__picked')!.textContent).toContain('мар 2025 – май 2025 · 3 месяца');
    button('Показать').click();
    await flushPromises();
    expect(v.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2025-03', to: '2025-05' }]);
  });

  it('«Cancel» emits nothing', async () => {
    const v = await open();
    button('3 месяца').click();
    button('Отмена').click();
    await flushPromises();
    expect(v.emitted('update:modelValue')).toBeUndefined();
  });
});
