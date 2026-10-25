// DataClient (src/main/data-client.ts) against a fake data process: the open message, calls held until ready and
// matched by id, rates sent ahead of a rated call only when they changed, a crash failing the calls in flight and the
// next call forking again, stop() waiting for the exit (and killing a process that hangs), and an unreadable database.
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { DataClient, STOP_KILL_MS, type DataChild, type DataClientDeps } from '../src/main/data-client.ts';
import { DataCallError, type ToData } from '../src/shared/data-protocol.ts';
import type { RatesView } from '../src/shared/api.ts';

const KEY = 'c0ffee'.padEnd(64, '0');

class FakeChild extends EventEmitter implements DataChild {
  sent: ToData[] = [];
  killed = false;
  constructor(private readonly opts: { exitOnKill?: boolean; exitOnClose?: boolean } = {}) {
    super();
  }
  postMessage(msg: ToData) {
    this.sent.push(msg);
    if (msg.type === 'close' && (this.opts.exitOnClose ?? true)) queueMicrotask(() => this.emit('exit', 0));
  }
  kill() {
    this.killed = true;
    if (this.opts.exitOnKill ?? true) queueMicrotask(() => this.emit('exit', 1));
    return true;
  }
  reply(msg: unknown) {
    this.emit('message', msg);
  }
  calls() {
    return this.sent.filter((m): m is Extract<ToData, { type: 'call' }> => m.type === 'call');
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function harness(opts: { db?: DataClientDeps['db']; child?: () => FakeChild; rates?: () => RatesView | null } = {}) {
  const children: FakeChild[] = [];
  const logs: string[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  let unreadable = 0;
  const client = new DataClient({
    fork: () => {
      const c = opts.child?.() ?? new FakeChild();
      children.push(c);
      return c;
    },
    db: opts.db ?? (() => ({ dbPath: '/x/monobank.db', dbKey: KEY })),
    rates: async () => (opts.rates ? opts.rates() : null),
    unreadable: () => void unreadable++,
    log: (m) => logs.push(m),
    setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length),
    clearTimeout: () => undefined,
  });
  return { client, children, logs, timers, unreadable: () => unreadable };
}

describe('DataClient', () => {
  it('forks once, opens with the path and the key, holds calls until ready, matches replies by id', async () => {
    const { client, children } = harness();
    const a = client.api.status();
    const b = client.api.people();
    await tick();
    expect(children).toHaveLength(1);
    const child = children[0]!;
    expect(child.sent[0]).toEqual({ type: 'open', dbPath: '/x/monobank.db', dbKey: KEY });
    expect(child.calls()).toHaveLength(0);
    child.reply({ type: 'ready' });
    await tick();
    const [ca, cb] = child.calls();
    expect([ca?.method, cb?.method]).toEqual(['status', 'people']);
    // Out of order: each reply still reaches its own call.
    child.reply({ type: 'result', id: cb!.id, value: [] });
    child.reply({ type: 'result', id: ca!.id, value: { hasData: false } });
    expect(await a).toEqual({ hasData: false });
    expect(await b).toEqual([]);
  });

  it('a reply to no call and a malformed message are dropped', async () => {
    const { client, children, logs } = harness();
    const p = client.api.status();
    await tick();
    const child = children[0]!;
    child.reply({ type: 'ready' });
    await tick();
    child.reply({ type: 'result', id: 999, value: 1 });
    child.reply({ type: 'result', id: 'x' });
    child.reply({ type: 'failure', id: child.calls()[0]!.id, code: 'connection', name: 'ConnectionError' });
    await expect(p).rejects.toMatchObject({ code: 'connection', name: 'ConnectionError' });
    expect(logs).toContain('data: dropped a reply to no call');
    expect(logs).toContain('data: dropped a malformed message');
  });

  it('a failure becomes a DataCallError with the code and the name', async () => {
    const { client, children } = harness();
    const p = client.api.renameParticipant(5, 'Хтось');
    await tick();
    children[0]!.reply({ type: 'ready' });
    await tick();
    children[0]!.reply({ type: 'failure', id: children[0]!.calls()[0]!.id, code: 'failed', name: 'TypeError' });
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DataCallError);
    expect(err).toMatchObject({ code: 'failed', name: 'TypeError' });
  });

  it('rates go ahead of a rated call, again only when they changed; other calls send none', async () => {
    let rates: RatesView | null = { list: [{ currency: 840, rate: 41 }], fetchedAt: 1, saved: false };
    const { client, children } = harness({ rates: () => rates });
    void client.api.status();
    await tick();
    const child = children[0]!;
    child.reply({ type: 'ready' });
    void client.api.monthOverview({ month: '2026-01' });
    void client.api.spendingOverview({ month: '2026-01', scope: 'personal' });
    await tick();
    rates = { list: [{ currency: 840, rate: 42 }], fetchedAt: 2, saved: false };
    void client.api.nowOverview({});
    await tick();
    expect(child.sent.map((m) => (m.type === 'call' ? m.method : m.type))).toEqual(['open', 'status', 'rates', 'monthOverview', 'spendingOverview', 'rates', 'nowOverview']);
    expect(child.sent.filter((m) => m.type === 'rates').map((m) => (m as { rates: RatesView }).rates.list[0]?.rate)).toEqual([41, 42]);
  });

  it('a crash: the calls in flight fail, and the next call forks a new process that gets the rates again', async () => {
    const rates: RatesView = { list: [{ currency: 840, rate: 41 }], fetchedAt: 1, saved: false };
    const { client, children } = harness({ rates: () => rates });
    const p = client.api.monthOverview({ month: '2026-01' });
    await tick();
    children[0]!.reply({ type: 'ready' });
    await tick();
    children[0]!.emit('exit', 1);
    await expect(p).rejects.toMatchObject({ code: 'failed', name: 'DataProcessExit' });
    const q = client.api.monthOverview({ month: '2026-01' });
    await tick();
    expect(children).toHaveLength(2);
    const next = children[1]!;
    next.reply({ type: 'ready' });
    await tick();
    expect(next.sent.map((m) => m.type)).toEqual(['open', 'rates', 'call']);
    next.reply({ type: 'result', id: next.calls()[0]!.id, value: { month: '2026-01' } });
    expect(await q).toEqual({ month: '2026-01' });
  });

  it('stop(): close, resolves on the exit; the next call forks again', async () => {
    const { client, children, timers } = harness();
    client.start();
    children[0]!.reply({ type: 'ready' });
    await client.stop();
    expect(children[0]!.sent.at(-1)).toEqual({ type: 'close' });
    expect(children[0]!.killed).toBe(false);
    expect(timers[0]?.ms).toBe(STOP_KILL_MS);
    void client.api.status();
    await tick();
    expect(children).toHaveLength(2);
  });

  it('stop() with a process that does not close: killed after the delay, and still waits for its exit', async () => {
    const { client, children, timers } = harness({ child: () => new FakeChild({ exitOnClose: false }) });
    client.start();
    let stopped = false;
    const stopping = client.stop().then(() => (stopped = true));
    await tick();
    expect(stopped).toBe(false);
    timers[0]!.fn();
    await stopping;
    expect(children[0]!.killed).toBe(true);
  });

  it('an unreadable database: the state is told, the calls fail, the process is killed', async () => {
    const h = harness();
    const p = h.client.api.status();
    await tick();
    h.children[0]!.reply({ type: 'open-failed', kind: 'unreadable', name: 'LibsqlError' });
    await expect(p).rejects.toMatchObject({ name: 'DataUnavailable' });
    expect(h.unreadable()).toBe(1);
    expect(h.children[0]!.killed).toBe(true);
  });

  it('a database that is not ready: nothing is forked, the call fails', async () => {
    const { client, children } = harness({ db: () => null });
    await expect(client.api.status()).rejects.toMatchObject({ name: 'DataUnavailable' });
    expect(children).toHaveLength(0);
  });
});
