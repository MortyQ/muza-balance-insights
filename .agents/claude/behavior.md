# Claude-Specific Behavior

## Response Style

- Be concise — no filler, no preamble
- Lead with the action or answer, not the explanation
- Use markdown only when it adds clarity
- No trailing summaries of what was just done

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
