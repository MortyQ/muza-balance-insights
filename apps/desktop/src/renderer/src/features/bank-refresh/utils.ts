import type { ConnectionView, ProviderKey } from '@contract/api.ts';
import { bankOf } from '@/entities/bank';
import { syncedWhen, t } from '@/shared/lib';

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

/** Whether a refresh of the bank (`provider` null: every bank) has a token to run with: main refuses one without. */
export function hasTokenFor(connections: ReadonlyArray<Readonly<ConnectionView>>, provider: ProviderKey | null): boolean {
  return connections.some((c) => (provider === null || c.provider === provider) && c.token.present);
}

/** «Refresh» with one bank connected; with several — what exactly: «Refresh all» or «Refresh Monobank». */
export function refreshButtonText(provider: ProviderKey | null, multipleBanks: boolean): string {
  if (!multipleBanks) return t('home.filters.refresh.button');
  return provider === null ? t('home.filters.refresh.buttonAll') : t('home.filters.refresh.buttonBank', { bank: t(bankOf(provider).name) });
}

/**
 * The line next to the button: an import or «Auto-sync» in progress, then why the button is off (no token, as a
 * warning), else when the selection was last refreshed (`line`).
 */
export function refreshStatus(s: { running: boolean; auto: boolean; hasToken: boolean; line: string }): { text: string; warning: boolean } {
  if (s.running) return { text: t(s.auto ? 'home.import.autoRunning' : 'home.filters.refresh.running'), warning: false };
  if (!s.hasToken) return { text: t('home.filters.refresh.noToken'), warning: true };
  return { text: s.line, warning: false };
}
