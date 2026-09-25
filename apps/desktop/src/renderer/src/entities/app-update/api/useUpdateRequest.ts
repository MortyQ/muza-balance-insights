import type { UpdateView } from '@contract/update.ts';
import { balanceApi } from '@/shared/api';

export function useUpdateRequest(): { fetchView: () => Promise<UpdateView> } {
  return { fetchView: () => balanceApi.getUpdate() };
}
