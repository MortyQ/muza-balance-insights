# muza-balance-insights (локальная папка — monobank-mcp)

Локальный stdio MCP-сервер: транзакции Monobank → SQLite → готовые агрегаты трат. Дальше — десктоп на Electron.

## Инструкции и скиллы из muzakit (`.agents/`)

Скопированы из `muzakit/.agents` 25.09.2026 (без скиллов `vtable` и `use-api`). Действуют для кода renderer:

@.agents/instructions/conventions.md
@.agents/instructions/vue-syntax.instructions.md
@.agents/instructions/typescript.instructions.md
@.agents/instructions/ui-component-migration.md
@.agents/claude/behavior.md

- При расхождении правил этот файл важнее `.agents/`.
- `project.md`, `testing.md`, `workflow.md` описывают саму muzakit (её пакеты, тесты `@muzakit/ui`, husky + commit-lint)
  и сюда не подключены; из `workflow.md` берём только Conventional Commits.
- `ui-component-migration.md` (BEM + SCSS, никаких Tailwind-классов в шаблоне) — только для копий в
  `apps/desktop/src/renderer/src/shared/ui/`. Экраны и компоненты приложения вне `shared/ui/` — на Tailwind-утилитах (решение этапа 1).
- Порядок импортов: vue → пакеты → `@contract/*` → `@/*` (слои) → относительные. Раскладка слоёв — раздел «Архитектура renderer»
  ниже; примеры с Apollo/GQL — только примеры.
- Скиллы: `.agents/skills/emil-design-eng` (полировка UI, анимации), `.agents/skills/find-skills`; источник — `skills-lock.json`.

## Структура монорепы (pnpm workspace)

- pnpm 12.6.0 установлен глобально через npm (`packageManager` в корневом `package.json`), Corepack не используется.
  Node — `.nvmrc` (22).
- `packages/core` (`@mono/core`) — платформенно-независимое ядро: провайдеры банков (сейчас Monobank), sync, категории, переводы, возвраты,
  scope, агрегаты, миграции и интерфейс `Db`. Без Node, браузера и глобалов: `fetch`, часы, логгер, id передаются
  снаружи (`packages/core/src/platform.ts`). Проверки: `packages/core/tests/purity.test.ts` и `tsconfig.json` ядра
  (`lib: ES2023 + WebWorker`, `types: []`). Runtime-зависимости — только `zod` и `@date-fns/tz`.
  Экспорт — TS-исходники по модулю: `@mono/core/<модуль>` → `src/<модуль>.ts`, без сборки.
  Доменные тесты — в `packages/core/tests`, на Node-адаптере (devDependency).
- **Провайдеры банков** (`packages/core/src/providers/`, спека — `reports/2026-09-26-connections-spec.md`):
  - контракт — `providers/types.ts` (`ProviderRules`, `ProviderClient`, `NormalizedAccount` / `NormalizedTx`), без импортов;
  - провайдер = две половины: **правила** `providers/<id>/rules.ts` (чистые: признаки строки, маскировка, лимиты API) и
    **клиент** `providers/<id>/client.ts` (сеть, страницы, 429). Разметка (`rederive`) клиента не загружает;
  - домен (`transfers`, `refunds`, `categories`, `scope`, `summaries`, `search`, `queries`, `masking`, `sync`) входит в
    провайдеры только через `providers/types.ts` и реестр правил `providers/rules.ts`; провайдеры друг друга не импортируют;
    в коде домена нет MCC 4829/6012, текстов Monobank, `'fop'` и хоста банка. Всё это проверяет
    `packages/core/tests/providers-boundary.test.ts` (с «ломающими» примерами);
  - Monobank: `providers/monobank/{rules,descriptions,client,constants}.ts`;
  - провайдер счёта — `connections.provider` его подключения (`accountProviders` / `providerOf` в
    `packages/core/src/connections.ts`); счёт без подключения — ошибка, а не значение по умолчанию;
  - общее для всех клиентов: слот запросов `src/ratelimit.ts` (интервал задаёт провайдер), ошибки `src/errors.ts`
    (`RateLimitError`, `StatementFormatError`).
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
  - Тот же владелец во втором подключении (тот же `external_client_id` или все счета уже в одном другом подключении) —
    `ConnectionDuplicateError` до любой записи.
  - Несколько подключений в одном прогоне — `runPlans`: окна по кругу между подключениями, у каждого свой слот;
    ошибка, которую вызывающий признал ошибкой подключения, выключает только его, остальное останавливает прогон.
- `packages/db-libsql` (`@mono/db-libsql`) — Node-адаптер libsql → `Db` (PRAGMA, WAL). Не зависит от core (типы
  повторены, расхождение ловит typecheck ядра), чтобы не было цикла зависимостей. Нужен apps/mcp и main-процессу Electron.
- `apps/mcp` (`@mono/mcp`) — MCP-сервер, CLI, скрипты, обезличенная копия (`analysis/*`), `.env`/токен (`config.ts`).
- `apps/desktop` (`@mono/desktop`) — этап 1, Electron.
- `data/`, `.env`, `analysis/`, `reports/`, `docs/` — в корне репозитория (`REPO_ROOT` в `apps/mcp/src/paths.ts`).
- Корневые скрипты: `test`, `typecheck` (`pnpm -r`) и `q`. Больше корневых прокси нет.
- Аргументы CLI — через `cliArgs()` (`apps/mcp/src/args.ts`): pnpm передаёт `--` скрипту как есть;
  `apps/mcp/tests/cli-args.test.ts` проверяет это на настоящем pnpm.
- Первый импорт: окна идут по кругу — сначала самое свежее окно всех счетов, потом история (`interleavePlan` в
  `packages/core/src/sync.ts`); внутри счёта порядок прежний, покрытие без дыр.

## Якоря доверия

Файлы, на которых держатся гарантии «агент не видит реальных данных и токена»:

- `apps/mcp/package.json`, блок `scripts`: что именно запускается под каждым именем, в том числе
  `recategorize` вне sandbox;
- `apps/mcp/tests/recategorize-safety.test.ts`: тест, который `recategorize` прогоняет первым шагом;
- `.claude/settings.json`: allow/deny, sandbox и `excludedCommands` (правит только пользователь).
- `.github/workflows/release.yml`: что собирается и публикуется от имени автора. Его гарантии проверяет
  `apps/desktop/tests/release-workflow.test.ts` (actions по SHA, права, триггеры, только draft; один секрет —
  `UPDATE_SIGNING_KEY`, только в Environment `release` с ручным подтверждением и только в шагах `update-sign.mjs`).
  Публичная половина ключа — `apps/desktop/src/main/update/public-key.ts`: смена = установленные копии отвергнут обновления.

Правила:
- любое изменение в них — отдельным пунктом в отчёте: что изменено и зачем;
- такие изменения не смешиваются с другими в одном шаге. Сначала отдельный шаг с правкой якоря и проверкой,
  потом остальная работа;
- ослабление проверки (убрать ассерт, расширить allow, сузить deny) — только после явного ок пользователя.

## Работа с реальными данными

- Реальные команды запускает только пользователь: `pnpm --filter @mono/mcp <команда>` для `sync`, `accounts`,
  `dev:mcp`, `export:analysis`, `overrides:*`, `scope-overrides:*`, `settings:*`, `verify:merchants`
  (вывод `overrides:candidates` содержит реальные имена контрагентов). Не запускать их и не предлагать запускать через `!`,
  потому что вывод `!`-команд попадает в контекст агента. Корневых прокси для них нет и не будет:
  каждая лишняя форма вызова — ещё одна дыра в deny-правилах.
- `pnpm --filter @mono/mcp recategorize` агент запускает сам, когда нужно (ровно эта команда, без аргументов, отдельным вызовом:
  она вне OS-sandbox через `sandbox.excludedCommands`, остальное в sandbox). Правила:
  - код recategorize и всё, что он импортирует (`apps/mcp/src/cli/recategorize.ts` → `apps/mcp/src/rederive.ts` →
    `packages/core/src/rederive.ts` → …), не читает `.env`, не импортирует `config.ts` и не вызывает `getToken`;
    путь к БД — `apps/mcp/src/paths.ts`, `MONO_DB_PATH` только из окружения;
  - вывод — только агрегаты и диагностика: никаких `description`, `counter_name`, `comment`, `iban`, `masked_pan`;
  - оба правила проверяет `apps/mcp/tests/recategorize-safety.test.ts` (граф импортов через пакеты workspace по их `exports`,
    статически и прогоном с канарейками); он же запускается первым шагом самого скрипта (`vitest run … && tsx …`),
    pre/post-скриптов нет;
  - изменить, что он печатает, — только после ок пользователя.
- К `data/`, `*.db`, `*.db-*`, `.env`, `.env.*` доступа нет и не будет.
- Запросы к данным — только через `pnpm q analysis/queries/<имя>.sql`: SQL агент пишет в файл в `analysis/queries/`
  (папка в `.gitignore` вместе с `analysis/`), в командной строке SQL нет — нет ложных совпадений с deny-правилами.
  Путь проверяет `q.ts` (только `.sql` внутри `analysis/queries/`, без симлинков наружу). Имена файлов — без слов из
  deny-правил (`sync`, `accounts`, `settings` …). q читает только обезличенную копию
  `analysis/analysis.sqlite` (read-only, один SELECT/WITH, не больше 500 строк).
  Копию пересобирает пользователь (`pnpm --filter @mono/mcp export:analysis`), автоматически — после sync и recategorize.
- Что в копии: только колонки из whitelist `apps/mcp/src/analysis/schema.ts`. `description` замаскирован
  (`packages/core/src/masking.ts` → `maskDescription` провайдера): служебные шаблоны как есть, название банки → `[jar]`, остальное → `[other]`
  плюс `desc_class` по форме строки. Вместо `counter_name` — флаг `has_counter`. У счёта — `participant_id` (число;
  подпись участника в копию не идёт).
  Новую колонку или шаблон добавлять в whitelist/маскировку только после ок пользователя.
- Доступ дополнительно ограничен `permissions.deny` и sandbox в `.claude/settings.json`.
  Не пытаться обойти ни то, ни другое.

## Формат отчётов

- Каждый отчёт по фазе или анализу — отдельный файл `reports/YYYY-MM-DD-<тема>.md` (папка в `.gitignore`).
- В чате — только короткое резюме (5–10 строк) и путь к файлу.
- Данные в отчёте — только из analysis-копии через `pnpm q`: никаких имён, контрагентов, номеров.
- Структура:
  1. 📌 TL;DR — 3–5 пунктов, главное сверху.
  2. Статус-таблица проверок: ✅ ок / ⚠️ внимание / ❌ проблема.
  3. Основные таблицы с данными. Для распределений — колонка с полоской из `█ ▏▎▍▌▋▊▉`
     пропорционально доле (без Mermaid).
  4. 🔍 Находки — что неожиданного и почему это важно.
  5. ❓ Открытые вопросы — нумерованные, с вариантами решения.
  6. ➡️ Следующий шаг.
- Эмодзи только как смысловые маркеры (статусы, заголовки разделов, иконки категорий),
  не в каждом предложении.
- Суммы в гривнах с разделителем тысяч («12 340 ₴»): без копеек в сводных таблицах,
  с копейками в детальных.
- Разные валюты никогда не суммировать в одну строку.

## Процесс

- Работа идёт фазами с остановками. Сначала план, код только после явного «ок» пользователя.
- Проверка перед сдачей: `pnpm test` и `pnpm typecheck` (в корне, `pnpm -r`).

## Принятые решения

- Холды: soft-delete через `is_cancelled`, строки не удаляются.
- Фильтры по периоду — только по `local_date`.
- Банки учитываются, если `balance > 0` ИЛИ для банки есть запись в `sync_state`.
- P2P-переводы → категория «переводы людям»; оверрайды категории по `counter_name`.
- Текстовые эвристики распознавания переводов строятся только на основе реальных данных,
  а не на догадках о формате `description`.
- Внутренние переводы (`packages/core/src/transfers.ts`) размечаются проходом после записи окна, окно расширяется
  на N = 20 с в обе стороны. Правила по приоритету: `pair` (одна валюта, точное зеркало, оба MCC 4829),
  `pair_fx` (разные валюты, оба равенства `operation_amount` ↔ `amount`), `jar_reversal` (откат
  автопополнения в той же банке, плюс раньше минуса), `iban`, `text` (служебные шаблоны без пары,
  кроме «Переказ на картку»). После `pair_fx` идёт `pair_fee`: одна валюта,
  `out.amount + out.commission_rate = −in.amount`, комиссия > 0. Пары строго один-к-одному: минимальный Δt,
  при равенстве — id.
- Шаблоны описаний Monobank — один источник в `packages/core/src/providers/monobank/descriptions.ts`, их используют и
  маскировка, и разметка (через правила провайдера).
- «Щомісячний платіж» → «рассрочки и кредиты», не internal. Двойного счёта с исходной покупкой нет
  (проверено на истории с 01.01; серия −1345 ₴ покрыта частично, принята как есть).
- Комиссия: строка с `commission_rate > 0` в агрегатах делится на тело (`amount + commission_rate`)
  и комиссию → «комиссии банка». У internal-строки тело исключается, комиссия остаётся тратой.
- **Переводы внутри семьи** (`transfer_rule = 'family'`): пара (`pair` / `pair_fx` / `pair_fee`) или совпадение `iban`
  между счетами **разных участников**. `is_internal_transfer = 0`; категория — «семье» у отправителя и «поступления» у
  получателя (раньше оверрайдов, как internal); не возврат. Итоги (`spendingSummary`, `comparePeriods`, `incomeSummary`):
  без `participantId` — вся семья, `family` исключается как internal (комиссия остаётся тратой); с `participantId` —
  только счета участника, `family` — трата «семье» / доход с источником `family`. С одним участником `family` не
  возникает и цифры прежние. В отчёте recategorize `family` появляется, только если такие строки есть.
- Агрегаты трат: по категории и валюте счёта три числа — брутто, возвраты, нетто (нетто = брутто − возвраты).
  «Поступления» и «свои переводы» в траты не входят. Валюты не суммируются. Реализация: `spendingSummary`
  в `packages/core/src/summaries.ts` (`spendingByCategory` в `packages/core/src/queries.ts` — обёртка).
- MCC без маппинга (в «другом»): 7399, 5999, 8999, 7299, 5311, 5331, 5399, 2791 — размытые.
  6012 делится по знаку: зачисления → «поступления», списания → «рассрочки и кредиты».
  8398 → «благотворительность» (донаты в чужие банки через 4829 — позже оверрайдами).
- Фикстуры тестов — только вымышленные имена и суммы; ничего из реальных данных и отчётов.

- Старое название банки в описаниях до августа принимается как есть (пары покрывают такие строки).
- Возврат с другим MCC (`packages/core/src/refunds.ts`, колонка `refund_pair_id`, не перевод): тот же счёт, зачисление
  MCC 4829 не «Від: …», сумма = |покупка|, покупка не 4829, зачисление через 0–15 мин, один-к-одному.
  Возврат получает категорию покупки. Возврат без покупки в периоде считается возвратом как есть.
- Оверрайды категорий — через `overrides:*` (только пользователь); категория валидируется по списку,
  после изменения — recategorize + обновление копии.

- В логах вместо маскированного номера карты писать тип и валюту счёта (например, `black/UAH`).

## План фазы 4 (пункты 1–2 готовы, 3–4 после фазы 5)

- ✅ Реализовано (миграция v7, `packages/core/src/scope.ts`, `packages/core/src/settings.ts`): `scope = personal | business`, вычисляется
  после категорий (`rescope` в проходах sync и recategorize), в whitelist копии. Возврат берёт scope покупки. Приоритет:
  1. `scope_overrides` — исключения; шаблон сопоставляется с `counter_name`, а если его нет — с исходным
     `description` (у казначейства и 9311/9399 контрагента нет). Заводит пользователь (`scope-overrides:*`);
  2. счёт `type = fop` → `business`;
  3. платёж в казначейство (`ГУК…`) с любой карты → `business` — **настройка, по умолчанию включена**
     (через казначейство идут и личные платежи: штрафы, госпошлины — их исключать оверрайдами);
  4. остальное → `personal` (в т.ч. 9311/9399 с личных карт).
- Internal-переводы ФОП ↔ личные в траты не входят ни в одном scope.
- Настройки — таблица `settings` в БД + CLI (только пользователь): «казначейство → business» (вкл. по умолчанию),
  «раскрывать полные имена» (выкл. по умолчанию).
- Порядок: 1) scope; 2) `spendingSummary(groupBy)`, `comparePeriods`, `incomeSummary`, `getBalances`,
  `getSyncStatus`; 3) нормализация мерчанта, `merchant_key`, `topMerchants`, `searchTransactions`,
  `findRecurring`; 4) сверка с балансами. Стоп и отчёт в `reports/` после каждого пункта.
- `merchant_key` в копии = HMAC-SHA256(секрет, нормализованный мерчант), первые 12 символов. Секрет создаётся
  один раз в `data/`; если файл пропал — экспорт падает с ошибкой, новый не генерирует.
- `search_text` (нормализованный текст для поиска, кириллица через JS) — только в основной БД, в whitelist
  копии не входит; тест, как для остальных чувствительных колонок.
- Имена в ответах тулов: `counter_name` всегда маскируется («О. Т.»). `searchTransactions` принимает полное имя
  во входе и матчит локально, в ответе маска. Раскрытие — только настройка в `settings`, не параметр тула.
- `findRecurring`: период 25–35 дней, сумма ±10%, минимум 3 повторения; если валюта операции ≠ валюте счёта —
  сравнивается `operation_amount`.
- ✅ Пункт 2 реализован: `packages/core/src/summaries.ts` (`spendingSummary`, `comparePeriods`, `incomeSummary`) и `packages/core/src/status.ts`
  (`getBalances`, `getSyncStatus`). Суммы в копейках валюты счёта, валюты не суммируются, без имён и описаний;
  счета — id + подпись `type/CUR`.
- `getBalances`: поля `own_funds` (основное) = balance − credit_limit, `credit_limit`, `available` (= balance).
- `spendingSummary` и `comparePeriods`: флаг неполного периода (конец периода после последнего sync или
  в будущем) и среднее в день. «Последний sync» — наименее свежий `newest_synced_time` среди счетов;
  среднее делится на полностью покрытые дни (день sync не считается, если синк не дошёл до его конца).
- Холды старше 3 дней (окно повторного sync) — окончательные: `pendingHolds` / `pending_holds` считают только свежие.
- `incomeSummary`: источник по форме операции, не по имени: `other_bank` (6012), `named_sender` («Від: …», люди и клиенты ФОП),
  `transfer` (прочие 4829), `other`. Возвраты и internal — не доход, кэшбэк не входит.
- Модули, которые импортирует recategorize, не импортируют `config.ts`: константы — `packages/core/src/constants.ts`
  (лимиты банка — `providers/<id>/constants.ts`), пути — `apps/mcp/src/paths.ts`.

## Фаза 5: MCP-сервер

- `apps/mcp/src/server.ts` (точка входа, `.env` и токен), `apps/mcp/src/mcp/run.ts` (stdio), `apps/mcp/src/mcp/tools.ts` (тулы).
  Тулы: `spending_summary`, `compare_periods`, `income_summary`, `search_transactions`, `get_balances`, `get_sync_status`,
  `sync_recent`.
- v1.1 (поездки): `operation_currency` (буквенный ISO, маппинг `packages/core/src/currency.ts`) — group_by и фильтр в `spending_summary`
  и `compare_periods`. Суммы в валюте счёта + блок `operation` (валюта операции), только если у группы одна валюта
  операции; суммы по экспоненте ISO (JPY 0, KWD 3). Страну API не отдаёт — в описаниях тулов подсказка про валюту и даты.
- `search_transactions` (`packages/core/src/search.ts`): текст ищется в JS (`normalizeSearch`: NFKC, `toLocaleLowerCase('uk')`) по
  description + counter_name; `merchant` = description, но имя → инициалы (строка с именем контрагента, «Від: …»,
  4829 не шаблон/казначейство), номер карты → `[картка]`, название банки → `банка`; `counterparty` — `displayCounterName`.
  limit 50 / макс. 200, `total` + `truncated`, итоги по всем совпадениям в валюте счёта и операции.
- Ответ — JSON: суммы в основных единицах рядом с кодом валюты, блок `period` (`incomplete`, `data_until`,
  `covered_days`, `pending_holds`), `notes` с диагностикой. Ошибки ввода — `isError` с понятным текстом,
  прочие — общий текст, подробности только в stderr.
- Описание каждого тула: когда использовать, формат дат, что тул НЕ делает (проверяется тестом).
- Без имён, номеров карт, IBAN и названий банок; описания — только в `search_transactions` (с маской имён);
  `counter_name` — через `displayCounterName`
  (инициалы, полное имя только при `reveal_full_names`).
- `sync_recent` — клиент в режиме `fail` (не ждёт лимит), токен читается при первом вызове; балансы не обновляет.
- Подключение к Claude Desktop — `docs/claude-desktop.md` (абсолютные пути к node и загрузчику tsx).
- Тесты: `apps/mcp/tests/mcp.test.ts` — клиент SDK в памяти + настоящий stdio-процесс из чужого cwd.

## Этап 1: десктоп (решения)

- Имя приложения — «Balance Insights» (без «mono»: читается как бренд банка). В README и в окне «О программе» —
  «неофициальное приложение, не связано с Monobank». API в renderer — `window.balance`, каналы IPC — `balance:*`.
- Имя и `userData` задаются явно до `ready` (`app.setName` / `app.setPath`): prod —
  `~/Library/Application Support/Balance Insights/`, dev — `~/Library/Application Support/Balance Insights Dev/`.
  Тест проверяет, что путь ровно такой. Агент эти папки не читает и приложение не запускает (deny + sandbox).
- **Имя «Balance Insights» и `appId` `io.github.mortyq.balanceinsights` после первого релиза не меняются.**
  От имени зависят папка userData и запись Keychain, которой safeStorage шифрует токен (по поведению Chromium —
  «<имя> Safe Storage»). От `appId` — bundle id на macOS, установка и идентичность приложения на Windows, автообновление.
  Смена = пользователи теряют токен и данные или получают второе приложение. `appId` проверяет `tests/package.test.ts`
  (конфиг и `CFBundleIdentifier` в бинарнике).
- Бинарник Electron: `dev` и `build` первым шагом запускают `scripts/ensure-electron.mjs` (inline, без
  postinstall и других lifecycle-хуков). Нет бинарника — вызывает `install.js` пакета Electron, есть — ничего не делает,
  нет сети — ошибка с командой `binary:install`, которую выполняет пользователь.
- Репозиторий — публичный `github.com/MortyQ/muza-balance-insights` (`muza` — бренд автора). Лицензия MIT,
  `author: MortyQ` без email. Файлы для GitHub-сообщества (README, SECURITY, CONTRIBUTING, шаблоны) — на английском,
  везде запрет выкладывать токен, выписки, суммы, имена, скриншоты с данными. Уязвимости — через private reporting.
- Меню приложения — своё (`apps/desktop/src/main/menu.ts`): стандартное меню Electron даёт Reload/DevTools и Help-ссылки
  через `shell.openExternal`. В prod — без reload, DevTools и роли `help`; «О программе» — нативная панель на macOS,
  диалог на Windows/Linux. Дисклеймер — одна константа `apps/desktop/src/shared/about.ts` (панель и экран), репозиторий
  в «О программе» — текстом, не ссылкой.
- Иконка — `apps/desktop/build/` (`icon.icns` до 1024, `icon.ico` до 256, `icon.png` 512, исходник `icon.svg`),
  electron-builder берёт её оттуда сам. `package.test.ts` / `dmg.test.ts` проверяют размеры и что в `.app` своя иконка.
  Образы `.dmg` монтируются только в `test:dmg` (у пользователя): `hdiutil` в sandbox агента не работает.
- Установщики (этап 2): mac `.dmg` arm64 и x64, win `nsis` x64 (per-user, `oneClick`, данные при удалении
  остаются), linux `AppImage` x64, имена `Balance-Insights-<версия>-<os>-<arch>.<ext>`. Скрипты `package:mac|win|linux`
  всегда с `--publish never` (иначе electron-builder на теге в CI публикует сам). Кэш загрузок Electron —
  `apps/desktop/node_modules/.cache/electron` (`electronDownload.cache`, `electron_config_cache`).
  libsql для обеих архитектур Mac — `supportedArchitectures` в `pnpm-workspace.yaml`.
- Релиз — `.github/workflows/release.yml`: тег `vX.Y.Z` (= версия `apps/desktop/package.json`) → тесты на Linux и
  macOS → сборка на своём раннере каждой ОС + проверки бинарника (`PACKAGE_CHECK`, `DMG_CHECK`) → draft-релиз с
  `SHA256SUMS.txt` и attestations. Публикует draft пользователь руками. Ручной запуск — только артефакты, без релиза.
- Обновление без Developer ID (проверено 25.09.2026): macOS один раз спрашивает пароль к Keychain, токен сохраняется.
- Прежнее имя до 25.09.2026 — «Balans Insights». Его пути остаются в deny и sandbox `.claude/settings.json`, пока
  пользователь не удалит старые папки (Application Support, Caches, Logs, в том числе Dev).
- CSP в dev ослаблена только для HMR (`connect-src ws://localhost:<порт>`, `style-src 'unsafe-inline'`),
  prod — ровно `default-src 'self'; script-src 'self'; connect-src 'none'` (+ `object-src`/`base-uri`/`form-action`/
  `frame-ancestors 'none'`).
- Fuses и локальная сборка `electron-builder --dir` в этапе 1, тест по бинарнику.
- Импорт возобновляется при запуске автоматически, если токен в Keychain; если токен был только в памяти — UI просит ввести.
- E2E на Electron в этапе 1 нет: ручной смоук пользователя по чек-листу из отчёта.
- Отмена импорта — `signal` в `SyncContext` ядра + `kill()` через 10 с как запасной путь.
- Временные сбои импорта (сеть/таймаут, 5xx, 429 сверх повторов ядра) и падение worker пережидаются
  (`apps/desktop/src/shared/retry.ts`): первый повтор через 1 мин, дальше каждые 15 мин, до 4 ч сбоев подряд;
  закоммиченное окно сбрасывает серию. После повтора докачиваются только оставшиеся окна исходного плана.
  Worker сам не выходит после итогового сообщения — его закрывает main (иначе сообщение терялось).
  Сон компьютера во время паузы перед повтором в эти 4 ч не засчитывается (`sleptDuringPause`: пауза затянулась
  больше чем на 30 с — разница считается сном и сдвигает начало серии).
- Экран данных (шаг 7): main отдаёт узкие view-типы из `apps/desktop/src/shared/api.ts` (`apps/desktop/src/main/data.ts` поверх
  `spendingSummary` / `getBalances` ядра) — категории, суммы в минимальных единицах, даты, подписи `black/UAH`.
  Renderer из ядра импортирует только `@mono/core/currency` (формат сумм). По умолчанию — текущий месяц (Киев), «личное».
- Локальная сборка (шаг 8): `pnpm --filter @mono/desktop package:dir` → `apps/desktop/dist/` (в `.gitignore`), конфиг
  `apps/desktop/electron-builder.json`: fuses по таблице плана этапа 1, `asar` + `asarUnpack: **/*.node`, без rebuild,
  Electron из `node_modules`, без подписи (ad-hoc после fuses). `test:package` собирает и проверяет бинарник
  (`apps/desktop/tests/package.test.ts`: fuse wire, содержимое asar, `codesign --verify`); без `dist/` бинарная часть пропускается.
  `@mono/*` в devDependencies десктопа: их вшивает electron-vite, в asar они не попадают.
- Этап 1 закрыт 25.09.2026: Electron Security Checklist 20/20 (таблица — `reports/2026-09-25-stage1-step9-security-checklist.md`,
  пункты 15 и 16 — `apps/desktop/tests/checklist.test.ts`), итоги трат месяца на экране совпали с MCP.
- «Удалить все данные» (`apps/desktop/src/main/wipe.ts`): системный диалог → токены → остановка worker (`Importer.stop`,
  kill + ожидание выхода) → закрытие соединения → файлы `APP_FILES` (база с WAL, старый `token.bin`, задача импорта) и
  папки `APP_DIRS` (`tokens/`).
- Токены — `TokenVault` (`apps/desktop/src/main/token.ts`): файл на подключение `tokens/<connectionId>.bin` (safeStorage,
  0600), статус и «ввести заново» — по подключению. Старый `token.bin` при запуске переносится к подключению Monobank
  как есть, без расшифровки. Форма токена провайдера — `apps/desktop/src/net/providers.ts` (`DESKTOP_PROVIDERS`, запись на
  каждый провайдер ядра — `tests/providers.test.ts`).
- Импорт нескольких подключений — одна задача, один worker, один `import-job.json`: `start` несёт
  `connections: [{ connectionId, provider, token }]` (1–10), окна идут по кругу (`runPlans`). Всё, что worker знает о
  банке (клиент, разбор ошибок), — `apps/desktop/src/worker/providers.ts` (`WORKER_PROVIDERS`); сеть — таблица `FETCH` в
  `worker/import.ts`, у каждого провайдера `allowlistedFetch(net.fetch, [его сервисы])` буквально. Отклонённый токен
  (`auth`) или чужой / уже подключённый владелец (`connection`) выключает только своё подключение: итог — `done` с
  `failed`; если не прошло ни одно — `error` первого. Подключение без токена main пропускает и добавляет в `failed`.
  При запуске задача продолжается для подключений с токеном в Keychain; нет ни одного — `needs-token` с их id.
- IPC людей и подключений (`apps/desktop/src/main/people.ts`, `PeopleService`): `listPeople` (подпись участника — единственное
  имя, что уходит в renderer; без токена и `external_client_id`), `addConnection({ participant: { id } | { label } |
  { fromBank: true }, provider, token, remember })` (форма токена до записи; тот же токен второй раз — `duplicate`; токен не
  сохранился — подключение и новый участник откатываются; импорт не запускает), `renameParticipant`, `setConnectionToken`,
  `removeConnection` (во время импорта — `import-running` без диалога, затем системный диалог, токен, данные).
  `spendingSummary` / `getBalances` принимают `participantId`.
- Стили renderer — Tailwind v4 (`@tailwindcss/vite`), токены — копия `muzakit/libs/config/src/tailwind/theme.css`
  в `apps/desktop/src/renderer/src/app/styles/theme.css` (сканирование только renderer: `source(none)` + `@source`).
  Шрифт — Manrope Variable из `@fontsource-variable` (в Plus Jakarta Sans нет базовой кириллицы), локальные файлы.
  `assetsInlineLimit: 0`: prod-CSP не пускает `data:`. Тема — по системной, через `data-theme`.
  Библиотеку muzakit целиком не подключаем, пока она не публикуется пакетом. Нужные компоненты — копиями в
  `apps/desktop/src/renderer/src/shared/ui/` (шапка «copied from muzakit», отличия — `shared/ui/README.md`), без `vue-router`
  внутри копий, `@vueuse`, `@iconify/vue`. Иконки — `unplugin-icons` (`autoInstall: false`) из локального `@iconify-json/lucide`,
  явный реестр `ui/components/base/icons.ts`, канонические имена Lucide (не алиасы).
  Таблицу трат и формат сумм пишем свои (`VTable` и `formatCurrency` из muzakit не подходят).
- **Сеть — список доверенных сервисов** (`apps/desktop/src/net/allowlist.ts`, `TRUSTED_SERVICES`): `github` (обновления:
  `github.com`, `release-assets.githubusercontent.com`), `monobank` (`api.monobank.ua`). Каждый потребитель ограничен своими
  сервисами (`allowlistedFetch(fetch, ['monobank'])` — X-Token не уйдёт на другой хост); https, порт по умолчанию, без
  редиректов. Добавлять — только надёжные известные сервисы, отдельным шагом, с правкой `tests/allowlist.test.ts`.
- **Архитектура renderer — FSD** (`apps/desktop/src/renderer/src`), проверяет `apps/desktop/tests/architecture.test.ts`
  (правила — `tests/helpers/architecture.ts`, у каждого правила есть «ломающий» пример):
  - слои `app → pages → widgets → features → entities → shared`, импорт только вниз; слайсы одного слоя друг друга не
    импортируют (кроме сегментов `shared`: `api`, `config`, `lib`, `ui`); внутри слайса — относительные импорты;
  - снаружи слайс доступен только через `index.ts` (`@/features/x`, без глубоких путей); `index.ts` только реэкспортирует;
  - алиасы: `@/` → `src/renderer/src`, `@contract/` → `src/shared` (типы и константы, общие с main и preload);
  - пакеты в renderer — только белый список (`vue`, `vue-router`, `pinia`, `@mono/core/currency`, `~icons/lucide/*`, шрифт);
    `electron`, `node:*` и новая зависимость — ошибка теста;
  - `window.balance` читает только `shared/api/balance.ts`; `balanceApi` вызывают только сегменты `api/` слайсов
    (`api/use<X>Request.ts`, возвращают объект функций) и подписки в `app/listeners.ts`;
  - сегменты слайса: `<Name>Feature.vue` (корень фичи), `api/`, `composables/` (логика, явный `Use<X>Return` в `types.ts`),
    `components/` (только отображение), `store/` (Pinia setup-store, только тут), `types.ts`, `constants.ts`, `utils.ts`
    (чистые функции); страницы — тонкие оболочки над фичами и виджетами;
  - общее состояние — Pinia в `entities`: `participant` (люди, подключения, статусы токенов, выбор «Вся семья / человек» —
    `selectedId`, запоминается в `localStorage` только для удобства), `sync-status` (статус данных и `version`, на который
    перезагружаются данные), `import-progress`; реакции между сущностями — в `app/listeners.ts` (люди обновляются на
    `needs-token`, в начале окон импорта и в его конце);
  - данные из main — `useAsyncData` (`shared/lib`): `Loadable<T>`, прошлое значение остаётся на время загрузки и после ошибки.
- Навигация — `vue-router` с memory history (адрес страницы всегда `app://renderer/index.html`), маршруты в `app/router`,
  имена — `ROUTE` в `shared/config`. Guard (`app/router/guards.ts` + `startRoute.ts`): экран подключения — только если нет ни
  одного подключения и нет данных; подключение без токена → главный с плашкой «Ввести токен»; настройки доступны всегда.
  Банки — `entities/bank` (Monobank + «Скоро»), подключение — `addConnection` в main (пока только Monobank).
- Простой UI людей (шаг 4e, до редизайна): настройки → «Люди и подключения» (`features/people`: имя и «Переименовать»,
  подключения со статусом токена, «Ввести токен заново», «Удалить», «Добавить подключение» — существующий человек или
  новый с именем / «Взять имя из банка», текст о согласии владельца токена); первый экран — `ConnectFirstFeature` той же
  формой с человеком «Я»; на главном — `features/participant-switch` («Вся семья / имена», только если людей больше одного),
  траты и балансы берут `participantId`; импорт показывает, какие подключения не загрузились.
  Логотип — необязательный локальный файл `entities/bank/assets/<id>.svg|png|webp`, иначе монограмма.
  «Настройки…» `CmdOrCtrl+,` в меню → `balance:open-settings` (main → renderer, без данных) → `onOpenSettings` в preload.

## Бэклог

- Веб-версия (Nuxt SPA) снята с плана: вместо неё десктоп на Electron (этап 1). Веб — возможная будущая версия.
- **Приложение как MCP-сервер для Claude Desktop**: данные в приложении, вопросы в Claude по подписке пользователя,
  без API-ключа. Главная будущая фича.
- **Единая база**: когда десктоп станет MCP-сервером, Claude Desktop читает базу десктопа (userData «Balance Insights»),
  а `apps/mcp` остаётся инструментом разработчика.
- Трей: импорт продолжается при закрытом окне.
- Распространение (бесплатно): публичный репо, сборка electron-builder в GitHub Actions по тегу (mac .dmg, win .exe,
  linux AppImage), публикация в GitHub Releases с SHA-256 и build provenance attestations. Страница установки
  со скриншотами обхода Gatekeeper и SmartScreen. Windows: заявка в SignPath Foundation на бесплатную подпись.
  macOS: без подписи, пока не решено иначе.
- **Автообновление — реализовано** (`apps/desktop/src/main/update/`):
  - новая версия предлагается только через подписанный манифест `update.json` + `.sig` (ed25519, `manifest.ts`):
    подпись проверяется до разбора, дальше — appId, версия строго выше текущей (без отката), имена файлов по шаблону;
    файл перед установкой или сохранением сверяется по размеру и sha512;
  - Windows и Linux AppImage — `electron-updater` (фид `latest*.yml` того же релиза, версия должна совпасть с манифестом),
    скачивание в фоне, `autoInstallOnAppQuit` включается только после проверки файла; «Перезапустить и обновить»
    не во время импорта. macOS и Linux без `$APPIMAGE` — проверенный файл в «Загрузки», `shell` не используется (#15);
  - сеть — только сессия `electron-updater` (одна на его запросы и наши) с фильтром сервиса `github`, в том числе на каждом
    редиректе (`session.ts`); `fromPartition` и `electron-updater` — только в `update/electron.ts`;
  - проверка через 10 с после запуска и раз в 6 ч; выключатель в настройках (`userData/preferences.json`, по умолчанию вкл.);
    в dev не проверяется. Релизы публикуются обычными, не pre-release (`/releases/latest`).
  - Ключ: `scripts/update-keygen.mjs` (только автор), подпись — `scripts/update-sign.mjs` в release job.
  - Не проверено на живом обновлении: фильтр сессии на редиректах GitHub, SmartScreen при тихой установке, карантин `.dmg`.
- **Живое обновление при импорте — реализовано** (`app/listeners.ts`): каждый новый `windowsDone` → `syncStatus.refresh()`
  не чаще раза в `LIVE_REFRESH_MS` (3 с, `throttle` из `shared/lib`, последний тик не теряется), конец импорта — ещё раз.
  Экраны перезагружаются по `version` «тихо» (`useAsyncData(…, { quiet })`: без `loading`, старые цифры до прихода новых);
  пока идёт импорт, в тратах строка «Идёт импорт — цифры дополняются». Тесты renderer с алиасами — `tests/renderer/`
  (типы проверяет `tsconfig.web.json`).
- Остальные экраны: сравнение месяцев, поездки по валюте операции, доходы, поиск операций.
- AI-режим со своим API-ключом: ключ в main через safeStorage, модель выбирает график из белого списка компонентов,
  код не генерирует.
- Погода (Open-Meteo) и курсы (`/bank/currency`): запросы из main по списку разрешённых адресов.
- Обновление Node с 22.
