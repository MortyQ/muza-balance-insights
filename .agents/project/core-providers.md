# Ядро: провайдеры банков

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: packages/core.

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

- **The provider filter** (`Filters.provider` in `summaries.ts`; `getBalances` / `balancesAt` `provider`): only the
  accounts of that bank's connections, alone or with `participantId` (one subquery over `accounts → connections`). It
  narrows the accounts and nothing else: `excludedTransferSql` does not look at it, so a transfer between the owner's
  accounts in two banks stays internal in every view. Coverage (`periodInfo`) and `firstDataDate` stay family-wide. An id
  outside `PROVIDER_IDS` is refused (`validateFilters`). Tests get a second bank by mocking the two registries
  (`providers/types.ts`, `providers/rules.ts`): `packages/core/tests/bank-filter.test.ts`.
- **What adding a bank takes**: its rules and client under `providers/<id>/`, its id in `PROVIDER_IDS`, its entry in
  `PROVIDER_RULES`; in the desktop — `DESKTOP_PROVIDERS`, `WORKER_PROVIDERS`, the worker's `FETCH` table, its hosts in
  `TRUSTED_SERVICES` (a separate, reviewed step), its entry in `BANKS` and its form folder in `features/integrations`.
  The bank filter, the data channels and «Refresh» need nothing: their options come from the connections.
