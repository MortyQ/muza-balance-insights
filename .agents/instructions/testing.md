# Testing `@muzakit/ui`

Two Vitest projects, one config (`libs/ui/vitest.config.ts`). Tests live in
`libs/ui/tests/`, outside `src/` — `src/` is both the dts build input and the
Tailwind `@source` scan root, and test files have no business in either.

| | `unit` | `browser` |
|---|---|---|
| Environment | jsdom | real Chromium via Playwright |
| Renderer | `@vue/test-utils` | `vitest-browser-vue` |
| CSS | not applied | Tailwind + SCSS, compiled |
| Covers | props, emits, models, slots, ARIA, keyboard | tokens, geometry, both themes |

## Commands

```bash
pnpm --filter @muzakit/ui test:unit            # jsdom, ~10s
pnpm --filter @muzakit/ui test:tokens          # token contracts (the whole browser project)
pnpm --filter @muzakit/ui test:visual          # same, every browser spec
pnpm --filter @muzakit/ui test:coverage        # unit + thresholds
pnpm --filter @muzakit/ui test:visual:docker   # the browser project in CI's image
```

A `pre-push` hook runs the unit project, and the token contracts when a Chromium
is installed.

## What CI gates on

`ci.yml` gates on build, both type-checks, lint, unit + coverage, and the token
contracts. A contract compares a component against the value the browser
computed for its `--ui-*` token; it has no baseline to go stale, so a red one is
a real defect.

**There is no pixel regression.** The screenshot suite and its baselines were
deleted when the component chrome was redrawn: every baseline predated the new
button, so the whole set was a record of a design that no longer exists. If it
comes back, write it against the settled visuals, keep only a Linux set, and
make it report rather than gate until its baselines are trusted.

## The three layers

**Convention guard** (`tests/conventions.spec.ts`) turns
`ui-component-migration.md` into assertions: one scoped style block per
component holding nothing but its `@import`, a paired stylesheet at the
conventional path, no Tailwind utilities in templates, no raw colours or
`@apply`/`theme()` in SCSS, `color-mix` always in oklch. It walks
`base`, `feedback`, `inputs`, `layout` and `overlay` only — `table/` owns a
partial set under `assets/styles/` instead of a stylesheet per component, so the
rule does not apply and its token bindings are covered by the browser layer
instead. `VIcon` is the only component exempt from the paired-stylesheet rule; an unscoped `<style>` is
allowed only where the element is teleported out of the component's subtree and
the block says `teleported:`.

**Unit** — behaviour, not appearance.

**Token contracts** (`tests/visual/tokens/`) resolve a `--ui-*` token through a
probe element and compare it against what the browser actually computed, in both
themes. This is what catches a component quietly drifting off its token, or a
dark-theme override that never lands. No baselines, so nothing to maintain.

What a token check cannot see — spacing, shadows, alignment — is currently
checked by eye, in both themes, on `/` and `/components-demo`.

The image tag in `ci.yml` and `scripts/visual-docker.sh` must match the
`playwright` version in `pnpm-lock.yaml`; bump them together.

## Traps worth knowing

1. **Vite's transform cache can outlive an edit to `tokens.css`** and serve the
   old colour, producing token-contract failures that have nothing to do with
   the change. If a contract reports a colour that is not in the file, clear
   `libs/ui/node_modules/.vite`.

2. **`browser.screenshotDirectory` is unusable.** It is resolved against the
   project root and then joined onto the spec's own directory, so any value
   builds an absolute-path-shaped tree inside `tests/`. `screenshotFailures` is
   off instead — a contract's assertion message already carries the value.

3. **Transitions are stubbed globally** in `tests/setup/unit.ts`. jsdom never
   fires `transitionend`, so a leaving element would sit in the DOM forever: a
   closed modal still matching its selector, a removed row still counted.

4. **Comments at the root of a template make a component multi-root.**
   `wrapper.classes()` is then empty and `wrapper.element` is a fragment
   (`VThemeSwitcher`). Reach for the root by selector.

5. **Iconify renders an empty `<svg>`** until it has fetched the glyph, so an
   icon name is only visible on `VIcon`'s props, never in the markup. In the
   browser project the local collections are registered up front, so glyphs do
   render.

6. **Units.** `rawToken("--ui-radius")` gives `0.375rem`, `getComputedStyle`
   gives `6px`. For anything that is not a colour use `tokenAsValue()` from
   `tests/setup/tokens.ts`, which pushes both sides through the same probe.

7. **The unit project needs jsdom, never `node`** — even for pure functions.
   `@muzakit/utils` runs a module-scope `watch` on import that touches
   `document` and `localStorage`.

8. **Module-level singletons survive between tests**: the `useModal` registry,
   `useTheme`. Clear them in `beforeEach`.

9. **`matchMedia` answers false to everything** in the unit setup, which
   disables anything gated on `(hover: hover)`. Override it in the spec, or the
   test passes by never doing anything.

10. **The browser project kills every transition and animation** —
    `tests/setup/browser.ts` writes a global `transition: none !important` so
    screenshots are deterministic. A `transitionDuration` assertion there reads
    `0s` no matter what the stylesheet says. Assert the custom property the
    duration is derived from instead (`VCollapse`'s
    `--v-collapse-duration`), and the end state each half of the pair lands on.

11. **`useClipboard` needs two stubs and a tick**, none of them obvious.
    `navigator.clipboard` has to be defined on the *real* `window.navigator`
    with `Object.defineProperty` — @vueuse captures `defaultNavigator =
    window.navigator` at module-evaluation time, so `vi.stubGlobal("navigator",
    …)` arrives too late and `isSupported` stays false, which means the button
    never renders and every assertion passes vacuously. `navigator.permissions`
    is a second, separate gate: without a `query` resolving to a granted
    `PermissionStatus` (an `EventTarget` — a bare `{ state }` throws on
    `addEventListener`), `copy()` falls through to `document.execCommand`, which
    jsdom does not implement. And the permission resolves asynchronously, so a
    click in the mount tick still takes the fallback — let a macrotask pass
    first. See `tests/unit/layout/VScrollPanel.spec.ts`.

12. **A `defineAsyncComponent` never resolves on its own** under Vitest's module
    runner. No number of `flushPromises` or macrotask ticks settles the loader's
    dynamic import; the spec has to `import()` the same module itself first, and
    then one `flushPromises` is enough. Until it does, the component stays a
    comment node — which reads exactly like a render condition being false, so
    the assertion fails for a reason that has nothing to do with the component.
    `NavigationSidebar.spec.ts` warms the chunk in its `render()` helper.

## The navigation sidebar

`navigation-sidebar/` is four logic units and thirteen components, all of them
reached through one provide.

**Helpers.** `tests/setup/sidebar.ts`. `makeNavItems()` is the tree every spec
works against — two roots, one three levels deep, one leaf addressed by name,
one branch that is itself navigable. `NAV_ROUTES` are the routes that tree
resolves against.

`withRouter(fn, route)` runs a composable inside a component that has a router
installed: three of the four units call `useRoute()`, which resolves through
`inject`, so `withScope()` is not enough — an `effectScope` carries reactivity
but no injection context and `useRoute()` inside one returns undefined.

`makeSidebarState()` builds what `<NavigationSidebar>` provides, with the
navigation half under the test's control: collapse/expand/mobile is the real
`buildSidebarState` over a real `createSidebar`, while `isActive` /
`isOnActivePath` are driven by an `activePath` ref. Route matching has its own
spec; driving thirteen components by pushing routes would re-test it thirteen
times and make all of them fail together when it breaks. `mountInSidebar()`
mounts with that provide plus a router.

**Traps:**

13. **Every component here except `SidebarMenuFlyoutParent` and
    `SidebarMobileFooter` calls `useSidebarState()`**, which throws outside the
    tree. There is no bare mount to fall back on — which is the point: a spec
    that forgets the provide fails loudly instead of testing a stub.

14. **`findComponent` crosses into a row's own children.** `SidebarNavItem`
    recurses, so a branch's subtree contains its children's `RouterLink`s — a
    tree-wide query finds one whether or not the row under test is a link.
    Assert on `wrapper.find(".sidebar-item").element.tagName` instead.

15. **The flyout's position is never asserted in the unit project.** It is
    computed from `getBoundingClientRect`, which jsdom answers with zeroes. Its
    open/close delays are real timers, so those specs run on fake ones.

16. **Escape closing the mobile drawer cannot be asserted through state.**
    `closeMobile()` on an already-closed drawer is a no-op, so the guard and its
    absence produce identical state. Stub `state.closeMobile` before mounting —
    the component destructures it in setup — and assert on the call.

## The table

`table/` is roughly half the library by volume and is covered along the same
four layers, with two extra helpers and a handful of traps of its own.

**Helpers.** `tests/setup/table.ts` holds every fixture — `makeColumns`,
`makeRows`, `makeTreeRows`, `makeGroupedColumns`, `makeFixedColumns`,
`makeTotalRow`. Unit specs and screenshots share them on purpose, so a failure
in one can be read against the other. `tests/setup/scope.ts` gives `withScope()`,
which runs a composable inside an `effectScope` instead of mounting a host: most
of the table's logic never touches the DOM, and `onScopeDispose` cleanup (the
`useLinkedTables` registry) needs the scope stopped afterwards.

**Where each thing is tested.** Composables and utils in isolation
(`tests/unit/table/composables`, `.../utils`), the 21 subcomponents in isolation
(`tests/unit/table/components`), and `VTable` itself only at the wiring seams —
one or two tests per prop → composable → subcomponent path, never the
cross-product. Layout-dependent behaviour is in the browser project.

**Traps:**

17. **Any unit test of `VTable` must pass `virtualized: false`.** `rowsToRender`
    returns nothing until the scroll container reports a size, and jsdom reports
    zero for everything — so a virtualized table renders no rows at all, and the
    virtualizer re-measures itself into "Maximum recursive updates exceeded"
    while trying. Neither is a defect; both are the absence of layout.

18. **In the browser project, render the table in place.** Moving the wrapper
    into a sized host after mount invalidates the rect TanStack Virtual measured
    on its first frame, and the window silently collapses to zero rows.

19. **The table's subcomponents are only styled when `VTable` is imported.** Its
    unscoped `<style>` is what pulls the partial set in, so a screenshot of
    `TablePagination` on its own is a baseline of an unstyled component — which
    looks plausible until someone compares it with the app.

20. **`keyv-browser` has to be inlined** (`server.deps.inline` on the unit
    project). Its ESM build imports `./keyv-idb` with no extension, which Node's
    resolver rejects, so the storage module cannot be imported at all otherwise.
    `fake-indexeddb/auto` in the unit setup then makes the default IndexedDB
    branch testable rather than skipped.

21. **More module-level singletons**: the `useLinkedTables` registry, and
    `tableStorage`, whose `setStorageType` mutates global state. Reset both in
    `beforeEach` or the order of files starts to matter.

22. **With both highlight axes on, the header's column pins come first** in DOM
    order. An unscoped `.v-table-pin-button[0]` selects a column, not a row.

23. **Several table styles are gradients**, so their colour is in
    `background-image` and `backgroundColor` reads as transparent — the header,
    the total row, and the active pagination button. A few values are literals
    rather than tokens (the wrapper's `1rem` radius); those are pinned as
    literals with a comment, not silently "fixed" in the test.

## Adding a component

Unit spec under `tests/unit/{category}/`, token contracts under
`tests/visual/tokens/{category}/`.

Then check the test can fail. A token contract that passes against a hardcoded
colour is not testing anything.
