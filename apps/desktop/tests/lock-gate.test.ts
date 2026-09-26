import { describe, expect, it } from 'vitest';
import { LOCK_CHANNEL, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL } from '../src/shared/channels.ts';
import { gatedPush } from '../src/main/lock/gate.ts';

describe('gatedPush', () => {
  it('open: everything goes through', () => {
    const sent: unknown[][] = [];
    const push = gatedPush(() => false, (ch, p) => void sent.push([ch, p]));
    expect(push(PROGRESS_CHANNEL, { phase: 'idle' })).toBe(true);
    expect(push(OPEN_SETTINGS_CHANNEL)).toBe(true);
    expect(sent).toEqual([[PROGRESS_CHANNEL, { phase: 'idle' }], [OPEN_SETTINGS_CHANNEL, undefined]]);
  });

  it('locked: only the lock view; progress, the update view and «Настройки…» are dropped', () => {
    const sent: string[] = [];
    const push = gatedPush(() => true, (ch) => void sent.push(ch));
    expect([PROGRESS_CHANNEL, UPDATE_CHANNEL, OPEN_SETTINGS_CHANNEL].map((ch) => push(ch, {}))).toEqual([false, false, false]);
    expect(push(LOCK_CHANNEL, { locked: true })).toBe(true);
    expect(sent).toEqual([LOCK_CHANNEL]);
  });
});
