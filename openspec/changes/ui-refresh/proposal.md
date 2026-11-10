# Proposal

## Why

The renderer's screens grew block by block, and the same marks are drawn by hand in many slightly different ways: an
icon in a round disc in four sizes and two tints (17 files), status pills in three geometries (10 files, each solving
the dark theme on its own, which is how the limit chip became unreadable), headline figures in three sizes and two
weights, block titles in five type styles. Figures jump when the month, person or currency changes, and most data
blocks show nothing while their first answer loads. The stageshow skill (`.agents/skills/stageshow`) gives a tested
set of craft and motion rules for product UI; this change applies them to our own components, in Tailwind on the
existing theme tokens.

## What Changes

- New parts in `shared/ui`, written in Tailwind utility classes on `app/styles/theme.css` tokens:
  - `VIconDisc`: an icon in a round disc, two sizes, a neutral, colour-tinted or solid (person) fill.
  - `VBadge`: a status or label pill, one geometry, tones `neutral | primary | success | warning | danger | info`,
    an optional dot; readable in both themes by construction.
  - `VStat`: a label, a headline figure and an optional change chip; two sizes.
  - `VCount`: a figure whose changed digits roll when the value changes in view.
  - `VSkeleton`: placeholder lines at the geometry of the content they stand for.
  - `VEmptyState`: one line and an optional action for a block with nothing to show.
  - `VListRow`: one row grid (leading mark, title over subtitle, trailing value) with one padding scale and an inset,
    rounded hover fill.
  - A type scale for block titles (block title, sub-title) used by every data block.
- Screens moved onto these parts, one area per commit: home (balances, «Now», «Spending», the highlights tile, budget,
  notices), analytics and insights, limits and goals, regular payments, daily allowance, category and income screens,
  settings sections and «People and banks». `DetailSkeleton` is rebuilt on `VSkeleton`.
- Motion: headline figures roll to their new value when the period, person, bank or currency changes; data blocks show
  skeletons at their own geometry on the first load instead of an empty space; rows that appear open their space
  (`VCollapse`). All of it stands still under `prefers-reduced-motion`.
- Every text, dictionary key and `data-test` hook stays as it is; no screen gains or loses information.

Out of scope:

- The muzakit copies in `shared/ui` (`VButton`, `VCard`, `VSwitch`, the sidebar, …) keep their SCSS and look.
- The stageshow React kit is not used in the app (renderer packages are a whitelist); only its rules are applied.
- New screens, new data, layout changes of the home grid, the leftover bugs in `docs/backlog.md` (the «Large one-off»
  chip, the «Lines» chart, the balance card layout, the period picker redesign).
- Charts (`VChart`, ECharts options) other than their surrounding titles and figures.

## Capabilities

### New Capabilities

- `desktop-ui-system`: how the renderer draws its shared marks (icon discs, status pills, headline figures, block
  titles, list rows, empty blocks) and how values and loading are shown (rolling figures, skeletons, reduced motion).

### Modified Capabilities

None: the screens' own specs describe what they show, not how it is drawn, and none of that changes.

## Impact

- Affected: `apps/desktop` renderer only (`src/renderer/src/shared/ui`, `entities`, `features`, `widgets`), its tests
  under `apps/desktop/tests/renderer` and `apps/desktop/tests/ui.test.ts`; docs `shared/ui/README.md` and
  `.agents/project/desktop-renderer.md`. No change to `packages/*`, `apps/mcp`, main, preload or IPC.
- No new dependency. No trust anchor changes.
- User-visible: yes. `CHANGELOG.md`, `## 0.1.15 — unreleased`, a «### Look» entry: a calmer, more consistent look
  across the screens; figures roll to their new value when the filters change; blocks show their outline while the
  data loads.
