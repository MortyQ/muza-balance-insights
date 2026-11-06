# Design

## Context

- The change rule lives in one place: `shared/lib/change.ts` (`change()`, `changeText()`). Its users: the category and
  income chips (`entities/operations/utils.ts` `changeChip`), home «Spending» (`features/spending-summary/utils/chips.ts`),
  «What's unusual» (`features/spending-summary/utils/insights.ts`), «Today» / «This week» (`features/now-strip/utils.ts`)
  and the Insights feed (`features/insights-page/utils.ts`, `cardView` and the glance lines).
- «×N» exists only in `entities/goal/utils.ts` as a private `times()`.
- The «?» is `shared/ui` `VHelpHint` (popover); a plain hint is `VTooltip`. Today only limits, goals and «Budget
  structure» use `VHelpHint`.
- The operations table: `entities/operations` (`OperationList.vue`, `OperationRow.vue`, the grid in `constants.ts`);
  a mark is `MarkView { text, tone }`, with no hint.
- The dictionaries use «операція» / «операция» in 34 uk keys and both «operation» and «transaction» in en; «оп.» in
  `home.now.opsShort` and `home.spending.opsShort`.

Rules followed: `.agents/project/desktop-renderer.md` (FSD, «`shared/ui` first», interface texts). None of the
`.agents/project/*.md` rules change; `desktop-renderer.md` gains one line that a change is said through `changeText`.

## Goals / Non-Goals

**Goals:** one term; one change rule; a hint on every figure the bug page named; no empty «Marks» column.

**Non-Goals:** new features from the same bug page items (search, the «Large one-off» chip, chart axis captions,
layout changes), any change of what a figure counts, main-process texts beyond the word swap.

## Decisions

1. **«Transaction», not «operation».** The bug page asks for it, en already uses it in half the keys, and the bank's
   own app says «транзакції». Only dictionary values change; keys keep their names (`ops`, `opsShort`) to keep the
   diff small, except `opsShort`, which goes: its users switch to the full plural key (`home.spending.ops`). The
   narrow places it served (the people chips, the income people list, `countCaption`) are checked at the narrowest
   width in tests by their text only; the live look goes to the backlog.
   Alternative: keep «операція» in uk/ru and «transaction» in en — rejected, the item asks for one term and the
   mixed en is the bug.
2. **The change rule in `changeText`.** Thresholds as constants in `change.ts`: `RATIO_FROM = 2`, `RATIO_UNTIL = 10`.
   The ratio is `1 + pct ÷ 100` (so the chips built from core's insights, which carry only the amount and the percent,
   follow the same rule). `changeText` picks the bracket: percent below `RATIO_FROM`,
   «×N» up to `RATIO_UNTIL`, nothing above. `times()` moves from `entities/goal` to `shared/lib/change.ts` and both use
   it. The hint texts that name the base («105 € more than in August (26 €)») get the base amount as a new
   placeholder where they do not have it yet.
   Alternative: the bug page's per-period minimum bases (1 000 ₴ a day, 5 000 ₴ a week …) — rejected: they are in
   hryvnias while the shown currency can be euros, and the ratio rule handles the tiny-base case on its own.
3. **Hints.** `VHelpHint` («?») for a block's «what it counts», next to its title; `VTooltip` for a single figure or
   mark. `MarkView` gains an optional `hint` (a text), `OperationRow` renders a mark with a hint inside `VTooltip`,
   focusable. Block texts are short and state the rules the code already has (no numbers filled in, unlike the budget
   help — these blocks have many figures each).
4. **The «Marks» column.** `OperationList` computes whether any shown row has marks and switches between two grid
   templates in `entities/operations/constants.ts`; the header follows. The filtered list (a payee picked) is the
   shown list.
5. **Wording.** «Hide from regular payments», «Not seen in recent months», the transactions list's empty search state and
   the holds line in the limits / budget help are dictionary edits only.

## Risks / Trade-offs

- Renaming en «Recent operations» → «Recent transactions» leaves the old name in the specs that refer to it
  (`desktop-home-highlights`, `desktop-home-insights`, `desktop-home-tiles`, `desktop-insights-page`); they are renamed
  when this change is archived, as plain wording, with no requirement change.
- The full plural is longer than «оп.»; a narrow person chip may cut it. The tests cannot see that; the backlog gets a
  live check.
- Russian and Ukrainian renderer tests that read «операц» or «%» need their expectations updated; that is part of
  each group, not a separate step.
