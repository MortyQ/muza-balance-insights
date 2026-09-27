# Выбор счетов в «Подключения» и подключения без цвета — план

> Ветка `feat/new-cards-settings`. Задачи по порядку (subagent-driven), после каждой — ревью, тесты, коммит
> (`git add` конкретных файлов, не `-a`). Решения пользователя 27.09.2026: вариант **A** для переводов; цвет остаётся
> только у людей.

**Цель:** у каждого счёта подключения — переключатель. Выключенный счёт не загружается и не входит ни в какую статистику;
его уже загруженные операции остаются в базе и возвращаются сразу, если включить. Цвет подключения больше не показывается
и не выбирается.

## Решения

- **Хранение** — миграция v11: `accounts.sync_choice INTEGER` (NULL = авто, 1 = вкл, 0 = выкл). `syncAccounts` его не
  трогает (upsert из банка сохраняет выбор). Авто = прежнее правило `defaultAccountSelection`: карта всегда; банка — если
  баланс > 0 или уже есть `sync_state`. **Действующее** значение (`enabled`) = `sync_choice` если не NULL, иначе авто.
  Одно SQL-выражение на ядро (константа/функция в одном модуле), им пользуются и план, и фильтры статистики.
- **Загрузка** — план импорта (`defaultAccountSelection`) берёт только `enabled`; выключенный — в отдельный список
  (для диагностики), не в `selected`. Явный `opts.accountIds` (mcp CLI) — как раньше.
- **Статистика (вариант A)** — выключенный счёт считается чужим:
  - его операции не входят ни в траты, ни в доходы, ни в балансы (`getBalances`, `balancesAt`), ни в курс по обменам
    (`fx.ts`), ни в поиск, ни в статус/покрытие данных (`dataFrom`/`dataUntil` — только по включённым), ни в
    `monthOverview` десктопа;
  - перевод включённого счёта с выключенным (`is_internal_transfer = 1`, пара `transfer_pair_id` на выключенном счёте,
    либо семейный перевод на такой счёт) **не** считается внутренним: исходящий — трата, входящий — доход (по категории
    строки как у обычной операции). Решается в момент подсчёта (фильтр в SQL), без rederive и без изменения колонок;
  - перевод на выключенный счёт без найденной пары (счёт не загружался) — как сейчас определил rederive; отдельно не
    ловим. Отметить в отчёте, если найдутся такие случаи в тестах.
- **Цвет подключения** — колонка `connections.color` и индекс остаются (миграции не откатываем), приложение их не
  читает и не пишет: убрать `setConnectionColor` (ядро, `IntegrationsService`, IPC, api), `color` из `ConnectionView` и
  из `addConnection`, выбор цвета в форме, точку и кнопку в строке. Новое подключение пишет `color = NULL`.
  apps/mcp цвет подключений не использует — проверить grep'ом.
- Копия для анализа (`apps/mcp/src/analysis/schema.ts`) **не меняется** (новая колонка — только с ок пользователя).
- Файлы доверия не трогаем.

## Задача 1: ядро

- `packages/core/src/db.ts` — миграция v11 `account_sync_choice`.
- Выражение «счёт включён» и функции в `packages/core/src/participants.ts` (или новый `accounts.ts`, если так чище):
  `listConnectionAccounts(db, connectionId)` → `[{ id, kind: 'card'|'jar', type, currencyCode, maskedPanTail: string|null,
  jarTitle: string|null, enabled, auto: boolean }]` (последние 4 цифры из `masked_pan`, название банки из `title`;
  без iban, без полного pan); `setAccountEnabled(db, accountId, enabled: boolean)` (неизвестный счёт — ошибка).
- `sync.ts` `defaultAccountSelection` — по `enabled`.
- Фильтры: `summaries.ts` (все запросы, в том числе `incomeSummary`, семейные переводы), `status.ts`, `fx.ts`,
  `search.ts`, `queries.ts` (если это статистика, а не диагностика — решить и объяснить), всё, что читает транзакции
  для итогов. Переводы — по варианту A.
- Тесты в `packages/core/tests`: миграция; выбор переживает `syncAccounts`; авто-правило для банки; план без
  выключенного; каждая сводка без выключенного счёта; перевод на выключенный счёт — трата, с него — доход; включение
  возвращает данные; `listConnectionAccounts` не отдаёт iban/полный pan.
- `.agents/project/core-people.md` и `domain-rules.md` — абзац о выборе счетов.

## Задача 2: десктоп main / IPC / цвет подключений

- `IntegrationsService`: `listConnectionAccounts(connectionId)`, `setAccountEnabled(accountId, enabled)` — во время
  импорта отказ `import-running` (как `removeConnection`); после изменения — push/refresh статуса, чтобы экраны
  пересчитались. Новые каналы в `shared/channels.ts`, `shared/api.ts`, preload, `ipc.ts` с проверкой аргументов как у
  соседей. `DataService.monthOverview` / `data.ts` — только включённые счета (если ядро не покрывает само).
- Убрать `setConnectionColor` и `color` подключения (см. «Решения»), `people.ts` → `ConnectionView` без `color`.
- Тесты: `tests/people.test.ts` / integrations-тесты, ipc-тесты на новые каналы и на отсутствие старого.
- `.agents/project/desktop-import.md` — IPC.

## Задача 3: renderer

- `features/integrations/shared/components/ConnectionRow.vue`: без точки цвета, без «Изменить цвет»; кнопка
  «Счета · N» раскрывает список (тот же `EXPAND_TRANSITION`): строка счёта — подпись (карта: тип · валюта · •• 1234;
  банка: название · валюта) и `VSwitch` из `shared/ui`; у выключенного — подсказка «Не загружается и не входит в
  статистику». Во время импорта переключатели `disabled` с подсказкой. Ошибка — в общий `error` раздела.
- `useConnectionActions` / `useConnectionsRequest`: запросы счетов и переключения; после переключения — обновить
  участников/статус данных, чтобы главная пересчиталась.
- Форма добавления / `useConnectionOwner`: без цвета подключения (`connectionColor`, `takenConnectionColors`),
  `colorHolders(…, 'connections')` — убрать, если больше не нужен.
- Тесты `tests/renderer/*` (подпись счёта — в utils с тестом), `architecture.test.ts` зелёный.
- `CHANGELOG.md` 0.1.5 unreleased: выбор счетов в «Подключения»; у подключений больше нет цвета.

## Финал

- Корень: `pnpm test`, `pnpm typecheck`. Финальное ревью всей ветки.
