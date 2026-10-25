# Proposal

## Why

Home is a column of wide blocks inside one rounded panel. Each block carries its own inner columns, dividers and
collapses, so blocks sit inside blocks and the eye has no single unit to read. The agreed mockup
(`.design/home-tiles.html`) turns home into a grid of separate tiles on the window's background, the way modern
finance dashboards do, and keeps the card stack as the first thing on screen. All the data already exists; only the
arrangement and the look change.

## What Changes

- **No shared panel.** The default layout drops the rounded panel around the screen (added in `desktop-app-shell`).
  The sidebar, the header row and the content sit on one background; only tiles are set off. The header stays pinned
  and takes the background colour; a hairline under it shows only while the content is scrolled.
- **Top row: three tiles.**
  - «Balance»: the card stack; under it, the free amount (accented) and the reserved amount with a thin split bar, for
    the card in front. No total above the stack.
  - «Month pace»: the existing pace chart and its figures, moved out of the balances block into its own tile.
  - «Month»: the existing month panel (In, Out, the month's result, the comparison), as its own tile.
  - Opening the row widens «Balance» to the whole row; «Month pace» and «Month» are hidden (kept mounted, inert) and come
    back when the row folds.
- **Second row: three tiles from the «Now» strip and «What's unusual».**
  - «Today» and «This week»: amount, change chip, at most 3 categories each (icon, name, bar, amount); under them a
    button opens the details. All three tiles of the row have the same height.
  - «What's unusual»: the spending block's insight lines, moved here.
  - The details replace the row with one wide tile: a «Today / This week» switch, the period's total and every category
    in two columns; a close button brings the three tiles back.
  - The «Now» strip's «top category» cell goes away: each tile already leads with its biggest category.
- **Third row: «Spending by category» and a right column.**
  - «Spending by category» (two columns wide): on the left the ring with the total and per-day amount inside, the
    change chip, and two small stats (operations, last month); on the right the category rows in the «Today» style
    (icon, name with share and operations under it, change chip, amount, a bar with last month's mark and the people
    split when on). Four rows, the rest behind «N more categories» that unfolds in place.
  - Right column: «Who spent what» (the block's people list as its own tile; family view only) and the regular
    payments teaser under it.
- At narrow widths the tiles stack into one or two columns; the details of a period still open in place.
- The dark theme colours were already changed separately (commit `258c923`); this change uses the theme tokens only.

Out of scope: new data, IPC or core calculations; «Recent activity» and per-currency changes from the mockup (later,
they need data the renderer does not have); other data screens' content (they only lose the shared panel); the
settings, lock and connect screens; the light theme colours; the bank cards' own look.

**Open decision for review — the total card.** The summary card already shows the free amount and «Reserved». With the
new line under the stack this repeats while the summary card is in front. The tasks keep the summary card as it is
(the repeat stays) and leave trimming the card to its own change, since it touches the card's own requirement in
`desktop-balance-cards`. Say if the trim should come into this change instead.

Packages: `apps/desktop` renderer only. No trust anchor changes. User-visible: yes — `CHANGELOG.md`,
`0.1.10 — unreleased`, «Home screen»: home is now a grid of tiles; «Navigation»: the screen sits on the window's
background without a panel (replacing the panel line added earlier in 0.1.10).

## Capabilities

### New Capabilities
- `desktop-home-tiles`: how home is arranged as tiles, what each tile shows, how they behave when the card row opens
  and when a period's categories are opened, and how they reflow by width.

### Modified Capabilities
- `desktop-balance-cards`: «Stack and month panel never overlap» — the stack, the month panel and the pace panel are
  separate tiles now; opening the row hides the neighbouring tiles instead of folding panels inside the block.
- `desktop-app-shell`: «Home keeps its blocks and order» is replaced by the tile order; a new requirement says data
  screens sit on the window's background without a shared panel. This needs `desktop-app-shell` and
  `desktop-month-pace` synced into `openspec/specs/` and archived first (both are implemented and verified).

## Impact

- Renderer: `app/layouts/DefaultLayout.vue` (no panel, header background), `pages/home` (the tile grid),
  `features/balances` (the block split into tiles, the free line), `features/now-strip` (three tiles, the details tile),
  `features/spending-summary` (the new block look, people and insights out to their own tiles),
  `features/recurring-payments` (teaser as a tile), a tile primitive in `shared/ui` if `VCard` does not cover it,
  dictionary keys in `uk.json` / `en.json` / `ru.json`.
- Tests: `tests/renderer/layouts.test.ts`, `balances-block.test.ts`, the now-strip and spending tests, `pages.test.ts`.
- Docs: `CLAUDE.md` (settings-ui block: Layouts, home), `.agents/project/desktop-renderer.md`, `CHANGELOG.md`.
