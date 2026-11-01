// @vitest-environment happy-dom
// The carousel (shared/ui): a slot per slide, dots only with two or more, the slide in view as the model, slides out of
// view inert, arrows between the dots, back to the first when the slide in view goes away.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { VCarousel, type CarouselSlide } from '@/shared/ui';

const dotLabel = (n: number, total: number, label: string) => `${n}/${total} ${label}`;

function host(initial: CarouselSlide[]) {
  const slides = ref(initial);
  const current = ref('');
  const w = mount(
    defineComponent(() => () =>
      h(
        VCarousel,
        { slides: slides.value, dotLabel, modelValue: current.value, 'onUpdate:modelValue': (v: string) => (current.value = v) },
        { a: () => h('p', 'first'), b: () => h('p', 'second') },
      ),
    ),
    { attachTo: document.body },
  );
  return { w, slides, current };
}

describe('VCarousel', () => {
  it('two slides: both slots, a dot each named by place and label, the first current; a dot or an arrow moves', async () => {
    const { w, current } = host([{ id: 'a', label: 'Unusual' }, { id: 'b', label: 'Recent' }]);
    await w.vm.$nextTick();
    expect(w.findAll('.v-carousel__slide').map((s) => s.text())).toEqual(['first', 'second']);
    const dots = w.findAll('[data-test="carousel-dot"]');
    expect(dots.map((d) => d.attributes('aria-label'))).toEqual(['1/2 Unusual', '2/2 Recent']);
    expect(current.value).toBe('a');
    expect(dots[0]!.attributes('aria-current')).toBe('true');
    expect(w.find('[data-slide="b"]').attributes('inert')).toBeDefined();

    await dots[1]!.trigger('click');
    expect(current.value).toBe('b');
    expect(w.find('[data-slide="a"]').attributes('inert')).toBeDefined();
    expect(w.find('[data-slide="b"]').attributes('inert')).toBeUndefined();

    await w.findAll('[data-test="carousel-dot"]')[1]!.trigger('keydown', { key: 'ArrowLeft' });
    expect(current.value).toBe('a');
    expect(document.activeElement).toBe(w.findAll('[data-test="carousel-dot"]')[0]!.element);
    w.unmount();
  });

  it('one slide: no dots, nothing inert; the slide in view going away brings back the first', async () => {
    const { w, slides, current } = host([{ id: 'a', label: 'Unusual' }, { id: 'b', label: 'Recent' }]);
    await w.vm.$nextTick();
    await w.findAll('[data-test="carousel-dot"]')[1]!.trigger('click');
    expect(current.value).toBe('b');

    slides.value = [{ id: 'a', label: 'Unusual' }];
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect(current.value).toBe('a');
    expect(w.findAll('[data-test="carousel-dot"]')).toHaveLength(0);
    expect(w.find('[data-slide="a"]').attributes('inert')).toBeUndefined();
    w.unmount();
  });
});
