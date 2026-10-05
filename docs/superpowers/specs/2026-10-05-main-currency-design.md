# Main currency and today's Monobank rate

Status: design, waiting for the user's review.

## Goal

The user picks the home screen's main currency: hryvnia, US dollar or euro. Every amount on the home screen is shown in
it. The other picked currencies follow as «≈» lines. Use case: someone planning to move to Europe sees their spending and
balances in euros.

All conversion on the home screen uses **today's Monobank rate**, never the rate of the month or of the purchase. One
number per currency, easy to explain: «what this is worth at today's rate».

## Decisions (user, 05.10.2026)

- Rate source: the public Monobank rates, `GET https://api.monobank.ua/bank/currency`, fetched by main. Asked at launch and
  again while the app is open. The last good answer is saved; offline, the saved one is used.
- The bank's **sell rate** (`rateSell`, hryvnia per one unit: what buying a dollar or a euro costs). For a pair with only
  a cross rate (`rateCross`), that one.
- Main currency choices: ₴, $, €. PLN is not added (not needed now).
- The user's own exchanges (`exchangeRates` in core) are no longer used for display in the app. The MCP server is
  unchanged.
- This replaces the backlog item «Monobank public rates only for a currency with no own operations». The backlog item
  «card-purchase rates» is dropped.

## 1. Rate source (main)

- A new trusted service in `apps/desktop/src/net/allowlist.ts`:
  `{ id: 'monobank-rates', purpose: 'Today's public exchange rates (no token, no user data)', hosts: ['api.monobank.ua'] }`.
  The host is the same as the import's, but the request goes through its own `allowlistedFetch(…, ['monobank-rates'])`
  with no headers at all, so the import's `X-Token` cannot reach it by construction. A separate step, with
  `tests/allowlist.test.ts`, like any trust anchor.
- `src/main/rates.ts` (`RatesService`):
  - `refresh()`: one GET, a timeout (10 s), at most 64 KiB, `redirect: 'error'`. The answer is checked with zod: an array
    of `{ currencyCodeA, currencyCodeB, date, rateBuy?, rateSell?, rateCross? }`. Unknown fields are ignored.
    Pairs with `currencyCodeB = 980` are kept: rate = `rateSell ?? rateCross`, positive and finite. Other pairs are dropped.
  - The answer is saved to `userData/rates.json`: `{ fetchedAt, list: [{ currency, rate }] }`. Written whole
    (temporary file + rename). Reading forgives a broken or missing file (= no rates). «Delete all data» removes it.
  - When: at launch (the lock does not matter: the request carries nothing of the user's), then every 4 hours while
    the app runs. Never more often than once per 5 minutes: Monobank refreshes the rates no faster and answers
    too-frequent calls with 429. A failure (offline, 429, bad answer) keeps the saved rates. No retries beyond the next
    regular time.
  - `current()`: `RatesView | null` (null: never fetched successfully).
  - The request runs in its own Electron session (`monobank-rates` partition), guarded for every request and redirect
    hop like the updater's: the default session belongs to the renderer and refuses everything.
- The shape of the answer is taken from the public API docs (api.monobank.ua/docs). Tests use a fictional fixture
  of that shape.

## 2. Conversion (main)

- Every overview (`monthOverview`, `spendingOverview`, `nowOverview`) folds account currencies into hryvnia by
  `RatesService.current()` instead of `exchangeRates(db, period)`. The previous period of the spending block uses the
  same rate (one rate for both, so the change chip shows spending, not the exchange rate).
- A currency with no rate (never fetched, or the bank does not quote it) stays out of the sums, as now (`leftOut`,
  `FxPart.rate = null`).
- Balances: the card's own funds (`CardTotal`) also fold foreign accounts into hryvnia at today's rate; `others` lists
  each foreign part with its rate («incl. 100 $ at the rate 41,75», or «without … — no rate»). Each account in the list
  keeps its own currency.
- Every overview answer carries the rates it used, `rates: RatesView | null` with
  `RatesView = { list: Array<{ currency; rate }>; fetchedAt; saved }` (`saved` = the last refresh failed, these are the
  saved rates). It replaces `SpendingFx`; `FxPart` keeps `rate` (today's) and loses `nearest`; `prevRate` goes away.
- When nothing is saved yet (the very first launch), an overview waits up to 5 s for the first fetch.

## 3. Main currency (renderer)

- `entities/currency-display`: the choice becomes `{ main: 980 | 840 | 978; also: { uah, usd, eur } }`, in localStorage
  (`home.currencies`, a per-computer convenience as now). The old `{ usd, eur }` value is read as `main: 980` with the
  same «≈» currencies. The main currency is never also shown as «≈».
- One helper for every home amount: `displayMoney(kopecksUah, rates, choice)` → the main-currency text, and
  `approxLine(...)` → «≈ …» in the other picked currencies. Balances, the «Now» strip (including «Most this week») and
  «Spending» use them instead of `formatMoney(…, UAH)`.
- A main currency without a rate (no rates yet) falls back to hryvnia on screen, and the switch says why.
- `CurrencyToggle` in the global filters: a «Main currency» segmented control (₴ / $ / €) on top, then «Also show» with
  a switch per remaining currency. The button text: «$ · ₴ €» (main first). The menu's footer says
  «Monobank sell rate, 05.10, 10:00», or «Saved rate from 03.10, 18:40» when `saved`. No rates: «Rates not loaded yet: only
  hryvnia for now».
- Percentages and change chips do not depend on the currency (one rate for both periods). The ring's per-currency
  chip and its «rate then / now» hint go away: with one rate they repeat the ring's own chip.

## 4. Settings and docs

- «Network»: the new service shows with its purpose (`SERVICE_TEXT` gets an entry; the typecheck forces it).
- `.agents/project/desktop-security.md`: the new service and why it has no headers. `domain-rules.md`: the desktop shows
  today's rate, core `exchangeRates` is the MCP's.
- `docs/backlog.md`: the «PLN and card-purchase rates» section is replaced by what is left (PLN later, if ever; the
  VPopover name; pendingHolds filters).
- `CHANGELOG.md` (0.1.8 — unreleased): the main currency setting; amounts are converted at today's Monobank sell rate;
  the app asks Monobank for public rates (no personal data is sent).

## Out of scope

- PLN or other main currencies.
- Rates by month or by purchase, rate history.
- The MCP server's currency handling.
- The income block (next, after this).

## Order of work

1. Allowlist entry + its test (trust anchor, its own step and commit).
2. `RatesService`: fetch, validation, cache, timer; tests with a fake fetch and a temp folder.
3. Main overviews switch to today's rate; the `rates` shape in `api.ts`; `data.test.ts` updated.
4. Renderer: the choice store and its migration, `displayMoney` / `approxLine`, the toggle, balances, now strip, spending.
5. i18n (uk / en / ru), docs, backlog, CHANGELOG. `pnpm test`, `pnpm typecheck`.

## Tests

- allowlist: the new service, its host; the import's service list unchanged.
- rates: a good answer, sell vs cross, bad shapes (not an array, negative, NaN, huge body), 429 and offline keep the saved
  file, broken `rates.json`, the 5-minute floor, the 4-hour timer, no headers on the request.
- main: folding by today's rate; a currency without a rate is left out; the same rate for both periods; balances folding.
- renderer: the choice parsing and migration; `displayMoney` / `approxLine` for each main currency; fallback to ₴ without
  rates; the toggle (segment, switches, footer states); each block renders the main currency.
