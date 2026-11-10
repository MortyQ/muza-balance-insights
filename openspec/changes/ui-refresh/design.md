# Design

## Context

See proposal.md for the motivation. The renderer styles screens with Tailwind v4 on the tokens of
`app/styles/theme.css` (`.agents/project/desktop-renderer.md`, styles). `shared/ui` holds muzakit copies and a few
parts of our own (`VChangeChip`, `VShareBar`, `VCarousel`, …), all written in BEM + SCSS on `--ui-*` tokens. The
repeated hand-built marks live in `entities`, `features` and `widgets`. The rules this change applies are the stageshow
skill's craft and motion references (`.agents/skills/stageshow/references/craft.md`, `motion.md`); its React kit cannot
be imported (the renderer's package whitelist, `tests/helpers/architecture.ts`).

Follows: `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", interface texts) and `shared/ui/README.md`.
Updates both: the new parts get README rows (checked by `tests/ui.test.ts`), the renderer file gets a short «Shared
marks» rule (use the part, never a hand-built lookalike) next to "`shared/ui` first".

## Goals / Non-Goals

**Goals:**

- One part per repeated mark, so the look is decided in one file.
- Motion that follows its cause: figures roll on a change, loading keeps the content's outline, nothing pops.
- No change to texts, data, keys, `data-test` hooks or screen structure.

**Non-Goals:**

- Restyling the muzakit copies or converting them to Tailwind.
- A visual-regression test setup (screenshots): the agent cannot launch the app; the look is checked by the user.

## Decisions

### FSD placement

All new parts are `shared/ui` (layer `shared`, segment `ui`), exported from `shared/ui/index.ts`:

| Part | File | Replaces |
|---|---|---|
| `VIconDisc` | `components/base/VIconDisc.vue` | the `grid size-N place-items-center rounded-full …` discs in 17 files |
| `VBadge` | `components/feedback/VBadge.vue` | the pills of `LimitStateChip`, `InsightCard`, `SignalCard`, `ConnectionRow`, `StorageInfoFeature`, `CategoryKindRow`, `BankPicker`, `SummaryCard`, `HomeBudgetFeature`, `SmallChartsView` |
| `VStat` | `components/feedback/VStat.vue` | the headline figure blocks of `HomeBudgetFeature`, `BudgetPanel`, `NowStripFeature`, `RecurringSummary`, `AllowanceFeature`, `SummaryFigure` |
| `VCount` | `components/feedback/VCount.vue` | plain text figures (used inside `VStat` and directly) |
| `VSkeleton` | `components/feedback/VSkeleton.vue` | the hand-drawn bars of `DetailSkeleton`, `VLoader` in `CategoryKindsFeature` |
| `VEmptyState` | `components/feedback/VEmptyState.vue` | the muted «none» paragraphs |
| `VListRow` | `components/layout/VListRow.vue` | the row markup of `CategoryRow`, `RecurringRow`, `LimitRow`, `RecentOperationsList`, `HomeInsightsTile`, `TileCategories`, `CategoryKindRow`, `ChangesList` |

The block-title scale is two Tailwind `@utility` classes in `app/styles/main.css` (`text-title` — a block's title,
`text-subtitle` — a group inside a block), not a component: headings keep their own `h2` / `h3` level and element.
Block skeletons are composed per feature from `VSkeleton` in that feature's `components/` (`<Block>Skeleton.vue`),
because each outline mirrors its own block; `DetailSkeleton` stays in `entities/operations`, rebuilt on `VSkeleton`.

### Tailwind in the new parts, SCSS left where it is

The user asked for the Tailwind approach. New parts are single-file components with Tailwind classes on theme tokens
(`bg-surface-sunken`, `text-warning`, …) and no `<style>` block. Alternative: SCSS + `--ui-*` like the other own parts —
rejected: two styling systems for new code and a token wrapper per colour; the parts would also not share the
screens' utilities (`@container`, `motion-safe:`). The muzakit copies keep SCSS (out of scope). `tests/ui.test.ts`
gets the new files in its own-file list (no «copied from muzakit» header). `shared/ui` is already under Tailwind's
`@source`.

### `VIconDisc`

Props: `icon`, `size: 'sm' | 'md'` (24 / 32 px disc, 14 / 16 px icon; the four sizes today collapse to these two —
`sm` in tiles and compact lists, `md` in full rows), `tone: 'neutral' | 'tint' | 'solid'`, `color` (a CSS colour for
`tint` — 16 % `color-mix`, the current category look — and `solid` — white glyph or initial on the colour, the person
look). A `label` slot replaces the icon (a person's initial). `flex: none` so it never squeezes. Lucide stays the icon
set (project rule); stageshow's "filled at small sizes" is not taken, a Lucide fill would be a second family.

### `VBadge`

Props: `tone`, `dot` (a 6 px leading dot in `currentColor`), `size: 'sm' | 'md'` (h-5 / h-6), default slot for the text.
One geometry (`inline-flex items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap`). Tone
classes are a table in the component, with the dark variants built in — warning is
`bg-warning-muted text-warning-foreground dark:bg-warning-subtle dark:text-warning`, the pattern already proven in
`ConnectionRow`; the other tones follow the same muted / subtle pair. Screens pass a tone, never colour classes;
`STATE_LOOK.chip` in `entities/goal/constants.ts` becomes a tone.

### `VStat` and `VCount`

`VStat`: `label`, `value` (the formatted string), `size: 'md' | 'lg'` (`text-2xl` / `text-3xl`, both
`font-extrabold tabular-nums leading-tight`), slots `chip` and `hint` (for `VHelpHint`), `tone` for the danger figure
(`AllowanceFeature`'s short state). One weight replaces bold / extrabold; `tracking-tight` is dropped.

`VCount` takes the already formatted string (money is formatted by `useMoneyFormat`; the part never formats), aligns
old and new strings from the right, and for each changed digit stacks the old and new glyph in a column that moves by
`transform: translateY` (travel curve `cubic-bezier(0.45, 0, 0.1, 1)`, about 450 ms, last digit first, 30 ms apart).
Unchanged characters do not move; separators and the currency sign never roll. A change in length eases the wrapper's
width with the roll. At rest each column holds only the current glyph, so `textContent` equals the value (renderer
tests read texts). The first value renders with no motion; under `prefers-reduced-motion` (or without `matchMedia`, as
in jsdom) the value is swapped at once. The visible digits are `aria-hidden`, and the element carries the value as its
accessible text once, so screen readers read the number, not the columns.

Alternatives: a number tween (lerp every frame) — rejected: it blurs every digit and needs the raw number, which
screens do not have after formatting; CSS `@property` counters — rejected: no locale grouping, no currency.

### `VSkeleton`

`shape: 'line' | 'disc' | 'block'`, `width` (a CSS length or %), `size` (the text style it stands for — `xs | sm | base
| title | figure` — so the bar sits in the same line box and the real row's pitch is kept). Fill `bg-surface-sunken`,
`motion-safe:animate-pulse`. The wrapper of a block's skeleton has `role="status"` and `aria-label` `common.loading`
(existing key). Shown only when `state.status === 'loading'` and there is no view yet — a cached answer (the read
cache) renders at once, as today.

### `VEmptyState` and `VListRow`

`VEmptyState`: the text (prop), an optional action slot; `text-sm text-foreground-muted`. `VListRow`: `as` (string or
component, so a feature can pass `RouterLink`; `shared/ui` still never imports `vue-router`), `dense`, slots `leading`,
default (title), `subtitle`, `trailing`. Grid `auto minmax(0,1fr) auto`, gap 12 px, padding 12 px (8 px dense), title over
subtitle with a 2 px gap, a hover / focus fill inset and rounded (negative margins on the list, not the row) when the row
is interactive.

### Rows opening

Lists whose rows can appear while in view (recent transactions after an import, limits in attention) wrap new rows in
`VCollapse`; nothing else gains motion.

## Risks / Trade-offs

- [Visual regressions the tests cannot see] → each area is its own commit, so one can be reverted alone; the user
  checks each area in the app; what only a live run shows goes to `docs/backlog.md`.
- [Renderer tests that assert class names (`LimitStateChip`, the dark chip test)] → they move to asserting the tone
  (`data-tone`) instead of the classes; texts and `data-test` stay untouched.
- [`VCount` columns breaking text reads in tests] → at rest only the current glyph is in the DOM; jsdom has no
  `matchMedia`, so tests never see a roll; a unit test covers rolling with `matchMedia` stubbed.
- [Two styling systems in `shared/ui`] → accepted: Tailwind for new parts, SCSS for copies, written down in the README.
- [Unifying four disc sizes into two shifts some rows by a few pixels] → intended; rows keep their grid through
  `VListRow`.

## Migration Plan

Parts first (one commit), then one commit per screen area; each commit leaves the app working. Rollback is a revert of
the area's commit. No data or settings migrate.
