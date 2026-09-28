import { balanceApi } from '@/shared/api';

/** «Delete all data» — from settings and from the recovery screen. main asks in a system dialog first; deleted: false = the user said no. */
export function useDeleteAllDataRequest(): { deleteAllData: () => Promise<{ deleted: boolean }> } {
  return { deleteAllData: () => balanceApi.deleteAllData() };
}
