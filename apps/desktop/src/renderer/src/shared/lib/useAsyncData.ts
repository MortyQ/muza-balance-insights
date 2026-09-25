import { ref, watch, type Ref, type WatchSource } from 'vue';

/**
 * Data from main that is reloaded when its inputs change. The last good value stays while a reload runs or after it
 * fails (the screen never reads a failure as «no data»).
 */
export type Loadable<T> =
  | { status: 'loading'; data: T | null }
  | { status: 'success'; data: T }
  | { status: 'error'; data: T | null };

export interface UseAsyncDataReturn<T> {
  state: Readonly<Ref<Loadable<T>>>;
  reload: () => Promise<void>;
}

/** Loads now and on every change of `sources`; an answer to an older request is dropped. */
export function useAsyncData<T>(load: () => Promise<T>, sources: ReadonlyArray<WatchSource>): UseAsyncDataReturn<T> {
  // `as`: ref() types its value as UnwrapRef<T>; T is plain data from main (no refs inside), so that is T itself.
  const state = ref({ status: 'loading', data: null }) as Ref<Loadable<T>>;
  let request = 0;

  async function reload(): Promise<void> {
    const id = ++request;
    state.value = { status: 'loading', data: state.value.data };
    try {
      const data = await load();
      if (id === request) state.value = { status: 'success', data };
    } catch {
      if (id === request) state.value = { status: 'error', data: state.value.data };
    }
  }

  watch([...sources], () => void reload(), { immediate: true });
  return { state, reload };
}
