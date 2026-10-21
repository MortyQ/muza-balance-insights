---
name: core-architecture
description: Keeps the layered folder layout of packages/core. Use before adding, moving, renaming or splitting a module in packages/core/src, adding a core test, a migration, a derived value, a statistic or an import step, or when an import between core folders does not fit.
---

# Core architecture

The rules are in `.agents/project/core-layout.md`; read it first. This skill is the procedure that applies them. The
guard is `packages/core/tests/layers.test.ts`: when it fails, fix the placement, never the test.

## Auto-Activation Triggers

- A new file in `packages/core/src` or `packages/core/tests`.
- A new exported function, type or constant in `packages/core/src`.
- Moving, renaming or splitting a core module, or a module past about 400 lines.
- A new migration, a new derived column, a new statistic for a screen or an MCP tool, a new import step or bank.
- An import from one core folder into another that is the same height or higher.
- `layers.test.ts`, `providers-boundary.test.ts` or the writer guard in `tests/derive/derived.test.ts` fails.

## 1. Place new code

1. Name the job in one line. Find the layer with «Where new code goes» in `core-layout.md`.
2. List what the code imports. Every import must come from the same folder or a lower one. If something needs a higher
   layer, the code belongs higher: a write that must re-derive goes to `commands/` (or `ingest/`), not `people/`.
3. Pick the module. Add to an existing module only if it is the same job and stays under about 400 lines. Otherwise
   create a new module named after the job (`commit.ts`, not `utils.ts`). No `index.ts`, no barrels.
4. Bank-specific code goes to `providers/<id>/` and reaches the domain only through `providers/types.ts`,
   `providers/rules.ts` or `providers/statements.ts` (`core-providers.md`).
5. Put the test in `packages/core/tests/<layer>/`, named after the module or the behaviour.

## 2. Add a migration

1. Create `storage/migrations/vNN.ts` (the next number) exporting `vNN: Migration`, with a comment that says why.
2. Append `vNN` to the list in `storage/migrations.ts`. Never edit an applied migration.
3. A new table or column that holds personal data stays out of the analysis copy unless the user agrees
   (root `CLAUDE.md`).

## 3. Split a module

1. Choose the parts by job, inside the same folder. Shared helpers go to the lowest part that uses them and are
   exported from there.
2. Move the code as is: the moved lines stay identical; only imports and the file comment of each new part change.
3. Point every importer at the part that now exports each symbol (core, `apps/mcp`, `apps/desktop`, tests, bench).
   Use `import type { … }` when every name is a type.
4. Check that nothing was lost: compare the code lines of the old file with the new parts, apart from imports and file
   comments.
5. Commit the split alone, without behaviour changes.

## 4. Move or rename a module

1. Use `git mv` so history follows.
2. Rewrite every path to it: relative imports, `@mono/core/<folder>/<module>`, `vi.mock` and `importOriginal` paths,
   `new URL(…, import.meta.url)` fixture paths, and the moved test's own `../src/` paths.
3. Update the tests that list files by path in the same commit: the writer guard (`tests/derive/derived.test.ts`),
   `tests/providers-boundary.test.ts`, and the renderer allowlist (`apps/desktop/tests/helpers/architecture.ts`).
4. Update doc paths: `CLAUDE.md`, `.agents/project/*.md`, `openspec/specs/`. Leave history alone
   (`docs/superpowers/`, `openspec/changes/archive/`).
5. If the module is named in `apps/mcp/tests/recategorize-safety.test.ts` (a trust anchor), make a separate commit
   right after the move that changes only those paths, and report it as its own item. Never remove or widen an
   assertion there.

## 5. Before handing over

Run `pnpm test` and `pnpm typecheck` at the root. Where root `pnpm` cannot run (the agent's sandbox), run each
package from its folder and ask the user to run the root commands:

```
packages/core:  node_modules/.bin/tsc -p tsconfig.json && node_modules/.bin/tsc -p tsconfig.test.json && node_modules/.bin/vitest run
apps/mcp:       node_modules/.bin/tsc -p tsconfig.json && node_modules/.bin/vitest run
apps/desktop:   node_modules/.bin/tsc -p tsconfig.node.json && node_modules/.bin/vue-tsc -p tsconfig.web.json && node_modules/.bin/vitest run
```

After a change on a read or import path, also run the bench (`node --import tsx bench/run.ts` in `packages/core`)
and compare it with the budgets in `bench/budgets.ts`.

Checklist:

- [ ] Every new module is in a layer folder, named after its job; no `index` / `utils` / `helpers` / `misc`.
- [ ] Imports only go down; `ingest` and `commands` do not import each other.
- [ ] Tests sit in `tests/<layer>/`.
- [ ] Moves and splits changed no code and are their own commits.
- [ ] Paths in docs, path-listing tests and (separately) the trust anchor follow.
- [ ] A new rule about the layout goes into `core-layout.md` and, if it can be checked, into `layers.test.ts` with a
      breaking example.
