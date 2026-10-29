# Proposal

## Why

With Monobank, PrivatBank and A-Bank connected, every data screen sums all banks together. That combined figure is the
main goal, but the user also wants to look at one bank alone, or at two of three, the way the person switch already
narrows the view to one member of the family.

## What Changes

- A bank filter in the header's filter row, after the currency: one toggle per bank that has imported, enabled
  accounts, all on by default, any one, two or three of them; the last one on cannot be turned off. It appears only
  when there are accounts of at least two banks. The choice is remembered on this computer, like the person.
- Every data screen reads the chosen banks: home (balances, month panel, «Now», spending, pace), analytics, the
  category and income screens, regular payments and planning. It combines with the person switch (person AND banks).
- The figures of a bank view are the combined figures restricted to the chosen banks' accounts:
  - a transfer between the user's own accounts in two banks stays a transfer (not spending, not income) even when only
    one of the two banks is shown, so the bank views add up to the all-banks view;
  - the implicit fee of a cross-bank transfer belongs to the bank the money left;
  - family transfers follow the person switch exactly as today.
- Balances and account cards show the chosen banks' accounts only.
- Whether a period is complete, and the per-day figures that depend on it, are decided by the chosen banks' accounts
  (the live-connection rule applied among them). The header's «data until» and its per-bank marks stay as they are.
- Core reads take an optional list of providers next to the participant; absent means every bank, so the MCP tools and
  every current caller are unchanged.

Out of scope:
- A per-bank breakdown (bars per bank, like the people bars of the family view): a later change, noted in the Notion
  plan.
- Bank filters in the MCP tools.
- Any stored or derived value: the filter is a view only, unlike turning an account off. No migration.

## Capabilities

### New Capabilities

- `core-bank-view`: what the core's statistics mean when they are restricted to some banks — which rows and accounts
  count, transfers between banks, the implicit fee, completeness of a period.
- `desktop-bank-filter`: the bank filter of the data screens — which banks it offers, its default, its limits, how it
  is remembered and how it combines with the person switch.

### Modified Capabilities

- `desktop-data-freshness`: «Live connections decide completeness» applies among the banks in view.
- `desktop-app-shell`: «Header with title and global filters» lists the bank filter among the global filters.

## Impact

- `packages/core`: `read/filters.ts` (filters and `periodInfo`), `read/status.ts` (balances), the reads built on them
  (`spending`, `income`, `compare`, `category-lines`, `income-lines`, `recurring`). No migration, no change to
  `derive/`.
- `apps/desktop`: `src/shared/api.ts` and `ipc-args.ts` (an optional `providers` on every overview query), the data
  process (`src/data/data.ts` and its helpers), the renderer (`entities/participant` — the view's store and the bank
  filter —, `widgets/global-filters`, the feature composables that read the view).
- `apps/mcp`: none.
- Trust anchors: none change.
- User-visible: yes. `CHANGELOG.md` gains, under `## 0.1.13 — unreleased`, an entry for the bank filter in the
  header.
