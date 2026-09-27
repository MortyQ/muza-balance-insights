import type { DbStateView } from '@contract/db-state.ts';
import type { RecoveryAction } from './types.ts';

type NotReady = Exclude<DbStateView['status'], 'ready'>;

export const TITLES: Record<NotReady, string> = {
  'key-unavailable': 'Нет доступа к ключу базы',
  'key-lost': 'Ключ базы потерян',
  'db-unreadable': 'База не открывается',
};

/** key-unavailable depends on where the key lives; neutral wording, no advice to press «Всегда разрешать». */
export const UNAVAILABLE_DETAIL: Record<DbStateView['platform'], string> = {
  darwin: 'Разрешите доступ в запросе Связки ключей — он появится после перезапуска.',
  linux: 'Разблокируйте связку ключей (keyring) и перезапустите приложение.',
  win32: 'Системное хранилище ключей не ответило. Перезапустите приложение.',
  other: 'Системное хранилище ключей не ответило. Перезапустите приложение.',
};

export const DETAILS: Record<Exclude<NotReady, 'key-unavailable'>, string> = {
  'key-lost':
    'Ключ, которым зашифрована база, больше не читается (переустановка без подписи, удалённая запись в Связке ключей, ' +
    'перенос на другой компьютер). Открыть эту базу нельзя.',
  'db-unreadable': 'Файл базы повреждён или зашифрован другим ключом.',
};

export const START_OVER_HINT =
  '«Начать заново» создаст новую пустую базу: операции загрузятся из банка заново, сохранённые токены останутся, если их ' +
  'удастся прочитать. Имена людей, оверрайды и настройки пропадут.';

export const ACTION_TEXT: Record<RecoveryAction, string> = {
  relaunch: 'Перезапустить',
  startOver: 'Начать заново',
  delete: 'Удалить все данные',
  quit: 'Выйти',
};

export const ACTION_ERROR = 'Не получилось. Перезапустите приложение и попробуйте ещё раз.';
