// The only place that decides where the app may go on the network: a list of trusted services, each with its hosts.
// Everything that makes a request from main or the import worker is scoped to the services it needs (the import only to
// Monobank, so its X-Token header can never reach another host); the renderer has no network at all (CSP + session).
// A new service is one entry here, reviewed like a trust anchor: only reliable, well-known endpoints.
import type { FetchLike, ResponseLike } from '@mono/core/platform';

export interface TrustedService {
  id: string;
  /** Why the app talks to it (shown in reviews and docs). */
  purpose: string;
  hosts: ReadonlyArray<string>;
}

export const TRUSTED_SERVICES = [
  {
    id: 'github',
    purpose: 'App updates: the release feed and the installers of github.com/MortyQ/muza-balance-insights',
    // github.com redirects release downloads to release-assets.githubusercontent.com.
    hosts: ['github.com', 'release-assets.githubusercontent.com'],
  },
  {
    id: 'monobank',
    purpose: 'Statement and balances import with the personal token',
    hosts: ['api.monobank.ua'],
  },
] as const satisfies ReadonlyArray<TrustedService>;

export type ServiceId = (typeof TRUSTED_SERVICES)[number]['id'];

export function hostsOf(services: ReadonlyArray<ServiceId>): string[] {
  return TRUSTED_SERVICES.filter((s) => services.includes(s.id)).flatMap((s) => [...s.hosts]);
}

export class NetworkPolicyError extends Error {
  override name = 'NetworkPolicyError';
}

/**
 * Throws NetworkPolicyError unless the URL is https, on a host of one of `services`, on the default port, with no
 * credentials. The message names the host only (a URL may carry ids in its path).
 */
export function assertAllowedUrl(url: string, services: ReadonlyArray<ServiceId>): URL {
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
  if (!hostsOf(services).includes(u.hostname)) throw refuse('хост не в списке разрешённых');
  return u;
}

export function isAllowedUrl(url: string, services: ReadonlyArray<ServiceId>): boolean {
  try {
    assertAllowedUrl(url, services);
    return true;
  } catch {
    return false;
  }
}

/** What allowlistedFetch needs from the real fetch (Electron net.fetch, or Node fetch in tests). */
export type InnerFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal; redirect: 'error' },
) => Promise<ResponseLike>;

/**
 * Wraps fetch for the given services: the URL is checked before anything goes out, and redirects are refused
 * (`redirect: 'error'`), otherwise an allowed host could bounce the request — and its headers — somewhere else.
 */
export function allowlistedFetch(inner: InnerFetch, services: ReadonlyArray<ServiceId>): FetchLike {
  return async (url, init) => {
    assertAllowedUrl(url, services);
    return inner(url, { ...init, redirect: 'error' });
  };
}
