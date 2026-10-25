// utilityProcess entry: the import runs here so the main process never blocks and a crash can't take it down.
// It opens its own connection to the same database (WAL), gets the tokens once in `start`, and reaches the network
// only through the allowlist — each provider's client only its own services. One job per process: main forks a fresh worker for every import.
import { net } from 'electron';
import { migrate, type Db } from '@mono/core/storage/db';
import { refreshCrossing } from '@mono/core/derive/derived';
import type { TokenProviderId } from '@mono/core/providers/info';
import { openLibsql } from '@mono/db-libsql';
import { allowlistedFetch } from '../net/allowlist.ts';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import { FromWorker, ToWorker } from '../shared/import-protocol.ts';
import { abortableClock } from './clock.ts';
import { runImport } from './run-import.ts';

/** Main closes the worker once the final message (done / error) arrives; this exit is only a fallback. */
const EXIT_FALLBACK_MS = 5_000;


/** The one trusted service a provider's client may reach (src/integrations/<bank>/desktop.ts). */
const serviceOf = (provider: TokenProviderId) => DESKTOP_PROVIDERS[provider].service;

const port = process.parentPort;
const controller = new AbortController();
let started = false;

function send(msg: FromWorker): void {
  // Validate our own output too: nothing untyped leaves the worker.
  port.postMessage(FromWorker.parse(msg));
}

port.on('message', (event: { data: unknown }) => {
  const parsed = ToWorker.safeParse(event.data);
  if (!parsed.success) return; // not from our main: ignore silently
  const msg = parsed.data;
  if (msg.type === 'cancel') {
    controller.abort();
    return;
  }
  if (started) return;
  started = true;
  void (async () => {
    let db: Db | null = null;
    try {
      db = await openLibsql(`file:${msg.dbPath}`, msg.dbKey ? { encryptionKey: msg.dbKey } : {});
      await migrate(db, Math.floor(Date.now() / 1000));
      await refreshCrossing(db);
      await runImport({
        db,
        // Each provider's client reaches only the service its desktop entry names: a bank token never reaches another.
        fetchFor: (provider) => allowlistedFetch(net.fetch, [serviceOf(provider)]),
        clock: abortableClock,
        connections: msg.connections,
        sinceSec: msg.sinceSec,
        rereadWindow: msg.rereadWindow,
        signal: controller.signal,
        emit: send,
      });
    } catch (err) {
      send({ type: 'log', message: `worker: ${err instanceof Error ? err.name : 'unknown'}` });
      send({ type: 'error', kind: 'db-open' });
    } finally {
      db?.close();
      // No process.exit() right after postMessage: the final message could be lost on the way (it was — main then
      // reported an "unexpected" exit and the real reason never reached the screen).
      setTimeout(() => process.exit(0), EXIT_FALLBACK_MS);
    }
  })();
});
