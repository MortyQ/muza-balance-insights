import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DbStateView } from '@contract/db-state.ts';
import { useDbStateRequest } from '../api/useDbStateRequest.ts';

/** The database view from main: pushed on every change (app/listeners.ts), fetched by the router guard at start. */
export const useDbStateStore = defineStore('db-state', () => {
  const { fetchView } = useDbStateRequest();
  const view = ref<DbStateView | null>(null);
  // Not known (main did not answer): no recovery screen — main's IPC gate still refuses data for a database that is not ready.
  const ready = computed(() => view.value === null || view.value.status === 'ready');

  function set(v: DbStateView): void {
    view.value = v;
  }

  async function refresh(): Promise<void> {
    view.value = await fetchView();
  }

  return { view, ready, set, refresh };
});
