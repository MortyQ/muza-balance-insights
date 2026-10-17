# Claude-Specific Behavior

## Response Style

- Be concise — no filler, no preamble
- Lead with the action or answer, not the explanation
- Use markdown only when it adds clarity
- No trailing summaries of what was just done

## Language

- Everything written into the repository is in English: code comments, docs, instructions, notes, commit messages.
  The only non-English text is the UI dictionaries (`apps/desktop/src/shared/i18n/*.json`).
- UI text is never a literal in code: `$t()` / `t()` with a key (see `CLAUDE.md`, «Process»).

## OpenSpec — Spec-Driven Planning

OpenSpec (`openspec/`) is the planning and spec system for the whole monorepo. Capability folders under
`openspec/specs/` are prefixed by part: `core-*`, `desktop-*`, `mcp-*`. Invoke the skills yourself — the user does not
type `/opsx:*`.

**When it applies — a new feature or a behaviour change.** Before any code:

1. `openspec-explore` — think the idea through.
2. `openspec-propose` — creates `openspec/changes/<change>/` with proposal, design, delta specs and tasks.
3. **The user reviews the proposal before apply starts.** Do not implement an unreviewed proposal.
4. `openspec-apply-change` — implement the tasks; each task group is one block and one commit.
5. `openspec-archive-change` — when the change is committed and its specs are synced (`openspec-sync-specs`). Never
   earlier.

`openspec-update-change` revises a change's artifacts when the plan shifts.

**When it does not apply — no spec:** bug fixes, small tweaks, pure refactors, dependency bumps, chores, docs. The
plan-then-«ок» rule of `CLAUDE.md` still holds for them.

The superpowers `brainstorming` and `writing-plans` skills are **not used in this repo**: when they would trigger, use
`openspec-explore` / `openspec-propose` instead. This outranks the plugin. The other superpowers skills
(systematic-debugging, TDD, verification-before-completion, …) remain in force. `docs/superpowers/` holds the specs and
plans written before OpenSpec; it is history, new ones are not added there.

**`openspec/specs/` is the living source of truth** for what it covers, next to `.agents/project/*.md`. Read the
relevant capability spec before changing it. A change that alters a rule in `.agents/project/*.md` updates that file
too.

**The CLI is `pnpm openspec`, never bare `openspec`.** It is a pinned root devDependency, not a global install. Wherever
an OpenSpec skill says `openspec <args>`, run `pnpm openspec <args>` from the repo root. Change and capability names
must not contain words from the deny rules (`sync`, `accounts`, `settings`, …): the command would be refused.

**Generated files are never edited by hand:** `.claude/skills/openspec-*`, `.claude/commands/opsx/`. `pnpm
openspec:update` regenerates them; project guidance goes in `openspec/config.yaml`. Updating the OpenSpec version
(`pnpm add -Dw --save-exact @fission-ai/openspec@<version>` → `pnpm openspec:update`) is the user's manual step —
never bump it or run `openspec:update` unprompted. Telemetry is off (`OPENSPEC_TELEMETRY=0` in `.claude/settings.json`
and in the script).

**Commits:** a spec-only change is `docs(openspec): <description>`; implementation commits keep `feat(<scope>): <block>`.

## Code Changes

- Read the file before editing it
- Do not refactor code that wasn't asked about
- Do not add comments, docstrings, or type annotations to untouched code
- Do not add error handling for impossible scenarios
- Do not create abstractions for one-off operations

## When Uncertain

- Ask one focused question, not a list
- Prefer making a reasonable assumption and stating it, over asking

## File Creation

- Prefer editing existing files over creating new ones
- Never create README or documentation files unless explicitly asked

## Skills Auto-Activation

Before writing any code, check if a skill in `.agents/skills/` applies to the current task.
Each skill file has an **Auto-Activation Triggers** section — if any trigger matches, apply that skill's patterns and rules automatically without waiting to be asked.

When a skill is active:
- Follow its output style and naming rules
- Flag violations of its forbidden patterns
- Use its file structure and composable architecture
