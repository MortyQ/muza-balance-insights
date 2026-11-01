# Design

## Context

See proposal.md for why and for the four decisions of 01.11. Follows `.agents/project/core-layout.md` (where modules
go), `domain-rules.md` (categories, aggregates, scope; updated with kinds, metrics, limits and goals),
`desktop-import.md` (channels; updated with the new ones), `desktop-renderer.md` (FSD, i18n, settings layout, home
tiles; updated with the section, the card, the screen, the slide and the explanations) and the root `CLAUDE.md` «From
the settings-ui branch» list of settings sections (updated: «Categories»).

What exists:
- Categories are a fixed list in `derive/categories.ts` (`CATEGORY`); the user's category choices live in
  `manual_categories` / `payee_categories` (v18), apart from transactions, never in the analysis copy.
- `read/reserves.ts` + v13 are the model for a small user-owned table with currency, owner and validation
  (`RESERVE_CURRENCIES`, `RESERVE_AMOUNT_MAX`, `ReserveError`).
- `insightsOverview` reads the month by category, the usual months (`spendingUsual`: `byCategory` per month, `income`)
  and today's rates; `savingsRate` is in `read/insights.ts`. `balancesAt` gives own funds per account; jars carry the
  bank's `goal`.
- «Planning» (`pages/planning`) holds `features/daily-allowance` only. Home's highlights tile is a carousel
  (`widgets`/`features` of `desktop-home-highlights`). Settings sections are `SETTINGS_SECTIONS`.

## Goals / Non-Goals

**Goals:** one source of kinds; metrics, limits and goals as pure tested functions over numbers already read; the
fewest extra reads per screen; every figure explainable with the user's own numbers.

**Non-Goals:** kinds or limits in the spending block or analytics; per-person kinds; history of kind changes (every
month uses today's kinds); limits feeding «Available per day».

## Decisions

### Kinds: user rows over code defaults
`category_kinds (category TEXT PRIMARY KEY, kind TEXT CHECK IN ('essential','wants','savings'), fixed INTEGER CHECK IN
(0,1), set_at INTEGER)`. A row only for a changed category; reset deletes. Defaults live beside the reader
(`read/category-kinds.ts`, `categoryKinds(db)` → every kind-bearing category with `changed`). Keyed by the stored
category name, as `manual_categories` is. Commands in `commands/category-kinds.ts` validate and throw
`CategoryKindError`; no re-derivation, since kinds are read at query time.

*Alternatives:* seeding every category (a later default would not reach users who never touched it); a categories
table (there is none). *Verdict:* rows over defaults.

### Metrics: pure functions
`read/budget.ts`: `byKind`, `budgetSplit`, `fixedShare`, `debtShare`, `reserveMonths`, and the guides as exported
constants (`BUDGET_GUIDE`, `FIXED_HIGH`, `FIXED_VERY_HIGH`, `DEBT_HIGH`, `RESERVE_MIN`, `RESERVE_GOOD`) that the card,
the explanations and the tests share. They fold the category totals `foldByCategory` already produces.

### One `goals` table for limits and savings goals
Notion plans one goals table with limits as its first type. `goals (id, type TEXT CHECK IN ('limit','budget','saving'),
category TEXT NULL, period TEXT NULL CHECK IN ('day','week','month'), currency, amount, participant_id NULL, name NULL,
until NULL, source TEXT NULL CHECK IN ('jar','own'), account_id NULL, created_at)`, with CHECKs per type (a limit has a
category and a period; the budget has neither and period month; a saving has a name and a source) and a unique index on
(type, category, period, participant_id) for limits. `name` is the user's text, so the table stays out of the analysis
copy. `account_id` refers to a jar by its id without a foreign key, like `manual_categories`, so a closed jar leaves
the goal readable.

*Alternative:* two tables — cleaner CHECKs, but two migrations, two command sets and two readers for one screen.
*Verdict:* one table, validated in `commands/goals.ts` before the CHECKs.

### Counting limits
`read/limits.ts` is pure: `limitState({ amount, spent, daysPassed, days, period })` → expected, forecast, per day,
state (with the «quarter of the period» rule and none for day limits) and `suggestedAmount(months, period)`. The data
process reads spending per category for the current day, week and month once each with the core spending summary
(`scope: 'personal'`, every provider, the owner's view: the family, or the person), folds by today's rates and hands
the numbers to `limitState`. The monthly budget sums categories that are neither fixed nor savings by `categoryKinds`.
Suggestions reuse `spendingUsual`'s per-category months.

*Alternative:* counting inside SQL per limit — N queries for N limits. *Verdict:* three period reads per owner view,
folded in memory.

The bank filter is ignored on purpose (decision of this change: a limit is one number for all the user's money); the
explanations say so.

### Reads and channels
- `getLimitsOverview(q: { participantId? })` → the budget, the limits with their figures, the savings goals with their
  progress, the suggestions, the kinds left out of the budget, today's rates. Used by the «Limits and goals» screen and
  home's «Limits» slide (which shows only attention and exceeded).
- `categoryOverview` gains `limit` (the category's limits of the owner view for the current period) when the shown
  period is the current month.
- `insightsOverview` gains `budget` (split, fixed, debt, reserve, kinds) and adds «limit exceeded» cards from the
  monthly limits of the shown month (`type: 'limit-exceeded'` beside the detectors' cards, ranked by money).
- Writes: `getCategoryKinds`, `setCategoryKind`, `resetCategoryKinds`, `saveGoal` (create or update by `id`),
  `deleteGoal`, `addSuggestedLimits`. All through the data process like `setOperationCategory`: zod arguments in
  `ipc-args.ts`, `data-protocol.ts`, main, host, renderer `methods.ts`. After a write the renderer bumps the sync-status
  version so the open reads reload quietly. Goal names cross IPC; they are the user's own text, never bank text.

### Explanations
Each «?» is a `VPopover` with a short text and its formula filled in. The numbers come from the view the screen already
has (no extra read): the composables build `explain` entries `{ key, params }`, and the template renders
`t(key, params)`. Dictionaries get one `help.*` group per screen (`help.limits.perDay`, `help.budget.reserve`, …) in
`uk`, `en`, `ru`. First-visit introductions are a dismissible block with `localStorage` keys
(`help.seen.limits`, `help.seen.categories`, `help.seen.budget`) behind try/catch, as other renderer conveniences; «How
it works» clears the key. A shared `shared/ui` `HelpHint` component (button «?» + popover, keyboard and screen reader
labels) carries them all.

*Alternative:* a separate help screen — far from the number it explains. *Verdict:* inline «?» next to each figure,
plus short introductions.

### Renderer placement (FSD)
- `shared/ui`: `HelpHint`, `IntroNote`.
- `entities/category-kind`: kind labels and the three kind colour tokens (added to the theme).
- `entities/goal`: limit state → label, icon and colour; amount formatting helpers.
- `features/category-kinds`: the settings section (`SETTINGS_SECTIONS` gains `categories` after `people`).
- `features/insights-page`: `BudgetCard.vue`, `budgetView`; the «limit exceeded» card reuses `InsightCard`.
- `features/limits-goals`: `api/`, `composables/useLimitsGoals.ts`, `components/` (`BudgetPanel`, `LimitRow`,
  `GoalRow`, `LimitSheet`, `GoalSheet`, `SuggestionsNote`), `LimitsGoalsFeature.vue`; `pages/planning` shows it above
  `AllowanceFeature`.
- `features/category-detail`: `CategoryLimitBar.vue` from `entities/goal`.
- Home highlights: a third slide `LimitsSlide` reading `getLimitsOverview`.

Bars follow the existing style: thin rounded bars on a sunken track; the pace marker is a short vertical tick.

## Risks / Trade-offs

- [Western guides do not fit Ukrainian incomes] → «common advice» wording, no grade colours; thresholds are constants,
  tuned after the live check.
- [Transfers to people hide rent or loans] → they default to wants; the user can re-kind the category or move a payee
  with the category menu; the explanation names the kinds.
- [Debt share misses credit card repayments] → the explanation says it counts «installments and loans» only.
- [Today's kinds and rates for past months] → stated in «How it was counted».
- [A forecast early in the period is noise] → no forecast-driven state before a quarter of the period.
- [Home reads one more overview] → the slide shares the read cache with the screen; one request per view.

## Migration Plan

v19 `category_kinds`, v20 `goals`: empty tables, nothing to backfill; rollback leaves unused tables.
