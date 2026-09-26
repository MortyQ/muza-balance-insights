import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LockService, type LockDeps } from '../src/main/lock/service.ts';
import { KDF, hashPin } from '../src/main/lock/pin.ts';
import { LOCK_FILE, readLock, writeLock, type LockFile } from '../src/main/lock/store.ts';

let dir: string;
beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-svc-'))));
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function make(o: { touchId?: boolean; prompt?: boolean } = {}) {
  const clock = { now: 1_000_000 };
  const events: string[] = [];
  const deps: LockDeps = {
    userDataDir: dir,
    touchId: { available: () => o.touchId ?? false, prompt: async () => o.prompt ?? true },
    importRunning: () => false,
    now: () => clock.now,
    onLocked: () => void events.push('reload'),
    onChange: (v) => void events.push(v.locked ? 'locked' : 'open'),
    log: () => undefined,
  };
  return { svc: new LockService(deps), clock, events, deps };
}

describe('LockService', () => {
  it('off by default: not locked, lock() does nothing', () => {
    const { svc, events } = make();
    expect(svc.isLocked()).toBe(false);
    expect(svc.view()).toMatchObject({ enabled: false, locked: false, broken: false });
    svc.lock('manual');
    expect(svc.isLocked()).toBe(false);
    expect(events).toEqual([]);
  });

  it('enable: writes lock.json, stays open; Touch ID on only where available', async () => {
    const { svc } = make({ touchId: true });
    await svc.enable('2580');
    expect(svc.view()).toMatchObject({ enabled: true, locked: false, touchId: true });
    const read = readLock(dir);
    expect(read.kind).toBe('ok');
    expect(fs.readFileSync(path.join(dir, LOCK_FILE), 'utf8')).not.toContain('2580');
    await expect(svc.enable('1397')).rejects.toThrow();
  });

  it('a weak PIN is refused by main too', async () => {
    const { svc } = make();
    await expect(svc.enable('1234')).rejects.toThrow();
    expect(readLock(dir).kind).toBe('none');
  });

  it('lock → reload + change; the right PIN opens, the wrong one counts', async () => {
    const { svc, events } = make();
    await svc.enable('2580');
    svc.lock('manual');
    expect(svc.isLocked()).toBe(true);
    expect(events.slice(-2)).toEqual(['reload', 'locked']);
    expect(await svc.unlockWithPin('1111')).toEqual({ ok: false, reason: 'wrong-pin', retryAt: null });
    expect(svc.view().failedAttempts).toBe(1);
    expect(await svc.unlockWithPin('2580')).toEqual({ ok: true });
    expect(svc.isLocked()).toBe(false);
    expect(svc.view().failedAttempts).toBe(0);
  });

  it('5th wrong PIN → 30 s pause; during it even the right PIN is not checked; after it, it opens', async () => {
    const { svc, clock } = make();
    await svc.enable('2580');
    svc.lock('manual');
    for (let i = 0; i < 4; i++) await svc.unlockWithPin('1111');
    expect(await svc.unlockWithPin('1111')).toEqual({ ok: false, reason: 'wrong-pin', retryAt: clock.now + 30_000 });
    expect(await svc.unlockWithPin('2580')).toEqual({ ok: false, reason: 'wait', retryAt: clock.now + 30_000 });
    clock.now += 30_000;
    expect(await svc.unlockWithPin('2580')).toEqual({ ok: true });
  });

  it('the counter survives a restart (a new service over the same folder)', async () => {
    const first = make();
    await first.svc.enable('2580');
    first.svc.lock('manual');
    for (let i = 0; i < 5; i++) await first.svc.unlockWithPin('1111');
    const second = make();
    expect(second.svc.isLocked()).toBe(true);
    expect(second.svc.view()).toMatchObject({ failedAttempts: 5, retryAt: first.clock.now + 30_000 });
  });

  it('triggers: a switched-off trigger does not lock, manual always does', async () => {
    const { svc } = make();
    await svc.enable('2580');
    await svc.setTriggers({ startup: true, idle: false, screenLock: true, sleep: true });
    svc.lock('idle');
    expect(svc.isLocked()).toBe(false);
    svc.lock('screenLock');
    expect(svc.isLocked()).toBe(true);
  });

  it('startup trigger: a new service starts locked only when it is on', async () => {
    const a = make();
    await a.svc.enable('2580');
    expect(make().svc.isLocked()).toBe(true);
    await a.svc.setTriggers({ startup: false, idle: true, screenLock: true, sleep: true });
    expect(make().svc.isLocked()).toBe(false);
  });

  it('broken lock.json: locked, no way in but reset()', async () => {
    fs.writeFileSync(path.join(dir, LOCK_FILE), '{oops');
    const { svc } = make();
    expect(svc.view()).toMatchObject({ enabled: true, locked: true, broken: true });
    expect(await svc.unlockWithPin('2580')).toEqual({ ok: false, reason: 'unavailable' });
    svc.reset();
    expect(svc.view()).toMatchObject({ enabled: false, locked: false, broken: false });
  });

  it('Touch ID: opens and clears the counter; cancelled → stays locked; unavailable when switched off', async () => {
    const ok = make({ touchId: true, prompt: true });
    await ok.svc.enable('2580');
    ok.svc.lock('manual');
    await ok.svc.unlockWithPin('1111');
    expect(await ok.svc.unlockWithTouchId()).toEqual({ ok: true });
    expect(ok.svc.view().failedAttempts).toBe(0);

    fs.rmSync(path.join(dir, LOCK_FILE));
    const no = make({ touchId: true, prompt: false });
    await no.svc.enable('2580');
    no.svc.lock('manual');
    expect(await no.svc.unlockWithTouchId()).toEqual({ ok: false, reason: 'cancelled' });
    await no.svc.unlockWithPin('2580');
    await no.svc.setTouchId(false);
    no.svc.lock('manual');
    expect(await no.svc.unlockWithTouchId()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('changePin needs the current PIN; disable removes lock.json', async () => {
    const { svc } = make();
    await svc.enable('2580');
    expect(await svc.changePin('1111', '1397')).toMatchObject({ ok: false, reason: 'wrong-pin' });
    expect(await svc.changePin('2580', '1397')).toEqual({ ok: true });
    svc.lock('manual');
    expect(await svc.unlockWithPin('2580')).toMatchObject({ ok: false });
    expect(await svc.unlockWithPin('1397')).toEqual({ ok: true });
    expect(await svc.disable({ pin: '0000' })).toMatchObject({ ok: false, reason: 'wrong-pin' });
    expect(await svc.disable({ pin: '1397' })).toEqual({ ok: true });
    expect(readLock(dir).kind).toBe('none');
    expect(svc.view().enabled).toBe(false);
  });

  it('concurrent wrong PINs are checked one after another (no race past the pause)', async () => {
    const { svc } = make();
    await svc.enable('2580');
    svc.lock('manual');
    await Promise.all(Array.from({ length: 7 }, () => svc.unlockWithPin('1111')));
    expect(svc.view().failedAttempts).toBe(5);
  });

  it('a huge nextAttemptAt (tampered lock.json) is clamped to now + 15 min', async () => {
    const record = await hashPin('2580');
    const clock = { now: 1_000_000 };
    const file: LockFile = {
      version: 1,
      hash: record.hash,
      kdf: { ...KDF, salt: record.kdf.salt },
      touchId: false,
      triggers: { startup: true, idle: true, screenLock: true, sleep: true },
      failedAttempts: 5,
      nextAttemptAt: clock.now + 10 * 24 * 60 * 60 * 1000,
    };
    await writeLock(dir, file);
    const events: string[] = [];
    const deps: LockDeps = {
      userDataDir: dir,
      touchId: { available: () => false, prompt: async () => true },
      importRunning: () => false,
      now: () => clock.now,
      onLocked: () => void events.push('reload'),
      onChange: (v) => void events.push(v.locked ? 'locked' : 'open'),
      log: () => undefined,
    };
    const svc = new LockService(deps);
    expect(svc.view().retryAt).toBe(clock.now + 900_000);
    expect(await svc.unlockWithPin('2580')).toEqual({ ok: false, reason: 'wait', retryAt: clock.now + 900_000 });
  });
});
