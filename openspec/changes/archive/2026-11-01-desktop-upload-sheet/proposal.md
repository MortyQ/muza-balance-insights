# Proposal

## Why

Statement upload was built around one file bank (PrivatBank). Every bank to come works by statement file (CSV, XLSX), so
the flow has to scale to many banks and accounts. Today it does not:

- one file at a time;
- a file goes to a connection, not to an account, so with several connections of a bank the user picks by hand;
- a new bank needs a connection made beforehand;
- «Данные по банкам» is a flat list headed by the one bank that is behind. Its file rows carry a full-width
  «Загрузить выписку» button that breaks the row.

## What Changes

- **Upload sheet.** «Upload statement» and a file dropped on the window open a sheet over the current screen, not a
  centred dialog. The sheet takes several files at once and shows one card per account found in them:
  - the bank, the card's last four digits and the period;
  - the person, prefilled;
  - «N new, M already there».
  
  One «Import» writes every card that is ready. A file no reader knows becomes a grey card, «Format not recognised»,
  and is skipped. The other cards are not affected.
- **The account decides where a file goes.** The app looks for a file account across every file connection of its
  bank, by its IBAN or card number:
  - a match → that connection and its person, with no question asked;
  - no match → the card asks «Whose account?». Picking a person adds the file to that person's connection of this bank,
    or creates one for them right in the sheet (named after the bank). No trip to «People and banks».
  
  This replaces the per-connection pick of `desktop-statement-upload`.
- **«Data by bank» panel.** The list is grouped by person, as in «People and banks». Each row shows:
  - the bank and the way (token or file);
  - «up to <date>» — coverage stays the end date only, no gap intervals;
  - one compact action: «Refresh» for a token connection, «Upload from <date>» for a file connection.

  «Upload from <date>» opens the sheet bound to that connection: the dialog asks for its bank's files, and the
  sheet says which date the file should start from. The trigger shows the overall state: the date alone when nothing
  is behind; «<bank>: up to <date>» for one bank behind; «N banks behind» for several. Under the list:
  - «Add bank» lists the banks the app knows, each with how it connects;
  - «Upload statement».
- **Banks come from the registry.** The bank list, the file extensions the dialog accepts and «Add bank» come from the
  bank registry. Each file bank also gets a one-line hint on where to download its statement (a dictionary key per
  bank). A new file bank adds its reader, its look and its hint, and no screen code.
- `CHANGELOG.md`, next unreleased version (0.1.11):
  - «Upload several statements at once: the app finds each card's bank and owner by itself, and adds a new bank right
    in the upload»;
  - «"Data by bank" groups banks by person and shows what to upload from which date».

Out of scope:
- gaps in coverage (only «up to <date>»);
- new bank readers (each bank's own change);
- uploads while the app lock is closed;
- reminders;
- the per-connection upload in «People and banks», which stays as it is;
- token connections in the sheet (a token bank's file stays a check that is never written, as today).

Affected:
- `apps/desktop`: the main statements service, the IPC contract, the preload and the renderer;
- `packages/core`: none expected — the account match by IBAN or card is in `compareStatement` already. If the
  cross-connection lookup needs a core query, it is added in `read/`.

Not affected: `apps/mcp`, `packages/db-libsql`. No trust anchor changes. User-visible: yes (CHANGELOG entries above).

Precondition: `desktop-quick-statement-upload` and `desktop-data-freshness` are archived first. They are implemented,
and each has only its final test run left. This change's deltas modify their specs.

## Capabilities

### New Capabilities

### Modified Capabilities
- `desktop-statement-upload`: several files; the account, not the connection, decides the target; a new bank's
  connection is made in the sheet; the sheet replaces the dialog; an upload can be bound to one connection.
- `desktop-data-freshness`: the list is grouped by person; each row's action names its start date; the trigger
  summarises; «Add bank» and «Upload statement» go under the list.

## Impact

- Main: `src/main/statements.ts`:
  - keeps up to 12 opened files at once (now one);
  - `openAny` takes several dropped paths or a multi-select dialog and returns one entry per file;
  - a new `resolve` step matches each account to a connection of its bank;
  - `commit` writes per connection, all accounts or none per file.
- IPC (`src/shared/api.ts`, `channels.ts`, `ipc-args.ts`, `src/main/ipc.ts` gates): the open, assign and commit
  methods change shape, and a create-connection-from-statement call is added. The preload still passes paths only,
  never to the renderer.
- Renderer:
  - `shared/ui`: a sheet overlay (`VSheet`, from muzakit if it has one);
  - `features/integrations/quick-upload`: rewritten around cards;
  - `widgets/global-filters`: `FreshnessList` and `SyncStatus`;
  - `entities/bank`: a statement hint key per bank;
  - dictionaries in uk, en and ru.
- Docs: `.agents/project/desktop-import.md` (the statement IPC), `.agents/project/desktop-security.md` (several
  dropped paths), `CLAUDE.md` (the home filters paragraph).
