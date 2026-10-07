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
  как есть, без расшифровки. Форма токена провайдера — `apps/desktop/src/net/providers.ts` (`DESKTOP_PROVIDERS`, запись на
  каждый провайдер ядра — `tests/providers.test.ts`).
- Папка банка — `apps/desktop/src/integrations/<банк>/`: `desktop.ts` (сторона main: название, форма токена) и
  `worker.ts` (сторона worker: клиент, тексты и разбор ошибок); общие типы — `integrations/types.ts`. Таблицы
  `DESKTOP_PROVIDERS` (`net/providers.ts`) и `WORKER_PROVIDERS` (`worker/providers.ts`) только собирают их в
  `Record<ProviderId, …>`: main не импортирует код worker. Сеть банка сюда не входит — она в `FETCH` (`worker/import.ts`).
- Импорт нескольких подключений — одна задача, один worker, один `import-job.json`: `start` несёт
  `connections: [{ connectionId, provider, token }]` (1–10), окна идут по кругу (`runPlans`). Всё, что worker знает о
  банке (клиент, разбор ошибок), — `apps/desktop/src/worker/providers.ts` (`WORKER_PROVIDERS`, из папок банков); сеть — таблица `FETCH` в
  `worker/import.ts`, у каждого провайдера `allowlistedFetch(net.fetch, [его сервисы])` буквально. Отклонённый токен
  (`auth`) или чужой / уже подключённый владелец (`other-holder` / `already-connected`) выключает только своё подключение: итог — `done` с
  `failed`; если не прошло ни одно — `error` первого. Подключение без токена main пропускает и добавляет в `failed`.
  При запуске задача продолжается для подключений с токеном в Keychain; нет ни одного — `needs-token` с их id.
- IPC людей и подключений: люди — `PeopleService` (`apps/desktop/src/main/people.ts`: `listPeople`, `renameParticipant`,
  `restoreBankName`, `setParticipantColor`), подключения и их токены — `IntegrationsService` (`main/integrations.ts`:
  `addConnection`, `setConnectionToken`, `removeConnection`, `listConnectionAccounts`, `setAccountEnabled`; людей берёт из ядра, не из
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
  `getSpendingOverview` / `getMonthOverview` принимают `participantId`. `getNowOverview` takes only `participantId` (main
  decides «today» in the system time zone; categories of today and of the week, the week's with last week's same days —
  categories and numbers only, no bank text); like the other data channels it is closed while locked and while the
  database is not ready.
  `getCategoryOverview({ period, category: CategoryId, scope, participantId? })` (the category screen; main:
  `DataService.categoryOverview`, helpers in `main/category.ts`; `period` — `DetailPeriod`: `{ kind: 'day', date }`,
  `{ kind: 'week', from }` (a Monday) or `{ kind: 'month', month }`; zod checks the shape, `main/period.ts` the days
  (`periodBounds`: a Monday, not after today) and what it is compared with (`periodCompare`: last month; last week cut
  to the weekdays the data reaches; a day — nothing); the 12 months only for a month) and `getIncomeOverview({ period, participantId? })` (the
  income screen, the same `DetailPeriod` checks; `DataService.incomeOverview`, `incomeStats` in `main/category.ts`) are the **only** data channels that
  carry the bank's text: each line's description (a card number cut to its last 4 digits, jar titles hidden; for an
  income line the sender's name of a «Від: …» transfer, else the description) and comment — never `counter_name`, an
  IBAN, a card number or a jar title (canary tests in `tests/data.test.ts`). The category figure is the spending
  block's (same fold), its lines come from core `categoryLines`; the income figure is the balances' «In» (all scopes,
  same fold), its lines come from core `incomeLines` (the same rows as `incomeSummary`, one query: `incomeRowsSql`).
  `getAnalyticsOverview({ from, to, participantId? })` (the analytics screen; `DataService.analyticsOverview`, pure helpers
  in `main/analytics.ts`): whole months `YYYY-MM`, `from ≤ to`, at most `ANALYTICS_MAX_MONTHS` (`src/shared/analytics.ts`:
  the import's 36 + the current one; zod refuses more, main refuses a range ending after this month). One month → per
  day, a range → per month; all scopes, the balances' fold (core `spendingGrid` + `incomeSummary` by day / month, today's
  rates, a currency without a rate in `leftOut`); the period before (`comparePeriod` for a month, the same number of
  months before a range; null before the data); for one month the usual month's running spending (mean of up to 3
  covered months before). Categories, numbers and dates only — no bank text (canary test in `tests/data.test.ts`).
  `DataStatus` (IPC `getSyncStatus`) несёт также
  `dataFrom` — the date in the system time zone of `MIN(oldest_synced_time)` по включённым счетам (`firstDataDate` в `packages/core/src/status.ts`),
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
