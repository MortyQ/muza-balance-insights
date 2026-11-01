import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Scope } from '@contract/api.ts';

/** Home's «Personal / Business» choice: the spending block's switch, followed by the tiles that read the same lines. */
export const useScopeStore = defineStore('scope', () => {
  const scope = ref<Scope>('personal');
  return { scope };
});
