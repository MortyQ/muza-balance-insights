// Category kinds (E1 of «Фінансова грамотність»): every spending category is essential, a want or savings, and fixed or
// not. Core holds the defaults; the user's changes live in category_kinds (v19), apart from transactions, read at query
// time — so a change needs no re-derivation. Not spending categories (own transfers, income, family) have no kind.
import { CATEGORY } from '../derive/categories.ts';
import type { Db } from '../storage/db.ts';

export const CATEGORY_KIND_VALUES = ['essential', 'wants', 'savings'] as const;
export type CategoryKind = (typeof CATEGORY_KIND_VALUES)[number];
export type KindChoice = { kind: CategoryKind; fixed: boolean };
/** A category's kind as it reads now: the user's choice or the default; `changed` — differs from the default. */
export type CategoryKindRow = KindChoice & { category: string; changed: boolean };

export class CategoryKindError extends Error {
  override name = 'CategoryKindError';
}

const C = CATEGORY;
const essential = (fixed = false): KindChoice => ({ kind: 'essential', fixed });
const wants = (fixed = false): KindChoice => ({ kind: 'wants', fixed });

/** The defaults, in the category list's order. Bank and transfer fees have a kind: spending counts them. */
export const DEFAULT_KINDS: ReadonlyMap<string, KindChoice> = new Map<string, KindChoice>([
  [C.groceries, essential()],
  [C.cafes, wants()],
  [C.transport, essential()],
  [C.health, essential()],
  [C.beauty, wants()],
  [C.clothing, wants()],
  [C.home, wants()],
  [C.telecom, essential(true)],
  [C.entertainment, wants()],
  [C.travel, wants()],
  [C.sport, wants()],
  [C.pets, essential()],
  [C.insurance, essential(true)],
  [C.taxes, essential()],
  [C.cash, wants()],
  [C.delivery, wants()],
  [C.education, essential(true)],
  [C.gifts, wants()],
  [C.utilities, essential(true)],
  [C.marketplaces, wants()],
  [C.charity, wants()],
  [C.rent, essential(true)],
  [C.car, essential()],
  [C.kids, essential()],
  [C.subscriptions, wants(true)],
  [C.investments, { kind: 'savings', fixed: false }],
  [C.fees, essential()],
  [C.transferFees, essential()],
  [C.p2p, wants()],
  [C.installments, essential(true)],
  [C.other, wants()],
]);

/** Every category with a kind, the user's choices over the defaults, in the defaults' order. */
export async function categoryKinds(db: Db): Promise<CategoryKindRow[]> {
  const rs = await db.execute('SELECT category, kind, fixed FROM category_kinds');
  const own = new Map(rs.rows.map((r) => [String(r.category), { kind: String(r.kind) as CategoryKind, fixed: Number(r.fixed) === 1 }]));
  return [...DEFAULT_KINDS].map(([category, d]) => {
    const k = own.get(category) ?? d;
    return { category, kind: k.kind, fixed: k.fixed, changed: k.kind !== d.kind || k.fixed !== d.fixed };
  });
}

/** The kinds as a lookup by category. */
export async function kindMap(db: Db): Promise<Map<string, KindChoice>> {
  return new Map((await categoryKinds(db)).map((r) => [r.category, { kind: r.kind, fixed: r.fixed }]));
}

/** Sets a category's kind and flag; the default itself removes the row. An unknown category or kind → CategoryKindError. */
export async function setCategoryKind(db: Db, category: string, choice: KindChoice, nowSec: number): Promise<void> {
  const d = DEFAULT_KINDS.get(category);
  if (!d) throw new CategoryKindError('not a category with a kind');
  if (!CATEGORY_KIND_VALUES.includes(choice.kind)) throw new CategoryKindError(`kind: ${CATEGORY_KIND_VALUES.join(' | ')}`);
  if (typeof choice.fixed !== 'boolean') throw new CategoryKindError('fixed: boolean');
  if (choice.kind === d.kind && choice.fixed === d.fixed) {
    await db.execute({ sql: 'DELETE FROM category_kinds WHERE category = ?', args: [category] });
    return;
  }
  await db.execute({
    sql: `INSERT INTO category_kinds (category, kind, fixed, set_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(category) DO UPDATE SET kind = excluded.kind, fixed = excluded.fixed, set_at = excluded.set_at`,
    args: [category, choice.kind, choice.fixed ? 1 : 0, nowSec],
  });
}

/** Back to the default: one category, or all with null. An unknown category → CategoryKindError. */
export async function resetCategoryKinds(db: Db, category: string | null): Promise<void> {
  if (category === null) {
    await db.execute('DELETE FROM category_kinds');
    return;
  }
  if (!DEFAULT_KINDS.has(category)) throw new CategoryKindError('not a category with a kind');
  await db.execute({ sql: 'DELETE FROM category_kinds WHERE category = ?', args: [category] });
}
