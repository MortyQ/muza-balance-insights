# Десктоп: renderer — FSD, UI, стили, навигация

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/desktop/src/renderer.

- Экран данных (шаг 7): main отдаёт узкие view-типы из `apps/desktop/src/shared/api.ts` (`apps/desktop/src/data/data.ts` поверх
  `spendingSummary` / `getMonthOverview` ядра) — категории, суммы в минимальных единицах, даты, подписи `black/UAH`.
  From the core the renderer imports only `@mono/core/shared/currency` (money format) and `@mono/core/providers/info`
  (the bank registry, pure data). По умолчанию — текущий месяц (Киев), «личное».
- **Блок балансов** (`features/balances`, `BalancesFeature.vue`): карта на главной с итогом месяца, приходом и тратами.
  Клик (или Enter/пробел) раскрывает стопку в ряд: у семьи — общая карта, затем карта каждого человека в его цвете
  (`legend`); у одного человека — его общая карта, затем каждый его счёт (карты, кредитки, банки, валютные); «Все
  счета» — заглушка (текст «Раздел появится позже», флаг в `useCardStack`). Позиции стопки/ряда — чистые функции в
  `utils.ts` (`slidesOf`, `slidePosition`), CSS-переменные `--x`/`--y`/`--z`/`--o`, `motion-reduce:` без сдвига.
  `composables/useMonthOverview.ts` — данные месяца и человека (`useAsyncData`, тихая перезагрузка на
  `syncStatus.version`). Счёт без данных на выбранную дату — бледная карта, `own_funds: null`.
  Layout (specs `desktop-home-tiles`, `desktop-balance-cards`): `BalancesFeature`'s root is `<div class="contents">`, so
  its three tiles are items of home's grid (`pages/home/HomePage.vue`): «Balance» (the stack, `FreeLine` under it —
  `freeLineOf(slide)`: the front card's free amount, its reserve and the free share as a bar; `row.first` while open),
  «Month pace» (`PacePanel`, the tile `min-w-0` so the chart shrinks with the grid) and «Month» (`MonthPanel`). Opening the
  row gives «Balance» `col-span-full`; the other two get `v-show` + `inert` (kept mounted: no reload, no new chart).
  The month pace (`components/PacePanel.vue`): `composables/useMonthPace.ts`
  asks `getAnalyticsOverview` for the block's month and person (one month: day buckets, `spending`, `usual`) and, for
  the current month only, `getAllowanceOverview` (its failure drops only «Available per day»); `paceView` /
  `paceChartOption(view, money)` in `utils.ts` (pure, `tests/renderer/month-pace.test.ts`) — the spending added up by day
  up to the last day with data as a line with a soft filled area, the usual dashed in a pale primary, today's point with
  its amount in a pill while the month runs, amounts on a faint grid (`money` — the home's `MoneyFormat`); figures:
  spent, usual by the same day (a past month: usual in a month), per day. No pace for a month without data; no usual
  line or figure with fewer than 3 whole months, a note instead.
  Split by banks (spec `desktop-spending-split`): `PaceSettings` (`VPopover` `lucide:settings`, «Together / By banks»)
  in the panel's header while two or more banks are on; the choice is `composables/usePaceSplit.ts` (`localStorage`
  `home.pace.split`, default together). `paceView` adds each bank's running sum from `spendingByBank` (`PaceView.banks`),
  `paceBanks(view, offered, split)` gives the banks to draw (name and colour from `entities/bank`) or null, and
  `paceChartOption(view, money, banks)` then stacks one area per bank under the month's line (no fill of its own; the
  areas have no edges and `PACE_BANK_FILL` strength, which the legend's swatches repeat);
  `paceTooltip` adds each bank's part after «Spent»; `PaceLegend` under the chart lists the banks drawn (`paceLegend`:
  colour, name, amount by the last day). No new request.
  A `Slide` is `{ kind: 'summary'; card: SummaryCardProps } | { kind: 'account'; card: AccountCardProps }` plus `key`
  and `flow`; an account slide carries its bank (`name.provider`) and card type (`variant`, `name.type`).
  The open row is a native scroller (`CardStack`): `overflow-x-auto`, `snap-x snap-mandatory`, cards stay absolute at
  `i × CARD_STEP` with `snap-start`, `[scrollbar-width:none]` on every OS, the edge with more cards fades
  (`mask-image`, `--fade-l` / `--fade-r`). `composables/useRowScroll.ts` reads the scroller into `rowView(scrollLeft,
  clientWidth, n)` (`first`/`last` wholly in view, `atStart`/`atEnd`, `fits`), moves by whole cards (`prev`/`next` —
  the header arrows, `goTo` — `RowDots`) and `toStart()` (waits for `scrollend`, `SCROLL_END_WAIT` fallback; instant under
  `prefers-reduced-motion`). `composables/useDragScroll.ts` — mouse drag past `DRAG_THRESHOLD` with snapping off and the
  next click swallowed; touch and pen are native; the vertical wheel is not translated. Every card takes focus while
  open and `focusin` scrolls it into view. `RowDots` — a button per card (`home.balances.toCard`), the cards in view as
  a pill, its place kept while folded. Folding scrolls to the start first, then stacks (`collapse` in
  `BalancesFeature`); `composables/useCardStack.ts` — `open`/`paging`/`toggle`/`close`, a new month or person calls
  `onReset` (the row jumps to its start).
  The month panel's «Into jars» / «Out of jars» line (`savedLine`, `Flow.saved`, total cards only) is `CardTotal.saved`
  from main: the jars' own funds at the month's end minus at its start, foreign jars at today's rate; null — no jar
  with data at both ends.
  Reserves (`MonthOverview.reserved`, today's balance only): the total card of the view — the family's, the picked
  person's, and each person's card in the family view with their own reserves (`people[].reserved`); never an account
  card — shows «Free» (own funds − reserves) big and own funds («Actually») and the reserve as tiles under it; the month panel's «Reserved» line (`reservedLine`,
  `Flow.reserved`) links to the planning screen (the card itself is a button, a link cannot sit inside it).
  `entities/account` — display only. `components/SummaryCard.vue` — the total of a view (spec
  `desktop-balance-cards`): a header band, a gradient of each person's colour mixed into `--surface` by `--card-band-tint`
  (one person: fading to `--card-band-fade`; both in `theme.css`, stronger in the dark theme), with `lucide:layers`, the
  title, the «Total» chip `home.balances.total` and `accents` as dots (at most five, then «+N»,
  `home.balances.morePeople`); under it the caption, the amount and `count`; on the right a column of the conversions
  (`fx`: symbol badge, `formatAmount`, ISO code; `MoneyFormat.alsoParts`), none without another picked currency; in the
  middle the family's shares (`people`, `sharesOf`: two or more people, at most `SHARES_NAMED` first names with whole
  amounts, then «+N»; a bar part per non-zero amount, a minus hatched; no bar when nobody is above zero) or, on one
  person's card with reserves, the meter (`freeShare`, `home.balances.freeShare` / `reservedShare`); tiles — «Actually»
  (`home.balances.actualTile`) and «Reserved» with reserves only, the month's net (`home.balances.inMonthTitle`,
  `--success-subtle` above zero, `--negative-soft-bg` below, neutral at zero). Negative figures use `--negative-soft`, a
  muted `--danger` for both themes. No rate line (the month panel keeps `fxNote`). It takes `SummaryCardProps` (each
  figure apart: `count`, `fx`, `negative`, `own`, `reserved`, `people`, `freeShare`, `net { label, amount, value }`);
  `components/AccountCard.vue` picks the skin of the account's bank from `BANK_CARDS` (`constants.ts`,
  `Partial<Record<ProviderId, Component>>`, else `NeutralCard` on `bg-nav`); each skin draws the bank's physical card
  (spec `desktop-balance-cards`) over `components/bank/CardShell.vue` — the shared body: wordmark slot `brand`, shapes
  slot `art`, the chip, `lucide:nfc`, a sheen, the people dots, the figures and `tone` (`dark | light`: text colours, the
  net arrow in `--card-up` / `--card-down` or, on a light card, `--card-up-ink` / `--card-down-ink` of `theme.css`). Skins
  are CSS only (gradients and shapes, fixed brand colours, no image file): `MonobankCard` by `variant` (black — also a
  jar and any other type —, white, iron, platinum, yellow), `PrivatBankCard`, `ABankCard`, `SlspCard`. Wordmarks are
  brand marks in the app's font, `aria-hidden`, never translated. They take `CardFigures` (`title`, `caption`, `amount`,
  `approx`, `actual`, `bottom`, `net` + `netText`, `accents`, `dim`, `variant`). All are 400 × 252 (a bank card's proportion; `CARD_WIDTH`), and their root is a `<button>`; `aria-expanded` comes from
  outside (no `aria-label` of their own: screen readers read the card's content, `aria-expanded` gives the state).
  `entities/period` — Pinia-store `useMonthStore` (`month`, `thisMonth`, `set(next, first)` — зажимает в
  `[firstMonth, thisMonth]`): один выбранный месяц для всей главной, его читают `balances` и `spending-summary`
  (своих переключателей месяца у них нет). Выбирают его в `MonthFilter` (компонент сущности, как `ParticipantFilter`:
  `VMonthPicker` «Месяц», `max` — этот месяц, `min` — пропсом; при сдвиге `min` позже зажимает выбор заново).
  Виджет `widgets/global-filters` (`GlobalFilters`, pinned above the default layout's scroll area, `app/layouts/DefaultLayout.vue`; layout — root `CLAUDE.md`) — фильтры, которые читают все блоки:
  `ParticipantFilter` и `MonthFilter` (только при `syncStatus.hasData`), then `CurrencyToggle` of `entities/currency-display` and the widget's `BankFilter` (the bank choice lives in the participant store: `banks`, `shown`, `selectedProviders` — undefined while every bank is on —, `selectBanks`; every data feature passes `selectedProviders` as `providers` next to `participantId`), `min` = the import's floor month
  (`monthOf(importFloor(today))`, `src/shared/import-range.ts`), not the first data month: an older month gets the «no data
  yet» notice of `widgets/home-notices` (сущности друг друга не импортируют). `shared/ui/VMonthPicker` — свой (на reka-ui `MonthPicker` в `PopoverRoot`, muzakit такого не даёт):
  `v-model` `'YYYY-MM'`, `min`/`max`, сетка 3×4, месяцы вне диапазона `disabled`.
- **Home grid** (spec `openspec/specs/desktop-home-tiles`): `HomePage` owns one CSS grid (`data-test="home-grid"`,
  `@container`: one column, two from `@[47rem]`, twelve from `@[79rem]` — where the folded stack fits 5 of them; rows
  5 · 4 · 3 (balance, pace, month; under 65rem a row each, 65–79rem balance | month over pace — the stack never
  stands alone in a wide row), 4 · 4 · 4 («Now» and «What's unusual»), 9 · 3 (spending, people / regular payments)). The features put their tiles straight
  into it through a `<div class="contents">` root (one root element; a comment before it would be a second root and drop
  the classes the page passes), in DOM order: balances (3 tiles), «Now» («Today», «This week», or the details tile),
  spending («What's unusual», «Spending by category» two columns × two rows, «Who spent what»), the regular payments
  teaser. Each tile says its own span. The «Now» details tile takes «What's unusual»'s place too: `NowStripFeature`
  `v-model:details` → `SpendingFeature` `insights-hidden` through the page (features never import each other).
  Checked by `tests/home-grid.test.ts`.
- **Sync status** (on the right of `GlobalFilters`, `widgets/global-filters`): the widget is where `import-progress`,
  `sync-status` and `participant` meet, and it takes the import's error wording from `features/import-statement`
  (`IMPORT_ERRORS`, `progressLine`, re-exported by its `index.ts`). `utils.ts`: `syncStatusView(progress, { line,
  lastSyncAt }, now, labelOf)` → `SyncStatusView` (`types.ts`: `icon`, `text`, `percent`, `note`, `tooltip`), pure and
  tested (`tests/renderer/sync-status.test.ts`); `failedConnections(progress)` → connection id → error text for
  `ParticipantFilter`'s `failed` prop. Phases: a user's import — spinner + `home.filters.syncing`, the windows share
  (`home.filters.percent`) only in `windows`, `progressLine` in the tooltip; «Auto-sync» — `home.import.autoRunning`, no
  percent, no tooltip; `retry` — `home.filters.retryAt` + the full retry line in the tooltip; otherwise the data line
  (`syncStatus.line`) + `home.filters.updated` with `syncedWhen(lastSyncAt, now)` (`shared/lib`: today → `common.atTime`,
  another day → `shortDate`); `done` with `failed` or `error` — a `text-warning` triangle, the reason
  (`home.import.notLoaded` / `IMPORT_ERRORS`) in the tooltip and as sr-only text. `components/SyncStatus.vue`: `role="status"`
  `aria-live="polite"`, the percent `aria-hidden` (a phase is announced once, not every tick), the spinner
  `motion-reduce:animate-none`; no `aria-busy` on the header (it can hold the announcement back). People: each person's
  tooltip — `entities.participant.updated` with the latest `lastSyncAt` of their connections (`lastSyncOf`), plus
  «label: reason» per failed connection; such a person gets `SegmentOption.alert` (`VSegmentedControl`: a warning dot,
  the string is the sr-only suffix, `entities.participant.syncFailed`). Segment tooltips are HTML, so names are escaped.
  Per-connection progress is not in the IPC: no per-person spinner.
- **Spending block** (`features/spending-summary`, `SpendingFeature.vue`; spec `docs/superpowers/specs/2026-10-02-spending-block-design.md`):
  one IPC `getSpendingOverview({ month, scope, participantId? })` (main: `DataService.spendingOverview`, helpers in
  `data/spending.ts`) — categories in hryvnia (account currencies folded by today's Monobank rates, `leftOut` without a rate; the answer carries `rates`),
  `purchases`, the compared period (`compare`: last month, cut to the same day while the month is incomplete; null
  before the data), for the family (more than one participant) each participant's part of every category. Renderer: `utils/` (by subject: `rows`, `people`, `chips`, `ring`, `totals`, `texts`, `prefs`, shared `month`; one `index.ts`) builds rows for the
  family or the block's own pick (`rowsFor`, top 7 + «N more categories» — not «Other», a bank category; colours by the
  family's rank from `--category-1…7`, a picked person's category below the top 7 — `--category-other`), chips (`change`,
  3% → «as in»; short differences carry «+» / «−» and an `sr` direction for screen readers), operations (`opsView`, `opsVs` with `OPS_TONE`),
  the ring (`ringStops` / `ringOf`), the compared period (`comparePeriodText` → `home.spending.compareFull`), the centre total and every amount through `MoneyFormat` (`entities/currency-display`; no per-currency chip). `composables/useSpending.ts` — the
  request and the pick (reset on month, scope and global filter changes);
  `composables/useSpendingView.ts` puts together `usePick` (the block's own person pick and the people list),
  `useCategoryRows` (`CategoriesView`: rows with their `categoryLink`, «noneBy») and `useSummaryView` (`SummaryView`:
  ring, comparison, stats, member card). Components only show one model each: `SpendingHeader` (+ `SpendingSettings` of
  `PrefSwitch`), `SpendingNotices`, `SpendingBody` → `summary/` (`SpendingSummary`: `CategoryRing`, `CompareNote`,
  `SpendingStats`, `PeopleList` of `PersonRow`, `MemberCard`) and `categories/` (`CategoryList` of `CategoryRow`:
  `OpsDiff`, `VShareBar`, `AmountCell`); a person's initial is `VAvatar` of `shared/ui`. A picked person keeps the family's bar scale: their
  segment first and bright, the others faded. A pick with no spending keeps the people list and shows `noneBy`; a pick
  of a person no longer in the view falls back to the family. Menu choices — `store/useSpendingPrefsStore.ts` (`localStorage` `spending.view`, defaults: split and mark on); the
  currency is the home-wide `entities/currency-display` choice. The footnote says «at today's Monobank rate». Layout: `@container`, the columns stack
  below `@3xl`; only the category name shrinks (ellipsis + title); numbers have fixed widths and never wrap.
  `shared/ui/VPopover` — ours on reka-ui.
  A category row is a link to its screen (`categoryLink(id, scope)` in `shared/config`; «N more categories» and an
  unknown word stay plain rows); it no longer unfolds — the per-person split is on the category screen. Category
  icons, names and rank colours live in `entities/category` (`CATEGORY_ICON`, `categoryName`, `categoryColor`), shared
  with the «Now» strip and the category screen.
  Tiles (spec `desktop-home-tiles`): «What's unusual» (`SpendingInsights`) in its own tile in the «Now» row, hidden by
  `insightsHidden`; the block's tile — header, notices, the summary column (ring, compare note, stats as soft tiles,
  member card) and the category rows (`CategoryRow`: icon in a soft circle, name with share and operations, chip,
  amount, the bar under them; `CategoryList` lists `SHOWN_ROWS` (4) and unfolds the rest in place); «Who spent what»
  (`PeopleList`, family view only, each person with a share bar — `PersonRowView.share`).
  «What's unusual» (`SpendingInsights`): `utils/insights.ts` `insightsView` over `SpendingOverview.usual`
  (whole-month medians) — categories off their usual by at least `INSIGHT_SHARE` (20%) and `INSIGHT_MIN` (500 ₴), the
  largest differences first, at most `INSIGHT_MAX` (3). A usual under `INSIGHT_BASE` (1 000 ₴) is too small a base for a
  share: only «more», said by the amount. While the month runs (`usual.running`) only categories already over a whole
  usual month, no income; a month that is over then says income (beside a category, or alone when off itself). The
  note says the median of how many months. None while a person is picked inside the block (the usual is the view's).
- **Category screen** (`features/category-detail`, `CategoryDetailFeature.vue`; `pages/category`; spec
  `docs/superpowers/specs/2026-10-05-category-screen-design.md`): route `category` (`/category/:id`, `CategoryId`; an
  unknown id → home by the route's guard; `query.scope` and an optional `query.day` / `query.week` (a real date),
  written by `categoryLink(id, scope, period?)` and read back by `categoryRequest`), default layout without its
  own menu item (`meta.navParent: 'home'` keeps «General» current — `useNav`). One IPC `getCategoryOverview` (see
  `desktop-import.md`); person and currency are the global filters; quiet reload on `syncStatus.version`.
  The feature takes a `period: DetailPeriod` prop: the page passes the link's day or week (`periodRequest` of
  `shared/config`: `query.day` / `query.week`, written by `periodQuery`), else the global filter's month; picking a
  month in the filter while a day or a week is open replaces the route with the month's. What a period shows is one
  table, `PERIOD_BLOCKS` of `entities/operations` (a day: no 12 months, no «per day», «When» only by part of the day; a
  week: no 12 months and no days of the month), the header's period `periodTitle`; the feature's own words are
  `PERIOD_TEXT` (the figure's label, the rank, «no spending»); a week is compared with last week (`changeChip(…,
  'week')`, `entities.operations.change.week.*`), a day with nothing. The income screen works the same way.
  The «Now» strip's category rows link here for their day or week (personal).
  `composables/useCategoryDetail.ts` — the request; `composables/useCategoryView.ts` — the view plus the list's own
  merchant filter, search and order (reset with period, category and person). «When» is counted on the screen from the
  lines (`whenTotals`), so the merchant filter narrows it too and its title names the merchant; the search does not. `utils.ts` is pure and tested
  (`tests/renderer/category-detail.test.ts`): summary (the change chip in «Spending»'s words), 12 months (average of
  the months with data), who / where / when, the list (merchants matched case-insensitively, search by text, comment
  and amount digits; the list total is the category's own figure while nothing filters it). Bars and marks are
  `aria-hidden` with sr-only text; the list is a `role="table"` grid that scrolls sideways in a narrow window.
  12 months: main picks the window (`monthsWindow` in `data/category.ts`: up to the current month while the picked one
  is among its last 12, else up to the picked one) and sends `thisMonth`; the strong bar is the picked month, the
  average leaves the running month out, the caption compares the picked month with it.
  The first load (no data yet) shows `DetailSkeleton` of `entities/operations` (`role="status"`) in place of the cards. Past
  months' bars and «When»'s non-peak bars are the category colour mixed 45% into the surface; the strong bar is the
  colour itself.
- **Shared parts of the detail screens** (`entities/operations`): what the category and income screens both show —
  `DetailSummary` (`SummaryHeader` + `SummaryFigure` + `StatGrid` of `StatCell`; `SummaryView`), `MonthsChart`,
  `WhenCharts` (`WeekdayBars`, `DayPartBars`, `MonthDayBars`), `PartBars` (`PartBar`: a split card's rows, the mark is
  the `mark` slot — the screens put `BankMark` there for «By bank»), `PeopleBars` (`PartBars` with `VAvatar`), `ShareList` (`ShareItem`:
  merchants / senders that filter the list), `OperationList` (the `role="table"` list with search and order, rows —
  `OperationRow`, columns `OPERATION_COLS`; column and search texts come as props), `BackLink`, `DetailSkeleton`. Every
  block only shows what it is given and emits what was picked; loading stays in the feature's `api/`; pure helpers in `utils.ts` (`monthsView`,
  `whenView` / `whenTotals` over a `value` accessor, `partBars`, `peopleBars`, `shareItems`, `changeChip`, `searchText`, `nameKey`).
  Texts — `entities.operations.*`. Amounts go through a structural `Money` (`MoneyFormat` fits; entities do not import
  each other).
  Charts are ECharts through `VChart` of `shared/ui`: «Last 12 months» (`monthsChartOption`: bar heights in % of the
  chart, the dashed average as a mark line with its amount at the right end (`avgLabel`), the picked month's label bold) and «When»'s weekdays and days
  (`weekdaysChartOption`, `daysChartOption`); options are pure and tested, colours stay CSS (`var(--cat)`, `SOFT_BAR`)
  and `VChart` resolves them. Progress-like bars (people, names, sources, parts of the day, the spending rows, the «Now» panel) are `VShareBar` of `shared/ui`.
- **Income screen** (`features/income-detail`, `IncomeDetailFeature.vue`; `pages/income`): route `income` (`/income`,
  `meta.navParent: 'home'`), opened from the «In» row of the balances' month panel (`FlowBars` `incomeTo`, md only). One
  IPC `getIncomeOverview({ period, participantId? })` — all scopes, the balances' figure; person and currency are the
  global filters, the period as on the category screen (`incomeLink(period?)`, the page passes a day, a week or the
  filter's month); quiet reload on `syncStatus.version`. Built like the category screen from `entities/operations`:
  summary (lines, average + median, per day, the month's spending as a share of the income, the largest), 12 months,
  «Where from» (`SourceBars`, by core income source), «From» (senders, filter the list and «When»), «Who received»
  (family view), «When», the list (always «+», green). Colour — `INCOME_COLOR` (`--success`). `utils.ts` is pure and
  tested (`tests/renderer/income-detail.test.ts`).
- **Planning screen** (`pages/planning`, route `planning`, `meta.nav` order 3, icon `lucide:calculator`,
  `periodFilter: 'none'`): planners and their settings, not on home. For now one block:
- **«Available per day»** (`features/daily-allowance`, `AllowanceFeature.vue`): on the planning screen, always about
  now (the month filter does not apply). One IPC `getAllowanceOverview({ participantId? })`, reloaded
  on the person, quietly on `syncStatus.version` and a new day (`useAllowance`). `utils.ts`: `allowanceView` — the sum
  per day (or what is short), «until … · n days», the income line (next / late / none) and the count's lines
  (`AllowanceBreakdown`: money, each active reserve, each mandatory payment, free, per day); `reserveMinor` — an amount typed in
  whole units; `reserveRows` — the reserves list (own currency, ≈ the screen's, the term). Under the count `ReserveList`:
  `ReserveRow` (`VPopover` menu «Edit» / «Delete»), one `ReserveForm` at a time (name, amount, currency `VSelect`,
  «No end» `VCheckbox` or the last day `VDatepicker`; «Whose» `VSelect` — each person and «Common» — in a family of
  several only, at first the picked person or common; one person: no field, theirs; checked on submit); a row says
  whose (`ReserveRowView.owner`) in a family view of several, «Add a reserve» up to `RESERVES_MAX`;
  `useAllowance.saveReserve` / `deleteReserve` call IPC and reload. `dayMonthName` («5 April», the year outside the current one) is in
  `shared/lib`, shared with the regular payments screen. Tested in `tests/renderer/allowance.test.ts`.
- **Regular payments screen** (`features/recurring-payments`, `RecurringFeature.vue`; `pages/recurring`): route
  `recurring` (`/recurring`), its own side menu item (`home.nav.recurring`, after «Analytics») and
  `meta.periodFilter: 'none'` — the global filters show the person and the currency, no period (the screen always
  looks at the last 13 months). One IPC `getRecurringOverview({ participantId? })`, reloaded on the person, quietly on
  `syncStatus.version`. `useRecurring` loads, `useRecurringView` builds `RecurringSummaryView` (the monthly total, the
  count, since when) and `RecurringRowView`s (`utils.ts`: `summaryView`, `rowView`, `dayText`); the person is in a row
  only in the family view of several. Components: `RecurringSummary`, `RecurringList` → `RecurringRow` (the category's
  icon, the name, category · person with `VAvatar`, the usual amount, the operation currency, «next» or «last»); the
  stopped ones in a second list. Marks: a row's `VPopover` menu (`lucide:ellipsis`) — «Mandatory payment» / «Not
  mandatory» and «Not a regular payment»; `useRecurring.setMark` saves (IPC `setRecurringMark`) and reloads, a failure
  shows `recurring.markFailed`. A mandatory row carries a «mandatory» pill, the summary «of which mandatory …»; hidden
  ones sit folded in a `<details>` «Hidden (n)», each with «Restore». On home, under «Spending»,
  `RecurringTeaserFeature`: one card-wide link to the screen — the monthly total, the count and the mandatory part
  (`teaserView`); only while the month filter is this month and something is active (`useRecurringTeaser`, the same
  IPC; quiet reloads on `syncStatus.version`; a mark is a write, so back on home its cached answer is stale and reloads quietly).
  Tested in `tests/renderer/recurring.test.ts`.
- **Analytics screen** (`features/analytics-overview`, `AnalyticsFeature.vue`; `pages/analytics`; spec
  `docs/superpowers/specs/2026-10-06-analytics-design.md`): route `analytics` with `meta.periodFilter: 'range'` — the
  global filters show `PeriodRangeFilter` (`entities/period`: `useRangeStore` — whole months, default the last 12 whole
  ones, independent of the home month; `rangePresets`, `compareText` for the picker's note; `dataFrom` comes as a prop)
  over `shared/ui/VMonthRangePicker` (ours on reka-ui `MonthPicker` / `MonthRangePicker`: «One month | Range», quick
  picks, the first click of a range is already one month, a draft applied on «Show», a `note` slot). One IPC
  `getAnalyticsOverview` (see `desktop-import.md`); person and currency are the global filters; quiet reload on
  `syncStatus.version`. Blocks: KPIs (income, spending, left, savings rate vs the period before), «Income and spending»
  (ECharts lines on a value axis by bucket index, the area between them as two `custom` polygon series split exactly at
  crossings — `gapPolygons`; one month: running totals + the dashed usual month), «What changed» (4 largest increases +
  the largest decrease; a row opens «Lines» with that category alone), «Categories» with a `VSegmentedControl` of four
  views: heatmap (`role="table"`; months, or calendar weeks of one month; colour = the cell's per-day level against the
  row's mean over full columns, `--heat-hot` / `--heat-cold` in `theme.css`, a running column dashed and out of the
  mean), small charts, lines (chips toggle, top 5 by default, hover fades the others, amount / share), compare
  (diverging bars). Rows = every category with spending, by the period's rank (no «Other N»; rank colours for the
  top 7, `--category-other` past them). Heatmap: names pinned left and «Average» right while the cells scroll; hovering a cell lights its row and column and fades the rest. The heatmap says its unit next to the legend (thousands of the shown
  currency per month, or per week); a small chart's bar has a tooltip with its bucket and amount. `utils.ts` is pure and tested
  (`tests/renderer/analytics.test.ts`).
- **«Now» strip** (`features/now-strip`, `NowStripFeature.vue`; spec `docs/superpowers/specs/2026-10-03-now-strip-design.md`):
  one IPC `getNowOverview({ participantId? })` (main: `DataService.nowOverview`, helpers in `data/now.ts`; main decides
  «today» in the system time zone, `src/shared/dates.ts`) — today vs a usual day (median of the 30 covered days before today, a day without spending = 0, none
  under 7 days), this week Monday … today vs the same days of last week, seven bars, the week's top category (its colour
  = its rank in this month's categories, as in «Spending»), pending holds. Personal scope always; today's Monobank rates (the answer carries `rates`).
  Between the balances and «Spending»; hidden unless the month filter is this month; reloads quietly on
  `syncStatus.version` and on the period store's `today`. `utils.ts` (`nowView`, `nowChip`, `weekBars`, `dayLabel`,
  `daysRange`, `categoryColor`) is pure and tested (`tests/renderer/now-strip.test.ts`).
  Two tiles, «Today» and «This week» (`components/TileCategories.vue`: at most `SHOWN_CATEGORIES` (3) rows — the
  category's icon in a soft circle of its colour, the name, a bar against the period's biggest category (`CategoryRow.bar`),
  the amount); each tile's button («Details», or `CategoryBreakdown.more` — «N more categories · amount») opens the details
  tile in their place (`col-span-full`): a «Today | Week» switch and every spending category of that period
  (`CategoryList`: colour, share of the period, amount, operations; the week's rows carry a chip against the same days
  of last week — `categoryChip`: the amount only, «same», «new»), closed with ✕. Open / closed is the
  `details` model (not remembered, closed when the strip hides); the period is remembered (`useNowPrefsStore`,
  `localStorage` `now.categories`, `parsePrefs`, default the week). Categories and numbers only: the lines with the
  bank's text stay on the category screen, which each row opens for that day or week.
- **Currency choice** (`entities/currency-display`): the home-wide main currency (₴ / $ / €) and the «≈» currencies.
  `useCurrencyDisplayStore` holds `choice { main, also }` (`localStorage` `home.currencies`; the old `{ usd, eur }` and
  the old `spending.view` `usd` / `eur` are read once and saved at once, as hryvnia main with the same «≈» ones) and
  `rates` — the newest `RatesView` snapshot of any block's answer (`setRates`), `undefined` until the first answer
  (not loaded yet, which is not «no rates»; `null` — main has none). Every home block calls
  `useMoneyFormat(() => answer.rates)` and formats through the returned `MoneyFormat` (`currency`, `convert`, `money`,
  `approx`, `approxInline`); without a rate for the main currency it falls back to ₴. Balances, «In / Out», the «Now»
  strip and «Spending» all format this way; no block formats a hryvnia amount itself. `CurrencyToggle` (in
  `GlobalFilters` after `MonthFilter`): a `VPopover` whose text is `shownText` («$ · ₴ €»), a `VSegmentedControl` for
  the main currency, «Also show» `VSwitch` rows for the others, and a footer with the rate's fetch time («saved» when
  main served the cached rates offline, or «no rates»).
- **Change chips** — `shared/ui/VChangeChip` (ours, `ChangeChipModel`) and `change()` in `shared/lib` (3 % → «same»):
  one look and one rule for «Spending» and the strip. A change against a base is said in money first, the percent in
  brackets — «+1 090 ₴ (9%)», in a sentence «1 090 ₴ (9%) more than…» (`changeText`; analytics: `diffText`): a
  percent alone reads wrong over a small base. Dictionary keys take it as `{diff}`. Shares («45% of the family») stay
  percent only.
- Стили renderer — Tailwind v4 (`@tailwindcss/vite`), токены — копия `muzakit/libs/config/src/tailwind/theme.css`
  в `apps/desktop/src/renderer/src/app/styles/theme.css` (сканирование только renderer: `source(none)` + `@source`).
  Шрифт — Manrope Variable из `@fontsource-variable` (в Plus Jakarta Sans нет базовой кириллицы), локальные файлы.
  `assetsInlineLimit: 0`: prod-CSP не пускает `data:`. Тема — `data-theme` по `prefers-color-scheme` (выбор темы — в main, см. блок settings-ui в корневом `CLAUDE.md`).
  Библиотеку muzakit целиком не подключаем, пока она не публикуется пакетом. Нужные компоненты — копиями в
  `apps/desktop/src/renderer/src/shared/ui/` (шапка «copied from muzakit», отличия — `shared/ui/README.md`), без `vue-router`
  внутри копий (exception approved by the user: `navigation-sidebar` keeps its `router-link`), `@vueuse`, `@iconify/vue`. Иконки — `unplugin-icons` (`autoInstall: false`) из локального `@iconify-json/lucide`,
  явный реестр `ui/components/base/icons.ts`, канонические имена Lucide (не алиасы).
  Таблицу трат и формат сумм пишем свои (`VTable` и `formatCurrency` из muzakit не подходят).
- **Элементы интерфейса — сначала `shared/ui`.** Нужен контрол (кнопка, поле, переключатель, чекбокс, список, подсказка,
  карточка…) — сначала искать его в `shared/ui` (`index.ts`, `README.md`). Нет — скопировать из muzakit по
  `ui-component-migration.md` отдельным шагом, потом использовать. Голый `<input type="checkbox">`, `<select>` и т. п. на
  экране — только если в muzakit такого компонента нет; причина — в отчёте. Настройка, которая применяется сразу, —
  `VSwitch`; вариант в форме, применяемый по кнопке, — `VCheckbox`.
- **Архитектура renderer — FSD** (`apps/desktop/src/renderer/src`), проверяет `apps/desktop/tests/architecture.test.ts`
  (правила — `tests/helpers/architecture.ts`, у каждого правила есть «ломающий» пример):
  - слои `app → pages → widgets → features → entities → shared`, импорт только вниз; слайсы одного слоя друг друга не
    импортируют (кроме сегментов `shared`: `api`, `config`, `layout`, `lib`, `ui`); внутри слайса — относительные импорты;
  - снаружи слайс доступен только через `index.ts` (`@/features/x`, без глубоких путей); `index.ts` только реэкспортирует;
  - алиасы: `@/` → `src/renderer/src`, `@contract/` → `src/shared` (типы и константы, общие с main и preload);
  - пакеты в renderer — только белый список (`vue`, `vue-router`, `pinia`, `@mono/core/shared/currency`,
    `@mono/core/providers/info` — its closure is pinned to `providers/types.ts`, the registry and each bank's `info.ts` /
    `constants.ts` by `coreInfoViolations` —, `~icons/lucide/*`, шрифт);
    `electron`, `node:*` и новая зависимость — ошибка теста;
  - `window.balance` читает только `shared/api/balance.ts`; `balanceApi` вызывают только сегменты `api/` слайсов
    (`api/use<X>Request.ts`, возвращают объект функций) и подписки в `app/listeners.ts`;
  - сегменты слайса: `<Name>Feature.vue` (корень фичи), `api/`, `composables/` (логика, явный `Use<X>Return` в `types.ts`),
    `components/` (только отображение; у сущности компонент может читать и менять свой стор — так `ParticipantFilter`), `store/` (Pinia setup-store, только тут), `types.ts`, `constants.ts`, `utils.ts`
    (чистые функции); страницы — тонкие оболочки над фичами и виджетами;
  - общее состояние — Pinia в `entities`: `participant` (люди, подключения, статусы токенов, выбор «Вся семья / человек» —
    `selectedId`, запоминается в `localStorage` только для удобства), `sync-status` (статус данных и `version`, на который
    перезагружаются данные), `import-progress`; реакции между сущностями — в `app/listeners.ts` (люди обновляются на
    `needs-token`, в начале окон импорта и в его конце);
  - **домен `features/settings`** — один слайс со всем, что пользователь делает с приложением и своими данными на этом
    компьютере: подфичи `app-lock`, `app-update`, `auto-sync`, `db-encryption`, `db-recovery`, `delete-data`,
    `security-info`, `theme-switch`, `language-select`
    (у каждой свои сегменты) и `shared/` для общего между ними (`isChecked`, `restoreSwitch` для `VSwitch`;
    `api/useDeleteAllDataRequest.ts` — «Удалить все данные» из настроек и с экрана «База недоступна»). Раскладка раздела
    (`Settings{Section,List,Row}`; also the side menu `SideNav` of settings and home) — сегмент `shared/layout`: ей пользуются и домен `integrations`, и виджет `settings`
    («О программе»). Наружу — только `features/settings/index.ts`: карточки настроек (их собирает виджет `settings`) и то,
    что живёт вне экрана настроек (экран блокировки, подсказка и баннер обновления на главной, экран «База недоступна»).
    Подфичи не импортируют друг друга и корень домена (`index.ts` и корневые файлы), `shared/` — ни одну подфичу и ни один
    корневой файл (`DOMAIN_SLICES` в `tests/helpers/architecture.ts`). Новая настройка — новая подфича здесь;
  - **домен `features/integrations`** — подключение банков и строки подключений, папка на банк: `monobank/`
    (`MonobankConnectFeature.vue` — форма добавления по токену: `<form>`, поле токена, согласие, кнопка;
    `components/MonobankTokenField.vue` — шаги и поле токена;
    `composables/useMonobankConnect.ts` — `addConnection` с `provider: 'monobank'`, тексты банка в `constants.ts`: `CONSENT_TEXT`,
    `TOKEN_STEPS`, `TOKEN_PLACEHOLDER`, `ACCESS_NOTE`) и
    `shared/` для общего между банками (`components/ConnectionRow.vue`, `components/BankPicker.vue` — выбор банка на первом
    экране; `composables/useConnectionActions.ts` — удалить, «Ввести токен заново», «Счета»;
    `composables/useConnectionOwner.ts` — чьё подключение и цвет нового человека; `api/useConnectionsRequest.ts`; `TOKEN_ERROR_TEXT`;
    `participantChoice`, `removeText`, `accountLabel`; контракты форм банка `ConnectFormProps` / `TokenFieldProps` в `types.ts`). `people/` — имя и цвет человека (`PersonBlock`, `usePeopleActions`). Корень домена: `PeopleConnectionsFeature.vue` (раздел
    «People and banks»: люди, под каждым — его подключения по банкам, `connectionsByBank`; «Add connection» у человека
    передаёт `forPerson` в `AddConnectionFeature`, «Add person» — `'new'`), `ConnectFirstFeature.vue` (первый экран), `AddConnectionFeature.vue` (чьё подключение и цвет нового человека — в слот
    формы банка; `provider` обязателен) и `constants.ts` — `PROVIDER_FORMS`, a `Partial` map of the banks that need their
    own forms (`provider → { connect, tokenField, accessNote, fileSteps? }`; `Component<ConnectFormProps>` /
    `Component<TokenFieldProps>`: vue-tsc checks that the bank's component takes those props; props at `<component :is>`
    are not checked). Every token bank has an entry (a test checks it); a bank with statement files only may have none and
    gets the generic file flow (`statement-file/`: `GENERIC_FILE_STEPS`, `FILE_ACCESS_NOTE`). `utils.ts` — `formsOf`
    (null for a bank without its own forms or an unknown provider — never another bank's), `fileStepsOf` (the bank's own
    steps, else the generic ones; null when the registry gives the bank no files), `accessNoteOf`. «Add connection» shows
    `BankPicker` while the registry has more than one bank, then the add form for the picked one (with «Other bank» to go
    back); with one bank it opens that bank's form. The add form offers «Token» only when the bank has its own forms.
    Only the root imports the bank folders; a connection row gets its bank's token field as a prop. The root files carry
    no bank's texts: the name comes from `entities/bank` (`bankOf`), the first screen's line from `accessNoteOf`. Наружу —
    `PeopleConnectionsFeature` (виджет `settings`) и `ConnectFirstFeature` (`pages/connect`). Те же правила домена, что у
    `settings`. A new bank needs nothing here unless it has a token or its own steps: then its folder and a
    `PROVIDER_FORMS` entry;
  - **«Счета» подключения** (`ConnectionRow`): кнопка «Счета · N» («Счета · X из N», если часть выключена;
    `accountsButtonText`, `aria-expanded`) раскрывает панель, как у токена (открыта
    одна из двух); список грузится при каждом открытии (`useConnectionActions.accounts`: `loading | ready | error`, старый
    список остаётся на время перезагрузки). Строка счёта — `SettingsRow` + `VSwitch`: подпись `accountLabel` (карта: тип
    банка · валюта · •• 1234; банка: «title» · валюта), у выключенного — «Не загружается и не входит в статистику». Во время
    импорта переключатели `disabled` с подсказкой. Переключение не оптимистичное: строка меняется после ответа, отказ
    (`import-running`) или ошибка — в `error` раздела, ползунок возвращается (`accountSwitchChange`). Пока один счёт
    сохраняется, остальные не `disabled` (фокус клавиатуры не теряется): `aria-disabled`, щелчок сразу откатывается.
    Ошибка загрузки списка — `console.error('[accounts] list failed', e)` (только ошибка, без данных). Строка
    подключения (`coverageLine`): «Счетов: X из N», все выключены — «Все счета выключены». После — `participant.refresh()` и
    `syncStatus.refresh()` (push из main нет): главная перезагружается тихо. Все счета выключены (`accountsOff` в
    `participant` по `ConnectionView.enabledAccounts`) → `hasData` ложно, но подключения есть: главная (не экран
    подключения) с плашкой «Все счета выключены…» и кнопкой в «People and banks» (`widgets/home-notices`);
  - данные из main — `useAsyncData` (`shared/lib`): `Loadable<T>`, прошлое значение остаётся на время загрузки и после ошибки.
  - **The read cache** (`shared/lib/readCache.ts`, `ReadCache`, the one `readCache`): the answers of the eight data reads
    (`CACHED_READS` in `shared/api/methods.ts`: the month, spending, now, category, income, recurring, allowance and
    analytics overviews), keyed by `readKey(method, args)`, at most `READ_CACHE_SIZE` (50, least recently used dropped
    first), memory only (the lock's reload leaves nothing; bank text in the lines never reaches storage). Fresh = no data
    change since its request started and younger than `READ_FRESH_MS` (60 s). `shared/api/balance.ts` wraps the bridge
    once (`wrapBridge`): a cached read keeps its answer under the generation read at its start (one that raced a write
    lands stale), a failure keeps nothing; `PASS_THROUGH` methods pass as they are; every other method is a write and
    makes all kept answers stale once it succeeds (a new write method needs no entry). The sync-status store's
    `refresh()` (an imported window, the end of an import, after writes and «Delete all data») calls `invalidateReads()`
    before it bumps `version`. A data feature's `api/` segment has a `peek<X>` next to its fetch, and its composable
    builds one `query()` for both and passes `cached: () => peek(query())` to `useAsyncData`: fresh → shown without a
    request, stale → shown at once and replaced by a quiet load, none → as before; `reload()` always asks. Tests:
    `tests/renderer/read-cache.test.ts`, the store's part in `sync-status.test.ts`.
- **Interface texts** — every text on a screen goes through vue-i18n, no literals:
  - templates: `$t('key')`, `$t('key', { name })`, plurals `$t('key', n)`; script code (`utils.ts`, composables,
    stores): `t` from `@/shared/lib`, called when the text is needed — never at module load (a constant built with `t`
    does not follow a language switch). Tables of texts in `constants.ts` hold keys (`MessageKey` from
    `@contract/i18n/index.ts`), the component translates them;
  - keys are nested by layer and slice, `<layer>.<slice>.<what>` (`settings.lock.title`, `home.balances.income`),
    shared words in `common.*`; `uk.json` is the reference, `en.json` and `ru.json` get the same key in the same change
    (`tests/i18n.test.ts`);
  - Ukrainian and Russian texts address the user informally (ти / ты), as the screens always have; English is plain;
  - numbers, dates and money keep their own formatters (`formatMoney`, `monthName`, `shortDate`) and are passed in as placeholders;
  - bank names, the app name and the language names in the language select are not translated.
- Навигация — `vue-router` с memory history (адрес страницы всегда `app://renderer/index.html`), маршруты в
  `app/router/routes.ts` (`meta.layout` / `meta.nav` — лаяут и пункт бокового меню, см. «Layouts» в корневом `CLAUDE.md`),
  имена — `ROUTE` в `shared/config`. Guard (`app/router/guards.ts` + `startRoute.ts`): экран подключения — только если нет ни
  одного подключения и нет данных; подключение без токена → главный с плашкой «Ввести токен»; настройки доступны всегда.
  Banks — `entities/bank`, display only, from the core registry (`@mono/core/providers/info`): `BANKS` is the
  registry's list in its order; a bank is `{ id, name, ways, monogram, monogramClass }` — the brand name, not translated;
  `ways` from its access (`token` first, then `file`); its look from `entities/bank/looks/<id>.ts` (`export const look`,
  found by `import.meta.glob`), else the neutral mark (its first letter on a muted square). `bankOf(id)` — a bank the
  registry does not know (a database from a newer version) gets a neutral entry with its id as the name and no ways,
  never another bank's look. The bank picker adds the disabled «Other banks» tile (`OTHER_BANKS`, not a bank). Card
  types: `cardTypesOf` / `defaultCardTypeOf` from the registry; names `entities.bank.cardType.<provider>.<type>`
  (`cardTypeName(provider, type)`; a type the bank does not list → «Card»; a test checks every listed type has a name).
  `AccountName` carries the provider, so `accountName` names any bank's cards; the balance card's bottom line takes the
  bank's name from `bankOf`. The history download is one import for every token connection: its list is headed by the
  token banks' names. Как подключать — в `features/integrations`.
- Statement files (`features/integrations/statement-file`): the add form shows «Token» / «Statement file» when the bank
  has both (`FileConnectForm`: no token, no «Use the name from the bank» — a file has no holder's name). A connection
  row gets «Upload statement» (a file connection) or «Check against a statement» (a token connection with accounts:
  compare only) when the registry gives the bank statement files (`fileStepsOf`); the panel (`StatementUploadFeature`)
  comes into the row's `statement` slot from the domain root, since `shared/` must not import a sub-feature.
  `useStatementUpload(connection)`: main opens the file (the renderer never gets its path or content); the panel shows
  one `section` per account of the file (`statementLabel`: the bank's card type name if it lists the type, else «Card»,
  currency, last digits; the summary; the account select, a card taken by another row is not offered; the new card's
  type, `newCardType` — the file's if the bank lists it, else the bank's `defaultCardType`; no type select for a bank
  that lists no types; its comparison lines). The first comparison sends null targets (the file's own
  match), then `initialTargets` offers the matched card, else `defaultTarget` among the free cards, and compares again
  only if that differs; every change of a target or a type compares the whole file again. One «Add» writes every
  account (`canWrite`: none blocked, something new) and refreshes people and the data status. Problem texts name no
  file format. Home with file connections only points to «Upload
  statement» instead of the import.
- Экран настроек — меню и разделы, см. блок settings-ui в корневом `CLAUDE.md`. Раздел «People and banks» —
  `features/integrations` (имя и «Переименовать», «Взять имя из банка», цвет человека; подключения со статусом токена, «Ввести токен заново», «Удалить», «Добавить подключение» — существующий
  человек или новый с именем / «Взять имя из банка», текст о согласии владельца токена); первый экран —
  `ConnectFirstFeature` той же формой с человеком «Я»; на главном — фильтр людей `ParticipantFilter` из `entities/participant` («Вся семья / имена», только если людей больше одного;
  у имени точка цвета человека, у «Вся семья» — точки всех: `filterOptions`, `SegmentOption.colors` в `VSegmentedControl`),
  траты и балансы берут `participantId`; импорт показывает, какие подключения не загрузились.
  Цвета людей (у подключений цвета нет): оттенки `--series-<key>` в `theme.css` (обе темы), выбор — `ColorSwatches` из
  `entities/participant` (radiogroup, занятые видны, но недоступны; своего компонента в muzakit нет), в форме добавления
  по умолчанию — первый свободный; «Изменить цвет» в «People and banks» применяется сразу; «Взять имя из банка»
  в «Переименовать».
  Логотип — необязательный локальный файл `entities/bank/assets/<id>.svg|png|webp`, иначе монограмма (`looks/<id>.ts`, else neutral).
  «Настройки…» `CmdOrCtrl+,` в меню → `balance:open-settings` (main → renderer, без данных) → `onOpenSettings` в preload.
