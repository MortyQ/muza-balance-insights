# Tasks

## 1. All categories screen

- [ ] 1.1 `rowsFor`: an `all` option — every category its own row, no `rest` row; unit tests (15 categories → 15 rows,
      amounts add up to the total, colours of the eighth and later)
- [ ] 1.2 `ROUTE.spendingCategories`, `spendingCategoriesLink()` in `shared/config`, the route `/spending/categories`
      (`meta.navParent: ROUTE.home`) and the thin page `pages/spending-categories`
- [ ] 1.3 `SpendingCategoriesFeature.vue` in `features/spending-summary`: back link, heading, month and total, the
      scope switch, the notices, the full list; exported from the slice
- [ ] 1.4 Home's `rest` row links to the screen (`useCategoryRows`)
- [ ] 1.5 Texts in `uk.json`, `en.json` and `ru.json`: the heading, the back link, the empty month
- [ ] 1.6 Renderer tests: the screen lists every category and follows month, person and scope; a row opens its
      category; home's «N more categories» row opens the screen; the route keeps «General» current
- [ ] 1.7 `.agents/project/desktop-renderer.md` (route, component) and `CHANGELOG.md` under 0.1.16
- [ ] 1.8 `docs/backlog.md`: check on a live system — a long month's list, both themes, a narrow window
- [ ] 1.9 `pnpm test` and `pnpm typecheck` at the root
