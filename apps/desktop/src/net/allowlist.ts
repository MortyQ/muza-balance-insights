// The only place that decides where the app may go on the network. Everything that makes a request from main or
// the import worker receives fetch through allowlistedFetch(); the renderer has no network at all (CSP + session).
// Adding a host (update check, exchange rates, weather — backlog) is one line here, reviewed like a trust anchor.
import type { FetchLike, ResponseLike } from '@mono/core/platform';

export const ALLOWED_HOSTS: readonly string[] = ['api.monobank.ua'];

export class NetworkPolicyError extends Error {
  override name = 'NetworkPolicyError';
}

/**
 * Throws NetworkPolicyError unless the URL is https, on an allowed host, on the default port, with no credentials.
 * The message names the host only (a URL may carry ids in its path).
 */
export function assertAllowedUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new NetworkPolicyError('Запрос отклонён: некорректный адрес');
  }
  const refuse = (why: string) => new NetworkPolicyError(`Запрос к ${u.hostname || '(нет хоста)'} отклонён: ${why}`);
  if (u.protocol !== 'https:') throw refuse('только https');
  if (u.username || u.password) throw refuse('учётные данные в адресе');
  if (u.port !== '') throw refuse('нестандартный порт');
  if (!ALLOWED_HOSTS.includes(u.hostname)) throw refuse('хост не в списке разрешённых');
  return u;
}

/** What allowlistedFetch needs from the real fetch (Electron net.fetch, or Node fetch in tests). */
export type InnerFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal; redirect: 'error' },
) => Promise<ResponseLike>;

/**
 * Wraps fetch: the URL is checked before anything goes out, and redirects are refused (`redirect: 'error'`),
 * otherwise an allowed host could bounce the request — and its X-Token header — somewhere else.
 */
export function allowlistedFetch(inner: InnerFetch): FetchLike {
  return async (url, init) => {
    assertAllowedUrl(url);
    return inner(url, { ...init, redirect: 'error' });
  };
}
