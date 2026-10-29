// @vitest-environment happy-dom
// VPopover (shared/ui): the trigger's name, its optional text and its optional `trigger` slot, hidden from screen readers.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { VPopover } from '@/shared/ui';

describe('VPopover', () => {
  it('icon and text only: no lead', () => {
    const w = mount(VPopover, { props: { icon: 'lucide:chevron-down', label: 'Currency: ₴', text: '₴' } });
    const trigger = w.get('button');
    expect(trigger.attributes('aria-label')).toBe('Currency: ₴');
    expect(trigger.text()).toBe('₴');
    expect(w.find('.v-popover__lead').exists()).toBe(false);
  });

  it('the trigger slot goes before the text, hidden from screen readers', () => {
    const w = mount(VPopover, {
      props: { icon: 'lucide:chevron-down', label: 'Banks: All banks', text: 'All banks' },
      slots: { trigger: () => h('i', { 'data-test': 'mark' }) },
    });
    const lead = w.get('.v-popover__lead');
    expect(lead.attributes('aria-hidden')).toBe('true');
    expect(lead.find('[data-test="mark"]').exists()).toBe(true);
    expect(w.get('button').element.firstElementChild).toBe(lead.element);
  });
});
