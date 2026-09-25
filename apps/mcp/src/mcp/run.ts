// Wires the tools to a transport. Separate from src/server.ts so tests can start the same server
// over stdio with their own database (no .env, no token).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Db } from '../db.ts';
import { log } from '../log.ts';
import { createServer, type ToolDeps } from './tools.ts';

export async function runStdioServer(db: Db, deps: Omit<ToolDeps, 'db'>): Promise<void> {
  const server = createServer({ db, ...deps });
  const transport = new StdioServerTransport();
  const shutdown = async () => {
    await server.close().catch(() => undefined);
    db.close();
    process.exit(0);
  };
  process.stdin.on('close', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  await server.connect(transport);
  log.info('monobank-mcp: сервер запущен (stdio)');
}
