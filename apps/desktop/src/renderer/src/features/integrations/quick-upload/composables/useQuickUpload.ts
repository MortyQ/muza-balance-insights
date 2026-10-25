import { ref } from 'vue';
import type { OpenAnyStatementResult, ProviderId } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { failedText, t } from '@/shared/lib';
import { useConnectionsRequest } from '../../shared/api/useConnectionsRequest.ts';
import { openProblemText } from '../../shared/utils.ts';
import type { ConnectionOption, QuickUploadState } from '../types.ts';
import { connectionsFor } from '../utils.ts';

// One upload at a time for the whole window: the header's button and the layout's drop zone share it.
const state = ref<QuickUploadState>({ step: 'idle' });

export function useQuickUpload() {
  const request = useConnectionsRequest();
  const participant = useParticipantStore();

  async function begin(open: () => Promise<OpenAnyStatementResult>): Promise<void> {
    state.value = { step: 'opening' };
    try {
      const r = await open();
      if (!r.opened) {
        state.value = r.reason === 'cancelled' ? { step: 'idle' } : { step: 'problem', message: openProblemText(r) };
        return;
      }
      await participant.refresh().catch(() => undefined);
      const { files, tokens } = connectionsFor(participant.view?.people ?? [], r.provider);
      if (files.length === 1) await assign(r.statementId, files[0]!);
      else state.value = { step: 'choose', statementId: r.statementId, provider: r.provider, files, tokens, busy: false };
    } catch {
      state.value = { step: 'problem', message: failedText() };
    }
  }

  async function assign(statementId: string, option: ConnectionOption): Promise<void> {
    const r = await request.assignStatement(statementId, option.connection.id);
    if (!r.opened && r.reason === 'expired') state.value = { step: 'problem', message: t('integrations.statement.expired') };
    else if (!r.opened) state.value = { step: 'problem', message: openProblemText(r) };
    else state.value = { step: 'ready', connection: option.connection, opened: r };
  }

  /** The picked connection of the file's bank. */
  async function choose(option: ConnectionOption): Promise<void> {
    const s = state.value;
    if (s.step !== 'choose') return;
    state.value = { ...s, busy: true };
    try {
      await assign(s.statementId, option);
    } catch {
      state.value = { step: 'problem', message: failedText() };
    }
  }

  /** No file connection of the file's bank: one is added for the person picked, then the file goes to it. */
  async function addConnection(participantId: number | null): Promise<void> {
    const s = state.value;
    if (s.step !== 'choose') return;
    state.value = { ...s, busy: true };
    try {
      const provider: ProviderId = s.provider;
      const r = await request.addConnection({
        participant: participantId === null ? { label: t('integrations.quick.me') } : { id: participantId },
        provider,
        method: 'file',
      });
      if (!r.added) throw new Error('not added');
      await participant.refresh();
      const added = connectionsFor(participant.view?.people ?? [], provider).files.find((o) => o.connection.id === r.connectionId);
      if (!added) throw new Error('not listed');
      await assign(s.statementId, added);
    } catch {
      state.value = { step: 'problem', message: failedText() };
    }
  }

  return {
    state,
    pick: () => begin(() => request.openAnyStatement()),
    drop: (files: ReadonlyArray<File>) =>
      files.length === 1 ? begin(() => request.openDroppedStatement(files[0]!)) : void (state.value = { step: 'problem', message: t('integrations.quick.oneFile') }),
    choose,
    addConnection,
    close: () => void (state.value = { step: 'idle' }),
  };
}
