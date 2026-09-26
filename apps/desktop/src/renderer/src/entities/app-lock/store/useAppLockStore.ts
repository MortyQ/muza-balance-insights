import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { LockView } from '@contract/lock.ts';
import { useLockStateRequest } from '../api/useLockStateRequest.ts';

/** The app-lock view from main: pushed on every change (app/listeners.ts), fetched by the router guard at start. */
export const useAppLockStore = defineStore('app-lock', () => {
  const { fetchView } = useLockStateRequest();
  const view = ref<LockView | null>(null);
  const locked = computed(() => view.value?.locked ?? false);

  function set(v: LockView): void {
    view.value = v;
  }

  async function refresh(): Promise<void> {
    view.value = await fetchView();
  }

  return { view, locked, set, refresh };
});
