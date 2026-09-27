# Ядро: участники, подключения, порядок импорта

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: packages/core.

- **Участники и подключения** (миграция v8): `participants` (кто; подпись только локально, в копию не идёт) →
  `connections` (провайдер + учётные данные; `external_client_id` — id владельца в банке, у Monobank `clientId`) →
  `accounts.connection_id` (обязателен). Существующие данные при миграции → участник «Я» + подключение `monobank` (id 1).
  - `syncAccounts` пишет счета под подключением контекста (`SyncContext.connectionId`, без него —
    `ensureDefaultConnection`: единственное подключение провайдера, так работают mcp с токеном из `.env` и десктоп до
    поддержки нескольких). Id владельца запоминается при первом синке; токен другого владельца — `ConnectionMismatchError`
    до любой записи (сам id не печатается). Счёт другого подключения не перезаписывается (предупреждение).
  - План импорта — только счета своего подключения (`defaultAccountSelection(db, connectionId)`).
  - Слот запросов (`api_calls.connection_id`) — на подключение: лимит банка на учётные данные; `NULL` — вызовы без
    подключения (тесты). `next_request_at` в статусе — самый поздний из слотов.
  - Тестовые счета — через `insertAccountRow` / `insertAccount` (`@mono/core/test-helpers`): они привязывают счёт к
    тестовому подключению Monobank.
  - Управление людьми и подключениями — `packages/core/src/participants.ts` (`listParticipants`, `addParticipant`,
    `renameParticipant`, `listConnections` без `external_client_id`, `addConnection`, `deleteConnection`: данные подключения
    одной транзакцией, пустой участник удаляется, затем полный `rederiveCore`).
  - Имя участника (миграция v9, `participants.label_source`): `user` — ввёл пользователь, банк не меняет; `bank` — имя
    владельца из банка (`ProviderAccounts.holderName`, у Monobank `name` из `client-info`) пишется при каждом
    `syncAccounts`, переименование → `user`. Имя — персональные данные: только в базе, не в копии, логах, отчёте recategorize.
  - Имя владельца от банка хранится и при `user` (миграция v10, `connections.holder_name`, только в базе):
    `restoreBankLabel` («Взять имя из банка» после переименования) ставит `bank` и сразу берёт `holder_name` первого
    подключения человека, где оно есть.
  - Цвета (миграция v10, `packages/core/src/colors.ts`): `participants.color` и `connections.color` — ключ палитры
    `COLOR_KEYS` (8, категориальная палитра dataviz), уникален отдельно среди людей и среди подключений, NULL = нет
    (палитра кончилась). Новый ряд — выбранный (занят → `ColorTakenError`) или первый свободный; `setParticipantColor`.
    В копию не идёт. С 27.09.2026 цвет только у людей: новое подключение пишет `color = NULL`
    (`addConnection`, `ensureDefaultConnection`), колонка и индекс остаются; `setConnectionColor` удалён вместе с
    выбором цвета подключения в десктопе.
  - Выбор счетов (миграция v11, `accounts.sync_choice`: NULL — авто, 1 — вкл, 0 — выкл; `packages/core/src/accounts.ts`).
    Действующее значение — `accountEnabledSql(alias)`, одно выражение на ядро: выбор, иначе авто (карта всегда; банка —
    баланс > 0 или есть `sync_state`). `syncAccounts` выбор не трогает. План (`defaultAccountSelection`) берёт только
    включённые; выключенные пользователем — в `disabled`, банки, выключенные авто-правилом, — в `skippedJars`; явный
    `accountIds` — как раньше. `listConnectionAccounts` (тип, валюта, последние 4 цифры карты, название банки, `enabled`,
    `auto`; без iban и полного номера), `setAccountEnabled` (неизвестный счёт — `ConnectionError`).
  - Тот же владелец во втором подключении (тот же `external_client_id` или все счета уже в одном другом подключении) —
    `ConnectionDuplicateError` до любой записи.
  - Несколько подключений в одном прогоне — `runPlans`: окна по кругу между подключениями, у каждого свой слот;
    ошибка, которую вызывающий признал ошибкой подключения, выключает только его, остальное останавливает прогон.
- Первый импорт: окна идут по кругу — сначала самое свежее окно всех счетов, потом история (`interleavePlan` в
  `packages/core/src/sync.ts`); внутри счёта порядок прежний, покрытие без дыр.
