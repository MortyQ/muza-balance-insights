import { ref } from 'vue';
import { useTokenStore } from '@/entities/token';
import { FAILED_TEXT } from '@/shared/lib';
import { useConnectRequest } from '../api/useConnectRequest.ts';
import type { UseDisconnectReturn } from '../types.ts';

/** Removes the token only: imported data stays. */
export function useDisconnect(): UseDisconnectReturn {
  const { clearToken } = useConnectRequest();
  const token = useTokenStore();
  const error = ref('');

  async function disconnect(): Promise<boolean> {
    error.value = '';
    try {
      await clearToken();
      await token.refresh();
      return true;
    } catch {
      error.value = FAILED_TEXT;
      return false;
    }
  }

  return { error, disconnect };
}
