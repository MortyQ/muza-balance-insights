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
- `features/spending-summary`: the «What's unusual» tile leaves `SpendingFeature`; the slice exports
  `SpendingInsightsFeature`, which runs the same `useSpending` request (the read cache answers it from the block's
  request) and emits `update:available`. The in-block person pick no longer hides it: the unusual lines are the
  view's (the global filter's person), and the slide does not know the block's pick.
- `features/recent-operations` (new slice): `RecentOperationsFeature` — `api/useRecentRequest.ts`, the rows (category
  icon from `entities/category`, money from `entities/currency-display`), `update:available`.
- `widgets/home-highlights` (new): `HomeHighlights` composes the two features in a `VCard` + `VCarousel`, decides the
  order and the empty text. Features never import each other; the widget does.
- `pages/home`: the widget in the grid in place of the old tile, hidden while «Now» details are open
  (`nowDetails`, as today's `insightsHidden`). `SpendingFeature` loses `insightsHidden`.

## 4. The grid rule

The spending tile spans 9 columns from 79rem. When neither «Who spent what» nor the teaser is in the grid, it spans 12.
One rule on the grid does it: the grid `:not(:has([data-tile="side"]))` makes its `[data-tile="spending"]` span 12
(`:has()` — Chromium in Electron supports it), so the features stay independent; the two side tiles carry
`data-tile="side"`. Verdict over the page knowing which tiles exist: that would need the features to report up through
the page for layout only.

## 5. Privacy

What it protects: the bank's descriptions stay inside the app. They already reach the renderer for three screens; the
home tile adds a fourth place in the same renderer, not a new path out. Main still sends them only in answers the
user's own screens ask for; the log gets counts; no MCP tool and no anonymised copy is touched. The comment in
`shared/api.ts` names home's «Recent operations» next to the category and income screens.

## Risks

- Two features on one request: the insights slide relies on the read cache to not double the spending request. Checked
  in a renderer test (one call of `getSpendingOverview` per filter change).
- A carousel inside a grid cell must keep the row's height equal (`desktop-home-tiles`): slides are stretched to the
  tallest; checked live (`docs/backlog.md`).
