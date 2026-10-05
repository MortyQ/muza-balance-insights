# muza-balance-insights (local folder: monobank-mcp)

A local stdio MCP server: Monobank transactions → SQLite → ready-made spending aggregates. Next: an Electron desktop app.

@.agents/claude/behavior.md

## Monorepo layout (pnpm workspace)

- pnpm 12.6.0 is installed globally via npm (`packageManager` in the root `package.json`); Corepack is not used.
  Node: `.nvmrc` (22).
- `packages/core` (`@mono/core`): the platform-independent core — bank providers (Monobank for now), sync, categories,
  transfers, refunds, scope, aggregates, migrations and the `Db` interface. No Node, browser or globals: `fetch`, the
  clock, the logger and ids are passed in (`packages/core/src/platform.ts`). Checked by `packages/core/tests/purity.test.ts`
  and the core's `tsconfig.json` (`lib: ES2023 + WebWorker`, `types: []`). Runtime dependencies: only `zod` and
  `@date-fns/tz`. Exports are TS sources per module: `@mono/core/<module>` → `src/<module>.ts`, no build step.
  Domain tests live in `packages/core/tests` and run on the Node adapter (a devDependency).
- `packages/db-libsql` (`@mono/db-libsql`): the Node libsql adapter → `Db` (PRAGMA, WAL). It does not depend on core
  (the types are repeated; a mismatch fails the core's typecheck), so there is no dependency cycle. Used by apps/mcp and
  the Electron main process.
- `apps/mcp` (`@mono/mcp`): the MCP server, CLI, scripts, the anonymised copy (`analysis/*`), `.env` / the token (`config.ts`).
- `apps/desktop` (`@mono/desktop`): stage 1, Electron.
- `data/`, `.env`, `analysis/`, `reports/`, `docs/` are at the repo root (`REPO_ROOT` in `apps/mcp/src/paths.ts`).
- Root scripts: `test`, `typecheck` (`pnpm -r`) and `q`. No other root proxies.
- CLI arguments go through `cliArgs()` (`apps/mcp/src/args.ts`): pnpm passes `--` to the script as is;
  `apps/mcp/tests/cli-args.test.ts` checks this against real pnpm.

## Trust anchors

The files that hold the guarantee "the agent sees neither real data nor the token":

- `apps/mcp/package.json`, the `scripts` block: exactly what runs under each name, including `recategorize` outside the
  sandbox;
- `apps/mcp/tests/recategorize-safety.test.ts`: the test `recategorize` runs as its first step;
- `.claude/settings.json`: allow/deny, sandbox and `excludedCommands` (edited by the user only);
- `.github/workflows/release.yml`: what is built and published under the author's name. Its guarantees are checked by
  `apps/desktop/tests/release-workflow.test.ts` (actions pinned by SHA, permissions, triggers, draft only; the description from the version's `CHANGELOG.md` section; one secret —
  `UPDATE_SIGNING_KEY`, only in the `release` Environment with manual approval and only in the `update-sign.mjs` steps).
  The public half of the key is `apps/desktop/src/main/update/public-key.ts`: changing it = installed copies reject updates.

Rules:
- any change to them is a separate item in the report: what changed and why;
- such changes are never mixed with others in one step. First a separate step that edits the anchor and verifies it,
  then the rest of the work;
- weakening a check (removing an assertion, widening allow, narrowing deny) only after the user's explicit ok.

## Working with real data

- Real commands are run by the user only: `pnpm --filter @mono/mcp <command>` for `sync`, `accounts`, `dev:mcp`,
  `export:analysis`, `overrides:*`, `scope-overrides:*`, `settings:*`, `verify:merchants` (the output of
  `overrides:candidates` contains real counterparty names). Do not run them and do not suggest running them via `!`:
  the output of `!` commands lands in the agent's context. There are no root proxies for them and there won't be: every
  extra way to invoke them is another hole in the deny rules.
- `pnpm --filter @mono/mcp recategorize` is run by the agent itself when needed (exactly this command, no arguments, as a
  separate call: it is outside the OS sandbox via `sandbox.excludedCommands`, everything else is sandboxed). Rules:
  - the recategorize code and everything it imports (`apps/mcp/src/cli/recategorize.ts` → `apps/mcp/src/rederive.ts` →
    `packages/core/src/rederive.ts` → …) does not read `.env`, does not import `config.ts` and does not call `getToken`;
    the DB path comes from `apps/mcp/src/paths.ts`, `MONO_DB_PATH` from the environment only;
  - output is aggregates and diagnostics only: no `description`, `counter_name`, `comment`, `iban`, `masked_pan`;
  - both rules are checked by `apps/mcp/tests/recategorize-safety.test.ts` (the import graph through workspace packages by
    their `exports`, statically and by a run with canaries); it also runs as the script's first step
    (`vitest run … && tsx …`), with no pre/post scripts;
  - changing what it prints only after the user's ok.
- There is no access to `data/`, `*.db`, `*.db-*`, `.env`, `.env.*`, and there won't be.
- Data queries only through `pnpm q analysis/queries/<name>.sql`: the agent writes the SQL to a file in
  `analysis/queries/` (ignored in `.gitignore` together with `analysis/`); no SQL on the command line, so no false matches
  with the deny rules. `q.ts` checks the path (only `.sql` inside `analysis/queries/`, no symlinks out). File names must
  not contain words from the deny rules (`sync`, `accounts`, `settings` …). q reads only the anonymised copy
  `analysis/analysis.sqlite` (read-only, one SELECT/WITH, at most 500 rows). The user rebuilds the copy
  (`pnpm --filter @mono/mcp export:analysis`); it is also rebuilt automatically after sync and recategorize.
- What the copy holds: only the columns in the whitelist `apps/mcp/src/analysis/schema.ts`. `description` is masked
  (`packages/core/src/masking.ts` → the provider's `maskDescription`): service templates as is, a jar's name → `[jar]`,
  everything else → `[other]`, plus `desc_class` by the shape of the line. Instead of `counter_name` — the `has_counter`
  flag. An account has `participant_id` (a number; the participant's label does not go into the copy).
  A new column or template goes into the whitelist / masking only after the user's ok.
- Access is further restricted by `permissions.deny` and the sandbox in `.claude/settings.json`. Do not try to get
  around either.

## Process

- Work goes in phases with stops. A plan first; code only after the user's explicit «ок» (ok).
- Before handing over: `pnpm test` and `pnpm typecheck` (at the root, `pnpm -r`).
- **English only in the repository**: code comments, docs, agent instructions (`CLAUDE.md`, `.agents/`), specs, plans,
  briefs, reports, the backlog, commit messages and PR texts — no Russian (or Ukrainian) anywhere but the UI
  dictionaries. A screen or button is named by its English UI text (`en.json`) in «», or by its dictionary key. Chat
  replies to the user are not covered by this rule.
- **Every UI text goes through i18n**: no literal text in a template or in renderer code — `$t('key')` in templates,
  `t('key')` from `@/shared/lib` in script code. A new text is a key in `uk.json` (the reference) and, in the same
  change, in `en.json` and `ru.json`. Details: «Interface texts» in `.agents/project/desktop-renderer.md`.
- `CHANGELOG.md` (**English**, for users; it is the release description): every user-visible change (new feature,
  changed behaviour, notable fix) goes there in the same work, under the **next** unreleased version — the one after
  `apps/desktop/package.json` (0.1.3 there → write into 0.1.4; no such section yet → create it as
  `## <version> — unreleased`). The version bump at release time makes it the released one: `unreleased` → the date
  (`## 0.1.4 — 2026-10-01`); the release refuses a tag whose section is missing or still `unreleased`. Plain English, no
  internal terms (files, IPC, libraries, tests); screen and button names as in the English UI (`en.json`), in «»; security only in
  terms of what it protects. Internal-only changes (tests, refactors, docs for agents) do not go there.

## Where the other rules are

Details per part of the project live in `.agents/project/`. They are pulled in by the `CLAUDE.md` files in the package
folders and load by themselves when Claude works with files in that folder. If a task touches a part whose files have not
been opened yet, read the relevant file yourself before editing.

| File | Read when | Pulled in by |
|---|---|---|
| `.agents/project/core-providers.md` | bank providers, the domain boundary | `packages/core/CLAUDE.md` |
| `.agents/project/core-people.md` | participants, connections, `runPlans`, the order of import windows | `packages/core/CLAUDE.md` |
| `.agents/project/domain-rules.md` | categories, transfers, refunds, fees, scope, aggregates, `search`, `findRecurring` | `packages/core/CLAUDE.md`, `apps/mcp/CLAUDE.md` |
| `.agents/project/mcp-server.md` | MCP tools, the response format | `apps/mcp/CLAUDE.md` |
| `.agents/project/reports.md` | **before any report** in `reports/` | `apps/mcp/CLAUDE.md` |
| `.agents/project/desktop-app.md` | name, `appId`, userData, menu, icon, installers, release, auto-update | `apps/desktop/CLAUDE.md` |
| `.agents/project/desktop-security.md` | CSP, fuses, network, app lock, database encryption, «Удалить все данные» | `apps/desktop/CLAUDE.md` |
| `.agents/project/desktop-import.md` | the import worker, retries, tokens, IPC for people and connections | `apps/desktop/CLAUDE.md` |
| `.agents/project/desktop-renderer.md` | FSD, "`shared/ui` first", styles, navigation | `apps/desktop/src/renderer/CLAUDE.md` (with the muzakit instructions) |
| `docs/backlog.md` | plans and what has not been checked on a live system | — |
| `CHANGELOG.md` | what users get in each version; the release description (rule in "Process") | — |

## From the settings-ui branch (rebased onto main 27.09.2026, to review)

Merged from `settings-ui` (title bar, theme, language, settings redesign) and adapted to the settings domain of main.
Kept apart from the rules above until reviewed; move each item to its `.agents/project/` file once accepted.

- **Window title bar** — our own (`titleBarStyle: 'hidden'` on every OS, `frameOptions` in `apps/desktop/src/main/window.ts`).
  Windows/Linux: native buttons over our strip (`titleBarOverlay`, colours = `--background` / `--foreground` of `theme.css`
  in hex, checked by `tests/window.test.ts`; main repaints them on a theme change via `nativeTheme` → `setTitleBarOverlay`);
  Linux also `autoHideMenuBar`. macOS: traffic lights, title centred. Height — `TITLE_BAR_HEIGHT`
  (`src/shared/titlebar.ts`, 36 px). The strip is `widgets/app-header` (`AppHeader`) over every screen (`App.vue`; only the
  screen under it scrolls, so pages use `min-h-full`, not `min-h-screen`): logo and name, gear → settings. The gear is
  hidden on the lock and «База недоступна» screens (the router would send settings back there anyway). The menu object
  stays (shortcuts) and is not shown on Windows/Linux. Home: `widgets/global-filters` (`GlobalFilters`) — the
  filters every home block reads (`ParticipantFilter`, `MonthFilter`, `CurrencyToggle`) and the sync status. It sits
  outside the default layout's own scroll area (the layout is a column: the filters, then a scroll area with the grid),
  so it never scrolls and the scroll bar starts under it. Month and currency on the left, the sync status on the right; the person switch is buttons centred
  in the row while there are at most `MAX_PARTICIPANT_BUTTONS` (4) people and they fit (`useParticipantLayout`:
  `ResizeObserver` on the row, the month with the currency, the sync status and a hidden copy of the buttons; `fitsCenter`), otherwise a
  `VSelect` before the month (`ParticipantFilter` `mode`).
- **Theme** — in main: `nativeTheme.themeSource` = `system | light | dark` (`src/shared/theme.ts`, default `system`), set
  before the window. The frame, native dialogs and menus and the page's `prefers-color-scheme` follow it. IPC
  `getTheme` / `setTheme`.
- **Language** — `src/shared/locale.ts` (`uk | en | ru`, `resolveLocale`: the first system language we have, else `en`);
  the saved choice (`preferences.json`) wins. IPC `getLocale` / `setLocale`; `getLocale` also passes a closed lock and a
  database that is not ready (the lock and recovery screens speak the language). The renderer loads it before the first
  screen (`loadLocale`) and switches at once on a choice (`applyLocale`, also sets `<html lang>`). Data for the select —
  `features/settings/language-select` (`LANGUAGE_OPTIONS`: own name + ISO country of the flag, not emoji; `useLocale`).
  The «Language and time» section (`LanguageSelectFeature`, section `language`): one «Language» row with `VSelect`,
  languages by their own names, no flags yet (no flag icons in the project); applies at once, main rebuilds the menu.
  The time part of the section is still to come.
- **Dictionaries** — `src/shared/i18n/{uk,en,ru}.json` (shared by main and renderer), vue-i18n syntax; `uk.json` is the
  reference (`Messages`, `MessageKey` in `src/shared/i18n/index.ts`); `tests/i18n.test.ts` checks the same keys,
  placeholders and plural forms. Renderer: vue-i18n 11 (`shared/lib/i18n.ts`, Composition API, typed keys — an unknown
  key fails `vue-tsc`), fallback `uk`. It compiles messages at run time without `new Function`, so the prod CSP (no
  `unsafe-eval`) holds; `tests/i18n.test.ts` scans every vue-i18n / @intlify build for `new Function` and `eval`.
  Renderer tests read texts in Russian (`tests/renderer/setup-locale.ts`). Main reads the same dictionaries without
  vue-i18n (`src/main/i18n.ts`, `translator(locale)`): keys `main.*` (menu, confirmation dialogs, the Touch ID reason)
  and `common.disclaimer` (About), plain text only (`tests/main-i18n.test.ts`); the language is read at each use and the
  menu is rebuilt on `setLocale`. Errors that reach the screen travel as codes, the renderer words them: update —
  `UpdateError` (`settings.update.error.*`), import — `ImportError` (`WORKER_ERRORS` + `no-token`, `crash`;
  `home.import.error.*`); the worker protocol carries no error text. Internal errors (IPC refusals, `TokenError`,
  network policy) are English and never shown.
- **Preferences** — `userData/preferences.json` (`src/main/prefs.ts`): `updateChecks`, `autoSync`, `theme`, `locale`.
  Reading forgives each field on its own; writing (`updatePrefs`, one at a time) is strict: an invalid value throws and
  nothing is written.
- **Settings screen** — the menu on the left (`SideNav` from `shared/layout` with `NAV_GROUPS` of `widgets/settings`,
  groups «Пользователи → Безопасность → Приложение») and one section on the right; the section is `query.section` of
  the `settings` route (`SETTINGS_SECTIONS` / `settingsSection` in `shared/config`, unknown → `people`; the menu order
  equals `SETTINGS_SECTIONS`, checked in `tests/renderer/settings.test.ts`). `widgets/settings` holds the menu and the
  section map; «О программе» is its component (`components/AboutApp.vue`); the page is a thin shell. Sections:
  - Пользователи: «Люди» (`PeopleFeature`), «Подключения» (`ConnectionsFeature` from `features/integrations`, badge
    `tokenBadge`, adding; then «History download» — `ImportFeature` from `features/import-statement`, composed in the
    widget: a list per bank (Monobank only for now), quick picks `IMPORT_PRESETS` + «From date» (`VDatepicker` with
    `min` / `max`), always up to today. The range rule is `src/shared/import-range.ts` (`isImportFrom`: from 36 months
    back to today in the system time zone), shared by the screen and main: IPC `startImport(from)` takes a real `YYYY-MM-DD`, the
    `Importer` throws on a date out of range. No arbitrary end date: coverage is one span per account (`sync_state`));
  - Безопасность: «Блокировка» (`AppLockSettingsFeature`), «Хранение и токены» (`StorageInfoFeature`; the
    `DbEncryptionFeature` row goes into its list through a slot), «Сеть» (`NetworkInfoFeature`; hosts — IPC
    `getTrustedServices` from `TRUSTED_SERVICES`, texts — `SERVICE_TEXT`; the database path is not shown), «Данные»;
  - Приложение: «Автосинхронизация» (`AutoSyncSettingsFeature`), «Обновления», «Оформление» (`ThemeSwitchFeature`),
    «Language and time» (`LanguageSelectFeature`), «О программе».
  Links from home open their section: «Ввести токен» → `connections`, the lock hint → `lock`. The history download is
  reached by `importLink(from?)` (`shared/config`: `section=connections`, `focus=import`, optional `from`); the page
  reads it back with `importRequest` and the section scrolls to itself, focuses and takes the date. Home has no import
  block: `widgets/home-notices` shows «No data yet» → «Download history» while nothing is imported (a line instead while
  the user's import runs), and, for a month picked before `dataFrom`, «{month}: no data yet» → «Download» from that
  month (`emptyMonth`). For that the month filter's lower bound is the import's floor month, not the first data month.
- **Section layout** — `shared/layout` (`@/shared/layout`): `SettingsSection` (title, description, closing note),
  `SettingsList` (the bordered list, optional heading), `SettingsRow` (title + hint, control on the right; `labelFor` makes
  the text the control's label). Every section uses them — the settings domain, `features/integrations` («Подключения»)
  and the settings widget («О программе»).
- **Side menu** — `SideNav` in `shared/layout`: a dumb component over a config (`SideNavGroup` / `SideNavItem`: optional
  group title, item `id`, dictionary key, icon; `id: null` → disabled with «Soon»), `current`, `select`; arrows walk the
  items (`nextItem`), roving tabindex. A column on wide windows (sticky at `--side-nav-top`, default 1.5rem), a strip on
  top below 45rem. Used by settings (`NAV_GROUPS`) and the default layout (items from the routes' `meta.nav`: «General» =
  `home`, «Analytics» = `analytics`, a placeholder for now).
- **Layouts** — `app/layouts` (as in so-platform's insights-client): `App.vue` = `AppHeader` + `MasterLayout`, which
  picks the shell by the route's `meta.layout` (`layoutOf`, absent → `default`; `LayoutName`, `RouteMeta` augmented in
  `app/layouts/types.ts`). `DefaultLayout` — the data screens: pinned `GlobalFilters`, then a scroll area with the
  settings grid: `SideNav` on the left (`useNav`: `navGroups(router.getRoutes())` — routes with `meta.nav { label, icon,
  order }`; current = the open route, a pick pushes it), the screen on the right. `EmptyLayout` — the screen alone (lock,
  recovery, connect, settings: `meta.layout: 'empty'`). The routes are `app/router/routes.ts`. The screen goes into the
  layout's slot (MasterLayout's `RouterView` slot), not a `RouterView` inside the layout: a leaving layout keeps its old
  screen for the fade. A layout change fades the shell; a screen change inside one layout fades only the screen (each
  layout's `<Transition name="swap" mode="out-in">`), so filters and menu stay. A default-layout screen without its own
  menu item names the item to keep current with `meta.navParent` (the category screen → `home`). `MasterLayout` keeps the screens in `KEPT_ALIVE` (`HomePage`) alive while another screen of their layout is open (back from a category, home is there at once, reloading quietly). Pages and layouts have one root element
  (`tests/pages.test.ts`); layouts and the menu — `tests/renderer/layouts.test.ts`. A new data screen = a page + a route
  with `meta.nav`; the guard opens every default-layout route once home is the start (`startGuard`).
- The renderer settings tests: `tests/renderer/settings.test.ts`, the header layout — `tests/renderer/app-header.test.ts`.
