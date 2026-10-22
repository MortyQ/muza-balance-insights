# Design

## Context

See `proposal.md` («Why») for the problem. The current state that shapes the approach:

- **Main's database work.** `src/main/data.ts` (`DataService`, about 950 lines, with helpers in `spending.ts`,
  `usual.ts`, `category.ts`, `analytics.ts`, `now.ts`, `period.ts` and `allowance.ts`) opens the one connection lazily.
  It runs `migrate` and `refreshCrossing` first, then lends that connection to `PeopleService`, `IntegrationsService` and
  `StatementsService` (`db: () => data.database()`).
- **Who else uses it.** The importer and auto-sync ask `DataService` for token connections and the last sync time.
  «Delete all data» and «Start over» call `data.close()`, then `releaseClosedFiles()`: on Windows a closed database keeps
  its files until V8 collects its statements.
- **The import worker** (`src/worker/import.ts`) is the existing pattern:
  - a `utilityProcess` forked with an empty env;
  - the key arrives in its `start` message;
  - messages are zod-checked on both sides (`src/shared/import-protocol.ts`);
  - main kills it if it does not stop in time;
  - `tests/worker-entry.test.ts` checks the entry as source.
- **Renderer.**
  - Every data feature loads through `useAsyncData` (`shared/lib`). It reloads quietly when `syncStatus.version`
    changes; that counter grows with each `syncStatus.refresh()` (imported windows, the end of an import, after writes).
  - Only `shared/api/balance.ts` touches `window.balance`. Only the slices' `api/` segments and `app/listeners.ts`
    import `@/shared/api` (`tests/helpers/architecture.ts`).

Rules followed:
- `.agents/project/desktop-security.md`: IPC gates, the key, Windows file release.
- `.agents/project/desktop-import.md`: the worker, people and connections IPC, the data channels.
- `.agents/project/desktop-renderer.md`: FSD, `useAsyncData`.
- `.agents/project/desktop-app.md`: build.

Updated by this change:
- `desktop-security.md`: the data process, its key, Windows release by process exit.
- `desktop-import.md`: who runs the people, connections and data channels.
- `desktop-renderer.md`: the read cache.

The new process gets its own section in `desktop-import.md`, «The data process». A new file would need another row in
the root table for one paragraph's worth of rules.

## Goals / Non-Goals

**Goals:**
- No SQL and no derivation on main's thread after launch.
- The same answers, refusals and errors at the IPC boundary as today. The renderer does not change, apart from the
  cache.
- Each moved piece stays testable without Electron, as `DataService` is today.

**Non-Goals:**
- Parallel reads. One connection runs one statement at a time, and a second connection in the same thread would not
  run alongside it either.
- Read priority over writes.
- Shrinking the launch work in main (`DbAccess.init`, encrypting a plain database).

## Decisions

### 1. A long-lived `utilityProcess`, main as the only gate

Alternatives considered:
- **`worker_threads` inside main.** A crash of the thread (a native libsql fault) takes the whole app down. libsql's
  addon in a worker thread is unproven here, while `utilityProcess` with libsql is already proven by the import.
  Rejected.
- **A remote `Db`: main keeps the services and only `execute` crosses to another process.** It moves the SQL but not
  the derivation and folding, which are JavaScript in core and main. Re-derivation alone runs thousands of statements,
  each one would become a round trip, and core's `Db` contract has no transactions to span them. Rejected.
- **The renderer talks to the data process directly** (a `MessagePort` handed over once). The lock, the database state
  and the sender checks live in main; the data process would need all of them, plus a way to learn the lock state.
  That means two gates to keep in step. Rejected.
- **Merge into the import worker.** The worker is one job per process, killed on cancel, and it holds tokens and
  network. The data process must outlive imports and must have neither. Rejected.

Verdict: a separate `utilityProcess` (`serviceName: 'balance-data'`, `env: {}`, stdio as the worker's), forked once the
database is ready. Main's IPC gates stay exactly as they are; each handler calls a `DataClient` instead of a service.

### 2. What moves, and how main's services split

| Today | Data process (`src/data/`) | Stays in main |
|---|---|---|
| `DataService` and its helpers | all of it, moved as is | — |
| `PeopleService.list` | participants and connections | each connection's token status, then the merge |
| `rename`, `restoreBankName`, `setParticipantColor` | all (a taken colour → the result value) | — |
| `IntegrationsService.addConnection` | list connections, create participant and connection, delete connection | the token's shape, the duplicate check against the vault, `tokens.set`, the rollback order |
| `setToken` | find the connection | `tokens.set` |
| `listConnectionAccounts`, `setAccountEnabled` | all | the `import-running` refusal |
| `remove` | `deleteConnection` | the refusal, the dialog, `tokens.clear` |
| `StatementsService.open` | the connection check and its accounts | the dialog, reading, parsing, the kept statement |
| `compare`, `commit` | `compareStatement`, `commitStatement` (the parsed statement in the message) | the kept statement, expiry, the `import-running` refusal |
| importer, auto-sync, legacy token | token connections, last sync time, the default connection | — |

`src/data/` holds:
- `process.ts`: the Electron entry, the only file there that imports `electron`;
- `host.ts`: the handler table, method → function over an open `Db`, testable with in-memory libsql;
- the moved `data.ts` and its helpers;
- `people.ts`, `connections.ts` and `statements.ts` for the database halves above.

Main keeps `people.ts`, `integrations.ts` and `statements.ts` as the orchestrating halves. Their `db: () => Promise<Db>`
dependency becomes a narrow data dependency (the client's methods).

The move of `DataService` and its helpers is its own commit and changes no code, following the rule of
`.agents/project/core-layout.md` («Modules»).

### 3. The protocol (`src/shared/data-protocol.ts`)

- **To the data process:**
  - `open { dbPath, dbKey }` (`dbKey` checked as in the import protocol);
  - `rates { list }` (today's `RatesView`);
  - `call { id, method, args }`;
  - `close`.
- **From the data process:**
  - `ready`;
  - `open-failed { kind: 'unreadable' | 'failed', name }`;
  - `result { id, value }`;
  - `failure { id, code, name }`.
- **Validation:**
  - The data process zod-checks every message, and each method's arguments against its own schema
    (`DATA_ARG_SCHEMAS`). For the IPC-facing methods these reuse `ARG_SCHEMAS` from `src/main/ipc.ts`, moved to `src/shared/`.
  - Main checks each reply's envelope and that its `id` is a pending call.
  - Result payloads are typed by one map, `DataMethods` (method → args and result), shared by the client and the
    host. They are not schema-checked again: they come from our own process, which is as trusted as `DataService`
    in main is today.
- **Errors:**
  - Known refusals are mapped in the host, so they cross as values. `ColorTakenError` becomes the
    `{ changed: false, reason: 'taken' }` result, and `StatementImportError` becomes its `reason`.
  - `ConnectionError` crosses as `failure { code: 'connection' }`; the client rethrows it as a `ConnectionError`, so
    main's refusals do not change.
  - Anything else crosses as `failure { code: 'failed', name }`. Only the error's name crosses, never its message.

### 4. Lifecycle (`src/main/data-client.ts`, `DataClient`)

- **Start.** `start()` runs after `DbAccess.init()` is ready, after `afterWipe()` and after «Start over». It takes
  `access.forWorker()` (renamed to `forProcess()`, which both users share), forks, and sends `open` and then the
  current rates. Calls made before `ready` wait in order.
- **Open.**
  - The data process runs `migrate` and `refreshCrossing` before `ready`, as `DataService.conn()` does today.
  - `open-failed { kind: 'unreadable' }` calls a new `DbAccess.markUnreadable()`. It is the same transition that
    `DbAccess.open()` makes on `SQLITE_NOTADB` today, including the state push.
  - No timeout on open: the first launch after an update may migrate for a while, as it does today.
- **Order.** The data process runs calls one at a time, in arrival order; the host awaits each before the next.
- **Crash.** An `exit` without `close` rejects every pending call (`DataCallError`, code `failed`). The next call forks
  again. There is no crash-loop timer: a restart only happens on demand, so a broken process cannot spin.
- **Stop.**
  - `stop()` sends `close` (the process closes the connection and exits), then kills the process after 5 s, and
    resolves only on `exit`.
  - «Delete all data» and «Start over» call `stop()` where they call `data.close()` today. Process exit releases the
    files on every OS, so `releaseClosedFiles()` is no longer needed on this path. It stays for `DbAccess` and
    `encrypt.ts`, which still open and close in main at launch.
- **Quit.** `before-quit` kills the process, as it does for the importer.
- **Rates.** `RatesService` gains an `onChange` callback. On each change the client sends `rates`, and the host keeps
  the last list for `DataService`'s `rates()` dependency.

### 5. What main may import

The architecture test (`tests/architecture.test.ts`) walks the import graph from `src/main/index.ts`, as
`recategorize-safety.test.ts` walks `recategorize`'s graph. It follows relative imports and `@mono/*` by their
`exports`. Type-only imports do not count. Allowed at run time:

- `@mono/core/shared/*`;
- `@mono/core/providers/*`: statement parsing and the provider ids;
- `@mono/core/storage/*`: only from `src/main/db/` and `src/main/smoke.ts`, the launch-time open and the dev smoke;
- `@mono/core/read/reserves`: only through `src/shared/allowance.ts`. It holds the reserve limits that zod shares with
  core, and nothing in main calls its functions;
- `@mono/db-libsql`: only from `src/main/index.ts` (the `DbAccess` wiring) and `src/main/smoke.ts`.

The test also checks `src/data/`:
- only `process.ts` imports `electron`;
- nothing there imports `src/net/`, `src/worker/` or `src/main/`;
- `process.ts` validates incoming messages and parses outgoing ones, checked as source like `worker-entry.test.ts`.

Each rule has a breaking example.

### 6. The renderer cache (FSD placement)

- **Layer `shared`, segment `api`: `shared/api/read-cache.ts`.**
  - `ReadCache` holds a generation counter and an LRU of at most 50 entries:
    `key → { data, generation, at }`.
  - The key is `method + JSON of the arguments`.
  - An entry is fresh when its generation equals the current one and it is under 60 s old.
- **`shared/api/balance.ts` wraps the bridge.**
  - The eight data reads (`getMonthOverview`, `getSpendingOverview`, `getNowOverview`, `getCategoryOverview`,
    `getIncomeOverview`, `getRecurringOverview`, `getAllowanceOverview`, `getAnalyticsOverview`) store their answer
    under the generation read when the request started, so an answer that raced a write lands stale.
  - Every method in `READ_ONLY` passes straight through. It lists the other reads: status, lists, lock, theme, locale
    and so on.
  - Any other method bumps the generation once it succeeds. A new write method is covered by default.
  - A test checks that every method in `METHODS` is either a cached read, in `READ_ONLY`, or a write.
  - `peekRead(method, args)` returns `{ data, fresh } | null`.
  - `invalidateReads()` bumps the generation.
- **Layer `entities`, slice `sync-status`, segment `api`:** re-exports `invalidateReads`. `refresh()` calls it before
  bumping `version`.
- **Layer `shared`, segment `lib`: `useAsyncData`** gains an option `cached?: () => { data: T; fresh: boolean } | null`.
  `shared/lib` does not import `shared/api`, so the feature passes the peek in.
  - **Fresh:** success, no load.
  - **Stale:** success with the stale data, then a quiet load.
  - **None:** today's behaviour.
- **Layer `features`, the data features' `api/` segments:** each gains a `peek` next to its fetch, and their
  composables pass it.

The cache holds the same data the screens already hold while shown, bank text included (category, income and recurring
lines). It is never persisted. The lock reloads the renderer, so it goes with the page.

## Risks / Trade-offs

- **[A long write queues reads.]** A 1.5 s re-derivation delays the next overview by up to that much. The window stays
  responsive, and the cache shows the last numbers meanwhile. → Accepted. Splitting reads off would need a second
  process.
- **[One more process.]** Its memory is about that of the import worker. → Accepted. It replaces work main does today.
- **[Main and the data process disagree on the database state.]** For example, a key stops fitting. → Only the data
  process opens the file after launch. Its `open-failed` drives `DbAccess`, so there is one source of the state.
- **[The import and the data process write at once.]** WAL plus libsql's busy timeout already cover the worker and
  `DataService` today. Statement commits and account toggles still refuse while an import runs. → Unchanged.
- **[Stale numbers for up to a minute after a change that bumps nothing.]** Today's rates change and the day rolls over
  without a write. → The 60 s age limit bounds it, and a stale answer is always reloaded.
- **[An answer from a crashed call is lost.]** → The renderer already treats a failed load as «keep the last numbers,
  show the error», and the next load goes to a new process.
- **[Windows file release now depends on process exit.]** → `stop()` resolves on `exit` only, and a kill after 5 s
  guarantees it. Checked live on Windows: `docs/backlog.md`.

## Migration Plan

No data migration. It ships in one release. Rollback is a revert of the desktop commits. The database, its key and its
format do not change, so an older build opens the same file.

Live checks for the user go to `docs/backlog.md`:
- the window stays responsive while an account is turned off on real data;
- «Delete all data» and «Start over» on Windows;
- the data process's memory;
- a crash of the data process (kill it from the OS) and the next screen load.
