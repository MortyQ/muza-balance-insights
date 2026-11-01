# Proposal

## Why

A transaction's category comes from its MCC, the bank's own category or a provider rule, and the user cannot change
it in the app. Rent paid as a transfer, a broker top-up or a child's school fee land in «переводы людям» or «другое»,
and the only fix today is the `overrides:*` CLI, which only matches counterparty names. The user wants to decide the
category in the app, and a decision must never be lost: not by a re-upload of the same statement, not by a sync and
not by a re-derivation.

## What Changes

- **Manual category of one debit.** The user picks a category for one operation that spends money. It is stored apart from the
  operation, keyed by its stored id, and applied last in the derivation, above every automatic rule and the MCC.
- **A rule for all operations of a merchant or counterparty.** The same pick can apply to every operation, past and
  future, with the same counterparty name or, without one, the same description. The answer states how many
  operations changed. A one-operation pick wins over a rule.
- **Undo.** Removing a manual pick or a rule returns the automatic category.
- **Manual decisions are authoritative.** Re-uploading the same statement, uploading one that overlaps, a sync and a
  full re-derivation never overwrite, duplicate or change them. Imports never write the manual tables.
- **New categories:** «аренда жилья», «авто», «дети», «подписки», «инвестиции». All of them are spending.
  «Инвестиции» (a broker top-up, buying shares) counts as spending, so its total shows like any other category's.
  No MCC is mapped to them in this change: they come from manual picks and rules.
- **«Путешествия» is shown as «Подорожі й відпустки» / «Travel and holidays» / «Путешествия и отпуск».** Only the
  display names change; the stored value stays.
- **A row menu on the category screen's debit rows**: right click on a row, or its «⋮» button, opens
  the same menu: «Change category…» (a searchable list) with «For all operations from this payee», and «Return the
  automatic category» when the row has a manual one.
- **`CHANGELOG.md`**, under `0.1.13 — unreleased`: change an operation's category, for one operation or for a payee.

## Capabilities

### New Capabilities
- `core-manual-categories`: manual picks and payee rules, their order in the derivation, their survival across
  imports, the new categories.
- `desktop-category-menu`: the row menu and the category picker.

### Modified Capabilities
- None.

## Impact

- `packages/core`: a migration (v18), `derive/categories.ts` (new categories, applying manual picks), a new
  `commands/categories.ts` (set, clear, apply to a payee, counts), tests.
- `apps/desktop`: IPC and `shared/api.ts`, the read cache invalidation after a change, a menu component in
  `shared/ui`, the picker feature, `OperationRow`, dictionaries.
- `apps/mcp`: the `overrides:*` CLI keeps working on the same rules table.
- **Analysis copy:** no new column; the stored `category` already reaches it. The manual tables do not.
- **Trust anchors:** none change.

## Out of scope

- MCC mappings to the new categories (a later change, each mapping approved).
- User-made categories with their own names.
- Loans («Позики»): dropped by the user.
- Bulk selection of several rows.
