# Proposal

## Why

The budget, the limits and the Insights feed shipped in 0.1.13, and some of their figures mislead. Pending holds count
as spending, so a limit can read as exceeded and an insight can appear and then vanish when the bank finalises or
cancels the hold. A cash withdrawal always counts as spending, although the money only moves into a wallet. Taxes eat a
FOP owner's budget, though the owner may plan for them apart from it. Two common transport MCCs fall into «Other».
Limits warn only once they are exceeded, though the forecast already shows it coming. These figures need to be right
before the live check of the budget and Insights screens.

## What Changes

- **Pending holds.** Fresh holds (the last 3 days, the window a sync re-reads, as `pendingHolds` already counts) leave
  the spent amount, the forecast and the state of every limit and of the monthly budget, the «Limit exceeded» and new
  «Forecast above the limit» cards, and the Insights detectors' month. A note beside them says how many are pending and
  for how much. «Spending» on home and in Analytics is unchanged: it still counts holds.
- **Cash withdrawals: a switch.** A new switch «Count cash withdrawals as spending» in the «Categories» section, on by
  default, so nothing changes until the user turns it off. Off: the «Cash» category leaves every spending figure (home,
  Analytics, budget, limits, 50/30/20, Insights, the MCP tools), as transfers between own accounts do. The month block
  on home then shows «Withdrawn in cash» for the month, so the money does not vanish. There is no «cash on hand»
  figure: what was spent in cash is unknown.
- **Taxes in the budget: a switch.** The monthly budget sheet gets «Count taxes», on by default. Off: «Taxes and
  government payments» is left out of the budget's flexible part and cannot be a fixed row. Category limits, «Spending»
  and 50/30/20 are unchanged.
- **Transport MCCs.** MCC 4111 (local commuter transport) and 4789 (transportation services) map to «Taxi and
  transport».
- **Rule changes reach old operations.** A change of the category rules bumps a rules version. The next import, an
  auto-sync included, then runs one full re-derivation, so stored categories equal a full pass again. Without this, the
  desktop would keep old categories until the accounts change.
- **«Forecast above the limit».** The Insights feed lists each monthly limit (and the budget's flexible part) whose
  forecast is above it while not yet exceeded. It appears only in the current month, once a quarter of the month has
  passed, the rule that already makes the «attention» state. The card is ranked among the others by the forecast
  overrun.

Out of scope:
- holds in «Spending» on home and in Analytics;
- a «cash on hand» balance or manual cash spending;
- the tax reserve or the FOP calculator;
- the week start of weekly limits;
- other MCC changes;
- notifications at 80% / 100%;
- the terminology and tooltip block («transactions», «×N»), which comes next.

## Capabilities

### New Capabilities

- `core-cash-withdrawals`: whether cash withdrawals count as spending. A stored switch, on by default. Off removes the
  «Cash» category from every spending figure and gives the month's withdrawn total.

### Modified Capabilities

- `core-spending-limits`:
  - what a limit counts: pending holds are left out, and the pending count and amount are given;
  - the budget's «Count taxes» switch.
- `core-derived-data`:
  - a category rules version; a change makes the next import run a full re-derivation;
  - MCC 4111 and 4789 map to transport.
- `desktop-limits-goals`:
  - the pending-holds note on the budget, the limits and the category screen's limit bar;
  - the «Count taxes» switch in the budget sheet.
- `desktop-insights-page`:
  - the feed and the limit cards count the month without pending holds, and the note says so;
  - the new «Forecast above the limit» card.
- `desktop-category-kinds`: the cash switch in the «Categories» section.
- `desktop-balance-cards`: «Withdrawn in cash» in the month block while cash does not count as spending.

## Impact

- **`packages/core`:**
  - `read/spending.ts` (`spendingLinesSql`: a pending-holds filter and the cash rule);
  - `people/settings.ts` (a new key);
  - `read/limits.ts`, `read/goals.ts` and a migration `v21` (`goals.count_taxes`);
  - `derive/categories.ts` (MCC rows and the rules version) and the import path that decides on a full pass;
  - tests in `tests/read`, `tests/derive`, `tests/storage`.
- **`apps/desktop`:**
  - `src/data/data.ts`, `src/data/limits.ts` (sums without holds, the pending note, taxes, the forecast cards);
  - `src/worker/run-import.ts` (the full pass on a new rules version);
  - IPC and `shared/api.ts` (the cash switch, `countTaxes`, the pending figures, a forecast card type);
  - the renderer: `features/limits-goals`, `features/home-budget`, `features/insights-page`, `features/settings`
    (Categories), `features/balances`;
  - the i18n keys in `uk`, `en` and `ru`.
- **`apps/mcp`:**
  - the spending tools follow the cash switch through core;
  - the `settings:*` script lists the new key by itself;
  - the `scripts` block of `package.json` does not change.
- **Trust anchors:** none change. `recategorize` prints nothing new.
- **Analysis copy:** no new columns.
- **User-visible.** `CHANGELOG.md` gets entries under `## 0.1.14 — unreleased`:
  - pending payments no longer push limits and the budget over;
  - the cash switch;
  - the budget's taxes switch;
  - the «Forecast above the limit» signal;
  - commuter transport is categorised.
