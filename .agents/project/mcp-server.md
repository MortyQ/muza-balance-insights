# MCP-сервер (`apps/mcp`)

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/mcp.

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
