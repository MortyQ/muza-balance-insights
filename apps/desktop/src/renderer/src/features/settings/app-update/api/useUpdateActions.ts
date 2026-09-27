import type { UpdateView } from '@contract/update.ts';
import { balanceApi } from '@/shared/api';

export function useUpdateActions(): {
  check: () => Promise<UpdateView>;
  download: () => Promise<UpdateView>;
  install: () => Promise<{ started: boolean; reason?: 'import-running' | 'not-ready' }>;
  setChecks: (enabled: boolean) => Promise<UpdateView>;
} {
  return {
    check: () => balanceApi.checkForUpdates(),
    download: () => balanceApi.downloadUpdate(),
    install: () => balanceApi.installUpdate(),
    setChecks: (enabled) => balanceApi.setUpdateChecks(enabled),
  };
}
