# Proposal

## Why

The desktop app keeps one household's money on one computer. That rules out what the product now needs most: the
same data on a phone, two or more people working in one shared space under their own sign-ins, and an import that
keeps running while no computer is on. A web version — its own backend (NestJS + TypeScript, PostgreSQL) and its own
installable frontend (PWA) — answers all three. From here on the web version is where the product is developed.

It is feasible, with three conditions that shape the plan (analysis in `design.md`):

1. **The bank's terms.** Monobank's personal API may be used on a server only for one's own family; a service that
   receives other clients' data on its servers must use the provider API, which needs the bank's approval. So the
   server is built multi-tenant from day one but opens in two stages: an invite-only family instance first, public
   sign-up only after the gates in `design.md` («Stages») are passed.
2. **The privacy promise changes.** «Nothing leaves your computer» is the desktop's promise, not the web's. The server
   sees the data while it works on it, and a copy of its database is readable by whoever runs the host. The design
   keeps the damage of a breach as small as it can be made and says plainly what it cannot prevent.
3. **A separate product.** The desktop stays as it is and is not touched by this work. The web version copies what it
   needs and then goes its own way; the part of the domain that is tied to SQL is ported to PostgreSQL, so it exists
   twice from now on.

## What Changes

- **`packages/domain` (new):** the server's domain on PostgreSQL, free of NestJS — the port of the core's storage,
  people, derivation, statistics and import, and of the read model behind the screens. Every data table carries its
  household, and the database itself refuses rows of another household. It imports the core's pure modules (banks'
  rules and statement readers, money, periods, currencies) as they are.
- **`packages/db-postgres` (new):** the PostgreSQL adapter that binds every transaction to one household.
- **`packages/contract` (new):** the method list, argument schemas and view types shared by the server and the web
  client.
- **`apps/server` (new, NestJS):** sign-in with passkeys and sessions; households with members, roles and invites; a
  gate in front of every data call (session → membership → role → arguments); background imports from bank APIs in a
  separate worker process that alone can open bank tokens; live events to the clients.
- **`apps/web` (new, Vue PWA):** its own frontend. It starts as a copy of the desktop's screens at a recorded commit,
  talks HTTP instead of IPC, and adds sign-in, the household switcher, members and devices; installable on a phone; a
  phone layout; nothing financial stored on the device; statement files decoded in the browser, so a raw file never
  reaches the server.
- **Operations:** one Oracle Cloud Always Free ARM host (reverse proxy, API, import worker, PostgreSQL), encrypted
  off-site backups with a rehearsed rebuild of the host, logs and an audit trail that carry codes and counts only.
- **Stages:** stage A — invite-only family instance; stage B — public sign-up, behind the gates in `design.md`.

Out of scope:

- Any change to `apps/desktop`, `packages/core`, `packages/db-libsql` or `apps/mcp`. The desktop keeps its code, its
  local database, its lock and its releases. A core change the web needs later (a new bank, a reader fix) is its own
  change with the core's tests.
- One SQLite database per household on the server (decision D1 records why it was considered and what choosing
  PostgreSQL costs).
- End-to-end encryption where the server cannot read the data, and encryption of bank text by column (decision D2:
  the second is prepared for, and is a stage B gate).
- The provider (corporate) bank API, open banking / PSD2 aggregators, payments of any kind. The credential model
  leaves room for them; applying to the bank is a stage B gate, not code in this change.
- Native mobile apps; push notifications; an AI mode; billing.
- Moving a desktop database to the web.

## Capabilities

### New Capabilities

- `server-identity`: who a user is and how a device stays signed in — passkeys, one-time email codes, sessions,
  the device list, fresh confirmation before sensitive actions.
- `server-households`: shared spaces — a household, its members and roles, invitations, the link between a member and
  a person of the household, leaving and removal.
- `server-tenant-storage`: where a household's data lives — every row owned by one household, isolation enforced by
  the database, encryption at rest and its limits, export and deletion.
- `server-bank-credentials`: how a bank API token is taken, kept and used — write-only for the API, readable by the
  import worker alone, never shown again, removed on demand.
- `server-bank-import`: imports that run on the server — the queue, one run per household, retries, scheduled
  refreshes, bank webhooks as hints, progress events.
- `server-statement-intake`: statement uploads on the web — parsed in the browser, checked on the server, compared and
  written by the domain's rules, the raw file kept nowhere.
- `server-api-gate`: the one path every client call takes — the closed method list, the order of checks, error codes,
  request limits, which answers may carry bank text.
- `server-operations`: running the service — the network boundary, logs and the audit trail without personal data,
  backups and rebuilding the host, closed or open sign-up, what the agent and CI can reach.
- `web-client`: the browser edition of the app — the screens over HTTP, installable, a phone layout, live updates,
  nothing financial kept on the device, the content security policy.

### Modified Capabilities

None. No existing capability's requirements change: the desktop and the core are not edited.

## Impact

- **New:** `packages/contract`, `packages/domain`, `packages/db-postgres`, `apps/server`, `apps/web`; a `deploy/`
  folder (container images for `linux/arm64`, the compose file, runbooks).
- **Unchanged:** `apps/desktop`, `packages/core`, `packages/db-libsql`, `apps/mcp`, the release workflow.
- **Duplication, on purpose:** the SQL-bound half of the domain (about 132 statements in about 35 core files, 23
  migrations) and the read model (`apps/desktop/src/data`, about 3100 lines) are ported, not shared; the screens are
  copied. A parity harness compares the server's figures with the core's on the same generated data. A later fix to
  a derivation rule is made in both places if the desktop needs it too.
- **New dependencies:** server — NestJS with the Fastify adapter, `pg` and Drizzle (schema and migrations),
  `pg-boss` (jobs in PostgreSQL), `@simplewebauthn/server`, `libsodium` (sealed boxes); web — `vite-plugin-pwa`,
  `@simplewebauthn/browser`, and the desktop decoder's `fflate`, `fast-xml-parser`, `pdfjs-dist`. Each is added in
  the task group that first needs it.
- **Trust anchors:** the existing four are not touched. The change **adds** anchors, registered in the root
  `CLAUDE.md` in steps that change nothing else and reported on their own: the tenant isolation test, the gate's policy table and its
  test, the credential sealing test, the deploy workflow. `.claude/settings.json` gains deny rules for the server's
  secrets and data folders — that file is edited by the user only; the task hands them the exact lines.
- **User-visible:** not for the desktop — no `CHANGELOG.md` entry. The web edition is a new product with its own
  release notes (`docs/web/CHANGELOG.md`, created in the group that prepares stage A), flagged for human review
  before anything is published.
- **Guarantee that stays:** the agent sees neither real data nor a token. Production secrets and data live only on
  the host; development and CI run on fictional data.
