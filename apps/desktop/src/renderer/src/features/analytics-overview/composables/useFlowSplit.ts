import { ref, type Ref } from 'vue';
import { FLOW_SPLIT_KEY } from '../constants.ts';
import type { FlowSplit } from '../types.ts';

function read(): FlowSplit {
  try {
    return localStorage.getItem(FLOW_SPLIT_KEY) === 'banks' ? 'banks' : 'together';
  } catch {
    return 'together';
  }
}

/** The chart's «Together / By banks» choice, remembered on this computer. */
export function useFlowSplit(): { split: Readonly<Ref<FlowSplit>>; setSplit: (s: FlowSplit) => void } {
  const split = ref<FlowSplit>(read());
  function setSplit(s: FlowSplit): void {
    split.value = s;
    try {
      localStorage.setItem(FLOW_SPLIT_KEY, s);
    } catch {
      // Storage unavailable: the choice holds while the screen is open.
    }
  }
  return { split, setSplit };
}
