# Tasks

Agent's sandbox: root `pnpm` cannot run, so each package's checks run from its folder (`.agents/skills/core-architecture`,
«Before handing over»). The user runs the root commands.

## 1. Move DataService and its helpers to src/data (refactor(desktop): data service folder)

- [x] 1.1 `git mv` `src/main/data.ts`, `spending.ts`, `usual.ts`, `category.ts`, `analytics.ts`, `now.ts`, `period.ts` and `allowance.ts` to `src/data/`, and rewrite only the imports: the moved files' own imports, `src/main/index.ts` and `people.ts`, and the tests that import them (`data*.test.ts`, `spending-main`, `usual`, `category`, `analytics-main`, `now-main`, `allowance` and `period` users). Verify that a line diff of each moved file shows only import lines changed.
- [x] 1.2 Update the doc paths that name these files (`.agents/project/desktop-*.md`, `apps/desktop` comments that cite a path). Verify `apps/desktop`'s tsc for node and web and its vitest pass.

## 2. The data host: the database halves out of main's services (feat(desktop): data host)

- [ ] 2.1 Add `src/shared/data-protocol.ts`: the `DataMethods` map (method → args and result), the zod schemas of the messages and of each method's arguments (`DATA_ARG_SCHEMAS`), and move `ARG_SCHEMAS`' shared pieces from `src/main/ipc.ts` to `src/shared/` so both use one copy. Verify with `tests/data-protocol.test.ts`: every method has a schema, an extra argument and an unknown method are refused, and `dbKey` follows the import protocol's rule.
- [ ] 2.2 Add `src/data/people.ts`, `connections.ts` and `statements.ts` with the database halves of the table in design §2. Move the mapping of `ColorTakenError` and `StatementImportError` into them, so refusals are values. Verify by moving the database cases of `tests/people.test.ts`, `integrations.test.ts` and `statements.test.ts` to these modules, unchanged in what they assert.
- [ ] 2.3 Add `src/data/host.ts`: the handler table over an open `Db`, with `open` (migrate, `refreshCrossing`), the kept rates, and errors as `{ code, name }`, the name only. Verify with `tests/data-host.test.ts` on in-memory libsql: each method answers as the service did, `ConnectionError` → `connection`, another error → `failed` with its name and no message text, and calls run one at a time in order.
- [ ] 2.4 Make main's `people.ts`, `integrations.ts` and `statements.ts` depend on a narrow data interface (the `DataMethods` they use) instead of `db`. Wire them for now to an in-process adapter over the host, so the app behaves as before. Verify that the main-side tests (token status merge, duplicate check, rollback order, `import-running` refusals, the kept statement and expiry) pass against a fake of that interface.

## 3. The data process and the client (feat(desktop): data process)

- [ ] 3.1 Add `src/data/process.ts`: the `utilityProcess` entry over the host, which validates incoming messages and parses outgoing ones, sends `ready` / `open-failed`, and exits on `close` after closing the connection. Verify with `tests/data-entry.test.ts`, checked as source like `worker-entry.test.ts`: `safeParse` in, `parse` out, no `net`, one `process.exit`.
- [ ] 3.2 Add `src/main/data-client.ts` (`DataClient`): fork, `open`, rates, calls queued until `ready`, replies matched to pending ids, `exit` → pending calls fail and the next call forks again, `stop()` (`close`, kill after 5 s, resolve on `exit`), and `open-failed: unreadable` → `DbAccess.markUnreadable()`. Verify with `tests/data-client.test.ts` using a fake child, as `importer.test.ts` does: order, crash mid-call, restart on demand, stop with a hanging child, a reply with an unknown id ignored, and errors rethrown as `ConnectionError` or `DataCallError`.
- [ ] 3.3 Add `DbAccess.markUnreadable()` and rename `forWorker()` to `forProcess()` (importer and client). Add `RatesService`'s `onChange`. Verify with `tests/db-access.test.ts`, which covers the same state and push as a `SQLITE_NOTADB` open, and `tests/rates.test.ts`, which covers a change notifying once and `forget()` notifying none.
- [ ] 3.4 Wire `src/main/index.ts`:
  - fork with `?modulePath`, `serviceName: 'balance-data'` and `env: {}`;
  - start after `init`, `afterWipe` and «Start over»;
  - IPC handlers, importer, auto-sync and the legacy token go through the client;
  - `before-quit` kills the process;
  - `wipe.ts` and `db/start-over.ts` call `stop()` instead of `data.close()`.

  Verify that `tests/wipe.test.ts` and `db-start-over.test.ts` assert the process exited before any file is removed, and that `tests/ipc.test.ts` still passes.
- [ ] 3.5 Update `.agents/project/desktop-import.md` with a new section «The data process», plus who runs the people, connections and data channels. Update `desktop-security.md`: the key in `open`, no network, Windows release by process exit, and `releaseClosedFiles` kept for launch only. Verify `apps/desktop`'s tsc for node and web and its vitest pass.

## 4. Main imports no query code (test(desktop): main import graph)

- [ ] 4.1 Extend `tests/architecture.test.ts` with the rules of design §5:
  - the run-time import graph from `src/main/index.ts` reaches only the allowed core folders and their stated exceptions;
  - `@mono/db-libsql` is imported only where allowed;
  - `src/data/` imports `electron` only in `process.ts` and never `src/net/`, `src/worker/` or `src/main/`.

  Add a legal decoy tree and one breaking example per rule. Verify the test passes on the real tree and fails on each example.

## 5. The read cache in the renderer (feat(desktop): read cache)

- [ ] 5.1 Add `shared/api/read-cache.ts` (`ReadCache`: generation, LRU of 50, 60 s freshness). Wrap the bridge in `shared/api/balance.ts`: the eight data reads are kept under the generation from the start of their request, `READ_ONLY` passes through, any other method bumps the generation on success, and `peekRead` and `invalidateReads` are exported. Verify with `tests/renderer/read-cache.test.ts`:
  - fresh, stale by generation and stale by age;
  - LRU drop;
  - a failure is not kept;
  - an answer that raced a write lands stale;
  - every method in `METHODS` is classified.
- [ ] 5.2 Add the `cached` option to `useAsyncData`: fresh → no load; stale → shown, then a quiet load; an older answer never replaces a newer one. Verify with `tests/renderer/use-async-data.test.ts`, which covers each case and that today's behaviour holds without the option.
- [ ] 5.3 Pass a peek from the data features' `api/` segments into their composables (balances, spending, now strip, category detail, income detail, recurring screen and teaser, allowance, analytics). In `useSyncStatusStore.refresh()`, call `invalidateReads()` through `entities/sync-status/api` before bumping `version`. Verify that the renderer tests show a month switched back with no new request and that a reserve added makes the month overview load again. Also verify that `tests/architecture.test.ts` still passes, since `@/shared/api` is imported only from `api/` segments and `app/listeners.ts`.
- [ ] 5.4 Update `.agents/project/desktop-renderer.md` (`useAsyncData` and the read cache: what is kept, what invalidates it, in memory only). Verify that `vue-tsc -p tsconfig.web.json` and the renderer tests pass.

## 6. Release notes and checks (docs(desktop): data process notes)

- [ ] 6.1 Add the user-visible entry to `CHANGELOG.md` under `## 0.1.10 — unreleased`, in plain words with no internal terms: the window stays responsive while the app recalculates, and screens you go back to open at once. Verify that `tests/release-notes.test.ts` passes.
- [ ] 6.2 Add the live checks of design «Migration Plan» to `docs/backlog.md`:
  - responsiveness while an account is turned off on real data;
  - Windows «Delete all data» and «Start over»;
  - the process's memory;
  - a killed data process and the next screen load.

  Verify that the entries are present.
- [ ] 6.3 Run `pnpm test` and `pnpm typecheck` at the root. The user runs them where the agent's sandbox cannot; the agent runs each package's checks from its folder. Verify that all pass.

## Workflow follow-up

- Sync the specs (`openspec-sync-specs`) and archive the change once every group is committed.
