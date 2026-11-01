// Category kinds (category-kinds.ts): the defaults cover every spending category, a choice wins and is marked, reset
// one or all, refusals, a full re-derivation leaves the choices alone.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { CATEGORY } from '../../src/derive/categories.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { CategoryKindError, categoryKinds, DEFAULT_KINDS, kindMap, resetCategoryKinds, setCategoryKind } from '../../src/read/category-kinds.ts';
import { memoryDb } from '../helpers.ts';

let db: Db;
beforeEach(async () => {
  db = await memoryDb();
});
afterEach(() => db.close());

describe('category kinds', () => {
  it('every spending category has a default; own transfers, income and family have none', () => {
    const without: string[] = [CATEGORY.ownTransfers, CATEGORY.income, CATEGORY.family];
    expect(new Set(DEFAULT_KINDS.keys())).toEqual(new Set(Object.values(CATEGORY).filter((c) => !without.includes(c))));
  });

  it('defaults without any choice: rent essential and fixed, cafes a want, investments savings', async () => {
    const k = await kindMap(db);
    expect(k.get(CATEGORY.rent)).toEqual({ kind: 'essential', fixed: true });
    expect(k.get(CATEGORY.cafes)).toEqual({ kind: 'wants', fixed: false });
    expect(k.get(CATEGORY.investments)).toEqual({ kind: 'savings', fixed: false });
    expect((await categoryKinds(db)).some((r) => r.changed)).toBe(false);
  });

  it('a choice wins and is marked; setting the default back clears the mark', async () => {
    await setCategoryKind(db, CATEGORY.clothing, { kind: 'essential', fixed: false }, 100);
    expect((await categoryKinds(db)).find((r) => r.category === CATEGORY.clothing)).toEqual({ category: CATEGORY.clothing, kind: 'essential', fixed: false, changed: true });
    await setCategoryKind(db, CATEGORY.clothing, { kind: 'wants', fixed: false }, 200);
    expect((await categoryKinds(db)).find((r) => r.category === CATEGORY.clothing)?.changed).toBe(false);
    expect((await db.execute('SELECT COUNT(*) AS n FROM category_kinds')).rows[0]?.n).toBe(0);
  });

  it('reset one, reset all', async () => {
    await setCategoryKind(db, CATEGORY.clothing, { kind: 'essential', fixed: false }, 100);
    await setCategoryKind(db, CATEGORY.sport, { kind: 'wants', fixed: true }, 100);
    await resetCategoryKinds(db, CATEGORY.clothing);
    expect((await categoryKinds(db)).filter((r) => r.changed).map((r) => r.category)).toEqual([CATEGORY.sport]);
    await resetCategoryKinds(db, null);
    expect((await categoryKinds(db)).some((r) => r.changed)).toBe(false);
  });

  it('refuses a category without a kind, an unknown kind; nothing stored', async () => {
    await expect(setCategoryKind(db, CATEGORY.income, { kind: 'essential', fixed: false }, 1)).rejects.toBeInstanceOf(CategoryKindError);
    await expect(setCategoryKind(db, 'nonsense', { kind: 'essential', fixed: false }, 1)).rejects.toBeInstanceOf(CategoryKindError);
    await expect(setCategoryKind(db, CATEGORY.cafes, { kind: 'luxury' as never, fixed: false }, 1)).rejects.toBeInstanceOf(CategoryKindError);
    await expect(resetCategoryKinds(db, CATEGORY.ownTransfers)).rejects.toBeInstanceOf(CategoryKindError);
    expect((await db.execute('SELECT COUNT(*) AS n FROM category_kinds')).rows[0]?.n).toBe(0);
  });

  it('a full re-derivation leaves the choices alone', async () => {
    await setCategoryKind(db, CATEGORY.clothing, { kind: 'essential', fixed: true }, 100);
    await rederiveCore(db);
    expect((await kindMap(db)).get(CATEGORY.clothing)).toEqual({ kind: 'essential', fixed: true });
  });
});
