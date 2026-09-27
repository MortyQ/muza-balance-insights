# Renderer (`apps/desktop/src/renderer`)

Загружается сам, когда Claude работает с файлами в этой папке. Дополняет `apps/desktop/CLAUDE.md`.

## Инструкции и скиллы из muzakit (`.agents/`)

Скопированы из `muzakit/.agents` 25.09.2026 (без скиллов `vtable` и `use-api`). Действуют для кода renderer:

@../../../../.agents/instructions/conventions.md
@../../../../.agents/instructions/vue-syntax.instructions.md
@../../../../.agents/instructions/typescript.instructions.md
@../../../../.agents/instructions/ui-component-migration.md

- При расхождении правил правила проекта (`CLAUDE.md`, `.agents/project/`) важнее инструкций muzakit.
- `project.md`, `testing.md`, `workflow.md` описывают саму muzakit (её пакеты, тесты `@muzakit/ui`, husky + commit-lint)
  и сюда не подключены; из `workflow.md` берём только Conventional Commits.
- `ui-component-migration.md` (BEM + SCSS, никаких Tailwind-классов в шаблоне) — только для копий в
  `apps/desktop/src/renderer/src/shared/ui/`. Экраны и компоненты приложения вне `shared/ui/` — на Tailwind-утилитах (решение этапа 1).
- Порядок импортов: vue → пакеты → `@contract/*` → `@/*` (слои) → относительные. Раскладка слоёв — раздел «Архитектура renderer»
  в `.agents/project/desktop-renderer.md`; примеры с Apollo/GQL — только примеры.
- Скиллы: `.agents/skills/emil-design-eng` (полировка UI, анимации), `.agents/skills/find-skills`; источник — `skills-lock.json`.

@../../../../.agents/project/desktop-renderer.md
