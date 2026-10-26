# Design

## Context

Follows `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", interface texts), `.agents/project/core-people.md`
(participants → connections; an empty participant is deleted with its last connection) and
`.agents/project/desktop-import.md` (the history download). The root `CLAUDE.md` «Settings screen» notes describe the two
sections being merged; that block is updated in the same change.

Today: `PeopleFeature` (`features/settings/people`) lists people with rename and colour; `ConnectionsFeature`
(`features/integrations`) lists connections in one `SettingsList` per person and has one «Add connection» panel whose
`AddConnectionFeature` asks «Whose» with `'new'` preselected (`useConnectionOwner`). The widget composes
`ConnectionsFeature` + `ImportFeature` for `section === 'connections'`.

## Goals / Non-Goals

Goals: one people-first section; connections drawn by bank under their person; adding a connection to a given person in
one step; the history download and every link into it keep working.

Non-goals: no core, IPC or main changes; no person without a connection; no reassigning connections; no new visual
language.

## Decisions

### D1. One section id: keep `people`, retire `connections`
`SETTINGS_SECTIONS` drops `connections`; `settingsSection('connections')` returns `people`, so old links and the
history-download link keep landing in the right place. `importLink` emits `section=people`.
Alternative — a new id (`people-banks`): every link and test changes and both old ids need aliases. Rejected.

### D2. FSD placement: the merged section lives in `features/integrations`
New `features/integrations/PeopleConnectionsFeature.vue` (public via `index.ts`). `PersonBlock`, `usePeopleActions` and
`usePeopleRequest` move from `features/settings/people` into `features/integrations/people/` (components, composables,
api); `features/settings/people` and its `PeopleFeature` export are removed. The widget renders
`PeopleConnectionsFeature` then `ImportFeature` for `section === 'people'` (the same composition the connections section
has today).
Alternative — compose people and connections in `widgets/settings`: a person's block would have to slot rows from
another feature per person and own the add panel's state, i.e. feature logic in a widget. Alternative — keep two
features and import one into the other: features must not import sibling features. Verdict: one feature.

### D3. Person block layout
`PersonBlock` keeps its header (avatar, name, «Rename», «Change colour», expanding panels) and gets a default slot under
it. `PeopleConnectionsFeature` fills it: for each bank of the person (order of `BANKS`), a `SettingsList` with the bank's
name as `heading` and that bank's `ConnectionRow`s; then an «Add connection» link button. Each person is one bordered
block (`SettingsList` of one `PersonBlock`, as now), with the banks' lists nested inside it. Grouping is a pure helper
`connectionsByBank(person)` in `features/integrations/utils.ts`.

### D4. Add flow for a given person
`AddConnectionFeature` gets `personId?: number`. When set, `useConnectionOwner` starts with that id and the «Whose»
select, the new-person fields and the colour are not rendered; the owner is `{ participant: id }` as the select would
give. One add panel is open at a time, keyed by the person (or `'new'` for «Add person»); it reuses the existing panel
(title, cancel, `BankPicker`, «Other bank»). «Add person» opens it without `personId` and with «Whose» hidden too, the
choice fixed to `'new'` — the select would offer existing people, which is what the per-person button is for.
The success notice («Connection added», or the import-running variant) shows under the person it was added to.

### D5. Empty state
No people → the section's empty text and «Add person». The first-connect screen (`ConnectFirstFeature`) is untouched.

## Risks / Trade-offs

- Long section for many people with many banks → each person's block is compact; the history download stays last.
  Accepted.
- Removing a person's last connection removes the person (core rule): the block disappears after refresh. The remove
  confirmation text says so when it is the last connection (new key).

## Migration Plan

Renderer only, no data migration. Saved/old `section=connections` links resolve to `people` (D1).

## Open Questions

- The section's name: «People and banks» (proposed) vs «People and connections». Decided at review.
