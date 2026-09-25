import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { UpdateView } from '@contract/update.ts';
import { useUpdateRequest } from '../api/useUpdateRequest.ts';

/** The app-update view from main: pushed on every change (app/listeners.ts), fetched once at start. */
export const useAppUpdateStore = defineStore('app-update', () => {
  const { fetchView } = useUpdateRequest();
  const view = ref<UpdateView | null>(null);
  const phase = computed(() => view.value?.state.phase ?? 'idle');

  function set(v: UpdateView): void {
    view.value = v;
  }

  async function refresh(): Promise<void> {
    view.value = await fetchView();
  }

  return { view, phase, set, refresh };
});
