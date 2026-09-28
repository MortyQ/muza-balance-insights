import { ref } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { failedText } from '@/shared/lib';
import { useConnectionsRequest } from '../api/useConnectionsRequest.ts';
import { TOKEN_ERROR_TEXT } from '../constants.ts';
import type { AccountsState, UseConnectionActionsReturn } from '../types.ts';
import { accountToggleText, removeText } from '../utils.ts';

/** What a connection row does, for any bank: the token form itself comes from the bank's folder. */
export function useConnectionActions(): UseConnectionActionsReturn {
  const request = useConnectionsRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  const error = ref('');
  const accounts = ref<ReadonlyMap<number, AccountsState>>(new Map());
  const savingAccount = ref<string | null>(null);

  function setAccounts(connectionId: number, state: AccountsState): void {
    accounts.value = new Map(accounts.value).set(connectionId, state);
  }

  async function setToken(connectionId: number, token: string, remember: boolean): Promise<boolean> {
    error.value = '';
    try {
      await request.setToken(connectionId, token.trim(), remember);
      await participant.refresh();
      return true;
    } catch {
      error.value = TOKEN_ERROR_TEXT;
      return false;
    }
  }

  async function remove(connectionId: number): Promise<void> {
    error.value = '';
    try {
      const r = await request.remove(connectionId);
      error.value = removeText(r);
      if (!r.removed) return;
      await participant.refresh();
      await syncStatus.refresh();
    } catch {
      error.value = failedText();
    }
  }

  async function loadAccounts(connectionId: number): Promise<void> {
    // A reopened panel keeps its list while the fresh one comes.
    if (accounts.value.get(connectionId)?.status !== 'ready') setAccounts(connectionId, { status: 'loading' });
    try {
      setAccounts(connectionId, { status: 'ready', accounts: await request.listAccounts(connectionId) });
    } catch (e) {
      // The error only (no account data): the cause for the next report.
      console.error('[accounts] list failed', e);
      setAccounts(connectionId, { status: 'error' });
    }
  }

  async function setAccountEnabled(connectionId: number, accountId: string, enabled: boolean): Promise<boolean> {
    error.value = '';
    savingAccount.value = accountId;
    try {
      const r = await request.setAccountEnabled(accountId, enabled);
      error.value = accountToggleText(r);
      if (!r.changed) return false;
      const state = accounts.value.get(connectionId);
      if (state?.status === 'ready') {
        const next = state.accounts.map((a) => (a.id === accountId ? { ...a, enabled, auto: false } : a));
        setAccounts(connectionId, { status: 'ready', accounts: next });
      }
      // No push from main: home reloads quietly on the new data status. The switch is saved even if this fails.
      await participant.refresh().catch(() => undefined);
      await syncStatus.refresh();
      return true;
    } catch {
      error.value = failedText();
      return false;
    } finally {
      savingAccount.value = null;
    }
  }

  return { error, setToken, remove, accounts, loadAccounts, savingAccount, setAccountEnabled };
}
