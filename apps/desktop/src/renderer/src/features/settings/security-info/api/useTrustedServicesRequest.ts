import type { TrustedServiceView } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useTrustedServicesRequest(): { list: () => Promise<TrustedServiceView[]> } {
  return { list: () => balanceApi.getTrustedServices() };
}
