# Цвета людей и подключений; возврат имени из банка — план

> Спека: `docs/superpowers/specs/2026-09-27-colors-bank-name-design.md`. Ветка `feat/improve-create-user-flow`.
> Шаги — чекбоксы; после каждой задачи — тесты пакета и коммит.

**Цель:** у каждого человека и подключения свой цвет из палитры (без повторов, выбор при создании и позже); «Взять имя
из банка» работает и после переименования.

**Архитектура:** ядро хранит ключи цвета и имя владельца (миграция 10), main отдаёт их в view и принимает смену через
три новых IPC, renderer рисует палитру `ColorSwatches` из `entities/participant`.

---

### Задача 1: ядро — миграция 10, `colors.ts`, participants, sync

**Файлы:** `packages/core/src/colors.ts` (новый), `db.ts`, `participants.ts`, `connections.ts`, `sync.ts`;
тест `packages/core/tests/colors.test.ts` (новый).

- [ ] Тест: миграция на базе v9 с 10 участниками/подключениями → цвета по порядку id, 9-й и 10-й — NULL; CHECK и UNIQUE.
- [ ] Тест: `addParticipant`/`addConnection` берут первый свободный; явный занятый → `ColorTakenError`; свободных нет → NULL.
- [ ] Тест: `setParticipantColor`/`setConnectionColor` (свой же цвет — ок, чужой — `ColorTakenError`, нет id — `ConnectionError`).
- [ ] Тест: sync пишет `holder_name` и при `'user'`, подпись не трогает; `restoreBankLabel` с `holder_name` и без.
- [ ] Тест: `holder_name`/`color` не в `ANALYSIS_SCHEMA` (apps/mcp).
- [ ] Реализация: `COLOR_KEYS`, `ColorKey`, `parseColor`, `firstFreeColor`, `ColorTakenError`; миграция 10
  (`ALTER … ADD COLUMN holder_name`, `color TEXT CHECK (color IN (…))`, `CREATE UNIQUE INDEX uq_participants_color` /
  `uq_connections_color`, `UPDATE` с CTE палитры); `listParticipants`/`listConnections` отдают `color`;
  `ensureDefaultConnection` — первый свободный.
- [ ] `pnpm --filter @mono/core test` + typecheck; `apps/mcp` тесты; коммит.

### Задача 2: main — view, IPC

**Файлы:** `apps/desktop/src/shared/colors.ts` (новый), `shared/api.ts`, `shared/channels.ts`, `main/ipc.ts`, `main/people.ts`,
`main/index.ts`; тесты `tests/people.test.ts`, `tests/ipc.test.ts`.

- [ ] `COLOR_KEYS` в `src/shared/colors.ts` (renderer не импортирует ядро), сверка типа с ядром в `people.ts`.
- [ ] `PersonView.color`, `ConnectionView.color`; `ParticipantChoice` нового человека + `color?`; `AddConnectionInput.color?`;
  `ColorChangeResult`.
- [ ] Методы `setParticipantColor(id, color)`, `setConnectionColor(id, color)`, `restoreBankName(id)`: channels, zod, BalanceApi,
  handlers; `ColorTakenError` → `{ changed: false, reason: 'taken' }`.
- [ ] Тесты: add с цветами и без, смена, занятый, `restoreBankName`; невалидные аргументы в `INVALID`.
- [ ] `npx vitest run` desktop (main-тесты) + typecheck; коммит.

### Задача 3: renderer

**Файлы:** `app/styles/theme.css` (`--series-*` в обеих темах), `entities/participant/{constants,utils,index}.ts`,
`entities/participant/components/ColorSwatches.vue` (новый), `features/settings/people/**`; тест `tests/renderer/people.test.ts`.

- [ ] Палитра: light/dark hex из dataviz (`references/palette.md`).
- [ ] `COLOR_NAMES`, `colorVar`, `takenColors`, `firstFreeColor` (renderer); `ColorSwatches` — radiogroup, стрелки, disabled
  занятые с подсказкой.
- [ ] Форма добавления: «Цвет человека» (новый), «Цвет подключения»; по умолчанию первый свободный.
- [ ] `PersonBlock`: аватар в цвет, «Изменить цвет»; в «Переименовать» — «Взять имя из банка».
- [ ] `ConnectionRow`: точка цвета, «Изменить цвет».
- [ ] Тесты utils; `npx vitest run tests/renderer` + typecheck web; коммит.

### Задача 4: CHANGELOG, документы, финальная проверка

- [ ] `CHANGELOG.md`: `## 0.1.5 — unreleased`.
- [ ] `.agents/project/desktop-import.md` (IPC людей), `desktop-renderer.md` (цвета).
- [ ] Полные тесты и typecheck по пакетам; коммит.
