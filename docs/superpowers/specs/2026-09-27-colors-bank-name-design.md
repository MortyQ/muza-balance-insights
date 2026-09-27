# Цвета людей и подключений; возврат имени из банка

Дата: 27.09.2026. Версия: 0.1.5.

## Зачем

- Будущие графики разбивают деньги по людям и по подключениям: у каждого нужен свой постоянный цвет, без повторов.
- Баг: «Переименовать» всегда делает имя «введённым вручную», вернуть «имя из банка» нельзя. Причины: (1) в UI и ядре нет
  такого действия; (2) имя владельца от банка нигде не хранится — sync сразу пишет его в подпись, поэтому даже при
  возврате имя появилось бы только после следующего импорта.

## Решения

- Цвет выбирается **из палитры**: 8 ключей — проверенная категориальная палитра dataviz (различима при дальтонизме в обеих
  темах; 9-й цвет не генерируется): `blue`, `orange`, `aqua`, `yellow`, `magenta`, `green`, `violet`, `red`.
  В базе — ключ, не hex: у ключа свой оттенок для светлой и тёмной темы.
- Две независимые палитры: цвета людей уникальны среди людей, цвета подключений — среди подключений.
- Новый человек / подключение получает первый свободный цвет. Свободных нет → `NULL` (нейтральный серый); добавление из-за
  цвета не блокируется. Сменить цвет можно на любой свободный.
- Имя из банка: последнее имя владельца хранится у подключения; «Взять имя из банка» доступно и при создании, и при
  переименовании; применяется сразу.

## Ядро (`packages/core`)

- Миграция 10:
  - `connections.holder_name TEXT` — последнее имя владельца от банка (персональные данные, только в этой базе);
  - `participants.color TEXT`, `connections.color TEXT` (NULL = без цвета) + `CHECK` по ключам + `CREATE UNIQUE INDEX uq_*_color` на каждый (NULL
    повторяться может);
  - существующим строкам — цвета по порядку `id` (window/CTE с палитрой; сверх 8 — NULL).
- `COLOR_KEYS` (новый модуль `colors.ts`): список ключей, `parseColor`, `firstFreeColor(db, 'participants' | 'connections')`.
- `addParticipant` / `addConnection` / `ensureDefaultConnection`: необязательный `color`; не задан → первый свободный;
  занят → `ConnectionError('Этот цвет уже занят')`.
- `setParticipantColor(db, id, color)`, `setConnectionColor(db, id, color)`: занятый → `ConnectionError`.
- `restoreBankLabel(db, participantId)`: `label_source = 'bank'`, `label` = `holder_name` первого (по `id`) подключения этого
  человека, где оно есть; нет ни одного → подпись не меняется до импорта.
- `syncAccounts`: `holder_name` пишется всегда, когда банк прислал имя; подпись — как сейчас, только при `'bank'`.
- `listParticipants` / `listConnections` отдают `color`.
- Анонимная копия: новые колонки не в whitelist `apps/mcp/src/analysis/schema.ts` → не попадают; тест это фиксирует.

## Main (`apps/desktop/src/main`)

- `PersonView.color`, `ConnectionView.color` (`ColorKey | null`); `ColorKey` в `src/shared` — копия ключей ядра, сверка типов
  в `people.ts` (как `ProviderKey`).
- `ParticipantChoice` нового человека несёт `color?`; `AddConnectionInput` — `color?` подключения.
- Новые IPC: `setParticipantColor(id, color)`, `setConnectionColor(id, color)`, `restoreBankName(participantId)`; zod — `z.enum`
  ключей. Результат смены цвета: `{ changed: true } | { changed: false; reason: 'taken' }`.

## Renderer

- Оттенки палитры — CSS-переменные `--series-<key>` в `app/styles/theme.css` для обеих тем.
- Выбор цвета — `ColorSwatches` (группа радио-кнопок-кружков, стрелки, `aria-label` — название цвета; занятый — `disabled`
  с подсказкой, у кого он). В muzakit аналога нет (проверено) → свой компонент `entities/participant/components/ColorSwatches.vue` на Tailwind.
- Форма «Добавить подключение» и первый экран: «Цвет человека» (только для нового) и «Цвет подключения», по умолчанию —
  первый свободный.
- «Люди»: аватар — цвет человека; «Изменить цвет» раскрывает палитру (как «Переименовать»), выбор применяется сразу.
- «Подключения»: точка цвета у строки + «Изменить цвет».
- «Переименовать»: чекбокс «Взять имя из банка» (выключает поле) → «Сохранить» вызывает `restoreBankName`.

## Тесты

- Ядро: миграция 10 на базе с данными (цвета по порядку, уникальность, >8 → NULL); `firstFreeColor`; занятый цвет →
  ошибка; `restoreBankLabel` с `holder_name` и без; sync пишет `holder_name` при `'user'` и не трогает подпись.
- Main: IPC-валидация ключей; `addConnection` с цветами.
- Renderer: `participantChoice`/форма, палитра отключает занятые, «Взять имя из банка» в переименовании.
- `schema.ts` не содержит `holder_name`/`color`.

## CHANGELOG 0.1.5 — unreleased

- Each person and connection has its own colour, chosen when adding and changeable later in «Люди» / «Подключения»; two
  cannot share a colour.
- «Взять имя из банка» (use the name from the bank) now also works after renaming.

## Вне рамок

- Сами графики; цвет в фильтре «Чьи деньги» на главной.
