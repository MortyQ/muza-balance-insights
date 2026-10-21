# Ядро: провайдеры банков

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: packages/core.

## Layout

`packages/core/src` is layered. A module imports its own folder and the folders below it, never above; `ingest` and
`commands` are both top and never import each other. Nothing lives at the root of `src/`. Checked by
`packages/core/tests/layers.test.ts` (with breaking examples). Bottom up:

| Folder | Holds |
|---|---|
| `shared/` | platform services, errors, cancelling, constants, currencies, formatting, periods, CSV |
| `storage/` | the `Db` contract and `migrate()` (`db.ts`); `migrations.ts` lists `migrations/vNN.ts`, one per version |
| `providers/` | the provider contract, the registries, the request slot (`ratelimit.ts`), one folder per bank |
| `people/` | participants, connections, accounts, colors, settings: reads and plain writes |
| `derive/` | the derivation: transfers, refunds, categories, scope, overrides, crossing, `rederive`, its diagnostics |
| `read/` | statistics and lookups: `filters`, `spending`, `compare`, `income`, lines, status, fx, recurring, search |
| `ingest/` | the import: `plan` (windows, order), `commit` (one span in one transaction), `sync` (the loop), statement files |
| `commands/` | writes on people and accounts that then re-derive (`setAccountEnabled`, `deleteConnection`) |

- A write that must re-derive belongs in `commands/` (or `ingest/`), not in `people/`: a lower layer cannot call
  `derive/`.
- A large module is split by job inside its folder (as `ingest/sync.ts` → `plan` / `commit` / `sync`), not with an
  index file: imports name the module (`@mono/core/read/spending`).
- A new migration is a new `storage/migrations/vNN.ts` and a new entry at the end of `storage/migrations.ts`.
- Tests mirror the folders (`packages/core/tests/<folder>/`); structure tests (`purity`, `providers-boundary`,
  `layers`) stay at the root and read `src/` through `tests/source-tree.ts`.

- **Провайдеры банков** (`packages/core/src/providers/`, спека — `reports/2026-09-26-connections-spec.md`):
  - контракт — `providers/types.ts` (`ProviderRules`, `ProviderClient`, `NormalizedAccount` / `NormalizedTx`), без импортов;
  - провайдер = две половины: **правила** `providers/<id>/rules.ts` (чистые: признаки строки, маскировка, лимиты API) и
    **клиент** `providers/<id>/client.ts` (сеть, страницы, 429). Разметка (`rederive`) клиента не загружает;
  - домен (every folder but `providers/`: `derive/`, `read/`, `ingest/`, …) входит в
    провайдеры только через `providers/types.ts` и реестр правил `providers/rules.ts`; провайдеры друг друга не импортируют;
    в коде домена нет MCC 4829/6012, текстов Monobank, `'fop'` и хоста банка. Всё это проверяет
    `packages/core/tests/providers-boundary.test.ts` (с «ломающими» примерами);
  - Monobank: `providers/monobank/{rules,descriptions,client,constants}.ts`;
  - провайдер счёта — `connections.provider` его подключения (`accountProviders` / `providerOf` в
    `packages/core/src/people/connections.ts`); счёт без подключения — ошибка, а не значение по умолчанию;
  - statement files, the provider's third, optional half: `providers/<id>/statement.ts` (a pure `StatementFileParser`:
    text → `ParsedStatement` or a `StatementProblem` code), listed in `providers/statements.ts` — the domain's third door
    (the boundary test allows only `<id>/statement.ts` and `types.ts` there). Monobank takes the card statement in
    Ukrainian (its service texts are the API's); the English one (translated texts) and the FOP one are refused with
    their own codes. Money is read as text into minor units; an absent cell (`—`) stays absent. The CSV reader is
    `src/shared/csv.ts`. Writing: `src/ingest/statement-import.ts` (`compareStatement` — counts and what blocks the write: a token
    connection, another currency, a hole; `commitStatement` — through `commitRows` of `ingest/commit.ts`, the write half of
    `commitWindow`, without hold cancelling). Row ids: account, second, amount and the order among equal rows;
  - общее для всех клиентов: слот запросов `src/providers/ratelimit.ts` (интервал задаёт провайдер), ошибки `src/shared/errors.ts`
    (`RateLimitError`, `StatementFormatError`).
