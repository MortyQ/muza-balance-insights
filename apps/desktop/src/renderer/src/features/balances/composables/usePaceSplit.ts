import { ref } from 'vue';
import { PACE_SPLIT_KEY } from '../constants.ts';
import type { PaceSplit, UsePaceSplitReturn } from '../types.ts';

function read(): PaceSplit {
  try {
    return localStorage.getItem(PACE_SPLIT_KEY) === 'banks' ? 'banks' : 'together';
  } catch {
    return 'together';
  }
}

/** «Month pace»'s «Together / By banks» choice, remembered on this computer (apart from «Spending» and «Analytics»). */
export function usePaceSplit(): UsePaceSplitReturn {
  const split = ref<PaceSplit>(read());
  function setSplit(s: PaceSplit): void {
    split.value = s;
    try {
      localStorage.setItem(PACE_SPLIT_KEY, s);
    } catch {
      // Storage unavailable: the choice holds while the screen is open.
    }
  }
  return { split, setSplit };
}
