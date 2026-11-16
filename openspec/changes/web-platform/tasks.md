# Tasks

Each group is one reviewable block and one commit (`feat(<scope>): <block>`). No group edits `apps/desktop`,
`packages/core`, `packages/db-libsql` or `apps/mcp`; they are read, copied from and used as the reference. Nothing
below starts before the proposal is reviewed. Every test runs on fictional data.

## 1. Spikes (throwaway code, results written down)

- [ ] 1.1 S1: a table with forced row-level security keyed on a per-transaction household setting, used through a connection pool by a role that owns nothing; verify with a script: no setting → no rows and a refused insert; household A's transaction cannot read or write B's rows; a reused pooled connection starts with no household; the running role cannot disable the policy
- [ ] 1.2 S2: choose the PostgreSQL the tests run on (in-process or a service) — it must honour roles and row-level security and run the job queue; verify S1's script and a queued, taken-once, retried job pass on it, and record what CI needs
- [ ] 1.3 S3: run the desktop decoder's code (`fflate`, `fast-xml-parser`, `pdfjs-dist`) in a browser Web Worker under the design's content security policy on the core's conformance fixtures; verify the same `StatementDocument` as the desktop decoder gives, in a desktop browser and at phone size
- [ ] 1.4 S4: register and use a passkey in a throwaway page served over HTTPS, in a browser tab and as an installed app; verify on the browsers at hand and list what could not be tried
- [ ] 1.5 S5: build and run Node 22, PostgreSQL and every native dependency of the planned stack (`libsodium`, the PostgreSQL driver) as `linux/arm64` containers; verify a container smoke run under emulation or on an ARM runner, and record each package's ARM status
- [ ] 1.6 S6: load a generated household of 40 000 operations into PostgreSQL and time a full re-derivation written the core's way (all rows read, one update per changed row in a transaction) and with batched updates; verify the timings are recorded and the design's D10 choice (in the API or as a job) is made from them
- [ ] 1.7 Write the results to `reports/` in the format of `.agents/project/reports.md`, with a go / change-design line per spike; add to `docs/backlog.md` what only a real phone or the real host can show; verify each spike has a recorded outcome and the design is updated (`openspec-update-change`) where a spike changed it

## 2. The agent's boundary for the server

- [ ] 2.1 Hand the user the exact `permissions.deny` and sandbox lines for `.claude/settings.json` covering the server's secret and data folders (`deploy/secrets/**`, `var/postgres/**`, `apps/server/.env*`, `apps/web/.env*`); verify, after the user applied them, that reading a canary file in each folder is refused (reported as its own item: a trust anchor edited by the user)
- [ ] 2.2 Add those folders to `.gitignore` and a repository test that fails when a file under them, a `.pem`, a `.key` or an `.env` is tracked; verify the test fails on a staged canary and passes without it

## 3. Contract package

- [ ] 3.1 Create `packages/contract` (`@mono/contract`, TS sources per module, no build step, dependencies `zod` and the core's pure modules): copy the desktop's data methods, their argument schemas and view types (reads, data commands, people and connections, import, statements) from `apps/desktop/src/shared`, leaving the desktop's files as they are; verify typecheck and a test that every method has an argument schema
- [ ] 3.2 Add the web's methods with schemas (sign-in, passkeys, devices, households, members, invites, export, deletion), the fixed error codes and the event shapes; replace the statement methods that take a file path with ones that take parsed statements; verify schema tests for bounds on every text, list and number
- [ ] 3.3 Add `packages/contract/CLAUDE.md` and the «Monorepo layout» lines of the root `CLAUDE.md` for the new packages and apps (not the trust anchors section); verify the documented import paths resolve

## 4. PostgreSQL adapter, the data schema and isolation

- [ ] 4.1 Create `packages/db-postgres` (`@mono/db-postgres`): a pool, and a `Db` bound to one household whose `execute` and `batch` each run in a transaction that first sets the household for that transaction only; integer and `bigint` values read as numbers with a range check; verify adapter tests on the database chosen in S2: the setting does not outlive the transaction, a failed batch applies nothing
- [ ] 4.2 Create `packages/domain` (`@mono/domain`) with its layer folders, its `Db` contract, `shared/` re-exporting the core's pure modules, and the layer test (which folder may import which; which `@mono/core` modules may be imported — none that touches the core's `Db`); verify the test with a legal decoy tree and one breaking example per rule
- [ ] 4.3 Write the `data` schema baseline: every table of the core at schema version 23 with `household_id`, real booleans, composite primary and foreign keys, every unique index led by `household_id`, the checks ported (`GLOB` → pattern checks), row-level security forced with one policy per table, and the roles (owner for migrations, running roles that own nothing); verify migrations apply from empty and a structure test: every `data` table has the column, the policy and forced security
- [ ] 4.4 Add `packages/domain/tests/tenant-isolation.test.ts`: for every `data` table, as the running role — no household set → no rows and a refused write; A cannot read, update, delete or reference B's rows; equal bank ids, colours and bank clients coexist in two households; the running role cannot alter a policy; verify it fails when one table's policy is dropped in a test migration
- [ ] 4.5 Add the statement structure tests: no statement text built from a runtime value other than through parameters and reviewed SQL fragments; no statement filters, groups, joins or sorts by a bank text column; verify each with a breaking example, and write `.agents/project/server-storage.md` (tenancy, roles, the opaque-text rule, what a copy of the database is worth)

## 5. Register the tenant isolation trust anchor

- [ ] 5.1 Add `packages/domain/tests/tenant-isolation.test.ts` to «Trust anchors» in the root `CLAUDE.md` with one line on what it guarantees; nothing else in this commit; verify the test passes and report the change as its own item

## 6. Domain: people and the parity harness

- [ ] 6.1 Port `people/` (participants, connections, accounts and their enabled rule, colours, household toggles) with the core's tests for it re-homed to the domain; verify those tests pass on PostgreSQL
- [ ] 6.2 Build the parity harness: one generated fictional data set (the core's bench generator, used as a dev dependency) loaded into the core on libsql and into the domain on PostgreSQL through each side's own writes, and a comparer for tables and for function answers; verify it reports equality for people, connections and accounts, and fails on a deliberately changed row
- [ ] 6.3 Write `.agents/project/server-domain.md` (layers, what is imported from the core and what is ported, the dialect rules, how a ported layer is accepted) and `packages/domain/CLAUDE.md`; verify the document's acceptance steps match what 6.1–6.2 did

## 7. Domain: import from a bank API

- [ ] 7.1 Port the request slot (one per connection, atomic under concurrent callers) and the Monobank client over it; verify tests: two concurrent callers get one slot per interval, a 429 honours its retry time
- [ ] 7.2 Port `ingest/plan`, `ingest/commit` and the import loop (`runPlans`, windows in turn, hold cancelling, coverage) with the core's tests re-homed; verify those tests pass and the parity harness shows equal `transactions`, raw rows and coverage after importing the same fake bank data on both sides

## 8. Domain: derivation

- [ ] 8.1 Port transfers, refunds, categories, scope and crossing, the span pass and the full pass, with the update strategy chosen in S6, and the core's tests re-homed; verify those tests pass
- [ ] 8.2 Extend the parity harness to every derived column after a span pass and after a full pass; verify equality on the generated data set and on each provider's conformance data

## 9. Domain: statement files

- [ ] 9.1 Port statement matching, `compareStatement` and `commitStatement` (the whole file or nothing, the blocks, the re-derivation rule) using the core's readers as they are, with the core's tests re-homed; verify those tests pass and the parity harness shows equal results for each conformance fixture committed on both sides

## 10. Domain: statistics, lists and commands

- [ ] 10.1 Port the period buckets and `read/` statistics (spending, income, compare, balances and status, exchange rates) with the core's tests re-homed; verify those tests pass and parity holds for every function on the generated data, per person, bank view and scope
- [ ] 10.2 Port the lists and lookups (category and income lines, latest and period lines, recurring payments and their marks, search), goals, reserves and category kinds, with the core's tests re-homed; verify tests and parity; verify the statement-count test (each overview function runs a fixed number of statements whatever the people, accounts and months)
- [ ] 10.3 Port `commands/` (operation and payee categories, enabling an account, removing a connection with its data and re-derivation) with the core's tests re-homed; verify tests and parity after each command

## 11. Domain: the screens' read model

- [ ] 11.1 Port the desktop's read model into `views/` (month, spending, «Now», category, income, recurring, allowance, limits, analytics, insights, FOP tax, search, recent operations), with the time zone an explicit argument of every «today» and period and the rates passed in; re-home its tests; verify tests, and a test that the same instant in two zones gives two different «today»
- [ ] 11.2 Extend the parity harness to every view's answer against the desktop's read model run on the core (used as a dev dependency, not edited); verify equality on the generated data for the family view, a person and a bank view
- [ ] 11.3 Port the bank-text canary test: marker values in the counterparty name, IBAN, card number and jar title; verify no view returns a marker and only the views marked as carrying bank text return descriptions

## 12. Server skeleton and the control schema

- [ ] 12.1 Create `apps/server` (`@mono/server`): NestJS on Fastify, the entries `main.ts` and `worker.ts` as stubs, `config/` with a zod environment schema where no secret has a default, `platform/` (clock, ids, a logger that takes a code and counts only), `health/`; verify the app boots in a test and `GET /api/v1/health` answers without a database
- [ ] 12.2 Add the folder rule test: which folder may import which; only `worker.ts`'s graph reaches bank clients and the token-opening module; only `tenant/` creates a household-bound `Db`; only `control-db/` queries the control schema; verify with a legal decoy tree and one breaking example per rule
- [ ] 12.3 Add `control-db/` (Drizzle schema and migrations for `users`, `passkeys`, `email_codes`, `sessions`, `recovery_holds`, `households`, `memberships`, `invites`, `connection_secrets`, `import_runs`, `hook_endpoints`, `audit_log`, `rates`, `deleted_households`); verify migrations apply from empty and a structure test that lists every control column and fails on a name outside the reviewed list
- [ ] 12.4 Add the error filter (fixed codes only), the request logger (method, code, duration, internal ids; never a body), `apps/server/CLAUDE.md` and `.agents/project/server-layout.md`; verify a test that a thrown error with a marker message reaches neither the answer nor the log

## 13. Identity

- [ ] 13.1 Email codes: request and verify, 10 minutes, single use, 5 tries, limits per email and address, the same answer for known and unknown emails, closed sign-up by invite or operator list, `mail/` behind an interface with a test double; verify tests for each scenario of «Email codes are short-lived…» and «Sign-up is closed»
- [ ] 13.2 Passkeys: registration and assertion (`@simplewebauthn/server`), several per user, labels, removal that never removes the last one without a recovery in place; verify with the library's test authenticator: register, sign in, a replayed assertion refused
- [ ] 13.3 Sessions: opaque ids stored as hashes, the `__Host-` cookie attributes, idle and absolute lifetimes, strength (`passkey` / `email`), the device list, end one and end all others; verify tests for expiry, a dump of the table holding no usable cookie value, and a revoked session refused on its next call
- [ ] 13.4 Fresh confirmation and auto-lock: the last confirmation time, the 10-minute window, the per-user idle lock enforced on the server; verify tests for `stale-auth`, `locked`, and unlock by a passkey assertion
- [ ] 13.5 Recovery hold: start by email code, 24 hours, notices to the email and live sessions, cancel from a live session, older sessions ended when a passkey is added; verify with a fake clock: the cancel path and the completion path
- [ ] 13.6 Audit rows for every identity event and `.agents/project/server-identity.md`; verify a test that each event writes one row with no email, code or cookie value in it

## 14. Households

- [ ] 14.1 Households and memberships: the personal household at sign-up, create, rename, list mine, roles, the «always an owner» rule; verify tests for each role and for the last owner leaving
- [ ] 14.2 Invites: create (role, optional email), hash at rest, 7 days, single use, revoke, accept by a signed-in user, the same answer for revoked, expired and unknown; verify tests for each scenario of «Invites are single-use links…»
- [ ] 14.3 Removal and leaving: the next request refused, open streams closed, the member's stored tokens deleted before the action reports done (the deletion is an interface with a test double until group 17); verify the order with a test that fails if the report comes first
- [ ] 14.4 The member–person link (one member per person), checked against the household's people through the domain; verify tests for the double link refusal

## 15. The gate

- [ ] 15.1 Add `gate/policy.ts`: one row per method of the contract (kind, least role, sensitive, bank text, limit), typed so a missing row fails the build; verify `tests/gate-policy.test.ts` walks the table: every method has a row and a schema, every write needs at least `member`, every sensitive method is in the reviewed list
- [ ] 15.2 Add the guards in the fixed order (transport → session → lock and freshness → membership and role → household state → arguments), `tenant/` binding the handler to that household's `Db`, and the call controller `POST /api/v1/h/:householdId/call/:method`; verify tests for each scenario of «Checks run in a fixed order…», «Refusals are fixed codes» and «A household the user is not in…» with a stub handler that records whether it ran
- [ ] 15.3 Transport rules: the `Origin` check, JSON only, the client header, body size per method class, `Cache-Control: no-store`, no cross-origin headers; request limits per session and address with the tighter buckets; verify tests for a cross-site form post, an oversized body and `limited` with a retry time
- [ ] 15.4 Write `.agents/project/server-gate.md` (the order, the codes, how to add a method); verify the «add a method» steps by adding and removing a dummy method in the policy test

## 16. Data methods over HTTP

- [ ] 16.1 Wire every read and data command of the contract through the gate to the domain's views and commands, with the user's time zone from the session and the rates from `rates/` (one public fetch for everyone, size-capped and schema-checked); verify the parity fixture of group 11 passes through HTTP
- [ ] 16.2 People and connections methods (list, rename, colour, connection list, enable an account), with refusals as values; verify tests for each refusal the contract names
- [ ] 16.3 `data_version` and events: a write raises the version and announces it; `GET /api/v1/h/:householdId/events` (server-sent events) behind the same session and membership checks, closed on removal or sign-out; verify tests: a second client gets `changed` with the version only, a removed member's stream closes
- [ ] 16.4 Canary over HTTP: a household with marker values in every personal field, every method called; verify no answer and no log line contains a marker, and only the methods marked `bankText` return descriptions

## 17. Bank credentials

- [ ] 17.1 Add `connections/sealing/seal.ts` (public key only) and `imports/worker/open.ts` (private key), sealed boxes carrying the household and connection ids; verify tests: round trip, a box under another household or connection is refused by `open`
- [ ] 17.2 Add `tests/token-sealing-safety.test.ts`: walk the import graph of `main.ts` through workspace packages and fail if it reaches `open.ts` or the private key's config; verify it fails when `main.ts` imports `open.ts`
- [ ] 17.3 Token entry and replacement (sensitive, `member`), shape check with `credentialFits`, the route's body never logged, the mode `kept` / `once`, who entered it; removal on connection removal, member removal (wires 14.3), household deletion and bank rejection, each before the action reports done; verify tests for each scenario of the `server-bank-credentials` spec, including the marker search across logs, jobs, audit rows, events and the household's data
- [ ] 17.4 Write `.agents/project/server-credentials.md` and add the token rows to the audit trail; verify the audit test of 13.6 covers token entry, replacement and deletion without the token

## 18. Register the gate and sealing trust anchors

- [ ] 18.1 Add `apps/server/src/gate/policy.ts`, `apps/server/tests/gate-policy.test.ts` and `apps/server/tests/token-sealing-safety.test.ts` to «Trust anchors» in the root `CLAUDE.md`, with one line each on what they guarantee; nothing else in this commit; verify both tests pass and report the change as its own item

## 19. The import worker

- [ ] 19.1 The job queue (`pg-boss`) and `imports/` producer: start (a date within the import range), one active run per household, cancel, `import_runs` rows with phases and counts; verify tests: two starts in the same instant give one run, a start out of range is refused
- [ ] 19.2 `worker.ts`: take a job, open its tokens, run the domain's import with a `Db` bound to the job's household and an allowlisted fetch per provider, with the retry rules of the spec; verify with a fake bank and a fake clock: a rejected token switches off one connection, a restart resumes without refetching a committed window, cancel stops within the test's bound
- [ ] 19.3 Connection check as a job (holder, accounts, the result codes) and deletion of a token that is not accepted; verify tests for «another holder» and «already connected»
- [ ] 19.4 Progress to clients: worker → PostgreSQL notification → the event stream, phases and counts only; statement commits and connection removals refused while a run is active; the end-of-run re-derivation; verify a test that watches a run's events and finds only phases, counts, dates and codes
- [ ] 19.5 Scheduled refresh with its thresholds, jitter, the household switch, skipped while a run is active or no token is stored; verify with a fake clock: a refresh re-reads the recent window, a switched-off household sends no request
- [ ] 19.6 Write `.agents/project/server-import.md`; add to `docs/backlog.md` what only a real bank shows (many tokens behind one address, a long run from a server); verify the document names every job and its retry rule

## 20. Statement intake

- [ ] 20.1 Server methods for a parsed upload (open with parsed statements, compare, commit), the contract's schema plus limits (accounts per file, files per upload, rows, text lengths, body size), server-made ids, the 10-minute in-memory keep bound to the member and household, dropped on lock and sign-out; verify tests for each scenario of the `server-statement-intake` spec, including a second member's use of an upload id
- [ ] 20.2 End-to-end parity: the conformance fixtures' parsed statements committed through HTTP to an empty household and through the core to an empty reference database; verify equal accounts, operations and derived values

## 21. Export and deletion

- [ ] 21.1 Export: an owner, a fresh confirmation, a passphrase, one protected file with the household's rows and no token, streamed and not kept; verify tests: the file opens only with the passphrase, holds no credential and no other household's row, and nothing remains on the server after the answer
- [ ] 21.2 Household deletion: closed to calls at once, tokens, then every row in every `data` table, then memberships and invites, resumable by the clean-up job, recorded in `deleted_households`; a start-up step deletes again any household on that list (the list is also written beside the backups in group 28); verify tests: an interrupted deletion finishes on clean-up, and a restored older database loses the household before the first call is answered

## 22. Web app: the copy and its host

- [ ] 22.1 Create `apps/web` (`@mono/web`) as a copy of `apps/desktop/src/renderer/src` and the dictionaries at a commit recorded in `.agents/project/web-client.md`, without the PIN lock, database encryption and recovery, app update and title bar slices, with its renderer tests and architecture test copied along; verify the copied tests that still apply pass and `vue-tsc` is clean
- [ ] 22.2 Add `shared/api/http-bridge.ts` (the contract's methods over `fetch`, the fixed codes mapped to the screens' states) behind the single bridge module, `shared/api/events.ts` (the event stream, reconnect with one refresh), web history with the household in the path; verify bridge tests against a fake server: `unauthenticated` → sign-in, `locked` → lock screen, `stale-auth` → passkey prompt then one retry; a reload of a category address shows the same screen
- [ ] 22.3 Serve the content security policy and the other security headers for the pages (the dev server for tests, the proxy config for production) and add a test that scans the build for `eval`, `new Function`, inline scripts and any URL of another origin; verify the scan passes on the production build
- [ ] 22.4 Add a storage test: run the screens on a fake bridge with marker data and assert that local storage, session storage, IndexedDB and the Cache API hold no marker, and that the only local-storage keys are the reviewed interface keys; verify it fails when a marker is written on purpose
- [ ] 22.5 Write `.agents/project/web-client.md` (the fork commit, what was left out, FSD placement of the web's slices, the storage and policy rules) and `apps/web/CLAUDE.md`; verify the documented dev command starts the client against a local server on fictional data

## 23. Web app: account and space screens

- [ ] 23.1 `entities/session`, `pages/sign-in`, `features/auth/sign-in` and `features/auth/passkeys`: sign-up by invite, the email code, passkey registration and sign-in, the recovery notice and cancel; every text a key in `uk.json`, `en.json` and `ru.json`; verify renderer tests for each flow and the dictionary test
- [ ] 23.2 `features/auth/devices` and the «Devices» settings section (the session list, end one, end all others, auto-lock time, recent security events); texts in the three dictionaries; verify renderer tests and the settings order test
- [ ] 23.3 `entities/household`, `features/household/switcher` (the sidebar header), `features/household/members` and `features/household/invites`, `pages/invite` with the visibility notice, the «Space» settings section (members, roles, invites, link a member to a person, leave); texts in the three dictionaries; verify renderer tests for each role's view
- [ ] 23.4 The lock screen with a passkey, the `stale-auth` prompt, the app's own confirmation dialogs (remove a connection; delete the household with its name typed), the export dialog and the «Scheduled refresh» switch; texts in the three dictionaries; verify renderer tests: the destructive button is not the default and stays disabled until the name matches

## 24. Web app: statement upload in the browser

- [ ] 24.1 Copy the desktop decoder's XLSX and PDF code and limits into `apps/web` as a Web Worker, with the core's `pickReader` and readers; a file input and drop that read bytes in the page and never send them; verify tests: a renamed file is read by its bytes, an over-limit archive is refused before inflating, and a request recorder sees no file bytes or name
- [ ] 24.2 Wire the upload sheet and the statement compare dialog to the parsed-upload methods of 20.1; verify the upload sheet tests pass against a fake server

## 25. Web app: phone layout

- [ ] 25.1 The shell at phone width: navigation, the filters row folding into a sheet, safe areas, tap sizes; verify renderer tests at 360 px for the shell and add the live checks to `docs/backlog.md`
- [ ] 25.2 Home, the category and income screens at phone width (one column, no horizontal scroll, sheets within the screen); verify renderer tests at 360 px
- [ ] 25.3 Analytics, insights, budget, regular payments, planning and settings at phone width; verify renderer tests at 360 px and add to `docs/backlog.md` the real-phone pass per screen

## 26. Web app: installable

- [ ] 26.1 Add the manifest, icons and a service worker that precaches the shell and ignores `/api` (`vite-plugin-pwa`); verify a test that the worker's routes exclude `/api` and that an API answer is never in a cache
- [ ] 26.2 The offline notice with retry, the «new version» prompt, and `Clear-Site-Data` on sign-out; texts in the three dictionaries; verify renderer tests for offline and update, and a server test for the header on sign-out

## 27. Bank webhooks (optional for stage A)

- [ ] 27.1 `hooks/`: an opt-in address per connection (a random path stored as a hash), a hit queues one debounced re-read and stores nothing of its body, the same answer for unknown addresses, limits; the worker sets and clears the address at the bank; verify tests for a forged call and a burst
- [ ] 27.2 The switch in the connection's row with its hint; texts in the three dictionaries; add the live check to `docs/backlog.md` (the bank's retry behaviour is not confirmed); verify renderer tests

## 28. Deployment on the Oracle ARM host

- [ ] 28.1 Add `deploy/`: `linux/arm64` images for `api` and `worker` (non-root, read-only file system), the compose file with `proxy`, `api`, `worker`, `postgres` and `egress` (a forwarding proxy that allows the banks' host names only), the networks, per-container secret mounts, the proxy config (TLS, strict transport security, the page headers, body and rate limits), the two running database roles and the owner role for migrations; verify a compose config test: only the proxy publishes a port, the worker alone mounts the private key and has no network but `egress` and the database, no secret value or host address appears in a tracked file
- [ ] 28.2 Backups and the rebuild: scripts for the nightly dump encrypted on the host and sent to a bucket at another provider, 30 days kept, the deleted-households list written beside the backups, a release's migration tried on a copy of the latest backup; `deploy/REBUILD.md` (a fresh host to a serving one); a notice on failure; verify a local rehearsal in containers on a fictional household: figures after the rebuild equal those before, and a household deleted after the backup is gone again
- [ ] 28.3 `deploy/RUNBOOK.md` for the provider: the instance shape within the free allowance, the home region, inbound rules for 443 and 80 only in the cloud network and the host firewall, administration through a private tunnel, the sending domain for mail, automatic security updates, what to do when the instance is reclaimed, key rotation, incident steps; operator notices (down, backup failed, disk, queue stalled) without user data; verify a test that each notice's text holds only codes, ids and counts
- [ ] 28.4 Add `.github/workflows/deploy.yml`: actions pinned by SHA, least permissions, a `production` environment with manual approval holding the only secrets, images built from this repository for `linux/arm64`; add `apps/server/tests/deploy-workflow.test.ts` like the desktop's `release-workflow.test.ts`; verify the test passes and fails on an unpinned action
- [ ] 28.5 Draft the web edition's privacy text and `docs/web/CHANGELOG.md` (what the operator can read, who the providers are, deletion and backups' expiry) — both flagged for human review before anything is published; add the text test (no claim that the operator cannot read the data, no tamper-protection claim); verify the test fails on a forbidden phrase

## 29. Register the deploy trust anchor

- [ ] 29.1 Add `.github/workflows/deploy.yml` and `apps/server/tests/deploy-workflow.test.ts` to «Trust anchors» in the root `CLAUDE.md`; nothing else in this commit; verify the test passes and report the change as its own item

## 30. Integration checks

- [ ] 30.1 End to end in containers on fictional data: sign up by invite, add a second member, import from the fake bank, upload a statement from the web client, see the change on the second member's client, remove the member, export, delete the household; verify the scripted run passes
- [ ] 30.2 The marker run of the `server-operations` spec across the whole flow; verify no log line, event, job row or audit row holds a marker
- [ ] 30.3 Measure on generated households within the host's size (2 cores, 12 GB): the read methods' latency with 50 households active, a full re-derivation next to reads, search on 40 000 operations, memory of PostgreSQL and the two processes; write the numbers and the chosen PostgreSQL settings to `reports/`; verify the report names what was measured and what was not
- [ ] 30.4 Add to `docs/backlog.md` the stage A opening checks that need the live host (creating the instance, the rebuild rehearsal on it, the port scan, mail delivery, installed app on real phones, a real bank import) and the stage B gates of the design as a checklist; verify every gate of design «Stages» has a line
- [ ] 30.5 Run `pnpm test` and `pnpm typecheck` at the root (in the sandbox: each package from its folder, the root run by the user)

## Workflow follow-up

- The owner's steps, outside the tracked tasks: create the Oracle tenancy with a home region in the EU and the ARM instance; decide on Pay As You Go; choose the backup bucket at another provider; register the domain and verify it for mail; create the production secrets on the host; write to the bank about the provider API (the stage B bank gate); have the privacy text and the providers' agreements reviewed by a qualified professional before stage B.
- Stage A opens only after the live checks of 30.4 are done by the owner on the host.
- Sync the delta specs to `openspec/specs/` and archive the change after its groups are committed.
- Add a row per finished block to the Notion work log, as the root `CLAUDE.md` asks.
