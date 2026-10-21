# Design

## Context

The design follows `.agents/project/desktop-renderer.md` (FSD, the balance block paragraph, styles) and updates its
balance block paragraph. Nothing in `desktop-app.md` or `desktop-security.md` is touched: no IPC, storage or network.

Today (`features/balances`):

- `BalancesFeature.vue`: `CardStack` fills the block; `MonthPanel` lies over it, `absolute top-0 right-0 w-[340px]`.
  The folded stack is 340 px plus 3 × 22 px of peeking cards, so below ~760 px of block width the two overlap.
- `CardStack.vue`: every card is `absolute`, placed by `slidePosition(i, open, offset)` through `--x` / `--y` / `--z`;
  the row is `overflow-clip`; paging changes `offset` and the cards' `left` moves them (`paging` turns the stagger off).
  Only the cards in view take focus.
- `useCardStack`: `open`, `offset` in `[0, n − VISIBLE_CARDS]`, `prev` / `next`, reset on a new month or person.
- `entities/account/components/BalanceCard.vue`: one dark card for both the totals and the accounts, the «m» mark
  inline. `OverviewAccount` has no bank. `entities/account` may not import `entities/bank` (slices of a layer do not
  import each other).

## Goals / Non-Goals

**Goals:**

- Layout that holds at any block width, decided by the block's own width (container query), not the window's.
- A card structure where the summary card is its own component and account cards are bank skins behind one entry.
- Native scrolling of the open row with no visible scroll bar, the arrows as a fallback.

**Non-Goals:**

- No change to what the cards show (figures, captions, reserves): only their look and the row's movement.
- No change to the stack animation itself (positions, stagger, durations).

## Decisions

### 1. Cards: `SummaryCard` + `AccountCard` → bank skin, all in `entities/account`

```
entities/account/
  components/
    SummaryCard.vue          new, from scratch: the total of a view
    AccountCard.vue          entry: <component :is="BANK_CARDS[bank]">
    bank/MonobankCard.vue    today's BalanceCard, moved and renamed
  constants.ts               BANK_CARDS: Record<CardBank, Component>
  types.ts                   CardBank = 'monobank'; SummaryCardProps; AccountCardProps (+ bank)
```

- Both are display only, a `<button>` root of the same 340 × 214 size, `aria-expanded` from outside, as today.
- `SummaryCard`: `bg-surface` + `border-border`, the text in theme colours (it follows light / dark, unlike a bank
  card), `lucide:layers` in a small tile instead of a bank mark, a `home.balances.total` chip («Total») next to the
  title, `accents` drawn as dots in the top right corner instead of the big circles. Same figure lines as today.
- `CardBank` is the account's own literal union (`'monobank'`), not `BankId` of `entities/bank`: the slices cannot
  import each other, and a skin is not a bank's display data. `vue-tsc` checks that `BANK_CARDS` covers every
  `CardBank` (`Record`), so a new bank fails the build until it has a skin.
- `features/balances` `Slide` becomes a union with the card's props nested, so they can be bound as a whole without
  splitting a union by rest: `{ kind: 'summary'; card: SummaryCardProps }` | `{ kind: 'account'; card:
  AccountCardProps }`, plus `key` and `flow`. `slidesOf` sets `bank: 'monobank'` on every account slide
  (the only bank in data); `CardStack` renders `SummaryCard` or `AccountCard` by `kind`.

Alternatives: a `variant` prop on the one card (rejected: the user wants the summary card built separately, and each
bank skin would add branches to one template); the skin picked in `features/balances` (rejected: then every feature
that shows an account card repeats the table).

### 2. Layout: the panel beside the stack, under it when narrow

- The block is a `@container`. At `@[44rem]` and wider (stack 406 px + gap 24 px + the panel's minimum 260 px ≈ 690 px
  ≈ 43.1rem, rounded up), the panel is positioned over the row's area as now, but anchored `left: 430px; right: 0`
  with `max-width: 340px` and `margin-left: auto`: it takes what is left, up to its full width, never under the stack.
- Narrower, the panel is in the flow under the stack. When the row opens, the panel's wrapper collapses through
  `grid-template-rows: 1fr → 0fr` (with the existing opacity fade), so no empty space is left; under
  `motion-reduce` it collapses without the transition.
- Breakpoint and widths live in `constants.ts` next to `CARD_STEP` (the Tailwind class carries the literal; a comment
  ties them).

Alternative: scale the cards down on a narrow block (rejected: a 340 px card with 30 px figures does not read well
smaller, and the row's step math would follow a variable size).

### 3. The open row: a native scroller, cards stay absolute

- When open, the row element is the scroll container: `overflow-x: auto`, `scroll-snap-type: x mandatory`,
  `overscroll-behavior-x: contain`, `[scrollbar-width:none]` (as `SideNav` does). Folded, it stays `overflow-clip`.
- Cards keep `position: absolute` inside a track of `n × CARD_STEP − gap` width. In the row, `slidePosition` no longer
  takes `offset`: card `i` sits at `i × CARD_STEP`; each card is `scroll-snap-align: start`. The open / fold animation
  (the `left` / `top` transitions and the stagger) stays exactly as it is.
- `useCardStack` loses `offset` as state. A new `useRowScroll(row, count)` (feature composable) reads the scroller:
  `scrollLeft` and `clientWidth` on `scroll` (one per animation frame) and on `ResizeObserver` → a pure
  `rowView(scrollLeft, clientWidth, n)` in `utils.ts` → `{ first, last, atStart, atEnd, fits }`. The header arrows read
  `atStart` / `atEnd`; `prev` / `next` call `scrollTo` by one `CARD_STEP` from the snapped card; `goTo(i)` serves the
  dots. `VISIBLE_CARDS` and `maxOffset` go: how many cards fit is the row's width.
- Scrolling uses `behavior: 'smooth'`, or `'instant'` under `prefers-reduced-motion`.
- Mouse drag: `useDragScroll(row)` in the feature. On `pointerdown` with `pointerType === 'mouse'`, after 5 px of
  movement it captures the pointer, turns snapping off for the drag (a class), moves `scrollLeft`, and on release
  turns snapping back on (the browser settles on a card) and swallows the next `click` once (capture phase), so a drag
  never folds the row. Touch and pen are left to native scrolling.
- Vertical wheel is not translated; Shift + wheel and trackpads scroll the row natively.
- Keyboard: every card in the open row takes focus (`reachable` = all while open); `focusin` on a card calls
  `scrollIntoView({ inline: 'nearest', block: 'nearest' })` so a snapped scroller shows it.
- A new month or person while open: `scrollTo(0)` instantly (the cards change anyway), as `offset = 0` did.

Alternative: our own gestures (wheel `deltaX` and pointer → `offset`, cards moved by `left`; rejected: momentum,
snapping, touch and focus scrolling would all be rewritten by hand, and trackpads would feel off next to every other
scroller of the OS). Alternative: cards in a flex row while open (rejected: the stack ⇄ row animation depends on
absolute positions; switching layout mid-transition jumps).

### 4. Position without a scroll bar: edge fades and dots

- Edge fades: a `mask-image` gradient on the scroller, the left fade only when `!atStart`, the right only when `!atEnd`
  (classes from `rowView`); none when `fits`.
- `RowDots.vue` (`features/balances/components`): under the row, shown only while open and not `fits`; one `<button>`
  per card, the cards in view `[first, last]` marked (a wider pill), `aria-label` = `home.balances.toCard`
  («{n} of {total}: {title}»), `aria-current` on the first in view. A dot calls `goTo(i)`. Keyboard users also have the
  arrows and Tab.

Alternative: a thin custom scroll bar (rejected by the user's own concern: it reads as an ordinary scroll bar).

### 5. Folding from a scrolled row

`collapse()` in `BalancesFeature` first scrolls to 0 if `scrollLeft > 0`, waits for `scrollend` (with a 500 ms
fallback for a missed event), then calls `stack.close()`. Focus handling stays (`focusFront`).

## Risks / Trade-offs

- [Snap with absolutely positioned cards: a snap area is any descendant box, but this is untested here] → the first
  task checks it in the app; if it fails, the track gets invisible snap stops (`n` static `<span>`s at `i × CARD_STEP`),
  which keeps the cards absolute.
- [happy-dom has no layout or scrolling] → the math is the pure `rowView` and is unit-tested; the composables are tested
  against a faked `scrollLeft` / `clientWidth`; swipe, snap, drag and the narrow layout are checked by hand and listed in
  `docs/backlog.md`.
- [A block narrower than one card (~406 px) still clips the stack] → the app's narrowest useful window is wider than
  that with the side menu as a strip; noted, not handled.
- [`scrollend` support] → Chromium in Electron has it; the timeout covers a scroll that ends without movement.
- [A hidden scroll bar hides that the row scrolls] → edge fades and dots carry that; the arrows stay.

## Migration Plan

Renderer only, no data or IPC. Rollback is a revert of the change's commits.
