// «Автообновление» in the renderer: the quiet line of an automatic refresh, the store's `auto` flag, the switch labels.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTO_SYNC_TRIGGERS } from '@contract/auto-sync.ts';
import type { ImportProgress } from '@contract/progress.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { TRIGGER_LABELS } from '@/features/auto-sync-settings/constants.ts';
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
