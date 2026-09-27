import type { UpdateState } from '@contract/update.ts';

/** The status line in settings. */
export function updateLine(s: Readonly<UpdateState>): string {
  switch (s.phase) {
    case 'idle':
      return '';
    case 'checking':
      return 'Проверяю…';
    case 'up-to-date':
      return 'Установлена последняя версия.';
    case 'available':
      return `Доступна версия ${s.version}.`;
    case 'downloading':
      return `Скачиваю ${s.version}… ${s.percent}%`;
    case 'ready':
      return `Версия ${s.version} скачана и проверена — установится при перезапуске.`;
    case 'saved':
      return `Версия ${s.version} скачана и проверена: «${s.fileName}» в папке «Загрузки».`;
    case 'error':
      return s.message;
  }
  return '';
}
