// The network of the updater: one Electron session, the one electron-updater itself uses (its NET_SESSION_NAME), so a
// single guard covers its requests (release feed, installer download) and ours (update.json, the macOS .dmg). The
// guard runs for every request and every redirect hop: only the `github` trusted service passes.
import { isAllowedUrl } from '../../net/allowlist.ts';

/** electron-updater's partition (electron-updater/out/electronHttpExecutor.js, NET_SESSION_NAME); tests pin it. */
export const UPDATE_PARTITION = 'electron-updater';

type Callback<T> = (response: T) => void;
export type UpdateSessionLike = {
  webRequest: { onBeforeRequest(h: (details: { url: string }, cb: Callback<{ cancel: boolean }>) => void): void };
  setPermissionRequestHandler(h: ((wc: unknown, permission: string, cb: (granted: boolean) => void) => void) | null): void;
  fetch(url: string, init?: { signal?: AbortSignal; cache?: 'no-store' }): Promise<Response>;
};

export function guardUpdateSession(ses: UpdateSessionLike, onBlocked?: (host: string) => void): void {
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = isAllowedUrl(details.url, ['github']);
    if (!ok) onBlocked?.(hostOf(details.url));
    cb({ cancel: !ok });
  });
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '(bad url)';
  }
}

/** A small file (update.json and its signature): status 200, at most `maxBytes`, `timeoutMs` for the whole request. */
export async function fetchBytes(ses: UpdateSessionLike, url: string, timeoutMs: number, maxBytes = 64 * 1024): Promise<Uint8Array> {
  const res = await ses.fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error('response too large');
  return bytes;
}

/** Streams a download into `dest`, never more than `maxBytes`; `onProgress` gets 0–100. */
export async function downloadTo(
  ses: UpdateSessionLike,
  url: string,
  dest: string,
  maxBytes: number,
  onProgress: (percent: number) => void,
  write: (dest: string, chunks: AsyncIterable<Uint8Array>) => Promise<void>,
): Promise<void> {
  const res = await ses.fetch(url, { cache: 'no-store' });
  if (res.status !== 200 || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || maxBytes;
  let got = 0;
  const reader = res.body.getReader();
  async function* chunks(): AsyncIterable<Uint8Array> {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      got += value.length;
      if (got > maxBytes) throw new Error('download larger than the manifest says');
      onProgress(Math.min(100, Math.round((got / total) * 100)));
      yield value;
    }
  }
  await write(dest, chunks());
}
