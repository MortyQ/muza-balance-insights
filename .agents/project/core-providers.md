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
