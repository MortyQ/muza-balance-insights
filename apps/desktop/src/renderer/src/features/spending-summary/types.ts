import type { ComputedRef, Ref } from 'vue';
import type { Scope, SpendingOverview, SpendingView } from '@contract/api.ts';
import type { Loadable, YearMonth } from '@/shared/lib';

/** A change chip: the text and its tone; `arrow` — show the up / down arrow. */
export interface ChipView {
  text: string;
  tone: 'up' | 'down' | 'neutral';
  arrow: 'up' | 'down' | null;
  title?: string;
}

/** «38 операций» and its small difference («+2», «столько же», «новое»; empty — no comparison). */
export interface OpsView {
  text: string;
  diff: string;
  tone: 'up' | 'down' | 'neutral';
  title: string;
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

// Old block (removed in Task 10): the table's composable still returns this shape.
export interface UseSpendingLegacyReturn {
  month: Readonly<Ref<YearMonth>>;
  scope: Ref<Scope>;
  state: Readonly<Ref<Loadable<SpendingView>>>;
  view: ComputedRef<SpendingView | null>;
  periodNote: ComputedRef<string | null>;
  importing: ComputedRef<boolean>;
}
