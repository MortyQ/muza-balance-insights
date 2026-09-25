// app://renderer/… serves the built renderer (Security Checklist #18: a custom protocol instead of file://).
// Only files inside the renderer folder, after resolving symlinks; anything else is a 404.
import fs from 'node:fs';
import path from 'node:path';

export const APP_SCHEME = 'app';
export const APP_HOST = 'renderer';
/** Origin of the renderer. URL.origin is "null" for non-special schemes, so this is built by hand, here only. */
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_ENTRY = `${APP_ORIGIN}/index.html`;

/** Privileges for protocol.registerSchemesAsPrivileged (before ready): standard + secure → 'self' and ES modules work. */
export const APP_SCHEME_PRIVILEGES = { standard: true, secure: true, supportFetchAPI: true } as const;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const inside = (dir: string, p: string) => {
  const rel = path.relative(dir, p);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

/** Absolute path of the file an app:// URL may serve, or null. */
export function resolveAppFile(rendererDir: string, rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== `${APP_SCHEME}:` || u.host !== APP_HOST || u.username || u.password) return null;
  if (u.pathname.includes('\\')) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(u.pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  if (decoded.split('/').some((seg) => seg === '..' || seg === '.')) return null;
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const full = path.resolve(rendererDir, rel);
  if (!inside(rendererDir, full)) return null;
  let real: string;
  try {
    real = fs.realpathSync(full);
  } catch {
    return null;
  }
  if (!inside(fs.realpathSync(rendererDir), real) || !fs.statSync(real).isFile()) return null;
  return real;
}

/** The protocol.handle() callback. Every response carries the CSP. */
export function createAppProtocolHandler(rendererDir: string, csp: string): (req: Request) => Promise<Response> {
  const headers = (type: string) => ({
    'Content-Type': type,
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  return async (req) => {
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: headers('text/plain') });
    const file = resolveAppFile(rendererDir, req.url);
    if (!file) return new Response('Not Found', { status: 404, headers: headers('text/plain') });
    const type = CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    return new Response(new Uint8Array(await fs.promises.readFile(file)), { status: 200, headers: headers(type) });
  };
}
