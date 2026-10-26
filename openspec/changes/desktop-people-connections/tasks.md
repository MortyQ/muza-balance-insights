# Tasks

## 1. One section id and the links

- [x] 1.1 `shared/config/settings.ts`: drop `connections` from `SETTINGS_SECTIONS`, `settingsSection('connections')` → `people`, `importLink` → `section=people`; `widgets/home-notices` «Enter token» link → `people`; verify `tests/renderer/settings.test.ts` (menu order, old link) and `import-history.test.ts`

## 2. The merged section

- [x] 2.1 Move `PersonBlock`, `usePeopleActions`, `usePeopleRequest` and their types into `features/integrations/people/`; remove `features/settings/people` and its export
- [x] 2.2 `connectionsByBank(person)` in `features/integrations/utils.ts` (banks in `BANKS` order); unit test
- [x] 2.3 `AddConnectionFeature`: optional `personId` (owner fixed, «Whose» and new-person fields hidden) and a fixed-new mode for «Add person»; `useConnectionOwner` takes the initial choice; verify the owner sent to `addConnection` in a renderer test
- [x] 2.4 `PeopleConnectionsFeature`: people blocks with connections by bank, per-person «Add connection», «Add person», one open add panel, the success notice in its block, the empty state; remove `ConnectionsFeature`
- [x] 2.5 `widgets/settings`: `NAV_GROUPS` (one «People and banks» item), compose `PeopleConnectionsFeature` + `ImportFeature` for `people`
- [x] 2.6 New keys in `uk.json`, `en.json`, `ru.json` (section title/description/note, «Add person», nav label); drop the unused `settings.nav.connections` and old section texts; `tests/i18n.test.ts`
- [x] 2.7 Renderer tests: `people.test.ts` / `settings.test.ts` for the merged section (two banks under one person, add to an existing person, add a new person)

## 3. Docs and release notes

- [x] 3.1 Root `CLAUDE.md` «Settings screen» notes: one section instead of «Люди» and «Подключения»; `.agents/project/desktop-import.md` if it names the connections section
- [x] 3.2 `CHANGELOG.md`: create `## 0.1.11 — unreleased` with the entry from the proposal
- [x] 3.3 `docs/backlog.md`: check the merged section on a live system with several people and banks
- [x] 3.4 Run `pnpm test` and `pnpm typecheck` at the root
