# Design

Follows `.agents/project/core-layout.md` (a list of lines for a screen → `read/`), `.agents/project/domain-rules.md`
(what «Spending» counts), `.agents/project/desktop-import.md` (the data process, IPC), `.agents/project/desktop-security.md`
(what leaves main) and `.agents/project/desktop-renderer.md` (FSD, `shared/ui` first, i18n). Updates
`desktop-renderer.md` (the home grid, the new tile and feature, where descriptions are shown) and `desktop-import.md`
(the new read). Builds on the archived `desktop-home-tiles`.

## 1. Core: `latestLines`

`read/category-lines.ts` already lists one category's spending lines with the bank's text (`spendingLinesSql`, the
lines «Spending» sums). `latestLines(db, q, limit)` runs the same query without the category condition, `LIMIT` in SQL,
and returns the same `CategoryLine` plus the line's `category`. Body lines only: a commission or transfer fee line is
not an operation of its own (it shares the body's id). The row mapping is shared by both functions.

Verdict over `searchTransactions` (`read/search.ts`): that one is the MCP's, masks names and has another shape; over a
new module: the job is the same (spending lines of a period), so it stays in one module.

## 2. IPC

`getRecentOperations({ month, scope, participantId?, providers? })` → `{ lines: RecentLineView[] }`, six lines. The
view is `CategoryLineView`'s fields a row needs (`key`, `date`, `time`, `merchant`, `uah`, `currency`, `amount`,
`hold`, `pending`, `refund`) plus `categoryId` / `category` for the icon and the link. Arguments checked by zod like
`categoryOverview`'s; a read, cached by the read cache under its own key; refreshed like every read after a data
change. Descriptions are cut as on the category screen (card numbers to their last digits, a jar's title hidden).

## 3. Renderer placement (FSD)

- `shared/lib/useDragScroll.ts`: moved from `features/balances/composables` unchanged (its own commit); the card
  stack and the carousel use it. Its `DRAG_THRESHOLD` moves with it.
- `shared/ui` `VCarousel` (BEM + SCSS, as every `shared/ui` copy): a native horizontal scroller without a scroll bar,
  `scroll-snap` to whole slides, one slot per slide (`slides: ReadonlyArray<{ id: string; label: string }>`, slot
  `#[id]`), dots under it only with two or more slides (buttons, `aria-label` «Slide N of M: label», `aria-current`),
  `useDragScroll` for the mouse, the dot of the slide in view tracked by an `IntersectionObserver`. `v-model` the slide
  in view. No motion under `prefers-reduced-motion` (`scroll-behavior: auto`).
- `entities/scope` (new): `useScopeStore`, home's «Personal / Business» choice. It was the spending block's own `ref`;
  the recent operations and the unusual lines follow the same switch, so it moves to a store the slices share.
- `features/spending-summary`: the «What's unusual» tile leaves `SpendingFeature`; the slice exports
  `useSpendingInsights` (the same `useSpending` request, worded; `loaded`) and the `SpendingInsights` component. The
  unusual lines are the view's (the global filter's person).
- `features/recent-operations` (new slice): `useRecentOperations` (`api/useRecentRequest.ts`, rows with the category
  icon from `entities/category`, money from `entities/currency-display`, `loaded`) and `RecentOperationsList`.
- `widgets/home-highlights` (new): `HomeHighlights` calls both composables, so it knows which slides have content
  before any is shown (a feature inside a slide that is not shown would not be mounted to say so), and renders the
  two components in a `VCard` + `VCarousel` with the order and the empty text. Features never import each other.
- `shared/api/balance.ts`: the same cached read asked again while it is in flight shares that request (the spending
  block and the unusual slide ask the same month at once); not across a data change (`desktop-read-cache`).
- `pages/home`: the widget in the grid in place of the old tile, hidden while «Now» details are open
  (`nowDetails`, as today's `insightsHidden`). `SpendingFeature` loses `insightsHidden`; the teaser is not mounted.

## 4. Nothing beside the spending tile

`SpendingFeature` stops drawing «Who spent what» and the page stops mounting `RecurringTeaserFeature`; the spending tile
spans the whole row (one row span). With the people tile gone the in-block person pick has no control, so it stays
`null` and the block shows the view's person. The pick code (`usePick`), `PeopleList` and `RecurringTeaserFeature` stay
in their slices, unmounted, for the later place the user decides.

## 5. Privacy

What it protects: the bank's descriptions stay inside the app. They already reach the renderer for three screens; the
home tile adds a fourth place in the same renderer, not a new path out. Main still sends them only in answers the
user's own screens ask for; the log gets counts; no MCP tool and no anonymised copy is touched. The comment in
`shared/api.ts` names home's «Recent operations» next to the category and income screens.

## Risks

- Two screens on one request: without sharing the request in flight, opening home would ask main for the month's
  spending twice. Checked in `tests/renderer/read-cache.test.ts`.
- A carousel inside a grid cell must keep the row's height equal (`desktop-home-tiles`): slides are stretched to the
  tallest; checked live (`docs/backlog.md`).
