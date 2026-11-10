# Design

## Context

See proposal.md. Core `read/search.ts` (`searchTransactions`) already serves the MCP tool: NFKC + lower-case text
matching in JS, amount matching, names masked to initials. The desktop's bank-text channels (category, income, recent,
insights, recurring, allowance) cut descriptions with `merchantText`. Follows `.agents/project/desktop-import.md`
(channels, canary tests) and `desktop-renderer.md` (FSD: a widget, since it reads several entities; i18n).

## Decisions

- **Reuse core search, not a new query**: one matching rule for the MCP tool and the desktop; the desktop maps results
  through `merchantText` and drops the masked counterparty field entirely.
- **Date parsing in the renderer** (`shared/lib`), sent as `from` / `to`: the language of the input is the UI's.
- **Widget `widgets/global-search`** in `GlobalFilters`: it reads categories (`entities/category`) and links
  (`shared/config`), so it cannot be an entity.

## Risks / Trade-offs

- [A new bank-text channel] → explicit user ok before apply; canary test; results only in memory (the read cache keeps
  nothing of it — the method is not in `CACHED_READS`).
- [Slow on 36 months] → the core search scans in JS; the bench gets a case, budget in `bench/budgets.ts`.
