# Proposal

## Why

«Settings» shows people in «People» and their bank connections in «Connections», and the add form always starts with
«New person». Adding a second bank for someone who is already in the app looks like adding a new person, although one
person can hold several connections (core already supports it: `ParticipantChoice` takes an existing participant).
The user should see each person with their banks in one place and add a connection right to that person.

## What Changes

- One section «People and banks» replaces «People» and «Connections» in the settings menu (group «Users»).
- Each person is one block: the avatar, name, «Rename» and «Change colour» (as today), then the person's connections
  grouped by bank (a heading per bank, the existing connection rows under it: token, «Accounts», statement upload,
  remove).
- «Add connection» on a person's block: pick the bank and the way (token / file); the owner is that person and the
  «Whose» field is not shown.
- «Add person» under the list: the same add flow with a new person (name or the name from the bank, colour), as the
  current add form does for «New person». A person is still created only together with a first connection.
- «History download» (`ImportFeature`) stays in the same section, below the people, and `importLink` still scrolls to
  it and passes its date.
- Old links with `section=connections` open the new section (the home «Enter token» link, `importLink`, anything saved).
- `CHANGELOG.md`, new section `## 0.1.11 — unreleased`: «Settings: people and their bank connections are now in one
  section «People and banks»; add a bank to someone who is already in the app with «Add connection» on their card».

Out of scope: people without connections; moving a connection from one person to another; merging people; changes to
`packages/core`, IPC, main or the import worker; the home screen and the quick upload flow; a visual redesign (only the
existing `shared/ui` and `shared/layout` components).

Affected: `apps/desktop` renderer only (features `integrations`, `settings/people`, widget `settings`, `shared/config`,
dictionaries, renderer tests). Not affected: `packages/core`, `packages/db-libsql`, `apps/mcp`, main, preload, IPC
contract. No trust anchor changes. User-visible: yes (CHANGELOG entry above).

## Capabilities

### New Capabilities
- `desktop-people-connections`: the settings section that lists people with their bank connections, adds a connection
  to a chosen or a new person, and hosts the history download.

### Modified Capabilities

## Impact

- `shared/config/settings.ts`: `SETTINGS_SECTIONS` loses `connections`; `settingsSection` maps `connections` → `people`;
  `importLink` uses `people`.
- `widgets/settings`: `NAV_GROUPS`, the composition (`PeopleConnectionsFeature` + `ImportFeature`).
- `features/integrations`: new `PeopleConnectionsFeature`, `PersonBlock` moved in from `features/settings/people`,
  `AddConnectionFeature` takes an optional fixed `personId`; `ConnectionsFeature` removed.
- `features/settings/people`: removed (its actions move with `PersonBlock`).
- `widgets/home-notices`: the «Enter token» link → `section=people`.
- Dictionaries uk/en/ru; tests `tests/renderer/settings.test.ts`, `people.test.ts`, `import-history.test.ts`.
