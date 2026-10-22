# Tasks

## 1. feat(desktop): navigation sidebar copied from muzakit

- [x] 1.1 Copy `muzakit/libs/ui/src/components/navigation-sidebar` (without `SidebarMenuFlyout*`) and its styles into `shared/ui` per `ui-component-migration.md`: `copied from muzakit` headers, `<style lang="scss" scoped>` + `@use`, `--ui-*` tokens only; `@vueuse/core` replaced by `addEventListener`; fixed positioning → a flex column; drawer below 45rem; check our `VTooltip` takes the same props. Verify: `pnpm --filter @mono/desktop typecheck` passes and `tests/architecture.test.ts` passes (no new package)
- [x] 1.2 Add missing icons to `icons.ts`, make the copy's literal `aria-label`s props, hide the brand block, add arrow-key roving between entries in the copy's nav. Verify: a renderer test mounts the sidebar with three entries and checks `aria-current`, the tooltip name when folded, and that ArrowDown moves focus and emits the navigation
- [x] 1.3 Export it from `shared/ui/index.ts` and add its row to `shared/ui/README.md` listing every divergence. Verify: README row present; tests from 1.2 green

## 2. feat(desktop): adaptive app shell

- [x] 2.1 `app/layouts/utils.ts`: `navItems(routes, translate)` → sidebar entries from `meta.nav` (order, icon, label); `useAppSidebar` with key `app.sidebar`, forced icons from 45rem to 64rem via `matchMedia`, unreadable storage → unfolded. Verify: unit tests for `navItems` order and for the forced/stored fold combination
- [x] 2.2 `DefaultLayout`: sidebar (footer «Settings» entry), header row (menu button below 45rem, `<h1>` with the current entry's label, `GlobalFilters`), scroll area with `max-w-[100rem]`; `SideNav` no longer used there (settings keep it). Verify: `tests/renderer/layouts.test.ts` updated — current entry on home, category screen marks «General», title text, settings route has no sidebar
- [x] 2.3 New texts (sidebar label, fold / unfold, open / close menu) as keys in `uk.json`, `en.json`, `ru.json`. Verify: `tests/i18n.test.ts` passes
- [x] 2.4 Home blocks and their order untouched. Verify: `git diff` shows no change under `features/balances`, `features/now-strip`, `features/spending-summary`

## 3. docs(desktop): shell rules and changelog

- [ ] 3.1 Root `CLAUDE.md` settings-ui block: «Side menu» (app navigation is the copied sidebar, `SideNav` is the settings section menu) and «Layouts» (header, width cap, width steps); `.agents/project/desktop-renderer.md`: the `vue-router` exception for this copy. Verify: both files mention `navigation-sidebar` and the 45rem / 64rem steps
- [ ] 3.2 `CHANGELOG.md`, `0.1.10 — unreleased`: one plain-English entry about the menu at the window's edge, folding to icons, and screens using the whole window. Verify: `tests/release-notes.test.ts` passes
- [ ] 3.3 `docs/backlog.md`: live checks — traffic lights and Windows overlay buttons against the sidebar, drawer on a narrow window, fold state after relaunch. Verify: items listed

## 4. Verification

- [ ] 4.1 Run `pnpm test` and `pnpm typecheck` at the root. Verify: both pass
