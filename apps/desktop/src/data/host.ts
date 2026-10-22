// The data process's handler table: each method of src/shared/data-protocol.ts over the one open connection. No
// Electron here (process.ts wires it), so tests run it on an in-memory database. Calls run one at a time, in the order
// they arrive. Arguments are checked before anything runs; an error goes back as a code and its name, never its message.
import { deleteConnection, setAccountEnabled } from '@mono/core/commands/people';
import { ConnectionError } from '@mono/core/people/connections';
import { renameParticipant, restoreBankLabel } from '@mono/core/people/participants';
import {
  DATA_ARG_SCHEMAS,
  type CallMessage,
  type DataArgs,
  type DataErrorCode,
  type DataMethod,
  type DataReply,
  type DataResult,
} from '../shared/data-protocol.ts';
import { connectionAccounts, connectionList, createConnection } from './connections.ts';
import { DataService, type DataServiceDeps } from './data.ts';
import { participantColor, peopleRows } from './people.ts';
import { compareOne, writeStatement } from './statements.ts';

type Handlers = { [M in DataMethod]: (...args: DataArgs<M>) => Promise<DataResult<M>> };

const codeOf = (err: unknown): DataErrorCode => (err instanceof ConnectionError ? 'connection' : 'failed');
const nameOf = (err: unknown): string => (err instanceof Error ? err.name.slice(0, 80) : 'Error');

export class DataHost {
  private readonly data: DataService;
  private readonly handlers: Handlers;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(d: DataServiceDeps) {
    const data = new DataService(d);
    const db = () => data.database();
    this.data = data;
    this.handlers = {
      monthOverview: (q) => data.monthOverview(q),
      spendingOverview: (q) => data.spendingOverview(q),
      nowOverview: (q) => data.nowOverview(q),
      categoryOverview: (q) => data.categoryOverview(q),
      incomeOverview: (q) => data.incomeOverview(q),
      recurringOverview: (q) => data.recurringOverview(q),
      allowanceOverview: (q) => data.allowanceOverview(q),
      analyticsOverview: (q) => data.analyticsOverview(q),
      setRecurringMark: (q) => data.setRecurringMark(q),
      addReserve: (r) => data.addReserve(r),
      updateReserve: (id, r) => data.updateReserve(id, r),
      deleteReserve: (id) => data.deleteReserve(id),
      status: () => data.status(),
      lastSyncSec: () => data.lastSyncSec(),
      tokenConnections: () => data.connections(),
      legacyConnection: () => data.legacyConnection(),
      people: async () => peopleRows(await db()),
      renameParticipant: async (id, label) => {
        await renameParticipant(await db(), id, label);
      },
      restoreBankName: async (id) => {
        await restoreBankLabel(await db(), id);
      },
      setParticipantColor: async (id, color) => participantColor(await db(), id, color),
      connections: async () => connectionList(await db()),
      createConnection: async (participant, provider, method) => createConnection(await db(), participant, provider, method, d.nowSec()),
      deleteConnection: async (id) => {
        await deleteConnection(await db(), id);
      },
      connectionAccounts: async (id) => connectionAccounts(await db(), id),
      setAccountEnabled: async (accountId, enabled) => {
        await setAccountEnabled(await db(), accountId, enabled);
      },
      compareStatement: async (id, statement, target) => compareOne(await db(), id, statement, target),
      commitStatement: async (id, statement, target) => writeStatement(await db(), id, statement, target, d.nowSec()),
    };
  }

  /** Opens the database and brings it up to date (migrate, refreshCrossing) before the first call. */
  async open(): Promise<void> {
    await this.data.database();
  }

  /** After the calls already queued. */
  close(): Promise<void> {
    return this.enqueue(() => this.data.close());
  }

  handle(call: CallMessage): Promise<DataReply> {
    return this.enqueue(() => this.run(call));
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async run(call: CallMessage): Promise<DataReply> {
    const parsed = DATA_ARG_SCHEMAS[call.method].safeParse(call.args);
    if (!parsed.success) return { type: 'failure', id: call.id, code: 'invalid', name: 'ZodError' };
    try {
      const handler = this.handlers[call.method] as (...args: unknown[]) => Promise<unknown>;
      return { type: 'result', id: call.id, value: await handler(...parsed.data) };
    } catch (err) {
      return { type: 'failure', id: call.id, code: codeOf(err), name: nameOf(err) };
    }
  }
}
