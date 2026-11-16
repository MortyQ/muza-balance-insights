# Design

## Context

Motivation and scope: `proposal.md`. This section holds only the facts the decisions rest on. They were read from the
code, the project notes and the providers' own pages on 2026-11-12; nothing here comes from real data.

### Decisions already made by the owner (2026-11-12)

- The web version is a separate product: its own backend and its own frontend. Development moves there.
- The desktop stays and is not touched by web work.
- All server data is in PostgreSQL.
- Hosting is Oracle Cloud Always Free, an ARM virtual machine. A home server is not an option.

### What exists and can be used

- **`packages/core`** is platform-independent (no Node, no browser globals). Its pure half — the provider contract,
  each bank's rules and statement readers, money, periods, currencies, CSV, the pure statistics helpers — has no
  database in it and can be imported by a server and a browser as it is.
- **Its SQL-bound half** goes through a narrow async contract (`Db { execute, batch, close }`) with hand-written
  SQLite SQL: about 132 `execute` and 10 `batch` call sites in about 35 files, 23 append-only migrations, 43 test
  files that open a libsql memory database. Most of the SQL is already valid PostgreSQL (`ON CONFLICT … DO UPDATE`,
  `RETURNING`, materialised CTEs). What is not: `json_each` period buckets (1 place), two-argument `MIN` / `MAX`
  (1), `IS ?` null-safe comparison (4), `ifnull` (1), `rowid` (1), integers used as booleans (throughout, centred on
  `accountEnabledSql`), `GLOB` checks and `AUTOINCREMENT` in migrations, positional `?` parameters.
- **No notion of an owner.** No table has a household column; every query, every derivation pass and every unique
  index spans the whole database. Text search runs in JS, not in SQL.
- **The desktop's read model** (`apps/desktop/src/data`, about 3100 lines, no Electron) builds every screen's answer
  from the core. Its contract is a closed list of 70 methods with a zod schema each: 44 are about data (16 reads, 11
  commands, 6 statement upload, 2 import, 9 people and connections), 26 exist only because it is a desktop.
- **The desktop's split by trust** is the model for the server: gates in front (sender → lock → database →
  arguments), a process that only reads and writes data, a process that alone talks to banks, a process that only
  decodes files — each behind a closed, schema-checked protocol.
- **Time**: SQL never does time-zone math; periods are computed in JS and passed as bounds. The desktop takes «today»
  from the system time zone — a server has none that means anything.

### What the bank allows

Read on `api.monobank.ua/docs` (the page is in Ukrainian; the points below are translated, not quoted):

- A service that wants to connect to the API centrally to serve its clients must use the API for service providers.
- The corporate API is not required if the clients' data does not reach the service's servers, or if the service is
  made for one's own family.
- Misuse of the personal API as a corporate one may be sanctioned by the bank.
- `api.monobank.ua` answers browser preflights with `access-control-allow-origin: *` and allows the `x-token`
  header (measured with an `OPTIONS` request, no token sent).

Unknown, so treated as unknown: the provider API's approval terms; whether the bank limits requests per source
address when many tokens are used from one server; the exact webhook retry rules.

### What the host gives

Read on Oracle's «Always Free Resources» page:

- Ampere A1 compute: 1,500 OCPU hours and 9,000 GB hours a month, which the page equates to 2 OCPUs and 12 GB of
  memory; 200 GB of boot and block volume in total; 10 TB of outbound transfer a month.
- Object Storage 20 GB; Vault with software-protected master keys and 150 secrets; Email Delivery 3,000 emails a
  month (outbound port 25 is blocked by default); Notifications 1,000 emails a month.
- Always Free compute and volumes must be created in the tenancy's home region, which is chosen at sign-up.
- An Always Free instance may be reclaimed as idle when, over 7 days, the 95th-percentile CPU use, the network use
  and (for A1) the memory use are each under 20%.

Not confirmed: whether a Pay As You Go tenancy is exempt from idle reclamation; how reliably an A1 instance can be
created in a given region.

### Project rules this change follows and adds

- **Follows**: `.agents/project/core-providers.md` (the provider boundary: the domain reaches a bank only through the
  five doors), `domain-rules.md` (what every figure means — the port keeps it), `core-layout.md` (the layer rule is
  repeated in `packages/domain`), `desktop-security.md` and `desktop-import.md` as the reference for the gate order,
  the decoder's limits, the allowlisted fetch, retries and the channels that may carry bank text,
  `desktop-renderer.md` (FSD, `shared/ui` first, every text through i18n — carried into `apps/web`).
- **Updates**: the «Monorepo layout» part of the root `CLAUDE.md`; `docs/backlog.md` (live checks, the stage B
  gates). No desktop or core rule file changes.
- **Adds**: `.agents/project/server-layout.md`, `server-domain.md`, `server-identity.md`, `server-gate.md`,
  `server-storage.md`, `server-credentials.md`, `server-import.md`, `web-client.md`, each pulled in by a `CLAUDE.md`
  in its package.
- **Trust anchors**: four additions to the root `CLAUDE.md` list, registered in task groups that change nothing
  else (5, 18, 29);
  `.claude/settings.json` gains deny rules that the user applies.

### Feasibility verdict

**Feasible.** What is new is everything a single-user local app never needed — identity, tenancy, a credential vault
on a server, operations — plus the port of the SQL-bound domain to PostgreSQL. The largest block of work is that
port, and its risk is figures that differ from today's; the parity harness (D5) exists to catch exactly that.

```
 browser / installed app
   apps/web  (Vue PWA)           statement files are decoded here, in a Web Worker
        |  HTTPS, same origin: POST /api/v1/...  +  one event stream
 +------v--------------------------------------------------------------+
 | proxy  (TLS, headers, limits)                                       |
 +------+--------------------------------------------------------------+
        |
 +------v-------------------+          +-----------------------------+
 | api  (NestJS)            |          | worker  (NestJS, no HTTP)   |
 |  gate: session > fresh   |  jobs    |  opens bank tokens          |
 |   > member > role > args | -------> |  bank requests (allowlist)  |
 |  seals tokens, cannot    | <------- |  import, refresh, backups   |
 |  open them               |  events  |                             |
 +------+-------------------+          +--------------+--------------+
        |        packages/domain (framework-free)     |
        |        over packages/db-postgres            |
 +------v---------------------------------------------v--------------+
 | PostgreSQL                                                        |
 |   control schema: users, sessions, households, members, invites,  |
 |                   sealed tokens, jobs, audit                      |
 |   data schema:    the household tables, each row owned by one     |
 |                   household, row-level security forced            |
 +-------------------------------------------------------------------+
```

## Goals / Non-Goals

**Goals:**

- A backend that is conventional to run and reason about: one database, one queue, two processes.
- A leak between households cannot come from a forgotten `WHERE`: the database refuses the row.
- The server's figures equal the desktop core's on the same data, and that is checked by machine.
- The internet-facing process cannot read a stored bank token.
- A raw statement file never reaches the server.
- The host can be lost and rebuilt from a backup by following written steps.
- The existing guarantees stay: the agent sees neither real data nor a token; logs carry codes and counts.

**Non-Goals:**

- Protection against whoever controls the running server or its database (the operator, the hosting provider, an
  attacker with code execution there). D2 says so plainly.
- Keeping the desktop and the web in step feature by feature.
- Horizontal scale beyond one host in this change.
- Offline use beyond the app shell.

## Decisions

### D1. One PostgreSQL database; every data row carries its household; the database enforces isolation

The owner chose PostgreSQL for everything. The alternative that was recommended and not chosen — one encrypted
SQLite file per household with the core unchanged — is recorded here with what the choice costs: the SQL-bound domain
is ported (D5), a per-household key is lost (D2), and deletion is row deletion rather than throwing away a key.
What it buys: one database to run, back up, restore and query; standard tooling; no shared volume between
processes; no pool of worker threads around a synchronous driver.

How tenancy is done inside PostgreSQL:

| Option | Verdict |
|---|---|
| A schema per household | No tenant column, but thousands of schemas strain the catalog and every migration runs once per household. Rejected. |
| Shared tables, `household_id` in every query by hand | Isolation depends on each of ~130 statements remembering a predicate. Rejected as the only defence. |
| **Shared tables, `household_id` on every row, row-level security forced** | Chosen. |

The chosen shape:

- Two schemas. `control`: users, passkeys, sessions, households, memberships, invites, sealed tokens, runs, the
  audit trail, the job queue — no amount, bank text, counterparty, IBAN or card number. `data`: the household
  tables ported from the core, each with `household_id uuid NOT NULL`.
- Every `data` table has row-level security **forced**, with one policy: a row is visible and writable only when its
  `household_id` equals the transaction's household setting. With no setting, a query returns nothing and a write
  fails. `household_id` defaults to that setting, so the ported statements do not name it.
- The application connects as a role that owns nothing and cannot bypass row-level security; migrations run as a
  separate owner role that the running service does not have.
- `packages/db-postgres` gives the domain a `Db` bound to one household: every `execute` and every `batch` runs in
  a transaction that first sets the household locally to that transaction, so nothing carries over on a pooled
  connection.
- Keys and uniqueness are per household: primary keys of bank-given ids are `(household_id, id)` — the same bank
  account may be connected in two households —, and every unique index of the core (participant colours,
  `connections(provider, external_client_id)`, the one-limit-per-owner rule) gains `household_id` as its first
  column. Foreign keys are composite, so a row cannot point across households.
- Only parameterised statements. Row-level security stops a forgotten predicate; it does not stop someone who can
  run arbitrary SQL as the application, because that someone can also change the setting. The domain has no
  statement built from client text, and a structure test keeps it so.

### D2. Encryption: what protects the data, and what choosing one database gives up

- **In transit**: TLS only.
- **At rest on the host**: the volume's encryption. This protects a detached disk; it does not protect against
  anyone who can read the running database, and a database dump taken on the host is readable.
- **Leaving the host**: every backup is encrypted on the host before it is sent; the key is not in the bucket.
- **Bank tokens**: sealed to the import worker's key (D6) — the one secret that stays unreadable even with the whole
  database in hand.
- **Not built now, prepared for**: encrypting bank text by column (descriptions, comments, counterparty names,
  IBANs, card numbers, holder names, raw bank rows) with a key per household. The rule that keeps this possible
  holds from the first migration: **SQL never filters, groups, joins or sorts on those columns** — they are read and
  written whole, and matching on them happens in the domain's code, as text search already does in the core. A
  structure test over the domain's statements enforces it. Turning the encryption on is a stage B gate.
- **End-to-end encryption** (the server stores ciphertext only) was considered and not chosen: it removes the
  reasons for this change — imports while every device is off, bank webhooks — and makes a shared space a key
  distribution problem.

What a member is told, in the web edition's privacy text: the operator of the service and its hosting provider can
technically read the data; backups are encrypted; deleted data leaves backups when they expire.

### D3. The contract is its own package; the API is a closed method list over HTTP

`packages/contract` holds the method list, a zod argument schema per method and the view types, for the server and
the web client. It starts from a copy of the desktop's data methods and view types (the desktop keeps its own files)
and adds the web's: sign-in, passkeys, devices, households, members, invites, export, deletion.

HTTP shape: `POST /api/v1/h/:householdId/call/:method`, body `{ "args": [...] }`, reply `{ "ok": true, "data": … }`
or `{ "ok": false, "code": … }`; identity and household management under `/api/v1/auth/*` and `/api/v1/me/*`; one
event stream `GET /api/v1/h/:householdId/events`. Every data call is a `POST`, reads included: nothing personal ever
sits in a URL, a proxy log or a cache, and every answer is `Cache-Control: no-store`.

Alternatives: REST resources (re-describes 44 working methods and every screen's wrapper for a single first-party
client); GraphQL (a query language on a financial API is attack surface without a use); tRPC (the project already
has a typed contract with schemas). Verdict: the contract, served by NestJS controllers.

The gate — one path, in this order:

1. transport: same origin (`Origin`), JSON only, a client header, body size, request limits;
2. session: the cookie resolves to a live session;
3. lock and freshness: the session is not locked; a sensitive method needs a recent passkey confirmation;
4. membership: the user belongs to the household named in the path, and the role covers the method;
5. household state: ready (not being deleted);
6. arguments: the method's zod schema;
7. the handler, with a `Db` bound to that household and nothing else; then the reply check; a write raises the
   household's `data_version` and emits a `changed` event.

The policy is a table, `Record<Method, { kind, role, fresh?, bankText?, limit }>`, typed so that a method without a
row does not compile, with a test that walks it. Errors leave as fixed codes (`unauthenticated`, `forbidden`,
`stale-auth`, `locked`, `invalid`, `unavailable`, `limited`, `failed`), never a message. An unknown household and a
household the user is not in answer the same `forbidden`.

### D4. Identity: passkeys, email codes for the first step and recovery, server-side sessions

- **Sign-up** proves the email with a one-time code and registers a passkey before the account is usable.
- **Sign-in** is a passkey. A one-time email code signs in to a *restricted* session: it can read and make ordinary
  edits, but a sensitive method needs a passkey.
- **Recovery** (no passkey left): an email code starts a 24-hour hold; every device and the email are told; any
  live session can cancel it; after the hold a new passkey can be added.
- **Sessions** are opaque 256-bit ids, stored as hashes, sent as a `__Host-` cookie (`HttpOnly`, `Secure`,
  `SameSite=Strict`, path `/`). Idle and absolute lifetimes; a device list with «sign out» per device and «sign out
  everywhere».
- **Fresh confirmation**: adding or replacing a bank token, removing a connection, inviting, changing a role,
  removing a member, exporting, deleting a household, managing passkeys — each needs a passkey confirmation at most
  10 minutes old.
- **Auto-lock**: optional, per user. After the chosen idle time the server refuses data methods on that session
  until a passkey confirmation. Enforced by the server, not by the page.
- **Cross-site requests**: `SameSite=Strict`, the `Origin` check, JSON bodies and a client header. No token in
  `localStorage`, no bearer token in JavaScript's reach.

Alternatives: passwords with a second factor (a password table to defend, reset by email anyway, phishable);
sign-in with a third-party identity (it learns who uses a finance app; can be added later without changing the
session model); email links alone (the mailbox becomes the only factor). Verdict as above.

### D5. The domain is ported into `packages/domain`, and parity is checked by machine

`packages/domain` (`@mono/domain`) is the server's domain: no NestJS, no HTTP, its own `Db` contract implemented by
`packages/db-postgres`. Its layers repeat the core's and are checked by a layer test of the same kind:

```
shared (re-exports of the core's pure modules) -> storage (Db contract, schema) -> people -> derive -> read
   -> ingest | commands -> views (the screens' read model, ported from the desktop's data process)
```

- **Imported as they are** from `@mono/core`: `shared/*`, the provider contract and registries (`providers/types`,
  `info`, `rules`, `statements`, `ids`, `statement-kit`, each bank's rules, descriptions, categories and readers),
  and the pure statistics helpers (`read/budget`, `health`, `insights`, `limits`, `masking`). A test lists the core
  modules the domain may import: none that touches the core's `Db`.
- **Ported** (the logic kept, the SQL moved to PostgreSQL, layer by layer, each with the core's tests for it):
  storage and schema, people and connections, the import (plan, commit, the loop, statement files, the bank client
  with its request slot), the derivation (transfers, refunds, categories, scope, crossing), the statistics and
  lists, the commands, and the read model.
- **Dialect rules of the port**: real `boolean` columns; unix seconds stay `bigint` and money stays integer minor
  units, as in the core, so values compare one to one; `bigint` is read as a number with a range check; the
  constructs listed in «Context» are replaced one for one; the core's migrations become one PostgreSQL baseline.
- **The parity harness**: one generated fictional data set is loaded into the core on libsql and into the domain on
  PostgreSQL; every derived column and the answer of every read are compared. It runs in CI for as long as the
  desktop's core is the reference, and it is the acceptance test of each ported layer.

Alternative: change the core so one SQL text runs on both databases and add the household to its function
signatures. It would keep the domain in one place, but it edits the desktop's dependency in about 130 places, which
the owner ruled out. Verdict: port, with the pure half shared and parity checked.

The cost, stated: a later fix to a derivation rule or a statistic is made in the domain and, if the desktop should
have it too, in the core.

### D6. Bank tokens: write-only for the API, opened by the import worker alone

- A token arrives over TLS in one request, is checked for shape (`credentialFits`), sealed to the worker's public
  key together with its household and connection ids, and stored in `control.connection_secrets`. The request body
  of that route is never logged. No method returns a token; the screens show a status.
- The opening half of the sealing module is imported only by the worker's entry. A test walks the API entry's import
  graph and fails if it can reach it — the same technique as `recategorize-safety.test.ts`.
- The worker opens a token only inside a job for that household and connection, and refuses one whose sealed ids do
  not match the job.
- Checking a new token (holder, accounts) is a job: the API answers «checking», the result arrives as an event with
  the codes the desktop uses (`auth`, `other-holder`, `already-connected`).
- Mode `once`: the token is deleted when the run that used it ends.
- Removing a connection, a member's removal, and deleting a household delete the sealed token first.

Alternatives: encrypting tokens with a key the API also holds (a compromised API reads all of them); keeping the
token in the browser and calling the bank from there (the bank allows it, but nothing runs while devices are off).
Verdict: sealed boxes.

A leaked Monobank personal token gives read access to that person's statement and balances and lets the holder set a
webhook; it moves no money. The response to a suspected leak: revoke at the bank, enter a new one.

### D7. Imports run as jobs in a separate process

- Jobs live in PostgreSQL (`pg-boss`): no second datastore. Queues: import (one active run per household),
  connection check, scheduled refresh, backups, clean-up.
- The worker runs the domain's import with a `Db` bound to the job's household, an allowlisted fetch per provider
  (a token cannot leave for another host) and, at the network level, an egress path that reaches bank hosts only.
- The bank's limit is per token and enforced by the request slot table, one slot per connection. A run is mostly
  waiting, so one worker carries many runs.
- A restart or a crash returns the job to the queue; the run continues from the coverage already committed, with
  the desktop's retry rules (first retry after a minute, then every 15 minutes, up to 4 hours of failures in a row).
- Scheduled refresh follows the desktop's auto-refresh rules (thresholds, re-reading the recent window), per
  household, with jitter.
- A bank webhook is opt-in per connection and is a **hint**: the personal API's payload is unsigned, so a hit only
  queues a short re-read of that connection (debounced); its content is never written.
- Progress is phases and counts, passed to the API through PostgreSQL notifications and on to clients as events.

### D8. Statement files are decoded in the browser; the server stores no file

`apps/web` carries its own copy of the desktop's decoder (`fflate` + `fast-xml-parser`, `pdfjs-dist`) and runs it,
with the core's readers, in a Web Worker under the desktop's limits. The server receives `ParsedStatement[]`, checks
the schema and its own limits (accounts per file, files per upload, rows, text lengths, body size), and from there
`compare` and `commit` are the domain's. Opened statements wait in memory for at most 10 minutes.

So the answer to «where are uploaded files stored» is: nowhere. Reports and exports are generated on request and
streamed; nothing is kept. Object storage is used for one thing only — encrypted backups.

Alternative: upload the file and decode on the server in an isolated process. It brings binary parsing of hostile
files and a file's transit to the server for no user benefit: a forged parsed statement can only damage the
uploader's own household, which a member may edit anyway. Verdict: decode on the client.

### D9. The frontend is its own app, started from a copy of the desktop's screens

- `apps/web` starts as a copy of `apps/desktop/src/renderer/src` and the dictionaries at a commit recorded in
  `.agents/project/web-client.md`. The desktop's files are not moved or edited. From then on the two diverge freely.
- Not copied: the PIN lock, database encryption and recovery, app update, the title bar. Replaced: the IPC bridge
  by an HTTP bridge behind the same single module (`shared/api/balance.ts` stays the only consumer, and the
  architecture test comes along); memory history by web history with the household in the path; system dialogs by
  the app's own.
- The decoder is copied into `apps/web` as the Web Worker of D8.

FSD placement of what the web adds:

| Layer | Slice | Holds |
|---|---|---|
| `pages` | `sign-in`, `invite` | sign-up / sign-in, accepting an invite (`meta.layout: 'empty'`) |
| `entities` | `session`, `household` | the signed-in user and devices; the household list and the active one |
| `features` | `auth/sign-in`, `auth/passkeys`, `auth/devices` | forms and lists; `api/` wrappers over the bridge |
| `features` | `household/switcher`, `household/members`, `household/invites` | the switcher in the sidebar header; members and invites |
| `features` | `integrations` (copied) | the upload sheet takes files from a file input and drop |
| `widgets` | `settings` (copied) | sections «Space» and «Devices»; the desktop-only sections are gone |
| `shared` | `api/http-bridge.ts`, `api/events.ts`, `lib/decoder-worker.ts` | the HTTP bridge, the event stream, the decoder worker's client |

The host: Vite, a service worker that precaches the shell and never handles `/api`, a manifest, the policy
`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self';
worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. No third-party
script, font, analytics or error reporter. Nothing financial in `localStorage`, IndexedDB or the Cache API; sign-out
sends `Clear-Site-Data`.

Live updates: a `changed` event carries the household's `data_version`; the client invalidates the read cache,
which also covers a second member or a second device.

Alternative: a shared screens package with two hosts. It keeps one set of screens but edits the desktop and ties
every web change to the desktop's build; the owner ruled it out. Verdict: copy and diverge.

### D10. The backend: NestJS on Fastify, two entry points, a layered folder rule

```
apps/server/src/
  main.ts            api entry
  worker.ts          import worker entry (application context, no HTTP)
  config/            environment schema (zod); no secret has a default
  platform/          clock, logger (codes and counts), ids
  control-db/        the control schema, migrations, repositories
  gate/              policy table, guards, zod pipe, error filter, request limits
  identity/          passkeys, email codes, sessions, devices, recovery hold, auto-lock
  households/        households, members, invites
  tenant/            binding a call or a job to one household's Db; export; deletion
  data/              call controller -> @mono/domain views and commands
  connections/       people and connections; sealing (the sealing half only)
  imports/           producer, runs, progress; worker side: runner, token opening, bank clients
  statements/        parsed statement intake
  rates/             public rates, one fetch for everyone
  events/            event streams
  hooks/             bank webhooks (hint only)
  audit/ mail/ health/
```

- NestJS holds transport, the gate and orchestration; every rule about money is in `packages/domain`, which can be
  tested without starting the application.
- Two PostgreSQL roles at run time: the API's and the worker's, neither owning tables nor able to bypass row-level
  security. Only `tenant/` creates a household-bound `Db`, and only from a household id that passed the gate (or
  from a job's own row).
- Import rules, checked by a structure test: only `worker.ts`'s graph reaches the token-opening module and bank
  clients; controllers reach the domain through `gate/` and `tenant/`; no module but `control-db/` queries the
  control schema.
- A full re-derivation is JS work over one household's rows. It runs in the worker when an import ends; after a
  statement commit it runs in the API if spike S6 shows it fits the budget, otherwise as a job.

Alternatives: Express adapter (works; Fastify's request limits and schema hooks fit the gate better); Prisma (a
heavier client, and the domain writes its SQL by hand anyway); Redis + BullMQ (a second datastore to secure and
back up for a queue PostgreSQL can hold). Verdict as listed.

### D11. Hosting: one Oracle Cloud Always Free ARM host

```
internet --443--> proxy --> api ------> postgres <------ worker --> egress proxy --> bank hosts only
                             \--> mail (codes and notices)
```

- One Ampere A1 instance within the free allowance (2 OCPUs, 12 GB), in a home region inside the EU. Images are
  built for `linux/arm64`.
- Containers: `proxy`, `api`, `worker`, `postgres`, `egress`; non-root, read-only file systems, no new privileges.
  Networks: the proxy reaches only the API; PostgreSQL is reachable only from the API and the worker; the worker
  has no route out except through `egress`, a forwarding proxy that allows the banks' host names only; the API's
  only way out is the mail service.
- Reachability: the cloud's network rules and the host firewall both allow inbound 443 (and 80 for the redirect)
  only; administration goes through a private tunnel, not an open SSH port.
- Secrets are files on the host, mounted per container (the worker's private key into the worker only); none in the
  repository, the image or the compose file. Keeping them in the provider's Vault instead is an open question.
- Mail: the provider's Email Delivery through authenticated submission, from a verified sending domain.
- PostgreSQL data on a block volume inside the free 200 GB.
- Backups: a nightly dump, encrypted on the host, sent to object storage at **another** provider; 30 days kept. The
  list of households deleted since each backup is kept beside the backups, so a restore deletes them again.
- **The host is treated as replaceable.** Oracle may reclaim an idle free instance and a free tenancy has no
  service promise, so `deploy/` rebuilds the service on a fresh host from the latest backup, and that rebuild is
  rehearsed before stage A opens. No artificial load is run to look busy.
- Logs stay on the host with rotation; operator notices go by email.

Alternatives considered with the owner: Vercel (no persistent processes or disk for the worker and the database;
ruled out), a home server (ruled out), a paid small host (the fallback if the free instance cannot be had or is
reclaimed repeatedly).

### D12. Performance: measure on generated households before stage A

- A household is small (tens of thousands of operations after 36 months). The cost centres are search over a
  household's lines and a full re-derivation, both JS work over rows.
- Every `data` index starts with `household_id`; the row-level security predicate uses it.
- Rates are fetched once for everyone; JSON is compressed; static files have hashed names and long lifetimes;
  charts load with the screens that use them.
- PostgreSQL is sized for the host's 12 GB together with the two Node processes; the numbers come from the
  measurement of task group 30, not from a guess.

### D13. The desktop is not touched

`apps/desktop`, `packages/core` and `packages/db-libsql` are not edited by this change. The desktop keeps its
releases. Whether the desktop later gets features the web gains is the owner's later decision, not planned here.

### D14. Development and the agent's boundary

- Development and CI use fictional data and throwaway keys generated at start; production secrets and data exist
  only on the host.
- The repository is public: the server's code is readable by anyone, so nothing relies on the code being secret,
  and no host address, account id or key is ever committed.
- The user adds deny rules for the server's secret and data folders to `.claude/settings.json` before the group
  that first creates them.
- New trust anchors, registered in the root `CLAUDE.md` in steps that change nothing else: the tenant isolation test; the gate's
  policy table and its test; the sealing import-graph test; the deploy workflow (actions pinned by SHA, manual
  approval, no secret outside its environment).

### Stages

- **Stage A — family instance.** Sign-up by invite only. This is the use the bank's terms name (a service for one's
  own family).
- **Stage B — public sign-up.** Opens only when all of these hold:
  1. bank access: the provider API is granted, or the bank confirms the token model in writing, or public users are
     limited to file connections;
  2. an independent security review of the server and the web client, with its findings closed;
  3. the privacy text, the terms and the agreements with the hosting, mail and backup providers reviewed by a
     qualified professional (which law applies and what it demands is their question, not this document's);
  4. bank text is encrypted by column with a key per household, and that key is held outside the database;
  5. hosting with a service promise (a free tenancy that may be reclaimed is not it), a rebuild rehearsal and an
     incident runbook exercised;
  6. sign-up and email abuse limits are in place and load was measured.

## Risks / Trade-offs

- **[The privacy promise changes]** → the web edition has its own privacy text that says what the operator can
  read; the desktop keeps its promise and stays available.
- **[A copy of the database is readable]** → the database is never reachable from outside; backups are encrypted
  before they leave; tokens are sealed; column encryption of bank text is prepared for and gates stage B.
- **[The domain exists twice]** → the pure half is shared; the parity harness compares the two on generated data;
  the cost of a double fix is stated and accepted.
- **[The port changes a figure]** → each layer is accepted only when the core's tests for it pass on the domain and
  the parity harness is green.
- **[Row-level security is bypassed by a privileged connection]** → the running roles own nothing and cannot bypass
  it; the owner role is used by migrations only; the isolation test connects as the running role.
- **[A server breach exposes many households]** → the API cannot open tokens; no statement is built from client
  text; stage B waits for an independent review.
- **[The bank refuses or sanctions the token model at scale]** → stage A is the allowed case; stage B has the bank
  gate; file connections never depend on the bank's API.
- **[Many tokens behind one address get throttled by the bank]** → unknown today; watched in stage A (few tokens),
  asked in the stage B bank contact.
- **[The free host is reclaimed, unavailable or closed]** → the host is replaceable by design; backups live at
  another provider; the rebuild is rehearsed; a paid host is the fallback.
- **[ARM-only images]** → every dependency with native code is checked on `linux/arm64` in spike S5 before it is
  relied on.
- **[A solo developer now runs a service]** → few parts (one database, no Redis, no object storage in the request
  path), runbooks in `deploy/`, automatic security updates on the host.
- **[A lost passkey]** → several passkeys per user, the recovery hold; a household with a second owner is never
  locked out by one person.
- **[Email becomes a recovery root]** → the 24-hour hold and notices; restricted sessions cannot touch tokens,
  members or exports.
- **[A webhook URL leaks]** → it is a hint: the worst case is extra re-reads, bounded by debounce and limits.

## Migration Plan

Order, each phase reviewable on its own:

1. **Spikes** (no product code): S1 row-level security with the per-transaction setting under a connection pool;
   S2 a test PostgreSQL that honours roles and row-level security, and the job queue on it; S3 the decoder in a
   browser Web Worker under the strict policy; S4 passkeys in an installed web app; S5 the stack on `linux/arm64`;
   S6 the cost of a full re-derivation on PostgreSQL.
2. **Foundations** — the contract, the PostgreSQL adapter, the schema with row-level security, the isolation test.
3. **The domain port**, layer by layer, each accepted by the core's tests and the parity harness.
4. **Server** — skeleton, identity, households, the gate, data methods, credentials, imports, statement intake,
   export and deletion.
5. **Web client** — the copy, the HTTP bridge, sign-in and household screens, statement intake, the phone layout,
   the installable shell.
6. **Operations** — images, the compose file, backups and the rebuild rehearsal, the deploy workflow.
7. **Stage A opens** on fictional data first, then the family's.

Rollback: the previous image plus the last backup; schema migrations are forward-only and each release's migration
is tried on a copy of the latest backup before it is applied. The desktop is not affected by anything here.

## Open Questions

Deferrable without changing the specs or the task order:

- The backup bucket's provider (an S3-compatible bucket outside Oracle; free allowances to be checked when choosing).
- Whether the host's secrets move into the provider's Vault in stage A or stay files.
- Whether the tenancy is switched to Pay As You Go to avoid idle reclamation (the exemption is not confirmed).
- The domain name and the web edition's name next to the desktop's.
- Whether stage A includes the bank webhook or waits (its task group is optional for opening).
- The export's file format (a passphrase-protected archive of the household's rows is the default).
