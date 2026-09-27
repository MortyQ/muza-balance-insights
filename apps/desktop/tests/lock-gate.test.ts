import { describe, expect, it } from 'vitest';
import { DB_STATE_CHANNEL, LOCK_CHANNEL, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL } from '../src/shared/channels.ts';
import { gatedPush } from '../src/main/lock/gate.ts';

const CHANNELS = [LOCK_CHANNEL, DB_STATE_CHANNEL, PROGRESS_CHANNEL, UPDATE_CHANNEL, OPEN_SETTINGS_CHANNEL];

describe('gatedPush', () => {
  it('open, database ready: everything goes through, payload as is', () => {
    const sent: unknown[][] = [];
    const push = gatedPush(() => false, () => true, (ch, p) => void sent.push([ch, p]));
    expect(push(PROGRESS_CHANNEL, { phase: 'idle' })).toBe(true);
    expect(push(OPEN_SETTINGS_CHANNEL)).toBe(true);
    expect(sent).toEqual([[PROGRESS_CHANNEL, { phase: 'idle' }], [OPEN_SETTINGS_CHANNEL, undefined]]);
  });

  // channel × lock × database: which pushes reach the renderer.
  it.each([
    [false, true, CHANNELS],
    [false, false, [LOCK_CHANNEL, DB_STATE_CHANNEL]],
    [true, true, [LOCK_CHANNEL]],
    [true, false, [LOCK_CHANNEL]],
  ] as const)('locked=%s dbReady=%s → only %j', (locked, dbReady, allowed) => {
    const sent: string[] = [];
    const push = gatedPush(() => locked, () => dbReady, (ch) => void sent.push(ch));
    expect(CHANNELS.map((ch) => push(ch, {}))).toEqual(CHANNELS.map((ch) => (allowed as readonly string[]).includes(ch)));
    expect(sent).toEqual(allowed);
  });
});
