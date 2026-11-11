# Design

## Context

See proposal.md. Core `read/search.ts` (`searchTransactions`) already serves the MCP tool: NFKC + lower-case text
matching in JS, amount matching, names masked to initials. The desktop's bank-text channels (category, income, recent,
insights, recurring, allowance) cut descriptions with `merchantText`. Follows `.agents/project/desktop-import.md`
(channels, canary tests) and `desktop-renderer.md` (FSD: a widget, since it reads several entities; i18n).

## Decisions

- **Reuse core search, not a new query**: one matching rule for the MCP tool and the desktop; the desktop maps results
  through `merchantText` and drops the masked counterparty field entirely.
- **Date parsing in the renderer** (`shared/lib`), sent as `from` / `to`: the language of the input is the UI's.
- **Widget `widgets/global-search`** in `GlobalFilters`: it reads categories (`entities/category`) and links
  (`shared/config`), so it cannot be an entity.

## Decisions taken while applying (10.11)

- **Core `periodLines`, not `searchTransactions` itself.** `searchTransactions` matches `counter_name` (an oracle on
  names the answer never shows), carries no view filters (person, banks) and returns the MCP's masked text, not the
  raw description `merchantText` needs. The desktop reads every operation of the period as the category screens list
  them (core `read/category-lines.ts` `periodLines`: body lines of both scopes, each with its category and scope) and
  matches in the data process with core's `normalizeSearch` — the same text rule as the MCP tool — on
  `merchantText(description)` and the comment only. A jar title, a full card number, an IBAN or a counterparty name in
  the stored data finds nothing (canary test).
- **Spending lines only.** A result must open a category screen, so income (the income screen) is out of v1.
- **Amount: converted in the renderer.** The renderer turns «250» in the main currency (the currency switch) into a
  hryvnia kopeck range ±1 unit by today's rate of that currency (`amountRange`; no rate → hryvnia, as the screen shows
  then), sent as `amount: { min, max }`; the data process compares the absolute line in hryvnia by today's rates. A
  line in a currency without a rate never matches an amount.
- **Dates: `shared/lib/searchQuery.ts` `parseSearch`.** Month names of all three languages (full names alone, short
  ones only next to a day or a year), the year inferred so the date is not in the future; sent as `from` / `to`; absent
  → `SEARCH_MONTHS` (36) back to today. The rest of the input is the text, a single number the amount.
- **Categories found in the renderer**, by their name in the interface language (main does not know it).
- **Payees and regular payments only with text**; payees grouped by `merchantKey` (the category screen's «Where»),
  regular payments as on their screen (`findRecurring` over 13 months, not hidden, active or ended within 120 days).
- **`features/global-search`, not a widget.** FSD forbids a widget importing another widget, and the brief mounts it
  in `widgets/global-filters`; a feature may read entities (`category`, `participant`, `period`, `currency-display`)
  and `shared/config`, so it is a feature, mounted there like `QuickUploadButtonFeature`.
- **Links.** `categoryLink(id, scope, period?, filter?)` gained `filter: { q?, merchant? }`, read back by
  `categoryRequest` (`q`, `merchant`, each cut to `SEARCH_QUERY_MAX`); the category screen starts each list from them
  (`useCategoryView`'s `open`). A transaction: its category, its scope, `q` = its description, and the global month set
  to its month after navigation; a payee: `merchant` = its key, the month of its newest match; a category: its screen
  («Personal», the current month); a regular payment: the regular payments screen.
- **IPC** `searchOverview({ query ≤ 100 chars, from?, to?, amount?, participantId?, providers? })`, in `PASS_THROUGH`
  (never cached), a rated data method.

## Risks / Trade-offs

- [A new bank-text channel] → explicit user ok before apply; canary test; results only in memory (the read cache keeps
  nothing of it — the method is not in `CACHED_READS`).
- [Slow on 36 months] → the core search scans in JS; the bench gets a case, budget in `bench/budgets.ts`. Measured
  10.11: «search over 36 months» ≈ 600 ms on 40 000 operations (the read itself; the JS match is small), budget
  2500 ms; the 200 ms debounce keeps it to one read per pause. A cache of the lines in the data process is the next
  step if it feels slow live (backlog).
