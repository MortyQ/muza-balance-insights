// Content-Security-Policy for the renderer. No Electron imports: also used by electron.vite.config.ts (build-time <meta>).

/** Production: exactly the policy from the stage-1 spec, plus the directives that default-src does not cover. */
export const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Development only (Vite dev server): HMR needs its WebSocket, and Vite injects CSS as <style> tags.
 * Nothing else is relaxed: no 'unsafe-eval', no remote hosts.
 */
export function devCsp(devOrigin: string): string {
  const ws = devOrigin.replace(/^http:/, 'ws:');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${ws}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * The dev server URL electron-vite passes in ELECTRON_RENDERER_URL — accepted only if it is plain http on
 * localhost / 127.0.0.1 with a port. Returns its origin, or null (then nothing is loaded).
 */
export function localDevOrigin(url: string | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(u.hostname) || !u.port || u.username || u.password) return null;
  return `${u.protocol}//${u.host}`;
}
