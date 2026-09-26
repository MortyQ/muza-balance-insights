# Бриф: шифрование локальной базы десктопа (Balance Insights)

Дата: 2026-09-26. Бриф для агента, который начнёт работу с нуля. Документ самодостаточный: исходный отчёт лежит в
`reports/`, а эта папка в `.gitignore`, поэтому всё нужное перенесено сюда. Сначала прочитай корневой `CLAUDE.md`,
разделы «Этап 1: десктоп», «Якоря доверия», «Работа с реальными данными» и «Процесс». Работа идёт фазами:
спека → план → код, код только после «ок» пользователя.

Пометки у фактов:
- **[опыт]** — проверено опытом на darwin-arm64, Node 22.14, `@libsql/client@0.18.0` из репозитория, на выброшенных
  базах в `$TMPDIR`;
- **[исходники]** — по исходникам или документации, без запуска;
- **[не проверено]** — никто не проверял, решать без проверки нельзя.

---

## 1. Цель и границы

**Цель.** Файл `userData/monobank.db` вместе с `-wal`, `-shm` и `-journal` лежит на диске зашифрованным. Без ключа файл
бесполезен.

**Решение (зафиксировано в бэклоге `CLAUDE.md`).** Вся база шифруется средствами libsql. Ключ — случайные 32 байта
(64 hex-символа), хранится через `safeStorage`, как токены. Шифрование включено у всех пользователей, независимо от
PIN блокировки приложения. Ключ получают main и import-worker, в renderer он не попадает никогда.

**Почему ключ не выводим из PIN:**
- импорт идёт в фоне, в том числе после перезапуска под замком: из PIN ключ в этот момент не получить, и база не откроется;
- у кого блокировка выключена, у того не было бы шифрования вовсе;
- забытый PIN означал бы потерю данных.

**Что защищаем и что нет:**

| Угроза | Сейчас | С фичей |
|---|---|---|
| Украден выключенный ноутбук с FileVault/BitLocker | защищает шифрование диска [22] | то же |
| Украден ноутбук без шифрования диска | ❌ база читается | ✅ файл не читается, ключ под паролем входа (Keychain/DPAPI) |
| Копия userData на флешку, в облако, в незашифрованный бэкап | ❌ | ✅ без Keychain/DPAPI этой учётной записи файл бесполезен |
| Другая учётная запись на этом компьютере | ❌ | ✅ macOS/Windows: ключ привязан к учётной записи |
| Программа под той же учётной записью | ❌ | ⚠️ Windows: DPAPI расшифрует любому процессу пользователя [30][47]. macOS: без ACL будет системный запрос [43]. Linux: любой клиент Secret Service [56] |
| Запись в userData (подмена байтов) | ❌ | ❌ шифр без аутентификации (раздел 6) |
| Компьютер разблокирован, приложение открыто | ❌ | ❌ это задача блокировки (PIN) |
| Дамп памяти процесса | ❌ | ❌ ключ и данные в памяти main и worker |

Шифрование диска защищает только выключенное устройство или устройство до входа [22]. Шифрование базы добавляет защиту
**копий файла** за пределами этой учётной записи и этого компьютера.

**Вне фичи:**
- база `apps/mcp` в `data/` — у инструмента разработчика своя модель угроз;
- обезличенная копия `analysis/`;
- аутентифицированный шифр (см. открытые вопросы);
- исправление проверки Linux-хранилища у токенов (раздел 7).

---

## 2. Проверенные факты

**Библиотека и шифр**

1. Версии в lockfile: `@libsql/client@0.18.0`, `@libsql/core@0.18.0`, `libsql@0.5.29`, нативные
   `@libsql/{darwin-arm64,darwin-x64,linux-x64-gnu,win32-x64-msvc}@0.5.29` [1]. **[исходники]**
2. В клиенте есть опция `encryptionKey?: string` [2]. Локальный клиент передаёт её в `libsql.Database`, а шифр не
   передаёт. Поэтому всегда действует `encryptionCipher ?? "aes256cbc"` [3][4]. **[исходники]**
3. Шифр в libsql только один: `enum Cipher { Aes256Cbc }`, «AES 256 Bit CBC - No HMAC (wxSQLite3)». При открытии
   вызываются `sqlite3mc_config(... "default:cipher" ...)` и `sqlite3_key` [7][8]. **[исходники]**
4. Внутри SQLite3 Multiple Ciphers 1.8.1, SQLite 3.45.1: `PRAGMA cipher` = `aes256cbc`, `kdf_iter` = 4001.
   Параметры `chacha20` и `sqlcipher` возвращают NULL. Если через сырой `libsql.Database` задать
   `encryptionCipher: 'chacha20' | 'sqlcipher' | 'aes256gcm'`, будет `SQLITE_MISUSE`. **[опыт]**
5. Свойства шифра [10][11]. **[исходники]**
   - ключ выводится из пароля через SHA-256, 4001 итерация;
   - HMAC нет;
   - IV страницы выводится из её номера;
   - байты 16–23 заголовка остаются открытыми.

**Поведение зашифрованной базы**

6. Файл, созданный с ключом, начинается не с `SQLite format 3`. Байты 16–23 = `1000020200402020` (страница 4096). В
   основном файле и в `-wal` канареечного текста нет. **[опыт]**
7. Неверный, пустой или отсутствующий ключ дают `SQLITE_NOTADB: file is not a database`. Это происходит уже в
   `createClient`, потому что клиент при создании сам выполняет `SELECT 1`. Незашифрованный файл, открытый с ключом,
   даёт ту же ошибку, а сам файл не меняется. **[опыт]**
8. Зашифрованная база работает в режиме WAL. Два процесса Node с одним ключом писали по очереди и одновременно:
   400 строк из 400, ни одной ошибки, `integrity_check = ok`. **[опыт]**

**Способы миграции**

9. `SELECT sqlcipher_export(...)` даёт `no such function`. **[опыт]**
10. `PRAGMA rekey` в WAL даёт «Rekeying is not supported in WAL journal mode.». Через сырой `libsql.Database` в режиме
    DELETE `rekey` шифрует файл на месте, но не crash-safe: пишет в единственную копию. Через `createClient` вышло
    `SQLITE_BUSY`. **[опыт]**
11. `VACUUM INTO` с соединения без ключа делает **незашифрованную** копию. `VACUUM INTO` с зашифрованного соединения
    делает копию, зашифрованную тем же ключом. **[опыт]**
12. `ATTACH 'новый' AS enc KEY '<ключ>'` плюс ручное копирование схемы и строк дают зашифрованную копию без потерь.
    **[опыт]**
    - сохраняются строки, FK, индекс, view, trigger и `user_version`;
    - `integrity_check = ok`, `foreign_key_check` пуст, канареечного текста в файле нет.
13. После `client.close()` данные остаются в `-wal`: основной файл 4 КБ, WAL 325 КБ, у зашифрованной и открытой базы
    одинаково. Их переносит `PRAGMA wal_checkpoint(TRUNCATE)`. **[опыт]**

**Прочее**

14. Подмена байта в зашифрованном файле. В свободной области страницы её не заметно вовсе. В области ячеек данные
    портятся и `integrity_check` = «malformed»; ошибки ключа при этом нет. **[опыт]**
15. Скорость, 30 000 строк одной транзакцией, агрегат `GROUP BY` за полгода (20 запросов), два прогона. Разница в пределах
    погрешности. Устойчиво растёт только открытие соединения, на 3–4 мс (KDF). **[опыт]**

    |  | вставка, мс | агрегат, мс | открытие, мс |
    |---|---|---|---|
    | без шифрования | 348–365 | 6,5–8,1 | 0,9–1,1 |
    | с шифрованием | 367–400 | 6,3–11,0 | 4,3–4,8 |

16. darwin-x64: в `index.node` есть `SQLite3 Multiple Ciphers 1.8.1` и `aes256cbc`. **[исходники]** — сам бинарник не
    запускался.
17. win32-x64-msvc и linux-x64-gnu. **[не проверено]** — пакеты не установлены локально. Что известно: CI libsql-js
    собирает все цели без флагов, отключающих шифрование, а `features = ["encryption"]` одинаков для всех платформ [9][16].
    Это состояние ветки `main`, не тега 0.5.29.

**safeStorage (Electron)**

18. `safeStorage` работает только в main. В utilityProcess из модулей Electron есть только `net` и `systemPreferences`
    [30][31]. **[исходники]**
19. Async API появился в Electron 42. Синхронный API в 45 объявлен устаревшим, в 46 удалён [32][33]. **[исходники]**
20. `decryptStringAsync` возвращает `{ result, shouldReEncrypt }`. `shouldReEncrypt = true` означает, что данные
    расшифрованы ключом другого провайдера, их нужно перешифровать и перезаписать [30][34]. **[исходники]**
21. `isAsyncEncryptionAvailable()` возвращает `true`, как только готов объект шифрования, даже без рабочего ключа —
    например, после «Запретить» на macOS [35]. **[исходники]**
22. Ошибки `decryptStringAsync` [35]. **[исходники]**
    - «safeStorage.decryptStringAsync is temporarily unavailable. Please try again.» — у провайдера нет ключа;
    - «Error while decrypting the ciphertext provided to safeStorage.decryptStringAsync.» — окончательная.
23. Объект шифрования кешируется на процесс. После неудачи ключ повторно не запрашивается до перезапуска приложения [36].
    **[исходники]**

**Keychain (macOS)**

24. Элемент Keychain: service `Balance Insights Safe Storage`, account `Balance Insights Key`, один на всё приложение
    [37][38]. **[исходники]**
    - Если элемента нет, создаётся новый пароль. При другой ошибке, в том числе «Запретить», новый не создаётся [39].
    - Старые шифротексты с новым паролем не расшифровать.
25. Keychain — файловый, со старыми ACL [41][42]. **[исходники]**
    - Приложение вне ACL получает запрос Deny / Allow / Always Allow [43].
    - Создатель элемента опознаётся по designated requirement [44][45].
    - Без стабильной подписи запрос приходит после каждого обновления; в Electron это закрыто как «not planned» [46].
26. Подробности для ad-hoc подписи. **[не проверено]**
    - Сводится ли designated requirement ad-hoc подписи к cdhash;
    - как ведёт себя partition list;
    - читает ли `security find-generic-password` элемент без запроса.

**Windows и Linux**

27. Windows: случайный AES-256-ключ лежит в `userData/Local State` → `os_crypt.encrypted_key`, как DPAPI-blob;
    шифрование AES-256-GCM, префикс `v10` [48][49]. **[исходники]**
    - Без `Local State` старые шифротексты не расшифровать.
    - App-Bound Encryption Electron не использует [49][50].
    - После сброса пароля администратором DPAPI-данные теряются [51].
28. Linux: `getSelectedStorageBackend()` возвращает бэкенд **синхронного** OSCrypt, а async API работает через
    os_crypt_async со своими провайдерами [36][49]. Подробности — раздел 7. **[исходники]**

---

## 3. Текущий код, который затронет фича

Пути от корня репозитория. Номера строк — на 2026-09-26, ветка `feat/app-lock`.

**`packages/db-libsql/src/index.ts`, функция `openLibsql(url)` (строки 25–53)**
- Сейчас вызывает `createClient({ url, concurrency: 1, timeout: 5000 })`, затем для файла `PRAGMA journal_mode = WAL`,
  затем `PRAGMA foreign_keys = ON`.
- Изменить: `openLibsql(url, opts?: { encryptionKey?: string })` и пробрасывать ключ в `createClient` только если он
  задан.
- Пакет не зависит от core, типы повторены. Сигнатура должна остаться совместимой с `Db` core: второй аргумент
  опциональный.

**`packages/db-libsql/tests/adapter.test.ts`** — сейчас тесты только на `:memory:`. Добавить тесты на временном файле
(см. раздел 9).

**`apps/desktop/src/main/data.ts`, `DataService`**
- Зависимость `open: () => Promise<Db>` (строка 14), ленивое `conn()`, `close()` (строка 116).
- Ключ в `DataService` не нужен: его замыкает фабрика `open` в `index.ts`.
- Экран потери ключа требует, чтобы ошибка открытия была **типизирована**. Сейчас упавший `open` просто отклоняет
  промис. Нужен явный класс ошибки, например `DbKeyError` или `DbOpenError` с `kind`.

**`apps/desktop/src/main/index.ts`, связывание (строки 82–101)**
- `const data = new DataService({ open: () => openLibsql(\`file:${path.join(userData, DB_FILE)}\`) … })`;
- `new Importer({ … dbPath: path.join(userData, DB_FILE) … })`.
- Изменить: до создания `DataService` получить ключ из нового хранилища ключа, при необходимости выполнить миграцию и
  передать ключ в `open` и в `Importer`.
- Миграция старого `token.bin` (`vault.migrateLegacy(await data.legacyConnection())`) открывает базу, поэтому ключ и
  миграция базы должны быть готовы **до** неё.

**`apps/desktop/src/main/importer.ts`** — `child.postMessage({ type: 'start', dbPath, connections, sinceSec })`
(строка 234). Добавить поле ключа. Файл задачи `import-job.json` (`JOB_FILE`, схема на строке 31: `sinceSec`, `depth`,
`startedAt`) данных не содержит, его не шифруем.

**`apps/desktop/src/shared/import-protocol.ts`, `StartMessage` (строки 17–27)** — zod `strictObject`. Добавить
`dbKey: z.string().regex(/^[0-9a-f]{64}$/)`. Комментарий в шапке файла («Tokens appear in exactly one message: `start`»)
расширить на ключ.

**`apps/desktop/src/worker/import.ts`** — `db = await openLibsql(\`file:${msg.dbPath}\`)` (строка 44). Передавать
`{ encryptionKey: msg.dbKey }`. Сообщение об ошибке и так фиксированное, ключ в него не попадёт; это закрепить тестом.

**`apps/desktop/src/main/token.ts`, `TokenVault`** — образец для нового хранилища ключа.
- Интерфейс `SafeStorageLike`.
- `secureStorageAvailable()` отбрасывает Linux-бэкенды `basic_text` и `unknown` (`INSECURE_BACKENDS`).
- Запись через tmp + rename с правами 0600, папка 0700.
- `get()` предназначен только для main и worker.
- Новый модуль, например `apps/desktop/src/main/db-key.ts` с `DbKeyVault`, повторяет этот подход, но смотри раздел 7:
  надёжность хранилища лучше определять по префиксу шифротекста.

**`apps/desktop/src/main/wipe.ts`**
- `DB_FILE = 'monobank.db'`.
- `APP_FILES` = база, `-wal`, `-shm`, `-journal`, `JOB_FILE`, `token.bin`, `token.bin.tmp`; `APP_DIRS = [TOKENS_DIR]`.
- Порядок в `deleteAllData`: токены → `importer.stop()` → `data.close()` → файлы.
- Добавить: файл ключа (и его `.tmp`), временный файл миграции. Ключ удалять первым, вместе с токенами.

**`apps/desktop/src/main/smoke.ts`, `runDbSmoke`** — открывает файл без ключа (строка 20). Передать ключ или оставить
смоук на отдельном файле; решить в плане.

**`apps/desktop/src/main/people.ts`, `PeopleService`** — работает через `data.database()`, изменений не требует.

**`apps/desktop/src/main/lock/`** — PIN хранится в `lock.json` (scrypt). С ключом базы **не связывать**.
Параллельно в этой ветке работает другой агент: сверься с `git log` перед правками.

**Тесты десктопа** (`apps/desktop/tests/`): `token.test.ts`, `wipe.test.ts`, `importer.test.ts`, `run-import.test.ts`,
`worker-entry.test.ts`, `smoke.test.ts`, `data.test.ts`, `package.test.ts`, `architecture.test.ts`.

**CI — `.github/workflows/release.yml`, это ЯКОРЬ ДОВЕРИЯ**
- job `test` запускает `pnpm test` на `ubuntu-latest` и `macos-latest`, **без Windows**;
- job `build` собирает на mac, win и linux и запускает `PACKAGE_CHECK`;
- правка — отдельным шагом, с отчётом, и `apps/desktop/tests/release-workflow.test.ts` должен остаться зелёным.

**Не трогать:** `apps/mcp` (его `db.ts` вызывает `openLibsql(url)` без ключа — сигнатура совместима),
`recategorize-safety.test.ts`, whitelist копии.

---

## 4. План реализации

Каждый этап — отдельный коммит (Conventional Commits). Проверка каждого этапа: `pnpm test` и `pnpm typecheck` в корне.

**Этап 0. Спека и ответы пользователя.** Получить решения по открытым вопросам (раздел 8), как минимум по вопросам 1, 2
и 5. Спеку положить в `docs/superpowers/specs/`, план — в `docs/superpowers/plans/`.

**Этап 1. Адаптер `openLibsql` с ключом** (`packages/db-libsql`)
- `openLibsql(url, { encryptionKey? })`.
- Тесты на файле в `os.tmpdir()`: заголовок ≠ `SQLite format 3`; неверный ключ и отсутствие ключа → `SQLITE_NOTADB`;
  WAL-файл без канарейки; два соединения с одним ключом; открытый файл без ключа работает как раньше.
- Добавить тест-«детектор шифра»: `SELECT sqlite3mc_version()` начинается с `SQLite3 Multiple Ciphers`, а
  `PRAGMA cipher` = `aes256cbc`. Он упадёт, если libsql соберут без шифрования.

**Этап 2. Проверка шифра в CI на всех ОС** (якорь, отдельный шаг)
- Цель: тест этапа 1 выполняется на Windows. Linux и macOS уже покрыты `pnpm test` в job `test`.
- Варианты: добавить `windows-latest` в матрицу `test` или добавить в job `build` для win шаг
  `pnpm --filter @mono/db-libsql test`.
- Обновить `release-workflow.test.ts`, если он проверяет матрицу. Вынести в отчёт как изменение якоря.

**Этап 3. Хранилище ключа** (`apps/desktop/src/main/db-key.ts`, новый)
- Файл `userData/db-key.bin`, 0600, запись через tmp + rename.
- Ключ: `crypto.randomBytes(32).toString('hex')`. Шифрование: `safeStorage.encryptStringAsync`.
- Надёжность проверять по итогу: `encryptStringAsync` прошёл, а на Linux префикс шифротекста `v11` или `v12`, не `v10`
  (раздел 7). `isAsyncEncryptionAvailable()` и `getSelectedStorageBackend()` для этого недостаточно (факты 21, 28).
- Расшифровка: при `shouldReEncrypt` перешифровать и перезаписать; проверять форму `/^[0-9a-f]{64}$/`.
- Различать исходы: `ok` | `no-secure-storage` | `unavailable` (temporarily unavailable) | `lost` (окончательная ошибка
  или файла нет при зашифрованной базе).
- Тесты — по образцу `token.test.ts`: фейковый safeStorage, ключ не попадает ни в логи, ни в ошибки, ни в IPC.

**Этап 4. Определение состояния и открытие**

| Файл базы | Ключ | Действие |
|---|---|---|
| нет | нет | создать ключ; база будет создана зашифрованной |
| есть, начинается с `SQLite format 3` | — | миграция (этап 5); ключ создать, если его нет |
| есть, зашифрован | `ok` | открыть с ключом |
| есть, зашифрован | `unavailable` или `lost` | экран потери ключа (этап 7) |
| открыт с ключом → `SQLITE_NOTADB` | — | экран «база повреждена или ключ не тот» |
| надёжного хранилища нет | — | база без шифрования + предупреждение (этап 8) |

Если остался временный файл миграции — удалить его и начать миграцию заново. Всё это выполняется до `migrateLegacy`,
до `Importer` и до первого IPC с данными.

**Этап 5. Миграция существующей базы** (`apps/desktop/src/main/db-encrypt.ts`, новый) — crash-safe:
1. Импорт не запущен, соединение единственное. На старой базе выполнить `PRAGMA wal_checkpoint(TRUNCATE)` (факт 13).
2. `ATTACH '<userData>/monobank.db.encrypting' AS enc KEY '<key>'` и `PRAGMA enc.journal_mode = DELETE`.
3. Скопировать схему из `main.sqlite_schema` в порядке table → index → view → trigger: в `CREATE` добавить префикс
   `enc.`, для таблиц — `INSERT INTO enc."t" SELECT * FROM main."t"`.
   - `sqlite_sequence` и `sqlite_stat*` перенести отдельно, если они есть. **[не проверено]** — в опыте AUTOINCREMENT не было;
     проверить по схеме `packages/core`.
   - `PRAGMA enc.user_version = <main.user_version>`.
   - `foreign_keys` при копировании выключить или соблюдать порядок таблиц.
4. `DETACH`, закрыть соединение.
5. Открыть временный файл новым соединением с ключом и проверить: `integrity_check = ok`, `foreign_key_check` пуст,
   `count(*)` каждой таблицы совпадает со старой базой, `user_version` совпадает, в `schema_migrations` тот же
   максимум. Закрыть.
6. `fsync` временного файла (`fs.promises.open` + `fh.sync()`), затем `rename(tmp, monobank.db)`.
   - `fsync` папки на macOS и Linux.
   - Windows: `rename` поверх файла, который открыт, падает — все соединения должны быть закрыты. Нужен ли там `fsync`
     каталога — **[не проверено]**.
7. Удалить старые `monobank.db-wal` и `monobank.db-shm` **до** первого открытия новой базы.
8. Любая ошибка на шагах 2–5: удалить временный файл, старую базу **не трогать**, показать ошибку и продолжить работу
   без шифрования до следующего запуска (или по решению пользователя, см. открытые вопросы).

Тесты — на временной папке: полная копия; падение на каждом шаге (внедрить сбой) оставляет старую базу целой;
повторный запуск после «аварии» с оставшимся tmp-файлом.

**Этап 6. Ключ в worker**
- `StartMessage.dbKey`; `Importer` получает ключ из `DbKeyVault` так же, как токены из `TokenVault`.
- Worker открывает базу через `openLibsql(..., { encryptionKey })`.
- Тесты: `import-protocol` отвергает не-hex ключ; сообщения worker → main не содержат ключ (канарейка).

**Этап 7. Потеря ключа: экран и восстановление**
- main сообщает renderer только **статус** (`'key-unavailable' | 'key-lost' | 'db-corrupt'`) и никаких подробностей.
  Новый IPC-канал `balance:*`, узкий тип в `apps/desktop/src/shared/api.ts`.
- Экран (FSD: `features/db-key-recovery` + страница или guard в `app/router`):
  - «Перезапустить и попробовать снова» → `app.relaunch()` + `app.exit()`. Повтор в том же процессе бесполезен (факт 23).
    Для macOS текст: «разрешите доступ в запросе Связки ключей»;
  - «Начать заново» → системный диалог → удалить базу, WAL/SHM и ключ; создать новый ключ. Операции загрузятся из банка
    заново, люди, их имена, оверрайды и настройки пропадут. Что делать с токенами — открытый вопрос 2;
  - «Выйти».
- **Никогда не удалять базу автоматически.**
- Тесты: guard пускает на экран восстановления при любом из трёх статусов; «Начать заново» без подтверждения ничего не
  удаляет.

**Этап 8. Нет надёжного хранилища (Linux)** — база остаётся открытой, в настройках постоянная плашка «Ключ хранить
негде — база не зашифрована». Нужен ли выбор другого поведения — открытый вопрос 1.

**Этап 9. Wipe и документация**
- `APP_FILES` += `db-key.bin`, `db-key.bin.tmp`, `monobank.db.encrypting`; ключ удаляется вместе с токенами, первым шагом.
- Обновить `wipe.test.ts`.
- Текст диалога «Удалить все данные» при необходимости дополнить.
- Записать решения в `CLAUDE.md` (раздел «Этап 1: десктоп» или новый).

---

## 5. Проверенные фрагменты кода

Всё ниже проверено опытом на darwin-arm64 с `@libsql/client@0.18.0` и Node 22.14. В коде приложения писать через
адаптер `openLibsql`.

Открытие зашифрованной базы (создаёт файл зашифрованным, если его нет):

```ts
import { createClient } from '@libsql/client';

const client = createClient({
  url: `file:${file}`,
  encryptionKey: key, // 64 hex-символа, БЕЗ обёртки x'…'
  concurrency: 1,
  timeout: 5_000,
});
await client.execute('PRAGMA journal_mode = WAL');
await client.execute('PRAGMA foreign_keys = ON');
```

- Неверный ключ, пустой ключ, отсутствие ключа или незашифрованный файл с ключом дают `LibsqlError` с кодом
  `SQLITE_NOTADB` уже на `createClient` (факт 7).
- Строку вида `x'…'` sqlite3mc трактует иначе (заголовок получился другим), поэтому ключ передаём голым hex.
- Кавычка внутри ключа работала, но у hex её нет.

Генерация ключа:

```ts
import crypto from 'node:crypto';
const key = crypto.randomBytes(32).toString('hex'); // /^[0-9a-f]{64}$/
```

Диагностика шифра (для теста «детектор»):

```sql
SELECT sqlite3mc_version() AS v;  -- 'SQLite3 Multiple Ciphers 1.8.1'
PRAGMA cipher;                     -- aes256cbc
SELECT sqlite3mc_config('aes256cbc', 'kdf_iter') AS v;  -- 4001
```

Проверка «файл незашифрован»:

```ts
const head = Buffer.alloc(16);
const fh = await fs.promises.open(file, 'r');
try { await fh.read(head, 0, 16, 0); } finally { await fh.close(); }
const isPlain = head.toString('latin1') === 'SQLite format 3\0';
```

Миграция через `ATTACH … KEY`, соединение открыто на старой базе **без** ключа. Проверено: 6 объектов схемы, FK,
UNIQUE, индекс, view, trigger, `user_version = 9`.

```ts
await c.execute('PRAGMA wal_checkpoint(TRUNCATE)');
await c.execute(`ATTACH DATABASE '${dst}' AS enc KEY '${key}'`); // dst и key без кавычек внутри: путь userData + hex
const objs = (await c.execute(
  "SELECT type, name, sql FROM main.sqlite_schema WHERE sql NOT NULL AND name NOT LIKE 'sqlite_%'",
)).rows;
const stmts = ['PRAGMA enc.journal_mode = DELETE'];
for (const t of ['table', 'index', 'view', 'trigger']) {
  for (const o of objs.filter((x) => x.type === t)) {
    stmts.push(String(o.sql).replace(
      new RegExp(`^(CREATE (?:UNIQUE )?(?:TABLE|INDEX|VIEW|TRIGGER)\\s+)("?${o.name}"?)`, 'i'),
      '$1enc.$2',
    ));
    if (t === 'table') stmts.push(`INSERT INTO enc."${o.name}" SELECT * FROM main."${o.name}"`);
  }
}
for (const s of stmts) await c.execute(s);
const uv = (await c.execute('PRAGMA main.user_version')).rows[0].user_version;
await c.execute(`PRAGMA enc.user_version = ${Number(uv)}`);
await c.execute('DETACH DATABASE enc');
c.close();
// затем: открыть dst с ключом → PRAGMA integrity_check, PRAGMA foreign_key_check, count(*) по таблицам
```

В опыте после копии: `integrity_check = ok`, `foreign_key_check` пуст, `user_version = 9`, канарейки в файле нет.

Что делать с этим фрагментом в продакшн-коде:
- регулярку для `CREATE` заменить на надёжную: имена берутся из схемы core, тест проверяет все объекты текущей схемы;
- проверить `IF NOT EXISTS`, имена в кавычках, `WITHOUT ROWID` в схеме core;
- AUTOINCREMENT и `sqlite_sequence` в опыте не проверялись.

Бэкап зашифрованной базы тем же ключом (проверено): `VACUUM INTO '<path>'` с зашифрованного соединения.

---

## 6. Подводные камни и риски

1. **AES-256-CBC без HMAC.** Шифр скрывает содержимое, но не защищает от изменений. Подмена в свободной области
   страницы незаметна, в данных даёт «malformed» (факт 14). В UI и README писать «зашифрована», а не «защищена от
   изменений».
2. **IV из номера страницы.** По двум копиям файла видно, какие страницы не менялись; содержимое при этом не раскрывается
   (вывод из описания шифра [10]).
3. **`PRAGMA rekey` в WAL не работает** (факт 10). Смена ключа в будущем = та же процедура копирования через `ATTACH KEY`.
   В libsql обсуждалось, что rekey в WAL портил базу [18].
4. **Копировать файл байтами нельзя**: данные живут в `-wal` даже после `close()` (факт 13). Только SQL
   (`ATTACH`, `VACUUM INTO`), и только после `wal_checkpoint(TRUNCATE)`.
5. **Неподписанная сборка macOS**: после каждого обновления приходит запрос Keychain (факт 25). «Запретить» → ключ
   недоступен до перезапуска (факт 23). Если пользователь удалил элемент в «Связке ключей», появится новый пароль, и
   старые токены и ключ базы потеряны (факт 24).
6. **Один пароль Keychain на всё приложение**: токены и ключ базы теряются вместе.
7. **Windows DPAPI**: не защищает от программ того же пользователя [30][47]. `Local State` — часть ключевого материала:
   перенос userData без него или сброс пароля администратором = потеря ключа (факт 27).
8. **Win/Linux-бинарники libsql** не проверены опытом (факт 17). Без CI-проверки (этап 2) можно выпустить сборку,
   которая не откроет базу.
9. **libsql фактически на поддержке**: «new features are being developed in Turso» [20]. Новых шифров не будет. При
   уходе с libsql придётся мигрировать формат.
10. **`SQLITE_NOTADB` не различает** «неверный ключ» и «повреждённый файл»: экран должен покрывать оба случая.
11. **Нарушить FK при копировании**: копировать с выключенными `foreign_keys` или в порядке зависимостей и проверять
    `foreign_key_check`.
12. **Будущее «приложение как MCP-сервер»**: читать базу десктопа снаружи (apps/mcp, Claude Desktop) без ключа из
    Keychain приложения станет нельзя. Нормально, если MCP-сервером будет само приложение.

---

## 7. Находка вне фичи: Linux и `TokenVault`

**Суть** (по исходникам Electron 44 и Chromium 152, **[не проверено]** на живой системе):
- `getSelectedStorageBackend()` описывает бэкенд **синхронного** OSCrypt.
- `encryptStringAsync` работает через os_crypt_async [36][49]. Провайдеры по приоритету: Secret Portal (`v12`, по
  умолчанию только расшифровывает) [55], Freedesktop Secret Service/KWallet (`v11`) [54], `PosixKeyProvider`
  (встроенный ключ из PBKDF2 от `peanuts`, `v10`) [52].
- Если Secret Service не ответил, async-шифрование **молча** идёт на встроенном ключе (`v10`), а
  `isAsyncEncryptionAvailable()` = `true` (факт 21).
- Выбор среды тоже разный: для `DESKTOP_ENVIRONMENT_OTHER` и LXQt синхронный выбирает `basic_text`, а async пробует
  Secret Service [53][54].
- Итог: проверка `INSECURE_BACKENDS = new Set(['basic_text', 'unknown'])` в
  `apps/desktop/src/main/token.ts` (`secureStorageAvailable()`) может пропустить случай, когда токен на деле зашифрован
  встроенным ключом. Возможно и обратное.

**Как проверить** (вручную, у пользователя на Linux, без реальных данных):
1. В dev-сборке зашифровать тестовую строку через `encryptStringAsync` и вывести в лог только первые 3 байта результата
   и `getSelectedStorageBackend()`.
2. Прогнать с работающим keyring (ожидается `v11`), с остановленным или заблокированным `gnome-keyring` или без
   D-Bus-сессии (ожидается `v10`), с `--password-store=basic`.

**Что поправить (отдельная задача, до фичи или вместе с ней — открытый вопрос 6):**
- на Linux считать хранилище надёжным, только если префикс свежего шифротекста `v11` или `v12`;
- `v10` на Linux считать ненадёжным: токен только в памяти, ключ базы не сохранять;
- обработать `shouldReEncrypt` у токенов;
- обновить `token.test.ts`: фейковый safeStorage возвращает шифротекст с префиксом.

---

## 8. Открытые вопросы (решает пользователь)

1. **Linux без надёжного хранилища:**
   - (а) база без шифрования + плашка (рекомендация);
   - (б) шифровать ключом только в памяти — база живёт до перезапуска;
   - (в) не запускаться.
2. **Токены при «Начать заново»:**
   - (а) оставить, если читаются;
   - (б) удалить всё, как в «Удалить все данные».
3. **Нужен ли аутентифицированный шифр:**
   - (а) принять AES-256-CBC сейчас (рекомендация);
   - (б) перейти на `better-sqlite3-multiple-ciphers` (sqlite3mc 2.4.0, по умолчанию sqleet — ChaCha20-Poly1305 [21])
     ценой нативного модуля под ABI Electron, синхронного API и второго драйвера;
   - (в) ждать стабильного шифрования Turso Database (AEGIS/AES-GCM, сейчас «experimental», есть баги [12][14][15]).
4. **Обернуть ключ ещё и PIN:**
   - (а) нет, PIN остаётся блокировкой интерфейса (рекомендация);
   - (б) опция «строгий режим» без фонового импорта после перезапуска.
5. **Проверка шифра на Windows:**
   - (а) `windows-latest` в матрицу `test`;
   - (б) шаг в job `build` для win;
   - (в) ручной смоук перед релизом.
6. **Исправление Linux-проверки у токенов (раздел 7):**
   - (а) отдельным шагом до фичи (рекомендация: ключ базы опирается на ту же проверку);
   - (б) вместе с фичей;
   - (в) сначала ручная проверка.
7. **Сбой миграции:**
   - (а) работать без шифрования и повторить при следующем запуске;
   - (б) блокирующий экран с «Повторить».
8. **Ручная проверка Keychain на обновлении ad-hoc-сборки** («Запретить» / «Разрешить»):
   - (а) до спеки;
   - (б) в смоуке фичи.

---

## 9. Как проверить реализацию

**Автотесты** (`pnpm test` и `pnpm typecheck` в корне):

- `packages/db-libsql`:
  - заголовок зашифрованного файла ≠ `SQLite format 3`;
  - неверный ключ и отсутствие ключа → `SQLITE_NOTADB`;
  - канарейки нет ни в основном файле, ни в `-wal`;
  - детектор `sqlite3mc_version` / `PRAGMA cipher`;
  - без ключа всё как раньше.
- Миграция:
  - полная копия — схема, строки, `user_version`, `integrity_check`, `foreign_key_check`;
  - внедрённый сбой на каждом шаге оставляет исходную базу целой, а временный файл удаляется;
  - повторный запуск после «аварии».
- `DbKeyVault`:
  - исходы `ok`, `no-secure-storage`, `unavailable`, `lost`;
  - `shouldReEncrypt`;
  - Linux `v10` → ненадёжно;
  - ключ-канарейка не появляется в логах, ошибках и ответах IPC.
- Протокол worker: `dbKey` проверяется zod; сообщения из worker не содержат ключ.
- `wipe.test.ts`: новые файлы в `APP_FILES`, ключ удаляется первым.
- `architecture.test.ts`: новая фича renderer укладывается в FSD.
- CI: тест-детектор проходит на macOS, Linux и Windows.

**Смоук для пользователя** (реальные команды и приложение запускает только пользователь):
1. Установить прошлую версию, загрузить данные. Обновиться до версии с шифрованием: данные на месте, суммы на экране
   совпадают с прежними.
2. Посмотреть на файл базы, например `head -c 16` (это делает пользователь, не агент): не `SQLite format 3`.
3. macOS: обновиться ещё раз (ad-hoc) → запрос Keychain → «Разрешить» → данные открываются.
4. macOS: на запросе нажать «Запретить» → экран «ключ недоступен» → «Перезапустить» → «Разрешить» → данные на месте.
5. Импорт после перезапуска (в том числе под замком PIN) дописывает операции.
6. «Удалить все данные» → в userData не осталось базы, ключа и временных файлов.
7. «Начать заново» с экрана потери ключа (имитация: удалить `db-key.bin` при закрытом приложении) → подтверждение →
   пустое приложение, импорт работает.
8. Windows: пункты 1, 2, 5, 6. Linux: с keyring — как Windows; без keyring — плашка «база не зашифрована».

---

## 📚 Источники

Все обращения — 2026-09-26.

1. `pnpm-lock.yaml:806–861, 2360` — версии `@libsql/client@0.18.0`, `libsql@0.5.29`, нативных пакетов.
2. `node_modules/.pnpm/@libsql+core@0.18.0/node_modules/@libsql/core/lib-esm/api.d.ts:13–16` — опции `encryptionKey`, `remoteEncryptionKey`.
3. `node_modules/.pnpm/@libsql+client@0.18.0/node_modules/@libsql/client/lib-esm/sqlite3.js:46–55` — локальный клиент передаёт `encryptionKey`, шифр не передаёт.
4. `node_modules/.pnpm/libsql@0.5.29/node_modules/libsql/index.js:75, 95` — `encryptionCipher ?? "aes256cbc"`.
5. `node_modules/.pnpm/@libsql+client@0.18.0/node_modules/@libsql/client/lib-esm/http.js:19–20` — удалённый клиент отвергает `encryptionKey`.
6. https://docs.turso.tech/sdk/ts/reference — Turso TS SDK Reference: зашифрованная база нечитаема обычным SQLite; для новых проектов советуют `@tursodatabase/database`.
7. https://raw.githubusercontent.com/tursodatabase/libsql/main/libsql-sys/src/connection.rs — `enum Cipher { Aes256Cbc }` «No HMAC (wxSQLite3)», `sqlite3mc_config` + `sqlite3_key` (ветка main).
8. https://raw.githubusercontent.com/tursodatabase/libsql/main/libsql-ffi/build.rs — `CODEC_TYPE=AES256`, `LIBSQL_ENCRYPTION=1` (ветка main).
9. https://raw.githubusercontent.com/tursodatabase/libsql-js/main/Cargo.toml — `features = ["encryption"]` без платформенных различий (ветка main).
10. https://utelle.github.io/SQLite3MultipleCiphers/docs/ciphers/cipher_aes256cbc/ — AES-256-CBC: SHA-256 KDF, 4001 итерация, без HMAC, IV из номера страницы.
11. https://utelle.github.io/SQLite3MultipleCiphers/docs/ciphers/cipher_legacy_mode/ — байты 16–23 заголовка открыты.
12. https://docs.turso.tech/tursodb/encryption — Turso Database: AEGIS/AES-GCM, «experimental».
14. https://github.com/tursodatabase/turso/issues/2703 — неверный ключ → panic (по выдаче поиска).
15. https://github.com/tursodatabase/turso/issues/8685 — не открывает только что созданную зашифрованную базу (по выдаче поиска).
16. https://github.com/tursodatabase/libsql-js/blob/main/.github/workflows/CI.yml — матрица сборки без флагов против шифрования.
17. https://utelle.github.io/SQLite3MultipleCiphers/docs/configuration/config_sql_pragmas/ — `key`/`rekey`, rekey в WAL, не выполнять PRAGMA шифрования в транзакции.
18. https://github.com/tursodatabase/libsql/issues/976 — rekey в WAL портил базу; обход через DELETE.
19. https://github.com/tursodatabase/libsql/issues/1756 — шифрование at rest выключено в libsql-server (причина не названа).
20. https://github.com/tursodatabase/libsql-js — README: «new features are being developed in Turso».
21. https://github.com/m4heshd/better-sqlite3-multiple-ciphers — sqlite3mc 2.4.0, по умолчанию sqleet.
22. https://support.apple.com/guide/security/volume-encryption-with-filevault-sec4c6dc1b6e/web — FileVault защищает данные в покое, после входа тома доступны.
23. https://www.zetetic.net/sqlcipher/performance/ — SQLCipher: 5–15 % накладных, KDF при открытии.
30. https://github.com/electron/electron/blob/44-x-y/docs/api/safe-storage.md — методы, `shouldReEncrypt`, только main, предупреждение о подписи, DPAPI.
31. https://github.com/electron/electron/blob/44-x-y/lib/utility/api/module-list.ts — в utilityProcess нет safeStorage.
32. https://github.com/electron/electron/pull/49054 — async API в safeStorage (Electron 42).
33. https://github.com/electron/electron/blob/main/docs/breaking-changes.md — синхронный API deprecated в 45, удалён в 46.
34. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/async/common/encryptor.cc — алгоритмы по префиксам, `should_reencrypt`.
35. https://github.com/electron/electron/blob/44-x-y/shell/browser/api/electron_api_safe_storage.cc — тексты ошибок, `isAsyncEncryptionAvailable` → true.
36. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/async/browser/os_crypt_async.cc — порядок провайдеров, кеш на процесс.
37. https://github.com/electron/electron/blob/44-x-y/shell/browser/electron_browser_main_parts.cc — service «<App> Safe Storage», `SelectBackend`.
38. https://github.com/electron/electron/blob/44-x-y/patches/chromium/feat_ensure_mas_builds_of_the_same_application_can_use_safestorage.patch — account «<App> Key».
39. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/common/keychain_password_mac.mm — новый пароль только при `errSecItemNotFound`.
41. https://github.com/chromium/chromium/blob/152.0.7977.130/crypto/apple/keychain_v2.mm — файловый keychain.
42. https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains — TN3137: виды keychain, ACL.
43. https://developer.apple.com/documentation/security/access-control-lists — запрос Deny / Allow / Always Allow.
44. https://developer.apple.com/library/archive/technotes/tn2206/_index.html — TN2206: designated requirement.
45. https://developer.apple.com/forums/thread/98484 — Apple DTS: элемент привязан к DR создателя.
46. https://github.com/electron/electron/issues/43233 — запросы Keychain после обновления без подписи, «not planned».
47. https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata — область действия DPAPI.
48. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/async/browser/dpapi_key_provider.cc — ключ в `Local State`, AES-256-GCM, v10.
49. https://github.com/electron/electron/blob/44-x-y/shell/browser/browser_process_impl.cc — провайдеры по ОС, путь `Local State`.
50. https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html — App-Bound Encryption (Chrome).
51. https://learn.microsoft.com/en-us/windows/win32/seccng/cng-dpapi-backup-keys-on-ad-domain-controllers — сброс пароля и DPAPI.
52. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/async/browser/posix_key_provider.cc — встроенный ключ `peanuts`, v10.
53. https://github.com/electron/electron/blob/44-x-y/patches/chromium/revert_oscrypt_remove_sync_backend.patch — синхронный `SelectBackend`.
54. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/async/browser/freedesktop_secret_key_provider.cc — v11, выбор среды.
55. https://github.com/chromium/chromium/blob/152.0.7977.130/components/os_crypt/async/browser/secret_portal_key_provider.cc — v12, portal.
56. https://specifications.freedesktop.org/secret-service/latest/ch10.html — Secret Service без контроля доступа.

Номера совпадают с исходным отчётом. Пропуски (13, 24–29, 40) — источники, которые здесь не понадобились.
