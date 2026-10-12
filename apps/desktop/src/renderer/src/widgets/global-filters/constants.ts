import type { MessageKey } from '@contract/i18n/index.ts';
import type { StartImportResult } from '@contract/progress.ts';

/** The gap between the row's columns, px: `gap-3`. */
export const ROW_GAP = 12;

/** The bank select's value for «All banks»: not a provider id, and not empty (reka-ui's select keeps '' for «no value»). */
export const ALL_BANKS = 'all';

/** Why main did not start a refresh: the dictionary key of the text next to the button. */
export const REFRESH_ERRORS = {
  running: 'home.filters.refresh.running',
  'no-token': 'home.filters.refresh.noToken',
  'db-unavailable': 'home.filters.refresh.unavailable',
} as const satisfies Record<Extract<StartImportResult, { started: false }>['reason'], MessageKey>;
