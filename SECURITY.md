# Security Policy

Balance Insights handles bank statements and a Monobank API token, so security reports are taken seriously.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting instead:
[Report a vulnerability](https://github.com/MortyQ/muza-balance-insights/security/advisories/new)
(Security tab → «Report a vulnerability»).

Please include:
- the app version and OS;
- what an attacker can do and under which conditions;
- steps to reproduce.

**Never include your real token, statements, amounts, names or card numbers** — a fake example is enough.

You will get a reply within 7 days. Fixes for confirmed issues ship in a patch release, and the advisory is published after that.

## Supported versions

Only the latest release gets security fixes.

## Scope

In scope: anything that lets data or the token leave the computer, lets web content run code in the app (CSP, IPC, navigation, preload), weakens the network allowlist (`api.monobank.ua` only), or tampers with the installed app.

Out of scope: an attacker who already controls your user account on the computer; Monobank's own API.

## If your token may have leaked

Revoke it at [api.monobank.ua](https://api.monobank.ua/) and create a new one. The token gives read access to your statement and balances.
