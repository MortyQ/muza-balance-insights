import { balanceApi } from '@/shared/api';

/** main asks for confirmation in a system dialog first; deleted: false = the user said no. */
export function useDeleteDataRequest(): { deleteAllData: () => Promise<{ deleted: boolean }> } {
  return { deleteAllData: () => balanceApi.deleteAllData() };
}
