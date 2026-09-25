// Main-side orchestration with a fake worker: job file (resume), powerSaveBlocker, cancel, progress validation, token.
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kyivStartOfDay } from '@mono/core/format';
import { CANCEL_KILL_MS, CRASH_GIVE_UP_MESSAGE, Importer, JOB_FILE, sinceForDepth, type ChildLike } from '../src/main/importer.ts';
import { RETRY_BUDGET_MS } from '../src/shared/retry.ts';
import type { ToWorker } from '../src/shared/import-protocol.ts';
import type { ImportProgress } from '../src/shared/progress.ts';

const TOKEN = 'uCANARY-importer-token-0123456789';
const NOW = kyivStartOfDay('2026-03-31') + 15 * 3600; // 31 March, 15:00 Kyiv

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'importer-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

class FakeChild extends EventEmitter implements ChildLike {
  sent: ToWorker[] = [];
  killed = false;
  postMessage(msg: ToWorker) {
    this.sent.push(msg);
  }
  kill() {
    this.killed = true;
    this.emit('exit', 0);
    return true;
  }
  reply(msg: unknown) {
    this.emit('message', msg);
  }
  exit() {
    this.emit('exit', 0);
  }
}

function setup(opts: { token?: string | null; stored?: 'secure' | 'memory' | null } = {}) {
  const children: FakeChild[] = [];
  const sent: ImportProgress[] = [];
  const logs: string[] = [];
  const blocker = { started: [] as string[], stopped: [] as number[], next: 1 };
  const timers: Array<() => void> = [];
  const clock = { now: NOW };
  const token = opts.token === undefined ? TOKEN : opts.token;
  const importer = new Importer({
    fork: () => {
      const c = new FakeChild();
      children.push(c);
      return c;
    },
    tokens: { get: async () => token, status: async () => ({ stored: opts.stored ?? (token ? 'secure' : null) }) },
    powerSaveBlocker: {
      start: (t) => (blocker.started.push(t), blocker.next++),
      stop: (id) => void blocker.stopped.push(id),
    },
    userDataDir: dir,
    dbPath: path.join(dir, 'monobank.db'),
    nowSec: () => clock.now,
    send: (p) => sent.push(p),
    log: (m) => logs.push(m),
    setTimeout: (fn) => (timers.push(fn), timers.length),
    clearTimeout: () => undefined,
  });
  return { importer, children, sent, logs, blocker, timers, clock };
}

const job = () => path.join(dir, JOB_FILE);

describe('sinceForDepth (Kyiv days, month clamp)', () => {
  it.each([
    [1, '2026-02-28'], // 31 Mar − 1 month → end of February
    [3, '2025-12-31'],
    [12, '2025-03-31'],
    [24, '2024-03-31'],
  ] as const)('%i month(s) before 31 Mar 2026 → %s 00:00 Kyiv', (depth, date) => {
    expect(sinceForDepth(depth, NOW)).toBe(kyivStartOfDay(date));
  });
});

describe('Importer', () => {
  it('start: job file, powerSaveBlocker, a fresh worker, the token only in the start message', async () => {
    const { importer, children, sent, blocker, logs } = setup();
    expect(await importer.start(3)).toEqual({ started: true });
    expect(JSON.parse(fs.readFileSync(job(), 'utf8'))).toEqual({ sinceSec: kyivStartOfDay('2025-12-31'), depth: 3, startedAt: NOW });
    expect(blocker.started).toEqual(['prevent-app-suspension']);
    expect(children).toHaveLength(1);
    expect(children[0]!.sent).toEqual([{ type: 'start', dbPath: path.join(dir, 'monobank.db'), token: TOKEN, sinceSec: kyivStartOfDay('2025-12-31') }]);
    expect(sent).toEqual([{ phase: 'starting', resumed: false }]);
    expect(JSON.stringify({ sent, logs, job: fs.readFileSync(job(), 'utf8') })).not.toContain(TOKEN);
  });

  it('forwards valid progress, drops malformed messages (logged, not forwarded)', async () => {
    const { importer, children, sent, logs } = setup();
    await importer.start(1);
    const c = children[0]!;
    c.reply({ type: 'progress', progress: { phase: 'accounts' } });
    c.reply({ type: 'progress', progress: { phase: 'accounts', token: TOKEN } }); // extra key → strict schema rejects
    c.reply({ type: 'whatever' });
    c.reply('not an object');
    expect(sent).toEqual([{ phase: 'starting', resumed: false }, { phase: 'accounts' }]);
    expect(logs.filter((l) => l.includes('malformed'))).toHaveLength(3);
    expect(JSON.stringify(sent)).not.toContain(TOKEN);
  });

  it('done → job removed, blocker stopped, "done" sent', async () => {
    const { importer, children, sent, blocker } = setup();
    await importer.start(1);
    children[0]!.reply({ type: 'done', windowsTotal: 2, transactions: 10 });
    children[0]!.exit();
    expect(fs.existsSync(job())).toBe(false);
    expect(blocker.stopped).toEqual([1]);
    expect(sent.at(-1)).toEqual({ phase: 'done', windowsTotal: 2, transactions: 10 });
    expect(importer.running).toBe(false);
  });

  it('a non-cancel error keeps the job for the next launch; blocker stopped', async () => {
    const { importer, children, sent, blocker } = setup();
    await importer.start(1);
    children[0]!.reply({ type: 'error', kind: 'network', message: 'Нет связи с Monobank.' });
    children[0]!.exit();
    expect(fs.existsSync(job())).toBe(true);
    expect(blocker.stopped).toEqual([1]);
    expect(sent.at(-1)).toEqual({ phase: 'error', message: 'Нет связи с Monobank.' });
  });

  it('the final message closes the worker from main (no reliance on the worker exiting); exit code logged', async () => {
    const { importer, children, sent, logs } = setup();
    await importer.start(1);
    children[0]!.reply({ type: 'log', message: 'error: MonoApiError status=502' });
    children[0]!.reply({ type: 'error', kind: 'other', message: 'Monobank ответил 502.' });
    expect(children[0]!.killed).toBe(true);
    expect(sent.at(-1)).toEqual({ phase: 'error', message: 'Monobank ответил 502.' });
    expect(logs).toEqual(['import: error: MonoApiError status=502', 'import: worker exit code=0']);
    children[0]!.reply({ type: 'done', windowsTotal: 1, transactions: 1 }); // late messages are ignored
    expect(sent.at(-1)).toMatchObject({ phase: 'error' });
    expect(importer.running).toBe(false);
  });

  it('worker dies without a word → "retry: crash", blocker stopped, job kept; restarted with the same job', async () => {
    const { importer, children, sent, blocker, timers, logs } = setup();
    await importer.start(1);
    children[0]!.exit();
    expect(sent.at(-1)).toEqual({ phase: 'retry', reason: 'crash', attempt: 1, inSec: 60 });
    expect(fs.existsSync(job())).toBe(true);
    expect(blocker.stopped).toEqual([1]);
    expect(importer.running).toBe(true); // a restart is pending: «Загрузить» stays unavailable
    expect(await importer.start(3)).toEqual({ started: false, reason: 'running' });
    expect(logs).toContain('import: worker died, restart 1 in 60 s');

    timers.at(-1)!();
    await new Promise((r) => setTimeout(r, 0));
    expect(children).toHaveLength(2);
    expect(children[1]!.sent[0]).toMatchObject({ type: 'start', sinceSec: children[0]!.sent[0]!.type === 'start' ? children[0]!.sent[0]!.sinceSec : -1 });
    expect(sent.at(-1)).toEqual({ phase: 'starting', resumed: true });
  });

  it('crashes keep happening: 1 min, then every 15 min, error after 4 hours; a committed window resets the streak', async () => {
    const { importer, children, sent, timers, clock } = setup();
    await importer.start(1);
    const crash = async () => {
      children.at(-1)!.exit();
      const p = sent.at(-1)!;
      if (p.phase !== 'retry') return p;
      clock.now += p.inSec;
      timers.at(-1)!();
      await new Promise((r) => setTimeout(r, 0));
      return p;
    };
    // A window committed between crashes → the streak starts over.
    expect(await crash()).toMatchObject({ attempt: 1, inSec: 60 });
    expect(await crash()).toMatchObject({ attempt: 2, inSec: 900 });
    children.at(-1)!.reply({ type: 'progress', progress: { phase: 'windows', account: 'black/UAH', from: '2026-03-01', to: '2026-03-31', round: 1, index: 1, total: 1, windowsDone: 1, windowsTotal: 2, transactions: 3, etaSec: 60, waitingSec: null } });
    expect(await crash()).toMatchObject({ attempt: 1, inSec: 60 });

    let last: ImportProgress;
    let waited = 0;
    for (let i = 0; ; i++) {
      last = await crash();
      if (last.phase !== 'retry') break;
      waited += last.inSec * 1000;
      expect(i).toBeLessThan(40);
    }
    expect(last).toEqual({ phase: 'error', message: CRASH_GIVE_UP_MESSAGE });
    expect(60_000 + waited).toBeLessThanOrEqual(RETRY_BUDGET_MS);
    expect(fs.existsSync(job())).toBe(true); // the next launch resumes
    expect(importer.running).toBe(false);
  });

  it('sleep of the Mac during a restart pause is not counted: as many restarts as without it', async () => {
    const attemptsUntilGiveUp = async (sleepMs: number) => {
      const { importer, children, sent, timers, clock } = setup();
      await importer.start(1);
      let n = 0;
      for (;;) {
        children.at(-1)!.exit();
        const p = sent.at(-1)!;
        if (p.phase !== 'retry') return n;
        n += 1;
        clock.now += p.inSec + (n === 3 ? sleepMs / 1000 : 0); // the Mac slept through the 3rd pause
        timers.at(-1)!();
        await new Promise((r) => setTimeout(r, 0));
        expect(n).toBeLessThan(40);
      }
    };
    const awake = await attemptsUntilGiveUp(0);
    expect(await attemptsUntilGiveUp(3 * 3600_000)).toBe(awake);
  });

  it('stop() (delete all data): kills the worker at once, waits for its exit, drops the job, no restart', async () => {
    const { importer, children, sent, timers } = setup();
    await importer.start(1);
    expect(fs.existsSync(job())).toBe(true);
    await importer.stop();
    expect(children[0]!.killed).toBe(true);
    expect(children[0]!.sent.map((m) => m.type)).toEqual(['start']); // no cooperative cancel: killed outright
    expect(importer.running).toBe(false);
    expect(fs.existsSync(job())).toBe(false);
    expect(timers).toHaveLength(0);
    expect(sent.at(-1)).toEqual({ phase: 'idle' });
  });

  it('stop() while a crash restart is pending → the restart never happens', async () => {
    const { importer, children, timers, sent } = setup();
    await importer.start(1);
    children[0]!.exit();
    expect(importer.running).toBe(true);
    await importer.stop();
    expect(importer.running).toBe(false);
    expect(fs.existsSync(job())).toBe(false);
    expect(sent.at(-1)).toEqual({ phase: 'idle' });
    expect(timers).toHaveLength(1); // the restart timer was cleared (a real clearTimeout drops it)
  });

  it('stop() with nothing running is a no-op apart from the idle state', async () => {
    const { importer, sent } = setup();
    await importer.stop();
    expect(sent).toEqual([{ phase: 'idle' }]);
  });

  it('«Остановить» while a restart is pending → cancelled, job removed, no restart', async () => {
    const { importer, children, sent, timers } = setup();
    await importer.start(1);
    children[0]!.exit();
    importer.cancel();
    expect(sent.at(-1)).toEqual({ phase: 'cancelled' });
    expect(fs.existsSync(job())).toBe(false);
    expect(importer.running).toBe(false);
    expect(timers).toHaveLength(1); // only the restart timer; a real clearTimeout drops it
  });

  it('app quit is not a crash: no restart, job kept; a pending restart is dropped', async () => {
    const a = setup();
    await a.importer.start(1);
    a.importer.shutdown();
    expect(a.sent.at(-1)).toEqual({ phase: 'starting', resumed: false });
    expect(a.children[0]!.killed).toBe(true);
    expect(fs.existsSync(job())).toBe(true);
    expect(a.importer.running).toBe(false);
    fs.rmSync(job(), { force: true });

    const b = setup();
    await b.importer.start(1);
    b.children[0]!.exit(); // crash → restart pending
    b.importer.shutdown();
    expect(b.importer.running).toBe(false);
    expect(fs.existsSync(job())).toBe(true);
  });

  it('cancel: cooperative first; the job ends; if the worker hangs it is killed after 10 s', async () => {
    const { importer, children, sent, timers } = setup();
    await importer.start(1);
    importer.cancel();
    importer.cancel(); // idempotent
    expect(children[0]!.sent.at(-1)).toEqual({ type: 'cancel' });
    expect(children[0]!.sent.filter((m) => m.type === 'cancel')).toHaveLength(1);
    expect(timers).toHaveLength(1);
    expect(CANCEL_KILL_MS).toBe(10_000);
    timers[0]!(); // 10 s later, no exit yet
    expect(children[0]!.killed).toBe(true);
    expect(sent.at(-1)).toEqual({ phase: 'cancelled' });
    expect(fs.existsSync(job())).toBe(false);
  });

  it('cancel acknowledged by the worker → "cancelled", job removed', async () => {
    const { importer, children, sent } = setup();
    await importer.start(1);
    importer.cancel();
    children[0]!.reply({ type: 'error', kind: 'cancelled', message: 'Импорт остановлен' });
    children[0]!.exit();
    expect(sent.at(-1)).toEqual({ phase: 'cancelled' });
    expect(fs.existsSync(job())).toBe(false);
  });

  it('one import at a time; no token → nothing starts', async () => {
    const a = setup();
    await a.importer.start(1);
    expect(await a.importer.start(3)).toEqual({ started: false, reason: 'running' });
    expect(a.children).toHaveLength(1);
    fs.rmSync(job(), { force: true }); // a's job; b shares the temp folder

    const b = setup({ token: null });
    expect(await b.importer.start(1)).toEqual({ started: false, reason: 'no-token' });
    expect(b.children).toHaveLength(0);
    expect(fs.existsSync(job())).toBe(false);
    expect(b.blocker.started).toEqual([]);
  });

  it('resume on launch: token in secure storage → continues with the saved sinceSec (not recomputed)', async () => {
    fs.writeFileSync(job(), JSON.stringify({ sinceSec: 1_700_000_000, depth: 12, startedAt: 1_700_000_000 }));
    const { importer, children, sent } = setup({ stored: 'secure' });
    await importer.resumeOnLaunch();
    expect(children[0]!.sent[0]).toMatchObject({ type: 'start', sinceSec: 1_700_000_000 });
    expect(sent).toEqual([{ phase: 'starting', resumed: true }]);
  });

  it('resume on launch: token only in memory (i.e. gone after restart) → the UI is asked for it, nothing starts', async () => {
    fs.writeFileSync(job(), JSON.stringify({ sinceSec: 1_700_000_000, depth: 3, startedAt: 1 }));
    const { importer, children, sent } = setup({ token: null, stored: null });
    await importer.resumeOnLaunch();
    expect(children).toHaveLength(0);
    expect(sent).toEqual([{ phase: 'needs-token' }]);
    expect(importer.lastProgress).toEqual({ phase: 'needs-token' });
  });

  it('resume on launch: automatic only from secure storage — a token held in memory does not count', async () => {
    fs.writeFileSync(job(), JSON.stringify({ sinceSec: 1_700_000_000, depth: 3, startedAt: 1 }));
    const { importer, children, sent } = setup({ token: TOKEN, stored: 'memory' });
    await importer.resumeOnLaunch();
    expect(children).toHaveLength(0);
    expect(sent).toEqual([{ phase: 'needs-token' }]);
  });

  it('no job or a corrupted job file → nothing happens', async () => {
    const a = setup();
    await a.importer.resumeOnLaunch();
    expect(a.children).toHaveLength(0);
    fs.writeFileSync(job(), '{not json');
    await a.importer.resumeOnLaunch();
    fs.writeFileSync(job(), JSON.stringify({ sinceSec: 'x' }));
    await a.importer.resumeOnLaunch();
    expect(a.children).toHaveLength(0);
    expect(a.sent).toEqual([]);
  });

  it('shutdown (app quit) kills the worker and keeps the job for resume', async () => {
    const { importer, children } = setup();
    await importer.start(1);
    importer.shutdown();
    expect(children[0]!.killed).toBe(true);
    expect(fs.existsSync(job())).toBe(true);
  });
});
