import type { SpendingAmounts, SpendingOverview, SpendingPersonPart } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { bankOf } from '@/entities/bank';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { t } from '@/shared/lib';
import { BELOW_TOP_COLOR, CATEGORY_COLORS, REST_COLOR, TOP } from '../constants.ts';
import type { BarSegment, BlockPerson, RowView, SpendingPrefs, SpendingSplit } from '../types.ts';
import { amountChip, opsView } from './chips.ts';
import { partial, prevIn } from './month.ts';
import { personOf } from './people.ts';
import { shareOf, totalFor } from './totals.ts';

const fade = (color: string) => `color-mix(in oklch, ${color} 22%, var(--surface))`;
/** % of `max`, one decimal. */
const pctOf = (value: number, max: number) => Math.round((value / max) * 1000) / 10;

/** `net` / `purchases` / `prev` — the pick's (family or person); `family` — the family's, which sets the bar scale. */
type Line = {
  key: string;
  categoryId: CategoryId | null;
  name: string;
  icon: string;
  color: string;
  net: number;
  purchases: number;
  prev: SpendingAmounts | null;
  family: { net: number; prev: SpendingAmounts | null };
  parts: SpendingPersonPart[];
  banks: BankPart[];
};

type BankPart = SpendingAmounts & { provider: string };

/** «Other»: each bank's parts summed over the rest categories, banks in their first order. */
function sumBanks(lists: ReadonlyArray<ReadonlyArray<BankPart>>): BankPart[] {
  const by = new Map<string, SpendingAmounts>();
  for (const l of lists) {
    for (const b of l) {
      const a = by.get(b.provider) ?? { net: 0, purchases: 0 };
      by.set(b.provider, { net: a.net + b.net, purchases: a.purchases + b.purchases });
    }
  }
  return [...by].map(([provider, a]) => ({ provider, ...a }));
}

/**
 * The split the bars are drawn with: the choice where it applies, else together (spec desktop-spending-split). By
 * people needs two or more people; by banks two or more banks on and no person picked in the block (the bank parts are
 * the whole view's).
 */
export function effectiveSplit(split: SpendingSplit, ctx: { people: number; banksOn: boolean; pick: number | null }): SpendingSplit {
  if (split === 'people') return ctx.people > 1 ? 'people' : 'together';
  if (split === 'banks') return ctx.banksOn && ctx.pick === null ? 'banks' : 'together';
  return 'together';
}

/** «Other»: each person's parts summed over the rest categories (they come in the same participant order). */
function sumParts(lists: ReadonlyArray<ReadonlyArray<SpendingPersonPart>>): SpendingPersonPart[] {
  const first = lists[0] ?? [];
  return first.map((p0, i) => {
    let net = 0;
    let purchases = 0;
    let prevNet = 0;
    let prevPurchases = 0;
    let hasPrev = true;
    for (const l of lists) {
      const p = l[i];
      if (!p) continue;
      net += p.net;
      purchases += p.purchases;
      if (p.prev) {
        prevNet += p.prev.net;
        prevPurchases += p.prev.purchases;
      } else hasPrev = false;
    }
    return { participantId: p0.participantId, net, purchases, prev: hasPrev ? { net: prevNet, purchases: prevPurchases } : null };
  });
}

function sumPrev(prevs: ReadonlyArray<SpendingAmounts | null>): SpendingAmounts | null {
  let net = 0;
  let purchases = 0;
  for (const p of prevs) {
    if (!p) return null;
    net += p.net;
    purchases += p.purchases;
  }
  return { net, purchases };
}

/** The rows of the list for the family (pick null) or one picked person; colours stay those of the family's rank. */
export function rowsFor(
  view: Readonly<SpendingOverview>,
  pick: number | null,
  people: ReadonlyArray<BlockPerson>,
  prefs: Readonly<SpendingPrefs>,
  fmt: MoneyFormat,
  banksOn = false,
): RowView[] {
  const split = effectiveSplit(prefs.split, { people: view.people.length, banksOn, pick });
  const lines: Line[] = view.categories
    .map((c, i): Line => {
      const own = pick === null ? c : c.people.find((p) => p.participantId === pick);
      return {
        key: c.category,
        categoryId: c.categoryId,
        name: categoryName(c),
        icon: CATEGORY_ICON[c.categoryId ?? 'other'],
        color: CATEGORY_COLORS[i] ?? BELOW_TOP_COLOR,
        net: own?.net ?? 0,
        purchases: own?.purchases ?? 0,
        prev: own ? own.prev : null,
        family: { net: c.net, prev: c.prev },
        parts: c.people,
        banks: c.banks,
      };
    })
    .filter((l) => l.net > 0)
    .sort((a, b) => b.net - a.net);

  const top = lines.slice(0, TOP);
  const rest = lines.slice(TOP);
  if (rest.length > 0) {
    top.push({
      key: 'rest',
      categoryId: null,
      name: t('home.spending.rest', rest.length),
      icon: CATEGORY_ICON.rest,
      color: REST_COLOR,
      net: rest.reduce((s, l) => s + l.net, 0),
      purchases: rest.reduce((s, l) => s + l.purchases, 0),
      prev: sumPrev(rest.map((l) => l.prev)),
      family: { net: rest.reduce((s, l) => s + l.family.net, 0), prev: sumPrev(rest.map((l) => l.family.prev)) },
      parts: sumParts(rest.map((l) => l.parts)),
      banks: sumBanks(rest.map((l) => l.banks)),
    });
  }

  const total = totalFor(view, pick).net;
  // One scale for the family and a pick: the family's amounts, so a picked person's bar is their part of the family's.
  const max = Math.max(1, ...top.map((l) => Math.max(l.family.net, l.family.prev?.net ?? 0)));
  return top.map((l): RowView => {
    // A pick's own segment comes first (it starts at 0, where its mark is measured from), the others follow faded.
    const parts = pick === null ? l.parts : [...l.parts].sort((a, b) => Number(b.participantId === pick) - Number(a.participantId === pick));
    // By people only with more than one person (main sends no parts for the only one); by banks in each bank's colour.
    const parted: BarSegment[] =
      split === 'people'
        ? parts.filter((p) => p.net > 0).map((p): BarSegment => {
            const who = personOf(people, p.participantId);
            return { value: p.net, color: pick === null || pick === p.participantId ? who.color : fade(who.color), title: `${who.name} — ${fmt.money(p.net)}` };
          })
        : split === 'banks'
          ? l.banks.filter((b) => b.net > 0).map((b): BarSegment => {
              const bank = bankOf(b.provider);
              return { value: b.net, color: bank.color, title: `${bank.name} — ${fmt.money(b.net)}` };
            })
          : [];
    const segments: BarSegment[] = parted.length > 0 ? parted : [{ value: 1, color: l.color, title: '' }];
    // Split by people with a pick: the bar is the family's amount; otherwise the pick's own.
    const barNet = pick !== null && split === 'people' && parted.length > 0 ? l.family.net : l.net;
    return {
      key: l.key,
      categoryId: l.categoryId,
      name: l.name,
      icon: l.icon,
      color: l.color,
      share: shareOf(l.net, total),
      amount: fmt.money(l.net),
      conv: fmt.approx(l.net),
      ops: opsView(l.purchases, l.prev?.purchases ?? null, view.month, partial(view)),
      chip: amountChip(l.net, l.prev?.net ?? null, view.month, fmt, partial(view)),
      width: pctOf(barNet, max),
      mark: prefs.mark && l.prev && l.prev.net > 0 ? pctOf(l.prev.net, max) : null,
      markTitle: l.prev && l.prev.net > 0 ? t('home.spending.markTitle', { month: prevIn(view.month), amount: fmt.money(l.prev.net) }) : '',
      segments,
    };
  });
}
