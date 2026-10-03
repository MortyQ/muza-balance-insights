import type { ComputedRef, Ref } from 'vue';
import type { Scope, SpendingAmounts, SpendingOverview } from '@contract/api.ts';
import type { Loadable, YearMonth } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';

/** A change chip (shared/ui `VChangeChip`). */
export type ChipView = ChangeChipModel;

/**
 * `home.spending.ops` and its small difference («+2», `home.spending.opsSame`, `home.spending.change.new`; empty — no
 * comparison); `sr` — the direction for screen readers ('' — none).
 */
export interface OpsView {
  text: string;
  diff: string;
  tone: 'up' | 'down' | 'neutral';
  title: string;
  sr: string;
}

export interface BarSegment {
  /** flex-grow weight */
  value: number;
  color: string;
  title: string;
}

export interface PersonLineView {
  participantId: number;
  name: string;
  initial: string;
  color: string;
  amount: string;
  conv: string[];
  ops: OpsView;
  chip: ChipView | null;
  /** % of the largest person's amount in this category; mark — last month's (null: no tick). */
  width: number;
  mark: number | null;
  markTitle: string;
  faded: boolean;
}

export interface RowView {
  key: string;
  name: string;
  icon: string;
  color: string;
  share: string;
  amount: string;
  conv: string[];
  ops: OpsView;
  chip: ChipView | null;
  /** % of the largest row (this month or last); mark — last month's position. */
  width: number;
  mark: number | null;
  markTitle: string;
  segments: BarSegment[];
  people: PersonLineView[];
}

export interface PersonRowView {
  /** null — «Whole family». */
  participantId: number | null;
  name: string;
  initial: string;
  color: string;
  /** The family row: every person's colour. */
  dots: string[];
  caption: string;
  amount: string;
  chip: ChipView | null;
  pressed: boolean;
}

export interface SpendingPrefs {
  split: boolean;
  mark: boolean;
  usd: boolean;
  eur: boolean;
}

/** A person as the block shows them (from the participant store). */
export interface BlockPerson {
  id: number;
  name: string;
  color: string;
}

export interface UseSpendingReturn {
  month: Readonly<Ref<YearMonth>>;
  /** The current Kyiv month (the year of `compared` is shown when it differs). */
  thisMonth: Readonly<Ref<YearMonth>>;
  scope: Ref<Scope>;
  state: Readonly<Ref<Loadable<SpendingOverview>>>;
  view: ComputedRef<SpendingOverview | null>;
  periodNote: ComputedRef<string | null>;
  importing: ComputedRef<boolean>;
  /** The global filter is «Whole family» and there is more than one person. */
  family: ComputedRef<boolean>;
  /** One person of a family is picked in the global filter. */
  member: ComputedRef<boolean>;
  people: ComputedRef<ReadonlyArray<BlockPerson>>;
  /** The person the global filter shows (one person of a family, or the only one); null — the whole family. */
  selected: ComputedRef<BlockPerson | null>;
  /** The block's own pick (family view): a participant id or null. */
  pick: Ref<number | null>;
  /** The expanded category key (family view), or null. */
  open: Ref<string | null>;
}

/** The block's display state from `useSpending` and the menu choices: everything the template binds. */
export interface UseSpendingViewReturn {
  /** «Whole family», the picked person, a family member of the global filter; '' — the only person. */
  who: ComputedRef<string>;
  /** «September · Whole family». */
  subtitle: ComputedRef<string>;
  /** The month has spending in the family view (the block shows even when a pick has none). */
  hasData: ComputedRef<boolean>;
  rows: ComputedRef<RowView[]>;
  /** «Olya: no spending this month» — a pick with no rows; '' otherwise. */
  noneBy: ComputedRef<string>;
  total: ComputedRef<(SpendingAmounts & { prev: SpendingAmounts | null }) | null>;
  ring: ComputedRef<string>;
  chip: ComputedRef<ChipView | null>;
  conv: ComputedRef<Array<{ text: string; chip: ChipView | null; title: string }>>;
  perDay: ComputedRef<string | null>;
  whoRows: ComputedRef<PersonRowView[]>;
  leftOut: ComputedRef<string[]>;
  noCompare: ComputedRef<string>;
  /** `home.spending.compareFull` — the period compared with; '' — no comparison. */
  compared: ComputedRef<string>;
  prevIn: ComputedRef<string>;
  /** The period compared with while this month is in progress (the tooltip of `prevIn`); '' — the whole month. */
  prevInTitle: ComputedRef<string>;
  opsVs: ComputedRef<Pick<OpsView, 'text' | 'tone' | 'sr'>>;
  /** The member card: «46% of the family's spending» and «family — 101 830 ₴»; null — no card. */
  memberCard: ComputedRef<{ initial: string; color: string; share: string; family: string } | null>;
  onPick: (id: number | null) => void;
  onToggle: (key: string) => void;
}
