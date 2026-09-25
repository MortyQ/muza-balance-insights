// Filesystem locations with no dependency on .env or the token. Code that must never see the token
// (recategorize runs outside the OS sandbox) imports this module instead of config.ts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repository root, resolved from this file — never from process.cwd() (Claude Desktop runs us from an arbitrary cwd).
 * data/, .env and analysis/ live here, not inside apps/mcp.
 */
export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** This package (apps/mcp). */
export const MCP_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const DEFAULT_DB_PATH = path.join(REPO_ROOT, 'data', 'monobank.db');

/** MONO_DB_PATH (relative to the repository root or absolute) or the default. Blank counts as unset. */
export function resolveDbPath(monoDbPath: string | undefined): string {
  const p = monoDbPath?.trim();
  return p ? path.resolve(REPO_ROOT, p) : DEFAULT_DB_PATH;
}
