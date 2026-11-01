# Design

## Context

See proposal.md for why. Follows `.agents/project/core-layout.md` (where modules go), `domain-rules.md` (categories,
aggregates; updated with the kinds and the metrics), `desktop-import.md` (channels; updated with the three new ones),
`desktop-renderer.md` (FSD, i18n, the settings layout; updated with the section and the card) and the root `CLAUDE.md`
«From the settings-ui branch» list of settings sections (updated: «Categories»).

What exists:
- Categories are a fixed list in `derive/categories.ts` (`CATEGORY`); the user's category choices live in
  `manual_categories` / `payee_categories` (v18), apart from transactions, never in the analysis copy.
- `insightsOverview` already reads the month's spending by category, the usual months (`spendingUsual`, with
  `byCategory` per month and `income`) and today's rates. Savings rate is `read/insights.ts` `savingsRate`.
- «Available per day» counts today's money from `balancesAt` (cards only). Balances count cards and jars.
- The renderer's settings sections are `SETTINGS_SECTIONS` (`shared/config/settings.ts`) with `widgets/settings` holding
  the menu and section map; rows use `SettingsSection` / `SettingsList` / `SettingsRow` from `shared/layout`.

## Goals / Non-Goals

**Goals:** one source of kinds (core defaults + user rows), metrics as pure tested functions, one extra field on the
Insights read (no extra round trip), a section that edits kinds in place.

**Non-Goals:** kinds in aggregates other than the budget card (spending block, analytics stay as they are); per-person
kinds; history of kind changes (the metrics always use today's kinds for every month).

## Decisions

### Storage: a small table of user rows over code defaults
`category_kinds (category TEXT PRIMARY KEY, kind TEXT CHECK IN ('essential','wants','savings'), fixed INTEGER CHECK IN
(0,1), set_at INTEGER)`, migration v19. A row exists only for a category the user changed; reset deletes rows. Defaults
are a map in `read/category-kinds.ts` beside a `categoryKinds(db)` reader that merges them and marks `changed`.
Keyed by the category's stored name (as `manual_categories` is), not by an id: the stored name is what aggregates group
by.

*Alternatives:* storing every category's kind (seeded) — a later default change would not reach users who never
touched it; a column on a categories table — there is no such table, categories are code. *Verdict:* user rows over
defaults.

The command (`commands/category-kinds.ts`: `setCategoryKind`, `resetCategoryKinds(category | null)`) validates against
the kind-bearing categories and throws `CategoryKindError`; it needs no re-derivation, since kinds are read at query
time.

### Metrics: pure functions over already-read numbers
`read/budget.ts`: `budgetSplit({ income, byKind })`, `fixedShare`, `debtShare`, `reserveMonths(money, essentialMonths)`
— numbers in, numbers out, no db. `byKind(byCategory, kinds)` folds a category map into essential / wants / savings and
fixed totals. Whole percents rounded like `savingsRate`; reserve to one decimal. The guides are exported constants
(`BUDGET_GUIDE = { essential: 50, wants: 30, left: 20 }`, `FIXED_HIGH = 50`, `FIXED_VERY_HIGH = 60`, `DEBT_HIGH = 30`,
`RESERVE_MIN = 3`, `RESERVE_GOOD = 6`) so the card and tests share them.

*Alternative:* SQL aggregates per kind — would duplicate the fold of currencies that `foldByCategory` already does.
*Verdict:* fold the existing category totals.

### Reading: `insightsOverview` gains `budget`
After the month summary it reads `categoryKinds(db)` once; for a finished month with income it folds the month's
`byCategory` into the split, fixed and debt shares; for the reserve it takes the essential total of each usual month
from `spendingUsual`'s `byCategory` (already read) and today's own money of the view from `balancesAt` (cards and jars,
`own_funds`, credit money is not own funds; foreign currencies at today's rates, without a rate left out and counted
in `leftOut`). `budget` is `{ split, fixed, debt, reserve, kinds }` with each part null when absent, plus the
categories per kind for «How it was counted». One extra query (`balancesAt`) and one tiny read (`category_kinds`); the
fixed statement-count test (`data-queries.test.ts`) grows by those.

*Alternative:* a separate `getBudgetOverview` read — a second request for the same screen and the same usual months.
*Verdict:* extend the Insights read.

Jars are counted in the reserve (they are the user's savings), unlike «Available per day», which spreads only card
money. The card says so in «How it was counted».

### Channels
`getCategoryKinds()` → `CategoryKindView[]` (`categoryId`, `kind`, `fixed`, `changed`), `setCategoryKind({ categoryId,
kind, fixed })`, `resetCategoryKinds({ categoryId | null })` — through the data process like `setOperationCategory`
(zod arguments in `ipc-args.ts`, `data-protocol.ts`, main handler, host, renderer `methods.ts`). The set/reset calls are
not cached reads; after a write the renderer refreshes the sync-status version, so the Insights read reloads quietly,
as the category menu does. No bank text crosses these channels.

### Renderer placement (FSD)
- `entities/category-kind`: `CategoryKind` labels (dictionary keys) and the kind colours (`--category-…` tokens are
  per category; kinds get three neutral tokens in the theme: essential, wants, left).
- `features/category-kinds` (settings section): `api/useCategoryKindsRequest.ts`, `composables/useCategoryKinds.ts`
  (optimistic change, revert and message on failure), `components/CategoryKindRow.vue` (icon, name, a `VSegmented`-like
  three-way choice from `shared/ui`, `VSwitch`), `CategoryKindsFeature.vue`. `SETTINGS_SECTIONS` gains `categories`
  after `people` in the first group; `widgets/settings` maps it.
- `features/insights-page`: `components/BudgetCard.vue` (stacked bar on a sunken track with the 50/30/20 marks — the
  thin rounded bars of the other cards — and three rows), `utils.ts` `budgetView` (texts through `t()`, amounts through
  the money format). First in the side column.

*Alternative:* the kinds editor inside the Budget card — mixes a month view with a lasting choice and crowds the card.
*Verdict:* settings section + link.

## Risks / Trade-offs

- [Western guides do not fit Ukrainian incomes] → shown as «a common guide», never a grade or a red colour; the
  thresholds are constants, easy to tune after the live check (backlog).
- [Transfers to people hide rent or loans] → they default to wants; the user can re-kind the category or move the
  payee to «rent» with the existing category menu. «How it was counted» names the kinds.
- [Debt share misses credit card repayments] → the row says it counts «installments and loans» only.
- [Reserve uses today's money for a past month] → the row says «now»; it does not change with the month filter.

## Migration Plan

v19 creates an empty table; nothing to backfill; rollback leaves an unused table.
