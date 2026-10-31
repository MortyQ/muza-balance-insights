# Tasks

## 1. Core: storage and categories (core)

- [ ] 1.1 Migration v18: `manual_categories` and `category_overrides.field` (design 1, 2). Verify the migration tests.
- [ ] 1.2 New categories in `CATEGORY` / `OVERRIDE_CATEGORIES`; derivation order with manual picks and `field`
  rules (design 3). Verify `tests/derive` with fictional rows: a pick over an MCC, a pick over a rule, undo, a
  derived-only row ignoring a pick.

## 2. Core: commands and import survival (core)

- [ ] 2.1 `commands/categories.ts` (design 4), with the changed count. Verify with fictional rows.
- [ ] 2.2 Tests: the same statement imported twice, an overlapping statement, a full re-derivation — picks and rules
  stay, no duplicates.

## 3. Desktop: IPC, menu and picker (desktop)

- [ ] 3.1 IPC and `shared/api.ts`, read cache cleared after a change (design 6, 7).
- [ ] 3.2 `VMenu` in `shared/ui`; the row menu on `OperationRow` (right click and «⋮»), keyboard. Renderer tests.
- [ ] 3.3 The category picker with search and the payee switch; colours and icons of the new categories; keys in
  `uk.json`, `en.json`, `ru.json`, including the new «Подорожі й відпустки» names.
- [ ] 3.4 `CHANGELOG.md` entry under `0.1.13 — unreleased`.

## 4. Docs and checks

- [ ] 4.1 `.agents/project/domain-rules.md` (the order), `docs/backlog.md` (ids changing between exports).
- [ ] 4.2 `pnpm test` and `pnpm typecheck` at the root (by the user where the sandbox blocks pnpm).
