# Tasks

## 1. Specs baseline — docs(openspec): sync and archive desktop-app-shell and desktop-month-pace

- [x] 1.1 Sync the specs of `desktop-app-shell` and `desktop-month-pace` into `openspec/specs/` and archive both changes
- [x] 1.2 `pnpm openspec validate desktop-home-tiles` passes against the synced specs

## 2. Layout — feat(desktop): data screens on the window's background

- [ ] 2.1 `DefaultLayout`: drop the panel wrapper; header row on `bg-background`, hairline while the scroll area is scrolled (composable in `app/layouts/composables`)
- [ ] 2.2 `tests/renderer/layouts.test.ts`: no panel, the header's hairline follows the scroll
- [ ] 2.3 `CLAUDE.md` («Layouts») and `CHANGELOG.md` («Navigation»: replace the panel line)

## 3. Home grid and balances tiles — feat(desktop): home as tiles, the balances block split

- [ ] 3.1 `HomePage`: the grid with named areas and the three container-query steps of design §2
- [ ] 3.2 `BalancesFeature`: `contents` root; «Balance», «Month pace», «Month» as three `VCard` tiles; remove the absolute positioning and the width constants it no longer needs
- [ ] 3.3 The free / reserved line with the split bar under the stack, for the card in front; dictionary keys in uk/en/ru
- [ ] 3.4 Open row: «Balance» spans the row, the other two `v-show` + `inert`; the chart refits on return
- [ ] 3.5 `tests/renderer/balances-block.test.ts` and a home grid test: areas, open/fold, the free line

## 4. Today and week — feat(desktop): the «Now» strip as tiles with period details

- [ ] 4.1 «Today» and «This week» tiles: amount, chip, at most 3 categories with icon and bar, the button (with the hidden count and total on «This week»), the empty-day line; drop the «top category» cell
- [ ] 4.2 The details tile: «Today / This week» switch, total, all categories in two columns, close; state in the now strip's store
- [ ] 4.3 `HomePage` passes `insights-hidden` from the now strip's state to `SpendingFeature`
- [ ] 4.4 Dictionary keys in uk/en/ru; now-strip tests for the 3-row limit, the button text and the details switch

## 5. Spending — feat(desktop): spending, people and unusual as tiles

- [ ] 5.1 `SpendingFeature`: `contents` root; «Spending by category» tile with the summary column and the restyled category rows (4 rows, the rest unfolds in place)
- [ ] 5.2 «Who spent what» tile from the block's people list (family view only), picking as before
- [ ] 5.3 «What's unusual» tile from the block's insight lines, hidden while the period details are open
- [ ] 5.4 `RecurringTeaserFeature` as a tile in the `recurring` area
- [ ] 5.5 Spending tests updated: rows limit, people tile shown only for a family, insights out of the block

## 6. Docs and checks — docs(desktop): home tiles rules and live checks

- [ ] 6.1 `.agents/project/desktop-renderer.md`: the home grid, the `contents` roots, the open-row rule
- [ ] 6.2 `CHANGELOG.md` «Home screen»: home as tiles, «What's unusual» moved, today/week details
- [ ] 6.3 `docs/backlog.md`: live checks (column steps, chart refit, scroll hairline, both themes, many people)
- [ ] 6.4 `pnpm test` and `pnpm typecheck` at the root
