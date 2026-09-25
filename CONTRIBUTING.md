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
