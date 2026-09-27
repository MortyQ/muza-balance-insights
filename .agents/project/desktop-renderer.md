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
  Виджет `widgets/global-filters` (`GlobalFilters`, над блоками главной) — фильтры, которые читают все блоки:
  `ParticipantFilter` и `MonthFilter` (только при `syncStatus.hasData`), `min` = `firstMonthOf(syncStatus.status.dataFrom)`
  из `entities/period` (сущности друг друга не импортируют). `shared/ui/VMonthPicker` — свой (на reka-ui `MonthPicker` в `PopoverRoot`, muzakit такого не даёт):
  `v-model` `'YYYY-MM'`, `min`/`max`, сетка 3×4, месяцы вне диапазона `disabled`.
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
    (`Settings{Section,List,Row}`) — сегмент `shared/layout`: ей пользуются и домен `integrations`, и виджет `settings`
    («О программе»). Наружу — только `features/settings/index.ts`: карточки настроек (их собирает виджет `settings`) и то,
    что живёт вне экрана настроек (экран блокировки, подсказка и баннер обновления на главной, экран «База недоступна»).
    Подфичи не импортируют друг друга и корень домена (`index.ts` и корневые файлы), `shared/` — ни одну подфичу и ни один
    корневой файл (`DOMAIN_SLICES` в `tests/helpers/architecture.ts`). Новая настройка — новая подфича здесь;
  - **домен `features/integrations`** — подключение банков и строки подключений, папка на банк: `monobank/`
    (`MonobankConnectFeature.vue` — форма добавления по токену: `<form>`, поле токена, согласие, кнопка;
    `components/MonobankTokenField.vue` — шаги и поле токена, шаги пока из `entities/bank`;
    `composables/useMonobankConnect.ts` — `addConnection` с `provider: 'monobank'`, тексты банка в `constants.ts`) и
    `shared/` для общего между банками (`components/ConnectionRow.vue`, `components/BankPicker.vue` — выбор банка на первом
    экране; `composables/useConnectionActions.ts` — удалить, цвет подключения, «Ввести токен заново»;
    `composables/useConnectionOwner.ts` — чьё подключение и цвета; `api/useConnectionsRequest.ts`; `CONSENT_TEXT`,
    `TOKEN_ERROR_TEXT`; `participantChoice`, `removeText`). Корень домена: `ConnectionsFeature.vue` (раздел
    «Подключения»), `ConnectFirstFeature.vue` (первый экран), `AddConnectionFeature.vue` (чьё подключение и цвета — в слот
    формы банка) и `constants.ts` — таблица `PROVIDER_FORMS` (`provider → { connect, tokenField }`): только корень
    импортирует папки банков, строка подключения получает поле токена своего банка пропсом. Наружу — `ConnectionsFeature`
    (виджет `settings`) и `ConnectFirstFeature` (`pages/connect`). Те же правила домена, что у `settings`. Новый банк —
    своя папка и запись в `PROVIDER_FORMS`;
  - данные из main — `useAsyncData` (`shared/lib`): `Loadable<T>`, прошлое значение остаётся на время загрузки и после ошибки.
- Навигация — `vue-router` с memory history (адрес страницы всегда `app://renderer/index.html`), маршруты в `app/router`,
  имена — `ROUTE` в `shared/config`. Guard (`app/router/guards.ts` + `startRoute.ts`): экран подключения — только если нет ни
  одного подключения и нет данных; подключение без токена → главный с плашкой «Ввести токен»; настройки доступны всегда.
  Банки — `entities/bank` (Monobank + «Скоро»), подключение — `addConnection` в main (пока только Monobank).
- Экран настроек — меню и разделы, см. блок settings-ui в корневом `CLAUDE.md`. Раздел «Люди» — `features/settings/people`
  (имя и «Переименовать», «Взять имя из банка», цвет человека); раздел «Подключения» — `features/integrations`
  (подключения со статусом токена, «Ввести токен заново», «Изменить цвет», «Удалить», «Добавить подключение» — существующий
  человек или новый с именем / «Взять имя из банка», текст о согласии владельца токена); первый экран —
  `ConnectFirstFeature` той же формой с человеком «Я»; на главном — фильтр людей `ParticipantFilter` из `entities/participant` («Вся семья / имена», только если людей больше одного;
  у имени точка цвета человека, у «Вся семья» — точки всех: `filterOptions`, `SegmentOption.colors` в `VSegmentedControl`),
  траты и балансы берут `participantId`; импорт показывает, какие подключения не загрузились.
  Цвета людей и подключений: оттенки `--series-<key>` в `theme.css` (обе темы), выбор — `ColorSwatches` из
  `entities/participant` (radiogroup, занятые видны, но недоступны; своего компонента в muzakit нет), в форме добавления
  по умолчанию — первый свободный; «Изменить цвет» в «Люди» и «Подключения» применяется сразу; «Взять имя из банка»
  в «Переименовать».
  Логотип — необязательный локальный файл `entities/bank/assets/<id>.svg|png|webp`, иначе монограмма.
  «Настройки…» `CmdOrCtrl+,` в меню → `balance:open-settings` (main → renderer, без данных) → `onOpenSettings` в preload.
