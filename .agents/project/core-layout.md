# Core: folder layout

Area: `packages/core`. The layout was set on 2026-10-21 (branch `refactor/core-layout`). Keep it: every new module, test
and split follows these rules, and the skill `.agents/skills/core-architecture` walks through them.

## Layers

`packages/core/src` is layered. A module imports its own folder and the folders below it, never above. `ingest` and
`commands` are both top and never import each other. Nothing lives at the root of `src/`. Type-only and dynamic imports
count the same as value imports. Bottom up:

| Folder | Holds | May import |
|---|---|---|
| `shared/` | platform services, errors, cancelling, constants, currencies, formatting, periods, CSV | — |
| `storage/` | the `Db` contract and `migrate()` (`db.ts`); `migrations.ts` lists `migrations/vNN.ts` | shared |
| `providers/` | the provider contract, the registries, the request slot (`ratelimit.ts`), one folder per bank | shared, storage |
| `people/` | participants, connections, accounts, colors, settings: reads and plain writes | the three above |
| `derive/` | the derivation: transfers, refunds, categories, scope, overrides, crossing, `rederive`, diagnostics | the four above |
| `read/` | statistics and lookups: `filters`, `spending`, `compare`, `income`, lines, status, fx, recurring, search | the five above |
| `ingest/` | the import: `plan` (windows, order), `commit` (one span, one transaction), `sync` (the loop), statement files | all but `commands` |
| `commands/` | writes on people and accounts that then re-derive (`setAccountEnabled`, `deleteConnection`) | all but `ingest` |

Inside `providers/` the boundary of `core-providers.md` holds as well: the domain enters a provider only through
`providers/types.ts`, `providers/rules.ts`, `providers/statements.ts` and `providers/info.ts`.

## Where new code goes

| New code | Place |
|---|---|
| A helper with no domain knowledge (dates, money, text) | `shared/` |
| A table, a column, an index | a new `storage/migrations/vNN.ts`, appended to `storage/migrations.ts` |
| Something only one bank knows | `providers/<id>/`, reached through the contract |
| A read or a plain write on people, connections, accounts | `people/` |
| A value derived from stored rows, kept on the row | `derive/`, and it joins `deriveSpan` / `rederiveCore` (`domain-rules.md`) |
| A statistic, a list of lines, a lookup for a screen or a tool | `read/` |
| A step of an import (API or file) | `ingest/` |
| A write that changes what is derived (it must re-derive before returning) | `commands/` |

- A function that needs a higher layer belongs to that layer or above. Do not move a lower module up to make an
  import legal; move the function that needs it.
- A layer never calls the one above through a callback or a registry to get around the rule. When it seems to need
  one, the code is in the wrong layer.

## Modules

- One module, one job. Split a module when it holds more than one job, or when it passes about 400 lines.
- Split inside the same folder, by job: `ingest/sync.ts` became `plan.ts`, `commit.ts` and `sync.ts`;
  `read/summaries.ts` became `filters.ts`, `spending.ts`, `compare.ts`, `income.ts`. Helpers the parts share go to one
  of them (the lowest in use, like `read/filters.ts`) and are exported from there.
- No index or barrel files: imports name the module (`@mono/core/read/spending`, `../derive/rederive.ts`). A barrel
  would also pull a provider's client into `recategorize`.
- A split or a move changes no code: the moved lines stay identical, only imports and file comments change. It is its
  own commit, apart from behaviour changes.
- Names: kebab-case files, named after the job (`commit.ts`, not `utils.ts`). No `utils`, `helpers` or `misc` modules
  in `src/`.

## Tests

- Tests mirror the folders: the tests of `src/<folder>/…` live in `packages/core/tests/<folder>/`.
- At the root of `tests/` only: the structure tests (`purity`, `providers-boundary`, `layers`), `bench-generate`, and
  the shared `helpers.ts` (`@mono/core/test-helpers`) and `source-tree.ts`.
- Structure tests read `src/` through `tests/source-tree.ts`. A new structural rule is a checker over file texts with a
  legal decoy tree and one breaking example per rule, like `layers.test.ts`.
- All of this is checked by `packages/core/tests/layers.test.ts`.

## Moving files

- Moving a module changes its path for every importer: the core's relative imports, `@mono/core/<folder>/<module>`
  in the apps, `vi.mock` paths, `new URL(…, import.meta.url)` fixture paths, and doc paths in `CLAUDE.md`,
  `.agents/project/*.md` and `openspec/specs`.
- The trust anchor `apps/mcp/tests/recategorize-safety.test.ts` names some core files by path (`derive/rederive.ts`,
  `derive/transfers.ts`, `storage/db.ts`, `ingest/sync.ts`). Moving one of them is followed by a separate commit that
  changes only those paths in the anchor and is reported on its own (root `CLAUDE.md`, «Trust anchors»).
- Tests that list files by path follow the move in the same commit: the writer guard in `tests/derive/derived.test.ts`,
  `tests/providers-boundary.test.ts`, and the renderer allowlist in `apps/desktop/tests/helpers/architecture.ts`
  (`@mono/core/shared/currency`).
