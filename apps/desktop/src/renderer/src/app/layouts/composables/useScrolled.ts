import { onScopeDispose, ref, watch, type Ref } from 'vue';

/** Whether the layout's scroll area is scrolled away from its top: the pinned header shows its hairline then. */
export function useScrolled(area: Readonly<Ref<HTMLElement | null>>): Readonly<Ref<boolean>> {
  const scrolled = ref(false);
  const update = () => {
    scrolled.value = (area.value?.scrollTop ?? 0) > 0;
  };
  watch(
    area,
    (el, old) => {
      old?.removeEventListener('scroll', update);
      el?.addEventListener('scroll', update, { passive: true });
      update();
    },
    { immediate: true },
  );
  onScopeDispose(() => area.value?.removeEventListener('scroll', update));
  return scrolled;
}
