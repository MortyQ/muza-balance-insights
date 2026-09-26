// Private helper for VInput (copied from muzakit uses @vueuse/core's useDebounceFn, not shipped here — see ui/README.md).
/** Wraps `fn` so a call is applied only after `ms` have passed without another call. `ms <= 0` calls immediately. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: A) => {
    if (ms <= 0) {
      fn(...args);
      return;
    }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}
