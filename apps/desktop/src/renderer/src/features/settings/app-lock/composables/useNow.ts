import { onMounted, onUnmounted, ref } from 'vue';
import type { UseNowReturn } from '../types.ts';

/** The clock for a countdown, ticking once a second while the component is mounted. */
export function useNow(): UseNowReturn {
  const now = ref(Date.now());
  let timer: number | undefined;
  onMounted(() => {
    timer = window.setInterval(() => (now.value = Date.now()), 1000);
  });
  onUnmounted(() => window.clearInterval(timer));
  return { now };
}
