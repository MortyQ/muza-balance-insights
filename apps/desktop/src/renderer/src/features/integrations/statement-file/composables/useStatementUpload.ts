import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import type { ConnectionView, StatementTargetInput } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { failedText, t } from '@/shared/lib';
import { useConnectionsRequest } from '../../shared/api/useConnectionsRequest.ts';
import { DEFAULT_NEW_CARD_TYPE } from '../constants.ts';
import type { TargetChoice, UploadState, UseStatementUploadReturn } from '../types.ts';
import { commitText, defaultTarget, openProblemText } from '../utils.ts';

/**
 * A statement file for one connection: main opens and reads it (the renderer never sees the file), then every change of
 * the account compares it again; «Add» writes it. A token connection's file is compared only.
 */
export function useStatementUpload(connection: MaybeRefOrGetter<Readonly<ConnectionView>>): UseStatementUploadReturn {
  const request = useConnectionsRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  const state = ref<UploadState>({ step: 'idle' });
  const target = ref<TargetChoice>('new');
  const newType = ref(DEFAULT_NEW_CARD_TYPE);

  const targetInput = (): StatementTargetInput =>
    target.value === 'new' ? { kind: 'new', type: newType.value } : { kind: 'account', accountId: target.value };

  const canAdd = computed(() => {
    const s = state.value;
    return s.step === 'opened' && s.comparison.status === 'ready' && s.comparison.comparison.blocked === null && s.comparison.comparison.added > 0;
  });

  async function compare(): Promise<void> {
    const s = state.value;
    if (s.step !== 'opened') return;
    const file = s.file;
    state.value = { step: 'opened', file, comparison: { status: 'loading' } };
    try {
      const r = await request.compareStatement(file.statementId, targetInput());
      // A newer file or step replaced this one meanwhile: its answer is not ours.
      if (state.value.step !== 'opened' || state.value.file !== file) return;
      state.value = r.ok
        ? { step: 'opened', file, comparison: { status: 'ready', comparison: r.comparison } }
        : { step: 'problem', message: t('integrations.statement.expired') };
    } catch {
      if (state.value.step === 'opened' && state.value.file === file) {
        state.value = { step: 'opened', file, comparison: { status: 'error', message: t('integrations.statement.compareFailed') } };
      }
    }
  }

  async function open(): Promise<void> {
    state.value = { step: 'opening' };
    try {
      const r = await request.openStatement(toValue(connection).id);
      if (!r.opened) {
        state.value = r.reason === 'cancelled' ? { step: 'idle' } : { step: 'problem', message: openProblemText(r) };
        return;
      }
      target.value = defaultTarget(r.accounts, toValue(connection).method === 'file');
      newType.value = DEFAULT_NEW_CARD_TYPE;
      state.value = { step: 'opened', file: r, comparison: { status: 'loading' } };
      await compare();
    } catch {
      state.value = { step: 'problem', message: failedText() };
    }
  }

  async function add(): Promise<void> {
    const s = state.value;
    if (s.step !== 'opened' || !canAdd.value) return;
    state.value = { step: 'writing', file: s.file, comparison: s.comparison };
    try {
      const r = await request.commitStatement(s.file.statementId, targetInput());
      state.value = r.written ? { step: 'done', message: commitText(r) } : { step: 'problem', message: commitText(r) };
      if (r.written) {
        // No push from main: home and the rows reload on the new data status. The rows are written even if this fails.
        await participant.refresh().catch(() => undefined);
        await syncStatus.refresh();
      }
    } catch {
      state.value = { step: 'problem', message: failedText() };
    }
  }

  // Sync: `open` sets the first account before the file is shown, so only its own comparison runs.
  watch([target, newType], () => void compare(), { flush: 'sync' });

  return { state, target, newType, canAdd, open, add };
}
