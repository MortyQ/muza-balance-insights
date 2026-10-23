# Proposal

## Why

The default layout keeps the menu, the filters and every data screen in one 68rem column centred in the window, so a
wide window shows a third of empty space on the sides while the blocks stay narrow. The app needs an adaptive shell
that fills the window and shrinks gracefully, before the post-MVP redesign, without rebuilding the screens.

## What Changes

- The app navigation (General, Analytics, Regular payments, Planning) becomes a sidebar pinned to the window's left
  edge, under the title bar, for the whole height of the layout. It is a copy of muzakit's `NavigationSidebar` placed
  in `shared/ui`, with `router-link` kept inside the copy (approved by the user) and without `@vueuse/core`.
- The sidebar collapses to icons with a toggle; the choice is remembered on this computer. Collapsed items show their
  name in a tooltip.
- The shell adapts to the window width: full sidebar on a wide window, icons only on a medium one, and on a narrow
  window the sidebar is hidden behind a menu button and opens as a drawer.
- Arrow keys keep moving between menu items, as the current side menu allows.
- The global filters (month or period, currency, people, the sync status) move into a header row above the content,
  after the current screen's title. The header stays put while the content scrolls.
- The content fills the width next to the sidebar, up to a cap (100rem), instead of the fixed 68rem column.
- The sidebar's footer holds «Settings».
- Home keeps its blocks and their order: the balances (card stack and month panel), the «Now» strip under them at full
  width, then «Spending». The blocks themselves are not changed.
- The settings screen keeps its own section menu (`SideNav`); it is not replaced.

Out of scope: any change inside the home blocks or the other screens; the patterns sketched for later (command palette,
hiding amounts, KPI tiles, limits); the title bar (`AppHeader`); the settings screen's layout; a new colour scheme.

Packages: `apps/desktop` only (renderer). No trust anchor changes. User-visible: yes — `CHANGELOG.md`, `0.1.10 —
unreleased`, a «Home screen» (or new «Navigation») entry: the menu sits at the window's edge, folds to icons, and the
screens use the whole window.

## Capabilities

### New Capabilities
- `desktop-app-shell`: the frame around the data screens — the app navigation sidebar (collapse, width steps, drawer,
  keyboard), the header with the screen title and the global filters, and how wide the content may grow.

### Modified Capabilities
<!-- none: desktop-balance-cards keeps its requirements; its container queries follow the wider content by themselves -->

## Impact

- Renderer: `shared/ui` (new `navigation-sidebar` copy, its `.scss`, icons registry, README row, exports),
  `app/layouts` (`DefaultLayout`, nav items from route `meta.nav`), `widgets/global-filters` (placed in the new header),
  i18n keys in `uk.json` / `en.json` / `ru.json`.
- `shared/layout/SideNav` stays for the settings screen only.
- Docs: root `CLAUDE.md` (the «Side menu» and «Layouts» items of the settings-ui block),
  `.agents/project/desktop-renderer.md` (the rule that muzakit copies carry no `vue-router`), `shared/ui/README.md`.
- No new dependency: `@vueuse/core` is not added.
