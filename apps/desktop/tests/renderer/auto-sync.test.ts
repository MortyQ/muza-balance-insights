// «Автообновление» in the renderer: the quiet line of an automatic refresh, the store's `auto` flag, the switch labels.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { AUTO_SYNC_TRIGGERS, DEFAULT_AUTO_SYNC, type AutoSyncSettings } from '@contract/auto-sync.ts';
import type { ImportProgress } from '@contract/progress.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { TRIGGER_LABELS } from '@/features/settings/auto-sync/constants.ts';
import { withChange } from '@/features/settings/auto-sync/utils.ts';
import { autoLine, failureLines, progressLine } from '@/features/import-statement/utils.ts';

const NOW = Date.UTC(2026, 8, 27, 9, 0);
const windows: ImportProgress = {
  phase: 'windows', account: 'black/UAH', from: '2026-08-27', to: '2026-09-27', round: 1, index: 1, total: 1,
  windowsDone: 0, windowsTotal: 3, transactions: 0, etaSec: 180, waitingSec: null, auto: true,
};

beforeEach(() => setActivePinia(createPinia()));

describe('autoLine', () => {
  it('while it runs: one quiet line, no windows, dates or counts', () => {
    for (const p of [{ phase: 'starting', resumed: false, auto: true }, { phase: 'accounts', auto: true }, windows, { phase: 'rederive', auto: true }] as ImportProgress[]) {
      expect(autoLine(p, NOW)).toBe('Обновляю данные…');
    }
  });

  it('a wait for the network is shown as for a user import; an error by its message', () => {
    const retry: ImportProgress = { phase: 'retry', reason: 'network', attempt: 1, inSec: 60, auto: true };
    expect(autoLine(retry, NOW)).toBe(progressLine(retry, NOW));
    expect(autoLine({ phase: 'error', message: 'Сбой', auto: true }, NOW)).toBe('Сбой');
  });

  it('once over: no «Готово» line; a connection that did not import still shows', () => {
    const done: ImportProgress = { phase: 'done', windowsTotal: 3, transactions: 5, failed: [{ connectionId: 2, message: 'Токен не принят' }], auto: true };
    expect(autoLine(done, NOW)).toBe('');
    expect(autoLine({ phase: 'cancelled', auto: true }, NOW)).toBe('');
    expect(autoLine({ phase: 'idle' }, NOW)).toBe('');
    expect(failureLines(done, (id) => `Люди ${id}`)).toEqual(['Люди 2: Токен не принят']);
  });
});

describe('import-progress store', () => {
  it('auto follows the latest state; running stays true for an automatic refresh', () => {
    const s = useImportProgressStore();
    expect(s.auto).toBe(false);
    s.set(windows);
    expect([s.auto, s.running]).toEqual([true, true]);
    s.set({ phase: 'starting', resumed: false });
    expect([s.auto, s.running]).toEqual([false, true]);
  });
});

describe('«Автообновление» card', () => {
  it('a label for every trigger', () => {
    expect(Object.keys(TRIGGER_LABELS).sort()).toEqual([...AUTO_SYNC_TRIGGERS].sort());
  });
});

describe('withChange: what goes to setAutoSync', () => {
  // The screen keeps the settings in a ref (a deep proxy); IPC clones its argument the way structuredClone does.
  const held = () => ref<AutoSyncSettings>(structuredClone(DEFAULT_AUTO_SYNC)).value;

  it('the main switch and each trigger give a plain object IPC can clone', () => {
    expect(() => structuredClone({ ...held(), enabled: false })).toThrow(); // the bug it replaces
    const off = withChange(held(), { enabled: false });
    expect(structuredClone(off)).toEqual({ ...DEFAULT_AUTO_SYNC, enabled: false });
    for (const t of AUTO_SYNC_TRIGGERS) {
      const next = withChange(held(), { trigger: t, on: false });
      expect(structuredClone(next)).toEqual({ enabled: true, triggers: { ...DEFAULT_AUTO_SYNC.triggers, [t]: false } });
    }
  });

  it('leaves what it was given as it was', () => {
    const s = held();
    withChange(s, { enabled: false });
    withChange(s, { trigger: 'wake', on: false });
    expect(structuredClone({ enabled: s.enabled, triggers: { ...s.triggers } })).toEqual(DEFAULT_AUTO_SYNC);
  });
});
