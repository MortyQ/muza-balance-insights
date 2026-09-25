# ui — components copied from muzakit

Source: `muzakit/libs/ui/src`, copied 2026-09-25, with the same directory layout, so relative imports stay the same.
Every copied file starts with a `copied from muzakit` header. Copies, not a package dependency: the public
CI build has no `~/Desktop/muzakit`, and `@muzakit/*` resolve each other through `workspace:*`.
Replace these copies with imports once muzakit is published as a package.

| Component | Changes against muzakit |
|---|---|
| `VButton` | `vue-router` removed (`to` / `replace` props, `RouterLink`): always a `<button>` |
| `VIcon` | `@iconify/vue` → `icons.ts`, a static registry of unplugin-icons components (build-time, no network) |
| `VSegmentedControl` | `useResizeObserver` from `@vueuse/core` → native `ResizeObserver` |
| `styles/tokens.css` | `font-family: var(--font-sans)` (Manrope) instead of Plus Jakarta Sans (no basic Cyrillic) |
| `VTooltip` | one `!` on `placements[0]` for our `noUncheckedIndexedAccess` (the array is a fixed literal) |
| `VButtonGroup`, `VCard`, `VInfoNotice`, `VLoader`, `VProgressBar`, their `.scss` | none |

## Ours, not copied

`table/VSimpleTable` — a plain data table (columns as data, `cell-<key>` slots, an optional total row), written in the same
BEM + SCSS + `--ui-*` token style. Not muzakit's `VTable` (virtualised, TanStack), which this app does not need.

`icons.ts` is ours, not copied. To add an icon, import `~icons/lucide/<name>` there and add a `"lucide:<name>"` key.
`tests/ui.test.ts` checks that every icon name used in `.vue` files is in the registry, and that nothing here
imports `vue-router`, `@vueuse/*` or `@iconify/vue`.
