import type { MessageKey } from '@contract/i18n/index.ts';
import type { ImportProgress } from '@contract/progress.ts';
import { accountName } from '@/entities/bank';
import { i18n, t } from '@/shared/lib';
import { IMPORT_ERRORS } from './constants.ts';

export function fmtDuration(sec: number): string {
  if (sec < 60) return t('home.import.duration.sec', { sec });
  const m = Math.round(sec / 60);
  return m < 60 ? t('home.import.duration.min', { min: m }) : t('home.import.duration.hourMin', { hours: Math.floor(m / 60), min: m % 60 });
}

const RETRY_REASON = {
  network: 'home.import.retry.network',
  server: 'home.import.retry.server',
  'rate-limit': 'home.import.retry.rateLimit',
  crash: 'home.import.retry.crash',
} as const satisfies Record<Extract<ImportProgress, { phase: 'retry' }>['reason'], MessageKey>;

/** One line under the import controls; `now` is passed in so the retry time is testable. */
export function progressLine(p: Readonly<ImportProgress>, now: number): string {
  switch (p.phase) {
    case 'idle':
      return '';
    case 'needs-token':
      return t('home.import.needsToken');
    case 'starting':
      return p.resumed ? t('home.import.resuming') : t('home.import.starting');
    case 'accounts':
      return t('home.import.accounts');
    case 'windows': {
      const wait = p.waitingSec ? t('home.import.waitLimit', { sec: p.waitingSec }) : '';
      return t('home.import.windowsLine', {
        account: p.account === null ? t('home.import.someAccount') : accountName(p.account),
        from: p.from,
        to: p.to,
        index: p.index,
        total: p.total,
        done: p.windowsDone,
        windows: p.windowsTotal,
        transactions: p.transactions,
        eta: fmtDuration(p.etaSec),
        wait,
      });
    }
    case 'retry': {
      const at = new Date(now + p.inSec * 1000).toLocaleTimeString(i18n.global.locale.value, { hour: '2-digit', minute: '2-digit' });
      return t('home.import.retryLine', { reason: t(RETRY_REASON[p.reason]), at, attempt: p.attempt });
    }
    case 'rederive':
      return t('home.import.rederive');
    case 'done':
      return t('home.import.done', { windows: p.windowsTotal, transactions: p.transactions });
    case 'cancelled':
      return t('home.import.cancelled');
    case 'error':
      return t(IMPORT_ERRORS[p.error]);
  }
  return '';
}

/**
 * «Auto-sync»: one quiet line while it runs, nothing once it is over — only a wait for the network or an error is
 * worth a line; a connection that did not import still shows through failureLines.
 */
export function autoLine(p: Readonly<ImportProgress>, now: number): string {
  switch (p.phase) {
    case 'retry':
      return progressLine(p, now);
    case 'error':
      return t(IMPORT_ERRORS[p.error]);
    case 'idle':
    case 'needs-token':
    case 'done':
    case 'cancelled':
      return '';
    case 'starting':
    case 'accounts':
    case 'windows':
    case 'rederive':
      return t('home.import.autoRunning');
  }
  return '';
}

/** After an import: one line per connection that did not import (`labelOf`: «Name · Monobank»). */
export function failureLines(p: Readonly<ImportProgress>, labelOf: (connectionId: number) => string): string[] {
  return p.phase === 'done' ? p.failed.map((f) => `${labelOf(f.connectionId)}: ${t(IMPORT_ERRORS[f.error])}`) : [];
}

/** Share of windows done, or null when there is no bar to show. */
export function windowsPercent(p: Readonly<ImportProgress>): number | null {
  return p.phase === 'windows' && p.windowsTotal > 0 ? (p.windowsDone / p.windowsTotal) * 100 : null;
}
