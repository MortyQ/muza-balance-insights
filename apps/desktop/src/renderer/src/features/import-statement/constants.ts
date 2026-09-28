import type { MessageKey } from '@contract/i18n/index.ts';
import type { StartImportResult } from '@contract/progress.ts';

/** Why an import did not start, as dictionary keys. */
export const START_ERRORS: Record<Extract<StartImportResult, { started: false }>['reason'], MessageKey> = {
  'no-token': 'home.import.startError.noToken',
  running: 'home.import.startError.running',
  'db-unavailable': 'home.import.startError.dbUnavailable',
};
