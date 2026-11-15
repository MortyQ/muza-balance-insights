// Plans (goals.ts): limits, the budget with its fixed rows, savings goals — add, list, change, delete; one per kind and
// owner; what is refused, by the code and by the table.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { CATEGORY } from '../../src/derive/categories.ts';
import { DEFAULT_KINDS } from '../../src/read/category-kinds.ts';
import { addGoal, deleteGoal, GoalError, listGoals, updateGoal, type GoalInput } from '../../src/read/goals.ts';
import { insertAccount, memoryDb } from '../helpers.ts';

let db: Db;
beforeEach(async () => {
  db = await memoryDb();
});
afterEach(() => db.close());

const CAFES: GoalInput = { type: 'limit', category: CATEGORY.cafes, period: 'month', currency: 980, amount: 400_000, participantId: null };
const BUDGET: GoalInput = { type: 'budget', currency: 978, amount: 200_000, participantId: null, fixed: [{ category: CATEGORY.rent, amount: 125_000 }], excluded: [] };

describe('goals', () => {
  it('add, list oldest first with the budget\'s rows, change, delete', async () => {
    const a = await addGoal(db, CAFES, 1);
    const b = await addGoal(db, BUDGET, 2);
    expect(await listGoals(db)).toEqual([a, b]);
    const changed = await updateGoal(db, b.id, { ...BUDGET, amount: 210_000, fixed: [{ category: CATEGORY.rent, amount: 130_000 }, { category: CATEGORY.utilities, amount: 11_000 }] });
    expect((await listGoals(db))[1]).toEqual(changed);
    await deleteGoal(db, b.id);
    expect(await listGoals(db)).toEqual([a]);
    expect((await db.execute('SELECT COUNT(*) AS n FROM goal_fixed')).rows[0]?.n).toBe(0);
  });

  it('one limit per category, period and owner; one budget per owner', async () => {
    await addGoal(db, CAFES, 1);
    await expect(addGoal(db, { ...CAFES, amount: 1 }, 2)).rejects.toBeInstanceOf(GoalError);
    await addGoal(db, { ...CAFES, period: 'week' }, 3);
    await addGoal(db, BUDGET, 4);
    await expect(addGoal(db, BUDGET, 5)).rejects.toBeInstanceOf(GoalError);
    expect(await listGoals(db)).toHaveLength(3);
  });

  it('a savings goal from a jar or from cards and jars; the name trimmed', async () => {
    await insertAccount(db, 'jar1', 'jar');
    const g = await addGoal(db, { type: 'saving', name: '  Відпустка ', currency: 980, amount: 5_000_000, participantId: null, until: '2027-06-01', source: 'jar', accountId: 'jar1' }, 1);
    expect(g).toMatchObject({ name: 'Відпустка', source: 'jar', accountId: 'jar1' });
    const own = await addGoal(db, { type: 'saving', name: 'Резерв', currency: 980, amount: 1_000_000, participantId: null, until: null, source: 'own', accountId: 'jar1' }, 2);
    expect(own).toMatchObject({ accountId: null });
  });

  it('refuses a bad amount, category, period, row, name, date, jar or person; nothing stored', async () => {
    for (const bad of [
      { ...CAFES, amount: 0 },
      { ...CAFES, amount: 1.5 },
      { ...CAFES, currency: 826 as never },
      { ...CAFES, category: CATEGORY.income },
      { ...CAFES, period: 'year' as never },
      { ...CAFES, participantId: 99 },
      { ...BUDGET, fixed: [{ category: CATEGORY.rent, amount: 0 }] },
      { ...BUDGET, fixed: [{ category: CATEGORY.rent, amount: 1 }, { category: CATEGORY.rent, amount: 2 }] },
      { ...BUDGET, excluded: [CATEGORY.rent] },
      { ...BUDGET, excluded: [CATEGORY.travel, CATEGORY.travel] },
      { ...BUDGET, excluded: [CATEGORY.income] },
      { ...BUDGET, excluded: ['not a category'] },
      { ...BUDGET, excluded: undefined as never },
      { type: 'saving', name: ' ', currency: 980, amount: 1, participantId: null, until: null, source: 'own', accountId: null },
      { type: 'saving', name: 'x', currency: 980, amount: 1, participantId: null, until: '2026-02-30', source: 'own', accountId: null },
      { type: 'saving', name: 'x', currency: 980, amount: 1, participantId: null, until: null, source: 'jar', accountId: 'nope' },
    ] as GoalInput[]) {
      await expect(addGoal(db, bad, 1)).rejects.toBeInstanceOf(GoalError);
    }
    expect(await listGoals(db)).toEqual([]);
  });

  it('the table refuses what the code would: a limit without a period', async () => {
    await expect(db.execute(`INSERT INTO goals (type, category, currency, amount, created_at) VALUES ('limit', 'кафе и рестораны', 980, 1, 1)`)).rejects.toThrow();
  });

  it('exclusions: kept with the budget in the category list\'s order, replaced on update, gone with it', async () => {
    const b = await addGoal(db, { ...BUDGET, excluded: [CATEGORY.travel, CATEGORY.taxes] }, 1);
    const inListOrder = [...DEFAULT_KINDS.keys()].filter((w) => w === CATEGORY.travel || w === CATEGORY.taxes);
    expect(b).toMatchObject({ excluded: inListOrder });
    expect((await listGoals(db))[0]).toEqual(b);
    const changed = await updateGoal(db, b.id, { ...BUDGET, excluded: [CATEGORY.groceries], fixed: [{ category: CATEGORY.taxes, amount: 10_000 }] });
    expect((await listGoals(db))[0]).toEqual(changed);
    expect(changed).toMatchObject({ excluded: [CATEGORY.groceries], fixed: [{ category: CATEGORY.taxes, amount: 10_000 }] });
    await updateGoal(db, b.id, BUDGET);
    expect((await listGoals(db))[0]).toMatchObject({ excluded: [] });
    await updateGoal(db, b.id, { ...BUDGET, excluded: [CATEGORY.travel] });
    await deleteGoal(db, b.id);
    expect((await db.execute('SELECT COUNT(*) AS n FROM goal_excluded')).rows[0]?.n).toBe(0);
  });

  it('a refused budget leaves the stored one as it was', async () => {
    const b = await addGoal(db, { ...BUDGET, excluded: [CATEGORY.travel] }, 1);
    await expect(updateGoal(db, b.id, { ...BUDGET, excluded: [CATEGORY.rent] })).rejects.toBeInstanceOf(GoalError);
    expect((await listGoals(db))[0]).toEqual(b);
  });

  it('the table cascade takes the exclusions with a budget; count_taxes is written as 1', async () => {
    const b = await addGoal(db, { ...BUDGET, excluded: [CATEGORY.taxes] }, 1);
    expect(Number((await db.execute({ sql: 'SELECT count_taxes AS c FROM goals WHERE id = ?', args: [b.id] })).rows[0]?.c)).toBe(1);
    await db.execute({ sql: 'DELETE FROM goals WHERE id = ?', args: [b.id] });
    expect((await db.execute('SELECT COUNT(*) AS n FROM goal_excluded')).rows[0]?.n).toBe(0);
  });

  it('a budget row written as v20 wrote it reads with no exclusions', async () => {
    await db.execute(`INSERT INTO goals (type, period, currency, amount, created_at) VALUES ('budget', 'month', 980, 1000, 2)`);
    expect((await listGoals(db))[0]).toMatchObject({ type: 'budget', excluded: [] });
  });

  it('a goal keeps its type; an unknown id is refused', async () => {
    const a = await addGoal(db, CAFES, 1);
    await expect(updateGoal(db, a.id, BUDGET)).rejects.toBeInstanceOf(GoalError);
    await expect(deleteGoal(db, 999)).rejects.toBeInstanceOf(GoalError);
  });
});
