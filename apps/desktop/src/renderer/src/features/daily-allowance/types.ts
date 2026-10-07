import type { ComputedRef, Ref } from 'vue';
import type { ReserveInput } from '@contract/allowance.ts';
import type { AllowanceOverview } from '@contract/api.ts';
import type { Loadable } from '@/shared/lib';

/** One line of «How it is counted»: a label and its amount with the sign it enters with. */
export interface BreakdownLine {
  label: string;
  amount: string;
  /** The result lines (free, per day): bold. */
  strong: boolean;
}

export interface AllowanceView {
  /** The sum per day, or what is short: in the screen's currency. */
  amount: string;
  /** Short of money: `amount` is the shortfall. */
  short: boolean;
  /** «until 10 April · 26 days» / «until the month's end · 17 days». */
  until: string;
  /** About the income: next, late or none. */
  income: string;
  lines: BreakdownLine[];
  /** Card currencies without a rate, left out; '' — none. */
  leftOut: string;
}

/** One reserve of the list. */
export interface ReserveRowView {
  id: number;
  name: string;
  /** In its own currency. */
  amount: string;
  /** ≈ in the screen's currency when that differs (and has a rate); '' — none. */
  approx: string;
  /** «no end» / «until 1 December» / «ended 1 December». */
  term: string;
  /** Counted now (not ended). */
  active: boolean;
  /** Whose, shown in a family view of several: the person, or common; null — not shown. */
  owner: { name: string; color: string } | { common: true } | null;
  /** As saved: the form starts from it. */
  input: ReserveInput;
}

export interface UseAllowanceReturn {
  state: Readonly<Ref<Loadable<AllowanceOverview>>>;
  /** The answer is there. */
  visible: ComputedRef<boolean>;
  view: ComputedRef<AllowanceView | null>;
  reserves: ComputedRef<ReserveRowView[]>;
  /** The screen's currency: a new reserve starts in it. */
  currency: ComputedRef<number>;
  /** The people a reserve can belong to — a family of several only; empty: the one person owns every new reserve. */
  owners: ComputedRef<ReadonlyArray<{ id: number; name: string }>>;
  /** Whose a new reserve is at first: the picked person (one person: them), else common. */
  owner: ComputedRef<number | null>;
  /** Adds (`id` null) or changes a reserve, then reloads; false — refused or failed. */
  saveReserve: (id: number | null, r: ReserveInput) => Promise<boolean>;
  /** Deletes a reserve, then reloads; false — failed. */
  deleteReserve: (id: number) => Promise<boolean>;
}
