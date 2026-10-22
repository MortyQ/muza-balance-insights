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

export interface UseAsyncDataOptions<T = unknown> {
  /**
   * Sources that reload in the background: the status stays as it is until the answer comes (no «loading» dimming),
   * e.g. the data version that grows with every imported window.
   */
  quiet?: ReadonlyArray<WatchSource>;
  /**
   * The kept answer for the current inputs (readCache), if any: a fresh one is shown without a request, a stale one is
   * shown at once and replaced by a quiet load. `reload()` always asks.
   */
  cached?: () => { data: T; fresh: boolean } | null;
}

/**
 * Loads now and on every change of `sources` (or `quiet`); an answer to an older request is dropped. With `cached`, a
 * kept answer is shown first (and a fresh one is not asked for again).
 */
export function useAsyncData<T>(
  load: () => Promise<T>,
  sources: ReadonlyArray<WatchSource>,
  { quiet = [], cached }: UseAsyncDataOptions<T> = {},
): UseAsyncDataReturn<T> {
  // `as`: ref() types its value as UnwrapRef<T>; T is plain data from main (no refs inside), so that is T itself.
  const state = ref({ status: 'loading', data: null }) as Ref<Loadable<T>>;
  let request = 0;

  async function run(background: boolean, ask = false): Promise<void> {
    const id = ++request;
    const kept = ask ? null : (cached?.() ?? null);
    if (kept) {
      state.value = { status: 'success', data: kept.data };
      if (kept.fresh) return;
      background = true;
    }
    if (!background) state.value = { status: 'loading', data: state.value.data };
    try {
      const data = await load();
      if (id === request) state.value = { status: 'success', data };
    } catch {
      if (id === request) state.value = { status: 'error', data: state.value.data };
    }
  }

  watch([...sources], () => void run(false), { immediate: true });
  if (quiet.length > 0) watch([...quiet], () => void run(true));
  return { state, reload: () => run(false, true) };
}
