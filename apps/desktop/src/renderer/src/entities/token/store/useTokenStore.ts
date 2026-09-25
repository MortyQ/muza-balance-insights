import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { TokenStatus } from '@contract/api.ts';
import { useTokenRequest } from '../api/useTokenRequest.ts';

/** Where the bank token is (never the token itself: it does not leave main). */
export const useTokenStore = defineStore('token', () => {
  const { fetchStatus } = useTokenRequest();
  const status = ref<TokenStatus | null>(null);
  const connected = computed(() => status.value?.present === true);

  async function refresh(): Promise<void> {
    status.value = await fetchStatus();
  }

  return { status, connected, refresh };
});
