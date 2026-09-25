import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ImportProgress } from '@contract/progress.ts';
import { RUNNING_PHASES } from '../constants.ts';

/** The last progress message from main. Fed by the one subscription in app/ (onProgress). */
export const useImportProgressStore = defineStore('import-progress', () => {
  const progress = ref<ImportProgress>({ phase: 'idle' });
  const running = computed(() => RUNNING_PHASES.includes(progress.value.phase));

  function set(p: ImportProgress): void {
    progress.value = p;
  }

  return { progress, running, set };
});
