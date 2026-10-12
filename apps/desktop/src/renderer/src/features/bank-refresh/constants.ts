import type { MessageKey } from '@contract/i18n/index.ts';
import type { StartImportResult } from '@contract/progress.ts';

/** Why main did not start a refresh: the dictionary key of the text next to the button. */
export const REFRESH_ERRORS = {
  running: 'home.filters.refresh.running',
  'no-token': 'home.filters.refresh.noToken',
  'db-unavailable': 'home.filters.refresh.unavailable',
} as const satisfies Record<Extract<StartImportResult, { started: false }>['reason'], MessageKey>;
