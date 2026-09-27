import type { DbStateView } from '@contract/db-state.ts';

export const KEY_STORE: Record<DbStateView['platform'], string> = {
  darwin: 'в Связке ключей macOS',
  win32: 'в хранилище Windows (DPAPI)',
  linux: 'в связке ключей (keyring)',
  other: 'в системном хранилище ключей',
};

export const NO_SECURE_STORAGE =
  'База не зашифрована: на этом компьютере нет надёжного хранилища ключей (keyring). Когда оно появится, приложение ' +
  'зашифрует базу при следующем запуске. По той же причине токены хранятся только в памяти.';

export const ENCRYPT_PENDING = 'Зашифровать базу не удалось — приложение попробует при следующем запуске.';

/** What encryption does and does not cover. Nothing about detecting changes to the file: the cipher cannot. */
export const SCOPE_NOTE =
  'Шифрование защищает копию файлов: на другом компьютере, в другой учётной записи, в резервной копии или облаке базу ' +
  'не открыть. Программы, запущенные под твоей учётной записью, ключ получить могут — для этого есть блокировка и ' +
  'шифрование диска.';
