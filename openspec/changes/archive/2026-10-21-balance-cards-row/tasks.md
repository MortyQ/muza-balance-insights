# Tasks

## 1. Layout: the month panel never under the stack — `fix(desktop): balance block`

- [x] 1.1 Make the balance block a `@container`; at `@[44rem]` anchor `MonthPanel` at `left: 430px; right: 0;
  max-width: 340px; margin-left: auto`, below it put the panel in the flow under the stack, with the widths in
  `features/balances/constants.ts`; verify with `vue-tsc` and by a renderer test that the panel carries the container
  classes and no fixed `w-[340px]`
- [x] 1.2 Collapse the panel's wrapper (`grid-template-rows: 1fr → 0fr`, `motion-reduce` without the transition) while
  the row is open in the narrow layout; verify by a renderer test that the wrapper is collapsed and `inert` while open
- [x] 1.3 `CHANGELOG.md`, `## 0.1.10 — unreleased`: the balance cards no longer cover «In» / «Out» in a narrow window;
  verify the section stays well-formed (`tests/release-workflow.test.ts`)

## 2. Cards: `SummaryCard` and bank skins — `feat(desktop): balance cards`

- [x] 2.1 Move `BalanceCard.vue` to `entities/account/components/bank/MonobankCard.vue`; add `CardBank`, `AccountCardProps`,
  `BANK_CARDS` and `AccountCard.vue` (picks the skin); export `AccountCard`, `SummaryCard` and the types from the slice's
  `index.ts`; verify `tests/architecture.test.ts` accepts the nested `components/bank/` folder (adjust the rule only
  with the user's ok) and `vue-tsc` passes
- [x] 2.2 Build `SummaryCard.vue` from scratch (theme surface and border, `lucide:layers` tile — registered in
  `icons.ts` if missing, the «Total» chip, accent dots, same figure lines, `<button>` 340 × 214); add
  `home.balances.total` to `uk.json`, `en.json`, `ru.json`; verify by a renderer test that it shows the figures, a dot
  per accent and no bank mark, and `tests/i18n.test.ts` passes
- [x] 2.3 Make `Slide` a `kind: 'summary' | 'account'` union; `slidesOf` sets `kind` and `bank: 'monobank'`;
  `CardStack` renders `SummaryCard` or `AccountCard`; update the `slidesOf` tests in `tests/renderer/balances.test.ts`
  (family: summaries only; a person: a summary then accounts) and the `BalanceCard` test to the new components; verify
  they pass
- [x] 2.4 `CHANGELOG.md`: the total card has its own look, so it no longer reads as one more card; verify as in 1.3

## 3. The open row scrolls — `feat(desktop): swipe the balance cards`

- [x] 3.1 Pure `rowView(scrollLeft, clientWidth, n)` → `{ first, last, atStart, atEnd, fits }` in
  `features/balances/utils.ts`; `slidePosition` drops `offset`; remove `VISIBLE_CARDS` and `maxOffset`; verify by unit
  tests (start, middle, end, everything fits, a half-scrolled card)
- [x] 3.2 `useRowScroll(row, count)`: reads the scroller (rAF-throttled `scroll`, `ResizeObserver`), `prev` / `next`
  by one `CARD_STEP`, `goTo(i)`, `toStart()` returning a promise on `scrollend` with a 500 ms fallback, `smooth` or
  `instant` by `prefers-reduced-motion`; `useCardStack` loses `offset` and resets the scroll on a new month or person;
  update `tests/renderer/card-stack.test.ts` and add tests for `useRowScroll` against a fake `scrollLeft` / `clientWidth`
  / `scrollTo`; verify they pass
- [x] 3.3 `CardStack`: the open row is the scroller (`overflow-x-auto`, `snap-x snap-mandatory`, `overscroll-x-contain`,
  `[scrollbar-width:none]`), cards `snap-start`, all cards focusable while open, `focusin` → `scrollIntoView` (nearest);
  edge fades from `rowView`; the header arrows read `atStart` / `atEnd`; check in the app that snapping lands on cards,
  and if it does not, add the static snap stops of design §Risks; verify the renderer tests for the classes and focus
- [x] 3.4 `useDragScroll(row)`: mouse-only drag past 5 px, snapping off during the drag, one swallowed `click` after a
  drag; verify by a renderer test with synthetic pointer events that a drag moves `scrollLeft` and does not toggle the
  row, and a plain click still does
- [x] 3.5 `RowDots.vue`: one button per card, the cards in view marked, `aria-label` `home.balances.toCard` (all three
  dictionaries), `aria-current`, hidden while folded or when everything fits, a dot calls `goTo`; verify by a renderer
  test and `tests/i18n.test.ts`
- [x] 3.6 `collapse()` scrolls the row to its start before `stack.close()`; verify by a renderer test that `close` runs
  after `toStart` resolves and focus returns to the front card
- [x] 3.7 Update the balance block paragraph of `.agents/project/desktop-renderer.md` (cards, skins, layout, scrolling,
  dots) in English; add to `docs/backlog.md` the live checks: trackpad / touch swipe and snapping, Shift + wheel, mouse
  drag, the narrow layout, no scroll bar on Windows; `CHANGELOG.md`: swipe through the open cards, the arrows still work

## 4. Integration

- [x] 4.1 Run `pnpm test` and `pnpm typecheck` at the root; verify both pass
