# Design

## Context

A budget (`goals`, type `budget`) holds a total, its fixed rows (`goal_fixed`) and `count_taxes` (migration v21).
`data/limits.ts` builds flexible spending as every category that is not a fixed row, not of the savings kind and — with
`countTaxes` off — not taxes. The sheet (`BudgetSheet.vue`) mirrors this in its live result and past months' chart.
The screen lives at `/budget` with `meta.navParent: home` and no menu entry.

Follows `.agents/project/core-layout.md` (a migration; plain writes in `read/goals.ts`, nothing derived),
`domain-rules.md` («Limits, the monthly budget, savings goals») and `desktop-renderer.md`; updates the last two.

## Goals / Non-Goals

**Goals:**
- One rule for «what the budget does not count», with taxes as a case of it.
- The exclusion changes the budget only; every other figure in the app stays as it is.
- The budget screen is one click away from anywhere.

**Non-Goals:**
- Exclusions by transaction or payee; exclusions on limits and goals; a full-page budget editor.

## Decisions

1. **Storage: a table `goal_excluded (goal_id, category)`**, like `goal_fixed`, cascade on the budget's delete.
   The migration creates it and inserts a taxes row for every budget with `count_taxes = 0`.
   Alternatives: a JSON column on `goals` — rejected, no integrity and unlike `goal_fixed`; more boolean columns —
   rejected, one per category does not scale.
   `goals.count_taxes` stays in the schema, written as 1 and never read (as `connections.color`): dropping a column
   with a CHECK needs a third rebuild of `goals` for no gain.

2. **Core contract.** `BudgetInput.excluded: string[]` replaces `countTaxes`. Checks, before any write: each a
   spending category (the kinds' list), each at most once, none also a fixed row. The read returns `excluded` in a
   stable order (the category list's). Names here are category words, not user text.

3. **Desktop contract.** The budget payload and view carry `excluded: KindCategoryId[]`; `countTaxes` leaves both.
   The switch is renderer state derived from the list (`!excluded.includes('taxes')`). `data/limits.ts` drops the
   excluded categories from flexible spending in the one place taxes are dropped today, so pace, forecast, per day,
   the pending note, home's row and the Insights limit signals all follow.
   The IPC schema checks the list (known ids, unique). No new method.

4. **The sheet.** Under the «Count taxes» switch: «Exclude from the budget», a `VSelect` of the categories not yet
   excluded, not fixed rows and not taxes (the switch owns taxes), and the chosen ones as removable chips
   (`VChip` of `shared/ui`). Excluding a category that is a fixed row is not offered; the user removes the row first.
   Bank and transfer fees can be excluded (they are flexible spending today) though they cannot be fixed rows.
   The past months' chart and the quick choices from the usual month leave the excluded categories out — the same
   list passed to `pastFlexible` that carries taxes today.
   Alternative — one checklist of all categories with three states (flexible / fixed / excluded): rejected for now,
   it would redo the fixed-cost block the user already knows.

5. **Saying it.** The panel's «taxes are not counted» note becomes «Not counted: <names>» listing every exclusion,
   taxes included, on the budget screen and home's budget slide.

6. **Menu.** The `/budget` route gets `meta.nav` («Budget», after «Regular payments», before «Planning») and loses
   `navParent`; the header then titles the screen «Budget». The global period filter is hidden there
   (`periodFilter: 'none'`), since the budget always shows the current month — as «Planning» does. Home's row and
   `budgetLink` are unchanged.

## Risks / Trade-offs

- A user can exclude so much that the budget says little — their choice; the «Not counted» note keeps it visible.
- A category of the savings kind is already outside flexible spending; excluding it changes nothing. It is still
  offered (kinds can be changed later), and the note lists it.
- Two controls for one list (the switch and the field) — kept because the user asked for the switch to stay.
