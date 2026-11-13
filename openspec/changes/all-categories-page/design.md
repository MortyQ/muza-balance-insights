# Design

## Context

`features/spending-summary` builds home's rows in `utils/rows.ts` (`rowsFor`): the categories with spending, biggest
first, the first `TOP` (7) named and the others summed into one row with key `rest`. `CategoryList` shows 4 rows and
«Show N more». A row links to the category screen through `categoryLink`; the `rest` row has no link. The data is one
answer, `getSpendingOverview`, kept by the read cache, and it already carries every category.

Follows `.agents/project/desktop-renderer.md` (FSD, «`shared/ui` first», i18n, layouts and `meta.navParent`) and
updates it with the new route and component.

## Goals / Non-Goals

**Goals:**
- Every category with spending is visible by name, with home's figures, one click from home.
- No second source of numbers: the screen and home's block read the same answer and build rows with the same code.

**Non-Goals:**
- Changing home's block beyond the link on its «N more categories» row.
- New figures, sorting or filters; categories without spending in the month.

## Decisions

1. **A separate screen, home stays short** — the user's choice over expanding home's list in place. Home's block
   keeps its height; the long list gets a place where length is expected.

2. **Placement (FSD).**
   - `shared/config/spending.ts`: `spendingCategoriesLink()`, and `ROUTE.spendingCategories`.
   - `features/spending-summary`: a second root component `SpendingCategoriesFeature.vue`, exported from the slice's
     `index.ts`. It reuses `useSpending`, `useSpendingView`, the prefs store, `CategoryRow` and `SpendingNotices`.
     Verdict against a new slice: a new feature could not import these (features do not import each other), so it
     would copy the row building — a second source of numbers.
   - `pages/spending-categories`: a thin page that renders the feature.
   - Route `/spending/categories`, default layout, `meta.navParent: ROUTE.home`, the month filter as on home.

3. **All rows from the same builder.** `rowsFor` takes an option `all`: with it, no `rest` row is made and every
   category is its own row. Colours stay as now: the family's top seven keep `--category-N`, the others
   `--category-other`. The bars share one scale (the biggest category), as on home.
   Alternative — a separate `allRowsFor`: rejected, it would repeat the split, scale and change logic.

4. **What the screen shows.** A back link to home, the heading «All categories», the month and the total as the
   subtitle, the «Personal / Business» switch, home's notices (failed read, partial month, pending holds, left-out
   currencies), then the full list. No ring and no «Show more»: the list is the point. The view settings are home's
   own (`useSpendingPrefsStore`), read here and changed on home.

5. **Home's link.** The `rest` row gets `to: spendingCategoriesLink()` in `useCategoryRows`, so it renders as a
   `RouterLink` like the named rows. Its text stays «N more categories».

6. **Person pick.** Home's block has its own person pick (`usePick`), which is local and resets. The screen follows
   the global person filter only; a pick made inside home's block is not carried over.

## Risks / Trade-offs

- An extra click to reach the small categories, against a longer home — accepted with decision 1.
- The eighth and later categories share one muted colour, so with «Show on bars» by people or banks the split keeps
  its own colours and nothing is lost; with «Together» their bars look alike, told apart by icon and name.
- A person's pick inside home's block is lost on the way to the screen (decision 6); the global filter covers it.
