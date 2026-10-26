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
  Под замком `registerIpc` пропускает только `ALLOWED_WHEN_LOCKED` (`getLockState`, `unlockWithPin`, `unlockWithTouchId`, `getLocale` — язык экрана замка,
  `deleteAllData`), push — только `balance:lock` (`gatedPush`, единственный путь `webContents.send` в `index.ts` —
  проверяет `tests/window.test.ts`); при блокировке renderer перезагружается. Импорт и проверка обновлений идут под
  замком, установка — после разблокировки (скачанное обновление ставится при выходе и под замком). «Идёт импорт» —
  по фазе прогресса (`importActive`), не по живому worker. `electron` — только в `lock/electron.ts`.
  Тесты со scrypt — с таймаутом 30 с на `describe` (реальный KDF под параллельным прогоном).
- **Statement files** (`main/statements.ts`): the file is picked in the system open dialog (the extensions the
  connection's bank's readers name, then «All files») and read in main only — at most 10 MiB (by size before reading and
  after). Its kind comes from its leading bytes (`sniffFormat`), never the name: text is decoded as UTF-8 in main, a
  spreadsheet or a PDF goes to the decoder process (below). The renderer gets, per account of the file, counts, dates,
  the currency, the card type and the last 4 card digits, plus codes — never the path, the name, the content or an
  IBAN; the log gets `[statement] <code>` or counts. The read statements are kept in main for compare and commit — one
  file at a time, 10 minutes — and dropped on the lock and on «Delete all data». No network.

  From the data screens files open as an upload (`openUpload`: the dialog with several files — every bank's extensions,
  or one connection's bank's only; `openDroppedUpload`: files dropped on the window), at most `UPLOAD_FILES_MAX` (12,
  `src/shared/upload.ts`), kept like a statement (10 minutes, dropped on the lock). Each file's bank comes from the
  reader its content picks; each account is matched to a connection by the data process (IBAN or card number), so the
  renderer gets a connection id and a participant id, never the number. A dropped file's path is read **in the preload
  only** (`webUtils.getPathForFile`): the renderer's API takes the `File`s, never a path; a `File` made by script has
  no path (`''`, refused by the arguments' schema). Main reads a dropped path only if it is a regular file itself (`lstat`: no
  directory, device or symbolic link), through the same size limit, decoder and readers.
- **The statement decoder** (`src/decoder/process.ts`, a `utilityProcess` forked per file by `main/decoder-client.ts`,
  `serviceName: 'balance-decoder'`, `env: {}`, nothing on the command line). A spreadsheet (`PK\3\4`) or a PDF
  (`%PDF-`) — main tells them by the leading bytes (`sniffFormat`); text stays in main — is decoded there, so a flaw
  in a PDF or XLSX library hit by a crafted file runs where there is no key, no token, no database, no network module
  and no channel to the renderer:
  - it gets one `decode { format, bytes }` and sends one reply, `document` (sheets of typed cell texts, or PDF text
    items with x, y, w, h) or `failure { code }`; main kills it on the reply (it never exits by itself, so the reply
    is not lost), on its exit, or after `DECODE_TIMEOUT_MS` (30 s); quitting kills one in flight;
  - both sides check the messages with `src/shared/decoder-protocol.ts` (zod), the limits included: the file 10 MiB;
    the archive's declared unpacked size 50 MiB (checked before anything is inflated, and each part is inflated into
    a buffer of its declared size: a zip bomb stops there); 50 sheets, 200 000 cells (an empty row counts), 1000
    characters a cell; 500 pages, 200 000 text items, 200 characters an item;
  - XLSX: `fflate` + `fast-xml-parser`; only the workbook, its relationships, the shared strings and the sheets are
    inflated; a part with a DOCTYPE is refused; formulas are not evaluated (the cached value), external links never
    followed;
  - PDF: `pdfjs-dist`'s legacy build in the same thread (no worker thread), no font faces, system fonts or
    WebAssembly, nothing rendered; pdf.js 6 has no eval path (`tests/decoder-pdf.test.ts` scans the build). Its
    optional native canvas is not installed (`ignoredOptionalDependencies` in `pnpm-workspace.yaml`); of the package
    only `legacy/build/pdf.mjs` and `pdf.worker.mjs` are packaged (`electron-builder.json`, checked in the asar);
  - its import graph reaches only `zod`, `fflate`, `fast-xml-parser`, those two pdf.js modules and core's `shared/`
    (`decoderViolations` in `tests/helpers/main-imports.ts`); main never imports `src/decoder/`.

  Tests: `tests/decoder.test.ts` (fixtures made in the test), `decoder-pdf.test.ts`, `decoder-client.test.ts`,
  `decoder-entry.test.ts` (as source).
- **Сеть — список доверенных сервисов** (`apps/desktop/src/net/allowlist.ts`, `TRUSTED_SERVICES`): `github` (обновления:
  `github.com`, `release-assets.githubusercontent.com`), `monobank` (`api.monobank.ua`). Каждый потребитель ограничен своими
  сервисами (`allowlistedFetch(fetch, ['monobank'])` — X-Token не уйдёт на другой хост); https, порт по умолчанию, без
  редиректов. Добавлять — только надёжные известные сервисы, отдельным шагом, с правкой `tests/allowlist.test.ts`.
  `monobank-rates` (`api.monobank.ua`, only `GET /bank/currency`): today's public Monobank rates for the home screen,
  fetched by main (`main/rates.ts`, `main/rates-session.ts`) through its own Electron session, partition
  `monobank-rates`, created and guarded in one step by `createRatesSession` (the only `fromPartition(` besides the
  updater's, `tests/update-session.test.ts`). It sends no headers, so the import's `X-Token` cannot reach it. The
  answer is capped at 64 KiB (by `Content-Length` before reading, and after) and zod-checked. Rates are cached in
  `userData/rates.json`, removed by «Delete all data», after which `RatesService.forget()` drops them from memory and
  discards a refresh still in flight.
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
  - the data process (`src/data/process.ts`) gets the key the same way, only in `open` (`DB_KEY_RE`), never in argv or
    env; it has no network and no channel to the renderer: every call reaches it through main's IPC gates. A key that
    stops fitting there (`SQLITE_NOTADB`) sets `db-unreadable` through `DbAccess.markUnreadable()`;
  - IPC: отправитель → замок → **база** → аргументы; не-ready база пропускает только `ALLOWED_WHEN_DB_UNAVAILABLE`
    (методы замка, `lockNow`, `getDbState`, `relaunchApp`, `startOver`, `quitApp`). Push при не-ready базе — только
    `balance:lock` и `balance:db-state`. `DbStateView` — только перечисления и boolean;
  - экран «База недоступна» (`features/settings/db-recovery`) — после замка (замок главнее: «Начать заново» не для того, кто сел за
    чужой компьютер), любой маршрут туда; кнопки при любом статусе: «Перезапустить» (`app.relaunch`, в том же процессе
    повтор бесполезен), «Начать заново», «Удалить все данные», «Выйти»;
  - «Начать заново» (`main/db/start-over.ts`): диалог → токены, которые расшифровываются, в память → токены, задача, ключ,
    база удаляются → новая база → токены становятся подключениями с именем из банка. Имена, оверрайды, настройки
    пропадают; `lock.json` не трогается; при ready-базе — отказ. Push состояния — один раз, в конце;
  - настройки — строка «Шифрование базы» в разделе «Хранение и токены» (`features/settings/db-encryption`);
  - релиз: на `windows-latest` обязательны тесты `db-libsql` (детектор шифра `sqlite3mc_version`, `PRAGMA cipher`).
  - **Windows держит файлы закрытой базы**, пока живы её prepared statements (у libsql-js нет `Statement.close`,
    `@libsql/client` готовит statement на каждый `execute`): после `close()` rename / unlink дают `EBUSY`, ожидание не
    помогает, помогает только сборка мусора (замерено в CI на `windows-latest`, 27.09.2026). Поэтому после `close()` и
    перед переименованием или удалением файлов базы — `releaseClosedFiles()` из `@mono/db-libsql` (принудительный gc через
    `v8.setFlagsFromString('--expose-gc')`): зависимость `release` у `encryptDatabase` (перед swap и удалением копии),
    `DbAccess.reset`. Недоступный gc — строка `[db] forced gc
    unavailable` при запуске и `forcedGc` в `[smoke]`. Проверка — `packages/db-libsql/tests/release-files.test.ts`
    (обязательна на Windows вместе с тестами шифрования). В main-процессе Electron gc вживую на Windows ещё не проверен.
    The data process's connection is released by the process's exit: «Delete all data» and «Start over» call
    `DataClient.stop()`, which resolves only on the exit, so `releaseClosedFiles()` remains for main's own launch-time opens
    (`DbAccess`, `encrypt.ts`).
