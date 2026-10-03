# «Now» strip on the home screen, and the currency switch in the global filters

Date: 03.10.2026. Version: 0.1.7 (unreleased). Design: «variant 11» of the home-screen exploration (a thin, secondary
strip of three cells). Plan: `docs/superpowers/plans/2026-10-03-now-strip.md`.

## Why

The home screen answers «how much this month» (balances) and «on what this month» (the «Spending» block). Neither answers
«how am I doing right now»: is today a heavy day, is this week ahead of last week, where does the money go this week.
The strip answers the three at a glance, under the balances and above «Spending», without competing with them.

Moving the «Dollars $» / «Euro €» switches out of the «Block settings» gear of «Spending» follows from it: the strip shows
«≈ $ / €» lines too, so the choice is no longer one block's — it belongs to the home screen.

## What the user sees

### The strip

One bordered surface (`VCard`-like, lighter: no shadow, `bg-surface`, smaller paddings), three equal columns with
vertical dividers; below the container width `@2xl` the columns stack with horizontal dividers. Placed on the home page
between `BalancesFeature` and `SpendingFeature`. The whole strip is a `<section>` with an accessible name «Now»
(`home.now.label`).

**Cell 1 — «Today · Sat, Oct 3»** (`home.now.today` + `home.now.date`; weekday from `common.weekdayShort`, month from
`common.monthShort`):
- today's spending, big (`text-2xl font-bold tabular-nums`), and the number of operations, small («2 operations»,
  `home.now.ops`);
- with currencies on: «≈ 15 $ · 13 €» under the amount (small, muted, `tabular-nums`);
- a change chip against a usual day (`+38%` with the arrow, or «about as usual»), and next to it, muted: «vs a usual day
  ≈ 520 ₴» (`home.now.vsUsual`);
- no usual day (fewer than 7 covered days, or a usual day of 0) → no chip and no context line; today 0 with a usual day
  of 0 → just «0 ₴»;
- the data does not reach today (`dataUntil` < today, e.g. no sync since yesterday) → instead of the chip line a muted
  «Data until 02.10» (`home.now.until`): a «−100%» against a usual day would be wrong.

**Cell 2 — «This week · Mon–Sat»** (`home.now.week`; on Monday just «Mon»):
- the sum Monday … today, big; «≈ $ / €» line as in cell 1;
- seven mini bars Monday … Sunday (`aria-hidden`): today in `--primary`, past days in `--primary-muted`, future days a
  2 px neutral stub (`--border`); heights relative to the largest day of the week; a past day with spending is at least
  6 % tall so it is visible;
- a change chip against the same days of last week (Monday … the same weekday), and «vs last week, Mon–Sat»
  (`home.now.vsWeek`). On Monday: Monday against last Monday. No chip and no context when last week's Monday is not
  covered by the data or last week's same days are 0;
- pending holds this week → one muted line with `lucide:clock`: «Processing at the bank: 2» (`home.now.pending`, its
  tooltip `home.now.pendingTitle` — «Their amounts may still change»). Minimal on purpose: the «Spending» block
  carries the full note.

**Cell 3 — «Most this week»** (`home.now.top`):
- the category with the largest net this week (Monday … today): a colour dot, its name (translated as in «Spending»,
  `home.spending.category.*`; ellipsis + title), the amount, and «39% of the week · 11 op.» (`home.now.topShare`,
  `home.now.opsShort`);
- the dot's colour is the one «Spending» gives that category this month: its rank in this month's categories →
  `--category-<rank + 1>` for the top 7, `--category-other` otherwise or when it is not among this month's categories;
- an empty week → a muted «No spending yet this week» (`home.now.noneWeek`).

### The change chip

The same chip as «Spending» (`VChangeChip`, below): orange with an up arrow = more, blue with a down arrow = less,
never red / green; the text carries the sign («+38%», «−12%»); under 3 % of the base → neutral «about as usual» /
«as last week» (`home.now.sameUsual`, `home.now.sameWeek`). Screen readers also hear the direction:
`home.now.srMoreUsual` / `srLessUsual` / `srMoreWeek` / `srLessWeek` («more than on a usual day», …).

### When the strip is shown

- Only with data (`syncStatus.hasData`, as every home block) and only after its first answer (no skeleton; a later
  reload keeps the previous numbers, an error keeps them too).
- Only while the month filter is the current month. The strip is always about now; with a past month picked it is
  hidden (not dimmed): the rest of the screen is about that month.
- It follows the global people filter exactly like «Spending» (`participantId` = `participant.selectedId`).
- It reloads quietly (no dimming) on `syncStatus.version` — every imported window and auto-sync — and when the Kyiv date
  changes (the period store's new `today`, recomputed on window focus and after imports), so it never shows yesterday as
  «Today» after midnight once the window is focused.

### The currency switch in the global filters

- In `GlobalFilters`, right after the month filter: a compact button showing the currencies on screen — «₴» when none,
  «₴ · $ €» with both (only the currencies switched on **and** having a rate). It opens a popover (`VPopover`, ours) with:
  a heading «Also show in currency», the note «Totals stay in hryvnia», and the two `VSwitch` rows «Dollars $» /
  «Euro €» with the same hints as before: «At the rate of your own exchanges this month», «At the rate of your nearest
  exchange — none this month», disabled with «No exchanges in $ yet».
- The button's accessible name includes its visible text: «Also show in currency: ₴ · $ €»
  (`entities.currencyDisplay.button`).
- It is home-wide: «Spending» (ring, categories, people lines) and the strip (cells 1 and 2) read it. The balances block
  is not affected.
- The «Block settings» gear of «Spending» keeps «Who spent how much» and «Last month's mark» only.
- The choice carries over: on the first start with the new version the `usd` / `eur` fields of the old `spending.view`
  storage are read once and written to the new key at once (the spending prefs store will drop them from
  `spending.view` on its next write).

## Decisions where the brief left room

1. **Usual day = median.** The 30 Kyiv days before today (today excluded), cut to what the data covers: from
   `max(today − 30, first data date)` to `min(yesterday, last fully synced day)` (core `periodInfo.coveredDays` of the
   daily query). Each such day counts, a day without spending as **0** (so a usual day of a person who spends every
   other day is honest). Even count → the mean of the two middle values, rounded to a kopeck. Fewer than **7** such days
   → `null` (no chip, no context): a median of three days says little.
2. **Scope = «Personal», fixed.** The «Spending» block's «Personal / Business» switch is the block's own local choice
   (a `ref` in `useSpending`, not persisted, default «Personal»). The strip does not follow it: a business tax payment
   would make «today» or «the usual day» meaningless, and a hidden dependency on another block's switch would surprise.
   The strip's numbers equal «Spending» on «Personal» for the same days (same core aggregate, same transfer / refund
   rules, same participant view).
3. **Rates = this month's own exchanges**, `exchangeRates(db, monthBounds(this month))` — exactly what «Spending» uses
   for the current month — applied to every day of the window, also the days of last month (a glance, not accounting).
   A currency without any rate is left out of the strip's sums silently (the «Spending» block lists it).
4. **Availability in the global switch** comes from the «Spending» overview of the selected month: `useSpending`
   publishes its `fx` into the currency store (`setFx`) on every answer. The strip is visible only for the current
   month, when that `fx` equals the strip's own, so the switch and both blocks always agree. No new request.
5. **Where shared things live (FSD).**
   - `ChangeChip` moves to `shared/ui` as `VChangeChip` (ours, BEM + SCSS, two new tokens `--ui-series-orange` /
     `--ui-series-blue` wrapping the theme's `--series-*`): two features need it, and «`shared/ui` first» says one
     component, not two drifting copies. Its model `ChangeChipModel` (= today's `ChipView`, which becomes an alias).
   - The pure `change()` (3 % rule) moves to `shared/lib/change.ts`; «Spending» re-exports it from its `utils.ts`.
   - The currency choice is a new entity `entities/currency-display`: Pinia store (`prefs`, `set`, `fx`, `setFx`),
     constants (`FX_CURRENCIES`, storage keys), pure helpers (`parseCurrencyPrefs`, `ratedCurrencies`,
     `convertLines`, `convertInline`, `shownText`) and its component `CurrencyToggle` (an entity component may read and
     change its own store, as `ParticipantFilter`).
   - The strip's category name and colour are two small functions in its own `utils.ts` (a feature cannot import
     «Spending»); they read the same dictionary keys and CSS variables.
6. **IPC**: one channel `getNowOverview({ participantId? })`. Main computes «today» from its clock in Kyiv
   (`toKyivDate(nowSec)`); the renderer passes no dates. Not allowed while locked or while the database is not ready (it
   is in neither allow-list). Shape under «Data contract».
7. **Per-day spending in core**: `spendingSummary` gets an internal `groupBy: 'day'` (key = Kyiv `local_date`). It is
   **not** added to `SPENDING_GROUP_BY` (the MCP tools' list), so the MCP tools are unchanged. Two core calls give the
   strip everything: `day` over `[today − 30, today]` (today, the week's bars, last week's same days, the usual day) and
   `category` over `[Monday, today]` (the week's total and top category); a third, `category` over this month, ranks the
   top category for its colour.
8. **The order of categories** (net desc, then the word; net ≤ 0 left out) becomes one helper in `main/spending.ts`
   (`rankedCategories`), used by `spendingOverview` and the strip, so the colour rank cannot drift.

## Numbers

All amounts leave main as hryvnia kopecks.

- **Spending** of a day / week / category = `net` of the core `spendingSummary` (scope `personal`; gross − refunds;
  income and own transfers excluded, family transfers excluded for the whole family and counted for one person), folded
  into hryvnia by this month's own rates (`foldByCategory` — it folds by any group key).
- **Operations** = `purchases` (spending lines `amount < 0`).
- **Today** = the day group of today's Kyiv date. Holds are included (as everywhere).
- **Week** = Monday … today (Kyiv, ISO week). `days[i]` = net of Monday + i, `null` after today. `total` = the sum of
  the week's categories (net and purchases), so the top category's share adds up.
- **Last week** = Monday − 7 … today − 7, from the same daily groups; `null` when the first data date is after
  Monday − 7.
- **Share** of the top category = `round(net / week.total.net × 100)` %, in the renderer.
- **Change**: percent of the base (usual day or last week), the 3 % rule; a base ≤ 0 → no chip.
- **Currencies** (USD 840, EUR 978): `fx` as in «Spending» (`rate`, `nearest`; `prevRate` always `null`); converted =
  `round(kopecks / rate)`.

## Data contract

```ts
type NowOverviewQuery = { participantId?: number };

type NowOverview = {
  date: string;              // Kyiv date main counted as today
  weekday: number;           // 1 = Monday … 7 = Sunday
  dataUntil: string | null;  // Kyiv date the data reaches (core periodInfo)
  today: SpendingAmounts;    // { net, purchases }
  usualDay: number | null;   // median, see «Decisions» 1
  week: {
    from: string;                  // Monday
    days: Array<number | null>;    // Mon … Sun, null after today
    total: SpendingAmounts;        // Mon … today
    prev: number | null;           // last week's Mon … same weekday
    top: (SpendingAmounts & { category: string; categoryId: CategoryId | null; rank: number | null }) | null;
    pendingHolds: number;
  };
  fx: SpendingFx[];          // this month's rates, prevRate null
};
```

No names, descriptions, card numbers or IBANs: dates, amounts, counts, a category word / id and rates only (checked by
the canaries of `tests/data.test.ts`).

## Out of scope

- A scope switch on the strip; business spending in it.
- Analytics over time (the strip is not a chart block).
- PLN and rates from card purchases: a backlog entry («Later: PLN and card-purchase rates» in `docs/backlog.md`).

## Tests

- core: `groupBy: 'day'` — keys, nets, same totals as `category`; still rejected by the MCP list.
- main: `shiftDate`, `isoWeekday`, `median`, `usualDay`, `sumDays`, `weekDays`, `rankedCategories` (pure);
  `DataService.nowOverview` on fictional fixtures — today, week bars, last week, usual day, top category and its rank,
  personal scope only, currencies folded, one person vs the family, data starting late (no usual day, no last week),
  pending holds, canaries.
- IPC: invalid inputs, a valid call reaches the handler; the preload exposes it (it follows `METHODS`).
- renderer: `change` in `shared/lib`; `VChangeChip`; `VPopover` with text; the period store's `today`; the currency
  entity (parse, migration, conversions, the button text, the popover mounted); «Spending» without currency switches
  and still converting by the shared choice; the strip's pure helpers and the strip mounted (hidden for a past month,
  texts in Russian, conversions, empty week, pending holds, stale data, quiet reload); architecture and i18n tests stay
  green.
