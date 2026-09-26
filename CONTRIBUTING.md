# Contributing to Balance Insights

Thanks for your interest. Bug reports from real use and focused fixes are the most welcome contributions.

## ⚠️ Your data stays yours

This app works with bank statements. In issues, pull requests, logs and screenshots **never share**:
- your Monobank token;
- statements, amounts, balances;
- names of people or shops, card numbers, IBANs;
- screenshots of the app with real data.

Describe the problem with the app version, OS, steps and the error text. If data matters, make up a small example.

## Before you start

- Check [existing issues](https://github.com/MortyQ/muza-balance-insights/issues) to avoid duplicates.
- For large changes, open an issue first to discuss the approach.
- Security issues go to [SECURITY.md](SECURITY.md), not to issues.

## Setup

```bash
git clone https://github.com/MortyQ/muza-balance-insights.git
cd muza-balance-insights
pnpm install
pnpm test
pnpm typecheck
```

Node 22 (`.nvmrc`), pnpm 12. The desktop app: `pnpm --filter @mono/desktop dev`.

## Windows

- Install pnpm globally via npm: `npm i -g pnpm@12.6.0` (matches `packageManager` in the root `package.json`; Corepack is not used here).
- Use Node 22 (`.nvmrc`).
- Install with the committed lockfile — `pnpm install --frozen-lockfile` — and don't let pnpm regenerate `pnpm-lock.yaml` on Windows.
- Desktop dev: `pnpm --filter @mono/desktop dev`, same as above. If the Electron binary download fails, run `pnpm --filter @mono/desktop binary:install`.
- Using Claude Code here? `.claude/settings.json` turns on an OS-level sandbox (macOS Seatbelt) that native Windows doesn't have. Prefer working inside WSL2, where the Linux sandbox applies normally.
  If you must work on native Windows, add your own git-ignored `.claude/settings.local.json` with `{"sandbox": {"failIfUnavailable": false}}` — this runs agent commands **without the OS sandbox**; only the `permissions` allow/deny rules in `.claude/settings.json` still apply. Never edit `.claude/settings.json` itself to weaken it in a PR.
- The data rule at the top of this file still applies: no tokens, statements, amounts, names, or screenshots with real data in issues or PRs.

## Pull request guidelines

- One concern per PR — don't mix features with refactors.
- `pnpm test` and `pnpm typecheck` pass.
- New behavior has tests. Test fixtures use made-up names and amounts only.
- Security settings are not relaxed without discussion: CSP, IPC checks, the preload API, the network allowlist, Electron fuses.
- Update `CHANGELOG.md` under `[Unreleased]`.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(desktop): monthly comparison screen
fix(core): refund matched to the wrong purchase
docs: install steps for Linux
test(core): FX transfer pair
```

## Reporting bugs and suggesting features

Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template.
