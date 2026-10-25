import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import type { ConnectionView, StatementComparisonView, StatementTargetInput } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { failedText, t } from '@/shared/lib';
import { useConnectionsRequest } from '../../shared/api/useConnectionsRequest.ts';
import type { OpenedStatement, TargetChoice, UploadState, UseStatementUploadReturn } from '../types.ts';
import { canWrite, commitText, initialTargets, newCardType, openProblemText } from '../utils.ts';

/**
 * A statement file for one connection: main opens and reads it (the renderer never sees the file); the first comparison
 * lets the file pick each account's target (IBAN, card number), then every change of a target compares the whole file
 * again; «Add» writes every account of it. A token connection's file is compared only.
 */
export function useStatementUpload(connection: MaybeRefOrGetter<Readonly<ConnectionView>>): UseStatementUploadReturn {
  const request = useConnectionsRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  const state = ref<UploadState>({ step: 'idle' });
  const targets = ref<TargetChoice[]>([]);
  const newTypes = ref<Array<string | null>>([]);
  // Set while the first comparison fills the targets: that is not the user's change.
  let filling = false;

  const targetInputs = (): StatementTargetInput[] =>
    targets.value.map((target, i) => (target === 'new' ? { kind: 'new', type: newTypes.value[i] ?? null } : { kind: 'account', accountId: target }));

  const canAdd = computed(() => {
    const s = state.value;
    return s.step === 'opened' && s.comparison.status === 'ready' && canWrite(s.comparison.comparisons);
  });

  /** `auto`: no targets, the file's own match; then the targets offered first, compared again if they differ from it. */
  async function compare(auto = false): Promise<void> {
    const s = state.value;
    if (s.step !== 'opened') return;
    const file = s.file;
    state.value = { step: 'opened', file, comparison: { status: 'loading' } };
    try {
      const r = await request.compareStatement(file.statementId, auto ? file.statements.map(() => null) : targetInputs());
      // A newer file or step replaced this one meanwhile: its answer is not ours.
      if (state.value.step !== 'opened' || state.value.file !== file) return;
      if (!r.ok) {
        state.value = { step: 'problem', message: t('integrations.statement.expired') };
        return;
      }
      state.value = { step: 'opened', file, comparison: { status: 'ready', comparisons: r.comparisons } };
      if (auto) fill(file, r.comparisons);
    } catch {
      if (state.value.step === 'opened' && state.value.file === file) {
        state.value = { step: 'opened', file, comparison: { status: 'error', message: t('integrations.statement.compareFailed') } };
      }
    }
  }

  function fill(file: OpenedStatement, comparisons: ReadonlyArray<StatementComparisonView>): void {
    const matched = comparisons.map((c) => (c.match.kind === 'account' ? c.match.accountId : 'new'));
    const chosen = initialTargets(file, comparisons, toValue(connection).method === 'file');
    filling = true;
    targets.value = chosen;
    newTypes.value = file.statements.map((s) => newCardType(s, toValue(connection).provider));
    filling = false;
    // A card offered where the file matched none: the shown comparison is not that one's.
    if (chosen.some((c, i) => c !== matched[i])) void compare();
  }

  async function open(): Promise<void> {
    state.value = { step: 'opening' };
    try {
      const r = await request.openStatement(toValue(connection).id);
      if (!r.opened) {
        state.value = r.reason === 'cancelled' ? { step: 'idle' } : { step: 'problem', message: openProblemText(r) };
        return;
      }
      filling = true;
      targets.value = r.statements.map(() => 'new');
      newTypes.value = r.statements.map((s) => newCardType(s, toValue(connection).provider));
      filling = false;
      state.value = { step: 'opened', file: r, comparison: { status: 'loading' } };
      await compare(true);
    } catch {
      state.value = { step: 'problem', message: failedText() };
    }
  }

  async function add(): Promise<void> {
    const s = state.value;
    if (s.step !== 'opened' || !canAdd.value) return;
    state.value = { step: 'writing', file: s.file, comparison: s.comparison };
    try {
      const r = await request.commitStatement(s.file.statementId, targetInputs());
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

  // Sync, so `filling` covers exactly the assignments it wraps.
  watch([targets, newTypes], () => {
    if (!filling) void compare();
  }, { flush: 'sync', deep: true });

  return { state, targets, newTypes, canAdd, open, add };
}
