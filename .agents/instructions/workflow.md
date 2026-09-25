# Git & Workflow

## Commit Messages

Follow Conventional Commits (enforced by commit-lint + Husky):

```
<type>(<scope>): <description>

feat(ui): add BaseModal component
fix(dashboard): correct table pagination offset
refactor(utils): simplify date formatting logic
chore: update pnpm lock file
```

**Types**: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`  
**Scope**: package name or area (`ui`, `dashboard`, `utils`, `config`)

## Branching

- `main` — stable, production-ready
- Feature branches: `feat/<description>`
- Fix branches: `fix/<description>`

## Pull Requests

- One PR = one logical change
- PR title follows the same Conventional Commits format
- Always test locally before opening a PR

## pnpm Workspace Commands

```bash
# install all deps
pnpm install

# run command in specific package
pnpm --filter @muzakit/ui build
pnpm --filter @muzakit/dashboard dev

# run in all packages
pnpm -r build
```

## Adding Dependencies

```bash
# add to specific package
pnpm --filter @muzakit/ui add some-lib

# add to root (dev tool)
pnpm add -D some-tool -w
```
