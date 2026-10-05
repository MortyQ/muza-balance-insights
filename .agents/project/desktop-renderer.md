# Десктоп: renderer — FSD, UI, стили, навигация

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/desktop/src/renderer.

- Экран данных (шаг 7): main отдаёт узкие view-типы из `apps/desktop/src/shared/api.ts` (`apps/desktop/src/main/data.ts` поверх
  `spendingSummary` / `getMonthOverview` ядра) — категории, суммы в минимальных единицах, даты, подписи `black/UAH`.
  Renderer из ядра импортирует только `@mono/core/currency` (формат сумм). По умолчанию — текущий месяц (Киев), «личное».
- **Блок балансов** (`features/balances`, `BalancesFeature.vue`): карта на главной с итогом месяца, приходом и тратами.
  Клик (или Enter/пробел) раскрывает стопку в ряд: у семьи — общая карта, затем карта каждого человека в его цвете
  (`legend`); у одного человека — его общая карта, затем каждый его счёт (карты, кредитки, банки, валютные); «Все
  счета» — заглушка (текст «Раздел появится позже», флаг в `useCardStack`). Позиции стопки/ряда — чистые функции в
  `utils.ts` (`slidesOf`, `slidePosition`), CSS-переменные `--x`/`--y`/`--z`/`--o`, `motion-reduce:` без сдвига.
  `composables/useMonthOverview.ts` — данные месяца и человека (`useAsyncData`, тихая перезагрузка на
  `syncStatus.version`); `composables/useCardStack.ts` — `open`/`offset`/`toggle`/`prev`/`next`, сбрасывается сменой
  месяца или человека. Счёт без данных на выбранную дату — бледная карта, `own_funds: null`.
  `entities/account` — только отображение, `components/BalanceCard.vue` (`title`, `caption`, `amount`, `others`,
  `bottom`, `net` + `netText`, `accents` — цвета кругов, `dim`); корень — `<button>`, `aria-expanded` приходит снаружи
  (без своего `aria-label`: содержимое карты уже читается экранными читалками, `aria-expanded` даёт состояние).
  `entities/period` — Pinia-store `useMonthStore` (`month`, `thisMonth`, `set(next, first)` — зажимает в
  `[firstMonth, thisMonth]`): один выбранный месяц для всей главной, его читают `balances` и `spending-summary`
  (своих переключателей месяца у них нет). Выбирают его в `MonthFilter` (компонент сущности, как `ParticipantFilter`:
  `VMonthPicker` «Месяц», `max` — этот месяц, `min` — пропсом; при сдвиге `min` позже зажимает выбор заново).
  Виджет `widgets/global-filters` (`GlobalFilters`, pinned above the default layout's scroll area, `app/layouts/DefaultLayout.vue`; layout — root `CLAUDE.md`) — фильтры, которые читают все блоки:
  `ParticipantFilter` и `MonthFilter` (только при `syncStatus.hasData`), then `CurrencyToggle` of `entities/currency-display`, `min` = the import's floor month
  (`monthOf(importFloor(today))`, `src/shared/import-range.ts`), not the first data month: an older month gets the «no data
  yet» notice of `widgets/home-notices` (сущности друг друга не импортируют). `shared/ui/VMonthPicker` — свой (на reka-ui `MonthPicker` в `PopoverRoot`, muzakit такого не даёт):
  `v-model` `'YYYY-MM'`, `min`/`max`, сетка 3×4, месяцы вне диапазона `disabled`.
- **Sync status** (on the right of `GlobalFilters`, `widgets/global-filters`): the widget is where `import-progress`,
  `sync-status` and `participant` meet, and it takes the import's error wording from `features/import-statement`
  (`IMPORT_ERRORS`, `progressLine`, re-exported by its `index.ts`). `utils.ts`: `syncStatusView(progress, { line,
  lastSyncAt }, now, labelOf)` → `SyncStatusView` (`types.ts`: `icon`, `text`, `percent`, `note`, `tooltip`), pure and
  tested (`tests/renderer/sync-status.test.ts`); `failedConnections(progress)` → connection id → error text for
  `ParticipantFilter`'s `failed` prop. Phases: a user's import — spinner + `home.filters.syncing`, the windows share
  (`home.filters.percent`) only in `windows`, `progressLine` in the tooltip; «Auto-sync» — `home.import.autoRunning`, no
  percent, no tooltip; `retry` — `home.filters.retryAt` + the full retry line in the tooltip; otherwise the data line
  (`syncStatus.line`) + `home.filters.updated` with `syncedWhen(lastSyncAt, now)` (`shared/lib`: today → `common.atTime`,
  another day → `shortDate`); `done` with `failed` or `error` — a `text-warning` triangle, the reason
  (`home.import.notLoaded` / `IMPORT_ERRORS`) in the tooltip and as sr-only text. `components/SyncStatus.vue`: `role="status"`
  `aria-live="polite"`, the percent `aria-hidden` (a phase is announced once, not every tick), the spinner
  `motion-reduce:animate-none`; no `aria-busy` on the header (it can hold the announcement back). People: each person's
  tooltip — `entities.participant.updated` with the latest `lastSyncAt` of their connections (`lastSyncOf`), plus
  «label: reason» per failed connection; such a person gets `SegmentOption.alert` (`VSegmentedControl`: a warning dot,
  the string is the sr-only suffix, `entities.participant.syncFailed`). Segment tooltips are HTML, so names are escaped.
  Per-connection progress is not in the IPC: no per-person spinner.
- **Spending block** (`features/spending-summary`, `SpendingFeature.vue`; spec `docs/superpowers/specs/2026-10-02-spending-block-design.md`):
  one IPC `getSpendingOverview({ month, scope, participantId? })` (main: `DataService.spendingOverview`, helpers in
  `main/spending.ts`) — categories in hryvnia (account currencies folded by today's Monobank rates, `leftOut` without a rate; the answer carries `rates`),
  `purchases`, the compared period (`compare`: last month, cut to the same day while the month is incomplete; null
  before the data), for the family (more than one participant) each participant's part of every category. Renderer: `utils.ts` builds rows for the
  family or the block's own pick (`rowsFor`, top 7 + «N more categories» — not «Other», a bank category; colours by the
  family's rank from `--category-1…7`, a picked person's category below the top 7 — `--category-other`), chips (`change`,
  3% → «as in»; short differences carry «+» / «−» and an `sr` direction for screen readers), operations (`opsView`, `opsVs` with `OPS_TONE`),
  the ring (`ringStops` / `ringOf`), the compared period (`comparePeriodText` → `home.spending.compareFull`), the centre total and every amount through `MoneyFormat` (`entities/currency-display`; no per-currency chip). `composables/useSpending.ts` — the
  request and the pick (reset on month, scope and global filter changes);
  `composables/useSpendingView.ts` — everything the template shows. A picked person keeps the family's bar scale: their
  segment first and bright, the others faded. A pick with no spending keeps the people list and shows `noneBy`; a pick
  of a person no longer in the view falls back to the family. Menu choices — `store/useSpendingPrefsStore.ts` (`localStorage` `spending.view`, defaults: split and mark on); the
  currency is the home-wide `entities/currency-display` choice. The footnote says «at today's Monobank rate». Layout: `@container`, the columns stack
  below `@3xl`; only the category name shrinks (ellipsis + title); numbers have fixed widths and never wrap.
  `shared/ui/VPopover` — ours on reka-ui.
  A category row is a link to its screen (`categoryLink(id, scope)` in `shared/config`; «N more categories» and an
  unknown word stay plain rows); it no longer unfolds — the per-person split is on the category screen. Category
  icons, names and rank colours live in `entities/category` (`CATEGORY_ICON`, `categoryName`, `categoryColor`), shared
  with the «Now» strip and the category screen.
- **Category screen** (`features/category-detail`, `CategoryDetailFeature.vue`; `pages/category`; spec
  `docs/superpowers/specs/2026-10-05-category-screen-design.md`): route `category` (`/category/:id`, `CategoryId`; an
  unknown id → home by the route's guard; `query.scope`, read back by `categoryRequest`), default layout without its
  own menu item (`meta.navParent: 'home'` keeps «General» current — `useNav`). One IPC `getCategoryOverview` (see
  `desktop-import.md`): the month, person and currency are the global filters; quiet reload on `syncStatus.version`.
  `composables/useCategoryDetail.ts` — the request; `composables/useCategoryView.ts` — the view plus the list's own
  merchant filter, search and order (reset with month, category and person). «When» is counted on the screen from the
  lines (`whenTotals`), so the merchant filter narrows it too and its title names the merchant; the search does not. `utils.ts` is pure and tested
  (`tests/renderer/category-detail.test.ts`): summary (the change chip in «Spending»'s words), 12 months (average of
  the months with data), who / where / when, the list (merchants matched case-insensitively, search by text, comment
  and amount digits; the list total is the category's own figure while nothing filters it). Bars and marks are
  `aria-hidden` with sr-only text; the list is a `role="table"` grid that scrolls sideways in a narrow window.
- **«Now» strip** (`features/now-strip`, `NowStripFeature.vue`; spec `docs/superpowers/specs/2026-10-03-now-strip-design.md`):
  one IPC `getNowOverview({ participantId? })` (main: `DataService.nowOverview`, helpers in `main/now.ts`; main decides
  «today» in the system time zone, `src/shared/dates.ts`) — today vs a usual day (median of the 30 covered days before today, a day without spending = 0, none
  under 7 days), this week Monday … today vs the same days of last week, seven bars, the week's top category (its colour
  = its rank in this month's categories, as in «Spending»), pending holds. Personal scope always; today's Monobank rates (the answer carries `rates`).
  Between the balances and «Spending»; hidden unless the month filter is this month; reloads quietly on
  `syncStatus.version` and on the period store's `today`. `utils.ts` (`nowView`, `nowChip`, `weekBars`, `dayLabel`,
  `daysRange`, `categoryColor`) is pure and tested (`tests/renderer/now-strip.test.ts`).
- **Currency choice** (`entities/currency-display`): the home-wide main currency (₴ / $ / €) and the «≈» currencies.
  `useCurrencyDisplayStore` holds `choice { main, also }` (`localStorage` `home.currencies`; the old `{ usd, eur }` and
  the old `spending.view` `usd` / `eur` are read once and saved at once, as hryvnia main with the same «≈» ones) and
  `rates` — the newest `RatesView` snapshot of any block's answer (`setRates`), `undefined` until the first answer
  (not loaded yet, which is not «no rates»; `null` — main has none). Every home block calls
  `useMoneyFormat(() => answer.rates)` and formats through the returned `MoneyFormat` (`currency`, `convert`, `money`,
  `approx`, `approxInline`); without a rate for the main currency it falls back to ₴. Balances, «In / Out», the «Now»
  strip and «Spending» all format this way; no block formats a hryvnia amount itself. `CurrencyToggle` (in
  `GlobalFilters` after `MonthFilter`): a `VPopover` whose text is `shownText` («$ · ₴ €»), a `VSegmentedControl` for
  the main currency, «Also show» `VSwitch` rows for the others, and a footer with the rate's fetch time («saved» when
  main served the cached rates offline, or «no rates»).
- **Change chips** — `shared/ui/VChangeChip` (ours, `ChangeChipModel`) and `change()` in `shared/lib` (3 % → «same»):
  one look and one rule for «Spending» and the strip.
- Стили renderer — Tailwind v4 (`@tailwindcss/vite`), токены — копия `muzakit/libs/config/src/tailwind/theme.css`
  в `apps/desktop/src/renderer/src/app/styles/theme.css` (сканирование только renderer: `source(none)` + `@source`).
  Шрифт — Manrope Variable из `@fontsource-variable` (в Plus Jakarta Sans нет базовой кириллицы), локальные файлы.
  `assetsInlineLimit: 0`: prod-CSP не пускает `data:`. Тема — `data-theme` по `prefers-color-scheme` (выбор темы — в main, см. блок settings-ui в корневом `CLAUDE.md`).
  Библиотеку muzakit целиком не подключаем, пока она не публикуется пакетом. Нужные компоненты — копиями в
  `apps/desktop/src/renderer/src/shared/ui/` (шапка «copied from muzakit», отличия — `shared/ui/README.md`), без `vue-router`
  внутри копий, `@vueuse`, `@iconify/vue`. Иконки — `unplugin-icons` (`autoInstall: false`) из локального `@iconify-json/lucide`,
  явный реестр `ui/components/base/icons.ts`, канонические имена Lucide (не алиасы).
  Таблицу трат и формат сумм пишем свои (`VTable` и `formatCurrency` из muzakit не подходят).
- **Элементы интерфейса — сначала `shared/ui`.** Нужен контрол (кнопка, поле, переключатель, чекбокс, список, подсказка,
  карточка…) — сначала искать его в `shared/ui` (`index.ts`, `README.md`). Нет — скопировать из muzakit по
  `ui-component-migration.md` отдельным шагом, потом использовать. Голый `<input type="checkbox">`, `<select>` и т. п. на
  экране — только если в muzakit такого компонента нет; причина — в отчёте. Настройка, которая применяется сразу, —
  `VSwitch`; вариант в форме, применяемый по кнопке, — `VCheckbox`.
- **Архитектура renderer — FSD** (`apps/desktop/src/renderer/src`), проверяет `apps/desktop/tests/architecture.test.ts`
  (правила — `tests/helpers/architecture.ts`, у каждого правила есть «ломающий» пример):
  - слои `app → pages → widgets → features → entities → shared`, импорт только вниз; слайсы одного слоя друг друга не
    импортируют (кроме сегментов `shared`: `api`, `config`, `layout`, `lib`, `ui`); внутри слайса — относительные импорты;
  - снаружи слайс доступен только через `index.ts` (`@/features/x`, без глубоких путей); `index.ts` только реэкспортирует;
  - алиасы: `@/` → `src/renderer/src`, `@contract/` → `src/shared` (типы и константы, общие с main и preload);
  - пакеты в renderer — только белый список (`vue`, `vue-router`, `pinia`, `@mono/core/currency`, `~icons/lucide/*`, шрифт);
    `electron`, `node:*` и новая зависимость — ошибка теста;
  - `window.balance` читает только `shared/api/balance.ts`; `balanceApi` вызывают только сегменты `api/` слайсов
    (`api/use<X>Request.ts`, возвращают объект функций) и подписки в `app/listeners.ts`;
  - сегменты слайса: `<Name>Feature.vue` (корень фичи), `api/`, `composables/` (логика, явный `Use<X>Return` в `types.ts`),
    `components/` (только отображение; у сущности компонент может читать и менять свой стор — так `ParticipantFilter`), `store/` (Pinia setup-store, только тут), `types.ts`, `constants.ts`, `utils.ts`
    (чистые функции); страницы — тонкие оболочки над фичами и виджетами;
  - общее состояние — Pinia в `entities`: `participant` (люди, подключения, статусы токенов, выбор «Вся семья / человек» —
    `selectedId`, запоминается в `localStorage` только для удобства), `sync-status` (статус данных и `version`, на который
    перезагружаются данные), `import-progress`; реакции между сущностями — в `app/listeners.ts` (люди обновляются на
    `needs-token`, в начале окон импорта и в его конце);
  - **домен `features/settings`** — один слайс со всем, что пользователь делает с приложением и своими данными на этом
    компьютере: подфичи `app-lock`, `app-update`, `people`, `auto-sync`, `db-encryption`, `db-recovery`, `delete-data`,
    `security-info`, `theme-switch`, `language-select`
    (у каждой свои сегменты) и `shared/` для общего между ними (`isChecked`, `restoreSwitch` для `VSwitch`;
    `api/useDeleteAllDataRequest.ts` — «Удалить все данные» из настроек и с экрана «База недоступна»). Раскладка раздела
    (`Settings{Section,List,Row}`; also the side menu `SideNav` of settings and home) — сегмент `shared/layout`: ей пользуются и домен `integrations`, и виджет `settings`
    («О программе»). Наружу — только `features/settings/index.ts`: карточки настроек (их собирает виджет `settings`) и то,
    что живёт вне экрана настроек (экран блокировки, подсказка и баннер обновления на главной, экран «База недоступна»).
    Подфичи не импортируют друг друга и корень домена (`index.ts` и корневые файлы), `shared/` — ни одну подфичу и ни один
    корневой файл (`DOMAIN_SLICES` в `tests/helpers/architecture.ts`). Новая настройка — новая подфича здесь;
  - **домен `features/integrations`** — подключение банков и строки подключений, папка на банк: `monobank/`
    (`MonobankConnectFeature.vue` — форма добавления по токену: `<form>`, поле токена, согласие, кнопка;
    `components/MonobankTokenField.vue` — шаги и поле токена;
    `composables/useMonobankConnect.ts` — `addConnection` с `provider: 'monobank'`, тексты банка в `constants.ts`: `CONSENT_TEXT`,
    `TOKEN_STEPS`, `TOKEN_PLACEHOLDER`, `ACCESS_NOTE`) и
    `shared/` для общего между банками (`components/ConnectionRow.vue`, `components/BankPicker.vue` — выбор банка на первом
    экране; `composables/useConnectionActions.ts` — удалить, «Ввести токен заново», «Счета»;
    `composables/useConnectionOwner.ts` — чьё подключение и цвет нового человека; `api/useConnectionsRequest.ts`; `TOKEN_ERROR_TEXT`;
    `participantChoice`, `removeText`, `accountLabel`; контракты форм банка `ConnectFormProps` / `TokenFieldProps` в `types.ts`). Корень домена: `ConnectionsFeature.vue` (раздел
    «Подключения»), `ConnectFirstFeature.vue` (первый экран), `AddConnectionFeature.vue` (чьё подключение и цвет нового человека — в слот
    формы банка; `provider` обязателен) и `constants.ts` — таблица `PROVIDER_FORMS` (`provider → { connect, tokenField, accessNote }`,
    `cardTypes` — названия типов карт банка для «Счета», `Component<ConnectFormProps>` / `Component<TokenFieldProps>`: vue-tsc проверяет, что компонент банка принимает эти
    пропсы; пропсы в месте `<component :is>` не проверяются) и `DEFAULT_PROVIDER` (банк «Добавить подключение»);
    `utils.ts` — `isProviderKey`, `formsOf` (незнакомый провайдер → формы банка по умолчанию). Только корень импортирует
    папки банков, строка подключения получает поле токена своего банка пропсом. В корневых файлах нет текстов конкретного
    банка: имя — из `entities/bank` (`bankOf`), строка первого экрана — `accessNote` из папки банка. Наружу — `ConnectionsFeature`
    (виджет `settings`) и `ConnectFirstFeature` (`pages/connect`). Те же правила домена, что у `settings`. Новый банк —
    своя папка и запись в `PROVIDER_FORMS`;
  - **«Счета» подключения** (`ConnectionRow`): кнопка «Счета · N» («Счета · X из N», если часть выключена;
    `accountsButtonText`, `aria-expanded`) раскрывает панель, как у токена (открыта
    одна из двух); список грузится при каждом открытии (`useConnectionActions.accounts`: `loading | ready | error`, старый
    список остаётся на время перезагрузки). Строка счёта — `SettingsRow` + `VSwitch`: подпись `accountLabel` (карта: тип
    банка · валюта · •• 1234; банка: «title» · валюта), у выключенного — «Не загружается и не входит в статистику». Во время
    импорта переключатели `disabled` с подсказкой. Переключение не оптимистичное: строка меняется после ответа, отказ
    (`import-running`) или ошибка — в `error` раздела, ползунок возвращается (`accountSwitchChange`). Пока один счёт
    сохраняется, остальные не `disabled` (фокус клавиатуры не теряется): `aria-disabled`, щелчок сразу откатывается.
    Ошибка загрузки списка — `console.error('[accounts] list failed', e)` (только ошибка, без данных). Строка
    подключения (`coverageLine`): «Счетов: X из N», все выключены — «Все счета выключены». После — `participant.refresh()` и
    `syncStatus.refresh()` (push из main нет): главная перезагружается тихо. Все счета выключены (`accountsOff` в
    `participant` по `ConnectionView.enabledAccounts`) → `hasData` ложно, но подключения есть: главная (не экран
    подключения) с плашкой «Все счета выключены…» и кнопкой в «Подключения» (`widgets/home-notices`);
  - данные из main — `useAsyncData` (`shared/lib`): `Loadable<T>`, прошлое значение остаётся на время загрузки и после ошибки.
- **Interface texts** — every text on a screen goes through vue-i18n, no literals:
  - templates: `$t('key')`, `$t('key', { name })`, plurals `$t('key', n)`; script code (`utils.ts`, composables,
    stores): `t` from `@/shared/lib`, called when the text is needed — never at module load (a constant built with `t`
    does not follow a language switch). Tables of texts in `constants.ts` hold keys (`MessageKey` from
    `@contract/i18n/index.ts`), the component translates them;
  - keys are nested by layer and slice, `<layer>.<slice>.<what>` (`settings.lock.title`, `home.balances.income`),
    shared words in `common.*`; `uk.json` is the reference, `en.json` and `ru.json` get the same key in the same change
    (`tests/i18n.test.ts`);
  - Ukrainian and Russian texts address the user informally (ти / ты), as the screens always have; English is plain;
  - numbers, dates and money keep their own formatters (`formatMoney`, `monthName`, `shortDate`) and are passed in as placeholders;
  - bank names, the app name and the language names in the language select are not translated.
- Навигация — `vue-router` с memory history (адрес страницы всегда `app://renderer/index.html`), маршруты в
  `app/router/routes.ts` (`meta.layout` / `meta.nav` — лаяут и пункт бокового меню, см. «Layouts» в корневом `CLAUDE.md`),
  имена — `ROUTE` в `shared/config`. Guard (`app/router/guards.ts` + `startRoute.ts`): экран подключения — только если нет ни
  одного подключения и нет данных; подключение без токена → главный с плашкой «Ввести токен»; настройки доступны всегда.
  Банки — `entities/bank`, только отображение (`BANKS`: `id`, `name`, монограмма / логотип, `status` — доступен / «Скоро»;
  у доступного — `auth: 'token' | 'oauth' | 'file'`, у Monobank `'token'`; `bankOf` — банк подключения, незнакомый →
  Monobank); как подключать — в папке банка в `features/integrations`. Подключение — `addConnection` в main (пока только Monobank).
- Экран настроек — меню и разделы, см. блок settings-ui в корневом `CLAUDE.md`. Раздел «Люди» — `features/settings/people`
  (имя и «Переименовать», «Взять имя из банка», цвет человека); раздел «Подключения» — `features/integrations`
  (подключения со статусом токена, «Ввести токен заново», «Удалить», «Добавить подключение» — существующий
  человек или новый с именем / «Взять имя из банка», текст о согласии владельца токена); первый экран —
  `ConnectFirstFeature` той же формой с человеком «Я»; на главном — фильтр людей `ParticipantFilter` из `entities/participant` («Вся семья / имена», только если людей больше одного;
  у имени точка цвета человека, у «Вся семья» — точки всех: `filterOptions`, `SegmentOption.colors` в `VSegmentedControl`),
  траты и балансы берут `participantId`; импорт показывает, какие подключения не загрузились.
  Цвета людей (у подключений цвета нет): оттенки `--series-<key>` в `theme.css` (обе темы), выбор — `ColorSwatches` из
  `entities/participant` (radiogroup, занятые видны, но недоступны; своего компонента в muzakit нет), в форме добавления
  по умолчанию — первый свободный; «Изменить цвет» в «Люди» применяется сразу; «Взять имя из банка»
  в «Переименовать».
  Логотип — необязательный локальный файл `entities/bank/assets/<id>.svg|png|webp`, иначе монограмма.
  «Настройки…» `CmdOrCtrl+,` в меню → `balance:open-settings` (main → renderer, без данных) → `onOpenSettings` в preload.
