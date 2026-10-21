# Baseline

Measured with `pnpm --filter @mono/core bench`.

- **Dataset:** `bench/generate.ts` `DEFAULT_BENCH`. Fictional data: 40 001 operations over 1 095 days, a 1 000-byte
  payload per operation, two participants, a jar disabled by the auto rule.
- **Machine:** the author's Mac, Node 22.14.
- **Timing:** the best of several runs of each case. Three encrypted runs differed by under 4%.

## Before the change (encrypted file, 63.1 MB)

| case                     |      ms | temporary budget |
|--------------------------|--------:|-----------------:|
| month by category        |   178.6 |              220 |
| month income by source   |   177.4 |              215 |
| 12 months by month       |   627.4 |              755 |
| 12 months by day         |   703.8 |              870 |
| spending block set       |  9 444  |           11 250 |
| balances at two instants |     1.2 |                5 |
| full re-derivation       |  3 071  |            3 700 |

The same dataset in a plain file, for comparison:

| case                     | ms     |
|--------------------------|-------:|
| month by category        |   12.9 |
| month income by source   |   12.2 |
| 12 months by month       |   54.2 |
| 12 months by day         |  131.1 |
| spending block set       |  586.5 |
| balances at two instants |    1.2 |
| full re-derivation       |  1 163 |

Notes:

- The «spending block set» replays the 19 statistics that the desktop's «Spending» block asks of the core today.
- Every generated row has a stored balance, so `balancesAt` never takes the reverse-sum path here. That path is
  covered by `balances-at.test.ts`, not timed.

## After the change (encrypted file, 66.8 MB)

Same dataset, machine and timing; the best of three encrypted runs. `bench/budgets.ts` now holds the final budgets.

| case                       |  before |  after | budget |
|----------------------------|--------:|-------:|-------:|
| month by category          |   178.6 |    1.5 |     10 |
| month income by source     |   177.4 |    0.8 |     10 |
| 12 months by month         |   627.4 |   26.3 |    100 |
| 12 months by day           |   703.8 |   38.5 |    150 |
| spending block set         |  9 444  |   21.7 |    120 |
| balances at two instants   |     1.2 |    1.2 |      5 |
| full re-derivation         |  3 071  |  1 414 |  3 000 |
| end of a routine auto-sync |  3 071  |   45.4 |    250 |

The same dataset in a plain file, after:

| case                       |     ms |
|----------------------------|-------:|
| month by category          |    1.7 |
| month income by source     |    0.8 |
| 12 months by month         |   19.0 |
| 12 months by day           |   33.3 |
| spending block set         |   22.6 |
| balances at two instants   |    1.3 |
| full re-derivation         |  1 161 |
| end of a routine auto-sync |   24.0 |

Against the targets of design D8: a month summary 1.5 ms (≤ 20), the «Spending» block's core calls 22 ms (≤ 300),
12 months by day 39 ms (≤ 150), the end of a routine auto-sync 45 ms (≤ 300).

Notes:

- «spending block set» follows the block as it is now: the month and the one before for the family and each person,
  then one grid by month for the six usual months and one income query by month (group 5). Before, the same answer
  took 19 statistics; most of the gain is still the per-query speed of groups 2–4.
- «end of a routine auto-sync» is new: `rederiveSpans` over the last 31 days, which is what an auto-sync re-reads.
  Before the change the end of every import was the full re-derivation, so its «before» is that row.
- The full re-derivation got faster in the encrypted file although it gained the crossing step; in the plain file it
  did not change (1 163 → 1 161). The likely reason is fewer encrypted pages to read once the payload moved out of
  `transactions` (group 2); this was not measured group by group.
- The encrypted file is 3.7 MB larger: `transaction_raw` has its own primary-key index. Making it `WITHOUT ROWID`
  would save most of that; it is not done (it would change migration 16).
- Budgets are about five times the measured time (twice for the full re-derivation), never above the D8 targets.
  Timings stay out of `pnpm test`; the deterministic guards are the query-plan, query-count and equivalence tests.
