import type { PeopleView } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useParticipantsRequest(): { fetchPeople: () => Promise<PeopleView> } {
  return { fetchPeople: () => balanceApi.listPeople() };
}
