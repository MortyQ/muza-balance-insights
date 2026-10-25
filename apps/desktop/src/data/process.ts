// utilityProcess entry: the app's database work runs here (host.ts), so main never waits on a query. It opens its own
// connection to the same database as the import worker (WAL), with the key from `open`; keeps the rates main sends;
// answers calls one at a time; exits on `close` once the connection is closed. No network, nothing but its parent
// port: main is the only gate between it and the renderer.
import { openLibsql } from '@mono/db-libsql';
import type { RatesView } from '../shared/api.ts';
import { FromData, ToData } from '../shared/data-protocol.ts';
import { notADatabase } from '../shared/db-open.ts';
import { DataHost } from './host.ts';

const port = process.parentPort;
let host: DataHost | null = null;
let rates: RatesView | null = null;
let closing = false;

function send(msg: FromData): void {
  // Validate our own output too: nothing untyped leaves the process.
  port.postMessage(FromData.parse(msg));
}

const nameOf = (err: unknown): string => (err instanceof Error ? err.name.slice(0, 80) : 'Error');

async function open(dbPath: string, dbKey: string | null): Promise<void> {
  const h = new DataHost({
    open: () => openLibsql(`file:${dbPath}`, dbKey ? { encryptionKey: dbKey } : {}),
    // The files are released when this process exits.
    release: async () => undefined,
    nowSec: () => Math.floor(Date.now() / 1000),
    rates: async () => rates,
    log: (line) => process.stderr.write(`${line}\n`),
  });
  host = h;
  try {
    await h.open();
    send({ type: 'ready' });
  } catch (err) {
    host = null;
    send({ type: 'open-failed', kind: notADatabase(err) ? 'unreadable' : 'failed', name: nameOf(err) });
  }
}

port.on('message', (event: { data: unknown }) => {
  const parsed = ToData.safeParse(event.data);
  if (!parsed.success) return; // not from our main: ignore silently
  const msg = parsed.data;
  if (msg.type === 'rates') {
    rates = msg.rates;
    return;
  }
  if (msg.type === 'open') {
    if (host === null && !closing) void open(msg.dbPath, msg.dbKey);
    return;
  }
  if (msg.type === 'close') {
    if (closing) return;
    closing = true;
    void (host?.close() ?? Promise.resolve()).catch(() => undefined).then(() => process.exit(0));
    return;
  }
  if (host === null || closing) {
    send({ type: 'failure', id: msg.id, code: 'failed', name: 'NotOpen' });
    return;
  }
  void host.handle(msg).then(send);
});
