# Proposal

## Why

The home grid leaves holes. «What's unusual» is drawn only when it has lines, and early in a month it never has any
(nothing is over a whole usual month yet), so the «Today» / «This week» row ends with an empty third. Right of
«Spending by category», with neither «Who spent what» nor the regular payments teaser, three columns stay empty too.
The plan of 29.10 («Головна без порожніх місць», Notion) fills the first hole with «Recent operations». On 01.11 the
user replaced the header switch of that plan with a carousel, like the account cards: the two contents are slides of
one tile, swiped or dragged. On the same day the user decided to take «Who spent what» and the regular payments teaser
off home for now (their place is decided later), so «Spending by category» always takes the whole row.

## What Changes

- **One tile, two slides.** The third place of the «Today» / «This week» row is a carousel with «What's unusual»
  and «Recent operations». Swipe, Shift + wheel, a mouse drag and dots under the tile move between them; it snaps to
  whole slides. «What's unusual» is first when it has lines; otherwise the tile opens on «Recent operations». With
  only one of them having content there is one slide, no dots and nothing to swipe. With neither, the tile says the
  month has no operations yet, so the place is never empty.
- **«Recent operations».** The newest six operations of the shown month that «Spending» counts — spending and
  refunds — for the same person, banks and «Personal / Business» choice as the rest of home. A row shows the
  category's icon, the bank's description, the amount and the day and time; it opens the operation's category screen.
  A pending bank operation is marked as on the category screen.
- **Nothing beside «Spending by category».** «Who spent what» and the regular payments teaser leave home; the spending
  tile takes the whole width. Picking a person inside the spending block goes with «Who spent what» (the global filter
  still picks a person). The components stay in their slices for a later place; «Regular payments» stays in the menu.
- **«Now» details** still take the place of the whole row, the carousel included.
- **New: descriptions on home (approved by the user on 01.11).** The bank's descriptions of operations today leave
  main only for the category, income and regular payments screens (`shared/api.ts`). «Recent operations» shows them on
  home. Nothing leaves the computer; the comment in `api.ts` and `desktop-renderer.md` name the new place.
- **`CHANGELOG.md`**, under `0.1.13 — unreleased`: the «What's unusual» / «Recent operations» tile; «Who spent what» and
  the regular payments teaser no longer on home.

## Capabilities

### New Capabilities
- `desktop-home-highlights`: the carousel tile, its slides, their order and the empty state.
- `desktop-recent-operations`: what «Recent operations» lists and how a row behaves.

### Modified Capabilities
- `desktop-home-tiles`: the tile order loses «Who spent what» and the teaser; «What's unusual tile» becomes the
  carousel tile; «Who spent what tile» is removed.

## Impact

- `packages/core`: `read/category-lines.ts` gains `latestLines` (the same spending lines, every category, newest
  first, a limit); tests in `tests/read`.
- `apps/desktop`: an IPC read `getRecentOperations` (main, data process, `shared/api.ts`, `ipc-args`, the read cache);
  renderer: `shared/ui` `VCarousel`, `useDragScroll` moved to `shared/lib`, a new feature `features/recent-operations`,
  the insights tile out of `SpendingFeature` into its own exported feature, a widget `widgets/home-highlights`, the
  people tile and the teaser off home; i18n `uk.json`, `en.json`, `ru.json`.
- `apps/mcp`: untouched.
- Trust anchors: none change.
- User-visible: yes; the `CHANGELOG.md` entry above.

## Out of scope

- A new place for «Who spent what» and the regular payments teaser.
- A remembered slide choice (the order rule decides each time).
- Income in «Recent operations», a search or a «show all» list.
- Any other tile in a carousel, and the «Dashboard with chosen widgets» (P3).
- Insights work beyond what `core-insight-detectors` did.
