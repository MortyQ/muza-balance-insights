# Design

## Context

See proposal.md — Why. Today `app/layouts/DefaultLayout.vue` renders `GlobalFilters` and a grid of `SideNav` (from
`shared/layout`, items built by `useNav` from route `meta.nav`) plus the screen, both inside
`max-w-[calc(13rem+3rem+52rem)]`. `SideNav` is also the settings screen's section menu (`NAV_GROUPS`, groups,
«Soon» items, a strip below 45rem, arrow keys via `nextItem`). The title bar (`widgets/app-header`) sits above every
layout and stays as it is.

Follows: `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", i18n, `ui-component-migration.md` for
copies), `.agents/instructions/vue-syntax.instructions.md`, `typescript.instructions.md`. Updates:
`desktop-renderer.md` (copies may keep `vue-router` where the user approved it — this sidebar) and the root
`CLAUDE.md` settings-ui block («Side menu», «Layouts»). Not security-relevant: no network, IPC, storage of data or
tokens; the only persisted value is the fold state, a per-computer convenience in `localStorage`.

## Goals / Non-Goals

**Goals:** one sidebar component taken from muzakit with minimal divergence; the shell owns all width logic; home
blocks untouched.

**Non-Goals:** nested menu entries or the collapsed flyout; a new title bar; restyling blocks; replacing the settings
section menu.

## Decisions

**FSD placement.**
- `shared/ui/components/navigation-sidebar/` — the copy (`NavigationSidebar`, `NavigationSidebarMobile`, `createSidebar`,
  `components/` header, nav, nav item, footer, mobile parts, `composables/` state, navigation, item link, injection
  keys, `utils/buildMenuTree`, `types/`), styles under `shared/ui/styles/components/navigation-sidebar/`, exported from
  `shared/ui/index.ts`. Generic: it knows nothing of our routes or texts.
- `app/layouts/` — `DefaultLayout` builds the shell; `utils.ts` gains `navItems(routes, translate)` →
  `SidebarNavItem[]` (from the same `meta.nav` that `navGroups` reads; pure, tested); `composables/useAppSidebar.ts`
  creates the instance (`createSidebar`) with the fold key and the width steps; the screen title comes from the current
  entry (`meta.navParent ?? route.name`).
- `widgets/global-filters` is unchanged inside; the layout places it in the header row after the title.

**Copy, adapted.** Alternatives: keep and restyle `SideNav` (no fold, no tooltips, no drawer — we would rebuild what
muzakit has); add `@muzakit/ui` as a package (not published; the CI build has no `~/Desktop/muzakit`). Verdict: copy.
Divergences, each recorded in `shared/ui/README.md`:
- `router-link` stays (user approved); entries are routes, so active state comes from the router.
- `@vueuse/core` removed: `SidebarMenuFlyout*` dropped (we have no nested entries; a folded parent would be a plain
  icon), `useEventListener` in the mobile drawer → `addEventListener` / `removeEventListener` in `onMounted` /
  `onBeforeUnmount`.
- `position: fixed; height: 100dvh` → a normal flex column of the layout (the title bar sits above it); `--sidebar-*`
  sizes kept.
- Breakpoints: muzakit switches to the drawer below 1024px. Ours: drawer below 45rem (the breakpoint the app already
  uses), forced icons from 45rem to 64rem — a `forcedCollapsed` computed in `useAppSidebar` from a `matchMedia`
  listener, combined with the user's choice; the stored choice is never overwritten by the forced state.
- `VIcon` names go through our `icons.ts` registry (`panel-left-open`, `panel-left-close`, `menu`, `x` added if
  missing); literal English `aria-label`s («Expand sidebar», «Main navigation») become props filled from the
  dictionaries by the layout.
- Brand block in the sidebar header hidden: the title bar already shows the app name and logo on every OS.
- Arrow keys: muzakit's nav has none; we add them in the copy's `SidebarNav` (up/down/left/right, moving focus and
  opening the entry, as `SideNav` does), reusing the same rule as `nextItem` over a flat list.

**Fold persistence.** `createSidebar`'s own `localStorage` persistence with key `app.sidebar`, read in try/catch
(falls back to unfolded). Alternative: `preferences.json` through IPC — heavier, and the fold state is a per-viewer
convenience like `spending.view`. Verdict: `localStorage`.

**Header.** A row in `DefaultLayout` above the scroll area: on narrow widths the menu button, then `<h1>` with the
current entry's label, then `GlobalFilters` taking the rest. Alternative: move the title into `GlobalFilters` —
mixes a routing concern into a filters widget. Verdict: the layout owns the title.

**Width.** The scroll area's inner container: `mx-auto w-full max-w-[100rem]` with the existing side padding. The
balance block's container queries react to the wider block on their own; no change in `features/balances`.

## Risks / Trade-offs

- [The copy drifts from muzakit] → every divergence listed in `shared/ui/README.md`; the file header carries the copy
  date.
- [Arrow keys inside a router-link list conflict with Tab order] → roving focus only within the nav; tested in
  `tests/renderer/layouts.test.ts`.
- [macOS traffic lights or the Windows overlay buttons overlap the sidebar] → the sidebar starts below the title bar,
  which already reserves those areas; checked live (backlog).
- [Wide blocks look sparse at 100rem] → accepted for now; the redesign revisits block internals.

## Migration Plan

No data migration. Rollback = revert the commits; the stored `app.sidebar` key is harmless if left behind.
