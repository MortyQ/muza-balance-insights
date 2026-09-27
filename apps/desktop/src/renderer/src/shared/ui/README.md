# ui — components copied from muzakit

Source: `muzakit/libs/ui/src`, same directory layout, so relative imports stay the same. Every copied file
starts with a `copied from muzakit` header carrying the date it was copied — components were added over
more than one day, so headers do not all share the same date. Copies, not a package dependency: the public
CI build has no `~/Desktop/muzakit`, and `@muzakit/*` resolve each other through `workspace:*`.
Replace these copies with imports once muzakit is published as a package.

| Component | Changes against muzakit |
|---|---|
| `VButton` | `vue-router` removed (`to` / `replace` props, `RouterLink`): always a `<button>` |
| `VIcon` | `@iconify/vue` → `icons.ts`, a static registry of unplugin-icons components (build-time, no network) |
| `VSegmentedControl` | `useResizeObserver` from `@vueuse/core` → native `ResizeObserver`; `SegmentOption.colors` — colour dots before the label (`.v-sc__dots` / `.v-sc__dot` in its `.scss`), for the people filter |
| `styles/tokens.css` | `font-family: var(--font-sans)` (Manrope) instead of Plus Jakarta Sans (no basic Cyrillic) |
| `VTooltip` | one `!` on `placements[0]` for our `noUncheckedIndexedAccess` (the array is a fixed literal) |
| `VButtonGroup`, `VCard`, `VInfoNotice`, `VLoader`, `VProgressBar`, their `.scss` | none |
| `VCheckbox` | `ref<HTMLInputElement \| null>(null)` → `useTemplateRef` (vue-syntax.instructions.md Rule 4) |
| `VSwitch`, `vswitch.scss` | `vswitch.scss`: focus ring on the track for `:focus-visible` (the real input is clipped) |
| `VInput` | `useDebounceFn` from `@vueuse/core` → local `debounce()` in `components/inputs/debounce.ts` (not exported from `index.ts`); the `debounce` prop is destructured as `debounceProp` to avoid shadowing the imported helper; `ref<HTMLInputElement \| HTMLTextAreaElement \| null>(null)` → `useTemplateRef`; added `defineExpose({ focus })` so a parent can call `.focus()` on a template ref to the component (muzakit's `VInput` doesn't expose this — no screen there needed to refocus it programmatically); `vinput.scss`: a disabled field drops its resting shadow, as a disabled `VButton` does |
| `VCollapse` | none |
| `VComposer` | `useClipboard` from `@vueuse/core` → a local `copy()`: `navigator.clipboard.writeText`, falling back to an off-screen `<textarea>` + `execCommand('copy')` (vueuse's own pre-`execCommand`-removal fallback) when the Clipboard API is unavailable or rejects; its own `copied` ref/timeout, cleared in `onScopeDispose` — see the note below about Electron's `denyAllPermissions` |

## Ours, not copied

`VSelect` and `VDatepicker` are built fresh on [reka-ui](https://reka-ui.com) primitives, not copied from muzakit:
muzakit's `VSelect` wraps `vue-multiselect` (`<style src="vue-multiselect/dist/vue-multiselect.css">`) and its
`VDatepicker` wraps `@vuepic/vue-datepicker` — both inject a stylesheet at runtime, which the prod CSP
(`default-src 'self'`, no `style-src 'unsafe-inline'`) blocks. reka-ui is headless (no injected styles; verified
against `node_modules/reka-ui/dist` — see the header comments of both components) and ships keyboard nav, focus
management and positioning we then style ourselves in BEM + `--ui-*` tokens, same as every other copy here.

- `VSelect` keeps muzakit's `options` / `placeholder` / `disabled` / `label` props and v-model, for a single,
  non-searchable select only — multiple selection, search/tagging and the floating label are dropped (reka-ui's
  `SelectPortal` + `SelectContent[position=popper]` replace muzakit's manual fixed-position teleport).
- `VDatepicker` keeps a single-date v-model and adds a named `range` v-model (`{ start, end }`), both as ISO
  `YYYY-MM-DD` strings — the public value type never touches `@internationalized/date`; `components/inputs/calendarDate.ts`
  holds the pure ISO ⇄ `CalendarDate` conversions (tested in `apps/desktop/tests/renderer/calendarDate.test.ts`).
  Locale is fixed to `uk-UA`, week starts Monday. No consumer yet.
- `VMonthPicker` — a month/year picker on reka-ui's `MonthPicker` in a `Popover` (muzakit has no month picker at all).
  `v-model` is a `"YYYY-MM"` string, `min` / `max` (also `"YYYY-MM"`) bound the selectable range; month names are our
  own (Russian UI), not the locale's. `components/inputs/calendarMonth.ts` holds the pure `"YYYY-MM"` ⇄ `CalendarDate`
  conversions (tested in `apps/desktop/tests/renderer/calendarMonth.test.ts`). Consumer: the balances block.

All three pass `as-child` to their reka-ui `*Content` and put the panel's class on a `<div>` of their own template:
reka-ui's `PopperContent` (`inheritAttrs: false`) puts `class` on an inner element that is not its root, so that element
never gets the component's scope attribute and a scoped rule on it matches nothing (the panel was see-through).
`tests/ui.test.ts` checks it. `VDatepicker`'s closed field uses the same box, type, hover, focus (also while open) and
disabled styles as `VSelect`'s trigger.

Shadows follow `VButton` (`vbutton.scss`): `VSelect`'s trigger, `VDatepicker`'s field, `VMonthPicker`'s pill and
`VInput` rest on `--ui-shadow-xs` and drop it when disabled, with the same 120 ms transitions (off under
`prefers-reduced-motion`). The focus/open border of `VSelect` and `VDatepicker` is 1px + a 1px inset ring rather than a
2px border, so the value does not shift; `VMonthPicker` takes `VButton`'s outline focus ring. The three popover panels
share one elevation: `--ui-surface-overlay`, a 1px `--ui-border`, `--ui-radius-lg`, `--ui-shadow-lg`. `tests/ui.test.ts`
checks both.

`table/VSimpleTable` — a plain data table (columns as data, `cell-<key>` slots, an optional total row), written in the same
BEM + SCSS + `--ui-*` token style. Not muzakit's `VTable` (virtualised, TanStack), which this app does not need.

`icons.ts` is ours, not copied. To add an icon, import `~icons/lucide/<name>` there and add a `"lucide:<name>"` key.
`tests/ui.test.ts` checks that every icon name used in `.vue` files is in the registry, and that nothing here
imports `vue-router`, `@vueuse/*` or `@iconify/vue`.

`components/inputs/debounce.ts` is ours, not copied — see the `VInput` row above.

## `VComposer`'s copy button and Electron

`copyable` first tries `navigator.clipboard.writeText` (see the table above). Electron's `denyAllPermissions`
(`apps/desktop/src/main/hardening.ts`) answers every `session.setPermissionRequestHandler` check with `false`,
which very likely makes the Async Clipboard API reject even from a same-origin click handler — not verified
against a running app. `copy()` falls back to `document.execCommand('copy')` on a temporary, off-screen
`<textarea>` for that case (and for any browser without `navigator.clipboard` at all); "Copied" is only shown
once one of the two has actually succeeded.
