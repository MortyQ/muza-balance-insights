# Правила домена: категории, переводы, возвраты, scope, агрегаты

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: packages/core, apps/mcp.

## Принятые решения

- Холды: soft-delete через `is_cancelled`, строки не удаляются.
- Periods (`spendingSummary`, `comparePeriods`, `incomeSummary`, `periodInfo`, `searchTransactions`, `exchangeRates`,
  `crossingCategories`) are calendar days [from, to] of a time zone (`tz`, `packages/core/src/periods.ts`; absent → Kyiv,
  which the MCP server keeps) and match rows by `time` in [start of `from`, start of the day after `to`). Grouping by
  `day` / `month` reads the zone's own day starts (`periodBuckets` → CTE `buckets`), right across DST. The desktop passes
  the system time zone. `local_date` stays the Kyiv date (the anonymised copy, diagnostics), not used by periods.
- Банки учитываются, если `balance > 0` ИЛИ для банки есть запись в `sync_state` (авто-правило; выбор пользователя
  `accounts.sync_choice` сильнее — см. ниже).
- **Выключенный счёт** (`packages/core/src/accounts.ts`, вариант A) считается чужим: его строк нет ни в тратах, ни в
  доходах, ни в балансах (`getBalances`, `balancesAt`), ни в курсе обменов, ни в поиске, ни в статусе и покрытии
  (`periodInfo`, `getSyncStatus`, `firstDataDate`, покрытие в `listConnections`); строки остаются в базе и возвращаются,
  как только счёт включён. Перевод включённого счёта с выключенным (пара `transfer_pair_id` на выключенном счёте или
  одиночное совпадение `iban` с ним — `crossesDisabledSql`) — обычная операция: не internal и не `family`, категория —
  как без пометки перевода (`crossingCategories`: `categorize` в момент запроса, в SQL — CTE `crossing AS MATERIALIZED`
  из `json_each`), источник дохода — по форме. Разметка и колонки не меняются, rederive не нужен. Перевод без пары,
  сделанный уже после выключения (`text`), — тоже обычная операция, если правило провайдера
  (`ownTransferCounterpart`: шаблон банки или её название, «На білу картку» / «З Чорної картки» — тип карты,
  тексты ФОП — тип и валюта) указывает только на выключенные счета того же подключения; текст, который подходит и
  включённому счёту, или не называет счёт вовсе (автопополнение «10%»), остаётся internal (`docs/backlog.md`).
  Диагностика (`transferDiagnostics`, `categoryCounts`, `scopeCounts`, отчёт recategorize, `overrideCandidates`) — по
  всей базе.
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
- `purchases` (spendingSummary, per group and per currency total): spending lines with `amount < 0`; a refund is not an
  operation, a commission is its own line («Bank fees»). `lines` counts every line, refunds included.
- `spendingSummary` also groups by `day` (a day of the period's zone) — internal: not in `SPENDING_GROUP_BY`, so the MCP tools
  do not offer it. Its one user is the desktop's «Now» strip: personal scope; today's Monobank rates for every
  day; the usual day = the median of daily net over the 30 days before today that the data covers (from the first data
  date to the last fully synced day; a day without spending = 0; fewer than 7 such days — none); last week = Monday − 7 …
  today − 7, none when the data starts later.
- `spendingGrid` (category × day or month of the period's zone, one query over `spendingLinesSql` + `SPENDING_LINE_SQL`,
  so per currency its cells add up to `spendingSummary`'s groups) and `incomeSummary` `groupBy: 'day'` — internal, for the
  desktop's analytics screen only (not in `SPENDING_GROUP_BY` / `INCOME_GROUP_BY`, the MCP tools do not offer them).
- The desktop converts account currencies at today's Monobank sell rate (main `rates.ts`); core `exchangeRates` (own
  exchanges) now serves only the MCP server.
- MCC без маппинга (в «другом»): 7399, 5999, 8999, 7299, 5311, 5331, 5399, 2791 — размытые.
  6012 делится по знаку: зачисления → «поступления», списания → «рассрочки и кредиты».
  8398 → «благотворительность» (донаты в чужие банки через 4829 — позже оверрайдами).
- Фикстуры тестов — только вымышленные имена и суммы; ничего из реальных данных и отчётов.
- Остаток на конец месяца (`balancesAt` в `packages/core/src/status.ts`): остаток банка после последней
  неотменённой операции до конца месяца (`endSec`, исключая саму секунду); если он не сохранён или в последнюю
  секунду покрытия несколько операций — обратный расчёт: текущий остаток минус сумма операций от конца месяца и
  позже. `accounts.balance` — остаток на момент `updated_at` (взят из client-info до выписок), поэтому обратный
  расчёт суммирует только операции с `time` между концом месяца и `updated_at` включительно — более поздние
  (ещё не отражённые в этом остатке) в сумму не входят. Покрытие счёта начинается позже конца месяца, или счёта
  нет в `sync_state` вовсе — «нет данных» (`null`). Кредитный лимит истории не имеет — для прошлых месяцев берётся
  текущий.
- Курс своих обменов (`exchangeRates`, `toUah` в `packages/core/src/fx.ts`): копейки гривны за минимальную единицу
  валюты из строк `pair_fx` на гривневых счетах. Продажи валюты; покупки — только если валюту ни разу не продавали.
  В месяце — средний, взвешенный по сумме; иначе ближайший обмен по времени (секунды до границ месяца в его поясе,
  равенство → более ранний), `nearest: true`. Общий для семьи, холды входят, отменённые — нет; обменов нет → курса
  нет, `toUah` → `null`, часть не входит в суммы. Пользуется только блок балансов десктопа («Пришло / Ушло» итоговых
  карт, `CardTotal.fx`); MCP-тулы не меняются.

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
- `findRecurring` is implemented (`packages/core/src/recurring.ts`, for the desktop's regular payments screen; carries
  the bank's text like `categoryLines`, never for an MCP tool or the copy). Rows: the spending lines (`spendingLinesSql`,
  bodies with `amount < 0`, holds included). Payee = `counter_iban`, else `counter_edrpou`, else the description
  lower-cased without punctuation and with runs of 3+ digits as `#`; plus the operation currency. A payee's payments
  are split by amount (±10% of a group's median `operation_amount`), and each group's series is the run back from its
  newest payment while gaps are 25–35 days or a skipped month (55–70); at least 3 payments and 2 one-month gaps.
  `active` — the last payment at most 40 days old. The desktop puts the next payment a calendar month after the last.
  `kind: 'income'` finds regular income by the same rules on the income rows (`incomeRowsSql`: no refunds, no own or
  — for the whole family — family transfers): a sender who pays about once a month.
- Marks on regular payments (migration v12, `recurring_marks`): `mandatory` (must be paid) or `hidden` (not a regular
  payment), by payee — the series key (`payeeOf`: payee + operation currency), so a mark holds for later payments and
  a new description to the same IBAN; two prices at one payee share it. `setRecurringMark(db, transactionId, mark |
  null)` finds the payee by a payment of the series. The key holds bank text: the table is in this database only (not
  whitelisted for the copy); «Start over» and «Delete all data» lose it like the overrides.
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
- `incomeLines` (`packages/core/src/income-lines.ts`, for the desktop's income screen only): the rows behind `incomeSummary`
  from the same query (`incomeRowsSql`), with source and the «Від: …» sender's name; carries the bank's text, never for
  an MCP tool or the anonymised copy.
- Модули, которые импортирует recategorize, не импортируют `config.ts`: константы — `packages/core/src/constants.ts`
  (лимиты банка — `providers/<id>/constants.ts`), пути — `apps/mcp/src/paths.ts`.
