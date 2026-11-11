# Design

## Context

The income screen gets a regular income block for a month's view. Core `findRecurring` with `kind: 'income'` already
finds regular income for «Available per day»; the regular payments screen sums the active regular payments. Both read
the last 13 months.

## Decisions

- **Computed for today, whatever month is shown.** `IncomeOverview.regular` is null for a day or a week; for any month
  it is the same answer (today's sources, today's rates). Regular income is what the user can count on now, not a
  property of a past month.
- **Same view as the screen.** The person and the bank filter of the query; all scopes; payee marks `hidden` are left
  out on both sides (income and payments), as on the regular payments screen.
- **The name is the income list's sender**: the provider's `namedSender` («Від: Name» → «Name»), else the description,
  both through `merchantText` (card numbers cut, jar titles hidden). No `counter_name`, IBAN or card number.
- **«Amount changed» needs a payment outside the series.** `findRecurring` groups a payee's payments within ±10% of a
  group's median, so the series' own last payment can never differ from the usual by much more than 10%. Core now also
  returns `latest`: the payee's newest payment after the series that fits none of its series, given to the series with
  the nearest usual amount (and `lastOperationAmount`, the series' own last). The desktop takes `latest` as the source's
  last payment when present: its date moves `next` on (so a raise is not «late») and its amount decides `change`. A
  payment that belongs to another series of the same payee (an advance and a salary) is never `latest`. The field is
  additive; nothing else reads it.
- **Active** = the last payment (with `latest`) at most 40 days old, core's `ACTIVE_DAYS`.
- **Marks**: late first (the expected date has passed: days since it), then changed (whole signed per cent beyond
  ±10%, compared in the operation currency the series is matched by), else on time.
- **Covered share**: the active regular payments' monthly sum (today's rates) over the regular income, whole per cent;
  null when the regular income is 0 (no source, or none with a rate).
- **Expected**: sources whose next date is from today to today + 30 days, soonest first; a late one is not «expected».
- Pure parts: `data/income-regular.ts` (main) and `features/income-detail/utils.ts` (renderer).

## Risks

- `latest` may be a one-off transfer from the same sender after the series (a refund of a loan, a gift): it would read
  as «amount changed». Checked on a live system (`docs/backlog.md`).
- A source paid less often than monthly (quarterly) is not found at all: `findRecurring`'s rules.
