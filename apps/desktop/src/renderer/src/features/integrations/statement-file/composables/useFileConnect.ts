import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import type { ParticipantChoice, ProviderKey } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { failedText } from '@/shared/lib';
import { useConnectionsRequest } from '../../shared/api/useConnectionsRequest.ts';
import type { SubmitState } from '../../shared/types.ts';
import type { UseFileConnectReturn } from '../types.ts';

/** A new connection filled by statement files: no token, nothing to check before it is added. */
export function useFileConnect(provider: MaybeRefOrGetter<ProviderKey>, owner: MaybeRefOrGetter<ParticipantChoice | null>): UseFileConnectReturn {
  const { addConnection } = useConnectionsRequest();
  const participant = useParticipantStore();
  const submit = ref<SubmitState>({ status: 'idle' });

  async function save(): Promise<boolean> {
    const choice = toValue(owner);
    if (!choice) return false;
    submit.value = { status: 'saving' };
    try {
      await addConnection({ participant: choice, provider: toValue(provider), method: 'file' });
      await participant.refresh();
      submit.value = { status: 'idle' };
      return true;
    } catch {
      submit.value = { status: 'error', message: failedText() };
      return false;
    }
  }

  return { submit, save };
}
