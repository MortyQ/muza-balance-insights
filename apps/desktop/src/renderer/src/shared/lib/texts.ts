import { t } from './i18n.ts';

/** A failed call to main (refused, main restarted, an old main without the handler) — shown, never an unhandled rejection. */
export function failedText(): string {
  return t('common.failed');
}
