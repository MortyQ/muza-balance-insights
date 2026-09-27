import { balanceApi } from '@/shared/api';
import type { DbRecoveryRequest } from '../types.ts';

/** Main refuses relaunchApp and startOver while the database is ready; both startOver and deleteAllData ask first. */
export function useDbRecoveryRequest(): DbRecoveryRequest {
  return {
    relaunchApp: () => balanceApi.relaunchApp(),
    startOver: () => balanceApi.startOver(),
    deleteAllData: () => balanceApi.deleteAllData(),
    quitApp: () => balanceApi.quitApp(),
  };
}
