# Шифрование локальной базы десктопа — дизайн

Релиз: 0.1.4 — вместе с блокировкой (решение пользователя 26.09.2026). Статус: решения пользователя по вопросам брифа получены 26.09.2026
(все «как рекомендовано»), спека ждёт ревью. Дальше — план в `docs/superpowers/plans/`, код только после «ок».

Источники: бриф `docs/superpowers/briefs/2026-09-26-db-encryption.md` (факты с пометками [опыт] / [исходники] /
[не проверено], номера фактов ниже — оттуда), исследование `reports/2026-09-26-db-encryption-research.md`, код ветки
`feat/crypt_db_files` на 26.09.2026 (после слияния `feat/app-lock`, PR #5). Всё, что не проверено опытом, помечено
«не проверено».

## Цель и границы

Файл `userData/monobank.db` вместе с `-wal`, `-shm` и `-journal` лежит на диске зашифрованным. Без ключа файл
бесполезен. Ключ — случайные 32 байта (64 hex-символа), хранятся через `safeStorage` в `userData/db-key.bin`, как
токены. Шифрование включено у всех, у кого есть надёжное хранилище ключей, независимо от PIN. Ключ знают только main и
import-worker; в renderer, логи, IPC, файл задачи импорта и сообщения worker → main он не попадает никогда.

Не входит: база `apps/mcp` в `data/` и обезличенная копия `analysis/` (своя модель угроз); аутентифицированный шифр
(решение 3); смена ключа (rekey) и бэкапы; чтение базы десктопа снаружи (будущий MCP-режим — забота самого приложения).

## Модель угроз

«Сейчас» — версия 0.1.3 плюс уже влитые блокировка и права 0700: база — обычный SQLite, папка `userData` 0700 на macOS/Linux (`restrictUserData`), профиль
Windows закрыт ACL. «С фичей» — эта спека.

| Угроза | macOS | Windows | Linux с keyring | Linux без keyring |
|---|---|---|---|---|
| Украден выключенный ноутбук, диск зашифрован (FileVault / BitLocker / LUKS) | ✅ и сейчас | ✅ и сейчас | ✅ и сейчас | ✅ и сейчас |
| Украден ноутбук без шифрования диска | ✅ ключ в Keychain под паролем входа | ✅ ключ под DPAPI (пароль входа) | ✅ ключ в keyring | ❌ база не зашифрована (решение 1) |
| Копия `userData` на флешку, в облако, в незашифрованный бэкап | ✅ без Keychain этой учётной записи файл бесполезен | ⚠️ бесполезен без DPAPI этой учётной записи; `Local State` в той же папке — половина ключевого материала, но без DPAPI не раскрывается | ✅ | ❌ |
| Другая учётная запись без прав администратора | ✅ и сейчас (0700) | ✅ и сейчас (ACL профиля) | ✅ и сейчас (0700) | ✅ и сейчас (0700) |
| Администратор / root того же компьютера | ⚠️ файл прочитает, ключ — только с паролем пользователя от Keychain | ⚠️ сброс пароля администратором = потеря DPAPI-ключа, а не раскрытие (факт 27) | ⚠️ как macOS | ❌ |
| Программа под той же учётной записью | ⚠️ без ACL будет системный запрос Keychain | ❌ DPAPI расшифрует любому процессу пользователя | ❌ любой клиент Secret Service | ❌ |
| Подмена байтов в файле базы | ❌ шифр без аутентификации: данные портятся (`malformed`), подмена не обнаруживается как атака (факт 14) | ❌ | ❌ | ❌ |
| Компьютер разблокирован, приложение открыто | ❌ задача блокировки (PIN) | ❌ | ❌ | ❌ |
| Дамп памяти main / worker | ❌ ключ и данные в памяти | ❌ | ❌ | ❌ |
| Старый открытый файл до миграции: свободные блоки диска, снимки APFS, Time Machine, теневые копии Windows, облачная синхронизация `userData` | ❌ миграция заменяет файл через `rename`, байты старого файла не затираются, снимки и бэкапы остаются открытыми | ❌ | ❌ | — |

Последняя строка идёт в заметки к релизу: «данные, попавшие в бэкапы до 0.1.4, остаются в них открытыми».

В UI и README — только «база зашифрована», никогда «защищена от изменений» (решение 3).

## Решения

1. **Linux без надёжного хранилища** → база остаётся незашифрованной, в настройках постоянная плашка. Когда хранилище
   появится, база шифруется при следующем запуске сама.
2. **«Начать заново» после потери ключа** → токены сохраняются, если расшифровываются. Токены лежат по id подключения,
   а подключения живут в удаляемой базе, поэтому «сохранить токены» = пересоздать подключения (раздел «Начать заново»).
3. **Шифр** — встроенный в libsql AES-256-CBC (sqlite3mc), без HMAC. Альтернативы (`better-sqlite3-multiple-ciphers`,
   Turso Database) не берём.
4. **Ключ PIN не оборачиваем.** PIN остаётся блокировкой интерфейса, `lock.json` не связан с ключом; импорт под замком
   после перезапуска открывает базу без пользователя.
5. **Проверка шифра на Windows** → `windows-latest` в матрицу job `test` в `.github/workflows/release.yml` +
   проверка в `apps/desktop/tests/release-workflow.test.ts`. Это **изменение якоря доверия** — отдельный этап, только после
   явного «ок» пользователя.
6. **Надёжность хранилища токенов на Linux** (префикс шифротекста `v11`/`v12` против `v10`, `shouldReEncrypt`) —
   отдельный этап **до** этапов шифрования: ключ базы опирается на ту же проверку.
7. **Сбой миграции** → работа без шифрования, повтор при следующем запуске; старая база не трогается.
8. **Keychain на обновлении ad-hoc-сборки** («Запретить» / «Разрешить») проверяется в смоуке фичи (нужны две сборки
   подряд).

Контекст: подпись Developer ID на macOS отложена (бюджет), поэтому запрос Keychain после каждого обновления — обычный,
повторяющийся сценарий, а не редкая авария (факт 25, electron#43233 «not planned»). Экран «ключ недоступен» — штатный
экран, а не страница ошибки. Подпись Windows — через SignPath; спеку это не затрагивает, релизный процесс не меняется,
кроме матрицы тестов.

## Архитектура

### Модули main

Новая папка `apps/desktop/src/main/db/` (как `lock/`) и общий модуль хранилища:

| Файл | Что делает | Electron |
|---|---|---|
| `main/secure-store.ts` | `SecureStore`: обёртка над `safeStorage` для токенов и ключа — проверка надёжности, классификация ошибок, `shouldReEncrypt` | нет, `SafeStorageLike` передаётся снаружи |
| `main/db/header.ts` | `dbFileKind(file)`: `missing` / `plain` / `other` по первым 16 байтам | нет |
| `main/db/key-vault.ts` | `DbKeyVault`: создать, прочитать, удалить `db-key.bin` | нет |
| `main/db/encrypt.ts` | `encryptDatabase()`: crash-safe миграция открытой базы в зашифрованную | нет |
| `main/db/access.ts` | `DbAccess`: определение состояния при запуске, открытие, ключ для worker, «Начать заново», сброс после wipe | нет |

`electron` в этих файлах не импортируется: `safeStorage`, `app.relaunch` и диалоги приходят из `index.ts` зависимостями
(как у `LockService`). Все тесты — на Node, без Electron.

### `SecureStore` (этап 1)

```ts
// apps/desktop/src/main/secure-store.ts
export type SafeStorageLike = { … }; // переезжает сюда из token.ts без изменений
export type Reliability = 'secure' | 'insecure' | 'unavailable';
export type Decrypted =
  | { kind: 'ok'; value: string; reencrypted: Buffer | null } // reencrypted — новый blob, если shouldReEncrypt и он надёжен
  | { kind: 'unavailable' }  // «temporarily unavailable»: у провайдера сейчас нет ключа (Keychain «Запретить», keyring заблокирован)
  | { kind: 'failed' };      // окончательная ошибка: другой ключ провайдера, повреждённый blob

export class SecureStore {
  constructor(deps: { safeStorage: SafeStorageLike; platform: NodeJS.Platform });
  /** Кешируется на процесс (как объект шифрования Chromium, факт 23). */
  reliability(): Promise<Reliability>;
  /** null — шифротекст ненадёжен (Linux v10) или шифрование недоступно: ничего не записывать. */
  encrypt(plain: string): Promise<Buffer | null>;
  decrypt(blob: Buffer): Promise<Decrypted>;
}
/** Linux: надёжен только `v11` (Secret Service / KWallet) и `v12` (Secret Portal); на macOS и Windows — любой успешный. */
export function blobReliable(blob: Buffer, platform: NodeJS.Platform): boolean;
export function classifyDecryptError(err: unknown): 'unavailable' | 'failed';
```

- `reliability()`: `isAsyncEncryptionAvailable()` = false → `insecure`; иначе шифрует пробную строку. Исключение →
  `unavailable`; на Linux префикс не `v11`/`v12` → `insecure`; иначе `secure`. `getSelectedStorageBackend()` больше не
  решает (факт 28), остаётся только в логе dev как диагностика.
- `classifyDecryptError`: сообщение содержит `temporarily unavailable` → `unavailable`, иначе `failed`. Тексты ошибок —
  из исходников Electron 44 (факт 22), на живой системе **не проверено**; смоук проверяет, что «Запретить» даёт
  `unavailable`. Экран при этом устроен так, что ошибка классификации не приводит к потере данных (см. «Экран»).
- `shouldReEncrypt`: `decrypt` сам перешифровывает; вызывающий перезаписывает файл атомарно, только если новый blob
  надёжен. Если перешифровка не удалась — значение всё равно возвращается, файл остаётся прежним.

Изменения `TokenVault` (`apps/desktop/src/main/token.ts`) в том же этапе:
- `secureStorageAvailable()` = `store.reliability() === 'secure'`; `INSECURE_BACKENDS` удаляется;
- `set()` пишет файл, только если `store.encrypt()` вернул blob;
- `get()`: `unavailable` → `null` **без удаления файла** и без `needsReentry` (сейчас `get()` удаляет файл при
  любой ошибке, в том числе после «Запретить»: после перезапуска и «Разрешить» токен был бы уже потерян);
  `failed` → как сейчас, `needsReentry`, файл удаляется; `reencrypted` → перезапись файла (tmp + rename, 0600).

### Файлы в `userData`

| Файл | Содержимое | Кто пишет |
|---|---|---|
| `monobank.db`, `-wal`, `-shm`, `-journal` | база, зашифрована ключом (или открыта: Linux без keyring, сбой миграции) | libsql |
| `db-key.bin` (+ `.tmp`) | `safeStorage`-blob 64 hex-символов, 0600 | `DbKeyVault` |
| `monobank.db.encrypting` (+ `-journal`) | временная зашифрованная копия во время миграции | `encryptDatabase` |

Папка `userData` — 0700 (`restrictUserData`, macOS/Linux), это вторая линия; права файла ключа 0600 ставятся всё равно.

### `DbKeyVault` (этап 4)

```ts
// apps/desktop/src/main/db/key-vault.ts
export const DB_KEY_FILE = 'db-key.bin';
export type KeyLoad =
  | { kind: 'ok'; key: string }
  | { kind: 'missing' }       // файла нет
  | { kind: 'unavailable' }   // SecureStore.decrypt → unavailable
  | { kind: 'lost' };         // failed, или расшифровалось не в /^[0-9a-f]{64}$/
export type KeyCreate = { kind: 'ok'; key: string } | { kind: 'insecure' } | { kind: 'unavailable' };

export class DbKeyVault {
  constructor(deps: { store: SecureStore; userDataDir: string; randomBytes?: (n: number) => Buffer });
  load(): Promise<KeyLoad>;
  /** Новый ключ, записан и прочитан обратно. Существующий файл перезаписывается только здесь. */
  create(): Promise<KeyCreate>;
  clear(): Promise<void>;  // db-key.bin и .tmp
}
```

`create()`: `crypto.randomBytes(32).toString('hex')` → `store.encrypt` (null → `insecure`/`unavailable` по
`reliability()`) → `db-key.bin.tmp` с `0o600` → `fh.sync()` → `rename` → `fsync` папки (macOS/Linux) → `load()` и
сравнение с ключом в памяти. Только после успешного чтения обратно ключ считается сохранённым. **Инвариант: зашифрованная
база появляется на диске только после того, как её ключ надёжно записан и прочитан обратно.**

Ключ в `DbKeyVault` не кешируется — его держит `DbAccess`.

### Определение состояния при запуске (этап 5)

`DbAccess.init()` вызывается в `index.ts` после `restrictUserData`, **до** `vault.migrateLegacy`, `Importer`,
`runDbSmoke`, регистрации IPC и создания окна. Сначала удаляются `monobank.db.encrypting` и его `-journal` (остаток
прерванной миграции). Потом:

| # | `dbFileKind` | `db-key.bin` | `reliability()` | Действие | Итог |
|---|---|---|---|---|---|
| 1 | `missing` | нет | `secure` | `create()` → открыть с ключом (файл создаётся зашифрованным) | `ready`, encrypted |
| 2 | `missing` | нет | `insecure` | открыть без ключа | `ready`, plain, notice `no-secure-storage` |
| 3 | `missing` | нет | `unavailable` | открыть без ключа (данных нет — терять нечего), повтор при следующем запуске | `ready`, plain, notice `encrypt-pending` |
| 4 | `missing` | есть | — | `load()`: `ok` → открыть с ним; `lost` → `create()` (данных нет); `unavailable` → как строка 3 | `ready` |
| 5 | `plain` | нет | `secure` | `create()` → `encryptDatabase` | `ready`, encrypted; сбой → plain, notice `encrypt-pending` |
| 6 | `plain` | есть | `secure` | `load()`: `ok` → `encryptDatabase` (продолжение после аварии между ключом и миграцией); `lost` → `create()` → миграция; `unavailable` → plain | как строка 5 |
| 7 | `plain` | любой | `insecure` | открыть без ключа, файл ключа не трогать | `ready`, plain, notice `no-secure-storage` |
| 8 | `plain` | любой | `unavailable` | открыть без ключа | `ready`, plain, notice `encrypt-pending` |
| 9 | `other` | нет | — | ничего не открывать, ничего не удалять | `key-lost` |
| 10 | `other` | есть | — | `load()`: `ok` → открыть с ключом → `migrate` core; `SQLITE_NOTADB` → `db-unreadable` | `ready` / `db-unreadable` |
| 11 | `other` | есть | — | `load()` → `unavailable` | `key-unavailable` |
| 12 | `other` | есть | — | `load()` → `lost` | `key-lost` |

- `dbFileKind`: файла нет или 0 байт → `missing` (пустой файл SQLite считает пустой базой); первые 16 байт =
  `SQLite format 3\0` → `plain`; иначе (зашифрованный файл, мусор, файл короче 16 байт) → `other`. Проверяется только
  основной файл; `-wal` при `plain` — забота `encryptDatabase`.
- Строка 11 на Linux, где keyring был, а сейчас заблокирован: `decrypt` blob `v11` без keyring — `unavailable` или
  `failed`, **не проверено**; оба ведут на экран с «Перезапустить».
- **База никогда не удаляется автоматически.** Строки 9–12 только выставляют состояние.
- Все исходы пишутся в лог одной строкой без ключа: `[db] state=ready encrypted=true` / `[db] state=key-unavailable` /
  `[db] encrypt failed at step=copy: SqliteError`.

```ts
// apps/desktop/src/main/db/access.ts
export type DbNotice = 'no-secure-storage' | 'encrypt-pending';
export type DbState =
  | { kind: 'ready'; encrypted: boolean; notice: DbNotice | null }
  | { kind: 'key-unavailable' }
  | { kind: 'key-lost' }
  | { kind: 'db-unreadable' };

export class DbOpenError extends Error {
  override name = 'DbOpenError';
  constructor(readonly kind: 'unavailable' | 'unreadable') { super(kind === 'unavailable' ? 'База недоступна' : 'База не открывается'); }
}

export class DbAccess {
  constructor(deps: {
    userDataDir: string;
    keys: DbKeyVault;
    store: SecureStore;
    openDb: (url: string, opts?: { encryptionKey?: string }) => Promise<Db>;  // openLibsql
    encrypt: typeof encryptDatabase;
    nowSec: () => number;
    onChange: (view: DbStateView) => void;
    log: (msg: string) => void;
  });
  init(): Promise<DbState>;
  state(): DbState;
  view(): DbStateView;               // то, что уходит в renderer
  isReady(): boolean;
  /** Фабрика для DataService: открывает с ключом, если он есть. Не ready → DbOpenError('unavailable'). */
  open(): Promise<Db>;
  /** Для Importer: путь и ключ (null в plain-режиме). Не ready → null. */
  forWorker(): { dbPath: string; dbKey: string | null } | null;
  /** После «Удалить все данные»: ключа и базы нет → как строка 1/2/3 при следующем open(). */
  afterWipe(): Promise<void>;
  startOver(): Promise<StartOverResult>;
}
```

`open()` при `SQLITE_NOTADB` в работе (не при запуске) переводит состояние в `db-unreadable` и сообщает через
`onChange`. `DataService` (`apps/desktop/src/main/data.ts`) не меняется: его `open` = `() => access.open()`, ключ он не
видит; неудачный `open` не кешируется, как сейчас.

### Миграция существующей базы (этап 6)

`encryptDatabase({ file, key, openDb, fs, fault?, log })` → `{ ok: true } | { ok: false; step: MigrationStep }`.
Выполняется, когда соединение с базой единственное: до `DataService`, `Importer` (worker не запущен), `runDbSmoke`;
второй экземпляр приложения исключён `requestSingleInstanceLock`, `apps/mcp` базу десктопа не открывает.

```ts
export const MIGRATION_STEPS = ['checkpoint', 'attach', 'copy', 'verify', 'sync', 'swap', 'cleanup'] as const;
export type MigrationStep = (typeof MIGRATION_STEPS)[number];
```

| Шаг | Что делается | Сбой на шаге |
|---|---|---|
| `checkpoint` | открыть старую базу **без** ключа; `PRAGMA wal_checkpoint(TRUNCATE)`; результат `busy = 0`; `PRAGMA foreign_keys = OFF` (вне транзакции); собрать эталон: `sqlite_schema` (type, name, tbl_name, sql), `count(*)` каждой таблицы, `sqlite_sequence`, `MAX(version)` из `schema_migrations`, `user_version` | закрыть соединение; удалить tmp; старая база цела |
| `attach` | `ATTACH DATABASE ? AS enc KEY ?` с аргументами `[tmp, key]` (привязка, а не подстановка: ключ не попадает в текст SQL; работает ли привязка в `ATTACH … KEY` у libsql — **не проверено**, иначе подстановка hex без кавычек, как в брифе); `PRAGMA enc.journal_mode = DELETE` | то же |
| `copy` | одной транзакцией: объекты схемы в порядке table → index → view → trigger с префиксом `enc.`; `INSERT INTO enc."t" SELECT * FROM main."t"`; `DELETE FROM enc.sqlite_sequence` + `INSERT INTO enc.sqlite_sequence SELECT * FROM main.sqlite_sequence`; `PRAGMA enc.user_version = …`; затем `DETACH`, закрыть соединение; проверить, что `monobank.db-wal` отсутствует или пуст | то же |
| `verify` | открыть tmp **новым** соединением с ключом: `integrity_check = ok`, `foreign_key_check` пуст, схема совпадает с эталоном (текст `sql` без префикса `enc.`), `count(*)` каждой таблицы, `sqlite_sequence`, `MAX(version)`, `user_version` совпадают; закрыть | то же |
| `sync` | `fh.sync()` tmp | то же |
| `swap` | удалить `monobank.db-shm` и пустой `monobank.db-wal` старой базы; `rename(tmp, monobank.db)`; `fsync` папки (macOS/Linux) | до `rename`: как выше (старый файл на месте, его WAL уже пуст после checkpoint). Windows: `rename` поверх файла, занятого антивирусом или индексатором, даёт `EPERM`/`EBUSY` — до 5 повторов с паузой 100–500 мс, **не проверено** |
| `cleanup` | удалить `monobank.db.encrypting-journal`, если остался | новая база уже на месте: только лог, состояние `ready`, encrypted |

- Сбой на любом шаге до `swap` включительно (до `rename`) → tmp и его `-journal` удаляются, старая база открывается без
  ключа, состояние `ready`, plain, notice `encrypt-pending`; ключ остаётся в `db-key.bin`, миграция повторится при
  следующем запуске (строка 6).
- Авария процесса на любом шаге: при следующем запуске tmp удаляется (начало `init`), дальше строка 6 — миграция
  заново. Авария после `rename`: база зашифрована, ключ записан раньше (инвариант `DbKeyVault`) → строка 10.
- `ENOSPC` (копии нужно место размером с базу) — обычный сбой шага `copy`.
- Время: 30 000 строк — порядка 0,4 с (факт 15); окно создаётся после миграции.

**Схема core.** По `packages/core/src/db.ts`: только таблицы и индексы, view и trigger нет; `AUTOINCREMENT` есть
(`api_calls`, `category_overrides`, `scope_overrides`, `participants`, `connections`) → `sqlite_sequence` переносится
обязательно (бриф помечал как «не проверено»: теперь ясно, что нужно). Таблицы `transactions`, `sync_state`, `accounts`
пересоздавались через `ALTER TABLE … RENAME`: по документации SQLite их `sql` в `sqlite_schema` после переименования
содержит имя в кавычках (`CREATE TABLE "transactions"`), а `IF NOT EXISTS` в сохранённом тексте не остаётся — **не
проверено на схеме core**. Поэтому префикс `enc.` вставляется не регуляркой из брифа, а разбором начала оператора:
`CREATE [UNIQUE] (TABLE|INDEX|VIEW|TRIGGER) [IF NOT EXISTS] <имя | "имя">`; имя сверяется с `sqlite_schema.name`,
несовпадение — сбой шага `copy`. Тест прогоняет все объекты текущей схемы (`SCHEMA_VERSION`) и падает на новом виде
объекта. `sqlite_autoindex_*` (`sql IS NULL`) пересоздаются из ограничений сами.

Вариант без переписывания текста (открытый вопрос 2): соединение открыто на **новом** файле с ключом, старый подключён
`ATTACH ? AS old KEY ''` (пустой ключ = без шифрования в sqlite3mc — по документации, **не проверено**), `CREATE` идут
как есть, `INSERT INTO main."t" SELECT * FROM old."t"`.

**Смена ключа в будущем** — та же процедура (`PRAGMA rekey` в WAL не работает, факт 10).

### Ключ в worker (этап 7)

- `apps/desktop/src/shared/import-protocol.ts`: `export const DB_KEY_RE = /^[0-9a-f]{64}$/;`
  `StartMessage` += `dbKey: z.string().regex(DB_KEY_RE).nullable()` (null только в plain-режиме). Шапка файла:
  «Tokens and the database key appear in exactly one message: `start`».
- `Importer` (`apps/desktop/src/main/importer.ts`): зависимость `dbPath: string` → `db: () => { dbPath: string; dbKey: string | null } | null`
  (`access.forWorker()`). `launch()` берёт её в момент запуска (перезапуск после падения worker — тоже); null →
  `{ started: false, reason: 'db-unavailable' }` (`StartImportResult` в `src/shared/progress.ts` расширяется).
  `resumeOnLaunch()` при не-ready базе ничего не делает.
- Ключ передаётся **только** через `postMessage`: `fork()` по-прежнему без аргументов и с `env: {}` — ни в argv (виден
  в `ps`), ни в окружении. `import-job.json` (`sinceSec`, `depth`, `startedAt`) не меняется.
- `apps/desktop/src/worker/import.ts`: `openLibsql(\`file:${msg.dbPath}\`, msg.dbKey ? { encryptionKey: msg.dbKey } : {})`.
  Ошибка открытия уже сводится к `err.name` в `log` и фиксированному тексту в `error` — закрепляется тестом с канарейкой.
- Неверный ключ в worker (не должно случаться) → `SQLITE_NOTADB` → `error` kind `other`, задача остаётся на следующий
  запуск; файл не меняется (факт 7).

### Адаптер (этап 2)

`packages/db-libsql/src/index.ts`: `openLibsql(url: string, opts: { encryptionKey?: string } = {})`; ключ уходит в
`createClient` только если задан. Второй аргумент необязателен — `apps/mcp/src/db.ts`, тесты core и
`recategorize` не меняются, `recategorize-safety.test.ts` остаётся зелёным (новых импортов нет). Ключ — голый hex, не
`x'…'` (бриф, раздел 5).

### Состояние в renderer, IPC и push (этап 8)

```ts
// apps/desktop/src/shared/db-state.ts — без импортов, как shared/lock.ts
export type DbStatus = 'ready' | 'key-unavailable' | 'key-lost' | 'db-unreadable';
export type DbStateView = {
  status: DbStatus;
  encrypted: boolean;
  notice: 'no-secure-storage' | 'encrypt-pending' | null;
  platform: 'darwin' | 'win32' | 'linux' | 'other';  // только для текста экрана
};
export type StartOverResult = { done: true; restoredConnections: number } | { done: false; reason: 'cancelled' | 'not-needed' };
```

В `DbStateView` нет ни одной произвольной строки — только перечисления, boolean и число: ключ туда не поместится
даже по ошибке (тест проверяет форму).

`apps/desktop/src/shared/channels.ts`: методы `getDbState`, `relaunchApp`, `startOver`, `quitApp`; push
`DB_STATE_CHANNEL = 'balance:db-state'`. Схемы в `ARG_SCHEMAS` — `z.tuple([])`. Типы — в `BalanceApi`
(`apps/desktop/src/shared/api.ts`), `onDbState(cb)` в preload.

**IPC-шлюз** (`apps/desktop/src/main/ipc.ts`). Порядок: отправитель → замок → **база** → аргументы → обработчик.

```ts
export const DB_UNAVAILABLE = 'База недоступна';
export const ALLOWED_WHEN_DB_UNAVAILABLE = [
  ...ALLOWED_WHEN_LOCKED,            // getLockState, unlockWithPin, unlockWithTouchId, deleteAllData
  'lockNow', 'getDbState', 'relaunchApp', 'startOver', 'quitApp',
] as const satisfies ReadonlyArray<Method>;
```

`registerIpc(…, { trusted, locked, dbReady, onError })`. Под замком — как сейчас, только `ALLOWED_WHEN_LOCKED`
(`getDbState` туда не входит: экран блокировки состояние базы не показывает). База не ready — только
`ALLOWED_WHEN_DB_UNAVAILABLE`, остальное — `DB_UNAVAILABLE`. Исключение `dbReady()` — как у `locked()`: отказ.
`relaunchApp` и `startOver` при ready-базе отвечают отказом в обработчике (`startOver` не должен стать вторым путём
wipe).

**Push** (`apps/desktop/src/main/lock/gate.ts`): `gatedPush(isLocked, isDbReady, send)` — под замком только
`LOCK_CHANNEL`; база не ready — `LOCK_CHANNEL` и `DB_STATE_CHANNEL`; иначе всё. Прогресс импорта, обновления и
«Настройки…» при недоступной базе отбрасываются. `webContents.send` остаётся только внутри колбэка `gatedPush`
(`tests/window.test.ts` проверяет это регуляркой — новый аргумент её не ломает).

**Обработчики** в `index.ts`: `getDbState` → `access.view()`; `relaunchApp` → `app.relaunch(); app.quit()` (повтор в том
же процессе бесполезен — объект шифрования кешируется, факт 23; `quit`, а не `exit`: `before-quit` отрабатывает);
`quitApp` → `app.quit()`; `startOver` → `access.startOver()`.

### Экран «База недоступна» (этап 8)

Renderer (FSD, правила `tests/architecture.test.ts`):
- `entities/db-state` — Pinia setup-store (`view`, `ready`, `refresh()`, `set()`), `api/useDbStateRequest.ts`;
- `features/db-recovery` — `DbRecoveryFeature.vue`, `composables/useDbRecovery.ts`, `api/useDbRecoveryRequest.ts`
  (`relaunchApp`, `startOver`, `quitApp`, `deleteAllData`), тексты в `constants.ts`;
- `features/db-encryption` — `DbEncryptionFeature.vue`, карточка в `widgets/settings` (статус и плашка);
- `pages/db-recovery` — тонкая оболочка; `ROUTE.dbRecovery` в `shared/config/routes.ts`;
- `app/router/guards.ts`: замок → `ROUTE.lock`; затем `dbState` (ждёт `refresh()`, как ждёт замок) не `ready` → любой
  маршрут, включая настройки, → `ROUTE.dbRecovery`; с `ROUTE.dbRecovery` при ready → `startRoute`;
- `app/listeners.ts`: `onDbState` → `set()` + `router.replace`, как у `onLock`.

Тексты по статусу (без подробностей ошибки):

| Статус | Заголовок | Пояснение |
|---|---|---|
| `key-unavailable` | «Нет доступа к ключу базы» | macOS: «Разрешите доступ в запросе Связки ключей — он появится после перезапуска». Linux: «Разблокируйте связку ключей (keyring) и перезапустите». Windows: «Системное хранилище ключей не ответило» |
| `key-lost` | «Ключ базы потерян» | «Ключ, которым зашифрована база, больше не читается (переустановка без подписи, удалённая запись в Связке ключей, перенос на другой компьютер). Открыть эту базу нельзя» |
| `db-unreadable` | «База не открывается» | «Файл базы повреждён или зашифрован другим ключом» |

Кнопки — одни и те же при любом статусе (ошибка классификации `unavailable`/`failed` не отнимает ни одного пути):
1. «Перезапустить» — основная при `key-unavailable`;
2. «Начать заново» — основная при `key-lost` / `db-unreadable`;
3. «Удалить все данные» — как в настройках;
4. «Выйти».

### «Начать заново»

`DbAccess.startOver()` (в `index.ts` связывается с `TokenVault`, `PeopleService`, `Importer`, диалогом):
1. Системный диалог: «Начать заново? Загруженные операции, люди и их имена, оверрайды и настройки будут удалены.
   Сохранённые токены останутся, если их удастся прочитать — операции загрузятся из банка заново». Нет → `cancelled`.
2. `importer.stop()` (при недоступной базе он не запущен — на всякий случай), `data.close()`.
3. Для каждого `tokens.saved()`: `tokens.get(id)`; прочитанные — в память вместе с провайдером (по форме токена,
   `DESKTOP_PROVIDERS[p].credential`; ни одного или больше одного совпадения — токен не берётся).
4. `tokens.clearAll()`; удалить `DB_FILES` (база, `-wal`, `-shm`, `-journal`, `.encrypting`, `.encrypting-journal`) и
   `JOB_FILE`; `keys.clear()`.
5. `init()` заново — строки 1–3 таблицы (новый ключ, пустая база).
6. Для каждого прочитанного токена — `people.addConnection({ participant: { fromBank: true }, provider, token, remember: true })`:
   новое подключение, участник с именем из банка при первом импорте. Имена, которые вводил пользователь, пропадают.
7. Состояние `ready` → push → главный экран (`startRoute`: подключения есть, данных нет → главный с кнопкой импорта;
   импорт сам не запускается).

При `key-unavailable` токены, скорее всего, тоже не прочитаются (тот же пароль Keychain): диалог это говорит, после
`startOver` их нужно ввести заново. `lock.json` не трогается.

### Linux без надёжного хранилища (этап 9)

Строки 2, 7 таблицы: база открыта, `DbStateView.notice = 'no-secure-storage'`. В настройках постоянная карточка
`DbEncryptionFeature`: «База не зашифрована: на этом компьютере нет надёжного хранилища ключей (keyring). Когда оно
появится, приложение зашифрует базу при следующем запуске». Это та же причина, по которой токены хранятся только в
памяти (`TokenStatus.secureStorage`). `encrypt-pending`: «Зашифровать базу не удалось — приложение попробует при
следующем запуске». `encrypted`: «База на этом компьютере зашифрована; ключ хранится в Связке ключей / DPAPI / keyring».

### Удаление данных (этапы 4 и 6)

`apps/desktop/src/main/wipe.ts`:
- `OTHER_FILES` += `db-key.bin`, `db-key.bin.tmp`, `monobank.db.encrypting`, `monobank.db.encrypting-journal`
  (каждый — в этапе, где файл появляется);
- `WipeDeps` += `dbKey: { clear(): Promise<void> }`;
- порядок: подтверждение → `tokens.clearAll()` → **`dbKey.clear()`** → `importer.stop()` → `data.close()` →
  `OTHER_FILES` → `APP_DIRS` → `LOCK_FILES` последними (как сейчас: сбой посередине не оставит данные без замка);
  затем в `index.ts` — `appLock.reset()` и `access.afterWipe()`.
- Ключ удаляется до базы: если файл базы не удалится (Windows держит файл), остаток уже нечитаем. Упавший wipe после
  удаления ключа → при следующем запуске строка 9 (`key-lost`) → «Начать заново» / «Удалить все данные».
- Текст `confirmDelete` в `index.ts`: «…загруженные операции, ключ базы, сохранённые токены, блокировка и незавершённый
  импорт…».
- `Local State` (Windows) — служебный файл Electron, wipe его не трогает, как и сейчас.

### Логи и ключ

- Ключ держат: `DbAccess` (private поле), аргумент `openDb`, сообщение `start`, память worker. Больше нигде.
- Логи main — `[db] …` только состояние, шаг миграции и `err.name`. Никогда `err.message` ошибок libsql в миграции
  (сообщение может содержать текст SQL; ключ в SQL не подставляется, но правило общее).
- `runDbSmoke` (`apps/desktop/src/main/smoke.ts`, только dev) сейчас открывает файл сам и без ключа: на зашифрованной
  базе это `NOTADB`, а на отсутствующей — создание **открытого** файла. Меняется на `runDbSmoke(open: () => Promise<Db>)`
  с `access.open()`, запускается после `init()`, выводит `encrypted: boolean`. Сообщение ошибки смоука — только `err.name`.
- JS-строку нельзя затереть в памяти — принято (строка «дамп памяти» в модели угроз).

## Порядок запуска в `index.ts`

```
configureIdentity → enableSandbox → … → whenReady:
  меню, сессия, протокол
  restrictUserData
  store = new SecureStore(...)
  vault = new TokenVault({ store, … })
  access = new DbAccess(...); await access.init()        ← здесь может появиться запрос Keychain
  data = new DataService({ open: () => access.open(), … })
  if (access.isReady() && vault.hasLegacy()) migrateLegacy(...)
  importer = new Importer({ db: () => access.forWorker(), … })
  updater, lock = new LockService(...), people, registerIpc(..., { locked, dbReady: () => access.isReady() })
  dev: runDbSmoke(() => access.open())
  окно; did-finish-load → push LOCK / DB_STATE / PROGRESS / UPDATE (через gatedPush);
                          первый раз: if (access.isReady()) importer.resumeOnLaunch(); scheduleChecks(updater)
```

`init()` ждётся до создания окна: запрос Keychain приходит до окна и никогда не накладывается на автоматический запрос
Touch ID экрана блокировки (`useUnlock` → `shouldAutoPromptTouchId`, коммит f04a0b0). Цена: если на запрос никто не
отвечает, окно не появляется, пока он висит (открытый вопрос 4).

## Взаимодействие с блокировкой и импортом

| Ситуация | Что видит пользователь | Импорт | Обновления |
|---|---|---|---|
| Замок закрыт, база ready | экран блокировки (PIN / Touch ID, автозапрос Touch ID) | идёт, «Идёт импорт» на экране | проверка и скачивание идут, установка после разблокировки |
| Замок закрыт, база не ready | **экран блокировки** (замок главнее), после разблокировки — экран «База недоступна» | не запускается | как строкой выше |
| Замок открыт / выключен, база не ready | экран «База недоступна», настройки недоступны, «Настройки…» из меню ничего не делает | не запускается, `startImport` → `DB_UNAVAILABLE` | фоновые проверки и скачивание идут (им база не нужна); push обновлений отброшен; скачанное и проверенное обновление ставится при выходе (Windows, AppImage) — в том числе при «Перезапустить» |
| Перезапуск под замком, ключ читается | Keychain без запроса (приложение в ACL) → экран блокировки | `resumeOnLaunch` продолжает задачу без PIN (решение 4) | обычно |
| Первый запуск после обновления неподписанной сборки (macOS) | до окна — системный запрос Keychain. «Разрешить» → как строкой выше; «Запретить» → экран блокировки (если включена) → «Нет доступа к ключу базы» | не запускается; задача остаётся в `import-job.json` | обычно |
| «Перезапустить» с экрана | новый процесс → снова запрос Keychain → (замок) → данные | продолжается сам | — |

Почему замок главнее: экран «База недоступна» предлагает «Начать заново» — разрушительное действие, которое не должен
получить человек за чужим незаблокированным компьютером. «Удалить все данные» под замком доступно, как и сейчас, только
через «Забыли PIN?» после 5 ошибок или при повреждённом `lock.json`.

Триггеры блокировки (простой, экран, сон) работают при любом состоянии базы: `webContents.reload()` → guard → замок.
Импорт под замком и после перезапуска работает, потому что ключ не зависит от PIN; задача импорта при недоступной базе
не теряется — `resumeOnLaunch` подхватит её после «Перезапустить» + «Разрешить».

## Ошибки и крайние случаи

| Случай | Поведение |
|---|---|
| «Запретить» в запросе Keychain | `key-unavailable`; токены на диске **не удаляются** (изменение `TokenVault.get`, этап 1) |
| «Всегда разрешать» на ad-hoc-сборке | запрос не появится до следующего обновления (DR ad-hoc = cdhash, **не проверено**, факт 26) |
| Пользователь удалил запись «Balance Insights Safe Storage» в Связке ключей | Chromium создаёт новый пароль (факт 24) → ключ и токены `failed` → `key-lost`; токены `needsReentry` |
| Удалён / испорчен `db-key.bin` при зашифрованной базе | `key-lost` |
| Удалён `db-key.bin` при открытой базе | строка 5: новый ключ, миграция |
| Windows: перенос `userData` без `Local State` или сброс пароля администратором | `failed` → `key-lost` |
| Linux: keyring был, теперь заблокирован / нет D-Bus | `key-unavailable` (или `key-lost`, **не проверено**) — «Перезапустить» есть в обоих |
| Linux: keyring появился у пользователя с открытой базой | строка 5 при следующем запуске |
| Авария посреди миграции | tmp удаляется при следующем запуске, миграция заново (строка 6) |
| Нет места на диске при миграции | сбой шага `copy`, plain + `encrypt-pending` |
| `SQLITE_NOTADB` с верным по форме ключом | `db-unreadable`; «неверный ключ» и «повреждённый файл» не различаются (риск 10 брифа) |
| Подмена байтов в зашифрованном файле | не обнаруживается как атака: `malformed` при чтении или незаметно (факт 14) |
| Ключ не в форме hex дошёл бы до worker | worker молча игнорирует невалидный `start` и не выходит (таймаута у main на это нет), поэтому `Importer` сам проверяет `StartMessage.parse` до `postMessage`: сбой → `{ started: false, reason: 'db-unavailable' }` и лог без содержимого |
| Два экземпляра приложения | второй выходит (`requestSingleInstanceLock`) до `init()` |
| Wipe упал после удаления ключа | следующий запуск: `key-lost` → «Начать заново» / «Удалить все данные» |
| `startOver` упал посередине | повтор `init()` при следующем запуске сводит к одной из строк таблицы; база не удаляется повторно без подтверждения |
| `restrictUserData` не сработал | лог, как сейчас; `db-key.bin` всё равно 0600 |

## Тесты по этапам

Везде: временная папка в `os.tmpdir()`, фейковый `safeStorage` (по образцу `tests/token.test.ts`), ключ-канарейка
вида `'c0ffee…'` (64 hex) и канареечный текст в строках базы. `pnpm test` и `pnpm typecheck` в корне на каждом этапе.

1. **`SecureStore` + `TokenVault`** (`tests/secure-store.test.ts`, `tests/token.test.ts`): Linux `v10` → `insecure`,
   `v11`/`v12` → `secure`, исключение при шифровании → `unavailable`; macOS/Windows: любой успешный blob — `secure`;
   `classifyDecryptError` для двух текстов Electron и произвольной ошибки; `shouldReEncrypt` → перезапись файла
   (атомарно, 0600), ненадёжный новый blob → файл прежний; `get()` при `unavailable` не удаляет файл и не ставит
   `needsReentry`, при `failed` — как сейчас; канарейка токена не появляется в логах, ошибках, IPC.
2. **Адаптер** (`packages/db-libsql/tests/adapter.test.ts`): заголовок зашифрованного файла ≠ `SQLite format 3`;
   неверный / пустой / отсутствующий ключ → `SQLITE_NOTADB`; открытый файл с ключом → `SQLITE_NOTADB`, файл не изменился
   (sha256 до и после); канарейки нет ни в основном файле, ни в `-wal`; два соединения с одним ключом пишут по очереди;
   без ключа всё как раньше; **детектор шифра**: `sqlite3mc_version()` начинается с `SQLite3 Multiple Ciphers`,
   `PRAGMA cipher` = `aes256cbc` — падает, если libsql соберут без шифрования.
3. **CI (якорь)**: `release-workflow.test.ts` — матрица job `test` ровно `[ubuntu-latest, macos-latest, windows-latest]`.
4. **`DbKeyVault`** (`tests/db-key.test.ts`): `create` → `load` круг; 0600; файл не в форме hex → `lost`; `unavailable`
   / `failed` от store; `create` на Linux `v10` → `insecure`, файл не записан; сбой записи → ни `.tmp`, ни частичного
   файла; ключ не в логах и ошибках. `wipe.test.ts`: `db-key.bin` в `APP_FILES`, удаляется до базы, `LOCK_FILES` —
   последними (порядок через фейки с журналом вызовов).
5. **`DbAccess.init`** (`tests/db-access.test.ts`): каждая строка таблицы состояний отдельным тестом, на реальных файлах
   libsql; строки 9–12 не удаляют и не меняют ни одного файла (хеши до и после); остаток `.encrypting` удаляется;
   `runDbSmoke` на зашифрованной базе.
6. **Миграция** (`tests/db-encrypt.test.ts`): полная копия базы с текущей схемой core (`migrate` + фикстуры с
   вымышленными данными во всех таблицах, удалённые строки для проверки `sqlite_sequence`); для **каждого** шага из
   `MIGRATION_STEPS` — внедрённый сбой (`fault(step)` бросает): старая база открывается без ключа, содержимое совпадает с
   эталоном, tmp и `-journal` удалены, состояние plain + `encrypt-pending`, следующий `init()` доводит миграцию; «авария»
   (tmp оставлен, процесс не доработал) → следующий `init()` чистит и мигрирует; непустой `-wal` после checkpoint →
   отказ до `swap`; после миграции в файле нет канарейки; Windows-ветка `rename` с повторами — на фейковом `fs`.
7. **Worker** (`tests/importer.test.ts`, `tests/worker-entry.test.ts`, `tests/run-import.test.ts`): `StartMessage`
   отвергает не-hex и лишние поля, принимает `null`; `Importer` не отправляет `start`, не прошедший схему; `start` несёт ключ из `access.forWorker()`; `fork` вызывается без
   ключа в аргументах и окружении; не-ready база → `db-unavailable`, `resumeOnLaunch` ничего не делает; worker с
   неверным ключом → `error` без канарейки; ни одно сообщение worker → main (прогресс, `log`, `done`, `error`) не
   содержит канарейку; `import-job.json` без ключа.
8. **IPC, push, renderer** (`tests/ipc.test.ts`, `tests/lock-gate.test.ts`, `tests/window.test.ts`, `tests/renderer/`):
   для каждого метода `METHODS` при не-ready базе — `DB_UNAVAILABLE`, кроме `ALLOWED_WHEN_DB_UNAVAILABLE` (новый метод
   попадает в проверку сам); порядок «отправитель → замок → база → аргументы»; под замком `getDbState` отклоняется;
   `gatedPush` — таблица «канал × замок × база»; `relaunchApp` / `startOver` при ready-базе — отказ; ответы
   `getDbState` на всех состояниях не содержат канарейку (и `DbStateView` — только перечисления); guard: замок → `lock`,
   любой не-ready статус → `dbRecovery` (и настройки тоже), ready на `dbRecovery` → `startRoute`; «Начать заново» без
   подтверждения ничего не удаляет; `startOver` восстанавливает подключения из читаемых токенов и отбрасывает
   нечитаемые; `architecture.test.ts` с новыми слайсами.
9. **Настройки и тексты**: карточка по трём состояниям; нигде в renderer и README нет «защищена от изменений»
   (текстовый тест, как в `repo-files.test.ts`).
10. **Документация**: `CLAUDE.md` — решения этой спеки.

## Этапы

Каждый этап — отдельный коммит (Conventional Commits), `pnpm test` + `pnpm typecheck` зелёные, стоп и короткий отчёт.

| # | Этап | Файлы | Якорь |
|---|---|---|---|
| 0 | Спека (этот файл) → план `docs/superpowers/plans/…-db-encryption.md` | — | нет |
| 1 | `SecureStore`, надёжность по префиксу, `shouldReEncrypt`, `TokenVault` без удаления при `unavailable` | `main/secure-store.ts`, `main/token.ts`, тесты | нет |
| 2 | `openLibsql(url, { encryptionKey })` + детектор шифра | `packages/db-libsql` | нет |
| 3 | **ЯКОРЬ: `windows-latest` в матрицу job `test`** | `.github/workflows/release.yml`, `apps/desktop/tests/release-workflow.test.ts` | **да — отдельный шаг, только после явного «ок» пользователя, отдельным пунктом в отчёте** |
| 4 | `DbKeyVault` + wipe для `db-key.bin` | `main/db/key-vault.ts`, `main/wipe.ts` | нет |
| 5 | `dbFileKind`, `DbAccess.init/open`, новые установки зашифрованы, открытая база пока остаётся открытой (`encrypt-pending`), `runDbSmoke`, порядок запуска | `main/db/header.ts`, `main/db/access.ts`, `main/index.ts`, `main/smoke.ts` | нет |
| 6 | Миграция + wipe для `.encrypting` | `main/db/encrypt.ts`, `main/wipe.ts` | нет |
| 7 | Ключ в worker | `shared/import-protocol.ts`, `main/importer.ts`, `worker/import.ts`, `shared/progress.ts` | нет |
| 8 | IPC-шлюз базы, push, экран «База недоступна», «Начать заново» | `shared/channels.ts`, `shared/db-state.ts`, `shared/api.ts`, `main/ipc.ts`, `main/lock/gate.ts`, preload, renderer | нет |
| 9 | Карточка в настройках, тексты (`AppLockSettingsFeature.vue`: «Это замок на входе, а не шифрование: файлы базы на диске по-прежнему доступны…»; README, строка 23: «The database file itself is not encrypted»; диалог «Удалить все данные») | renderer, `README.md`, `main/index.ts` | нет |
| 10 | `CLAUDE.md`: решения, смоук-чек-лист в отчёте `reports/` | `CLAUDE.md` | нет |

Этап 3 можно делать в любой момент после 2, но до релиза. Если «ок» на него не получен, фича не выпускается: без него
Windows-сборка может не открыть базу (факт 17, риск 8 брифа). Дополнительно (не якорь) в этапе 2 или 6:
`tests/package.test.ts` при `PACKAGE_CHECK` проверяет, что каждый `index.node` libsql в `app.asar.unpacked` содержит
строку `SQLite3 Multiple Ciphers` — это ловит сборку без шифрования на всех трёх ОС и обеих архитектурах Mac, но
бинарник не запускает.

## Смоук пользователя

Реальное приложение и команды запускает только пользователь. Нужны две сборки подряд (решение 8): «A» = 0.1.3 (последний выпущенный, без шифрования),
«B» = с шифрованием, «C» = та же, что B, с поднятой версией.

1. macOS: установить A, загрузить данные, запомнить итоги месяца. Обновиться до B: данные на месте, итоги совпадают, в
   настройках «База зашифрована».
2. Пользователь сам: `head -c 16 "~/Library/Application Support/Balance Insights/monobank.db" | xxd` — не
   `SQLite format 3` (агент эти папки не читает).
3. Обновиться B → C (ad-hoc): запрос Keychain до окна → «Разрешить» → данные открываются, импорт продолжается.
4. Ещё раз обновиться (или C → C') → «Запретить» → (если включена блокировка — сначала экран блокировки, Touch ID
   спрашивает сам) → «Нет доступа к ключу базы» → токены в `tokens/` остались (проверяет пользователь: число файлов) →
   «Перезапустить» → «Разрешить» → данные и незавершённый импорт на месте.
5. Проверить «Всегда разрешать»: следующий запуск той же сборки без запроса (**не проверено**, факт 26).
6. Импорт после перезапуска под замком PIN: окно заблокировано, «Идёт импорт», после разблокировки операции дописаны.
7. «Удалить все данные» (и с экрана «База недоступна») → в `userData` нет базы, `db-key.bin`, `.encrypting`,
   `lock.json`, `tokens/`.
8. «Начать заново»: при закрытом приложении удалить `db-key.bin` → запуск → «Ключ базы потерян» → отмена ничего не
   удаляет → подтверждение → подключения на месте (имена из банка после импорта), импорт работает.
9. Windows: пункты 1, 2 (PowerShell `Format-Hex`), 6, 7, 8.
10. Linux с keyring: как Windows. Linux без keyring (остановить `gnome-keyring` или запустить с
    `--password-store=basic`): плашка «База не зашифрована», токены только в памяти; включить keyring → следующий
    запуск шифрует базу. Префикс blob (`v10`/`v11`) — диагностическая строка в dev-логе без содержимого (раздел 7 брифа).

## Открытые вопросы

1. **Полный `pnpm test` на `windows-latest` никогда не запускался.** Часть тестов опирается на POSIX (права 0600/0700,
   `hdiutil`, настоящий pnpm в `cli-args.test.ts`).
   - (а) в этапе 3 довести весь набор до зелёного на Windows (пропуски по `process.platform` там, где тест про POSIX);
   - (б) Windows-запись матрицы запускает только `pnpm --filter @mono/db-libsql test` и тесты `main/db/*`;
   - рекомендация: (а), если падений немного; иначе (б) как временная мера с задачей в бэклоге.
2. **Способ копирования схемы.** (а) проверенный в брифе `ATTACH … AS enc KEY` с переписыванием `CREATE` на `enc.` —
   нужен разбор имени (кавычки после `RENAME`); (б) обратный: соединение на новом файле с ключом, старый —
   `ATTACH … AS old KEY ''`, `CREATE` без правок. Рекомендация: первым тестом этапа 6 проверить (б); если работает —
   (б), иначе (а).
3. **Имена людей после «Начать заново».** Пересозданные подключения получают имя из банка; введённые пользователем имена
   теряются. Сохранять их отдельным файлом нельзя (персональные данные вне зашифрованной базы). Рекомендация: принять.
4. **Окно до или после ключа.** (а) ждать `init()` до окна — запрос Keychain без окна, но без наложения на Touch ID
   (рекомендация); (б) окно сразу с состоянием «открываю базу» — нужно откладывать автозапрос Touch ID, пока идёт запрос
   Keychain.
5. **Поведение `TokenVault.get` при окончательной ошибке.** Сейчас файл удаляется. Можно не удалять вовсе (перезапишется
   при повторном вводе) — защита от ошибки классификации «Запретить» как `failed`. Рекомендация: не удалять и при
   `failed`, только `needsReentry`; `resumeOnLaunch` тогда посчитает такой токен «secure» и получит `no-token` —
   поведение то же, что сейчас.
6. **Подсказка про «Всегда разрешать» на экране.** На неподписанной сборке она действует до следующего обновления
   (**не проверено**). Рекомендация: нейтральный текст «Разрешите доступ», без совета нажимать «Всегда разрешать».
7. ✅ **Номер релиза** — решено: шифрование выходит в 0.1.4 вместе с блокировкой.

Вопросы 1–6 — приняты рекомендации (если пользователь не скажет иначе до соответствующего этапа).
Этап 3 (якорь: `windows-latest` в `release.yml` + проверка в `release-workflow.test.ts`) — **ок пользователя получен 26.09.2026**.

## Где бриф расходится с текущим кодом

Бриф писался на `feat/app-lock` до слияния (PR #5). Эта спека исходит из кода, а не из брифа:
1. `index.ts`: связывание теперь на строках 94–116, а не 82–101; `feat/app-lock` влит, «параллельного агента» в `lock/` нет.
2. IPC-шлюз замка уже есть (`registerIpc(…, { locked })`, `ALLOWED_WHEN_LOCKED`, порядок «отправитель → замок →
   аргументы»); этап 7 брифа его не учитывал — шлюз базы встаёт после замка.
3. Все push идут через `gatedPush` (`tests/window.test.ts`); новый канал состояния базы — только через него.
4. Wipe: бриф — «токены → worker → соединение → файлы»; сейчас файлы замка удаляются последними (`OTHER_FILES` →
   `APP_DIRS` → `LOCK_FILES`), после wipe — `appLock.reset()`.
5. `restrictUserData` (0700, коммит 9363dfa) и README про шифрование диска: колонка «Сейчас» в таблице угроз брифа
   устарела для «другой учётной записи» на macOS/Linux.
6. Автозапрос Touch ID на экране блокировки (f04a0b0) — бриф не рассматривал наложение на запрос Keychain.
7. `TokenVault.get()` удаляет файл токена при **любой** ошибке расшифровки, в том числе после «Запретить» — в брифе
   этого нет, а с неподписанными обновлениями это регулярная потеря токенов.
8. Импорт продолжается из `did-finish-load` вместе с `scheduleChecks(updater)`; бриф не говорил, что его нужно
   закрыть состоянием базы.
9. `runDbSmoke` при отсутствующей базе создал бы открытый файл до `DbAccess` — порядок важен, не только ключ.
10. Каналы — в `shared/channels.ts` (`METHODS`, `*_CHANNEL`), в `shared/api.ts` — только типы.
11. Схема core: `AUTOINCREMENT` есть (нужен `sqlite_sequence`), view и trigger нет, таблицы после `RENAME`.
12. Тексты «не шифрование» в `AppLockSettingsFeature.vue` и README (строка 23) появились после брифа.
13. `release-workflow.test.ts` сейчас не проверяет ОС матрицы `test` — проверку нужно добавить, а не «обновить».

## Что не проверено

- Шифр в бинарниках libsql для win32-x64-msvc и linux-x64-gnu (факт 17) — закрывает этап 3.
- darwin-x64 запускался только как строка в `index.node` (факт 16).
- Тексты ошибок `decryptStringAsync` и то, что «Запретить» даёт именно «temporarily unavailable» (факт 22).
- Префиксы `v10`/`v11`/`v12` на живом Linux и поведение `decrypt` blob `v11` без keyring (раздел 7 брифа).
- Designated requirement ad-hoc подписи, partition list, «Всегда разрешать» (факт 26).
- Привязка параметров в `ATTACH … KEY ?` через libsql; `KEY ''` как «без шифрования»; вид `sql` после `RENAME` и
  отсутствие `IF NOT EXISTS` в `sqlite_schema` на схеме core.
- `rename` поверх файла на Windows при антивирусе и нужен ли там `fsync` каталога.
