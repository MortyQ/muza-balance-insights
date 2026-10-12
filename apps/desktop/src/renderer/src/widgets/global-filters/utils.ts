import type { ConnectionView, ProviderKey } from '@contract/api.ts';
import type { ImportProgress } from '@contract/progress.ts';
import { bankOf } from '@/entities/bank';
import { IMPORT_ERRORS, progressLine } from '@/features/import-statement';
import { i18n, syncedWhen, t } from '@/shared/lib';
import { ALL_BANKS } from './constants.ts';
import type { FilterRowWidths, SyncStatusView } from './types.ts';

/** The bank select: «All banks», then the connected banks by name. */
export function bankOptions(providers: ReadonlyArray<ProviderKey>): Array<{ label: string; value: string }> {
  return [{ label: t('home.filters.allBanks'), value: ALL_BANKS }, ...providers.map((p) => ({ label: t(bankOf(p).name), value: p }))];
}

/** When the data was last updated, for the tooltip of the data line: «Updated at 14:20»; '' — never. */
function updatedLine(line: string, lastSyncAt: string | null, now: number): string {
  if (!line || lastSyncAt === null) return '';
  return t('home.filters.updated', { when: syncedWhen(lastSyncAt, new Date(now)) });
}

/**
 * The status next to the home filters, built of the progress of an import and the data status. An import started by the
 * user shows a spinner, «Syncing…» and the share of windows done; «Auto-sync» only «Updating the data…»; both show the
 * progress (windows done of all) on hover. A wait for a retry — its time. Once over — what the data covers, and when it
 * was last updated on hover, with a warning when the import or one of its connections failed. `now` is passed in so the
 * retry time and «today» are testable.
 */
export function syncStatusView(
  p: Readonly<ImportProgress>,
  data: { line: string; lastSyncAt: string | null },
  now: number,
  labelOf: (connectionId: number) => string,
): SyncStatusView {
  const idle: SyncStatusView = { icon: null, text: data.line, percent: '', note: '', tooltip: updatedLine(data.line, data.lastSyncAt, now) };
  switch (p.phase) {
    case 'starting':
    case 'accounts':
    case 'windows':
    case 'rederive': {
      if (p.auto) return { ...idle, icon: 'spinner', text: t('home.import.autoRunning'), tooltip: progressLine(p, now) };
      const pct = p.phase === 'windows' && p.windowsTotal > 0 ? Math.floor((p.windowsDone / p.windowsTotal) * 100) : null;
      return {
        ...idle,
        icon: 'spinner',
        text: t('home.filters.syncing'),
        percent: pct === null ? '' : t('home.filters.percent', { pct }),
        tooltip: progressLine(p, now),
      };
    }
    case 'retry': {
      const at = new Date(now + p.inSec * 1000).toLocaleTimeString(i18n.global.locale.value, { hour: '2-digit', minute: '2-digit' });
      return { ...idle, icon: 'spinner', text: t('home.filters.retryAt', { at }), tooltip: progressLine(p, now) };
    }
    case 'done': {
      if (p.failed.length === 0) return idle;
      const note = p.failed
        .map((f) => t('home.import.notLoaded', { line: `${labelOf(f.connectionId)}: ${t(IMPORT_ERRORS[f.error])}` }))
        .join('\n');
      return { ...idle, icon: 'warning', note, tooltip: note };
    }
    case 'error': {
      const note = t(IMPORT_ERRORS[p.error]);
      return { ...idle, icon: 'warning', note, tooltip: note };
    }
    case 'idle':
    case 'needs-token':
    case 'cancelled':
      return idle;
  }
}

/** Connections that did not update in the last import → why, for the people filter. */
export function failedConnections(p: Readonly<ImportProgress>): Record<number, string> {
  return p.phase === 'done' ? Object.fromEntries(p.failed.map((f) => [f.connectionId, t(IMPORT_ERRORS[f.error])])) : {};
}

/**
 * Whether the person buttons fit centred in the row: the middle column of `1fr auto 1fr` is as wide as the row minus
 * two of the wider side and the two gaps around it. Before the first measurement (row 0): fits, so the first frame
 * shows the buttons rather than a select that flips to them.
 */
export function fitsCenter(w: Readonly<FilterRowWidths>, gap: number): boolean {
  return w.row === 0 || w.center + 2 * gap + 2 * Math.max(w.left, w.right) <= w.row;
}

/**
 * When the bank's data was last refreshed (`provider` null: every bank): the oldest refresh among its connections, so
 * the line never says more than is true of all of them. Null: one of them was never refreshed, or there is none.
 */
export function lastRefreshOf(connections: ReadonlyArray<Readonly<ConnectionView>>, provider: ProviderKey | null): string | null {
  const times = connections.filter((c) => provider === null || c.provider === provider).map((c) => c.lastSyncAt);
  let oldest: string | null = null;
  for (const at of times) {
    if (at === null) return null;
    if (oldest === null || at < oldest) oldest = at;
  }
  return oldest;
}

/** When the selection was last refreshed, or that it never was. */
export function refreshLine(last: string | null, now: Date): string {
  return last === null ? t('home.filters.refresh.never') : t('home.filters.refresh.last', { when: syncedWhen(last, now) });
}
