# Tasks

## 1. Budget: past months' chart, bar levels, the bar past the limit

- [x] 1.1 Spec delta `specs/desktop-limits-goals/spec.md` (bar levels; the bar past the limit), strict validation
- [x] 1.2 `PastBars.vue`: bars render; a test that fails before the fix
- [x] 1.3 `--warning-strong` in `theme.css` (both themes); `strong` look, `STRONG_PACE`, `STRONG_FORECAST` and the rule
      in `entities/goal`; unit tests at the thresholds
- [x] 1.4 `LimitBar` past the limit: solid, hatched, the limit's tick, the scaled pace marker; `limitLook` figures;
      tests; every user of `LimitBar` passes the new figures
- [x] 1.5 `.agents/project/desktop-renderer.md`, `CHANGELOG.md`, `docs/backlog.md` (look in both themes)

## 2. Spending: seven categories on home, back to the list

- [x] 2.1 Spec deltas `specs/desktop-home-tiles/spec.md` and `specs/desktop-spending-categories/spec.md`, strict validation
- [x] 2.2 `CategoryList` without the fold; unused keys and `SHOWN_ROWS` removed; tests
- [x] 2.3 Origin in `categoryLink` / `categoryRequest`; `BackLink` `to`; the category screen's back link and label
      (three dictionaries); tests
- [x] 2.4 `.agents/project/desktop-renderer.md`, `CHANGELOG.md`

## 3. Insights: a clearer «What's unusual»

- [x] 3.1 Spec delta `specs/desktop-insights-page/spec.md`, strict validation
- [x] 3.2 `FeedRow` and `FeedDetails`: one list, one row shape, details on demand, high rows opened
- [x] 3.3 The chart's caption and legend; texts in three dictionaries
- [x] 3.4 Filters: severity toggles and the «Kind» select; the remembered filter unchanged
- [x] 3.5 «How it was counted» folded
- [x] 3.6 Renderer tests rewritten for the rows: keyboard, `aria-expanded`, filters, links, the legend
- [x] 3.7 `.agents/project/desktop-renderer.md`, `CHANGELOG.md`, `docs/backlog.md`

## 4. Checks

- [ ] 4.1 `pnpm test` and `pnpm typecheck` at the root
