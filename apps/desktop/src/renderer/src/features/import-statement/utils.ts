import type { ImportProgress } from '@contract/progress.ts';

export function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec} с`;
  const m = Math.round(sec / 60);
  return m < 60 ? `≈ ${m} мин` : `≈ ${Math.floor(m / 60)} ч ${m % 60} мин`;
}

const RETRY_REASON = {
  network: 'Нет связи с Monobank',
  server: 'Monobank временно не отвечает',
  'rate-limit': 'Monobank просит подождать',
  crash: 'Процесс импорта перезапускается',
} as const satisfies Record<Extract<ImportProgress, { phase: 'retry' }>['reason'], string>;

/** One line under the import controls; `now` is passed in so the retry time is testable. */
export function progressLine(p: Readonly<ImportProgress>, now: number): string {
  switch (p.phase) {
    case 'idle':
      return '';
    case 'needs-token':
      return 'Есть незавершённый импорт. Подключи банк, чтобы продолжить.';
    case 'starting':
      return p.resumed ? 'Продолжаю импорт…' : 'Запускаю импорт…';
    case 'accounts':
      return 'Обновляю список счетов…';
    case 'windows': {
      const wait = p.waitingSec ? ` · жду лимит Monobank ${p.waitingSec} с` : '';
      return `${p.account}: окно ${p.from} … ${p.to} (${p.index}/${p.total}) · загружено окон ${p.windowsDone} из ${p.windowsTotal}, операций ${p.transactions} · осталось ${fmtDuration(p.etaSec)}${wait}`;
    }
    case 'retry': {
      const at = new Date(now + p.inSec * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `${RETRY_REASON[p.reason]}. Повтор в ${at} (попытка ${p.attempt}). Уже загруженное сохранено.`;
    }
    case 'rederive':
      return 'Размечаю переводы и категории…';
    case 'done':
      return `Готово: окон ${p.windowsTotal}, операций ${p.transactions}.`;
    case 'cancelled':
      return 'Импорт остановлен. Уже загруженное сохранено.';
    case 'error':
      return p.message;
  }
  return '';
}

/** Share of windows done, or null when there is no bar to show. */
export function windowsPercent(p: Readonly<ImportProgress>): number | null {
  return p.phase === 'windows' && p.windowsTotal > 0 ? (p.windowsDone / p.windowsTotal) * 100 : null;
}
