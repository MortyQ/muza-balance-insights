# Десктоп: защита — CSP, fuses, сеть, блокировка, шифрование базы, удаление данных

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/desktop.

- CSP в dev ослаблена только для HMR (`connect-src ws://localhost:<порт>`, `style-src 'unsafe-inline'`),
  prod — ровно `default-src 'self'; script-src 'self'; connect-src 'none'` (+ `object-src`/`base-uri`/`form-action`/
  `frame-ancestors 'none'`).
- Fuses и локальная сборка `electron-builder --dir` в этапе 1, тест по бинарнику.
- «Удалить все данные» (`apps/desktop/src/main/wipe.ts`): системный диалог → токены → ключ базы (`db-key.bin`: база, которая
  не удалится, уже нечитаема) → остановка worker (`Importer.stop`, kill + ожидание выхода) → закрытие соединения → файлы
  `APP_FILES` (база с WAL, копия `.encrypting`, старый `token.bin`, задача импорта) и папки `APP_DIRS` (`tokens/`). Файлы блокировки (`lock.json`) удаляются последними: сбой посередине не оставит данные без замка.
- **Блокировка приложения** (0.1.4, спека `docs/superpowers/specs/2026-09-26-app-lock-design.md`): выкл. по умолчанию;
  PIN 4–8 цифр (без одинаковых и подряд, `pinProblem` в `src/shared/lock.ts`) на всех ОС + Touch ID на macOS
  (`promptTouchID`, системный диалог сам предлагает пароль Mac). Windows Hello нет (нужен нативный модуль). Замок — UI,
  не шифрование. Всё в `src/main/lock/`: scrypt-хеш, `lock.json` (0600, повреждён → заблокировано навсегда, выход —
  «Удалить все данные»), паузы 5 ошибок → 30 с / 1 / 5 / 15 мин (счётчик на диске). Триггеры — переключатели, все вкл.:
  запуск, 60 мин системного простоя, блокировка экрана, сон; плюс «Заблокировать» `CmdOrCtrl+L`.
  Под замком `registerIpc` пропускает только `ALLOWED_WHEN_LOCKED` (`getLockState`, `unlockWithPin`, `unlockWithTouchId`,
  `deleteAllData`), push — только `balance:lock` (`gatedPush`, единственный путь `webContents.send` в `index.ts` —
  проверяет `tests/window.test.ts`); при блокировке renderer перезагружается. Импорт и проверка обновлений идут под
  замком, установка — после разблокировки (скачанное обновление ставится при выходе и под замком). «Идёт импорт» —
  по фазе прогресса (`importActive`), не по живому worker. `electron` — только в `lock/electron.ts`.
  Тесты со scrypt — с таймаутом 30 с на `describe` (реальный KDF под параллельным прогоном).
- **Сеть — список доверенных сервисов** (`apps/desktop/src/net/allowlist.ts`, `TRUSTED_SERVICES`): `github` (обновления:
  `github.com`, `release-assets.githubusercontent.com`), `monobank` (`api.monobank.ua`). Каждый потребитель ограничен своими
  сервисами (`allowlistedFetch(fetch, ['monobank'])` — X-Token не уйдёт на другой хост); https, порт по умолчанию, без
  редиректов. Добавлять — только надёжные известные сервисы, отдельным шагом, с правкой `tests/allowlist.test.ts`.
- **Шифрование базы** (0.1.4 вместе с блокировкой, спека `docs/superpowers/specs/2026-09-26-db-encryption-design.md`):
  - вся база — AES-256-CBC (sqlite3mc в `@libsql/client`, `openLibsql(url, { encryptionKey })`); ключ — случайные 32 байта
    hex в `userData/db-key.bin` через `safeStorage` (как токены), для всех, независимо от PIN (из PIN не берём: импорт под
    замком после перезапуска не открыл бы базу). Защищает копию файлов (другой компьютер / учётная запись, бэкап, облако);
    от программ той же учётной записи не защищает; изменения файла не обнаруживаются — «защищена от изменений» нигде не
    писать (`tests/db-encryption-texts.test.ts`);
  - `main/secure-store.ts` (`SecureStore`) — общий для токенов и ключа: на Linux надёжность по префиксу blob (`v11`/`v12` —
    keyring, `v10` — нет), ошибка расшифровки «temporarily unavailable» → `unavailable`, иначе `failed`; `reencrypted` →
    перезапись. `TokenVault.get` файл, который не расшифровался, **не удаляет** («Запретить» после неподписанного
    обновления — не потеря токенов);
  - `main/db/access.ts` (`DbAccess`) решает состояние при запуске до окна и до всего, что открывает базу:
    `ready` (зашифрована / открыта с `notice`: `no-secure-storage` — нет keyring, `encrypt-pending` — повтор при
    следующем запуске), `key-unavailable`, `key-lost`, `db-unreadable`. Базу сам **никогда не удаляет**; новый ключ
    записывается и читается обратно до того, как от него начнёт зависеть файл;
  - существующая открытая база шифруется при запуске (`main/db/encrypt.ts`): новый файл с ключом + `ATTACH старый KEY ''`,
    схема копируется как есть, сверка (integrity, FK, схема, число строк, `sqlite_sequence`, `user_version`), fsync, rename
    (на Windows с повторами). До rename старый файл не пишется; сбой — копия удаляется, база остаётся открытой;
  - ключ в worker — только в сообщении `start` (`dbKey`, `DB_KEY_RE`), не в argv и env; `Importer` проверяет `StartMessage`
    до `postMessage`, не-ready база → `db-unavailable`;
  - IPC: отправитель → замок → **база** → аргументы; не-ready база пропускает только `ALLOWED_WHEN_DB_UNAVAILABLE`
    (методы замка, `lockNow`, `getDbState`, `relaunchApp`, `startOver`, `quitApp`). Push при не-ready базе — только
    `balance:lock` и `balance:db-state`. `DbStateView` — только перечисления и boolean;
  - экран «База недоступна» (`features/settings/db-recovery`) — после замка (замок главнее: «Начать заново» не для того, кто сел за
    чужой компьютер), любой маршрут туда; кнопки при любом статусе: «Перезапустить» (`app.relaunch`, в том же процессе
    повтор бесполезен), «Начать заново», «Удалить все данные», «Выйти»;
  - «Начать заново» (`main/db/start-over.ts`): диалог → токены, которые расшифровываются, в память → токены, задача, ключ,
    база удаляются → новая база → токены становятся подключениями с именем из банка. Имена, оверрайды, настройки
    пропадают; `lock.json` не трогается; при ready-базе — отказ. Push состояния — один раз, в конце;
  - настройки — карточка «Шифрование базы» (`features/settings/db-encryption`);
  - релиз: на `windows-latest` обязательны тесты `db-libsql` (детектор шифра `sqlite3mc_version`, `PRAGMA cipher`).
