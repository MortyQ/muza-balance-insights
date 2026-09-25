// Starts the real MCP server over stdio with a given database file (argv[2]) — for the e2e test.
// Same code path as src/server.ts minus config/.env and the token (sync_recent reports a missing token).
import { openDb } from '../../src/db.ts';
import { runStdioServer } from '../../src/mcp/run.ts';
import { systemClock } from '../../src/clock.ts';

const db = await openDb(`file:${process.argv[2]}`);
await runStdioServer(db, {
  clock: systemClock,
  getApi: () => {
    throw new Error('MONO_TOKEN не задан.');
  },
});
