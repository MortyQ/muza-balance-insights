# muza-balance-insights (локальная папка — monobank-mcp)

Локальный stdio MCP-сервер: транзакции Monobank → SQLite → готовые агрегаты трат. Дальше — десктоп на Electron.

@.agents/claude/behavior.md

## Структура монорепы (pnpm workspace)

- pnpm 12.6.0 установлен глобально через npm (`packageManager` в корневом `package.json`), Corepack не используется.
  Node — `.nvmrc` (22).
- `packages/core` (`@mono/core`) — платформенно-независимое ядро: провайдеры банков (сейчас Monobank), sync, категории, переводы, возвраты,
  scope, агрегаты, миграции и интерфейс `Db`. Без Node, браузера и глобалов: `fetch`, часы, логгер, id передаются
  снаружи (`packages/core/src/platform.ts`). Проверки: `packages/core/tests/purity.test.ts` и `tsconfig.json` ядра
  (`lib: ES2023 + WebWorker`, `types: []`). Runtime-зависимости — только `zod` и `@date-fns/tz`.
  Экспорт — TS-исходники по модулю: `@mono/core/<модуль>` → `src/<модуль>.ts`, без сборки.
  Доменные тесты — в `packages/core/tests`, на Node-адаптере (devDependency).
- `packages/db-libsql` (`@mono/db-libsql`) — Node-адаптер libsql → `Db` (PRAGMA, WAL). Не зависит от core (типы
  повторены, расхождение ловит typecheck ядра), чтобы не было цикла зависимостей. Нужен apps/mcp и main-процессу Electron.
- `apps/mcp` (`@mono/mcp`) — MCP-сервер, CLI, скрипты, обезличенная копия (`analysis/*`), `.env`/токен (`config.ts`).
- `apps/desktop` (`@mono/desktop`) — этап 1, Electron.
- `data/`, `.env`, `analysis/`, `reports/`, `docs/` — в корне репозитория (`REPO_ROOT` в `apps/mcp/src/paths.ts`).
- Корневые скрипты: `test`, `typecheck` (`pnpm -r`) и `q`. Больше корневых прокси нет.
- Аргументы CLI — через `cliArgs()` (`apps/mcp/src/args.ts`): pnpm передаёт `--` скрипту как есть;
  `apps/mcp/tests/cli-args.test.ts` проверяет это на настоящем pnpm.

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

## Процесс

- Работа идёт фазами с остановками. Сначала план, код только после явного «ок» пользователя.
- Проверка перед сдачей: `pnpm test` и `pnpm typecheck` (в корне, `pnpm -r`).

## Где остальные правила

Подробности по частям проекта — в `.agents/project/`. Они подключены через `CLAUDE.md` в папках пакетов и загружаются
сами, когда Claude работает с файлами этой папки. Задача затрагивает часть, файлы которой ещё не открывались, —
прочитать нужный файл самому до правок.

| Файл | Когда читать | Подключён в |
|---|---|---|
| `.agents/project/core-providers.md` | провайдеры банков, граница домена | `packages/core/CLAUDE.md` |
| `.agents/project/core-people.md` | участники, подключения, `runPlans`, порядок окон импорта | `packages/core/CLAUDE.md` |
| `.agents/project/domain-rules.md` | категории, переводы, возвраты, комиссии, scope, агрегаты, `search`, `findRecurring` | `packages/core/CLAUDE.md`, `apps/mcp/CLAUDE.md` |
| `.agents/project/mcp-server.md` | тулы MCP, формат ответов | `apps/mcp/CLAUDE.md` |
| `.agents/project/reports.md` | **перед любым отчётом** в `reports/` | `apps/mcp/CLAUDE.md` |
| `.agents/project/desktop-app.md` | имя, `appId`, userData, меню, иконка, установщики, релиз, автообновление | `apps/desktop/CLAUDE.md` |
| `.agents/project/desktop-security.md` | CSP, fuses, сеть, блокировка, шифрование базы, «Удалить все данные» | `apps/desktop/CLAUDE.md` |
| `.agents/project/desktop-import.md` | worker импорта, повторы, токены, IPC людей и подключений | `apps/desktop/CLAUDE.md` |
| `.agents/project/desktop-renderer.md` | FSD, «сначала `shared/ui`», стили, навигация | `apps/desktop/src/renderer/CLAUDE.md` (там же инструкции muzakit) |
| `docs/backlog.md` | планы и то, что не проверено вживую | — |
