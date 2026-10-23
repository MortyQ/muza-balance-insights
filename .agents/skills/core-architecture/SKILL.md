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
   `providers/rules.ts`, `providers/statements.ts`, `providers/info.ts` or `providers/ids.ts` (`core-providers.md`).
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

## 5. Add a bank

A new bank is a contained task: its own folders, one line in each registry, its fixtures. No domain module, import
step or screen outside the bank's own files changes for it (`core-providers.md`; the change `provider-modules`). Use
fictional data only; look at a real statement file only as a masked layout (digits → 9, letters → a/A).

Core (`packages/core`):

1. Add its id to `PROVIDER_IDS` in `src/providers/types.ts`.
2. Create `src/providers/<id>/`:
   - `info.ts`: `<id>Info` (`ProviderInfo`): the brand name; `access` (`token: { credential, api } | null`, `file`);
     `ids: 'prefixed'` (only Monobank is `'bare'`); `cardTypes`, `defaultCardType`. It imports only `../types.ts` and
     its own `constants.ts`.
   - `rules.ts`: `<id>Rules` (`ProviderRules`), pure. Rows may have no MCC (`mcc: null`) and a bank category
     (`bankCategory`): `categoryHint` maps it to one of `CATEGORY_HINTS`. New masking templates in `maskDescription`
     change what reaches the analysis copy: only after the user's ok (root `CLAUDE.md`).
   - `statement.ts` (a bank with files): `readers: StatementReader[]`, pure, one per kind of file, reading the
     `StatementDocument` (`text`, `sheets` or `pdf`), never bytes.
   - `client.ts` (a bank with an API): network, pages, 429, through `src/providers/ratelimit.ts`.
3. Add one line to each registry: `PROVIDERS` in `src/providers/info.ts`, `PROVIDER_RULES` in `src/providers/rules.ts`,
   and (with files) `STATEMENT_READERS` in `src/providers/statements.ts`.
4. Add fixtures for the conformance suite: `tests/providers/<id>/fixtures/conformance/<name>.document.json` (the
   document as the desktop decodes it) and `<name>.expected.json` (`{ reader, result }`). At least one per reader; add
   the bank's refusals (another language, an unsupported kind) as fixtures too. Reader details go to
   `tests/providers/<id>/statement.test.ts`, rule details to `tests/providers/<id>/rules.test.ts`.

Desktop (`apps/desktop`):

5. A bank with an API: `src/integrations/<id>/desktop.ts` (its trusted service) and `worker.ts` (its client and error
   mapping), one line each in `src/net/providers.ts` and `src/worker/providers.ts`. A new host in `TRUSTED_SERVICES`
   (`src/net/allowlist.ts`) is its own step with `tests/allowlist.test.ts`.
6. Renderer, all optional except the card type names:
   - card type names `entities.bank.cardType.<id>.<type>` in `uk.json`, `en.json` and `ru.json`, one per `cardTypes`
     entry;
   - its look: `src/renderer/src/entities/bank/looks/<id>.ts` (`export const look`) and/or a logo
     `entities/bank/assets/<id>.svg|png|webp`; without them the bank gets the neutral mark;
   - a bank with a token, or its own file steps: `features/integrations/<id>/` and an entry in `PROVIDER_FORMS`. A bank
     with files only and no entry gets the generic file flow.
7. A user-visible bank is a `CHANGELOG.md` entry.

The checks that must pass, unedited (they run for every id in `PROVIDER_IDS`):

- `packages/core/tests/providers/conformance.test.ts`: info, ids, rules on rows with and without an MCC or a bank
  category, readers on their fixtures (twice the same, picked by the document alone, other banks' files left alone);
- `packages/core/tests/providers-boundary.test.ts`, `purity.test.ts`, `layers.test.ts`;
- `apps/desktop/tests/providers.test.ts`, `architecture.test.ts` (the registry's import closure), `i18n.test.ts`,
  `renderer/integrations.test.ts` (card type names, forms of token banks), `renderer/registry-banks.test.ts`.

## 6. Before handing over

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
