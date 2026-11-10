# Proposal

## Why

Finding one transaction means guessing its category and month first. Testing asked for one search field on every
screen (Notion, «Global search»; the plan lists it as P2).

## What Changes

- A search field in the header of every data screen, opened with Cmd+K / Ctrl+K, placeholder «Search transactions by
  name, amount or date».
- Results grouped: Transactions, Payees, Categories, Regular payments. A transaction opens its category screen for its
  month with the list filtered to it; a payee opens its category with the payee filter; a category opens its screen.
- Dates understood: «12 Oct», «5–11 Oct», «October 2026»; amounts with a ±1 tolerance in the main currency.
- **A new data channel that carries the bank's text** (each transaction's description, cut the same way as the
  category screen's lines: card numbers to the last 4 digits, jar titles hidden; never `counter_name`, an IBAN or a full
  card number). Every such channel so far was added only with the user's explicit ok — this proposal asks for it.

Out of scope: searching comments of other people's accounts beyond the view; fuzzy matching; search history.

User-visible: yes. `CHANGELOG.md`, the next unreleased version, «### Search» (flagged for human review).

Trust anchors: none change.

Affected: `packages/core` (`read/search.ts` reused: it already normalises text and matches amounts), `apps/desktop`
(IPC `searchOverview`, data process, `widgets/global-search`, dictionaries, tests).

## Capabilities

### New Capabilities

- `desktop-global-search`: one search over transactions, payees, categories and regular payments from any data screen.

### Modified Capabilities

None.

## Impact

- IPC `searchOverview({ query, participantId?, providers? })` → at most 50 transactions (newest first), 10 payees,
  categories and regular payments; a canary test that no `counter_name`, IBAN or card number reaches the renderer.
- `widgets/global-search` mounted in `GlobalFilters`; a `VSheet` / popover result list with keyboard navigation.
