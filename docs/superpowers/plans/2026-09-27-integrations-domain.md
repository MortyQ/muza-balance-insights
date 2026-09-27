# Домен `integrations`: подключение и синк по банкам — план

> Выполнять задачами по порядку (subagent-driven), после каждой — ревью, тесты и коммит. **Чистый рефакторинг:**
> поведение, тексты экрана, каналы IPC, файлы токенов, база — без изменений. CHANGELOG не пополняется (внутреннее).
> Этап «общий тип доступа» (credential union: OAuth / open banking / файл) — позже, отдельным планом.

**Цель:** всё, что зависит от банка (форма доступа, шаги получения токена, тексты ошибок, клиент и разбор ошибок в
worker), живёт в папке своего банка; общее (люди, фильтр людей, прогресс импорта, статус данных, автосинк) — отдельно.
Первый банк — `monobank`; в названиях домена и UI — `integrations`, в базе и ядре остаётся `connections`.

**Ограничения:** правила FSD (`tests/architecture.test.ts`, `tests/helpers/architecture.ts`); `FETCH` в
`worker/import.ts` остаётся буквальным (`allowlistedFetch(net.fetch, ['monobank'])`, его держит
`tests/worker-entry.test.ts`); `tests/providers.test.ts`, `tests/allowlist.test.ts` — те же утверждения (только пути);
файлы доверия не трогаем; `tokens/<id>.bin` и перенос старого `token.bin` — байт в байт как раньше.

## Сейчас

- Renderer: `features/settings/people` смешивает людей (`PeopleFeature`, `PersonBlock`, переименование и цвет),
  подключения (`ConnectionsFeature`, `ConnectionRow`) и подключение Monobank (`AddConnectionForm` с `MONOBANK`,
  `useAddConnection` с `provider: 'monobank'`, `TokenField`, `BankCard`, тексты в `constants.ts`).
  `ConnectFirstFeature` экспортируется доменом settings (`pages/connect`). `entities/bank` (`BANKS`) несёт
  `tokenSteps` / `tokenPlaceholder`.
- Main/worker/net: `net/providers.ts` `DESKTOP_PROVIDERS`, `worker/providers.ts` `WORKER_PROVIDERS` (тексты ошибок
  Monobank), `main/people.ts` `PeopleService` (люди + подключения + токены вместе).

## Задача 1: renderer — домен `features/integrations`

- Новый доменный слайс `features/integrations` (добавить в `DOMAIN_SLICES`; это не ослабление проверки — отметить в
  отчёте): `shared/` (строка подключения `ConnectionRow`, выбор банка ex-`BankCard`, общие действия подключений —
  удалить, цвет, «Ввести токен заново» как диспетчер, api-запросы подключений, текст о согласии владельца) и
  `monobank/` (форма токена ex-`TokenField` + шаги, `useMonobankConnect` ex-`useAddConnection` в части токена,
  тексты). Корневые файлы домена: `ConnectionsFeature.vue`, `ConnectFirstFeature.vue`, форма добавления подключения.
  Как корневой файл выбирает форму банка — таблица `provider → компонент` в корне домена (корню можно импортировать
  подфичи; проверить, что `domainViolation` / `subFeatureOf` это допускают на корневом файле).
- `features/settings/people` оставляет только людей. Виджет `settings` берёт раздел «Подключения» из
  `@/features/integrations`; `pages/connect` — `ConnectFirstFeature` оттуда же.
- Тесты `tests/renderer/{people,settings}.test.ts` — пути; новые — если логика вынесена в utils.

## Задача 2: `entities/bank` — только отображение

- `BANKS`: `id`, `name`, монограмма/логотип, `status` (доступен / «Скоро»), `auth: 'token' | 'oauth' | 'file'`
  (у Monobank — `'token'`; подготовка к open banking, поведение не меняет). `tokenSteps` / `tokenPlaceholder` → в
  `features/integrations/monobank`.

## Задача 3: main/worker — папки банков

- `apps/desktop/src/integrations/monobank/{desktop.ts,worker.ts}` (или `src/main|worker/integrations/...` — выбрать то,
  что проще проходит границы процессов и `tsconfig`), `integrations/index.ts` — `Record<ProviderId, …>` (исчерпывающая
  запись по провайдерам ядра сохраняется). `DESKTOP_PROVIDERS` / `WORKER_PROVIDERS` собираются оттуда. `FETCH` — не трогать.

## Задача 4: `PeopleService` → `PeopleService` + `IntegrationsService`

- Люди (список, переименование, имя из банка, цвет человека) — `PeopleService`; подключения (добавить, токен, удалить,
  цвет подключения) — `IntegrationsService` (`main/integrations.ts`). Каналы и форма IPC — прежние (`ipc.ts` только
  перенаправляет вызовы). Тесты `tests/people.test.ts` делятся по сервисам без потери утверждений.

## Финал

- Документы: `.agents/project/desktop-renderer.md` (домен integrations, settings/people), `desktop-import.md`
  (сервисы, папки банков), корневой `CLAUDE.md` (блок settings-ui: «Подключения» — из integrations).
- Корень: `pnpm test`, `pnpm typecheck`.
