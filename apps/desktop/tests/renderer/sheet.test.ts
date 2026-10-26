// @vitest-environment happy-dom
// VSheet (shared/ui): a modal panel over the screen — title, content and footer; Esc closes it.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { VSheet } from '@/shared/ui';

describe('VSheet', () => {
  it('shows its title, content and footer while open; Esc closes it', async () => {
    const w = mount(VSheet, {
      props: { open: true, title: 'Вигаданий заголовок', description: 'Опис', 'onUpdate:open': (v: boolean) => w.setProps({ open: v }) },
      slots: { default: '<p data-test="body">Тіло</p>', footer: '<button data-test="act">Дія</button>' },
      attachTo: document.body,
    });
    await nextTick();
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Вигаданий заголовок');
    expect(dialog?.textContent).toContain('Опис');
    expect(dialog?.querySelector('[data-test="body"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-test="act"]')).not.toBeNull();
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    await nextTick();
    expect(w.props('open')).toBe(false);
    w.unmount();
  });

  it('renders nothing while closed', () => {
    const w = mount(VSheet, { props: { open: false, title: 'x' }, attachTo: document.body });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    w.unmount();
  });
});
