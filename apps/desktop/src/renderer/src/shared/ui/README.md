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
| `VCheckbox` | `ref<HTMLInputElement \| null>(null)` → `useTemplateRef` (vue-syntax.instructions.md Rule 4) |
| `VSwitch` | none |
| `VInput` | `useDebounceFn` from `@vueuse/core` → local `debounce()` in `components/inputs/debounce.ts` (not exported from `index.ts`); the `debounce` prop is destructured as `debounceProp` to avoid shadowing the imported helper; `ref<HTMLInputElement \| HTMLTextAreaElement \| null>(null)` → `useTemplateRef` |
| `VCollapse` | none |
| `VComposer` | `useClipboard` from `@vueuse/core` → `navigator.clipboard.writeText` in a local `copy()`, with its own `copied` ref/timeout; rejection is swallowed (no UI feedback) — see the note below about Electron's `denyAllPermissions` |

## Ours, not copied

`table/VSimpleTable` — a plain data table (columns as data, `cell-<key>` slots, an optional total row), written in the same
BEM + SCSS + `--ui-*` token style. Not muzakit's `VTable` (virtualised, TanStack), which this app does not need.

`icons.ts` is ours, not copied. To add an icon, import `~icons/lucide/<name>` there and add a `"lucide:<name>"` key.
`tests/ui.test.ts` checks that every icon name used in `.vue` files is in the registry, and that nothing here
imports `vue-router`, `@vueuse/*` or `@iconify/vue`.

## `VComposer`'s copy button and Electron

`copyable` calls `navigator.clipboard.writeText` directly (see the table above). Not verified against
`denyAllPermissions` (`apps/desktop/src/main/hardening.ts`), which answers every `session.setPermissionRequestHandler`
check with `false`: Chromium's Async Clipboard API gates a *write* behind the `clipboard-write` permission only in
some contexts (cross-origin iframe, no user gesture, page not focused) — a same-origin write from a click handler,
which is the only way `VComposer` calls it, commonly succeeds without a permission check at all. Whether Electron's
handler is consulted for this path has not been tested in this app; if it is, the write silently fails (the `catch`
swallows the rejection and shows no feedback) rather than showing a broken "Copied" state.
