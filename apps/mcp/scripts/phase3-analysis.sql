-- Phase 3 analysis queries over analysis/analysis.sqlite (the anonymized copy).
-- Reference only: run each query separately via pnpm q: put it into analysis/queries/<name>.sql
-- (q accepts exactly one SELECT/WITH per call).

-- Q6a: balance breaks per account, row order (time, id). Inflated by same-second reordering — see Q6c.
WITH o AS (
  SELECT t.id, t.account_id, t.time, t.amount, t.balance, t.hold,
         LAG(t.balance) OVER w AS prev_balance, LAG(t.time) OVER w AS prev_time, LAG(t.hold) OVER w AS prev_hold
  FROM transactions t WHERE t.is_cancelled = 0
  WINDOW w AS (PARTITION BY t.account_id ORDER BY t.time, t.id)
), b AS (
  SELECT o.*, o.balance - (o.prev_balance + o.amount) AS gap
  FROM o WHERE o.prev_balance IS NOT NULL AND o.prev_balance + o.amount <> o.balance
)
SELECT a.kind, a.type, a.currency_code AS cur, COUNT(*) AS breaks, SUM(b.time = b.prev_time) AS same_sec,
       SUM(b.hold = 1 OR b.prev_hold = 1) AS hold_inv,
       SUM(EXISTS (SELECT 1 FROM transactions x WHERE x.account_id = b.account_id AND x.id <> b.id AND x.amount = b.gap)) AS gap_eq_tx
FROM b JOIN accounts a ON a.id = b.account_id
GROUP BY b.account_id ORDER BY breaks DESC;

-- Q6b: one account's chain in row order (replace the account id).
SELECT t.time, t.local_date AS d, t.description AS descr, t.amount, t.balance,
       LAG(t.balance) OVER w AS prev_bal, t.balance - (LAG(t.balance) OVER w + t.amount) AS gap,
       t.time - LAG(t.time) OVER w AS dt
FROM transactions t
WHERE t.account_id = '<account id>' AND t.is_cancelled = 0
WINDOW w AS (ORDER BY t.time, t.id)
ORDER BY t.time, t.id LIMIT 45;

-- Q6c: chain checked per (account, second) group, order inside the group ignored.
-- end_bal = the balance no other row of the group starts from.
WITH live AS (SELECT * FROM transactions WHERE is_cancelled = 0),
g AS (
  SELECT account_id, time, COUNT(*) AS n, SUM(amount) AS s,
         (SELECT COUNT(*) FROM live e WHERE e.account_id = l.account_id AND e.time = l.time
            AND NOT EXISTS (SELECT 1 FROM live f WHERE f.account_id = e.account_id AND f.time = e.time
                              AND f.id <> e.id AND f.balance - f.amount = e.balance)) AS n_end,
         (SELECT e.balance FROM live e WHERE e.account_id = l.account_id AND e.time = l.time
            AND NOT EXISTS (SELECT 1 FROM live f WHERE f.account_id = e.account_id AND f.time = e.time
                              AND f.id <> e.id AND f.balance - f.amount = e.balance) LIMIT 1) AS end_bal
  FROM live l GROUP BY account_id, time
),
c AS (SELECT g.*, LAG(end_bal) OVER (PARTITION BY account_id ORDER BY time) AS prev_end FROM g)
SELECT a.kind, a.type, COUNT(*) AS groups, SUM(n > 1) AS multi_groups, SUM(n_end <> 1) AS ambiguous,
       SUM(prev_end IS NOT NULL AND prev_end + s <> end_bal) AS group_breaks
FROM c JOIN accounts a ON a.id = c.account_id
GROUP BY c.account_id ORDER BY group_breaks DESC;

-- Q6d: last statement balance vs current account balance.
SELECT a.kind, a.type, a.currency_code AS cur, a.balance AS acc_balance,
       (SELECT t.balance FROM transactions t
         WHERE t.account_id = a.id AND t.is_cancelled = 0
           AND NOT EXISTS (SELECT 1 FROM transactions f WHERE f.account_id = t.account_id AND f.is_cancelled = 0
                             AND f.time = t.time AND f.id <> t.id AND f.balance - f.amount = t.balance)
         ORDER BY t.time DESC LIMIT 1) AS last_tx_balance
FROM accounts a ORDER BY a.kind, a.type;

-- Q7: cross-currency candidates (different account currencies, opposite signs, <= 20 s).
SELECT t1.local_date AS d, a1.type AS t_out, a1.currency_code AS c_out, a2.kind AS k_in, a2.type AS t_in,
       a2.currency_code AS c_in, t2.time - t1.time AS dt, t1.description AS d_out, t2.description AS d_in,
       t1.amount AS out_amt, t1.operation_amount AS out_op, t1.currency_code AS out_opcur, t1.commission_rate AS out_comm,
       t2.amount AS in_amt, t2.operation_amount AS in_op, t2.currency_code AS in_opcur, t2.commission_rate AS in_comm,
       (t1.operation_amount = -t2.amount) AS outop_eq_in, (t2.operation_amount = -t1.amount) AS inop_eq_out
FROM transactions t1
JOIN accounts a1 ON a1.id = t1.account_id
JOIN transactions t2 ON t2.account_id <> t1.account_id AND ABS(t2.time - t1.time) <= 20
                    AND t2.amount > 0 AND t2.is_cancelled = 0
JOIN accounts a2 ON a2.id = t2.account_id AND a2.currency_code <> a1.currency_code
WHERE t1.amount < 0 AND t1.is_cancelled = 0
ORDER BY t1.time;

-- Q8: jar operations without an exact mirror on another account (<= 60 s) and what is nearby.
WITH lonely AS (
  SELECT j.* FROM transactions j JOIN accounts ja ON ja.id = j.account_id AND ja.kind = 'jar'
  WHERE j.is_cancelled = 0
    AND NOT EXISTS (SELECT 1 FROM transactions c WHERE c.account_id <> j.account_id AND c.amount = -j.amount
                      AND ABS(c.time - j.time) <= 60 AND c.is_cancelled = 0)
)
SELECT l.local_date AS d, l.time AS jar_time, l.description AS jar_descr, l.amount AS jar_amt,
       c.time - l.time AS dt, a.type AS c_type, c.description AS c_descr, c.amount AS c_amt, c.mcc AS c_mcc
FROM lonely l
LEFT JOIN transactions c ON c.account_id <> l.account_id AND ABS(c.time - l.time) <= 60 AND c.is_cancelled = 0
LEFT JOIN accounts a ON a.id = c.account_id
ORDER BY l.time, c.time;

-- Q9: installments — for each «Щомісячний платіж» series, a purchase on the same account 0–60 days before
-- the first payment with |amount| ≈ payment × N (N = 2..24, tolerance ±N minor units).
-- A hit means the full price was already charged → counting the payments as spending double-counts it.
WITH RECURSIVE n(k) AS (SELECT 2 UNION ALL SELECT k + 1 FROM n WHERE k < 24),
p AS (
  SELECT t.*, (SELECT MIN(p2.time) FROM transactions p2
                WHERE p2.account_id = t.account_id AND p2.description = 'Щомісячний платіж'
                  AND ABS(p2.amount - t.amount) <= 1) AS first_time
  FROM transactions t WHERE t.description = 'Щомісячний платіж' AND t.is_cancelled = 0
),
series AS (SELECT account_id, first_time, MIN(amount) AS pay_amt, COUNT(*) AS payments FROM p GROUP BY account_id, first_time)
SELECT s.pay_amt, s.payments, date(s.first_time, 'unixepoch') AS first_pay, n.k AS N, c.local_date AS cand_d,
       (s.first_time - c.time) / 86400 AS days_before, c.amount AS cand_amt,
       ABS(c.amount) - ABS(s.pay_amt) * n.k AS diff, c.mcc, c.desc_class
FROM series s JOIN n
JOIN transactions c ON c.account_id = s.account_id AND c.is_cancelled = 0 AND c.amount < 0
                   AND c.time BETWEEN s.first_time - 60 * 86400 AND s.first_time
                   AND ABS(ABS(c.amount) - ABS(s.pay_amt) * n.k) <= n.k
ORDER BY s.pay_amt, n.k;
