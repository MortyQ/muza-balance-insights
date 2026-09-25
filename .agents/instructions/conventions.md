# Code Conventions

## Naming

| Entity | Convention | Example |
|---|---|---|
| Vue component files | PascalCase | `BaseButton.vue` |
| Component names | PascalCase | `<BaseButton />` |
| Composables | camelCase, `use` prefix | `useModal.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_ITEMS` |
| Types / Interfaces | PascalCase | `ButtonProps`, `UserData` |
| CSS classes | kebab-case | `btn-primary` |
| Folder names | kebab-case | `form-controls/` |

## File Organization

- One component per file
- Co-locate component-specific composables and types next to the component
- Shared types go in `types/` folder within the package

## Imports Order

1. Vue / framework imports
2. Third-party libraries
3. Internal `@muzakit/*` packages
4. Relative imports (local to current package)

## Comments

- Write comments only where logic is non-obvious
- No JSDoc on self-explanatory functions
- No commented-out code — delete it

## General Rules

- Prefer `const` over `let`
- No `any` — use `unknown` or proper types
- No unused variables or imports
- Keep functions small and focused
- Do not add features beyond what was asked
