# Бэклог

Перенесено из корневого `CLAUDE.md` (27.09.2026).

## Обязательно до MVP

- **Выбор счетов: переводы без пары на выключенный счёт** — остаются внутренними, если текст банка не называет счёт
  однозначно: автопополнение банки («10%», «До 10₴») с выключенной карты, «З Чорної картки» при двух чёрных картах,
  одна из которых включена. Нужны данные о том, как банк подписывает такие строки, прежде чем ловить их иначе.

- **Проверка безопасности для OAuth и open banking** (решение пользователя 27.09.2026: делаем обязательно; токен API
  банка — не самый надёжный способ доступа, цель — перейти на open banking). Сейчас сетевые правила запрещают редиректы
  и любые адреса вне `TRUSTED_SERVICES` (`apps/desktop/src/net/allowlist.ts`, `.agents/project/desktop-security.md`),
  а OAuth требует и того и другого. Отдельная спека и ревью до кода:
  - как проходит вход: системный браузер + loopback / свой протокол, PKCE, `state`; обработка редиректа только в main,
    renderer не видит ни кода, ни токенов;
  - какие хосты банка и провайдера open banking добавляются в список доверенных, редиректы — только по точному списку
    (правка `allowlist.test.ts` отдельным шагом);
  - хранение access / refresh токенов (safeStorage, как `TokenVault`), срок жизни, обновление и отзыв, «Удалить все данные»
    и «Начать заново» их тоже стирают;
  - CSP и fuses не ослабляются; что меняется в `wipe.ts`, `start-over.ts`, импорте под замком.
  Подготовка уже есть: домен `integrations` (папка на банк), `ways: ('token' | 'oauth' | 'file')[]` у банка в `entities/bank`.
  Следом — общий тип доступа вместо строки-токена (этап 5 плана `docs/superpowers/plans/2026-09-27-integrations-domain.md`).

- **Statement files: not checked on a live system** (plan `docs/superpowers/plans/2026-10-07-statement-files.md`,
  Task 9) — the reference check: a Ukrainian Monobank card statement for a period the token already covers, «Check
  against a statement» on that card; expected `matched = rows`, nothing differing or missing. Still assumptions until
  then: the card amount includes the fee (as in the API), the row order. Next: the FOP statement (needs its Ukrainian
  header; the IBAN in its title line can find the account), other banks' formats (Sense, Oschadbank: CSV), the English
  statement only with templates taken from real data.

- **Шифрование базы: не проверено вживую** — шифр в бинарниках libsql win32/linux (первый прогон release на Windows),
  darwin-x64; тексты ошибок `decryptStringAsync` и что «Запретить» даёт «temporarily unavailable»; «Всегда разрешать» на
  ad-hoc-сборке; префиксы `v10`/`v11` на живом Linux. Смоук-чек-лист — `reports/2026-09-27-db-encryption-smoke.md`.
- **Автосинхронизация: не проверено вживую** — сон и пробуждение (`resume` + 60 с), 4 часа при открытом приложении,
  «Загрузить» поверх автосинхронизации (worker останавливается, ручной импорт идёт с начала), выключенный переключатель,
  запуск под замком. Холды, завершённые позже 3 дней, после автосинхронизации перестают быть холдами.
- **Токены и ключ базы на Linux без keyring — проверить вживую** (VM или `--password-store=basic`): по коду async API без
  keyring шифрует встроенным ключом (`v10`), и `SecureStore` должен счесть это `insecure` (токены в памяти, база открыта с
  `no-secure-storage`).
- Когда приложение станет MCP-сервером — замок должен закрывать и MCP-доступ. Windows Hello — отдельным шагом (нативный модуль).
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
- Остальные экраны: сравнение месяцев, поездки по валюте операции, доходы, поиск операций.
- AI-режим со своим API-ключом: ключ в main через safeStorage, модель выбирает график из белого списка компонентов,
  код не генерирует.
- Погода (Open-Meteo): запросы из main по списку разрешённых адресов.
- Обновление Node с 22.

## To check live: app shell (desktop-app-shell)

- The sidebar under the title bar: macOS traffic lights and the Windows / Linux overlay buttons do not cover it.
- A narrow window (< 45rem): the menu button opens the drawer; a pick, Escape and a click outside close it.
- A medium window (45–64rem): icons only, tooltips on hover; widening restores the stored choice.
- Fold, relaunch: the menu opens folded.

## To check live: month pace (desktop-month-pace)

- The balances block at three widths: the pace beside the month panel (wide), under them (medium, narrow), folding
  with the open row; a past month (whole month, no «Available per day»); a person picked.

## To check live: home tiles (desktop-home-tiles)

- The grid's steps: one column in a narrow window, two from about 750 px of content, twelve columns (5·4·3, 4·4·4,
  9·3) from about 1260 px; no tile cut or overlapping, the folded stack fits its 5 columns.
- Opening and folding the cards: «Balance» takes the whole row, the pace chart and «Month» come back at once and the
  chart fits its tile; the free line follows the card in front while the row scrolls.
- «Today» / «This week»: equal heights with one and with three categories, the details tile, its switch and close; an
  empty day; «What's unusual» hidden while the details are open; a past month (no «Now» tiles).
- «Spending by category» with 4+ categories unfolded and folded; «Who spent what» in the family view, absent for one
  person; the regular payments tile beside it.
- The header's hairline while scrolling; both themes (the new dark one included); the pace chart's pill near the top.

## Later: currencies

- PLN (or other currencies) as a main / «≈» currency: one entry in `CURRENCIES` (`entities/currency-display`) and the
  dictionaries; the rate is already in the Monobank answer.
- The `CurrencyToggle` popover and the «Spending» gear popover have no accessible name for the dialog itself: give
  `VPopover` a `title` / `aria-labelledby` option.
- `pendingHolds` ignores the participant and scope filters, in «Spending» and in the «Now» strip alike.

## Later: analytics

- Open the category screen from analytics: that screen is one scope and one month, analytics is all scopes over a range,
  so the figures would not match. Needs a scope filter on analytics or a range on the category screen.
- A personal / business switch on analytics; weeks or quarters as the unit of a range; keeping the period between
  launches.
- Not checked on a live system: the analytics screen (layout, the charts' look, the period picker's hover preview).

## Later: home screen

- «Spending»: show today's categories too — most likely a switch right by the category bars (month / today), so the
  block answers «what did I spend on today» without a separate view.

## Check on a live system: core read model (`openspec/changes/archive/2026-10-21-core-read-model`)

- **Migration 16 on a real database**: how long the first launch after the update takes (the `transactions` rebuild
  plus the one-time compaction), and whether the `[db] compaction …` line says `done`. A failed compaction leaves
  the data correct but the file large until the next VACUUM.
- **The real payload size**: the bank's item per operation in `transaction_raw`, compared with the 1 KB the benchmark
  assumes (`packages/core/bench/generate.ts`). A much larger payload makes the gain from moving it out bigger; a much
  smaller one makes the bench too optimistic about the old layout.
- **The speed of the screens on a real database, before and after**: home (the balance cards, the «Now» strip, the
  spending block), a category screen, analytics for a month and for a range of months; with one person and with
  several. The bench (`packages/core/bench`, fictional data) shows 1.5–40 ms per statistic after the change; a real
  database may differ in size, payload and the share of transfers.
- **The end of an auto-sync on a real database, before and after**: the time of the `rederive` phase (the worker's
  `rederive: N spans, …` log line marks the incremental pass; a line with the categories count marks a full pass).
  A routine auto-sync should take the incremental pass; a full one after an ordinary sync means an account's IBAN, jar
  title or card type looked changed.
- Not checked on a live system: the balance block (`balance-cards-row`): snapping of the open row to whole cards
  (absolutely positioned cards as snap areas; if it does not snap, add static snap stops on the track, design §Risks),
  trackpad and touch swipes, Shift + wheel, mouse drag (no fold after a drag), the edge fades, no scroll bar on Windows,
  the month panel under the stack in a narrow window and its fold while the row is open, folding a scrolled row, the
  summary card in the light and dark themes.
- Not checked on a live system: the summary card (`summary-card-tiles`): the header band in both themes (family and
  one person, more than four people), long amounts and the «≈» line in 400 px (truncation with the full text on hover),
  the three tiles with large figures, a person with a negative total (the soft red on the light and the dark surface);
  the larger cards (400 × 252): from what window width the month panel stands beside the stack (`@[47rem]`); the
  conversions column with one and two currencies beside a long amount, the shares with 2, 4 and 7 people (the line's
  truncation, «+N» in the line and the header), mixed signs (the hatched minus in both themes), everyone at zero or
  below, the reserve meter on a person's card.

## Check on a live system: the data process (`openspec/changes/desktop-data-process`)

- **The build**: `pnpm --filter @mono/desktop build` (and `dev`) bundles `src/data/process.ts` as its own entry
  (`?modulePath`, like the import worker), and the packaged app starts it (`[data] …` lines in the dev log; no
  `data: database unavailable` while the database is ready).
- **Responsiveness on a real database**: turn an account off (a full re-derivation) and, while it runs, move the
  window, open the menu and switch screens; the same while a statement upload commits. The window must not freeze.
- **«Delete all data» and «Start over» on Windows**: the database files go without `EBUSY` now that the data process
  exits before they are deleted.
- **The data process's memory**: its resident size next to main's and the import worker's, after a few screens.
- **A crash**: kill the `balance-data` process from the OS, then open a screen: the first load may show the failure
  line, the next one is answered by a new process.
- **The read cache by eye**: going back to a month or a category shows its numbers at once; after an import window or
  a write (a reserve, a recurring mark, an account toggle) the screen shows the new numbers within one quiet reload.

## Check on a live system: provider modules (`openspec/changes/provider-modules`)

- **The benchmark with two banks**: `packages/core/bench` builds its data through the real provider registry, which
  holds Monobank only, so it cannot hold a second bank yet. When the first real second bank lands, add its accounts
  and cross-bank pairs to `bench/generate.ts` and check the budgets. A one-off run with a mocked second bank
  (23.10.2026, not kept) gave a full re-derivation of 1160 ms with one bank and 1151 ms with two, and 6 / 5 ms for a
  3-day span: the cross-bank pass adds no measurable time.
- **A real transfer between two banks and its fee**: once a second bank's statements are in, send money from one bank
  to the other (with and without a fee) and check that the two rows pair: the credit within `CROSS_BANK_WINDOW_SEC`
  (180 s) of the debit, the fee within `CROSS_BANK_FEE_PERCENT` (5%) of the credit (`packages/core/src/derive/transfers.ts`).
  The fee must show under «Transfer fees» (`CATEGORY.transferFees`), and neither half under spending or income. Note the
  real gaps between the halves and the real fees, to confirm or tune both constants.
- **The fee floor**: a small transfer whose fee is above 5% is not paired and counts as spending and income. Collect the
  real fees on small amounts (a fixed fee on a 100 ₴ transfer is more than 5%); decide from them whether an absolute
  floor is needed.
- **Home's first row at three widths** (change `desktop-home-tiles`, group 7): under 65rem a tile per row, 65–79rem
  «Balance» | «Month» over «Month pace», from 79rem one row; open and fold the card row at each, both themes.
- **The «Month pace» tooltip** (change `desktop-pace-tooltip`): hover along a running month, both themes; the tooltip
  beside today's amount pill near the right edge (it should flip left, not cover the pill), and on a past month.
- **The «Spending» ring** (change `desktop-spending-ring`): both themes; a month with many small categories (no
  segment vanishes, the gaps stay even); the widened segment whole at the ring's edges; the centre switching to the
  hovered category and back without flicker when the pointer crosses a gap.
- **Dropping statement files on the window** (`QuickUploadFeature`, `openDroppedUpload`): drop a real `.xlsx` and
  `.csv` on macOS and Windows, a folder, several files at once, and a file from a zip opened in the system's archive
  viewer (it may have no path: expect «unreadable»). Check the window never navigates to a dropped file.
- **The upload sheet on a live system** (change `desktop-upload-sheet`): 12 large XLSX files at once (reading time, one
  decoder at a time); the side panel and the bottom sheet below 45rem; «Upload from» opening the right bank's files;
  the «where to download» hints (`entities.bank.statementHint.*`) checked against the real Monobank and Privat24 apps.
- **One card in two connections of a bank**: the upload takes the first connection that has the account (file ones
  first). See whether two connections ever share a card; if they do, the sheet should ask instead.
- **A file whose cards go to two connections** (`commitUpload`): each connection's part is written in its own
  transaction, so a block on the second part leaves the first written. Rare (one file, two people's cards of one bank);
  move to one transaction if it shows up.
- **More PrivatBank statements** (readers `privatbank-card-uk` and `privatbank-card-en`, each built from one real file
  of one UAH card; Privat24 exports only these two languages): check a file with two cards, a card in another currency
  and a period with a refund. Watch the recategorize report's «Неизвестные категории банка» for PrivatBank categories
  the table lacks, among them the English names of «Платежі за реквізитами» and «Платежі до бюджету» and the Ukrainian
  pair of «Cinema». Check whether the English statement writes treasury payees in Cyrillic (`TREASURY_RE`) or
  transliterates them.
- **Real PrivatBank `.xlsx` files**: before their reader ships, the team adding it checks that the
  decoder (`apps/desktop/src/decoder/`) turns real files into the document the reader expects: sheets with values kept
  as stored (dates as Excel serials, no floats). A file the decoder refuses (`unreadable`, `encrypted`, a passed limit
  of `DECODE_LIMITS` in `src/shared/decoder-protocol.ts`) shows which assumption broke. Only masked layouts in fixtures.
- **Real A-Bank files** (change `core-abank-statements`): the readers were checked, outside the repository, on a
  workbook re-saved by Apple Numbers and a PDF re-saved by macOS with its client block blanked. Upload, through the
  app's own decoder, an original `.xlsx` and an original multi-page PDF straight from the bank, and check:
  - the workbook's cell types (text, as seen, or numbers and Excel serial dates) — both read;
  - the PDF's heading: whether it states the IBAN and the credit limit (else a PDF account is matched by its cards);
  - pdf.js's text items against the PDF reader's band reading (`pdfTable`): a row's date over its time, a wrapped long
    description, the header repeated on every page;
  - a top-up from another bank with MCC 6012: whether it should pair with that bank's debit (today it counts as income
    here and as spending there).
- **Real SLSP files** (change `core-slsp-statements`): the reader was checked, outside the repository, through the
  app's own decoder on three real monthly statements (all rows read, every file adds up). Still to check live:
  - the zone of a card operation's time abroad: Bratislava time is assumed; compare a hryvnia purchase with the
    Monobank side of the same day near midnight, if one exists;
  - `BOLT.EU/O/…` and `BOLT.EU/P/…`: which is ride-hailing and which something else (food, scooters); both map to
    transport;
  - the first upload in the app: a new account, then the next month into it (only new rows), and the keyword
    categories on «Spending»; how many card payments stay in «Other» (about 40% in the samples);
  - a transfer to the user's own account in another bank: an own transfer only when that account's IBAN is in the app.
- **The decoder's memory on a large PDF**: upload a long PDF statement (hundreds of pages, near `STATEMENT_MAX_BYTES`,
  10 MiB) and watch the `balance-decoder` process: its peak resident size, the time against `DECODE_TIMEOUT_MS` (30 s),
  and that it is gone after the reply. Lower the page or item limits if the peak is too high for a weak machine.
- **«People and banks» on a live system**: with two people and several banks each (a token and a file connection),
  check the bank headings, «Add connection» on a person (the connection lands on them, no new person), «Add person»,
  removing a person's last connection (the person goes), and «Download history» from home scrolling to the download.

## Check on a live system: the bank filter (`openspec/changes/archive/2026-10-28-bank-view-filter`)

- **Bank views add up**: with real Monobank, PrivatBank and A-Bank data, the three single-bank views add up to the
  all-banks view on home («Spending», «Balance», the month grid) and in «Analytics», for the family and for one person.
- **A statement-only bank reads complete up to its last day**: choose only a bank with uploaded statements; the month's
  completeness and the per-day figures stop at that bank's last statement day, while the header's «Data until» stays
  global.
- **An own transfer between two banks**: it is spending in neither bank's view, and its fee shows under «Transfer
  fees» only in the view of the bank it was sent from.
- **The control by eye** (redone as one popover in `desktop-bank-looks`): the «Banks» button with the marks at three
  widths and both themes, the person buttons still falling back to the select when the row gets narrow; the panel's
  switches; the last bank on cannot be turned off and says why.
- **«By bank»** (change `bank-breakdown`): with real data from two or three banks, the bars on a category's screen and
  on the income screen add up to the screen's total, follow the bank filter and the person, and a transfer fee shows
  under the bank it was sent from. The card at three widths (the right column's last card stretching), both themes.
- **Split by banks** (change `openspec/changes/archive/2026-10-29-bank-split`): with real data from two or three banks, «Spending» «By banks» — each bar's
  bank segments add up to the category, the hover names the bank and the amount; the «Income and spending» chart «By
  banks» — the stacked areas' top equals the «Together» spending line, for a month (running) and a range. The bank
  colours in both themes (Monobank's foreground colour on the dark theme), PrivatBank's green beside the income line,
  and an earlier «Who spent how much» choice carried over after the update.

## Check on a live system: bank looks (`openspec/changes/desktop-bank-looks`)

- **Card looks by eye**: each bank's card and each Monobank type (black, white, iron, platinum, children's yellow, a jar)
  in the open row, in both themes: brand colours close to the real cards, text readable on every card (the light ones
  especially), the people dots, a dimmed card without data, hover and press motion. The colours were picked from public
  photos, not brand guides.
- **«Month pace» by banks**: with real data from two or three banks, the stacked areas' top meets the month's line every
  day, the tooltip's bank parts add up to «Spent», the gear hides with one bank on and the choice survives a restart.
- **No grey charts**: leave «General» for another screen while auto-sync runs, come back — «Month pace» keeps its
  colours and its tooltip has text.

## Check on a live system: manual categories (`openspec/changes/manual-categories`)

- The row menu on a real category screen: a right click and «⋮» open the same menu, the picker takes focus and gives
  it back, the screen and home reload with the line moved.
- A choice survives a real re-upload of the same statement and of a longer one, and an auto-sync of a Monobank card.
- A bank that changes an operation's time or amount between two exports gives it a new id, so its one-operation
  choice would not follow (the payee rule would). Not seen so far; watch for it.

## Check on a live system: insight detectors (`openspec/changes/core-insight-detectors`)

- Five lines in «What's unusual»: the «Now» row grows with the tile, and «Today» / «This week» beside it still read
  well at the medium and the wide width.
- A category with no spending in the usual months shows as «rare» once it passes 500 ₴; watch whether it is noise.
- Clicking a line opens the category screen for the shown month and the block's scope.

## Check on a live system: home without holes (`openspec/changes/desktop-home-gaps`)

- The highlights tile: a trackpad swipe and a mouse drag between «What's unusual» and «Recent operations», the dots,
  no stuck half slide; under reduced motion no smooth scroll.
- The «Today» / «This week» row keeps one height with the carousel at 1, 2 and 12 columns; six rows of «Recent
  operations» do not overflow the tile.
- A past month: no «Recent operations», «What's unusual» across the row (or no tile), and back to the current month the
  carousel returns.
- Opening home asks main for the month's spending once (the block and the unusual slide share it).
- A place for «Who spent what» and the regular payments teaser: off home since 01.11, to be decided with the user.

## Check on a live system: home «Insights» (`openspec/changes/archive/2026-11-01-desktop-home-insights`)

- «Spending» and «Insights» keep one row height at 12 columns; the block takes its own row under «Spending» below that.
- A payee whose descriptions vary (a city or a terminal number in the text) splits and may show no driver: is that
  common on real data?
- A past month: the savings rate beside the usual one; the running month: drivers only, no rate.
- Opening home still asks main for the month's spending once (the spending block, the unusual slide and the block).

## Check on a live system: the Insights screen (`openspec/changes/archive/2026-11-01-desktop-insights-page`)

- Severity thresholds (10% / 4% of a usual month): do the marks match what feels important on real data?
- New payees: a payee whose description changes (a terminal number, a city) may look new every month.
- Large one-offs: a yearly payment (insurance, a subscription paid once a year) shows as a one-off each time: fine or noise?
- The card's bars: readable at the narrowest window and with a month far above the others.
- A running month on its first days: the meter and the empty feed read sensibly.

## Check on a live system: budget, limits and goals (`openspec/changes/budget-structure`)

- Category kinds: do the defaults (transfers to people and subscriptions as wants, car, kids and pets essential) feel
  right on real spending?
- «Budget structure»: the 50/30/20 split and the guides (fixed above 50–60%, loans under 30%, reserve 3–6 months) — do
  they read as advice, not as a grade? The reserve counts jars too: sensible?
- The monthly budget: rent paid as a transfer to a person counts as flexible until its payee is set to «Rent» — is it
  clear enough from the «?» text?
- Pace and forecast early in a month (the first week) and for week limits on Mondays: no false alarms?
- Home's budget row at every window width; the empty row's wording; the «Limits» slide's order.
- Savings goals: a jar's own target offered; the need per month to a date; a closed jar.
- The «?» explanations: readable, the numbers match the screen, nothing cut in a narrow window.

## Check on a live system: figure accuracy (`openspec/changes/figure-accuracy`)

- A real hold: a card payment from today leaves the limit's and the budget's spent amount, shows as «+ 1 pending» with
  its amount, and counts once the bank finalises it (or vanishes when cancelled). «Spending» on home keeps it all along.
- The first import after the update: the log shows one full «rederive», the next auto-sync is incremental again; a
  metro or suburban-train payment (MCC 4111 / 4789) is now «Taxi and transport».
- The cash switch off: home's «Spending», «Analytics», the budget, limits and «Insights» all drop withdrawals at once;
  «Month pace» shows «Withdrawn in cash»; the ATM fee stays in «Bank fees»; on again restores every figure.
- A budget with «Count taxes» off: taxes leave its flexible part and its past-months chart, the panel says so, and
  «Spending» and «Budget structure» still show them.
- «Forecast above the limit» in «Insights» after the first week of a month: does it read as a warning, not an alarm?
- The pace rule (attention at ≥ 1.3 × the plan and ≥ 5% of the limit above it; «a little ahead» above 110% of the
  plan): on real months, does it warn early enough without crying wolf after one large purchase? Tune the thresholds in
  `packages/core/src/read/limits.ts`.

## Check on a live system: texts and hints (`openspec/changes/texts-hints`)

- Whole plural counts («12 транзакцій») in the narrowest places: the people captions of «Spending», «Who received» on
  the income screen, the «Today» / «This week» tiles; nothing cut that matters.
- The «?» popovers at every window width and in both themes: none cut by the window's edge, the header rows keep
  their height, the balance header's «?» does not open or fold the card row.
- Tooltips by keyboard: Tab reaches a «pending» mark, the count change, «… a day» in the ring, «Free» and «Compared
  with …», and each shows its hint; a screen reader reads it.
- The «Marks» column toggling while picking a payee or searching: the columns do not jump in a distracting way.
- «×N» on real months: does «+105 € (×5.0)» read better than the percent did, and is the money alone above ten times
  clear enough with the base in the hint?

## Check on a live system: Insights health and filters (`openspec/changes/insights-health`)

- The shares chart in both themes and at narrow widths: the dashed guide visible, a month without income a gap, the
  axis labels not cut; the «What is left» / «Wants» switch keeps the chart's height.
- The «Financial health» block stacked under 48rem of the screen's width, side by side above it; the checklist's «?»
  popovers not cut by the window's edge.
- The figures on real months: is «what is left» on the chart what the user expects next to «Kept» at the top (the
  chart counts investments as left, «Kept» counts them as spending)?
- The feed's filter remembered after a restart of the app and across months and people; the counts on the severity
  buttons match the «Signals» figure.
- Keyboard: Tab reaches each filter button, Enter / Space presses it, a screen reader says «pressed»; the checklist's
  standing is read after each figure.
