import { computed, ref } from 'vue';
import { useAppLockStore } from '@/entities/app-lock';
import { HINT_KEY } from '../constants.ts';
import type { UseLockHintReturn } from '../types.ts';
import { shouldShowHint } from '../utils.ts';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

export function useLockHint(): UseLockHintReturn {
  const appLock = useAppLockStore();
  const dismissed = ref(readDismissed());
  const visible = computed(() => shouldShowHint(appLock.view, dismissed.value));

  function dismiss(): void {
    dismissed.value = true;
    try {
      localStorage.setItem(HINT_KEY, 'dismissed');
    } catch {
      // Storage unavailable: the hint comes back next launch, nothing else changes.
    }
  }

  return { visible, dismiss };
}
