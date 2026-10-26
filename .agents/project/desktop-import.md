# Десктоп: импорт, токены, люди и подключения в main

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/desktop.

- Импорт возобновляется при запуске автоматически, если токен в Keychain; если токен был только в памяти — UI просит ввести.
- Отмена импорта — `signal` в `SyncContext` ядра + `kill()` через 10 с как запасной путь.
- Временные сбои импорта (сеть/таймаут, 5xx, 429 сверх повторов ядра) и падение worker пережидаются
  (`apps/desktop/src/shared/retry.ts`): первый повтор через 1 мин, дальше каждые 15 мин, до 4 ч сбоев подряд;
  закоммиченное окно сбрасывает серию. После повтора докачиваются только оставшиеся окна исходного плана.
  Worker сам не выходит после итогового сообщения — его закрывает main (иначе сообщение терялось).
  Сон компьютера во время паузы перед повтором в эти 4 ч не засчитывается (`sleptDuringPause`: пауза затянулась
  больше чем на 30 с — разница считается сном и сдвигает начало серии).
- Токены — `TokenVault` (`apps/desktop/src/main/token.ts`): файл на подключение `tokens/<connectionId>.bin` (safeStorage,
  0600), статус и «ввести заново» — по подключению. Старый `token.bin` при запуске переносится к подключению Monobank
  как есть, без расшифровки. A bank's name and credential shape are the core's registry (`@mono/core/providers/info`:
  `infoOf`, `credentialFits`, `TOKEN_PROVIDER_IDS`); `token.ts` may import it because its whole closure is pure data
  (`tests/token.test.ts` walks it).
- A bank with an API has a folder `apps/desktop/src/integrations/<bank>/`: `desktop.ts` (the one trusted service its
  client may reach) and `worker.ts` (the worker's side: the client, its errors); shared types — `integrations/types.ts`.
  `DESKTOP_PROVIDERS` (`net/providers.ts`) and `WORKER_PROVIDERS` (`worker/providers.ts`) gather them as
  `Record<TokenProviderId, …>`: exactly the core's token providers (`tests/providers.test.ts`, which also checks that
  each client's origin is a host of its service); main does not import worker code. A file-only bank has no folder
  here.
- **The data process** (`src/data/process.ts`, a long-lived `utilityProcess`, `serviceName: 'balance-data'`, `env: {}`):
  every database read and write behind the renderer's IPC runs there, so main never waits on a query. Main keeps the IPC
  gates, the tokens, the dialogs, reading and parsing a statement file, and `DbAccess` (it still opens the file at
  launch to decide its state and to encrypt a plain one; `smoke.ts` in dev). The handler table is `src/data/host.ts`
  (`DataService` in `src/data/data.ts` and the database halves in `src/data/people.ts`, `connections.ts`,
  `statements.ts`); the closed list of methods, their argument schemas and the messages are
  `src/shared/data-protocol.ts` (the IPC methods reuse `src/shared/ipc-args.ts`). Main reaches it through
  `DataClient` (`src/main/data-client.ts`, `.api` is the typed `DataApi` of `src/main/data-api.ts`):
  - `open { dbPath, dbKey }` first (`DbAccess.forProcess()`, the key only in this message); calls wait for `ready`;
    `open-failed: unreadable` → `DbAccess.markUnreadable()` (the recovery screen), `failed` → the call fails;
  - today's rates (`RatesService.current()`, which still waits for a refresh in flight) go ahead of a call of
    `RATED_METHODS` whenever they changed since the last sent;
  - calls run one at a time in the order they arrive; an error comes back as a code (`connection`, `invalid`,
    `failed`) and the error's name only, and main rethrows it as `DataCallError` (a refusal such as a taken colour or
    a blocked statement is a value, as before);
  - an exit fails the calls in flight; the next call forks a new process (no crash timer: a restart only on demand);
  - `stop()` (`close`, killed after `STOP_KILL_MS`, resolves on the exit) before «Delete all data» and «Start over»
    delete the files; on quit it is killed. Forked once at launch after the dev smoke, so the migration runs early.
  Tests: `tests/data-host.test.ts`, `data-client.test.ts`, `data-protocol.test.ts`, `data-entry.test.ts` (as source);
  `tests/main-imports.test.ts`: main's run-time import graph reaches core only in `shared/` and `providers/` (plus the
  dev smoke's `storage/` and the reserve limits through `src/shared/allowance.ts`), never `src/data/`; the data
  process's graph has no Electron, network, main or worker code.
- **The end of an import** (the `rederive` progress phase, `worker/run-import.ts`): every committed window was
  already derived by its own pass (`commitRows` → core `deriveSpan`), so the end re-derives only the spans they
  touched (core `rederiveSpans`, merged; log line `rederive: N spans, categories changed: M`). A full `rederiveCore`
  (log line: its first report line) when a window's derivation failed (`CommitResult.derivationFailed`) or the
  accounts' IBANs, jar titles or card types changed during the run (`accountInputs` / `accountInputsChanged` in core
  `derived.ts`, read before the first window and at the end). A connection's first import brings new IBANs, so it
  ends with a full pass. Checked by `tests/run-import-derive.test.ts`.
- File connections (`connections.method = 'file'`) are outside the import: the data process's `tokenConnections` (`DataService.connections()`) lists token
  connections only, so the start, the resume and auto-sync never see them; their accounts are filled by statement
  uploads (`main/statements.ts`), refused while an import runs.
- **Statement upload** (IPC `openStatement`, `compareStatement`, `commitStatement`; main `StatementsService`):
  - `open(connectionId)`: no reader for the bank → `no-format`; the dialog offers the readers' `extensions` and «All
    files»; the file is read (10 MiB), its kind told by its bytes (`sniffFormat`): text in main, a spreadsheet or a PDF
    through `DecoderClient` (`main/decoder-client.ts`, a process per file; its codes become the screen's:
    `unreadable` — also `crashed` and `bad-reply` —, `encrypted`, `over-limits` — every size and count limit —,
    `timeout`). Then core `pickReader` picks the reader by the document alone, a reader of another provider is refused
    as `other-bank`, `read` gives one `ParsedStatement` per account (more than `STATEMENT_ACCOUNTS_MAX` (50) →
    `over-limits`). Every account is kept under one `statementId`; the answer is `statements: OpenedStatementView[]`
    (currency, rows, dates, the file's card type, the last 4 digits of its first card, the connection's cards of that
    currency);
  - `compare(statementId, targets)`: one target per account (`StatementTargetInput`, or null — the file's match: IBAN,
    then card number, else new); each comparison carries its `match`;
  - `commit(statementId, targets)`: one explicit target per account; the whole file in one batch or nothing (core
    `commitStatement`, a block on any account refuses it); a new card's id is main's (`file-` + a UUID).
  A target list of another length than the file's accounts is an error (zod checks the shape only). The data process
  gets the statements and targets (`DATA_ARG_SCHEMAS`: same length, at most 50) and runs core `compareStatement` /
  `writeStatement` (`data/statements.ts`). Tests: `tests/statements.test.ts` (a renamed file, a zip under any name,
  two accounts, another bank, each decoder refusal), `data-protocol.test.ts`, `ipc.test.ts`.
- **The upload sheet** (IPC `openUpload(connectionId?)`, `openDroppedUpload(files)`, `commitUpload(uploadId, choices)`;
  main `StatementsService.openUpload` / `commitUpload`): up to `UPLOAD_FILES_MAX` (12) files, read one at a time; a file
  that fails is its own `{ ok: false, problem }` and never fails the upload. Each account of a file is compared (no
  target) with every connection of its bank, file ones first; the first whose data process matches it (IBAN, then card
  number) gives `match: { connectionId, participantId, method }` and its counts; none → `match: null`, every row new.
  `commitUpload` takes per file, per account a participant id for an unmatched account (null for a matched one or none
  yet): that person's first file connection of the bank takes it, or one is created for them at the write
  (`createConnection`, once per person and bank in the upload) — so a cancelled sheet creates nothing. A file with an
  account still waiting is `waiting`, one blocked by core is that block, and every other file is written, grouped by
  connection (one core `commitStatement` per connection). `import-running` refuses the whole upload. Tests: the «upload
  sheet» block of `tests/statements.test.ts`.
- Импорт нескольких подключений — одна задача, один worker, один `import-job.json`: `start` несёт
  `connections: [{ connectionId, provider, token }]` (1–10), окна идут по кругу (`runPlans`). Всё, что worker знает о
  банке (клиент, разбор ошибок), — `apps/desktop/src/worker/providers.ts` (`WORKER_PROVIDERS`, из папок банков,
  `workerProviderOf`); the network: `fetchFor` in `worker/import.ts` gives each provider
  `allowlistedFetch(net.fetch, [serviceOf(provider)])`, the service its `desktop.ts` names (`tests/worker-entry.test.ts`). Отклонённый токен
  (`auth`) или чужой / уже подключённый владелец (`other-holder` / `already-connected`) выключает только своё подключение: итог — `done` с
  `failed`; если не прошло ни одно — `error` первого. Подключение без токена main пропускает и добавляет в `failed`.
  При запуске задача продолжается для подключений с токеном в Keychain; нет ни одного — `needs-token` с их id.
- IPC людей и подключений (main's halves; their database halves run in the data process, above): люди — `PeopleService` (`apps/desktop/src/main/people.ts`: `listPeople`, `renameParticipant`,
  `restoreBankName`, `setParticipantColor`), подключения и их токены — `IntegrationsService` (`main/integrations.ts`:
  `addConnection`, `setConnectionToken`, `removeConnection`, `listConnectionAccounts`, `setAccountEnabled`; людей берёт из data-процесса, не из
  `PeopleService`); `ipc.ts` только направляет вызовы. `listPeople` (подпись участника — единственное
  имя, что уходит в renderer; без токена и `external_client_id`), `addConnection({ participant: { id } | { label } |
  { fromBank: true }, provider, token, remember })` (у нового человека — свой `color?`; у подключения цвета нет) (форма токена до записи; тот же токен второй раз — `duplicate`; токен не
  сохранился — подключение и новый участник откатываются; импорт не запускает), `renameParticipant`, `restoreBankName`, `setParticipantColor` (занятый цвет →
  `{ changed: false, reason: 'taken' }`; ключи — `src/shared/colors.ts`, сверка с ядром — только в `people.ts`), `setConnectionToken`,
  `removeConnection` (во время импорта — `import-running` без диалога, затем системный диалог, токен, данные),
  `listConnectionAccounts(connectionId)` → `ConnectionAccountView[]` (`id`, `kind`, `type`, `currencyCode`,
  `maskedPanTail`, `jarTitle`, `enabled`, `auto` — поле за полем из ядра, без iban и полного номера; неизвестное
  подключение — ошибка), `setAccountEnabled(accountId, enabled)` → `{ changed: true } | { changed: false, reason:
  'import-running' }` (во время импорта — отказ, как у `removeConnection`; неизвестный счёт — ошибка). Push нет: после
  ответа renderer сам обновляет людей и `syncStatus.refresh()` (`version` → экраны пересчитываются), как после удаления.
  Под замком и при не-ready базе оба канала закрыты.
  `getSpendingOverview` / `getMonthOverview` принимают `participantId`. `MonthOverview.reserved` — the active
  reserves («Available per day») of the view in hryvnia at today's rate, the current month only (null — none or another
  month), set against `total`; each of `people` has its own `reserved`; the balance itself stays as the bank has it. The family's `people` cost no query per person: their balances are the
  family's `balancesAt` split by owner (core `balancesOf`), their income and spending one `incomeSummary` /
  `spendingSummary` grouped by `participant` each (an internal grouping: every group follows that person's own view of
  family transfers); `balancesAt` itself is one statement for all accounts. `tests/data-queries.test.ts` checks that every overview runs a
  fixed number of statements, whatever the people, accounts and months. `SpendingOverview.usual` (`data/usual.ts`): the whole-month medians per category,
  of the total and of income over up to 6 months before that the data covers from their first day, same person and
  scope, today's rates; `running` while the shown month runs, and then no income (its day decides it); null with fewer
  than 3 such months. Whole months even for a running one: a few days of lumpy spending make «up to the same day» noise. The usual months run up to the shown one without a gap, so they come from one
  `spendingGrid` by month and one `incomeSummary` by month (to the shown month's end); each month folds as its own
  summary would (`cellGroups` in `data/spending.ts`: per currency and key, then today's rates). `getNowOverview` takes only `participantId` (main
  decides «today» in the system time zone; categories of today and of the week, the week's with last week's same days —
  categories and numbers only, no bank text; one `spendingGrid` by day × category over the widest span — the usual day's
  window, this month, last week — folded per span with `cellGroups`, plus `periodInfo` for the window and the week);
  like the other data channels it is closed while locked and while the
  database is not ready.
  `getCategoryOverview({ period, category: CategoryId, scope, participantId? })` (the category screen; main:
  `DataService.categoryOverview`, helpers in `data/category.ts`; `period` — `DetailPeriod`: `{ kind: 'day', date }`,
  `{ kind: 'week', from }` (a Monday) or `{ kind: 'month', month }`; zod checks the shape, `data/period.ts` the days
  (`periodBounds`: a Monday, not after today) and what it is compared with (`periodCompare`: last month; last week cut
  to the weekdays the data reaches; a day — nothing); the 12 months only for a month) and `getIncomeOverview({ period, participantId? })` (the
  income screen, the same `DetailPeriod` checks; `DataService.incomeOverview`, `incomeStats` in `data/category.ts`) are the **only** data channels that
  carry the bank's text: each line's description (a card number cut to its last 4 digits, jar titles hidden; for an
  income line the sender's name of a «Від: …» transfer, else the description) and comment — never `counter_name`, an
  IBAN, a card number or a jar title (canary tests in `tests/data.test.ts`). The category figure is the spending
  block's (same fold), its lines come from core `categoryLines`; the income figure is the balances' «In» (all scopes,
  same fold), its lines come from core `incomeLines` (the same rows as `incomeSummary`, one query: `incomeRowsSql`).
  `getRecurringOverview({ participantId? })` (the regular payments screen; `DataService.recurringOverview`): core
  `findRecurring` over the last 13 months (from the first day of the month a year back to today, system time zone), all
  scopes; `active` (last payment ≤ 40 days ago, hryvnia desc), `ended` (40–120 days, newest first), `monthly` = the
  active ones' usual payments in hryvnia by today's rates, `mandatory` — the part marked so; `hidden` — payees marked
  «not a regular payment» (out of `active`, `ended` and the sums). `setRecurringMark({ key, mark })` (`key` — a
  payment's id, `mark` `mandatory | hidden | null`) marks its payee (core `setRecurringMark`); unknown key — error; `next` — a calendar month after the last (`nextMonthDay`). The
  third channel with bank text: each payment's description through `merchantText` — never `counter_name`, an IBAN, a
  card number or a jar title (canary test in `tests/data.test.ts`).
  `getAllowanceOverview({ participantId? })` («Available per day»; `DataService.allowanceOverview`, pure calculation in
  `data/allowance.ts`): the cards' own funds now (`balancesAt` now; no jars; foreign at today's rates, unrated in
  `leftOut`) − the reserve − the active regular payments marked mandatory whose next date is before `until`, over
  `days`. `until` — the next regular income (`findRecurring` `kind: 'income'`, each person's largest with a rate, the
  earliest still to come), else — none, or due today or earlier (`overdue`) — the next month's first day. The reserves are
  core `reserves.ts` (table `reserves`, migration 13: name, currency 980 | 840 | 978, amount in its minor units, `until`
  — the last day it counts or null; migration 14: `participant_id` — whose, or null for common; a removed person's become
  common; with one person only, the reserves so far became theirs; at most `RESERVES_MAX`; database only, so encrypted and gone with «Delete all data»,
  never in the analysis copy or an MCP tool). Whose counts where (`reserveFor` in `data/data.ts`): the family view —
  all; a person — their own only, never a common one. `reserves` in the answer lists the view's: `active` (no end, or
  `until` ≥ today) ones are taken off at today's rate (`uah`; without a rate null and not taken off). IPC `addReserve`,
  `updateReserve(id, r)`, `deleteReserve(id)` — zod and core check the same limits (`src/shared/allowance.ts`
  re-exports core's). Bank text: the income's and payments'
  descriptions through `merchantText` (canary test).
  `getAnalyticsOverview({ from, to, participantId? })` (the analytics screen; `DataService.analyticsOverview`, pure helpers
  in `data/analytics.ts`): whole months `YYYY-MM`, `from ≤ to`, at most `ANALYTICS_MAX_MONTHS` (`src/shared/analytics.ts`:
  the import's 36 + the current one; zod refuses more, main refuses a range ending after this month). One month → per
  day, a range → per month; all scopes, the balances' fold (core `spendingGrid` + `incomeSummary` by day / month, today's
  rates, a currency without a rate in `leftOut`); the period before (`comparePeriod` for a month, the same number of
  months before a range; null before the data); for one month the usual month's running spending (mean of up to 3
  covered months before). Categories, numbers and dates only — no bank text (canary test in `tests/data.test.ts`).
  `DataStatus` (IPC `getSyncStatus`) несёт также
  `dataFrom` — the date in the system time zone of `MIN(oldest_synced_time)` по включённым счетам (`firstDataDate` в `packages/core/src/read/status.ts`),
  пара к `dataUntil`; ей пользуется нижняя граница выбора месяца в `entities/period`. `DataService.status` / `lastSyncSec`
  (порог автосинхронизации) — тоже только по включённым (`ENABLED_ACCOUNT_IDS_SQL` ядра).
- **Живое обновление при импорте — реализовано** (`app/listeners.ts`): каждый новый `windowsDone` → `syncStatus.refresh()`
  не чаще раза в `LIVE_REFRESH_MS` (3 с, `throttle` из `shared/lib`, последний тик не теряется), конец импорта — ещё раз.
  Экраны перезагружаются по `version` «тихо» (`useAsyncData(…, { quiet })`: без `loading`, старые цифры до прихода новых);
  пока идёт импорт, в тратах строка «Идёт импорт — цифры дополняются». Тесты renderer с алиасами — `tests/renderer/`
  (типы проверяет `tsconfig.web.json`).
- **Автосинхронизация** (27.09.2026): `apps/desktop/src/main/auto-sync.ts` (`AutoSync`, без Electron) решает, `Importer.startAuto`
  запускает. Триггеры: запуск (после `resumeOnLaunch` — незавершённый импорт важнее), выход из сна (`powerMonitor` `resume`
  + 60 с на сеть), проверка раз в 30 мин. Пороги: запуск и сон — не раньше 30 мин после последней синхронизации
  (`MAX(last_sync_at)`) или попытки, проверка по таймеру — 4 ч. Не запускается: выключено (главный переключатель или
  триггер), база не готова, данных ещё нет (первую историю выбирает пользователь), идёт импорт или лежит `import-job.json`.
  Под замком — запускается. Настройки — `preferences.json` (`src/main/prefs.ts`: у каждого поля своё значение по умолчанию,
  запись по очереди через `updatePrefs`), IPC `getAutoSync` / `setAutoSync`, карточка «Автосинхронизация» в настройках.
  - Прогон: вся семья — подключения, у которых сейчас есть токен (без токена — молча пропускаются, их показывает плашка на
    главной); `sinceSec` — the start of this month in the system time zone; `rereadWindow` — у загруженного счёта одно окно на всю длину
    до «сейчас» (последний 31 день у Monobank; разрыв больше окна − 3 дня — обычный план). Так подтягиваются холды,
    завершённые позже 3 дней. `RESYNC_OVERLAP_SEC` (3 дня) в ядре не менялся: на нём `pendingHolds` и синк `apps/mcp`.
  - Без файла задачи, без `needs-token`, без `no-token` в `done`; каждое состояние помечено `auto: true`
    (renderer узнаёт режим и после перезагрузки страницы). Ручной «Загрузить» вытесняет автосинхронизацию (`halt()`, затем свой
    запуск). На главной — одна строка «Обновляю данные…» (или повтор / ошибка), без итога «Готово»; строка «Идёт импорт —
    цифры дополняются» — только для ручного импорта.
