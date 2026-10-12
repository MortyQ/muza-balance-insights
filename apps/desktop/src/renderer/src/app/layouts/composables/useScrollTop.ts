import { watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';

/**
 * Another screen of the layout starts at its top: the layout's own scroll area glides up when the route's path changes
 * (a category opened from the middle of home). Without motion when the system asks for less of it.
 */
export function useScrollTop(area: Readonly<Ref<HTMLElement | null>>): void {
  const route = useRoute();
  watch(
    () => route.path,
    () => {
      const el = area.value;
      if (!el || el.scrollTop === 0) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    },
  );
}
