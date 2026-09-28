import type { DbStateView } from '@contract/db-state.ts';
import { t } from '@/shared/lib';
import { DETAILS, TITLES, UNAVAILABLE_DETAIL } from './constants.ts';
import type { RecoveryText } from './types.ts';

/** Title, explanation and the main button for a database that is not ready; null when it is. No error details. */
export function recoveryText(view: DbStateView | null): RecoveryText | null {
  if (!view || view.status === 'ready') return null;
  if (view.status === 'key-unavailable') {
    return { title: t(TITLES[view.status]), detail: t(UNAVAILABLE_DETAIL[view.platform]), primary: 'relaunch' };
  }
  return { title: t(TITLES[view.status]), detail: t(DETAILS[view.status]), primary: 'startOver' };
}
