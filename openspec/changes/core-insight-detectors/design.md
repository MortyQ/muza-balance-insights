# Design

Follows `.agents/project/core-layout.md` (a statistic for a screen → `read/`), `.agents/project/domain-rules.md`
(what counts as spending and income; unchanged), `.agents/project/desktop-renderer.md` (FSD, i18n) and
`.agents/project/desktop-import.md` (the data process). Updates `domain-rules.md` with one short «Insights» bullet that
points at `read/insights.ts`; the others are not changed.

## 1. Input: sums, not rows

The detectors take what the data process already has after `spendingUsual`:

```ts
type InsightInput = {
  months: number;                 // whole months behind the usual (3 … 6)
  running: boolean;               // the shown month is not over yet
  now: Map<string, number>;       // category (stored word) → net spent this month, kopecks
  usual: Map<string, number>;     // category → median net of the whole months, > 0 only
  income: { now: number; usual: number } | null;  // null while the month runs
};
```

They never read the database. Verdict over the alternative «detectors query the database themselves»: the sums are
folded by today's rates and by the block's person, scope and banks in the data process; repeating that in core would
mean two places that must agree. A pure function over sums is also what the Insights page and an MCP tool will call
with their own sums.

The «usual» medians (`apps/desktop/src/data/usual.ts`) stay where they are in this change: moving them is a move, its
own commit, and nothing else in core needs them yet. The 3-months floor is checked in both places (`usualOf` returns
null below it, `detectInsights` returns nothing below it), so core's rule holds for any caller.

## 2. Output

```ts
type Insight = {
  type: 'category-more' | 'category-less' | 'category-rare' | 'category-over-month' | 'income-more' | 'income-less';
  direction: 'up' | 'down';
  amount: number;          // |now − usual|, kopecks
  percent: number | null;  // round(|now − usual| / usual × 100); null for category-rare
  category: string | null; // the stored word; null for income
  now: number;
  usual: number;
};
detectInsights(input: InsightInput): { months: number; running: boolean; insights: Insight[] } | null;
```

`link` from the Notion spec is `category`: the only screen a row opens today is the category screen; the renderer turns
it into `categoryLink(id, scope, month)`. `params` are `now`, `usual` and `months`, the numbers the text needs.

## 3. Rules (constants in `read/insights.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `INSIGHT_SHARE` | 0.2 | the share threshold |
| `INSIGHT_MIN` | 50 000 | the money threshold, kopecks |
| `INSIGHT_BASE` | 100 000 | below this usual a category is «rare»: only growth, no share |
| `INSIGHT_MIN_MONTHS` | 3 | whole months needed |

The values are today's renderer constants; they move to core. `INSIGHT_MAX` (5) stays a renderer constant: how many to
show is the screen's choice, the detectors return all of them, ranked.

- A month that is over: per category in `usual ∪ now` (a category missing from `usual` has usual 0 → «rare»),
  `diff = now − usual`; kept when `|diff| ≥ INSIGHT_MIN` and (rare, or `|diff| ≥ usual × INSIGHT_SHARE`); a rare
  category only when `diff > 0`. Income the same way, with the share always required.
- A running month: only categories already over a **whole** usual month by both thresholds (`category-over-month`, with
  the share against that whole month); no income, no «less».
- Ranking: `amount` desc, then category word asc (income sorts as an empty word), so the order is stable.

Change from today: a category that is new this month (no usual at all) was invisible, because only `usual` categories
were walked. It now shows as «rare» when it passes the money threshold. This is the cheap half of the P2 «first
spending in a category».

## 4. Data process and the contract

`DataService.spendingOverview` calls `detectInsights` with the folded sums it already computes and adds
`insights: SpendingInsights | null` to `SpendingOverview` (`shared/api.ts`), each insight with a `categoryId`
(`CATEGORY_ID`) next to the stored word. `usual` stays in the answer: the category and analytics views read nothing of
it, but the spending block's other parts may; it is dropped in a later cleanup if unused.

## 5. Renderer (FSD placement)

All in the existing slice `features/spending-summary`:

- `utils/insights.ts`: `insightsView` maps `SpendingInsights` to lines: a dictionary key per `type`, `{name}`,
  `{amount}` and `{diff}` params (`{diff}` is `changeText`: the money with the share in brackets, as the lines say
  today), `tone` from `direction` (income is `neutral`), and the `to` of the category screen. First `INSIGHT_MAX` (5).
- `components/SpendingInsights.vue`: a category row is a `router-link` (the whole row, focus ring, keyboard); income
  rows stay plain. Five rows in the tile: the tile already grows with its row; checked in the mounted test at the
  narrow width.
- `constants.ts`: `INSIGHT_SHARE`, `INSIGHT_MIN`, `INSIGHT_BASE` go; `INSIGHT_MAX` becomes 5.
- Keys under `home.spending.insights.*`: `overMonth` now carries `{diff}` like `more` / `less`; `incomeNormal` is
  removed; `rare` keeps the money only.

## 6. Security

Nothing new crosses a boundary: the same sums the block already returns, now with a few derived numbers. No IPC
method, no storage.

## Risks

- Five lines may push the tile taller than «Today» and «This week» in its row. Tiles of one row share a height
  (`desktop-home-tiles`), so the row grows; acceptable, checked live (`docs/backlog.md`).
- New-this-month categories add lines users have not seen before; they pass the same 500 ₴ threshold.
