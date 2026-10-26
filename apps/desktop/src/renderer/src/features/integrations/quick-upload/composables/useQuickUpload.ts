import { ref, type Ref } from 'vue';
import type { OpenUploadResult } from '@contract/api.ts';
import { UPLOAD_FILES_MAX } from '@contract/upload.ts';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { failedText, t } from '@/shared/lib';
import { useConnectionsRequest } from '../../shared/api/useConnectionsRequest.ts';
import type { QuickUploadState, UploadRequest } from '../types.ts';
import { doneText, initialChoices } from '../utils.ts';

// One upload at a time for the whole window: the header's button, the data status list and the drop zone share it.
const state = ref<QuickUploadState>({ step: 'idle' });

export function useQuickUpload(): {
  state: Ref<QuickUploadState>;
  pick: (request?: UploadRequest) => Promise<void>;
  drop: (files: ReadonlyArray<File>) => Promise<void>;
  choose: (file: number, account: number, participantId: number) => void;
  commit: () => Promise<void>;
  close: () => void;
} {
  const request = useConnectionsRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();

  async function begin(req: UploadRequest, open: () => Promise<OpenUploadResult>): Promise<void> {
    state.value = { step: 'opening', request: req };
    try {
      const r = await open();
      if (!r.opened) {
        state.value =
          r.reason === 'cancelled' ? { step: 'idle' } : { step: 'problem', request: req, message: t('integrations.quick.tooMany', { max: UPLOAD_FILES_MAX }) };
        return;
      }
      await participant.refresh().catch(() => undefined);
      const people = participant.people;
      const only = people.length === 1 ? people[0]!.id : null;
      state.value = { step: 'review', request: req, uploadId: r.uploadId, files: r.files, choices: initialChoices(r.files, only), busy: false, error: '' };
    } catch {
      state.value = { step: 'problem', request: req, message: failedText() };
    }
  }

  function choose(file: number, account: number, participantId: number): void {
    const s = state.value;
    if (s.step !== 'review') return;
    const choices = s.choices.map((c, i) => (i === file ? c.map((p, j) => (j === account ? participantId : p)) : c));
    state.value = { ...s, choices };
  }

  async function commit(): Promise<void> {
    const s = state.value;
    if (s.step !== 'review' || s.busy) return;
    state.value = { ...s, busy: true, error: '' };
    try {
      const r = await request.commitUpload(s.uploadId, s.choices);
      if (!r.written) {
        if (r.reason === 'expired') state.value = { step: 'problem', request: s.request, message: t('integrations.statement.expired') };
        else state.value = { ...s, busy: false, error: t('integrations.statement.importRunning') };
        return;
      }
      state.value = { step: 'done', request: s.request, message: doneText(r) };
      // No push from main: home and the rows reload on the new data status. The rows are written even if this fails.
      await participant.refresh().catch(() => undefined);
      await syncStatus.refresh().catch(() => undefined);
    } catch {
      state.value = { ...s, busy: false, error: failedText() };
    }
  }

  return {
    state,
    pick: (req = {}) => begin(req, () => request.openUpload(req.connectionId)),
    drop: (files) => begin({}, () => request.openDroppedUpload([...files])),
    choose,
    commit,
    close: () => void (state.value = { step: 'idle' }),
  };
}
