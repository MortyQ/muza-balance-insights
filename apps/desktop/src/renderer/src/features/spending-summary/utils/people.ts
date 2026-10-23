import type { SpendingOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { t } from '@/shared/lib';
import { REST_COLOR } from '../constants.ts';
import type { BlockPerson, PersonRowView } from '../types.ts';
import { diffChip } from './chips.ts';
import { partial } from './month.ts';
import { percentOf } from './totals.ts';

/** A person of the view as the block knows them; one removed meanwhile → «?» in grey. */
export const personOf = (people: ReadonlyArray<BlockPerson>, id: number): BlockPerson => people.find((p) => p.id === id) ?? { id, name: '?', color: REST_COLOR };

/** The people list: `home.spending.whole` first, then each person. */
export function peopleRows(view: Readonly<SpendingOverview>, pick: number | null, people: ReadonlyArray<BlockPerson>, fmt: MoneyFormat): PersonRowView[] {
  const family: PersonRowView = {
    participantId: null,
    name: t('home.spending.whole'),
    color: '',
    dots: people.map((p) => p.color),
    caption: t('home.spending.together', { ops: t('home.spending.opsShort', { n: view.total.purchases }) }),
    amount: fmt.money(view.total.net),
    chip: diffChip(view.total.net, view.total.prev?.net ?? null, view.month, fmt, partial(view)),
    pressed: pick === null,
  };
  return [
    family,
    ...view.people.map((p): PersonRowView => {
      const who = personOf(people, p.participantId);
      return {
        participantId: p.participantId,
        name: who.name,
        color: who.color,
        dots: [],
        caption: t('home.spending.personShare', { pct: percentOf(p.net, view.total.net), ops: t('home.spending.opsShort', { n: p.purchases }) }),
        amount: fmt.money(p.net),
        chip: diffChip(p.net, p.prev?.net ?? null, view.month, fmt, partial(view)),
        pressed: pick === p.participantId,
      };
    }),
  ];
}
