import type { StartImportResult } from '@contract/progress.ts';

export const START_ERRORS: Record<Extract<StartImportResult, { started: false }>['reason'], string> = {
  'no-token': 'Нет ни одного токена: введи его в настройках, «Люди и подключения».',
  running: 'Импорт уже идёт.',
  'db-unavailable': 'База сейчас недоступна — импорт не запустился.',
};
