import { balanceApi } from '@/shared/api';
import type { DbRecoveryRequest } from '../types.ts';

/** Main refuses relaunchApp and startOver while the database is ready; startOver asks first. «Удалить все данные» — shared/api. */
export function useDbRecoveryRequest(): DbRecoveryRequest {
  return {
    relaunchApp: () => balanceApi.relaunchApp(),
    startOver: () => balanceApi.startOver(),
    quitApp: () => balanceApi.quitApp(),
  };
}
