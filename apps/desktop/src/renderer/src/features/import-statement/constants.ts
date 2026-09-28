import type { MessageKey } from '@contract/i18n/index.ts';
import type { ImportError, StartImportResult } from '@contract/progress.ts';

/** Why an import did not start, as dictionary keys. */
export const START_ERRORS: Record<Extract<StartImportResult, { started: false }>['reason'], MessageKey> = {
  'no-token': 'home.import.startError.noToken',
  running: 'home.import.startError.running',
  'db-unavailable': 'home.import.startError.dbUnavailable',
};

/** Why a connection or the import stopped (main and the worker send the code), as dictionary keys. */
export const IMPORT_ERRORS: Record<ImportError, MessageKey> = {
  auth: 'home.import.error.auth',
  'other-holder': 'home.import.error.otherHolder',
  'already-connected': 'home.import.error.alreadyConnected',
  'rate-limit': 'home.import.error.rateLimit',
  network: 'home.import.error.network',
  format: 'home.import.error.format',
  bank: 'home.import.error.bank',
  other: 'home.import.error.other',
  'db-open': 'home.import.error.dbOpen',
  'no-token': 'home.import.error.noToken',
  crash: 'home.import.error.crash',
};
