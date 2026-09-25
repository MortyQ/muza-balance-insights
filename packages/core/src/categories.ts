// Transaction categories: manual overrides by counter_name, the provider's hint from the shape of the operation
// (transfers, installments, taxes — providers/<id>/rules.ts), then the MCC table (ISO 18245, not bank-specific).
// Recomputed after the internal-transfer pass (category depends on is_internal_transfer).
import type { Db, Stmt } from './db.ts';
import { accountProviders, providerOf } from './connections.ts';
import { rulesFor } from './providers/rules.ts';
import type { CategoryHint, ProviderId } from './providers/types.ts';
import type { TimeRange } from './transfers.ts';

export const DEFAULT_CATEGORY = 'другое';

export const CATEGORY = {
  groceries: 'продукты',
  cafes: 'кафе и рестораны',
  transport: 'такси и транспорт',
  health: 'аптеки и здоровье',
  beauty: 'красота',
  clothing: 'одежда',
  home: 'дом и техника',
  telecom: 'связь и цифровые сервисы',
  entertainment: 'развлечения',
  travel: 'путешествия',
  sport: 'спорт',
  pets: 'зоотовары',
  insurance: 'страхование',
  taxes: 'налоги и госплатежи',
  cash: 'наличные',
  delivery: 'доставка',
  education: 'образование',
  gifts: 'цветы и подарки',
  utilities: 'коммунальные',
  marketplaces: 'маркетплейсы',
  charity: 'благотворительность',
  fees: 'комиссии банка', // never assigned to a row: the commission part of a row, split in aggregates
  p2p: 'переводы людям',
  installments: 'рассрочки и кредиты',
  ownTransfers: 'свои переводы',
  income: 'поступления',
  other: DEFAULT_CATEGORY,
} as const;

const HINT_CATEGORY: Readonly<Record<CategoryHint, string>> = {
  installments: CATEGORY.installments,
  taxes: CATEGORY.taxes,
  income: CATEGORY.income,
  p2p: CATEGORY.p2p,
};

/**
 * MCCs seen in real data (phase 3 reports). Anything else falls back to «другое».
 * Deliberately unmapped (ambiguous, decided): 7399, 5999, 8999, 7299, 5311, 5331, 5399, 2791.
 * Transfers (4829) and 6012 come from the provider's hint, not from here.
 */
const MCC_CATEGORY: ReadonlyMap<number, string> = new Map([
  [5411, CATEGORY.groceries], // supermarkets
  [5499, CATEGORY.groceries], // misc food stores
  [5451, CATEGORY.groceries], // dairy
  [5462, CATEGORY.groceries], // bakeries
  [5310, CATEGORY.groceries], // discount stores
  [5441, CATEGORY.groceries], // candy / confectionery
  [5812, CATEGORY.cafes], // restaurants
  [5813, CATEGORY.cafes], // bars
  [5814, CATEGORY.cafes], // fast food
  [5811, CATEGORY.cafes], // caterers
  [4121, CATEGORY.transport], // taxi
  [4131, CATEGORY.transport], // bus lines
  [4112, CATEGORY.transport], // passenger railways
  [5541, CATEGORY.transport], // service stations (fuel)
  [5912, CATEGORY.health], // pharmacies
  [8021, CATEGORY.health], // dentists
  [8043, CATEGORY.health], // opticians
  [8071, CATEGORY.health], // medical labs
  [5977, CATEGORY.beauty], // cosmetics
  [5651, CATEGORY.clothing], // family clothing
  [5691, CATEGORY.clothing], // men's & women's clothing
  [5931, CATEGORY.clothing], // second-hand
  [5948, CATEGORY.clothing], // leather goods
  [5722, CATEGORY.home], // household appliances
  [5732, CATEGORY.home], // electronics
  [5211, CATEGORY.home], // building materials
  [4812, CATEGORY.telecom], // telecom equipment
  [4814, CATEGORY.telecom], // telecom services
  [5816, CATEGORY.telecom], // digital games
  [5817, CATEGORY.telecom], // digital apps
  [5818, CATEGORY.telecom], // digital goods
  [5734, CATEGORY.telecom], // computer software stores
  [7829, CATEGORY.entertainment], // film / video
  [7991, CATEGORY.entertainment], // tourist attractions
  [7841, CATEGORY.entertainment], // video rental / streaming
  [5735, CATEGORY.entertainment], // record stores
  [5994, CATEGORY.entertainment], // news dealers, newsstands
  [4722, CATEGORY.travel], // travel agencies
  [7011, CATEGORY.travel], // hotels
  [7941, CATEGORY.sport], // sports clubs
  [5995, CATEGORY.pets], // pet shops
  [742, CATEGORY.pets], // veterinary services
  [6300, CATEGORY.insurance], // insurance
  [9311, CATEGORY.taxes], // tax payments
  [9399, CATEGORY.taxes], // government services
  [6010, CATEGORY.cash], // manual cash disbursement
  [4215, CATEGORY.delivery], // courier services
  [9402, CATEGORY.delivery], // postal services
  [8299, CATEGORY.education], // schools and educational services
  [5943, CATEGORY.education], // stationery / school supplies
  [5992, CATEGORY.gifts], // florists
  [5944, CATEGORY.gifts], // jewelry
  [4900, CATEGORY.utilities], // utilities
  [5262, CATEGORY.marketplaces], // marketplaces
  [8398, CATEGORY.charity], // charitable organizations
]);

export type CategoryOverride = { pattern: string; matchType: 'exact' | 'contains'; category: string };

export type CategorizeInput = {
  description: string;
  mcc: number;
  amount: number;
  counterName: string | null;
  isInternalTransfer: boolean;
  /** Whose rules apply (the account's connection's provider). */
  provider: ProviderId;
};

export function categorize(tx: CategorizeInput, overrides: readonly CategoryOverride[] = []): string {
  if (tx.isInternalTransfer) return CATEGORY.ownTransfers;

  const override = matchOverride(tx.counterName, overrides);
  if (override) return override.category;

  const hint = rulesFor(tx.provider).categoryHint(tx);
  if (hint) return HINT_CATEGORY[hint];
  return MCC_CATEGORY.get(tx.mcc) ?? DEFAULT_CATEGORY;
}

/**
 * Override lookup shared by category overrides (key = counter_name) and scope overrides
 * (key = counter_name, or the description when there is no counterparty).
 * Exact matches win over contains; among contains, the longest pattern wins. Case-insensitive, trimmed.
 */
export function matchOverride<O extends { pattern: string; matchType: 'exact' | 'contains' }>(
  key: string | null,
  overrides: readonly O[],
): O | null {
  const name = key?.trim().toLowerCase();
  if (!name) return null;
  const exact = overrides.find((o) => o.matchType === 'exact' && o.pattern.trim().toLowerCase() === name);
  if (exact) return exact;
  const contains = overrides
    .filter((o) => o.matchType === 'contains' && o.pattern.trim() !== '' && name.includes(o.pattern.trim().toLowerCase()))
    .sort((a, b) => b.pattern.trim().length - a.pattern.trim().length);
  return contains[0] ?? null;
}

export async function loadOverrides(db: Db): Promise<CategoryOverride[]> {
  const rs = await db.execute('SELECT pattern, match_type, category FROM category_overrides');
  return rs.rows.map((r) => ({
    pattern: String(r.pattern),
    matchType: r.match_type === 'exact' ? 'exact' : 'contains',
    category: String(r.category),
  }));
}

/**
 * Recomputes category for rows in the range (all rows if none). Writes only rows that change.
 * A refund paired with its purchase (refund_pair_id, the credit side) takes the purchase's category,
 * so it lands in that category's refunds instead of «поступления».
 */
export async function recategorize(db: Db, range?: TimeRange | null): Promise<number> {
  const [overrides, providers] = await Promise.all([loadOverrides(db), accountProviders(db)]);
  const cols = 'id, account_id, description, mcc, amount, counter_name, is_internal_transfer, category, refund_pair_id';
  const rs = range
    ? await db.execute({ sql: `SELECT ${cols} FROM transactions WHERE time BETWEEN ? AND ?`, args: [range.from, range.to] })
    : await db.execute(`SELECT ${cols} FROM transactions`);

  const computed = new Map<string, string>();
  for (const r of rs.rows) {
    computed.set(
      String(r.id),
      categorize(
        {
          description: String(r.description ?? ''),
          mcc: Number(r.mcc),
          amount: Number(r.amount),
          counterName: r.counter_name === null ? null : String(r.counter_name),
          isInternalTransfer: Number(r.is_internal_transfer) === 1,
          provider: providerOf(providers, String(r.account_id)),
        },
        overrides,
      ),
    );
  }

  // Refund credits: the purchase's category (computed above, or stored if the purchase is outside the range).
  const refunds = rs.rows.filter((r) => r.refund_pair_id !== null && Number(r.amount) > 0);
  const outside = refunds.map((r) => String(r.refund_pair_id)).filter((id) => !computed.has(id));
  const stored = new Map<string, string>();
  if (outside.length > 0) {
    const ps = await db.execute({
      sql: `SELECT id, category FROM transactions WHERE id IN (${outside.map(() => '?').join(', ')})`,
      args: outside,
    });
    for (const r of ps.rows) stored.set(String(r.id), String(r.category));
  }
  for (const r of refunds) {
    const purchase = String(r.refund_pair_id);
    const category = computed.get(purchase) ?? stored.get(purchase);
    if (category) computed.set(String(r.id), category);
  }

  const stmts: Stmt[] = [];
  for (const r of rs.rows) {
    const category = computed.get(String(r.id));
    if (category !== undefined && category !== r.category) {
      stmts.push({ sql: 'UPDATE transactions SET category = ? WHERE id = ?', args: [category, String(r.id)] });
    }
  }
  if (stmts.length > 0) await db.batch(stmts);
  return stmts.length;
}
