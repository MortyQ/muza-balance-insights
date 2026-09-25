// Session and webContents hardening (Security Checklist #1, #5, #11–14). Electron objects come in as parameters,
// so everything here is unit-tested with fakes.
import { APP_ORIGIN } from './app-protocol.ts';

type Callback<T> = (value: T) => void;

export type SessionLike = {
  setPermissionRequestHandler(h: (wc: unknown, permission: string, cb: Callback<boolean>) => void): void;
  setPermissionCheckHandler(h: (...args: unknown[]) => boolean): void;
  setDevicePermissionHandler(h: (...args: unknown[]) => boolean): void;
  webRequest: {
    onBeforeRequest(h: (details: { url: string }, cb: Callback<{ cancel: boolean }>) => void): void;
    onHeadersReceived(
      h: (details: { url: string; responseHeaders?: Record<string, string[]> }, cb: Callback<{ responseHeaders?: Record<string, string[]> }>) => void,
    ): void;
  };
};

/** #5: the app needs no permission at all — camera, geolocation, notifications, HID/USB/serial… all denied. */
export function denyAllPermissions(session: SessionLike): void {
  session.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
}

/** What the renderer session may load: the app protocol; in dev also the local Vite server (http + HMR ws) and DevTools. */
export function isAllowedRendererUrl(url: string, devOrigin: string | null): boolean {
  if (url.startsWith(`${APP_ORIGIN}/`)) return true;
  if (!devOrigin) return false;
  const ws = devOrigin.replace(/^http:/, 'ws:');
  return url.startsWith(`${devOrigin}/`) || url === devOrigin || url.startsWith(`${ws}/`) || url === ws || url.startsWith('devtools://');
}

/**
 * #1 + defence in depth behind the CSP: every request of the renderer session that is not our own content is cancelled.
 * In dev, the Vite server's responses get the (dev) CSP header here; in prod the app:// handler sets it itself.
 * The import's network (utilityProcess, net.fetch) uses the system network context, not this session.
 */
export function restrictRendererSession(
  session: SessionLike,
  opts: { devOrigin: string | null; devCsp: string | null; onBlocked?: (where: string) => void },
): void {
  session.webRequest.onBeforeRequest((details, cb) => {
    const allowed = isAllowedRendererUrl(details.url, opts.devOrigin);
    if (!allowed) opts.onBlocked?.(urlWhere(details.url));
    cb({ cancel: !allowed });
  });
  session.webRequest.onHeadersReceived((details, cb) => {
    if (opts.devOrigin && opts.devCsp && details.url.startsWith(`${opts.devOrigin}/`)) {
      const headers = { ...(details.responseHeaders ?? {}) };
      for (const k of Object.keys(headers)) if (k.toLowerCase() === 'content-security-policy') delete headers[k];
      cb({ responseHeaders: { ...headers, 'Content-Security-Policy': [opts.devCsp] } });
      return;
    }
    cb({});
  });
}

/** For dev diagnostics: scheme + host + path, never the query or fragment. */
export function urlWhere(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return '(invalid url)';
  }
}

export type WebContentsLike = {
  on(event: 'will-navigate' | 'will-redirect' | 'will-attach-webview', listener: (e: { preventDefault(): void }, url?: unknown) => void): unknown;
  setWindowOpenHandler(h: (details: unknown) => { action: 'deny' }): void;
};

/** #11–14: no navigation away, no redirects, no new windows, no <webview>. Applied to every webContents. */
export function guardWebContents(wc: WebContentsLike, onPrevented?: (what: string) => void): void {
  const prevent = (name: string) => (e: { preventDefault(): void }, url?: unknown) => {
    e.preventDefault();
    onPrevented?.(`${name} ${typeof url === 'string' ? urlWhere(url) : ''}`.trim());
  };
  wc.on('will-navigate', prevent('will-navigate'));
  wc.on('will-redirect', prevent('will-redirect'));
  wc.on('will-attach-webview', prevent('will-attach-webview'));
  wc.setWindowOpenHandler((details) => {
    const url = (details as { url?: unknown } | null)?.url;
    onPrevented?.(`window-open ${typeof url === 'string' ? urlWhere(url) : ''}`.trim());
    return { action: 'deny' };
  });
}
