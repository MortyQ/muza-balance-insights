/** A call that runs at most once per `ms`; a call inside the pause is not lost, it runs once when the pause ends. */
export interface Throttled {
  call: () => void;
  cancel: () => void;
}

export function throttle(fn: () => void, ms: number): Throttled {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  function pause(): void {
    timer = setTimeout(() => {
      timer = null;
      if (!pending) return;
      pending = false;
      fn();
      pause();
    }, ms);
  }

  return {
    call() {
      if (timer !== null) {
        pending = true;
        return;
      }
      fn();
      pause();
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = false;
    },
  };
}
